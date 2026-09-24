import { z } from 'zod';

// Check before trimming so surrounding control characters are not silently accepted.
export const cleanText = (max: number) => z.string()
  .refine(value => !/[\u0000-\u001f\u007f-\u009f]/.test(value), 'Control characters are not allowed.')
  .transform(value => value.trim()).pipe(z.string().max(max));

export const AdministrationPhoneSchema = cleanText(32).superRefine((value, ctx) => {
  const local = value.startsWith('+63') ? value.slice(3) : value;
  const message = !local ? 'Phone number is required.'
    : !local.startsWith('9') ? 'Philippine mobile number must start with 9.'
    : !/^9\d{9}$/.test(local) ? 'Phone number must contain exactly 10 digits.' : null;
  if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}).transform(value => value.startsWith('+63') ? value : `+63${value}`);

export const CreateAdministrationUserSchema = z.object({
  firstName: cleanText(100).pipe(z.string().min(1, 'First name is required.')),
  lastName: cleanText(100).pipe(z.string().min(1, 'Last name is required.')),
  email: cleanText(254).pipe(z.string().min(1, 'Email is required.').email('Enter a valid email address.')).transform(value => value.toLowerCase()),
  phone: AdministrationPhoneSchema,
  // The existing user service accepts the canonical RoleDefinition.name.
  role: cleanText(100).pipe(z.string().min(1, 'Role is required.')),
  jobTitle: cleanText(100).optional(),
  department: cleanText(100).optional(),
}).strict();

export const UpdateAdministrationUserSchema = CreateAdministrationUserSchema.omit({ email: true }).partial()
  .extend({ status: z.enum(['ACTIVE', 'INACTIVE']).optional() }).strict();

export type CreateAdministrationUserInput = z.infer<typeof CreateAdministrationUserSchema>;
export type UpdateAdministrationUserInput = z.infer<typeof UpdateAdministrationUserSchema>;
