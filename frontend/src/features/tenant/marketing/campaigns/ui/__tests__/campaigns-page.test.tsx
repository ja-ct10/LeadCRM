import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CUSTOM_FIELD_MODULES, getCrmFieldCatalog, type ClosingField } from '@leadcrm/shared';
import { clearPageCache } from '@/shared/cache/page-cache';
const mocks = vi.hoisted(() => ({ get: vi.fn(), duplicate: vi.fn(), create: vi.fn(), archive: vi.fn(), refresh: vi.fn(), variableFields: vi.fn(), emailSettings: vi.fn(), smsSettings: vi.fn(), templates: [] as Array<{ id: string; name: string; type: 'Email' | 'SMS'; content: string; subject?: string; category: string }>, permitted: true, initial: false, refreshing: false }));
const campaign = { id: 'campaign', name: 'Saved campaign', type: 'Email', status: 'sent', targetAudience: 'All Leads', sentCount: 4, openedCount: 2, clickedCount: 1, createdAt: '2026-09-30' };
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', tenantId: 'tenant', role: 'Client Admin' }, tenant: { id: 'tenant' }, isLoading: false }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => mocks.permitted }));
vi.mock('../../hooks/use-campaigns-data', () => ({ useCampaignsData: () => ({ campaigns: [campaign], total: 1, templates: mocks.templates, metrics: { activeCampaigns: 1, sent: 10, emailSent: 4, opened: 2, clicked: 1 }, isInitialLoad: mocks.initial, isRefreshing: mocks.refreshing, refetch: mocks.refresh }) }));
vi.mock('@/shared/services/campaigns.api', () => ({ campaignsApi: { get: mocks.get, duplicate: mocks.duplicate, create: mocks.create, archive: mocks.archive, variableFields: mocks.variableFields, emailSettings: mocks.emailSettings, smsSettings: mocks.smsSettings } }));
vi.mock('../campaign-builder', () => ({ CampaignBuilder: () => <div>Campaign editor</div> }));
vi.mock('../campaign-report-view', () => ({ CampaignReportView: () => <div>Campaign report</div> }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn() }) }));
import CampaignsPage from '../campaigns-page';
beforeEach(() => { clearPageCache(); vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.clearAllMocks(); mocks.templates = []; mocks.permitted = true; mocks.initial = false; mocks.refreshing = false; mocks.archive.mockResolvedValue({ success: true }); mocks.refresh.mockResolvedValue(undefined); mocks.variableFields.mockResolvedValue({ success: true, data: CUSTOM_FIELD_MODULES.flatMap(module => getCrmFieldCatalog(module)) }); mocks.emailSettings.mockResolvedValue({ success: true, data: { senderName: 'Provider sender', senderEmail: 'provider@example.test' } }); mocks.smsSettings.mockResolvedValue({ success: true, data: { organizationName: 'SMS organization', organizationEmail: 'contact@example.test' } }); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); clearPageCache(); });
it('keeps the email open rate independent of submitted SMS volume', () => {
  render(<CampaignsPage />);
  expect(screen.getByRole('progressbar', { name: 'Average open rate: 50.0%' })).toBeTruthy();
});
it('opens View and duplicates the complete saved campaign into a new draft', async () => {
  mocks.get.mockResolvedValue({ data: { ...campaign, subject: 'Saved subject', body: '<p>Saved body</p>', audienceSource: 'LEADS' } });
  mocks.create.mockResolvedValue({ data: { id: 'copy' } });
  render(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['View', 'Duplicate', 'Archive']);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  await waitFor(() => expect(mocks.duplicate).toHaveBeenCalledWith('campaign'));
  expect(mocks.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
  expect(screen.getByText('Campaign report')).toBeTruthy();
});
it('archives only selected campaigns after confirmation and refreshes', async () => {
  render(<CampaignsPage />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(mocks.archive).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: 'Archive 1 campaign?' })).toBeTruthy();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith('campaign'));
  await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  expect(mocks.refresh).toHaveBeenCalled();
});
it('retains View without exposing forbidden mutations', () => {
  mocks.permitted = false;
  render(<CampaignsPage />);
  expect(screen.queryByRole('checkbox', { name: 'Select all records' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['View']);
});

it('uses the Leads blue filter state and returns to inactive when closed', () => {
  render(<CampaignsPage />);
  const filter = screen.getByLabelText('Filter campaigns');
  fireEvent.click(filter); expect(filter.className).toContain('bg-primary'); expect(filter.className).toContain('text-white');
  fireEvent.click(filter); expect(filter.className).toContain('bg-white'); expect(filter.getAttribute('aria-expanded')).toBe('false');
});
it.each(['initial', 'refreshing'] as const)('keeps the campaign controls visible during %s table loading', state => {
  mocks[state] = true; render(<CampaignsPage />);
  if (state === 'initial') expect(screen.getByText('Loading campaigns...').parentElement?.querySelector('.animate-spin')).toBeTruthy();
  expect(screen.getByLabelText('Search campaigns')).toBeTruthy(); expect(screen.getByLabelText('Filter campaigns')).toBeTruthy();
  if (state === 'initial') expect(screen.queryByRole('grid')).toBeNull();
  else expect(screen.getByRole('grid')).toBeTruthy();
});
it('offers persisted outcome statuses including interrupted submissions and Email/SMS types', () => {
  render(<CampaignsPage />); fireEvent.click(screen.getByLabelText('Filter campaigns'));
  const filters = screen.getAllByRole('checkbox').filter(el => !el.getAttribute('aria-label')?.startsWith('Select'));
  expect([...new Set(filters.map(el => el.closest('label')?.textContent))]).toEqual(['Sent', 'Partially Sent', 'Interrupted', 'Delivered', 'Failed', 'Draft', 'Scheduled', 'Email', 'SMS']);
});

it('replaces the active template selection with the exact catalog token and restores focus', async () => {
  render(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Email Templates' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create First Email Template' }));
  const subject = screen.getByLabelText(/Subject Line/) as HTMLInputElement;
  const content = screen.getByLabelText(/Message Content/) as HTMLTextAreaElement;
  fireEvent.change(subject, { target: { value: 'Hello customer!' } });
  fireEvent.change(content, { target: { value: 'Keep this body.' } });
  fireEvent.focus(subject); subject.setSelectionRange(6, 14);
  fireEvent.click(screen.getByRole('button', { name: 'Insert Variable' }));
  const firstName = await screen.findByRole('button', { name: /First Name.*firstName/ });
  fireEvent.click(firstName);
  expect(subject.value).toBe('Hello {{firstName}}!');
  expect(content.value).toBe('Keep this body.');
  await waitFor(() => expect(document.activeElement).toBe(subject));
  expect(subject.selectionStart).toBe(19);
  fireEvent.focus(content); content.setSelectionRange(5, 9);
  fireEvent.click(screen.getByRole('button', { name: 'Insert Variable' }));
  fireEvent.click(screen.getByRole('button', { name: /Sender Email.*sender_email/ }));
  expect(content.value).toBe('Keep {{sender_email}} body.');
  expect(screen.queryByLabelText('Search variables')).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(content));
});

it.each(['Email', 'SMS'] as const)('limits the %s template picker to active Lead/Contact fields from the tenant catalog', async type => {
  const definitions = CUSTOM_FIELD_MODULES.map((module, index): ClosingField => ({ id: `definition-${index}`, version: 1, module, name: `${module} Custom`, technicalAlias: `${module}Custom`, type: 'Text', active: true, required: false, description: '', visibleInForm: true, visibleInDetails: true, group: 'Basic Information', order: 0, options: [] }));
  const inactive = { ...definitions[0], id: 'inactive', technicalAlias: 'inactive', name: 'Inactive Custom', active: false };
  mocks.variableFields.mockResolvedValue({ success: true, data: CUSTOM_FIELD_MODULES.flatMap(module => getCrmFieldCatalog(module, [...definitions, inactive])) });
  render(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: `${type} Templates` }));
  fireEvent.click(screen.getByRole('button', { name: `Create First ${type} Template` }));
  fireEvent.click(screen.getByRole('button', { name: 'Insert Variable' }));
  await screen.findByRole('button', { name: /leads Custom.*customFieldValues.leadsCustom/ });
  const picker = screen.getByLabelText('Search variables').closest('.max-h-80')! as HTMLElement;
  for (const source of ['LEADS', 'CONTACTS']) {
    fireEvent.change(screen.getByLabelText('Template field source'), { target: { value: source } });
    expect(picker.textContent).not.toMatch(/Accounts|Deals|accounts Custom|deals Custom|Inactive Custom/);
    expect([...picker.querySelectorAll('p')].map(node => node.textContent)).toEqual(['Standard Fields', 'Custom Fields', 'Sender']);
    for (const key of ['value', 'website', 'customFieldValues.accountsCustom', 'customFieldValues.dealsCustom', 'customFieldValues.inactive']) expect(within(picker).queryByText(`{{${key}}}`)).toBeNull();
    expect(within(picker).getByRole('button', { name: /leads Custom/ }).hasAttribute('disabled')).toBe(source !== 'LEADS');
    expect(within(picker).getByRole('button', { name: /contacts Custom/ }).hasAttribute('disabled')).toBe(source !== 'CONTACTS');
    expect(within(picker).getAllByText('{{firstName}}')).toHaveLength(1);
    expect(within(picker).getByText('{{sender_name}}')).toBeTruthy();
    expect(within(picker).getByText('{{sender_email}}')).toBeTruthy();
  }
  fireEvent.focus(screen.getByLabelText(/Message Content/));
  fireEvent.click(within(picker).getByRole('button', { name: /contacts Custom/ }));
  expect((screen.getByLabelText(/Message Content/) as HTMLTextAreaElement).value).toBe('{{customFieldValues.contactsCustom}}');
});

it.each(['Email', 'SMS'] as const)('previews %s templates with current configured sender identity and compatible tokens', async type => {
  mocks.templates = [{ id: 'template', name: 'Sender template', type, category: 'Marketing', subject: 'Hello {{firstName}}', content: '{{firstName}} {{first_name}} {{sender_name}} {{sender_email}}' }];
  render(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: type === 'Email' ? 'Email Templates' : 'SMS Templates' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  const text = type === 'Email' ? 'John John Provider sender provider@example.test' : 'John John SMS organization contact@example.test';
  await screen.findByText(text);
});
it('inserts a canonical variable in a new SMS template', async () => {
  render(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'SMS Templates' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create First SMS Template' }));
  const content = screen.getByLabelText(/Message Content/) as HTMLTextAreaElement;
  fireEvent.focus(content);
  fireEvent.click(screen.getByRole('button', { name: 'Insert Variable' }));
  fireEvent.click(await screen.findByRole('button', { name: /First Name.*firstName/ }));
  expect(content.value).toBe('{{firstName}}');
});
