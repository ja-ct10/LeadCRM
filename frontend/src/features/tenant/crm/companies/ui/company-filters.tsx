'use client';

import React from 'react';
import { TrelloFilter } from '@/shared/components/TrelloFilter';
import { COMPANY_INDUSTRIES, COMPANY_SIZES } from '../constants/company.constants';
import type { CompanyFilters } from '../types/company.types';

interface CompanyFiltersBarProps {
  filters: CompanyFilters;
  onChange: (filters: CompanyFilters) => void;
}

export default function CompanyFiltersBar({ filters, onChange }: CompanyFiltersBarProps) {
  return (
    <TrelloFilter
      searchTerm={filters.search}
      setSearchTerm={search => onChange({ ...filters, search })}
      statuses={COMPANY_INDUSTRIES.map(i => ({ id: i, label: i }))}
      selectedStatuses={filters.industries}
      setSelectedStatuses={industries => onChange({ ...filters, industries })}
      labels={COMPANY_SIZES.map(s => ({ id: s, label: s }))}
      selectedLabels={filters.sizes}
      setSelectedLabels={sizes => onChange({ ...filters, sizes })}
      labelsTitle="Size"
    />
  );
}
