// Read-only verification of qa-forms-local.mjs after a browser submission.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4106/api/v1';
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'forms-qa@camxian.com', password: 'Forms-Local-QA-2026!' }) });
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
async function read(path) {
  const response = await fetch(base + path, { headers: { cookie } });
  assert.equal(response.status, 200, path);
  return (await response.json()).data;
}
const forms = await read('/marketing/forms?limit=100');
const form = forms.find(item => item.name === 'Forms Builder QA'); assert.ok(form);
const leads = await read('/crm/leads?pageSize=100');
const lead = leads.find(item => item.email === 'forms-browser-qa@example.com'); assert.ok(lead);
assert.equal(lead.firstName, 'Browser'); assert.equal(lead.lastName, 'QA');
assert.equal(lead.companyName, 'QA Company'); assert.equal(lead.address, 'QA address'); assert.equal(lead.source, 'Referral');
const custom = await read(`/crm/leads/${lead.id}/custom-fields`);
const age = custom.fields.find(field => field.name === 'Age'); assert.ok(age);
assert.equal(custom.values[age.id], 29);
assert.equal(leads.filter(item => item.email === lead.email).length, 1);
const submissions = await read(`/marketing/forms/${form.id}/submissions`);
assert.equal(submissions.length, 1);
const submission = submissions[0]; assert.equal(submission.leadId, lead.id);
const ageInput = submission.publishedConfig.fields.find(field => field.customFieldId === age.id); assert.ok(ageInput);
assert.equal(submission.values[ageInput.id], '29');
const layout = submission.publishedConfig.fields.filter(field => ['header', 'paragraph'].includes(field.type)); assert.equal(layout.length, 2);
for (const field of layout) assert.equal(Object.hasOwn(submission.values, field.id), false);
assert.equal(Object.values(submission.productLabels).includes('Smart Lock'), true);
const evidence = { environment: 'disposable local database', passed: true, lead: { id: lead.id, firstName: lead.firstName, lastName: lead.lastName, companyName: lead.companyName, address: lead.address, source: lead.source }, custom: { label: 'Age', canonicalDefinitionId: age.id, value: custom.values[age.id] }, form: { id: form.id, status: form.status, revision: form.revision, publishedRevision: form.publishedRevision, fields: form.fields.map(field => ({ id: field.id, label: field.label, type: field.type, mapToField: field.mapToField, customFieldId: field.customFieldId })) }, submission: { count: submissions.length, productLabels: submission.productLabels, layoutExcludedFromValues: true }, duplicateLeadCount: 1 };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
