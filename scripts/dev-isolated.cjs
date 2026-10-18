// Persistent, loopback-only development. Never reads the hosted backend .env.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.env.local-development');
const databaseDirectory = path.join(directory, 'postgres');
const runtimeFile = path.join(directory, 'runtime.json');
const stopFile = path.join(directory, 'stop.json');
const npmCli = process.env.npm_execpath;
const children = new Set();
let postgresBin, settings, stopping = false, startedDatabase = false;
const environment = {};
for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432']) {
  if (process.env[key] !== undefined) environment[key] = process.env[key];
}
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, env: environment, windowsHide: true, stdio: 'pipe', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(executable)} failed: ${(result.stderr ?? result.stdout ?? '').toString().slice(-2000)}`);
  return result.stdout?.toString() ?? '';
}
const postgres = name => path.join(postgresBin, name + (process.platform === 'win32' ? '.exe' : ''));
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Local port ${port} is in use. Stop the existing local instance before restarting.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
function launch(args, cwd, extra = {}) {
  const child = spawn(process.execPath, args, { cwd, env: { ...environment, ...extra }, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { children.delete(child); if (!stopping) stop(code ?? 1); });
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  if (startedDatabase) {
    const verified = fs.realpathSync(databaseDirectory);
    if (verified !== path.join(fs.realpathSync(directory), 'postgres')) throw new Error('Local database directory changed; refusing to stop it.');
    spawnSync(postgres('pg_ctl'), ['-D', verified, '-m', 'fast', '-w', 'stop'], { env: environment, windowsHide: true, stdio: 'ignore' });
  }
  if (fs.existsSync(runtimeFile) && JSON.parse(fs.readFileSync(runtimeFile, 'utf8')).pid === process.pid) {
    fs.unlinkSync(runtimeFile);
    if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
  }
  process.exit(code);
}
async function main() {
  if (!npmCli) throw new Error('Start with npm run dev:isolated.');
  if (process.argv.includes('--stop')) {
    if (!fs.existsSync(runtimeFile)) { console.log('The isolated local app is already stopped.'); return; }
    const running = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    fs.writeFileSync(stopFile, JSON.stringify({ pid: running.pid }));
    for (let attempt = 0; attempt < 60; attempt++) {
      if (!fs.existsSync(runtimeFile)) { console.log('The isolated local app and its database have stopped.'); return; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('The local launcher did not acknowledge the stop request. Inspect .env.local-development/runtime.json and the runtime logs.');
  }
  await Promise.all([freePort(3000), freePort(4000)]);
  fs.mkdirSync(directory, { recursive: true });
  const settingsFile = path.join(directory, 'settings.json');
  settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {
    format: 'leadcrm-local-development-v1', port: 55434, database: 'leadcrm_local_development',
    databasePassword: randomBytes(24).toString('hex'), jwtSecret: randomBytes(32).toString('hex'), encryptionKey: randomBytes(32).toString('hex'),
    email: 'local.admin@camxian.com', password: `Local-${randomBytes(10).toString('hex')}!`,
  };
  if (settings.format !== 'leadcrm-local-development-v1' || settings.port !== 55434 || settings.database !== 'leadcrm_local_development') throw new Error('Unexpected local development profile; refusing to use it.');
  if (!fs.existsSync(settingsFile)) fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'LOGIN.txt'), `LeadCRM local development\nURL: http://localhost:3000/login\nEmail: ${settings.email}\nPassword: ${settings.password}\n\nThese credentials work only in this local database. Keep this file private.\n`, { mode: 0o600 });
  const emptyEnv = path.join(directory, 'empty.env');
  fs.writeFileSync(emptyEnv, '# Local configuration is supplied by the development launcher.\n');
  fs.mkdirSync(path.join(directory, 'private-files'), { recursive: true, mode: 0o700 });
  const url = `postgresql://leadcrm_local:${settings.databasePassword}@127.0.0.1:${settings.port}/${settings.database}?connection_limit=8`;
  Object.assign(environment, {
    NODE_ENV: 'development', DATABASE_URL: url, DIRECT_URL: url, PGPASSWORD: settings.databasePassword,
    JWT_SECRET: settings.jwtSecret, ENCRYPTION_KEY: settings.encryptionKey, DOTENV_CONFIG_PATH: emptyEnv,
    APP_URL: 'http://localhost:3000', ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000', TRUSTED_PROXIES: 'loopback',
    API_URL: 'http://127.0.0.1:4000/api/v1', HOST: '127.0.0.1', PORT: '4000', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false',
    STORAGE_ROOT: path.join(directory, 'private-files'),
    AVATAR_STORAGE_BUCKET: 'avatars', RECORD_FILES_STORAGE_BUCKET: 'files',
    LEADCRM_LOCAL_SETTINGS: settingsFile,
  });
  postgresBin = process.env.POSTGRES_BIN || run('pg_config', ['--bindir']).trim();
  const passwordFile = path.join(directory, 'postgres-password');
  if (!fs.existsSync(path.join(databaseDirectory, 'PG_VERSION'))) {
    if (fs.existsSync(databaseDirectory) && fs.readdirSync(databaseDirectory).length) throw new Error('The local PostgreSQL directory is nonempty but uninitialized. Preserve it and inspect it before retrying.');
    fs.writeFileSync(passwordFile, settings.databasePassword, { mode: 0o600 });
    run(postgres('initdb'), ['-D', databaseDirectory, '-U', 'leadcrm_local', '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C']);
    fs.appendFileSync(path.join(databaseDirectory, 'postgresql.conf'), "\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = ''\n");
    fs.unlinkSync(passwordFile);
  }
  const status = spawnSync(postgres('pg_ctl'), ['-D', databaseDirectory, 'status'], { env: environment, windowsHide: true, stdio: 'ignore' });
  if (status.status !== 0) {
    await freePort(settings.port);
    run(postgres('pg_ctl'), ['-D', databaseDirectory, '-l', path.join(directory, 'postgres.log'), '-o', `-p ${settings.port} -c timezone=UTC`, '-w', 'start'], { stdio: process.platform === 'win32' ? 'ignore' : 'pipe' });
    startedDatabase = true;
  }
  const psqlArgs = ['-X', '-h', '127.0.0.1', '-p', String(settings.port), '-U', 'leadcrm_local', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
  const exists = run(postgres('psql'), [...psqlArgs, '-At', '-c', "SELECT 1 FROM pg_database WHERE datname='leadcrm_local_development'"]).trim() === '1';
  if (!exists) run(postgres('psql'), [...psqlArgs, '-c', 'CREATE DATABASE leadcrm_local_development']);
  console.log('Applying migrations to the persistent local development database...');
  // This database is owned exclusively by this profile. Existing deployments use db:deploy.
  run(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(root, 'backend/prisma/schema.prisma')], { stdio: 'inherit' });
  if (!process.argv.includes('--skip-build')) run(process.execPath, [npmCli, '--prefix', 'backend', 'run', 'build'], { stdio: 'inherit' });
  if (!fs.existsSync(path.join(root, 'backend/dist/start.js'))) throw new Error('Build the backend before using --skip-build.');
  run(process.execPath, [path.join(root, 'scripts/local-development-bootstrap.cjs')], { stdio: 'inherit' });
  launch([path.join(root, 'backend/dist/start.js')], path.join(root, 'backend'));
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:4000/health', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('The local API did not become ready.');
  launch([path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3000'], path.join(root, 'frontend'));
  fs.writeFileSync(runtimeFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
  setInterval(() => {
    // Another process may still be writing the request when the poll runs.
    let request;
    try { request = JSON.parse(fs.readFileSync(stopFile, 'utf8')); } catch { return; }
    if (request.pid === process.pid) stop();
  }, 500);
  console.log('LeadCRM: http://localhost:3000/login');
  console.log('Local login details: .env.local-development/LOGIN.txt');
  console.log('Background workers enabled. Local records persist after restart. Press Ctrl+C to stop.');
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
main().catch(error => { console.error(error.message); stop(1); });
