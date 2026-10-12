import { expect, it } from 'vitest';
import { serializeLead } from '../lead-serializer';

it('serializes the real Lead projection with ISO dates, canonical fields and relation IDs', () => {
  const user = { id: 'agent', firstName: 'Alex', lastName: 'Morgan' };
  const input = {
    id: 'lead', tenantId: 'tenant', firstName: 'Mary Jane', lastName: 'de la Cruz', status: 'WARM',
    email: 'mary@example.test', phone: '+639123456789', companyName: '', address: 'Manila', source: 'Referral',
    accountId: 'account', assignedUserId: 'agent', account: { id: 'account', name: 'Different Account' }, assignedUser: user,
    productInterestIds: ['cctv-id', 'bio-id'], productInterest: ['CCTV', 'Biometrics'],
    createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-02T00:00:00Z'),
    createdById: user.id, updatedById: user.id, createdBy: user, updatedBy: user,
    lastStatusChangedAt: new Date('2026-10-02T00:00:00Z'),
    contactId: null, convertedAt: null, convertedById: null, isArchived: false, deletedAt: null, deletedBy: null,
    creationKey: 'internal-key', productsNormalized: true, engagementEvaluatedAt: new Date(),
    leadPerson: 'Wrong alias', displayName: 'Wrong alias', description: 'Retired value',
  } as unknown as Parameters<typeof serializeLead>[0];
  const result = serializeLead(input);
  expect(result).toMatchObject({
    id: 'lead', tenantId: 'tenant', firstName: 'Mary Jane', lastName: 'de la Cruz', companyName: '', source: 'Referral', status: 'Warm',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', lastStatusChangedAt: '2026-10-02T00:00:00.000Z',
    accountId: 'account', account: { id: 'account', name: 'Different Account' }, assignedUserId: 'agent', assignedUser: user,
    createdBy: user, updatedBy: user, productInterestIds: ['cctv-id', 'bio-id'], productInterest: ['CCTV', 'Biometrics'], productInterests: ['CCTV', 'Biometrics'],
    convertedAt: null, deletedAt: null,
  });
  for (const field of ['name', 'leadPerson', 'displayName', 'description', 'creationKey', 'productsNormalized', 'engagementEvaluatedAt']) expect(result).not.toHaveProperty(field);
  expect(input.createdAt).toBeInstanceOf(Date);
});
