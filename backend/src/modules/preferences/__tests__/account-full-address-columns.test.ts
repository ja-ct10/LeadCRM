import { expect, it } from 'vitest';
import { ACCOUNTS_TABLE_COLUMNS, ACCOUNTS_TABLE_SORT_FIELDS, defaultFieldLayout, getCrmFieldCatalog, getWorkflowUpdateFields, normalizeModuleColumns, reconcileTableColumns, upgradeAssignmentLayout } from '@leadcrm/shared';
import { reconcileWithRegistry, validateAgainstRegistry } from '../preferences.service';

it('removes legacy columns from user/tenant preferences while preserving placement and width', () => {
  const legacy = [{ id: 'name', visible: true, order: 0 }, { id: 'city', visible: false, order: 1, width: 245 }, { id: 'country', visible: true, order: 2 }, { id: 'province', visible: true, order: 3 }, { id: 'internalNotes', visible: true, order: 4 }, { id: 'activeProductIds', visible: true, order: 5 }];
  const result = reconcileWithRegistry({ module: 'accounts', columns: legacy }, 'accounts');
  expect(result.columns[1]).toEqual({ id: 'address', visible: false, order: 1, width: 245 });
  expect(result.columns.map(column => column.id).sort()).toEqual(ACCOUNTS_TABLE_COLUMNS.map(column => column.id).sort());
  expect(validateAgainstRegistry(result, 'accounts').valid).toBe(true);
  expect(reconcileTableColumns('accounts', result.columns, ACCOUNTS_TABLE_COLUMNS)).toEqual(result.columns);
  expect(legacy[1].id).toBe('city');
});
it('upgrades the old address label and excludes retired Notes from the Account field catalog', () => {
  const layout = defaultFieldLayout('accounts');
  layout.fields.address = { label: 'Street Address', groupId: 'accounts:section:1', order: 0, visibleInForm: true, visibleInDetails: true };
  expect(getCrmFieldCatalog('accounts', [], layout).find(field => field.technicalKey === 'address')?.label).toBe('Company Address');
  expect(getCrmFieldCatalog('accounts').some(field => field.technicalKey === 'notes')).toBe(false);
  layout.fields.address.label = 'Delivery location';
  expect(getCrmFieldCatalog('accounts', [], layout).find(field => field.technicalKey === 'address')?.label).toBe('Delivery location');
  layout.fields.city = { ...layout.fields.address, label: 'City' };
  const upgraded = upgradeAssignmentLayout(layout);
  expect(upgraded.fields).not.toHaveProperty('city');
  for (const key of ['city','province','country']) {
    expect(getCrmFieldCatalog('accounts').some(field => field.technicalKey === key)).toBe(false);
    expect(getWorkflowUpdateFields('account').some(field => field.field === key)).toBe(false);
  }
});
it('prefers an existing Full Address preference and leaves other modules untouched', () => {
  const columns = [{ id: 'city', visible: true, order: 0 }, { id: 'address', visible: false, order: 1, width: 300 }];
  expect(normalizeModuleColumns('accounts', columns)).toEqual([columns[1]]);
  expect(normalizeModuleColumns('contacts', columns)).toBe(columns);
  expect(ACCOUNTS_TABLE_SORT_FIELDS).toContain('address');
  for (const field of ['activeProductIds', 'internalNotes', 'city', 'province', 'country']) {
    expect(ACCOUNTS_TABLE_COLUMNS.some(column => column.id === field)).toBe(false);
    expect(ACCOUNTS_TABLE_SORT_FIELDS).not.toContain(field);
  }
});
