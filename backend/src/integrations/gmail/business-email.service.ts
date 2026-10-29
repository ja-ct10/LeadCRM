import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { BUSINESS_INQUIRY_EMAIL, ManualCreateLeadSchema, SESSION_IDLE_MS, isWorkspaceAccessible, isOnboardingComplete } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { mailConfig } from '../../config/mail.config';
import { encryptToken, decryptToken } from '../../core/encryption/crypto.service';
import { hashToken } from '../../core/auth/session.service';
import { readAuthUser } from '../../core/auth/auth-user';
import { tenantContext } from '../../core/tenant/tenant-context';
import { AppError } from '../../shared/errors/app-error';
import { exchangeCodeForTokens, refreshAccessToken, getUserInfo, getMailboxProfile } from './gmail.oauth';
import { normalizeEmail } from './engagement-rules';
import { salesTransaction } from '../../modules/crm/leads/lead-automation.service';
import { createContact } from '../../modules/crm/contacts/contacts.repository';

const scope = 'https://www.googleapis.com/auth/gmail.readonly';
export async function requireBusinessEmailAdmin(tenantId: string, userId: string) {
  const user = await readAuthUser(userId, tenantId);
  if (user.role !== 'Client Admin' || user.status !== 'ACTIVE' || user.mustChangePassword || !isWorkspaceAccessible(user.tenantStatus) || !isOnboardingComplete(user)) throw new AppError('Business inquiry email is managed by the Client Admin.', 403);
  return user;
}
export function businessEmailCallback() {
  const configured = process.env.BUSINESS_EMAIL_REDIRECT_URI || mailConfig.gmail.redirectUri;
  if (!configured) throw new AppError('Configure the business email callback URL.', 503);
  const url = new URL(process.env.BUSINESS_EMAIL_REDIRECT_URI || new URL('/api/v1/integrations/business-email/callback', configured).toString());
  const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.pathname !== '/api/v1/integrations/business-email/callback' ||
      url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new AppError('Configure the business email HTTPS callback URL.', 503);
  }
  return url.toString();
}
export async function beginBusinessEmail(tenantId: string, userId: string, sessionToken: string) {
  await requireBusinessEmailAdmin(tenantId, userId);
  if (!mailConfig.gmail.clientId || !mailConfig.gmail.clientSecret || !process.env.ENCRYPTION_KEY) throw new AppError('Configure Gmail OAuth before connecting business email.', 503);
  const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
  await prisma.businessEmailOAuthState.deleteMany({ where: { tenantId, expiresAt: { lt: new Date() } } });
  await prisma.businessEmailOAuthState.create({ data: { stateHash: hashToken(state), tenantId, userId, sessionHash: hashToken(sessionToken), verifier: encryptToken(verifier), expiresAt: new Date(Date.now() + 600000) } });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: mailConfig.gmail.clientId, redirect_uri: businessEmailCallback(), response_type: 'code',
    scope: scope + ' https://www.googleapis.com/auth/userinfo.email', access_type: 'offline', prompt: 'consent', login_hint: BUSINESS_INQUIRY_EMAIL,
    state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
  return { url: url.toString() };
}
export async function finishBusinessEmail(state: string, code: string) {
  const stateHash = hashToken(state), challenge = await tenantContext.exit(() => prisma.businessEmailOAuthState.findUnique({ where: { stateHash } }));
  if (!challenge || +challenge.expiresAt <= Date.now()) throw new AppError('Connection request expired. Start again.', 400);
  await tenantContext.run({ tenantId: challenge.tenantId }, async () => {
    if (!(await prisma.businessEmailOAuthState.deleteMany({ where: { stateHash, expiresAt: { gt: new Date() } } })).count) throw new AppError('Connection request was already used.', 400);
    const checkSession = async () => {
      const session = await prisma.session.findUnique({ where: { tokenHash: challenge.sessionHash } });
      if (!session || session.revokedAt || +session.expiresAt <= Date.now() || +session.lastActiveAt <= Date.now() - SESSION_IDLE_MS || session.userId !== challenge.userId || session.tenantId !== challenge.tenantId) throw new AppError('Sign in again to connect business email.', 401);
      await requireBusinessEmailAdmin(challenge.tenantId, challenge.userId);
    };
    await checkSession();
    const tokens = await exchangeCodeForTokens(code, decryptToken(challenge.verifier), businessEmailCallback());
    const [info, profile] = await Promise.all([getUserInfo(tokens.access_token), getMailboxProfile(tokens.access_token)]);
    if (!info.verified_email || normalizeEmail(info.email) !== BUSINESS_INQUIRY_EMAIL || normalizeEmail(profile.emailAddress) !== BUSINESS_INQUIRY_EMAIL) throw new AppError(`Connect ${BUSINESS_INQUIRY_EMAIL} for business inquiries.`, 400);
    if (!tokens.scope?.split(' ').includes(scope) || !tokens.refresh_token) throw new AppError('Approve read-only and offline Gmail access, then reconnect.', 400);
    await checkSession();
    const previous = await prisma.businessEmailConnection.findUnique({ where: { tenantId: challenge.tenantId }, select: { email: true } });
    const data = { email: BUSINESS_INQUIRY_EMAIL, connectedById: challenge.userId, accessToken: encryptToken(tokens.access_token), refreshToken: encryptToken(tokens.refresh_token), tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), isActive: true, syncError: null, leaseId: null, leaseUntil: null,
      ...(previous && previous.email !== BUSINESS_INQUIRY_EMAIL ? { startsAt: new Date(), lastSyncAt: null, nextPageToken: null } : {}) };
    await prisma.businessEmailConnection.upsert({ where: { tenantId: challenge.tenantId }, create: { tenantId: challenge.tenantId, ...data }, update: data });
    await prisma.auditLog.create({ data: { tenantId: challenge.tenantId, userId: challenge.userId, action: 'business_email.connected', entityType: 'BusinessEmailConnection' } });
  });
}
export async function businessEmailStatus(tenantId: string) {
  const row = await prisma.businessEmailConnection.findUnique({ where: { tenantId }, select: { isActive: true, email: true, lastSyncAt: true, syncError: true } });
  const matchesMailbox = row?.email === BUSINESS_INQUIRY_EMAIL;
  return { email: BUSINESS_INQUIRY_EMAIL, connected: matchesMailbox && !!row?.isActive, lastSyncAt: matchesMailbox ? row.lastSyncAt?.toISOString() ?? null : null, syncError: matchesMailbox ? row.syncError : null };
}
export async function disconnectBusinessEmail(tenantId: string, userId: string) {
  await requireBusinessEmailAdmin(tenantId, userId);
  await salesTransaction(async tx => {
    await tx.businessEmailConnection.updateMany({ where: { tenantId }, data: { isActive: false, accessToken: '', refreshToken: '', leaseId: null, leaseUntil: null } });
    await tx.businessEmailOAuthState.deleteMany({ where: { tenantId } });
    await tx.auditLog.create({ data: { tenantId, userId, action: 'business_email.disconnected', entityType: 'BusinessEmailConnection' } });
  });
}
const listSchema = z.object({ messages: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200) })).max(30).optional(), nextPageToken: z.string().max(4000).optional() });
const messageSchema = z.object({ id: z.string().max(200), snippet: z.string().max(10000).default(''), internalDate: z.string().max(20), labelIds: z.array(z.string().max(100)).max(100).default([]), payload: z.object({ headers: z.array(z.object({ name: z.string().max(100), value: z.string().max(10000) })).max(100) }) });
export function inquiryMetadata(input: unknown, startsAt: Date) {
  if (!input || typeof input !== 'object') return;
  const raw = input;
  if ('payload' in raw && raw.payload && typeof raw.payload === 'object' && 'headers' in raw.payload && Array.isArray(raw.payload.headers) && raw.payload.headers.length > 100) return;
  if ('labelIds' in raw && Array.isArray(raw.labelIds) && raw.labelIds.length > 100) return;
  const parsed = messageSchema.safeParse(input); if (!parsed.success) return;
  const m = parsed.data, header = (name: string) => m.payload.headers.find(h => h.name.toLowerCase() === name)?.value ?? '';
  const sender = normalizeEmail(header('from')), to = header('to').toLowerCase(), receivedAt = new Date(Number(m.internalDate));
  if (!Number.isFinite(+receivedAt) || +receivedAt < +startsAt || +receivedAt > Date.now() + 300000 || !z.string().email().safeParse(sender).success || sender === BUSINESS_INQUIRY_EMAIL || !to.split(/[,;]/).some(v => normalizeEmail(v) === BUSINESS_INQUIRY_EMAIL)) return;
  if (m.labelIds.some(l => ['SPAM', 'TRASH', 'DRAFT', 'SENT'].includes(l)) || !m.labelIds.includes('INBOX')) return;
  if ((header('auto-submitted') && header('auto-submitted').toLowerCase() !== 'no') || header('list-id') || /^(bulk|list|junk)$/i.test(header('precedence')) || /^(mailer-daemon|postmaster|no-?reply)@/i.test(sender)) return;
  const plain = (v: string, max: number) => v.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').slice(0, max);
  return { providerMessageId: m.id, sender, senderName: plain(header('from').replace(/<[^>]*>/g, '').replace(/^"|"$/g, '').trim(), 200), subject: plain(header('subject'), 500), snippet: plain(m.snippet, 1000), receivedAt };
}
export async function syncBusinessEmail(tenantId: string) {
  let row = await prisma.businessEmailConnection.findUnique({ where: { tenantId } });
  if (!row?.isActive || row.email !== BUSINESS_INQUIRY_EMAIL) throw new AppError(`Connect ${BUSINESS_INQUIRY_EMAIL} for business inquiries.`, 409);
  await requireBusinessEmailAdmin(tenantId, row.connectedById);
  const now = new Date(), leaseId = randomUUID();
  // Cover one bounded page: 31 provider calls can each take 15 seconds.
  const acquired = await prisma.businessEmailConnection.updateMany({
    where: { id: row.id, email: BUSINESS_INQUIRY_EMAIL, isActive: true, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseId, leaseUntil: new Date(+now + 600000) },
  });
  if (!acquired.count) return { busy: true, captured: 0 };
  let coolingDown = false, cooldownMs = 60000;
  try {
    if (+row.tokenExpiresAt < Date.now() + 60000) {
      const tokens = await refreshAccessToken(decryptToken(row.refreshToken));
      if (!(await prisma.businessEmailConnection.updateMany({ where: { id: row.id, leaseId, isActive: true }, data: { accessToken: encryptToken(tokens.access_token), tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}) } })).count) return { captured: 0 };
      row = (await prisma.businessEmailConnection.findUnique({ where: { tenantId } }))!;
    }
    const json = async (path: string) => {
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { headers: { Authorization: 'Bearer ' + decryptToken(row!.accessToken) }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!r.ok) {
        const retry = r.headers.get('Retry-After');
        if (retry) cooldownMs = Math.min(900000, Math.max(cooldownMs, /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()));
        throw new AppError(r.status === 401 || r.status === 403 ? 'Reconnect the business mailbox in Google.' : 'Business email sync failed; retry shortly.', 503);
      }
      return r.json();
    };
    const query = new URLSearchParams({ q: `in:inbox after:${Math.floor(+row.startsAt / 1000)}`, maxResults: '30', ...(row.nextPageToken ? { pageToken: row.nextPageToken } : {}) });
    const page = listSchema.parse(await json('messages?' + query));
    const messages: Array<ReturnType<typeof inquiryMetadata>> = [];
    for (const item of page.messages ?? []) messages.push(inquiryMetadata(await json('messages/' + item.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Auto-Submitted&metadataHeaders=Precedence&metadataHeaders=List-Id'), row.startsAt));
    let captured = 0;
    await salesTransaction(async tx => {
      await requireBusinessEmailAdmin(tenantId, row!.connectedById);
      // Serialize persistence against disconnect and credential changes.
      if (!(await tx.businessEmailConnection.updateMany({ where: { id: row!.id, leaseId, isActive: true }, data: { lastSyncAt: now, nextPageToken: page.nextPageToken ?? null, syncError: null } })).count) return;
      for (const message of messages) if (message) {
        const internal = await tx.user.findFirst({ where: { tenantId, email: { equals: message.sender, mode: 'insensitive' } }, select: { id: true } });
        if (internal) continue;
        captured += (await tx.businessEmailInquiry.createMany({ data: [{ ...message, id: randomUUID(), tenantId, connectionId: row!.id }], skipDuplicates: true })).count;
      }
    });
    return { captured, hasMore: !!page.nextPageToken };
  } catch (error) {
    coolingDown = true;
    await prisma.businessEmailConnection.updateMany({ where: { id: row.id, leaseId, isActive: true }, data: { syncError: 'Business email sync needs attention. Reconnect or retry shortly.', leaseUntil: new Date(Date.now() + (Number.isFinite(cooldownMs) ? cooldownMs : 60000)) } });
    throw error;
  } finally { if (!coolingDown) await prisma.businessEmailConnection.updateMany({ where: { id: row.id, leaseId }, data: { leaseUntil: null, leaseId: null } }); }
}
export async function listBusinessInquiries(tenantId: string, page = 1) {
  return prisma.businessEmailInquiry.findMany({ where: { tenantId, status: 'review' }, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 30, take: 30,
    select: { id: true, sender: true, senderName: true, subject: true, snippet: true, receivedAt: true, status: true, leadId: true } });
}
export async function reviewBusinessInquiry(tenantId: string, userId: string, id: string, body: unknown) {
  await requireBusinessEmailAdmin(tenantId, userId);
  const action = z.object({ action: z.enum(['dismiss', 'create']), lead: ManualCreateLeadSchema.optional() }).strict().parse(body);
  return salesTransaction(async tx => {
    const inquiry = await tx.businessEmailInquiry.findFirst({ where: { tenantId, id } });
    if (!inquiry) throw new AppError('Inquiry unavailable.', 404);
    if (inquiry.status !== 'review') return { leadId: inquiry.leadId, status: inquiry.status };
    if (!(await tx.businessEmailInquiry.updateMany({ where: { tenantId, id, status: 'review' }, data: { reviewedAt: new Date(), reviewedById: userId, status: action.action === 'dismiss' ? 'dismissed' : 'creating' } })).count) throw new AppError('This inquiry was already reviewed.', 409);
    if (action.action === 'dismiss') return { status: 'dismissed', leadId: null };
    if (!action.lead || normalizeEmail(action.lead.email) !== inquiry.sender) throw new AppError('Use the inquiry sender email and complete the Lead details.', 400);
    const contacts = await tx.contact.count({ where: { tenantId, email: { equals: inquiry.sender, mode: 'insensitive' } } });
    const existing = await tx.lead.findMany({ where: { tenantId, email: { equals: inquiry.sender, mode: 'insensitive' } }, take: 2 });
    if (contacts || existing.length > 1 || existing.some(l => l.isArchived || l.convertedAt)) throw new AppError('This sender already has a CRM record. Review the existing record before creating another Lead.', 409);
    const evidence = { source: BUSINESS_INQUIRY_EMAIL, medium: 'email', campaign: '', category: 'Direct Email', channel: 'Direct Email', method: 'business_email', observedAt: inquiry.receivedAt.toISOString() };
    const lead = existing[0] ?? await createContact(tenantId, { ...action.lead, source: 'Direct Email', sourceDetail: '', requestId: inquiry.id }, userId, { first: evidence, last: evidence, captureMethod: 'business_email' });
    await tx.activity.create({ data: { tenantId, leadId: lead.id, createdById: userId, type: 'email', title: 'Business email inquiry reviewed', description: inquiry.subject, metadata: { source: 'business_email', inquiryId: id, providerMessageId: inquiry.providerMessageId } } });
    await tx.businessEmailInquiry.update({ where: { id, tenantId }, data: { status: 'accepted', leadId: lead.id } });
    await tx.auditLog.create({ data: { tenantId, userId, action: 'business_email.inquiry_accepted', entityType: 'Lead', entityId: lead.id } });
    return { status: 'accepted', leadId: lead.id };
  });
}
export async function syncBusinessEmailConnections() {
  const connections = await tenantContext.exit(() => prisma.businessEmailConnection.findMany({ where: { email: BUSINESS_INQUIRY_EMAIL, isActive: true, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - 30000) } }] }, take: 10 }));
  for (const connection of connections) await tenantContext.run({ tenantId: connection.tenantId }, () => syncBusinessEmail(connection.tenantId)).catch(() => { /* Safe diagnostic is persisted on the connection. */ });
}
