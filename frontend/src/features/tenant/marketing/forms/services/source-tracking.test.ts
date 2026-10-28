import { beforeEach, expect, it } from 'vitest';
import { captureFormSource, rememberFormSource } from './source-tracking';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/forms/public'); });
it('preserves tagged first touch across navigation and remembers only after opt-in', () => {
  window.history.replaceState({}, '', '/forms/public?utm_source=google&utm_medium=cpc&email=private');
  const first = captureFormSource('public');
  expect(first.first.params).toEqual({ utm_source: 'google', utm_medium: 'cpc' });
  expect(first.first.landingPage).not.toContain('private');
  expect(localStorage.length).toBe(0);
  rememberFormSource('public', first, true);
  window.history.replaceState({}, '', '/forms/public');
  expect(captureFormSource('public').last.params.utm_source).toBe('google');
});
it('keeps first touch and updates the latest source for a new campaign', () => {
  window.history.replaceState({}, '', '/forms/public?utm_source=facebook&utm_medium=paid_social');
  captureFormSource('public');
  window.history.replaceState({}, '', '/forms/public?utm_source=newsletter&utm_medium=email');
  const current = captureFormSource('public');
  expect(current.first.params.utm_source).toBe('facebook'); expect(current.last.params.utm_source).toBe('newsletter');
});
