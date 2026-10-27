import DOMPurify from 'dompurify';
import { CAMPAIGN_EMAIL_TAGS, CAMPAIGN_EMAIL_ATTRIBUTES, styleCampaignEmailLinks, renderEmailVariables, type EmailVariables } from '@leadcrm/shared';
import { THEME_PALETTES, type ResolvedTheme } from '@/lib/appearance-config';
import { ACCENT_COLORS } from '@/lib/accent-colors';

export function sanitizeCampaignBody(body: string): string {
  const html = DOMPurify.sanitize(body, { ALLOWED_TAGS: CAMPAIGN_EMAIL_TAGS,
    ALLOWED_ATTR: [...new Set(Object.values(CAMPAIGN_EMAIL_ATTRIBUTES).flat())], ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i });
  // DOMPurify's attribute list is global; apply the shared per-element policy.
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const element of template.content.querySelectorAll('*')) {
    const allowed = CAMPAIGN_EMAIL_ATTRIBUTES[element.tagName.toLowerCase() as keyof typeof CAMPAIGN_EMAIL_ATTRIBUTES] ?? [];
    for (const attribute of [...element.attributes]) if (!allowed.includes(attribute.name)) element.removeAttribute(attribute.name);
  }
  return template.innerHTML.trim();
}

export function renderCampaignPreview(body: string, variables: EmailVariables): string {
  return styleCampaignEmailLinks(sanitizeCampaignBody(renderEmailVariables(body, variables, true)));
}

/** Presentation belongs only to the sandboxed preview, never the saved/sent body. */
export function campaignPreviewDocument(body: string, variables: EmailVariables, theme: ResolvedTheme, accent: string): string {
  const dark = theme === 'dark';
  const palette = THEME_PALETTES[theme];
  const primary = (ACCENT_COLORS.find(color => color.id === accent) ?? ACCENT_COLORS[0]).primary;
  return `<!doctype html><html><head><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="${dark ? 'dark' : 'light'}"><base target="_blank"><style>
    html,body{background:${palette.card};color:${dark ? '#f1f5f9' : '#25313d'};color-scheme:${dark ? 'dark' : 'light'}}
    body{font:14px/1.6 system-ui;margin:0;overflow-wrap:anywhere}
    a{color:${dark ? `color-mix(in srgb, ${primary} 65%, white)` : primary}!important;text-decoration:underline}
    img,table{max-width:100%}td,th,hr,blockquote{border-color:${dark ? '#475569' : '#cbd5e1'}}
  </style></head><body>${renderCampaignPreview(body, variables)}</body></html>`;
}

/** Persist the anchors that the preview shows so every sender receives HTML links. */
export function prepareCampaignBody(body: string): string {
  return styleCampaignEmailLinks(sanitizeCampaignBody(body));
}
