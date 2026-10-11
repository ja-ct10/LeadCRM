// Start matching local frontend/API code; never inherit a hosted frontend API_URL.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
const children = new Set();
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    // Only terminate process trees created by this launcher.
    if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}

function launch(args, env = process.env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping && args[0] !== npmCli) stop(code ?? (signal ? 1 : 0));
  });
  return child;
}

function freePort(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the existing local preview before running npm run dev:local.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

async function main() {
  if (!npmCli) throw new Error('Start this launcher with npm run dev:local.');
  await Promise.all([freePort(3000), freePort(4000)]);
  console.log('Building the current backend/shared code for the local preview…');
  const build = launch([npmCli, '--prefix', 'backend', 'run', 'build']);
  const built = await new Promise(resolve => build.once('exit', resolve));
  if (stopping) return;
  if (built !== 0) throw new Error('Backend build failed; the local preview was not started.');

  launch([path.join(root, 'scripts/start-connected-api.cjs')]);
  let ready = false;
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:4000/health', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Wait for local API startup. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (stopping) return;
  if (!ready) throw new Error('The local API did not become ready.');
  console.log('Local preview: http://localhost:3000 → http://127.0.0.1:4000/api/v1');
  console.log('Uses backend/.env database configuration; no startup seeds or scheduled jobs.');
  const frontend = launch([npmCli, '--prefix', 'frontend', 'run', 'dev'], {
    ...process.env, API_URL: 'http://127.0.0.1:4000/api/v1', NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false',
  });
  frontend.once('exit', code => { if (!stopping) stop(code ?? 1); });
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
main().catch(error => { console.error(error.message); stop(1); });
