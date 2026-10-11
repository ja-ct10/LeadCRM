import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const state = vi.hoisted(() => ({
  deal: {} as Record<string, any>, next: {} as Record<string, any>, legacyWon: false,
  tx: { deal: { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, stage: { findFirst: vi.fn() },
    pipeline: { findFirst: vi.fn() }, auditLog: { create: vi.fn() },
    dealStageHistory: { findFirst: vi.fn(), create: vi.fn() }, activity: { create: vi.fn() },
    leadDeal: { findMany: vi.fn() }, contactDeal: { findMany: vi.fn() } },
}));
vi.mock('../../../../config/database.config', () => ({ default: state.tx }));
vi.mock('../../leads/lead-automation.service', () => ({ crmScope: (tenantId: string) => ({ tenantId }), salesTransaction: (work: (tx: unknown) => unknown) => work(state.tx), resolveProducts: vi.fn() }));
vi.mock('../../closing-requirements/closing-requirements.repository', () => ({ closingEvidence: vi.fn(async () => ({ fields: [], values: { signed: true } })) }));
vi.mock('../won-conversion.service', () => ({ resolveWonRelationships: vi.fn() }));
vi.mock('../../engagement.service', () => ({ changeCustomerStatus: vi.fn() }));

import { moveDealStage, moveDealPipeline } from '../deals.repository';
import { dealHasEverBeenWon } from '../deal-lifecycle';

const stage = (id: string, isWon = false, isLost = false) => ({ id, name: id, tenantId: 'tenant', pipelineId: 'pipeline', isWon, isLost, requiredFields: [] });
beforeEach(() => {
  vi.clearAllMocks(); state.legacyWon = false;
  state.deal = { id: 'deal', tenantId: 'tenant', title: 'Sale', pipelineId: 'pipeline', stageId: 'Lead', stage: stage('Lead'),
    createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'), hasEverBeenWon: false, wonHistoryVerified: true,
    closedAt: null, wonConfirmedAt: null, closingSnapshot: null, lostReason: null, assignedUserId: 'agent', leadDeals: [], contactDeals: [] };
  state.next = stage('Qualified');
  state.tx.deal.findFirst.mockImplementation(async () => ({ ...state.deal }));
  state.tx.deal.findFirstOrThrow.mockImplementation(async () => ({ ...state.deal, stage: state.next, leadDeals: [], contactDeals: [] }));
  state.tx.stage.findFirst.mockImplementation(async () => state.next);
  state.tx.deal.update.mockImplementation(async ({ data }) => { state.deal = { ...state.deal, ...data }; return state.deal; });
  state.tx.dealStageHistory.findFirst.mockImplementation(async ({ where }) => where.OR && state.legacyWon ? { id: 'old-won' } : null);
  state.tx.dealStageHistory.create.mockImplementation(async ({ data }) => ({ id: 'event', ...data }));
  state.tx.leadDeal.findMany.mockResolvedValue([]); state.tx.contactDeal.findMany.mockResolvedValue([]);
});
const move = () => moveDealStage('deal', 'tenant', state.next.id, 'actor');

describe('governed Deal stage changes', () => {
  it('rejects an archival race at the conditional transfer write without recording history', async () => {
    state.next = { ...stage('target-stage'), pipelineId: 'target' };
    state.tx.pipeline.findFirst.mockResolvedValue({ id: 'target', name: 'Renewals' });
    state.tx.deal.updateMany.mockImplementation(async ({ where, data }) => {
      state.deal.isArchived = true;
      if (where.isArchived === false) return { count: 0 };
      Object.assign(state.deal, data);
      return { count: 1 };
    });
    await expect(moveDealPipeline('deal', 'tenant', 'actor', { pipelineId: 'target', stageId: 'target-stage' })).rejects.toThrow('Deal changed');
    expect(state.deal).toMatchObject({ pipelineId: 'pipeline', stageId: 'Lead', isArchived: true });
    expect(state.tx.dealStageHistory.create).not.toHaveBeenCalled();
    expect(state.tx.activity.create).not.toHaveBeenCalled();
    expect(state.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it.each([{ isArchived: true }, { deletedAt: new Date('2026-10-11') }])('rejects a record deactivated after validation but before the conditional write: %j', async deactivated => {
    state.tx.deal.update.mockImplementation(async ({ where, data }) => {
      // Model another session winning the archival/deletion race at the write boundary.
      Object.assign(state.deal, deactivated);
      if (where.isArchived === false && state.deal.isArchived || where.deletedAt === null && state.deal.deletedAt) {
        throw new Prisma.PrismaClientKnownRequestError('Record no longer matches the active write condition', { code: 'P2025', clientVersion: '5' });
      }
      state.deal = { ...state.deal, ...data };
      return state.deal;
    });
    await expect(move()).rejects.toThrow('active write condition');
    expect(state.deal.stageId).toBe('Lead');
    expect(state.tx.dealStageHistory.create).not.toHaveBeenCalled();
    expect(state.tx.activity.create).not.toHaveBeenCalled();
  });
  it('validates legacy singular requirements against canonical participants', async () => {
    state.next.requiredFields = ['leadId', 'contactId'];
    await expect(move()).rejects.toThrow('Missing stage requirements');
    expect(state.tx.deal.update).not.toHaveBeenCalled();
    state.deal.leadDeals = [{ leadId: 'lead' }];
    state.deal.contactDeals = [{ contactId: 'contact' }];
    await expect(move()).resolves.toBeTruthy();
  });
  it('records an actual transition once and preserves the prior event snapshot', async () => {
    const result = await move();
    expect(result?.previousDeal.stageId).toBe('Lead');
    expect(result?.deal.stageId).toBe('Qualified');
    expect(state.tx.dealStageHistory.create).toHaveBeenCalledOnce();
    expect(state.tx.dealStageHistory.create.mock.calls[0][0].data).toMatchObject({ tenantId: 'tenant', previousStageId: 'Lead', newStageId: 'Qualified' });
    await move();
    expect(state.tx.dealStageHistory.create).toHaveBeenCalledOnce();
    expect(state.tx.activity.create).toHaveBeenCalledOnce();
  });
  it('allows verified Lost → Qualified without copying or changing the agent', async () => {
    Object.assign(state.deal, { stageId: 'Lost', stage: stage('Lost', false, true), closedAt: new Date(), lostReason: 'Deferred' });
    await move();
    expect(state.deal).toMatchObject({ stageId: 'Qualified', closedAt: null, lostReason: null, assignedUserId: 'agent', hasEverBeenWon: false });
  });
  it.each(['won', 'lost-after-won', 'uncertain', 'lost-to-lead'])('blocks %s without altering terminal sale evidence', async condition => {
    const wasWon = condition === 'won';
    Object.assign(state.deal, { stageId: wasWon ? 'Won' : 'Lost', stage: stage(wasWon ? 'Won' : 'Lost', wasWon, !wasWon),
      hasEverBeenWon: condition === 'won' || condition === 'lost-after-won', wonHistoryVerified: condition !== 'uncertain',
      closingSnapshot: { signed: 'historical' }, wonConfirmedAt: wasWon ? new Date() : null });
    if (condition === 'lost-to-lead') state.next = stage('Lead');
    await expect(move()).rejects.toThrow(/won|history|only be reopened/i);
    expect(state.tx.deal.update).not.toHaveBeenCalled();
    expect(state.tx.dealStageHistory.create).not.toHaveBeenCalled();
    expect(state.deal.closingSnapshot).toEqual({ signed: 'historical' });
  });
  it('checks unbounded historical Won evidence within the tenant', async () => {
    state.legacyWon = true;
    Object.assign(state.deal, { stageId: 'Lost', stage: stage('Lost', false, true) });
    await expect(move()).rejects.toThrow('previously been won');
    expect(state.tx.dealStageHistory.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'tenant', dealId: 'deal', OR: [{ newStage: { isWon: true } }, { previousStage: { isWon: true } }] }, select: { id: true } });
  });
  it('persists the lifetime Won outcome in the same transaction as evidence and stage history', async () => {
    state.next = stage('Won', true);
    await move();
    expect(state.deal).toMatchObject({ hasEverBeenWon: true, wonHistoryVerified: true, wonConfirmedById: 'actor', closingSnapshot: { fields: [], values: { signed: true } } });
    expect(state.tx.dealStageHistory.create).toHaveBeenCalledOnce();
  });
  it('uses confirmed or monotonic Won evidence even when old stage history is unavailable', async () => {
    state.deal.wonConfirmedAt = new Date();
    expect(await dealHasEverBeenWon(state.tx as never, 'tenant', state.deal as never)).toBe(true);
    expect(state.tx.dealStageHistory.findFirst).not.toHaveBeenCalled();
  });
});
