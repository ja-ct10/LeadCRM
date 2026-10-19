import { expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { CreateDealSchema, ManualCreateDealSchema, UpdateDealSchema } from '../deals.dto';
import { CreateDealBatchSchema, getCrmFieldCatalog, getWorkflowConditionFields, getWorkflowUpdateFields, normalizeModuleColumns } from '@leadcrm/shared';
import { CreateStageSchema, UpdateStageSchema } from '../../pipeline/pipeline.dto';

const create = { leadIds: ['lead'], title: 'CCTV installation', pipelineId: 'sales', stageId: 'lead', productInterestIds: ['11111111-1111-4111-8111-111111111111'] };
it('accepts create and update without retired fields', () => {
  expect(ManualCreateDealSchema.parse(create).priority).toBe('MEDIUM');
  expect(UpdateDealSchema.parse({ title: 'Updated installation', priority: 'HIGH' })).toEqual({ title: 'Updated installation', priority: 'HIGH' });
});
it.each(['confidence', 'description', 'industry'])('rejects %s on create and update', field => {
  const value = field === 'confidence' ? 50 : 'Old field';
  expect(CreateDealSchema.safeParse({ ...create, [field]: value }).success).toBe(false);
  expect(ManualCreateDealSchema.safeParse({ ...create, [field]: value }).success).toBe(false);
  expect(UpdateDealSchema.safeParse({ [field]: value }).success).toBe(false);
  expect(CreateDealBatchSchema.safeParse({ ...create, idempotencyKey: '11111111-1111-4111-8111-111111111111', [field]: value }).success).toBe(false);
});

it('removes Deal Industry catalog and stage requirements while retaining Account Industry', () => {
  expect(getCrmFieldCatalog('deals').some(field => field.technicalKey === 'industry')).toBe(false);
  expect(getCrmFieldCatalog('accounts').some(field => field.technicalKey === 'industry')).toBe(true);
  expect(getWorkflowConditionFields('deal').some(field => field.field === 'deal.industry')).toBe(false);
  expect(getWorkflowUpdateFields('deal').some(field => field.field === 'industry')).toBe(false);
  expect(getWorkflowConditionFields('account').some(field => field.field === 'account.industry')).toBe(true);
  expect(normalizeModuleColumns('deals', [{ id: 'industry', visible: true, order: 0 }, { id: 'title', visible: true, order: 1 }])).toEqual([{ id: 'title', visible: true, order: 1 }]);
  expect(normalizeModuleColumns('accounts', [{ id: 'industry', visible: true, order: 0 }])).toEqual([{ id: 'industry', visible: true, order: 0 }]);
  for (const field of ['industry', 'deal.industry']) {
    expect(CreateStageSchema.safeParse({ pipelineId: 'sales', name: 'Review', order: 1, requiredFields: [field] }).success).toBe(false);
    expect(UpdateStageSchema.safeParse({ requiredFields: [field] }).success).toBe(false);
  }
  expect(UpdateStageSchema.safeParse({ requiredFields: ['leadSource', 'value'] }).success).toBe(true);
});
it('generated ORM models contain neither retired Deal fields nor an invitation model', () => {
  const deal = Prisma.dmmf.datamodel.models.find(model => model.name === 'Deal')!;
  expect(deal.fields.map(field => field.name)).not.toContain('description');
  expect(deal.fields.map(field => field.name)).not.toContain('confidence');
  expect(deal.fields.map(field => field.name)).not.toContain('industry');
  expect(Prisma.dmmf.datamodel.models.find(model => model.name === 'Account')!.fields.map(field => field.name)).toContain('industry');
  expect(Prisma.dmmf.datamodel.models.map(model => model.name)).not.toContain('TenantInvitation');
});
