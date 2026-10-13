-- Correct only untouched seeded defaults. Administrator edits increment version
-- and write ClosingField audit history; both fences preserve deliberate choices.
BEGIN;
WITH defaults AS (
  SELECT 'confirmation-type' AS id, '{"id":"confirmation-type","name":"Confirmation Type","type":"Dropdown","required":true,"options":["Approved Quotation","Signed Contract","Purchase Order Received","Order Confirmed","Other"],"description":"","active":true,"module":"deals","group":"Closed Won Requirements","visibleInForm":true,"visibleInDetails":true,"order":0,"version":1}'::jsonb AS definition
  UNION ALL
  SELECT 'confirmation-date', '{"id":"confirmation-date","name":"Confirmation Date","type":"Date","required":true,"options":[],"description":"","active":true,"module":"deals","group":"Closed Won Requirements","visibleInForm":true,"visibleInDetails":true,"order":1,"version":1}'::jsonb
), corrected AS (
  UPDATE "ClosingFieldDefinition" field
  SET definition = jsonb_set(jsonb_set(field.definition, '{required}', 'false'), '{version}', '2'), "updatedAt" = CURRENT_TIMESTAMP
  FROM defaults seeded
  WHERE field.id = seeded.id
    AND (field.definition - 'technicalAlias' - 'groupId') = seeded.definition
    AND (field.definition->>'groupId' IS NULL OR field.definition->>'groupId' = 'deals:closing-evidence')
    AND NOT EXISTS (
      SELECT 1 FROM "AuditLog" audit
      WHERE audit."tenantId" = field."tenantId" AND audit."entityType" = 'ClosingField' AND audit."entityId" = field.id
    )
  RETURNING field."tenantId"
)
UPDATE "TenantPreference" preference
SET value = jsonb_set(preference.value, '{revision}', to_jsonb(COALESCE((preference.value->>'revision')::integer, 0) + 1)), "updatedAt" = CURRENT_TIMESTAMP
WHERE preference.module = 'deals' AND preference.key = 'field-layout'
  AND preference."tenantId" IN (SELECT "tenantId" FROM corrected);
COMMIT;
