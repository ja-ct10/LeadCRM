'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { companiesService } from '../services/companies.service';
import type { Company, CompanyFilters } from '../types/company.types';
import type { CompanyFormValues } from '../schemas/company.schema';

const EMPTY_FILTERS: CompanyFilters = {
  search: '',
  industries: [],
  sizes: [],
};

export function useCompanies() {
  const { tenant, user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(() =>
    companiesService.getAll().filter(c => c.tenantId === tenant?.id && !c.isArchived),
  );
  const [filters, setFilters] = useState<CompanyFilters>(EMPTY_FILTERS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);

  const filtered = useMemo(() => {
    let result = companies;
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
  }, [companies, filters]);

  const refresh = useCallback(() => {
    setCompanies(
      companiesService.getAll().filter(c => c.tenantId === tenant?.id && !c.isArchived),
    );
  }, [tenant?.id]);

  const handleCreate = useCallback((data: CompanyFormValues) => {
    if (!tenant) return;
    const all = companiesService.getAll();
    const newCompany: Company = {
      ...data,
      id: 'company_' + Date.now(),
      tenantId: tenant.id,
      createdAt: new Date().toISOString(),
    };
    companiesService.save([...all, newCompany]);
    refresh();
    setIsFormOpen(false);
  }, [tenant, refresh]);

  const handleUpdate = useCallback((id: string, data: CompanyFormValues) => {
    const all = companiesService.getAll();
    companiesService.save(all.map(c => c.id === id ? { ...c, ...data } : c));
    refresh();
    setIsFormOpen(false);
    setEditTarget(null);
  }, [refresh]);

  const handleDelete = useCallback((id: string) => {
    const all = companiesService.getAll();
    companiesService.save(all.map(c => c.id === id ? { ...c, isArchived: true } : c));
    refresh();
  }, [refresh]);

  const handleOpenCreate = useCallback(() => {
    setEditTarget(null);
    setIsFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((company: Company) => {
    setEditTarget(company);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditTarget(null);
  }, []);

  return {
    companies: filtered,
    totalCount: companies.length,
    filters,
    setFilters,
    isFormOpen,
    editTarget,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
  };
}
