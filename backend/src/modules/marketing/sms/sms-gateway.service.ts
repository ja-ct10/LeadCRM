/**
 * SMS Gateway Service
 * Sends SMS via a local Android gateway (Macrodroid / SMS Gateway REST app)
 * running on the same network. The phone uses a physical SIM card with prepaid load.
 *
 * Architecture: LeadCRM → HTTP POST → Android phone → Carrier → Recipient
 *
 * Gateway endpoint is configured via SMS_GATEWAY_URL env variable.
 * Default: http://192.168.1.100:8080/send (adjust to your phone's IP)
 */

import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';

// ── Types ────────────────────────────────────────────────────────────────────

interface SmsMessage {
  to: string;
  message: string;
  leadId?: string;
  campaignId?: string;
}

interface SmsQueueItem extends SmsMessage {
  id: string;
  tenantId: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retries: number;
  error?: string;
  createdAt: Date;
  sentAt?: Date;
}

interface SmsGatewayResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface QueueStatus {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  isRunning: boolean;
}

// ── Configuration ────────────────────────────────────────────────────────────

const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || 'http://192.168.1.100:8080/send';
const SMS_DELAY_MS = parseInt(process.env.SMS_DELAY_MS || '1500', 10); // 1.5s between messages
const SMS_MAX_RETRIES = parseInt(process.env.SMS_MAX_RETRIES || '3', 10);
const PH_NUMBER_REGEX = /^\+639\d{9}$/;

// ── Database-Backed Queue (persistent) ──────────────────────────────────────

const runningQueues = new Set<string>();
const stopSignals = new Set<string>();

async function getQueueItemsFromDb(tenantId: string): Promise<SmsQueueItem[]> {
  const items = await prisma.sMSQueue.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
  
  return items.map(item => ({
    id: item.id,
    tenantId: item.tenantId,
    to: item.toNumber,
    message: item.message,
    leadId: item.leadId || undefined,
    campaignId: item.campaignId || undefined,
    status: item.status as 'pending' | 'sending' | 'sent' | 'failed',
    retries: item.retryCount,
    error: item.errorMessage || undefined,
    createdAt: item.createdAt,
    sentAt: item.sentAt || undefined,
  }));
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validatePhilippineNumber(phone: string): { valid: boolean; normalized: string; error?: string } {
  let normalized = phone.replace(/[\s\-()]/g, '');

  // Convert 09XX to +639XX
  if (normalized.startsWith('09') && normalized.length === 11) {
    normalized = '+63' + normalized.substring(1);
  }
  // Convert 639XX to +639XX
  if (normalized.startsWith('639') && normalized.length === 12) {
    normalized = '+' + normalized;
  }

  if (!PH_NUMBER_REGEX.test(normalized)) {
    return { valid: false, normalized, error: 'Invalid Philippine mobile number. Expected format: +639XXXXXXXXX' };
  }

  return { valid: true, normalized };
}

// ── Gateway Communication ────────────────────────────────────────────────────

async function sendToGateway(to: string, message: string): Promise<SmsGatewayResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(SMS_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: to, message }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { success: false, error: `Gateway returned ${response.status}: ${errorText}` };
    }

    const data = await response.json().catch(() => ({ success: true }));
    return { success: true, messageId: data.messageId || data.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gateway unreachable';
    return { success: false, error: message };
  }
}

// ── Queue Operations ─────────────────────────────────────────────────────────

export async function enqueueSms(tenantId: string, messages: SmsMessage[]): Promise<{ queued: number; errors: string[] }> {
  const errors: string[] = [];
  let queued = 0;

  for (const msg of messages) {
    const validation = validatePhilippineNumber(msg.to);
    if (!validation.valid) {
      errors.push(`${msg.to}: ${validation.error}`);
      continue;
    }

    await prisma.sMSQueue.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        toNumber: validation.normalized,
        message: msg.message,
        leadId: msg.leadId,
        campaignId: msg.campaignId,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
      },
    });
    queued++;
  }

  return { queued, errors };
}

export async function startQueue(tenantId: string, userId: string): Promise<void> {
  if (runningQueues.has(tenantId)) return;

  runningQueues.add(tenantId);
  stopSignals.delete(tenantId);

  const firstItem = await prisma.sMSQueue.findFirst({
    where: { tenantId, status: 'pending' },
    select: { campaignId: true }
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'sms.queue_started',
    entityType: 'Campaign',
    entityId: firstItem?.campaignId || undefined,
  });

  // Process queue asynchronously
  processQueue(tenantId, userId).catch(() => {
    runningQueues.delete(tenantId);
  });
}

async function processQueue(tenantId: string, userId: string): Promise<void> {
  while (true) {
    // Check stop signal
    if (stopSignals.has(tenantId)) {
      stopSignals.delete(tenantId);
      break;
    }

    // Find next pending message from database
    const item = await prisma.sMSQueue.findFirst({
      where: {
        tenantId,
        OR: [
          { status: 'pending' },
          { 
            status: 'failed',
            retryCount: { lt: SMS_MAX_RETRIES }
          }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!item) break;

    // Update status to sending
    await prisma.sMSQueue.update({
      where: { id: item.id },
      data: { status: 'processing' }
    });

    const result = await sendToGateway(item.toNumber, item.message);

    if (result.success) {
      await prisma.sMSQueue.update({
        where: { id: item.id },
        data: { 
          status: 'sent',
          sentAt: new Date()
        }
      });

      // Update campaign contact status if linked
      if (item.campaignId && item.leadId) {
        await prisma.campaignContact.updateMany({
          where: { campaignId: item.campaignId, leadId: item.leadId, tenantId } as any,
          data: { status: 'sent', sentAt: new Date() },
        }).catch(() => { /* non-critical */ });
      }
    } else {
      const newRetries = item.retryCount + 1;
      await prisma.sMSQueue.update({
        where: { id: item.id },
        data: { 
          retryCount: newRetries,
          status: newRetries >= SMS_MAX_RETRIES ? 'failed' : 'pending',
          errorMessage: newRetries >= SMS_MAX_RETRIES ? result.error : undefined
        }
      });
    }

    // Throttle: wait between messages to avoid carrier spam detection
    await new Promise((resolve) => setTimeout(resolve, SMS_DELAY_MS));
  }

  runningQueues.delete(tenantId);

  // Update campaign sent count
  const sentCount = await prisma.sMSQueue.count({
    where: { tenantId, status: 'sent' }
  });
  
  const firstItem = await prisma.sMSQueue.findFirst({
    where: { tenantId },
    select: { campaignId: true }
  });
  
  const campaignId = firstItem?.campaignId;
  if (campaignId && sentCount > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentCount, status: 'COMPLETED' },
    }).catch(() => { /* non-critical */ });
  }

  await writeAuditLog({
    tenantId,
    userId,
    action: 'sms.queue_completed',
    entityType: 'Campaign',
    entityId: campaignId || undefined,
  });
}

export function stopQueue(tenantId: string): void {
  if (runningQueues.has(tenantId)) {
    stopSignals.add(tenantId);
  }
}

export async function getQueueStatus(tenantId: string): Promise<QueueStatus> {
  const items = await prisma.sMSQueue.findMany({
    where: { tenantId },
    select: { status: true }
  });

  return {
    total: items.length,
    pending: items.filter((m) => m.status === 'pending').length,
    sending: items.filter((m) => m.status === 'processing').length,
    sent: items.filter((m) => m.status === 'sent').length,
    failed: items.filter((m) => m.status === 'failed').length,
    isRunning: runningQueues.has(tenantId),
  };
}

export function getQueueItems(tenantId: string): Promise<SmsQueueItem[]> {
  return getQueueItemsFromDb(tenantId);
}

export async function clearQueue(tenantId: string): Promise<void> {
  await prisma.sMSQueue.deleteMany({
    where: { tenantId }
  });
  stopSignals.delete(tenantId);
}

// ── Convenience: Single SMS ──────────────────────────────────────────────────

export async function sendSingleSms(
  tenantId: string,
  userId: string,
  to: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const validation = validatePhilippineNumber(to);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const result = await sendToGateway(validation.normalized, message);

  await writeAuditLog({
    tenantId,
    userId,
    action: result.success ? 'sms.sent' : 'sms.failed',
    entityType: 'SMS',
    entityId: undefined,
  });

  return result;
}

// ── Bulk SMS (queues and starts processing) ──────────────────────────────────

export async function sendBulkSms(
  tenantId: string,
  userId: string,
  campaignId: string,
  recipients: Array<{ phone: string; leadId?: string; message: string }>,
): Promise<{ queued: number; errors: string[] }> {
  // Clear any existing queue for this tenant
  await clearQueue(tenantId);

  const messages: SmsMessage[] = recipients.map((r) => ({
    to: r.phone,
    message: r.message,
    leadId: r.leadId,
    campaignId,
  }));

  const result = await enqueueSms(tenantId, messages);

  if (result.queued > 0) {
    await startQueue(tenantId, userId);
  }

  return result;
}
