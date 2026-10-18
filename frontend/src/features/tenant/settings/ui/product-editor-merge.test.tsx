import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProductEditor } from './product-editor';

afterEach(cleanup);

it('requires a selected category while preserving the Product description and single category control', async () => {
  const save = vi.fn(async () => {});
  render(<ProductEditor busy={false} categories={['Security']} onSave={save} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Product Name'), { target: { value: 'Camera' } });
  fireEvent.change(screen.getByLabelText('Deal Value (PHP)'), { target: { value: '15000' } });
  fireEvent.change(screen.getByLabelText('Product Description'), { target: { value: 'Includes installation' } });
  expect(screen.getAllByRole('combobox', { name: 'Category' })).toHaveLength(1);
  expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect(screen.getByText('Category is required.')).toBeTruthy(); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Security' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ name: 'Camera', category: 'Security', description: 'Includes installation', dealValue: 15000 }));
});

it('preserves existing 200-character categories, descriptions and decimal values when editing', async () => {
  const save = vi.fn(async () => {});
  const product = { id: 'product', name: 'Camera', category: 'C'.repeat(200), description: 'Existing description', dealValue: 15000.5, active: true, createdAt: '', updatedAt: '' };
  render(<ProductEditor product={product} categories={[product.category]} busy={false} onSave={save} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ name: product.name, category: product.category, description: product.description, dealValue: product.dealValue }));
});
