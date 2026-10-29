import { expect, it } from 'vitest';
import { normalizeMailboxContent, safeMailboxHtml, trimmedMailboxHtml, mailboxDisplayDocument } from './email-html';
it('removes active content, tracking pixels and CSS from untrusted email', () => {
  const clean = safeMailboxHtml('<p style="background:url(https://tracker.test)">Hello</p><img src="https://tracker.test/open" onerror="alert(1)"><svg onload="alert(1)"></svg><a href="jav&#97;script:alert(1)">link</a><script>alert(1)</script>');
  expect(clean).toContain('Hello'); expect(clean).not.toMatch(/script|onerror|onload|tracker|style=|<svg|<img/);
  expect(safeMailboxHtml('<a href="https://example.test">Product</a>')).toContain('href="https://example.test"');
});
it('preserves email styling, classes, tables, branding and safe links only in the isolated display document', () => {
  const source = mailboxDisplayDocument('<html><head><style>.button{background:#1260ff;color:white}@media(max-width:400px){table{width:100%}}</style></head><body><table width="600" cellpadding="24" bgcolor="#eee"><tr><td><h1>Reset your password</h1><a class="button" style="padding:16px" href="https://example.test/reset">Reset password</a><img src="https://example.test/logo.png" width="120"></td></tr></table></body></html>');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  expect(doc.querySelector('table')?.getAttribute('cellpadding')).toBe('24');
  expect(doc.querySelector('a')?.getAttribute('style')).toBe('padding:16px');
  expect(doc.querySelector('a')?.getAttribute('class')).toBe('button');
  expect(doc.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
  expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://example.test/logo.png');
  expect(doc.querySelector('img')?.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(source).toContain('@media'); expect(source).toContain("script-src 'none'");
  expect(safeMailboxHtml('<p style="color:red">Compose</p><img src="https://example.test/logo.png">')).not.toMatch(/style=|<img/);
});
it('removes executable markup, nested documents and unsafe navigation from the display document', () => {
  const source = mailboxDisplayDocument('<script>bad()</script><style>@import "https://evil.test/style.css";</style><iframe srcdoc="<script>bad()</script>"></iframe><object data="x"></object><form><input></form><meta http-equiv="refresh" content="0;url=https://evil.test"><base href="https://evil.test"><img src="javascript:bad()" onerror="bad()"><img src="/api/proxy/auth/me"><a href="jav&#97;script:bad()">Bad</a>');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  expect(doc.querySelector('script,iframe,object,form,input,base,[onerror]')).toBeNull();
  expect([...doc.querySelectorAll('img')].every(img => !img.hasAttribute('src'))).toBe(true);
  expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
  expect(doc.querySelector('meta[http-equiv="refresh"]')).toBeNull();
  expect(source).toContain("style-src 'unsafe-inline';"); expect(source).toContain("connect-src 'none'");
});
it('resolves only known CID raster blobs, retains plain text and removes confirmed quotes', () => {
  const doc = new DOMParser().parseFromString(mailboxDisplayDocument('<pre>A &lt; B\nSecond line</pre><img src="cid:logo%40mail"><img src="blob:untrusted"><img src="data:image/svg+xml,bad"><blockquote type="cite">History</blockquote>', { 'logo@mail': 'blob:authorized-image' }), 'text/html');
  expect(doc.querySelector('pre')?.textContent).toBe('A < B\nSecond line');
  expect(doc.querySelector('img')?.getAttribute('src')).toBe('blob:authorized-image');
  expect([...doc.querySelectorAll('img')].slice(1).every(img => !img.hasAttribute('src'))).toBe(true);
  expect(doc.body.textContent).not.toContain('History'); expect(doc.querySelector('details')).toBeNull();
});
it('contains sender markup and restricts navigation without hiding ambiguous customer text', () => {
  const html = '<div class="fixed inset-0" style="position:fixed"><iframe src="https://tracker.test"></iframe><object>bad</object><embed src="x"><a href="/crm/leads">internal path</a><a href="data:text/html,bad">data</a><a href="https://example.test" onclick="bad()">safe</a></div>';
  const clean = safeMailboxHtml(html);
  expect(clean).not.toMatch(/class=|style=|iframe|object|embed|onclick|href="\/|data:/);
  expect(clean).toContain('rel="noopener noreferrer"'); expect(clean).toContain('target="_blank"');
  expect(trimmedMailboxHtml('<p>On Thursday we wrote a proposal.</p>')).not.toContain('<details');
  expect(trimmedMailboxHtml('<p>Reply</p><blockquote type="cite">History</blockquote><p>Answer after quote</p>')).toBe('<p>Reply</p><p>Answer after quote</p>');
});

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const entities = 'A&nbsp;B &#39;yes&#39; &lt; &gt; &amp; &#x1F600;';
it.each([
  ['HTML', `<p>${entities}<br>Second line</p>`],
  ['legacy text', `${entities}\nSecond line`],
  ['Gmail text envelope', `<pre>${escape(entities + '\nSecond line')}</pre>`],
])('decodes entities consistently in %s while retaining line breaks', (_name, body) => {
  const content = normalizeMailboxContent(body);
  expect(content.text).toBe("A B 'yes' < > & 😀\nSecond line");
  const frame = new DOMParser().parseFromString(mailboxDisplayDocument(body), 'text/html');
  const app = new DOMParser().parseFromString(safeMailboxHtml(content.html), 'text/html');
  expect(frame.body.textContent?.replace(/\u00a0/g, ' ')).toBe(app.body.textContent?.replace(/\u00a0/g, ' '));
});

it.each(['&amp;lt;img&amp;gt;', '<p>&amp;lt;img&amp;gt;</p>', '<pre>&amp;amp;lt;img&amp;amp;gt;</pre>'])('does not recursively decode nested entities: %s', body => {
  const content = normalizeMailboxContent(body);
  expect(content.text).toBe('&lt;img&gt;');
  expect(normalizeMailboxContent(content.html).text).toBe(content.text);
});

it.each(['&lt;img src=x onerror=alert(1)&gt;', '<pre>&amp;lt;img src=x onerror=alert(1)&amp;gt;</pre>'])('keeps decoded markup inert: %s', body => {
  const content = normalizeMailboxContent(body);
  expect(content.text).toBe('<img src=x onerror=alert(1)>');
  const app = new DOMParser().parseFromString(safeMailboxHtml(content.html), 'text/html');
  const frame = new DOMParser().parseFromString(mailboxDisplayDocument(body), 'text/html');
  expect(app.querySelector('img, [onerror]')).toBeNull(); expect(frame.querySelector('img, [onerror]')).toBeNull();
});

it.each([
  '<div class="gmail_quote"><div class="gmail_attr">On Thursday, Staff wrote:</div><blockquote>Old message</blockquote></div>',
  '<div class="yahoo_quoted"><p>Old message</p></div>',
  '<div class="moz-cite-prefix">On Thu, Oct 8, 2026, Staff wrote:</div><blockquote type="cite">Old message</blockquote>',
  '<div>On Thu, Oct 8, 2026, Staff wrote:</div><blockquote>Old message</blockquote>',
  '<div id="divRplyFwdMsg">From: Staff<br>Sent: Thursday<br>To: Customer<br>Subject: Inquiry</div><blockquote>Old message</blockquote>',
])('removes structural reply history and preserves answers after the quote', quote => {
  const body = `<p><strong>New answer</strong> &amp; thanks</p>${quote}<p>Answer after quote</p>`;
  const content = normalizeMailboxContent(body);
  expect(content.text).toBe('New answer & thanks\n\nAnswer after quote');
  expect(content.html).toContain('<strong>New answer</strong>');
  expect(content.html).not.toMatch(/Old message|wrote:|Show trimmed content/);
});

it('removes a confirmed Outlook suffix with multiple header blocks', () => {
  const body = '<p>Reply</p><div id="divRplyFwdMsg"><b>From:</b> Staff<br><b>Sent:</b> Thursday<br><b>To:</b> Customer</div><p>Old message</p><p>Older message</p>';
  expect(normalizeMailboxContent(body).text).toBe('Reply');
});

it.each([
  'New answer\n\nOn Thu, Oct 8, 2026,\nStaff <staff@example.test> wrote:\n> Old question\n\nInline answer\n> Another old question\nBottom answer',
  '<div>New answer</div><div>On Thu, Oct 8, 2026,</div><div><b>Staff &lt;staff@example.test&gt;</b> wrote:</div><div>&gt; Old question</div><div>Inline answer</div><div>&gt; Another old question</div><div>Bottom answer</div>',
])('handles wrapped reply headers and retains inline and bottom answers', body => {
  const content = normalizeMailboxContent(body);
  expect(content.text).toContain('New answer'); expect(content.text).toContain('Inline answer'); expect(content.text).toContain('Bottom answer');
  expect(content.text).not.toMatch(/Old question|old question|wrote:|staff@example/);
});

it('removes corroborated Original Message headers from plain text', () => {
  expect(normalizeMailboxContent('New answer\n-----Original Message-----\nFrom: Staff\nSent: Thursday\nTo: Customer\nSubject: Inquiry\nOld message').text).toBe('New answer');
});

it.each([
  'A useful quote:\n> Keep this standalone quotation.\nOn Thursday we wrote a proposal.\nOn Thursday, Staff wrote:\nThis is a discussion of that literal header.',
  '<p>On Thursday, Staff wrote:</p><p>This is a discussion of that literal header.</p><blockquote>Keep this standalone quotation.</blockquote>',
  '-----Original Message-----\nThese words describe the separator, without any message headers.',
])('preserves ambiguous separators and legitimate quotations', body => {
  const content = normalizeMailboxContent(body);
  expect(content.text).toContain(body.includes('Original Message') ? 'Original Message' : 'On Thursday, Staff wrote:');
  if (body.includes('standalone quotation')) expect(content.text).toContain('Keep this standalone quotation.');
});

it.each([
  'Sharing this message\n---------- Forwarded message ----------\nFrom: Sender\nDate: Thursday\nSubject: Proposal\nTo: Customer\nForwarded content\nOn Thu, Staff wrote:\n> Forwarded history',
  '<p>Sharing this message</p><div class="gmail_quote">---------- Forwarded message ----------<br>From: Sender<br>Date: Thursday<br>Subject: Proposal<br>To: Customer<blockquote>Forwarded content</blockquote></div>',
])('preserves intentionally forwarded headers and content', body => {
  const content = normalizeMailboxContent(body);
  expect(content.text).toContain('Sharing this message'); expect(content.text).toContain('Forwarded message'); expect(content.text).toContain('Forwarded content');
});

it('retains long messages, paragraphs, lists, links and their new-message tail', () => {
  const body = `<p>${'Long message. '.repeat(2000)}</p><p>Second paragraph</p><ul><li>First item</li><li>Second item</li></ul><p><a href="https://example.test/?a=1&amp;b=2">Link</a></p><div class="gmail_quote">Old message</div><p>New-message tail</p>`;
  const content = normalizeMailboxContent(body);
  expect(content.text.match(/Long message\./g)).toHaveLength(2000);
  expect(content.text).toContain('\n\nSecond paragraph'); expect(content.text).toContain('First item\nSecond item'); expect(content.text).toMatch(/New-message tail$/);
  const app = new DOMParser().parseFromString(safeMailboxHtml(content.html), 'text/html');
  expect(app.querySelector('a')?.getAttribute('href')).toBe('https://example.test/?a=1&b=2');
});

it('does not restore quote-only content through empty-body presentation', () => {
  const body = '<div class="gmail_quote">Old message</div>';
  expect(normalizeMailboxContent(body).text).toBe('');
  const doc = new DOMParser().parseFromString(mailboxDisplayDocument(body), 'text/html');
  expect(doc.body.textContent).toBe('(No content)');
});
it('preserves literal reply examples inside code', () => {
  const body = '<p>Example for documentation:</p><pre><code>On Thu, Oct 8, 2026, Staff wrote:\n&gt; This is an example, not previous mail.</code></pre>';
  expect(normalizeMailboxContent(body).text).toContain('On Thu, Oct 8, 2026, Staff wrote:\n> This is an example, not previous mail.');
});
it('distinguishes Outlook forwards from replies using the existing subject', () => {
  const body = '<p>Sharing this message</p><div id="divRplyFwdMsg">From: Sender<br>Sent: Thursday<br>To: Customer<br>Subject: Proposal</div><p>Forwarded content</p>';
  expect(normalizeMailboxContent(body, { subject: 'Fwd: Proposal' }).text).toContain('Forwarded content');
  expect(normalizeMailboxContent(body, { subject: 'Re: Fwd: Proposal' }).text).toBe('Sharing this message');
  const doc = new DOMParser().parseFromString(mailboxDisplayDocument(body, {}, 'Fw: Proposal'), 'text/html');
  expect(doc.body.textContent).toContain('Forwarded content');
});
it('preserves Mozilla forward containers even when their inner blockquote uses type=cite', () => {
  const body = '<p>Sharing this message</p><div class="moz-forward-container"><div>From: Sender<br>Date: Thursday<br>Subject: Proposal</div><blockquote type="cite">Forwarded content</blockquote></div>';
  expect(normalizeMailboxContent(body).text).toContain('Forwarded content');
});
