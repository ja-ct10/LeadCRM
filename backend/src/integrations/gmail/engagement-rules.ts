import sanitizeHtml from 'sanitize-html';
import { CrmStatus, normalizeCrmStatus } from '@leadcrm/shared';

export const COLD_AFTER_DAYS = 60;
export type Engagement = 'none' | 'interested' | 'quotation' | 'proceed' | 'cancel';
export function normalizeEmail(value: string): string {
  const address = value.match(/<([^<>]+)>/)?.[1] ?? value;
  return address.trim().toLowerCase();
}

/** Only classify the customer's new text, never quoted staff messages or signatures. */
export function newMessageText(body: string): string {
  const text = sanitizeHtml(body.replace(/<\/(?:p|div|tr)>|<br\s*\/?\s*>/gi, '\n'), {
    allowedTags: [], allowedAttributes: {}, nonTextTags: ['script', 'style', 'blockquote'],
    transformTags: { '*': (tagName, attribs) => ({ tagName: /gmail_quote|yahoo_quoted|moz-cite-prefix/.test(attribs.class ?? '') ? 'blockquote' : tagName, attribs }) },
    textFilter: text => text,
  }).replace(/&nbsp;/gi, ' ').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return text.split(/\n\s*(?:On .+wrote:|From:|[-_]{2,}|Sent from my)|\n>/i)[0].trim().toLowerCase();
}

export function hasBusinessContext(text: string): boolean {
  return /\b(product|service|quotation|quote|proposal|contract|pricing|price|purchase|order|invoice|agreement|scope of work|installation|requirements|subscription)\b/i.test(text);
}

/** Conservative English rules: ambiguity is an abstention, never a model-generated state. */
export function classifyEngagement(body: string, businessThread = false, automated = false): Engagement {
  if (automated) return 'none';
  const text = newMessageText(body);
  if (!text || /\b(out of office|automatic reply|automated message|delivery failed|mailer-daemon)\b/.test(text)) return 'none';
  // Conditional, reported, negated or tentative purchase language must not change strong states.
  const uncertain = /\b(if|maybe|might|may|perhaps|unless|not yet|not ready|cannot|can't|couldn't|won't|would not|haven't|not approved|don't approve|do not approve|let me|let us|manager|said|says|pending|awaiting|subject to|once|after|before|however|but)\b/.test(text);
  if (!uncertain && !/\?/.test(text) && /\b(?:we|i) (?:are |am )?(?:no longer interested|not interested)(?:[.!]|$| in (?:the |your |this )?(?:product|service|proposal|quotation|purchase)[.!]?)|\b(?:please |we want to |i want to )(?:cancel (?:the |our |my )?(?:order|purchase|transaction|opportunity|contract)|do not proceed|don't proceed|stop (?:the |our |my )?(?:transaction|order))|\b(?:we|i) (?:decline|reject) (?:the |your )?(?:proposal|quotation|offer)\b/.test(text)) return 'cancel';
  const negated = /\b(no|not|never|don't|do not|cancel|decline|reject|undecided|still deciding|considering|comparing)\b/.test(text);
  if ((businessThread || hasBusinessContext(text) || /\b(?:purchase|buy)\b/.test(text)) && !/\b(?:meeting|interview|appointment)\b/.test(text) && !uncertain && !negated && !/\?/.test(text) && /\b(?:we|i) (?:want to|would like to|have decided to|will|are ready to|am ready to) (?:proceed|purchase|buy|move forward)|\b(?:please proceed with|we approve (?:the |your )?(?:quotation|quote|proposal|contract)|i approve (?:the |your )?(?:quotation|quote|proposal|contract)|we confirm (?:the |our )?(?:order|purchase))\b/.test(text)) return 'proceed';
  if (!uncertain && !/\b(?:don't|do not|no need|not need|not requesting|cancel|decline|reject)\b/.test(text) && /\b(?:please (?:send|provide|prepare)|(?:can|could|would) you (?:send|provide|prepare)|(?:we|i) (?:need|request|would like))\b.{0,65}\b(?:quotation|quote|proposal|contract|agreement|final pricing|formal pricing|purchase terms|scope of work)\b/.test(text)) return 'quotation';
  if (!/\bnot interested\b/.test(text) && (businessThread || hasBusinessContext(text)) && /\b(?:can you|could you|how (?:much|does|do|long)|what (?:is|are)|tell (?:me|us)|more (?:information|details)|interested in|our requirements|still deciding|comparing (?:the )?options)\b/.test(text)) return 'interested';
  return 'none';
}

export function engagementStatus(current: string, engagement: Engagement): CrmStatus | undefined {
  const status = normalizeCrmStatus(current);
  if (status === 'Closed' || status === 'Cancelled' || engagement === 'none') return;
  if (engagement === 'cancel') return 'Cancelled';
  if (engagement === 'proceed') return 'Hot';
  return status === 'Hot' ? undefined : 'Warm';
}

export function eligibleForCold(record: { status: string; lastMeaningfulInboundAt: Date | null; firstUnansweredOutboundAt: Date | null; lastStatusChangedAt: Date | null }, now = new Date()): boolean {
  const inbound = record.lastMeaningfulInboundAt, outbound = record.firstUnansweredOutboundAt;
  return ['Warm', 'Hot'].includes(normalizeCrmStatus(record.status)) && !!inbound && !!outbound
    && outbound > inbound && now.getTime() - inbound.getTime() >= COLD_AFTER_DAYS * 86400000
    && now.getTime() - outbound.getTime() >= 30 * 86400000
    && (!record.lastStatusChangedAt || record.lastStatusChangedAt <= inbound);
}

export const ENGAGEMENT_REASONS: Record<Exclude<Engagement, 'none'>, string> = {
  interested: 'Customer asked about the product or is considering options by email.',
  quotation: 'Customer requested a quotation, proposal or formal purchase terms by email.',
  proceed: 'Customer confirmed intent to proceed by email. Staff confirmation is required to close the sale.',
  cancel: 'Customer explicitly cancelled or declined the opportunity by email.',
};
