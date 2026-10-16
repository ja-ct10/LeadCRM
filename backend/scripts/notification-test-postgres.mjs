import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, rmSync, realpathSync, appendFileSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const ledger = 'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz, started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0);';
const migrationReceipt = (name, source) => `INSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ('${randomUUID()}','${createHash('sha256').update(source).digest('hex')}','${name}',now(),1);`;
export async function notificationTestPostgres() {
 const root = resolve(import.meta.dirname, '../..');
 const require = createRequire(import.meta.url);
 const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
 const toolEnvironment = qaEnvironment(root);
 const output = resolve(root, 'data/outputs/system-audit/postgres');
 mkdirSync(output, { recursive: true });
 const parent = realpathSync(process.platform === 'linux' ? '/tmp' : output);
 const directory = mkdtempSync(join(parent, 'leadcrm-pg-'));
 const log = join(directory, 'server.log');
 const evidence = join(output, `server-${randomUUID()}.log`);
 let bin = process.env.POSTGRES_TEST_BIN;
 if (!bin) {
  try { bin = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8', windowsHide: true, env: toolEnvironment }).trim(); }
  catch { throw Error('Set POSTGRES_TEST_BIN to an installed PostgreSQL bin directory.'); }
 }
 const exe = name => resolve(bin, name + (process.platform === 'win32' ? '.exe' : ''));
 if (!existsSync(exe('initdb'))) throw Error('Set POSTGRES_TEST_BIN to the PostgreSQL bin directory.');
 const probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done));
 const port = probe.address().port; await new Promise(done => probe.close(done));
 // Windows postgres inherits pg_ctl's output handles; pipes keep spawnSync waiting
 // after pg_ctl has exited even when the server is already ready.
 const run = (name,args) => execFileSync(exe(name),args,{ windowsHide:true, env:toolEnvironment, stdio:name==='pg_ctl' && process.platform === 'win32'?'ignore':'pipe', timeout:150000 })?.toString() ?? '';
 const preserveLog = () => { if (existsSync(log)) copyFileSync(log, evidence); };
 let started = false, stopped = false;
 const stop = () => {
  if (stopped) return;
  const target = realpathSync(directory);
  if (!target.startsWith(parent + sep) || !target.slice(parent.length + 1).startsWith('leadcrm-pg-')) throw Error('Unsafe fixture cleanup path');
  // pg_ctl targets this private data directory; never kill by name or port.
  // Durable shutdown can exceed pg_ctl's default 60s when the host is busy.
  if (started || existsSync(join(directory, 'postmaster.pid'))) {
   try { run('pg_ctl',['-D',directory,'-m','fast','-w','-t','120','stop']); }
   catch (error) {
    // Another cleanup attempt may already have completed shutdown. Only status 3
    // proves this private cluster is stopped; never remove a running data directory.
    try { run('pg_ctl',['-D',directory,'status']); } catch (status) { if (status.status === 3) { preserveLog(); rmSync(target, { recursive: true, maxRetries: 5, retryDelay: 200 }); stopped = true; return; } }
    throw error;
   }
  }
  preserveLog();
  rmSync(target, { recursive: true, maxRetries: 5, retryDelay: 200 });
  stopped = true;
 };
 // Bootstrap only: this newly created disposable cluster is discarded after QA.
 // Runtime WAL/data synchronization remains enabled and is verified below.
 try {
 run('initdb',['-D',directory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C','--no-sync']);
 // A config file avoids pg_ctl's platform-dependent shell quoting of an empty
 // string. All clients use TCP; runners need no access to /var/run/postgresql.
 appendFileSync(join(directory, 'postgresql.conf'), "\nunix_socket_directories = ''\n");
 run('pg_ctl',['-D',directory,'-l',log,'-o',`-h 127.0.0.1 -p ${port} -c timezone=UTC -c max_connections=30`,'-w','start']);
 started = true;
 const psql = (database,args) => run('psql',['-X','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',database,'-v','ON_ERROR_STOP=1',...args]);
 let durability;
  const values = psql('postgres',['-At','-c',"SELECT current_setting('fsync'), current_setting('synchronous_commit'), current_setting('full_page_writes')"]).trim().split('|');
  durability = { fsync: values[0], synchronous_commit: values[1], full_page_writes: values[2] };
  if (values.length !== 3 || values.some(value => value !== 'on')) throw Error('Disposable PostgreSQL runtime durability must remain enabled');
 const migrations = resolve(root,'backend/prisma/migrations');
 const schemaSource = ({ before = '\uffff', exclude = [] } = {}) => {
 const sql = [ledger];
 for (const name of readdirSync(migrations).sort()) {
   const file=join(migrations,name,'migration.sql'); if(!existsSync(file))continue;
   if (name >= before || exclude.includes(name)) continue;
   const source = readFileSync(file,'utf8');
   sql.push(source, migrationReceipt(name, source));
 }
 return sql.join('\n');
 };
 const schema = join(directory,'schema.sql'); writeFileSync(schema,schemaSource());
 const disposableName = name => /^leadcrm_[a-z_]+_\d+$/.test(name) || ['leadcrm_custom_fields_test', 'leadcrm_polish_test'].includes(name);
 let statement = 0;
 return {
  directory,
  evidence,
  version: run('postgres', ['--version']).trim(),
  durability,
  async database(name, { migrate = true, before, exclude } = {}) {
   if(!disposableName(name))throw Error('Disposable database name required');
   psql('postgres',['-c',`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`]);
   psql('postgres',['-c',`CREATE DATABASE "${name}"`]);
   if (migrate) {
    if (before || exclude) { const selected = join(directory, `selected-${++statement}.sql`); writeFileSync(selected, schemaSource({ before, exclude })); psql(name, ['-f', selected]); }
    else psql(name,['-f',schema]);
   }
   return `postgresql://postgres@127.0.0.1:${port}/${name}?connection_limit=4&statement_cache_size=0`;
  },
  executeSql(name, source) {
   if (!disposableName(name)) throw Error('Disposable database name required');
   const file = join(directory, `statement-${++statement}.sql`); writeFileSync(file, source);
   return psql(name, ['-f', file]);
  },
  stop,
 };
 } catch (error) {
  preserveLog();
  const diagnostics = existsSync(log) ? readFileSync(log, 'utf8').slice(-16000) : [error.stdout, error.stderr].filter(Boolean).map(String).join('\n');
  try { stop(); } catch (cleanup) { throw new Error(`Native PostgreSQL failed; owned-cluster cleanup failed (${cleanup.code || cleanup.name}). Evidence: ${evidence}\n${diagnostics}`, { cause: error }); }
  throw new Error(`${error.message}\nNative PostgreSQL evidence: ${evidence}\n${diagnostics}`, { cause: error });
 }
}
export async function runNotificationTestFile(file,url) {
 const root=resolve(import.meta.dirname,'..');
 const require=createRequire(import.meta.url);
 const { qaEnvironment }=require('../../scripts/qa-environment.cjs');
 const child=spawn(process.execPath,[resolve(root,'../node_modules/vitest/vitest.mjs'),'run',file,'--maxWorkers=1'],{
  cwd:root,windowsHide:true,stdio:'inherit',env:qaEnvironment(resolve(root,'..'),{DATABASE_URL:url,DIRECT_URL:url})});
 return new Promise((done,fail)=>{child.on('exit',code=>done(code??1));child.on('error',fail);});
}
