import { z } from 'zod';

export const DealViewFiltersSchema = z.object({
  search: z.string().max(1000).default(''), my: z.boolean().default(false),
  filters: z.object(Object.fromEntries(['stage', 'owner', 'priority', 'product', 'status', 'created'].map(key => [key, z.array(z.string().max(200)).max(100).optional()]))).strict().default({}),
  accountId: z.string().optional(), leadId: z.string().optional(), contactId: z.string().optional(),
}).strict();
export type DealViewFilters = { search: string; my: boolean; filters: Record<string, string[] | undefined>; accountId?: string; leadId?: string; contactId?: string };
export interface DealFilterRecord {
  title: string; companyName?: string; contactPerson?: string; accountId?: string | null;
  leadId?: string | null; leadIds?: string[]; contactId?: string | null; contactIds?: string[];
  assignedUserId?: string | null; stageId: string; priority: string; productInterests?: string[];
  createdAt: string | Date; status: string;
}
/** The board and export share the same display-field search and filter semantics. */
export function matchesDealView(deal: DealFilterRecord, view: DealViewFilters, userId: string, now = Date.now()): boolean {
  const terms = view.search.trim().toLowerCase().slice(0, 150).split(/\s+/).filter(Boolean).slice(0, 12);
  const text = `${deal.title} ${deal.companyName ?? ''} ${deal.contactPerson ?? ''}`.toLowerCase();
  const f = view.filters;
  return (!view.accountId || deal.accountId === view.accountId)
    && (!view.leadId || !!deal.leadIds?.includes(view.leadId) || deal.leadId === view.leadId)
    && (!view.contactId || !!deal.contactIds?.includes(view.contactId) || deal.contactId === view.contactId)
    && terms.every(term => text.includes(term)) && (!view.my || deal.assignedUserId === userId)
    && (!f.stage?.length || f.stage.includes(deal.stageId))
    && (!f.owner?.length || f.owner.includes(deal.assignedUserId || 'unassigned'))
    && (!f.priority?.length || f.priority.some(value => value.toLowerCase() === deal.priority.toLowerCase()))
    && (!f.product?.length || !!deal.productInterests?.some(value => f.product!.includes(value)))
    && (!f.status?.length || f.status.includes(deal.status))
    && (!f.created?.length || f.created.some(days => Number.isFinite(Number(days)) && new Date(deal.createdAt).getTime() >= now - Number(days) * 86400000));
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export const csvDocument = (rows: unknown[][]) => '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
