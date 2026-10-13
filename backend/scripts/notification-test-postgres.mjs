import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
export async function notificationTestPostgres() {
 const root = resolve(import.meta.dirname, '../..');
 const require = createRequire(import.meta.url);
 const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
 const toolEnvironment = qaEnvironment(root);
 const output = resolve(root, 'data/outputs/notification-verification');
 mkdirSync(output, { recursive: true });
 const directory = mkdtempSync(join(output, 'postgres-'));
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
 const run = (name,args) => execFileSync(exe(name),args,{ windowsHide:true, env:toolEnvironment, stdio:name==='pg_ctl'?'ignore':'pipe', timeout:120000 })?.toString() ?? '';
 // Bootstrap only: this newly created disposable cluster is discarded after QA.
 // Runtime WAL/data synchronization remains enabled and is verified below.
 run('initdb',['-D',directory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C','--no-sync']);
 run('pg_ctl',['-D',directory,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c timezone=UTC -c max_connections=30`,'-w','start']);
 const psql = (database,args) => run('psql',['-X','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',database,'-v','ON_ERROR_STOP=1',...args]);
 let durability;
 try {
  const values = psql('postgres',['-At','-c',"SELECT current_setting('fsync'), current_setting('synchronous_commit'), current_setting('full_page_writes')"]).trim().split('|');
  durability = { fsync: values[0], synchronous_commit: values[1], full_page_writes: values[2] };
  if (values.length !== 3 || values.some(value => value !== 'on')) throw Error('Disposable PostgreSQL runtime durability must remain enabled');
 } catch (error) {
  run('pg_ctl',['-D',directory,'-m','fast','-w','stop']);
  throw error;
 }
 const migrations = resolve(root,'backend/prisma/migrations');
 const sql = ['CREATE TABLE "_prisma_migrations" (migration_name text, finished_at timestamptz, rolled_back_at timestamptz);'];
 for (const name of readdirSync(migrations).sort()) {
   const file=join(migrations,name,'migration.sql'); if(!existsSync(file))continue;
   sql.push(readFileSync(file,'utf8'),`INSERT INTO "_prisma_migrations" VALUES ('${name}',now(),NULL);`);
 }
 const schema = join(directory,'schema.sql'); writeFileSync(schema,sql.join('\n'));
 const disposableName = name => /^leadcrm_[a-z_]+_\d+$/.test(name) || ['leadcrm_custom_fields_test', 'leadcrm_polish_test'].includes(name);
 let statement = 0;
 return {
  directory,
  version: run('postgres', ['--version']).trim(),
  durability,
  async database(name, { migrate = true } = {}) {
   if(!disposableName(name))throw Error('Disposable database name required');
   psql('postgres',['-c',`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`]);
   psql('postgres',['-c',`CREATE DATABASE "${name}"`]);
   if (migrate) psql(name,['-f',schema]);
   return `postgresql://postgres@127.0.0.1:${port}/${name}?connection_limit=4&statement_cache_size=0`;
  },
  executeSql(name, source) {
   if (!disposableName(name)) throw Error('Disposable database name required');
   const file = join(directory, `statement-${++statement}.sql`); writeFileSync(file, source);
   return psql(name, ['-f', file]);
  },
  stop() { run('pg_ctl',['-D',directory,'-m','fast','-w','stop']); },
 };
}
export async function runNotificationTestFile(file,url) {
 const root=resolve(import.meta.dirname,'..');
 const require=createRequire(import.meta.url);
 const { qaEnvironment }=require('../../scripts/qa-environment.cjs');
 const child=spawn(process.execPath,[resolve(root,'../node_modules/vitest/vitest.mjs'),'run',file,'--maxWorkers=1'],{
  cwd:root,windowsHide:true,stdio:'inherit',env:qaEnvironment(resolve(root,'..'),{DATABASE_URL:url,DIRECT_URL:url})});
 return new Promise((done,fail)=>{child.on('exit',code=>done(code??1));child.on('error',fail);});
}
