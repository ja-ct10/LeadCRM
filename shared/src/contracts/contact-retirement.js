"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETIRED_CONTACT_FIELDS = void 0;
exports.isRetiredContactField = isRetiredContactField;
exports.retiredContactReferences = retiredContactReferences;
exports.withoutRetiredContactFields = withoutRetiredContactFields;
/** Contact database properties retired by the governed column rollout. */
exports.RETIRED_CONTACT_FIELDS = ['customerType', 'recordType', 'score', 'linkedinUrl', 'activeProducts', 'lastContactedAt', 'qualifiedAt', 'disqualifiedReason', 'jobTitle'];
const retiredKeys = new Set([...exports.RETIRED_CONTACT_FIELDS, 'activeProductIds', 'linkedin']);
function isRetiredContactField(field, entity) {
    return field.startsWith('contact.') ? retiredKeys.has(field.slice(8)) : entity === 'contact' && retiredKeys.has(field);
}
/** Inspect selectors only. Message bodies and custom field IDs are historical data. */
function retiredContactReferences(value, entity) {
    const found = new Set();
    const visit = (node) => {
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (!node || typeof node !== 'object')
            return;
        if ('field' in node && node.field === 'event.changedFields' && 'value' in node) {
            for (const field of Array.isArray(node.value) ? node.value : [node.value])
                if (typeof field === 'string' && isRetiredContactField(field, entity))
                    found.add(field);
        }
        for (const [key, child] of Object.entries(node)) {
            if (key === 'field' && typeof child === 'string' && isRetiredContactField(child, entity))
                found.add(child);
            if (key === 'changedFields' && Array.isArray(child))
                for (const field of child)
                    if (typeof field === 'string' && isRetiredContactField(field, entity))
                        found.add(field);
            visit(child);
        }
    };
    visit(value);
    return [...found];
}
function withoutRetiredContactFields(record) {
    return Object.fromEntries(Object.entries(record).filter(([key]) => !retiredKeys.has(key)));
}
