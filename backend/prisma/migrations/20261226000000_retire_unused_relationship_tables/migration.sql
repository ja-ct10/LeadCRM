-- Separate, exact-release operator cutover. Normal deployment excludes this file.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Task", public."CampaignContact", public."TaskAccount", public."SmsCampaignLink" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."_prisma_migrations"
    WHERE migration_name='20261102000000_retire_relationship_compatibility'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Task' AND column_name='accountId')
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public."TaskAccount"'::regclass AND tgname='crm_relationship_projection') THEN
    RAISE EXCEPTION 'RETIRED_RELATIONSHIP_CANONICAL_CUTOVER_REQUIRED';
  END IF;
  IF (EXISTS (SELECT 1 FROM public."TaskAccount") OR EXISTS (SELECT 1 FROM public."SmsCampaignLink"))
    AND (coalesce(obj_description('public."TaskAccount"'::regclass),'') !~ '^leadcrm-retired-relationships-v1:[0-9a-f]{40}$'
      OR obj_description('public."TaskAccount"'::regclass) IS DISTINCT FROM obj_description('public."SmsCampaignLink"'::regclass)) THEN
    RAISE EXCEPTION 'RETIRED_RELATIONSHIP_VERIFIED_CUTOVER_REQUIRED';
  END IF;
END $$;
SELECT * FROM public.leadcrm_verify_retired_relationships();
-- Do not cascade away unexpected external references. Any unknown dependent
-- constraint/view stops this transaction; the operator must investigate it.
DROP TABLE public."TaskAccount";
DROP TABLE public."SmsCampaignLink";
DROP FUNCTION public.leadcrm_reject_retired_relationship_write();
-- Archive guards and verification survive physical source retirement.
COMMIT;
