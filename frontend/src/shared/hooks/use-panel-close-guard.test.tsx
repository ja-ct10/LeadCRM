import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SideSheet } from '@/shared/components/side-sheet';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { usePanelDraft } from './use-panel-close-guard';

function Draft() {
  const [value, setValue] = useState(''), [busy, setBusy] = useState(false);
  const close = usePanelDraft({ dirty: !!value, busy });
  return <><label>Name<input value={value} onChange={event => setValue(event.target.value)} /></label>
    <label>Saving<input type="checkbox" checked={busy} onChange={event => setBusy(event.target.checked)} /></label>
    <button onClick={close}>Cancel form</button></>;
}
afterEach(cleanup);

it.each([SideSheet, SlidingDrawer])('protects a dirty form from Escape and cancellation, keeps input, and discards only after confirmation in %s', async Shell => {
  const closed = vi.fn();
  render(<Shell isOpen onClose={closed} title="Account editor"><Draft /></Shell>);
  const name = screen.getByRole('textbox', { name: 'Name' });
  fireEvent.change(name, { target: { value: 'Entered company' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' });
  expect(closed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeNull());
  expect(name).toHaveProperty('value', 'Entered company');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel form' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
});

it.each([SideSheet, SlidingDrawer])('blocks all close requests while saving and allows an unchanged form to close in %s', Shell => {
  const closed = vi.fn();
  render(<Shell isOpen onClose={closed} title="Account editor"><Draft /></Shell>);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Saving' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel form' }));
  expect(closed).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Saving' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel form' }));
  expect(closed).toHaveBeenCalledOnce();
});
