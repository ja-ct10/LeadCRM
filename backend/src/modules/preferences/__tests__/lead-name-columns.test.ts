import { beforeEach, expect, it, vi } from 'vitest';
import { normalizeLeadColumns, normalizeModuleColumns, type ColumnConfigItem } from '@leadcrm/shared';
import { getSystemDefault, getSortableFields } from '../column-registry';
import { reconcileWithRegistry, resolveEffectiveColumns } from '../preferences.service';
import * as repo from '../preferences.repository';

vi.mock('../preferences.repository');
const oldDefault = ['firstName', 'assignedUserId', 'email', 'phone', 'companyName', 'status', 'createdAt', 'source']
  .map((id, order): ColumnConfigItem => ({ id, order, visible: true, width: 150 + order }));
const expectedDefault = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'assignedUserId'];
const visibleIds = (columns: ColumnConfigItem[]) => [...columns].sort((a, b) => a.order - b.order).filter(column => column.visible).map(column => column.id);
beforeEach(() => vi.resetAllMocks());

it('keeps frontend-compatible system defaults and both sort fields in the backend', () => {
  expect(visibleIds(getSystemDefault('leads').columns)).toEqual(expectedDefault);
  expect(getSortableFields('leads')).toEqual(expect.arrayContaining(['firstName', 'lastName']));
});

it('upgrades old default snapshots without mutating them or discarding widths', () => {
  const snapshot = structuredClone(oldDefault);
  const upgraded = reconcileWithRegistry({ module: 'leads', columns: oldDefault }, 'leads').columns;
  expect(visibleIds(upgraded)).toEqual(expectedDefault);
  for (const column of snapshot) expect(upgraded.find(item => item.id === column.id)?.width).toBe(column.width);
  expect(oldDefault).toEqual(snapshot);
  expect(normalizeLeadColumns(upgraded)).toBe(upgraded);
});

it('adds Last Name beside First Name while preserving a custom layout and hidden fields', () => {
  const custom: ColumnConfigItem[] = [
    { id: 'email', order: 0, visible: true, width: 275 },
    { id: 'firstName', order: 1, visible: true, width: 190 },
    { id: 'companyName', order: 2, visible: false, width: 220 },
    { id: 'status', order: 3, visible: true },
    { id: 'createdAt', order: 4, visible: true },
  ];
  const upgraded = normalizeLeadColumns(custom);
  expect(upgraded.map(column => column.id)).toEqual(['email', 'firstName', 'lastName', 'companyName', 'status', 'createdAt']);
  expect(visibleIds(upgraded)).toEqual(['email', 'firstName', 'lastName', 'status', 'createdAt']);
  expect(upgraded.filter(column => column.id !== 'lastName').map(({ order, ...column }) => column))
    .toEqual(custom.map(({ order, ...column }) => column));
});

it('respects an explicit Last Name visibility/order/width and leaves other modules untouched', () => {
  const columns = [...oldDefault, { id: 'lastName', order: 99, visible: false, width: 200 }];
  expect(normalizeLeadColumns(columns)).toBe(columns);
  expect(normalizeModuleColumns('contacts', oldDefault)).toBe(oldDefault);
  expect(normalizeLeadColumns([])).toEqual([]);
});

it('retains the previous email/phone migration and is idempotent', () => {
  const columns = normalizeLeadColumns([{ id: 'firstName', order: 0, visible: true }, { id: 'emailAndPhone', order: 1, visible: true }]);
  expect(visibleIds(columns)).toEqual(['firstName', 'lastName', 'email', 'phone']);
  expect(normalizeLeadColumns(columns)).toBe(columns);
  expect(normalizeLeadColumns(columns.map(column => column.id === 'phone' ? { ...column, visible: false } : column))
    .find(column => column.id === 'phone')?.visible).toBe(false);
});

it.each(['user', 'tenant'])('normalizes an old %s preference on read without writing or deleting it', async layer => {
  const preference = { id: 'saved', value: { columns: oldDefault } } as any;
  vi.mocked(repo.findUserPreference).mockResolvedValue(layer === 'user' ? preference : null);
  vi.mocked(repo.findTenantPreference).mockResolvedValue(layer === 'tenant' ? preference : null);
  const result = await resolveEffectiveColumns('tenant', 'user', 'leads');
  expect(visibleIds(result.columns)).toEqual(expectedDefault);
  expect(repo.upsertUserPreference).not.toHaveBeenCalled();
  expect(repo.upsertTenantPreference).not.toHaveBeenCalled();
  expect(repo.deleteUserPreference).not.toHaveBeenCalled();
  expect(repo.deleteTenantPreference).not.toHaveBeenCalled();
});
