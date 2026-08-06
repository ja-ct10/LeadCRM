-- CreateEnum: ContactLifecycleStage
CREATE TYPE "ContactLifecycleStage" AS ENUM ('LEAD', 'QUALIFIED', 'CONTACT', 'CUSTOMER', 'CHURNED', 'DISQUALIFIED');

-- AlterTable: Add lifecycleStage, recordType, qualifiedAt, disqualifiedReason to Contact
ALTER TABLE "Contact" ADD COLUMN "lifecycleStage" "ContactLifecycleStage" NOT NULL DEFAULT 'LEAD';
ALTER TABLE "Contact" ADD COLUMN "recordType" TEXT;
ALTER TABLE "Contact" ADD COLUMN "qualifiedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "disqualifiedReason" TEXT;

-- Backfill: derive lifecycleStage from existing data
-- 1. Contacts with customerType = 'Active Customer' → CUSTOMER
UPDATE "Contact" SET "lifecycleStage" = 'CUSTOMER'
WHERE "customerType" = 'Active Customer';

-- 2. Contacts with status = 'CLOSED' (legacy customer indicator) → CUSTOMER
UPDATE "Contact" SET "lifecycleStage" = 'CUSTOMER'
WHERE "status" = 'CLOSED' AND "lifecycleStage" != 'CUSTOMER';

-- 3. Contacts with status = 'CANCELLED' → DISQUALIFIED
UPDATE "Contact" SET "lifecycleStage" = 'DISQUALIFIED'
WHERE "status" = 'CANCELLED' AND "lifecycleStage" = 'LEAD';

-- 4. Contacts with convertedAt set → at least CONTACT
UPDATE "Contact" SET "lifecycleStage" = 'CONTACT', "qualifiedAt" = "convertedAt"
WHERE "convertedAt" IS NOT NULL AND "lifecycleStage" = 'LEAD';

-- 5. Contacts linked to a Deal via ContactDeal → at least CONTACT
UPDATE "Contact" SET "lifecycleStage" = 'CONTACT'
WHERE "id" IN (SELECT DISTINCT "contactId" FROM "ContactDeal")
AND "lifecycleStage" = 'LEAD';

-- 6. Contacts with customerType = 'Inactive Customer' or 'Former Customer' → CHURNED
UPDATE "Contact" SET "lifecycleStage" = 'CHURNED'
WHERE "customerType" IN ('Inactive Customer', 'Former Customer')
AND "lifecycleStage" NOT IN ('CUSTOMER', 'DISQUALIFIED');

-- CreateIndex
CREATE INDEX "Contact_tenantId_lifecycleStage_idx" ON "Contact"("tenantId", "lifecycleStage");
