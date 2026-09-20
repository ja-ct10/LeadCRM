import { z } from 'zod';
import { CreateUserSchema, StrongPasswordSchema } from '@leadcrm/shared';
const profileFields = {
  phone: z.string().max(50).optional(), jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(), avatarUrl: z.string().optional(), timeZone: z.string().max(100).optional(),
};
export const CreateUsersSchema = CreateUserSchema.extend({
  ...profileFields, password: StrongPasswordSchema.optional(), role: z.string().trim().min(1),
});
// Never accept tenant, credentials, or password-gate state through profile updates.
export const UpdateUsersSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(), lastName: z.string().trim().min(1).max(100).optional(),
  role: z.string().min(1).optional(), status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(), ...profileFields,
}).strict();
