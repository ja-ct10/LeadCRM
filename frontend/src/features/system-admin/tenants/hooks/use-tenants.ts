'use client';
import { useMemo, useState } from 'react';
import { Tenant } from '@/store/types';

type StatusFilter = 'all' | 'pending' | 'active' | 'inactive' | 'rejected';

interface UseTenantsOptions {
  tenants: Tenant[];
}

/**
 * Encapsulates all filter and search logic for the System Admin tenant list.
 * Extracted from AdminConsole so the control plane pages stay thin.
 */
export function useTenants({ tenants }: UseTenantsOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredTenants = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return tenants.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.email ?? '').toLowerCase().includes(normalizedQuery);

      // Map 'suspended' → 'inactive' for UI display
      const normalizedStatus = t.status === 'suspended' ? 'inactive' : t.status;
      const matchesStatus =
        statusFilter === 'all' || normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tenants, searchQuery, statusFilter]);

  const counts = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    pending: tenants.filter((t) => t.status === 'pending').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
    rejected: tenants.filter((t) => t.status === 'rejected').length,
  }), [tenants]);

  return {
    filteredTenants,
    counts,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
  };
}
