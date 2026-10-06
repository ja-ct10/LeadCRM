"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PH_MOBILE_ERROR = void 0;
exports.isValidPhMobile = isValidPhMobile;
exports.validatePhMobile = validatePhMobile;
exports.toE164 = toE164;
/** Canonical Philippine mobile number rules shared by CRM and profile forms. */
exports.PH_MOBILE_ERROR = 'Enter a valid 10-digit Philippine mobile number starting with 9.';
/** A national mobile number without the country prefix, in 9XXXXXXXXX form. */
function isValidPhMobile(value) {
    return /^9\d{9}$/.test(value);
}
/** Returns an inline validation message, or null when valid or optional-empty. */
function validatePhMobile(value) {
    if (value.length === 0)
        return null;
    return isValidPhMobile(value) ? null : exports.PH_MOBILE_ERROR;
}
/** Converts a validated local number to LeadCRM's existing E.164 storage format. */
function toE164(localNumber) {
    return `+63${localNumber}`;
}
