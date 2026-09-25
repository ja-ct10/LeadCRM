"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaManageSchema = exports.MfaVerifySchema = exports.MfaEnableSchema = exports.MfaSetupSchema = exports.CurrentPasswordSchema = exports.MfaProofSchema = exports.TotpCodeSchema = exports.EmployeeEmailSchema = exports.EMPLOYEE_EMAIL_DOMAIN = void 0;
const zod_1 = require("zod");
exports.EMPLOYEE_EMAIL_DOMAIN = 'camxian.com';
exports.EmployeeEmailSchema = zod_1.z.string().refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value), 'Control characters are not allowed.')
    .transform(value => value.trim().toLowerCase()).pipe(zod_1.z.string().max(254)
    .email('Enter a valid employee email.')
    .refine(value => value.split('@').length === 2 && value.split('@')[1] === exports.EMPLOYEE_EMAIL_DOMAIN, 'Use your @camxian.com employee email.'));
exports.TotpCodeSchema = zod_1.z.string().regex(/^\d{6}$/, 'Enter a 6-digit authenticator code.');
exports.MfaProofSchema = zod_1.z.string().regex(/^(?:\d{6}|[a-f0-9]{8}-[a-f0-9]{8})$/, 'Enter a 6-digit authenticator code or a recovery code.');
exports.CurrentPasswordSchema = zod_1.z.string().min(1, 'Current password is required.').max(72);
exports.MfaSetupSchema = zod_1.z.object({ currentPassword: exports.CurrentPasswordSchema }).strict();
exports.MfaEnableSchema = zod_1.z.object({ code: exports.TotpCodeSchema }).strict();
exports.MfaVerifySchema = zod_1.z.object({ code: exports.MfaProofSchema }).strict();
exports.MfaManageSchema = zod_1.z.object({ currentPassword: exports.CurrentPasswordSchema, code: exports.MfaProofSchema }).strict();
