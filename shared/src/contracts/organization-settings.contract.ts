import { z } from 'zod';

const optionalText = z.string().trim().nullable().optional()
  .transform(value => value === '' ? null : value);

export const UpdateOrganizationSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(255).optional(),
  industry: optionalText,
  email: optionalText.pipe(z.string().email('Enter a valid email address').nullable().optional()),
  phone: optionalText,
  domain: optionalText,
  address: optionalText,
}).strict().refine(value => Object.values(value).some(field => field !== undefined), 'No organization changes supplied');

export type UpdateOrganizationSettings = z.infer<typeof UpdateOrganizationSettingsSchema>;
export interface OrganizationSettings {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  domain: string | null;
  address: string | null;
}
