ALTER TABLE "DashboardRevision" ADD COLUMN content BIGINT NOT NULL DEFAULT 0;

-- One committed counter for CRM readers, including worker and relationship writes.
CREATE FUNCTION leadcrm_crm_content_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tenant_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'TenantPreference' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.key <> 'field-layout' OR OLD.module NOT IN ('leads','contacts','accounts','deals') THEN RETURN OLD; END IF;
    ELSE
      IF NEW.key <> 'field-layout' OR NEW.module NOT IN ('leads','contacts','accounts','deals') THEN RETURN NEW; END IF;
    END IF;
  END IF;
  tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."tenantId" ELSE NEW."tenantId" END;
  IF EXISTS (SELECT 1 FROM "Tenant" WHERE id = tenant_id) THEN
    INSERT INTO "DashboardRevision" ("tenantId",content) VALUES (tenant_id,1)
    ON CONFLICT ("tenantId") DO UPDATE SET content = "DashboardRevision".content + 1;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Lead','Contact','Account','Deal','Activity','Task',
    'LeadDeal','ContactDeal','TaskLead','TaskContact','TaskDeal','TaskAccount',
    'ProductInterest','LeadProductInterest','ContactProductInterest','AccountProductInterest',
    'ClosingFieldDefinition','CustomFieldValue','RecordFile','TenantPreference'] LOOP
    EXECUTE format('CREATE TRIGGER crm_content_revision AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION leadcrm_crm_content_revision()', table_name);
  END LOOP;
END $$;
CREATE INDEX "Activity_context_cursor" ON "Activity" ("tenantId","createdAt" DESC,id DESC);
