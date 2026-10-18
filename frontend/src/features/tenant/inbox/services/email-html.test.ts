import { expect, it } from 'vitest';
import { safeMailboxHtml, trimmedMailboxHtml, mailboxDisplayDocument } from './email-html';
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
it('resolves only known CID raster blobs, retains plain text and folds recognizable quotes', () => {
  const doc = new DOMParser().parseFromString(mailboxDisplayDocument('<pre>A &lt; B\nSecond line</pre><img src="cid:logo%40mail"><img src="blob:untrusted"><img src="data:image/svg+xml,bad"><blockquote>History</blockquote>', { 'logo@mail': 'blob:authorized-image' }), 'text/html');
  expect(doc.querySelector('pre')?.textContent).toBe('A < B\nSecond line');
  expect(doc.querySelector('img')?.getAttribute('src')).toBe('blob:authorized-image');
  expect([...doc.querySelectorAll('img')].slice(1).every(img => !img.hasAttribute('src'))).toBe(true);
  expect(doc.querySelector('details summary')?.textContent).toBe('Show trimmed content');
});
it('contains sender markup and restricts navigation without hiding ambiguous customer text', () => {
  const html = '<div class="fixed inset-0" style="position:fixed"><iframe src="https://tracker.test"></iframe><object>bad</object><embed src="x"><a href="/crm/leads">internal path</a><a href="data:text/html,bad">data</a><a href="https://example.test" onclick="bad()">safe</a></div>';
  const clean = safeMailboxHtml(html);
  expect(clean).not.toMatch(/class=|style=|iframe|object|embed|onclick|href="\/|data:/);
  expect(clean).toContain('rel="noopener noreferrer"'); expect(clean).toContain('target="_blank"');
  expect(trimmedMailboxHtml('<p>On Thursday we wrote a proposal.</p>')).not.toContain('<details');
  expect(trimmedMailboxHtml('<p>Reply</p><blockquote>History</blockquote><p>Answer after quote</p>')).toContain('</details><p>Answer after quote</p>');
});
