# Prisma Migration Ordering Fix — Bugfix Design

## Overview

Migration `20260807080905_init` (6th in the sequence) contains an `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` statement that references a column which does not exist until migration `20260807130000_add_stage_governance` (10th in the sequence). This causes PostgreSQL error 42703 on fresh deployments, `prisma migrate reset`, and new developer setup. The fix removes the premature ALTER statement from the earlier migration, since the DROP DEFAULT is already correctly performed by the later migration `20260808063611_init_campaigns` (13th in the sequence) which runs after the column exists.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — migration `20260807080905_init` executes an ALTER on a non-existent column (`Stage.requiredFields`) during sequential migration application
- **Property (P)**: The desired behavior — migration `20260807080905_init` completes successfully by only altering columns that exist at that point in the sequence
- **Preservation**: The `Deal.tags` DROP DEFAULT in the same migration, the column creation in migration 10, and the DROP DEFAULT in migration 13 must all remain unchanged
- **Migration sequence**: The ordered list of 24 Prisma migrations applied by folder name (lexicographic timestamp order)
- **Position 6**: Migration `20260807080905_init` — the buggy migration
- **Position 10**: Migration `20260807130000_add_stage_governance` — creates `requiredFields` with default
- **Position 13**: Migration `20260808063611_init_campaigns` — drops the default (safe, column exists)

## Bug Details

### Bug Condition

The bug manifests when Prisma applies migration `20260807080905_init` against a database where the `Stage` table does not yet have a `requiredFields` column. This occurs on every fresh database setup (new developer, CI, `prisma migrate reset`, production deploy from scratch) because the column is not created until 4 migrations later.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type MigrationExecution
  OUTPUT: boolean
  
  RETURN input.migrationName == "20260807080905_init"
         AND input.executionMode IN ["deploy", "reset", "dev (fresh)"]
         AND columnExists("Stage", "requiredFields", input.databaseState) == false
END FUNCTION
```

### Examples

- **Fresh deploy on Render**: `prisma migrate reset --force` runs all migrations from scratch → hits position 6 → `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` → PostgreSQL error 42703 → deployment fails
- **New developer onboarding**: `prisma migrate dev` on empty database → same failure at position 6 → developer cannot start backend
- **CI pipeline**: automated test suite runs `prisma migrate deploy` on test database → migration 6 fails → all tests blocked
- **Edge case (safe)**: Existing production database that already ran all migrations → `prisma migrate deploy` skips already-applied migrations → no error (migration already recorded in `_prisma_migrations` table)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Migration `20260807080905_init` must continue to execute `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT` successfully
- Migration `20260807130000_add_stage_governance` must continue to create `requiredFields TEXT[] DEFAULT ARRAY[]::TEXT[]` on `Stage`
- Migration `20260808063611_init_campaigns` must continue to execute `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` (this is the correct location for this operation)
- The final schema state after all migrations must remain identical (Stage.requiredFields is `String[]` with no default)
- No other migration files are modified
- The migration folder name `20260807080905_init` remains unchanged (Prisma tracks by folder name)

**Scope:**
All migrations other than `20260807080905_init` are completely unaffected. The only change is removing a single SQL statement from one migration file. The database end-state is unchanged because the removed operation is duplicated (correctly) in migration 13.

## Hypothesized Root Cause

Based on the bug description, the root cause is:

1. **Premature statement in migration**: When the migration `20260807080905_init` was generated or manually composed, an `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` statement was included. At that point in the migration sequence, the `requiredFields` column does not exist — it is created 4 migrations later by `20260807130000_add_stage_governance`.

2. **Likely generation artifact**: This was likely caused by running `prisma migrate dev` while the Prisma schema already had `requiredFields` defined without a default, but against a database state where the column existed from a prior development branch. Prisma generated the ALTER to reconcile the drift, but the migration was committed without verifying sequential validity from a clean state.

3. **Duplicate operation**: The same `DROP DEFAULT` operation already exists correctly in migration `20260808063611_init_campaigns` (position 13), which runs after the column is created (position 10). The statement in position 6 is entirely redundant and invalid.

## Correctness Properties

Property 1: Bug Condition - Migration completes without referencing non-existent columns

_For any_ migration execution where `20260807080905_init` is applied to a database where `Stage.requiredFields` does not yet exist, the fixed migration SHALL complete successfully without PostgreSQL errors, executing only the `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT` statement.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Final schema state unchanged

_For any_ complete migration sequence execution (all 24 migrations applied in order), the fixed migration set SHALL produce the exact same final database schema as the intended schema — specifically, the `Stage` table SHALL have a `requiredFields` column of type `TEXT[]` with no default value, identical to what `prisma db pull` would produce against the current `schema.prisma`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/prisma/migrations/20260807080905_init/migration.sql`

**Specific Changes**:
1. **Remove the premature ALTER statement**: Delete the line `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT;` and its associated comment `-- AlterTable`
2. **Retain the Deal ALTER**: Keep `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;` and its comment intact

**Before (current content):**
```sql
-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT;
```

**After (fixed content):**
```sql
-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;
```

### What NOT to change:
- Do NOT modify any other migration file
- Do NOT create a new migration
- Do NOT squash or reorder migrations
- Do NOT rename the migration folder
- Do NOT modify `schema.prisma` (it is already correct)

## Testing Strategy

### Validation Approach

The testing strategy verifies that the full migration sequence runs cleanly from scratch and that the final schema matches the Prisma schema definition. Since this is a migration-file fix (not application code), testing is focused on migration execution rather than property-based testing of functions.

### Exploratory Bug Condition Checking

**Goal**: Confirm the bug exists by running migrations on a fresh database BEFORE applying the fix.

**Test Plan**: Execute `prisma migrate reset --force` or `prisma migrate deploy` against an empty database and observe the failure at migration 6.

**Test Cases**:
1. **Fresh migrate reset**: Run `npx prisma migrate reset --force` → observe error 42703 at `20260807080905_init` (will fail on unfixed code)
2. **Fresh migrate deploy**: Run `npx prisma migrate deploy` against empty database → observe same failure (will fail on unfixed code)

**Expected Counterexamples**:
- PostgreSQL error: `column "requiredFields" of relation "Stage" does not exist`
- Migration `20260807080905_init` is recorded as failed in `_prisma_migrations` table

### Fix Checking

**Goal**: Verify that for all fresh database states, the fixed migration sequence completes without errors.

**Pseudocode:**
```
FOR ALL database WHERE database.state == "empty" DO
  result := prisma_migrate_deploy(database, all_migrations)
  ASSERT result.exitCode == 0
  ASSERT result.errors == []
  ASSERT all_migrations_applied(database)
END FOR
```

**Test Cases**:
1. **Fresh migrate reset (post-fix)**: Run `npx prisma migrate reset --force` → all 24 migrations complete successfully
2. **Schema validation**: Run `npx prisma db pull` and compare against `schema.prisma` → schemas match
3. **Prisma validate**: Run `npx prisma validate` → passes without errors

### Preservation Checking

**Goal**: Verify that the final database schema is identical whether or not the removed statement was ever executed.

**Pseudocode:**
```
FOR ALL database WHERE all_migrations_applied(database) DO
  ASSERT columnExists("Stage", "requiredFields", database) == true
  ASSERT columnType("Stage", "requiredFields", database) == "TEXT[]"
  ASSERT columnHasDefault("Stage", "requiredFields", database) == false
  ASSERT columnExists("Deal", "tags", database) == true
  ASSERT columnHasDefault("Deal", "tags", database) == false
END FOR
```

**Test Cases**:
1. **Deal.tags DROP DEFAULT preserved**: After all migrations, verify `Deal.tags` has no default (the retained ALTER in migration 6 executed correctly)
2. **Stage.requiredFields column exists**: After all migrations, verify `Stage.requiredFields` exists as `TEXT[]` (created by migration 10)
3. **Stage.requiredFields no default**: After all migrations, verify `Stage.requiredFields` has no default (DROP DEFAULT executed by migration 13)
4. **No schema drift**: Run `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma` → reports no drift

### Unit Tests

- Not applicable (this is a migration SQL fix, not application code)

### Property-Based Tests

- Not directly applicable for SQL migration fixes. The "property" being tested is schema equivalence, which is validated by Prisma's built-in tooling (`prisma migrate diff`, `prisma validate`)

### Integration Tests

- Run full migration sequence from empty database → verify all 24 migrations pass
- Run `prisma migrate reset --force` → verify clean reset and re-apply
- Run backend server startup after migrations → verify no Prisma client errors
- Verify the application can read/write `Stage.requiredFields` and `Deal.tags` after migrations complete
