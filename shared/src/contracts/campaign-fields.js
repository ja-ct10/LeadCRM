"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPAIGN_VARIABLE_CATEGORIES = void 0;
exports.campaignPersonalizationAvailable = campaignPersonalizationAvailable;
exports.campaignVariableChoices = campaignVariableChoices;
exports.campaignApprovedVariableKeys = campaignApprovedVariableKeys;
exports.campaignFields = campaignFields;
exports.campaignConditionField = campaignConditionField;
exports.campaignFieldOperators = campaignFieldOperators;
exports.campaignConditionError = campaignConditionError;
const field_catalog_1 = require("./field-catalog");
exports.CAMPAIGN_VARIABLE_CATEGORIES = ['Standard Fields', 'Custom Fields', 'Sender'];
function campaignPersonalizationAvailable(field) {
    return field.active && field.personalizationAvailable && (field.visibleInForm || field.visibleInDetails);
}
/** Same token is never a relationship binding. Custom definition identities stay separate. */
function campaignVariableChoices(fields, source) {
    const module = source === 'LEADS' ? 'leads' : source === 'CONTACTS' ? 'contacts' : undefined;
    const choices = new Map();
    for (const field of fields) {
        const id = field.customFieldId ? `${field.module}:${field.customFieldId}` : JSON.stringify([field.kind, field.technicalKey, field.label, field.type, field.reference]);
        const existing = choices.get(id);
        if (existing)
            existing.origins.push(field);
        else
            choices.set(id, { id, technicalKey: field.technicalKey, label: field.label, category: field.kind === 'System' ? 'Standard Fields' : 'Custom Fields', origins: [field], personalizationAvailable: false });
    }
    for (const choice of choices.values()) {
        const field = choice.origins.find(origin => origin.module === module);
        choice.personalizationAvailable = !!field && campaignPersonalizationAvailable(field);
        if (!choice.personalizationAvailable)
            choice.unavailableReason = !module ? 'Select a Lead or Contact audience to use this field.' : !field ? 'Unavailable for this audience. Related Account and Deal fields require an explicit supported binding.' : field.unavailableReason ?? (!field.active ? 'This field is disabled.' : !field.visibleInForm && !field.visibleInDetails ? 'This field is hidden.' : 'This field does not support personalization.');
    }
    return [...choices.values(), ...['sender_name', 'sender_email'].map(technicalKey => ({ id: technicalKey, technicalKey, label: technicalKey === 'sender_name' ? 'Sender Name' : 'Sender Email', category: 'Sender', origins: [], personalizationAvailable: true }))];
}
/** Canonical IDs remain valid for saved content; legacy aliases are rendering compatibility only. */
function campaignApprovedVariableKeys(fields) {
    const keys = new Set(['sender_name', 'sender_email', ...fields.filter(campaignPersonalizationAvailable).flatMap(field => [field.technicalKey, ...(field.canonicalTechnicalKey ? [field.canonicalTechnicalKey] : [])])]);
    const aliases = { first_name: ['firstName'], last_name: ['lastName'], company_name: ['companyName', 'company'], contact_number: ['phone'] };
    for (const [alias, nativeKeys] of Object.entries(aliases))
        if (nativeKeys.some(key => keys.has(key)))
            keys.add(alias);
    return keys;
}
function campaignFields(source, definitions = [], layout) {
    const module = source === 'LEADS' ? 'leads' : 'contacts';
    const fields = (0, field_catalog_1.getCrmFieldCatalog)(module, definitions, layout).filter(field => field.active);
    if (!fields.some(field => field.technicalKey === 'createdAt'))
        fields.push({ technicalKey: 'createdAt', label: 'Created Date', module, kind: 'System', type: 'date', groupId: 'metadata', group: 'Record', order: 10000, required: false, mandatory: false, active: true, visibleInForm: false, visibleInDetails: true, conditionAvailable: true, personalizationAvailable: true });
    return fields;
}
function campaignConditionField(key, fields) {
    const native = key === 'productInterest' ? 'productInterestIds' : key === 'company' ? (fields[0]?.module === 'leads' ? 'companyName' : 'company') : key;
    return fields.find(field => field.technicalKey === native || field.canonicalTechnicalKey === native);
}
function campaignFieldOperators(field) {
    const presence = ['is_empty', 'is_not_empty'];
    if (!field || field.type === 'file')
        return presence;
    if (field.type === 'date')
        return ['any', 'gte', 'lte', 'between', ...presence];
    if (field.type === 'number')
        return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', ...presence];
    if (['dropdown', 'reference', 'products', 'boolean'].includes(field.type))
        return ['equals', 'not_equals', ...presence];
    return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', ...presence];
}
function campaignConditionError(condition, fields) {
    const field = campaignConditionField(condition.field, fields);
    if (!field?.conditionAvailable)
        return 'This field is unavailable for the selected source. Repair the condition.';
    if (!campaignFieldOperators(field).includes(condition.operator))
        return `Choose a supported operator for ${field.label}.`;
    if (['is_empty', 'is_not_empty', 'any'].includes(condition.operator))
        return condition.value === null ? undefined : 'This operator has no value.';
    const value = condition.value;
    if (field.type === 'number')
        return typeof value === 'number' && Number.isFinite(value) ? undefined : `Enter a number for ${field.label}.`;
    if (field.type === 'boolean')
        return typeof value === 'boolean' ? undefined : `Select Yes or No for ${field.label}.`;
    if (field.type === 'products')
        return Array.isArray(value) && value.length && value.every(id => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) ? undefined : 'Select at least one product.';
    if (field.type === 'reference')
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? undefined : `Select ${field.label}.`;
    if (field.type === 'date') {
        const valid = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
        return condition.operator === 'between' ? value && typeof value === 'object' && !Array.isArray(value) && valid(value.from) && valid(value.to) && value.from <= value.to ? undefined : 'Enter valid From and To dates.' : valid(value) ? undefined : 'Select a valid calendar date.';
    }
    if (typeof value !== 'string' || !value.trim())
        return `Enter a value for ${field.label}.`;
    if (field.type === 'dropdown' && !field.options?.includes(value))
        return `Select a current ${field.label} option.`;
    return undefined;
}
