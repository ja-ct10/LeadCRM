'use client';

import React from 'react';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SideSheet } from '@/shared/components/SideSheet';
import { useHasPermission } from '@/shared/hooks/usePermissions';
import { useCompanies } from '../hooks/use-companies';
import CompaniesTable from '../ui/companies-table';
import CompanyFilters from '../ui/company-filters';
import CompanyForm from '../ui/company-form';

export default function CompaniesPage() {
  const canCreate = useHasPermission('contacts.create');
  const canEdit   = useHasPermission('contacts.edit');
  const canDelete = useHasPermission('contacts.delete');

  const {
    companies, totalCount, filters, setFilters,
    isFormOpen, editTarget,
    handleCreate, handleUpdate, handleDelete,
    handleOpenCreate, handleOpenEdit, handleCloseForm,
  } = useCompanies();

  const handleSubmit = (data: any) => {
    if (editTarget) {
      handleUpdate(editTarget.id, data);
    } else {
      handleCreate(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-500" />
            Companies
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalCount} {totalCount === 1 ? 'company' : 'companies'} total
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleOpenCreate} className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Company
          </Button>
        )}
      </div>

      {/* Filters */}
      <CompanyFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
        <CompaniesTable
          companies={companies}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      {/* Create / Edit Sheet */}
      <SideSheet
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Company' : 'New Company'}
      >
        <CompanyForm
          initial={editTarget}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      </SideSheet>
    </div>
  );
}
