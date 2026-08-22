import prisma from '../../../config/database.config';

export async function createImport(
  tenantId: string,
  createdById: string,
  data: { fileName: string; totalRecords: number },
) {
  return prisma.contactImport.create({
    data: { tenantId, createdById, fileName: data.fileName, totalRecords: data.totalRecords, status: 'importing' },
  });
}

export async function createImportResults(
  results: Array<{
    importId: string; rowNumber: number; status: string; contactId?: string; remarks?: string;
    firstName?: string; lastName?: string; email?: string; phone?: string; companyName?: string; address?: string;
  }>,
) {
  return prisma.contactImportResult.createMany({ data: results });
}

export async function updateImportStatus(
  id: string, tenantId: string,
  data: { status: string; successfulRecords: number; failedRecords: number; completedAt?: Date },
) {
  return prisma.contactImport.update({ where: { id, tenantId }, data });
}

export async function findImportById(id: string, tenantId: string) {
  return prisma.contactImport.findFirst({
    where: { id, tenantId },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function findImports(tenantId: string, query: { page: number; limit: number }) {
  const skip = (query.page - 1) * query.limit;
  const [data, total] = await Promise.all([
    prisma.contactImport.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, skip, take: query.limit, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.contactImport.count({ where: { tenantId } }),
  ]);
  return { data, total, page: query.page, limit: query.limit };
}

export async function findImportResults(importId: string, tenantId: string, query: { page: number; limit: number; status?: string }) {
  const skip = (query.page - 1) * query.limit;
  const importRecord = await prisma.contactImport.findFirst({ where: { id: importId, tenantId }, select: { id: true } });
  if (!importRecord) return null;

  const where: Record<string, unknown> = { importId };
  if (query.status) where.status = query.status;

  const [data, total] = await Promise.all([
    prisma.contactImportResult.findMany({ where, orderBy: { rowNumber: 'asc' }, skip, take: query.limit }),
    prisma.contactImportResult.count({ where }),
  ]);
  return { data, total, page: query.page, limit: query.limit };
}
