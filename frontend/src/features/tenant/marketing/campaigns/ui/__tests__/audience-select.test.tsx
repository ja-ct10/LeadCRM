import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SavedAudience } from '@leadcrm/shared';
import { AudienceSelect } from '../audience-select';

afterEach(cleanup);
const saved = [
  { id: 'custom-1', name: 'Customers', source: 'LEADS', matchMode: 'AND', conditions: [] },
  { id: 'custom-2', name: 'Legacy', source: 'ALL', matchMode: 'AND', conditions: [], repairReason: 'Repair required' },
] as SavedAudience[];
function Picker({ onDelete = vi.fn(), disabled = false }: { onDelete?: (audience: SavedAudience) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  return <><label id="builder-audience-label" htmlFor="builder-audience">Target Audience</label><AudienceSelect value={value} onChange={setValue} audiences={saved} onDelete={onDelete} canDelete disabled={disabled} className="w-full" /></>;
}
it('keeps built-ins free of trash actions and gives custom rows sibling selection/deletion controls', () => {
  const remove = vi.fn(); render(<Picker onDelete={remove} />);
  fireEvent.click(screen.getByLabelText('Target Audience'));
  for (const name of ['All Leads', 'All Contacts']) {
    const option = screen.getByRole('menuitemradio', { name });
    fireEvent.mouseOver(option); option.focus();
    expect(within(option.parentElement!).queryByRole('menuitem')).toBeNull();
  }
  const button = screen.getByRole('menuitem', { name: 'Delete Customers' });
  expect(button.tagName).toBe('BUTTON'); expect(button.getAttribute('type')).toBe('button');
  expect(screen.getByRole('menuitemradio', { name: 'Customers' }).contains(button)).toBe(false);
  fireEvent.click(button);
  expect(remove).toHaveBeenCalledExactlyOnceWith(saved[0]);
  expect(screen.getByLabelText('Target Audience')).toHaveProperty('value', '');
  expect(document.activeElement).toBe(screen.getByLabelText('Target Audience'));
});
it('navigates, type-ahead focuses a choice, selects with Enter and restores focus with Escape', async () => {
  render(<Picker />);
  const trigger = screen.getByLabelText('Target Audience'); trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const first = screen.getByRole('menuitemradio', { name: 'Select an audience' });
  await waitFor(() => expect(document.activeElement).toBe(first));
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'All Leads' }));
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete Legacy' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Home' }); expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'c' });
  const choice = screen.getByRole('menuitemradio', { name: 'Customers' });
  expect(document.activeElement).toBe(choice);
  fireEvent.keyDown(choice, { key: 'Enter' });
  expect(trigger).toHaveProperty('value', 'custom-1'); expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(trigger); fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(document.activeElement).toBe(trigger); expect(screen.queryByRole('menu')).toBeNull();
});
it('keeps legacy choices disabled while allowing their custom definitions to be deleted', () => {
  const remove = vi.fn(); render(<Picker onDelete={remove} />); fireEvent.click(screen.getByLabelText('Target Audience'));
  fireEvent.click(screen.getByRole('menuitemradio', { name: /Legacy.*repair required/ }));
  expect(screen.getByLabelText('Target Audience')).toHaveProperty('value', '');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Legacy' }));
  expect(remove).toHaveBeenCalledExactlyOnceWith(saved[1]);
});
it('cannot open or mutate a disabled picker', () => {
  render(<Picker disabled />); fireEvent.click(screen.getByLabelText('Target Audience'));
  expect(screen.queryByRole('menu')).toBeNull();
});
