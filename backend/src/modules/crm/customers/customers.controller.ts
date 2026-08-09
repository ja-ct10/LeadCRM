import { Request, Response, NextFunction } from 'express';
import * as service from './customers.service';

// Controller — HTTP handlers only. No business logic here.

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getCustomers(
      req.user!.tenantId,
      req.query as Record<string, unknown>,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const customer = await service.getCustomerById(id, req.user!.tenantId);
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await service.createCustomer(
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const customer = await service.updateCustomer(
      id,
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function archiveCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    await service.archiveCustomer(id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function convertCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const result = await service.convertCustomer(id, req.user!.tenantId, req.user!.userId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
