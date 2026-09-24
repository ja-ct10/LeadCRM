'use client';
import { campaignsApi } from '@/shared/services/campaigns.api';
// Preserve the older feature service names while sharing the canonical transport.
export const campaignsService = { getAll: campaignsApi.list, getById: campaignsApi.get, create: campaignsApi.create, update: campaignsApi.update, delete: campaignsApi.archive, send: campaignsApi.send };
