import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import type { Prisma } from '@prisma/client';
import { INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR } from '@leadcrm/shared';
import { readCrmStatusEvidence } from './access/crm-record-access.service';

// Record fields are plain text, including notes; HTML is never stored as markup.
export const recordText = (max = 2000) => z.string().max(max).transform(value =>
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim());
export const recordName = (max = 100) => recordText(max).pipe(z.string().min(1, 'Name is required'));

/** User identity is internal regardless of role, activation or assignment eligibility. */
export async function assertExternalCustomerEmail(tx: Prisma.TransactionClient, tenantId: string,
  email: string | null | undefined, path: (string | number)[] = ['email']): Promise<void> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return;
  // Compare exactly after trimming legacy stored addresses, as CRM matching does.
  // Tenant-authoritative validation must include employees hidden by Team/Archived
  // Data View permissions. No identity details are returned to the caller.
  const candidates = await readCrmStatusEvidence(() => tx.user.findMany({ where: { tenantId, email: { contains: normalized, mode: 'insensitive' } }, select: { email: true } }));
  if (candidates.some(user => user.email.trim().toLowerCase() === normalized)) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, path, message: INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR }]);
  }
}

/** Validate customer identities before writing or copying ordered Deal junctions. */
export async function assertExternalCustomerParticipants(tx: Prisma.TransactionClient, tenantId: string,
  participants: { leadIds?: string[]; contactIds?: string[] }): Promise<void> {
  for (const field of ['leadIds', 'contactIds'] as const) {
    const ids = participants[field];
    if (!ids?.length) continue;
    const where = { tenantId, id: { in: [...new Set(ids)] } };
    const people = await readCrmStatusEvidence(() => field === 'leadIds' ? tx.lead.findMany({ where, select: { email: true } })
      : tx.contact.findMany({ where, select: { email: true } }));
    for (const person of people) await assertExternalCustomerEmail(tx, tenantId, person.email, [field]);
  }
}
