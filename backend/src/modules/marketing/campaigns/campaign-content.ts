import sanitizeHtml from 'sanitize-html';
import { renderEmailVariables, EmailSubjectSchema, type EmailVariables } from '@leadcrm/shared';
import { AppError } from '../../../shared/errors/app-error';

export function sanitizeCampaignHtml(body: string): string {
  return sanitizeHtml(body, {
    allowedTags: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr'],
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
    allowedSchemes: ['https', 'http', 'mailto'], allowProtocolRelative: false,
  }).trim();
}
export function renderCampaignMessage(subject: string, body: string, values: EmailVariables) {
  const renderedSubject = EmailSubjectSchema.parse(renderEmailVariables(subject, values));
  if (!renderedSubject) throw new AppError('Personalized subject is empty.', 400);
  const content = body.replace(/\r?\n/g, '<br>');
  const html = sanitizeCampaignHtml(renderEmailVariables(content, values, true));
  if (!sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()) throw new AppError('Body must contain message text.', 400);
  return { subject: renderedSubject, html };
}
