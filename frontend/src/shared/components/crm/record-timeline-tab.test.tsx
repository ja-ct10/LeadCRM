import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ canEdit: true, actor: 'actor', create: vi.fn(), onCreated: vi.fn(), loadMore: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => mocks.canEdit }));
vi.mock('@/shared/hooks/use-record-activities', () => ({ useRecordActivities: () => ({ activities: [], error: null, isInitialLoad: false, loadMore: mocks.loadMore }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: mocks.actor } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ addActivity: vi.fn() }) }));
vi.mock('@/features/tenant/crm/activities/services/activities.service', () => ({ activitiesService: { create: mocks.create } }));
import { RecordTimelineTab } from './record-timeline-tab';
import { clearPageCache } from '@/shared/cache/page-cache';
const note = { id: 'saved', type: 'note', title: 'Follow-up note', createdAt: '2026-10-01T10:00:00Z', createdBy: { id: 'actor', firstName: 'Author', lastName: 'Test', email: 'author@example.test' } };
beforeEach(() => { vi.resetAllMocks(); mocks.canEdit = true; mocks.actor = 'actor'; });
afterEach(cleanup);
it('shows the complete assignment message and preserves the actual event-time actor', () => {
  render(<RecordTimelineTab activities={[{ ...note, type: 'assignment', title: 'Assigned Agent changed to Next Agent',
    description: 'Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.',
    metadata: { actorName: 'Actual Admin' } }]} module="leads" recordId="lead" />);
  const timeline = within(screen.getByRole('region', { name: 'Activity Timeline' }));
  expect(timeline.getByText('Assigned Agent changed to Next Agent')).toBeTruthy();
  expect(timeline.getByText('Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.')).toBeTruthy();
  expect(timeline.getByText('Actual Admin')).toBeTruthy();
  expect(timeline.queryByText('Author Test')).toBeNull();
});
it('preserves the event-time Task actor after their profile name changes', () => {
  render(<RecordTimelineTab activities={[{ ...note, type: 'task', title: 'Task Completed',
    createdBy: { ...note.createdBy, firstName: 'Renamed', lastName: 'User' },
    metadata: { taskEvent: { actorName: 'Original Actor' } } }]} module="deals" recordId="deal" />);
  const timeline = within(screen.getByRole('region', { name: 'Activity Timeline' }));
  expect(timeline.getByText('Original Actor')).toBeTruthy();
  expect(timeline.queryByText('Renamed User')).toBeNull();
  expect(timeline.getByText('Task Completed').parentElement?.querySelector('time')?.getAttribute('dateTime')).toBe(note.createdAt);
});
it.each([['leads','leadId'],['contacts','contactId'],['accounts','accountId'],['deals','dealId']] as const)('saves one trimmed %s note, applies server identity and clears only after success', async (module,key) => {
  mocks.create.mockResolvedValue({ data: note });
  render(<RecordTimelineTab canEditRecord activities={[]} module={module} recordId="record" onActivityCreated={mocks.onCreated} />);
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Follow-up note  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(mocks.onCreated).toHaveBeenCalledExactlyOnceWith(note));
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ type: 'note', title: 'Follow-up note', [key]: 'record' });
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('');
  expect(within(screen.getByRole('region', { name: 'Notes' })).getAllByText('Follow-up note')).toHaveLength(1);
});
it('keeps a failed draft and excludes duplicate clicks while saving', async () => {
  let reject!: (error: Error) => void;
  mocks.create.mockReturnValue(new Promise((_,fail) => { reject = fail; }));
  render(<RecordTimelineTab canEditRecord activities={[]} module="deals" recordId="deal" />);
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Unsaved note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
  expect(mocks.create).toHaveBeenCalledOnce();
  reject(new Error('Offline'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save note' }).hasAttribute('disabled')).toBe(false));
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('Unsaved note');
});
it('keeps Notes and actual Tasks before Timeline independent of filters', () => {
  const onFiltersChange = vi.fn();
  const view = render(<RecordTimelineTab canEditRecord activities={[note, { id: 'call', type: 'call', title: 'Historical call', createdAt: note.createdAt }]} notes={[note]} tasks={<section aria-label="Tasks">Actual Task</section>} module="leads" recordId="lead" onFiltersChange={onFiltersChange} />);
  expect(screen.getAllByRole('region').map(region => region.getAttribute('aria-label'))).toEqual(['Notes','Tasks','Activity Timeline']);
  fireEvent.click(screen.getByRole('button', { name: 'Emails' }));
  expect(onFiltersChange).toHaveBeenCalledWith({ type: 'email', search: undefined });
  view.rerender(<RecordTimelineTab canEditRecord activities={[]} notes={[note]} tasks={<section aria-label="Tasks">Actual Task</section>} module="leads" recordId="lead" onFiltersChange={onFiltersChange} />);
  expect(within(screen.getByRole('region', { name: 'Notes' })).getByText(note.title)).toBeTruthy();
  expect(screen.getByText('Actual Task')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Activity Timeline' })).queryByText(note.title)).toBeNull();
  expect(onFiltersChange).toHaveBeenCalledWith({ type: 'email', search: undefined });
  expect(screen.queryByText('Quick Log')).toBeNull(); expect(screen.queryByText('Log an activity')).toBeNull();
});
it('keeps server search results authoritative instead of filtering only the returned page again', () => {
  const onFiltersChange = vi.fn();
  render(<RecordTimelineTab activities={[note]} notes={[]} module="leads" recordId="lead" onFiltersChange={onFiltersChange} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search activities' }), { target: { value: 'query matched on server' } });
  expect(onFiltersChange).toHaveBeenCalledWith({ type: undefined, search: 'query matched on server' });
  expect(within(screen.getByRole('region', { name: 'Activity Timeline' })).getByText(note.title)).toBeTruthy();
});
it('loads older Notes and Timeline from their separate readers', () => {
  const olderNotes = vi.fn(), olderEvents = vi.fn();
  render(<RecordTimelineTab canEditRecord activities={[]} notes={[]} module="contacts" recordId="contact" hasMore hasMoreNotes onLoadMore={olderEvents} onLoadMoreNotes={olderNotes} />);
  fireEvent.click(screen.getByRole('button', { name: 'Load older notes' })); fireEvent.click(screen.getByRole('button', { name: 'Load older activity' }));
  expect(olderNotes).toHaveBeenCalledOnce(); expect(olderEvents).toHaveBeenCalledOnce();
});
it('withholds the note editor without record edit permission', () => {
  mocks.canEdit = false;
  render(<RecordTimelineTab canEditRecord activities={[]} module="accounts" recordId="account" />);
  expect(screen.queryByLabelText('Note')).toBeNull();
});
it('discards local saved notes after cache clearing, preserves a same-user draft and clears it on identity change', async () => {
  mocks.create.mockResolvedValue({ data: note });
  const view = render(<RecordTimelineTab canEditRecord activities={[]} module="leads" recordId="record" />);
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: note.title } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Notes' })).getByText(note.title)).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Private draft' } });
  clearPageCache();
  view.rerender(<RecordTimelineTab canEditRecord activities={[]} module="leads" recordId="record" />);
  expect(screen.queryByText(note.title)).toBeNull();
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('Private draft');
  mocks.actor = 'other-user';
  view.rerender(<RecordTimelineTab canEditRecord activities={[]} module="leads" recordId="record" />);
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('');
});

it('withholds the note editor when assignment is denied despite Edit permission', () => {
  render(<RecordTimelineTab canEditRecord={false} activities={[]} module="leads" recordId="record" />);
  expect(screen.queryByLabelText('Note')).toBeNull();
});

it('shows mailbox failure without a contradictory empty email history message', () => {
  render(<RecordTimelineTab activities={[]} module="leads" recordId="record" error="Connect your work Gmail account first." />);
  fireEvent.click(screen.getByRole('button', { name: 'Emails' }));
  expect(screen.getByRole('alert').textContent).toContain('Connect your work Gmail');
  expect(screen.queryByText('No activities match your filter.')).toBeNull();
});
