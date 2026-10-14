import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { backfillPasswordTimestamps, parseOptions } from './backfill-password-timestamps.mjs';

test('requires an explicit matching target and an approved count before writes', () => {
  const url = 'postgresql://user:secret@localhost:5432/disposable';
  assert.throws(() => parseOptions([], url));
  assert.throws(() => parseOptions(['--target=other:5432/disposable'], url));
  assert.throws(() => parseOptions(['--target=localhost:5432/disposable', '--apply'], url));
  assert.equal(parseOptions(['--target=localhost:5432/disposable'], url).apply, false);
});
test('backfills only established null timestamps and preserves all other fields and known timestamps', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`CREATE TABLE "User" (id text PRIMARY KEY, "passwordHash" text, "passwordChangedAt" timestamp(3), "mustChangePassword" boolean, "onboardingCompletedAt" timestamp, "tenantId" text);
      INSERT INTO "User" VALUES ('legacy-a','hash-a',NULL,false,'2026-01-01','tenant-a'), ('legacy-b','hash-b',NULL,false,'2026-02-01','tenant-b'),
      ('known','known-hash','2026-03-01',false,'2026-01-01','tenant-a'), ('temporary','temporary-hash',NULL,true,NULL,'tenant-a'), ('passwordless',NULL,NULL,false,'2026-01-01','tenant-a');`);
    const db = { $transaction: callback => pg.transaction(async tx => callback({
      $queryRawUnsafe: async sql => (await tx.query(sql)).rows,
      $executeRawUnsafe: sql => tx.exec(sql),
    })) };
    const before = (await pg.query('SELECT * FROM "User" ORDER BY id')).rows;
    assert.equal((await backfillPasswordTimestamps(db)).eligible, '2');
    assert.deepEqual((await pg.query('SELECT * FROM "User" ORDER BY id')).rows, before);
    await assert.rejects(backfillPasswordTimestamps(db, { apply: true, expectedCount: 3 }));
    const result = await backfillPasswordTimestamps(db, { apply: true, expectedCount: 2 });
    assert.equal(result.updated, 2);
    const after = (await pg.query('SELECT * FROM "User" ORDER BY id')).rows;
    for (let i = 0; i < before.length; i++) {
      if (before[i].id.startsWith('legacy-')) {
        assert.ok(after[i].passwordChangedAt);
        assert.deepEqual({ ...after[i], passwordChangedAt: null }, before[i]);
      } else assert.deepEqual(after[i], before[i]);
    }
    assert.equal(after.find(row => row.id === 'legacy-a').passwordChangedAt.getTime(), after.find(row => row.id === 'legacy-b').passwordChangedAt.getTime());
    assert.equal((await backfillPasswordTimestamps(db, { apply: true, expectedCount: 0 })).updated, 0);
    assert.deepEqual((await pg.query('SELECT * FROM "User" ORDER BY id')).rows, after);
  } finally { await pg.close(); }
});
