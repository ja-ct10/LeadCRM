import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getAvailableActions, type WorkflowAction, type WorkflowOptions } from '@leadcrm/shared';
import { ActionFields } from './workflow-fields';
import { actionIssues, actionSummary, toDraft } from '../services/workflow-editor';

const userId = '00000000-0000-4000-8000-000000000001';
const groupId = '00000000-0000-4000-8000-000000000002';
const options: WorkflowOptions = { users: [], taskAssignees: [{ id: userId, name: 'Task specialist' }],
  roles: [{ id: groupId, name: 'Support', memberCount: 3, eligibleMemberCounts: { task_assignee: 2, crm_owner: 0 } }],
  groups: [{ id: groupId, name: 'Follow-up team', memberCount: 4, eligibleMemberCounts: { task_assignee: 2, crm_owner: 1 }, members: [{ id: userId, name: 'Task specialist', purposes: ['task_assignee'] }] }],
  pipelines: [], templates: [], campaigns: [] };
function Editor({ initial, entity = initial.type === 'create_task' ? 'deal' : 'lead' }: { initial: WorkflowAction; entity?: 'lead' | 'contact' | 'account' | 'deal' }) {
  const [action, setAction] = useState(initial);
  return <><ActionFields action={action} entity={entity} definition={getAvailableActions().find(definition => definition.type === action.type)} options={options} onChange={config => setAction({ ...action, config })} />
    <output data-testid="config">{JSON.stringify(action.config)}</output></>;
}
afterEach(cleanup);
describe('workflow assignment editor', () => {
  it('requires an explicit Account task assignee and offers no retired Account owner choice', () => {
    const initial: WorkflowAction = { type: 'create_task', config: { title: 'Follow up' } };
    render(<Editor initial={initial} entity="account" />);
    expect(screen.queryByRole('option', { name: 'Current Record Agent' })).toBeNull();
    expect(actionIssues(initial, getAvailableActions().find(action => action.type === 'create_task'), 'account', options)).toEqual([expect.stringContaining('Account assignment, product fields and internal notes are retired')]);
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'user' } });
    fireEvent.change(screen.getByLabelText('Assignment user'), { target: { value: userId } });
    expect(JSON.parse(screen.getByTestId('config').textContent!).assignmentTarget).toEqual({ type:'user',id:userId });
  });
  it('offers record owner by default and writes one canonical group target with eligible counts', () => {
    render(<Editor initial={{ type: 'create_task', config: { title: 'Call' } }} />);
    expect((screen.getByLabelText('Assign to') as HTMLSelectElement).value).toBe('record_owner');
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'group' } });
    fireEvent.change(screen.getByLabelText('Assignment group'), { target: { value: groupId } });
    expect(screen.getByText('4 members · 2 eligible')).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('config').textContent!)).toEqual({ title: 'Call', assignmentTarget: { type: 'group', id: groupId, strategy: 'round_robin' } });
  });
  it.each(['create_task', 'assign_owner'] as const)('offers the supported %s strategies and explains active-user eligibility', type => {
    render(<Editor initial={{ type, config: { assignmentTarget: { type: 'group', id: groupId, strategy: 'round_robin' } } }} />);
    const method = screen.getByLabelText('Assignment method') as HTMLSelectElement;
    expect(Array.from(method.options).map(option => option.value)).toEqual(type === 'assign_owner' ? ['round_robin', 'weighted_workload'] : ['round_robin']);
    expect(method.value).toBe('round_robin');
    expect(screen.getByText(/Inactive users are skipped/)).toBeTruthy();
    expect(screen.queryByLabelText('Sticky fallback method')).toBeNull();
    if (type === 'assign_owner') {
      fireEvent.change(method, { target: { value: 'weighted_workload' } });
      expect(JSON.parse(screen.getByTestId('config').textContent!).assignmentTarget.strategy).toBe('weighted_workload');
    }
  });
  it.each(['contact', 'deal'] as const)('keeps weighted Lead assignment out of %s owner strategies', entity => {
    render(<Editor entity={entity} initial={{ type: 'assign_owner', config: { assignmentTarget: { type: 'group', id: groupId, strategy: 'round_robin' } } }} />);
    const method = screen.getByLabelText('Assignment method') as HTMLSelectElement;
    expect(Array.from(method.options).map(option => option.value)).toEqual(['round_robin']);
  });
  it.each(['least_workload', 'random', 'availability', 'capacity', 'sticky'])('loads and saves a retired %s method as round-robin', strategy => {
    const draft = toDraft({ name: 'Saved', trigger: 'deal.created', isActive: false, actions: [{ type: 'create_task', config: { title: 'Call', assignmentTarget: { type: 'group', id: groupId, strategy, ...(strategy === 'sticky' ? { sticky: { fallback: 'random', preferCurrentOwner: true } } : {}) } } }] });
    render(<Editor initial={draft.actions[0]} />);
    expect((screen.getByLabelText('Assignment method') as HTMLSelectElement).value).toBe('round_robin');
    expect(draft.actions[0].config.assignmentTarget).toEqual({ type: 'group', id: groupId, strategy: 'round_robin' });
    expect(actionIssues(draft.actions[0], getAvailableActions()[0], 'deal', options)).toEqual([]);
  });
  it('configures per-member availability, custom shifts, capacity overrides and validation', () => {
    render(<Editor initial={{ type: 'create_task', config: { title: 'Call', assignmentTarget: { type: 'group', id: groupId, strategy: 'round_robin', availability: { timeZone: 'Asia/Manila', schedule: { days: [1], start: '09:00', end: '17:00' }, members: [] } } } }} />);
    fireEvent.change(screen.getByLabelText('Assignment timezone'), { target: { value: 'UTC' } });
    fireEvent.click(screen.getByLabelText('Task specialist unavailable'));
    fireEvent.click(screen.getByLabelText('Task specialist custom shift'));
    fireEvent.change(screen.getByLabelText('Task specialist shift start'), { target: { value: '22:00' } });
    fireEvent.click(screen.getByLabelText('Enforce capacity limit'));
    fireEvent.change(screen.getByLabelText('Default capacity limit'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Task specialist capacity limit'), { target: { value: '3' } });
    const config = JSON.parse(screen.getByTestId('config').textContent!);
    expect(config.assignmentTarget).toMatchObject({ availability: { timeZone: 'UTC', members: [{ userId, unavailable: true, schedule: { start: '22:00' } }] }, capacity: { maxPerMember: 10, members: [{ userId, limit: 3 }] } });
    expect(actionIssues({ type: 'create_task', config }, getAvailableActions()[0], 'deal', options)).toEqual([]);
    fireEvent.change(screen.getByLabelText('Default capacity limit'), { target: { value: '0' } });
    expect(actionIssues({ type: 'create_task', config: JSON.parse(screen.getByTestId('config').textContent!) }, getAvailableActions()[0], 'deal', options).length).toBeGreaterThan(0);
  });
  it('uses task candidates for legacy tasks and removes the old field on edits', () => {
    render(<Editor initial={{ type: 'create_task', config: { title: 'Call', assignedUserId: userId } }} />);
    expect((screen.getByLabelText('Assignment user') as HTMLSelectElement).value).toBe(userId);
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'role' } });
    fireEvent.change(screen.getByLabelText('Assignment role'), { target: { value: groupId } });
    expect(JSON.parse(screen.getByTestId('config').textContent!)).not.toHaveProperty('assignedUserId');
  });
  it('preserves unavailable saved groups and reports them before activation', () => {
    const action: WorkflowAction = { type: 'create_task', config: { title: 'Call', assignmentTarget: { type: 'group', id: userId, strategy: 'round_robin' } } };
    render(<Editor initial={action} />);
    expect((screen.getByLabelText('Assignment group') as HTMLSelectElement).value).toBe(userId);
    expect(screen.getByText('This assignment target is unavailable. Choose another before activating.')).toBeTruthy();
    expect(actionIssues(action, getAvailableActions()[0], 'deal', options)).toContain('Assignment target unavailable. Choose an available selection.');
  });
  it('shows role summaries, enforces purpose-specific eligibility, and excludes record owner from Assign Agent', () => {
    const action: WorkflowAction = { type: 'assign_owner', config: { assignmentTarget: { type: 'role', id: groupId, strategy: 'round_robin' } } };
    render(<Editor initial={action} />);
    expect(screen.queryByRole('option', { name: 'Current Record Agent' })).toBeNull();
    expect(actionSummary(action, options)).toEqual(['Assign to Role · Support · Round-robin']);
    expect(actionIssues(action, getAvailableActions().find(definition => definition.type === 'assign_owner'), 'lead', options)).toContain('Support has no eligible members for this assignment.');
    const task: WorkflowAction = { type: 'create_task', config: { title: 'Call', assignedUserId: userId } };
    expect(actionIssues(task, getAvailableActions()[0], 'deal', options)).toEqual([]);
    expect(toDraft({ name: 'Test', trigger: 'deal.created', isActive: false, actions: [task] }).actions[0].config).toEqual({ title: 'Call', assignmentTarget: { type: 'user', id: userId } });
  });
});
