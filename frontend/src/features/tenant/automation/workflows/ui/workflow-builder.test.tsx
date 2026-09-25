import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WORKFLOW_TRIGGERS, getAvailableActions, type WorkflowDraft } from '@leadcrm/shared';
import WorkflowBuilder from './visual-workflow-builder';
import { workflowsApi } from '@/shared/services/workflows.api';
vi.mock('@/shared/services/workflows.api', () => ({ workflowsApi: { validate: vi.fn() } }));
afterEach(() => {cleanup();vi.clearAllMocks();});
const initial:WorkflowDraft = {name:'Deal follow-up',trigger:'deal.created',isActive:false,
  conditions:{operator:'AND',conditions:[{field:'deal.value',operator:'greater_than',value:1000}]},
  actions:[{type:'create_task',config:{title:'Call owner'}}]};
function setup(options:{save?:(draft:WorkflowDraft)=>Promise<void>;readOnly?:boolean;canActivate?:boolean;initial?:WorkflowDraft}={}) {
  const save=options.save ?? vi.fn().mockResolvedValue(undefined),close=vi.fn();
  render(<WorkflowBuilder initial={options.initial ?? structuredClone(initial)} triggers={WORKFLOW_TRIGGERS} actions={getAvailableActions()} canActivate={options.canActivate ?? true} readOnly={options.readOnly} onSave={save} onClose={close}/>);
  return {save,close};
}
describe('workflow page builder', () => {
  it('opens a new blank workflow without a legacy warning or losing its recipe steps', () => {
    setup({initial:{...initial,name:''}});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Call owner')).toBeTruthy();
  });
  it('keeps unsaved typed condition edits in the drawer until Save step', async () => {
    const {save}=setup();
    const name=screen.getByLabelText('Workflow name');name.focus();fireEvent.change(name,{target:{value:'Updated follow-up'}});expect(document.activeElement).toBe(name);
    fireEvent.click(screen.getByRole('button',{name:/IF/}));
    fireEvent.change(screen.getByLabelText('Condition 1 value'),{target:{value:'25000'}});
    expect(screen.queryByRole('option',{name:'contains'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Save step'}));
    fireEvent.click(screen.getByRole('button',{name:'Save and activate'}));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({name:'Updated follow-up',isActive:true,conditions:{operator:'AND',conditions:[{field:'deal.value',operator:'greater_than',value:25000}]}})));
  });
  it('shows one required name error below the input and does not save', async () => {
    const {save}=setup();fireEvent.change(screen.getByLabelText('Workflow name'),{target:{value:'   '}});
    fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
    expect(screen.getAllByText('Workflow name is required.')).toHaveLength(1);
    expect(screen.getByLabelText('Workflow name').getAttribute('aria-describedby')).toBe('workflow-name-error');expect(save).not.toHaveBeenCalled();
  });
  it('retains the page and server error after an unsuccessful save', async () => {
    const {close}=setup({save:vi.fn().mockRejectedValue(new Error('Choose an active workspace user.'))});
    fireEvent.click(screen.getByRole('button',{name:'Save and activate'}));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Choose an active workspace user.'));expect(close).not.toHaveBeenCalled();
  });
  it('discards cancelled step changes and restores focus to the node', async () => {
    setup();const node=screen.getByRole('button',{name:/THEN/});node.focus();fireEvent.click(node);
    fireEvent.change(screen.getByLabelText(/Task title/),{target:{value:'Unsaved title'}});
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(screen.getByText('Call owner')).toBeTruthy();await waitFor(() => expect(document.activeElement).toBe(node));
  });
  it('validates without invoking persistence or execution', async () => {
    vi.mocked(workflowsApi.validate).mockResolvedValue({success:true,data:{valid:true,message:'Configuration valid. No actions executed.'}});
    const {save,close}=setup();fireEvent.click(screen.getByRole('button',{name:'Validate'}));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No actions executed'));
    expect(save).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
  });
  it('makes details read-only and omits mutation controls', () => {
    setup({readOnly:true});expect(screen.queryByRole('button',{name:'Save draft'})).toBeNull();
    expect((screen.getByLabelText('Workflow name').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:/THEN/}));expect(screen.queryByRole('button',{name:'Save step'})).toBeNull();
  });
  it('opens legacy definitions for explicit repair without exposing raw config', () => {
    const {save}=setup({initial:{...initial,actions:[{type:'send_sms',message:'Legacy'}]} as unknown as WorkflowDraft});
    expect(screen.getByRole('alert').textContent).toContain('older configuration');expect(screen.queryByText('send_sms')).toBeNull();expect(save).not.toHaveBeenCalled();
  });
});
