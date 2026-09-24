import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), apply: vi.fn(), success: vi.fn(), error: vi.fn(), canEdit: true, tenant: 'tenant' }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: mocks.tenant }, userCan: () => mocks.canEdit, applyOrganizationSettings: mocks.apply }) }));
vi.mock('../../services/settings.service', () => ({ settingsApiService: { getOrganization: mocks.get, updateOrganization: mocks.save } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
import { OrganizationSettingsForm } from '../organization-settings-form';
const saved = { id: 'tenant', name: 'Original', industry: 'IT', email: 'info@example.com', phone: '123', domain: 'example.com', address: 'Manila' };
beforeEach(() => { vi.resetAllMocks(); mocks.canEdit = true; mocks.tenant = 'tenant'; mocks.get.mockResolvedValue({ data: saved }); });
afterEach(cleanup);
const name = () => screen.getByLabelText('Organization Name') as HTMLInputElement;

it('hydrates readonly values, Edit enables fields, Cancel restores the persisted snapshot', async () => {
  render(<OrganizationSettingsForm />);
  await screen.findByDisplayValue('Original');
  expect(name().readOnly).toBe(true);
  expect(screen.queryByText('Save Changes')).toBeNull();
  fireEvent.click(screen.getByText('Edit'));
  expect(name().readOnly).toBe(false);
  fireEvent.change(name(), { target: { value: 'Unsaved' } });
  fireEvent.click(screen.getByText('Cancel'));
  expect(name().value).toBe('Original');
  expect(name().readOnly).toBe(true);
  expect(mocks.save).not.toHaveBeenCalled();
});

it('blocks duplicate saves, retains edits on failure, and displays the canonical saved response on retry', async () => {
  let reject!: (error: Error) => void;
  mocks.save.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  render(<OrganizationSettingsForm />); await screen.findByDisplayValue('Original');
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.change(name(), { target: { value: ' Changed ' } });
  const form = name().closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.success).not.toHaveBeenCalled();
  reject(new Error('Save failed'));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Save failed'));
  expect(name().value).toBe(' Changed ');
  expect(name().readOnly).toBe(false);
  mocks.save.mockResolvedValue({ data: { ...saved, name: 'Changed' } });
  fireEvent.submit(form);
  await waitFor(() => expect(name().readOnly).toBe(true));
  expect(name().value).toBe('Changed');
  expect(mocks.apply).toHaveBeenCalledWith({ ...saved, name: 'Changed' });
});

it('reloads from the API and never offers Edit without permission', async () => {
  mocks.canEdit = false;
  const view = render(<OrganizationSettingsForm />); await screen.findByDisplayValue('Original');
  expect(screen.queryByText('Edit')).toBeNull();
  expect(name().readOnly).toBe(true);
  view.unmount(); mocks.get.mockResolvedValue({ data: { ...saved, name: 'Persisted' } });
  render(<OrganizationSettingsForm />); await screen.findByDisplayValue('Persisted');
  expect(mocks.get).toHaveBeenCalledTimes(2);
});

it('ignores stale fetches after a tenant change and resets editing', async () => {
  let resolve!: (value: { data: typeof saved }) => void;
  mocks.get.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = render(<OrganizationSettingsForm />);
  mocks.tenant = 'other'; mocks.get.mockResolvedValue({ data: { ...saved, id: 'other', name: 'Other' } });
  view.rerender(<OrganizationSettingsForm />); await screen.findByDisplayValue('Other');
  resolve({ data: saved });
  await waitFor(() => expect(name().value).toBe('Other'));
});
