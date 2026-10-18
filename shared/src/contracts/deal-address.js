"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dealCustomerAddressMessage = exports.dealAddressKey = exports.DealAddressSourceSchema = void 0;
exports.resolveDealAddress = resolveDealAddress;
exports.dealAddressMessage = dealAddressMessage;
const zod_1 = require("zod");
exports.DealAddressSourceSchema = zod_1.z.object({
    type: zod_1.z.enum(['lead', 'contact', 'account']),
    id: zod_1.z.string().trim().min(1).max(255),
}).strict();
const dealAddressKey = (source) => `${source.type}:${source.id}`;
exports.dealAddressKey = dealAddressKey;
/** Resolve references at read time; never turn a linked value into a stored override. */
function resolveDealAddress(address, selection, options) {
    const parsed = exports.DealAddressSourceSchema.safeParse(selection);
    const source = parsed.success ? parsed.data : null;
    const selected = source ? options.find(option => (0, exports.dealAddressKey)(option) === (0, exports.dealAddressKey)(source)) : undefined;
    const automatic = selection == null && options.length === 1 ? options[0] : undefined;
    const customerAddress = selected?.address ?? automatic?.address ?? null;
    const customerStatus = selection != null ? selected ? 'linked' : 'unavailable' : automatic ? 'linked' : options.length ? 'choice_required' : 'empty';
    return { options, source: source ?? (automatic ? { type: automatic.type, id: automatic.id } : null), customerAddress, customerStatus,
        effectiveAddress: address?.trim() ? address : customerAddress, status: address?.trim() ? 'override' : customerStatus };
}
const dealCustomerAddressMessage = (context) => dealAddressMessage({ ...context, effectiveAddress: context.customerAddress, status: context.customerStatus });
exports.dealCustomerAddressMessage = dealCustomerAddressMessage;
function dealAddressMessage(context) {
    if (context.effectiveAddress)
        return context.effectiveAddress;
    if (context.status === 'choice_required')
        return 'Choose a linked address';
    if (context.status === 'unavailable')
        return 'The selected customer address is unavailable. Choose another linked address or provide a Deal override.';
    return 'No linked customer address available';
}
