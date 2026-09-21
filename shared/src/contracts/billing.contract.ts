import { Invoice } from '../types/billing.types';


export interface InvoiceListResponse {
  data: Invoice[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}
