import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorkflowDraft } from '@leadcrm/shared';
import { WorkflowDefinitionSummary, emptySnapshotOptions } from './workflow-definition-summary';
afterEach(cleanup);
const definition: WorkflowDraft = { name: 'Historical follow-up', trigger: 'lead.created', isActive: true,
  conditions: { operator: 'OR', conditions: [{ field: 'lead.status', operator: 'equals', value: 'Hot' }, { field: 'lead.email', operator: 'is_not_empty', value: null }] },
  actions: [{ type: 'create_task', enabled: false, config: { title: 'Old task', assignmentTarget: { type: 'group', id: 'old-group', strategy: 'sticky', availability: { timeZone: 'Asia/Manila' } } } },
    { type: 'send_email', config: { subject: 'Saved subject', body: '<p>Saved message</p><script>alert(1)</script><img src="https://tracker.test"><a href="javascript:alert(1)">Unsafe</a>' } }] };
it('uses readable conditions and ordered action settings without normalizing historical strategies', () => {
  const { container } = render(<WorkflowDefinitionSummary definition={definition} />);
  expect(screen.getByText('Match any condition')).toBeTruthy();
  expect(screen.getByText('Hot')).toBeTruthy(); expect(screen.getByText('Disabled')).toBeTruthy();
  expect(screen.getByText('Previous assignee / Sticky assignment')).toBeTruthy();
  expect(screen.getByText('Unavailable group (old-group)')).toBeTruthy();
  expect(screen.getByText('Asia/Manila')).toBeTruthy(); expect(container.querySelector('pre')).toBeNull();
  expect(container.querySelector('script, img, a[href^="javascript:"]')).toBeNull();
  expect(screen.getByText('Saved message')).toBeTruthy();
});
it('renders match-all and missing field references without hiding the snapshot', () => {
  render(<WorkflowDefinitionSummary definition={{ ...definition, conditions: { operator: 'AND', conditions: [{ field: 'account.internalNotes', operator: 'contains', value: 'Historical text' }] } }} />);
  expect(screen.getByText('Match all conditions')).toBeTruthy(); expect(screen.getByText('Unavailable field (account.internalNotes)')).toBeTruthy();
  expect(screen.getByText('Historical text')).toBeTruthy();
});
it('uses authorized labels and shows all settings for retired actions', () => {
  render(<WorkflowDefinitionSummary options={{ ...emptySnapshotOptions, groups: [{ id: 'old-group', name: 'Sales Group', memberCount: 2, eligibleMemberCounts: { crm_owner: 2, task_assignee: 2 } }] }}
    definition={{ ...definition, actions: [...definition.actions, { type: 'send_campaign', config: { campaignId: 'unavailable' } }] }} />);
  expect(screen.getByText('Sales Group')).toBeTruthy(); expect(screen.getByText(/Send Campaign \(retired\)/)).toBeTruthy();
  expect(screen.getByText('Unavailable campaign (unavailable)')).toBeTruthy();
});
