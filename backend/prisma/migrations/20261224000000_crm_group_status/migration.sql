-- Group ownership is explicitly assigned; existing rows retain their current access.
ALTER TABLE "Lead" ADD COLUMN "ownerGroupId" TEXT;
CREATE INDEX "Lead_tenantId_ownerGroupId_idx" ON "Lead"("tenantId", "ownerGroupId");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerGroupId_tenantId_fkey" FOREIGN KEY ("ownerGroupId", "tenantId") REFERENCES "TenantGroup"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD COLUMN "ownerGroupId" TEXT;
CREATE INDEX "Contact_tenantId_ownerGroupId_idx" ON "Contact"("tenantId", "ownerGroupId");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerGroupId_tenantId_fkey" FOREIGN KEY ("ownerGroupId", "tenantId") REFERENCES "TenantGroup"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Account" ADD COLUMN "ownerGroupId" TEXT;
CREATE INDEX "Account_tenantId_ownerGroupId_idx" ON "Account"("tenantId", "ownerGroupId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerGroupId_tenantId_fkey" FOREIGN KEY ("ownerGroupId", "tenantId") REFERENCES "TenantGroup"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD COLUMN "ownerGroupId" TEXT;
CREATE INDEX "Deal_tenantId_ownerGroupId_idx" ON "Deal"("tenantId", "ownerGroupId");
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerGroupId_tenantId_fkey" FOREIGN KEY ("ownerGroupId", "tenantId") REFERENCES "TenantGroup"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD COLUMN "manualStatusContext" JSONB;
ALTER TABLE "Contact" ADD COLUMN "manualStatusContext" JSONB;
ALTER TABLE "TenantGroupMember" ADD COLUMN "crmRoleId" TEXT;
CREATE INDEX "TenantGroupMember_tenantId_crmRoleId_idx" ON "TenantGroupMember"("tenantId", "crmRoleId");
ALTER TABLE "TenantGroupMember" ADD CONSTRAINT "TenantGroupMember_crmRoleId_tenantId_fkey" FOREIGN KEY ("crmRoleId", "tenantId") REFERENCES "RoleDefinition"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
