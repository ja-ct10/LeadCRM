// Groups repository — thin DB layer, all queries scoped to tenantId.
// Business logic lives in groups.service.ts.

import prisma from '../../../config/database.config';
import { isGroupHeadRole, type GroupMemberInput } from '@leadcrm/shared';
import { Prisma } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { assertPermissions } from '../../../core/permissions/permission.service';

const GROUP_SELECT = {
  id:        true,
  tenantId:  true,
  name:      true,
  systemKey: true,
  createdAt: true,
  updatedAt: true,
  members: {
    select: {
      id:     true,
      userId: true,
      isHead: true,
      user: {
        select: {
          id:        true,
          firstName: true,
          lastName:  true,
          email:     true,
          role:      true,
          status:    true,
          avatarUrl: true,
          userRoles: { where: { role: { isArchived: false, isSystemRole: false } }, select: { role: { select: { name: true } } } },
        },
      },
    },
  },
} as const;

export function canBeGroupHead(user: { status: string; role: string; userRoles: { role: { name: string } }[] }): boolean {
  return user.status === 'ACTIVE' && isGroupHeadRole(user.role) && user.userRoles.some(link => link.role.name === user.role);
}

export async function findAllGroups(tenantId: string) {
  return prisma.tenantGroup.findMany({
    where:   { tenantId },
    select:  GROUP_SELECT,
    orderBy: { name: 'asc' },
  });
}

export async function findGroupById(id: string, tenantId: string) {
  return prisma.tenantGroup.findFirst({
    where:  { id, tenantId },
    select: GROUP_SELECT,
  });
}

export async function createGroup(tenantId: string, name: string) {
  return prisma.tenantGroup.create({
    data:   { tenantId, name },
    select: GROUP_SELECT,
  });
}

export async function updateGroup(id: string, tenantId: string, name: string) {
  return prisma.tenantGroup.update({
    where:  { id, tenantId },
    data:   { name },
    select: GROUP_SELECT,
  });
}

export async function deleteEmptyGroup(id: string, tenantId: string) {
  // The predicate and serializable transaction protect against concurrent additions.
  return prisma.$transaction(tx => tx.tenantGroup.deleteMany({
    where: { id, tenantId, systemKey: null, members: { none: {} } },
  }), { isolationLevel: 'Serializable' });
}

export async function addGroupMembers(groupId: string, input: GroupMemberInput, tenantId: string, actorId: string) {
  return prisma.$transaction(async tx => {
    const group = await tx.tenantGroup.findFirst({ where: { id: groupId, tenantId }, select: GROUP_SELECT });
    if (!group) throw new NotFoundError('Group');
    const userIds = 'userIds' in input ? input.userIds : [input.userId];
    const users = await tx.user.findMany({
      where: { id: { in: userIds }, tenantId, status: 'ACTIVE' }, select: { id: true },
    });
    if (users.length !== userIds.length) throw new NotFoundError('Active workspace user');
    const existingIds = new Set(group.members.map(member => member.userId));
    if ('userIds' in input && userIds.some(id => existingIds.has(id))) {
      throw new ConflictError('One or more selected users are already members of this group.');
    }
    const additions = userIds.filter(id => !existingIds.has(id));
    if (!additions.length) return group; // Preserve legacy single-member retries.
    await tx.tenantGroupMember.createMany({
      data: additions.map(userId => ({ groupId, userId, tenantId })),
    });
    // Membership history and revision triggers roll back with the entire batch.
    await tx.auditLog.createMany({ data: additions.map(userId => ({
      tenantId, userId: actorId, action: 'group.member_added', entityType: 'TenantGroup', entityId: groupId,
      changeset: { before: null, after: { userId } },
    })) });
    return tx.tenantGroup.findFirstOrThrow({ where: { id: groupId, tenantId }, select: GROUP_SELECT });
  }, { isolationLevel: 'Serializable' });
}

export async function removeGroupMember(groupId: string, userId: string, tenantId: string) {
  return prisma.tenantGroupMember.deleteMany({ where: { groupId, userId, tenantId } });
}

export async function setGroupHead(groupId: string, userId: string | null, tenantId: string, actorId: string) {
  return prisma.$transaction(async tx => {
    // Account writes take the user lock before their lifecycle trigger changes
    // memberships. Keep that order so deactivation cannot leave an inactive head.
    const userIds = [...new Set(userId ? [actorId, userId] : [actorId])];
    await tenantContext.exit(async () => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE "tenantId" = ${tenantId} AND id IN (${Prisma.join(userIds)}) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "TenantGroup" WHERE "tenantId" = ${tenantId} AND id = ${groupId} FOR UPDATE`;
    });
    const actor = await tx.user.findFirst({ where: { id: actorId, tenantId, status: 'ACTIVE', role: 'Client Admin' } });
    if (!actor) throw new ForbiddenError('Only an active Client Admin can manage the Group Head.');
    await assertPermissions({ userId: actorId, tenantId, role: actor.role }, ['groups.edit'], tx);
    const group = await tx.tenantGroup.findFirst({ where: { id: groupId, tenantId }, select: GROUP_SELECT });
    if (!group) throw new NotFoundError('Group');
    if (userId !== null) {
      const member = group.members.find(row => row.userId === userId);
      if (!member) throw new NotFoundError('Group member');
      if (!canBeGroupHead(member.user)) {
        throw new ValidationError('Choose an active Group member whose primary role is Sales Manager or Head of Sales.');
      }
    }
    const previousUserId = group.members.find(member => member.isHead)?.userId ?? null;
    if (previousUserId === userId) return group;
    await tx.tenantGroupMember.updateMany({ where: { groupId, tenantId, isHead: true }, data: { isHead: false } });
    if (userId !== null) await tx.tenantGroupMember.update({
      where: { groupId_userId: { groupId, userId }, tenantId }, data: { isHead: true },
    });
    await tx.auditLog.create({ data: {
      tenantId, userId: actorId, action: 'group.head_changed', entityType: 'TenantGroup', entityId: groupId,
      changeset: { before: { userId: previousUserId }, after: { userId } },
    } });
    return tx.tenantGroup.findFirstOrThrow({ where: { id: groupId, tenantId }, select: GROUP_SELECT });
  }, { isolationLevel: 'Serializable' });
}
