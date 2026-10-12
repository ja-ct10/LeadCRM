"use strict";
/**
 * Contact API contracts — request/response shapes for the contacts module.
 *
 * Entity types and request interfaces are defined in ../types/contact.types.ts.
 * This file re-exports them and adds response-specific contracts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactCreationIdentitySchema = void 0;
const zod_1 = require("zod");
/** Identity belongs to creation, never ordinary Contact updates. */
exports.ContactCreationIdentitySchema = zod_1.z.object({
    requestId: zod_1.z.string().uuid(),
    productInterestIds: zod_1.z.array(zod_1.z.string().uuid()).max(100).optional(),
});
