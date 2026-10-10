import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSED_WON_GROUP_ID, DEFAULT_CLOSING_FIELDS, defaultFieldLayout, getCrmFieldCatalog, getWorkflowConditionFields, getWorkflowUpdateFields, isClosedWonField, isSystemClosingField, type ClosingField } from '@leadcrm/shared';

const state = vi.hoisted(() => ({ definitions: [] as Array<{ tenantId: string; id: string; definition: unknown }>, preferences: [] as Array<{ tenantId: string; module: string; key: string; value: unknown }>, values: [] as Array<{ fieldId: string; value: unknown }>, workflows: [] as unknown[], forms: [] as unknown[], audiences: [] as unknown[], templates: [] as unknown[], campaigns: [] as unknown[], audits: [] as unknown[] }));
const tx = vi.hoisted(() => ({
  closingFieldDefinition: {
    findMany: vi.fn(async ({ where }: any) => structuredClone(state.definitions.filter(row => row.tenantId === where.tenantId))),
    createMany: vi.fn(async ({ data }: any) => { state.definitions.push(...data); }),
    create: vi.fn(async ({ data }: any) => { state.definitions.push(data); return data; }),
    update: vi.fn(async ({ where, data }: any) => { const row = state.definitions.find(row => row.id === where.tenantId_id.id && row.tenantId === where.tenantId_id.tenantId)!; Object.assign(row, data); return row; }),
  },
  tenantPreference: {
    findUnique: vi.fn(async ({ where }: any) => structuredClone(state.preferences.find(row => row.tenantId === where.tenantId_module_key.tenantId && row.module === where.tenantId_module_key.module && row.key === where.tenantId_module_key.key) ?? null)),
    upsert: vi.fn(async ({ where, create }: any) => { const row = state.preferences.find(row => row.tenantId === where.tenantId_module_key.tenantId && row.module === where.tenantId_module_key.module); if (row) return structuredClone(row); state.preferences.push(create); return structuredClone(create); }),
    update: vi.fn(async ({ where, data }: any) => { const row = state.preferences.find(row => row.tenantId === where.tenantId_module_key.tenantId && row.module === where.tenantId_module_key.module)!; Object.assign(row, data); return row; }),
  },
  customFieldValue: { count: vi.fn(async ({ where }: any) => state.values.filter(value => value.fieldId === where.fieldId && where.OR.some((condition: any) => condition.value.equals === value.value)).length) },
  workflow: { findMany: vi.fn(async () => state.workflows) }, marketingForm: { findMany: vi.fn(async () => state.forms) }, targetAudience: { findMany: vi.fn(async () => state.audiences) }, template: { findMany: vi.fn(async () => state.templates) }, campaign: { findMany: vi.fn(async () => state.campaigns) },
  auditLog: { create: vi.fn(async ({ data }: any) => { state.audits.push(data); return data; }) },
}));
vi.mock('../leads/lead-automation.service', () => ({ salesTransaction: (callback: (tx: unknown) => unknown) => callback(tx) }));
vi.mock('../../automation/triggers/triggers.service', () => ({ fireDealStageChanged: vi.fn(), fireDealUpdated: vi.fn() }));
vi.mock('../deals/deals.repository', () => ({ moveDealStage: vi.fn() }));
import { getFieldLayout, updateFieldLayout } from './field-layout.service';
import { deleteField, referencesCustomField, saveField } from './closing-requirements.service';
import { readFields } from './closing-requirements.repository';

beforeEach(() => { for (const values of Object.values(state)) values.length = 0; state.definitions.push(...DEFAULT_CLOSING_FIELDS.map(definition => ({ tenantId: 'tenant', id: definition.id, definition }))); vi.clearAllMocks(); });
const createField = (extra = {}) => saveField('tenant', 'actor', { module: 'leads', group: 'Basic Information', type: 'Number', name: 'Budget', required: false, ...extra });

describe('field configuration identity and preservation', () => {
  it('keeps native technical keys and custom IDs stable across labels, hiding and saved section ordering', async () => {
    const first = await getFieldLayout('tenant', 'leads');
    const added = await updateFieldLayout('tenant', 'actor', 'leads', { action: 'add', label: ' Technical details ' });
    const group = added.layout.groups.find(group => group.label === 'Technical details')!;
    const budget = await createField({ group: group.label, groupId: group.id });
    state.values.push({ fieldId: budget.id, value: 0 });
    await updateFieldLayout('tenant', 'actor', 'leads', { action: 'rename', groupId: group.id, label: 'Project information' });
    await updateFieldLayout('tenant', 'actor', 'leads', { action: 'moveGroup', groupId: group.id, direction: 'up' });
    await saveField('tenant', 'actor', { name: 'Project value', visibleInDetails: false }, budget.id);
    const next = await getFieldLayout('tenant', 'leads'), entry = next.fields.find(field => field.customFieldId === budget.id)!;
    expect(entry).toMatchObject({ label: 'Project value', technicalKey: `customFieldValues.${budget.id}`, groupId: group.id, group: 'Project information', visibleInDetails: false });
    expect(state.values).toEqual([{ fieldId: budget.id, value: 0 }]);
    expect(next.layout.groups.find(item => item.id === group.id)?.order).toBe(first.layout.groups.length - 1);
    await updateFieldLayout('tenant', 'actor', 'leads', { action: 'field', technicalKey: 'email', label: 'Work email' });
    expect((await getFieldLayout('tenant', 'leads')).fields.find(field => field.technicalKey === 'email')?.label).toBe('Work email');
  });
  it('rejects prohibited type/module/key changes, mandatory hiding and required custom hiding', async () => {
    const budget = await createField({ required: true });
    for (const patch of [{ type: 'Text' }, { module: 'contacts' }, { technicalKey: 'changed' }, { id: 'spoofed' }, { visibleInForm: false }]) await expect(saveField('tenant', 'actor', patch, budget.id)).rejects.toThrow();
    await expect(updateFieldLayout('tenant', 'actor', 'leads', { action: 'field', technicalKey: 'email', visibleInForm: false })).rejects.toThrow('mandatory');
    await saveField('tenant', 'actor', { required: false, visibleInForm: false }, budget.id);
    const hidden = (await readFields(tx as any, 'tenant')).find(field => field.id === budget.id)!;
    expect(getWorkflowConditionFields('lead', undefined, [hidden]).some(field => field.field === `lead.customFieldValues.${budget.id}`)).toBe(true);
    expect(getWorkflowUpdateFields('lead', [hidden]).some(field => field.field === `customFieldValues.${budget.id}`)).toBe(false);
  });
  it('uses exact seeded IDs and a protected context, preserving renamed closing validation', async () => {
    const original = DEFAULT_CLOSING_FIELDS[0];
    expect(isSystemClosingField(original)).toBe(true);
    expect(isSystemClosingField({ ...original, id: 'user-id' })).toBe(false);
    await updateFieldLayout('tenant', 'actor', 'deals', { action: 'rename', groupId: CLOSED_WON_GROUP_ID, label: 'Approval evidence' });
    const renamed = (await readFields(tx as any, 'tenant')).find(field => field.id === original.id)!;
    expect(renamed.group).toBe('Approval evidence'); expect(isClosedWonField(renamed)).toBe(true);
    await expect(deleteField('tenant', 'actor', original.id)).rejects.toThrow('System fields');
    await expect(updateFieldLayout('tenant', 'actor', 'deals', { action: 'delete', groupId: CLOSED_WON_GROUP_ID })).rejects.toThrow('protected');
    await expect(updateFieldLayout('tenant', 'actor', 'deals', { action: 'field', technicalKey: `customFieldValues.${original.id}`, groupId: defaultFieldLayout('deals').groups[0].id })).rejects.toThrow('closing evidence');
  });
  it('deletes ordinary sections only through an explicit same-module move and preserves field/value identities', async () => {
    const field = await createField(), before = await getFieldLayout('tenant', 'leads'), groupId = before.layout.groups[0].id;
    await expect(updateFieldLayout('tenant', 'actor', 'leads', { action: 'delete', groupId })).rejects.toThrow('Choose another');
    const moved = await updateFieldLayout('tenant', 'actor', 'leads', { action: 'delete', groupId, moveToGroupId: before.layout.groups[1].id });
    expect(moved.layout.groups.some(group => group.id === groupId)).toBe(false);
    expect(moved.fields.find(item => item.customFieldId === field.id)?.groupId).toBe(before.layout.groups[1].id);
    await expect(updateFieldLayout('tenant', 'actor', 'leads', { action: 'add', label: ' status & INTEREST ' })).rejects.toThrow('unique');
  });
  it('blocks saved dependencies and used option removal, then retires unreferenced custom fields without purging evidence', async () => {
    const field = await createField({ type: 'Dropdown', options: ['Gold', 'Silver'] });
    state.values.push({ fieldId: field.id, value: 'Gold' });
    await expect(saveField('tenant', 'actor', { options: ['Silver'] }, field.id)).rejects.toThrow('saved records');
    state.workflows.push({ id: 'workflow', name: 'Qualify', conditions: { conditions: [{ field: `lead.customFieldValues.${field.id}`, value: 'Gold' }] } });
    await expect(deleteField('tenant', 'actor', field.id)).rejects.toThrow('Qualify'); state.workflows.length = 0;
    state.templates.push({ id: 'template', name: 'Welcome', content: `Budget {{customFieldValues.${field.id}}}` });
    await expect(deleteField('tenant', 'actor', field.id)).rejects.toThrow('Welcome'); state.templates.length = 0;
    await deleteField('tenant', 'actor', field.id);
    expect((await readFields(tx as any, 'tenant')).some(item => item.id === field.id)).toBe(false);
    expect((await readFields(tx as any, 'tenant', true)).find(item => item.id === field.id)?.deletedAt).toBeTruthy();
    expect(state.values).toEqual([{ fieldId: field.id, value: 'Gold' }]);
  });
  it('does not confuse mutable labels or ID prefixes with immutable tokens', () => {
    expect(referencesCustomField('Budget', 'field-id')).toBe(false);
    expect(referencesCustomField('{{customFieldValues.field-id-other}}', 'field-id')).toBe(false);
    expect(referencesCustomField('Budget {{ \n  customFieldValues.field-id\t }}', 'field-id')).toBe(true);
    expect(referencesCustomField({ fieldId: 'field-id' }, 'field-id')).toBe(true);
    const custom = { id: 'field-id', name: 'Budget', module: 'leads', group: 'Basic Information', type: 'Number', active: true, visibleInForm: false } as ClosingField;
    expect(getCrmFieldCatalog('leads', [custom]).find(field => field.customFieldId === custom.id)).toMatchObject({ conditionAvailable: true, personalizationAvailable: true, visibleInForm: false });
  });
  it('rejects another group at the layout limit without making the saved layout unreadable', async () => {
    const initial = await getFieldLayout('tenant', 'leads');
    const layout = structuredClone(initial.layout);
    while (layout.groups.length < 100) layout.groups.push({ id: `group-${layout.groups.length}`, label: `Group ${layout.groups.length}`, order: layout.groups.length });
    state.preferences.find(preference => preference.module === 'leads')!.value = layout;
    await expect(updateFieldLayout('tenant', 'actor', 'leads', { action: 'add', label: 'Overflow' })).rejects.toThrow('at most 100');
    expect((await getFieldLayout('tenant', 'leads')).layout.groups).toHaveLength(100);
    expect(tx.tenantPreference.update).not.toHaveBeenCalled();
  });
});
