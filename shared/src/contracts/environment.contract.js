"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeEnvironmentSchema = exports.CrmEnvironmentSchema = void 0;
const zod_1 = require("zod");
exports.CrmEnvironmentSchema = zod_1.z.enum(['SANDBOX', 'PRODUCTION']);
exports.ChangeEnvironmentSchema = zod_1.z.object({ environment: exports.CrmEnvironmentSchema }).strict();
