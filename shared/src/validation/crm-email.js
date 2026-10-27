"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmEmailSchema = exports.INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR = void 0;
const zod_1 = require("zod");
exports.INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR = 'This email belongs to an internal employee account and cannot be used as a customer record.';
/** Shared manual Lead/Contact create and field-edit validation. */
exports.CrmEmailSchema = zod_1.z.string().trim().min(1, 'Email is required').max(254, 'Email must be 254 characters or less').email('Invalid email address');
