import { Router, raw } from 'express';
import { authorize } from '../../../api/middleware/rbac.middleware';
import { listFiles, uploadFile, downloadFile, listEmailAttachments } from './record-files.service';
import { RecordEmailAttachmentContextSchema, CRM_FILE_SIZE_ERROR, RECORD_FILE_MAX_BYTES } from '@leadcrm/shared';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/app-error';

export const recordFilesRouter = Router();
const fileBody = raw({ type: 'application/octet-stream', limit: RECORD_FILE_MAX_BYTES });
const crmFileBody: import('express').RequestHandler = (req, res, next) => fileBody(req, res, error =>
  next(error?.type === 'entity.too.large' ? new AppError(CRM_FILE_SIZE_ERROR, 413) : error));
// Mounted inside authenticated CRM routes; permissions run before the binary parser.
for (const module of ['leads', 'contacts', 'accounts', 'deals'] as const) {
  const permission = module;
  if (module !== 'accounts') recordFilesRouter.get(`/${module}/:id/email-attachments`, authorize(`${permission}.view`), async (req, res, next) => {
    try {
      const context = RecordEmailAttachmentContextSchema.parse({ recordModule: module, recordId: req.params.id });
      const { cursor } = z.object({ cursor: z.string().max(2000).optional() }).strict().parse(req.query);
      res.set('Cache-Control', 'private, no-store').json({ success: true, data: await listEmailAttachments(req.user!.tenantId, req.user!.userId, context, cursor) });
    } catch (error) { next(error); }
  });
  recordFilesRouter.post(`/${module}/custom-field-uploads`, (req, res, next) => authorize(`${permission}.${req.query.recordId === undefined ? 'create' : 'edit'}`)(req, res, next), fileBody, async (req, res, next) => {
    try {
      const recordId = z.string().uuid().optional().parse(req.query.recordId);
      res.status(201).json({ success: true, data: await uploadFile(module, recordId ?? null, req.user!.tenantId, req.user!.userId, req.query, req.body, 'custom-field') });
    } catch (error) { next(error); }
  });
  recordFilesRouter.get(`/${module}/:id/files`, authorize(`${permission}.view`), async (req, res, next) => {
    try { res.json({ success: true, data: await listFiles(module, String(req.params.id), req.user!.tenantId) }); } catch (error) { next(error); }
  });
  recordFilesRouter.post(`/${module}/:id/files`, authorize(`${permission}.edit`), module === 'accounts' ? fileBody : crmFileBody, async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await uploadFile(module, String(req.params.id), req.user!.tenantId, req.user!.userId, req.query, req.body) }); } catch (error) { next(error); }
  });
  recordFilesRouter.get(`/${module}/:id/files/:fileId/download`, authorize(`${permission}.view`), async (req, res, next) => {
    try {
      const file = await downloadFile(module, String(req.params.id), req.user!.tenantId, String(req.params.fileId));
      res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(file.bytes);
    } catch (error) { next(error); }
  });
}
