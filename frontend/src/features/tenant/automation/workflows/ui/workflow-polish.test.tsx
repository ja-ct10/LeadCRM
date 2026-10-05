import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getAvailableActions, WORKFLOW_TRIGGERS, type WorkflowAction, type WorkflowEntity } from '@leadcrm/shared';
import { ActionFields, ConditionFields } from './workflow-fields';
import { duplicateWorkflowName, workflowNameIssue } from '../services/workflow-editor';
import { prepareWorkflowRecipe, WORKFLOW_RECIPES, QUALIFIED_FOLLOW_UP_NAME } from '../services/workflow-recipes';
const options = { users: [], pipelines: [], templates: [], campaigns: [], productInterests: [{ id: 'others', name: 'Others' }] };
afterEach(cleanup);
function Editor({ entity, config }: { entity: WorkflowEntity; config: Record<string, unknown> }) {
  const [action, setAction] = useState<WorkflowAction>({ type: 'update_field', config });
  return <><ActionFields action={action} entity={entity} options={options} onChange={config => setAction({ ...action, config })} /><output data-testid="config">{JSON.stringify(action.config)}</output></>;
}
describe('workflow polish controls', () => {
  it('hides the value control for empty Product Interest and keeps Others a real selection', () => {
    const onChange = vi.fn();
    const trigger = WORKFLOW_TRIGGERS.find(t => t.type === 'lead.updated');
    const view = render(<ConditionFields options={options} trigger={trigger} value={{ operator: 'AND', conditions: [{ field: 'lead.productInterest', operator: 'is_empty', value: null }] }} onChange={onChange} />);
    expect(screen.queryByLabelText('Condition 1 value')).toBeNull();
    view.rerender(<ConditionFields options={options} trigger={trigger} value={{ operator: 'AND', conditions: [{ field: 'lead.productInterest', operator: 'contains', value: 'Others' }] }} onChange={onChange} />);
    expect((screen.getByLabelText('Condition 1 value') as HTMLSelectElement).value).toBe('Others');
  });
  it('keeps historical Deal Product, value and currency out of update actions', () => {
    render(<Editor entity="deal" config={{ field: '', value: '' }} />);
    expect(screen.queryByRole('option', { name: 'Deal Value' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Product Interest' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Currency' })).toBeNull();
    expect(WORKFLOW_TRIGGERS.find(t => t.type === 'deal.updated')?.fields.some(f => f.field === 'deal.value')).toBe(true);
  });
  it('allows optional Others details and requires an explicit clear choice', () => {
    render(<Editor entity="lead" config={{ field: 'productInterest', value: [] }} />);
    fireEvent.click(screen.getByLabelText('Others'));
    fireEvent.change(screen.getByLabelText('Specify (optional)'), { target: { value: 'Consulting' } });
    expect(JSON.parse(screen.getByTestId('config').textContent!)).toMatchObject({ value: ['others'], otherDetails: 'Consulting' });
    fireEvent.click(screen.getByLabelText('Others'));
    expect(JSON.parse(screen.getByTestId('config').textContent!)).toMatchObject({ value: [], otherDetails: '' });
    fireEvent.click(screen.getByLabelText('Clear this field'));
    expect(JSON.parse(screen.getByTestId('config').textContent!).clear).toBe(true);
  });
  it('keeps retired steps readable and excludes them from the action picker', () => {
    render(<ActionFields action={{ type: 'create_notification', config: { title: 'Existing' } }} options={options} entity="lead" onChange={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('Notifications are automatic');
    expect(getAvailableActions().map(a => a.type)).toContain('send_sms');
    expect(getAvailableActions().map(a => a.type)).not.toContain('send_campaign');
  });
  it('checks normalized names and finds an unused duplicate name', () => {
    expect(workflowNameIssue('  Follow   UP ', [{ id: '1', name: 'follow up' }])).toContain('already exists');
    expect(workflowNameIssue('Follow Up', [{ id: '1', name: 'follow up' }], '1')).toBe('');
    expect(duplicateWorkflowName('Follow Up', [{ name: 'follow up (copy)' }])).toBe('Follow Up (Copy 2)');
  });
  it('requires a real Qualified stage and verified never-won history in the recipe', () => {
    const recipe = WORKFLOW_RECIPES.find(r => r.name === QUALIFIED_FOLLOW_UP_NAME)!;
    const draft = prepareWorkflowRecipe(recipe, { ...options, pipelines: [{ id: 'p', name: 'Sales', stages: [{ id: 'q', name: 'Qualified' }] }] });
    expect(draft.trigger).toBe('deal.stage_changed');
    expect(draft.conditions).toMatchObject({ operator: 'AND', conditions: expect.arrayContaining([
      { field: 'event.newStageId', operator: 'equals', value: 'q' },
      { field: 'deal.hasEverBeenWon', operator: 'equals', value: false },
      { field: 'deal.wonHistoryVerified', operator: 'equals', value: true },
    ]) });
    expect(recipe.conditions?.conditions[0].value).toBe('');
  });
});
