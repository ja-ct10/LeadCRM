/**
 * Lead types — re-exported from the shared package.
 * The backend Lead model is the same as Contact (same Prisma model).
 * This ensures compile-time detection of field name mismatches
 * between frontend and backend via TypeScript strict mode.
 *
 * DO NOT define standalone types here. All canonical CRM entity
 * types live in @leadcrm/shared.
 */
export type { Contact as Lead, ContactStatus as LeadStatus } from '@leadcrm/shared';
