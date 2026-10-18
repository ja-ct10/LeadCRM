'use client';
import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { TableIconButton } from '@/shared/components/data-grid/table-icon-button';

export function ExportCsvButton({ module, params, disabled }: { module: 'leads' | 'contacts' | 'accounts' | 'deals'; params: Record<string, unknown>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  return <TableIconButton variant="outline" label="Export CSV" disabled={disabled || busy} onClick={async () => {
    if (pending.current) return; pending.current = true; setBusy(true);
    try {
      const blob = await apiClient.download(`/crm/${module}/export`, params);
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      link.download = `${module}-${date}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to export CSV.'); }
    finally { pending.current = false; setBusy(false); }
  }}><Download size={14} aria-hidden="true" /></TableIconButton>;
}
