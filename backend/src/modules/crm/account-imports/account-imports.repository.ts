import prisma from '../../../config/database.config';

export async function createImport(
  tenantId: string,
  createdById: string,
  data: { fileName: string; totalRecords: number },
) {
  return prisma.accountImport.create({
    data: {
      tenantId,
      createdById,
      fileName: data.fileName,
      totalRecords: data.totalRecords,
      status: 'importing',
    },
  });
}

export async function createImportResults(
  results: Array<{
    importId: string;
    rowNumber: number;
    status: string;
    accountId?: string;
    remarks?: string;
    name?: string;
    industry?: string;
    website?: string;
    address?: string;
    city?: string;
    province?: string;
    country?: string;
  }>,
) {
  return prisma.accountImportResult.createMany({ data: results });
}

export async function updateImportStatus(
  id: string,
  tenantId: string,
  data: {
    status: string;
    successfulRecords: number;
    failedRecords: number;
    completedAt?: Date;
  },
) {
  return prisma.accountImport.update({
    where: { id, tenantId },
    data,
  });
}

export async function findImportById(id: string, tenantId: string) {
  return prisma.accountImport.findFirst({
    where: { id, tenantId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function findImports(
  tenantId: string,
  query: { page: number; limit: number },
) {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.accountImport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.accountImport.count({ where: { tenantId } }),
  ]);

  return { data, total, page, limit };
}

export async function findImportResults(
  importId: string,
  tenantId: string,
  query: { page: number; limit: number; status?: string },
) {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const importRecord = await prisma.accountImport.findFirst({
    where: { id: importId, tenantId },
    select: { id: true },
  });
  if (!importRecord) return null;

  const where: Record<string, unknown> = { importId };
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.accountImportResult.findMany({
      where,
      orderBy: { rowNumber: 'asc' },
      skip,
      take: limit,
    }),
    prisma.accountImportResult.count({ where }),
  ]);

  return { data, total, page, limit };
}
