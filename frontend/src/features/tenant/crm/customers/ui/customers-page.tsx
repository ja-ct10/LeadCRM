'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Customer } from '@/store/types';
import { ClientTable } from '@/features/tenant/crm/leads/ui/leads-table';
import { ClientDetailSheet } from '@/features/tenant/crm/leads/ui/lead-detail-sheet';
import { LeadFormSheet as CustomerFormSheet } from '@/features/tenant/crm/leads/ui/lead-form';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { UserCheck, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { toast } from 'sonner';

/**
 * Customers Page — shows only customers with customerType = 'Active Customer'.
 * Set by the won-deal handoff. Status is human-owned and independent (REQ131).
 * Reuses the existing customers table and detail sheet — no duplication.
 */
export default function CustomersPage() {
  const { contacts, organizations, users, tasks, deals, campaigns, addContact: addCustomer, updateContact: updateCustomer, deleteContact: deleteCustomer, restoreRecord, addTask, updateTask } = useData({ includeArchived: false });
  const customers = contacts; // alias — filtering happens below
  const { user } = useAuth();

  const canCreate = useHasPermission('contacts.create');

  const [searchTerm, setSearchTerm]         = useState('');
  const [isFormOpen, setIsFormOpen]         = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [detailSheetClient, setDetailSheetClient] = useState<Customer | null>(null);

  // BW-2 fix: filter on customerType (set by won-deal handoff), NOT status
  // REQ131: status is human-owned and unrelated to customer standing
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const isCustomer = c.customerType === 'Active Customer';
      if (!isCustomer) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        c.firstName?.toLowerCase().includes(q) ||
        c.lastName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.jobTitle?.toLowerCase().includes(q)
      );
    });
  }, [customers, searchTerm]);

  const { currentPage, pageSize, totalPages, goToPage, setPageSize, paginateItems } = usePagination({
    totalItems: filteredCustomers.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [searchTerm],
  });

  const paginatedCustomers = paginateItems(filteredCustomers);

  const handleOpenCreate = () => { setEditingCustomer(undefined); setIsFormOpen(true); };
  const handleOpenEdit   = (c: Customer) => { setEditingCustomer(c); setIsFormOpen(true); };
  const handleCloseForm  = () => { setIsFormOpen(false); setEditingCustomer(undefined); };

  const handleSubmit = (data: any) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data);
      toast.success('Customer updated');
    } else {
      addCustomer({ ...data, customerType: 'Active Customer' });
      toast.success('Customer added');
    }
    handleCloseForm();
  };

  const handleDelete = (id: string) => {
    deleteCustomer(id);
    toast.success('Customer removed');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-500" />
            Customers
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {customers.length} active {customers.length === 1 ? 'customer' : 'customers'}
          </p>
        </div>
        {canCreate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleOpenCreate}
                  size="icon"
                  aria-label="Add Customer"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Customer</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-gray-200 dark:border-white/8 bg-white dark:bg-white/2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Table — reuses customers table */}
      <ClientTable
        data={paginatedCustomers}
        viewMode="leads"
        onEdit={handleOpenEdit}
        onView={(c) => setDetailSheetClient(c)}
        onArchive={(c) => handleDelete(c.id)}
        organizations={organizations}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={customers.length}
          pageSize={pageSize}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Detail Sheet */}
      {detailSheetClient && (
        <ClientDetailSheet
          isOpen={!!detailSheetClient}
          onClose={() => setDetailSheetClient(null)}
          client={detailSheetClient}
          clientType="individual"
          onEdit={() => {
            setEditingCustomer(detailSheetClient);
            setIsFormOpen(true);
            setDetailSheetClient(null);
          }}
          onArchive={(id) => { handleDelete(id); setDetailSheetClient(null); }}
        />
      )}

      {/* Form Sheet */}
      {isFormOpen && (
        <CustomerFormSheet
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSubmit}
          initialData={editingCustomer}
        />
      )}
    </div>
  );
}

