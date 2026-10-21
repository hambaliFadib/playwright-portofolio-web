const { execFileSync } = require('node:child_process');
const project = require('../project.config');
const EXPECTED_REPOSITORY = 'hambaliFadib/portofolio-web';
const SHA = /^[0-9a-f]{40}$/i;
function requireSha(label, value) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(label + ' must be a full 40-character commit SHA.');
  return value.toLowerCase();
}
function resolveExpectedApplicationSha(env) {
  const source = env || process.env;
  const candidate = source.PORTFOLIO_APP_TEST_SHA || project.application.sha;
  return requireSha('Expected application test SHA', candidate);
}
function validateRevisionContract(x) {
  if (!x || typeof x !== 'object') throw new Error('Revision contract is missing.');
  if (x.applicationRepository !== EXPECTED_REPOSITORY || x.eventRepository !== EXPECTED_REPOSITORY) throw new Error('Caller repository identity mismatch.');
  if (x.eventName !== 'pull_request') throw new Error('Only pull_request events are accepted.');
  if (x.baseRef !== 'dev') throw new Error('Application PR must target dev.');
  const caller = requireSha('Caller event SHA', x.callerSha);
  const tested = requireSha('Application tested SHA', x.appTestSha);
  const head = requireSha('Application PR head SHA', x.appPrHeadSha);
  const eventHead = requireSha('Event PR head SHA', x.eventHeadSha);
  const appCheckout = requireSha('Application checkout SHA', x.appCheckoutSha);
  const qaPin = requireSha('Pinned QA source SHA', x.qaSourceSha);
  const qaCheckout = requireSha('QA checkout SHA', x.qaCheckoutSha);
  if (tested !== caller) throw new Error('Requested application revision does not match caller event SHA.');
  if (head !== eventHead) throw new Error('Application PR head SHA does not match caller event head SHA.');
  if (appCheckout !== tested) throw new Error('Application checkout SHA does not match tested revision.');
  if (qaCheckout !== qaPin) throw new Error('QA checkout SHA does not match immutable source pin.');
  return { applicationRepository: EXPECTED_REPOSITORY, applicationPrHeadSha: head, applicationTestedSha: tested, qaSourceSha: qaPin };
}
function gitSha(root) {
  if (!root) throw new Error('Checkout root is required.');
  return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function main() {
  const qaRoot = process.env.PORTFOLIO_QA_ROOT || process.cwd();
  const appRoot = process.env.PORTFOLIO_APP_ROOT;
  const result = validateRevisionContract({
    applicationRepository: process.env.PORTFOLIO_APP_REPOSITORY,
    eventRepository: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME,
    baseRef: process.env.PORTFOLIO_EVENT_BASE_REF,
    callerSha: process.env.GITHUB_SHA,
    appTestSha: process.env.PORTFOLIO_APP_TEST_SHA,
    appPrHeadSha: process.env.PORTFOLIO_APP_PR_HEAD_SHA,
    eventHeadSha: process.env.PORTFOLIO_EVENT_HEAD_SHA,
    appCheckoutSha: gitSha(appRoot),
    qaSourceSha: process.env.PORTFOLIO_QA_SOURCE_SHA,
    qaCheckoutSha: gitSha(qaRoot),
  });
  console.log('Revision contract verified: ' + JSON.stringify(result));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { EXPECTED_REPOSITORY, requireSha, resolveExpectedApplicationSha, validateRevisionContract, gitSha };
