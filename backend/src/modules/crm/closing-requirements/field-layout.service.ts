import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { CLOSED_WON_GROUP_ID, CRM_SYSTEM_FIELDS, CUSTOM_FIELD_MODULES, FieldLayoutSchema, upgradeAssignmentLayout, customFieldNameKey, defaultFieldLayout, getCrmFieldCatalog, isClosedWonField, type ClosingField, type CustomFieldModule, type FieldLayout } from '@leadcrm/shared';
import { salesTransaction } from '../leads/lead-automation.service';
import { readFields } from './closing-requirements.repository';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';

type Tx = Prisma.TransactionClient;
export const FieldModuleSchema = z.enum(CUSTOM_FIELD_MODULES);
const preferenceKey = (tenantId: string, module: CustomFieldModule) => ({ tenantId, module, key: 'field-layout' });
/** Stable built-in IDs and persisted legacy IDs survive every rename and subsequent read. */
export async function readFieldLayout(tx: Tx, tenantId: string, module: CustomFieldModule, definitions?: ClosingField[]): Promise<FieldLayout> {
  const where = preferenceKey(tenantId, module);
  const existing = await tx.tenantPreference.findUnique({ where: { tenantId_module_key: where } });
  if (existing) {
    const original = FieldLayoutSchema.parse(existing.value);
    const layout = upgradeAssignmentLayout(original, definitions ?? await readFields(tx, tenantId));
    if (JSON.stringify(original) !== JSON.stringify(layout)) await tx.tenantPreference.update({ where: { tenantId_module_key: where }, data: { value: layout as unknown as Prisma.InputJsonValue } });
    return layout;
  }
  const layout = defaultFieldLayout(module);
  const fields = definitions ?? await readFields(tx, tenantId);
  for (const field of fields.filter(field => field.module === module)) {
    if (!layout.groups.some(group => customFieldNameKey(group.label) === customFieldNameKey(field.group))) layout.groups.push({ id: field.groupId ?? randomUUID(), label: field.group, order: layout.groups.length });
  }
  const created = await tx.tenantPreference.upsert({ where: { tenantId_module_key: where }, create: { ...where, value: layout as unknown as Prisma.InputJsonValue }, update: {} });
  return FieldLayoutSchema.parse(created.value);
}
export const getFieldLayout = (tenantId: string, module: CustomFieldModule) => salesTransaction(async tx => {
  const fields = await readFields(tx, tenantId), layout = await readFieldLayout(tx, tenantId, module, fields);
  return { layout, fields: getCrmFieldCatalog(module, fields, layout) };
});
const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), label: z.string().trim().min(1).max(100) }).strict(),
  z.object({ action: z.literal('rename'), groupId: z.string(), label: z.string().trim().min(1).max(100) }).strict(),
  z.object({ action: z.literal('moveGroup'), groupId: z.string(), direction: z.enum(['up', 'down']) }).strict(),
  z.object({ action: z.literal('delete'), groupId: z.string(), moveToGroupId: z.string().optional() }).strict(),
  z.object({ action: z.literal('field'), technicalKey: z.string(), label: z.string().trim().min(1).max(100).optional(), groupId: z.string().optional(), visibleInForm: z.boolean().optional(), visibleInDetails: z.boolean().optional(), direction: z.enum(['up', 'down']).optional() }).strict(),
]);
export async function updateFieldLayout(tenantId: string, actorId: string, module: CustomFieldModule, input: unknown) {
  const action = ActionSchema.parse(input);
  return salesTransaction(async tx => {
    const definitions = await readFields(tx, tenantId), layout = await readFieldLayout(tx, tenantId, module, definitions);
    const before = structuredClone(layout), catalog = getCrmFieldCatalog(module, definitions, layout);
    const group = 'groupId' in action ? layout.groups.find(group => group.id === action.groupId) : undefined;
    if (action.action !== 'add' && action.action !== 'field' && !group) throw new NotFoundError('Field group');
    if ((action.action === 'add' || action.action === 'rename') && layout.groups.some(group => group.id !== ('groupId' in action ? action.groupId : '') && customFieldNameKey(group.label) === customFieldNameKey(action.label))) throw new ValidationError('Group names must be unique within this module.');
    if (action.action === 'add') {
      if (layout.groups.length >= 100) throw new ValidationError('A module can contain at most 100 field groups.');
      layout.groups.push({ id: randomUUID(), label: action.label, order: layout.groups.length });
    }
    if (action.action === 'rename') group!.label = action.label;
    if (action.action === 'moveGroup') {
      const sorted = [...layout.groups].sort((a, b) => a.order - b.order), index = sorted.findIndex(group => group.id === action.groupId), next = index + (action.direction === 'up' ? -1 : 1);
      if (next >= 0 && next < sorted.length) [sorted[index], sorted[next]] = [sorted[next], sorted[index]];
      sorted.forEach((group, order) => { group.order = order; });
    }
    if (action.action === 'delete') {
      if (group!.id === CLOSED_WON_GROUP_ID || group!.protected) throw new ValidationError('Closing evidence is a protected section and cannot be deleted.');
      const contained = catalog.filter(field => field.groupId === group!.id);
      const target = layout.groups.find(group => group.id === action.moveToGroupId && group.id !== action.groupId && group.id !== CLOSED_WON_GROUP_ID);
      if (contained.length && !target) throw new ValidationError('Choose another section in this module to move the fields before deleting this group.');
      if (layout.groups.length === 1) throw new ValidationError('Keep at least one field group.');
      for (const field of contained) {
        if (field.customFieldId) { const definition = definitions.find(item => item.id === field.customFieldId)!; definition.groupId = target!.id; definition.group = target!.label; }
        else layout.fields[field.technicalKey] = { label: field.label, groupId: target!.id, order: field.order, visibleInForm: field.visibleInForm, visibleInDetails: field.visibleInDetails };
      }
      layout.groups = layout.groups.filter(item => item.id !== action.groupId);
    }
    if (action.action === 'field') {
      const field = catalog.find(field => field.technicalKey === action.technicalKey);
      if (!field) throw new ValidationError('Choose a supported field in this module.');
      const target = action.groupId ? layout.groups.find(group => group.id === action.groupId) : layout.groups.find(group => group.id === field.groupId);
      if (!target) throw new ValidationError('Choose a section in this module.');
      if ((field.groupId === CLOSED_WON_GROUP_ID) !== (target.id === CLOSED_WON_GROUP_ID)) throw new ValidationError('Fields cannot move into or out of closing evidence.');
      if (field.mandatory && action.visibleInForm === false) throw new ValidationError(`${field.label} is mandatory and cannot be hidden from its form.`);
      if (field.customFieldId) {
        const definition = definitions.find(item => item.id === field.customFieldId)!;
        if (definition.required && action.visibleInForm === false && !isClosedWonField(definition)) throw new ValidationError('Turn off Required before hiding this field from forms.');
        Object.assign(definition, { groupId: target.id, group: target.label }, action.label ? { name: action.label } : {}, action.visibleInForm === undefined ? {} : { visibleInForm: action.visibleInForm }, action.visibleInDetails === undefined ? {} : { visibleInDetails: action.visibleInDetails });
      } else layout.fields[field.technicalKey] = { label: action.label ?? field.label, groupId: target.id, order: field.order, visibleInForm: action.visibleInForm ?? field.visibleInForm, visibleInDetails: action.visibleInDetails ?? field.visibleInDetails };
      if (action.direction) {
        const ordered = catalog.filter(item => item.groupId === target.id).sort((a, b) => a.order - b.order || a.technicalKey.localeCompare(b.technicalKey)), index = ordered.findIndex(item => item.technicalKey === field.technicalKey), next = index + (action.direction === 'up' ? -1 : 1);
        if (index >= 0 && next >= 0 && next < ordered.length) [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
        ordered.forEach((item, order) => {
          if (item.customFieldId) definitions.find(definition => definition.id === item.customFieldId)!.order = order;
          else layout.fields[item.technicalKey] = { ...(layout.fields[item.technicalKey] ?? { label: item.label, groupId: target.id, visibleInForm: item.visibleInForm, visibleInDetails: item.visibleInDetails }), order };
        });
      }
    }
    // Keep the old string as a compatibility projection; stable IDs govern context.
    for (const definition of definitions.filter(field => field.module === module)) {
      const previousGroupId = definition.groupId ?? before.groups.find(group => customFieldNameKey(group.label) === customFieldNameKey(definition.group))?.id;
      const resolved = layout.groups.find(group => group.id === previousGroupId) ?? layout.groups.find(group => customFieldNameKey(group.label) === customFieldNameKey(definition.group));
      if (resolved) { definition.groupId = resolved.id; definition.group = resolved.label; }
      await tx.closingFieldDefinition.update({ where: { tenantId_id: { tenantId, id: definition.id } }, data: { definition: definition as unknown as Prisma.InputJsonValue } });
    }
    if (Object.keys(layout.fields).some(key => !CRM_SYSTEM_FIELDS[module].some(field => field.technicalKey === key))) throw new ValidationError('Unsupported system field.');
    await tx.tenantPreference.update({ where: { tenantId_module_key: preferenceKey(tenantId, module) }, data: { value: layout as unknown as Prisma.InputJsonValue } });
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: 'field_layout.updated', entityType: module, entityId: module, changeset: { before, after: layout } as unknown as Prisma.InputJsonValue } });
    return { layout, fields: getCrmFieldCatalog(module, definitions, layout) };
  });
}
