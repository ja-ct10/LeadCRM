-- Additive phase. No Contact or relationship data is modified.
-- Deliberately outside public/Prisma: operator-only history, no application API.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA crm_history;
REVOKE ALL ON SCHEMA crm_history FROM PUBLIC;
CREATE TABLE crm_history.contact_retired_values (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  contact_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source_updated_at timestamp(3) NOT NULL,
  was_archived boolean NOT NULL,
  retired_values jsonb NOT NULL,
  product_links jsonb NOT NULL,
  contact_deals jsonb NOT NULL
);
CREATE INDEX contact_retired_values_identity ON crm_history.contact_retired_values (tenant_id, contact_id);
REVOKE ALL ON ALL TABLES IN SCHEMA crm_history FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA crm_history FROM PUBLIC;
ALTER TABLE crm_history.contact_retired_values ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION crm_history.reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Contact retirement archive is immutable';
END $$;
CREATE TRIGGER contact_retired_values_immutable BEFORE UPDATE OR DELETE ON crm_history.contact_retired_values
FOR EACH ROW EXECUTE FUNCTION crm_history.reject_history_mutation();
CREATE TRIGGER contact_retired_values_no_truncate BEFORE TRUNCATE ON crm_history.contact_retired_values
FOR EACH STATEMENT EXECUTE FUNCTION crm_history.reject_history_mutation();

-- Operator invoker permissions only. Later captures append versions; they never
-- overwrite history or interpret a purchased Product as a current interest.
CREATE FUNCTION crm_history.capture_contact_retirement() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE captured bigint;
BEGIN
  LOCK TABLE public."Contact" IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE crm_history.contact_retired_values IN SHARE ROW EXCLUSIVE MODE;
  INSERT INTO crm_history.contact_retired_values
    (tenant_id, contact_id, source_updated_at, was_archived, retired_values, product_links, contact_deals)
  SELECT c."tenantId", c.id, c."updatedAt", c."isArchived", projection.retired,
    COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId") FROM public."ContactProductInterest" l WHERE l."tenantId"=c."tenantId" AND l."contactId"=c.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."dealId") FROM public."ContactDeal" l WHERE l."tenantId"=c."tenantId" AND l."contactId"=c.id), '[]'::jsonb)
  FROM public."Contact" c
  CROSS JOIN LATERAL (SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) AS retired FROM jsonb_each(to_jsonb(c))
    WHERE key IN ('customerType','recordType','score','linkedinUrl','activeProducts','lastContactedAt','qualifiedAt','disqualifiedReason')) projection
  WHERE NOT EXISTS (SELECT 1 FROM crm_history.contact_retired_values h
    WHERE h.tenant_id=c."tenantId" AND h.contact_id=c.id AND h.retired_values=projection.retired
      AND h.source_updated_at=c."updatedAt" AND h.was_archived=c."isArchived");
  GET DIAGNOSTICS captured = ROW_COUNT;
  RETURN captured;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA crm_history FROM PUBLIC;
SELECT crm_history.capture_contact_retirement();
COMMIT;
