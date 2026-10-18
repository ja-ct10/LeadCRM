import { afterEach, expect, it, vi } from 'vitest';
import { parseGmailMessage, fetchMessageDetail, type GmailApiMessage } from './gmail.service';
const data = (value: string) => ({ data: Buffer.from(value).toString('base64url') });
const message = (payload: GmailApiMessage['payload']): GmailApiMessage => ({ id: 'mime-message', threadId: 'mime-thread', labelIds: ['INBOX'], snippet: '', internalDate: '1000000', payload });
afterEach(() => vi.unstubAllGlobals());
it('prefers nested HTML alternatives, excludes attached HTML and preserves related CID metadata', () => {
  const parsed = parseGmailMessage(message({ headers: [], mimeType: 'multipart/mixed', parts: [
    { filename: 'attachment.html', mimeType: 'text/html', body: data('<p>Not the body</p>'), headers: [{ name: 'Content-Disposition', value: 'attachment' }] },
    { mimeType: 'multipart/related', parts: [
      { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: data('Plain') }, { mimeType: 'text/html', body: data('<h1>HTML</h1><img src="cid:logo@mail">') }] },
      { partId: '1.1', filename: '', mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<logo@mail>' }, { name: 'Content-Disposition', value: 'inline' }], body: { attachmentId: 'gmail-image', size: 123 } },
    ] },
    { mimeType: 'message/rfc822', filename: 'forwarded.eml', parts: [{ mimeType: 'text/html', body: data('Attached message') }] },
  ] }));
  expect(parsed.body).toBe('<h1>HTML</h1><img src="cid:logo@mail">'); expect(parsed.plainText).toBe('Plain');
  expect(parsed.attachments).toEqual([{ id: 'gmail-image', partId: '1.1', filename: '', mimeType: 'image/png', size: 123, contentId: 'logo@mail', disposition: 'inline' }]);
});
it('escapes plain text and decodes declared character sets', () => {
  const parsed = parseGmailMessage(message({ headers: [{ name: 'Content-Type', value: 'text/plain; charset=windows-1252' }], mimeType: 'text/plain', body: { data: Buffer.from('Caf\xe9 <test> & hello', 'latin1').toString('base64url') } }));
  expect(parsed.body).toBe('<pre>Café &lt;test&gt; &amp; hello</pre>');
});
it('distinguishes absent metadata from a full empty attachment list and preserves part-backed files without inventing size', () => {
  const payload = { headers: [], mimeType: 'text/html', body: data('<p>Hello</p>') };
  expect(parseGmailMessage(message(payload), 'metadata').attachments).toBeUndefined();
  expect(parseGmailMessage(message(payload)).attachments).toEqual([]);
  expect(parseGmailMessage(message({ headers: [], mimeType: 'multipart/mixed', parts: [{ partId: '2', filename: 'small.txt', mimeType: 'text/plain', body: data('Original') }] })).attachments).toEqual([{ id: 'part:2', partId: '2', filename: 'small.txt', mimeType: 'text/plain' }]);
});
it('retrieves attachment-backed HTML through the existing Gmail read path', async () => {
  const provider = vi.fn(async (url: string) => url.includes('/attachments/') ? Response.json({ ...data('<h1>Original HTML</h1>'), size: 22 }) : Response.json(message({ headers: [], mimeType: 'text/html', body: { attachmentId: 'html-body' } })));
  vi.stubGlobal('fetch', provider);
  const parsed = await fetchMessageDetail('mime-test-token', 'mime-message');
  expect(parsed.body).toBe('<h1>Original HTML</h1>');
  expect(provider.mock.calls.map(call => call[0])).toEqual(['https://gmail.googleapis.com/gmail/v1/users/me/messages/mime-message?format=full', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/mime-message/attachments/html-body']);
});
