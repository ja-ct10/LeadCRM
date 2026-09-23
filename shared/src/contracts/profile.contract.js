"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVATAR_MAX_BYTES = exports.AVATAR_MIME_TYPES = exports.UpdateSelfProfileSchema = void 0;
const zod_1 = require("zod");
const optionalText = (max) => zod_1.z.string().trim().max(max).nullable().optional();
exports.UpdateSelfProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(1).max(100).optional(),
    lastName: zod_1.z.string().trim().min(1).max(100).optional(),
    phone: optionalText(50),
    jobTitle: optionalText(150),
    department: optionalText(150),
    timeZone: optionalText(100).refine(value => {
        if (!value)
            return true;
        try {
            new Intl.DateTimeFormat('en', { timeZone: value });
            return true;
        }
        catch {
            return false;
        }
    }, 'Choose a valid time zone, such as Asia/Manila'),
}).strict().refine(value => Object.keys(value).length > 0, 'No profile changes supplied');
exports.AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
exports.AVATAR_MAX_BYTES = 5 * 1024 * 1024;
