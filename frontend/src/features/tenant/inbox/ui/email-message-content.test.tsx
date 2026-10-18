import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailMessageContent } from './email-message-content';
import type { GmailEmail } from '../services/gmail.service';
const mocks = vi.hoisted(() => ({ content: vi.fn(), attachment: vi.fn(), toast: vi.fn() }));
vi.mock('../services/gmail.service', () => ({ fetchGmailMessageContent: mocks.content, fetchGmailAttachment: mocks.attachment }));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
const email: GmailEmail = { id: 'message-id', threadId: 'thread', from: 'sender@example.test', to: ['owner@example.test'], subject: 'Quotation', snippet: 'Saved body', body: '<p>Saved body</p>', date: '2026-10-18T00:00:00Z', labels: ['INBOX'], isRead: true };
const pdf = { id: 'pdf-id', filename: 'QT-2026-00124.pdf', mimeType: 'application/pdf', size: 2048 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:original-' + Math.random());
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mocks.content.mockResolvedValue({ body: '<h1 style="color:blue">Original body</h1>', attachments: [pdf] });
  mocks.attachment.mockResolvedValue(new Blob(['%PDF-1.7\nOriginal bytes'], { type: 'application/pdf' }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('recovers formatted content and metadata, previews the original PDF, downloads it and revokes preview URLs', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<EmailMessageContent email={email} />);
  await screen.findByText(pdf.filename);
  expect(screen.getByText('PDF Document · 2.0 KB')).toBeTruthy();
  expect(screen.getByTitle('Email message content').getAttribute('srcdoc')).toContain('<h1 style="color:blue">Original body</h1>');
  expect(screen.getByTitle('Email message content').getAttribute('sandbox')).not.toContain('allow-scripts');
  fireEvent.click(screen.getByRole('button', { name: `Preview ${pdf.filename}` }));
  const frame = await screen.findByTitle('Email attachment PDF preview');
  expect(frame.getAttribute('src')).toMatch(/^blob:original-.*#view=FitH$/);
  expect(mocks.attachment).toHaveBeenCalledWith(email.id, pdf.id, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(pdf.filename);
  expect(mocks.attachment).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByLabelText('Close sheet'));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(frame.getAttribute('src')!.split('#')[0]);
});
it('loads CID images and image thumbnails through the authorized attachment service and previews images', async () => {
  mocks.content.mockResolvedValue({ body: '<p>Branded</p><img src="cid:logo@mail">', attachments: [
    { id: 'logo', contentId: 'logo@mail', disposition: 'inline', filename: 'logo.png', mimeType: 'image/png' },
    { id: 'photo', filename: 'photo.png', mimeType: 'image/png', size: 100 },
  ] }); mocks.attachment.mockResolvedValue(new Blob(['image bytes'], { type: 'image/png' }));
  const view = render(<EmailMessageContent email={email} />);
  await waitFor(() => expect(screen.getByTitle('Email message content').getAttribute('srcdoc')).toMatch(/src="blob:original-/));
  expect(screen.queryByText('logo.png')).toBeNull();
  await screen.findByAltText('photo.png');
  fireEvent.click(screen.getByRole('button', { name: 'Preview photo.png' }));
  await screen.findByRole('dialog', { name: 'photo.png' });
  expect(screen.getAllByAltText('photo.png')).toHaveLength(2);
  view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it('leaves unsupported files downloadable and reports missing attachment errors', async () => {
  mocks.content.mockResolvedValue({ body: '<pre>Plain text</pre>', attachments: [{ id: 'office', filename: 'document.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }] });
  mocks.attachment.mockRejectedValue(Object.assign(new Error('Attachment is no longer available.'), { status: 404 }));
  render(<EmailMessageContent email={email} />);
  await screen.findByText('document.docx'); expect(screen.queryByRole('button', { name: /Preview/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Download document.docx' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Attachment is no longer available.'));
});
it('retains saved content on temporary errors, retries, and clears content on authorization loss', async () => {
  mocks.content.mockRejectedValueOnce(Object.assign(new Error('Gmail is temporarily unavailable.'), { status: 503 }));
  const onUnavailable = vi.fn(); render(<EmailMessageContent email={email} onUnavailable={onUnavailable} />);
  await screen.findByRole('alert'); expect(screen.getByTitle('Email message content').getAttribute('srcdoc')).toContain('Saved body');
  mocks.content.mockRejectedValueOnce(Object.assign(new Error('Mailbox access revoked.'), { status: 404 }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry message' }));
  await waitFor(() => expect(onUnavailable).toHaveBeenCalledOnce());
  expect(screen.getByTitle('Email message content').getAttribute('srcdoc')).not.toContain('Saved body');
});
