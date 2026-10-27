import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

afterEach(cleanup);
it('associates a dialog with its visible title and description', async () => {
  render(<Dialog open><DialogContent><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update your details.</DialogDescription></DialogContent></Dialog>);
  const dialog = await screen.findByRole('dialog', { name: 'Edit profile' });
  expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Update your details.');
});
it('preserves explicit accessible labels and title IDs', async () => {
  render(<Dialog open><DialogContent aria-labelledby="custom-title"><DialogTitle id="custom-title">Scheduled email</DialogTitle></DialogContent></Dialog>);
  expect((await screen.findByRole('dialog', { name: 'Scheduled email' })).getAttribute('aria-labelledby')).toBe('custom-title');
});
