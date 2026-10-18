import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QuotationWizard } from '../quotation-wizard';
import type { Template } from '@/store/types';

vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent' } }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-panel-close-guard', () => ({ usePanelDraft: () => undefined }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [], enabled: true }) }));
vi.mock('../campaign-variable-picker', () => ({ useCampaignVariableFields: () => ({ fields: [] }) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: ({ params }: any) => ({ data: { recordId: params.quotationRecipient, email: 'fixture@example.test', assignedUserId: 'agent', deals: [{ id: 'linked-deal', title: 'Linked Deal' }], hasMoreDeals: false } }) }));
vi.mock('@/shared/components/entity-combobox', () => ({ EntityCombobox: ({ entityType, value, onChange }: any) => <select aria-label={`Search ${entityType}`} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">Choose</option><option value="person">Person</option><option value="another">Another person</option></select> }));
afterEach(cleanup);

it.each(['Lead', 'Contact'])('requires a linked Deal for a %s recipient and clears the stale Deal when the recipient changes', type => {
  render(<QuotationWizard template={{ id: 'template', name: 'Quotation' } as Template} onClose={() => {}} />);
  if (type === 'Contact') fireEvent.change(screen.getByLabelText('Send To *'), { target: { value: type } });
  fireEvent.change(screen.getByRole('combobox', { name: `Search ${type.toLowerCase()}s` }), { target: { value: 'person' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('alert').textContent).toContain('Select an Associated Deal');
  const deals = screen.getByLabelText(/Associated Deal/);
  fireEvent.change(deals, { target: { value: 'linked-deal' } });
  fireEvent.change(screen.getByRole('combobox', { name: `Search ${type.toLowerCase()}s` }), { target: { value: 'another' } });
  expect(deals).toHaveProperty('value', '');
  fireEvent.change(deals, { target: { value: 'linked-deal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('heading', { name: 'Products' })).toBeTruthy();
});
