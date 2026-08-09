import { Request, Response, NextFunction } from 'express';
import * as smsService from './sms-gateway.service';

export async function sendSms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      res.status(400).json({ success: false, error: 'Missing required fields: to, message' });
      return;
    }

    const result = await smsService.sendSingleSms(
      req.user!.tenantId,
      req.user!.userId,
      to,
      message,
    );

    if (result.success) {
      res.json({ success: true, message: 'SMS sent successfully' });
    } else {
      res.status(422).json({ success: false, error: result.error });
    }
  } catch (e) {
    next(e);
  }
}

export async function sendBulkSms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId, recipients } = req.body;
    if (!campaignId || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ success: false, error: 'Missing required fields: campaignId, recipients[]' });
      return;
    }

    const result = await smsService.sendBulkSms(
      req.user!.tenantId,
      req.user!.userId,
      campaignId,
      recipients,
    );

    res.json({ success: true, queued: result.queued, errors: result.errors });
  } catch (e) {
    next(e);
  }
}

export async function getQueueStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = smsService.getQueueStatus(req.user!.tenantId);
    res.json({ success: true, data: status });
  } catch (e) {
    next(e);
  }
}

export async function getQueueItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = smsService.getQueueItems(req.user!.tenantId);
    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
}

export async function stopQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    smsService.stopQueue(req.user!.tenantId);
    res.json({ success: true, message: 'Queue stop signal sent' });
  } catch (e) {
    next(e);
  }
}

export async function clearQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    smsService.clearQueue(req.user!.tenantId);
    res.json({ success: true, message: 'Queue cleared' });
  } catch (e) {
    next(e);
  }
}

export function validateNumber(req: Request, res: Response, _next: NextFunction): void {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ success: false, error: 'Missing phone number' });
    return;
  }
  const result = smsService.validatePhilippineNumber(phone);
  res.json({ success: true, data: result });
}
