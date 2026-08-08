import { PrismaClient } from '@prisma/client';
import { refreshAccessToken, getUserInfo } from './gmail.oauth';
import { GmailEmail, GmailThread } from './gmail.types';

const prisma = new PrismaClient();

/**
 * Ensures the access token is still valid; refreshes if expired.
 * Returns a valid access token or throws if refresh fails.
 */
export async function getValidAccessToken(tenantId: string, userId: string): Promise<string> {
  const account = await prisma.emailAccount.findUnique({
    where: { tenantId_userId_provider: { tenantId, userId, provider: 'gmail' } },
  });

  if (!account || !account.isActive) {
    throw new Error('Gmail account not connected');
  }

  // Check if token is still valid (with 5-minute buffer)
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  const isExpired = account.tokenExpiresAt
    ? account.tokenExpiresAt.getTime() - bufferMs < now.getTime()
    : true;

  if (!isExpired) {
    return account.accessToken;
  }

  // Token expired — refresh it
  if (!account.refreshToken) {
    throw new Error('No refresh token available. Please reconnect your Gmail account.');
  }

  const tokens = await refreshAccessToken(account.refreshToken);

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.emailAccount.update({
    where: { tenantId_userId_provider: { tenantId, userId, provider: 'gmail' } },
    data: {
      accessToken: tokens.access_token,
      tokenExpiresAt: expiresAt,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token;
}

/**
 * Fetches emails from the user's Gmail inbox.
 */
export async function fetchEmails(
  tenantId: string,
  userId: string,
  options: { maxResults?: number; query?: string; pageToken?: string } = {},
): Promise<{ emails: GmailEmail[]; nextPageToken?: string }> {
  const accessToken = await getValidAccessToken(tenantId, userId);
  const { maxResults = 20, query = 'in:inbox', pageToken } = options;

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    q: query,
  });
  if (pageToken) params.set('pageToken', pageToken);

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listResponse.ok) {
    throw new Error(`Gmail API error: ${listResponse.status}`);
  }

  const listData = await listResponse.json() as {
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
  };

  if (!listData.messages || listData.messages.length === 0) {
    return { emails: [], nextPageToken: undefined };
  }

  // Fetch full message details in parallel (batch of up to maxResults)
  const emails = await Promise.all(
    listData.messages.map((msg) => fetchMessageDetail(accessToken, msg.id)),
  );

  return { emails, nextPageToken: listData.nextPageToken };
}

/**
 * Fetches a single message's full detail.
 */
async function fetchMessageDetail(accessToken: string, messageId: string): Promise<GmailEmail> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch message ${messageId}: ${response.status}`);
  }

  const data = await response.json() as GmailApiMessage;

  return parseGmailMessage(data);
}

/**
 * Sends an email via Gmail API.
 */
export async function sendEmail(
  tenantId: string,
  userId: string,
  to: string | string[],
  subject: string,
  body: string,
): Promise<{ messageId: string; threadId: string }> {
  const accessToken = await getValidAccessToken(tenantId, userId);

  const recipients = Array.isArray(to) ? to.join(', ') : to;
  const rawMessage = createRawMessage(recipients, subject, body);

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to send email: ${response.status} — ${errorBody}`);
  }

  const result = await response.json() as { id: string; threadId: string };
  return { messageId: result.id, threadId: result.threadId };
}

/**
 * Gets the connection status for a user's Gmail account.
 */
export async function getConnectionStatus(
  tenantId: string,
  userId: string,
): Promise<{ isConnected: boolean; email: string | null; connectedAt: string | null; lastSyncAt: string | null }> {
  const account = await prisma.emailAccount.findUnique({
    where: { tenantId_userId_provider: { tenantId, userId, provider: 'gmail' } },
  });

  if (!account || !account.isActive) {
    return { isConnected: false, email: null, connectedAt: null, lastSyncAt: null };
  }

  return {
    isConnected: true,
    email: account.email,
    connectedAt: account.connectedAt.toISOString(),
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
  };
}

/**
 * Disconnects a Gmail account (soft-delete — sets isActive to false).
 */
export async function disconnectAccount(tenantId: string, userId: string): Promise<void> {
  await prisma.emailAccount.update({
    where: { tenantId_userId_provider: { tenantId, userId, provider: 'gmail' } },
    data: { isActive: false, accessToken: '', refreshToken: null },
  });
}

/**
 * Creates or updates a draft in Gmail.
 */
export async function saveDraft(
  tenantId: string,
  userId: string,
  to: string,
  subject: string,
  body: string,
  draftId?: string,
): Promise<{ draftId: string; messageId: string }> {
  const accessToken = await getValidAccessToken(tenantId, userId);
  const rawMessage = createRawMessage(to, subject, body);

  const requestBody = { message: { raw: rawMessage } };

  let response: Response;

  if (draftId) {
    // Update existing draft
    response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );
  } else {
    // Create new draft
    response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to save draft: ${response.status} — ${errorBody}`);
  }

  const result = await response.json() as { id: string; message: { id: string } };
  return { draftId: result.id, messageId: result.message.id };
}

/**
 * Deletes a draft from Gmail.
 */
export async function deleteDraft(
  tenantId: string,
  userId: string,
  draftId: string,
): Promise<void> {
  const accessToken = await getValidAccessToken(tenantId, userId);

  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

/**
 * Moves messages to trash (batch delete).
 */
export async function trashEmails(
  tenantId: string,
  userId: string,
  messageIds: string[],
): Promise<{ success: boolean; count: number }> {
  const accessToken = await getValidAccessToken(tenantId, userId);

  await Promise.all(
    messageIds.map((id) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ),
  );

  return { success: true, count: messageIds.length };
}

/**
 * Archives messages (removes INBOX label).
 */
export async function archiveEmails(
  tenantId: string,
  userId: string,
  messageIds: string[],
): Promise<{ success: boolean; count: number }> {
  const accessToken = await getValidAccessToken(tenantId, userId);

  await Promise.all(
    messageIds.map((id) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      }),
    ),
  );

  return { success: true, count: messageIds.length };
}

// ─── Internal Helpers ───────────────────────────────────

interface GmailApiMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string } }[];
  };
  internalDate: string;
}

function parseGmailMessage(data: GmailApiMessage): GmailEmail {
  const headers = data.payload.headers;
  const getHeader = (name: string): string =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  const from = getHeader('From');
  const to = getHeader('To').split(',').map((s) => s.trim()).filter(Boolean);
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  const isRead = !data.labelIds.includes('UNREAD');

  // Extract body from parts or direct body
  let body = '';
  if (data.payload.parts) {
    const htmlPart = data.payload.parts.find((p) => p.mimeType === 'text/html');
    const textPart = data.payload.parts.find((p) => p.mimeType === 'text/plain');
    const part = htmlPart ?? textPart;
    if (part?.body?.data) {
      body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
  } else if (data.payload.body?.data) {
    body = Buffer.from(data.payload.body.data, 'base64url').toString('utf-8');
  }

  return {
    id: data.id,
    threadId: data.threadId,
    from,
    to,
    subject,
    snippet: data.snippet,
    body,
    date: date || new Date(parseInt(data.internalDate, 10)).toISOString(),
    isRead,
    labels: data.labelIds,
  };
}

function createRawMessage(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(message).toString('base64url');
}
