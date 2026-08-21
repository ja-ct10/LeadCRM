'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getLeadImport,
  getLeadImportResults,
} from '@/shared/services/lead-imports.api';
import type { ImportSummary, ImportResultRow } from '@/shared/services/lead-imports.api';

// ── Component ────────────────────────────────────────────────────────────────

export default function ImportDetailsPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const importId = params.importId as string;

  const [importData, setImportData] = useState<ImportSummary | null>(null);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'imported' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 25;

  // ── Fetch Import Summary ───────────────────────────────────────────────
  useEffect(() => {
    if (!importId) return;

    setIsLoading(true);
    getLeadImport(importId)
      .then((res) => {
        setImportData(res.data);
        setError(null);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load import details';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setIsLoading(false));
  }, [importId]);

  // ── Fetch Results (paginated) ──────────────────────────────────────────
  const fetchResults = useCallback(async () => {
    if (!importId) return;

    setIsResultsLoading(true);
    try {
      const params: { page: number; limit: number; status?: string } = { page, limit: pageSize };
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await getLeadImportResults(importId, params);
      setResults(res.data);
      setTotalResults(res.meta.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load results';
      toast.error(msg);
    } finally {
      setIsResultsLoading(false);
    }
  }, [importId, page, pageSize, statusFilter]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalResults / pageSize);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'completed_with_errors': return 'Completed with Errors';
      case 'failed': return 'Failed';
      case 'importing': return 'Importing';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
      case 'completed_with_errors': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
      case 'failed': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
      case 'importing': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  // ── Loading State ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading import details...</span>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error || !importData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={32} className="text-red-500" />
        <p className="text-sm text-slate-600 dark:text-slate-400">{error || 'Import not found'}</p>
        <button
          onClick={() => router.push('/crm/leads')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Leads
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Navigation */}
      <button
        onClick={() => router.push('/crm/leads')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Leads
      </button>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Import Details
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Review the results of your lead import.
          </p>
        </div>
        <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold', getStatusColor(importData.status))}>
          {getStatusLabel(importData.status)}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Records"
          value={importData.totalRecords}
          icon={<FileText size={18} className="text-blue-500" />}
        />
        <SummaryCard
          label="Imported"
          value={importData.successfulRecords}
          icon={<CheckCircle2 size={18} className="text-emerald-500" />}
          variant="success"
        />
        <SummaryCard
          label="Failed"
          value={importData.failedRecords}
          icon={<XCircle size={18} className="text-red-500" />}
          variant="danger"
        />
        <SummaryCard
          label="File"
          value={importData.fileName}
          icon={<FileText size={18} className="text-slate-500" />}
          isText
        />
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Import Results
            {totalResults > 0 && (
              <span className="text-slate-400 dark:text-slate-500 font-normal ml-2">
                ({totalResults.toLocaleString()} rows)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'imported' | 'failed')}
              className="h-8 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              aria-label="Filter results by status"
            >
              <option value="all">All Statuses</option>
              <option value="imported">Imported</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {isResultsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FileText size={24} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {statusFilter !== 'all' ? 'No results match the selected filter.' : 'No results available.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-16">
                    Row
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    First Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Last Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Phone Number
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Company Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Full Address
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-24">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap min-w-[200px]">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {results.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                      {row.firstName || <Placeholder />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                      {row.lastName || <Placeholder />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                      {row.email || <Placeholder />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                      {row.phone || <Placeholder />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                      {row.companyName || <Placeholder />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                      {row.address || <Placeholder />}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold',
                          row.status === 'imported'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
                        )}
                      >
                        {row.status === 'imported' ? (
                          <CheckCircle2 size={10} />
                        ) : (
                          <XCircle size={10} />
                        )}
                        {row.status === 'imported' ? 'Imported' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      {row.remarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages} · {totalResults.toLocaleString()} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                  page <= 1
                    ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
                )}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                  page >= totalPages
                    ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
                )}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  variant,
  isText,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'success' | 'danger';
  isText?: boolean;
}): React.ReactElement {
  return (
    <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-white/[0.04] flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          <p
            className={cn(
              'text-lg font-bold mt-0.5 truncate',
              variant === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : variant === 'danger'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-white',
              isText && 'text-sm font-medium',
            )}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function Placeholder(): React.ReactElement {
  return <span className="text-slate-300 dark:text-slate-600">—</span>;
}
