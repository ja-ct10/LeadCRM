import { z } from 'zod';

export const CreateInvitationsSchema = z.object({
  emails: z.array(z.string().email('Each entry must be a valid email')).min(1, 'At least one email is required').max(10, 'Maximum 10 invitations at once'),
  roleId: z.string().uuid('Invalid role ID'),
});

export type CreateInvitationsDto = z.infer<typeof CreateInvitationsSchema>;
