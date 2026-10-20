import { expect, it } from 'vitest';
import { createRawMessage } from './gmail.service';
import { decodeOutgoingAttachments } from './mailbox-upload-attachments';
import { MAILBOX_ATTACHMENT_MAX_BYTES } from '@leadcrm/shared';

const upload = (filename = 'Quotation.pdf', body = '%PDF-1.4\nTest') => ({ filename, mimeType: 'application/pdf', content: Buffer.from(body).toString('base64') });
it('encodes multiple attachments with their exact bytes, safe filenames and MIME types', () => {
  const files = decodeOutgoingAttachments([upload('Client "quote" – revised.pdf'), { filename: 'Details.csv', mimeType: 'text/csv', content: Buffer.from('Product,Price\nCamera,100').toString('base64') }])!;
  const raw = Buffer.from(createRawMessage('customer@example.test', 'Editable subject', '<p>Details</p>', 'agent@camxian.com', undefined, '<send@example.test>', [], files), 'base64url').toString();
  expect(raw).toContain('Content-Type: multipart/mixed');
  expect(raw).toContain('Content-Type: text/csv');
  expect(raw).toContain("filename*=UTF-8''Client%20%22quote%22%20%E2%80%93%20revised.pdf");
  expect(raw).toContain(Buffer.from('Product,Price\nCamera,100').toString('base64'));
  expect(files[0].data.toString()).toBe('%PDF-1.4\nTest');
});
it('rejects unsupported files, mismatched contents, unsafe headers, invalid encoding and oversized payloads', () => {
  for (const files of [[upload('bad.exe')], [upload('bad.pdf', 'Not a PDF')], [upload('bad\r\nBcc: victim.pdf')], [{ ...upload(), content: 'invalid*' }], [upload('big.pdf', '%PDF-' + 'x'.repeat(MAILBOX_ATTACHMENT_MAX_BYTES))], Array.from({ length: 11 }, () => upload())]) expect(() => decodeOutgoingAttachments(files)).toThrow();
});
it('accepts a valid attachment at the 5 MB limit without exhausting the validation stack', () => {
  const file = upload('Large.pdf', '%PDF-' + 'x'.repeat(MAILBOX_ATTACHMENT_MAX_BYTES - 5));
  expect(decodeOutgoingAttachments([file])?.[0].data.length).toBe(MAILBOX_ATTACHMENT_MAX_BYTES);
});
