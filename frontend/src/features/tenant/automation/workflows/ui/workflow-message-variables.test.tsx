import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { defaultFieldLayout, getAvailableActions, getWorkflowMessageVariables, type WorkflowOptions } from '@leadcrm/shared';
import { ActionFields } from './workflow-fields';
afterEach(cleanup);
const definition = getAvailableActions().find(action => action.type === 'create_task');
it.each(['lead', 'contact'] as const)('keeps four catalog shortcuts and inserts entity-specific keys for %s', entity => {
  const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [] }, onChange = vi.fn();
  render(<ActionFields entity={entity} action={{ type: 'create_task', config: { title: 'Follow up with ' } }} definition={definition} options={options} onChange={onChange} />);
  const shortcuts = within(screen.getByLabelText('Personalize Task title'));
  expect(shortcuts.getAllByRole('button').map(button => button.textContent)).toEqual(['First Name', 'Last Name', 'Email', 'Company Name']);
  for (const [label, token] of [['First Name', 'firstName'], ['Last Name', 'lastName'], ['Email', 'email'], ['Company Name', entity === 'lead' ? 'companyName' : 'company']]) {
    fireEvent.click(shortcuts.getByRole('button', { name: label }));
    expect(onChange).toHaveBeenLastCalledWith({ title: `Follow up with {{${token}}}` });
  }
});
it('uses configured labels and does not add unrelated Account, Deal or custom shortcuts', () => {
  const layout = defaultFieldLayout('leads');
  layout.fields.firstName = { label: 'Customer First Name', groupId: 'leads:section:0', order: 0, visibleInForm: true, visibleInDetails: true };
  expect(getWorkflowMessageVariables('lead', layout).map(variable => variable.label)).toContain('Customer First Name');
  expect(getWorkflowMessageVariables('account')).toEqual([]);
  expect(getWorkflowMessageVariables('deal')).toEqual([]);
});
