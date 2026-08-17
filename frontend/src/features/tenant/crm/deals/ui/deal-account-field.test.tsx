/**
 * Unit tests for DealAccountField — Account combobox for Deal form.
 *
 * Validates Requirements:
 * - 11.1: Account combobox searches/displays tenant's accounts, single-select
 * - 11.4: Stores accountId (UUID) for submission, not the account name
 * - 11.7: Remove control deassociates without confirmation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { DealAccountField } from './deal-account-field';

// ─── Mock DataContext ─────────────────────────────────────────────────────────

const MOCK_ORGANIZATIONS = [
  { id: 'org-uuid-001', name: 'Acme Corp', industry: 'SaaS', tenantId: 't1' },
  { id: 'org-uuid-002', name: 'Globex Inc', industry: 'Telecom', tenantId: 't1' },
  { id: 'org-uuid-003', name: 'Initech', industry: 'IT', tenantId: 't1' },
  { id: 'org-uuid-004', name: 'Umbrella Corp', industry: 'Healthcare', tenantId: 't1' },
  { id: 'org-uuid-005', name: 'Stark Industries', industry: 'Manufacturing', tenantId: 't1' },
];

vi.mock('@/store/DataContext', () => ({
  useData: () => ({
    organizations: MOCK_ORGANIZATIONS,
    contacts: [],
    users: [],
    pipelines: [],
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DealAccountField', () => {
  let onChange: ReturnType<typeof vi.fn<(accountId: string | null) => void>>;

  beforeEach(() => {
    onChange = vi.fn<(accountId: string | null) => void>();
  });

  it('renders with placeholder text when no value is selected', () => {
    render(<DealAccountField value={null} onChange={onChange} />);
    expect(screen.getByText('Search accounts...')).toBeTruthy();
  });

  it('renders the label "Account"', () => {
    render(<DealAccountField value={null} onChange={onChange} />);
    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('displays selected account name when value is a valid account ID', () => {
    render(<DealAccountField value="org-uuid-001" onChange={onChange} />);
    expect(screen.getByText('Acme Corp')).toBeTruthy();
  });

  it('stores accountId (UUID) on selection — not the display name', async () => {
    render(<DealAccountField value={null} onChange={onChange} />);

    // Open the combobox
    const trigger = screen.getByRole('combobox');
    await act(async () => { fireEvent.click(trigger); });

    // Select "Globex Inc" (which has id org-uuid-002)
    await waitFor(() => {
      expect(screen.getByText('Globex Inc')).toBeTruthy();
    });
    await act(async () => { fireEvent.click(screen.getByText('Globex Inc')); });

    // Verify onChange was called with the UUID, not the name
    expect(onChange).toHaveBeenCalledWith('org-uuid-002');
    expect(onChange).not.toHaveBeenCalledWith('Globex Inc');
  });

  it('allows at most one account selection (single-select mode)', async () => {
    render(<DealAccountField value="org-uuid-001" onChange={onChange} />);

    // Should show "Acme Corp" as the single selection
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    // Should NOT show chips (which are multi-select UI)
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('remove control (X button) deassociates without confirmation', async () => {
    render(<DealAccountField value="org-uuid-001" onChange={onChange} />);

    // Find and click the clear/X button
    const clearButton = screen.getByLabelText('Clear selection');
    await act(async () => { fireEvent.click(clearButton); });

    // Should immediately call onChange with null — no confirmation dialog
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByText('Are you sure')).toBeNull();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('displays field error message when error prop is provided', () => {
    render(<DealAccountField value={null} onChange={onChange} error="Account is required" />);
    expect(screen.getByText('Account is required')).toBeTruthy();
  });

  it('is disabled when disabled prop is true', () => {
    render(<DealAccountField value={null} onChange={onChange} disabled />);
    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
  });

  it('searches accounts case-insensitively when typing in the combobox', async () => {
    render(<DealAccountField value={null} onChange={onChange} />);

    // Open the combobox
    const trigger = screen.getByRole('combobox');
    await act(async () => { fireEvent.click(trigger); });

    // Type search term
    const searchInput = screen.getByRole('searchbox');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'acme' } }); });

    // Wait for debounce (300ms) and verify filtering
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    }, { timeout: 1000 });
  });
});
