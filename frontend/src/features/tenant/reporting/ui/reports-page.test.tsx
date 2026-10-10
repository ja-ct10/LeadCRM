import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/features/tenant/dashboard/ui/dashboard', () => ({ default: ({ heading }: { heading: string }) => <div>{heading}<button>Export CSV</button></div> }));
import ReportsPage from './reports-page';
afterEach(cleanup);
it('uses the canonical reporting UI with its export and report title', () => {
  render(<ReportsPage />);
  expect(screen.getByText('Analytics & Reports')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
});
