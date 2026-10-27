'use client';

import Dashboard from '@/features/tenant/dashboard/ui/dashboard';
import { dashboardQueryString } from '@/features/tenant/dashboard/hooks/use-dashboard-report';
import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from '@/shared/utils/toast';
import type { DashboardQuery, DashboardReport } from '@leadcrm/shared';

function ReportsCsvExport({ query, report, error, loading, className }: { query: DashboardQuery; report: DashboardReport | null; error: string | null; loading: boolean; className: string }) {
  const [exporting, setExporting] = useState(false);
  const pending = useRef(false);
  const disabled = !report || loading || exporting || !!error;
  const exportCsv = async () => {
    if (disabled || pending.current) return;
    pending.current = true;
    setExporting(true);
    try {
      const response = await fetch(`/api/proxy/reporting/dashboard/export?${dashboardQueryString(query)}`, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('Export could not load. Your access or reporting data may have changed.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url;
      link.download = `LeadCRM_Dashboard_${report?.period.start}_${report?.period.end}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      toast.success('CSV download started.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Export failed'); }
    finally { pending.current = false; setExporting(false); }
  };
  return <button onClick={exportCsv} disabled={disabled} className={className} title="Export CSV" aria-label="Export CSV" aria-busy={exporting || loading || undefined}><Download size={14} aria-hidden="true" /><span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export CSV'}</span></button>;
}

/** Reports reuse the authorized Dashboard view and retain their CSV control. */
export default function ReportsPage() {
  return <Dashboard presentation="reporting" heading="Analytics & Reports" renderToolbarActions={props => <ReportsCsvExport {...props} />} />;
}
