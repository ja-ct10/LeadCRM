import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { defaultFieldLayout, getAvailableActions, getWorkflowEmailVariableChoices, getWorkflowMessageVariables, workflowMessageVariableKeys, WorkflowDraftSchema, type ClosingField, type WorkflowOptions } from '@leadcrm/shared';
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

it.each(['lead', 'contact'] as const)('email picker exposes only eligible fields belonging to %s', entity => {
  const base: ClosingField = { id: 'field-id', technicalAlias: 'project-code', name: 'Project Code', module: entity === 'lead' ? 'leads' : 'contacts', group: 'Basic Information', type: 'Text', active: true, required: false, visibleInForm: true, visibleInDetails: true, options: [], description: '', order: 0, version: 1 };
  const choices = getWorkflowEmailVariableChoices(entity, undefined, [base, { ...base, id: 'other', name: 'Unrelated Field', module: entity === 'lead' ? 'contacts' : 'leads' }, { ...base, id: 'deal', module: 'deals' }, { ...base, id: 'account', module: 'accounts' }, { ...base, id: 'disabled', active: false }]);
  expect(choices.some(choice => choice.label === 'Project Code')).toBe(true);
  expect(choices.every(choice => choice.category !== 'Sender' && choice.origins.every(origin => origin.module === base.module))).toBe(true);
  expect(choices.some(choice => choice.label === 'Unrelated Field')).toBe(false);
});

it.each(['subject', 'body'] as const)('inserts an email variable at the %s selection and restores the caret', async field => {
  const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [] };
  const label = field === 'subject' ? 'Subject (overrides template)' : 'Message (overrides template)';
  function Editor() {
    const [config, setConfig] = React.useState({ subject: 'Hello NAME!', body: 'Hello NAME!' });
    return <ActionFields entity="lead" action={{ type: 'send_email', config }} definition={getAvailableActions().find(action => action.type === 'send_email')} options={options} onChange={value => setConfig(value as typeof config)} />;
  }
  render(<Editor />);
  const input = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
  input.focus(); input.setSelectionRange(6, 10);
  fireEvent.click(screen.getByRole('button', { name: `Insert Variable into ${label}` }));
  const picker = screen.getByRole('group', { name: `Variables for ${label}` });
  expect(within(picker).queryByText('Sender')).toBeNull();
  fireEvent.click(within(picker).getByRole('button', { name: /^First Name/ }));
  expect(input.value).toBe('Hello {{firstName}}!');
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(19);
  expect(input.selectionEnd).toBe(19);
});

it('keeps unsupported variable errors inline and discards legacy sender settings', () => {
  render(<ActionFields entity="lead" action={{ type: 'send_email', config: { subject: '{{unavailable}}' } }} definition={getAvailableActions().find(action => action.type === 'send_email')} options={{ users: [], templates: [], campaigns: [], pipelines: [] }} onChange={vi.fn()} />);
  expect(screen.getByRole('alert').textContent).toContain('{{unavailable}}');
  expect(screen.getByLabelText('Subject (overrides template)').getAttribute('aria-invalid')).toBe('true');
  expect(screen.queryByLabelText('Connected Gmail sender')).toBeNull();
  expect(WorkflowDraftSchema.parse({ name: 'Legacy', trigger: 'lead.created', actions: [{ type: 'send_email', config: { subject: 'Hello', body: 'Message', senderUserId: 'legacy' } }] }).actions[0].config).toEqual({ subject: 'Hello', body: 'Message' });
});
