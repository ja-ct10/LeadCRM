import { expect, it } from 'vitest';
import { toBackendCreateContact, toBackendUpdateContact, toFrontendContact, toFrontendLegacyLead } from '../contact.adapter';
import { toFrontendLead } from '../lead.adapter';
import type { LeadRead } from '@leadcrm/shared';

it('retains populated Lead table fields, audit users, and every product from the response', () => {
  const user = { id: 'owner', firstName: 'Alex', lastName: 'Morgan' };
  const input = {
    id: 'lead', firstName: 'Jordan', lastName: 'Lee', companyName: '',
    account: { id: 'account', name: 'Northstar' }, description: 'Installation request',
    website: 'https://example.test', createdBy: user, updatedBy: user,
    lastStatusChangedAt: '2026-10-04T03:00:00Z', productInterest: ['CCTV', 'Biometrics'],
  };
  expect(toFrontendContact(input)).toMatchObject({
    companyName: 'Northstar', description: input.description, website: input.website,
    createdByUser: user, updatedByUser: user,
    latestStatusChangeDate: input.lastStatusChangedAt, productInterests: ['CCTV', 'Biometrics'],
  });
});

it('writes canonical multiword names, source and product IDs without display-name aliases', () => {
  const input = { firstName: 'Mary Jane', lastName: 'de la Cruz', name: 'Wrong full name',
    contactPerson: 'Wrong contact alias', leadPerson: 'Wrong lead alias', displayName: 'Wrong display alias',
    source: 'Referral', leadSource: 'Wrong source alias', productInterestIds: ['product-id'],
    productInterest: ['Wrong display name'], productInterests: ['Wrong display name'],
  };
  for (const payload of [toBackendCreateContact(input), toBackendUpdateContact(input)]) {
    expect(payload).toMatchObject({ firstName: 'Mary Jane', lastName: 'de la Cruz', source: 'Referral', productInterest: ['product-id'] });
    for (const alias of ['name', 'contactPerson', 'leadPerson', 'displayName', 'leadSource', 'productInterestIds', 'productInterests']) expect(payload).not.toHaveProperty(alias);
  }
  expect(input.firstName).toBe('Mary Jane');
  expect(input.lastName).toBe('de la Cruz');
});

it('does not reconstruct persisted names from a combined display alias', () => {
  expect(toBackendUpdateContact({ name: 'Mary Jane de la Cruz', contactPerson: 'Wrong Alias', displayName: 'Wrong Alias' })).toEqual({});
  expect(toBackendCreateContact({ leadPerson: 'Mary Jane de la Cruz' })).toMatchObject({ firstName: '', lastName: '' });
});

it('preserves explicit empty canonical source and product selections over compatibility aliases', () => {
  expect(toBackendUpdateContact({ source: '', leadSource: 'Wrong source', productInterestIds: [], productInterest: ['Wrong name'] }))
    .toEqual({ source: '', productInterest: [] });
});

it('projects typed Lead reads using canonical names, company and complete relation/product values', () => {
  const user = { id: 'owner', firstName: 'Alex', lastName: 'Morgan' };
  const input = { id: 'lead', tenantId: 'tenant', firstName: ' Mary Jane ', lastName: ' de la Cruz ',
    companyName: '', accountId: 'account', account: { id: 'account', name: 'Different account' },
    assignedUserId: user.id, assignedUser: user, createdBy: user, updatedBy: user,
    source: 'Referral', productInterestIds: ['cctv-id', 'bio-id'], productInterest: ['CCTV', 'Biometrics'],
    status: 'Warm', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', isArchived: false,
  } as LeadRead;
  expect(toFrontendLead(input)).toMatchObject({
    firstName: input.firstName, lastName: input.lastName, contactPerson: 'Mary Jane de la Cruz', companyName: '',
    source: 'Referral', leadSource: 'Referral', productInterestIds: ['cctv-id', 'bio-id'], productInterests: ['CCTV', 'Biometrics'],
    accountId: 'account', account: input.account, assignedUser: user, createdByUser: user, updatedByUser: user,
    createdAt: input.createdAt, updatedAt: input.updatedAt,
  });
});

import { RETIRED_CONTACT_FIELDS } from '@leadcrm/shared';
it('never recreates retired Contact fields and keeps legacy Lead metrics independent', () => {
  const input = {id:'contact',score:92,linkedinUrl:'https://example.test',customerType:'Customer',recordType:'Individual',activeProducts:['CCTV'],lifecycleStage:'CUSTOMER',customerSince:'2020-01-01'};
  const contact = toFrontendContact(input);
  for (const field of RETIRED_CONTACT_FIELDS) expect(contact).not.toHaveProperty(field);
  expect(contact).not.toHaveProperty('linkedin');
  expect(contact).toMatchObject({lifecycleStage:'CUSTOMER',customerSince:'2020-01-01'});
  expect(toFrontendLegacyLead(input).score).toBe(92);
});
