"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneAvailabilitySchema = exports.CrmPhoneAvailabilityQuerySchema = exports.STAFF_PHONE_CONFLICT = void 0;
const zod_1 = require("zod");
const lead_contract_1 = require("./lead.contract");
exports.STAFF_PHONE_CONFLICT = 'This phone number belongs to a staff account and cannot be used.';
exports.CrmPhoneAvailabilityQuerySchema = zod_1.z.object({
    module: zod_1.z.enum(['leads', 'contacts']),
    phone: lead_contract_1.LeadPhoneSchema,
}).strict();
exports.PhoneAvailabilitySchema = zod_1.z.discriminatedUnion('available', [
    zod_1.z.object({ available: zod_1.z.literal(true) }),
    zod_1.z.object({ available: zod_1.z.literal(false), reason: zod_1.z.literal('STAFF_PHONE_NOT_ALLOWED') }),
]);
