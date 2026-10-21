import { expect, it } from 'vitest';
import { CRM_FILE_FORMAT_ERROR, CRM_FILE_SIZE_ERROR, RECORD_FILE_MAX_BYTES } from '@leadcrm/shared';
import { validateCrmFile } from './record-file-validation';
import { docxFixture, validFiles, zipFixture } from './__tests__/file-fixtures';

it.each(validFiles())('accepts supported $name and generic browser metadata', file => {
  expect(validateCrmFile(file.name, file.type, file.bytes)).toBe(file.type);
  expect(validateCrmFile(file.name.toUpperCase(), 'application/octet-stream', file.bytes)).toBe(file.type);
});
it('allows exactly 10 MB, rejects oversize and empty content', () => {
  expect(validateCrmFile('notes.txt', 'text/plain', Buffer.alloc(RECORD_FILE_MAX_BYTES, 65))).toBe('text/plain');
  expect(() => validateCrmFile('notes.txt', 'text/plain', Buffer.alloc(RECORD_FILE_MAX_BYTES + 1))).toThrow(CRM_FILE_SIZE_ERROR);
  expect(() => validateCrmFile('notes.txt', 'text/plain', Buffer.alloc(0))).toThrow('Choose a nonempty file.');
});
it.each(['txt', 'csv'])('rejects binary content disguised as %s while allowing Unicode text', extension => {
  for (const bytes of [Buffer.from([0xff, 0xfe, 0xfd]), Buffer.from('hidden\x7fcontrol'), Buffer.from('hidden\u0085control')])
    expect(() => validateCrmFile(`data.${extension}`, 'application/octet-stream', bytes)).toThrow(/contents/);
  expect(validateCrmFile(`data.${extension}`, 'application/octet-stream', Buffer.from('\ufeffName,City\nJos\u00e9,\u6771\u4eac\n'))).toBe(extension === 'csv' ? 'text/csv' : 'text/plain');
});
it('rejects unsupported extensions, incompatible MIME, binary text and disguised archives', () => {
  for (const name of ['image.webp', 'archive.zip', 'legacy.doc', 'sheet.xlsx', 'document.pdf.exe', 'csv'])
    expect(() => validateCrmFile(name, 'application/octet-stream', Buffer.from('test'))).toThrow(CRM_FILE_FORMAT_ERROR);
  expect(() => validateCrmFile('document.pdf', 'image/png', Buffer.from('%PDF-1.4'))).toThrow(CRM_FILE_FORMAT_ERROR);
  expect(() => validateCrmFile('image.png', 'image/png', Buffer.from('plain text'))).toThrow(/contents/);
  expect(() => validateCrmFile('notes.txt', 'text/plain', Buffer.from([0,1,2,3]))).toThrow(/contents/);
  expect(() => validateCrmFile('document.docx', 'application/octet-stream', zipFixture({ 'hello.txt': 'hello' }))).toThrow(/contents/);
  expect(() => validateCrmFile('document.docx', 'application/octet-stream', docxFixture().subarray(0, 50))).toThrow(/contents/);
  const corrupt = docxFixture(); corrupt.writeUInt32LE(0, corrupt.indexOf(Buffer.from([80,75,1,2])) + 16);
  expect(() => validateCrmFile('document.docx', 'application/octet-stream', corrupt)).toThrow(/contents/);
  expect(validateCrmFile('data.csv', 'application/vnd.ms-excel', Buffer.from('a,b\n1,2'))).toBe('text/csv');
});
