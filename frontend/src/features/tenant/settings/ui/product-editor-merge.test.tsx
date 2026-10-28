import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProductEditor } from './product-editor';

afterEach(cleanup);

it('saves and reopens literal Unicode Product text with meaningful placeholders', async () => {
  const name = `ñ é 中文 日本語 한글 مرحبا 😊 & ' " < > ∑ ₱ e\u0301`;
  const description = `${name}\n<tag>literal text</tag>`;
  const save = vi.fn(async () => {});
  const view = render(<ProductEditor busy={false} categories={['Security']} onSave={save} onCancel={() => {}} />);
  expect(screen.getByPlaceholderText('Enter product name...')).toBe(screen.getByLabelText('Product Name'));
  expect(screen.getByPlaceholderText('Describe this product...')).toBe(screen.getByLabelText('Product Description'));
  fireEvent.change(screen.getByLabelText('Product Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Product Description'), { target: { value: description } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Security' } });
  fireEvent.change(screen.getByLabelText('Deal Value (PHP)'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ name, description, category: 'Security', dealValue: 123 }));
  view.unmount();
  render(<ProductEditor product={{ name, description, category: 'Security', dealValue: 123, id: 'saved', active: true, createdAt: '', updatedAt: '' }} busy={false} categories={['Security']} onSave={save} onCancel={() => {}} />);
  expect(screen.getByLabelText('Product Name')).toHaveProperty('value', name);
  expect(screen.getByLabelText('Product Description')).toHaveProperty('value', description);
});

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
