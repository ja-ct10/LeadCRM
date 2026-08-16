-- ============================================================
-- Migration: split_crm_models
-- Adds Account, Lead, Customer as distinct CRM entities.
-- Account replaces Organization as the company/account model.
-- Lead and Customer replace the generic Contact model with
-- lifecycle-specific entities.
-- This migration is additive and non-destructive.
-- Existing Contact, Organization, and ContactDeal tables are
-- left in place for backward compatibility.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. CREATE TABLE: Account (company/account entity)
--    Replaces Organization with richer fields.
--    Organization table is preserved unchanged.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "size" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerType" TEXT NOT NULL DEFAULT 'Prospect',
    "customerSince" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'Philippines',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- 2. CREATE TABLE: Lead (pre-conversion prospect entity)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT,
    "assignedUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "address" TEXT,
    "productInterest" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Inquiry',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- 3. CREATE TABLE: Customer (converted/active customer entity)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT,
    "assignedUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "address" TEXT,
    "productInterest" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- 4. CREATE TABLE: LeadDeal (Lead ↔ Deal junction)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadDeal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDeal_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- 5. CREATE TABLE: CustomerDeal (Customer ↔ Deal junction)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CustomerDeal" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDeal_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- 6. ALTER TABLE: Deal — add Lead/Customer/Account FKs
--    (contactId and organizationId kept for backward compat)
-- ─────────────────────────────────────────────
ALTER TABLE "Deal"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT,
    ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- ─────────────────────────────────────────────
-- 7. ALTER TABLE: Task — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 8. ALTER TABLE: Activity — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "Activity"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 9. ALTER TABLE: Invoice — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 10. ALTER TABLE: ServiceOrder — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "ServiceOrder"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 11. ALTER TABLE: CampaignContact — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "CampaignContact"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 12. ALTER TABLE: EmailDeliveryLog — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "EmailDeliveryLog"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 13. ALTER TABLE: SMSQueue — add Lead/Customer FKs
-- ─────────────────────────────────────────────
ALTER TABLE "SMSQueue"
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─────────────────────────────────────────────
-- 14. CREATE INDEXES: Account
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Account_tenantId_isArchived_idx" ON "Account"("tenantId", "isArchived");
CREATE INDEX IF NOT EXISTS "Account_tenantId_name_idx" ON "Account"("tenantId", "name");

-- ─────────────────────────────────────────────
-- 15. CREATE INDEXES: Lead
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_assignedUserId_idx" ON "Lead"("tenantId", "assignedUserId");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_email_idx" ON "Lead"("tenantId", "email");

-- ─────────────────────────────────────────────
-- 16. CREATE INDEXES: Customer
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_assignedUserId_idx" ON "Customer"("tenantId", "assignedUserId");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_email_idx" ON "Customer"("tenantId", "email");

-- ─────────────────────────────────────────────
-- 17. CREATE INDEXES: LeadDeal
-- ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "LeadDeal_leadId_dealId_key" ON "LeadDeal"("leadId", "dealId");
CREATE INDEX IF NOT EXISTS "LeadDeal_dealId_tenantId_idx" ON "LeadDeal"("dealId", "tenantId");
CREATE INDEX IF NOT EXISTS "LeadDeal_leadId_tenantId_idx" ON "LeadDeal"("leadId", "tenantId");

-- ─────────────────────────────────────────────
-- 18. CREATE INDEXES: CustomerDeal
-- ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerDeal_customerId_dealId_key" ON "CustomerDeal"("customerId", "dealId");
CREATE INDEX IF NOT EXISTS "CustomerDeal_dealId_tenantId_idx" ON "CustomerDeal"("dealId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerDeal_customerId_tenantId_idx" ON "CustomerDeal"("customerId", "tenantId");

-- ─────────────────────────────────────────────
-- 19. ADD FOREIGN KEYS (idempotent — skip if already exists)
-- ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadDeal" ADD CONSTRAINT "LeadDeal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadDeal" ADD CONSTRAINT "LeadDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadDeal" ADD CONSTRAINT "LeadDeal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadDeal" ADD CONSTRAINT "LeadDeal_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerDeal" ADD CONSTRAINT "CustomerDeal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerDeal" ADD CONSTRAINT "CustomerDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerDeal" ADD CONSTRAINT "CustomerDeal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerDeal" ADD CONSTRAINT "CustomerDeal_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

