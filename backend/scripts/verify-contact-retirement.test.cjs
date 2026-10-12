const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyContactRelease } = require('./deploy-contact-retirement.cjs');
const { deploymentPlan } = require('./deploy-crm-imports.cjs');
const config = {api:'https://crm.example/api/v1',commit:'a'.repeat(40),token:'disposable-verifier'};
const request = (capability=true,field) => async (url,options) => {
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.Cookie,'leadcrm_token=disposable-verifier');
  const contact = {id:'contact',productInterests:['CCTV'],...(field?{[field]:null}:{})};
  return {ok:true,json:async()=>url.endsWith('/health') ? {commit:config.commit,capabilities:capability?['contact-retirement-contract-v1']:[]}
    : url.endsWith('/auth/me') ? {data:{id:'admin',tenantId:'tenant',role:'Client Admin'}}
    : url.includes('archived=true') ? {data:[],meta:{total:0,hasMore:false}}
    : url.includes('page=') ? {data:[contact],meta:{total:1,hasMore:false}}
    : {data:contact}};
};
test('requires exact serving release, capability and retired-field-free authenticated lists and details',async()=>{
  assert.deepEqual((await verifyContactRelease(config,request())).counts,{active:1,archived:0});
  await assert.rejects(verifyContactRelease(config,request(false)),/CONTACT_RELEASE_NOT_SERVING/);
  for(const field of ['customerType','recordType','score','linkedinUrl','activeProducts','lastContactedAt','qualifiedAt','disqualifiedReason']) await assert.rejects(verifyContactRelease(config,request(true,field)),/CONTACT_PUBLIC_CONTRACT_INVALID/);
  await assert.rejects(verifyContactRelease({...config,api:'http://crm.example/api/v1'},request()),/HTTPS_API_REQUIRED/);
});
test('normal deployment adds the archive and defers Contact destruction along with existing gates',()=>{
  const records=['20261028000000_retire_legacy_crm_imports'].map(migration_name=>({migration_name,finished_at:new Date(),rolled_back_at:null}));
  const names=['20261101000000_expand_canonical_relationships','20261102000000_retire_relationship_compatibility','20261110000000_retire_unused_crm_columns','20261112000000_retire_lead_nonform_columns','20261128000000_preserve_contact_retirement_history','20261129000000_retire_contact_obsolete_columns'];
  const plan=deploymentPlan(records,names);
  assert.equal(plan.through,'20261129000000_retire_contact_obsolete_columns');
  assert.ok(plan.exclude.includes('20261129000000_retire_contact_obsolete_columns'));
  assert.ok(plan.exclude.includes('20261110000000_retire_unused_crm_columns'));
  assert.ok(plan.exclude.includes('20261102000000_retire_relationship_compatibility'));
  assert.ok(!plan.exclude.includes('20261128000000_preserve_contact_retirement_history'));
});
