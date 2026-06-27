import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title:          z.string().min(1).max(255),
  description:    z.string().optional(),
  status:         z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled']).default('pending'),
  priority:       z.enum(['Low', 'Medium', 'High']).default('Medium'),
  dueDate:        z.string().datetime(),
  reminderAt:     z.string().datetime().optional(),
  dealId:         z.string().cuid().optional(),
  contactId:      z.string().cuid().optional(),
  organizationId: z.string().cuid().optional(),
  assignedUserId: z.string().cuid(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const CompleteTaskSchema = z.object({
  completedAt: z.string().datetime().optional(),
});

export type CreateTaskDto   = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto   = z.infer<typeof UpdateTaskSchema>;
export type CompleteTaskDto = z.infer<typeof CompleteTaskSchema>;
