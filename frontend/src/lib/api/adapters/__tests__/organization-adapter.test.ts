import { expect, it } from 'vitest';
import { toFrontendOrg, toBackendCreateOrg, toBackendUpdateOrg } from '../organization.adapter';

it('retains supported Account details and discards legacy assignment and product data', () => {
  const fields = { id: 'account', name: 'Northstar', email: 'team@example.test', phone: '+639171234567', notes: 'Customer notes', updatedAt: '2026-10-04T03:00:00Z' };
  const legacy = { tags: ['Legacy'], internalNotes: 'Team notes', assignedUserId: 'owner', assignedUser: { id: 'owner', firstName: 'Alex', lastName: 'Morgan' }, productInterests: ['CCTV'], activeProducts: ['Biometrics'] };
  const account = toFrontendOrg({ ...fields, ...legacy });
  expect(account).toMatchObject(fields);
  for (const key of Object.keys(legacy)) expect(account).not.toHaveProperty(key);
});

it('omits retired columns from create and update payloads even with stale Account data', () => {
  const stale = { name: 'Company', tags: ['Legacy'], internalNotes: 'Private' };
  for (const payload of [toBackendCreateOrg(stale), toBackendUpdateOrg(stale)]) {
    expect(payload.name).toBe('Company');
    expect(payload).not.toHaveProperty('tags');
    expect(payload).not.toHaveProperty('internalNotes');
  }
});
