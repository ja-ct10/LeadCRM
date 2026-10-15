import type { PGlite } from '@electric-sql/pglite';
export function replayCrmMigrations(db: Pick<PGlite, 'exec' | 'query'>, options?: { from?: string; before?: string; exclude?: string[] }): Promise<void>;
