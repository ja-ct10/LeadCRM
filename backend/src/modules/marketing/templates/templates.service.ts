import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';

export async function getTemplates(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;
  const where = { tenantId, isArchived: query.archived === 'true',
    ...(query.type   ? { type:   String(query.type) }   : {}),
    ...(query.search ? { name:   { contains: String(query.search), mode: 'insensitive' as const } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.template.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.template.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getTemplateById(id: string, tenantId: string) {
  const t = await prisma.template.findFirst({ where: { id, tenantId } });
  if (!t) throw new NotFoundError('Template');
  return t;
}

export async function createTemplate(tenantId: string, userId: string, dto: Record<string, unknown>) {
  const template = await prisma.template.create({ data: { ...dto, tenantId } as never });
  await writeAuditLog({ tenantId, userId, action: 'template.created', entityType: 'Template', entityId: template.id });
  return template;
}

export async function updateTemplate(id: string, tenantId: string, userId: string, dto: Record<string, unknown>) {
  const existing = await prisma.template.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Template');
  const template = await prisma.template.update({ where: { id }, data: dto as never });
  await writeAuditLog({ tenantId, userId, action: 'template.updated', entityType: 'Template', entityId: id });
  return template;
}

export async function archiveTemplate(id: string, tenantId: string, userId: string) {
  const existing = await prisma.template.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Template');
  await prisma.template.update({ where: { id }, data: { isArchived: true } });
  await writeAuditLog({ tenantId, userId, action: 'template.archived', entityType: 'Template', entityId: id });
}
