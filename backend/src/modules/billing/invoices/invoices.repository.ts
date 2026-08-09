import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateInvoiceDto, UpdateInvoiceDto } from './invoices.dto';

export async function findAllInvoices(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.status        ? { status:        String(query.status) }        : {}),
    ...(query.paymentStatus ? { paymentStatus: String(query.paymentStatus) } : {}),
    ...(query.dealId        ? { dealId:        String(query.dealId) }        : {}),
    ...(query.leadId        ? { leadId:        String(query.leadId) }        : {}),
    ...(query.customerId    ? { customerId:    String(query.customerId) }    : {}),
  };

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        deal: { select: { id: true, title: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findInvoiceById(id: string, tenantId: string) {
  return prisma.invoice.findFirst({
    where: { id, tenantId },
    include: {
      deal:         { select: { id: true, title: true } },
      lead:         { select: { id: true, firstName: true, lastName: true } },
      customer:     { select: { id: true, firstName: true, lastName: true } },
      transactions: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function createInvoice(tenantId: string, dto: CreateInvoiceDto) {
  return prisma.invoice.create({ data: { ...dto, tenantId } });
}

export async function updateInvoice(id: string, tenantId: string, dto: UpdateInvoiceDto) {
  const existing = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.invoice.update({ where: { id }, data: dto });
}

export async function markInvoicePaid(id: string, tenantId: string, paidAt: Date) {
  const existing = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.invoice.update({
    where: { id },
    data: { paymentStatus: 'Paid', status: 'Active', paidAt },
  });
}

export async function archiveInvoice(id: string, tenantId: string) {
  const existing = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.invoice.update({ where: { id }, data: { isArchived: true } });
}
