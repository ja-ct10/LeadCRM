import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearPageCache } from '@/shared/cache/page-cache';
import { QuotationWizard } from '../quotation-wizard';
import type { Template } from '@/store/types';

const ids = { recipient: '11111111-1111-4111-8111-111111111111', other: '22222222-2222-4222-8222-222222222222',
  deal: '33333333-3333-4333-8333-333333333333', otherDeal: '44444444-4444-4444-8444-444444444444',
  product: '55555555-5555-4555-8555-555555555555', otherProduct: '66666666-6666-4666-8666-666666666666' };
const mocks = vi.hoisted(() => ({ get: vi.fn(), preview: vi.fn(), send: vi.fn(), denied: new Set<string>(), products: [] as { id: string; name: string; category: string; description: string; dealValue: number; active: boolean }[] }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: mocks.get } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'sender', tenantId: 'tenant', role: 'Client Admin' }, tenant: { id: 'tenant' }, isLoading: false, authError: null }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (key: string) => !mocks.denied.has(key) }));
vi.mock('@/shared/hooks/use-panel-close-guard', () => ({ usePanelDraft: () => undefined }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: mocks.products, enabled: true, loading: false, error: '', hasLoaded: true }) }));
vi.mock('../campaign-variable-picker', () => ({ useCampaignVariableFields: () => ({ fields: [] }) }));
vi.mock('../quotation-variable-field', () => ({ QuotationVariableField: () => <textarea aria-label="Notes" /> }));
// Selector and API dependencies use fixtures; the wizard uses the real cache
// hook, shared contract, labels, field errors, quantities and navigation.
vi.mock('@/shared/components/entity-combobox', () => ({ EntityCombobox: (props: { id: string; value: string; onChange: (id: string) => void; error?: string; 'aria-labelledby': string; 'aria-required': boolean }) => <>
  <select id={props.id} aria-labelledby={props['aria-labelledby']} aria-required={props['aria-required']} value={props.value || ''} onChange={event => props.onChange(event.target.value)}><option value="">Search recipient</option><option value={ids.recipient}>Juan</option><option value={ids.other}>Maria</option></select>
  {props.error && <p role="alert">{props.error}</p>}
</> }));
vi.mock('../../services/quotations.api', () => ({ quotationsApi: { preview: mocks.preview, send: mocks.send }, quotationPdfBlob: () => new Blob(['%PDF-']), downloadQuotationPdf: vi.fn() }));
const template = { id: '77777777-7777-4777-8777-777777777777', name: 'CCTV Quotation', type: 'Quotation' } as Template;
const recipient = () => screen.getByRole('combobox', { name: 'Recipient' });
const deal = () => screen.getByRole('combobox', { name: 'Associated Deal' }) as HTMLSelectElement;
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
async function selectRecipient(id = ids.recipient) {
  fireEvent.change(recipient(), { target: { value: id } });
  await waitFor(() => expect(deal().disabled).toBe(false));
}
async function productsStep() {
  await selectRecipient(); fireEvent.change(deal(), { target: { value: ids.deal } }); next();
  return screen.findByRole('spinbutton', { name: 'Quantity for CCTV System' });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.denied.clear(); clearPageCache();
  mocks.products = [{ id: ids.product, name: 'CCTV System', category: 'Security', description: 'CCTV Setup', dealValue: 1234.56, active: true },
    { id: ids.otherProduct, name: 'Maintenance', category: 'Services', description: 'Annual care', dealValue: 500, active: true }];
  mocks.get.mockImplementation(async (path: string) => {
    if (path.endsWith('/relationships?limit=50')) return { data: { deals: [{ id: ids.deal, title: 'CCTV Deal' }, { id: ids.otherDeal, title: 'Maintenance Deal' }], hasMoreDeals: false } };
    if (path.includes('/deals/')) return { data: { id: path.split('/').at(-1), productInterestId: path.endsWith(ids.deal) ? ids.product : ids.otherProduct, value: 99999 } };
    return { data: { assignedUserId: 'sender', email: 'recipient@example.test' } };
  });
  mocks.preview.mockResolvedValue({ data: { fingerprint: 'a'.repeat(64), pdfBase64: 'JVBERi0=', filename: 'quote.pdf', document: { total: '3703.68' } } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:quotation') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(cleanup);

it('reuses required labels, blocks missing fields, focuses the invalid control and keeps Deal visible', async () => {
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  for (const name of ['Send To', 'Recipient', 'Associated Deal']) {
    expect(screen.getByRole('combobox', { name }).getAttribute('aria-required')).toBe('true');
    expect(screen.getByText(name, { selector: 'label' }).querySelector('span.text-red-500[aria-hidden="true"]')?.textContent).toBe('*');
  }
  expect(deal().disabled).toBe(true); expect(screen.queryByText(/Optional/)).toBeNull();
  next(); expect(screen.getByRole('alert').textContent).toContain('Select an available recipient'); expect(document.activeElement).toBe(recipient());
  await selectRecipient(); next(); expect(screen.getByRole('alert').textContent).toBe('Associated Deal is required.'); expect(document.activeElement).toBe(deal());
  expect(screen.queryByText('Quotation Details', { selector: 'h2' })).toBeNull();
});
it('loads canonical Product metadata and catalog price, removes manual selection and retains quantity across Back/Next', async () => {
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  const quantity = await productsStep();
  for (const label of ['Product', 'Category', 'Description', 'Qty', 'Deal Value', 'Total']) expect(screen.getByRole('columnheader', { name: label })).toBeTruthy();
  for (const text of ['CCTV System', 'Security', 'CCTV Setup']) expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Add Product|Remove/ })).toBeNull();
  expect(screen.getAllByText('₱1,234.56')).toHaveLength(2);
  fireEvent.change(quantity, { target: { value: '3' } }); expect(screen.getByText('Total: ₱3,703.68')).toBeTruthy();
  next(); expect(screen.getByRole('heading', { name: 'Quotation Details' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' })); expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3');
  fireEvent.click(screen.getByRole('button', { name: 'Back' })); expect(deal().value).toBe(ids.deal); next();
  expect((await screen.findByRole('spinbutton') as HTMLInputElement).value).toBe('3');
});
it.each(['0', '-1', '1.5', '1000001'])('blocks invalid quantity %s before Quotation Details', async value => {
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  fireEvent.change(await productsStep(), { target: { value } }); next();
  expect(screen.getByRole('alert').textContent).toContain('positive whole-number'); expect(screen.getByRole('heading', { name: 'Products' })).toBeTruthy();
});
it('clears dependent selections on recipient/type changes and resets quantity for a new Deal', async () => {
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  fireEvent.change(await productsStep(), { target: { value: '4' } }); fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.change(deal(), { target: { value: ids.otherDeal } }); next();
  expect((await screen.findByRole('spinbutton', { name: 'Quantity for Maintenance' }) as HTMLInputElement).value).toBe('1'); expect(screen.queryByText('CCTV System')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back' })); await selectRecipient(ids.other); expect(deal().value).toBe(''); next();
  expect(screen.getByRole('alert').textContent).toBe('Associated Deal is required.');
  fireEvent.change(screen.getByRole('combobox', { name: 'Send To' }), { target: { value: 'Contact' } }); expect((recipient() as HTMLSelectElement).value).toBe(''); expect(deal().value).toBe('');
});
it.each([null, 'inactive'])('blocks a Deal with %s Product without displaying a zero quotation', async value => {
  if (value === 'inactive') mocks.products[0].active = false;
  else {
    const original = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) => path.includes('/deals/') ? Promise.resolve({ data: { id: ids.deal, productInterestId: null } }) : original(path));
  }
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  await selectRecipient(); fireEvent.change(deal(), { target: { value: ids.deal } }); next();
  const message = value === null ? 'No product is associated with this Deal. Please select a Deal with an assigned product.' : 'The Deal’s Product is unavailable. Select a Deal with an available Product.';
  expect(await screen.findByText(message)).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByText(/Total:/)).toBeNull();
  next(); expect(screen.getByRole('heading', { name: 'Products' })).toBeTruthy(); expect(mocks.preview).not.toHaveBeenCalled();
});
it('ignores a late response from the previously selected Deal', async () => {
  const original = mocks.get.getMockImplementation()!; let resolveOld!: (value: unknown) => void;
  mocks.get.mockImplementation((path: string) => path.endsWith(`/deals/${ids.deal}`) ? new Promise(resolve => { resolveOld = resolve; }) : original(path));
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  await selectRecipient(); fireEvent.change(deal(), { target: { value: ids.deal } }); await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
  fireEvent.change(deal(), { target: { value: ids.otherDeal } }); next(); await screen.findByRole('spinbutton', { name: 'Quantity for Maintenance' });
  await act(async () => resolveOld({ data: { id: ids.deal, productInterestId: ids.product } }));
  expect(screen.queryByText('CCTV System')).toBeNull(); expect(screen.getAllByRole('row')).toHaveLength(2);
});
it('resets quantity when switching between cached Deals linked to the same Product', async () => {
  const original = mocks.get.getMockImplementation()!;
  mocks.get.mockImplementation((path: string) => path.includes('/deals/') ? Promise.resolve({ data: { id: path.split('/').at(-1), productInterestId: ids.product } }) : original(path));
  render(<QuotationWizard template={template} onClose={vi.fn()} />);
  fireEvent.change(await productsStep(), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.change(deal(), { target: { value: ids.otherDeal } }); next();
  await waitFor(() => expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.change(deal(), { target: { value: ids.deal } }); next();
  await waitFor(() => expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1'));
});
it('invalidates a reviewed PDF when catalog data changes and sends the bound Deal/Product to preview', async () => {
  const view = render(<QuotationWizard template={template} onClose={vi.fn()} />);
  fireEvent.change(await productsStep(), { target: { value: '3' } }); next(); next();
  await screen.findByTitle('Quotation PDF preview');
  expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ dealId: ids.deal, products: [{ productId: ids.product, quantity: 3 }] }));
  mocks.products = mocks.products.map(product => ({ ...product, dealValue: product.dealValue + 1 })); view.rerender(<QuotationWizard template={template} onClose={vi.fn()} />);
  await waitFor(() => expect(screen.queryByTitle('Quotation PDF preview')).toBeNull());
  expect(screen.getByRole('heading', { name: 'Quotation Details' })).toBeTruthy(); expect(screen.getByRole('alert').textContent).toContain('Refresh the preview');
});
it('keeps required Deal disabled when Deals View is missing', async () => {
  mocks.denied.add('deals.view'); render(<QuotationWizard template={template} onClose={vi.fn()} />);
  fireEvent.change(recipient(), { target: { value: ids.recipient } }); await screen.findByText('Deals View permission is required.');
  expect(deal().disabled).toBe(true); expect(mocks.get.mock.calls.some(([path]) => path.includes('/relationships'))).toBe(false);
});
