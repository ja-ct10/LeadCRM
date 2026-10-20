import { z } from 'zod';

export const GroupNameSchema = z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or fewer.');
export const CreateGroupSchema = z.object({ name: GroupNameSchema }).strict();
export const UpdateGroupSchema = CreateGroupSchema;

export const GroupMemberSchema = z.union([
  z.object({ userId: z.string().uuid('Invalid user ID') }).strict(),
  z.object({
    userIds: z.array(z.string().uuid('Invalid user ID')).min(1, 'Select at least one user.')
      .refine(ids => new Set(ids).size === ids.length, 'Select each user only once.'),
  }).strict(),
]);
export type GroupMemberInput = z.infer<typeof GroupMemberSchema>;

export const GroupHeadSchema = z.object({ userId: z.string().uuid('Invalid user ID').nullable() }).strict();
export type GroupHeadInput = z.infer<typeof GroupHeadSchema>;

/** Group responsibility follows the current primary role and grants no permissions. */
export function isGroupHeadRole(role: string): boolean {
  return ['salesmanager', 'headofsales'].includes(role.trim().toLowerCase().replace(/[\s_-]/g, ''));
}

export interface TenantGroupMember {
  id: string;
  userId: string;
  isHead: boolean;
  canBeHead: boolean;
  user: { id: string; firstName: string; lastName: string; email: string; role: string; status: string; avatarUrl: string | null };
}

export interface TenantGroup {
  id: string;
  tenantId: string;
  name: string;
  isDefault?: boolean;
  members: TenantGroupMember[];
  createdAt: string;
  updatedAt: string;
}
