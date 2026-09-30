'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PermissionKey } from '@leadcrm/shared';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { environmentSnapshot } from '@/lib/api/environment-transport';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { SelectedRowsBar } from './selected-rows-bar';
import { Button } from '@/shared/components/ui/button';

export interface BulkActionResult { succeeded: string[]; failed: string[]; }
export interface BulkAction {
  id: string;
  label: string;
  destructive: boolean;
  entityName?: string;
  permission?: PermissionKey;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onExecute: (ids: string[]) => Promise<BulkActionResult>;
}
export interface BulkSelectionBarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  onClearSelection: () => void;
  actions: BulkAction[];
  onRemoveIds?: (ids: string[]) => void;
  className?: string;
}
function ActionButton({ action, disabled, onClick }: { action: BulkAction; disabled: boolean; onClick: () => void }) {
  const allowed = useHasPermission(action.permission ?? 'contacts.view');
  if (action.permission && !allowed) return null;
  const Icon = action.icon;
  return <Button variant="outline" disabled={disabled} onClick={onClick}>{Icon && <Icon size={14} />}{action.label}</Button>;
}

/** Shared presentation and confirmation; module callbacks retain backend rules. */
export function BulkSelectionBar({ selectedCount, selectedIds, onClearSelection, actions, onRemoveIds }: BulkSelectionBarProps) {
  const [pending, setPending] = useState<{ action: BulkAction; ids: string[]; generation: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (!selectedCount) setPending(null); }, [selectedCount]);
  async function execute(action: BulkAction, ids: string[], generation: number) {
    if (lock.current) return;
    if (generation !== environmentSnapshot().generation || environmentSnapshot().switching) { setPending(null); return; }
    lock.current = true; setBusy(true);
    try {
      const result = await action.onExecute(ids);
      if (generation !== environmentSnapshot().generation) return;
      onRemoveIds?.(result.succeeded);
      if (!result.failed.length) toast.success(`${result.succeeded.length} ${action.entityName ?? 'record'}${result.succeeded.length === 1 ? '' : 's'} ${action.id === 'archive' ? 'archived' : action.id === 'pause' ? 'paused' : 'processed successfully'}.`);
      else if (!result.succeeded.length) toast.error(`Failed to process ${result.failed.length} record(s).`);
      else toast.warning(`${result.succeeded.length} succeeded, ${result.failed.length} failed.`);
      setPending(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to complete this action.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <SelectedRowsBar count={selectedCount} onClear={onClearSelection} disabled={busy}>
      {actions.map(action => <ActionButton key={action.id} action={action} disabled={busy} onClick={() => {
        const ids = [...selectedIds], generation = environmentSnapshot().generation;
        if (action.destructive) setPending({ action, ids, generation });
        else void execute(action, ids, generation);
      }} />)}
    </SelectedRowsBar>
    <ConfirmActionDialog open={!!pending && selectedCount > 0} onOpenChange={open => { if (!open && !busy) setPending(null); }}
      title={pending ? `${pending.action.label} ${pending.ids.length} ${pending.action.entityName ?? 'record'}${pending.ids.length === 1 ? '' : 's'}?` : ''}
      description="Archived records and their history are preserved." confirmLabel={pending?.action.label} isLoading={busy}
      onConfirm={async () => { if (pending) await execute(pending.action, pending.ids, pending.generation); }} />
  </>;
}

/** Continue on individual failures without crossing a workspace switch. */
export async function executeSelectedRows(ids: string[], execute: (id: string) => Promise<unknown>): Promise<BulkActionResult> {
  const result: BulkActionResult = { succeeded: [], failed: [] };
  const generation = environmentSnapshot().generation;
  for (const id of ids) {
    const current = environmentSnapshot();
    if (current.switching || current.generation !== generation) { result.failed.push(id); continue; }
    try { await execute(id); result.succeeded.push(id); } catch { result.failed.push(id); }
  }
  return result;
}
