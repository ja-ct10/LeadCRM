import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const migrationsDir = path.resolve(
  __dirname,
  '../../../prisma/migrations'
);

const buggyMigrationPath = path.join(
  migrationsDir,
  '20260807080905_init',
  'migration.sql'
);

/**
 * Bug Condition Exploration Test
 *
 * Validates: Requirements 1.1
 *
 * Property 1: Bug Condition - Migration references non-existent requiredFields column
 *
 * Migration `20260807080905_init` (position 6) contains:
 *   ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT
 *
 * But `requiredFields` is only created in migration `20260807130000_add_stage_governance`
 * (position 10). This means the ALTER references a column that does not exist at
 * execution time, causing PostgreSQL error 42703 on fresh deployments.
 *
 * This test asserts that migration 20260807080905_init should NOT contain any
 * ALTER TABLE statement referencing columns that only exist in later migrations.
 *
 * EXPECTED: This test FAILS on unfixed code (confirms bug exists).
 * After the fix is applied, this test should PASS.
 */
describe('Migration Ordering - Bug Condition Exploration', () => {
  const stageGovernanceMigrationPath = path.join(
    migrationsDir,
    '20260807130000_add_stage_governance',
    'migration.sql'
  );

  // Get ordered list of migration folder names
  function getMigrationOrder(): string[] {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(); // Prisma applies migrations in lexicographic order
  }

  // Parse ALTER TABLE ... ALTER COLUMN statements from SQL
  function parseAlterColumnStatements(sql: string): Array<{ table: string; column: string }> {
    const regex = /ALTER\s+TABLE\s+"(\w+)"\s+ALTER\s+COLUMN\s+"(\w+)"/gi;
    const results: Array<{ table: string; column: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sql)) !== null) {
      results.push({ table: match[1], column: match[2] });
    }
    return results;
  }

  // Parse ADD COLUMN statements from SQL
  function parseAddColumnStatements(sql: string): Array<{ table: string; column: string }> {
    const regex = /ALTER\s+TABLE\s+"(\w+)"\s+ADD\s+COLUMN\s+"(\w+)"/gi;
    const results: Array<{ table: string; column: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sql)) !== null) {
      results.push({ table: match[1], column: match[2] });
    }
    return results;
  }

  it('property: migration 20260807080905_init should not reference columns created in later migrations', () => {
    const migrationOrder = getMigrationOrder();
    const buggyMigrationIndex = migrationOrder.indexOf('20260807080905_init');
    const stageGovernanceIndex = migrationOrder.indexOf('20260807130000_add_stage_governance');

    // Sanity: confirm both migrations exist and ordering
    expect(buggyMigrationIndex).toBeGreaterThan(-1);
    expect(stageGovernanceIndex).toBeGreaterThan(-1);
    expect(stageGovernanceIndex).toBeGreaterThan(buggyMigrationIndex);

    // Read the buggy migration content
    const buggyMigrationSql = fs.readFileSync(buggyMigrationPath, 'utf-8');

    // Collect columns created in ALL migrations AFTER the buggy one
    const laterMigrations = migrationOrder.slice(buggyMigrationIndex + 1);
    const columnsCreatedLater: Array<{ table: string; column: string; migration: string }> = [];

    for (const migrationName of laterMigrations) {
      const migrationFile = path.join(migrationsDir, migrationName, 'migration.sql');
      if (!fs.existsSync(migrationFile)) continue;
      const sql = fs.readFileSync(migrationFile, 'utf-8');
      const addedColumns = parseAddColumnStatements(sql);
      for (const col of addedColumns) {
        columnsCreatedLater.push({ ...col, migration: migrationName });
      }
    }

    // Parse ALTER COLUMN statements in the buggy migration
    const alteredColumns = parseAlterColumnStatements(buggyMigrationSql);

    // Property: use fast-check to assert for ALL altered columns in this migration,
    // NONE of them should reference a table/column pair that is only created later
    fc.assert(
      fc.property(
        fc.constantFrom(...alteredColumns),
        (alteredCol) => {
          const createdLater = columnsCreatedLater.find(
            (c) => c.table === alteredCol.table && c.column === alteredCol.column
          );

          // The property: an altered column must NOT be one that is only created later
          // If createdLater is found, this column does not exist at migration execution time
          if (createdLater) {
            throw new Error(
              `Migration 20260807080905_init references "${alteredCol.table}"."${alteredCol.column}" ` +
              `via ALTER COLUMN, but this column is only created in later migration ` +
              `"${createdLater.migration}" (position ${migrationOrder.indexOf(createdLater.migration) + 1}). ` +
              `Column does not exist at execution point of migration 6.`
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: migration should not contain ALTER TABLE "Stage" ALTER COLUMN "requiredFields"', () => {
    const buggyMigrationSql = fs.readFileSync(buggyMigrationPath, 'utf-8');

    // Property: for any substring of the migration SQL that matches an ALTER TABLE pattern,
    // it must not reference Stage.requiredFields (which doesn't exist until migration 10)
    fc.assert(
      fc.property(
        fc.constant(buggyMigrationSql),
        (sql) => {
          const containsInvalidAlter = sql.includes(
            'ALTER TABLE "Stage" ALTER COLUMN "requiredFields"'
          );

          if (containsInvalidAlter) {
            throw new Error(
              'Migration 20260807080905_init contains ' +
              '`ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` ' +
              'but "requiredFields" column does not exist until migration ' +
              '20260807130000_add_stage_governance (position 10 in sequence). ' +
              'This causes PostgreSQL error 42703 on fresh deployments.'
            );
          }

          return true;
        }
      ),
      { numRuns: 1 }
    );
  });
});

/**
 * Preservation Property Tests
 *
 * Validates: Requirements 3.4
 *
 * Property 2: Preservation - Deal tags DROP DEFAULT statement preserved
 *
 * Migration `20260807080905_init` contains a valid statement:
 *   ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT
 *
 * This statement must NOT be removed by the fix. These tests assert the
 * Deal ALTER statement is always present in the migration file and that
 * the migration file maintains valid SQL structure.
 *
 * EXPECTED: These tests PASS on both unfixed and fixed code.
 */
describe('Migration Ordering - Preservation Properties', () => {
  it('property: migration ALWAYS contains ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT', () => {
    const migrationSql = fs.readFileSync(buggyMigrationPath, 'utf-8');

    // Property: for the migration file content, it must ALWAYS contain
    // the Deal tags DROP DEFAULT statement — this valid statement must survive any edit
    fc.assert(
      fc.property(
        fc.constant(migrationSql),
        (sql) => {
          const containsDealAlter = sql.includes(
            'ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT'
          );

          if (!containsDealAlter) {
            throw new Error(
              'Migration 20260807080905_init MUST contain ' +
              '`ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT` — ' +
              'this valid statement must be preserved after any fix. ' +
              'The Deal.tags column exists at this migration execution point ' +
              'and the DROP DEFAULT is required for correct schema state.'
            );
          }

          return true;
        }
      ),
      { numRuns: 1 }
    );
  });

  it('property: migration file has valid SQL structure with proper comment', () => {
    const migrationSql = fs.readFileSync(buggyMigrationPath, 'utf-8');

    // Property: the migration file must maintain valid SQL structure:
    // - Contains at least the Deal ALTER TABLE statement
    // - Has proper SQL comment structure (-- AlterTable preceding the statement)
    // - Is non-empty and contains actual SQL
    fc.assert(
      fc.property(
        fc.constant(migrationSql),
        (sql) => {
          // Must not be empty
          if (sql.trim().length === 0) {
            throw new Error('Migration file must not be empty');
          }

          // Must contain the -- AlterTable comment for Deal statement
          if (!sql.includes('-- AlterTable')) {
            throw new Error(
              'Migration file must contain "-- AlterTable" SQL comment ' +
              'preceding the ALTER TABLE statement'
            );
          }

          // Must contain the Deal ALTER TABLE statement
          if (!sql.includes('ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;')) {
            throw new Error(
              'Migration file must contain the complete Deal ALTER statement ' +
              'with semicolon terminator'
            );
          }

          // The comment must precede the Deal ALTER (proper structure)
          const commentIndex = sql.indexOf('-- AlterTable');
          const dealAlterIndex = sql.indexOf('ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;');
          if (commentIndex > dealAlterIndex) {
            throw new Error(
              'The "-- AlterTable" comment must precede the ' +
              'ALTER TABLE "Deal" statement in the migration file'
            );
          }

          return true;
        }
      ),
      { numRuns: 1 }
    );
  });

  it('property: Deal ALTER TABLE statement is a complete valid SQL statement', () => {
    const migrationSql = fs.readFileSync(buggyMigrationPath, 'utf-8');

    // Property: the Deal ALTER TABLE statement must be a syntactically complete SQL statement
    // (ends with semicolon, uses proper quoting, has correct ALTER COLUMN syntax)
    fc.assert(
      fc.property(
        fc.constant(migrationSql),
        (sql) => {
          // Extract lines containing the Deal ALTER
          const lines = sql.split('\n');
          const dealAlterLine = lines.find((line) =>
            line.includes('ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT')
          );

          if (!dealAlterLine) {
            throw new Error('Deal ALTER TABLE statement not found in migration');
          }

          // Must end with semicolon (complete SQL statement)
          if (!dealAlterLine.trim().endsWith(';')) {
            throw new Error(
              'Deal ALTER TABLE statement must end with semicolon — ' +
              'incomplete SQL statement detected'
            );
          }

          // Must use double-quoted identifiers (PostgreSQL standard)
          if (!dealAlterLine.includes('"Deal"') || !dealAlterLine.includes('"tags"')) {
            throw new Error(
              'Deal ALTER TABLE statement must use double-quoted identifiers ' +
              '("Deal" and "tags") for PostgreSQL compatibility'
            );
          }

          return true;
        }
      ),
      { numRuns: 1 }
    );
  });
});
