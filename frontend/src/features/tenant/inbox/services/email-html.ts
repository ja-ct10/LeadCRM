import DOMPurify from 'dompurify';

function mailboxFragment(html: string) {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    // Classes are inspected for provider quote markers, then removed before rendering.
    ALLOWED_ATTR: ['href', 'title', 'class'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll('a').forEach(link => {
    if (!/^(https?:\/\/|mailto:)/i.test(link.getAttribute('href') ?? '')) link.removeAttribute('href');
    else { link.setAttribute('rel', 'noopener noreferrer'); link.setAttribute('target', '_blank'); }
  });
  return fragment;
}
function serialize(fragment: DocumentFragment) {
  fragment.querySelectorAll('[class]').forEach(element => element.removeAttribute('class'));
  const container = document.createElement('div'); container.append(fragment);
  return container.innerHTML;
}

/** Mail is untrusted: no remote resources, CSS, executable elements or unsafe links. */
export function safeMailboxHtml(html: string): string { return serialize(mailboxFragment(html)); }

/** Only structural quotes are folded; original content and ordering remain intact.
 * Unknown plaintext separators deliberately remain visible. */
export function trimmedMailboxHtml(html: string): string {
  const fragment = mailboxFragment(html);
  const selector = 'blockquote, .gmail_quote';
  const quotes = [...fragment.querySelectorAll(selector)].filter(element => !element.parentElement?.closest(selector));
  for (const quote of quotes) {
    if (!quote.textContent?.trim()) continue;
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Show trimmed content';
    quote.replaceWith(details); details.append(summary, quote);
  }
  return serialize(fragment);
}

export const mailboxContentId = (value: string) => {
  try { return decodeURIComponent(value.replace(/^cid:/i, '')).trim().replace(/^<|>$/g, ''); } catch { return ''; }
};
export function mailboxReferencedContentIds(html: string): Set<string> {
  const fragment = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['img'], ALLOWED_ATTR: ['src'], RETURN_DOM_FRAGMENT: true });
  return new Set([...fragment.querySelectorAll('img[src]')].flatMap(img => /^cid:/i.test(img.getAttribute('src') ?? '') ? [mailboxContentId(img.getAttribute('src')!)] : []));
}

/** Display only. This document MUST stay in a script-disabled sandbox, never the app DOM.
 * DOMPurify validates markup; the frame CSP contains CSS and resource loading. */
export function mailboxDisplayDocument(html: string, inlineImages: Record<string, string> = {}): string {
  const root = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true, RETURN_DOM: true,
    ALLOWED_TAGS: ['html', 'head', 'body', 'style', 'p', 'br', 'hr', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'center', 'font', 'details', 'summary'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style', 'width', 'height', 'align', 'valign', 'bgcolor', 'background', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'size', 'face', 'color', 'dir', 'lang'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
  }) as HTMLElement;
  root.querySelectorAll('a').forEach(link => {
    if (!/^(https?:\/\/|mailto:)/i.test(link.getAttribute('href') ?? '')) link.removeAttribute('href');
    else { link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer'); }
  });
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') ?? '';
    const resolved = /^cid:/i.test(src) ? inlineImages[mailboxContentId(src)] : src;
    // Only application-created blobs can enter through the CID map.
    if (resolved && (/^https?:\/\//i.test(resolved) || /^cid:/i.test(src) && /^blob:/.test(resolved))) img.setAttribute('src', resolved);
    else img.removeAttribute('src');
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.removeAttribute('srcset');
  });
  root.querySelectorAll('[background]').forEach(element => {
    if (!/^https?:\/\//i.test(element.getAttribute('background') ?? '')) element.removeAttribute('background');
  });
  const selector = 'blockquote, .gmail_quote';
  for (const quote of [...root.querySelectorAll(selector)].filter(element => !element.parentElement?.closest(selector))) {
    if (!quote.textContent?.trim()) continue;
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = 'Show trimmed content'; quote.replaceWith(details); details.append(summary, quote);
  }
  const head = root.querySelector('head');
  const csp = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: http: blob:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  head?.insertAdjacentHTML('afterbegin', `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{background:white;color:#111}body{margin:0;display:flow-root;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}summary{cursor:pointer;margin:12px 0;font:12px sans-serif;color:#666}</style>`);
  return '<!doctype html>' + root.outerHTML;
}
