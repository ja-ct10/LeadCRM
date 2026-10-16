-- Use the seeder's exact name/type identities across tenants, including archived
-- defaults. Replace tokens in place without changing IDs, edits or timestamps.
UPDATE "Template" AS template
SET subject = replace(replace(template.subject, '{{first_name}}', '{{firstName}}'), '{{company_name}}', '{{companyName}}'),
    content = replace(replace(template.content, '{{first_name}}', '{{firstName}}'), '{{company_name}}', '{{companyName}}')
FROM (VALUES
  ('Lead Inquiry Acknowledgment', 'Email'),
  ('Proposal Follow-Up', 'Email'),
  ('Thank You and Next Steps', 'Email'),
  ('Inquiry Received', 'SMS'),
  ('Inquiry Follow-Up', 'SMS'),
  ('Proposal Ready', 'SMS')
) AS defaults(name, type)
WHERE template.name = defaults.name AND template.type = defaults.type
  AND (strpos(template.subject, '{{first_name}}') > 0 OR strpos(template.subject, '{{company_name}}') > 0
    OR strpos(template.content, '{{first_name}}') > 0 OR strpos(template.content, '{{company_name}}') > 0);
