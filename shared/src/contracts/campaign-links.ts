import { escapeEmailHtml } from './campaign-email';

// Both sanitizers use this allowlist before the shared text-node transformation.
export const CAMPAIGN_EMAIL_TAGS = ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr'];
export const CAMPAIGN_EMAIL_ATTRIBUTES = { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };

export function campaignLinkDestination(value: string): string | null {
  if (!/^https?:\/\//i.test(value) || /[\s<>"'\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? value : null;
  } catch { return null; }
}

/** Plain-text URLs share the email linkifier's punctuation rules. */
export function campaignTextLinkParts(text: string): Array<{ text: string; url?: string }> {
  const parts: Array<{ text: string; url?: string }> = [];
  let position = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const candidate = match[0];
    let url = candidate;
    while (/[.,;:!?]$/.test(url)) url = url.slice(0, -1);
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
    }
    if (url.includes('{{') || !campaignLinkDestination(url)) continue;
    if (match.index! > position) parts.push({ text: text.slice(position, match.index) });
    parts.push({ text: url, url });
    position = match.index! + url.length;
  }
  if (position < text.length) parts.push({ text: text.slice(position) });
  return parts;
}
export function mapCampaignTextLinks(text: string, replace: (url: string) => string): string {
  return campaignTextLinkParts(text).map(part => part.url ? replace(part.url) : part.text).join('');
}

export const SMS_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;
export function smsCampaignTrackingUrl(origin: string, token: string): string {
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !SMS_LINK_TOKEN_PATTERN.test(token)) {
    throw new Error('Invalid SMS tracking origin or token.');
  }
  return `${url.origin}/s/${token}`;
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

/** Input MUST already be sanitized. Existing anchors and attributes are untouched.
 * Aggregate destinations by their exact decoded href; queries/fragments stay distinct.
 */
export function linkifyCampaignHtml(safeHtml: string): string {
  let anchorDepth = 0;
  return safeHtml.split(/(<(?:[^>"']|"[^"]*"|'[^']*')*>)/g).map(part => {
    if (part.startsWith('<')) {
      if (/^<a(?:\s|>)/i.test(part)) anchorDepth++;
      if (/^<\/a\s*>/i.test(part)) anchorDepth = Math.max(0, anchorDepth - 1);
      return part;
    }
    const text = part.replace(/\r\n?|\n/g, '<br>');
    if (anchorDepth) return text;
    // Keep surrounding sanitized text/entities intact. Decode only candidate
    // destinations and escape them once, preventing double-encoded queries.
    return part.split(/(https?:\/\/(?:(?!&(?:quot|apos|lt|gt|#39);)[^\s<>"'])+)/gi).map((segment, index) => {
      if (index % 2 === 0) return segment.replace(/\r\n?|\n/g, '<br>');
      let url = decodeEntities(segment);
      const decoded = url;
      while (/[.,;:!?]$/.test(url)) url = url.slice(0, -1);
      for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
        while (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
      }
      const suffix = decoded.slice(url.length);
      return !url.includes('{{') && campaignLinkDestination(url) ? `<a href="${escapeEmailHtml(url)}">${escapeEmailHtml(url)}</a>${escapeEmailHtml(suffix)}` : escapeEmailHtml(segment);
    }).join('');
  }).join('');
}

/** Apply trusted presentation after sanitization; user-supplied CSS stays disallowed. */
export function styleCampaignEmailLinks(safeHtml: string): string {
  return linkifyCampaignHtml(safeHtml).replace(/<a\b([^>]*)>/gi, (tag, attributes: string) =>
    /\bhref\s*=/.test(attributes) ? `<a${attributes} style="color: #2563eb; text-decoration: underline;">` : tag);
}

export function campaignHtmlLinks(safeHtml: string): string[] {
  return [...new Set([...linkifyCampaignHtml(safeHtml).matchAll(/<a\s[^>]*?href="([^"]*)"/gi)]
    .map(match => campaignLinkDestination(decodeEntities(match[1])))
    .filter((url): url is string => url !== null))];
}
