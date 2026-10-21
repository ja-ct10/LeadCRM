-- Eligibility is resolved by RBAC at assignment time. A later role or ranking
-- change must not remove an administrator's saved designation.
CREATE OR REPLACE FUNCTION leadcrm_clear_ineligible_group_head() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    UPDATE "TenantGroupMember" SET "isHead" = false
    WHERE "tenantId" = NEW."tenantId" AND "userId" = NEW.id AND "isHead";
  END IF;
  RETURN NEW;
END $$;
