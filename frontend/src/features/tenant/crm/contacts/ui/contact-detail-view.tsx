'use client';

import React from 'react';
import { Contact, Organization, User as UserType, Deal, Task, Campaign } from '@/store/types';
import { useData } from '@/store/DataContext';
import { ClientProfileTabs } from './contact-profile-tabs';
import { CompanyProfileTabs, ExtendedOrg } from './company-profile-tabs';
import { ShieldCheck, TrendingUp } from 'lucide-react';
import { getCRMStatusStyles } from '@/lib/utils';
import { BackButton } from '@/shared/components/ui/back-button';

interface UnifiedDetailViewProps {
  type: 'individual' | 'organization';
  selectedItem: Contact | (Organization & { contacts?: Contact[] });
  initialTab?: string;
  users: UserType[];
  deals: Deal[];
  tasks: Task[];
  campaigns: Campaign[];
  currentUser: UserType | null;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  addTask: (taskData: any) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  onClose: () => void;
  handleSyncCompanyDetails: (companyNameRef: string, updates: Partial<Contact>) => void;
  onEditClick?: () => void;
  setSelectedContact?: (contact: Contact | null) => void;
  setSelectedOrgName?: (orgName: string | null) => void;
  setSelectedOrg?: (org: Organization | null) => void;
}

export const UnifiedDetailView = ({
  type,
  selectedItem,
  initialTab = 'overview',
  users,
  deals,
  tasks,
  campaigns,
  currentUser,
  updateContact,
  addTask,
  updateTask,
  onClose,
  handleSyncCompanyDetails,
  onEditClick,
  setSelectedContact,
  setSelectedOrgName
}: UnifiedDetailViewProps) => {

  const { contacts = [] } = useData({ includeArchived: true });

  // Robust organization entity normalization regardless of whether selectedItem is a Contact or an Organization
  const normalizedOrg: ExtendedOrg = React.useMemo(() => {
    const isContactObj = 'companyName' in selectedItem || 'contactPerson' in selectedItem;
    const itemAsContact = selectedItem as Contact;
    const itemAsOrg = selectedItem as Organization;

    const name = (isContactObj ? itemAsContact.companyName : itemAsOrg.name) || 'Organization';
    const id = isContactObj ? (itemAsContact.organizationId || itemAsContact.id) : itemAsOrg.id;

    // Find all contacts in dataset matching this organization
    const orgContacts = contacts.filter(c => 
      !c.isArchived && (
        (id && c.organizationId === id) ||
        (c.companyName && name && c.companyName.toLowerCase().trim() === name.toLowerCase().trim())
      )
    );

    return {
      id: id || 'org_demo',
      tenantId: selectedItem.tenantId || 'tenant_demo',
      name: name,
      industry: (selectedItem as any).industry || 'Technology & B2B Solutions',
      size: (selectedItem as any).size || '250+ Employees',
      website: (selectedItem as any).website || 'N/A',
      taxId: (selectedItem as any).taxId || 'N/A',
      createdAt: (selectedItem as any).createdAt || new Date().toISOString(),
      contacts: orgContacts.length > 0 ? orgContacts : (isContactObj ? [itemAsContact] : []),
      address: (selectedItem as any).address || [ (selectedItem as any).streetAddress, (selectedItem as any).city, (selectedItem as any).province ].filter(Boolean).join(', ') || 'Metropolitan Manila',
      status: (selectedItem as any).status || 'Customer',
      leadSource: (selectedItem as any).leadSource || 'Website Portal',
      estimatedValue: (selectedItem as any).estimatedValue || 0,
      repId: (selectedItem as any).assignedUserId || 'user_1',
    };
  }, [selectedItem, contacts]);

  // Dynamic Mappings for Status and Connected Deals
  const mappedStatus = type === 'individual' 
    ? (selectedItem as Contact).status 
    : normalizedOrg.status;

  const mappedDeals = React.useMemo(() => {
    if (type === 'individual') {
      const contact = selectedItem as Contact;
      return deals.filter(d => 
        !d.isArchived && (
          d.contactId === contact.id ||
          d.contactIds?.includes(contact.id) ||
          (d.companyName && contact.companyName && d.companyName.toLowerCase().trim() === contact.companyName.toLowerCase().trim()) || 
          (d.contactPerson && contact.contactPerson && d.contactPerson.toLowerCase().trim() === contact.contactPerson.toLowerCase().trim())
        )
      );
    } else {
      const orgName = normalizedOrg.name.toLowerCase().trim();
      const orgContactIds = new Set(normalizedOrg.contacts.map(c => c.id));
      const orgContactPersons = new Set(normalizedOrg.contacts.map(c => c.contactPerson?.toLowerCase().trim()).filter(Boolean));

      return deals.filter(d => {
        if (d.isArchived) return false;
        if (d.companyId && normalizedOrg.id && d.companyId === normalizedOrg.id) return true;
        if (d.companyName && d.companyName.toLowerCase().trim() === orgName) return true;
        if (d.contactId && orgContactIds.has(d.contactId)) return true;
        if (d.contactIds && d.contactIds.some(cid => orgContactIds.has(cid))) return true;
        if (d.contactPerson && orgContactPersons.has(d.contactPerson.toLowerCase().trim())) return true;
        return false;
      });
    }
  }, [type, selectedItem, deals, normalizedOrg]);

  return (
    <div className="space-y-6" id="unified-detail-view-root">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10">
        <BackButton label="Back to Contacts" onClick={onClose} variant="default" />
      </div>

      {/* Dynamic Summary Bar displaying Mapped Status and Deals count */}
      <div className="bg-slate-50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/[0.04] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="text-blue-500 shrink-0" size={16} />
          <div>
            <span className="text-slate-405 dark:text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Dynamic CRM Mapping Structure</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Classified as: <strong className="text-blue-500 capitalize">{type} Account model</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className={`flex items-center border px-2.5 py-1 rounded-lg font-semibold text-xs ${getCRMStatusStyles(mappedStatus)}`}>
            <span>Status: <strong className="font-extrabold">{mappedStatus}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-white/5 border border-gray-150 dark:border-white/5 px-2.5 py-1 rounded-lg">
            <TrendingUp className="text-indigo-400 w-3.5 h-3.5" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Deals Stream: <strong className="text-indigo-500 dark:text-indigo-400">{mappedDeals.length} opportunity file(s)</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Actual Tab Interfaces Layouts */}
      {type === 'individual' ? (
        <ClientProfileTabs
          selectedContact={selectedItem as Contact}
          initialTab={initialTab as any}
          users={users}
          deals={deals}
          tasks={tasks}
          campaigns={campaigns}
          currentUser={currentUser}
          updateContact={updateContact}
          addTask={addTask}
          updateTask={updateTask}
          onClose={onClose}
          onEditClick={onEditClick}
        />
      ) : (
        <CompanyProfileTabs
          selectedOrg={normalizedOrg}
          initialTab={initialTab as any}
          users={users}
          deals={deals}
          tasks={tasks}
          campaigns={campaigns}
          currentUser={currentUser}
          updateContact={updateContact}
          addTask={addTask}
          updateTask={updateTask}
          onClose={onClose}
          handleSyncCompanyDetails={handleSyncCompanyDetails}
          onEditClick={onEditClick}
          setSelectedContact={setSelectedContact}
          setSelectedOrgName={setSelectedOrgName}
        />
      )}
    </div>
  );
};
