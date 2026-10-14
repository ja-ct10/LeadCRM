import { readCsvSource, saveCsvChunk, releaseCsvSource, sourceDigest } from './import-upload.service';
import { createHash } from 'node:crypto';
import { CreateCrmImportSchema, mapImportCsv, type CrmImportModule, type CreateCrmImportInput, type ImportReviewRow } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { paginate } from '../../../shared/helpers/pagination';
import { salesTransaction } from '../leads/lead-automation.service';
import { createImportRow, csvRowValidator, importValidationErrors, type MappedRow } from './import-rows.service';
import { importStore, type ImportQuery } from './imports.repository';
import type { Prisma } from '@prisma/client';

async function prepare(module: CrmImportModule, tenantId: string, actorId: string, input: CreateCrmImportInput) {
  const dto = CreateCrmImportSchema.parse(input);
  const csvText = await readCsvSource(tenantId, actorId, module, dto);
  try { return { dto, rows: mapImportCsv(module, { ...dto, csvText }) }; }
  catch (error) { throw new ValidationError(error instanceof Error ? error.message : 'Invalid CSV.'); }
}

async function requestIdentity(module: CrmImportModule, tenantId: string, actorId: string, input: CreateCrmImportInput) {
  const dto = CreateCrmImportSchema.parse(input);
  const previous = await importStore(prisma, module, tenantId).findKey(dto.idempotencyKey);
  // A completed, actor-bound receipt retains the original immutable upload reference.
  // Bare keys and historical jobs without source evidence still require the source.
  const retainedDigest = previous?.completedAt && previous.createdById === actorId && dto.csvText === undefined && previous.sourceReference === dto.uploadId ? previous.sourceDigest : null;
  const digest = retainedDigest ?? await sourceDigest(tenantId, actorId, module, dto);
  const mappings = Object.entries(dto.mappings).sort(([a], [b]) => a.localeCompare(b));
  return { dto, digest, requestHash: createHash('sha256').update(JSON.stringify([actorId, dto.fileName, mappings, digest])).digest('hex') };
}

export function moduleImportService(module: CrmImportModule) {
  const storeFor = (tenantId: string) => importStore(prisma, module, tenantId);
  return {
    uploadCsv: (tenantId: string, actorId: string, input: unknown) => saveCsvChunk(tenantId, actorId, module, input),
    async previewImport(tenantId: string, actorId: string, input: CreateCrmImportInput, offset = 0): Promise<ImportReviewRow[]> {
      const { rows } = await prepare(module, tenantId, actorId, input), validate = csvRowValidator(module, tenantId, rows);
      const result: ImportReviewRow[] = [];
      for (const raw of rows.slice(offset, offset + 25)) {
        const { products, ...review } = await validate(prisma, raw);
        result.push(review);
      }
      return result;
    },
    async getRequestImport(tenantId: string, actorId: string, input: CreateCrmImportInput) {
      const { dto, requestHash, digest } = await requestIdentity(module, tenantId, actorId, input);
      const job = await storeFor(tenantId).findKey(dto.idempotencyKey);
      if (job && job.requestHash !== requestHash) throw new ConflictError('This import key belongs to a different request. Start a New import.');
      return job;
    },
    async processImport(tenantId: string, actorId: string, input: CreateCrmImportInput) {
      const { dto, requestHash, digest } = await requestIdentity(module, tenantId, actorId, input);
      const existing = await storeFor(tenantId).findKey(dto.idempotencyKey);
      if (existing && existing.requestHash !== requestHash) throw new ConflictError('This import key belongs to a different request. Start a New import.');
      if (existing?.completedAt) { await releaseCsvSource(tenantId, actorId, module, dto.uploadId); return existing; }
      const { rows } = await prepare(module, tenantId, actorId, input);
      const job = await salesTransaction(async tx => {
        const db = importStore(tx, module, tenantId);
        const previous = await db.findKey(dto.idempotencyKey);
        if (previous) {
          if (previous.requestHash !== requestHash) throw new ConflictError('This import key belongs to a different request. Start a New import to change the file or mapping.');
          return previous;
        }
        return db.create({ createdById: actorId, fileName: dto.fileName, totalRecords: rows.length,
          idempotencyKey: dto.idempotencyKey, requestHash, sourceDigest: digest, sourceReference: dto.uploadId, status: 'importing', uploadId: dto.uploadId });
      });
      if (job.completedAt) { await releaseCsvSource(tenantId, actorId, module, dto.uploadId); return job; }
      const validate = csvRowValidator(module, tenantId, rows, async (tx, rowNumber) =>
        (await importStore(tx, module, tenantId).row(job.id, rowNumber))?.status === 'failed');
      const committed = new Set((await storeFor(tenantId).rows(job.id)).map(r => r.rowNumber));
      const saveOutcome = async (tx: Prisma.TransactionClient, raw: MappedRow, status: string, errors: string[], entityId?: string) => {
        const db = importStore(tx, module, tenantId);
        await db.save({ importId: job.id, rowNumber: raw.rowNumber, entityId, status,
          remarks: errors.length ? `Row ${raw.rowNumber}: ${errors.join('; ')}` : undefined,
          data: raw.data,
        });
        // The record, its required side effects, result, and progress share one commit.
        const outcomes = await db.rows(job.id);
        const successfulRecords = outcomes.filter(r => r.status === 'imported').length;
        const failedRecords = outcomes.filter(r => r.status === 'failed').length;
        const duplicateRecords = outcomes.filter(r => r.status === 'duplicate').length;
        const done = outcomes.length === rows.length;
        const jobStatus = !done ? 'importing' : failedRecords + duplicateRecords === 0 ? 'completed' : successfulRecords ? 'completed_with_errors' : 'failed';
        await db.update(job.id, { successfulRecords, failedRecords, duplicateRecords, status: jobStatus, completedAt: done ? new Date() : null });
        if (done) await tx.auditLog.create({ data: { tenantId, userId: actorId, action: `${module}.import`, entityType: 'CrmImportJob', entityId: job.id,
          metadata: { module, totalRecords: rows.length, successfulRecords, failedRecords, duplicateRecords, status: jobStatus } } });
      };
      // Bounded, resumable requests avoid holding one transaction or HTTP request for 5000 rows.
      for (const raw of rows.filter(r => !committed.has(r.rowNumber)).slice(0, 25)) {
        try {
          await salesTransaction(async tx => {
            if (await importStore(tx, module, tenantId).row(job.id, raw.rowNumber)) return;
            const review = await validate(tx, raw);
            const entityId = review.isValid ? await createImportRow(tx, module, tenantId, actorId, job.id, review) : undefined;
            await saveOutcome(tx, raw, review.isValid ? 'imported' : review.status === 'duplicate' ? 'duplicate' : 'failed', review.errors, entityId);
          });
        } catch (error) {
          const errors = importValidationErrors(error);
          // Infrastructure failures keep the original job resumable, with committed progress intact.
          if (!errors) throw error;
          // Creation may have written relationships before rejecting the row. Roll back first.
          await salesTransaction(async tx => {
            if (!await importStore(tx, module, tenantId).row(job.id, raw.rowNumber)) await saveOutcome(tx, raw, 'failed', errors);
          });
        }
      }
      const result = (await storeFor(tenantId).find(job.id))!;
      if (result.completedAt) await releaseCsvSource(tenantId, actorId, module, dto.uploadId);
      return result;
    },
    async getImportById(id: string, tenantId: string) {
      const record = await storeFor(tenantId).find(id);
      if (!record) throw new NotFoundError('Import');
      return record;
    },
    async listImports(tenantId: string, query: ImportQuery) {
      const [data, total] = await Promise.all([storeFor(tenantId).list(query), storeFor(tenantId).count(query.status)]);
      return paginate(data, total, query);
    },
    async listImportResults(id: string, tenantId: string, query: ImportQuery) {
      if (!await storeFor(tenantId).find(id)) throw new NotFoundError('Import');
      const [rows, total] = await Promise.all([storeFor(tenantId).results(id, query), storeFor(tenantId).countResults(id, query.status)]);
      const recordKey = { leads: 'leadId', contacts: 'contactId', accounts: 'accountId' }[module];
      // Preserve module API aliases while keeping one relational result contract.
      const data = rows.map(row => ({ ...(row.data as Record<string, unknown>), ...row,
        importId: row.importJobId, [recordKey]: row.recordId,
      }));
      return paginate(data, total, query);
    },
  };
}
