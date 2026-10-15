import { expect, it } from 'vitest';
import { toFrontendOrg } from '../organization.adapter';

it('retains supported Account details and discards legacy assignment and product data', () => {
  const fields = { id: 'account', name: 'Northstar', email: 'team@example.test', phone: '+639171234567', notes: 'Customer notes', updatedAt: '2026-10-04T03:00:00Z' };
  const legacy = { internalNotes: 'Team notes', assignedUserId: 'owner', assignedUser: { id: 'owner', firstName: 'Alex', lastName: 'Morgan' }, productInterests: ['CCTV'], activeProducts: ['Biometrics'] };
  const account = toFrontendOrg({ ...fields, ...legacy });
  expect(account).toMatchObject(fields);
  for (const key of Object.keys(legacy)) expect(account).not.toHaveProperty(key);
});
