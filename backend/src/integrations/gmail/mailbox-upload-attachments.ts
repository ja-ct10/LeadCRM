import { MailboxUploadAttachmentsSchema, MAILBOX_ATTACHMENT_MAX_BYTES, MAILBOX_ATTACHMENTS_MAX_BYTES, mailboxAttachmentType } from '@leadcrm/shared';
import { AppError } from '../../shared/errors/app-error';

export interface OutgoingMailboxAttachment { filename: string; mimeType: string; data: Buffer }

export function validateOutgoingAttachments(files: OutgoingMailboxAttachment[]) {
  if (files.length > 10 || files.reduce((sum, file) => sum + file.data.length, 0) > MAILBOX_ATTACHMENTS_MAX_BYTES) throw new AppError('Attach at most 10 files totaling 10 MB.', 400);
  for (const file of files) {
    const ext = file.filename.split('.').pop()?.toLowerCase();
    const bytes = file.data;
    const signature = bytes.subarray(0, 12);
    const valid = ext === 'pdf' ? signature.subarray(0, 5).toString() === '%PDF-'
      : ext === 'png' ? signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : ext === 'jpg' || ext === 'jpeg' ? signature.subarray(0, 3).equals(Buffer.from([255,216,255]))
      : ext === 'gif' ? /^GIF8[79]a/.test(signature.toString())
      : ext === 'webp' ? signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP'
      : ['zip', 'docx', 'xlsx', 'pptx'].includes(ext ?? '') ? signature.subarray(0, 2).toString() === 'PK'
      : ['doc', 'xls', 'ppt'].includes(ext ?? '') ? signature.subarray(0, 8).equals(Buffer.from([208,207,17,224,161,177,26,225]))
      : ['txt', 'csv'].includes(ext ?? '') && !bytes.includes(0);
    if (!file.filename || file.filename.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(file.filename) || file.mimeType !== mailboxAttachmentType(file.filename) || !bytes.length || bytes.length > MAILBOX_ATTACHMENT_MAX_BYTES || !valid) throw new AppError('Invalid attachment. Use a supported document or image up to 5 MB.', 400);
  }
  return files;
}

export function decodeOutgoingAttachments(input: unknown) {
  if (input === undefined) return undefined;
  return validateOutgoingAttachments(MailboxUploadAttachmentsSchema.parse(input).map(file => ({ filename: file.filename, mimeType: file.mimeType, data: Buffer.from(file.content, 'base64') })));
}
