BEGIN;
-- Destructive: back up retired billing and domain data before deployment.
DELETE FROM "RolePermission" WHERE "module" IN ('billing', 'invoices');

-- DropForeignKey
ALTER TABLE "PlanFeature" DROP CONSTRAINT "PlanFeature_planId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_planId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentMethod" DROP CONSTRAINT "PaymentMethod_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantDomain" DROP CONSTRAINT "TenantDomain_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantDomainSettings" DROP CONSTRAINT "TenantDomainSettings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_dealId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_leadId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_contactId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_paymentMethodId_fkey";

-- DropIndex
DROP INDEX "Tenant_stripeCustomerId_key";

-- AlterTable
ALTER TABLE "SystemAdmin" DROP COLUMN "paymentMethods";

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "maxContacts",
DROP COLUMN "maxDeals",
DROP COLUMN "maxUsers",
DROP COLUMN "plan",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "subscriptionEndsAt",
DROP COLUMN "subscriptionStatus",
DROP COLUMN "trialEndsAt";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "invoiceId";

-- AlterTable
ALTER TABLE "TargetAudience" DROP COLUMN "paymentMethods";

-- AlterTable
ALTER TABLE "EmailAccount" DROP COLUMN "paymentMethods";

-- AlterTable
ALTER TABLE "AutomationRule" DROP COLUMN "paymentMethods";

-- DropTable
DROP TABLE "PricingPlan";

-- DropTable
DROP TABLE "PlanFeature";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "PaymentMethod";

-- DropTable
DROP TABLE "TenantDomain";

-- DropTable
DROP TABLE "TenantDomainSettings";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "PaymentTransaction";

-- DropTable
DROP TABLE "StripeWebhookEvent";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "PlanType";

-- DropEnum
DROP TYPE "BillingCycle";

-- DropEnum
DROP TYPE "WebhookEventStatus";


COMMIT;
