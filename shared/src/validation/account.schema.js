"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionalTaxIdSchema = void 0;
const zod_1 = require("zod");
/** Tax IDs stay strings so leading zeros are preserved. Empty means not provided. */
exports.OptionalTaxIdSchema = zod_1.z.string()
    .regex(/^(?:[0-9]{9})?$/, 'Tax ID must contain exactly 9 digits.')
    .optional();
