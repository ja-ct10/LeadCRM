import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureFormSource } from './source-tracking';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/forms/public'); });
afterEach(() => vi.restoreAllMocks());
it('preserves tagged first touch across navigation only within the session', () => {
  window.history.replaceState({}, '', '/forms/public?utm_source=google&utm_medium=cpc&email=private');
  const first = captureFormSource('public');
  expect(first.first.params).toEqual({ utm_source: 'google', utm_medium: 'cpc' });
  expect(first.first.landingPage).not.toContain('private');
  expect(localStorage.length).toBe(0);
  window.history.replaceState({}, '', '/forms/public');
  expect(captureFormSource('public').last.params.utm_source).toBe('google');
  expect(localStorage.length).toBe(0);
  sessionStorage.clear();
  expect(captureFormSource('public').last.params).toEqual({});
});
it('removes and ignores previously remembered attribution', () => {
  const touch = { params: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'old' }, observedAt: new Date().toISOString() };
  const remembered = JSON.stringify({ first: touch, last: touch, storage: 'remembered' });
  localStorage.setItem('leadcrm-source:public', remembered);
  sessionStorage.setItem('leadcrm-source:public', remembered);
  localStorage.setItem('unrelated', 'keep');
  expect(captureFormSource('public')).toMatchObject({ first: { params: {} }, last: { params: {} }, storage: 'session' });
  expect(localStorage.getItem('leadcrm-source:public')).toBeNull();
  expect(localStorage.getItem('unrelated')).toBe('keep');
});
it('captures existing campaign tags and keeps form sessions isolated', () => {
  window.history.replaceState({}, '', '/forms/public?utm_source=google&utm_medium=cpc&utm_campaign=existing_link');
  expect(captureFormSource('public').last.params.utm_campaign).toBe('existing_link');
  window.history.replaceState({}, '', '/forms/other');
  expect(captureFormSource('other').first.params).toEqual({});
});
it('still captures current URL evidence when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  window.history.replaceState({}, '', '/forms/public?utm_source=partner&utm_medium=referral');
  expect(captureFormSource('public')).toMatchObject({ last: { params: { utm_source: 'partner' } }, storage: 'unavailable' });
});
it('keeps first touch and updates the latest source for a new campaign', () => {
  window.history.replaceState({}, '', '/forms/public?utm_source=facebook&utm_medium=paid_social');
  captureFormSource('public');
  window.history.replaceState({}, '', '/forms/public?utm_source=newsletter&utm_medium=email');
  const current = captureFormSource('public');
  expect(current.first.params.utm_source).toBe('facebook'); expect(current.last.params.utm_source).toBe('newsletter');
});
