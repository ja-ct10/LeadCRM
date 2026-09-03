'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { RoleListItem, RoleDetail } from '@/store/types/roles.types';
import { rolesService } from '../services/roles.service';

interface UseRolesReturn {
  roles:          RoleListItem[];
  isLoading:      boolean;
  error:          string | null;
  searchQuery:    string;
  setSearchQuery: (q: string) => void;
  filteredRoles:  RoleListItem[];
  selectedRole:   RoleDetail | null;
  isDetailOpen:   boolean;
  isBuilderOpen:  boolean;
  editingRole:    RoleListItem | null;
  openDetail:     (id: string) => void;
  closeDetail:    () => void;
  openBuilder:    (role?: RoleListItem) => void;
  closeBuilder:   () => void;
  refetch:        () => void;
  handleArchive:  (id: string) => Promise<void>;
}

export function useRoles(): UseRolesReturn {
  const [roles, setRoles]             = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await rolesService.getAll();
      setRoles(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q),
    );
  }, [roles, searchQuery]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const detail = await rolesService.getById(id);
      setSelectedRole(detail);
      setIsDetailOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load role');
    }
  }, []);

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedRole(null);
  }, []);

  const openBuilder = useCallback((role?: RoleListItem) => {
    setEditingRole(role ?? null);
    setIsBuilderOpen(true);
  }, []);

  const closeBuilder = useCallback(() => {
    setIsBuilderOpen(false);
    setEditingRole(null);
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    await rolesService.archive(id);
    setRoles(prev => prev.filter(r => r.id !== id));
  }, []);

  return {
    roles,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    filteredRoles,
    selectedRole,
    isDetailOpen,
    isBuilderOpen,
    editingRole,
    openDetail,
    closeDetail,
    openBuilder,
    closeBuilder,
    refetch: loadRoles,
    handleArchive,
  };
}
