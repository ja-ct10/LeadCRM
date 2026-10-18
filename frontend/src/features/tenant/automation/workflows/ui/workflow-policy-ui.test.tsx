import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WORKFLOW_TRIGGERS, getAvailableActions } from '@leadcrm/shared';
import { WorkflowLibrary } from './workflow-library';
import WorkflowBuilder from './visual-workflow-builder';
import { ActionFields } from './workflow-fields';
import { actionIssues } from '../services/workflow-editor';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(cleanup);
const options = { users: [], pipelines: [], templates: [], campaigns: [] };
it('removes loss-reason controls and defaults target stages to Sales Pipeline', () => {
  const definition = getAvailableActions().find(action => action.type === 'move_deal_stage');
  const change = vi.fn();
  const salesOptions = { ...options, pipelines: [{ id: 'sales', name: 'Sales Pipeline', stages: [{ id: 'qualified', name: 'Qualified' }] }, { id: 'other', name: 'Legacy', stages: [{ id: 'other-stage', name: 'Other stage' }] }] };
  render(<ActionFields entity="deal" action={{ type: 'move_deal_stage', config: {} }} definition={definition} options={salesOptions} onChange={change} />);
  expect(screen.queryByLabelText('Include a loss reason')).toBeNull();
  expect(screen.queryByLabelText('Loss reason')).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Pipeline' })).toBeNull();
  expect(screen.getByText('Sales Pipeline')).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Qualified' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Other stage' })).toBeNull();
  fireEvent.change(screen.getByLabelText(/Target stage/), { target: { value: 'qualified' } });
  expect(change).toHaveBeenCalledWith({ stageId: 'qualified' });
});
it('preserves a saved legacy stage and reason without changing its pipeline', () => {
  const definition = getAvailableActions().find(action => action.type === 'move_deal_stage');
  const change = vi.fn();
  render(<ActionFields entity="deal" action={{ type: 'move_deal_stage', config: { stageId: 'lost', lostReason: 'Saved reason' } }} definition={definition} options={{ ...options, pipelines: [{ id: 'legacy', name: 'Legacy pipeline', stages: [{ id: 'lost', name: 'Lost' }] }] }} onChange={change} />);
  expect(screen.getByText('Legacy pipeline')).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Include a loss reason')).toBeNull();
});
it.each(WORKFLOW_TRIGGERS)('shows the correct actions for $label', trigger => {
  render(<WorkflowLibrary triggers={WORKFLOW_TRIGGERS} actions={getAvailableActions()} trigger={trigger} disabled={false} dragEnabled={false} onChoose={vi.fn()} />);
  expect(!!screen.queryByRole('button', { name: 'Add Create Task' })).toBe(trigger.entity === 'deal');
  expect(!!screen.queryByRole('button', { name: 'Add Send Email' })).toBe(trigger.entity !== 'account');
  expect(!!screen.queryByRole('button', { name: 'Add Send SMS' })).toBe(trigger.entity !== 'account');
  expect(!!screen.queryByRole('button', { name: 'Add Assign Agent' })).toBe(trigger.entity !== 'account' && !trigger.type.endsWith('.updated') && !trigger.type.startsWith('deal.closed_'));
  expect(screen.queryByRole('button', { name: /^Drag / })).toBeNull();
});
it.each([375, 1440])('supports configuration and placement at %spx with mobile-only drag removal', width => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn((query: string) => ({ matches: query.includes('max-width') ? width <= 767 : width >= 1280, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  Element.prototype.scrollTo = vi.fn();
  render(<WorkflowBuilder initial={{ name: 'Opportunity follow-up', trigger: 'deal.created', isActive: false, actions: [{ type: 'create_task', config: { title: 'Call' } }] }} triggers={WORKFLOW_TRIGGERS} actions={getAvailableActions()} options={options} canActivate onSave={vi.fn()} onClose={vi.fn()} />);
  expect(!!screen.queryByLabelText('Drag to reorder action')).toBe(width >= 768);
  if (width < 768) expect(screen.getByText(/Tap each step to configure it/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Configure action: 1. Create Task/ }));
  expect(screen.getByRole('button', { name: 'Done' }).style.backgroundColor).toBe('var(--primary)');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  if (width < 768) fireEvent.click(screen.getByRole('button', { name: 'Add steps' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Send SMS' }));
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  fireEvent.click(cancel);
  expect(screen.queryByText('Choose an insertion position.')).toBeNull();
});
it('requires an explicit primary person for Deal email and offers no record-address fallback', () => {
  render(<ActionFields entity="deal" action={{ type: 'send_email', config: {} }} definition={getAvailableActions().find(action => action.type === 'send_email')} options={options} onChange={vi.fn()} />);
  const recipient = screen.getByLabelText('Recipient') as HTMLSelectElement;
  expect([...recipient.options].map(option => option.value)).toEqual(['', 'primary_contact', 'primary_lead']);
});
