import { expect, it } from 'vitest';
import { RETIRED_CONTACT_FIELDS, defaultFieldLayout, getCrmFieldCatalog, getWorkflowConditionFields, getWorkflowUpdateFields, normalizeWorkflowReferences, retiredContactReferences, campaignFields, campaignFieldsForSource, campaignApprovedVariableKeys } from '@leadcrm/shared';
import { CreateClientContactSchema, UpdateClientContactSchema } from '../contacts-v2.dto';
import { validateWorkflowConditions } from '../../../automation/workflows/workflow-validation';

it.each(RETIRED_CONTACT_FIELDS)('rejects retired Contact mutation input %s on create and update', field => {
  expect(CreateClientContactSchema.safeParse({ requestId: '00000000-0000-4000-8000-000000000001', firstName: 'Nora', lastName: 'Lim', email: 'nora@example.test', [field]: null }).success).toBe(false);
  expect(UpdateClientContactSchema.safeParse({ [field]: null }).success).toBe(false);
});
it('keeps supported writes and Product Interest catalogs, with Account Active Products scoped independently', () => {
  expect(CreateClientContactSchema.parse({ requestId: '00000000-0000-4000-8000-000000000001', firstName: 'Nora', lastName: 'Lim', email: 'nora@example.test', productInterests: ['CCTV'] })).toMatchObject({ productInterests: ['CCTV'] });
  for (const fields of [getCrmFieldCatalog('contacts').map(f=>f.technicalKey), getWorkflowConditionFields('contact').map(f=>f.field.slice(8)), getWorkflowUpdateFields('contact').map(f=>f.field), campaignFields('CONTACTS').map(f=>f.technicalKey)]) {
    expect(fields).toContain('productInterestIds');
    for (const key of [...RETIRED_CONTACT_FIELDS,'activeProductIds']) expect(fields).not.toContain(key);
  }
  expect(getCrmFieldCatalog('accounts').map(f=>f.technicalKey)).not.toContain('activeProductIds');
  const all = (['leads','contacts','accounts','deals'] as const).flatMap(module=>getCrmFieldCatalog(module));
  const contactTokens = campaignApprovedVariableKeys(campaignFieldsForSource(all,'CONTACTS'));
  expect(contactTokens.has('activeProductIds')).toBe(false);
  expect(contactTokens.has('account.activeProductIds')).toBe(false);
  expect(campaignApprovedVariableKeys(campaignFieldsForSource(all,'LEADS')).has('activeProductIds')).toBe(false);
});
it('retains historical selectors unchanged and blocks Contact activation before execution', () => {
  const conditions = { operator: 'AND' as const, conditions: [{ field: 'contact.activeProducts', operator: 'is_empty' as const, value: null }] };
  const draft = { name: 'Needs repair', trigger: 'contact.updated', conditions, actions: [{ type: 'update_field', config: { field: 'activeProducts', clear: true } }], isActive: true };
  expect(normalizeWorkflowReferences(draft, [])).toEqual(draft);
  expect(retiredContactReferences([draft.conditions,draft.actions],'contact')).toEqual(['contact.activeProducts','activeProducts']);
  expect(() => validateWorkflowConditions(draft as never)).toThrow('Repair the Workflow condition');
  expect(retiredContactReferences({ field: 'account.activeProducts', body: 'contact.score', config: { field: 'customFieldValues.score' } }, 'account')).toEqual([]);
  expect(retiredContactReferences({ field: 'event.changedFields', value: 'activeProducts' }, 'contact')).toEqual(['activeProducts']);
  expect(retiredContactReferences({ field: 'event.changedFields', value: 'score' }, 'lead')).toEqual([]);
});
it('uses the requested Contact sections while preserving historical custom-field group identity', () => {
  expect(defaultFieldLayout('contacts').groups.map(group => group.label)).toEqual(['Basic Information', 'Status & Interest', 'Organization', 'Additional Information', 'Assigned Agent']);
  const definitions = ['Status & Classification', 'Relationships'].map((group, index) => ({ id: `historic-${index}`, name: `Preserved ${index}`, type: 'Text', module: 'contacts', group, active: true, visibleInForm: true, visibleInDetails: true, order: 0 }));
  const fields = getCrmFieldCatalog('contacts', definitions as never);
  expect(fields.find(field => field.customFieldId === 'historic-0')).toMatchObject({ groupId: 'contacts:section:1', group: 'Status & Interest' });
  expect(fields.find(field => field.customFieldId === 'historic-1')).toMatchObject({ groupId: 'contacts:section:2', group: 'Organization' });
});
