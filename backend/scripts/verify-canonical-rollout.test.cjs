const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploymentTarget } = require('./deploy-crm-imports.cjs');
const { verifyCanonicalRelease } = require('./deploy-canonical-relationships.cjs');
const config = { api: 'https://crm.example/api/v1', commit: 'a'.repeat(40), token: 'local-test-token' };
const request = (health, status = 200) => async url => ({ ok: status === 200, json: async () => url.endsWith('/health') ? health : { data: { user: { id: 'u', tenantId: 't', role: 'Client Admin' } } } });
test('normal deployment stops before active compatibility column retirement', () => {
  const rows = [{ migration_name: '20261028000000_retire_legacy_crm_imports', finished_at: new Date() }];
  assert.equal(deploymentTarget(rows, []), '20261101000000_expand_canonical_relationships');
  rows.push({ migration_name: '20261102000000_retire_relationship_compatibility', finished_at: new Date() });
  assert.equal(deploymentTarget(rows, []), '\uffff');
});
test('canonical retirement rejects old commits, missing capability and unsuccessful endpoints', async () => {
  const health = { commit: config.commit, capabilities: ['canonical-crm-relations-v1'] };
  await verifyCanonicalRelease(config, request(health));
  for (const changed of [{ ...health, commit: 'b'.repeat(40) }, { ...health, capabilities: [] }]) await assert.rejects(verifyCanonicalRelease(config, request(changed)));
  await assert.rejects(verifyCanonicalRelease(config, request(health, 401)));
  await assert.rejects(verifyCanonicalRelease({ ...config, token: '' }, request(health)));
});
