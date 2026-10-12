import { beforeEach, expect, it, vi } from 'vitest';
import { normalizeLeadColumns, normalizeModuleColumns, SaveColumnsBodySchema, type ColumnConfigItem } from '@leadcrm/shared';
import { getSystemDefault, getSortableFields, LEADS_COLUMN_REGISTRY } from '../column-registry';
import { reconcileWithRegistry, resolveEffectiveColumns, upsertUserPreference, deleteUserPreference, validateAgainstRegistry } from '../preferences.service';
import * as repo from '../preferences.repository';

vi.mock('../preferences.repository');
const oldDefault = ['firstName', 'assignedUserId', 'email', 'phone', 'companyName', 'status', 'createdAt', 'source']
  .map((id, order): ColumnConfigItem => ({ id, order, visible: true, width: 150 + order }));
const expectedDefault = ['name', 'email', 'phone', 'companyName', 'status', 'assignedUserId', 'source'];
const visibleIds = (columns: ColumnConfigItem[]) => [...columns].sort((a, b) => a.order - b.order).filter(column => column.visible).map(column => column.id);
beforeEach(() => vi.resetAllMocks());

it('hides Name through authenticated saves and resolves conflicting legacy names without changing widths', async () => {
  const config = getSystemDefault('leads').columns.map(column => ({ ...column, width: 230, visible: ['name', 'firstName', 'lastName'].includes(column.id) ? true : column.visible }));
  const result = await upsertUserPreference('tenant', 'user', 'leads', { module: 'leads', columns: config });
  expect(result.columns.find(column => column.id === 'name')?.visible).toBe(true);
  expect(result.columns.filter(column => ['firstName', 'lastName'].includes(column.id)).every(column => !column.visible)).toBe(true);
  expect(result.columns.every(column => column.width === 230)).toBe(true);
  const split = config.map(column => column.id === 'name' ? { ...column, visible: false } : column);
  const switched = await upsertUserPreference('tenant', 'user', 'leads', { module: 'leads', columns: split });
  expect(switched.columns[0]).toMatchObject({ id: 'name', visible: false, order: 0 });
  expect(switched.columns.filter(column => ['firstName', 'lastName'].includes(column.id)).every(column => column.visible)).toBe(true);
});

it('uses shared supported defaults with fixed Name and optional individual name fields', () => {
  expect(visibleIds(getSystemDefault('leads').columns)).toEqual(expectedDefault);
  expect(getSortableFields('leads')).toEqual(expect.arrayContaining(['name', 'firstName', 'lastName']));
  expect(LEADS_COLUMN_REGISTRY.columns.find(column => column.id === 'name')).toMatchObject({ required: false, fixedPosition: 'first', pinned: 'left' });
  expect(LEADS_COLUMN_REGISTRY.columns.find(column => column.id === 'firstName')?.required).toBe(false);
});

it.each([
  { columns: oldDefault },
  { columns: ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'assignedUserId'].map((id, order) => ({ id, order, visible: true, width: 185 + order })) },
])('upgrades untouched historical defaults without mutating or discarding saved widths', ({ columns }) => {
  const snapshot = structuredClone(columns);
  const upgraded = reconcileWithRegistry({ module: 'leads', columns }, 'leads').columns;
  expect(visibleIds(upgraded)).toEqual(expectedDefault);
  for (const column of snapshot) expect(upgraded.find(item => item.id === column.id)?.width).toBe(column.width);
  expect(columns).toEqual(snapshot);
  expect(normalizeLeadColumns(upgraded)).toEqual(upgraded);
});

it('puts Name first and preserves custom order, widths and explicit individual name visibility', () => {
  const custom: ColumnConfigItem[] = [
    { id: 'email', order: 0, visible: true, width: 275 },
    { id: 'firstName', order: 1, visible: false, width: 190 },
    { id: 'companyName', order: 2, visible: false, width: 220 },
    { id: 'lastName', order: 3, visible: true, width: 205 },
    { id: 'status', order: 4, visible: true },
  ];
  const upgraded = normalizeLeadColumns(custom);
  expect(upgraded[0]).toMatchObject({ id: 'name', visible: false, order: 0 });
  expect(visibleIds(upgraded)).toEqual(['email', 'lastName', 'status']);
  expect(upgraded.slice(1).map(({ order, ...column }) => column)).toEqual(custom.map(({ order, ...column }) => column));
  expect(normalizeLeadColumns(upgraded)).toEqual(upgraded);
  expect(normalizeModuleColumns('contacts', custom)).toBe(custom);
});

it('keeps a hidden Name first, retaining its saved width', () => {
  const result = reconcileWithRegistry({ module: 'leads', columns: [
    { id: 'email', order: 0, visible: true, width: 270 },
    { id: 'name', order: 5, visible: false, width: 315 },
    { id: 'firstName', order: 6, visible: false },
    { id: 'lastName', order: 7, visible: false },
  ] }, 'leads').columns;
  expect(result[0]).toEqual({ id: 'name', order: 0, visible: false, width: 315 });
  expect(result.filter(column => column.id === 'name')).toHaveLength(1);
  expect(result.find(column => column.id === 'email')?.width).toBe(270);
  expect(result.find(column => column.id === 'firstName')?.visible).toBe(false);
});

it('retains legacy email/phone migration and retires unsupported choices with sequential orders', () => {
  const columns = normalizeLeadColumns([
    { id: 'firstName', order: 0, visible: false },
    { id: 'emailAndPhone', order: 1, visible: true },
    { id: 'latestSmsDate', order: 65, visible: true },
    { id: 'phoneAction', order: 70, visible: true },
    { id: 'accountId', order: 75, visible: true, width: 255 },
  ]);
  expect(visibleIds(columns)).toEqual(['name', 'email', 'phone', 'accountId']);
  expect(columns.map(column => column.order)).toEqual(columns.map((_, index) => index));
  expect(columns.find(column => column.id === 'accountId')?.width).toBe(255);
  expect(normalizeLeadColumns(columns)).toEqual(columns);
  expect(validateAgainstRegistry({ module: 'leads', columns }, 'leads').valid).toBe(true);
});

it.each(['user', 'tenant'])('normalizes an old %s preference on read without rewriting it', async layer => {
  const preference = { id: 'saved', value: { columns: oldDefault } } as any;
  vi.mocked(repo.findUserPreference).mockResolvedValue(layer === 'user' ? preference : null);
  vi.mocked(repo.findTenantPreference).mockResolvedValue(layer === 'tenant' ? preference : null);
  const result = await resolveEffectiveColumns('tenant', 'user', 'leads');
  expect(visibleIds(result.columns)).toEqual(expectedDefault);
  expect(repo.findUserPreference).toHaveBeenCalledWith('tenant', 'user', 'leads', 'columns');
  expect(repo.upsertUserPreference).not.toHaveBeenCalled();
  expect(repo.upsertTenantPreference).not.toHaveBeenCalled();
  expect(repo.deleteUserPreference).not.toHaveBeenCalled();
  expect(repo.deleteTenantPreference).not.toHaveBeenCalled();
});

it('preserves widths through stored schema parsing, saving, and tenant fallback after reset', async () => {
  const columns = getSystemDefault('leads').columns.map(column => ({ ...column, width: column.id === 'name' ? 320 : 190 }));
  expect(SaveColumnsBodySchema.parse({ columns }).columns).toEqual(columns);
  vi.mocked(repo.findUserPreference).mockResolvedValue({ value: { columns } } as any);
  expect((await resolveEffectiveColumns('tenant', 'user', 'leads')).columns).toEqual(columns);
  await upsertUserPreference('tenant', 'user', 'leads', { module: 'leads', columns });
  expect(repo.upsertUserPreference).toHaveBeenCalledWith('tenant', 'user', 'leads', 'columns', { columns });
  vi.mocked(repo.findUserPreference).mockResolvedValue(null);
  vi.mocked(repo.findTenantPreference).mockResolvedValue({ value: { columns } } as any);
  expect((await deleteUserPreference('tenant', 'user', 'leads')).columns).toEqual(columns);
  expect(repo.deleteUserPreference).toHaveBeenCalledWith('tenant', 'user', 'leads', 'columns');
});

it('accepts documented retired choices from old clients while rejecting arbitrary or malformed input', async () => {
  const legacy = [...oldDefault, { id: 'phoneAction', order: 70, visible: true }];
  const result = await upsertUserPreference('tenant', 'user', 'leads', { module: 'leads', columns: legacy });
  expect(result.columns.some(column => column.id === 'phoneAction')).toBe(false);
  expect(result.columns.map(column => column.order)).toEqual(result.columns.map((_, index) => index));
  for (const columns of [
    [{ id: 'arbitrarySecret', order: 0, visible: true }],
    [{ id: 'email', order: -1, visible: true }],
    [{ id: 'email', order: 0, visible: true, width: -20 }],
    [{ id: 'email', order: 0, visible: true }, { id: 'email', order: 1, visible: false }],
  ]) {
    vi.mocked(repo.upsertUserPreference).mockClear();
    await expect(upsertUserPreference('tenant', 'user', 'leads', { module: 'leads', columns })).rejects.toThrow();
    expect(repo.upsertUserPreference).not.toHaveBeenCalled();
  }
});
