"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupHeadSchema = exports.GroupMemberSchema = exports.UpdateGroupSchema = exports.CreateGroupSchema = exports.GroupNameSchema = void 0;
exports.isGroupHeadRole = isGroupHeadRole;
const zod_1 = require("zod");
exports.GroupNameSchema = zod_1.z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or fewer.');
exports.CreateGroupSchema = zod_1.z.object({ name: exports.GroupNameSchema }).strict();
exports.UpdateGroupSchema = exports.CreateGroupSchema;
exports.GroupMemberSchema = zod_1.z.union([
    zod_1.z.object({ userId: zod_1.z.string().uuid('Invalid user ID') }).strict(),
    zod_1.z.object({
        userIds: zod_1.z.array(zod_1.z.string().uuid('Invalid user ID')).min(1, 'Select at least one user.')
            .refine(ids => new Set(ids).size === ids.length, 'Select each user only once.'),
    }).strict(),
]);
exports.GroupHeadSchema = zod_1.z.object({ userId: zod_1.z.string().uuid('Invalid user ID').nullable() }).strict();
/** Group responsibility follows the current primary role and grants no permissions. */
function isGroupHeadRole(role) {
    return ['salesmanager', 'headofsales'].includes(role.trim().toLowerCase().replace(/[\s_-]/g, ''));
}
