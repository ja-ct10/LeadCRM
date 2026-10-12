-- Production discovery only. Never remap a legacy Task from candidate counts.
BEGIN READ ONLY;

WITH usage AS (
  SELECT t.id, t."tenantId", t.status, t."isArchived",
    (SELECT count(*) FROM "TaskDeal" x WHERE x."taskId" = t.id) AS deals,
    (SELECT count(*) FROM "TaskLead" x WHERE x."taskId" = t.id) AS leads,
    (SELECT count(*) FROM "TaskContact" x WHERE x."taskId" = t.id) AS contacts,
    (SELECT count(*) FROM "TaskAccount" x WHERE x."taskId" = t.id) AS accounts
  FROM "Task" t
)
SELECT "tenantId", count(*) AS tasks,
  count(*) FILTER (WHERE NOT "isArchived" AND status NOT IN ('completed','cancelled')) AS active,
  count(*) FILTER (WHERE status = 'completed') AS completed,
  count(*) FILTER (WHERE "isArchived") AS archived,
  count(*) FILTER (WHERE deals = 1) AS one_deal,
  count(*) FILTER (WHERE deals > 1) AS multiple_deals,
  count(*) FILTER (WHERE deals = 0) AS no_deals,
  count(*) FILTER (WHERE deals = 0 AND leads > 0 AND contacts + accounts = 0) AS lead_only,
  count(*) FILTER (WHERE deals = 0 AND contacts > 0 AND leads + accounts = 0) AS contact_only,
  count(*) FILTER (WHERE deals = 0 AND accounts > 0 AND leads + contacts = 0) AS account_only,
  count(*) FILTER (WHERE (deals > 0)::int + (leads > 0)::int + (contacts > 0)::int + (accounts > 0)::int > 1) AS mixed,
  count(*) FILTER (WHERE deals + leads + contacts + accounts = 0) AS unassociated
FROM usage GROUP BY "tenantId";

-- Candidates establish review scope; they do not prove the original intent.
WITH candidates AS (
  SELECT tl."taskId", ld."dealId" FROM "TaskLead" tl
    JOIN "LeadDeal" ld ON ld."leadId" = tl."leadId" AND ld."tenantId" = tl."tenantId"
  UNION
  SELECT tc."taskId", cd."dealId" FROM "TaskContact" tc
    JOIN "ContactDeal" cd ON cd."contactId" = tc."contactId" AND cd."tenantId" = tc."tenantId"
  UNION
  SELECT tc."taskId", ld."dealId" FROM "TaskContact" tc
    JOIN "Lead" l ON l."contactId" = tc."contactId" AND l."tenantId" = tc."tenantId" AND l."convertedAt" IS NOT NULL
    JOIN "LeadDeal" ld ON ld."leadId" = l.id AND ld."tenantId" = l."tenantId"
  UNION
  SELECT ta."taskId", d.id FROM "TaskAccount" ta
    JOIN "Deal" d ON d."accountId" = ta."accountId" AND d."tenantId" = ta."tenantId"
)
SELECT t.id, t."tenantId", count(DISTINCT d.id) AS eligible_candidates,
  array_agg(DISTINCT d.id) FILTER (WHERE d.id IS NOT NULL) AS candidate_deal_ids
FROM "Task" t LEFT JOIN candidates c ON c."taskId" = t.id
LEFT JOIN "Deal" d ON d.id = c."dealId" AND d."tenantId" = t."tenantId" AND NOT d."isArchived" AND d."deletedAt" IS NULL
WHERE NOT EXISTS (SELECT 1 FROM "TaskDeal" td WHERE td."taskId" = t.id)
GROUP BY t.id, t."tenantId" ORDER BY t."tenantId", t.id;

SELECT 'Activity' AS source, count(*) AS rows, count(DISTINCT "taskId") AS tasks
FROM "Activity" WHERE "taskId" IS NOT NULL OR type = 'task'
UNION ALL
SELECT 'AuditLog', count(*), count(DISTINCT "entityId") FROM "AuditLog" WHERE "entityType" = 'Task';

SELECT w.id, w."tenantId", w.name, w."isActive", w.status, w.trigger, w.conditions, w.actions
FROM "Workflow" w WHERE NOT w."isArchived" AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.actions) = 'array' THEN w.actions ELSE '[]'::jsonb END) a
  WHERE a->>'type' = 'create_task'
);

SELECT count(*) AS ledger_rows,
  count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS successful,
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unresolved_failed
FROM "_prisma_migrations";
ROLLBACK;
