'use client';

import React, { useState } from 'react';
import { Contact } from '@/store/types';
import { Edit, Mail, Phone, Building, Users, Archive, ArchiveRestore, Check, X, PanelRight } from 'lucide-react';
import { getCRMStatusStyles, getConnectedDealsForContact, getConnectedDealsForOrg } from '@/lib/utils';
import { Organization, User } from '@/store/types';
import { useData } from '@/store/DataContext';
import { UserProfileDrawer } from '@/shared/components/user-profile-drawer';

interface ClientTableProps {
  data: Contact[];
  viewMode: 'contacts' | 'organizations';
  onEdit: (contact: Contact) => void;
  onView: (contact: Contact, tab?: string) => void;
  onEditOrg?: (org: Organization) => void;
  onArchive?: (contact: Contact) => void;
  onRestore?: (contact: Contact) => void;
  onArchiveOrg?: (org: Organization) => void;
  onRestoreOrg?: (org: Organization) => void;
  onQuickView?: (contact: Contact, tab?: string) => void;
  onQuickViewOrg?: (org: Organization, tab?: string) => void;
  organizations?: Organization[];
  showArchived?: boolean;
}

export function ClientTable({ data, viewMode, onEdit, onView, organizations, onEditOrg, onArchive, onRestore, onArchiveOrg, onRestoreOrg, onQuickView, onQuickViewOrg, showArchived }: ClientTableProps) {
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedUserDrawer, setSelectedUserDrawer] = useState<User | null>(null);
  const { users, deals, tasks = [] } = useData();

  if (viewMode === 'organizations' && organizations) {
    const filteredOrgs = organizations.filter(org => showArchived ? org.isArchived : !org.isArchived);

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Industry / Size</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Contacts</th>
              <th className="px-4 py-3">Deals</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredOrgs.map((org) => {
              const orgDeals = getConnectedDealsForOrg(org, deals, data);
              const orgContacts = data.filter(c => !c.isArchived && ((c.organizationId && c.organizationId === org.id) || (c.companyName && org.name && c.companyName.toLowerCase().trim() === org.name.toLowerCase().trim())));
              const totalOrgValue = orgDeals.reduce((sum, d) => sum + (d.value || 0), 0);

              return (
                <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
                        <Building size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white cursor-pointer hover:text-blue-600" onClick={() => onQuickViewOrg && onQuickViewOrg(org)}>
                          {org.name}
                        </div>
                        {org.website && (
                          <a href={org.website.startsWith('http') ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                            {org.website}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    <div>{org.industry || 'General'}</div>
                    <div className="text-[11px] text-slate-400">{org.size || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {[org.city, org.province, org.country].filter(Boolean).join(', ') || org.address || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{orgContacts.length} Contacts</span>
                  </td>
                  <td className="px-4 py-3">
                    {orgDeals.length > 0 ? (
                      <button 
                        className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors border border-blue-200 dark:border-blue-800/40 shadow-sm"
                        title="View Organization Deals"
                        onClick={(e) => { e.stopPropagation(); onQuickViewOrg && onQuickViewOrg(org, 'deals'); }}
                      >
                        {orgDeals.length} Deal{orgDeals.length > 1 ? 's' : ''}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {totalOrgValue > 0 ? (
                      <div 
                        className="inline-flex flex-col items-end cursor-pointer group"
                        onClick={(e) => { e.stopPropagation(); onQuickViewOrg && onQuickViewOrg(org, 'deals'); }}
                        title="Total Organization Deal Value"
                      >
                        <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          ₱{totalOrgValue.toLocaleString('en-PH')}
                        </span>
                        <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400">PHP</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs font-normal">-</span>
                    )}
                  </td>
              
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onQuickViewOrg && onQuickViewOrg(org)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Quick View">
                      <PanelRight size={16} /> 
                    </button>
                    <button onClick={() => onEditOrg && onEditOrg(org)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                      <Edit size={16} />
                    </button>
                    {org.isArchived ? (
                      restoringId === org.id ? (
                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800/30">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mr-1 uppercase">Restore?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRestoreOrg) onRestoreOrg(org);
                              setRestoringId(null);
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRestoringId(null); }}
                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRestoringId(org.id); }}
                          className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                          title="Restore Organization"
                        >
                          <ArchiveRestore size={16} />
                        </button>
                      )
                    ) : (
                      archivingId === org.id ? (
                        <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800/30">
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-500 mr-1 uppercase">Archive?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onArchiveOrg) onArchiveOrg(org);
                              setArchivingId(null);
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setArchivingId(null); }}
                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setArchivingId(org.id); }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Archive Organization"
                        >
                          <Archive size={16} />
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredOrgs.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // default / contacts
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 dark:border-white/10 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-3 min-w-[100px]">Date</th>
            <th className="px-4 py-3 min-w-[150px]">Company Name</th>
            <th className="px-4 py-3 min-w-[150px]">Address</th>
            <th className="px-4 py-3 min-w-[150px]">Contact Person</th>
            <th className="px-4 py-3 min-w-[150px]">Contact Number</th>
            <th className="px-4 py-3 min-w-[150px]">Email Address</th>
            <th className="px-4 py-3 min-w-[150px]">Product Interest</th>
            <th className="px-4 py-3 min-w-[120px]">Source</th>
            <th className="px-4 py-3 min-w-[120px]">Agent</th>
            <th className="px-4 py-3 min-w-[90px]">Deals</th>
            <th className="px-4 py-3 min-w-[130px] text-right">Value</th>
            <th className="px-4 py-3 min-w-[90px]">Status</th>
            <th className="px-4 py-3 min-w-[180px]">Update</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {data.map((contact) => {
            const contactDeals = getConnectedDealsForContact(contact, deals);
            const totalValue = contactDeals.reduce((sum, d) => sum + (d.value || 0), 0);

            return (
              <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-500 cursor-pointer" onClick={() => onView(contact)}>
                  {new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})}
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onView(contact)}>
                  {contact.recordType === 'Organization' ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{contact.companyName || '-'}</span>
                      {(contact.businessType || contact.orgWebsite) && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {contact.businessType}{contact.businessType && contact.orgWebsite ? ' · ' : ''}{contact.orgWebsite}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-xs">Individual</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {contact.address || [contact.streetAddress, contact.city, contact.province].filter(Boolean).join(', ') || '-'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white cursor-pointer" onClick={() => onView(contact)}>
                  {contact.firstName ? `${contact.firstName} ${contact.lastName || ''}` : contact.contactPerson || '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 items-start">
                    {(contact.contactNumbers && contact.contactNumbers.length > 0) ? (
                      contact.contactNumbers.map(cn => (
                        <div key={cn.id} className="text-xs flex flex-col">
                          <span className="text-slate-700 dark:text-slate-300">{cn.countryCode ? cn.countryCode + ' ' : ''}{cn.number} <span className="text-slate-400">({cn.type})</span></span>
                          {cn.notes && <span className="text-slate-400 italic">{cn.notes}</span>}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-600 dark:text-slate-400">{contact.phone || contact.mobileNumber || '-'}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 break-all max-w-[150px]">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:text-blue-600 transition-colors">{contact.email}</a>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {contact.productInterests?.length ? contact.productInterests.join(', ') : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {contact.leadSource || '-'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {(() => {
                    const agent = users.find(u => u.id === contact.assignedUserId);
                    return (
                      <div 
                        className="flex items-center gap-1.5 cursor-pointer group hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (agent) setSelectedUserDrawer(agent);
                        }}
                        title="Click to view Sales Rep Profile Drawer"
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(agent?.firstName || '?').charAt(0)}
                        </div>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {agent ? `${agent.firstName} ${agent.lastName}` : 'Unassigned'}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                {/* DEALS COLUMN */}
                <td className="px-4 py-3">
                  {contactDeals.length > 0 ? (
                    <button 
                      className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors border border-blue-200 dark:border-blue-800/40 shadow-sm"
                      title="View Deals in Profile"
                      onClick={(e) => { e.stopPropagation(); onView(contact, 'deals'); }}
                    >
                      {contactDeals.length} Deal{contactDeals.length > 1 ? 's' : ''}
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </td>
                {/* VALUE COLUMN (Positioned immediately next to Deals) */}
                <td className="px-4 py-3 text-right">
                  {totalValue > 0 ? (
                    <div 
                      className="inline-flex flex-col items-end cursor-pointer group"
                      onClick={(e) => { e.stopPropagation(); onView(contact, 'deals'); }}
                      title="Total Deal Value"
                    >
                      <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        ₱{totalValue.toLocaleString('en-PH')}
                      </span>
                      <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400">PHP</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs font-normal">-</span>
                  )}
                </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getCRMStatusStyles(contact.status)}`}>
                  {contact.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-[150px] truncate" title={contact.notes}>
                {contact.notes || '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onQuickView && onQuickView(contact); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Quick View">
                    <PanelRight size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(contact); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                    <Edit size={16} />
                  </button>
                  {contact.isArchived ? (
                    restoringId === contact.id ? (
                      <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800/30">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mr-1 uppercase">Restore?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onRestore) onRestore(contact);
                            setRestoringId(null);
                          }}
                          className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRestoringId(null); }}
                          className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRestoringId(contact.id); }}
                        className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                        title="Restore Contact"
                      >
                        <ArchiveRestore size={16} />
                      </button>
                    )
                  ) : (
                    archivingId === contact.id ? (
                      <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800/30">
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-500 mr-1 uppercase">Archive?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onArchive) onArchive(contact);
                            setArchivingId(null);
                          }}
                          className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setArchivingId(null); }}
                          className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setArchivingId(contact.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Archive Contact"
                      >
                        <Archive size={16} />
                      </button>
                    )
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        {data.length === 0 && (
          <tr>
            <td colSpan={14} className="px-4 py-10 text-center text-sm text-slate-500">
                No profiles found matching your criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedUserDrawer && (
        <UserProfileDrawer
          user={selectedUserDrawer}
          deals={deals}
          tasks={tasks}
          onClose={() => setSelectedUserDrawer(null)}
          onSelectDeal={(deal) => {
            setSelectedUserDrawer(null);
            const targetContact = data.find(c => c.id === deal.contactId || deal.contactIds?.includes(c.id));
            if (targetContact) onView(targetContact);
          }}
        />
      )}
    </div>
  );
}
