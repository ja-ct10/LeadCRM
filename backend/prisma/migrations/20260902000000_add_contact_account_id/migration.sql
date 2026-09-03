-- ============================================================
-- Migration: add_contact_account_id
-- Phase 1 (Expand) of the CRM Data Model Consolidation (ADR-001).
-- Adds the canonical Contact -> Account relationship.
--
-- ADDITIVE and NON-DESTRUCTIVE:
--   - adds nullable "Contact"."accountId"
--   - adds FK Contact.accountId -> Account.id (ON DELETE SET NULL)
--   - adds index on ("tenantId", "accountId")
--
-- "Contact"."organizationId" is intentionally left in place. It is removed
-- later in the contract phase (Phase 5) once all reads/writes use accountId
-- and verification passes.
--
-- References only columns that exist at this point in the sequence
-- (Account and Contact both already exist). Idempotent guards included.
-- ============================================================

-- 1. Add the nullable accountId column
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- 2. Index for tenant-scoped lookups by account
CREATE INDEX IF NOT EXISTS "Contact_tenantId_accountId_idx" ON "Contact"("tenantId", "accountId");

-- 3. Foreign key -> Account (idempotent)
DO $$ BEGIN
  ALTER TABLE "Contact"
    ADD CONSTRAINT "Contact_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
