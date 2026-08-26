'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { adminWebhookService, type WebhookEvent } from '../services/admin-webhook.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getStatusBadge(status: string): { icon: React.ReactNode; className: string } {
  switch (status) {
    case 'PROCESSED':
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
      };
    case 'FAILED':
      return {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        className: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60',
      };
    default:
      return {
        icon: <Clock className="h-3.5 w-3.5" />,
        className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
      };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebhookEventsPage(): React.ReactElement {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, unknown> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;

      const response = await adminWebhookService.listEvents(params as Parameters<typeof adminWebhookService.listEvents>[0]);
      setEvents(response.data);
      setTotal(response.meta.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load webhook events';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleReplay = useCallback(async (eventId: string) => {
    try {
      setReplayingId(eventId);
      const response = await adminWebhookService.replayEvent(eventId);
      if (response.data.status === 'PROCESSED') {
        toast.success('Event replayed successfully.');
      } else {
        toast.error(`Replay failed: ${response.data.error ?? 'Unknown error'}`);
      }
      fetchEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to replay event';
      toast.error(message);
    } finally {
      setReplayingId(null);
    }
  }, [fetchEvents]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Webhook Events</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            All inbound Stripe webhook events with replay capability.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchEvents}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="PROCESSED">Processed</option>
          <option value="FAILED">Failed</option>
        </select>
        <input
          type="text"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          placeholder="Filter by event type..."
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 w-64"
        />
        <span className="self-center text-xs text-slate-500 dark:text-slate-400">
          {total} event{total !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Event ID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Type</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Received</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Attempts</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Error</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                  No webhook events found.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const badge = getStatusBadge(event.status);
                return (
                  <tr
                    key={event.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {event.stripeEventId.slice(0, 20)}...
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                      {event.type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${badge.className}`}>
                        {badge.icon}
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {event.attempts}
                    </td>
                    <td className="px-4 py-3 text-red-600 dark:text-red-400 text-xs max-w-[200px] truncate">
                      {event.error ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {event.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleReplay(event.id); }}
                          disabled={replayingId === event.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 disabled:opacity-50 transition-colors"
                        >
                          {replayingId === event.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Event Details</h3>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stripe Event ID</span>
                <p className="font-mono text-sm text-slate-800 dark:text-slate-200 mt-1 break-all">{selectedEvent.stripeEventId}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{selectedEvent.type}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{selectedEvent.status}</p>
              </div>
              {selectedEvent.error && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Error</span>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{selectedEvent.error}</p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Received</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{formatDate(selectedEvent.createdAt)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Processed</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{formatDate(selectedEvent.processedAt)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attempts</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{selectedEvent.attempts}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payload</span>
                <pre className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 overflow-x-auto max-h-[400px] overflow-y-auto">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
              {selectedEvent.status === 'FAILED' && (
                <button
                  type="button"
                  onClick={() => { handleReplay(selectedEvent.id); setSelectedEvent(null); }}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Retry This Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
