// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EMPTY_PERMISSION_FLAGS, hasCrmRecordAssignmentAccess, type CrmRecordAccessPolicy } from '@leadcrm/shared';

const flags = { ...EMPTY_PERMISSION_FLAGS, canView: true, canViewAll: true, canEdit: true };
const policy: CrmRecordAccessPolicy = { userId: 'staff', tenantId: 'tenant', clientAdmin: false, assignmentRestricted: true,
  permissions: { contacts: { ...flags, canViewAll: false, canViewMy: true } },
  groupGrants: [
    { groupId: 'one', groupName: 'One', permissions: { contacts: flags }, assignmentRestricted: false },
    { groupId: 'two', groupName: 'Two', permissions: { contacts: flags }, assignmentRestricted: false },
    { groupId: 'three', groupName: 'Three', permissions: { contacts: { ...flags, canEdit: false } }, assignmentRestricted: false },
  ] };
const record = (ownerGroupId: string | null, assignedUserId = 'another') => ({ tenantId: 'tenant', ownerGroupId, assignedUserId, status: 'Inquiry' });

describe('CRM record and action grants retain their Group provenance', () => {
  it.each(['one', 'two'])('permits the configured action independently within %s', group => {
    expect(hasCrmRecordAssignmentAccess(policy, record(group), 'contacts')).toBe(true);
  });
  it('does not extend a Head grant to a member-only Group or an unowned record', () => {
    expect(hasCrmRecordAssignmentAccess(policy, record('three'), 'contacts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(policy, record(null), 'contacts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(policy, record('four'), 'contacts')).toBe(false);
  });
  it('preserves configured own-record access across Groups', () => {
    expect(hasCrmRecordAssignmentAccess(policy, record('three', 'staff'), 'contacts')).toBe(true);
    expect(hasCrmRecordAssignmentAccess(policy, record(null, 'staff'), 'contacts')).toBe(true);
  });
  it('keeps Client Admin access independent of memberships and inside the tenant', () => {
    const admin = { ...policy, clientAdmin: true };
    expect(hasCrmRecordAssignmentAccess(admin, record(null), 'contacts')).toBe(true);
    expect(hasCrmRecordAssignmentAccess(admin, { ...record('one'), tenantId: 'other' }, 'contacts')).toBe(false);
  });
  it('does not combine visibility in one Group with editing in another', () => {
    const split = { ...policy, permissions: {}, groupGrants: [policy.groupGrants![2], { ...policy.groupGrants![0], permissions: { contacts: { ...flags, canView: false, canViewAll: false } } }] };
    expect(hasCrmRecordAssignmentAccess(split, record('three'), 'contacts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(split, record('one'), 'contacts')).toBe(false);
  });
  it('revokes a removed membership and does not infer Archive from Edit', () => {
    expect(hasCrmRecordAssignmentAccess({ ...policy, groupGrants: [] }, record('one'), 'contacts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(policy, record('one'), 'contacts', 'canArchive')).toBe(false);
  });
});
