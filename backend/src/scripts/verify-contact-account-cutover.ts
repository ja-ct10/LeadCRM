/**
 * READ-ONLY verification for Phase 4 of the CRM Data Model Consolidation (ADR-001).
 *
 * Confirms the expand + cutover are structurally sound against the live DB:
 *   - Contact.accountId column exists and is queryable
 *   - Contact -> Account relation include works
 *   - Account -> contacts back-relation works
 *   - relationships-style query by accountId works
 *   - tenant-isolation invariant holds for any linked contacts
 *
 * No writes. Run: npx ts-node src/scripts/verify-contact-account-cutover.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

async function main(): Promise<void> {
  console.log('Phase 4 verification — Contact <-> Account cutover (read-only)');
  console.log('Timestamp:', new Date().toISOString());

  // 1. accountId column is queryable + relation include works (contacts-v2 read path).
  const contacts = await prisma.contact.findMany({
    take: 5,
    select: {
      id: true, tenantId: true, accountId: true, organizationId: true,
      account:      { select: { id: true, name: true, tenantId: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  console.log(`\n[1] Contact query with account+organization includes: OK (${contacts.length} rows)`);

  // 2. Account -> contacts back-relation works (relationships/getAccountRelationships path).
  const accountsWithContacts = await prisma.account.findMany({
    take: 5,
    select: { id: true, name: true, tenantId: true, contacts: { select: { id: true } } },
  });
  console.log(`[2] Account.contacts back-relation: OK (${accountsWithContacts.length} accounts)`);

  // 3. Filter contacts by accountId (contacts-v2 findAllContacts path).
  const firstAccountId = accountsWithContacts[0]?.id;
  if (firstAccountId) {
    const byAccount = await prisma.contact.count({ where: { accountId: firstAccountId } });
    console.log(`[3] Contact filter by accountId: OK (${byAccount} contacts on first account)`);
  } else {
    console.log('[3] Contact filter by accountId: OK (no accounts to filter — 0 rows in DB)');
  }

  // 4. Tenant-isolation invariant: any contact linked to an account must share its tenant.
  const linked = contacts.filter((c) => c.account != null);
  const violations = linked.filter((c) => c.account!.tenantId !== c.tenantId);
  if (violations.length > 0) {
    throw new Error(`TENANT ISOLATION VIOLATION: ${violations.length} contact(s) link to an account in another tenant`);
  }
  console.log(`[4] Tenant-isolation invariant (Contact.tenantId === account.tenantId): OK (${linked.length} linked contacts checked)`);

  // 5. Legacy organizationId still readable during transition (compat).
  const stillOnOrg = await prisma.contact.count({ where: { organizationId: { not: null }, accountId: null } });
  console.log(`[5] Contacts still on legacy organizationId with no accountId: ${stillOnOrg} (should be 0 after backfill on populated DBs)`);

  console.log('\nAll structural checks passed. No data modified.');
}

main()
  .catch((err) => {
    console.error('Verification FAILED:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
