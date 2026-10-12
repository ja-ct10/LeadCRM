'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { reconcileTableColumns, normalizeModuleColumns, type ColumnConfigItem } from '@leadcrm/shared';
import { preferencesApi } from '@/shared/services/preferences.api';
import { MODULE_COLUMN_REGISTRIES } from '@/shared/constants/column-registries';
import { useAuth } from '@/store/AuthContext';

interface UseColumnPreferencesReturn {
  effectiveColumns: ColumnConfigItem[];
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveColumns: (config: ColumnConfigItem[]) => Promise<void>;
  saveColumnWidth: (columnId: string, width: number) => Promise<void>;
  resetColumns: () => Promise<void>;
  resetColumnWidths: () => Promise<void>;
  retryCount: number;
}

/** Serialize writes so resize, Save and Reset never roll back a newer preference. */
export function useColumnPreferences(module: string): UseColumnPreferencesReturn {
  const { user, tenant } = useAuth();
  const identity = [module, tenant?.id, user?.id].join(':');
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [effectiveColumns, setEffectiveColumns] = useState<ColumnConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const columnsRef = useRef<ColumnConfigItem[]>([]);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const mutationVersion = useRef(0);
  const mountedRef = useRef(true);
  const normalize = useCallback((columns: ColumnConfigItem[]) => {
    const registry = MODULE_COLUMN_REGISTRIES[module];
    return registry ? reconcileTableColumns(module, columns, registry) : normalizeModuleColumns(module, columns);
  }, [module]);
  const publish = useCallback((columns: ColumnConfigItem[]) => {
    columnsRef.current = columns; setEffectiveColumns(columns);
  }, []);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    const version = mutationVersion.current;
    publish([]); setIsLoading(true); setIsSaving(false); setSaveError(null); setRetryCount(0);
    preferencesApi.getEffectiveColumns(module).then(response => {
      if (!cancelled && mountedRef.current && identityRef.current === identity && version === mutationVersion.current) publish(normalize(response.data.columns));
    }).catch((error: unknown) => {
      if (!cancelled && mountedRef.current && version === mutationVersion.current) setSaveError(error instanceof Error ? error.message : 'Failed to load column preferences');
    }).finally(() => { if (!cancelled && mountedRef.current) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [identity, module, normalize, publish]);

  const mutate = useCallback((getColumns?: () => ColumnConfigItem[]): Promise<void> => {
    const owner = identity;
    mutationVersion.current += 1;
    const operation = queueRef.current.catch(() => {}).then(async () => {
      if (!mountedRef.current || owner !== identityRef.current) throw new Error('Your session changed. Please reload column preferences.');
      const previous = columnsRef.current;
      const config = getColumns ? normalize(getColumns()) : undefined;
      if (config) publish(config);
      setIsSaving(true); setSaveError(null);
      try {
        const response = config ? await preferencesApi.saveUserPreference(module, config) : await preferencesApi.deleteUserPreference(module);
        if (mountedRef.current && owner === identityRef.current) { publish(normalize(response.data.columns)); setSaveError(null); setRetryCount(0); }
      } catch (error: unknown) {
        if (mountedRef.current && owner === identityRef.current) {
          publish(previous); setSaveError(error instanceof Error ? error.message : 'Unable to save column preferences');
          setRetryCount(count => count + 1);
        }
        throw error;
      } finally { if (mountedRef.current && owner === identityRef.current) setIsSaving(false); }
    });
    queueRef.current = operation;
    return operation;
  }, [identity, module, normalize, publish]);
  const saveColumns = useCallback((columns: ColumnConfigItem[]) => mutate(() => columns), [mutate]);
  const resetColumns = useCallback(() => mutate(), [mutate]);
  const resetColumnWidths = useCallback(() => mutate(() => normalize(columnsRef.current)
    .map(({ width: _width, ...column }) => column)), [mutate, normalize]);
  const saveColumnWidth = useCallback((columnId: string, width: number) => mutate(() => normalize(columnsRef.current)
    .map(column => column.id === columnId ? { ...column, width: Math.round(Math.min(800, Math.max(80, width))) } : column)), [mutate, normalize]);
  return { effectiveColumns, isLoading, isSaving, saveError, saveColumns, saveColumnWidth, resetColumns, resetColumnWidths, retryCount };
}
