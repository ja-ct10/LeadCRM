'use client';
import { useId, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from '@/shared/utils/toast';
import { apiClient } from '@/lib/api/client';
import { TableIconButton } from '@/shared/components/data-grid/table-icon-button';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { invalidatePageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';

export function ExportCsvButton({ module, params, hasData, disabled }: { module: 'leads' | 'contacts' | 'accounts' | 'deals'; params: Record<string, unknown>; hasData?: boolean; disabled?: boolean }) {
  const { tenant } = useAuth();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const descriptionId = useId();
  // Highlight views load a single record independently of the export filters.
  const availability = useCachedPage<{ meta: { total: number } }>({
    module, params: { ...params, page: 1, limit: 1 },
    disabled: hasData !== undefined || !!disabled, revalidateOnInvalidation: true,
    fetchFn: signal => apiClient.get(`/crm/${module}`, { params: { ...params, page: 1, limit: 1 }, signal }),
  });
  const checking = hasData === undefined;
  const available = checking ? availability.data && availability.data.meta.total > 0 : hasData;
  const checkingData = checking && (availability.isInitialLoad || availability.isRefreshing);
  const blocked = !!disabled || busy || !available || checkingData || checking && !!availability.error;
  const empty = available === false && !disabled && !checkingData && !(checking && availability.error);
  const emptyMessage = 'No data available to export.';
  return <><TableIconButton variant="outline" label={empty ? emptyMessage : 'Export CSV'} ariaLabel="Export CSV"
    aria-describedby={empty ? descriptionId : undefined} aria-busy={busy || checkingData || undefined} disabled={blocked} onClick={async () => {
    if (blocked || pending.current) return; pending.current = true; setBusy(true);
    try {
      const blob = await apiClient.download(`/crm/${module}/export`, params);
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      link.download = `${module}-${date}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); toast.success('CSV download started.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export CSV.');
      if ((error as { status?: number })?.status === 404 && error instanceof Error && error.message === emptyMessage) invalidatePageCache(module, tenant?.id);
    }
    finally { pending.current = false; setBusy(false); }
  }}><Download size={14} aria-hidden="true" /></TableIconButton>{empty && <span id={descriptionId} className="sr-only">{emptyMessage}</span>}</>;
}
