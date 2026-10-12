import { expect, it } from 'vitest';
import { matchesSearch } from './search';
it('matches full names, mixed case and repeated whitespace across fields', () => {
  expect(matchesSearch('  CRUZ   Mary ', 'Mary Jane', 'de la Cruz', 'mary@example.test')).toBe(true);
  expect(matchesSearch('mary missing', 'Mary Jane', 'de la Cruz')).toBe(false);
});
it('keeps email text intact and treats a cleared search as all records', () => {
  expect(matchesSearch('mary@example.test', 'Mary', 'mary@example.test')).toBe(true);
  expect(matchesSearch(' ', undefined, null)).toBe(true);
});
