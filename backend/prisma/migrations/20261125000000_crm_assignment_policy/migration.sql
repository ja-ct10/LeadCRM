-- Additive policy only. No CRM records, assignments or permission flags change.
ALTER TABLE "RoleDefinition" ADD COLUMN "crmAssignmentRestricted" BOOLEAN NOT NULL DEFAULT false;
UPDATE "RoleDefinition"
SET "crmAssignmentRestricted" = true
WHERE lower(regexp_replace(trim("name"), '[[:space:]_-]', '', 'g'))
  IN ('sales', 'salesrep', 'salesrepresentative', 'salesagent', 'salesstaff', 'salesmanager');
