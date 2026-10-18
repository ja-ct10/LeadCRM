import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedCampaignTemplates, DEFAULT_CAMXIAN_TEMPLATES, DEFAULT_QUOTATION_TEMPLATES } from '../modules/marketing/templates/default-templates';

const db = new PrismaClient();
async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) throw new Error('Specify the confirmed workspace ID: npm run db:seed:campaigns -- <tenant-id>. No records were changed.');
  const quotationsOnly = process.argv[3] === '--quotations-only';
  if (process.argv.length > 4 || process.argv[3] && !quotationsOnly) throw new Error('Only the optional --quotations-only flag is supported. No records were changed.');
  const tenants = await db.tenant.findMany({ where: { id: tenantId }, select: { id: true } });
  if (tenants.length !== 1) throw new Error('Workspace not found. No records were changed.');
  const created = await seedCampaignTemplates(db, tenants[0].id, true, { quotationsOnly });
  const expected = DEFAULT_QUOTATION_TEMPLATES.length + (quotationsOnly ? 0 : DEFAULT_CAMXIAN_TEMPLATES.length);
  console.info(`Campaign templates: ${created} created; ${expected - created} existing samples retained${quotationsOnly ? '; Email/SMS unchanged.' : '; legacy default variable tokens normalized.'}`);
}
main().catch(error => {
  console.error('[Campaign template seed]', { name: error.name, ...(error.code ? { code: error.code } : {}), message: error.message });
  process.exitCode = 1;
}).finally(() => db.$disconnect());
