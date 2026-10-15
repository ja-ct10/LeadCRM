import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowAction } from '@leadcrm/shared';
import { resolveTaskDeals, resolveTaskDealIds, validateTaskDealSelection, workflowTaskAssociationSummary } from '../action-task-deals';
import { restoredWorkflowTaskInput } from '../action-task-input';

const mocks = vi.hoisted(() => ({ count: vi.fn(), rows: vi.fn(), deal: vi.fn(), pipeline: vi.fn(), stage: vi.fn(), product: vi.fn() }));
vi.mock('../../../../config/database.config', () => ({ default: {
  deal: { count: mocks.count, findMany: mocks.rows, findFirst: mocks.deal }, pipeline: { findFirst: mocks.pipeline },
  stage: { findFirst: mocks.stage }, productInterest: { findFirst: mocks.product },
} }));
vi.mock('../action-message', () => ({ renderMessage: vi.fn(), resolveMessageValues: vi.fn() }));
const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const tenantId = uuid(1), sourceId = uuid(2), pipelineId = uuid(3), stageId = uuid(4), productId = uuid(5), dealId = uuid(6);
const action = (config: Record<string, unknown> = {}): WorkflowAction => ({ type: 'create_task', config: { title: 'Follow up', ...config } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.count.mockResolvedValue(1); mocks.rows.mockResolvedValue([{ id: dealId, title: 'Related deal' }]);
  mocks.deal.mockResolvedValue({ id: dealId }); mocks.pipeline.mockResolvedValue({ id: pipelineId });
  mocks.stage.mockResolvedValue({ pipelineId }); mocks.product.mockResolvedValue({ id: productId });
});

describe('Workflow task association selection', () => {
  it('defaults Deal triggers to their triggering deal and preserves exact legacy selections', async () => {
    expect(await resolveTaskDealIds(action({ dealId }), 'deal', tenantId, { 'deal.id': dealId })).toEqual([dealId]);
    expect(mocks.count).toHaveBeenCalledWith({ where: expect.objectContaining({ tenantId, id: dealId, AND: [{ id: dealId }], isArchived: false, deletedAt: null }) });
    expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: 'asc' } }));
    expect(mocks.rows.mock.calls[0][0]).not.toHaveProperty('take');
  });
  it('requires an explicit all-matching choice for multiple matches and reports the count', async () => {
    mocks.count.mockResolvedValue(3);
    await expect(resolveTaskDeals(action(), 'lead', tenantId, { 'lead.id': sourceId })).rejects.toThrow("3 related deals match your selection. Narrow your filters or choose 'All matching related deals'.");
    expect(mocks.rows).not.toHaveBeenCalled();
    const rows = [6, 7, 8].map(id => ({ id: uuid(id), title: `Deal ${id}` }));
    mocks.rows.mockResolvedValue(rows);
    expect(await resolveTaskDeals(action({ targetMode: 'all_matching' }), 'lead', tenantId, { 'lead.id': sourceId })).toEqual(rows);
    expect(workflowTaskAssociationSummary(rows.length)).toBe('Creates 1 task linked to 3 deals.');
  });
  it('combines tenant-owned pipeline, stage, product and exact-deal filters with the source relationship', async () => {
    await resolveTaskDeals(action({ targetMode: 'single_match', pipelineId, currentStageId: stageId, productInterestId: productId, dealId }), 'lead', tenantId, { 'lead.id': sourceId });
    expect(mocks.count).toHaveBeenCalledWith({ where: expect.objectContaining({ tenantId, pipelineId, stageId, id: dealId,
      AND: [{ leadDeals: { some: { tenantId, leadId: sourceId } } }],
      OR: [{ productInterestId: productId }, { productInterestIds: { has: productId } }],
    }) });
  });
  it('includes direct Contact links and converted Lead links without discovering unrelated deals', async () => {
    await resolveTaskDeals(action(), 'contact', tenantId, { 'contact.id': sourceId });
    expect(mocks.count).toHaveBeenCalledWith({ where: expect.objectContaining({ AND: [{ OR: [
      { contactDeals: { some: { tenantId, contactId: sourceId } } },
      { leadDeals: { some: { tenantId, lead: { tenantId, contactId: sourceId, convertedAt: { not: null } } } } },
    ] }] }) });
  });
  it('fails on zero matches and on selections beyond the existing 50-deal limit without truncating', async () => {
    mocks.count.mockResolvedValue(0);
    await expect(resolveTaskDeals(action(), 'lead', tenantId, { 'lead.id': sourceId })).rejects.toThrow('No related deals match');
    mocks.count.mockResolvedValue(51);
    await expect(resolveTaskDeals(action({ targetMode: 'all_matching' }), 'lead', tenantId, { 'lead.id': sourceId })).rejects.toThrow('51 related deals match your selection. A task supports up to 50 deal associations.');
    expect(mocks.rows).not.toHaveBeenCalled();
    mocks.count.mockResolvedValue(50); mocks.rows.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ id: uuid(index + 6), title: `Deal ${index}` })));
    expect(await resolveTaskDealIds(action({ targetMode: 'all_matching' }), 'lead', tenantId, { 'lead.id': sourceId })).toHaveLength(50);
  });
  it.each([
    ['deal', { targetMode: 'all_matching' }], ['deal', { pipelineId }], ['lead', { targetMode: 'triggering_deal' }],
    ['contact', { targetMode: 'latest' }], ['lead', { dealId: 'manual-invalid-id' }], ['account', { targetMode: 'all_matching' }],
  ] as const)('rejects invalid or unsupported %s selection %j', async (entity, config) => {
    await expect(validateTaskDealSelection(action(config), entity, tenantId)).rejects.toThrow();
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it.each(['pipeline', 'stage', 'product', 'deal'] as const)('rejects a missing or foreign %s reference before resolving deals', async kind => {
    mocks[kind].mockResolvedValue(null);
    const config = { pipeline: { pipelineId }, stage: { currentStageId: stageId }, product: { productInterestId: productId }, deal: { dealId } }[kind];
    await expect(validateTaskDealSelection(action(config), 'lead', tenantId)).rejects.toThrow('unavailable');
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks[kind]).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId }) }));
  });
  it('rejects a stage from a different pipeline and a race during a preview read', async () => {
    mocks.stage.mockResolvedValue({ pipelineId: uuid(99) });
    await expect(validateTaskDealSelection(action({ pipelineId, currentStageId: stageId }), 'lead', tenantId)).rejects.toThrow('another pipeline');
    mocks.rows.mockResolvedValue([]);
    await expect(resolveTaskDeals(action(), 'lead', tenantId, { 'lead.id': sourceId })).rejects.toThrow('Related deals changed during this check');
  });
  it('preserves the unique-match behavior of existing Account workflows', async () => {
    expect(await resolveTaskDealIds(action(), 'account', tenantId, { 'account.id': sourceId })).toEqual([dealId]);
    expect(mocks.count).toHaveBeenCalledWith({ where: expect.objectContaining({ AND: [{ accountId: sourceId }] }) });
  });
});

describe('Workflow task recovery payload', () => {
  it('restores the original dates, assignee and ordered associations for the same step receipt', () => {
    const payload = { requestId: uuid(10), title: 'Original task', status: 'pending', priority: 'High',
      dueDate: '2026-10-10T09:00:00.000Z', assignedUserId: uuid(11), dealIds: [uuid(12), uuid(13)] };
    expect(restoredWorkflowTaskInput(payload, uuid(10))).toEqual(payload);
    expect(restoredWorkflowTaskInput({ version: 1, action: action(), context: {} }, uuid(10))).toBeUndefined();
    expect(() => restoredWorkflowTaskInput(payload, uuid(14))).toThrow('saved task request');
  });
});
