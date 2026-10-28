import { ATTRIBUTION_KEYS, AttributionContextSchema, classifySource, type AttributionContext, type AttributionTouch } from '@leadcrm/shared';

export function captureFormSource(publicId: string): AttributionContext {
  const now = new Date(), params: Record<string, string> = {}, url = new URL(window.location.href);
  for (const key of ATTRIBUTION_KEYS) { const v = url.searchParams.get(key); if (v) params[key] = v.replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim().slice(0, 200); }
  let referrer: string | undefined;
  try { const origin = new URL(document.referrer).origin; if (origin !== url.origin) referrer = origin + '/'; } catch { /* No referral evidence. */ }
  const touch: AttributionTouch = { params, observedAt: now.toISOString(), landingPage: url.origin + url.pathname, ...(referrer ? { referrer } : {}) };
  const key = 'leadcrm-source:' + publicId;
  let context: AttributionContext = { first: touch, last: touch, storage: 'session' };
  try {
    const previous = AttributionContextSchema.safeParse(JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || 'null'));
    if (previous.success && +now - Date.parse(previous.data.first.observedAt) < 30 * 86400000 && Date.parse(previous.data.first.observedAt) <= +now) {
      context = { ...previous.data, last: classifySource(touch).method === 'unattributed' ? previous.data.last : touch };
    }
    (context.storage === 'remembered' ? localStorage : sessionStorage).setItem(key, JSON.stringify(context));
  } catch { context.storage = 'unavailable'; }
  return context;
}
export function rememberFormSource(publicId: string, context: AttributionContext, remember: boolean): AttributionContext {
  const updated: AttributionContext = { ...context, storage: remember ? 'remembered' : 'session' };
  try {
    const key = 'leadcrm-source:' + publicId;
    localStorage.removeItem(key); sessionStorage.removeItem(key);
    (remember ? localStorage : sessionStorage).setItem(key, JSON.stringify(updated));
  } catch { updated.storage = 'unavailable'; }
  return updated;
}
