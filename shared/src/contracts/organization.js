"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewAccountSchema = void 0;
exports.exclusiveAccountInput = exclusiveAccountInput;
const zod_1 = require("zod");
const administration_user_schema_1 = require("../validation/administration-user.schema");
const closing_requirements_1 = require("./closing-requirements");
const record_experience_1 = require("./record-experience");
/** A retry identity belongs to this Account creation, including saves from edit forms. */
exports.NewAccountSchema = zod_1.z.object({
    requestId: zod_1.z.string().uuid(),
    name: (0, administration_user_schema_1.cleanText)(255).pipe(zod_1.z.string().min(1, 'Company name is required.')),
    industry: (0, administration_user_schema_1.cleanText)(2000).optional(),
    size: zod_1.z.enum(record_experience_1.COMPANY_SIZE_OPTIONS).optional(),
    website: zod_1.z.string().trim().url('Must be a valid URL').optional().or(zod_1.z.literal('')),
    customFieldValues: closing_requirements_1.CustomFieldValuesSchema.optional(),
}).strict();
function exclusiveAccountInput(input) {
    return !input.newAccount || !input.accountId;
}
