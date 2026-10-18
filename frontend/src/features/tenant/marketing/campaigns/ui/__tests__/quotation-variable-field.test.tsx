import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QuotationVariableField } from '../quotation-variable-field';
import { campaignVariableTriggerClassName } from '../campaign-variable-picker';
afterEach(cleanup);
it.each(['Header / Company Information', 'Introduction / Message', 'Footer / Terms'])('uses the existing picker and restores the insertion caret in %s', async label => {
  const change = vi.fn();
  function Field() {
    const [value, setValue] = React.useState('Hello customer!');
    return <QuotationVariableField id="notes" label={label} value={value} onChange={next => { change(next); setValue(next); }} choices={[{ id: 'firstName', technicalKey: 'firstName', label: 'First Name', category: 'Recipient (Lead / Contact)', origins: [], personalizationAvailable: true }]} />;
  }
  const view = render(<Field />);
  const input = screen.getByLabelText(label) as HTMLTextAreaElement;
  input.focus(); input.setSelectionRange(6, 14);
  const trigger = screen.getByRole('button', { name: `Insert Variable into ${label}` });
  expect(trigger.className).toBe(campaignVariableTriggerClassName);
  expect(trigger.querySelector('svg')?.getAttribute('width')).toBe('14');
  fireEvent.click(trigger);
  expect(screen.getByLabelText('Search variables')).toBeTruthy();
  expect(view.container.contains(screen.getByRole('group', { name: `Variables for ${label}` }))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /First Name/ }));
  expect(change).toHaveBeenCalledWith('Hello {{firstName}}!');
  expect(input.value).toBe('Hello {{firstName}}!');
  expect(screen.queryByLabelText('Search variables')).toBeNull();
  await waitFor(() => { expect(document.activeElement).toBe(input); expect(input.selectionStart).toBe(19); expect(input.selectionEnd).toBe(19); });
});

it('focuses quotation search, tabs through available variables and restores trigger focus on Escape', async () => {
  render(<QuotationVariableField id="notes" label="Notes" value="" onChange={vi.fn()} choices={[{ id: 'organizationName', technicalKey: 'organizationName', label: 'Organization Name', category: 'Organization', origins: [], personalizationAvailable: true }]} />);
  const trigger = screen.getByRole('button', { name: 'Insert Variable into Notes' });
  trigger.focus(); fireEvent.keyDown(trigger, { key: 'Enter' });
  const search = screen.getByLabelText('Search variables');
  await waitFor(() => expect(document.activeElement).toBe(search));
  fireEvent.change(search, { target: { value: 'organizationName' } });
  const picker = screen.getByRole('group', { name: 'Variables for Notes' });
  const item = within(picker).getByRole('button', { name: /Organization Name/ });
  fireEvent.keyDown(search, { key: 'Tab' }); expect(document.activeElement).toBe(item);
  fireEvent.keyDown(item, { key: 'Escape' });
  expect(screen.queryByLabelText('Search variables')).toBeNull(); expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger); fireEvent.mouseDown(screen.getByLabelText('Notes'));
  expect(screen.queryByLabelText('Search variables')).toBeNull();
});
