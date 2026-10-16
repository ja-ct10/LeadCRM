'use client';

import React from 'react';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';

interface RoleDeletionDialogProps {
  role: { id: string; name: string; userCount: number; isSystemRole: boolean; isArchived?: boolean } | null;
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => Promise<void>;
}

export function RoleDeletionDialog({ role, canDelete, onOpenChange, onDelete }: RoleDeletionDialogProps): React.ReactElement {
  const assigned = !!role && role.userCount > 0;
  return <ConfirmActionDialog open={!!role} onOpenChange={onOpenChange}
    title={assigned ? 'Role cannot be deleted' : 'Delete role?'}
    description={assigned
      ? `This role is currently assigned to ${role.userCount} user(s). Reassign them to another role before deleting this role.`
      : `Delete "${role?.name ?? ''}"? The role will be removed from active use.`}
    warning={assigned
      ? 'Users must have another role assigned before this role can be deleted.'
      : 'This role will no longer be available for assignment after deletion.'}
    variant={assigned ? 'warning' : 'destructive'} hideConfirm={assigned}
    cancelLabel={assigned ? 'Close' : 'Cancel'} confirmLabel="Delete Role"
    confirmDisabled={!role || !canDelete || role.isSystemRole || role.isArchived}
    onConfirm={async () => {
      if (!role || !canDelete || role.isSystemRole || role.isArchived || role.userCount > 0) return false;
      await onDelete(role.id);
    }} />;
}
