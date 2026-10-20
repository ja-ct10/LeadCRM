'use client';

import { useEffect, useRef } from 'react';
import type { NotificationRecordTarget } from '@leadcrm/shared';
import { useNotifications } from './use-notifications';

/** Every dot shares the existing authenticated counts watcher; no feed or row requests. */
export function UnreadRecordDot({ entityType, entityId }: NotificationRecordTarget) {
  const { unreadRecords } = useNotifications('all', { countsOnly: true });
  if (!unreadRecords.some(record => record.entityType === entityType && record.entityId === entityId)) return null;
  return <span role="status" aria-label={`Unread ${entityType} notifications`} className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />;
}

/** Consume the open snapshot once, only after the existing detail reader succeeds. */
export function useReadRecordNotifications(entityType: NotificationRecordTarget['entityType'], entityId: string | undefined, ready: boolean) {
  const notifications = useNotifications('all', { countsOnly: true, enabled: ready && !!entityId });
  const opening = useRef({ identity: '', attempted: false });
  const identity = notifications.scope + ':' + entityType + ':' + entityId;
  useEffect(() => {
    if (!ready || !entityId) return;
    if (opening.current.identity !== identity) opening.current = { identity, attempted: false };
    if (!notifications.hasCounts || opening.current.attempted) return;
    opening.current.attempted = true;
    if (notifications.unreadRecords.some(record => record.entityType === entityType && record.entityId === entityId)) {
      void notifications.markRecordAsRead({ entityType, entityId });
    }
  }, [identity, ready, entityType, entityId, notifications.hasCounts, notifications.unreadRecords, notifications.markRecordAsRead]);
}
