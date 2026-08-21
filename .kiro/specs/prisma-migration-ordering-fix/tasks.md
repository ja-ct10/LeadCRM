# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Migration references non-existent requiredFields column
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — migration `20260807080905_init` contains `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` which references a column that does not exist until migration `20260807130000_add_stage_governance`
  - Write a property-based test (using fast-check) that reads `backend/prisma/migrations/20260807080905_init/migration.sql` and asserts: for any column referenced in an ALTER TABLE statement in this migration, that column must NOT reference a table/column pair that is only created in a later migration
  - Concretely: parse the migration SQL and assert it does NOT contain `ALTER TABLE "Stage" ALTER COLUMN "requiredFields"` (since `requiredFields` does not exist at this migration's execution point)
  - The test asserts: migration `20260807080905_init` should only reference columns that exist at its execution point in the sequence
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because the migration contains the invalid ALTER TABLE statement)
  - Document counterexample: `migration.sql` contains `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT` but `requiredFields` is created 4 migrations later
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Deal tags DROP DEFAULT statement preserved
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: migration `20260807080905_init/migration.sql` currently contains `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT`
  - Observe: this is the valid statement in the migration that must NOT be removed
  - Write property-based test (using fast-check): for the migration file content, assert it ALWAYS contains `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT` — this valid statement must survive any edit
  - Additionally assert: the migration file remains valid SQL (contains at least the Deal ALTER TABLE statement, has proper comment structure)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms the Deal tags statement exists and will be preserved)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.4_

- [x] 3. Fix migration `20260807080905_init` — remove invalid requiredFields reference

  - [x] 3.1 Implement the fix
    - Remove the `-- AlterTable` comment preceding the Stage ALTER statement
    - Remove `ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT;`
    - Keep `-- AlterTable` comment and `ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;` intact
    - Final file content should be:
      ```sql
      -- AlterTable
      ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;
      ```
    - _Bug_Condition: migration contains ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT but requiredFields does not exist until migration 20260807130000_
    - _Expected_Behavior: migration completes without referencing non-existent columns_
    - _Preservation: Deal tags DROP DEFAULT statement remains intact; requiredFields DROP DEFAULT still handled by migration 20260808063611_init_campaigns_
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Migration no longer references non-existent column
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 asserts the migration does not contain the invalid requiredFields ALTER
    - When this test passes, it confirms the migration no longer references non-existent columns
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Deal tags statement still present
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms Deal tags DROP DEFAULT is still in the migration)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.4_

- [x] 4. Checkpoint - Ensure all tests pass and validate schema
  - Run `npx prisma validate` in backend to confirm schema is valid
  - Ensure all property-based tests pass
  - Verify migration file only contains the Deal tags ALTER TABLE statement
  - Ask the user if questions arise
