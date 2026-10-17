import { afterEach, describe, expect, it, vi } from 'vitest';
import { campaignTextLinkParts, mapCampaignTextLinks, smsCampaignTrackingUrl } from '@leadcrm/shared';
import { isSmsLinkPreview, prepareSmsLinks, smsTrackingOrigin } from '../sms-link-tracking';

afterEach(() => vi.unstubAllEnvs());
describe('SMS recipient links', () => {
  it('splits preview links without losing text, punctuation or unresolved variables', () => {
    const message = 'Hi {{firstName}}, visit (https://example.test/a(b)?x=1&y=2#here). Next https://other.test! Pending https://example.test/{{customFieldValues.slug}}';
    const parts = campaignTextLinkParts(message);
    expect(parts.map(part => part.text).join('')).toBe(message);
    expect(parts.filter(part => part.url).map(part => part.url)).toEqual(['https://example.test/a(b)?x=1&y=2#here', 'https://other.test']);
    expect(campaignTextLinkParts('')).toEqual([]);
  });
  it('preserves exact destinations, queries, fragments and surrounding punctuation', () => {
    const prepared = prepareSmsLinks('Visit (https://example.test/a(b)?x=1&y=2#section). Again https://example.test/a(b)?x=1&y=2#section!', 'https://crm.example.test');
    expect(prepared.links).toHaveLength(1);
    expect(prepared.links[0].url).toBe('https://example.test/a(b)?x=1&y=2#section');
    const url = smsCampaignTrackingUrl('https://crm.example.test', prepared.links[0].id);
    expect(prepared.message).toBe(`Visit (${url}). Again ${url}!`);
    expect(prepareSmsLinks('https://example.test/a(b)?x=1&y=2#section', 'https://crm.example.test').links[0].id).not.toBe(prepared.links[0].id);
  });
  it('does not transform unsafe schemes or credential-bearing destinations', () => {
    expect(mapCampaignTextLinks('javascript:alert(1) https://user:pass@example.test/ mailto:a@example.test', () => 'changed')).not.toContain('changed');
  });
  it.each(['https://example.test/path', 'https://user:pass@example.test', 'https://example.test/?key=1', 'ftp://example.test'])('rejects invalid tracking origin %s', origin => {
    expect(() => prepareSmsLinks('https://example.test/', origin)).toThrow();
  });
  it('requires a public HTTPS website origin in production without blocking link-free SMS', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('APP_URL', 'http://localhost:3000');
    expect(() => smsTrackingOrigin()).toThrow('Configure APP_URL');
    expect(prepareSmsLinks('A plain SMS')).toMatchObject({ message: 'A plain SMS', links: [] });
    vi.stubEnv('APP_URL', 'https://crm.example.test'); expect(smsTrackingOrigin()).toBe('https://crm.example.test');
  });
  it.each([
    ['HEAD', {}], ['GET', { purpose: 'prefetch' }], ['GET', { secPurpose: 'prefetch;prerender' }],
    ['GET', { userAgent: 'WhatsApp/2.0' }], ['GET', { userAgent: 'facebookexternalhit/1.1' }], ['GET', { userAgent: 'Googlebot' }],
  ])('ignores known preview request %s %j', (method, headers) => expect(isSmsLinkPreview(method, headers)).toBe(true));
  it('accepts an ordinary browser visit without claiming it proves SMS delivery', () => {
    expect(isSmsLinkPreview('GET', { userAgent: 'Mozilla/5.0 (Android) Chrome/130' })).toBe(false);
  });
});
