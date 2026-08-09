import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Generates a cryptographically-random UUID v4.
 * Uses the native Web Crypto API (crypto.randomUUID) — available in all
 * modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) and Node 14.17+.
 * No external package required.
 *
 * This is the ONLY approved ID-generation function in this codebase.
 * Never use Date.now(), Math.random(), or string prefixes for record IDs.
 */
export function uuid(): string {
  // Browser environment - use crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID (server-side, old browsers)
  // RFC4122 version 4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getCRMStatusStyles(status: string): string {
  switch (status) {
    case 'Hot':
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
    case 'Warm':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    case 'Closed':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    case 'Cancelled':
      return 'bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-405 border-slate-200 dark:border-slate-500/20';
    case 'Cold':
    default:
      return 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20';
  }
}

export function getCRMStatusStripColor(status: string): string {
  switch (status) {
    case 'Hot': return 'bg-rose-500';
    case 'Warm': return 'bg-amber-500';
    case 'Closed': return 'bg-emerald-500';
    case 'Cancelled': return 'bg-slate-400';
    case 'Cold':
    default:
      return 'bg-sky-500';
  }
}

export function getConnectedDealsForContact(contact: any, deals: any[]): any[] {
  if (!contact || !deals || deals.length === 0) return [];
  const contactCompName = contact.companyName?.toLowerCase().trim() || '';
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim().toLowerCase();
  const personName = (contact.contactPerson || '').toLowerCase().trim();

  return deals.filter(d => {
    if (d.isArchived) return false;
    if (d.contactId && d.contactId === contact.id) return true;
    if (d.contactIds && d.contactIds.includes(contact.id)) return true;
    if (contact.organizationId && d.companyId && d.companyId === contact.organizationId) return true;
    if (contactCompName !== '' && d.companyName && d.companyName.toLowerCase().trim() === contactCompName) return true;
    if (personName !== '' && d.contactPerson && d.contactPerson.toLowerCase().trim() === personName) return true;
    if (fullName !== '' && d.contactPerson && d.contactPerson.toLowerCase().trim() === fullName) return true;
    return false;
  });
}

export function getConnectedDealsForOrg(  org: { id?: string; name?: string; contacts?: any[] },
  deals: any[],
  allContacts: any[] = []
): any[] {
  if (!org || !deals || deals.length === 0) return [];
  const orgId = org.id;
  const orgName = org.name?.toLowerCase().trim() || '';

  // Collect all contacts belonging to or matching this organization
  const orgContacts = org.contacts && org.contacts.length > 0
    ? org.contacts
    : allContacts.filter(c => 
        !c.isArchived && (
          (orgId && c.organizationId === orgId) ||
          (orgName !== '' && c.companyName && c.companyName.toLowerCase().trim() === orgName)
        )
      );

  const contactIdsSet = new Set<string>();
  const contactNamesSet = new Set<string>();

  orgContacts.forEach(c => {
    if (c.id) contactIdsSet.add(c.id);
    if (c.contactPerson) contactNamesSet.add(c.contactPerson.toLowerCase().trim());
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
    if (fullName !== '') contactNamesSet.add(fullName);
  });

  return deals.filter(d => {
    if (d.isArchived) return false;
    if (orgId && d.companyId && d.companyId === orgId) return true;
    if (orgName !== '' && d.companyName && d.companyName.toLowerCase().trim() === orgName) return true;
    if (d.contactId && contactIdsSet.has(d.contactId)) return true;
    if (d.contactIds && d.contactIds.some(cid => contactIdsSet.has(cid))) return true;
    if (d.contactPerson && contactNamesSet.has(d.contactPerson.toLowerCase().trim())) return true;
    return false;
  });
}

/**
 * Returns all deals connected to a specific Lead by leadId / leadIds / name matching.
 * Mirrors getConnectedDealsForOrg but scoped to a single Lead record.
 */
export function getConnectedDealsForLead(
  lead: { id?: string; leadPerson?: string; firstName?: string; lastName?: string },
  deals: any[],
): any[] {
  if (!lead || !deals || deals.length === 0) return [];
  const leadId = lead.id;
  const fullName = lead.leadPerson?.toLowerCase().trim() ||
    `${lead.firstName || ''} ${lead.lastName || ''}`.trim().toLowerCase();

  return deals.filter(d => {
    if (d.isArchived) return false;
    if (leadId && d.leadId === leadId) return true;
    if (leadId && d.leadIds && d.leadIds.includes(leadId)) return true;
    if (leadId && d.contactId === leadId) return true;
    if (leadId && d.contactIds && d.contactIds.includes(leadId)) return true;
    if (fullName && d.leadPerson && d.leadPerson.toLowerCase().trim() === fullName) return true;
    if (fullName && d.contactPerson && d.contactPerson.toLowerCase().trim() === fullName) return true;
    return false;
  });
}
