import { describe, it, expect } from 'vitest';
import { DealAddressSourceSchema, resolveDealAddress, dealCustomerAddressMessage } from '@leadcrm/shared';

const lead = { type: 'lead' as const, id: 'lead', label: 'Lead: Customer', address: 'Personal street\nPasig' };
const account = { type: 'account' as const, id: 'account', label: 'Company: Business', address: 'Company street\nMakati' };
describe('live Deal address resolution', () => {
  it('uses one eligible source without copying it and leaves several sources unresolved', () => {
    expect(resolveDealAddress('', null, [lead])).toMatchObject({ status: 'linked', effectiveAddress: lead.address });
    expect(resolveDealAddress('', null, [account])).toMatchObject({ status: 'linked', effectiveAddress: account.address });
    expect(resolveDealAddress('', null, [lead, account])).toMatchObject({ status: 'choice_required', effectiveAddress: null });
    expect(resolveDealAddress('', null, [])).toMatchObject({ status: 'empty', effectiveAddress: null });
  });
  it('keeps a chosen source even when an alternative exists or both addresses are equal', () => {
    expect(resolveDealAddress('', { type: account.type, id: account.id }, [lead, account]).effectiveAddress).toBe(account.address);
    expect(resolveDealAddress('', null, [lead, { ...account, address: lead.address }]).status).toBe('choice_required');
    expect(resolveDealAddress('', { type: lead.type, id: lead.id }, [account])).toMatchObject({ status: 'unavailable', effectiveAddress: null });
  });
  it('prioritizes an override without losing the selected customer address', () => {
    const context = resolveDealAddress('Installation site', { type: account.type, id: account.id }, [lead, account]);
    expect(context).toMatchObject({ status: 'override', effectiveAddress: 'Installation site', customerAddress: account.address });
    expect(dealCustomerAddressMessage(context)).toBe(account.address);
    expect(resolveDealAddress('  ', { type: account.type, id: account.id }, [account]).effectiveAddress).toBe(account.address);
  });
  it('accepts references only, never address copies or arbitrary source types', () => {
    expect(DealAddressSourceSchema.safeParse({ type: 'lead', id: 'lead' }).success).toBe(true);
    expect(DealAddressSourceSchema.safeParse(lead).success).toBe(false);
    expect(DealAddressSourceSchema.safeParse({ type: 'user', id: 'agent' }).success).toBe(false);
  });
});
