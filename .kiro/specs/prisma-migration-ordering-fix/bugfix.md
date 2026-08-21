# Bugfix Requirements Document

## Introduction

Render deployment fails because Prisma migration `20260807080905_init` (6th in the migration list) executes `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` — but the `requiredFields` column does not exist at that point. It is created later in migration `20260807130000_add_stage_governance` (10th in the list). This causes PostgreSQL error 42703 ("column does not exist"), which blocks fresh deployments, `prisma migrate reset`, and new developer onboarding.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `prisma migrate deploy` or `prisma migrate reset` runs migration `20260807080905_init` THEN the system fails with PostgreSQL error 42703: `column "requiredFields" of relation "Stage" does not exist` because the migration attempts to alter a column that has not been created yet

1.2 WHEN a fresh database setup is performed (new developer or CI) THEN the system cannot complete the migration sequence and the backend fails to start

1.3 WHEN Render deployment executes the build command (`npx prisma migrate reset --force`) THEN the deployment fails entirely and the backend is unreachable

### Expected Behavior (Correct)

2.1 WHEN `prisma migrate deploy` or `prisma migrate reset` runs migration `20260807080905_init` THEN the system SHALL complete successfully without referencing columns that do not yet exist at that point in the migration sequence

2.2 WHEN a fresh database setup is performed (new developer or CI) THEN the system SHALL complete all migrations in sequence without dependency errors and the backend SHALL start successfully

2.3 WHEN Render deployment executes the build command THEN the deployment SHALL complete all migrations successfully and the backend SHALL become reachable

### Unchanged Behavior (Regression Prevention)

3.1 WHEN migration `20260807130000_add_stage_governance` runs THEN the system SHALL CONTINUE TO create the `requiredFields` column on the `Stage` table with type `TEXT[]` and default `ARRAY[]::TEXT[]`

3.2 WHEN migration `20260808063611_init_campaigns` runs (after `requiredFields` column exists) THEN the system SHALL CONTINUE TO execute `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` successfully

3.3 WHEN all migrations complete THEN the final `Stage` table schema SHALL CONTINUE TO have a `requiredFields` column of type `String[]` with no default (matching the current Prisma schema definition)

3.4 WHEN migration `20260807080905_init` runs THEN the system SHALL CONTINUE TO execute `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT` (the other statement in the same migration that is not affected by this bug)
