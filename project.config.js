module.exports = Object.freeze({
  framework: Object.freeze({
    repository: 'https://github.com/hambaliFadib/playwright-quality-framework',
    sha: 'b5b46cc60b834ffe5ae0fcfc38d8d87921bd490d',
  }),
  application: Object.freeze({
    repository: 'https://github.com/hambaliFadib/portofolio-web',
    ref: 'feat/approved-identity-journey-v1',
    sha: '484ec044ae955cd376e1c9814033932102be60df',
    unitModule: 'lib/date-ranges.ts',
  }),
  suites: Object.freeze(['unit', 'http-smoke', 'ui-e2e']),
});
