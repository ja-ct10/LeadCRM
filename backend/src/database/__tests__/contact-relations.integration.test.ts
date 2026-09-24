import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_campaign_test_\d+$/.test(url.pathname);
const db = new PrismaClient();
const tables = ['Deal', 'Task', 'Activity', 'CampaignContact', 'Invoice', 'EmailDeliveryLog', 'SMSQueue'];
const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations/20261005000000_contact_relation_names/migration.sql'), 'utf8').replace(/^--.*$/gm, '');
const statements = sql.split(/(DO \$\$[\s\S]*?\$\$;)/).flatMap(part => part.startsWith('DO $$') ? [part] : part.split(';'))
  .map(part => part.trim()).filter(part => part && !['BEGIN', 'COMMIT'].includes(part));

describe.skipIf(!disposable)('Contact relation migration on disposable PostgreSQL', () => {
  afterAll(() => db.$disconnect());
  async function fixture(dualColumns: boolean, check: (tx: Prisma.TransactionClient) => Promise<void>) {
    // The whole fixture rolls back, including its uniquely named schema.
    const schema = `contact_test_${randomUUID().replaceAll('-', '')}`;
    const rollback = new Error('fixture complete');
    try {
      await db.$transaction(async tx => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe('CREATE TABLE "Contact" (id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, environment TEXT NOT NULL)');
        await tx.$executeRawUnsafe('INSERT INTO "Contact" VALUES (\'contact-a\', \'tenant-a\', \'PRODUCTION\'), (\'contact-b\', \'tenant-a\', \'PRODUCTION\')');
        await tx.$executeRawUnsafe('CREATE TABLE "Customer" (id TEXT PRIMARY KEY)');
        await tx.$executeRawUnsafe('CREATE TABLE "CustomerDeal" (id TEXT PRIMARY KEY, "customerId" TEXT REFERENCES "Customer"(id))');
        for (const table of tables) {
          const oldContact = dualColumns ? `, "contactId" TEXT ${table === 'CampaignContact' ? 'NOT NULL' : ''} REFERENCES "Contact"(id)` : '';
          await tx.$executeRawUnsafe(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, environment TEXT NOT NULL, "campaignId" TEXT, "createdAt" TIMESTAMP DEFAULT now(), "customerId" TEXT REFERENCES "Contact"(id)${oldContact})`);
          await tx.$executeRawUnsafe(`INSERT INTO "${table}" (id, "tenantId", environment, "campaignId", "customerId"${dualColumns ? ', "contactId"' : ''}) VALUES ('row-a', 'tenant-a', 'PRODUCTION', 'campaign-a', 'contact-a'${dualColumns ? ", 'contact-a'" : ''})`);
        }
        await check(tx);
        throw rollback;
      }, { timeout: 30000 });
    } catch (error) { if (error !== rollback) throw error; }
  }
  const migrate = async (tx: Prisma.TransactionClient) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  };
  it.each([false, true])('preserves relationships and permits lead-only recipients (legacy columns: %s)', async dual => {
    await fixture(dual, async tx => {
      await migrate(tx);
      for (const table of tables) {
        expect(await tx.$queryRawUnsafe(`SELECT "contactId" FROM "${table}"`)).toEqual([{ contactId: 'contact-a' }]);
      }
      await tx.$executeRawUnsafe('INSERT INTO "CampaignContact" (id, "tenantId", environment, "campaignId") VALUES (\'lead-only\', \'tenant-a\', \'PRODUCTION\', \'campaign-a\')');
      expect(await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('Customer', 'CustomerDeal')`).toEqual([]);
      expect(await tx.$queryRaw`SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'customerId'`).toEqual([]);
      // Safe to retry an already-normalized schema.
      await migrate(tx);
    });
  });
  it('refuses to discard a nonempty Customer table', async () => {
    await expect(fixture(true, async tx => {
      await tx.$executeRawUnsafe('INSERT INTO "Customer" VALUES (\'legacy-record\')');
      await migrate(tx);
    })).rejects.toThrow(/Legacy Customer contains records/);
  });
  it('refuses conflicting old and new contact links', async () => {
    await expect(fixture(true, async tx => {
      await tx.$executeRawUnsafe('UPDATE "CampaignContact" SET "contactId" = \'contact-b\'');
      await migrate(tx);
    })).rejects.toThrow(/Conflicting contactId\/customerId/);
  });
  it('refuses a cross-tenant link', async () => {
    await expect(fixture(false, async tx => {
      await tx.$executeRawUnsafe('UPDATE "Contact" SET "tenantId" = \'other-tenant\'');
      await migrate(tx);
    })).rejects.toThrow(/Missing or out-of-scope Contact/);
  });
});
