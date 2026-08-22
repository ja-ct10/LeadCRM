import * as repo from './account-imports.repository';
import { ImportAccountRowSchema, CreateAccountImportDto } from './account-imports.dto';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import prisma from '../../../config/database.config';
import { paginate } from '../../../shared/helpers/pagination';

/**
 * Process an account import: validate each row, create valid accounts, record results.
 */
export async function processImport(
  tenantId: string,
  userId: string,
  dto: CreateAccountImportDto,
) {
  const importRecord = await repo.createImport(tenantId, userId, {
    fileName: dto.fileName,
    totalRecords: dto.rows.length,
  });

  let successCount = 0;
  let failCount = 0;
  const results: Array<{
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
  }> = [];

  for (const row of dto.rows) {
    const { rowNumber, ...rowData } = row;

    const validation = ImportAccountRowSchema.safeParse(rowData);

    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join('; ');
      failCount++;
      results.push({
        importId: importRecord.id,
        rowNumber,
        status: 'failed',
        remarks: errors,
        name: rowData.name || undefined,
        industry: rowData.industry || undefined,
        website: rowData.website || undefined,
        address: rowData.address || undefined,
        city: rowData.city || undefined,
        province: rowData.province || undefined,
        country: rowData.country || undefined,
      });
      continue;
    }

    // Check for duplicate name within tenant
    const existing = await prisma.account.findFirst({
      where: { tenantId, name: validation.data.name, isArchived: false },
      select: { id: true },
    });

    if (existing) {
      failCount++;
      results.push({
        importId: importRecord.id,
        rowNumber,
        status: 'failed',
        remarks: 'An account with this name already exists.',
        name: validation.data.name,
        industry: validation.data.industry || undefined,
        website: validation.data.website || undefined,
        address: validation.data.address || undefined,
        city: validation.data.city || undefined,
        province: validation.data.province || undefined,
        country: validation.data.country || undefined,
      });
      continue;
    }

    try {
      const account = await prisma.account.create({
        data: {
          tenantId,
          name: validation.data.name,
          industry: validation.data.industry || undefined,
          website: validation.data.website || undefined,
          address: validation.data.address || undefined,
          city: validation.data.city || undefined,
          province: validation.data.province || undefined,
          country: validation.data.country || 'Philippines',
        },
      });

      successCount++;
      results.push({
        importId: importRecord.id,
        rowNumber,
        status: 'imported',
        accountId: account.id,
        name: validation.data.name,
        industry: validation.data.industry || undefined,
        website: validation.data.website || undefined,
        address: validation.data.address || undefined,
        city: validation.data.city || undefined,
        province: validation.data.province || undefined,
        country: validation.data.country || undefined,
      });
    } catch (err) {
      failCount++;
      const message = err instanceof Error ? err.message : 'Unexpected database error';
      results.push({
        importId: importRecord.id,
        rowNumber,
        status: 'failed',
        remarks: message,
        name: validation.data.name,
        industry: validation.data.industry || undefined,
        website: validation.data.website || undefined,
        address: validation.data.address || undefined,
        city: validation.data.city || undefined,
        province: validation.data.province || undefined,
        country: validation.data.country || undefined,
      });
    }
  }

  if (results.length > 0) {
    await repo.createImportResults(results);
  }

  const finalStatus =
    failCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'completed_with_errors';

  await repo.updateImportStatus(importRecord.id, tenantId, {
    status: finalStatus,
    successfulRecords: successCount,
    failedRecords: failCount,
    completedAt: new Date(),
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'accounts.import',
    entityType: 'AccountImport',
    entityId: importRecord.id,
    after: {
      fileName: dto.fileName,
      totalRecords: dto.rows.length,
      successfulRecords: successCount,
      failedRecords: failCount,
      status: finalStatus,
    },
  });

  return {
    id: importRecord.id,
    fileName: dto.fileName,
    totalRecords: dto.rows.length,
    successfulRecords: successCount,
    failedRecords: failCount,
    status: finalStatus,
    createdAt: importRecord.createdAt,
    completedAt: new Date(),
  };
}

export async function getImportById(id: string, tenantId: string) {
  const record = await repo.findImportById(id, tenantId);
  if (!record) throw new NotFoundError('AccountImport');
  return record;
}

export async function listImports(
  tenantId: string,
  query: { page: number; limit: number },
) {
  const result = await repo.findImports(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function listImportResults(
  importId: string,
  tenantId: string,
  query: { page: number; limit: number; status?: string },
) {
  const result = await repo.findImportResults(importId, tenantId, query);
  if (!result) throw new NotFoundError('AccountImport');
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}
