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
it('makes loss reasons optional and validates an enabled empty reason before activation', () => {
  const definition = getAvailableActions().find(action => action.type === 'move_deal_stage');
  const change = vi.fn();
  const initial = { type: 'move_deal_stage' as const, config: { stageId: 'lost' } };
  const rendered = render(<ActionFields entity="deal" action={initial} definition={definition} options={options} onChange={change} />);
  expect(screen.queryByLabelText('Loss reason')).toBeNull();
  fireEvent.click(screen.getByLabelText('Include a loss reason'));
  expect(change).toHaveBeenLastCalledWith({ stageId: 'lost', includeLossReason: true, lostReason: '' });
  const enabled = { ...initial, config: change.mock.calls[0][0] };
  rendered.rerender(<ActionFields entity="deal" action={enabled} definition={definition} options={options} onChange={change} />);
  expect(screen.getByLabelText('Loss reason').getAttribute('aria-required')).toBe('true');
  expect(actionIssues(enabled, definition, 'deal', options)).toContain('Enter a loss reason or turn off Include a loss reason.');
  fireEvent.change(screen.getByLabelText('Loss reason'), { target: { value: 'Budget changed' } });
  fireEvent.click(screen.getByLabelText('Include a loss reason'));
  expect(change).toHaveBeenLastCalledWith({ stageId: 'lost', includeLossReason: false });
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
