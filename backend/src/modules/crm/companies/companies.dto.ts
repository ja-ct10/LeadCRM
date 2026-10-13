import { z } from 'zod';
import { CustomFieldValuesSchema, COMPANY_SIZE_OPTIONS } from '@leadcrm/shared';
import { recordText, recordName } from '../record-validation';
import { consolidateAccountAddress } from './account-address';

const id = () => z.string().min(1);

const CompanyFieldsSchema = z.object({
  customFieldValues: CustomFieldValuesSchema.optional(),
  productInterestOther: recordText(1000).nullable().optional(),
  name:           recordName(255),
  industry:       recordText().optional(),
  size:           z.enum(COMPANY_SIZE_OPTIONS).optional(),
  website:        z.string().url().optional().or(z.literal('')),
  tags:           z.array(recordText(200)).max(100).default([]),
  address:        recordText().optional(),
  city:           recordText().optional(),
  province:       recordText().optional(),
  country:        recordText().optional(),
  assignedUserId: id().optional(),
  notes:          recordText().optional(),
  internalNotes:  recordText().optional(),
  productInterests: z.array(recordText(200)).max(100).optional(),
  activeProducts: z.array(recordText(200)).max(100).optional(),
});

// Accept legacy split-address input, but persist only the consolidated address.
function fullAddress<T extends { address?: string; city?: string; province?: string; country?: string }>(input: T) {
  const { city, province, country, ...data } = input;
  return { ...data, ...(['address', 'city', 'province', 'country'].some(key => key in input)
    ? { address: consolidateAccountAddress(input) ?? undefined } : {}) };
}
export const CreateCompanySchema = CompanyFieldsSchema.transform(fullAddress);
export const UpdateCompanySchema = CompanyFieldsSchema.partial().extend({
  assignedUserId: id().nullable().optional(),
  productInterestIds: z.array(z.string().uuid()).max(100).optional(),
  activeProductIds: z.array(z.string().uuid()).max(100).optional(),
}).transform(fullAddress);

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>;
