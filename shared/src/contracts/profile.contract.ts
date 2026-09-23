import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const UpdateSelfProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: optionalText(50),
  jobTitle: optionalText(150),
  department: optionalText(150),
  timeZone: optionalText(100).refine(value => {
    if (!value) return true;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Choose a valid time zone, such as Asia/Manila'),
}).strict().refine(value => Object.keys(value).length > 0, 'No profile changes supplied');

export type UpdateSelfProfile = z.infer<typeof UpdateSelfProfileSchema>;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
