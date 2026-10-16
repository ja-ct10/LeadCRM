import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('repairs only missing same-tenant email Deal links and increments each affected mailbox once, idempotently', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TABLE "Deal" (id TEXT PRIMARY KEY, "tenantId" TEXT);
      CREATE TABLE "EmailAccount" (id TEXT PRIMARY KEY, "mailboxVersion" INTEGER);
      CREATE TABLE "MailboxMessage" (id TEXT PRIMARY KEY, "tenantId" TEXT, "accountId" TEXT, "dealId" TEXT);
      CREATE TABLE "Activity" (id TEXT PRIMARY KEY, "tenantId" TEXT, type TEXT, "mailboxMessageId" TEXT, "dealId" TEXT, "leadId" TEXT, "contactId" TEXT, metadata JSONB, "createdAt" TIMESTAMP);
      INSERT INTO "Deal" VALUES ('deal-a','a'), ('deal-b','b'), ('other-deal-a','a');
      INSERT INTO "EmailAccount" VALUES ('mail-a',7), ('mail-b',10), ('untouched',3);
      INSERT INTO "MailboxMessage" VALUES ('m1','a','mail-a','deal-a'), ('m2','a','mail-a','deal-a'), ('m3','b','mail-b','deal-b'),
        ('no-deal','a','untouched',NULL), ('missing-deal','a','untouched','missing'), ('foreign-deal','a','untouched','deal-b');
    `);
    const fixtures = [
      ['repair-lead', 'a', 'email', 'm1', null, 'lead', null],
      ['repair-contact', 'a', 'email', 'm2', null, null, 'contact'],
      ['repair-other-tenant', 'b', 'email', 'm3', null, 'other-lead', null],
      ['existing-conflict', 'a', 'email', 'm1', 'other-deal-a', 'lead', null],
      ['non-email', 'a', 'note', 'm1', null, 'lead', null],
      ['foreign-message', 'b', 'email', 'm1', null, null, 'contact'],
      ['no-message-deal', 'a', 'email', 'no-deal', null, null, 'contact'],
      ['missing-message', 'a', 'email', 'missing', null, 'lead', null],
      ['missing-deal', 'a', 'email', 'missing-deal', null, 'lead', null],
      ['foreign-deal', 'a', 'email', 'foreign-deal', null, 'lead', null],
    ];
    for (const values of fixtures) await db.query(`INSERT INTO "Activity" VALUES ($1,$2,$3,$4,$5,$6,$7,'{"preserve":"body and identity"}','2026-01-01')`, values);
    const activities = async () => (await db.query<{ id: string; dealId: string | null }>('SELECT * FROM "Activity" ORDER BY id')).rows;
    const accounts = async () => (await db.query('SELECT * FROM "EmailAccount" ORDER BY id')).rows;
    const before = await activities();
    const messages = (await db.query('SELECT * FROM "MailboxMessage" ORDER BY id')).rows;
    const migration = await readFile(resolve(__dirname, '../../../prisma/migrations/20261212000000_mailbox_activity_deals/migration.sql'), 'utf8');
    await db.exec(migration);
    const after = await activities();
    expect(after).toEqual(before.map(row => row.id.startsWith('repair-') ? { ...row, dealId: row.id === 'repair-other-tenant' ? 'deal-b' : 'deal-a' } : row));
    expect(await accounts()).toEqual([{ id: 'mail-a', mailboxVersion: 8 }, { id: 'mail-b', mailboxVersion: 11 }, { id: 'untouched', mailboxVersion: 3 }]);
    expect((await db.query('SELECT * FROM "MailboxMessage" ORDER BY id')).rows).toEqual(messages);
    await db.exec(migration);
    expect(await activities()).toEqual(after);
    expect(await accounts()).toEqual([{ id: 'mail-a', mailboxVersion: 8 }, { id: 'mail-b', mailboxVersion: 11 }, { id: 'untouched', mailboxVersion: 3 }]);
  } finally { await db.close(); }
});
