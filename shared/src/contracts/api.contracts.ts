/**
 * Standard API response shape — ALL endpoints must use this format.
 * Enforced by the error middleware and all controllers.
 */

// Success response
export interface ApiResponse<T = unknown> {
  success: true;
  data:    T;
}

// Error response
export interface ApiError {
  success: false;
  error: {
    code:      string;    // e.g. CONTACT_NOT_FOUND | PLAN_LIMIT_EXCEEDED | VALIDATION_ERROR
    message:   string;    // Human-readable message
    field?:    string;    // For validation errors — which field failed
    requestId: string;    // For debugging (correlate with server logs)
    timestamp: string;    // ISO timestamp
  };
}

// Paginated list response
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total:       number;
    page:        number;
    pageSize:    number;
    hasNextPage: boolean;
    cursor?:     string;  // For cursor-based pagination (future)
  };
}

// Common query params for list endpoints
export interface ListQueryParams {
  page?:     number;
  pageSize?: number;
  search?:   string;
  sortBy?:   string;
  sortDir?:  'asc' | 'desc';
  cursor?:   string;
}
