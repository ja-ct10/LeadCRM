import { Prisma } from '@prisma/client';
import { FormDefinitionSchema, PublicSubmissionSchema, validateFormValues, withProductOptions } from '@leadcrm/shared';
import type { PublicFormDefinition } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { sendMail } from '../../../shared/services/email.service';
import { normalizePhone } from '../../crm/duplicate-detection/duplicate-detection.service';
import { createAssignedLead, createProductDeals, productConfiguration, salesTransaction, resolveProducts } from '../../crm/leads/lead-automation.service';

export class SubmissionValidationError extends ValidationError {
  constructor(public fieldErrors: Record<string, string>) { super('Please check the highlighted fields.'); }
}
const publicWhere = (publicId: string) => ({ publicId, isArchived: false, status: 'published', publishedVersion: { gt: 0 }, tenant: { status: { in: ['ACTIVE', 'SANDBOX'] as ('ACTIVE' | 'SANDBOX')[] } } });
export async function getPublicForm(publicId: string): Promise<PublicFormDefinition> {
  const form = await prisma.marketingForm.findFirst({ where: publicWhere(publicId) });
  if (!form?.publishedConfig) throw new NotFoundError('Form');
  const config = FormDefinitionSchema.parse(form.publishedConfig);
  const products = await salesTransaction(tx => productConfiguration(tx, form.tenantId));
  return { name: config.name, fields: withProductOptions(config.fields, products), design: config.design, version: form.publishedVersion, trackUrlParams: config.settings.trackUrlParams };
}

export async function submitPublicForm(publicId: string, body: unknown) {
  const input = PublicSubmissionSchema.parse(body);
  if (input.website) throw new ValidationError('Unable to accept submission.');
  const form = await prisma.marketingForm.findFirst({ where: publicWhere(publicId) });
  if (!form) throw new NotFoundError('Form');
  const scope = { tenantId: form.tenantId };
  // Serializable predicate reads prevent simultaneous inquiries creating duplicate people,
  // including submissions arriving through different forms in this dataset.
  return tenantContext.run(scope, async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const accepted = await prisma.$transaction(async tx => {
          const live = await tx.marketingForm.findFirst({ where: { ...publicWhere(publicId), ...scope } });
          if (!live?.publishedConfig) throw new NotFoundError('Form');
          if (live.publishedVersion !== input.version) throw new ConflictError('This form has changed. Reload it before submitting.');
          if (input.requestId) {
            const previous = await tx.formSubmission.findFirst({ where: { ...scope, formId: live.id, requestKey: input.requestId } });
            if (previous) return { submission: previous, notificationEmail: '' };
          }
          const config = FormDefinitionSchema.parse(live.publishedConfig);
          config.fields = withProductOptions(config.fields, await productConfiguration(tx, scope.tenantId));
          const validated = validateFormValues(config.fields, input.values);
          if (Object.keys(validated.errors).length) throw new SubmissionValidationError(validated.errors);
          const mapped: Record<string, string> = {};
          for (const field of config.fields) if (field.mapToField && typeof validated.values[field.id] === 'string') mapped[field.mapToField] = validated.values[field.id] as string;
          const productField = config.fields.find(field => field.mapToField === 'productInterest');
          const productValue = productField ? validated.values[productField.id] : undefined;
          const selectedProducts = Array.isArray(productValue) ? productValue : typeof productValue === 'string' && productValue ? [productValue] : [];
          const resolvedProducts = await resolveProducts(tx, scope.tenantId, selectedProducts);
          const email = mapped.email || undefined, phone = mapped.phone || undefined;
          if (!email && !phone) throw new ValidationError('An email address or phone number is required.');
          const identity: Prisma.LeadWhereInput[] = [];
          if (email) identity.push({ email: { contains: email, mode: 'insensitive' } });
          // Narrow legacy formatted numbers before comparing their normalized identity.
          if (phone) identity.push({ phone: { contains: phone.slice(-4) } });
          const leadCandidates = await tx.lead.findMany({ where: { ...scope, OR: identity }, take: 101 });
          const contactCandidates = await tx.contact.findMany({ where: { ...scope, OR: identity as Prisma.ContactWhereInput[] }, take: 101 });
          // Include archived people in matching; never revive or duplicate them silently.
          const conflict = () => new ConflictError('We could not safely match this inquiry. Please contact the company directly.');
          if (leadCandidates.length > 100 || contactCandidates.length > 100) throw conflict();
          const matches = (p: { email: string | null; phone: string | null }) =>
            !!((email && p.email?.trim().toLowerCase() === email) || (phone && p.phone && normalizePhone(p.phone) === normalizePhone(phone)));
          const leads = leadCandidates.filter(matches), contacts = contactCandidates.filter(matches);
          if (leads.length > 1 || contacts.length > 1) throw conflict();
          const lead = leads[0]; let contact = contacts[0];
          if (lead?.contactId) {
            const linked = await tx.contact.findFirst({ where: { ...scope, id: lead.contactId } });
            if (!linked || (contact && linked.id !== contact.id)) throw conflict();
            contact = linked;
          }
          if (lead && contact && lead.contactId !== contact.id) {
            const sameEmail = email && lead.email?.trim().toLowerCase() === email && contact.email?.trim().toLowerCase() === email;
            const samePhone = phone && lead.phone && contact.phone && normalizePhone(lead.phone) === normalizePhone(phone) && normalizePhone(contact.phone) === normalizePhone(phone);
            if (!sameEmail && !samePhone) throw conflict();
          }
          if (lead?.isArchived || contact?.isArchived) throw conflict();
          let leadId: string | null = lead?.id ?? null, contactId: string | null = contact?.id ?? null;
          if (lead && !contact) {
            const won = await tx.deal.findFirst({ where: { ...scope,
              AND: [ { OR: [{ leadId: lead.id }, { leadDeals: { some: { ...scope, leadId: lead.id } } }] },
                { OR: [{ stage: { ...scope, isWon: true } }, { stageHistories: { some: { ...scope, newStage: { ...scope, isWon: true } } } }] } ],
            } });
            if (won) {
              const linkedPeople = await tx.contactDeal.findMany({ where: { ...scope, dealId: won.id }, select: { contactId: true } });
              const linkedIds = [...new Set([won.contactId, ...linkedPeople.map(p => p.contactId)].filter((id): id is string => !!id))];
              if (linkedIds.length > 1) throw conflict();
              if (linkedIds.length === 1) {
                const linked = await tx.contact.findFirst({ where: { ...scope, id: linkedIds[0] } });
                if (!linked || linked.isArchived) throw conflict();
                contact = linked;
              }
              // Preserve the original lead, deal, owner, and product history. Repair only conversion linkage.
              contact ??= await tx.contact.create({ data: { ...scope, firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone,
                company: lead.companyName, address: lead.address, accountId: lead.accountId, assignedUserId: lead.assignedUserId,
                productInterests: lead.productInterest, source: lead.source, lifecycleStage: 'CUSTOMER', customerType: 'Customer', customerSince: won.closedAt ?? new Date(), convertedAt: new Date() } });
              contactId = contact.id;
              await tx.lead.update({ where: { id: lead.id, ...scope }, data: { contactId, convertedAt: lead.convertedAt ?? new Date() } });
            }
          }
          if (contactId) leadId = null;
          if (leadId && lead && !contactId) {
            // A repeat inquiry can add interests, but must never replace historical Deals or owners.
            await tx.lead.update({ where: { id: leadId, ...scope }, data: {
              productInterestIds: [...new Set([...lead.productInterestIds, ...selectedProducts])],
              productInterest: [...new Set([...lead.productInterest, ...resolvedProducts.map(p => p.name)])],
            } });
            await createProductDeals(tx, scope.tenantId, leadId);
          }
          if (!leadId && !contactId) {
            const names = (mapped.fullName || '').split(/\s+/);
            const created = await createAssignedLead(tx, { ...scope, firstName: mapped.firstName || names[0] || 'Website', lastName: mapped.lastName || names.slice(1).join(' ') || 'Inquiry',
              email, phone, companyName: mapped.companyName || null, website: mapped.website || null, address: mapped.address || null,
              productInterestIds: selectedProducts, source: 'Website' });
            leadId = created.id;
          }
          const submission = await tx.formSubmission.create({ data: { ...scope, formId: live.id, requestKey: input.requestId, publishedVersion: live.publishedVersion,
            publishedConfig: { name: config.name, fields: config.fields, design: config.design }, leadId, contactId, email, phone,
            values: validated.values, tracking: config.settings.trackUrlParams ? input.tracking : {}, notificationStatus: config.settings.notificationEmail ? 'pending' : 'not_requested' } });
          return { submission, notificationEmail: config.settings.notificationEmail };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
        // Notification cannot roll back accepted data. Do not include visitor HTML or identity in mail/logs.
        if (accepted.notificationEmail) {
          let status = 'failed';
          try { const result = await sendMail({ to: accepted.notificationEmail, subject: 'New LeadCRM form submission', html: '<p>A new website inquiry has been recorded. Open Forms in LeadCRM to view submission history.</p>' }); status = result.submitted ? 'sent' : 'failed'; }
          catch { console.error('[Forms] Notification failed', { submissionId: accepted.submission.id }); }
          try { await prisma.formSubmission.update({ where: { id: accepted.submission.id, ...scope }, data: { notificationStatus: status } }); }
          catch { console.error('[Forms] Notification status update failed', { submissionId: accepted.submission.id }); }
        }
        return { accepted: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) {
          if (attempt < 3) continue;
          throw new ConflictError('Another inquiry is being processed. Please try again.');
        }
        throw error;
      }
    }
    throw new ConflictError('Please try again.');
  });
}
