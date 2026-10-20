import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Deal, Pipeline } from '@/store/types';
import { PipelineKanbanBoard } from './pipeline-kanban-board';
vi.mock('@/features/tenant/notifications/hooks/use-record-notifications', () => ({ UnreadRecordDot: () => null }));

vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/shared/components/crm/deal-card-menu', () => ({ DealCardMenu: () => <button>Deal actions</button> }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const pipeline = { id: 'sales', name: 'Sales Pipeline', stages: [
  { id: 'lead', name: 'Lead', order: 1 }, { id: 'contacted', name: 'Contacted', order: 2 },
  { id: 'q', name: 'Qualified', order: 3 }, { id: 'won', name: 'Closed Deal', order: 4, isWon: true },
  { id: 'lost', name: 'Cancelled', order: 5, isLost: true }, { id: 'review', name: 'Review', order: 6 },
] } as Pipeline;
const agent = { id: 'agent', firstName: 'Julie Ann', lastName: 'Tiron' };
const deal = { id: 'deal', title: 'Opportunity', pipelineId: 'sales', stageId: 'q', value: 37000, priority: 'Medium',
  createdAt: '2026-10-01T00:00:00Z', expectedCloseDate: '2026-10-20T00:00:00Z', assignedUserId: 'agent' } as Deal;
function card(row: Deal) {
  return <PipelineKanbanBoard pipeline={pipeline} deals={[row]} users={[]} canEdit={false} canDelete={false}
    onDealClick={vi.fn()} onDealDragEnd={vi.fn()} onAddDeal={vi.fn()} onLoadMore={vi.fn()}
    loadingStages={new Set()} hasMoreByStage={{}} />;
}

it('shows the full close date and assigned Agent on the same footer row, retaining actions', () => {
  render(card({ ...deal, assignedUser: agent }));
  const date = screen.getByTitle('Expected Close Date');
  const assigned = screen.getByTitle('Assigned to Julie Ann Tiron');
  expect(date.textContent).toBe('Oct 20, 2026');
  expect(assigned.textContent).toBe('Julie Ann Tiron');
  expect(date.parentElement).toBe(assigned.parentElement);
  expect(assigned.querySelector('.lucide-user')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Deal actions' })).toBeTruthy();
});

it.each([undefined, '', 'invalid'])('shows an em dash for unavailable close date %s and an Unassigned label', expectedCloseDate => {
  render(card({ ...deal, expectedCloseDate, assignedUserId: undefined }));
  expect(screen.getByTitle('Expected Close Date').textContent).toBe('—');
  expect(screen.getByTitle('Unassigned').textContent).toBe('Unassigned');
});

it('retains the full long Agent name as a tooltip and constrains its visible text', () => {
  const assignedUser = { ...agent, lastName: 'A very long assigned Agent family name' };
  render(card({ ...deal, assignedUser }));
  const assigned = screen.getByTitle(`Assigned to ${assignedUser.firstName} ${assignedUser.lastName}`);
  expect(assigned.querySelector('span')?.className).toContain('truncate');
  expect(assigned.className).toContain('min-w-0');
  expect(screen.getByTitle('Expected Close Date').className).toContain('shrink-0');
});

it.each(['lead', 'contacted', 'won', 'lost', 'review'])('hides Expected Close Date in %s while keeping the Agent', stageId => {
  render(card({ ...deal, stageId, assignedUser: agent }));
  expect(screen.queryByTitle('Expected Close Date')).toBeNull();
  expect(screen.queryByText('Oct 20, 2026')).toBeNull();
  expect(screen.getByTitle('Assigned to Julie Ann Tiron').textContent).toBe('Julie Ann Tiron');
});

it('shows and hides the date after entering and leaving the configured Qualified stage', () => {
  const view = render(card({ ...deal, stageId: 'lead', assignedUser: agent }));
  expect(screen.queryByTitle('Expected Close Date')).toBeNull();
  view.rerender(card({ ...deal, assignedUser: agent }));
  expect(screen.getByTitle('Expected Close Date').textContent).toBe('Oct 20, 2026');
  view.rerender(card({ ...deal, stageId: 'contacted', assignedUser: agent }));
  expect(screen.queryByTitle('Expected Close Date')).toBeNull();
  expect(screen.getByTitle('Assigned to Julie Ann Tiron')).toBeTruthy();
});
