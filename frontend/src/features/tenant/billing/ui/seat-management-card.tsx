'use client';

import React, { useState, useCallback } from 'react';
import { Users, Plus, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { billingService } from '../services/billing.service';
import type { SeatUsage } from '../types/billing.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SeatManagementCardProps {
  seats: SeatUsage | null;
  hasSubscription: boolean;
  onSeatsChanged: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SeatManagementCard({ seats, hasSubscription, onSeatsChanged }: SeatManagementCardProps): React.ReactElement {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [seatCount, setSeatCount] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleAddSeats = useCallback(async () => {
    if (seatCount < 1) return;
    try {
      setLoading(true);
      await billingService.updateSeats('add', seatCount);
      toast.success(`Added ${seatCount} seat${seatCount > 1 ? 's' : ''} to your plan.`);
      setShowAddModal(false);
      setSeatCount(1);
      onSeatsChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add seats';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [seatCount, onSeatsChanged]);

  const handleRemoveSeats = useCallback(async () => {
    if (seatCount < 1) return;
    try {
      setLoading(true);
      await billingService.updateSeats('remove', seatCount);
      toast.success(`Removed ${seatCount} seat${seatCount > 1 ? 's' : ''} from your plan.`);
      setShowRemoveModal(false);
      setSeatCount(1);
      onSeatsChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove seats';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [seatCount, onSeatsChanged]);

  if (!seats || !hasSubscription) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Team Seats</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Subscribe to a plan to manage team seats.</p>
      </div>
    );
  }

  const usagePercent = seats.total > 0 ? Math.min(100, (seats.used / seats.total) * 100) : 0;
  const isAtCapacity = seats.available === 0;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Team Seats</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {seats.used} / {seats.total} seats used
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setSeatCount(1); setShowAddModal(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            {seats.additional > 0 && (
              <button
                type="button"
                onClick={() => { setSeatCount(1); setShowRemoveModal(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Minus className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAtCapacity
                ? 'bg-red-500 dark:bg-red-400'
                : usagePercent > 80
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-indigo-500 dark:bg-indigo-400'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        {/* Breakdown */}
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Included: {seats.included} (from plan)</span>
          {seats.additional > 0 && <span>Additional: {seats.additional} (billed)</span>}
          <span>{seats.available} available</span>
        </div>

        {isAtCapacity && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            All seats are in use. Add more seats to invite additional team members.
          </p>
        )}
      </div>

      {/* Add Seats Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Add Seats</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Additional seats will be prorated on your next invoice.
            </p>
            <div className="flex items-center gap-4 mb-6">
              <label htmlFor="add-seat-count" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Number of seats:
              </label>
              <input
                id="add-seat-count"
                type="number"
                min={1}
                max={100}
                value={seatCount}
                onChange={(e) => setSeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSeats}
                disabled={loading || seatCount < 1}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Add {seatCount} Seat{seatCount > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Seats Modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Remove Seats</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              You have {seats.additional} additional seat{seats.additional > 1 ? 's' : ''}.
              You cannot remove seats below your active user count ({seats.used} users).
            </p>
            <div className="flex items-center gap-4 mb-6 mt-4">
              <label htmlFor="remove-seat-count" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Seats to remove:
              </label>
              <input
                id="remove-seat-count"
                type="number"
                min={1}
                max={seats.additional}
                value={seatCount}
                onChange={(e) => setSeatCount(Math.max(1, Math.min(seats.additional, parseInt(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveSeats}
                disabled={loading || seatCount < 1}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove {seatCount} Seat{seatCount > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
