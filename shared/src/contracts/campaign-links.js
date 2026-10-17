"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMS_LINK_TOKEN_PATTERN = exports.CAMPAIGN_EMAIL_ATTRIBUTES = exports.CAMPAIGN_EMAIL_TAGS = void 0;
exports.campaignLinkDestination = campaignLinkDestination;
exports.campaignTextLinkParts = campaignTextLinkParts;
exports.mapCampaignTextLinks = mapCampaignTextLinks;
exports.smsCampaignTrackingUrl = smsCampaignTrackingUrl;
exports.linkifyCampaignHtml = linkifyCampaignHtml;
exports.styleCampaignEmailLinks = styleCampaignEmailLinks;
exports.campaignHtmlLinks = campaignHtmlLinks;
const campaign_email_1 = require("./campaign-email");
// Both sanitizers use this allowlist before the shared text-node transformation.
exports.CAMPAIGN_EMAIL_TAGS = ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr'];
exports.CAMPAIGN_EMAIL_ATTRIBUTES = { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
function campaignLinkDestination(value) {
    if (!/^https?:\/\//i.test(value) || /[\s<>"'\x00-\x1f\x7f]/.test(value))
        return null;
    try {
        const url = new URL(value);
        return url.hostname && !url.username && !url.password ? value : null;
    }
    catch {
        return null;
    }
}
/** Plain-text URLs share the email linkifier's punctuation rules. */
function campaignTextLinkParts(text) {
    const parts = [];
    let position = 0;
    for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
        const candidate = match[0];
        let url = candidate;
        while (/[.,;:!?]$/.test(url))
            url = url.slice(0, -1);
        for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
            while (url.endsWith(close) && url.split(close).length > url.split(open).length)
                url = url.slice(0, -1);
        }
        if (url.includes('{{') || !campaignLinkDestination(url))
            continue;
        if (match.index > position)
            parts.push({ text: text.slice(position, match.index) });
        parts.push({ text: url, url });
        position = match.index + url.length;
    }
    if (position < text.length)
        parts.push({ text: text.slice(position) });
    return parts;
}
function mapCampaignTextLinks(text, replace) {
    return campaignTextLinkParts(text).map(part => part.url ? replace(part.url) : part.text).join('');
}
exports.SMS_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;
function smsCampaignTrackingUrl(origin, token) {
    const url = new URL(origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !exports.SMS_LINK_TOKEN_PATTERN.test(token)) {
        throw new Error('Invalid SMS tracking origin or token.');
    }
    return `${url.origin}/s/${token}`;
}
function decodeEntities(value) {
    return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, entity => {
        const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
        if (named[entity.toLowerCase()])
            return named[entity.toLowerCase()];
        const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
}
/** Input MUST already be sanitized. Existing anchors and attributes are untouched.
 * Aggregate destinations by their exact decoded href; queries/fragments stay distinct.
 */
function linkifyCampaignHtml(safeHtml) {
    let anchorDepth = 0;
    return safeHtml.split(/(<(?:[^>"']|"[^"]*"|'[^']*')*>)/g).map(part => {
        if (part.startsWith('<')) {
            if (/^<a(?:\s|>)/i.test(part))
                anchorDepth++;
            if (/^<\/a\s*>/i.test(part))
                anchorDepth = Math.max(0, anchorDepth - 1);
            return part;
        }
        const text = part.replace(/\r\n?|\n/g, '<br>');
        if (anchorDepth)
            return text;
        // Keep surrounding sanitized text/entities intact. Decode only candidate
        // destinations and escape them once, preventing double-encoded queries.
        return part.split(/(https?:\/\/(?:(?!&(?:quot|apos|lt|gt|#39);)[^\s<>"'])+)/gi).map((segment, index) => {
            if (index % 2 === 0)
                return segment.replace(/\r\n?|\n/g, '<br>');
            let url = decodeEntities(segment);
            const decoded = url;
            while (/[.,;:!?]$/.test(url))
                url = url.slice(0, -1);
            for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
                while (url.endsWith(close) && url.split(close).length > url.split(open).length)
                    url = url.slice(0, -1);
            }
            const suffix = decoded.slice(url.length);
            return !url.includes('{{') && campaignLinkDestination(url) ? `<a href="${(0, campaign_email_1.escapeEmailHtml)(url)}">${(0, campaign_email_1.escapeEmailHtml)(url)}</a>${(0, campaign_email_1.escapeEmailHtml)(suffix)}` : (0, campaign_email_1.escapeEmailHtml)(segment);
        }).join('');
    }).join('');
}
/** Apply trusted presentation after sanitization; user-supplied CSS stays disallowed. */
function styleCampaignEmailLinks(safeHtml) {
    return linkifyCampaignHtml(safeHtml).replace(/<a\b([^>]*)>/gi, (tag, attributes) => /\bhref\s*=/.test(attributes) ? `<a${attributes} style="color: #2563eb; text-decoration: underline;">` : tag);
}
function campaignHtmlLinks(safeHtml) {
    return [...new Set([...linkifyCampaignHtml(safeHtml).matchAll(/<a\s[^>]*?href="([^"]*)"/gi)]
            .map(match => campaignLinkDestination(decodeEntities(match[1])))
            .filter((url) => url !== null))];
}
