import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { defaultFieldLayout, getAvailableActions, getWorkflowMessageVariables, workflowMessageVariableKeys, type ClosingField, type WorkflowOptions } from '@leadcrm/shared';
import { actionIssues } from '../services/workflow-editor';
import { ActionFields } from './workflow-fields';
afterEach(cleanup);
const definition = getAvailableActions().find(action => action.type === 'create_task');
it.each(['lead', 'contact'] as const)('inserts canonical person-field shortcuts for %s', entity => {
  const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [] }, onChange = vi.fn();
  render(<ActionFields entity={entity} action={{ type: 'create_task', config: { title: 'Follow up with ' } }} definition={definition} options={options} onChange={onChange} />);
  const shortcuts = within(screen.getByLabelText('Personalize Task title'));
  expect(shortcuts.getAllByRole('button').map(button => button.textContent)).toEqual(expect.arrayContaining(['First Name', 'Last Name', 'Email', 'Company Name']));
  for (const [label, token] of [['First Name', 'firstName'], ['Last Name', 'lastName'], ['Email', 'email'], ['Company Name', entity === 'lead' ? 'companyName' : 'company']]) {
    fireEvent.click(shortcuts.getByRole('button', { name: label }));
    expect(onChange).toHaveBeenLastCalledWith({ title: `Follow up with {{${token}}}` });
  }
});
it('uses configured catalog labels and module-specific technical keys', () => {
  const layout = defaultFieldLayout('leads');
  layout.fields.firstName = { label: 'Customer First Name', groupId: 'leads:section:0', order: 0, visibleInForm: true, visibleInDetails: true };
  expect(getWorkflowMessageVariables('lead', layout).map(variable => variable.label)).toContain('Customer First Name');
  expect(getWorkflowMessageVariables('account').map(variable => variable.token)).toContain('name');
  expect(getWorkflowMessageVariables('deal').map(variable => variable.token)).toContain('title');
});
it('inserts exact custom aliases, accepts canonical IDs and legacy aliases, and names unsupported keys', () => {
  const field: ClosingField = { id: 'field-id', technicalAlias: 'project-code', name: 'Project Code', module: 'leads', group: 'Basic Information', type: 'Text', active: true, required: false, visibleInForm: true, visibleInDetails: true, options: [], description: '', order: 0, version: 1 };
  const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [], customFields: [field] }, onChange = vi.fn();
  render(<ActionFields entity="lead" action={{ type: 'create_task', config: { title: '' } }} definition={definition} options={options} onChange={onChange} />);
  fireEvent.click(within(screen.getByLabelText('Personalize Task title')).getByRole('button', { name: 'Project Code' }));
  expect(onChange).toHaveBeenCalledWith({ title: '{{customFieldValues.project-code}}' });
  const keys = workflowMessageVariableKeys('lead', [field]);
  for (const key of ['first_name', 'last_name', 'company_name', 'contact_number', 'firstName', 'companyName', 'customFieldValues.project-code', 'customFieldValues.field-id']) expect(keys.has(key)).toBe(true);
  expect(actionIssues({ type: 'create_task', config: { title: '{{first_name}} {{company_name}} {{customFieldValues.project-code}}' } }, definition, 'lead', options)).toEqual([]);
  expect(actionIssues({ type: 'create_task', config: { title: '{{missingKey}}' } }, definition, 'lead', options).join(' ')).toContain('{{missingKey}}');
  expect(workflowMessageVariableKeys('lead', [{ ...field, active: false }]).has('customFieldValues.project-code')).toBe(false);
});
