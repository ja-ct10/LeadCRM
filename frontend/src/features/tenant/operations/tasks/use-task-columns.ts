import { useEffect, useRef, useState } from "react";
import {
  TASK_COLUMN_DEFINITIONS,
  type ColumnConfigItem,
} from "@leadcrm/shared";
import { preferencesApi } from "@/shared/services/preferences.api";
import { USE_MOCK_DATA } from "@/lib/config";
import { normalizeTaskColumns } from "./task-columns";
const defaults = (): ColumnConfigItem[] =>
  TASK_COLUMN_DEFINITIONS.map((column) => ({
    id: column.id,
    visible: column.defaultVisible,
    order: column.defaultOrder,
  }));
export function useTaskColumns(identity: string, enabled: boolean) {
  const [state, setState] = useState<{
    identity: string;
    columns: ColumnConfigItem[];
    error?: string;
  }>();
  const current = useRef(identity);
  current.current = identity;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const read = async () => {
      try {
        const columns = USE_MOCK_DATA
          ? defaults()
          : (await preferencesApi.getEffectiveColumns("tasks")).data.columns;
        if (!cancelled)
          setState({ identity, columns: normalizeTaskColumns(columns) });
      } catch (error) {
        if (!cancelled)
          setState({
            identity,
            columns: defaults(),
            error:
              error instanceof Error
                ? error.message
                : "Unable to load column preferences.",
          });
      }
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, [identity, enabled, revision]);
  const columns = state?.identity === identity ? state.columns : defaults();
  const latestColumns = useRef(columns);
  latestColumns.current = columns;
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const write = (input?: () => ColumnConfigItem[]): Promise<void> => {
    const started = identity;
    const pending = writeQueue.current.catch(() => {}).then(async () => {
      if (current.current !== started) throw new Error('Your session changed. Reload column preferences.');
      const config = input ? normalizeTaskColumns(input()) : undefined;
      const previous = latestColumns.current;
      if (config) { latestColumns.current = config; setState({ identity, columns: config }); }
      try {
        const saved = USE_MOCK_DATA ? config ?? defaults()
          : config ? (await preferencesApi.saveUserPreference('tasks', config)).data.columns
          : (await preferencesApi.deleteUserPreference('tasks')).data.columns;
        if (current.current !== started) return;
        const normalized = normalizeTaskColumns(saved);
        latestColumns.current = normalized;
        setState({ identity, columns: normalized });
      } catch (error) {
        if (current.current === started) { latestColumns.current = previous; setState({ identity, columns: previous }); }
        throw error;
      }
    });
    writeQueue.current = pending;
    return pending;
  };
  const save = (input: ColumnConfigItem[]) => write(() => input);
  const reset = () => write();
  const resetWidths = () => write(() => latestColumns.current.map(({ width: _width, ...column }) => column));
  const saveWidth = (columnId: string, width: number): Promise<void> => write(() =>
    latestColumns.current.map(column => column.id === columnId
      ? { ...column, width: Math.max(80, Math.min(800, Math.round(width))) } : column));
  return {
    columns,
    save,
    reset,
    resetWidths,
    saveWidth,
    loading: enabled && state?.identity !== identity,
    error: state?.identity === identity ? state.error : undefined,
    retry: () => setRevision((value) => value + 1),
  };
}
