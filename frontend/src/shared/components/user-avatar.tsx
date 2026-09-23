'use client';

import { useState } from 'react';

/** Fill an existing avatar frame while retaining its initials on missing/broken images. */
export function UserAvatar({ user }: { user?: { firstName?: string; lastName?: string; avatarUrl?: string | null } | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = `${user?.firstName?.[0] ?? 'U'}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  return user?.avatarUrl && user.avatarUrl !== failedUrl
    ? <img src={user.avatarUrl} alt={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()} className="w-full h-full rounded-full object-cover" onError={() => setFailedUrl(user.avatarUrl!)} />
    : <span>{initials}</span>;
}
