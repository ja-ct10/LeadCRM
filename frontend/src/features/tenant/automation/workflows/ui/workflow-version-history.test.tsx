import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WorkflowVersionHistory } from './workflow-version-history';
import { workflowsApi } from '@/shared/services/workflows.api';
import { toast } from '@/shared/utils/toast';

vi.mock('@/shared/services/workflows.api', () => ({ workflowsApi: { versions: vi.fn() } }));
vi.mock('@/shared/utils/toast', () => ({ toast: { success: vi.fn() } }));
beforeEach(() => {
  vi.mocked(workflowsApi.versions).mockResolvedValue({ success: true, data: [{ version: 1, createdAt: '2026-10-01T00:00:00Z', activatedById: null,
    definition: { name: 'Follow up', trigger: 'deal.created', isActive: false, actions: [] } }] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('keeps a failed restore confirmation open for retry and announces one successful restore', async () => {
  const restore = vi.fn().mockRejectedValueOnce(new Error('Client Admin cannot be assigned by workflows. Choose another role.')).mockResolvedValue(undefined);
  render(<WorkflowVersionHistory workflowId="wf" dirty={false} onRestore={restore} />);
  fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore into draft' }));
  const confirmation = screen.getByRole('alertdialog');
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Restore draft' }));
  expect(await within(confirmation).findByRole('alert')).toHaveProperty('textContent', 'Client Admin cannot be assigned by workflows. Choose another role.');
  expect(toast.success).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Restore draft' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledExactlyOnceWith('Version restored to draft.'));
  expect(restore).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('does not report an empty history when the history request fails', async () => {
  vi.mocked(workflowsApi.versions).mockRejectedValue(new Error('Unable to load versions.'));
  render(<WorkflowVersionHistory workflowId="wf" dirty={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to load versions.');
  expect(screen.queryByText('No published versions yet.')).toBeNull();
});
