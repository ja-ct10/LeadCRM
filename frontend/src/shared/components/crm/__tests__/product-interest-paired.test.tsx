import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { defaultFieldLayout } from '@leadcrm/shared';
import { ProductInterestField, ProductInterestSelect } from '../product-interest-select';
import { ConfiguredFormLayout } from '../configured-form-layout';
import type { useRecordCustomFields } from '../record-custom-fields';
afterEach(cleanup);
const products = [{ id: 'network', name: 'Network', category: 'Services' }, { id: 'camera', name: 'CCTV', category: 'Security' }];

it.each(['id', 'name'] as const)('keeps %s-mode selections while filtering the paired controls', valueMode => {
  const selected = valueMode === 'id' ? 'network' : 'Network', change = vi.fn();
  render(<ProductInterestField fieldKey="productInterestIds" label="Product Interest" error="Choose a product"><ProductInterestSelect products={products} values={[selected]} valueMode={valueMode} categories={['Services', 'Security', '', 'Security']} onChange={change} showUncategorized={false} /></ProductInterestField>);
  expect(screen.getAllByText('Product Category')).toHaveLength(1);
  expect(screen.queryByText('—')).toBeNull();
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['All categories', 'Security', 'Services']);
  const trigger = screen.getByRole('button', { name: 'Product Interest' });
  expect(screen.getByText('Product Interest').getAttribute('for')).toBe(trigger.id);
  expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  fireEvent.change(screen.getByRole('combobox', { name: 'Product category filter' }), { target: { value: 'Security' } });
  fireEvent.click(trigger);
  expect(screen.getByRole('checkbox', { name: 'Network' })).toHaveProperty('checked', true);
  expect(screen.getByRole('checkbox', { name: 'CCTV' })).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});

it('uses the configured product label once and respects field visibility', () => {
  const layout = defaultFieldLayout('leads');
  layout.fields.productInterestIds = { ...layout.fields.productInterestIds, label: 'Requested services' };
  const form = { module: 'leads', fields: [], layout, query: {} } as unknown as ReturnType<typeof useRecordCustomFields>;
  const children = <ProductInterestField fieldKey="productInterestIds" label="Product Interest"><ProductInterestSelect products={products} values={[]} onChange={vi.fn()} /></ProductInterestField>;
  const view = render(<ConfiguredFormLayout form={form}>{children}</ConfiguredFormLayout>);
  expect(screen.getAllByText('Requested services')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Requested services' })).toBeTruthy();
  expect(screen.getAllByRole('heading', { name: 'Status & Interest' })).toHaveLength(1);
  layout.fields.productInterestIds.visibleInForm = false;
  view.rerender(<ConfiguredFormLayout form={form}>{children}</ConfiguredFormLayout>);
  expect(screen.queryByRole('button', { name: 'Requested services' })).toBeNull();
});
