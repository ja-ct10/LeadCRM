import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductCategoryValue, productCategoriesForSelection } from '../product-category-value';
import { InlineEditRows } from '../inline-edit-rows';
const products = [{ id: 'one', name: 'Camera', category: 'Security' }, { id: 'two', name: 'Lock', category: 'Security' }, { id: 'three', name: 'Legacy', category: '' }];
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [...products, { id: 'four', name: 'Router', category: 'Network' }], loading: false }) }));
afterEach(cleanup);
it('deduplicates categories in selection order and distinguishes known blanks from unresolved products', () => {
  expect(productCategoriesForSelection(['one', 'two', 'three'], products)).toBe('Security, Uncategorized');
  expect(productCategoriesForSelection(['missing'], products)).toBe('—');
  expect(productCategoriesForSelection([], products)).toBe('—');
  expect(productCategoriesForSelection(['Camera'], [...products, { id: 'replacement', name: 'Camera', category: 'Wrong' }], 'name')).toBe('—');
});
it('updates a read-only category when product selections change', () => {
  const view = render(<ProductCategoryValue values={['one']} products={products} />);
  expect(screen.getByText('Security')).toBeTruthy();
  view.rerender(<ProductCategoryValue values={['three']} products={products} />);
  expect(screen.getByText('Uncategorized')).toBeTruthy();
});
it('places the category immediately above an inline product field and follows the unsaved selection', async () => {
  const save = vi.fn();
  render(<InlineEditRows rows={[{ technicalKey: 'productInterestIds', label: 'Product Interest', type: 'products', value: ['one'], displayValue: ['Camera'], apiField: 'productInterest', productRecords: products }]} canEdit onSave={save} />);
  expect(screen.getByText('Product Category').closest('div')?.nextElementSibling?.textContent).toContain('Product Interest');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Product Interest' }));
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Router' }));
  await waitFor(() => expect(screen.getByText('Security, Network')).toBeTruthy());
  expect(save).not.toHaveBeenCalled();
});
