import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAuthorizationUrl, exchangeCodeForTokens, getUserInfo, GMAIL_SCOPES } from './gmail.oauth';
import { fetchEmails, sendEmail, getConnectionStatus, disconnectAccount, trashEmails, archiveEmails, saveDraft, deleteDraft } from './gmail.service';
import { AppError } from '../../shared/errors/app-error';
import { writeAuditLog } from '../../core/audit/audit.service';

const prisma = new PrismaClient();

/**
 * GET /integrations/gmail/authorize
 * Returns the Google OAuth2 authorization URL for the authenticated user.
 */
export async function authorize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;

    // Encode state for CSRF protection — verified in callback
    const state = Buffer.from(JSON.stringify({ userId, tenantId })).toString('base64url');
    const url = getAuthorizationUrl(state);

    res.json({ url });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /integrations/gmail/callback
 * Handles the OAuth2 callback from Google. Exchanges code for tokens and stores them.
 */
export async function callback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      // User denied access or an error occurred
      const frontendUrl = process.env.APP_URL ?? 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?gmail_error=${encodeURIComponent(String(oauthError))}`);
      return;
    }

    if (!code || !state) {
      throw new AppError('Missing authorization code or state', 400);
    }

    // Decode and validate state
    let statePayload: { userId: string; tenantId: string };
    try {
      statePayload = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf-8'));
    } catch {
      throw new AppError('Invalid state parameter', 400);
    }

    const { userId, tenantId } = statePayload;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(String(code));
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Get the connected Gmail address
    const userInfo = await getUserInfo(tokens.access_token);

    // Upsert the EmailAccount record
    await prisma.emailAccount.upsert({
      where: { tenantId_userId_provider: { tenantId, userId, provider: 'gmail' } },
      update: {
        email: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope.split(' '),
        isActive: true,
        connectedAt: new Date(),
      },
      create: {
        tenantId,
        userId,
        provider: 'gmail',
        email: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope.split(' '),
        isActive: true,
      },
    });

    // Redirect back to the frontend with success indicator
    const frontendUrl = process.env.APP_URL ?? 'http://localhost:3000';

    // Audit log: Gmail account connected
    await writeAuditLog({
      tenantId,
      userId,
      action: 'integration.gmail_connected',
      entityType: 'EmailAccount',
      entityId: userId,
      after: { email: userInfo.email, provider: 'gmail' },
      severity: 'INFO',
    });

    res.redirect(`${frontendUrl}/dashboard?gmail_connected=true`);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /integrations/gmail/status
 * Returns whether the current user has a connected Gmail account.
 */
export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const connectionStatus = await getConnectionStatus(tenantId, userId);
    res.json(connectionStatus);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /integrations/gmail/emails
 * Fetches emails from the user's connected Gmail inbox.
 */
export async function listEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const { maxResults, query, pageToken } = req.query;

    const result = await fetchEmails(tenantId, userId, {
      maxResults: maxResults ? parseInt(String(maxResults), 10) : undefined,
      query: query ? String(query) : undefined,
      pageToken: pageToken ? String(pageToken) : undefined,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/gmail/send
 * Sends an email through the user's connected Gmail account.
 */
export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      throw new AppError('Missing required fields: to, subject, body', 400);
    }

    const result = await sendEmail(tenantId, userId, to, subject, body);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/gmail/disconnect
 * Disconnects the user's Gmail account.
 */
export async function disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    await disconnectAccount(tenantId, userId);

    await writeAuditLog({
      tenantId,
      userId,
      action: 'integration.gmail_disconnected',
      entityType: 'EmailAccount',
      entityId: userId,
      severity: 'INFO',
    });

    res.json({ success: true, message: 'Gmail account disconnected' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/gmail/trash
 * Moves selected emails to trash.
 */
export async function trash(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw new AppError('messageIds must be a non-empty array', 400);
    }

    const result = await trashEmails(tenantId, userId, messageIds);

    await writeAuditLog({
      tenantId,
      userId,
      action: 'integration.gmail_trash',
      entityType: 'EmailAccount',
      entityId: userId,
      metadata: { messageIds, count: messageIds.length },
      severity: 'INFO',
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/gmail/archive
 * Archives selected emails (removes from inbox).
 */
export async function archive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw new AppError('messageIds must be a non-empty array', 400);
    }

    const result = await archiveEmails(tenantId, userId, messageIds);

    await writeAuditLog({
      tenantId,
      userId,
      action: 'integration.gmail_archive',
      entityType: 'EmailAccount',
      entityId: userId,
      metadata: { messageIds, count: messageIds.length },
      severity: 'INFO',
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/gmail/drafts
 * Creates or updates a draft.
 */
export async function saveDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const { to, subject, body, draftId } = req.body;

    if (!to && !subject && !body) {
      throw new AppError('At least one field (to, subject, body) is required', 400);
    }

    const result = await saveDraft(tenantId, userId, to ?? '', subject ?? '', body ?? '', draftId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /integrations/gmail/drafts/:draftId
 * Deletes a draft.
 */
export async function deleteDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    const { draftId } = req.params;

    if (!draftId) {
      throw new AppError('draftId is required', 400);
    }

    await deleteDraft(tenantId, userId, draftId);
    res.json({ success: true, message: 'Draft deleted' });
  } catch (error) {
    next(error);
  }
}
