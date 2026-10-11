// Default is a read-only plan. Apply only to an explicitly named tenant after backup review.
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { normalizeCustomField, type ClosingField } from '@leadcrm/shared';
import { backfillTechnicalAliases, lockFieldConfiguration, planTechnicalAliases } from '../src/modules/crm/closing-requirements/custom-field-aliases';

dotenv.config({ path: resolve(__dirname, '../.env') });
const db = new PrismaClient({ log: [] });
const apply = process.argv.includes('--apply');
const tenantId = process.argv[process.argv.indexOf('--tenant') + 1];
const scopedTenant = process.argv.includes('--tenant') ? tenantId : undefined;
const actorId = process.argv.includes('--actor') ? process.argv[process.argv.indexOf('--actor') + 1] : undefined;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function main() {
  if (apply && !scopedTenant) throw new Error('--apply requires --tenant <id>. Review the read-only plan and backups first.');
  if (apply && !actorId) throw new Error('--apply requires --actor <tenant-admin-id> for attribution.');
  if (process.argv.includes('--tenant') && (!scopedTenant || scopedTenant.startsWith('--'))) throw new Error('Supply a tenant ID.');
  const tenantIds = scopedTenant ? [scopedTenant] : (await db.closingFieldDefinition.findMany({ distinct: ['tenantId'], select: { tenantId: true } })).map(row => row.tenantId);
  for (const id of tenantIds) {
    const rows = await db.closingFieldDefinition.findMany({ where: { tenantId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const fields = rows.map(row => normalizeCustomField(row.definition as unknown as ClosingField));
    if (fields.some((field, index) => field.id !== rows[index].id)) throw new Error('Definition identity mismatch; review before applying aliases.');
    const plan = planTechnicalAliases(fields);
    const changes = plan.filter(field => !fields.find(original => original.id === field.id)?.technicalAlias).map(field => ({ module: field.module, id: field.id, technicalAlias: field.technicalAlias }));
    console.log(JSON.stringify({ metadataVersion: 1, tenantId: id, mode: apply ? 'apply' : 'plan', changes }));
    if (!apply) continue;
    if (!await db.user.findFirst({ where: { id: actorId, tenantId: id, role: 'Client Admin', status: 'ACTIVE' } })) throw new Error('The applying actor must be an active Client Admin in this tenant.');
    for (let attempt = 0; ; attempt++) {
      try {
        await db.$transaction(async tx => {
          await lockFieldConfiguration(tx, id);
          const current = await tx.closingFieldDefinition.findMany({ where: { tenantId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
          const values = await tx.customFieldValue.findMany({ where: { tenantId: id }, orderBy: { id: 'asc' } });
          const history = await tx.deal.findMany({ where: { tenantId: id }, orderBy: { id: 'asc' }, select: { id: true, closingValues: true, closingSnapshot: true } });
          const before = digest([values, history]);
          const updated = await backfillTechnicalAliases(tx, id, current.map(row => normalizeCustomField(row.definition as unknown as ClosingField)));
          if (digest([await tx.customFieldValue.findMany({ where: { tenantId: id }, orderBy: { id: 'asc' } }), await tx.deal.findMany({ where: { tenantId: id }, orderBy: { id: 'asc' }, select: { id: true, closingValues: true, closingSnapshot: true } })]) !== before) throw new Error('Preservation check failed. Transaction rolled back.');
          const assigned = updated.filter(field => !(current.find(row => row.id === field.id)!.definition as Prisma.JsonObject).technicalAlias).map(field => ({ id: field.id, alias: field.technicalAlias! }));
          if (assigned.length) await tx.auditLog.create({ data: { tenantId: id, userId: actorId!, action: 'custom_field.alias_backfill_v1', entityType: 'ClosingField', changeset: { assigned } } });
          console.log(JSON.stringify({ tenantId: id, verified: 'field-value rows and closing history unchanged', digest: before }));
        }, { isolationLevel: 'Serializable', timeout: 20000 });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 4) continue;
        throw error;
      }
    }
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted]') : 'Alias operation failed.'); process.exitCode = 1; }).finally(() => db.$disconnect());
