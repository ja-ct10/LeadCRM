import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClosingFieldInputSchema, ClosingValuesPatchSchema, customFieldNameKey, getCrmFieldCatalog, isClosedWonField, isSystemClosingField, normalizeCustomField, type ClosingField, type ClosingValues, type ClosingRequirementsState } from '@leadcrm/shared';
import { salesTransaction } from '../leads/lead-automation.service';
import { readFields, readClosingFields, validateValues } from './closing-requirements.repository';
import { persistValues } from './custom-field-values.repository';
import { moveDealStage } from '../deals/deals.repository';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { fireDealStageChanged, fireDealUpdated } from '../../automation/triggers/triggers.service';
import { recordChanges } from '../record-updates';
import { isDeepStrictEqual } from 'node:util';
import { readFieldLayout } from './field-layout.service';

export const listFields = (tenantId: string) => salesTransaction(tx => readFields(tx, tenantId));
export async function saveField(tenantId: string, actorId: string, input: unknown, id?: string) {
  return salesTransaction(async tx => {
    const fields = await readFields(tx, tenantId);
    const previous = fields.find(f => f.id === id);
    if (id && !previous) throw new NotFoundError('Custom field');
    const patch = input as Record<string, unknown>;
    let definitionInput = input;
    if (previous) {
      const { id: _id, version: _version, deletedAt: _deletedAt, deletedById: _deletedById, ...definition } = previous;
      definitionInput = { ...definition, ...patch };
      if (patch.group !== undefined && patch.groupId === undefined) delete (definitionInput as Record<string, unknown>).groupId;
    }
    const field = ClosingFieldInputSchema.parse(definitionInput);
    if (!id && fields.filter(f => f.module === field.module).length >= 100) throw new ValidationError('Maximum 100 custom fields per module.');
    const layout = await readFieldLayout(tx, tenantId, field.module, fields);
    const group = field.groupId ? layout.groups.find(group => group.id === field.groupId) : layout.groups.find(group => customFieldNameKey(group.label) === customFieldNameKey(field.group));
    if (!group) throw new ValidationError('Select a section for this module.');
    field.group = group.label; field.groupId = group.id;
    if (fields.some(f => f.id !== id && f.module === field.module && customFieldNameKey(f.group) === customFieldNameKey(field.group) && customFieldNameKey(f.name) === customFieldNameKey(field.name))) throw new ValidationError('Field names must be unique within this module and group.');
    // Keep IDs and types stable so existing values cannot change meaning after an edit.
    if (previous && previous.type !== field.type) throw new ValidationError('Field type cannot be changed. Add a new field instead.');
    if (previous && previous.module !== field.module) throw new ValidationError('Module cannot be changed. Add a new field instead.');
    if (previous && isClosedWonField(previous) !== isClosedWonField(field)) throw new ValidationError('Fields cannot move into or out of the Closed Won workflow. Add a new field in that context instead.');
    if (field.required && !field.visibleInForm && !isClosedWonField(field)) throw new ValidationError('Turn off Required before hiding this field from forms.');
    if (previous?.type === 'Dropdown') {
      const removed = previous.options.filter(option => !field.options.includes(option));
      if (removed.length && await tx.customFieldValue.count({ where: { tenantId, fieldId: previous.id, OR: removed.map(value => ({ value: { equals: value } })) } })) throw new ValidationError('An option is used by saved records. Retain that option to preserve their values.');
    }
    if (!previous) field.order = Math.max(-1, ...getCrmFieldCatalog(field.module, fields, layout).filter(f => f.groupId === field.groupId).map(f => f.order)) + 1;
    const saved: ClosingField = { ...field, id: id ?? randomUUID(), version: (previous?.version ?? 0) + 1 };
    const definition = saved as unknown as Prisma.InputJsonValue;
    if (previous) await tx.closingFieldDefinition.update({ where: { tenantId_id: { tenantId, id: saved.id } }, data: { definition } });
    else await tx.closingFieldDefinition.create({ data: { tenantId, id: saved.id, definition } });
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: previous ? 'closing_field.updated' : 'closing_field.created', entityType: 'ClosingField', entityId: saved.id, changeset: { before: previous ?? null, after: saved } as unknown as Prisma.InputJsonValue } });
    return saved;
  });
}

/** Match immutable IDs/technical tokens only, never mutable labels. */
export function referencesCustomField(value: unknown, id: string): boolean {
  if (typeof value === 'string') {
    const matchesKey = (key: string) => key === `customFieldValues.${id}` || key.endsWith(`.customFieldValues.${id}`);
    return value === id || matchesKey(value) || [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].some(match => matchesKey(match[1].trim()));
  }
  if (Array.isArray(value)) return value.some(item => referencesCustomField(item, id));
  return !!value && typeof value === 'object' && Object.entries(value).some(([key, item]) => key === id || key === `customFieldValues.${id}` || referencesCustomField(item, id));
}
export async function deleteField(tenantId: string, actorId: string, id: string) {
  return salesTransaction(async tx => {
    const fields = await readFields(tx, tenantId), field = fields.find(field => field.id === id);
    if (!field) throw new NotFoundError('Custom field');
    if (isSystemClosingField(field)) throw new ValidationError('System fields cannot be deleted.');
    const [workflows, forms, audiences, templates, campaigns] = await Promise.all([
      tx.workflow.findMany({ where: { tenantId, isArchived: false }, select: { id: true, name: true, conditions: true, actions: true } }),
      tx.marketingForm.findMany({ where: { tenantId, isArchived: false }, select: { id: true, name: true, fields: true, publishedConfig: true } }),
      tx.targetAudience.findMany({ where: { tenantId }, include: { conditions: true } }),
      tx.template.findMany({ where: { tenantId, isArchived: false }, select: { id: true, name: true, subject: true, content: true } }),
      tx.campaign.findMany({ where: { tenantId, isArchived: false, status: { in: ['DRAFT', 'SCHEDULED'] as never[] } } }),
    ]);
    const affected = [
      ...workflows.filter(row => referencesCustomField([row.conditions, row.actions], id)).map(row => `Workflow “${row.name}” (${row.id})`),
      ...forms.filter(row => referencesCustomField([row.fields, row.publishedConfig], id)).map(row => `Form “${row.name}” (${row.id})`),
      ...audiences.filter(row => referencesCustomField(row.conditions, id)).map(row => `Audience “${row.name}” (${row.id})`),
      ...templates.filter(row => referencesCustomField([row.subject, row.content], id)).map(row => `Template “${row.name}” (${row.id})`),
      ...campaigns.filter(row => referencesCustomField(row, id)).map(row => `Campaign “${row.name}” (${row.id})`),
    ];
    if (affected.length) throw new ValidationError(`Repair these references before deleting this field: ${affected.join('; ')}.`);
    const retired: ClosingField = { ...field, active: false, deletedAt: new Date().toISOString(), deletedById: actorId, version: field.version + 1 };
    await tx.closingFieldDefinition.update({ where: { tenantId_id: { tenantId, id } }, data: { definition: retired as unknown as Prisma.InputJsonValue } });
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: 'custom_field.deleted', entityType: 'ClosingField', entityId: id, changeset: { before: field, after: retired } as unknown as Prisma.InputJsonValue } });
    return { id, deletedAt: retired.deletedAt };
  });
}

async function readState(tx: Prisma.TransactionClient, tenantId: string, dealId: string): Promise<ClosingRequirementsState> {
  const deal = await tx.deal.findFirst({ where: { id: dealId, tenantId, isArchived: false, deletedAt: null }, include: { stage: true } });
  if (!deal) throw new NotFoundError('Deal');
  const snapshot = deal.closingSnapshot as { fields?: ClosingField[]; values?: ClosingValues } | null;
  const locked = deal.stage.isWon || deal.stage.isLost || !!snapshot;
  const fields = snapshot?.fields?.map(normalizeCustomField) ?? (locked ? [] : await readClosingFields(tx, tenantId));
  const values = snapshot?.values ?? deal.closingValues as ClosingValues;
  const files = await tx.recordFile.findMany({ where: { tenantId, dealId }, select: { id: true, name: true, size: true, type: true } });
  return { fields, values, locked, closedAt: deal.wonConfirmedAt?.toISOString(), errors: locked ? {} : await validateValues(tx, tenantId, dealId, fields, values),
    files: files.map(file => ({ ...file, url: `/api/proxy/crm/deals/${encodeURIComponent(dealId)}/files/${file.id}/download` })) };
}
export const getRequirements = (tenantId: string, dealId: string) => salesTransaction(tx => readState(tx, tenantId, dealId));

export async function saveValues(tenantId: string, actorId: string, dealId: string, input: unknown) {
  const patch = ClosingValuesPatchSchema.parse(input);
  const result = await salesTransaction(async tx => {
    const deal = await tx.deal.findFirst({ where: { id: dealId, tenantId, isArchived: false, deletedAt: null }, include: { stage: true } });
    if (!deal) throw new NotFoundError('Deal');
    if (deal.stage.isWon || deal.stage.isLost || deal.closingSnapshot) throw new ValidationError('Closed Deal evidence is preserved and cannot be edited.');
    const fields = await readClosingFields(tx, tenantId);
    if (Object.keys(patch.values).some(id => !fields.some(f => f.id === id && f.active))) throw new ValidationError('Choose an active closing field.');
    const normalized = Object.fromEntries(Object.entries(patch.values).map(([id, value]) => [id, typeof value === 'string' ? value.trim() : value]));
    const previousValues = deal.closingValues as ClosingValues;
    const changed = Object.keys(normalized).filter(id => !isDeepStrictEqual(previousValues[id], normalized[id]));
    if (!changed.length) return { state: await readState(tx, tenantId, dealId), transition: null, before: deal, updated: deal };
    const values: ClosingValues = { ...deal.closingValues as ClosingValues, ...normalized };
    const errors = await validateValues(tx, tenantId, dealId, fields, values);
    const invalid = changed.filter(id => errors[id]);
    if (invalid.length) throw new ValidationError(invalid.map(id => errors[id]).join(' '));
    const updated = await tx.deal.update({ where: { id: dealId, tenantId }, data: { closingValues: values } });
    // Compatibility JSON and normalized values commit together; frozen snapshots stay untouched.
    await persistValues(tx, tenantId, 'deals', dealId, normalized);
    await tx.activity.create({ data: { tenantId, dealId, createdById: actorId, type: 'note', title: 'Closed Won requirements updated', description: fields.filter(f => changed.includes(f.id)).map(f => f.name).join(', '), metadata: { source: 'closing_requirements', fieldIds: changed } } });
    let transition: Awaited<ReturnType<typeof moveDealStage>> = null;
    const missingRequired = fields.some(field => field.active && field.required && errors[field.id]);
    if (deal.stage.name.trim().toLowerCase() === 'qualified' && !missingRequired) {
      const wonStages = await tx.stage.findMany({ where: { tenantId, pipelineId: deal.pipelineId, isWon: true, isLost: false } });
      if (wonStages.length !== 1) throw new ValidationError('Configure exactly one Closed Won stage in this pipeline.');
      transition = await moveDealStage(dealId, tenantId, wonStages[0].id, actorId, undefined, undefined, undefined, undefined, tx);
      if (transition?.stageHistory) await tx.auditLog.create({ data: { tenantId, userId: actorId, action: 'deal.stage_changed', entityType: 'Deal', entityId: dealId, changeset: { before: { stageId: deal.stageId }, after: { stageId: wonStages[0].id } }, metadata: { source: 'closing_requirements' } } });
    }
    return { state: await readState(tx, tenantId, dealId), transition, before: deal, updated: transition?.deal ?? updated };
  });
  if (result.transition?.stageHistory) {
    const { deal, stageHistory } = result.transition;
    await fireDealStageChanged({ tenantId, actorId, eventId: stageHistory.id, deal, newStageId: deal.stageId, newStageName: deal.stage.name, isWon: true, isLost: false, prevStageId: stageHistory.previousStageId ?? undefined });
  }
  const changes = recordChanges(result.before, result.updated);
  if (changes.changedFields.length) await fireDealUpdated({ tenantId, actorId, record: result.updated,
    eventId: result.transition?.stageHistory?.id, changedFields: changes.changedFields, changes });
  return result.state;
}
