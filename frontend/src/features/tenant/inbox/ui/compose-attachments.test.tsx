import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ComposeModal from './compose-modal';
const mocks = vi.hoisted(() => ({ send: vi.fn(), save: vi.fn(), schedule: vi.fn(), error: vi.fn(), content: vi.fn(), attachment: vi.fn(), relationships: { data: { deals: [{ id: 'linked-deal', title: 'Camera installation', assignedUserId: 'agent' }, { id: 'other-deal', title: 'Other agent Deal', assignedUserId: 'other-agent' }], hasMoreDeals: false }, isInitialLoad: false, isRefreshing: false, loadMore: vi.fn(), refetch: vi.fn(), error: null } }));
vi.mock('../services/gmail.service', () => ({ sendGmailEmail: mocks.send, saveGmailDraft: mocks.save, scheduleGmailEmail: mocks.schedule, fetchGmailMessageContent: mocks.content, fetchGmailAttachment: mocks.attachment }));
vi.mock('@/shared/hooks/use-record-relationships', () => ({ useRecordRelationships: () => mocks.relationships }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent' } }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
beforeEach(() => { vi.clearAllMocks(); mocks.send.mockResolvedValue({ messageId: 'sent', threadId: 'thread' }); mocks.save.mockResolvedValue({ draftId: 'draft' }); });
afterEach(cleanup);
const draft = { to: 'customer@example.test', subject: 'Original', body: '<p>Hello</p>', recordContext: { recordModule: 'leads' as const, recordId: 'source-lead' } };
function attach(file = new File(['%PDF-1.4 test'], 'Proposal.pdf', { type: 'application/pdf' })) { fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } }); }

it('keeps the selected related Deal when editing the subject and sends attachments with it', async () => {
  render(<ComposeModal isOpen onClose={vi.fn()} onSent={vi.fn()} initialDraft={draft} />);
  fireEvent.click(screen.getByRole('button', { name: 'Associated deal' }));
  expect(screen.queryByRole('radio', { name: 'Other agent Deal' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Search associated deal'), { target: { value: 'Camera' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Camera installation' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), { target: { value: 'My edited subject' } });
  attach(); await screen.findByText('Proposal.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][1]).toBe('My edited subject');
  expect(mocks.send.mock.calls[0][8]).toMatchObject({ recordContext: draft.recordContext, dealId: 'linked-deal', attachments: [{ filename: 'Proposal.pdf', mimeType: 'application/pdf', content: btoa('%PDF-1.4 test') }] });
});

it('allows manual subjects without Deals, validates files, removes them, and preserves remaining files in drafts', async () => {
  mocks.relationships.data.deals = [];
  render(<ComposeModal isOpen onClose={vi.fn()} onSent={vi.fn()} initialDraft={draft} />);
  expect(screen.getByText('No associated deals. Enter a subject manually.')).toBeTruthy();
  attach(new File(['exe'], 'unsafe.exe')); await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(screen.queryByRole('list', { name: 'Email attachments' })).toBeNull();
  attach(); await screen.findByText('Proposal.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment Proposal.pdf' }));
  expect(screen.queryByText('Proposal.pdf')).toBeNull();
  attach(); await screen.findByText('Proposal.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.save.mock.calls[0][8].attachments).toHaveLength(1);
});

it('restores attachments from Gmail before enabling saved-draft delivery', async () => {
  mocks.content.mockResolvedValue({ body: '<p>Hello</p>', attachments: [{ id: 'file', filename: 'Existing.pdf', mimeType: 'application/pdf' }] });
  mocks.attachment.mockResolvedValue(new Blob(['%PDF-existing']));
  render(<ComposeModal isOpen onClose={vi.fn()} onSent={vi.fn()} initialDraft={{ ...draft, recordContext: undefined, draftId: 'saved', attachmentSourceMessageId: 'saved-message' }} />);
  expect(screen.getByRole('button', { name: 'Send email' })).toHaveProperty('disabled', true);
  await screen.findByText('Existing.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][8].attachments[0].content).toBe(btoa('%PDF-existing'));
});
