import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../../../config/database.config', () => ({ default: { campaignContact: { findMany: store.findMany } } }));
import { readSmsLinkHistory, visitSmsLink } from '../sms-link-tracking';

const token = 'a'.repeat(24);
const history = { id: token, url: 'https://example.test/products?a=1&b=2#section',
  clickedAt: '2026-10-02T03:12:00.123', lastClickedAt: '2026-10-02T03:13:00.456', clickCount: 4 };

beforeEach(() => store.findMany.mockReset());
describe('retired SMS link receipts', () => {
  it('preserves exact destinations, counts and UTC timestamps from PostgreSQL JSON', () => {
    const [link] = readSmsLinkHistory([history]);
    expect(link).toEqual({ ...history, clickedAt: new Date('2026-10-02T03:12:00.123Z'), lastClickedAt: new Date('2026-10-02T03:13:00.456Z') });
    expect(readSmsLinkHistory([{ ...history, clickedAt: '2026-10-02T11:12:00.123+08:00', lastClickedAt: null }])[0].clickedAt?.toISOString()).toBe('2026-10-02T03:12:00.123Z');
  });

  it('ignores malformed receipts and unsafe or credential-bearing destinations', () => {
    for (const value of [null, {}, 'text', [null, [], {}, { ...history, id: 'bad' }, { ...history, url: 'javascript:alert(1)' },
      { ...history, url: 'https://user:password@example.test/' }, { ...history, clickCount: -1 }, { ...history, clickCount: 1.5 }]]) {
      expect(readSmsLinkHistory(value)).toEqual([]);
    }
    expect(readSmsLinkHistory([{ ...history, clickedAt: 'invalid', lastClickedAt: null }])[0]).toMatchObject({ clickedAt: null, lastClickedAt: null });
  });

  it('resolves an existing opaque token using bounded JSON containment and makes no writes', async () => {
    store.findMany.mockResolvedValue([{ smsLinkHistory: [history] }]);
    await expect(visitSmsLink(token)).resolves.toBe(history.url);
    expect(store.findMany).toHaveBeenCalledExactlyOnceWith({ where: { smsLinkHistory: { array_contains: [{ id: token }] } },
      select: { smsLinkHistory: true }, take: 2 });
    // The mock has no mutation delegates: every redirect is read-only.
    expect(readSmsLinkHistory([history])[0].clickCount).toBe(4);
  });

  it('rejects malformed, missing, duplicated and unsafe tokens without guessing a destination', async () => {
    await expect(visitSmsLink('invalid')).rejects.toMatchObject({ statusCode: 404 });
    expect(store.findMany).not.toHaveBeenCalled();
    for (const matches of [[], [{ smsLinkHistory: [history] }, { smsLinkHistory: [history] }],
      [{ smsLinkHistory: [history, history] }], [{ smsLinkHistory: [{ ...history, id: 'b'.repeat(24) }] }],
      [{ smsLinkHistory: [{ ...history, url: 'https://user:pass@example.test' }] }]]) {
      store.findMany.mockResolvedValue(matches);
      await expect(visitSmsLink(token)).rejects.toMatchObject({ statusCode: 404 });
    }
  });
});
