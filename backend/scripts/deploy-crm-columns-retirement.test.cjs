'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const operator = require('./deploy-crm-columns-retirement.cjs');
const names = readdirSync(resolve(__dirname,'../prisma/migrations')).filter(n => /^\d+_/.test(n));
const approved = operator.retirements.map(([name]) => name);
const receipt = name => ({ migration_name:name,finished_at:new Date(),checksum:createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',name,'migration.sql'))).digest('hex') });
const records = names.filter(name => !approved.includes(name)).map(receipt);
test('plans exactly the six retirements and skips verified applications', () => {
  assert.deepEqual(operator.plan(records,names),approved);
  assert.deepEqual(operator.plan([...records,receipt(approved[0])],names),approved.slice(1));
  assert.deepEqual(operator.plan([...records,...approved.map(receipt)],names),[]);
});
test('blocks unexpected pending work, changed history and unresolved receipts', () => {
  assert.throws(() => operator.plan(records,[...names,'20990101000000_unreviewed']),/OUTSIDE_APPROVED_SCOPE/);
  assert.throws(() => operator.plan([{...records[0],checksum:'0'.repeat(64)},...records.slice(1)],names),/CHECKSUM_MISMATCH/);
  assert.throws(() => operator.plan([...records,{migration_name:approved[0]}],names),/FAILED_MIGRATION/);
});
test('finds entity-qualified selectors, changed-field references and template tokens', () => {
  assert.deepEqual(operator.references({ field:'event.changedFields',value:['contact.score','lead.score','account.tags'] },'lead'),['contact.score','account.tags']);
  assert.deepEqual(operator.references([{field:'jobTitle'},{body:'{{jobTitle}} {{lead.website}} {{customFieldValues.jobTitle}}'}],'contact'),['jobTitle','lead.website']);
  assert.deepEqual(operator.references({field:'website',body:'Ordinary jobTitle and tags text'},'account'),[]);
  assert.deepEqual(operator.references({field:'record.tags'},'account'),['record.tags']);
  assert.deepEqual(operator.references({field:'activeProductIds'},'contact'),['activeProductIds']);
});
test('requires actual runtime read-only before considering maintenance attestations', async () => {
  let disconnected = false;
  await assert.rejects(operator.writeFence({ DATABASE_URL:'postgresql://app@localhost/leadcrm',CRM_COLUMNS_EXPECT_DATABASE:'leadcrm' },() => ({
    $queryRawUnsafe:async () => [{database:'leadcrm',role:'app',readonly:'off'}], $disconnect:async () => { disconnected = true; },
  })), /APPLICATION_WRITES_NOT_PAUSED/);
  assert.equal(disconnected,true);
});
test('requires enough time to complete a bounded transaction and verification', () => {
  assert.throws(() => operator.deadline({CRM_COLUMNS_DEADLINE:new Date(Date.now()+5000).toISOString()}),/DEADLINE_REQUIRED/);
  assert.throws(() => operator.deadline({CRM_COLUMNS_DEADLINE:new Date(Date.now()+700000).toISOString()}),/DEADLINE_REQUIRED/);
  assert.ok(operator.deadline({CRM_COLUMNS_DEADLINE:new Date(Date.now()+300000).toISOString()}) > Date.now());
});
test('standalone rehearsal rejects the live database before opening any connection', async () => {
  const rehearsal = require('./rehearse-crm-columns-retirement.cjs');
  await assert.rejects(rehearsal.run({CRM_COLUMNS_EXPECT_DATABASE:'leadcrm'}),/ISOLATED_RESTORE_REQUIRED/);
  await assert.rejects(rehearsal.run({CRM_COLUMNS_EXPECT_DATABASE:'leadcrm_crm_columns_restore_20261023000001',DATABASE_URL:'postgresql://app@localhost/leadcrm',DIRECT_URL:'postgresql://migrator@localhost/leadcrm'}),/CONNECTION_MISMATCH/);
});
test('retries only passive reconnect reads and never a mutation', async () => {
  let attempts = 0;
  const result = await operator.passiveFetch('http://127.0.0.1/health',{},async()=>({status:++attempts===1?503:200,arrayBuffer:async()=>{}}));
  assert.equal(result.status,200);
  assert.equal(attempts,2);
  attempts=0;
  await operator.passiveFetch('http://127.0.0.1/change',{method:'POST'},async()=>{attempts++;return {status:503};});
  assert.equal(attempts,1);
});
test('refuses an operator view filtered by row-level security', async () => {
  await assert.rejects(operator.audit({$queryRawUnsafe:async()=>[{schema:'public',table:'Contact'}]}),/OPERATOR_RLS_SCOPE_REQUIRES_REVIEW/);
});
