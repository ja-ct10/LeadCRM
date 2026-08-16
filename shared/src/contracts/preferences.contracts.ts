/**
 * Preference API request/response contracts.
 * Defines the shape of all preference endpoint communications.
 */

import type { ColumnConfigItem } from '../types/preferences';

/** Source layer that resolved the effective columns. */
export type ColumnSource = 'user' | 'tenant' | 'system';

/** Successful column preference response payload. */
export interface ColumnPreferenceData {
  module: string;
  source: ColumnSource;
  columns: ColumnConfigItem[];
}

/** Success envelope for column preference endpoints. */
export interface ColumnPreferenceSuccessResponse {
  success: true;
  data: ColumnPreferenceData;
}

/** Validation error detail for a specific field. */
export interface ColumnPreferenceErrorDetail {
  field: string;
  reason: string;
}

/** Error envelope for column preference endpoints. */
export interface ColumnPreferenceErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ColumnPreferenceErrorDetail[];
  };
}

/** Union type for all column preference API responses. */
export type ColumnPreferenceResponse =
  | ColumnPreferenceSuccessResponse
  | ColumnPreferenceErrorResponse;

/** Request body for saving column preferences (PUT endpoints). */
export interface SaveColumnsRequest {
  columns: ColumnConfigItem[];
}
