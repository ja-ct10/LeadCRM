-- Coordinated release: stop old APIs/workers before this preserving expansion.
-- New writers use canonical TaskDeal context and do not create SMS tracking links.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Task", public."Account", public."TaskAccount",
  public."CampaignContact", public."SmsCampaignLink" IN ACCESS EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public."TaskAccount" l
    LEFT JOIN public."Task" t ON t.id=l."taskId" AND t."tenantId"=l."tenantId"
    LEFT JOIN public."Account" a ON a.id=l."accountId" AND a."tenantId"=l."tenantId"
    WHERE t.id IS NULL OR a.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public."SmsCampaignLink" l
    LEFT JOIN public."CampaignContact" r ON r.id=l."campaignContactId" AND r."tenantId"=l."tenantId"
    WHERE r.id IS NULL
  ) THEN RAISE EXCEPTION 'RETIRED_RELATIONSHIP_SCOPE_MISMATCH'; END IF;
END $$;

ALTER TABLE public."Task" ADD COLUMN "retiredAccountLinks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public."CampaignContact" ADD COLUMN "smsLinkHistory" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public."Task" ADD CONSTRAINT "Task_retiredAccountLinks_array"
  CHECK (jsonb_typeof("retiredAccountLinks")='array');
ALTER TABLE public."CampaignContact" ADD CONSTRAINT "CampaignContact_smsLinkHistory_array"
  CHECK (jsonb_typeof("smsLinkHistory")='array');

-- Exact source rows, including null timestamps and original ordering. Raw SQL
-- deliberately does not rewrite parent updatedAt or invent historical events.
UPDATE public."Task" t SET "retiredAccountLinks"=(
  SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position,l."accountId")
  FROM public."TaskAccount" l WHERE l."taskId"=t.id AND l."tenantId"=t."tenantId"
) WHERE EXISTS (SELECT 1 FROM public."TaskAccount" l WHERE l."taskId"=t.id);
UPDATE public."CampaignContact" r SET "smsLinkHistory"=(
  SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
  FROM public."SmsCampaignLink" l WHERE l."campaignContactId"=r.id AND l."tenantId"=r."tenantId"
) WHERE EXISTS (SELECT 1 FROM public."SmsCampaignLink" l WHERE l."campaignContactId"=r.id);

-- Public legacy-token discovery uses JSON containment. This index is not a
-- uniqueness constraint: source PKs plus the immutable closed archive preserve
-- global token uniqueness; new recipients may only start with an empty archive.
CREATE INDEX "CampaignContact_smsLinkHistory_idx"
  ON public."CampaignContact" USING GIN ("smsLinkHistory" jsonb_path_ops);

CREATE FUNCTION public.leadcrm_verify_retired_relationships()
RETURNS TABLE(source_table text, source_rows bigint, preserved_rows bigint)
LANGUAGE plpgsql AS $$
DECLARE source_count bigint; archive_count bigint; mismatch boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."Task" t CROSS JOIN LATERAL jsonb_array_elements(t."retiredAccountLinks") l
    WHERE jsonb_typeof(l)<>'object' OR l->>'taskId' IS DISTINCT FROM t.id
      OR l->>'tenantId' IS DISTINCT FROM t."tenantId" OR nullif(l->>'accountId','') IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public."CampaignContact" r CROSS JOIN LATERAL jsonb_array_elements(r."smsLinkHistory") l
    WHERE jsonb_typeof(l)<>'object' OR l->>'campaignContactId' IS DISTINCT FROM r.id
      OR l->>'tenantId' IS DISTINCT FROM r."tenantId" OR nullif(l->>'id','') IS NULL
      OR nullif(l->>'url','') IS NULL
  ) THEN RAISE EXCEPTION 'RETIRED_RELATIONSHIP_ARCHIVE_SCOPE_MISMATCH'; END IF;
  IF EXISTS (
    SELECT l->>'id' FROM public."CampaignContact" r
    CROSS JOIN LATERAL jsonb_array_elements(r."smsLinkHistory") l
    GROUP BY l->>'id' HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'RETIRED_SMS_TOKEN_DUPLICATE'; END IF;

  SELECT coalesce(sum(jsonb_array_length("retiredAccountLinks")),0) INTO archive_count FROM public."Task";
  IF to_regclass('public."TaskAccount"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public."TaskAccount"' INTO source_count;
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public."Task" t WHERE t."retiredAccountLinks" IS DISTINCT FROM
      coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position,l."accountId") FROM public."TaskAccount" l
        WHERE l."taskId"=t.id AND l."tenantId"=t."tenantId"),''[]''::jsonb))' INTO mismatch;
    IF mismatch OR source_count<>archive_count THEN RAISE EXCEPTION 'TASK_ACCOUNT_PRESERVATION_MISMATCH'; END IF;
  ELSE source_count:=NULL; END IF;
  source_table:='TaskAccount'; source_rows:=source_count; preserved_rows:=archive_count; RETURN NEXT;

  SELECT coalesce(sum(jsonb_array_length("smsLinkHistory")),0) INTO archive_count FROM public."CampaignContact";
  IF to_regclass('public."SmsCampaignLink"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public."SmsCampaignLink"' INTO source_count;
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public."CampaignContact" r WHERE r."smsLinkHistory" IS DISTINCT FROM
      coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM public."SmsCampaignLink" l
        WHERE l."campaignContactId"=r.id AND l."tenantId"=r."tenantId"),''[]''::jsonb))' INTO mismatch;
    IF mismatch OR source_count<>archive_count THEN RAISE EXCEPTION 'SMS_LINK_PRESERVATION_MISMATCH'; END IF;
  ELSE source_count:=NULL; END IF;
  source_table:='SmsCampaignLink'; source_rows:=source_count; preserved_rows:=archive_count; RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.leadcrm_verify_retired_relationships() FROM PUBLIC;
SELECT * FROM public.leadcrm_verify_retired_relationships();

CREATE FUNCTION public.leadcrm_protect_retired_relationship_archive() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE column_name text := TG_ARGV[0];
BEGIN
  IF TG_OP='INSERT' THEN
    IF to_jsonb(NEW)->column_name IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION 'RETIRED_RELATIONSHIP_ARCHIVE_INSERT_FORBIDDEN';
    END IF;
  ELSIF to_jsonb(NEW)->column_name IS DISTINCT FROM to_jsonb(OLD)->column_name
    OR (to_jsonb(OLD)->column_name<>'[]'::jsonb AND
      (NEW.id IS DISTINCT FROM OLD.id OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId")) THEN
    RAISE EXCEPTION 'RETIRED_RELATIONSHIP_ARCHIVE_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_retired_account_links BEFORE INSERT OR UPDATE ON public."Task"
  FOR EACH ROW EXECUTE FUNCTION public.leadcrm_protect_retired_relationship_archive('retiredAccountLinks');
CREATE TRIGGER protect_retired_sms_links BEFORE INSERT OR UPDATE ON public."CampaignContact"
  FOR EACH ROW EXECUTE FUNCTION public.leadcrm_protect_retired_relationship_archive('smsLinkHistory');

CREATE FUNCTION public.leadcrm_reject_retired_relationship_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RETIRED_RELATIONSHIP_SOURCE_FROZEN'; END $$;
CREATE TRIGGER freeze_retired_relationship_rows BEFORE INSERT OR UPDATE OR DELETE ON public."TaskAccount"
  FOR EACH ROW EXECUTE FUNCTION public.leadcrm_reject_retired_relationship_write();
CREATE TRIGGER freeze_retired_relationship_truncate BEFORE TRUNCATE ON public."TaskAccount"
  FOR EACH STATEMENT EXECUTE FUNCTION public.leadcrm_reject_retired_relationship_write();
CREATE TRIGGER freeze_retired_relationship_rows BEFORE INSERT OR UPDATE OR DELETE ON public."SmsCampaignLink"
  FOR EACH ROW EXECUTE FUNCTION public.leadcrm_reject_retired_relationship_write();
CREATE TRIGGER freeze_retired_relationship_truncate BEFORE TRUNCATE ON public."SmsCampaignLink"
  FOR EACH STATEMENT EXECUTE FUNCTION public.leadcrm_reject_retired_relationship_write();
COMMIT;
