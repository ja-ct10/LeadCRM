import { describe, it, expect } from 'vitest';
import { parseFilterParams, buildPrismaFilters, type FilterFields } from '../filter-parser';

const fields: FilterFields = {
  status: { kind: 'choice' }, source: { kind: 'choice' }, assignedUserId: { kind: 'reference' },
  size: { kind: 'choice' }, industry: { kind: 'text' }, value: { kind: 'number' }, enabled: { kind: 'boolean' },
  date: { kind: 'date', operators: ['gte', 'lte'] },
};
const compile = (query: Record<string, unknown>) => buildPrismaFilters(parseFilterParams(query), fields, { type: 'size', leadSource: 'source' });

describe('typed CRM filter queries', () => {
  it('combines actual allowed fields and aliases before the allowlist check', () => {
    expect(compile({ page: '2', filter: { status: 'in:Hot,Warm', type: 'in:Enterprise,SMB', leadSource: 'equals:Referral', assignedUserId: 'is_null' } })).toEqual([
      { status: { in: ['Hot', 'Warm'] } }, { size: { in: ['Enterprise', 'SMB'] } }, { source: 'Referral' }, { assignedUserId: null },
    ]);
  });
  it('supports flat clients and Express bracket objects with identical semantics', () => {
    expect(compile({ 'filter[industry]': 'contains:Acme: Pacific' })).toEqual(compile({ filter: { industry: 'contains:Acme: Pacific' } }));
    expect(compile({ filter: { industry: 'contains:Acme: Pacific' } })).toEqual([{ industry: { contains: 'Acme: Pacific', mode: 'insensitive' } }]);
  });
  it.each(['equals', 'gt', 'gte', 'lt', 'lte'])('converts finite numeric operands for %s', operator => {
    for (const value of ['0', '-3', '4.25', '1e3']) {
      expect(compile({ 'filter[value]': operator + ':' + value })).toEqual([{ value: operator === 'equals' ? Number(value) : { [operator]: Number(value) } }]);
    }
  });
  it('converts numeric memberships and booleans without changing null semantics', () => {
    expect(compile({ filter: { value: 'not_in:0,2.5,-3', enabled: 'equals:false', assignedUserId: 'is_not_null' } })).toEqual([
      { value: { notIn: [0, 2.5, -3] } }, { enabled: false }, { assignedUserId: { not: null } },
    ]);
  });
  it.each(['NaN', 'Infinity', '1e999', '0x10', '12oops'])('rejects invalid numeric input %s', value => {
    expect(() => compile({ 'filter[value]': 'gte:' + value })).toThrow();
  });
  it.each([
    { filter: { status: 'contains:Hot' } }, { filter: { assignedUserId: 'gt:2' } },
    { filter: { industry: 'between:a,b' } }, { filter: { status: 'fuzzy_match:Hot' } },
    { filter: { value: 'contains:2' } }, { filter: { date: 'gte:2026-02-31' } },
    { filter: { enabled: 'equals:0' } }, { filter: { tenantId: 'equals:other' } },
    { filter: { AND: 'is_not_null' } }, { filter: { customFieldValues: 'equals:10' } },
  ])('rejects unsupported field/operator/value instead of silently dropping it: %j', query => {
    expect(() => compile(query)).toThrow();
  });
  it.each([
    { filter: ['equals:Hot'] }, { filter: 'equals:Hot' }, { filter: { status: ['in:Hot', 'in:Cold'] } },
    { filter: { status: { equals: 'Hot' } } }, { 'filter[status][nested]': 'equals:Hot' },
    { 'filter[status]': 'in:Hot', filter: { status: 'in:Cold' } },
    { filter: { status: 'in:Hot,,Cold' } }, { filter: { status: 'equals:' } },
    { filter: { value: 'gt:   ' } }, { filter: { source: 'is_null:Referral' } },
  ])('rejects malformed query shapes and missing operands: %j', query => {
    expect(() => compile(query)).toThrow();
  });
  it('preserves an empty cleared filter and ignores ordinary pagination parameters', () => {
    expect(compile({ page: '1', search: 'acme', 'filter[status]': '' })).toEqual([]);
  });
  it('allows explicitly described dates without exposing generic between', () => {
    expect(compile({ filter: { date: 'gte:2026-10-11' } })).toEqual([{ date: { gte: new Date('2026-10-11') } }]);
    expect(() => compile({ filter: { date: 'between:2026-10-10,2026-10-11' } })).toThrow();
  });
  it('validates repository-owned fixed filters without emitting arbitrary Prisma fields', () => {
    const handled: FilterFields = { related: { kind: 'choice', operators: ['in'], options: ['has_deals'], handled: true } };
    expect(buildPrismaFilters(parseFilterParams({ filter: { related: 'in:has_deals' } }), handled)).toEqual([]);
    expect(() => buildPrismaFilters(parseFilterParams({ filter: { related: 'in:has_password' } }), handled)).toThrow();
  });
});
