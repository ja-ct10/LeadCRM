'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { listContactImports } from '@/shared/services/contact-imports.api';
import type { ContactImportSummary } from '@/shared/services/contact-imports.api';

// ── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'completed' | 'completed_with_errors' | 'failed';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: ContactImportSummary['status']): { label: string; className: string } {
  switch (status) {
    case 'completed':
      return { label: 'Success', className: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' };
    case 'completed_with_errors':
      return { label: 'Partial', className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' };
    case 'pending':
    case 'importing':
      return { label: 'In Progress', className: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' };
    default:
      return { label: status, className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImportHistoryList(): React.ReactElement {
  const router = useRouter();
  const [imports, setImports] = useState<ContactImportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const pageSize = 10;

  const fetchImports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listContactImports({ page, limit: pageSize });
      setImports(response.data);
      setTotalRecords(response.meta.total);
      setTotalPages(Math.ceil(response.meta.total / pageSize) || 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load import history';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  const filteredImports = statusFilter === 'all'
    ? imports
    : imports.filter((imp) => imp.status === statusFilter);

  // ── Loading State ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Import History</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800/60 rounded-xl h-16" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Import History</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-3">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Failed to load import history</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
          <button
            onClick={fetchImports}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty State ────────────────────────────────────────────────────────
  if (imports.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Import History</h3>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Inbox size={24} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No imports yet</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            Once you import contacts via CSV, your import history will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ── List View ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Import History</h3>
        <div className="flex items-center gap-1.5">
          {(['all', 'completed', 'completed_with_errors', 'failed'] as const).map((filter) => {
            const labels: Record<StatusFilter, string> = {
              all: 'All',
              completed: 'Success',
              completed_with_errors: 'Partial',
              failed: 'Failed',
            };
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors',
                  statusFilter === filter
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Import List */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-[12px]" aria-label="Import history">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Date</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">File Name</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-400">Records</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-400">Errors</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Imported By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredImports.map((imp) => {
              const badge = getStatusBadge(imp.status);
              const userName = imp.createdBy
                ? `${imp.createdBy.firstName} ${imp.createdBy.lastName}`
                : '—';

              return (
                <tr
                  key={imp.id}
                  onClick={() => router.push(`/crm/contacts/imports/${imp.id}`)}
                  className="hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  tabIndex={0}
                  role="row"
                  aria-label={`Import ${imp.fileName} on ${formatDate(imp.createdAt)}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/crm/contacts/imports/${imp.id}`); }}
                >
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatDate(imp.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                      <span className="text-slate-900 dark:text-white font-medium truncate max-w-[180px]">
                        {imp.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold', badge.className)}>
                      {(imp.status === 'pending' || imp.status === 'importing') && (
                        <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                      )}
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{imp.successfulRecords}</span>
                    <span className="text-slate-400 dark:text-slate-500"> / {imp.totalRecords}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {imp.failedRecords > 0 ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">{imp.failedRecords}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                    {userName}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {totalRecords} total imports
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Page {page} of {totalPages}
            </span>
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
  );
}
