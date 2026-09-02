import * as repo from './contact-imports.repository';
import { ImportContactRowSchema, CreateContactImportDto } from './contact-imports.dto';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import prisma from '../../../config/database.config';
import { paginate } from '../../../shared/helpers/pagination';

/**
 * Process a contact import: validate each row, create valid contacts in the Customer table, record results.
 */
export async function processImport(tenantId: string, userId: string, dto: CreateContactImportDto) {
  const importRecord = await repo.createImport(tenantId, userId, { fileName: dto.fileName, totalRecords: dto.rows.length });

  let successCount = 0;
  let failCount = 0;
  const results: Array<{
    importId: string; rowNumber: number; status: string; contactId?: string; remarks?: string;
    firstName?: string; lastName?: string; email?: string; phone?: string; companyName?: string; address?: string;
  }> = [];

  for (const row of dto.rows) {
    const { rowNumber, ...rowData } = row;
    const validation = ImportContactRowSchema.safeParse(rowData);

    if (!validation.success) {
      failCount++;
      results.push({
        importId: importRecord.id, rowNumber, status: 'failed',
        remarks: validation.error.errors.map((e) => e.message).join('; '),
        firstName: rowData.firstName || undefined, lastName: rowData.lastName || undefined,
        email: rowData.email || undefined, phone: rowData.phone || undefined,
        companyName: rowData.companyName || undefined, address: rowData.address || undefined,
      });
      continue;
    }

    // Check duplicate by email in Contact table
    const existing = await prisma.contact.findFirst({
      where: { tenantId, email: validation.data.email },
      select: { id: true },
    });

    if (existing) {
      failCount++;
      results.push({
        importId: importRecord.id, rowNumber, status: 'failed',
        remarks: 'A contact with this email already exists.',
        firstName: validation.data.firstName, lastName: validation.data.lastName,
        email: validation.data.email, phone: validation.data.phone,
        companyName: validation.data.companyName, address: validation.data.address,
      });
      continue;
    }

    try {
      // Create in Contact table
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          firstName: validation.data.firstName,
          lastName: validation.data.lastName,
          email: validation.data.email,
          phone: validation.data.phone,
          // DB column is "company", not "companyName"
          company: validation.data.companyName,
          address: validation.data.address,
          // ContactStatus enum — WARM is the DB default
          status: 'WARM',
        } as never,
      });

      successCount++;
      results.push({
        importId: importRecord.id, rowNumber, status: 'imported', contactId: contact.id,
        firstName: validation.data.firstName, lastName: validation.data.lastName,
        email: validation.data.email, phone: validation.data.phone,
        companyName: validation.data.companyName, address: validation.data.address,
      });
    } catch (err) {
      failCount++;
      results.push({
        importId: importRecord.id, rowNumber, status: 'failed',
        remarks: err instanceof Error ? err.message : 'Unexpected database error',
        firstName: validation.data.firstName, lastName: validation.data.lastName,
        email: validation.data.email, phone: validation.data.phone,
        companyName: validation.data.companyName, address: validation.data.address,
      });
    }
  }

  if (results.length > 0) await repo.createImportResults(results);

  const finalStatus = failCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'completed_with_errors';

  await repo.updateImportStatus(importRecord.id, tenantId, {
    status: finalStatus, successfulRecords: successCount, failedRecords: failCount, completedAt: new Date(),
  });

  await writeAuditLog({
    tenantId, userId, action: 'contacts.import', entityType: 'ContactImport', entityId: importRecord.id,
    after: { fileName: dto.fileName, totalRecords: dto.rows.length, successfulRecords: successCount, failedRecords: failCount, status: finalStatus },
  });

  return {
    id: importRecord.id, fileName: dto.fileName, totalRecords: dto.rows.length,
    successfulRecords: successCount, failedRecords: failCount, status: finalStatus,
    createdAt: importRecord.createdAt, completedAt: new Date(),
  };
}

export async function getImportById(id: string, tenantId: string) {
  const record = await repo.findImportById(id, tenantId);
  if (!record) throw new NotFoundError('ContactImport');
  return record;
}

export async function listImports(tenantId: string, query: { page: number; limit: number }) {
  const result = await repo.findImports(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function listImportResults(importId: string, tenantId: string, query: { page: number; limit: number; status?: string }) {
  const result = await repo.findImportResults(importId, tenantId, query);
  if (!result) throw new NotFoundError('ContactImport');
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}
