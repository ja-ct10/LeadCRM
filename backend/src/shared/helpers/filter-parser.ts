import { conditionOperators } from '@leadcrm/shared';
import { ValidationError } from '../errors/http-error';

export interface ParsedFilter { field: string; operator: string; value: unknown }
export interface FilterFieldDescriptor {
  kind: 'text' | 'number' | 'boolean' | 'date' | 'choice' | 'reference';
  operators?: readonly string[];
  options?: readonly string[];
  /** A repository-owned filter such as Lead Created or a fixed relationship scope. */
  handled?: boolean;
}
export type FilterFields = Readonly<Record<string, FilterFieldDescriptor>>;

/** Accept both Express bracket objects and flat client keys without coercing query objects. */
export function parseFilterParams(query: Record<string, unknown>): ParsedFilter[] {
  const entries = Object.entries(query).filter(([key]) => key.startsWith('filter['));
  if (query.filter !== undefined) {
    if (!query.filter || typeof query.filter !== 'object' || Array.isArray(query.filter)) throw new ValidationError('Invalid filter query.');
    for (const [field, value] of Object.entries(query.filter)) {
      if (Object.prototype.hasOwnProperty.call(query, `filter[${field}]`)) throw new ValidationError('Supply each filter only once.');
      entries.push([`filter[${field}]`, value]);
    }
  }
  if (entries.length > 30) throw new ValidationError('Supply at most 30 filters.');
  return entries.flatMap<ParsedFilter>(([key, raw]) => {
    const match = /^filter\[([a-zA-Z][a-zA-Z0-9]*)\]$/.exec(key);
    if (!match || typeof raw !== 'string' || raw.length > 10000 || /[\x00-\x1f\x7f]/.test(raw)) throw new ValidationError('Invalid filter query.');
    const encoded = raw.trim();
    if (!encoded) return [];
    const colon = encoded.indexOf(':');
    const operator = (colon < 0 ? encoded : encoded.slice(0, colon)).trim();
    const operand = colon < 0 ? undefined : encoded.slice(colon + 1).trim();
    if (['is_null', 'is_not_null'].includes(operator)) {
      if (operand) throw new ValidationError('This filter operator does not accept a value.');
      return [{ field: match[1], operator, value: null }];
    }
    if (!operand) throw new ValidationError('Enter a filter value.');
    const value = ['in', 'not_in'].includes(operator) ? operand.split(',').map(value => value.trim()) : operand;
    if (Array.isArray(value) && (value.length > 100 || value.some(value => !value))) throw new ValidationError('Choose valid filter values.');
    return [{ field: match[1], operator, value }];
  });
}

function typedOperand(value: unknown, descriptor: FilterFieldDescriptor): string | number | boolean | Date {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new ValidationError('Invalid filter value.');
  if (descriptor.options && !descriptor.options.includes(String(value))) throw new ValidationError('Choose a supported filter value.');
  if (descriptor.kind === 'number') {
    if (typeof value === 'boolean' || typeof value === 'string' && (!value.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) throw new ValidationError('Enter a valid filter number.');
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ValidationError('Enter a finite filter number.');
    return number;
  }
  if (descriptor.kind === 'boolean') {
    if (value !== true && value !== false && value !== 'true' && value !== 'false') throw new ValidationError('Choose a valid filter boolean.');
    return value === true || value === 'true';
  }
  if (descriptor.kind === 'date') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new ValidationError('Choose a valid filter date.');
    return new Date(value);
  }
  if (typeof value !== 'string') throw new ValidationError('Enter a text filter value.');
  return value;
}

/** Each repository declares its actual fields; aliases resolve before the allowlist check. */
export function buildPrismaFilters(filters: ParsedFilter[], fields: FilterFields, aliases: Record<string, string> = {}): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];
  for (const { field, operator, value } of filters) {
    const canonical = Object.prototype.hasOwnProperty.call(aliases, field) ? aliases[field] : field;
    const descriptor = Object.prototype.hasOwnProperty.call(fields, canonical) ? fields[canonical] : undefined;
    if (!descriptor) throw new ValidationError('Choose a supported filter field.');
    if (!(descriptor.operators ?? conditionOperators('crm', descriptor.kind)).includes(operator)) throw new ValidationError('Choose a supported operator for this filter field.');
    if (['is_null', 'is_not_null'].includes(operator)) {
      if (value !== null) throw new ValidationError('This filter operator does not accept a value.');
      if (!descriptor.handled) clauses.push({ [canonical]: operator === 'is_null' ? null : { not: null } });
      continue;
    }
    if (value === null || value === undefined || value === '') throw new ValidationError('Enter a filter value.');
    // Lead Created retains its separate Manila calendar range contract.
    if (descriptor.handled && descriptor.kind === 'date') continue;
    const converted = ['in', 'not_in'].includes(operator)
      ? (Array.isArray(value) && value.length ? value.map(item => typedOperand(item, descriptor)) : undefined)
      : typedOperand(value, descriptor);
    if (converted === undefined) throw new ValidationError('Choose valid filter values.');
    if (descriptor.handled) continue;
    if (operator === 'equals') clauses.push({ [canonical]: converted });
    else if (operator === 'contains') clauses.push({ [canonical]: { contains: converted, mode: 'insensitive' } });
    else if (operator === 'in' || operator === 'not_in') clauses.push({ [canonical]: { [operator === 'in' ? 'in' : 'notIn']: converted } });
    else if (['gt', 'gte', 'lt', 'lte'].includes(operator)) clauses.push({ [canonical]: { [operator]: converted } });
    else throw new ValidationError('Choose a supported filter operator.');
  }
  return clauses;
}
