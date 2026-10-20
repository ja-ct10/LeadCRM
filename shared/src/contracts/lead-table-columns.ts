import type { ColumnDefinition } from '../types/preferences';

/** Canonical display value only; writes continue to use the two persisted name fields. */
export function formatLeadName(lead: { firstName?: string | null; lastName?: string | null }): string {
  return [lead.firstName?.trim(), lead.lastName?.trim()].filter(Boolean).join(' ') || '—';
}

export const LEADS_TABLE_SORT_FIELDS = ['name', 'firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'createdAt', 'updatedAt', 'lastSalesActivityAt'];
const entries: [string, string, boolean, ColumnDefinition['priority']][] = [
  ['name', 'Name', true, 'high'],
  ['email', 'Email', true, 'low'], ['phone', 'Phone', true, 'low'],
  ['companyName', 'Company Name', true, 'high'], ['status', 'Status', true, 'medium'],
  ['assignedUserId', 'Assigned Agent', true, 'medium'], ['source', 'Lead Source', true, 'medium'],
  ['firstName', 'First Name', false, 'high'], ['lastName', 'Last Name', false, 'high'],
  ['accountId', 'Account', false, 'medium'], ['productInterest', 'Product Interest', false, 'low'],
  ['address', 'Full Address', false, 'low'], ['createdAt', 'Created', false, 'low'],
  ['createdBy', 'Created by', false, 'low'], ['updatedAt', 'Updated', false, 'low'],
  ['updatedBy', 'Updated by', false, 'low'], ['latestStatusChangeDate', 'Latest status change date', false, 'low'],
];
export const LEADS_TABLE_COLUMNS: ColumnDefinition[] = entries.map(([id, label, defaultVisible, priority], defaultOrder) => ({
  id, label, defaultVisible, defaultOrder, priority, required: false,
  group: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'latestStatusChangeDate'].includes(id) ? 'History' : 'Leads',
  sortable: LEADS_TABLE_SORT_FIELDS.includes(id),
  ...(id === 'name' ? { fixedPosition: 'first' as const, pinned: 'left' as const } : {}),
}));

/** Documented historical static choices with no Lead list data source. Custom fields are independent. */
export const RETIRED_LEAD_TABLE_IDS = [
  'phoneAction', 'emailAction', 'description', 'website', 'localTime', 'primaryAddressCityState', 'linkedinUrl', 'classifyB2bB2c',
  'latestCommunication', 'latestCommunicationDate', 'latestCommunicationUser', 'firstCommunication', 'firstCommunicationDate', 'firstCommunicationUser', 'timesCommunicated',
  'latestEmailDate', 'latestReceivedEmailDate', 'latestSentEmailDate', 'latestEmailSubject', 'emailLastOpened', 'emailCount', 'sentEmailCount', 'receivedEmailCount', 'emailAttachmentCount',
  'latestCallDate', 'latestIncomingCallDate', 'latestOutgoingCallDate', 'latestCallNote', 'firstCallDate', 'firstCallNote', 'callCount', 'outgoingCallCount', 'incomingCallCount',
  'latestSmsDate', 'latestReceivedSmsDate', 'latestSentSmsDate', 'latestSmsMessage', 'firstSmsDate', 'firstSmsMessage', 'smsCount', 'sentSmsCount', 'receivedSmsCount',
  'noteCount', 'latestNoteDate', 'activeOppValue', 'wonOppValue', 'lostOppValue', 'allOppValue', 'primaryOppStatus', 'primaryOppCloseDate', 'primaryOppCreated', 'primaryOppUpdated', 'primaryOppValue', 'primaryOppUser', 'lastOppStatusChangeDate',
  'opportunityCount', 'activeOpportunityCount', 'wonOpportunityCount', 'lostOpportunityCount', 'nextTask', 'nextTaskDate', 'nextTaskUser', 'taskCount', 'completedTaskCount', 'incompleteTaskCount',
];
