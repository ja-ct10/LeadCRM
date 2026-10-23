'use strict';
// Current production data may be rehearsed only in an explicitly named restore
// database. Uses the real compiled HTTP app, normal auth and unmodified operator.
const { readFileSync } = require('node:fs');
const { compiledContext, withSession } = require('./crm-columns-operator-session.cjs');
async function run(env = process.env) {
  const database = env.CRM_COLUMNS_EXPECT_DATABASE;
  if (!/^leadcrm_crm_columns_restore_\d{14}$/.test(database || '')) throw Error('CRM_COLUMNS_ISOLATED_RESTORE_REQUIRED');
  for (const value of [env.DATABASE_URL,env.DIRECT_URL || env.DATABASE_URL]) if (decodeURIComponent(new URL(value).pathname.slice(1)) !== database) throw Error('CRM_COLUMNS_REHEARSAL_CONNECTION_MISMATCH');
  Object.assign(process.env,env);
  const context = compiledContext(env);
  const operator = require('./deploy-crm-columns-retirement.cjs');
  let server, appDb, maintenance;
  try {
    const evidence = JSON.parse(readFileSync(env.CRM_COLUMNS_BACKUP_EVIDENCE,'utf8'));
    if (operator.digest(await operator.snapshot(context.db)) !== evidence.snapshotDigest) throw Error('CRM_COLUMNS_RESTORED_BASELINE_MISMATCH');
    if (operator.digest(await operator.retiredValues(context.db)) !== evidence.retiredDigest) throw Error('CRM_COLUMNS_RESTORED_RETIRED_VALUES_MISMATCH');
    const app = require('../dist/backend/src/app.js').default;
    appDb = require('../dist/backend/src/config/database.config.js').default;
    maintenance = require('../dist/backend/src/core/maintenance/crm-retirement-maintenance.js').crmRetirementMaintenance;
    const until = new Date(Date.now()+600000).toISOString();
    // This isolated app starts no workers; its actual requests are still drained
    // and its database connection must independently report READ ONLY.
    maintenance.begin(Date.parse(until)); await maintenance.drain();
    server = app.listen(0,'127.0.0.1'); await new Promise(done=>server.once('listening',done));
    return await withSession(context.db,token=>operator.run(context.db,'--retire',{...env,
      CRM_COLUMNS_VERIFY_API:`http://127.0.0.1:${server.address().port}/api/v1`,CRM_COLUMNS_VERIFY_TOKEN:token,CRM_COLUMNS_DEADLINE:until,
    }));
  } finally {
    maintenance?.resume(); server?.closeAllConnections();
    await Promise.all([server&&new Promise(done=>server.close(done)),appDb?.$disconnect(),context.db.$disconnect()]);
    context.restoreResolver();
  }
}
module.exports={run};
if (require.main===module) run().then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error('[crm-columns-rehearsal]',error.code||error.message,JSON.stringify(error.details||null));process.exitCode=1;});
