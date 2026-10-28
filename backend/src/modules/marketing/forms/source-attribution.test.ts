import { describe, expect, it } from 'vitest';
import { AttributionContextSchema, classifySource, sourceAttribution, sourceCampaignLink, SOURCE_LINK_PRESETS, publicSubmissionContent } from '@leadcrm/shared';
const now = new Date('2026-10-28T05:00:00.000Z');
const touch = (params = {}, extra = {}) => ({ params, observedAt: now.toISOString(), ...extra });
describe('Source evidence', () => {
  it('keeps submission retry identity stable when PostgreSQL reorders nested JSON keys', () => {
    const first = { params: { utm_source: 'google', utm_medium: 'cpc' }, observedAt: now.toISOString() };
    const reordered = { observedAt: now.toISOString(), params: { utm_medium: 'cpc', utm_source: 'google' } };
    expect(publicSubmissionContent(1, {}, {}, { first, last: first, storage: 'session' })).toBe(publicSubmissionContent(1, {}, {}, { storage: 'session', last: reordered, first: reordered }));
  });
  it.each(SOURCE_LINK_PRESETS)('classifies $source / $medium as $category', row => {
    const link = new URL(sourceCampaignLink('https://crm.example.test/forms/public', row.source, row.medium));
    expect(classifySource(touch(Object.fromEntries(link.searchParams)))).toMatchObject({ source: row.source, category: row.category, method: 'url_tags' });
  });
  it('distinguishes organic Facebook from advertising and rejects lookalike domains', () => {
    expect(classifySource(touch({}, { referrer: 'https://m.facebook.com/' }))).toMatchObject({ channel: 'Organic Social' });
    expect(classifySource(touch({ fbclid: 'click' }))).toMatchObject({ channel: 'Direct / Unattributed' });
    expect(classifySource(touch({}, { referrer: 'https://facebook.com.evil.test/' }))).toMatchObject({ channel: 'Referral' });
  });
  it('retains unknown platform names without inventing a channel', () => {
    expect(classifySource(touch({ utm_source: 'new_network', utm_medium: 'new_medium' }))).toMatchObject({ source: 'new_network', category: 'Others', channel: 'Unassigned' });
  });
  it('does not infer Paid Search network from a Google click identifier', () => {
    expect(classifySource(touch({ gclid: 'example' }))).toMatchObject({ category: 'Google Ads', channel: 'Paid Other' });
  });
  it('does not accept full referrer queries, credentials or unknown properties', () => {
    const base = { first: touch(), last: touch(), storage: 'session' };
    expect(AttributionContextSchema.safeParse({ ...base, first: touch({}, { referrer: 'https://example.test/?email=private' }) }).success).toBe(false);
    expect(AttributionContextSchema.safeParse({ ...base, first: touch({}, { landingPage: 'https://user:pass@example.test/form' }) }).success).toBe(false);
    expect(AttributionContextSchema.safeParse({ ...base, tenantId: 'other' }).success).toBe(false);
  });
  it('discards expired and future touchpoints', () => {
    const old = touch({ utm_source: 'google', utm_medium: 'cpc' }, { observedAt: '2025-01-01T00:00:00.000Z' });
    const future = touch({ utm_source: 'google' }, { observedAt: '2099-01-01T00:00:00.000Z' });
    expect(sourceAttribution({ first: old, last: future, storage: 'remembered' }, now).last.channel).toBe('Direct / Unattributed');
  });
});
