import { z } from 'zod';
import { PERMISSION_MODULES } from '@leadcrm/shared';

const permissionRowSchema = z.object({
  module:    z.string().refine(value => PERMISSION_MODULES.some(module => module.key === value), 'Invalid permission module'),
  canView:   z.boolean(),
  canCreate: z.boolean(),
  canEdit:   z.boolean(),
  canDelete: z.boolean(),
}).strict().superRefine((row, ctx) => {
  const module = PERMISSION_MODULES.find(module => module.key === row.module);
  for (const action of ['canView', 'canCreate', 'canEdit', 'canDelete'] as const) {
    if (row[action] && module && !module.actions.includes(action)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [action], message: 'Invalid permission action for this module' });
    }
  }
});

const permissionsSchema = z.array(permissionRowSchema).refine(
  rows => new Set(rows.map(row => row.module)).size === rows.length,
  'Duplicate permission modules are not allowed',
);
const roleNameSchema = z.string().trim().min(1, 'Role name is required.').min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters');

export const CreateRoleSchema = z.object({
  name:        roleNameSchema,
  description: z.string().max(200, 'Description must be at most 200 characters').optional(),
  permissions: permissionsSchema.default([]),
}).strict();

export const UpdateRoleSchema = z.object({
  name:        roleNameSchema.optional(),
  description: z.string().max(200).optional(),
  permissions: permissionsSchema.optional(),
}).strict().refine(
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
