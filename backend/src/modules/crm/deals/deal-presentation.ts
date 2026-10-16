import prisma from '../../../config/database.config';
import { salesContext } from '../leads/sales-context';
import { mayReadContactAccount, presentContactAccount } from '../contacts-v2/contact-account-access';

/** Apply source-module visibility to Deal responses, including nested Contacts. */
export async function presentDealResponse<T>(tenantId: string, response: T): Promise<T> {
  const permitted = await mayReadContactAccount(salesContext.getStore() ?? prisma, tenantId);
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object' || value instanceof Date) return value;
    const source = value as Record<string, unknown>;
    const record = 'companyFromAccount' in source ? presentContactAccount(source, permitted) : source;
    return Object.fromEntries(Object.entries(record).map(([key, entry]) =>
      [key, !permitted && (key === 'organization' || key === 'account') ? null : visit(entry)]));
  }
  return visit(response) as T;
}
