import prisma from '../../../config/database.config';

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createImport(
  tenantId: string,
  createdById: string,
  data: { fileName: string; totalRecords: number },
) {
  return prisma.leadImport.create({
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
    leadId?: string;
    remarks?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    address?: string;
  }>,
) {
  return prisma.leadImportResult.createMany({ data: results });
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

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
  return prisma.leadImport.update({
    where: { id, tenantId },
    data,
  });
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function findImportById(id: string, tenantId: string) {
  return prisma.leadImport.findFirst({
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
    prisma.leadImport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.leadImport.count({ where: { tenantId } }),
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

  // Verify import belongs to tenant
  const importRecord = await prisma.leadImport.findFirst({
    where: { id: importId, tenantId },
    select: { id: true },
  });
  if (!importRecord) return null;

  const where: Record<string, unknown> = { importId };
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.leadImportResult.findMany({
      where,
      orderBy: { rowNumber: 'asc' },
      skip,
      take: limit,
    }),
    prisma.leadImportResult.count({ where }),
  ]);

  return { data, total, page, limit };
}
