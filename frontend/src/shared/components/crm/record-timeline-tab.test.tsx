import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ canCreate: true, create: vi.fn(), onCreated: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => mocks.canCreate }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ addActivity: vi.fn() }) }));
vi.mock('@/features/tenant/crm/activities/services/activities.service', () => ({ activitiesService: { create: mocks.create } }));
import { RecordTimelineTab } from './record-timeline-tab';
beforeEach(() => { vi.resetAllMocks(); mocks.canCreate = true; });
afterEach(cleanup);
it('saves one activity with the supported record link and refreshes after success', async () => {
  mocks.create.mockResolvedValue({ data: { id: 'saved' } });
  render(<RecordTimelineTab activities={[]} module="deals" recordId="deal-1" onActivityCreated={mocks.onCreated} />);
  fireEvent.change(screen.getByLabelText('Activity description'), { target: { value: 'Follow-up note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await waitFor(() => expect(mocks.onCreated).toHaveBeenCalledOnce());
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ type: 'note', title: 'Follow-up note', dealId: 'deal-1' });
});
it('retains the draft when persistence fails', async () => {
  mocks.create.mockRejectedValue(new Error('Offline'));
  render(<RecordTimelineTab activities={[]} module="accounts" recordId="account-1" onActivityCreated={mocks.onCreated} />);
  fireEvent.change(screen.getByLabelText('Activity description'), { target: { value: 'Unsaved note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Note' }).hasAttribute('disabled')).toBe(false));
  expect((screen.getByLabelText('Activity description') as HTMLTextAreaElement).value).toBe('Unsaved note');
  expect(mocks.onCreated).not.toHaveBeenCalled();
});
it('does not offer mutations without the existing create permission', () => {
  mocks.canCreate = false;
  render(<RecordTimelineTab activities={[]} module="deals" recordId="deal-1" />);
  expect(screen.queryByLabelText('Activity description')).toBeNull();
});
it.each(['leads', 'contacts'] as const)('never creates an unlinked live %s activity', module => {
  render(<RecordTimelineTab activities={[]} module={module} recordId="record-1" />);
  expect(screen.queryByLabelText('Activity description')).toBeNull();
  expect(screen.getByText(/Quick Log is currently unavailable/)).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();
});
