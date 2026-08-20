/**
 * Contact/Lead types — re-exported from the shared package.
 * This ensures compile-time detection of field name mismatches
 * between frontend and backend via TypeScript strict mode.
 *
 * DO NOT define standalone types here. All canonical CRM entity
 * types live in @leadcrm/shared.
 */
export type { Contact, ContactStatus, CreateContactRequest, UpdateContactRequest } from '@leadcrm/shared';
