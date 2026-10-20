ALTER TABLE "TenantGroupMember" ADD COLUMN "isHead" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "TenantGroupMember_one_head_per_group"
ON "TenantGroupMember" ("tenantId", "groupId") WHERE "isHead";

-- Membership deletion already removes the designation. Cover all account status
-- and primary-role mutation paths, including bulk edits and role renames.
CREATE FUNCTION leadcrm_clear_ineligible_group_head() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'ACTIVE' OR lower(regexp_replace(btrim(NEW.role), '[[:space:]_-]', '', 'g')) NOT IN ('salesmanager', 'headofsales') THEN
    UPDATE "TenantGroupMember" SET "isHead" = false
    WHERE "tenantId" = NEW."tenantId" AND "userId" = NEW.id AND "isHead";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER clear_ineligible_group_head AFTER UPDATE OF status, role ON "User"
FOR EACH ROW EXECUTE FUNCTION leadcrm_clear_ineligible_group_head();
