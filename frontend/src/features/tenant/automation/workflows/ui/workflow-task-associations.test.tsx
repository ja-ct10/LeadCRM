import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkflowTaskAssociationSchema, type WorkflowOptions } from '@leadcrm/shared';
import { WorkflowTaskAssociations } from './workflow-task-associations';
afterEach(cleanup);
const options: WorkflowOptions = { users: [], templates: [], campaigns: [], pipelines: [{ id: 'pipeline', name: 'Sales', stages: [{ id: 'stage', name: 'Qualified' }] }, { id: 'other', name: 'Support', stages: [] }], productInterests: [{ id: 'product', name: 'Subscription' }] };
it.each(['lead', 'contact'] as const)('requires an explicit all-matching selection for %s', entity => {
  const onChange = vi.fn();
  render(<WorkflowTaskAssociations entity={entity} action={{ type: 'create_task', config: { title: 'Follow up' } }} options={options} onChange={onChange} />);
  expect((screen.getByLabelText('Associate task with') as HTMLSelectElement).value).toBe('single_match');
  expect(screen.queryByLabelText(/Deal ID/)).toBeNull();
  fireEvent.change(screen.getByLabelText('Associate task with'), { target: { value: 'all_matching' } });
  expect(onChange).toHaveBeenCalledWith({ title: 'Follow up', targetMode: 'all_matching' });
});
it('uses the triggering Deal and preserves Account unique-match behavior', () => {
  const view = render(<WorkflowTaskAssociations entity="deal" action={{ type: 'create_task', config: {} }} options={options} onChange={vi.fn()} />);
  expect((screen.getByLabelText('Associate task with') as HTMLSelectElement).value).toBe('triggering_deal');
  expect(screen.queryByRole('button', { name: 'Pipeline filter' })).toBeNull();
  view.rerender(<WorkflowTaskAssociations entity="account" action={{ type: 'create_task', config: {} }} options={options} onChange={vi.fn()} />);
  expect(screen.queryByRole('option', { name: 'All matching related deals' })).toBeNull();
});
it('searches named filters and clears a stale stage when changing pipeline', () => {
  const onChange = vi.fn();
  render(<WorkflowTaskAssociations entity="lead" action={{ type: 'create_task', config: { currentStageId: 'old-stage' } }} options={options} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pipeline filter' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search pipeline filter' }), { target: { value: 'Sal' } });
  expect(screen.queryByRole('menuitem', { name: 'Support' })).toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sales' }));
  expect(onChange).toHaveBeenCalledWith({ pipelineId: 'pipeline' });
});
it('shares strict association values while treating blank optional filters as omitted', () => {
  expect(WorkflowTaskAssociationSchema.parse({ title: 'Task', pipelineId: '', targetMode: '' })).toEqual({ pipelineId: undefined, targetMode: undefined });
  expect(WorkflowTaskAssociationSchema.safeParse({ targetMode: 'latest' }).success).toBe(false);
  expect(WorkflowTaskAssociationSchema.safeParse({ pipelineId: 'foreign-looking-id' }).success).toBe(false);
});
