-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_tenantId_userId_provider_key" ON "EmailAccount"("tenantId", "userId", "provider");

-- CreateIndex
CREATE INDEX "EmailAccount_tenantId_userId_idx" ON "EmailAccount"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "EmailAccount_tenantId_isActive_idx" ON "EmailAccount"("tenantId", "isActive");
