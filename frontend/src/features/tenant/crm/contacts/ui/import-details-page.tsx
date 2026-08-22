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
  Calendar,
  User,
} from 'lucide-react';
import {
  getContactImport,
  getContactImportResults,
} from '@/shared/services/contact-imports.api';
import type { ContactImportSummary, ContactImportResultRow } from '@/shared/services/contact-imports.api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'Completed';
    case 'completed_with_errors': return 'Completed with Errors';
    case 'failed': return 'Failed';
    case 'importing': return 'Importing';
    case 'pending': return 'Pending';
    default: return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
    case 'completed_with_errors': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
    case 'failed': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
    case 'importing': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';
    default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ImportDetailsPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const importId = params.importId as string;

  const [importData, setImportData] = useState<ContactImportSummary | null>(null);
  const [results, setResults] = useState<ContactImportResultRow[]>([]);
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
    getContactImport(importId)
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
      const fetchParams: { page: number; limit: number; status?: string } = { page, limit: pageSize };
      if (statusFilter !== 'all') fetchParams.status = statusFilter;

      const res = await getContactImportResults(importId, fetchParams);
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

  const totalPages = Math.ceil(totalResults / pageSize) || 1;

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
          onClick={() => router.push('/crm/contacts/import')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Imports
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Navigation */}
      <button
        onClick={() => router.push('/crm/contacts/import')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        aria-label="Back to imports"
      >
        <ArrowLeft size={16} />
        Back to Imports
      </button>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Import Details
          </h1>
          <div className="flex items-center gap-3 mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <FileText size={12} aria-hidden="true" />
              {importData.fileName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} aria-hidden="true" />
              {formatDate(importData.createdAt)}
            </span>
            {importData.createdBy && (
              <span className="inline-flex items-center gap-1">
                <User size={12} aria-hidden="true" />
                {importData.createdBy.firstName} {importData.createdBy.lastName}
              </span>
            )}
          </div>
        </div>
        <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold', getStatusColor(importData.status))}>
          {getStatusLabel(importData.status)}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <FileText size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{importData.totalRecords.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Records</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{importData.successfulRecords.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Imported</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800/40 border border-red-200 dark:border-red-800/40 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
              <XCircle size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{importData.failedRecords.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Row Results
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
              className="h-8 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <table className="w-full text-xs" aria-label="Import row results">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 w-16">Row</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">First Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Last Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Email</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Phone</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Company</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 w-20">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 min-w-[160px]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {results.map((row) => (
                  <tr key={row.id} className={cn('transition-colors', row.status === 'failed' && 'bg-red-50/30 dark:bg-red-500/[0.02]')}>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]">{row.rowNumber}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.firstName || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.lastName || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{row.email || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{row.companyName || '—'}</td>
                    <td className="px-4 py-2.5">
                      {row.status === 'imported' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={11} aria-hidden="true" /> Imported
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                          <XCircle size={11} aria-hidden="true" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-slate-500 dark:text-slate-400">
                      {row.remarks || (row.status === 'imported' ? 'Imported successfully' : '—')}
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
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Page {page} of {totalPages} ({totalResults.toLocaleString()} rows)
            </span>
            <div className="flex items-center gap-2">
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
