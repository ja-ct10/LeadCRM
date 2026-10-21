import { inflateRawSync } from 'node:zlib';
import { crmFileExtension, crmFileValidationError, CRM_FILE_FORMAT_ERROR, RECORD_FILE_MAX_BYTES } from '@leadcrm/shared';
import { AppError } from '../../../shared/errors/app-error';

const mimeTypes = {
  csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

function isText(bytes: Buffer): boolean {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text);
  } catch { return false; }
}

/** Inspect the ZIP directory and only inflate bounded, required Word XML parts. */
function isDocx(bytes: Buffer): boolean {
  try {
    let end = bytes.length - 22;
    const minimum = Math.max(0, end - 65535);
    while (end >= minimum && bytes.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < minimum || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length ||
        bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) return false;
    const count = bytes.readUInt16LE(end + 10), directorySize = bytes.readUInt32LE(end + 12);
    let cursor = bytes.readUInt32LE(end + 16), totalSize = 0;
    if (!count || count > 2048 || count !== bytes.readUInt16LE(end + 8) || cursor + directorySize !== end) return false;
    const xml = new Map<string, string>(), names = new Set<string>();
    const required = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'];
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) return false;
      const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
      const compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
      const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
      const local = bytes.readUInt32LE(cursor + 42);
      const next = cursor + 46 + nameLength + extraLength + commentLength;
      if (next > end || flags & 1 || ![0, 8].includes(method) || local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) return false;
      const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
      if (names.has(name) || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || /vbaProject\.bin$/i.test(name)) return false;
      names.add(name); totalSize += size;
      if (totalSize > 64 * 1024 * 1024 || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) return false;
      const localNameLength = bytes.readUInt16LE(local + 26), start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
      if (start + compressedSize > bytes.readUInt32LE(end + 16) || bytes.subarray(local + 30, local + 30 + localNameLength).toString('utf8') !== name) return false;
      if (required.includes(name)) {
        if (!size || size > 64 * 1024 * 1024) return false;
        const compressed = bytes.subarray(start, start + compressedSize);
        const content = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: 64 * 1024 * 1024 });
        if (content.length !== size) return false;
        let crc = 0xffffffff;
        for (const byte of content) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
        }
        if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32LE(cursor + 16)) return false;
        const encoding = content[0] === 255 && content[1] === 254 ? 'utf-16le' : content[0] === 254 && content[1] === 255 ? 'utf-16be' : 'utf-8';
        const text = new TextDecoder(encoding, { fatal: true }).decode(content);
        if (text.includes('\0')) return false;
        xml.set(name, text);
      }
      cursor = next;
    }
    const contentTypes = xml.get('[Content_Types].xml') ?? '', relationships = xml.get('_rels/.rels') ?? '';
    return cursor === end && required.every(name => xml.has(name)) &&
      /<(?:\w+:)?Types[\s>]/.test(contentTypes) && /<(?:\w+:)?Relationships[\s>]/.test(relationships) &&
      (contentTypes.match(/<(?:\w+:)?Override\b[^>]*>/g) ?? []).some(tag =>
        /PartName\s*=\s*["']\/word\/document\.xml["']/.test(tag) && tag.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) &&
      (relationships.match(/<(?:\w+:)?Relationship\b[^>]*>/g) ?? []).some(tag =>
        /Target\s*=\s*["']\/?word\/document\.xml["']/.test(tag) && /Type\s*=\s*["'][^"']+\/officeDocument["']/.test(tag)) &&
      /<(?:[\w]+:)?document[\s>]/.test(xml.get('word/document.xml')!) &&
      /(?:wordprocessingml\/2006\/main|ooxml\/wordprocessingml\/main)/.test(xml.get('word/document.xml')!);
  } catch { return false; }
}

export function validateCrmFile(name: string, submittedType: string, bytes: Buffer): string {
  if (!Buffer.isBuffer(bytes)) throw new AppError('Choose a nonempty file.', 400);
  const error = crmFileValidationError({ name, size: bytes.length });
  if (error) throw new AppError(error, bytes.length > RECORD_FILE_MAX_BYTES ? 413 : 400);
  const extension = crmFileExtension(name)!;
  const type = submittedType.trim().toLowerCase();
  const compatible = type === mimeTypes[extension] || type === 'application/octet-stream' ||
    extension === 'csv' && ['text/plain', 'application/csv', 'application/vnd.ms-excel'].includes(type);
  if (!compatible) throw new AppError(CRM_FILE_FORMAT_ERROR, 400);
  const signature = bytes.subarray(0, 12);
  const valid = extension === 'pdf' ? signature.subarray(0, 5).toString() === '%PDF-'
    : extension === 'png' ? signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : extension === 'jpg' || extension === 'jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
    : extension === 'docx' ? isDocx(bytes)
    : isText(bytes) &&
      !signature.subarray(0, 5).toString().startsWith('%PDF-') && !signature.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
  if (!valid) throw new AppError('File contents do not match the selected file type.', 400);
  return mimeTypes[extension];
}
