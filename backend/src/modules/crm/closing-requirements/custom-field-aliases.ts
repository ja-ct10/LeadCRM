import { Prisma } from '@prisma/client';
import { allocateCustomFieldAlias, customFieldAliasBase, CRM_SYSTEM_FIELDS, DEFAULT_CLOSING_FIELDS, isSystemClosingField, RESERVED_CUSTOM_FIELD_ALIASES, type ClosingField, type CustomFieldModule } from '@leadcrm/shared';
import { ValidationError } from '../../../shared/errors/http-error';

/** All definition/layout writes take this lock before reading configuration. */
export async function lockFieldConfiguration(tx: Prisma.TransactionClient, tenantId: string) {
  // An atomic upsert acquires PostgreSQL's row lock through the scoped delegate.
  // Keep the request's tenant middleware active; raw SQL is intentionally forbidden.
  const scope = { tenantId, module: 'custom-fields', key: 'configuration-lock' };
  await tx.tenantPreference.upsert({ where: { tenantId_module_key: scope }, create: { ...scope, value: { version: 1 } }, update: { value: { version: 1 } }, select: { tenantId: true } });
}

export function occupiedAliases(module: CustomFieldModule, fields: ClosingField[]): Set<string> {
  return new Set([
    ...RESERVED_CUSTOM_FIELD_ALIASES,
    ...CRM_SYSTEM_FIELDS[module].map(field => customFieldAliasBase(field.technicalKey)),
    ...DEFAULT_CLOSING_FIELDS.map(field => field.id),
    ...fields.filter(field => field.module === module).flatMap(field => [field.id, ...(field.technicalAlias ? [field.technicalAlias] : [])]),
  ]);
}

export function newTechnicalAlias(module: CustomFieldModule, label: string, fields: ClosingField[]): string {
  const base = customFieldAliasBase(label);
  if (!base || RESERVED_CUSTOM_FIELD_ALIASES.has(base)) throw new ValidationError('Choose a field name that produces a nonempty, non-reserved technical alias.');
  return allocateCustomFieldAlias(base, occupiedAliases(module, fields));
}

/** Version 1 metadata backfill. Caller holds the tenant lock in a serializable transaction.
 * Input follows createdAt/id order, including retired definitions, so allocation is repeatable.
 * Only missing aliases are written. Values, snapshots, definition IDs and versions stay intact.
 */
export function planTechnicalAliases(input: ClosingField[]): ClosingField[] {
  const fields = input.map(field => ({ ...field }));
  for (const field of fields.filter(field => field.technicalAlias)) {
    if (fields.some(other => other.module === field.module && other.id !== field.id && (other.technicalAlias === field.technicalAlias || other.id === field.technicalAlias))) throw new ValidationError('Ambiguous stored field alias. Resolve the metadata conflict before continuing.');
  }
  for (const field of fields) {
    if (field.technicalAlias) continue;
    const base = customFieldAliasBase(field.name);
    field.technicalAlias = isSystemClosingField(field) ? field.id
      : allocateCustomFieldAlias(!base || RESERVED_CUSTOM_FIELD_ALIASES.has(base) ? 'field' : base, occupiedAliases(field.module, fields));
  }
  return fields;
}

export async function backfillTechnicalAliases(tx: Prisma.TransactionClient, tenantId: string, input: ClosingField[]) {
  const fields = planTechnicalAliases(input);
  for (const field of fields) {
    if (input.find(original => original.id === field.id)?.technicalAlias) continue;
    // Merge only the metadata property, preserving the original JSON document exactly.
    await tx.closingFieldDefinition.update({ where: { tenantId_id: { tenantId, id: field.id } }, data: {
      definition: { ...(await tx.closingFieldDefinition.findUniqueOrThrow({ where: { tenantId_id: { tenantId, id: field.id } } })).definition as Prisma.JsonObject, technicalAlias: field.technicalAlias },
    } });
  }
  return fields;
}
