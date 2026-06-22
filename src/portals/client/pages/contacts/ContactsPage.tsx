import React, { useState, useMemo } from "react";
import { useData } from "../../../../store/DataContext";
import { useAuth } from "../../../../store/AuthContext";
import { Plus } from "lucide-react";
import { Contact, Organization } from "../../../../store/types";
import { ClientTable } from "./ClientTable";
import { ClientFilters } from "./ClientFilters";
import { ContactFormSheet } from "./ContactFormSheet";
import { UnifiedDetailView } from "../../components/contacts/UnifiedDetailView";
import { ClientDetailSheet } from "../../components/contacts/ClientDetailSheet";
import { toast } from "sonner";

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
          l.customerType !== "Individual"
        )
          return false;
        if (
          smartView === "Organization Customers" &&
          l.customerType !== "Organization"
        )
          return false;

        // CustomerType category filter
        const type =
          l.customerType ||
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

  // Handlers
  const handleAddNew = () => {
    setEditingLead(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingLead(contact);
    setIsFormOpen(true);
  };

  const handleView = (contact: Contact) => {
    setViewingLead(contact);
  };

  const handleSaveForm = (data: Partial<Contact>) => {
    if (editingLead) {
      updateContact(editingLead.id, data);
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
        customerType: data.customerType || "Individual",
        companyName: data.companyName || "",
        contactPerson: contactPerson || "Unnamed Lead",
        jobTitle: data.jobTitle || "",
        email: data.email || "",
        phone: data.phone || "",
        serviceRequired: data.serviceRequired || "",
        leadSource: data.leadSource || "Added Manually",
        estimatedValue: data.estimatedValue || 0,
        assignedUserId: data.assignedUserId || "",
        expectedCloseDate: data.expectedCloseDate || "",
        notes: data.notes || "",
        status: data.status || "Cold",
      };
      addContact(newLeadParams);
      toast.success("Profile created successfully");
    }
    setIsFormOpen(false);
  };

  const handleArchive = (contact: Contact) => {
    deleteContact(contact.id);
    toast.success("Profile archived successfully");
  };

  const handleRestore = (contact: Contact) => {
    restoreRecord("Contact", contact.id);
    toast.success("Profile restored successfully");
  };

  const handleArchiveOrg = (org: any) => {
    deleteOrganization(org.id);
    toast.success("Organization archived successfully");
  };

  const handleRestoreOrg = (org: any) => {
    restoreRecord("Organization", org.id);
    toast.success("Organization restored successfully");
  };

  if (viewingLead) {
    return (
      <UnifiedDetailView
        type={
          viewingLead.customerType === "Organization"
            ? "organization"
            : "individual"
        }
        selectedItem={viewingLead}
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
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="shrink-0 mb-2 xl:mb-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Client Profiles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage all your customers, prospects, and organization clients in
            one place.
          </p>
        </div>

        <div className="flex-1 w-full justify-end">
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
            actions={
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20"
                >
                  <Plus size={18} /> Add Profile
                </button>
              </div>
            }
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
        <ClientTable
          data={filteredLeads}
          viewMode={smartView === "Organization Customers" ? "organizations" : "contacts"}
          organizations={organizations}
          onEdit={handleEdit}
          onView={handleView}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onArchiveOrg={handleArchiveOrg}
          onRestoreOrg={handleRestoreOrg}
          onQuickView={(contact) => setDetailSheetClient({ client: contact, type: 'individual' })}
          onQuickViewOrg={(org) => setDetailSheetClient({ client: org, type: 'organization' })}
          showArchived={smartView === "Archived"}
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
          onArchive={(id, type) => {
            if (type === 'individual') {
              deleteContact(id);
              toast.success("Profile archived successfully");
            } else {
              deleteOrganization(id);
              toast.success("Organization archived successfully");
            }
          }}
        />
      )}
    </div>
  );
}
