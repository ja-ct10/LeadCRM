import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LeadsDataGrid } from '../leads-data-grid';
import { toFrontendContact } from '@/lib/api/adapters/contact.adapter';
import type { Lead } from '@/store/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('renders all products and populated API details without relying on the user lookup page', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const owner = { id: 'owner', firstName: 'Alex', lastName: 'Morgan' };
  const lead = toFrontendContact({ id: 'lead', firstName: 'Jordan', lastName: 'Lee',
    productInterest: ['CCTV', 'Biometrics'], description: 'Installation request', website: 'https://example.test',
    assignedUser: owner, assignedUserId: owner.id, createdBy: owner, updatedBy: owner,
  }) as Lead;
  render(<LeadsDataGrid leads={[lead]} totalRecords={1}
    effectiveColumns={['firstName', 'productInterest', 'description', 'website', 'createdBy', 'updatedBy', 'assignedUserId'].map((id, order) => ({ id, order, visible: true }))}
    selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={vi.fn()} getOwnerName={() => '—'} getOwnerInitials={() => '?'} />);
  expect(screen.getByText('CCTV')).toBeTruthy();
  expect(screen.getByText('Biometrics')).toBeTruthy();
  expect(screen.getByText('Installation request')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'example.test' }).getAttribute('href')).toBe('https://example.test');
  expect(screen.getAllByText('Alex Morgan')).toHaveLength(3);
});
