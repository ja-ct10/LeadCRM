import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ get: vi.fn(), updateStage: vi.fn(), reorderStages: vi.fn(), createStage: vi.fn(), deleteStage: vi.fn() }));
vi.mock('@/shared/services/pipelines.api', () => ({ pipelinesApi: api }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
import { PipelineStagesDialog } from './pipeline-stages-dialog';

const stages = [
  { id: 'start', name: 'Lead', order: 0, isDefault: true },
  { id: 'review', name: 'Review', order: 1 },
  { id: 'won', name: 'Won', order: 2, isWon: true },
];
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { stages } });
  api.updateStage.mockResolvedValue({});
  api.reorderStages.mockResolvedValue({});
  api.createStage.mockResolvedValue({});
  api.deleteStage.mockResolvedValue({});
});

it('loads stages and persists rename, reorder and add through the existing service', async () => {
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<PipelineStagesDialog pipelineId="sales" onClose={() => {}} onChanged={changed} />);
  expect(screen.getByRole('status', { name: 'Loading pipeline stages' })).toBeTruthy();
  const name = await screen.findByLabelText('Stage 2');
  fireEvent.change(name, { target: { value: '  Discovery  ' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save name' })[1]);
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(api.updateStage).toHaveBeenCalledWith('review', { name: 'Discovery' });
  fireEvent.click(screen.getByRole('button', { name: 'Move Review up' }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  expect(api.reorderStages).toHaveBeenCalledWith('sales', ['review', 'start', 'won']);
  fireEvent.change(screen.getByLabelText('New stage'), { target: { value: '  Proposal  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add stage' }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
  expect(api.createStage).toHaveBeenCalledWith({ pipelineId: 'sales', name: 'Proposal', order: 3 });
});

it('requires removal confirmation and surfaces server reference constraints', async () => {
  api.deleteStage.mockRejectedValue(new Error('Stage is referenced by existing Deals.'));
  render(<PipelineStagesDialog pipelineId="sales" onClose={() => {}} onChanged={vi.fn()} />);
  const remove = await screen.findByRole('button', { name: 'Remove Review' });
  expect((screen.getByRole('button', { name: 'Remove Lead' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Remove Won' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(remove);
  expect(api.deleteStage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.deleteStage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove stage' }));
  expect((await screen.findByRole('alert')).textContent).toContain('referenced');
  expect(api.deleteStage).toHaveBeenCalledTimes(1);
  expect(api.deleteStage).toHaveBeenCalledWith('review');
});
