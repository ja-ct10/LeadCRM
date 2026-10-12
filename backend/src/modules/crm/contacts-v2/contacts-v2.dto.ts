import { CrmEmailSchema, CustomFieldValuesSchema, ContactCreationIdentitySchema } from '@leadcrm/shared';
import { z } from 'zod';
import { CrmStatusSchema } from '@leadcrm/shared';
import { recordText, recordName } from '../record-validation';
const ContactFields = ContactCreationIdentitySchema.extend({
  customFieldValues: CustomFieldValuesSchema.optional(),
  productInterestOther: recordText(1000).nullable().optional(),
  firstName: recordName(), lastName: recordName(),
  email: CrmEmailSchema,
  phone: recordText(100).optional(), company: recordText().optional(),
  address: recordText().optional(), jobTitle: recordText().optional(),
  source: recordText().optional(), notes: recordText(10000).optional(),
  status: CrmStatusSchema.default('Warm'),
  accountId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  productInterests: z.array(recordName(200)).max(100).optional(),
}).strict();
const exclusiveProducts = (data: { productInterestIds?: string[]; productInterests?: string[] }) => data.productInterestIds === undefined || data.productInterests === undefined;
export const CreateClientContactSchema = ContactFields.refine(exclusiveProducts, 'Supply Product IDs or legacy names, not both.');
export const UpdateClientContactSchema = ContactFields.omit({ requestId: true }).partial().strict();
