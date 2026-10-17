"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvDocument = exports.DealViewFiltersSchema = void 0;
exports.matchesDealView = matchesDealView;
exports.csvCell = csvCell;
const zod_1 = require("zod");
exports.DealViewFiltersSchema = zod_1.z.object({
    search: zod_1.z.string().max(1000).default(''), my: zod_1.z.boolean().default(false),
    filters: zod_1.z.object(Object.fromEntries(['stage', 'owner', 'priority', 'product', 'status', 'created'].map(key => [key, zod_1.z.array(zod_1.z.string().max(200)).max(100).optional()]))).strict().default({}),
    accountId: zod_1.z.string().optional(), leadId: zod_1.z.string().optional(), contactId: zod_1.z.string().optional(),
}).strict();
/** The board and export share the same display-field search and filter semantics. */
function matchesDealView(deal, view, userId, now = Date.now()) {
    const terms = view.search.trim().toLowerCase().slice(0, 150).split(/\s+/).filter(Boolean).slice(0, 12);
    const text = `${deal.title} ${deal.companyName ?? ''} ${deal.contactPerson ?? ''}`.toLowerCase();
    const f = view.filters;
    return (!view.accountId || deal.accountId === view.accountId)
        && (!view.leadId || !!deal.leadIds?.includes(view.leadId) || deal.leadId === view.leadId)
        && (!view.contactId || !!deal.contactIds?.includes(view.contactId) || deal.contactId === view.contactId)
        && terms.every(term => text.includes(term)) && (!view.my || deal.assignedUserId === userId)
        && (!f.stage?.length || f.stage.includes(deal.stageId))
        && (!f.owner?.length || f.owner.includes(deal.assignedUserId || 'unassigned'))
        && (!f.priority?.length || f.priority.some(value => value.toLowerCase() === deal.priority.toLowerCase()))
        && (!f.product?.length || !!deal.productInterests?.some(value => f.product.includes(value)))
        && (!f.status?.length || f.status.includes(deal.status))
        && (!f.created?.length || f.created.some(days => Number.isFinite(Number(days)) && new Date(deal.createdAt).getTime() >= now - Number(days) * 86400000));
}
function csvCell(value) {
    let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
    if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
        text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
}
const csvDocument = (rows) => '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
exports.csvDocument = csvDocument;
