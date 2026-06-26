import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';

export async function getCampaigns(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;
  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.status ? { status: String(query.status) as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'SCHEDULED' } : {}),
    ...(query.type   ? { type:   String(query.type)   as 'EMAIL' | 'SMS' | 'MULTI_CHANNEL' } : {}),
    ...(query.search ? { name:   { contains: String(query.search), mode: 'insensitive' as const } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.campaign.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.campaign.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getCampaignById(id: string, tenantId: string) {
  const c = await prisma.campaign.findFirst({ where: { id, tenantId }, include: { _count: { select: { campaignContacts: true } } } });
  if (!c) throw new NotFoundError('Campaign');
  return c;
}

export async function createCampaign(tenantId: string, userId: string, dto: Record<string, unknown>) {
  const campaign = await prisma.campaign.create({ data: { ...dto, tenantId } as never });
  await writeAuditLog({ tenantId, userId, action: 'campaign.created', entityType: 'Campaign', entityId: campaign.id });
  return campaign;
}

export async function updateCampaign(id: string, tenantId: string, userId: string, dto: Record<string, unknown>) {
  const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Campaign');
  const campaign = await prisma.campaign.update({ where: { id }, data: dto as never });
  await writeAuditLog({ tenantId, userId, action: 'campaign.updated', entityType: 'Campaign', entityId: id });
  return campaign;
}

export async function sendCampaign(id: string, tenantId: string, userId: string) {
  const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Campaign');
  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status: 'ACTIVE', sentAt: new Date() },
  });
  await writeAuditLog({ tenantId, userId, action: 'campaign.sent', entityType: 'Campaign', entityId: id, after: { sentAt: new Date() } });
  return campaign;
}

export async function archiveCampaign(id: string, tenantId: string, userId: string) {
  const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Campaign');
  await prisma.campaign.update({ where: { id }, data: { isArchived: true, status: 'COMPLETED' } });
  await writeAuditLog({ tenantId, userId, action: 'campaign.archived', entityType: 'Campaign', entityId: id });
}
