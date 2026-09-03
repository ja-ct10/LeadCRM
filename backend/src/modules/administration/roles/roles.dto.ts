import { z } from 'zod';

const permissionRowSchema = z.object({
  module:    z.string().min(1),
  canView:   z.boolean(),
  canCreate: z.boolean(),
  canEdit:   z.boolean(),
  canDelete: z.boolean(),
});

export const CreateRoleSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters'),
  description: z.string().max(200, 'Description must be at most 200 characters').optional(),
  permissions: z.array(permissionRowSchema).default([]),
});

export const UpdateRoleSchema = z.object({
  name:        z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(permissionRowSchema).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' },
);

export const AssignRoleSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  roleId: z.string().uuid('roleId must be a valid UUID'),
});

export type CreateRoleDto  = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleDto  = z.infer<typeof UpdateRoleSchema>;
export type AssignRoleDto  = z.infer<typeof AssignRoleSchema>;
export type PermissionRowDto = z.infer<typeof permissionRowSchema>;
