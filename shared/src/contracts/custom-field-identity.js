"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customFieldTechnicalKey = exports.RESERVED_CUSTOM_FIELD_ALIASES = exports.CUSTOM_FIELD_ALIAS_MAX_LENGTH = void 0;
exports.customFieldAliasBase = customFieldAliasBase;
exports.allocateCustomFieldAlias = allocateCustomFieldAlias;
exports.resolveCustomFieldReference = resolveCustomFieldReference;
exports.CUSTOM_FIELD_ALIAS_MAX_LENGTH = 64;
exports.RESERVED_CUSTOM_FIELD_ALIASES = new Set(['constructor', 'prototype', 'proto', '__proto__', 'customfieldvalues']);
/** Labels are used only at allocation time; resolution never derives an alias from a label. */
function customFieldAliasBase(label) {
    return label.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, exports.CUSTOM_FIELD_ALIAS_MAX_LENGTH).replace(/-+$/g, '');
}
function allocateCustomFieldAlias(base, occupied) {
    for (let suffix = 1;; suffix++) {
        const tail = suffix === 1 ? '' : `-${suffix}`;
        const candidate = base.slice(0, exports.CUSTOM_FIELD_ALIAS_MAX_LENGTH - tail.length).replace(/-+$/g, '') + tail;
        if (!occupied.has(candidate) && !exports.RESERVED_CUSTOM_FIELD_ALIASES.has(candidate))
            return candidate;
    }
}
const customFieldTechnicalKey = (field) => `customFieldValues.${field.technicalAlias ?? field.id}`;
exports.customFieldTechnicalKey = customFieldTechnicalKey;
/** Definitions must already be tenant scoped by the caller. Never resolves across modules. */
function resolveCustomFieldReference(module, reference, definitions) {
    const identity = reference.startsWith('customFieldValues.') ? reference.slice('customFieldValues.'.length) : reference;
    const matches = definitions.filter(field => field.module === module && !field.deletedAt && (field.id === identity || field.technicalAlias === identity));
    return matches.length === 1 ? matches[0] : undefined;
}
