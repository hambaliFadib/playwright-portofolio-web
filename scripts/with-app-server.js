const { spawn, spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const project = require('../project.config');

const qaRoot = path.resolve(__dirname, '..');

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function sanitizeEnvironment(source) {
  const safe = { ...source };
  for (const key of Object.keys(safe)) {
    if (/(token|secret|password|api[_-]?key|private[_-]?key)/i.test(key)) delete safe[key];
  }
  return safe;
}

function listenStatus(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => {
      probe.close((error) => error ? reject(error) : resolve());
    });
  });
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHealthy(server, baseURL, logPath) {
  const deadline = Date.now() + 60_000;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error('Owned production server exited before health check. See ' + logPath);
    }
    try {
      const response = await fetch(baseURL);
      if (response.ok) {
        console.log('Owned production server healthy: ' + response.status + ' ' + baseURL);
        return;
      }
      lastError = 'HTTP ' + response.status;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Production server health check timed out: ' + lastError + '. See ' + logPath);
}

async function stopOwnedServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  console.log('Stopping owned production server PID ' + server.pid);
  server.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null && server.signalCode === null) {
    console.log('Owned production server did not stop in time; terminating PID ' + server.pid);
    server.kill('SIGKILL');
    await exited;
  }
}

async function main() {
  const appRoot = process.env.PORTFOLIO_APP_ROOT;
  if (!appRoot) throw new Error('Set PORTFOLIO_APP_ROOT to the separate application checkout.');
  const resolvedAppRoot = path.resolve(appRoot);
  const relative = path.relative(qaRoot, resolvedAppRoot);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('The application checkout must be outside the QA repository worktree.');
  }

  const appSha = git(resolvedAppRoot, ['rev-parse', 'HEAD']);
  if (appSha !== project.application.sha) {
    throw new Error('Application SHA mismatch. Expected ' + project.application.sha + '; found ' + appSha);
  }
  const buildIdPath = path.join(resolvedAppRoot, '.next', 'BUILD_ID');
  if (!fs.existsSync(buildIdPath)) {
    throw new Error('The pinned application production build is missing. Run npm ci and npm run build in the app checkout first.');
  }

  let port;
  const configuredBaseURL = (process.env.BASE_URL || '').trim();
  if (configuredBaseURL) {
    const configured = new URL(configuredBaseURL);
    if (configured.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost'].includes(configured.hostname) ||
        (configured.pathname !== '/' && configured.pathname !== '')) {
      throw new Error('BASE_URL must be a local HTTP origin for the owned production server.');
    }
    port = Number(configured.port || 80);
    await listenStatus(port);
  } else {
    port = await findFreePort();
  }

  const baseURL = 'http://127.0.0.1:' + port;
  const nextCli = path.join(resolvedAppRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!fs.existsSync(nextCli)) throw new Error('Pinned Next.js CLI was not found in the application checkout.');

  const artifacts = path.join(qaRoot, 'artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const logPath = path.join(artifacts, 'portfolio-app-server.log');
  const logFd = fs.openSync(logPath, 'w');
  const serverEnv = {
    PATH: process.env.PATH || process.env.Path || '',
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
  };
  if (process.platform === 'win32') {
    serverEnv.SystemRoot = process.env.SystemRoot || '';
    serverEnv.WINDIR = process.env.WINDIR || '';
    serverEnv.TEMP = process.env.TEMP || '';
    serverEnv.TMP = process.env.TMP || '';
  }

  let server;
  try {
    server = spawn(process.execPath, [
      nextCli,
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ], {
      cwd: resolvedAppRoot,
      env: serverEnv,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });
    server.once('error', (error) => {
      console.error('Could not start owned production server: ' + error.message);
    });
    console.log('Started owned production server PID ' + server.pid + ' for app SHA ' + appSha);
    await waitForHealthy(server, baseURL, logPath);

    const env = sanitizeEnvironment(process.env);
    env.BASE_URL = baseURL;
    env.PORTFOLIO_APP_ROOT = resolvedAppRoot;
    env.PORTFOLIO_APP_SHA = appSha;
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const validation = spawnSync(npmCommand, ['run', 'validate'], {
      cwd: qaRoot,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    process.exitCode = validation.status === null ? 1 : validation.status;
  } finally {
    await stopOwnedServer(server);
    fs.closeSync(logFd);
    console.log('Production server log: ' + logPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});