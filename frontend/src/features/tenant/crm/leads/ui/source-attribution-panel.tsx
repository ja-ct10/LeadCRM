import type { SourceAttribution } from '@leadcrm/shared';
const methods: Record<string, string> = { url_tags: 'Campaign URL tags', click_id: 'Click identifier', referrer: 'Referring website', unattributed: 'No acquisition evidence', manual: 'Staff entry', business_email: 'Connected business mailbox' };
export function SourceAttributionPanel({ attribution, sourceDetail }: { attribution?: SourceAttribution | null; sourceDetail?: string | null }) {
  if (!attribution && !sourceDetail) return null;
  return <section aria-label="Source attribution" className="my-4 rounded-lg border border-border p-4 text-sm"><h3 className="font-semibold">Source attribution</h3>
    {sourceDetail && <p className="mt-2">Detail: {sourceDetail}</p>}
    {attribution && <><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['first', 'last'] as const).map(key => <div key={key}><h4 className="font-medium">{key === 'first' ? 'First observed source' : 'Latest qualifying source'}</h4><p className="break-words">{attribution[key].source} / {attribution[key].medium}</p><p>{attribution[key].channel}</p><p className="break-words">Campaign: {attribution[key].campaign || 'None'}</p><p className="text-xs text-muted-foreground">{methods[attribution[key].method] ?? attribution[key].method}</p></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Captured through {attribution.captureMethod.replaceAll('_', ' ')}. Campaign tags describe a link; they do not verify an advertising platform.</p></>}
  </section>;
}
