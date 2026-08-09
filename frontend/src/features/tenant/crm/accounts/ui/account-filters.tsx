'use client';

import React from 'react';
import { TrelloFilter } from '@/shared/components/trello-filter';
import { COMPANY_INDUSTRIES, COMPANY_SIZES } from '../constants/account.constants';
import type { AccountFilters } from '../types/account.types';

interface AccountFiltersBarProps {
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
}

export default function AccountFiltersBar({ filters, onChange }: AccountFiltersBarProps) {
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
