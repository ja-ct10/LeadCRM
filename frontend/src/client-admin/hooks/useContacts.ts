'use client';
import { useMemo, useState } from 'react';
import { Contact } from '../../store/types';

interface UseContactsOptions {
  contacts: Contact[];
}

/**
 * Encapsulates all filter, sort, and search logic for the contacts list.
 * Extracted from ContactsPage to keep the page thin and logic reusable.
 */
export function useContacts({ contacts }: UseContactsOptions) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedView, setSelectedView] = useState('');

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (c.isArchived) return false;

      const matchesSearch =
        !searchTerm ||
        c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.companyName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(c.status);

      const matchesSource =
        selectedSources.length === 0 || selectedSources.includes(c.leadSource);

      const matchesType =
        selectedTypes.length === 0 ||
        selectedTypes.includes(c.customerType || 'Individual');

      return matchesSearch && matchesStatus && matchesSource && matchesType;
    });
  }, [contacts, searchTerm, selectedStatuses, selectedSources, selectedTypes]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setSelectedSources([]);
    setSelectedTypes([]);
    setSelectedView('');
  };

  const activeFilterCount =
    (searchTerm ? 1 : 0) +
    selectedStatuses.length +
    selectedSources.length +
    selectedTypes.length;

  return {
    filteredContacts,
    searchTerm,
    setSearchTerm,
    selectedStatuses,
    setSelectedStatuses,
    selectedSources,
    setSelectedSources,
    selectedTypes,
    setSelectedTypes,
    selectedView,
    setSelectedView,
    clearFilters,
    activeFilterCount,
  };
}
