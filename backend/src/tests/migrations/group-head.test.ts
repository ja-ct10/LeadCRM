import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GroupHeadSchema, isGroupHeadRole } from '@leadcrm/shared';

it('preserves memberships, enforces one head per Group and clears lifecycle designations without restoring them', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "User" (id text PRIMARY KEY, "tenantId" text NOT NULL, status text NOT NULL, role text NOT NULL);
      CREATE TABLE "TenantGroupMember" (id text PRIMARY KEY, "tenantId" text NOT NULL, "groupId" text NOT NULL, "userId" text NOT NULL REFERENCES "User"(id));
      INSERT INTO "User" VALUES ('manager','tenant','ACTIVE','Sales Manager'),('second','tenant','ACTIVE','Head of Sales');
      INSERT INTO "TenantGroupMember" VALUES ('one','tenant','sales','manager'),('two','tenant','sales','second'),('other','tenant','support','manager');`);
    await db.exec(readFileSync(resolve(__dirname, '../../../prisma/migrations/20261222000000_group_head_assignment/migration.sql'), 'utf8'));
    expect((await db.query(`SELECT "isHead" FROM "TenantGroupMember"`)).rows).toEqual([{ isHead: false }, { isHead: false }, { isHead: false }]);
    await db.exec(`UPDATE "TenantGroupMember" SET "isHead"=true WHERE "userId"='manager'`);
    await expect(db.exec(`UPDATE "TenantGroupMember" SET "isHead"=true WHERE id='two'`)).rejects.toThrow(/unique/i);
    await db.exec(`UPDATE "User" SET role=' Head_of-Sales ' WHERE id='manager'`);
    expect((await db.query(`SELECT id FROM "TenantGroupMember" WHERE "isHead"`)).rows).toHaveLength(2);
    await db.exec(`UPDATE "User" SET status='PENDING' WHERE id='manager'`);
    expect((await db.query(`SELECT id FROM "TenantGroupMember" WHERE "isHead"`)).rows).toEqual([]);
    await db.exec(`UPDATE "User" SET status='ACTIVE' WHERE id='manager'`);
    expect((await db.query(`SELECT id FROM "TenantGroupMember" WHERE "isHead"`)).rows).toEqual([]);
    await db.exec(`UPDATE "TenantGroupMember" SET "isHead"=true WHERE id='two'; UPDATE "User" SET role='Sales Agent' WHERE id='second'`);
    expect((await db.query(`SELECT id FROM "TenantGroupMember" WHERE "isHead"`)).rows).toEqual([]);
    await db.exec(`UPDATE "TenantGroupMember" SET "isHead"=true WHERE id='one'; DELETE FROM "TenantGroupMember" WHERE id='one'`);
    expect((await db.query(`SELECT id FROM "TenantGroupMember" WHERE "isHead"`)).rows).toEqual([]);
    expect((await db.query(`SELECT id FROM "TenantGroupMember"`)).rows).toHaveLength(2);
  } finally { await db.close(); }
}, 30000);

it('accepts only a UUID or explicit null and limits head eligibility to primary manager labels', () => {
  expect(GroupHeadSchema.safeParse({ userId: null }).success).toBe(true);
  for (const input of [{}, { userId: '' }, { userId: 'invalid' }, { userId: null, role: 'Client Admin' }]) expect(GroupHeadSchema.safeParse(input).success).toBe(false);
  for (const role of ['Sales Manager', 'Head of Sales', ' sales-manager ', 'HEAD_OF_SALES']) expect(isGroupHeadRole(role)).toBe(true);
  for (const role of ['Sales Agent', 'Sales Representative', 'Client Admin', 'Top Management', 'Sales Manager Assistant']) expect(isGroupHeadRole(role)).toBe(false);
});
