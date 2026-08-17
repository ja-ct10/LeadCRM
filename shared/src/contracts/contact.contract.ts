/**
 * Contact API contracts — request/response shapes for the contacts module.
 *
 * Entity types and request interfaces are defined in ../types/contact.types.ts.
 * This file re-exports them and adds response-specific contracts.
 */

import type { Contact } from '../types/contact.types';

// Re-export request types from types for consumers that import from contracts
export type { CreateContactRequest, UpdateContactRequest } from '../types/contact.types';

/** Paginated list response for the contacts endpoint. */
export interface ContactListResponse {
  data: Contact[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
