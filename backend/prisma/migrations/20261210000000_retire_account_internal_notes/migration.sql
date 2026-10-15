BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Account",public."Activity",public."Workflow",public."Template",public."TenantPreference",public."ClosingFieldDefinition" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public."Account") AND COALESCE(obj_description('crm_history.account_legacy_notes'::regclass),'') !~ '^leadcrm-account-notes-compatible-v1:[0-9a-f]{40}$' THEN RAISE EXCEPTION 'ACCOUNT_NOTES_VERIFIED_CUTOVER_REQUIRED'; END IF;
END $$;
SELECT crm_history.reconcile_account_notes();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public."Account" a CROSS JOIN LATERAL(VALUES('notes',a.notes),('internalNotes',a."internalNotes")) source(field,value)
    WHERE source.value IS NOT NULL AND NOT EXISTS(SELECT 1 FROM crm_history.account_legacy_notes h
      WHERE h.tenant_id=a."tenantId" AND h.account_id=a.id AND h.source_field=source.field AND h.note_value=source.value
      AND (source.value !~ '[^[:space:]]' OR EXISTS(SELECT 1 FROM public."Activity" activity WHERE activity.id=h.activity_id AND activity."tenantId"=a."tenantId" AND activity.type='note' AND activity.description=source.value AND activity.metadata->>'legacyAccountNote'='v1' AND activity.metadata->>'sourceAccountId'=a.id AND crm_history.account_note_destination(a."tenantId",a.id,activity."accountId"))))) THEN RAISE EXCEPTION 'ACCOUNT_NOTES_PRESERVATION_MISMATCH'; END IF;
END $$;
DROP TRIGGER preserve_account_note_write ON public."Account";
-- Preserve writes to the surviving historical Notes column too.
CREATE TRIGGER preserve_account_note_write AFTER INSERT OR UPDATE OF notes ON public."Account" FOR EACH ROW EXECUTE FUNCTION crm_history.preserve_account_note_write();
ALTER TABLE public."Account" DROP COLUMN "internalNotes";
COMMENT ON TABLE crm_history.account_legacy_notes IS NULL;
COMMIT;
