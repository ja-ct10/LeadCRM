import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readRememberedEmail, rememberLoginEmail, REMEMBERED_EMAIL_KEY } from './remembered-login';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('stores one normalized identifier and removes it when the preference is disabled', () => {
  rememberLoginEmail(' Staff@CAMXIAN.COM ', true);
  expect(readRememberedEmail()).toBe('staff@camxian.com');
  expect(localStorage.length).toBe(1);
  rememberLoginEmail('staff@camxian.com', false);
  expect(readRememberedEmail()).toBe(''); expect(localStorage.length).toBe(0);
});
it('rejects malformed persisted identifiers', () => {
  localStorage.setItem(REMEMBERED_EMAIL_KEY, '{"password":"never-autofill"}');
  expect(readRememberedEmail()).toBe('');
});
it('tolerates blocked browser storage without breaking authentication', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(readRememberedEmail()).toBe('');
  expect(() => rememberLoginEmail('staff@camxian.com', true)).not.toThrow();
  expect(() => rememberLoginEmail('', false)).not.toThrow();
});
