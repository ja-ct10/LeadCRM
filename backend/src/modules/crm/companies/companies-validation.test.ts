import { beforeEach, expect, it, vi } from 'vitest';
import { OptionalTaxIdSchema } from '@leadcrm/shared';
const repo = vi.hoisted(() => ({ createCompany: vi.fn(), updateCompany: vi.fn(), findCompanyById: vi.fn() }));
vi.mock('./companies.repository', () => repo);
vi.mock('../../../core/audit/audit.service', () => ({ writeAuditLog: vi.fn(), buildChangeset: vi.fn(() => ({ before: {}, after: {} })) }));
import { createCompany, updateCompany } from './companies.service';
beforeEach(() => { vi.clearAllMocks(); });
it.each([undefined, '', '123456789', '012345678'])('accepts optional/string Tax ID %s', taxId => {
  expect(OptionalTaxIdSchema.safeParse(taxId).success).toBe(true);
});
it.each(['12345678', '1234567890', '123ABC789', '123-456-789', ' 123456789', '123 456789'])('rejects %s even when services are invoked directly', async taxId => {
  await expect(createCompany('tenant', 'user', { name: 'Account', tags: [], country: 'Philippines', taxId })).rejects.toThrow('Tax ID must contain exactly 9 digits.');
  await expect(updateCompany('account', 'tenant', 'user', { taxId })).rejects.toThrow('Tax ID must contain exactly 9 digits.');
  expect(repo.createCompany).not.toHaveBeenCalled();
  expect(repo.updateCompany).not.toHaveBeenCalled();
});
