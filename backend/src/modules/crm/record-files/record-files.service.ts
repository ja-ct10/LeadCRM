import { randomUUID } from 'node:crypto';
import { assertCrmRecordMutation } from '../access/crm-record-access.service';
import { salesTransaction } from '../leads/lead-automation.service';
import { z } from 'zod';
import { RECORD_FILE_MAX_BYTES } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { AppError } from '../../../shared/errors/app-error';
import { recordText } from '../record-validation';
import { privateObjectStorage } from '../../../shared/services/private-object-storage';
import type { MailboxAttachment, RecordEmailAttachmentContext, RecordEmailAttachmentsPage } from '@leadcrm/shared';
import { recordMailboxScope } from '../../../integrations/gmail/mailbox-record-scope';
import { readMailboxContent } from '../../../integrations/gmail/mailbox-attachments';
import sanitizeHtml from 'sanitize-html';

export type FileModule = 'leads' | 'contacts' | 'accounts' | 'deals';
const links = { leads: 'leadId', contacts: 'contactId', accounts: 'accountId', deals: 'dealId' } as const;
const actor = { uploadedBy: { select: { firstName: true, lastName: true } } } as const;
const types = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv', 'application/zip', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] as const;
export const UploadMetadataSchema = z.object({ name: recordText(255).pipe(z.string().min(1)).transform(value => value.replace(/[\\/]/g, '_')), type: z.union([z.enum(types), z.literal('application/octet-stream')]) });

function storage() {
  return privateObjectStorage(process.env.RECORD_FILES_STORAGE_BUCKET || 'crm-record-files');
}
async function requireRecord(module: FileModule, id: string, tenantId: string) {
  const where = { id, tenantId, isArchived: false, deletedAt: null };
  const record = module === 'leads' ? await prisma.lead.findFirst({ where }) : module === 'contacts' ? await prisma.contact.findFirst({ where }) : module === 'deals' ? await prisma.deal.findFirst({ where }) : await prisma.account.findFirst({ where });
  if (!record) throw new AppError('Record not found.', 404);
  return record;
}
function metadata(file: { id: string; name: string; size: number; type: string; uploadedAt: Date; uploadedBy: { firstName: string; lastName: string } }, module: FileModule, recordId: string) {
  return { id: file.id, name: file.name, size: file.size, type: file.type, uploadedAt: file.uploadedAt.toISOString(), uploadedBy: `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`, url: `/api/proxy/crm/${module}/${encodeURIComponent(recordId)}/files/${file.id}/download` };
}
export async function listFiles(module: FileModule, id: string, tenantId: string) {
  await requireRecord(module, id, tenantId);
  const files = await prisma.recordFile.findMany({ where: { tenantId, [links[module]]: id }, include: actor, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }] });
  return files.map(file => metadata(file, module, id));
}

function validAttachment(file: unknown): file is MailboxAttachment {
  if (!file || typeof file !== 'object') return false;
  const value = file as MailboxAttachment;
  return typeof value.id === 'string' && /^(?:[a-zA-Z0-9_-]+|part:[a-zA-Z0-9_.-]*)$/.test(value.id) && value.id.length <= 2000
    && typeof value.filename === 'string' && typeof value.mimeType === 'string'
    && value.mimeType.length > 0 && (!value.id.startsWith('part:') || value.partId === value.id.slice(5))
    && (value.size === undefined || Number.isSafeInteger(value.size) && value.size >= 0);
}

function referencedContentIds(body: string) {
  const ids = new Set<string>();
  sanitizeHtml(body, { allowedTags: ['img'], allowedAttributes: { img: ['src'] }, transformTags: {
    img: (tagName, attribs) => {
      if (/^cid:/i.test(attribs.src ?? '')) {
        try { ids.add(decodeURIComponent(attribs.src.slice(4)).trim().replace(/^<|>$/g, '')); } catch { /* Invalid CID cannot identify an attachment. */ }
      }
      return { tagName, attribs };
    },
  } });
  return ids;
}

export async function listEmailAttachments(tenantId: string, userId: string, context: RecordEmailAttachmentContext, cursor?: string): Promise<RecordEmailAttachmentsPage> {
  const access = await recordMailboxScope(tenantId, userId, context);
  let after: { date: string; id: string; context: string } | undefined;
  if (cursor) {
    try {
      after = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!after || typeof after.id !== 'string' || !Number.isFinite(Date.parse(after.date))) throw new Error();
    } catch { throw new AppError('Invalid attachment page.', 400); }
    if (after.context !== access.contextHash) throw new AppError('Mailbox access changed. Reload files.', 409, 'MAILBOX_SCOPE_CHANGED');
  }
  const rows = await prisma.mailboxMessage.findMany({ where: { AND: [access.where, ...(after ? [{ OR: [{ sentAt: { lt: new Date(after.date) } }, { sentAt: new Date(after.date), id: { lt: after.id } }] }] : [])] },
    select: { id: true, providerMessageId: true, attachments: true, body: true, sentAt: true }, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 21 });
  const page: RecordEmailAttachmentsPage = { attachments: [] };
  const seen = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    let files = Array.isArray(row.attachments) ? (row.attachments as unknown[]).filter(validAttachment) : [];
    let body = row.body;
    if ((!files.length || !Array.isArray(row.attachments) || files.length !== row.attachments.length) && !page.error) {
      try { const recovered = await readMailboxContent(tenantId, userId, row.providerMessageId); files = recovered.attachments.filter(validAttachment); body = recovered.body; }
      catch (error) {
        if (error instanceof AppError && ([401, 403, 409].includes(error.statusCode) || error.code === 'MAILBOX_SCOPE_CHANGED')) throw error;
        page.error = 'Some email attachments are unavailable. Retry files to try again.';
      }
    }
    const inlineIds = referencedContentIds(body);
    for (const file of files) {
      if (file.disposition === 'inline' || file.contentId && inlineIds.has(file.contentId)) continue;
      const id = JSON.stringify([access.account.id, row.providerMessageId, file.id]);
      if (seen.has(id)) continue;
      seen.add(id);
      page.attachments.push({ id, accountId: access.account.id, messageId: row.providerMessageId, attachmentId: file.id,
        name: file.filename, type: file.mimeType, ...(file.size === undefined ? {} : { size: file.size }), sentAt: row.sentAt.toISOString() });
    }
  }
  const current = await recordMailboxScope(tenantId, userId, context);
  if (current.contextHash !== access.contextHash) throw new AppError('Mailbox access changed. Reload files.', 409, 'MAILBOX_SCOPE_CHANGED');
  const expectedIds = rows.slice(0, 20).map(row => row.id);
  const stillLinked = await prisma.mailboxMessage.count({ where: { AND: [current.where, { id: { in: expectedIds } }] } });
  if (stillLinked !== expectedIds.length) throw new AppError('Message association changed. Reload files.', 409, 'MAILBOX_SCOPE_CHANGED');
  if (rows.length > 20) {
    const last = rows[19];
    page.nextCursor = Buffer.from(JSON.stringify({ context: access.contextHash, date: last.sentAt.toISOString(), id: last.id })).toString('base64url');
  }
  return page;
}
export async function uploadFile(module: FileModule, id: string | null, tenantId: string, userId: string, input: unknown, bytes: Buffer) {
  if (id) await requireRecord(module, id, tenantId);
  if (id) await salesTransaction(tx => assertCrmRecordMutation(tx, module, id));
  const submitted = UploadMetadataSchema.parse(input);
  const extension = submitted.name.split('.').pop()?.toLowerCase();
  const inferred: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', csv: 'text/csv', zip: 'application/zip', doc: 'application/msword', xls: 'application/vnd.ms-excel', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const data = { ...submitted, type: submitted.type === 'application/octet-stream' ? inferred[extension ?? ''] ?? submitted.type : submitted.type };
  if (!(types as readonly string[]).includes(data.type)) throw new AppError('This file type is not supported.', 400);
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > RECORD_FILE_MAX_BYTES) throw new AppError('Choose a nonempty file no larger than 10 MB.', 400);
  // Refuse mislabeled binary files. Downloads always use attachment + nosniff.
  const signature = bytes.subarray(0, 12);
  const valid = data.type === 'application/pdf' ? signature.subarray(0, 5).toString() === '%PDF-'
    : data.type === 'image/png' ? signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : data.type === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
    : data.type === 'image/webp' ? signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP'
    : data.type.startsWith('text/') ? !bytes.includes(0)
    : data.type.includes('openxmlformats') || data.type === 'application/zip' ? signature[0] === 80 && signature[1] === 75
    : signature.subarray(0, 4).equals(Buffer.from([208,207,17,224]));
  if (!valid) throw new AppError('File contents do not match the selected file type.', 400);
  const config = storage();
  if (!id) {
    // Expired drafts cannot be claimed. Remove only this uploader's abandoned
    // drafts; record attachments and historical values are never cleanup targets.
    const expired = await prisma.recordFile.findMany({ where: { tenantId, uploadedById: userId, pendingModule: { not: null }, uploadedAt: { lte: new Date(Date.now() - 86400000) } }, take: 100 });
    if (expired.length) {
      try {
        await config.remove(expired.map(file => file.objectKey));
        await prisma.recordFile.deleteMany({ where: { tenantId, uploadedById: userId, pendingModule: { not: null }, id: { in: expired.map(file => file.id) } } });
      } catch { console.warn('Unable to clean up expired record files'); }
    }
    if (await prisma.recordFile.count({ where: { tenantId, uploadedById: userId, pendingModule: { not: null } } }) >= 100) throw new AppError('Too many unfinished file uploads. Save your current records or retry after old drafts expire.', 400);
  }
  const fileId = randomUUID();
  const key = `${encodeURIComponent(tenantId)}/${module}/${encodeURIComponent(id ?? `pending-${userId}`)}/${fileId}`;
  await config.put(key, bytes);
  try {
    const file = await prisma.$transaction(async tx => {
      const saved = await tx.recordFile.create({ data: { id: fileId, tenantId, ...(id ? { [links[module]]: id } : { pendingModule: module }), uploadedById: userId, name: data.name, size: bytes.length, type: data.type, objectKey: key }, include: actor });
      if (id) await tx.activity.create({ data: { tenantId, createdById: userId, [links[module]]: id, type: 'file_upload', title: `Uploaded ${data.name}`, metadata: { fileId } } });
      return saved;
    });
    return { ...metadata(file, module, id ?? ''), ...(!id ? { url: '' } : {}) };
  } catch (error) {
    await config.remove([key]).catch(() => console.warn('Unable to clean up uncommitted record file'));
    throw error;
  }
}
export async function downloadFile(module: FileModule, id: string, tenantId: string, fileId: string) {
  await requireRecord(module, id, tenantId);
  const file = await prisma.recordFile.findFirst({ where: { id: fileId, tenantId, [links[module]]: id } });
  if (!file) throw new AppError('File not found.', 404);
  const config = storage();
  return { name: file.name, bytes: await config.read(file.objectKey) };
}
