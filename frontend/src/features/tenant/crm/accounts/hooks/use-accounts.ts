'use client';

import { uuid } from '@/lib/utils';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/store/AuthContext';
import { accountsService } from '../services/accounts.service';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Account, AccountFilters } from '../types/account.types';
import type { AccountFormValues } from '../schemas/account.schema';

const EMPTY_FILTERS: AccountFilters = {
  search: '',
  industries: [],
  sizes: [],
};

export function useAccounts() {
  const { tenant } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState<AccountFilters>(EMPTY_FILTERS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!tenant) return;
    setIsLoading(true);
    try {
      if (USE_MOCK_DATA) {
        // Mock mode: load from localStorage
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        setAccounts(all.filter(c => c.tenantId === tenant.id && !c.isArchived));
      } else {
        const res = await accountsService.getAll({ limit: 100 });
        const data = (res?.data ?? []) as Account[];
        setAccounts(data.filter(c => !c.isArchived));
      }
    } catch (err) {
      console.error('[useAccounts] Failed to load accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filtered = useMemo(() => {
    let result = accounts;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q),
      );
    }
    if (filters.industries.length > 0) {
      result = result.filter(c => filters.industries.includes(c.industry ?? ''));
    }
    if (filters.sizes.length > 0) {
      result = result.filter(c => filters.sizes.includes(c.size ?? ''));
    }
    return result;
  }, [accounts, filters]);

  const handleCreate = useCallback(async (data: AccountFormValues) => {
    if (!tenant) return;
    try {
      if (USE_MOCK_DATA) {
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        const newAccount: Account = {
          ...data,
          id: uuid(),
          tenantId: tenant.id,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem('leadcrm_accounts', JSON.stringify([...all, newAccount]));
      } else {
        await accountsService.create({ ...data, tenantId: tenant.id });
      }
      await loadAccounts();
      setIsFormOpen(false);
    } catch (err) {
      console.error('[useAccounts] Failed to create account:', err);
    }
  }, [tenant, loadAccounts]);

  const handleUpdate = useCallback(async (id: string, data: AccountFormValues) => {
    try {
      if (USE_MOCK_DATA) {
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('leadcrm_accounts', JSON.stringify(
          all.map(c => c.id === id ? { ...c, ...data } : c)
        ));
      } else {
        await accountsService.update(id, data as unknown as Record<string, unknown>);
      }
      await loadAccounts();
      setIsFormOpen(false);
      setEditTarget(null);
    } catch (err) {
      console.error('[useAccounts] Failed to update account:', err);
    }
  }, [loadAccounts]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      if (USE_MOCK_DATA) {
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('leadcrm_accounts', JSON.stringify(
          all.map(c => c.id === id ? { ...c, isArchived: true } : c)
        ));
      } else {
        await accountsService.archive(id);
      }
      await loadAccounts();
    } catch (err) {
      console.error('[useAccounts] Failed to delete account:', err);
    }
  }, [loadAccounts]);

  const handleOpenCreate = useCallback(() => { setEditTarget(null); setIsFormOpen(true); }, []);
  const handleOpenEdit   = useCallback((account: Account) => { setEditTarget(account); setIsFormOpen(true); }, []);
  const handleCloseForm  = useCallback(() => { setIsFormOpen(false); setEditTarget(null); }, []);

  return {
    accounts: filtered,
    totalCount: accounts.length,
    filters,
    setFilters,
    isFormOpen,
    isLoading,
    editTarget,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
  };
}
