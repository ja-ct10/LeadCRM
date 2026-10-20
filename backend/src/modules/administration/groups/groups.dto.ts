import { z } from 'zod';
import { CreateGroupSchema, UpdateGroupSchema, GroupMemberSchema, GroupHeadSchema } from '@leadcrm/shared';
export { CreateGroupSchema, UpdateGroupSchema, GroupMemberSchema, GroupHeadSchema };

export type CreateGroupDTO = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupDTO = z.infer<typeof UpdateGroupSchema>;
export type GroupMemberDTO = z.infer<typeof GroupMemberSchema>;
