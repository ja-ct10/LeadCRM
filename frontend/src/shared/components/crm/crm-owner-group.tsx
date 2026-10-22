'use client';
import { useState } from 'react';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';
import { usePanelDraft } from '@/shared/hooks/use-panel-close-guard';
import { panelInputClass, panelLabelClass } from '@/shared/components/side-panel-styles';

/** Group ownership is explicit; changing an agent never infers a Group. */
export function useCrmOwnerGroup(module: string, record?: { ownerGroupId?: string | null } | null, busy = false) {
  const access = useCrmRecordAccess(module);
  const [value, setValue] = useState(record?.ownerGroupId ?? '');
  const editable = !record || !!access.policy?.clientAdmin;
  usePanelDraft({ dirty: editable && value !== (record?.ownerGroupId ?? ''), busy });
  const groups = (access.ownerGroups ?? []).filter(group => !record ? access.policy?.clientAdmin || access.policy?.groupGrants?.some(grant => grant.groupId === group.id && grant.permissions[module]?.canCreate) : true);
  return {
    value,
    payload: editable ? { ownerGroupId: value || null } : {},
    field: editable && (groups.length > 0 || value) ? <label className="block space-y-1.5">
      <span className={panelLabelClass}>Owning Group</span>
      <select aria-label="Owning Group" className={panelInputClass} value={value} disabled={busy} onChange={event => setValue(event.target.value)}>
        <option value="">Unassigned</option>
        {value && !groups.some(group => group.id === value) && <option value={value}>Current Group unavailable</option>}
        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </label> : null,
  };
}
