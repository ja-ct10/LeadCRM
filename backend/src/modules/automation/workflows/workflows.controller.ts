import { Request, Response, NextFunction } from 'express';
import * as service from './workflows.service';
export async function getOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getOptions(req.user!.tenantId, req.user!.userId) }); }
  catch (err) { next(err); }
}

export async function validateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.validateDraft(req.user!.tenantId, req.user!.userId, req.body) }); }
  catch (err) { next(err); }
}
export async function getExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getExecution(String(req.params.executionId), String(req.params.id), req.user!.tenantId) }); }
  catch (err) { next(err); }
}

export async function getWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, ...await service.getWorkflows(req.user!.tenantId, req.query as Record<string, unknown>) });
  } catch (err) { next(err); }
}

export async function getWorkflowById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getWorkflowById(String(req.params.id), req.user!.tenantId) });
  } catch (err) { next(err); }
}

export async function createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const w = await service.createWorkflow(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: w });
  } catch (err) { next(err); }
}

export async function updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.updateWorkflow(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body) });
  } catch (err) { next(err); }
}

export async function toggleWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.toggleWorkflow(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body.isActive) });
  } catch (err) { next(err); }
}

export async function archiveWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.archiveWorkflow(String(req.params.id), req.user!.tenantId, req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getWorkflowExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestedPage = Number(req.query.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    res.json({ success: true, data: await service.getWorkflowExecutions(String(req.params.id), req.user!.tenantId, page) });
  } catch (err) { next(err); }
}

export async function testWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.testWorkflow(String(req.params.id), req.user!.tenantId, req.body.entityId) });
  } catch (err) { next(err); }
}
