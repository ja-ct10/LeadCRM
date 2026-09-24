"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrganizationSettingsSchema = void 0;
const zod_1 = require("zod");
const optionalText = zod_1.z.string().trim().nullable().optional()
    .transform(value => value === '' ? null : value);
exports.UpdateOrganizationSettingsSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Organization name is required').max(255).optional(),
    industry: optionalText,
    email: optionalText.pipe(zod_1.z.string().email('Enter a valid email address').nullable().optional()),
    phone: optionalText,
    domain: optionalText,
    address: optionalText,
}).strict().refine(value => Object.values(value).some(field => field !== undefined), 'No organization changes supplied');
