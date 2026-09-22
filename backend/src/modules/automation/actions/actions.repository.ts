import prisma from '../../../config/database.config';
export function findUser(id: string, tenantId: string) {
  return prisma.user.findFirst({ where: { id, tenantId, status: 'ACTIVE' }, select: { id: true } });
}
export function findTemplate(id: string, tenantId: string) {
  return prisma.template.findFirst({ where: { id, tenantId, isArchived: false, type: 'Email' } });
}
export function findStage(id: string, tenantId: string) {
  return prisma.stage.findFirst({ where: { id, tenantId, pipeline: { tenantId, isArchived: false } } });
}
export function findSender(id: string, tenantId: string) {
  return prisma.emailAccount.findFirst({ where: { userId: id, tenantId, isActive: true, provider: 'gmail' }, select: { email: true } });
}
export function createDelivery(data: { tenantId: string; fromEmail: string; toEmail: string; subject: string; leadId?: string; customerId?: string }) {
  return prisma.emailDeliveryLog.create({ data: { ...data, status: 'pending' } });
}
export function finishDelivery(id: string, tenantId: string, data: { status: string; gmailMessageId?: string; gmailThreadId?: string; sentAt?: Date; errorMessage?: string }) {
  return prisma.emailDeliveryLog.update({ where: { id, tenantId }, data });
}
