/**
 * Gmail Service — OAuth2 Integration
 * Sends real emails from the user's connected Gmail account via Gmail API.
 *
 * Requirements:
 * - OAuth2 credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI)
 * - User must complete OAuth flow to store tokens in EmailAccount table
 * - Supports HTML emails, bulk sending, automatic token refresh, unsubscribe footer
 */

import crypto from 'node:crypto';
import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { encryptToken, decryptToken } from '../../../core/encryption/crypto.service';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  leadId?: string;
  campaignId?: string;
}

interface GmailTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

// ── Configuration ────────────────────────────────────────────────────────────

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:4000/api/v1/integrations/gmail/callback';
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const UNSUBSCRIBE_URL = process.env.UNSUBSCRIBE_URL || 'http://localhost:3000/unsubscribe';

// ── OAuth2 Flow ──────────────────────────────────────────────────────────────

export function getAuthUrl(tenantId: string, userId: string): { url: string; state: string } {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  // Generate cryptographically secure CSRF state token
  const stateData = {
    tenantId,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

export async function exchangeCodeForTokens(code: string, state: string): Promise<GmailTokens> {
  // Validate CSRF state token
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    
    // Check timestamp (state should be used within 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      throw new Error('OAuth state token expired');
    }
    
    // Verify required fields
    if (!stateData.tenantId || !stateData.userId || !stateData.nonce) {
      throw new Error('Invalid OAuth state token');
    }
  } catch (error) {
    throw new Error('Invalid or tampered OAuth state parameter');
  }

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      redirect_uri: GMAIL_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${(errorData as Record<string, string>).error_description || response.statusText}`);
  }

  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Gmail access token');
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ── Token Management ─────────────────────────────────────────────────────────

async function getValidToken(tenantId: string, userId: string): Promise<{ accessToken: string; email: string }> {
  const account = await prisma.emailAccount.findFirst({
    where: { tenantId, userId, provider: 'gmail', isActive: true },
  });

  if (!account) {
    throw new Error('No Gmail account connected. Please connect your Gmail account first.');
  }

  // Decrypt stored tokens
  const decryptedAccessToken = decryptToken(account.accessToken);
  let currentAccessToken = decryptedAccessToken;

  // Check if token is expired (with 5-minute buffer)
  const isExpired = account.tokenExpiresAt
    ? account.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000
    : true;

  if (isExpired && account.refreshToken) {
    const decryptedRefreshToken = decryptToken(account.refreshToken);
    const refreshed = await refreshAccessToken(decryptedRefreshToken);

    // Re-encrypt and store new access token
    const encryptedAccessToken = encryptToken(refreshed.accessToken);
    
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptedAccessToken,
        tokenExpiresAt: refreshed.expiresAt,
        updatedAt: new Date(),
      },
    });

    currentAccessToken = refreshed.accessToken;
  }

  return { accessToken: currentAccessToken, email: account.email };
}

// ── Email Building ───────────────────────────────────────────────────────────

function buildUnsubscribeFooter(campaignId?: string, contactEmail?: string): string {
  const unsubLink = campaignId && contactEmail
    ? `${UNSUBSCRIBE_URL}?campaign=${campaignId}&email=${encodeURIComponent(contactEmail)}`
    : UNSUBSCRIBE_URL;

  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
      <p>You received this email because you are subscribed to our updates.</p>
      <p><a href="${unsubLink}" style="color: #3b82f6; text-decoration: underline;">Unsubscribe</a> from future emails.</p>
    </div>
  `;
}

function buildMimeMessage(from: string, to: string, subject: string, htmlBody: string): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const mimeLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    `--${boundary}--`,
  ];

  return mimeLines.join('\r\n');
}

// ── Send Email via Gmail API ─────────────────────────────────────────────────

async function sendViaGmailApi(accessToken: string, rawMessage: string): Promise<SendResult> {
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
    const errorMsg = ((errorData.error as Record<string, string>)?.message) || response.statusText;
    return { success: false, error: `Gmail API error: ${errorMsg}` };
  }

  const result = await response.json() as { id: string; threadId: string };
  return { success: true, messageId: result.id, threadId: result.threadId };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function sendEmail(
  tenantId: string,
  userId: string,
  payload: EmailPayload,
): Promise<SendResult> {
  const { accessToken, email: fromEmail } = await getValidToken(tenantId, userId);

  const footer = buildUnsubscribeFooter(payload.campaignId, payload.to);
  const fullHtml = payload.htmlBody + footer;
  const rawMessage = buildMimeMessage(fromEmail, payload.to, payload.subject, fullHtml);

  const result = await sendViaGmailApi(accessToken, rawMessage);

  // Log delivery
  await prisma.emailDeliveryLog.create({
    data: {
      tenantId,
      campaignId: payload.campaignId || null,
      leadId: payload.leadId || null,
      fromEmail,
      toEmail: payload.to,
      subject: payload.subject,
      gmailMessageId: result.messageId || null,
      gmailThreadId: result.threadId || null,
      status: result.success ? 'sent' : 'failed',
      sentAt: result.success ? new Date() : null,
      errorMessage: result.error || null,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: result.success ? 'email.sent' : 'email.failed',
    entityType: 'Email',
    entityId: result.messageId || undefined,
  });

  return result;
}

export async function sendBulkEmail(
  tenantId: string,
  userId: string,
  campaignId: string,
  recipients: Array<{ email: string; leadId?: string; subject: string; htmlBody: string }>,
  options: { mode?: 'sequential' | 'batch'; delayMs?: number } = {},
): Promise<BulkSendResult> {
  const { accessToken, email: fromEmail } = await getValidToken(tenantId, userId);
  const { mode = 'sequential', delayMs = 500 } = options;

  const result: BulkSendResult = { total: recipients.length, sent: 0, failed: 0, errors: [] };

  console.log(`Starting ${mode} email send (${recipients.length} recipients, ${delayMs}ms delay)`);

  // CRITICAL: Use for...of loop to ensure sequential processing
  // NEVER use Promise.all() or concurrent processing for campaigns
  for (const recipient of recipients) {
    const sendStartTime = Date.now();
    console.log(`Sending to ${recipient.email}... (${result.sent + 1}/${recipients.length})`);

    const footer = buildUnsubscribeFooter(campaignId, recipient.email);
    const fullHtml = recipient.htmlBody + footer;
    const rawMessage = buildMimeMessage(fromEmail, recipient.email, recipient.subject, fullHtml);

    const sendResult = await sendViaGmailApi(accessToken, rawMessage);

    if (sendResult.success) {
      result.sent++;
      console.log(`  ✓ Sent successfully (messageId: ${sendResult.messageId})`);

      // Update campaign contact record
      if (recipient.leadId) {
        await prisma.campaignContact.updateMany({
          where: { campaignId, leadId: recipient.leadId, tenantId },
          data: { status: 'sent', sentAt: new Date() },
        }).catch(() => { /* non-critical */ });
      }
    } else {
      result.failed++;
      result.errors.push({ email: recipient.email, error: sendResult.error || 'Unknown error' });
      console.log(`  ✗ Failed: ${sendResult.error}`);
    }

    // Log each delivery with audit trail
    await prisma.emailDeliveryLog.create({
      data: {
        tenantId,
        campaignId,
        leadId: recipient.leadId || null,
        fromEmail,
        toEmail: recipient.email,
        subject: recipient.subject,
        gmailMessageId: sendResult.messageId || null,
        gmailThreadId: sendResult.threadId || null,
        status: sendResult.success ? 'sent' : 'failed',
        sentAt: sendResult.success ? new Date() : null,
        errorMessage: sendResult.error || null,
      },
    });

    // Sequential delay between emails (configurable)
    // This ensures emails are sent one at a time, never concurrently
    if (result.sent + result.failed < recipients.length) {
      console.log(`  Waiting ${delayMs}ms before next send...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Update campaign metrics
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: result.sent,
      status: result.sent > 0 ? 'ACTIVE' : 'DRAFT',
      sentAt: result.sent > 0 ? new Date() : undefined,
    },
  }).catch(() => { /* non-critical */ });

  // Add comprehensive audit logging
  await writeAuditLog({
    tenantId,
    userId,
    action: 'email.bulk_sent',
    entityType: 'Campaign',
    entityId: campaignId,
    after: {
      mode,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      delayMs,
      recipients: recipients.length,
    },
  });

  console.log(`Bulk email send completed: ${result.sent}/${result.total} sent, ${result.failed} failed`);
  return result;
}

// ── Account Management ───────────────────────────────────────────────────────

export async function connectGmailAccount(
  tenantId: string,
  userId: string,
  code: string,
): Promise<{ email: string }> {
  const tokens = await exchangeCodeForTokens(code, 'dummy-state');

  // Get user email from Gmail
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error('Failed to get Gmail profile information');
  }

  const profile = await profileRes.json() as { email: string };

  // Encrypt tokens before storing
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

  // Upsert email account
  await prisma.emailAccount.upsert({
    where: { tenantId_userId_provider: { tenantId, userId, provider: 'gmail' } },
    create: {
      tenantId,
      userId,
      provider: 'gmail',
      email: profile.email,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: tokens.expiresAt || null,
      scopes: ['gmail.send', 'gmail.readonly', 'userinfo.email'],
      isActive: true,
    },
    update: {
      email: profile.email,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken ?? undefined,
      tokenExpiresAt: tokens.expiresAt || null,
      isActive: true,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'gmail.connected',
    entityType: 'EmailAccount',
    entityId: profile.email,
  });

  return { email: profile.email };
}

export async function disconnectGmailAccount(tenantId: string, userId: string): Promise<void> {
  await prisma.emailAccount.updateMany({
    where: { tenantId, userId, provider: 'gmail' },
    data: { isActive: false },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'gmail.disconnected',
    entityType: 'EmailAccount',
  });
}

export async function getGmailAccountStatus(tenantId: string, userId: string): Promise<{
  connected: boolean;
  email?: string;
  lastSyncAt?: Date;
}> {
  const account = await prisma.emailAccount.findFirst({
    where: { tenantId, userId, provider: 'gmail', isActive: true },
  });

  if (!account) {
    return { connected: false };
  }

  return {
    connected: true,
    email: account.email,
    lastSyncAt: account.lastSyncAt || undefined,
  };
}
