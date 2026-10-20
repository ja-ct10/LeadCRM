import { mailboxAttachmentType, MailboxUploadAttachmentsSchema, MAILBOX_ATTACHMENT_MAX_BYTES, MAILBOX_ATTACHMENTS_MAX_BYTES, type MailboxUploadAttachment } from '@leadcrm/shared';

export async function readComposeFiles(files: File[], current: MailboxUploadAttachment[] = []) {
  if (files.length + current.length > 10 || files.some(file => !file.size || file.size > MAILBOX_ATTACHMENT_MAX_BYTES)) throw new Error('Attach at most 10 nonempty files, up to 5 MB each.');
  const existingBytes = current.reduce((sum, file) => sum + file.content.length * 3 / 4 - (file.content.endsWith('==') ? 2 : file.content.endsWith('=') ? 1 : 0), 0);
  if (files.reduce((sum, file) => sum + file.size, existingBytes) > MAILBOX_ATTACHMENTS_MAX_BYTES) throw new Error('Attachments must total 10 MB or less.');
  const additions = await Promise.all(files.map(async file => {
    const mimeType = mailboxAttachmentType(file.name);
    if (!mimeType) throw new Error('Choose PDF, Office, ZIP, text, CSV or image files.');
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`)); reader.readAsDataURL(file);
    });
    return { filename: file.name, mimeType, content };
  }));
  const result = MailboxUploadAttachmentsSchema.safeParse([...current, ...additions]);
  if (!result.success) throw new Error(result.error.issues[0].message);
  return result.data;
}
