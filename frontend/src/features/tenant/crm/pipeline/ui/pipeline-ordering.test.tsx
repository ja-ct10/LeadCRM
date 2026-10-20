import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { DndContext, DragCancelEvent, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { Deal, Pipeline } from '@/store/types';
import { toFrontendDeal } from '@/lib/api/adapters/deal.adapter';
import { PipelineKanbanBoard } from './pipeline-kanban-board';
vi.mock('@/features/tenant/notifications/hooks/use-record-notifications', () => ({ UnreadRecordDot: () => null }));

const dnd = vi.hoisted(() => ({ props: {} as React.ComponentProps<typeof DndContext> }));
vi.mock('@dnd-kit/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return { ...actual, DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
    dnd.props = props;
    return <actual.DndContext {...props} />;
  } };
});
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/shared/components/crm/deal-card-menu', () => ({ DealCardMenu: () => null }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const pipeline = { id: 'sales', name: 'Sales', stages: [
  { id: 'lead', name: 'Lead', order: 0 }, { id: 'qualified', name: 'Qualified', order: 1 },
] } as Pipeline;
const row = (id: string, createdAt: string, lastStageChangeDate?: string, stageId = 'qualified'): Deal =>
  toFrontendDeal({ id, title: id, createdAt, lastStageChangeDate, pipelineId: 'sales', stageId });
const board = (deals: Deal[], onDealDragEnd = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)) =>
  <PipelineKanbanBoard pipeline={pipeline} deals={deals} users={[]} canEdit canDelete={false}
    onDealClick={vi.fn()} onDealDragEnd={onDealDragEnd} onAddDeal={vi.fn()} onLoadMore={vi.fn()}
    loadingStages={new Set()} hasMoreByStage={{}} />;
const order = (stage = 'Qualified') => Array.from(
  screen.getByRole('heading', { name: stage }).closest('.rounded-2xl')!.querySelectorAll('[data-deal-id]'),
  card => card.getAttribute('data-deal-id'),
);
function preview(id: string, stageId: string) {
  act(() => dnd.props.onDragStart?.({ active: { id } } as DragStartEvent));
  act(() => dnd.props.onDragOver?.({ active: { id }, over: { id: stageId } } as DragOverEvent));
}
const drop = (id: string, stageId: string) => act(() => dnd.props.onDragEnd?.({ active: { id }, over: { id: stageId } } as DragEndEvent));

it('sorts by movement or creation with stable ID ties without mutating incoming rows', () => {
  const deals = [
    row('old-unmoved', '2020-01-01T00:00:00Z'),
    row('z-tied', '2026-10-19T00:00:00Z'),
    row('older-moved', '2000-01-01T00:00:00Z', '2026-10-20T00:00:00Z'),
    row('new-unmoved', '2026-10-19T12:00:00Z'),
    row('a-tied', '2001-01-01T00:00:00Z', '2026-10-19T00:00:00Z'),
    row('other-stage', '2099-01-01T00:00:00Z', undefined, 'lead'),
  ];
  const before = structuredClone(deals);
  deals.forEach(Object.freeze); Object.freeze(deals);
  render(board(deals));
  expect(order()).toEqual(['older-moved', 'new-unmoved', 'a-tied', 'z-tied', 'old-unmoved']);
  expect(order('Lead')).toEqual(['other-stage']);
  expect(deals).toEqual(before);
});

it('puts a drag preview first and keeps the confirmed server order after the save', async () => {
  const deals = [row('resident', '2026-10-19T00:00:00Z'), row('moving', '2000-01-01T00:00:00Z', undefined, 'lead')];
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const view = render(board(deals, save));
  preview('moving', 'qualified');
  expect(order()).toEqual(['moving', 'resident']);
  drop('moving', 'qualified');
  expect(save).toHaveBeenCalledExactlyOnceWith('moving', 'qualified');
  expect(order()).toEqual(['moving', 'resident']);
  const confirmed = [deals[0], { ...deals[1], stageId: 'qualified', lastStageChangeDate: '2026-10-20T00:00:00Z' }];
  view.rerender(board(confirmed, save));
  await act(async () => finish());
  expect(order()).toEqual(['moving', 'resident']);
  expect(order('Lead')).toEqual([]);
  expect(deals[1].stageId).toBe('lead');
  expect(deals[1].createdAt).toBe('2000-01-01T00:00:00Z');
});

it('restores source ordering after a cancelled preview or a rejected stage move', async () => {
  const deals = [row('resident', '2026-10-19T00:00:00Z'), row('moving', '2000-01-01T00:00:00Z', undefined, 'lead'),
    row('source-newer', '2026-10-18T00:00:00Z', undefined, 'lead')];
  let reject!: (reason: Error) => void;
  const save = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  render(board(deals, save));
  preview('moving', 'qualified');
  act(() => dnd.props.onDragCancel?.({ active: { id: 'moving' } } as DragCancelEvent));
  expect(order()).toEqual(['resident']);
  expect(order('Lead')).toEqual(['source-newer', 'moving']);
  expect(save).not.toHaveBeenCalled();
  preview('moving', 'qualified');
  drop('moving', 'qualified');
  expect(order()).toEqual(['moving', 'resident']);
  await act(async () => reject(new Error('Stage move rejected')));
  expect(order()).toEqual(['resident']);
  expect(order('Lead')).toEqual(['source-newer', 'moving']);
});

it('keeps a same-stage drop in timestamp order without saving a movement', () => {
  const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  render(board([row('older', '2020-01-01T00:00:00Z'), row('newer', '2026-10-19T00:00:00Z')], save));
  preview('older', 'qualified');
  drop('older', 'qualified');
  expect(order()).toEqual(['newer', 'older']);
  expect(save).not.toHaveBeenCalled();
});
