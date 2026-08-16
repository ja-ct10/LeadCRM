import { Request, Response, NextFunction } from 'express';

import * as repo from './preferences.repository';
import { isValidModule, isValidSortField } from './column-registry';
import { AppError } from '../../shared/errors/app-error';

// ─────────────────────────────────────────────────────
// Table Preferences Controller
// Handles generic per-module preferences: pageSize, viewMode, sort
// Uses the existing UserPreference table with different keys.
// Unknown modules return 404 — never reveal module existence.
// ─────────────────────────────────────────────────────

// Valid page sizes
const VALID_PAGE_SIZES = [10, 20, 25, 30, 40, 50];

// Valid view modes
const VALID_VIEW_MODES = ['wrap', 'clip'];

// Valid sort directions
const VALID_SORT_DIRECTIONS = ['asc', 'desc'];

/**
 * GET /api/v1/preferences/table/:module
 * Returns all table preferences (pageSize, viewMode, sort) for the authenticated user.
 */
export async function getTablePreferences(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, userId } = req.user!;
    const module = String(req.params.module);

    if (!isValidModule(module)) {
      throw new AppError('Not found', 404);
    }

    // Fetch all table preference keys in parallel
    const [pageSizePref, viewModePref, sortPref] = await Promise.all([
      repo.findUserPreference(tenantId, userId, module, 'pageSize'),
      repo.findUserPreference(tenantId, userId, module, 'viewMode'),
      repo.findUserPreference(tenantId, userId, module, 'sort'),
    ]);

    const pageSize = parsePageSize(pageSizePref?.value);
    const viewMode = parseViewMode(viewModePref?.value);
    const rawSort = parseSort(sortPref?.value);

    // Discard stale sort if the field is no longer in the module's sortable fields
    const sort = rawSort && isValidSortField(module, rawSort.field) ? rawSort : null;

    res.json({
      success: true,
      data: { module, pageSize, viewMode, sort },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/preferences/table/:module/page-size
 * Save records-per-page preference.
 */
export async function savePageSize(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, userId } = req.user!;
    const module = String(req.params.module);

    if (!isValidModule(module)) {
      throw new AppError('Not found', 404);
    }

    const { pageSize } = req.body;

    if (!VALID_PAGE_SIZES.includes(pageSize)) {
      throw new AppError(
        `Invalid pageSize. Must be one of: ${VALID_PAGE_SIZES.join(', ')}`,
        400,
      );
    }

    await repo.upsertUserPreference(tenantId, userId, module, 'pageSize', { pageSize });

    res.json({
      success: true,
      data: { module, pageSize },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/preferences/table/:module/view-mode
 * Save view mode preference (wrap / clip).
 */
export async function saveViewMode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, userId } = req.user!;
    const module = String(req.params.module);

    if (!isValidModule(module)) {
      throw new AppError('Not found', 404);
    }

    const { viewMode } = req.body;

    if (!VALID_VIEW_MODES.includes(viewMode)) {
      throw new AppError(
        `Invalid viewMode. Must be one of: ${VALID_VIEW_MODES.join(', ')}`,
        400,
      );
    }

    await repo.upsertUserPreference(tenantId, userId, module, 'viewMode', { viewMode });

    res.json({
      success: true,
      data: { module, viewMode },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/preferences/table/:module/sort
 * Save sort preference (field + direction).
 */
export async function saveSort(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, userId } = req.user!;
    const module = String(req.params.module);

    if (!isValidModule(module)) {
      throw new AppError('Not found', 404);
    }

    const { field, direction } = req.body;

    if (!field || typeof field !== 'string' || field.length > 100) {
      throw new AppError('Invalid sort field', 400);
    }

    if (!VALID_SORT_DIRECTIONS.includes(direction)) {
      throw new AppError(
        `Invalid sort direction. Must be one of: ${VALID_SORT_DIRECTIONS.join(', ')}`,
        400,
      );
    }

    await repo.upsertUserPreference(tenantId, userId, module, 'sort', { field, direction });

    res.json({
      success: true,
      data: { module, sort: { field, direction } },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────

function parsePageSize(value: unknown): number {
  if (!value) return 25; // default
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    if (data && typeof data === 'object' && 'pageSize' in data) {
      const ps = (data as { pageSize: unknown }).pageSize;
      if (typeof ps === 'number' && VALID_PAGE_SIZES.includes(ps)) {
        return ps;
      }
    }
    return 25;
  } catch {
    return 25;
  }
}

function parseViewMode(value: unknown): string {
  if (!value) return 'wrap'; // default
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    if (data && typeof data === 'object' && 'viewMode' in data) {
      const vm = (data as { viewMode: unknown }).viewMode;
      if (typeof vm === 'string' && VALID_VIEW_MODES.includes(vm)) {
        return vm;
      }
    }
    return 'wrap';
  } catch {
    return 'wrap';
  }
}

function parseSort(value: unknown): { field: string; direction: string } | null {
  if (!value) return null;
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    if (
      data &&
      typeof data === 'object' &&
      'field' in data &&
      'direction' in data
    ) {
      const d = data as { field: unknown; direction: unknown };
      if (
        typeof d.field === 'string' &&
        typeof d.direction === 'string' &&
        VALID_SORT_DIRECTIONS.includes(d.direction)
      ) {
        return { field: d.field, direction: d.direction };
      }
    }
    return null;
  } catch {
    return null;
  }
}
