import { Request, Response, NextFunction } from 'express';
import * as service from './forms.service';
import { formSourceLinks, sourceLinksPdf } from './source-links.service';
import { z } from 'zod';

export async function sourceLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional().parse(req.query.campaign);
    const manifest = await formSourceLinks(req.user!.tenantId, String(req.params.id), process.env.PUBLIC_FORM_ORIGIN || process.env.APP_URL || 'http://localhost:3000', campaign);
    if (req.path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename="leadcrm-source-links.pdf"');
      const doc = sourceLinksPdf(manifest); doc.pipe(res); doc.end();
    } else res.json(manifest);
  } catch (e) { next(e); }
}

export async function duplicateForm(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ success: true, data: await service.duplicateForm(String(req.params.id), req.user!.tenantId, req.user!.userId) }); } catch (err) { next(err); }
}
export async function getSubmissions(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, ...await service.getSubmissions(String(req.params.id), req.user!.tenantId, req.query as Record<string, unknown>) }); } catch (err) { next(err); }
}

// ─── Controllers ─────────────────────────────────────────────────────────────
// Each controller:
//   1. Extracts inputs from the request (parsed by validate middleware upstream)
//   2. Delegates all business logic to the service layer
//   3. Returns the response envelope — never touches Prisma directly
// ─────────────────────────────────────────────────────────────────────────────

export async function getForms(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.getForms(
      req.user!.tenantId,
      req.query as Record<string, unknown>,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getLeadFormFieldCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getLeadFormFieldCatalog(req.user!.tenantId) }); }
  catch (err) { next(err); }
}

export async function getFormById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const form = await service.getFormById(
      String(req.params.id),
      req.user!.tenantId,
    );
    res.json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
}

export async function createForm(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.body already validated + parsed by validate(CreateFormSchema) middleware
    const form = await service.createForm(
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.status(201).json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
}

export async function updateForm(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.body already validated + parsed by validate(UpdateFormSchema) middleware
    const form = await service.updateForm(
      String(req.params.id),
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
}

export async function publishForm(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const form = await service.publishForm(
      String(req.params.id),
      req.user!.tenantId,
      req.user!.userId,
    );
    res.json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
}

export async function deleteForm(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await service.deleteForm(
      String(req.params.id),
      req.user!.tenantId,
      req.user!.userId,
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function unpublishForm(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await service.unpublishForm(String(req.params.id), req.user!.tenantId, req.user!.userId) }); }
  catch (err) { next(err); }
}
