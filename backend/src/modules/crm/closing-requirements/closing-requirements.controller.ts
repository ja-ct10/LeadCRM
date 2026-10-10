import type { Request, Response, NextFunction } from 'express';
import * as service from './closing-requirements.service';
import { getFieldLayout, updateFieldLayout, FieldModuleSchema } from './field-layout.service';

const handle = (action: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await action(req) }); } catch (error) { next(error); }
};
export const list = handle(req => service.listFields(req.user!.tenantId));
export const create = handle(req => service.saveField(req.user!.tenantId, req.user!.userId, req.body));
export const edit = handle(req => service.saveField(req.user!.tenantId, req.user!.userId, req.body, String(req.params.id)));
export const remove = handle(req => service.deleteField(req.user!.tenantId, req.user!.userId, String(req.params.id)));
export const layout = handle(req => getFieldLayout(req.user!.tenantId, FieldModuleSchema.parse(req.params.module)));
export const saveLayout = handle(req => updateFieldLayout(req.user!.tenantId, req.user!.userId, FieldModuleSchema.parse(req.params.module), req.body));
export const readValues = handle(req => service.getRequirements(req.user!.tenantId, String(req.params.id)));
export const saveValues = handle(req => service.saveValues(req.user!.tenantId, req.user!.userId, String(req.params.id), req.body));
