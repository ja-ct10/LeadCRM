"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeEmailSchema = exports.StaffEmailSchema = exports.EMPLOYEE_EMAIL_DOMAIN = void 0;
const zod_1 = require("zod");
exports.EMPLOYEE_EMAIL_DOMAIN = 'camxian.com';
exports.StaffEmailSchema = zod_1.z.string().refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value), 'Control characters are not allowed.')
    .transform(value => value.trim().toLowerCase()).pipe(zod_1.z.string().max(254)
    .email('Enter a valid staff email.').refine(value => !value.includes('*'), 'Enter a valid staff email.'));
exports.EmployeeEmailSchema = exports.StaffEmailSchema.refine(value => value.split('@')[1] === exports.EMPLOYEE_EMAIL_DOMAIN, 'Use your @camxian.com employee email.');
