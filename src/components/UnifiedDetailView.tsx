import React from 'react';
import { Contact, Organization, User as UserType, Deal, Task, Campaign } from '../store/types';
import { ClientProfileTabs } from './ClientProfileTabs';
import { CompanyProfileTabs } from './CompanyProfileTabs';
import { ShieldCheck, TrendingUp } from 'lucide-react';
import { getCRMStatusStyles } from '../lib/utils';



interface UnifiedDetailViewProps {
  type: 'individual' | 'organization';
  selectedItem: Contact | (Organization & { contacts?: Contact[] });
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

  // Dynamic Mappings for Status and Connected Deals
  const mappedStatus = type === 'individual' 
    ? (selectedItem as Contact).status 
    : 'Contact';

  const mappedDeals = React.useMemo(() => {
    if (type === 'individual') {
      const contact = selectedItem as Contact;
      return deals.filter(d => 
        (d.companyName && contact.companyName && d.companyName.toLowerCase().trim() === contact.companyName.toLowerCase().trim()) || 
        (d.contactPerson && contact.contactPerson && d.contactPerson.toLowerCase().trim() === contact.contactPerson.toLowerCase().trim())
      );
    } else {
      const org = selectedItem as any;
      return deals.filter(d => 
        (d.companyName && org.name && d.companyName.toLowerCase().trim() === org.name.toLowerCase().trim()) ||
        org.contacts.some(c => c.contactPerson && d.contactPerson && c.contactPerson.toLowerCase().trim() === d.contactPerson.toLowerCase().trim())
      );
    }
  }, [type, selectedItem, deals]);

  return (
    <div className="space-y-6" id="unified-detail-view-root">
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
          selectedOrg={{ ...(selectedItem as Organization), contacts: [], address: '', status: 'Contact', leadSource: '' } as any}
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
