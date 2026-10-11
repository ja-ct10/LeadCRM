import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CUSTOM_FIELD_MODULES, campaignApprovedVariableKeys, campaignVariableChoices, getCrmFieldCatalog, type ClosingField } from '@leadcrm/shared';
import { CampaignVariablePicker } from '../campaign-variable-picker';

afterEach(cleanup);
const definitions = CUSTOM_FIELD_MODULES.map((module, index): ClosingField => ({ id: `definition-${index}`, version: 1, module, name: module === 'leads' ? 'Customer Age' : 'Age', technicalAlias: 'age', type: 'Number', active: true, required: false, description: '', visibleInForm: true, visibleInDetails: true, group: 'Basic Information', order: 0, options: [] }));
const fields = CUSTOM_FIELD_MODULES.flatMap(module => getCrmFieldCatalog(module, definitions));
it.each(['missing', 'deleted'])('does not display custom fields with %s definitions', state => {
  const configured = state === 'missing' ? [] : definitions.map(field => ({ ...field, active: false, deletedAt: '2026-10-11T00:00:00.000Z' }));
  const catalog = CUSTOM_FIELD_MODULES.flatMap(module => getCrmFieldCatalog(module, configured));
  const choices = campaignVariableChoices(catalog, 'LEADS');
  render(<CampaignVariablePicker choices={choices} onInsert={vi.fn()} />);
  expect(choices.filter(choice => choice.category === 'Custom Fields')).toEqual([]);
  expect(screen.queryByRole('button', { name: /customFieldValues/ })).toBeNull();
  expect(screen.getByText('Custom Fields')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Sender Name/ })).toBeTruthy();
});
it('renders exactly three categories with all four origins, immutable aliases and no new legacy choices', () => {
  render(<CampaignVariablePicker choices={campaignVariableChoices(fields, 'LEADS')} onInsert={vi.fn()} />);
  expect([...document.querySelectorAll('p')].map(node => node.textContent)).toEqual(['Standard Fields', 'Custom Fields', 'Sender']);
  expect(screen.queryByText('Existing aliases')).toBeNull();
  expect(screen.queryByText('{{first_name}}')).toBeNull();
  expect(screen.getAllByText('{{firstName}}')).toHaveLength(1);
  const ageChoices = screen.getAllByRole('button', { name: /Age.*customFieldValues.age/ }) as HTMLButtonElement[];
  expect(ageChoices).toHaveLength(4);
  expect(ageChoices.filter(button => !button.disabled)).toHaveLength(1);
  expect(ageChoices.find(button => !button.disabled)?.textContent).toContain('Customer Age');
  expect(screen.getByRole('button', { name: /Deal Value.*value/ }).getAttribute('disabled')).toBe('');
});
it.each(['firstName', 'Customer Age', 'sender', 'Custom Fields', 'Deals'])('searches labels, keys, classification and module metadata for %s', search => {
  render(<CampaignVariablePicker choices={campaignVariableChoices(fields, 'LEADS')} onInsert={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Search variables'), { target: { value: search } });
  expect(document.querySelectorAll('p')).toHaveLength(3);
  expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  if (search === 'sender') expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Sender Name{{sender_name}}', 'Sender Email{{sender_email}}']);
});
it('inserts the displayed key and keeps different company keys and definition identities distinct', () => {
  const onInsert = vi.fn(), choices = campaignVariableChoices(fields, 'CONTACTS');
  render(<CampaignVariablePicker choices={choices} onInsert={onInsert} />);
  fireEvent.click(screen.getByRole('button', { name: /Company Name.*\{\{company\}\}.*Contacts/ }));
  expect(onInsert).toHaveBeenLastCalledWith('{{company}}');
  fireEvent.click(screen.getByRole('button', { name: /Age.*customFieldValues.age.*Contacts/ }));
  expect(onInsert).toHaveBeenLastCalledWith('{{customFieldValues.age}}');
  expect(choices.filter(choice => choice.technicalKey === 'customFieldValues.age').map(choice => choice.origins[0].customFieldId)).toEqual(definitions.map(field => field.id));
});
it('does not allow legacy aliases to bypass hidden, inactive or unsupported fields', () => {
  const catalog = getCrmFieldCatalog('leads', definitions).map(field => ['phone', 'status'].includes(field.technicalKey) ? { ...field, visibleInForm: false, visibleInDetails: false } : field.customFieldId ? { ...field, active: false } : field);
  const approved = campaignApprovedVariableKeys(catalog);
  expect(approved.has('firstName')).toBe(true); expect(approved.has('first_name')).toBe(true);
  for (const token of ['phone', 'contact_number', 'status', 'customFieldValues.age', 'value', 'customFieldValues.definition-0']) expect(approved.has(token)).toBe(false);
});
