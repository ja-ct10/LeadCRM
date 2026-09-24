import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Client Admin' } }) }));
vi.mock('@/shared/services/audit.api', () => ({ auditApi: { list: mocks.list } }));
vi.mock('@/shared/components/charts/ChartComponents', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return { ResponsiveContainer: Container, AreaChart: Container, BarChart: Container, Area: Empty, XAxis: Empty, YAxis: Empty, Tooltip: Empty, CartesianGrid: Empty, Bar: Empty, Cell: Empty };
});
import AuditLogsPage from './audit-logs-page';
const log = { id: 'audit', action: 'ENVIRONMENT_CHANGED_WITH_LONG_ACTION', severity: 'WARNING', entityType: 'USER', entityId: 'long-entity-id', createdAt: '2026-09-23T10:00:00Z', user: { email: 'long.operator@camxian.com' }, ipAddress: '127.0.0.1' };
beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue({ data: [log], meta: { total: 26 } }); });
afterEach(cleanup);

it('renders mobile cards and desktop rows from one request; selection opens the same inspector', async () => {
  render(<AuditLogsPage />);
  const records = screen.getByLabelText('Audit records');
  const card = await within(records).findByRole('button');
  expect(card.textContent).toContain(log.action);
  expect(card.textContent).toContain(log.user.email);
  expect(card.textContent).toContain(log.entityId);
  expect(mocks.list).toHaveBeenCalledTimes(1);
  fireEvent.click(card);
  expect(card.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Event Reference ID')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'WARNING' } });
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'WARNING', page: 1 }), false));
  fireEvent.click(screen.getByLabelText('Next page'));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), false));
});

it('retains loading, empty, failure and retry behavior', async () => {
  mocks.list.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({ data: [], meta: { total: 0 } });
  render(<AuditLogsPage />);
  expect(screen.getByLabelText('Loading audit logs')).toBeTruthy();
  await screen.findByText('Failed to load audit logs');
  fireEvent.click(screen.getByText('Retry'));
  await within(screen.getByLabelText('Audit records')).findByText(/No audit logs found/);
  expect(mocks.list).toHaveBeenCalledTimes(2);
});
