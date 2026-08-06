'use client';

import React from 'react';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { SideSheet } from '@/shared/components/side-sheet';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useCompanies } from '../hooks/use-companies';
import CompaniesTable from '../ui/companies-table';
import CompanyFilters from '../ui/company-filters';
import CompanyForm from '../ui/company-form';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';

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

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    setPageSize,
    paginateItems,
  } = usePagination({
    totalItems: companies.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [filters],
  });

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleOpenCreate}
                  size="icon"
                  aria-label="New Company"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Company</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Filters */}
      <CompanyFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
        <CompaniesTable
          companies={paginateItems(companies)}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      <div className="mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
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
