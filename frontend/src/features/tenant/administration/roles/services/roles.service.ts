'use client';

import { rolesApi } from '@/shared/services/roles.api';
import type { RoleListItem, RoleDetail } from '@/store/types/roles.types';
import type { CreateRolePayload, UpdateRolePayload } from '@/shared/services/roles.api';

export const rolesService = {
  getAll: async (): Promise<RoleListItem[]> => {
    const res = await rolesApi.list();
    return res.data ?? [];
  },

  getById: async (id: string): Promise<RoleDetail> => {
    const res = await rolesApi.get(id);
    return res.data;
  },

  create: async (payload: CreateRolePayload): Promise<RoleListItem> => {
    const res = await rolesApi.create(payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateRolePayload): Promise<RoleListItem> => {
    const res = await rolesApi.update(id, payload);
    return res.data;
  },

  archive: async (id: string): Promise<void> => {
    await rolesApi.archive(id);
  },

  assign: async (userId: string, roleId: string): Promise<void> => {
    await rolesApi.assign(userId, roleId);
  },

  unassign: async (userId: string, roleId: string): Promise<void> => {
    await rolesApi.unassign(userId, roleId);
  },
};
