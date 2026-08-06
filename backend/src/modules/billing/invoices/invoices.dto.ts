import { z } from 'zod';

const id = () => z.string().min(1);

export const CreateInvoiceSchema = z.object({
  invoiceNumber:   z.string().min(1),
  plan:            z.string().optional(),
  amount:          z.number().positive(),
  taxAmount:       z.number().min(0).default(0),
  discountAmount:  z.number().min(0).default(0),
  totalAmount:     z.number().positive(),
  currency:        z.string().default('PHP'),
  frequency:       z.enum(['Monthly', 'Quarterly', 'Annual', 'One-time']),
  status:          z.enum(['Active', 'Pending', 'Expired', 'Cancelled']).default('Pending'),
  paymentStatus:   z.enum(['Paid', 'Unpaid', 'Overdue']).default('Unpaid'),
  startDate:       z.string().datetime(),
  dueDate:         z.string().datetime().optional(),
  nextBillingDate: z.string().datetime().optional(),
  dealId:          id().optional(),
  contactId:       id().optional(),
  organizationId:  id().optional(),
  notes:           z.string().optional(),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

export const MarkPaidSchema = z.object({
  paidAt: z.string().datetime().optional(),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof UpdateInvoiceSchema>;
export type MarkPaidDto      = z.infer<typeof MarkPaidSchema>;
