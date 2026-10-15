BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Account",public."AccountProductInterest",public."Workflow",public."Template",public."TenantPreference",public."UserPreference",public."ClosingFieldDefinition" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public."Account") AND COALESCE(obj_description('crm_history.account_retired_values'::regclass),'') !~ '^leadcrm-accounts-fields-compatible-v1:[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'ACCOUNT_FIELDS_VERIFIED_CUTOVER_REQUIRED';
  END IF;
END $$;
SELECT crm_history.reconcile_account_fields();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public."Account" a WHERE NOT EXISTS (
    SELECT 1 FROM crm_history.account_retired_values h WHERE h.tenant_id=a."tenantId" AND h.account_id=a.id
    AND h.retired_values=jsonb_build_object('assignedUserId',a."assignedUserId",'productInterests',a."productInterests",'activeProducts',a."activeProducts",'productInterestOther',a."productInterestOther",'productsNormalized',a."productsNormalized",'isArchived',a."isArchived",'updatedAt',a."updatedAt")
    AND h.product_links=COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId") FROM public."AccountProductInterest" l WHERE l."tenantId"=a."tenantId" AND l."accountId"=a.id),'[]'::jsonb))) THEN RAISE EXCEPTION 'ACCOUNT_FIELDS_PRESERVATION_MISMATCH'; END IF;
END $$;
DROP TABLE public."AccountProductInterest";
ALTER TABLE public."Account" DROP COLUMN "assignedUserId", DROP COLUMN "productInterests", DROP COLUMN "activeProducts", DROP COLUMN "productInterestOther", DROP COLUMN "productsNormalized";
COMMENT ON TABLE crm_history.account_retired_values IS NULL;
COMMIT;
