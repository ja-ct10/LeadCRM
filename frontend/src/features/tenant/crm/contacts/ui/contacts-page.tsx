'use client';

import React, { useState, useMemo } from "react";
import { useData } from "@/store/DataContext";
import { useAuth } from "@/store/AuthContext";
import { Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Contact, Organization } from "@/store/types";
import { ClientTable } from "./contacts-table";
import { ClientFilters } from "./contact-filters";
import { ContactFormSheet } from "./contact-form";
import { UnifiedDetailView } from "./contact-detail-view";
import { ClientDetailSheet } from "./contact-detail-sheet";
import { toast } from "sonner";
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';

export default function ContactsPage() {
  const {
    contacts,
    addContact,
    updateContact,
    deleteContact,
    deleteOrganization,
    restoreRecord,
    organizations,
    users,
    tasks,
    deals,
    campaigns,
    addTask,
    updateTask,
  } = useData({ includeArchived: true });
  const { user } = useAuth();

  // State
  const [smartView, setSmartView] = useState("All Profiles");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<
    "All" | "Individual" | "Organization"
  >("All");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Contact | undefined>();
  const [viewingLead, setViewingLead] = useState<Contact | undefined>();
  const [activeDetailTab, setActiveDetailTab] = useState<string>("overview");
  const [detailSheetClient, setDetailSheetClient] = useState<{ client: Contact | Organization, type: 'individual' | 'organization' } | null>(null);

  // Filter Data
  const filteredLeads = useMemo(() => {
    return contacts
      .filter((l) => {
        // Archived filter
        if (smartView === "Archived") {
          if (!l.isArchived) return false;
        } else {
          if (l.isArchived) return false;
        }

        // Smart View Filter
        if (
          smartView === "Leads" &&
          !["Hot", "Warm", "Cold"].includes(l.status)
        )
          return false;
        if (smartView === "Customers" && l.status !== "Closed") return false;
        if (
          smartView === "Individual Customers" &&
          l.recordType !== "Individual"
        )
          return false;
        if (
          smartView === "Organization Customers" &&
          l.recordType !== "Organization"
        )
          return false;

        // CustomerType category filter
        const type =
          l.recordType ||
          (l.organizationId || l.companyName ? "Organization" : "Individual");
        if (customerTypeFilter !== "All" && type !== customerTypeFilter)
          return false;

        // Pipeline status filter mutli-select
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(l.status))
          return false;

        // Owner filter multi-select
        if (selectedOwners.length > 0) {
          let matched = false;
          if (selectedOwners.includes("unassigned") && !l.assignedUserId) {
            matched = true;
          }
          if (selectedOwners.includes("me") && l.assignedUserId === user?.id) {
            matched = true;
          }
          if (l.assignedUserId && selectedOwners.includes(l.assignedUserId)) {
            matched = true;
          }
          if (!matched) return false;
        }

        // Lead source filter multi-select
        if (selectedSources.length > 0) {
          const leadSrc = l.leadSource || "Other";
          let matched = false;
          for (const src of selectedSources) {
            if (leadSrc.toLowerCase().includes(src.toLowerCase())) {
              matched = true;
              break;
            }
          }
          if (!matched) return false;
        }

        // Search term
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const matchesName =
            l.firstName?.toLowerCase().includes(search) ||
            l.lastName?.toLowerCase().includes(search) ||
            l.contactPerson?.toLowerCase().includes(search);
          const matchesCompany = l.companyName?.toLowerCase().includes(search);
          const matchesEmail = l.email?.toLowerCase().includes(search);
          const matchesPhone = l.phone?.includes(search);
          if (!matchesName && !matchesCompany && !matchesEmail && !matchesPhone)
            return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.status === "Hot" && b.status !== "Hot") return -1;
        if (b.status === "Hot" && a.status !== "Hot") return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [
    contacts,
    customerTypeFilter,
    searchTerm,
    selectedStatuses,
    selectedOwners,
    selectedSources,
    user?.id,
    smartView,
  ]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    setPageSize,
    paginateItems,
  } = usePagination({
    totalItems: filteredLeads.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [searchTerm, customerTypeFilter, selectedStatuses, selectedOwners, selectedSources, smartView],
  });

  // Handlers
  const handleAddNew = () => {
    setEditingLead(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingLead(contact);
    setIsFormOpen(true);
  };

  const handleView = (contact: Contact, tab: string = "overview") => {
    setActiveDetailTab(tab);
    setViewingLead(contact);
  };

  const handleViewOrg = (org: Organization, tab: string = "overview") => {
    setActiveDetailTab(tab);
    setViewingLead({
      id: org.id,
      tenantId: org.tenantId,
      companyName: org.name,
      contactPerson: org.name,
      recordType: "Organization",
      status: "Active",
      organizationId: org.id,
      industry: org.industry,
      size: org.size,
      website: org.website,
      taxId: org.taxId,
      address: org.address,
    } as any);
  };

  const handleSaveForm = async (data: Partial<Contact>) => {
    try {
      if (editingLead) {
        await updateContact(editingLead.id, data);
        toast.success("Profile updated successfully");
        // Update viewing contact if it's the same one
        if (viewingLead?.id === editingLead.id) {
          setViewingLead({ ...viewingLead, ...data });
        }
      } else {
        const contactPerson =
          `${data.firstName || ""} ${data.lastName || ""}`.trim();
        const newLeadParams: Omit<
          Contact,
          "id" | "tenantId" | "createdAt" | "score"
        > = {
          ...data,
          recordType: data.recordType || "Individual",
          companyName: data.companyName || "",
          contactPerson: contactPerson || "Unnamed Lead",
          jobTitle: data.jobTitle || "",
          email: data.email || "",
          phone: data.phone || "",
          productInterests: data.productInterests || [],
          leadSource: data.leadSource || "Added Manually",
          estimatedValue: data.estimatedValue || 0,
          assignedUserId: data.assignedUserId || "",
          expectedCloseDate: data.expectedCloseDate || "",
          notes: data.notes || "",
          status: data.status || "Cold",
        };
        await addContact(newLeadParams);
        toast.success("Profile created successfully");
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    }
  };

  const handleArchive = async (contact: Contact) => {
    try {
      await deleteContact(contact.id);
      toast.success("Profile archived successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to archive profile");
    }
  };

  const handleRestore = async (contact: Contact) => {
    try {
      await restoreRecord("Contact", contact.id);
      toast.success("Profile restored successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to restore profile");
    }
  };

  const handleArchiveOrg = async (org: any) => {
    try {
      await deleteOrganization(org.id);
      toast.success("Organization archived successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to archive organization");
    }
  };

  const handleRestoreOrg = (org: any) => {
    restoreRecord("Organization", org.id);
    toast.success("Organization restored successfully");
  };

  if (viewingLead) {
    return (
      <UnifiedDetailView
        type={
          viewingLead.recordType === "Organization"
            ? "organization"
            : "individual"
        }
        selectedItem={viewingLead}
        initialTab={activeDetailTab}
        users={users}
        deals={deals}
        tasks={tasks}
        campaigns={campaigns || []}
        currentUser={user}
        updateContact={updateContact}
        addTask={addTask}
        updateTask={updateTask}
        onClose={() => setViewingLead(undefined)}
        handleSyncCompanyDetails={() => {}}
      />
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* 1. Standardized Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Client Profiles
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {filteredLeads.length} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage all your customer profiles, active leads, and corporate accounts in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAddNew}
                  aria-label="Add Profile"
                  className="h-9 w-9 flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
                >
                  <Plus size={15} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add Profile</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 2. Overview Operational KPI Strip */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Total Profiles</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{contacts.filter(c => !c.isArchived).length}</span>
            <span className="text-[11px] text-slate-500">records</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Active Leads</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{contacts.filter(c => ['Hot', 'Warm', 'Cold'].includes(c.status) && !c.isArchived).length}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">In funnel</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Converted Customers</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{contacts.filter(c => c.status === 'Closed' && !c.isArchived).length}</span>
            <span className="text-[11px] text-slate-500">closed</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Individuals</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{contacts.filter(c => (c.recordType === 'Individual' || (!c.recordType && !c.companyName)) && !c.isArchived).length}</span>
            <span className="text-[11px] text-slate-500">accounts</span>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Organizations</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-purple-600 dark:text-purple-400">{contacts.filter(c => (c.recordType === 'Organization' || c.companyName) && !c.isArchived).length}</span>
            <span className="text-[11px] text-slate-500">corporate</span>
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <ClientFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        customerTypeFilter={customerTypeFilter}
        setCustomerTypeFilter={setCustomerTypeFilter}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedOwners={selectedOwners}
        setSelectedOwners={setSelectedOwners}
        selectedSources={selectedSources}
        setSelectedSources={setSelectedSources}
        usersList={users || []}
        currentUserEmail={user?.email || ""}
        smartView={smartView}
        setSmartView={setSmartView}
      />

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <ClientTable
          data={paginateItems(filteredLeads)}
          viewMode={smartView === "Organization Customers" ? "organizations" : "contacts"}
          organizations={organizations}
          onEdit={handleEdit}
          onView={handleView}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onArchiveOrg={handleArchiveOrg}
          onRestoreOrg={handleRestoreOrg}
          onQuickView={(contact, tab) => handleView(contact, tab || 'overview')}
          onQuickViewOrg={(org, tab) => handleViewOrg(org, tab || 'overview')}
          showArchived={smartView === "Archived"}
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


      {/* Forms and Sheets */}
      {isFormOpen && (
        <ContactFormSheet
          isOpen={isFormOpen}
          initialData={editingLead}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveForm}
        />
      )}

      {detailSheetClient && (
        <ClientDetailSheet
          isOpen={!!detailSheetClient}
          onClose={() => setDetailSheetClient(null)}
          client={detailSheetClient.client}
          clientType={detailSheetClient.type}
          onEdit={() => {
            if (detailSheetClient.type === 'individual') {
              setEditingLead(detailSheetClient.client as Contact);
              setIsFormOpen(true);
              setDetailSheetClient(null);
            }
          }}
          onArchive={async (id, type) => {
            try {
              if (type === 'individual') {
                await deleteContact(id);
                toast.success("Profile archived successfully");
              } else {
                await deleteOrganization(id);
                toast.success("Organization archived successfully");
              }
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Failed to archive");
            }
          }}
        />
      )}
    </div>
  );
}