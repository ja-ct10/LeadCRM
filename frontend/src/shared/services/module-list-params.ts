import type { FilterCondition } from '@leadcrm/shared';
export function moduleListParams({ search, filter, sort }: { search?: string; filter?: FilterCondition[]; sort?: { field: string; direction: string } | null }) {
  const params: Record<string, unknown> = {};
  if (sort) params.sort = `${sort.field}:${sort.direction}`;
  if (search?.trim()) params.search = search.trim();
  for (const condition of filter ?? []) params[`filter[${condition.field}]`] = Array.isArray(condition.value)
    ? `${condition.operator}:${condition.value.join(',')}` : condition.value == null ? condition.operator : `${condition.operator}:${String(condition.value)}`;
  return params;
}
