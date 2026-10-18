import { z } from 'zod';

export const DealAddressSourceSchema = z.object({
  type: z.enum(['lead', 'contact', 'account']),
  id: z.string().trim().min(1).max(255),
}).strict();
export type DealAddressSource = z.infer<typeof DealAddressSourceSchema>;
export interface DealAddressOption extends DealAddressSource { label: string; address: string }
export interface DealAddressContext {
  effectiveAddress: string | null;
  customerAddress: string | null;
  customerStatus: 'linked' | 'choice_required' | 'empty' | 'unavailable';
  source: DealAddressSource | null;
  status: 'override' | 'linked' | 'choice_required' | 'empty' | 'unavailable';
  options: DealAddressOption[];
}
export const dealAddressKey = (source: DealAddressSource) => `${source.type}:${source.id}`;

/** Resolve references at read time; never turn a linked value into a stored override. */
export function resolveDealAddress(address: string | null | undefined, selection: unknown, options: DealAddressOption[]): DealAddressContext {
  const parsed = DealAddressSourceSchema.safeParse(selection);
  const source = parsed.success ? parsed.data : null;
  const selected = source ? options.find(option => dealAddressKey(option) === dealAddressKey(source)) : undefined;
  const automatic = selection == null && options.length === 1 ? options[0] : undefined;
  const customerAddress = selected?.address ?? automatic?.address ?? null;
  const customerStatus = selection != null ? selected ? 'linked' : 'unavailable' : automatic ? 'linked' : options.length ? 'choice_required' : 'empty';
  return { options, source: source ?? (automatic ? { type: automatic.type, id: automatic.id } : null), customerAddress, customerStatus,
    effectiveAddress: address?.trim() ? address : customerAddress, status: address?.trim() ? 'override' : customerStatus };
}

export const dealCustomerAddressMessage = (context: DealAddressContext) => dealAddressMessage({ ...context, effectiveAddress: context.customerAddress, status: context.customerStatus });

export function dealAddressMessage(context: DealAddressContext): string {
  if (context.effectiveAddress) return context.effectiveAddress;
  if (context.status === 'choice_required') return 'Choose a linked address';
  if (context.status === 'unavailable') return 'The selected customer address is unavailable. Choose another linked address or provide a Deal override.';
  return 'No linked customer address available';
}
