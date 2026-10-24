// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EMPTY_PERMISSION_FLAGS, hasCrmRecordAssignmentAccess, canReassignCrmRecord, type CrmRecordAccessPolicy } from '@leadcrm/shared';

const flags = { ...EMPTY_PERMISSION_FLAGS, canView: true, canViewAll: true, canEdit: true };
const policy: CrmRecordAccessPolicy = { userId: 'staff', tenantId: 'tenant', clientAdmin: false,
  assignmentRestricted: true, permissions: { contacts: flags, accounts: flags } };
const record = (assignedUserId: string | null = 'staff') => ({ tenantId: 'tenant', assignedUserId, status: 'Inquiry' });

describe('customer access uses employee roles and Assigned Agent', () => {
  it('allows an assigned employee with the required role permission', () => {
    expect(hasCrmRecordAssignmentAccess(policy, record(), 'contacts')).toBe(true);
  });
  it.each(['another', null])('denies restricted edits for assignment %s', assigned => {
    expect(hasCrmRecordAssignmentAccess(policy, record(assigned), 'contacts')).toBe(false);
  });
  it('ignores obsolete customer ownership and group-only grants', () => {
    const legacy = { ...policy, permissions: {}, groupGrants: [{ groupId: 'one', permissions: { contacts: flags }, assignmentRestricted: false }] };
    expect(hasCrmRecordAssignmentAccess(legacy, { ...record(), ownerGroupId: 'one' } as ReturnType<typeof record>, 'contacts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(policy, { ...record(), ownerGroupId: 'one' } as ReturnType<typeof record>, 'contacts')).toBe(true);
  });
  it('allows unrestricted role access without any employee group', () => {
    expect(hasCrmRecordAssignmentAccess({ ...policy, assignmentRestricted: false }, record('another'), 'contacts')).toBe(true);
    expect(canReassignCrmRecord({ ...policy, assignmentRestricted: false }, record('another'), 'contacts')).toBe(true);
    expect(canReassignCrmRecord(policy, record(), 'contacts')).toBe(false);
  });
  it('preserves own-record scopes and distinct action grants', () => {
    const scoped = { ...policy, assignmentRestricted: false, permissions: { contacts: { ...flags, canViewAll: false, canViewMy: true } } };
    expect(hasCrmRecordAssignmentAccess(scoped, record(), 'contacts')).toBe(true);
    expect(hasCrmRecordAssignmentAccess(scoped, record('another'), 'contacts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(policy, record(), 'contacts', 'canArchive')).toBe(false);
    expect(hasCrmRecordAssignmentAccess({ ...policy, permissions: {} }, record(), 'contacts')).toBe(false);
  });
  it('keeps Accounts role-based without an Assigned Agent requirement', () => {
    expect(hasCrmRecordAssignmentAccess(policy, record(null), 'accounts')).toBe(true);
  });
  it('keeps Client Admin inside the current tenant', () => {
    const admin = { ...policy, clientAdmin: true };
    expect(hasCrmRecordAssignmentAccess(admin, record(null), 'contacts')).toBe(true);
    expect(hasCrmRecordAssignmentAccess(admin, { ...record(), tenantId: 'other' }, 'contacts')).toBe(false);
  });
});
