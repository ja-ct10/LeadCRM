'use client';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse, PaginatedResponse } from '@leadcrm/shared';
import type { ServiceOrder } from '@/store/types';

export const serviceOrdersService = {
  getAll: (): Promise<PaginatedResponse<ServiceOrder>> =>
    apiClient.get<PaginatedResponse<ServiceOrder>>('/operations/service-orders'),

  getById: (id: string): Promise<ApiResponse<ServiceOrder>> =>
    apiClient.get<ApiResponse<ServiceOrder>>(`/operations/service-orders/${id}`),

  update: (id: string, data: Partial<ServiceOrder>): Promise<ApiResponse<ServiceOrder>> =>
    apiClient.put<ApiResponse<ServiceOrder>>(`/operations/service-orders/${id}`, data),
};
