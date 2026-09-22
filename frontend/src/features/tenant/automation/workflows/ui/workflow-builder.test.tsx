import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WORKFLOW_TRIGGERS, getAvailableActions, type WorkflowDraft } from '@leadcrm/shared';
import WorkflowBuilder from './visual-workflow-builder';

vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [], pipelines: [], templates: [] }) }));
vi.mock('@/features/tenant/marketing/campaigns/hooks/use-campaigns-data', () => ({ useCampaignsData: () => ({ templates: [], error: null }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
afterEach(cleanup);
const initial: WorkflowDraft = { name: 'Deal follow-up', trigger: 'deal.created', isActive: false,
  conditions: { operator: 'AND', conditions: [{ field: 'deal.value', operator: 'greater_than', value: 1000 }] },
  actions: [{ type: 'create_task', config: { title: 'Call owner' } }] };
function setup(options: { save?: (draft: WorkflowDraft) => Promise<void>; readOnly?: boolean; canActivate?: boolean } = {}) {
  const save = options.save ?? vi.fn().mockResolvedValue(undefined);
  const close = vi.fn();
  render(<WorkflowBuilder initial={structuredClone(initial)} triggers={WORKFLOW_TRIGGERS} actions={getAvailableActions()}
    canActivate={options.canActivate ?? true} readOnly={options.readOnly} onSave={save} onClose={close} />);
  return { save, close };
}
describe('guided workflow builder', () => {
  it('opens legacy definitions safely without saving or silently retaining unsupported actions', () => {
    const save = vi.fn();
    const legacy = { ...initial, actions: [{ type: 'send_sms', message: 'Legacy message' }] } as unknown as WorkflowDraft;
    render(<WorkflowBuilder initial={legacy} triggers={WORKFLOW_TRIGGERS} actions={getAvailableActions()}
      canActivate onSave={save} onClose={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('older configuration');
    expect(screen.queryByLabelText('Action 1 type')).toBeNull();
    expect(screen.getByText(/"send_sms"/).textContent).toContain('Legacy message');
    expect(save).not.toHaveBeenCalled();
  });
  it('preserves focus during editing and submits typed numeric conditions with an explicit activation state', async () => {
    const { save, close } = setup();
    const name = screen.getByLabelText('Workflow name'); name.focus();
    fireEvent.change(name, { target: { value: 'Updated follow-up' } });
    expect(document.activeElement).toBe(name);
    fireEvent.change(screen.getByLabelText('Condition 1 value'), { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and activate' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated follow-up', isActive: true,
      conditions: { operator: 'AND', conditions: [{ field: 'deal.value', operator: 'greater_than', value: 25000 }] } }));
  });
  it('keeps server validation errors visible without closing or reporting success', async () => {
    const { close } = setup({ save: vi.fn().mockRejectedValue(new Error('Choose an active workspace user.')) });
    fireEvent.click(screen.getByRole('button', { name: 'Save and activate' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Choose an active workspace user.'));
    expect(close).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Save and activate' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('saves drafts paused and removes actions that are incompatible with a new trigger entity', async () => {
    const { save } = setup({ canActivate: false });
    expect(screen.queryByRole('button', { name: 'Save and activate' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Action 1 type'), { target: { value: 'move_deal_stage' } });
    fireEvent.change(screen.getByLabelText('Trigger'), { target: { value: 'lead.created' } });
    expect(screen.queryByLabelText('Action 1 type')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'lead.created', isActive: false, actions: [] })));
  });
  it('makes details read-only and retains a keyboard exit', () => {
    setup({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect((screen.getByLabelText('Workflow name').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    const exit = screen.getByRole('button', { name: 'Close' });
    exit.focus(); fireEvent.keyDown(exit, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));
  });
});
