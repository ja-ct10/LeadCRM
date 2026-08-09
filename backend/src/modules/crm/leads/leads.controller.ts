import { Request, Response, NextFunction } from 'express';
import * as service from './leads.service';

// Controller — HTTP handlers only. No business logic here.

export async function getLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getLeads(
      req.user!.tenantId,
      req.query as Record<string, unknown>,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getLeadById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const lead = await service.getLeadById(id, req.user!.tenantId);
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

export async function createLead(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await service.createLead(
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const lead = await service.updateLead(
      id,
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

export async function archiveLead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    await service.archiveLead(id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function convertLead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const result = await service.convertLead(id, req.user!.tenantId, req.user!.userId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
