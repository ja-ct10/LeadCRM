import { expect, it, vi } from 'vitest';
import { BUSINESS_INQUIRY_EMAIL } from '@leadcrm/shared';
import { businessEmailCallback, inquiryMetadata } from './business-email.service';
const starts = new Date(Date.now() - 10000);
const message = (headers: Array<{ name: string; value: string }> = [], labels = ['INBOX']) => ({ id: 'provider1', labelIds: labels, internalDate: String(Date.now() - 1000), snippet: 'I would like CCTV pricing.', payload: { headers: [{ name: 'From', value: 'New Customer <prospect@example.test>' }, { name: 'To', value: BUSINESS_INQUIRY_EMAIL }, { name: 'Subject', value: 'CCTV inquiry' }, ...headers] } });
it('captures an external inquiry without interpreting its subject as a purchase decision', () => {
  expect(inquiryMetadata(message(), starts)).toMatchObject({ sender: 'prospect@example.test', subject: 'CCTV inquiry', providerMessageId: 'provider1' });
});
it.each(['SPAM', 'TRASH', 'SENT', 'DRAFT'])('excludes %s messages', label => expect(inquiryMetadata(message([], ['INBOX', label]), starts)).toBeUndefined());
it.each([{ name: 'Auto-Submitted', value: 'auto-replied' }, { name: 'List-Id', value: 'newsletter' }, { name: 'Precedence', value: 'bulk' }])('excludes automated or bulk metadata $name', header => expect(inquiryMetadata(message([header]), starts)).toBeUndefined());
it('does not backfill messages predating the business-mailbox connection', () => expect(inquiryMetadata({ ...message(), internalDate: String(+starts - 1) }, starts)).toBeUndefined());

it('skips malformed and oversized provider metadata without poisoning the sync page', () => {
  for (const input of [null, {}, { ...message(), internalDate: 'invalid' }, { ...message(), snippet: 'x'.repeat(10001) }, message(Array.from({ length: 101 }, () => ({ name: 'Subject', value: 'x' }))), message([], Array(101).fill('INBOX'))]) {
    expect(inquiryMetadata(input, starts)).toBeUndefined();
  }
});
it('requires an incoming recipient match and excludes self, no-reply, future and non-inbox messages', () => {
  for (const input of [message([], []), { ...message(), internalDate: String(Date.now()+600000) }, { ...message(), payload: { headers: [{ name: 'From', value: BUSINESS_INQUIRY_EMAIL }, { name: 'To', value: BUSINESS_INQUIRY_EMAIL }] } }, { ...message(), payload: { headers: [{ name: 'From', value: 'noreply@example.test' }, { name: 'To', value: BUSINESS_INQUIRY_EMAIL }] } }, { ...message(), payload: { headers: [{ name: 'From', value: 'prospect@example.test' }, { name: 'To', value: 'someone-else@example.test' }] } }]) {
    expect(inquiryMetadata(input, starts)).toBeUndefined();
  }
});

it('accepts only a clean HTTPS callback, with HTTP limited to loopback development', () => {
  try {
    for (const origin of ['https://api.lead-crm.tech', 'http://localhost:4300']) {
      const url=origin+'/api/v1/integrations/business-email/callback'; vi.stubEnv('BUSINESS_EMAIL_REDIRECT_URI', url);
      expect(businessEmailCallback()).toBe(url);
    }
    for (const url of ['ftp://localhost/api/v1/integrations/business-email/callback', 'http://public.example/api/v1/integrations/business-email/callback', 'https://user:password@api.lead-crm.tech/api/v1/integrations/business-email/callback', 'https://api.lead-crm.tech/api/v1/integrations/business-email/callback?unexpected=true', 'https://api.lead-crm.tech/api/v1/integrations/business-email/callback#fragment']) {
      vi.stubEnv('BUSINESS_EMAIL_REDIRECT_URI', url); expect(() => businessEmailCallback()).toThrow('callback URL');
    }
  } finally { vi.unstubAllEnvs(); }
});
