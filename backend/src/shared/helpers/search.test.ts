import { expect, it } from 'vitest';
import { buildSearchClauses } from './search';

it('matches multiword names across fields and normalizes whitespace before querying', () => {
  const clauses = buildSearchClauses('  Mary  Jane\tde la Cruz ', ['firstName', 'lastName', 'email']);
  expect(clauses).toHaveLength(5);
  expect(clauses[0].OR).toContainEqual({ firstName: { contains: 'Mary', mode: 'insensitive' } });
  expect(clauses[4].OR).toContainEqual({ lastName: { contains: 'Cruz', mode: 'insensitive' } });
});
it('keeps email and company tokens intact and includes canonical related labels', () => {
  const clauses = buildSearchClauses('juan@example.test', ['email'], contains => [{ account: { name: contains } }]);
  expect(clauses).toEqual([{ OR: [
    { email: { contains: 'juan@example.test', mode: 'insensitive' } },
    { account: { name: { contains: 'juan@example.test', mode: 'insensitive' } } },
  ] }]);
});
it.each(['  ', null, {}, 42])('treats empty or nonstring search as no text filter (%j)', value => {
  expect(buildSearchClauses(value, ['name'])).toEqual([]);
});
it.each([
  ['+63 (917) 123-4567', '639171234567'], ['0917-123-4567', '639171234567'],
  ['0917', '63917'],
])('matches a formatted telephone query %s against normalized storage', (query, expected) => {
  const clauses = buildSearchClauses(query, ['firstName', 'phone']);
  expect(clauses).toHaveLength(1);
  expect(clauses[0].OR).toContainEqual({ phone: { contains: expected, mode: 'insensitive' } });
});
it('matches a local phone prefix alongside a name term', () => {
  const clauses = buildSearchClauses('Josh 0917', ['firstName', 'phone']);
  expect(clauses).toHaveLength(2);
  expect(clauses[0].OR).toContainEqual({ firstName: { contains: 'Josh', mode: 'insensitive' } });
  expect(clauses[1].OR).toContainEqual({ phone: { contains: '63917', mode: 'insensitive' } });
});
it('bounds clauses and query length', () => {
  expect(buildSearchClauses(Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '), ['name'])).toHaveLength(12);
  expect(buildSearchClauses('a'.repeat(1000), ['name'])[0].OR).toContainEqual({ name: { contains: 'a'.repeat(150), mode: 'insensitive' } });
});
