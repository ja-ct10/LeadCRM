import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { defaultFieldLayout, getAvailableActions, getWorkflowEmailVariableChoices, getWorkflowMessageVariables, workflowMessageVariableKeys, WorkflowDraftSchema, SMS_DEFAULT_FOOTER, type ClosingField, type WorkflowOptions } from '@leadcrm/shared';
import { actionIssues } from '../services/workflow-editor';
import { ActionFields } from './workflow-fields';
afterEach(cleanup);
const definition = getAvailableActions().find(action => action.type === 'send_sms');
it('offers editable footer insertion for SMS actions without adding it to email actions', () => {
  const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [] };
  const change = vi.fn();
  const view = render(<ActionFields entity="lead" action={{ type: 'send_sms', config: { message: 'My message' } }} definition={definition} options={options} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Insert default SMS footer' }));
  expect(change).toHaveBeenCalledWith({ message: `My message\n\n${SMS_DEFAULT_FOOTER}` });
  view.rerender(<ActionFields entity="lead" action={{ type: 'send_email', config: {} }} definition={getAvailableActions().find(action => action.type === 'send_email')} options={options} onChange={change} />);
  expect(screen.queryByRole('button', { name: 'Insert default SMS footer' })).toBeNull();
});
it.each(['lead', 'contact'] as const)('reuses the Campaign variable picker and selection insertion for %s SMS', entity => {
  const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [] };
  function Editor() {
    const [config, setConfig] = React.useState({ recipient: 'record', message: 'Hi NAME!' });
    return <ActionFields entity={entity} action={{ type: 'send_sms', config }} definition={definition} options={options} onChange={value => setConfig(value as typeof config)} />;
  }
  render(<Editor />);
  const input = screen.getByLabelText('SMS message') as HTMLTextAreaElement;
  input.focus(); input.setSelectionRange(3, 7);
  fireEvent.click(screen.getByRole('button', { name: 'Insert Variable into SMS message' }));
  const picker = within(screen.getByRole('group', { name: 'Variables for SMS message' }));
  for (const category of ['Standard Fields', 'Custom Fields', 'Sender']) expect(picker.getByText(category)).toBeTruthy();
  fireEvent.change(picker.getByRole('textbox', { name: 'Search variables' }), { target: { value: 'firstName' } });
  fireEvent.click(picker.getByRole('button', { name: /^First Name/ }));
  expect(input.value).toBe('Hi {{firstName}}!');
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
  render(<ActionFields entity="lead" action={{ type: 'send_sms', config: { recipient: 'record', message: '' } }} definition={definition} options={options} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Insert Variable into SMS message' }));
  fireEvent.click(screen.getByRole('button', { name: /^Project Code/ }));
  expect(onChange).toHaveBeenCalledWith({ recipient: 'record', message: '{{customFieldValues.project-code}}' });
  const keys = workflowMessageVariableKeys('lead', [field]);
  for (const key of ['first_name', 'last_name', 'company_name', 'contact_number', 'firstName', 'companyName', 'customFieldValues.project-code', 'customFieldValues.field-id']) expect(keys.has(key)).toBe(true);
  expect(actionIssues({ type: 'send_sms', config: { recipient: 'record', message: '{{first_name}} {{company_name}} {{customFieldValues.project-code}}' } }, definition, 'lead', options)).toEqual([]);
  expect(actionIssues({ type: 'send_sms', config: { recipient: 'record', message: '{{missingKey}}' } }, definition, 'lead', options).join(' ')).toContain('{{missingKey}}');
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
