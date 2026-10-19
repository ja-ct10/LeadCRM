import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const mocks = vi.hoisted(() => ({ attachment: vi.fn(), canDelete: false }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => mocks.canDelete }));
vi.mock('@/features/tenant/inbox/services/gmail.service', () => ({ fetchGmailAttachment: mocks.attachment }));
import { RecordFilesTab } from './record-files-tab';

beforeEach(() => {
  vi.clearAllMocks(); mocks.canDelete = false;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:original-' + Math.random());
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows persisted file history metadata and a download action', () => {
  render(<RecordFilesTab files={[{
    id: 'file-1', name: 'agreement.pdf', size: 2048, type: 'application/pdf',
    uploadedAt: '2026-09-01T10:00:00.000Z', uploadedBy: 'Ava Cruz', url: '/api/proxy/crm/leads/lead-1/files/file-1/download',
  }]} />);
  expect(screen.getByText('agreement.pdf')).toBeTruthy();
  expect(screen.getByText(/2\.0 KB/)).toBeTruthy();
  expect(screen.getByText(/Ava Cruz/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Download agreement.pdf' }).getAttribute('href')).toContain('/files/file-1/download');
});

it('shows a disabled upload loading state until the API call settles', async () => {
  let finishUpload!: () => void;
  const onUpload = vi.fn(() => new Promise<void>(resolve => { finishUpload = resolve; }));
  render(<RecordFilesTab files={[]} onUpload={onUpload} />);
  const picker = screen.getByLabelText('Choose file') as HTMLInputElement;
  const file = new File(['%PDF-1.7\nattachment'], 'agreement.pdf', { type: 'application/pdf' });
  fireEvent.change(picker, { target: { files: [file] } });
  expect(await screen.findByRole('status', { name: 'Uploading file' })).toBeTruthy();
  expect(picker.disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Upload file' })).toBeNull();
  await act(async () => { finishUpload(); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Upload file' })).toBeTruthy());
  expect(onUpload).toHaveBeenCalledWith(file);
  expect(toast.success).toHaveBeenCalledWith('agreement.pdf uploaded');
});

it('shows a useful upload error and lets the user retry', async () => {
  const retryUpload = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
  render(<RecordFilesTab files={[]} error="Could not load files." onRetry={retryUpload} onUpload={retryUpload} />);
  expect(screen.getByRole('alert').textContent).toContain('Could not load files.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry files' }));
  const picker = screen.getByLabelText('Choose file');
  fireEvent.change(picker, { target: { files: [new File(['%PDF-1.7'], 'agreement.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Storage unavailable'));
  expect(screen.getByRole('button', { name: 'Upload file' })).toBeTruthy();
});

const reference = { id: 'gmail-reference', accountId: 'mailbox', messageId: 'message', attachmentId: 'original-pdf', name: 'quotation.pdf', type: 'application/pdf', size: 20173, sentAt: '2026-10-18T01:00:00Z' };
const emailFile = { id: reference.id, name: reference.name, type: reference.type, size: reference.size, uploadedAt: reference.sentAt, emailAttachment: reference };

it.each(['leads', 'contacts', 'deals'] as const)('uses the original PDF viewer and reauthorizes every %s action', async recordModule => {
  const context = { recordModule, recordId: 'record' }, click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  mocks.attachment.mockResolvedValue(new Blob(['%PDF-1.7 original'], { type: 'application/pdf' }));
  mocks.canDelete = true;
  const onDelete = vi.fn();
  render(<RecordFilesTab files={[emailFile, { id: 'manual', name: 'manual.txt', type: 'text/plain', size: 5, uploadedAt: reference.sentAt, url: '/original-manual-download' }]} emailContext={context} onDelete={onDelete} />);
  expect(screen.getByText(/Email Attachment/).textContent).toContain('19.7 KB');
  expect(screen.getByRole('button', { name: 'Delete manual.txt' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Delete quotation.pdf' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Preview quotation.pdf' }));
  const frame = await screen.findByTitle('Email attachment PDF preview');
  expect(frame.getAttribute('src')).toMatch(/^blob:original-.*#view=FitH$/);
  expect(screen.getByRole('link', { name: 'Open PDF in a new tab' })).toBeTruthy();
  expect(mocks.attachment).toHaveBeenLastCalledWith('message', 'original-pdf', expect.any(AbortSignal), { ...context, accountId: 'mailbox' });
  fireEvent.click(screen.getByRole('button', { name: /^Download$/ }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(mocks.attachment).toHaveBeenCalledTimes(2);
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('quotation.pdf');
  fireEvent.click(screen.getByLabelText('Close sheet'));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(frame.getAttribute('src')!.split('#')[0]);
});

it('supports images, unknown sizes and download-only formats without a delete action', async () => {
  mocks.attachment.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  const image = { ...emailFile, name: 'photo.png', type: 'image/png', size: undefined, emailAttachment: { ...reference, name: 'photo.png', type: 'image/png', size: undefined } };
  render(<RecordFilesTab files={[image, { ...emailFile, id: 'office', name: 'document.docx', type: 'application/msword' }]} emailContext={{ recordModule: 'contacts', recordId: 'record' }} />);
  expect(screen.getByText(/PNG Image/).textContent).not.toContain('NaN');
  expect(screen.queryByRole('button', { name: 'Preview document.docx' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Download document.docx' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Preview photo.png' }));
  expect(await screen.findByAltText('photo.png')).toBeTruthy();
});

it('closes and revokes the preview on access changes and discards an in-flight stale response', async () => {
  mocks.attachment.mockResolvedValueOnce(new Blob(['%PDF-original'], { type: 'application/pdf' }));
  const props = { files: [emailFile], emailContext: { recordModule: 'leads' as const, recordId: 'record' } };
  const view = render(<RecordFilesTab {...props} attachmentAccessKey="access-1" />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview quotation.pdf' }));
  await screen.findByTitle('Email attachment PDF preview');
  view.rerender(<RecordFilesTab {...props} attachmentAccessKey="access-2" />);
  expect(screen.queryByTitle('Email attachment PDF preview')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  let finish!: (value: Blob) => void;
  mocks.attachment.mockImplementationOnce(() => new Promise<Blob>(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview quotation.pdf' }));
  const signal = mocks.attachment.mock.calls[1][2] as AbortSignal;
  view.rerender(<RecordFilesTab {...props} attachmentAccessKey="access-3" />);
  expect(signal.aborted).toBe(true);
  await act(async () => finish(new Blob(['%PDF-stale'], { type: 'application/pdf' })));
  expect(screen.queryByTitle('Email attachment PDF preview')).toBeNull();
});

it('uses existing error feedback for revoked downloads and preserves manual delete confirmation', async () => {
  const onUnavailable = vi.fn(), onDelete = vi.fn(); mocks.canDelete = true;
  mocks.attachment.mockRejectedValue(Object.assign(new Error('Mailbox access revoked'), { status: 403 }));
  render(<RecordFilesTab files={[emailFile, { id: 'manual', name: 'manual.txt', type: 'text/plain', size: 5, uploadedAt: reference.sentAt }]}
    emailContext={{ recordModule: 'leads', recordId: 'record' }} onEmailUnavailable={onUnavailable} onDelete={onDelete} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download quotation.pdf' }));
  await waitFor(() => expect(onUnavailable).toHaveBeenCalledOnce());
  expect(toast.error).toHaveBeenCalledWith('Mailbox access revoked');
  fireEvent.click(screen.getByRole('button', { name: 'Delete manual.txt' }));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith('manual'));
});
