import prisma from '../../../config/database.config';
import type { Prisma } from '@prisma/client';
import { createDeal } from '../deals/deals.repository';
import type { CreateDealDto } from '../deals/deals.dto';

export const createImport = (tenantId: string, createdById: string, fileName: string, totalRecords: number) =>
  prisma.dealImport.create({ data: { tenantId, createdById, fileName, totalRecords, status: 'importing' } });
export const findImport = (id: string, tenantId: string) => prisma.dealImport.findFirst({ where: { id, tenantId }, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } });
export const finishImport = (id: string, tenantId: string, successfulRecords: number, failedRecords: number, status: string) =>
  prisma.dealImport.update({ where: { id, tenantId }, data: { successfulRecords, failedRecords, status, completedAt: new Date() } });

export async function saveRow(tenantId: string, actorId: string, result: { importId: string; rowNumber: number; data: Prisma.InputJsonObject; remarks?: string }, dto?: CreateDealDto) {
  // Each deal, its relationships, and its successful result commit together.
  return prisma.$transaction(async tx => {
    const deal = dto ? await createDeal(tenantId, actorId, dto, tx) : null;
    return tx.dealImportResult.create({ data: { ...result, status: deal ? 'imported' : 'failed', dealId: deal?.id } });
  });
}

export async function listImports(tenantId: string, page: number, limit: number) {
  const [data, total] = await Promise.all([
    prisma.dealImport.findMany({ where: { tenantId }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.dealImport.count({ where: { tenantId } }),
  ]);
  return { data, total };
}
export async function listResults(importId: string, page: number, limit: number, status?: string) {
  const where = { importId, ...(status ? { status } : {}) };
  const [data, total] = await Promise.all([
    prisma.dealImportResult.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { rowNumber: 'asc' } }),
    prisma.dealImportResult.count({ where }),
  ]);
  return { data: data.map(row => ({ ...(row.data as Record<string, string>), ...row })), total };
}

export const findPipelines = (tenantId: string, value: string) => prisma.pipeline.findMany({ where: { tenantId, isArchived: false, OR: [{ id: value }, { name: value }] }, take: 2 });
export const findStages = (tenantId: string, pipelineId: string, value: string) => prisma.stage.findMany({ where: { tenantId, pipelineId, OR: [{ id: value }, { name: value }] }, take: 2 });
export const findAccounts = (tenantId: string, value: string) => prisma.account.findMany({ where: { tenantId, isArchived: false, OR: [{ id: value }, { name: value }] }, take: 2 });
export const findContacts = (tenantId: string, value: string) => prisma.contact.findMany({ where: { tenantId, isArchived: false, OR: [{ id: value }, { email: value }] }, take: 2 });
export const findUsers = (tenantId: string, value: string) => prisma.user.findMany({ where: { tenantId, status: 'ACTIVE', OR: [{ id: value }, { email: value }] }, take: 2 });
