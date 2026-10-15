import type { Prisma } from '@prisma/client';
import { ValidationError } from '../../../shared/errors/http-error';

type Kind = 'lead' | 'contact';
type Selection = { ids?: string[]; names?: string[]; activeNames?: string[]; activeIds?: string[] };
type Previous = { id?: string; productInterest?: string[]; productInterestIds?: string[]; productInterests?: string[]; activeProducts?: string[]; productLinks?: Array<{ productInterestId: string; activeProduct: boolean }> };

/** Build a single nested write, so the record and its links commit atomically.
 * Previous selections may retain retired products or unresolved historical text.
 * New selections must resolve to an active, tenant-owned catalog entry.
 */
export async function productRelationData(tx: Prisma.TransactionClient, kind: Kind, tenantId: string,
  selection: Selection, previous?: Previous, updating = false) {
  if (kind === 'contact' && (selection.activeNames !== undefined || selection.activeIds !== undefined)) throw new ValidationError('Contact Active Products is retired. Use confirmed Closed Won Deals for sales history.');
  const catalog = await tx.productInterest.findMany({ where: { tenantId } });
  const previousNames = [...(previous?.productInterest ?? previous?.productInterests ?? []), ...(kind === 'contact' ? [] : previous?.activeProducts ?? [])];
  const priorLinks = !previous?.id ? [] : kind === 'lead'
    ? await tx.leadProductInterest.findMany({ where: { tenantId, leadId: previous.id } })
    : await tx.contactProductInterest.findMany({ where: { tenantId, contactId: previous.id } });
  const previousIds = [...(previous?.productInterestIds ?? []), ...priorLinks.map(link => link.productInterestId), ...(previous?.productLinks ?? []).map(link => link.productInterestId)];
  const ids = selection.ids;
  const names = selection.names ?? previous?.productInterest ?? previous?.productInterests ?? [];
  const activeNames = kind === 'contact' ? [] : selection.activeNames ?? previous?.activeProducts ?? [];
  const entries = new Map<string, { productInterestId: string; tenantId: string; position: number; interested: boolean; activeProduct: boolean }>();
  const unresolvedNames: string[] = [], unresolvedActive: string[] = [];
  const resolve = (value: string, byId: boolean, activeProduct: boolean) => {
    let matches = catalog.filter(p => byId ? p.id === value : p.name.trim().toLowerCase() === value.trim().toLowerCase());
    const retained = byId ? previousIds.includes(value) : previousNames.includes(value);
    if (!byId) {
      const prior = matches.filter(p => previousIds.includes(p.id));
      // Names are only transport compatibility. Never replace a retained FK with
      // a newer catalog entry that reuses a retired Product's name.
      if (retained && prior.length === 1) matches = prior;
      else if (!retained) matches = matches.filter(p => p.active);
    }
    if (matches.length !== 1) {
      if (!byId && retained) { (activeProduct ? unresolvedActive : unresolvedNames).push(value); return; }
      throw new ValidationError('Select an unambiguous Product Interest from the product catalog.');
    }
    const product = matches[0];
    if (!product.active && !retained && !previousIds.includes(product.id)) throw new ValidationError('Select available Product Interests.');
    const entry = entries.get(product.id) ?? { productInterestId: product.id, tenantId, position: entries.size, interested: false, activeProduct: false };
    if (activeProduct) entry.activeProduct = true; else entry.interested = true;
    entries.set(product.id, entry);
  };
  for (const value of ids ?? names) resolve(value, !!ids, false);
  for (const value of selection.activeIds ?? activeNames) resolve(value, !!selection.activeIds, true);
  // Preserve separately governed purchase flags and IDs without turning them
  // into current interests or exposing an editable Active Products feature.
  if (kind === 'contact') for (const link of [...priorLinks, ...(previous?.productLinks ?? [])]) {
    if (!('activeProduct' in link) || !link.activeProduct) continue;
    const entry = entries.get(link.productInterestId);
    if (entry) entry.activeProduct = true;
    else entries.set(link.productInterestId, { productInterestId: link.productInterestId, tenantId, position: entries.size, interested: false, activeProduct: true });
  }
  const normalized = !unresolvedNames.length && !unresolvedActive.length;
  const links = [...entries.values()];
  // Keep unresolved records on the explicit compatibility branch until staff resolve them.
  const interestNames = [...links.filter(p => p.interested).map(p => catalog.find(c => c.id === p.productInterestId)!.name), ...unresolvedNames];
  const active = [...links.filter(p => p.activeProduct).map(p => catalog.find(c => c.id === p.productInterestId)!.name), ...unresolvedActive];
  return {
    productsNormalized: normalized,
    ...(kind === 'lead'
      ? { productInterest: normalized ? [] : interestNames, productInterestIds: normalized ? [] : links.map(p => p.productInterestId) }
      : { productInterests: normalized ? [] : interestNames }),
    productLinks: {
      ...(updating ? { deleteMany: {} } : {}),
      // Composite parent relations supply tenantId; Prisma excludes inherited FKs here.
      create: links.map(({ interested, activeProduct, tenantId: _tenantId, ...link }) => kind === 'lead' ? link : { ...link, interested, activeProduct }),
    },
  };
}
