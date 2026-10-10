import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AudienceSourceSchema, AudiencePreviewSchema, AudiencePreviewRequestSchema, CreateAudienceSchema, CRM_STATUSES, LeadCreatedFilterSchema, leadCreatedBounds, type AudienceInput, type AudienceBreakdown, type AudiencePreviewResult, type EmailVariables, campaignFields, campaignConditionField, campaignConditionError, FieldLayoutSchema, type CrmFieldCatalogEntry, type AudienceCondition } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { AppError } from '../../../shared/errors/app-error';
import { resolveProducts, validateSalesOwner } from '../../crm/leads/lead-automation.service';
import { readConfiguredFields } from '../../crm/closing-requirements/closing-requirements.repository';
import { normalizeSmsPhone } from '../../../shared/services/sms.service';

export function campaignScope(tenantId: string) {
  const context = tenantContext.getStore();
  if (!context || context.tenantId !== tenantId) throw new AppError('CRM tenant context is required.', 403);
  return { tenantId };
}

/** CRM scalar fields used by audience matching; never a paginated UI cache. */
async function companyValues(tenantId: string, source: AudienceInput['source'], db: Prisma.TransactionClient = prisma) {
  const where = { ...campaignScope(tenantId), isArchived: false, deletedAt: null };
  const [leads, contacts] = await Promise.all([
    source === 'CONTACTS' ? [] : db.lead.findMany({ where, distinct: ['companyName'], select: { companyName: true } }),
    source === 'LEADS' ? [] : db.contact.findMany({ where, distinct: ['company', 'accountId'], select: { company: true, account: { select: { name: true } } } }),
  ]);
  return [...leads.map(row => row.companyName), ...contacts.map(row => row.account?.name || row.company)].filter((value): value is string => !!value?.trim());
}
export async function audienceCompanies(tenantId: string, input: unknown) {
  const source = AudienceSourceSchema.parse(input);
  const names = new Map<string, string>();
  for (const value of (await companyValues(tenantId, source)).sort()) {
    const name = value.trim();
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

// Preserve the string column: scalars stay readable, structured values are JSON.
// Legacy product names resolve only through this tenant's catalog.
export async function audienceFields(tenantId: string, sourceInput: unknown, db: Prisma.TransactionClient = prisma) {
  const source = AudienceSourceSchema.parse(sourceInput), module = source === 'LEADS' ? 'leads' : 'contacts';
  const [definitions, preference] = await Promise.all([readConfiguredFields(db, tenantId), db.tenantPreference.findFirst({ where: { tenantId, module, key: 'field-layout' } })]);
  const layout = FieldLayoutSchema.safeParse(preference?.value);
  return campaignFields(source, definitions, layout.success ? layout.data : undefined);
}
async function readDefinition(tenantId: string, source: string, rows: { field: string; operator: string; value: string }[], db: Prisma.TransactionClient, matchMode: string = 'AND'): Promise<AudienceInput> {
  const conditions = await Promise.all(rows.map(async row => {
    let value: unknown = row.value;
    // Current writes serialize all values as JSON; tolerate prior scalar strings.
    if (/^[\[\{\"]/.test(row.value) || row.field.startsWith('customFieldValues.')) { try { value = JSON.parse(row.value); } catch { /* legacy scalar */ } }
    if (row.field === 'status' && typeof value === 'string') value = CRM_STATUSES.find(status => status.toLowerCase() === String(value).toLowerCase()) ?? value;
    if (['any', 'is_empty', 'is_not_empty'].includes(row.operator)) value = null;
    if (row.field === 'productInterest' && typeof value === 'string') {
      const product = await db.productInterest.findFirst({ where: { tenantId, active: true, name: value }, select: { id: true } });
      if (!product) throw new AppError('A saved audience Product Interest is no longer available.', 400);
      value = [product.id];
    }
    return { field: row.field, operator: row.operator, value };
  }));
  return AudiencePreviewSchema.parse({ source, matchMode, conditions });
}
export async function validateAudienceReferences(tenantId: string, dto: AudienceInput, db: Prisma.TransactionClient = prisma) {
  const fields = await audienceFields(tenantId, dto.source, db);
  for (const condition of dto.conditions) {
    const error = campaignConditionError(condition, fields);
    if (error) throw new AppError(error, 400);
    if (['any', 'is_empty', 'is_not_empty'].includes(condition.operator)) continue;
    const field = campaignConditionField(condition.field, fields)!;
    if (field.type === 'products') await resolveProducts(db, tenantId, condition.value as string[]);
    if (field.reference === 'user') await validateSalesOwner(db, tenantId, String(condition.value));
    if (field.reference === 'account' && !await db.account.findFirst({ where: { tenantId, id: String(condition.value), isArchived: false, deletedAt: null }, select: { id: true } })) throw new AppError('Select an available Account in this tenant.', 400);
  }
  return fields;
}
export async function getAudiences(tenantId: string) {
  const rows = await prisma.targetAudience.findMany({ where: { ...campaignScope(tenantId), isActive: true }, include: { conditions: { orderBy: { conditionOrder: 'asc' } } }, orderBy: { name: 'asc' } });
  return Promise.all(rows.map(async row => {
    try { return { id: row.id, name: row.name, ...await readDefinition(tenantId, row.source, row.conditions, prisma, row.matchMode) }; }
    catch { const repair = await readDefinition(tenantId, 'LEADS', row.conditions, prisma, row.matchMode).catch(() => ({ conditions: [] })); return { id: row.id, name: row.name, source: row.source, matchMode: row.matchMode, conditions: repair.conditions, repairReason: row.source === 'ALL' ? 'Legacy mixed audience. Create a Lead or Contact audience before reuse.' : 'Saved audience needs repair before reuse.' }; }
  }));
}
export async function createAudience(tenantId: string, input: unknown) {
  const dto = CreateAudienceSchema.parse(input), scope = campaignScope(tenantId);
  return prisma.$transaction(async tx => {
    await validateAudienceReferences(tenantId, dto, tx);
    const row = await tx.targetAudience.create({ data: { ...scope, name: dto.name, source: dto.source, matchMode: dto.matchMode,
      conditions: { create: dto.conditions.map((condition, i) => ({ field: condition.field, operator: condition.operator, value: JSON.stringify(condition.value), conditionOrder: i })) } } });
    return { id: row.id, ...dto };
  });
}
export async function updateAudience(tenantId: string, id: string, input: unknown) {
  const dto = CreateAudienceSchema.parse(input), scope = campaignScope(tenantId);
  return prisma.$transaction(async tx => {
    await validateAudienceReferences(tenantId, dto, tx);
    if (!await tx.targetAudience.findFirst({ where: { id, ...scope, isActive: true }, select: { id: true } })) throw new AppError('Target audience not found.', 404);
    await tx.targetAudience.update({ where: { id }, data: { name: dto.name, source: dto.source, matchMode: dto.matchMode, conditions: { deleteMany: {}, create: dto.conditions.map((condition, index) => ({ field: condition.field, operator: condition.operator, value: JSON.stringify(condition.value), conditionOrder: index })) } } });
    return { id, ...dto };
  });
}
export async function audienceDefinition(tenantId: string, id?: string | null, source?: string | null, db: Prisma.TransactionClient = prisma): Promise<AudienceInput> {
  if (id) {
    const audience = await db.targetAudience.findFirst({ where: { ...campaignScope(tenantId), id, isActive: true }, include: { conditions: { orderBy: { conditionOrder: 'asc' } } } });
    if (!audience) throw new AppError('Target audience not found.', 404);
    if (audience.source === 'ALL') throw new AppError('This legacy mixed audience requires a new Lead or Contact audience before reuse.', 400);
    return readDefinition(tenantId, audience.source, audience.conditions, db, audience.matchMode);
  }
  if (source === 'ALL') throw new AppError('Select Leads or Contacts to repair this legacy mixed campaign.', 400);
  return AudiencePreviewSchema.parse({ source, conditions: [] });
}
function scalarPredicate(condition: AudienceCondition, date = false, insensitive = false): Record<string, unknown> {
  const { operator, value } = condition;
  if (operator === 'is_empty') return { equals: null };
  if (operator === 'is_not_empty') return { not: null };
  if (operator === 'any') return {};
  if (date) {
    const filter = LeadCreatedFilterSchema.parse(operator === 'between' ? { operator, ...(typeof value === 'object' ? value : {}) } : { operator, date: value });
    return leadCreatedBounds(filter);
  }
  const comparisons: Partial<Record<AudienceCondition['operator'], string>> = { equals: 'equals', not_equals: 'not', contains: 'contains', not_contains: 'not', starts_with: 'startsWith', ends_with: 'endsWith', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' };
  const comparison = comparisons[operator];
  if (!comparison) throw new AppError('Unsupported audience operator.', 400);
  return { [comparison]: operator === 'not_contains' ? { contains: value, ...(insensitive ? { mode: 'insensitive' } : {}) } : value, ...(insensitive ? { mode: 'insensitive' } : {}) };
}
/** Only keys approved by the module catalog enter a Prisma predicate. */
export function conditionsFor(input: AudienceInput, lead: boolean, _companies?: string[], catalog = campaignFields(lead ? 'LEADS' : 'CONTACTS')): Prisma.LeadWhereInput[] | Prisma.ContactWhereInput[] {
  return input.conditions.map(condition => {
    const error = campaignConditionError(condition, catalog);
    if (error) throw new AppError(error, 400);
    const field = campaignConditionField(condition.field, catalog)!;
    if (field.customFieldId) {
      const base = { fieldId: field.customFieldId, module: lead ? 'leads' : 'contacts' };
      const populated = { ...base, NOT: { OR: [{ value: { equals: Prisma.JsonNull } }, { value: { equals: '' } }] } };
      if (condition.operator === 'is_empty') return { customFieldValues: { none: populated } };
      if (condition.operator === 'is_not_empty') return { customFieldValues: { some: populated } };
      if (condition.operator === 'any') return {};
      const json = field.type === 'date' ? condition.operator === 'between' ? { gte: (condition.value as { from: string }).from, lte: (condition.value as { to: string }).to } : { [condition.operator]: condition.value } : scalarPredicate(condition);
      if (typeof json.contains === 'string') { json.string_contains = json.contains; delete json.contains; }
      if (typeof json.startsWith === 'string') { json.string_starts_with = json.startsWith; delete json.startsWith; }
      if (typeof json.endsWith === 'string') { json.string_ends_with = json.endsWith; delete json.endsWith; }
      if (['not_equals', 'not_contains'].includes(condition.operator)) {
        const positive = condition.operator === 'not_equals' ? { equals: condition.value } : { string_contains: condition.value };
        return { customFieldValues: { none: { ...base, value: positive } } };
      }
      return { customFieldValues: { some: { ...base, value: json } } };
    }
    if (field.type === 'products') {
      const active = field.technicalKey === 'activeProductIds';
      const relation = { ...(lead ? {} : { [active ? 'activeProduct' : 'interested']: true }), ...(!['is_empty', 'is_not_empty'].includes(condition.operator) ? { productInterestId: { in: condition.value } } : {}) };
      return { productLinks: { [['not_equals', 'is_empty'].includes(condition.operator) ? 'none' : 'some']: relation } };
    }
    const key = field.technicalKey;
    const value = !lead && key === 'status' && typeof condition.value === 'string' ? condition.value.toUpperCase() : condition.value;
    if (['is_empty', 'is_not_empty'].includes(condition.operator) && ['status', 'createdAt'].includes(key)) return condition.operator === 'is_empty' ? { id: { in: [] } } : {};
    if (['is_empty', 'is_not_empty'].includes(condition.operator) && ['firstName', 'lastName'].includes(key)) return { [key]: condition.operator === 'is_empty' ? '' : { not: '' } };
    let scalar = scalarPredicate({ ...condition, value }, field.type === 'date', ['text', 'longText'].includes(field.type) || key === 'status' && lead);
    if (condition.field === 'company' && typeof condition.value === 'string' && ['equals', 'not_equals'].includes(condition.operator) && _companies) scalar = { [condition.operator === 'equals' ? 'in' : 'notIn']: [...new Set([condition.value, ..._companies.filter(company => company.trim().toLowerCase() === String(condition.value).trim().toLowerCase())])], mode: 'insensitive' };
    if (condition.field === 'company' && !lead) return { OR: [{ account: { is: { name: scalar } } }, { account: { is: null }, company: scalar }, { account: { is: { name: '' } }, company: scalar }] };
    if (['is_empty', 'is_not_empty'].includes(condition.operator) && ['text', 'longText', 'dropdown'].includes(field.type)) return condition.operator === 'is_empty' ? { OR: [{ [key]: null }, { [key]: '' }] } : { AND: [{ [key]: { not: null } }, { [key]: { not: '' } }] };
    return { [key]: scalar };
  }) as Prisma.LeadWhereInput[] | Prisma.ContactWhereInput[];
}
export function audiencePredicate(input: AudienceInput, lead: boolean, fields?: CrmFieldCatalogEntry[], companies?: string[]) {
  const conditions = conditionsFor(input, lead, companies, fields);
  return conditions.length ? { [input.matchMode]: conditions } : {};
}
const recipientProjection = { id: true, email: true, firstName: true, lastName: true, phone: true, status: true, source: true, address: true, createdAt: true, assignedUserId: true, accountId: true, assignedUser: { select: { firstName: true, lastName: true } }, account: { select: { name: true } }, customFieldValues: { select: { fieldId: true, value: true } }, productLinks: { orderBy: [{ position: 'asc' }, { productInterestId: 'asc' }] as Prisma.LeadProductInterestOrderByWithRelationInput[], select: { productInterestId: true, product: { select: { name: true } } } }, isArchived: true, deletedAt: true } as const;
function personalized(row: Record<string, unknown>, fields: CrmFieldCatalogEntry[]): EmailVariables {
  const values: EmailVariables = {};
  const scalar = (value: unknown, date = false): string => value == null ? '' : date ? value instanceof Date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value) : String(value).slice(0, 10) : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);
  const custom = new Map((row.customFieldValues as { fieldId: string; value: unknown }[] ?? []).map(value => [value.fieldId, value.value]));
  const products = row.productLinks as { product: { name: string }; interested?: boolean; activeProduct?: boolean }[] ?? [];
  for (const field of fields.filter(entry => entry.personalizationAvailable)) {
    let value: unknown = field.customFieldId ? custom.get(field.customFieldId) : row[field.technicalKey];
    if (field.technicalKey === 'company') value = (row.account as { name: string } | null)?.name || row.company;
    if (field.reference === 'user') { const user = row.assignedUser as { firstName: string; lastName: string } | null; value = user ? `${user.firstName} ${user.lastName}`.trim() : ''; }
    if (field.reference === 'account') value = (row.account as { name: string } | null)?.name;
    if (field.type === 'products') value = products.filter(product => field.technicalKey === 'activeProductIds' ? product.activeProduct : product.interested !== false).map(product => product.product.name).join(', ');
    values[field.technicalKey] = scalar(value, field.type === 'date');
  }
  return { ...values, first_name: scalar(row.firstName), last_name: scalar(row.lastName), company_name: (row.account as { name: string } | null)?.name || scalar(row.companyName ?? row.company), contact_number: scalar(row.phone), status: scalar(row.status) };
}
export interface ResolvedRecipient { leadId?: string; contactId?: string; email: string | null; phone?: string | null; personalization: EmailVariables; reason: string | null }
const emptyBreakdown = (): AudienceBreakdown => ({ matched: 0, eligible: 0, missingEmail: 0, invalidEmail: 0, duplicateEmail: 0, staffEmail: 0, unsubscribed: 0, blocked: 0, inactive: 0, recipientNotAllowed: 0, missingPhone: 0, invalidPhone: 0, duplicatePhone: 0, doNotContact: 0 });
const reasonCounts = { MISSING_EMAIL: 'missingEmail', INVALID_EMAIL: 'invalidEmail', DUPLICATE_EMAIL: 'duplicateEmail', STAFF_EMAIL: 'staffEmail', UNSUBSCRIBED: 'unsubscribed', BLOCKED: 'blocked', INACTIVE: 'inactive', RECIPIENT_NOT_ALLOWED: 'recipientNotAllowed', MISSING_PHONE: 'missingPhone', INVALID_PHONE: 'invalidPhone', DUPLICATE_PHONE: 'duplicatePhone', DO_NOT_CONTACT: 'doNotContact' } as const;
function classify(row: ResolvedRecipient, channel: 'EMAIL' | 'SMS', staff: Set<string>, suppressed: Map<string, string>, allowlist: Set<string> | null, seen: Set<string>, breakdown: AudienceBreakdown) {
  breakdown.matched++;
  row.email = row.email?.trim().toLowerCase() || null;
  if (channel === 'SMS') {
    if (!row.phone?.trim()) row.reason ||= 'MISSING_PHONE';
    else { try { row.phone = normalizeSmsPhone(row.phone); } catch { row.reason ||= 'INVALID_PHONE'; } }
    row.reason ||= suppressed.get(row.phone || '') || (seen.has(row.phone || '') ? 'DUPLICATE_PHONE' : null);
  } else {
    row.reason ||= !row.email ? 'MISSING_EMAIL' : !z.string().email().safeParse(row.email).success ? 'INVALID_EMAIL' : staff.has(row.email) ? 'STAFF_EMAIL' : suppressed.get(row.email) || (seen.has(row.email) ? 'DUPLICATE_EMAIL' : allowlist && !allowlist.has(row.email) ? 'RECIPIENT_NOT_ALLOWED' : null);
  }
  if (row.reason) {
    const key = reasonCounts[row.reason as keyof typeof reasonCounts];
    if (key) breakdown[key] = (breakdown[key] ?? 0) + 1;
  } else { seen.add((channel === 'SMS' ? row.phone : row.email)!); breakdown.eligible++; }
}
export function classifyRecipients(records: ResolvedRecipient[], staff: Set<string>, suppressed: Map<string, string>, allowlist: Set<string> | null, channel: 'EMAIL' | 'SMS' = 'EMAIL') {
  const breakdown = emptyBreakdown(), seen = new Set<string>();
  for (const row of records) classify(row, channel, staff, suppressed, allowlist, seen, breakdown);
  return { records, breakdown };
}

async function visitBatches<T extends { id: string }>(read: (cursor?: string) => Promise<T[]>, visit: (row: T) => void) {
  let cursor: string | undefined;
  for (;;) {
    const rows = await read(cursor);
    rows.forEach(visit);
    if (rows.length < 250) return;
    cursor = rows[rows.length - 1].id;
  }
}

export async function resolveAudience(tenantId: string, input: unknown, db: Prisma.TransactionClient = prisma, channel: 'EMAIL' | 'SMS' = 'EMAIL', page?: { page: number; limit: number }) {
  const dto = AudiencePreviewSchema.parse(input), scope = campaignScope(tenantId);
  const fields = await validateAudienceReferences(tenantId, dto, db);
  const companies = dto.conditions.some(condition => condition.field === 'company') ? await companyValues(tenantId, dto.source, db) : undefined;
  const staff = new Set<string>(), suppressed = new Map<string, string>();
  const batch = (cursor?: string) => ({ take: 250, orderBy: { id: 'asc' as const }, where: { ...scope, ...(cursor ? { id: { gt: cursor } } : {}) } });
  if (channel === 'EMAIL') {
    await visitBatches(cursor => db.user.findMany({ ...batch(cursor), select: { id: true, email: true } }), u => { staff.add(u.email.trim().toLowerCase()); });
    await visitBatches(cursor => db.emailDeliveryLog.findMany({ ...batch(cursor), where: { ...batch(cursor).where, OR: [{ status: { in: ['hard_bounce', 'blocked', 'spam', 'invalid_email', 'unsubscribed'] } }, { EmailEvent: { some: { eventType: { in: ['hard_bounce', 'blocked', 'spam', 'invalid_email', 'unsubscribe'] } } } }] }, select: { id: true, toEmail: true, status: true } }), log => { suppressed.set(log.toEmail.trim().toLowerCase(), log.status === 'unsubscribed' ? 'UNSUBSCRIBED' : 'BLOCKED'); });
  }
  await visitBatches(cursor => db.contact.findMany({ ...batch(cursor), where: { ...batch(cursor).where, doNotContact: true }, select: { id: true, email: true, phone: true } }), c => {
    if (channel === 'SMS' && c.phone) { try { suppressed.set(normalizeSmsPhone(c.phone), 'DO_NOT_CONTACT'); } catch { /* Invalid numbers cannot be sent. */ } }
    else if (c.email) suppressed.set(c.email.trim().toLowerCase(), 'UNSUBSCRIBED');
  });
  if (channel === 'EMAIL') await visitBatches(cursor => db.campaignContact.findMany({ ...batch(cursor), where: { ...batch(cursor).where, unsubscribed: true }, select: { id: true, email: true, lead: { select: { email: true } }, contact: { select: { email: true } } } }), c => {
    for (const email of [c.email, c.lead?.email, c.contact?.email]) if (email) suppressed.set(email.trim().toLowerCase(), 'UNSUBSCRIBED');
  });
  const rawAllowlist = process.env.BREVO_SANDBOX_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const allowlist = process.env.NODE_ENV !== 'production' && rawAllowlist?.length ? new Set(rawAllowlist) : null;
  const breakdown = emptyBreakdown(), seen = new Set<string>(), records: ResolvedRecipient[] = [];
  const retain = (row: ResolvedRecipient) => {
    classify(row, channel, staff, suppressed, allowlist, seen, breakdown);
    if (!page || (!row.reason && breakdown.eligible > (page.page - 1) * page.limit && records.length < page.limit)) records.push(row);
  };
  // Contacts win. Preview reads bounded, stable batches and retains only its page.
  if (dto.source !== 'LEADS') {
    let cursor: string | undefined;
    for (;;) {
      const rows = await db.contact.findMany({ where: { ...scope, ...audiencePredicate(dto, false, fields, companies), ...(cursor ? { id: { gt: cursor } } : {}) }, take: 250, orderBy: { id: 'asc' }, select: { ...recipientProjection, company: true, jobTitle: true, notes: true, doNotContact: true, productLinks: { ...recipientProjection.productLinks, select: { ...recipientProjection.productLinks.select, interested: true, activeProduct: true } } } });
      for (const c of rows) retain({ contactId: c.id, email: c.email, phone: c.phone, reason: c.doNotContact ? (channel === 'SMS' ? 'DO_NOT_CONTACT' : 'UNSUBSCRIBED') : c.isArchived || c.deletedAt || c.status === 'CANCELLED' ? 'INACTIVE' : null, personalization: personalized(c, fields) });
      if (rows.length < 250) break;
      cursor = rows[rows.length - 1].id;
    }
  }
  if (dto.source !== 'CONTACTS') {
    let cursor: string | undefined;
    for (;;) {
      const rows = await db.lead.findMany({ where: { ...scope, ...audiencePredicate(dto, true, fields, companies), ...(cursor ? { id: { gt: cursor } } : {}) }, take: 250, orderBy: { id: 'asc' }, select: { ...recipientProjection, companyName: true, convertedAt: true } });
      for (const l of rows) retain({ leadId: l.id, email: l.email, phone: l.phone, reason: l.isArchived || l.deletedAt || l.convertedAt || ['archived', 'converted', 'cancelled'].includes(l.status.toLowerCase()) ? 'INACTIVE' : null, personalization: personalized(l, fields) });
      if (rows.length < 250) break;
      cursor = rows[rows.length - 1].id;
    }
  }
  return { records, breakdown };
}
export async function previewAudience(tenantId: string, input: unknown): Promise<AudiencePreviewResult> {
  const { channel, page, limit, ...definition } = AudiencePreviewRequestSchema.parse(input);
  const { records, breakdown } = await resolveAudience(tenantId, definition, prisma, channel, { page, limit });
  return { ...breakdown, recipients: records.map(r => ({ id: (r.contactId || r.leadId)!, recordType: r.contactId ? 'Contact' : 'Lead', name: `${r.personalization.first_name || ''} ${r.personalization.last_name || ''}`.trim(), company: r.personalization.company_name || '', email: r.email, phone: r.phone ?? null })), meta: { page, limit, total: breakdown.eligible, hasMore: page * limit < breakdown.eligible } };
}
