const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploymentTarget, deploymentPlan } = require('./deploy-crm-imports.cjs');
const { verifyCanonicalRelease } = require('./deploy-canonical-relationships.cjs');
const config = { api: 'https://crm.example/api/v1', commit: 'a'.repeat(40), token: 'local-test-token' };
const request = (health, status = 200) => async url => ({ ok: status === 200, json: async () => url.endsWith('/health') ? health : { data: { user: { id: 'u', tenantId: 't', role: 'Client Admin' } } } });
test('normal deployment stops before active compatibility column retirement', () => {
  const rows = [{ migration_name: '20261028000000_retire_legacy_crm_imports', finished_at: new Date() }];
  assert.equal(deploymentTarget(rows, []), '20261101000000_expand_canonical_relationships');
  rows.push({ migration_name: '20261102000000_retire_relationship_compatibility', finished_at: new Date() });
  assert.equal(deploymentTarget(rows, []), '\uffff');
});

test('only reviewed independent migrations can run while relationship retirement is deferred', () => {
  const rows = [{ migration_name: '20261028000000_retire_legacy_crm_imports', finished_at: new Date() }];
  const names = ['20261102000000_retire_relationship_compatibility', '20261103000000_reply_engagement_deal_batches', '20261104000000_user_first_login_onboarding', '20261105000000_module_custom_fields'];
  assert.deepEqual(deploymentPlan(rows, names), { through: names[3], exclude: [names[0]] });
  assert.throws(() => deploymentPlan(rows, [...names, '20261105000000_unreviewed']), /REVIEW_MIGRATIONS/);
  assert.throws(() => deploymentPlan([...rows, { migration_name: names[2] }], names), /FAILED_MIGRATION/);
  rows.push({ migration_name: names[0], finished_at: new Date() });
  assert.deepEqual(deploymentPlan(rows, names), { through: '\uffff', exclude: [] });
});
test('canonical retirement rejects old commits, missing capability and unsuccessful endpoints', async () => {
  const health = { commit: config.commit, capabilities: ['canonical-crm-relations-v1'] };
  await verifyCanonicalRelease(config, request(health));
  for (const changed of [{ ...health, commit: 'b'.repeat(40) }, { ...health, capabilities: [] }]) await assert.rejects(verifyCanonicalRelease(config, request(changed)));
  await assert.rejects(verifyCanonicalRelease(config, request(health, 401)));
  await assert.rejects(verifyCanonicalRelease({ ...config, token: '' }, request(health)));
});
