"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradePlanSchema = void 0;
const zod_1 = require("zod");
exports.UpgradePlanSchema = zod_1.z.object({
    plan: zod_1.z.enum(['FREE', 'PRO', 'ENTERPRISE']),
    billingCycle: zod_1.z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
});
