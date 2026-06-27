import * as repo from './invoices.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { CreateInvoiceDto, UpdateInvoiceDto, MarkPaidDto } from './invoices.dto';
import { paginate } from '../../../shared/helpers/pagination';

export async function getInvoices(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllInvoices(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getInvoiceById(id: string, tenantId: string) {
  const invoice = await repo.findInvoiceById(id, tenantId);
  if (!invoice) throw new NotFoundError('Invoice');
  return invoice;
}

export async function createInvoice(tenantId: string, userId: string, dto: CreateInvoiceDto) {
  const invoice = await repo.createInvoice(tenantId, dto);
  await writeAuditLog({
    tenantId, userId,
    action: 'invoice.created', entityType: 'Invoice', entityId: invoice.id,
    after: { invoiceNumber: dto.invoiceNumber, amount: dto.totalAmount, currency: dto.currency },
  });
  return invoice;
}

export async function updateInvoice(id: string, tenantId: string, userId: string, dto: UpdateInvoiceDto) {
  const invoice = await repo.updateInvoice(id, tenantId, dto);
  if (!invoice) throw new NotFoundError('Invoice');
  await writeAuditLog({
    tenantId, userId,
    action: 'invoice.updated', entityType: 'Invoice', entityId: id,
    after: dto as Record<string, unknown>,
  });
  return invoice;
}

export async function markInvoicePaid(id: string, tenantId: string, userId: string, dto: MarkPaidDto) {
  const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
  const invoice = await repo.markInvoicePaid(id, tenantId, paidAt);
  if (!invoice) throw new NotFoundError('Invoice');
  await writeAuditLog({
    tenantId, userId,
    action: 'invoice.paid', entityType: 'Invoice', entityId: id,
    after: { paymentStatus: 'Paid', paidAt },
  });
  return invoice;
}

export async function archiveInvoice(id: string, tenantId: string, userId: string) {
  const invoice = await repo.archiveInvoice(id, tenantId);
  if (!invoice) throw new NotFoundError('Invoice');
  await writeAuditLog({
    tenantId, userId,
    action: 'invoice.archived', entityType: 'Invoice', entityId: id,
    after: { isArchived: true },
  });
  return invoice;
}
