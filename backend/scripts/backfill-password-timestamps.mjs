// Explicit deployment target only. Never reads the application's .env or runs at startup.
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

const legacy = '"passwordHash" IS NOT NULL AND "passwordChangedAt" IS NULL AND "mustChangePassword" = false';
const auditSql = `SELECT count(*)::text AS total,
  count(*) FILTER (WHERE ${legacy})::text AS eligible,
  count(*) FILTER (WHERE "passwordChangedAt" IS NOT NULL)::text AS initialized,
  md5(COALESCE(string_agg((to_jsonb(u) - 'passwordChangedAt')::text, '' ORDER BY id), '')) AS preserved
  FROM "User" u`;

export function parseOptions(args, databaseUrl) {
  const target = args.find(arg => arg.startsWith('--target='))?.slice(9);
  if (!databaseUrl || !target) throw new Error('PASSWORD_EXPIRATION_DATABASE_URL and --target=host:port/database are required.');
  const url = new URL(databaseUrl);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('A PostgreSQL target is required.');
  const identity = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (target !== identity) throw new Error('The explicit target does not match the database URL.');
  const apply = args.includes('--apply');
  const countArg = args.find(arg => arg.startsWith('--expected-count='))?.slice(17);
  if (args.some(arg => arg !== '--apply' && !arg.startsWith('--target=') && !arg.startsWith('--expected-count='))) throw new Error('Unknown argument.');
  if (apply && (!countArg || !/^\d+$/.test(countArg) || !Number.isSafeInteger(Number(countArg)))) throw new Error('--apply requires --expected-count from the read-only audit.');
  return { target, apply, expectedCount: countArg === undefined ? undefined : Number(countArg) };
}

export async function backfillPasswordTimestamps(db, { apply = false, expectedCount } = {}) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe(apply ? 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE' : 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    if (apply) await tx.$executeRawUnsafe('LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE');
    const [before] = await tx.$queryRawUnsafe(auditSql);
    if (!apply) return { readOnly: true, total: before.total, eligible: before.eligible, initialized: before.initialized };
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 0 || Number(before.eligible) !== expectedCount) throw new Error('Eligible count differs from the approved audit; no timestamps changed.');
    const known = await tx.$queryRawUnsafe('SELECT id, "passwordChangedAt" FROM "User" WHERE "passwordChangedAt" IS NOT NULL ORDER BY id');
    const changed = await tx.$queryRawUnsafe(`UPDATE "User" SET "passwordChangedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE ${legacy} RETURNING id, "passwordChangedAt"`);
    const [after] = await tx.$queryRawUnsafe(auditSql);
    const timestamps = await tx.$queryRawUnsafe('SELECT id, "passwordChangedAt" FROM "User" WHERE "passwordChangedAt" IS NOT NULL ORDER BY id');
    const previousById = new Map(known.map(row => [row.id, new Date(row.passwordChangedAt).getTime()]));
    const preservedKnown = timestamps.filter(row => previousById.has(row.id));
    if (changed.length !== expectedCount || after.eligible !== '0' || before.total !== after.total || before.preserved !== after.preserved ||
        preservedKnown.length !== known.length || preservedKnown.some(row => new Date(row.passwordChangedAt).getTime() !== previousById.get(row.id))) {
      throw new Error('Backfill preservation verification failed; transaction rolled back.');
    }
    return { readOnly: false, total: after.total, eligibleBefore: before.eligible, eligibleAfter: after.eligible, updated: changed.length,
      passwordChangedAt: changed[0] ? new Date(changed[0].passwordChangedAt).toISOString() : null, preservationVerified: true };
  }, { maxWait: 15_000, timeout: 60_000 });
}

async function main() {
  const url = process.env.PASSWORD_EXPIRATION_DATABASE_URL;
  const options = parseOptions(process.argv.slice(2), url);
  const db = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try { console.log(JSON.stringify({ target: options.target, ...await backfillPasswordTimestamps(db, options) }, null, 2)); }
  catch (error) {
    // Prisma diagnostics can include connection details; print only the safe failure category.
    console.error(error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'Database operation failed; backfill did not commit.');
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Invalid backfill configuration.'); process.exitCode = 1; });
