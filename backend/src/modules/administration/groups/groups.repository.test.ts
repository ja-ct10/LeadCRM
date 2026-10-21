import { expect, it, vi } from 'vitest';
import { EMPTY_PERMISSION_FLAGS } from '@leadcrm/shared';
vi.mock('../../../config/database.config', () => ({ default: {} }));
import { groupHeadCandidateIds } from './groups.repository';

const grant = (module: string, flags = {}) => ({ module, ...EMPTY_PERMISSION_FLAGS, canView: true, ...flags });
const role = (name: string, permissions: ReturnType<typeof grant>[] = [], isSystemRole = false) => ({ role: { name, permissions, isSystemRole } });
const member = (userId: string, userRoles: ReturnType<typeof role>[], extra = {}) => ({
  userId, user: { role: userRoles[0]?.role.name ?? 'Unassigned', status: 'ACTIVE', userRoles, ...extra },
});

it('ranks arbitrary custom roles by allowed grants and returns all highest ties', () => {
  const members = [member('low', [role('Director', [grant('groups')])]),
    member('first', [role('Custom A', [grant('groups', { canEdit: true })])]),
    member('second', [role('Custom B', [grant('users', { canCreate: true })])])];
  expect([...groupHeadCandidateIds(members)]).toEqual(['first', 'second']);
  members[1].user.role = members[1].user.userRoles[0].role.name = 'Renamed role';
  expect([...groupHeadCandidateIds(members)]).toEqual(['first', 'second']);
});

it('combines secondary roles without double counting and follows module View and applicable-action rules', () => {
  const combined = member('combined', [role('Primary', [grant('groups', { canEdit: true })]),
    role('Secondary', [grant('groups', { canEdit: true }), grant('users')])]);
  const duplicate = member('duplicate', [role('First', [grant('groups', { canEdit: true })]), role('Second', [grant('groups', { canEdit: true })])]);
  const unavailable = member('unavailable', [role('Unavailable', [grant('users', { canView: false, canCreate: true, canEdit: true }), grant('unknown'), grant('settings', { canCreate: true })])]);
  expect([...groupHeadCandidateIds([combined, duplicate, unavailable])]).toEqual(['combined']);
});

it('excludes zero grants, invalid primary assignments, protected junctions and unavailable accounts', () => {
  const invalid = [member('zero', [role('Empty')]), member('unlinked', [role('Secondary', [grant('groups')])], { role: 'Missing primary' }),
    member('inactive', [role('Staff', [grant('groups')])], { status: 'INACTIVE' }),
    member('pending', [role('Staff', [grant('groups')])], { status: 'PENDING' }),
    member('protected', [role('Staff'), role('Client Admin', [grant('groups')], true)])];
  expect([...groupHeadCandidateIds(invalid)]).toEqual([]);
  expect([...groupHeadCandidateIds([])]).toEqual([]);
});

it('uses current permission changes and includes the resolver grants of a member administrator', () => {
  const members = [member('one', [role('One', [grant('groups')])]), member('two', [role('Two', [grant('groups', { canEdit: true })])])];
  expect([...groupHeadCandidateIds(members)]).toEqual(['two']);
  members[0].user.userRoles[0].role.permissions.push(grant('users', { canCreate: true }));
  expect([...groupHeadCandidateIds(members)]).toEqual(['one']);
  expect([...groupHeadCandidateIds([...members, member('admin', [], { role: 'Client Admin' })])]).toEqual(['admin']);
});
