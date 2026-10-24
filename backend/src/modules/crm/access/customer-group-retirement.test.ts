import { describe, expect, it } from 'vitest';
import { CreateLeadSchema, UpdateLeadSchema, CreateDealBatchSchema } from '@leadcrm/shared';
import { CreateClientContactSchema, UpdateClientContactSchema } from '../contacts-v2/contacts-v2.dto';
import { CreateCompanySchema, UpdateCompanySchema } from '../companies/companies.dto';
import { CreateDealSchema, UpdateDealSchema } from '../deals/deals.dto';

const uuid = 'da7cd819-f5bd-4b31-8abf-ccbd083fc4eb';
const person = { firstName: 'Customer', lastName: 'Example', email: 'customer@example.test', status: 'Inquiry' };
const cases = [
  ['Lead create', CreateLeadSchema, person], ['Lead update', UpdateLeadSchema, { firstName: 'Customer' }],
  ['Contact create', CreateClientContactSchema, { ...person, requestId: uuid }], ['Contact update', UpdateClientContactSchema, { firstName: 'Customer' }],
  ['Account create', CreateCompanySchema, { name: 'Customer organization' }], ['Account update', UpdateCompanySchema, { name: 'Customer organization' }],
  ['Deal create', CreateDealSchema, { title: 'Customer opportunity', pipelineId: uuid, stageId: uuid }],
  ['Deal update', UpdateDealSchema, { title: 'Customer opportunity' }],
  ['Deal batch', CreateDealBatchSchema, { idempotencyKey: uuid, pipelineId: uuid, stageId: uuid, title: 'Customer opportunity', productInterestIds: [uuid] }],
] as const;

describe('customer contracts retire employee group ownership', () => {
  it.each(cases)('%s accepts its normal payload and rejects owning-group input, including null', (_label, schema, input) => {
    expect(schema.safeParse(input).success).toBe(true);
    for (const ownerGroupId of [null, uuid]) {
      const result = schema.safeParse({ ...input, ownerGroupId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some(issue => issue.path.includes('ownerGroupId') || issue.code === 'unrecognized_keys' && issue.keys.includes('ownerGroupId'))).toBe(true);
    }
  });
});
