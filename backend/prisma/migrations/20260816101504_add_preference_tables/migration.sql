-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPreference_tenantId_module_idx" ON "UserPreference"("tenantId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_tenantId_userId_module_key_key" ON "UserPreference"("tenantId", "userId", "module", "key");

-- CreateIndex
CREATE INDEX "TenantPreference_tenantId_module_idx" ON "TenantPreference"("tenantId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPreference_tenantId_module_key_key" ON "TenantPreference"("tenantId", "module", "key");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPreference" ADD CONSTRAINT "TenantPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
