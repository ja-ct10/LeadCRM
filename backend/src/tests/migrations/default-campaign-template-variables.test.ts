import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { DEFAULT_CAMXIAN_TEMPLATES } from '../../modules/marketing/templates/default-templates';

it('repairs only default template tokens across tenants without changing history or identity, and is idempotent', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TABLE "Tenant" (id TEXT PRIMARY KEY);
      INSERT INTO "Tenant" VALUES ('tenant-a'), ('tenant-b');
      CREATE TABLE "Template" (id TEXT PRIMARY KEY, "tenantId" TEXT REFERENCES "Tenant"(id),
        name TEXT, type TEXT, category TEXT, subject TEXT, content TEXT, "isArchived" BOOLEAN,
        "createdAt" TIMESTAMP DEFAULT '2026-01-01', "updatedAt" TIMESTAMP DEFAULT '2026-02-01');
      CREATE TABLE "Campaign" (id TEXT PRIMARY KEY, "tenantId" TEXT REFERENCES "Tenant"(id),
        "emailTemplateId" TEXT REFERENCES "Template"(id), "smsTemplateId" TEXT REFERENCES "Template"(id),
        subject TEXT, body TEXT, status TEXT);
    `);
    const legacyContent = 'Hi {{first_name}} / {{firstName}} / {{first_name}}, please call us tomorrow for {{company_name}} / {{companyName}}. {{sender_name}} {{sender_email}} {{ first_name }} first_name {{customFieldValues.first_name}}';
    const canonicalContent = 'Hi {{firstName}} / {{firstName}} / {{firstName}}, please call us tomorrow for {{companyName}} / {{companyName}}. {{sender_name}} {{sender_email}} {{ first_name }} first_name {{customFieldValues.first_name}}';
    const legacySubject = 'Follow {{first_name}} at {{company_name}} / {{firstName}}';
    const canonicalSubject = 'Follow {{firstName}} at {{companyName}} / {{firstName}}';
    const expected = new Map<string, { subject: string | null; content: string }>();
    let changed = 0;
    for (const tenantId of ['tenant-a', 'tenant-b']) {
      for (const [index, sample] of DEFAULT_CAMXIAN_TEMPLATES.entries()) {
        const variants = [
          { key: 'legacy', subject: legacySubject, content: legacyContent, repair: true },
          { key: 'null-subject', subject: null, content: legacyContent, repair: true },
          { key: 'subject-only', subject: legacySubject, content: canonicalContent, repair: true },
          { key: 'correct', subject: canonicalSubject, content: canonicalContent, repair: false },
          { key: 'wrong-type', subject: legacySubject, content: legacyContent, repair: false },
          { key: 'custom-name', subject: legacySubject, content: legacyContent, repair: false },
        ];
        for (const variant of variants) {
          const id = `${tenantId}-${index}-${variant.key}`;
          await db.query(`INSERT INTO "Template" (id, "tenantId", name, type, category, subject, content, "isArchived")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, tenantId,
            variant.key === 'custom-name' ? `${sample.name} custom` : sample.name,
            variant.key === 'wrong-type' ? sample.type === 'Email' ? 'SMS' : 'Email' : sample.type,
            'User-edited category', variant.subject, variant.content, index % 2 === 0]);
          expected.set(id, { subject: variant.repair && variant.subject !== null ? canonicalSubject : variant.subject,
            content: variant.repair ? canonicalContent : variant.content });
          if (variant.repair) changed++;
        }
      }
      await db.query(`INSERT INTO "Campaign" VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')`,
        [`${tenantId}-draft`, tenantId, `${tenantId}-0-legacy`, `${tenantId}-3-legacy`, legacySubject, legacyContent]);
    }
    const templates = () => db.query<{ id: string; subject: string | null; content: string }>('SELECT * FROM "Template" ORDER BY id');
    const before = (await templates()).rows;
    const campaignsBefore = (await db.query('SELECT * FROM "Campaign" ORDER BY id')).rows;
    const migration = await readFile(resolve(__dirname, '../../../prisma/migrations/20261211000000_normalize_default_campaign_template_variables/migration.sql'), 'utf8');
    expect((await db.query(migration)).affectedRows).toBe(changed);
    const after = (await templates()).rows;
    expect(after).toEqual(before.map(row => ({ ...row, ...expected.get(row.id) })));
    expect((await db.query('SELECT * FROM "Campaign" ORDER BY id')).rows).toEqual(campaignsBefore);
    expect((await db.query(migration)).affectedRows).toBe(0);
    expect((await templates()).rows).toEqual(after);
  } finally { await db.close(); }
}, 20000);
