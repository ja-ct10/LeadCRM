import { z } from 'zod';

export const GroupNameSchema = z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or fewer.');
export const CreateGroupSchema = z.object({ name: GroupNameSchema }).strict();
export const UpdateGroupSchema = CreateGroupSchema;

export interface TenantGroupMember {
  id: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
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
