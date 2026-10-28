ALTER TABLE "Lead" ADD COLUMN "sourceDetail" TEXT, ADD COLUMN "attribution" JSONB;
ALTER TABLE "Contact" ADD COLUMN "attribution" JSONB;
ALTER TABLE "Deal" ADD COLUMN "attribution" JSONB;
ALTER TABLE "FormSubmission" ADD COLUMN "attribution" JSONB, ADD COLUMN "attributionInput" JSONB;
CREATE TABLE "BusinessEmailConnection" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL UNIQUE REFERENCES "Tenant"("id"),
  "connectedById" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL, "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSyncAt" TIMESTAMP(3), "nextPageToken" TEXT,
  "syncError" TEXT, "leaseUntil" TIMESTAMP(3), "leaseId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BusinessEmailOAuthState" (
  "stateHash" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "sessionHash" TEXT NOT NULL, "verifier" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BusinessEmailOAuthState_expiresAt_idx" ON "BusinessEmailOAuthState"("expiresAt");
CREATE TABLE "BusinessEmailInquiry" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "connectionId" TEXT NOT NULL REFERENCES "BusinessEmailConnection"("id") ON DELETE CASCADE,
  "providerMessageId" TEXT NOT NULL, "sender" TEXT NOT NULL, "senderName" TEXT NOT NULL,
  "subject" TEXT NOT NULL, "snippet" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'review', "leadId" TEXT, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  UNIQUE("connectionId", "providerMessageId")
);
CREATE INDEX "BusinessEmailInquiry_tenantId_status_receivedAt_idx" ON "BusinessEmailInquiry"("tenantId", "status", "receivedAt");
