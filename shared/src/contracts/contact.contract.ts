import { Contact, ContactStatus } from '../types/contact.types';

// API shape contracts — what the API accepts and returns
// Both frontend services and backend controllers reference these

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: ContactStatus;
  source?: string;
  notes?: string;
}

export interface UpdateContactRequest extends Partial<CreateContactRequest> {}

export interface ContactListResponse {
  data: Contact[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
