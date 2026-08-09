import { Request, Response, NextFunction } from 'express';
import * as gmailService from './gmail.service';

export async function sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, subject, htmlBody, leadId, campaignId } = req.body;
    if (!to || !subject || !htmlBody) {
      res.status(400).json({ success: false, error: 'Missing required fields: to, subject, htmlBody' });
      return;
    }

    const result = await gmailService.sendEmail(
      req.user!.tenantId,
      req.user!.userId,
      { to, subject, htmlBody, leadId, campaignId },
    );

    if (result.success) {
      res.json({ success: true, data: { messageId: result.messageId, threadId: result.threadId } });
    } else {
      res.status(422).json({ success: false, error: result.error });
    }
  } catch (e) {
    next(e);
  }
}

export async function sendBulkEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId, recipients } = req.body;
    if (!campaignId || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ success: false, error: 'Missing required fields: campaignId, recipients[]' });
      return;
    }

    const result = await gmailService.sendBulkEmail(
      req.user!.tenantId,
      req.user!.userId,
      campaignId,
      recipients,
    );

    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function getGmailAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url } = gmailService.getAuthUrl(req.user!.tenantId, req.user!.userId);
    res.json({ success: true, data: { url } });
  } catch (e) {
    next(e);
  }
}

export async function handleGmailCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).json({ success: false, error: 'Missing code or state parameter' });
      return;
    }

    const decoded = JSON.parse(Buffer.from(String(state), 'base64url').toString()) as { tenantId: string; userId: string };
    const result = await gmailService.connectGmailAccount(decoded.tenantId, decoded.userId, String(code));

    // Redirect back to frontend settings page
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings/integrations?gmail=connected&email=${encodeURIComponent(result.email)}`);
  } catch (e) {
    next(e);
  }
}

export async function disconnectGmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await gmailService.disconnectGmailAccount(req.user!.tenantId, req.user!.userId);
    res.json({ success: true, message: 'Gmail account disconnected' });
  } catch (e) {
    next(e);
  }
}

export async function getGmailStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await gmailService.getGmailAccountStatus(req.user!.tenantId, req.user!.userId);
    res.json({ success: true, data: status });
  } catch (e) {
    next(e);
  }
}
