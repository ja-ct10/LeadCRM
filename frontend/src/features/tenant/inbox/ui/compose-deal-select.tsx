'use client';
import { useEffect, useRef } from 'react';
import type { MailboxRecordContext } from '@leadcrm/shared';
import { useRecordRelationships } from '@/shared/hooks/use-record-relationships';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { CheckboxDropdownSelect } from '@/shared/components/ui/checkbox-dropdown-select';
import { useAuth } from '@/store/AuthContext';

/** Reuse the same authorized, paginated Deal relationships as the record panel. */
export function ComposeDealSelect({ context, dealId, onSelect, disabled }: { context: MailboxRecordContext; dealId: string; onSelect: (id: string, title?: string) => void; disabled: boolean }) {
  const canView = useHasPermission('deals.view');
  const { user } = useAuth();
  const query = useRecordRelationships<{ deals: { id: string; title: string; assignedUserId?: string | null }[]; hasMoreDeals: boolean }>(context.recordModule, context.recordId, !canView);
  const requested = useRef<typeof query.data>(undefined);
  useEffect(() => { if (query.data?.hasMoreDeals && !query.isRefreshing && !query.error && requested.current !== query.data) { requested.current = query.data; query.loadMore(); } }, [query.data, query.isRefreshing, query.error, query.loadMore]);
  if (!canView) return null;
  const deals = (query.data?.deals ?? []).filter(deal => deal.assignedUserId === user?.id);
  return <div className="min-w-0 space-y-1 border-b border-border px-4 py-2">
    <CheckboxDropdownSelect values={dealId ? [dealId] : []} options={deals.map(deal => ({ value: deal.id, label: deal.title }))} single searchable ariaLabel="Associated deal" placeholder={query.isInitialLoad ? 'Loading associated deals…' : 'Choose an associated deal (optional)'} emptyMessage="No associated deals. Enter a subject manually." disabled={disabled || query.isInitialLoad} onChange={ids => { const deal = deals.find(deal => deal.id === ids[0]); onSelect(deal?.id ?? '', deal?.title); }} />
    {dealId && <button type="button" disabled={disabled} onClick={() => onSelect('')} className="text-xs text-primary underline">Remove deal association</button>}
    {query.error && <p role="alert" className="text-xs text-destructive">Unable to load associated deals. <button type="button" onClick={() => void query.refetch()} className="underline">Retry</button></p>}
    {!query.isInitialLoad && !query.error && !deals.length && <p className="text-xs text-muted-foreground">No associated deals. Enter a subject manually.</p>}
  </div>;
}
