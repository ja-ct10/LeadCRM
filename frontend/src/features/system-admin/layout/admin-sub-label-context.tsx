'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Context ───────────────────────────────────────────────────────────────────

interface AdminSubLabelContextValue {
  subLabel:    string | null;
  setSubLabel: (label: string | null) => void;
}

const AdminSubLabelContext = createContext<AdminSubLabelContextValue>({
  subLabel:    null,
  setSubLabel: () => undefined,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AdminSubLabelProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [subLabel, setSubLabelState] = useState<string | null>(null);

  const setSubLabel = useCallback((label: string | null) => {
    setSubLabelState(label);
  }, []);

  return (
    <AdminSubLabelContext.Provider value={{ subLabel, setSubLabel }}>
      {children}
    </AdminSubLabelContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdminSubLabel(): AdminSubLabelContextValue {
  return useContext(AdminSubLabelContext);
}
