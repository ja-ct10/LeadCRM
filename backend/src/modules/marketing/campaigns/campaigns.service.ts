import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';
import * as gmailService from '../email/gmail.service';
import * as smsService from '../sms/sms-gateway.service';
import type { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactRecord {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  status: string;
  /** Discriminates between Lead and Customer at runtime */
  _type: 'lead' | 'customer';
}

interface AudienceCondition {
  field: string;
  operator: string;
  value: string;
}

// ── Security: allowlist of Lead/Customer fields that conditions may filter ─────
// Prevents user-controlled `condition.field` from injecting arbitrary Prisma keys.
const ALLOWED_CONDITION_FIELDS = new Set<string>([
  'status', 'source', 'industry', 'score', 'tags', 'customerType',
  'firstName', 'lastName', 'email', 'phone', 'city', 'country',
]);

// ── Variable replacement ───────────────────────────────────────────────────────

function replaceVariables(text: string, contact: ContactRecord): string {
  return text
    .replace(/\{\{first_name\}\}/g, contact.firstName ?? '')
    .replace(/\{\{last_name\}\}/g, contact.lastName ?? '')
    .replace(/\{\{company_name\}\}/g, contact.companyName ?? '')
    .replace(/\{\{contact_number\}\}/g, contact.phone ?? '')
    .replace(/\{\{status\}\}/g, contact.status)
    .replace(/\{\{sender_name\}\}/g, 'LeadCRM Agent')
    .replace(/\{\{sender_email\}\}/g, 'hello@leadcrm.com');
}

// ── Resolve audience contacts ──────────────────────────────────────────────────

async function resolveAudienceContacts(
  tenantId: string,
  conditions: AudienceCondition[],
): Promise<ContactRecord[]> {
  const where: Record<string, unknown> = {
    tenantId,
    isArchived: false,
    doNotContact: false,
  };

  for (const cond of conditions) {
    // Security: skip conditions that reference fields not in the allowlist
    if (!ALLOWED_CONDITION_FIELDS.has(cond.field)) {
      continue;
    }

    const numericValue = Number(cond.value);
    const parsedNum = isNaN(numericValue) ? cond.value : numericValue;

    switch (cond.operator) {
      case 'equals':     where[cond.field] = cond.value; break;
      case 'not_equals': where[cond.field] = { not: cond.value }; break;
      case 'contains':   where[cond.field] = { contains: cond.value, mode: 'insensitive' }; break;
      case 'gte':        where[cond.field] = { gte: parsedNum }; break;
      case 'lte':        where[cond.field] = { lte: parsedNum }; break;
      case 'in':         where[cond.field] = { in: cond.value.split(',').map((v) => v.trim()) }; break;
      case 'not_in':     where[cond.field] = { notIn: cond.value.split(',').map((v) => v.trim()) }; break;
    }
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      companyName: true,
      status: true,
    },
  });

  return leads.map((l) => ({ ...l, _type: 'lead' as const }));
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function getCampaigns(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.status
      ? { status: String(query.status) as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'SCHEDULED' }
      : {}),
    ...(query.type
      ? { type: String(query.type) as 'EMAIL' | 'SMS' | 'MULTI_CHANNEL' }
      : {}),
    ...(query.search
      ? { name: { contains: String(query.search), mode: 'insensitive' as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.campaign.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.campaign.count({ where }),
  ]);

  return paginate(data, total, { page, limit });
}

export async function getCampaignById(id: string, tenantId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { campaignContacts: true } } },
  });
  if (!campaign) throw new NotFoundError('Campaign');
  return campaign;
}

export async function createCampaign(
  tenantId: string,
  userId: string,
  dto: CreateCampaignDto,
) {
  const campaign = await prisma.campaign.create({
    data: {
      tenantId,
      name: dto.name,
      type: dto.type,
      status: 'DRAFT',
      subject: dto.subject ?? null,
      body: dto.body ?? null,
      targetAudienceId: dto.targetAudienceId ?? null,
      emailTemplateId: dto.emailTemplateId ?? null,
      smsTemplateId: dto.smsTemplateId ?? null,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'campaign.created',
    entityType: 'Campaign',
    entityId: campaign.id,
    after: { name: campaign.name, type: campaign.type },
  });

  return campaign;
}

export async function updateCampaign(
  id: string,
  tenantId: string,
  userId: string,
  dto: UpdateCampaignDto,
) {
  const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Campaign');

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.subject !== undefined && { subject: dto.subject }),
      ...(dto.body !== undefined && { body: dto.body }),
      ...(dto.targetAudienceId !== undefined && { targetAudienceId: dto.targetAudienceId }),
      ...(dto.scheduledFor !== undefined && {
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
      }),
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'campaign.updated',
    entityType: 'Campaign',
    entityId: id,
    before: { name: existing.name, status: existing.status },
    after: { name: campaign.name, status: campaign.status },
  });

  return campaign;
}

// ── Send ───────────────────────────────────────────────────────────────────────

export async function sendCampaign(id: string, tenantId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, tenantId },
    include: {
      campaignContacts: {
        include: { lead: true, customer: true },
      },
      targetAudience: { include: { conditions: true } },
      emailTemplate: true,
      smsTemplate: true,
    },
  });
  if (!campaign) throw new NotFoundError('Campaign');

  // --- Resolve recipients ---
  // Prefer explicit CampaignContact records; fall back to resolving from TargetAudience.
  let contacts: ContactRecord[] = campaign.campaignContacts
    .map((cc) => {
      if (cc.lead) {
        return {
          id: cc.lead.id,
          email: cc.lead.email,
          phone: cc.lead.phone,
          firstName: cc.lead.firstName || '',
          lastName: cc.lead.lastName || '',
          companyName: cc.lead.companyName,
          status: cc.lead.status,
          _type: 'lead' as const,
        };
      }
      if (cc.customer) {
        return {
          id: cc.customer.id,
          email: cc.customer.email,
          phone: cc.customer.phone,
          firstName: cc.customer.firstName || '',
          lastName: cc.customer.lastName || '',
          companyName: cc.customer.companyName ?? null,
          status: cc.customer.status,
          _type: 'customer' as const,
        };
      }
      return null;
    })
    .filter((c): c is Exclude<typeof c, null> => c !== null);

  if (contacts.length === 0 && campaign.targetAudienceId && campaign.targetAudience) {
    contacts = await resolveAudienceContacts(tenantId, campaign.targetAudience.conditions);

    // Persist CampaignContact rows so per-contact delivery tracking works.
    if (contacts.length > 0) {
      await prisma.campaignContact.createMany({
        data: contacts.map((c) => ({
          tenantId,
          campaignId: id,
          // Correctly discriminate by the _type flag, not by heuristic status check.
          leadId: c._type === 'lead' ? c.id : null,
          customerId: c._type === 'customer' ? c.id : null,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (contacts.length === 0) {
    throw new Error('No recipients found for this campaign');
  }

  // --- Resolve content ---
  const subject = campaign.subject ?? campaign.emailTemplate?.subject ?? '';
  const htmlBody = campaign.body ?? campaign.emailTemplate?.content ?? '';
  const smsBody = campaign.body ?? campaign.smsTemplate?.content ?? '';

  let sentCount = 0;

  if (campaign.type === 'EMAIL') {
    const recipients = contacts
      .filter((c) => c.email !== null)
      .map((c) => ({
        email: c.email as string,
        leadId: c._type === 'lead' ? c.id : undefined,
        subject: replaceVariables(subject, c),
        htmlBody: replaceVariables(htmlBody, c),
      }));

    const result = await gmailService.sendBulkEmail(tenantId, userId, id, recipients, {
      mode: 'sequential',
      delayMs: 2000, // 2-second delay for production safety
    });
    sentCount = result.sent;
  } else if (campaign.type === 'SMS') {
    const recipients = contacts
      .filter((c) => c.phone !== null)
      .map((c) => ({
        phone: c.phone as string,
        leadId: c._type === 'lead' ? c.id : undefined,
        message: replaceVariables(smsBody, c),
      }));

    const result = await smsService.sendBulkSms(tenantId, userId, id, recipients);
    sentCount = result.queued;
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: 'ACTIVE', sentCount, sentAt: new Date() },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'campaign.sent',
    entityType: 'Campaign',
    entityId: id,
    after: { sentCount, type: campaign.type },
  });

  return updated;
}

// ── Archive ────────────────────────────────────────────────────────────────────

export async function archiveCampaign(id: string, tenantId: string, userId: string) {
  const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Campaign');

  await prisma.campaign.update({
    where: { id },
    data: { isArchived: true, status: 'COMPLETED' },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'campaign.archived',
    entityType: 'Campaign',
    entityId: id,
    before: { name: existing.name },
  });
}
