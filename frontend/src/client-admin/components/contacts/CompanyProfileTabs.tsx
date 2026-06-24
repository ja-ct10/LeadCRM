import React, { useState, useEffect } from 'react';
import { 
  Building, Mail, Phone, FileText, ChevronRight, MapPin, Tag, Calendar, 
  Clock, Plus, CheckCircle, MessageSquare, Send, Bell, Shield, Layers, HelpCircle, Briefcase, Activity, Edit, Users, Globe
} from 'lucide-react';
import { Contact, Organization, User as UserType, Deal, Task, Campaign } from '../../../store/types';
import { ContactActivitiesTab } from './tabs/ContactActivitiesTab';
import { ContactEmailTab } from './tabs/ContactEmailTab';
import { ContactSmsTab } from './tabs/ContactSmsTab';
import { toast } from 'sonner';
import { getCRMStatusStyles, getCRMStatusStripColor } from '../../../lib/utils';



export type ExtendedOrg = Organization & { contacts: Contact[]; address?: string; status?: any; leadSource?: string; estimatedValue?: number; repId?: string };

interface Props {
  selectedOrg: ExtendedOrg;
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
}

export type OrgTabType = 
  | 'overview' 
  | 'contacts'
  | 'activities' 
  | 'notes' 
  | 'emails' 
  | 'sms' 
  | 'tasks' 
  | 'deals' 
  | 'cascade';

export const CompanyProfileTabs = ({
  selectedOrg,
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
}: Props) => {
  const [activeTab, setActiveTab ] = useState<OrgTabType>('overview');

  // Interactive local states for persistence
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [companyNotes, setCompanyNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  
  // Simulated communications state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [smsText, setSmsText] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  // New task inline state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  // Custom logging inline states
  const [logType, setLogType] = useState<'Call' | 'Meeting' | 'Note'>('Call');
  const [logNotes, setLogNotes] = useState('');

  // Cascade states
  const [cascadeWeb, setCascadeWeb] = useState(selectedOrg.website !== 'N/A' ? selectedOrg.website : '');
  const [cascadeIndustry, setCascadeIndustry] = useState(selectedOrg.industry);
  const [cascadeSize, setCascadeSize] = useState(selectedOrg.size);
  const [cascadeTaxId, setCascadeTaxId] = useState(selectedOrg.taxId !== 'N/A' ? selectedOrg.taxId : '');
  const [cascadeAddress, setCascadeAddress] = useState(selectedOrg.address !== 'N/A' ? selectedOrg.address : '');

  // Predefined email templates
  const EMAIL_TEMPLATES = [
    { id: 'intro', name: 'Corporate Intro', subject: `TechFlow Business Partnership - ${selectedOrg.name}`, body: `Dear members of ${selectedOrg.name},\n\nWe would like to introduce our executive enterprise infrastructure offerings tailored specifically for the ${selectedOrg.industry} industry.\n\nAre you available for a structured assessment meeting next Tuesday?\n\nBest regards,\nEnterprise Solutions Architect` },
    { id: 'proposal', name: 'Enterprise Proposal Focus', subject: `Executive Network Proposal: ${selectedOrg.name}`, body: `Dear Management Team,\n\nFollowing up on our engineering consultation. We have formulated a tailored scope of services representing a custom deployment.\n\nLet us know if you require any adjustments.\n\nWarm regards,\n` },
    { id: 'review', name: 'Strategic Account Review', subject: `Quarterly Account Evaluation: ${selectedOrg.name}`, body: `Dear partners,\n\nWe wish to organize an automated telemetry review of the cabling work conducted on your offices.\n\nPlease confirm availability for a 15-minute briefing.\n\nRespectfully,\n` }
  ];

  // Load activities of this company
  useEffect(() => {
    const defaultActivities = [
      { id: 'e1', type: 'system', text: `Registered corporate directory node for ${selectedOrg.name} under ${selectedOrg.industry} industry sector.`, time: '5 days ago', user: 'System CRM Parser' },
      { id: 'e2', type: 'system', text: `Rollup pipeline calculation established: $${(selectedOrg.estimatedValue ?? 0).toLocaleString()} across ${selectedOrg.contacts.length} representative personnel.`, time: 'Just now', user: 'System CRM Parser' },
      { id: 'e3', type: 'system', text: selectedOrg.repId ? `Mapped primary CRM staff handler.` : 'Registered as unassigned corporate portfolio.', time: '5 days ago', user: 'System CRM Parser' }
    ];

    const savedActivities = localStorage.getItem(`crm_activities_org_${selectedOrg.name}`);
    if (savedActivities) {
      setTimelineEvents(JSON.parse(savedActivities));
    } else {
      setTimelineEvents(defaultActivities);
    }

    // Load notes
    const savedNotes = localStorage.getItem(`crm_notes_org_${selectedOrg.name}`);
    const savedInternalNotes = localStorage.getItem(`crm_internal_notes_org_${selectedOrg.name}`);
    setCompanyNotes(savedNotes || `No corporate history captured for ${selectedOrg.name} yet.`);
    setInternalNotes(savedInternalNotes || `Confidential security logs for ${selectedOrg.name}.`);

    // Reset cascades
    setCascadeWeb(selectedOrg.website !== 'N/A' ? selectedOrg.website : '');
    setCascadeIndustry(selectedOrg.industry);
    setCascadeSize(selectedOrg.size);
    setCascadeTaxId(selectedOrg.taxId !== 'N/A' ? selectedOrg.taxId : '');
    setCascadeAddress(selectedOrg.address !== 'N/A' ? selectedOrg.address : '');

  }, [selectedOrg]);

  const saveActivities = (updatedList: any[]) => {
    setTimelineEvents(updatedList);
    localStorage.setItem(`crm_activities_org_${selectedOrg.name}`, JSON.stringify(updatedList));
  };

  const addActivityLog = (text: string, type: string = 'system') => {
    const newLog = {
      id: Math.random().toString(),
      type,
      text,
      time: 'Just now',
      user: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'CRM Staff'
    };
    const updated = [newLog, ...timelineEvents];
    saveActivities(updated);
  };

  const handleLogInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logNotes.trim()) return;
    addActivityLog(`Logged Corporate interaction [${logType}]: "${logNotes}"`, 'user_action');
    setLogNotes('');
    toast.success(`Registered interaction for ${selectedOrg.name}!`);
  };

  const handleSaveNotes = () => {
    localStorage.setItem(`crm_notes_org_${selectedOrg.name}`, companyNotes);
    localStorage.setItem(`crm_internal_notes_org_${selectedOrg.name}`, internalNotes);
    toast.success('Successfully updated corporate records!');
    addActivityLog(`Modified central organization internal dossiers.`, 'user_action');
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailBody.trim()) return;
    setIsSendingEmail(true);
    setTimeout(() => {
      addActivityLog(`Enterprise Broadcast Sent to all ${selectedOrg.contacts.length} key contacts. Subject: "${emailSubject}"`, 'email');
      toast.success(`Enterprise dispatch broadcasted successfully to personnel of ${selectedOrg.name}`);
      setIsSendingEmail(false);
      setEmailSubject('');
      setEmailBody('');
      setSelectedEmailTemplate('');
    }, 1200);
  };

  const handleApplyTemplate = (id: string) => {
    const selected = EMAIL_TEMPLATES.find(t => t.id === id);
    if (selected) {
      setSelectedEmailTemplate(id);
      setEmailSubject(selected.subject);
      setEmailBody(selected.body);
    }
  };

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;
    setIsSendingSms(true);
    setTimeout(() => {
      addActivityLog(`SMS Broadcaster Disposed to corporate contact loop. Text: "${smsText}"`, 'sms');
      toast.success(`Corporate mobile notification sent.`);
      setIsSendingSms(false);
      setSmsText('');
    }, 1000);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    addTask({
      title: `${newTaskTitle} (Firm: ${selectedOrg.name})`,
      assignedUserId: selectedOrg.repId || currentUser?.id || 'user_1',
      dueDate: newTaskDate || new Date().toISOString().split('T')[0],
      priority: newTaskPriority,
      status: 'pending',
      notes: `Rollup scheduled task for B2B Account: ${selectedOrg.name}.`
    });

    addActivityLog(`Scheduled corporate task milestone: "${newTaskTitle}"`, 'task');
    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskPriority('Medium');
    toast.success('Task logged under Corporate Account on board!');
  };

  const handlePerformCascadeWeb = (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Partial<Contact> = {};
    if (cascadeWeb) { fields.orgWebsite = cascadeWeb; fields.website = cascadeWeb; }
    if (cascadeIndustry) { fields.businessType = cascadeIndustry; }
    if (cascadeSize) { fields.companySize = cascadeSize; }
    if (cascadeTaxId) { fields.taxId = cascadeTaxId; }
    if (cascadeAddress) { fields.orgAddress = cascadeAddress; }

    handleSyncCompanyDetails(selectedOrg.name, fields);
    addActivityLog(`Executed global parameter sync: website, industry, size coordinates.`, 'system');
  };

  // Connected Deals
  const connectedDeals = deals.filter(d => 
    d.companyName?.toLowerCase().trim() === selectedOrg.name.toLowerCase().trim() ||
    selectedOrg.contacts.some(c => c.contactPerson && d.contactPerson && c.contactPerson.toLowerCase().trim() === d.contactPerson.toLowerCase().trim())
  );

  // Connected Tasks
  const connectedTasks = tasks.filter(t => t.title?.includes(selectedOrg.name));

  const assignedRep = users.find(u => u.id === selectedOrg.repId);

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full text-slate-800 dark:text-slate-100" id="company-profile-container">
       {/* Left Static Side card */}
      <div className="w-full md:w-72 shrink-0 space-y-6">
        <div className="bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.04] rounded-2xl p-5 text-center shadow-sm relative overflow-hidden">
          {/* Glowing border highlight strip */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 animate-pulse ${getCRMStatusStripColor(selectedOrg.status)}`} />

          <div className="w-16 h-16 mx-auto mt-2 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-extrabold flex items-center justify-center text-2xl uppercase shadow-md shadow-amber-500/10">
            {selectedOrg.name.charAt(0)}
          </div>
          
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 flex items-center justify-center gap-1.5">
            {selectedOrg.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ðŸ¢ {selectedOrg.industry} â€¢ Corporate Account
          </p>
          
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getCRMStatusStyles(selectedOrg.status)}`}>
              {selectedOrg.status} Account
            </span>
            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/10">
              {selectedOrg.leadSource || 'Website Portal'}
            </span>
          </div>

          {onEditClick && (
            <button
              onClick={onEditClick}
              className="mt-4 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-550 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Edit size={12} /> Update Company Details
            </button>
          )}

          <div className="border-t border-gray-100 dark:border-white/5 mt-5 pt-4 text-left space-y-3">
            <div className="flex items-center gap-2.5 text-xs">
              <Globe size={13} className="text-slate-400 shrink-0" />
              <span className="truncate text-slate-705 dark:text-slate-300 font-medium">
                {selectedOrg.website !== 'N/A' ? (
                  <a href={selectedOrg.website?.startsWith('http') ? selectedOrg.website : `https://${selectedOrg.website}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                    {selectedOrg.website}
                  </a>
                ) : 'No website synced'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <Users size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-705 dark:text-slate-300 font-bold">{selectedOrg.contacts.length} Associated Contacts</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-705 dark:text-slate-300 font-medium truncate" title={selectedOrg.address !== 'N/A' ? selectedOrg.address : 'HQ'}>
                {selectedOrg.address !== 'N/A' ? selectedOrg.address : 'Unverified Address'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Financial Worth card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-250">Combined B2B Account Worth</div>
          <div className="text-2xl font-bold mt-1.5 text-slate-100">${(selectedOrg.estimatedValue ?? 0).toLocaleString()}</div>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">Weighted based on aggregate contact files from personnel contacts.</p>
          
          <div className="border-t border-white/5 mt-4 pt-3 text-xs flex justify-between items-center text-slate-300">
            <span>Corporate Tier:</span>
            <span className="font-semibold text-white">{(selectedOrg.estimatedValue ?? 0) > 150000 ? 'Tier-1 Key Account' : 'Midmarket Entity'}</span>
          </div>
        </div>
      </div>

      {/* Right Details Tabs view */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 border border-gray-150 dark:border-white/[0.04] rounded-2xl p-5 shadow-sm min-w-0">
        {/* Scrollable horizontal tabs row */}
        <div className="flex gap-1.5 border-b border-gray-200 dark:border-white/5 pb-2.5 overflow-x-auto scrollbar-none shrink-0 mb-6" id="details-tabs-bar">
          {(['overview', 'contacts', 'activities', 'notes', 'emails', 'sms', 'tasks', 'deals', 'cascade'] as OrgTabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all capitalize whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5'
              }`}
            >
              {tab === 'sms' ? 'SMS Messages' : 
               tab === 'cascade' ? 'ðŸ”„ Cascade Sync' : 
               tab === 'contacts' ? 'ðŸ‘¥ Personnel Contacts' : 
               tab === 'overview' ? 'Overview' : tab}
            </button>
          ))}
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 text-left animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Section A: Company demographics */}
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">1. Basic Details</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <span className="text-slate-400 text-[10px] block font-semibold">Corporate Legal Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{selectedOrg.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Primary Industry</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedOrg.industry}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Account Size Bracket</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedOrg.size}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Corporate Tax ID / TIN</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-amber-400">{selectedOrg.taxId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Customer Type</span>
                      <span className="font-semibold text-slate-850 dark:text-blue-400">Corporate Organization</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Corporate directory contacts */}
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs font-sans">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">2. Communication Directory</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Primary Website URL</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{selectedOrg.website}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Assigned Advisor</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                          {assignedRep ? `${assignedRep.firstName} ${assignedRep.lastName}` : 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Personnel Registered</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">{selectedOrg.contacts.length} profiles</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section C: Complete Address */}
                <div className="sm:col-span-2 space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">3. Address & Geographical Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Verified Head Office Address</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{selectedOrg.address !== 'N/A' ? selectedOrg.address : 'No central address mapped. Navigate to Cascade updates tab to set.'}</span>
                    </div>
                  </div>
                </div>

                {/* Section D: Custom fields rollup */}
                <div className="sm:col-span-2 space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs text-left">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">4. Configured Custom Segmentation Fields</h4>
                  <p className="text-slate-500 font-medium">To keep datasets aligned across all personnel registered under this firm, please utilize the <span className="font-bold text-slate-700 dark:text-slate-300">"Cascade Sync"</span> panel tab. Changes propagate instantly to all sub-contacts.</p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: PERSONNEL LIST DIRECTORY ACCORDION */}
          {activeTab === 'contacts' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/5 pb-1.5 shrink-0">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Associated Key Contacts</h4>
                <span className="text-[10px] text-slate-500 font-bold">{selectedOrg.contacts.length} Associated records</span>
              </div>

              <div className="space-y-2">
                {selectedOrg.contacts.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => {
                      if (setSelectedContact && setSelectedOrgName) {
                        setSelectedContact(c);
                        setSelectedOrgName(null);
                      }
                    }}
                    className="p-3 border border-gray-150 dark:border-white/[0.03] bg-gray-50/50 dark:bg-white/[0.01] hover:border-blue-500/25 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <div className="text-left space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-white block text-xs md:text-sm">{c.contactPerson}</span>
                      <span className="text-[10px] text-slate-500 block font-semibold">{c.jobTitle || 'Representative Contact'} â€¢ {c.email || 'No email'}</span>
                    </div>
                    <button
                      type="button"
                      className="text-blue-500 hover:text-blue-400 font-bold text-[10px] bg-white dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/5"
                    >
                      View Folder
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITIES TIMELINE */}
          {activeTab === 'activities' && (
            <ContactActivitiesTab
              timelineEvents={timelineEvents}
              logType={logType}
              logNotes={logNotes}
              onSetLogType={setLogType}
              onSetLogNotes={setLogNotes}
              onLogInteraction={handleLogInteraction}
            />
          )}

          {/* TAB 4: NOTES AND RICH INTERNAL PERSISTENCE */}
          {activeTab === 'notes' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">General Corporate History Dossier</label>
                <textarea 
                  rows={4} 
                  value={companyNotes} 
                  onChange={e => setCompanyNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all"
                  placeholder="History or account logs..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Enterprise Internal Audits (Confidential)</label>
                <textarea 
                  rows={4} 
                  value={internalNotes} 
                  onChange={e => setInternalNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all font-mono text-amber-600 dark:text-amber-400"
                  placeholder="Confidential comments, compliance audits, discount tiers..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="button" 
                  onClick={handleSaveNotes}
                  className="bg-blue-600 hover:bg-blue-550 font-bold text-white px-4 py-2 rounded-xl text-xs transition-colors shadow-md shadow-blue-500/10"
                >
                  Save Corporate Records
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: BROADCAST EMAIL */}
          {activeTab === 'emails' && (
            <ContactEmailTab
              contactEmail={`[Broadcast â†’ all ${selectedOrg.contacts.length} contacts of ${selectedOrg.name}]`}
              templates={EMAIL_TEMPLATES}
              emailSubject={emailSubject}
              emailBody={emailBody}
              selectedTemplateId={selectedEmailTemplate}
              isSending={isSendingEmail}
              onApplyTemplate={handleApplyTemplate}
              onSubjectChange={setEmailSubject}
              onBodyChange={setEmailBody}
              onSend={handleSendEmail}
            />
          )}

          {/* TAB 6: CORPORATE SMS NOTIFICATION */}
          {activeTab === 'sms' && (
            <ContactSmsTab
              smsText={smsText}
              isSending={isSendingSms}
              onSmsTextChange={setSmsText}
              onSend={handleSendSms}
            />
          )}

          {/* TAB 7: OUTLINE CORPORATE TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-5 text-left animate-in fade-in duration-100" id="profile-tasks-integration-tab">
              <form onSubmit={handleAddTask} className="bg-slate-50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/[0.03] p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Fast Schedule Account task milestone</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Task Title *</label>
                    <input 
                      type="text" 
                      required
                      placeholder={`e.g. Schedule onboarding for ${selectedOrg.name}`}
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Target Due Date</label>
                    <input 
                      type="date" 
                      value={newTaskDate}
                      onChange={e => setNewTaskDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">Priority:</span>
                    {(['Low', 'Medium', 'High'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskPriority(p)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${
                          newTaskPriority === p ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/5 text-slate-600'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <Plus size={12} /> Add Corporate Task
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enterprise task queue</h5>
                {connectedTasks.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 border border-gray-150 dark:border-white/[0.03] bg-white dark:bg-white/[0.02] rounded-xl text-xs hover:border-gray-200 dark:hover:border-white/10 transition-all">
                    <div className="flex items-start gap-2.5">
                      <input 
                        type="checkbox" 
                        checked={t.status === 'completed'}
                        onChange={() => {
                          updateTask(t.id, { status: t.status === 'completed' ? 'pending' : 'completed' });
                          toast.success('Task checklist status toggled successfully');
                        }}
                        className="rounded border-gray-300 text-blue-500 mt-0.5 cursor-pointer"
                      />
                      <div className="text-left">
                        <span className={`font-bold block ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t.title}</span>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-0.5 font-semibold">
                          <span>Due: {t.dueDate}</span>
                          <span>â€¢</span>
                          <span className={`px-1.5 py-0.2 rounded ${
                            t.priority === 'High' ? 'bg-red-500/10 text-red-500' :
                            t.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-slate-500/10 text-slate-500'
                          }`}>{t.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {connectedTasks.length === 0 && (
                  <div className="p-8 text-center text-slate-500 border border-dashed border-gray-200 dark:border-white/5 rounded-2xl">
                    No active corporate milestones registered.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: ASSOCIATED DEALS PIPELINE */}
          {activeTab === 'deals' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/5 pb-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Enterprise Deal Rollups</h4>
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {connectedDeals.length} active pipelines
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {connectedDeals.map(d => (
                  <div key={d.id} className="p-4 bg-white dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">{d.title}</span>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-semibold">
                        <span>Contact Rep Contact: {d.contactPerson || 'General'}</span>
                        <span>â€¢</span>
                        <span className="text-slate-400">Owner User ID: {d.assignedUserId || 'System'}</span>
                      </div>
                    </div>

                    <div className="text-right flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-gray-100 dark:border-white/5 pt-2 sm:pt-0">
                      <div>
                        <div className="text-sm font-black text-slate-950 dark:text-slate-100">${d.value.toLocaleString()}</div>
                        <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider block mt-0.5">{d.priority} Priority</span>
                      </div>
                    </div>
                  </div>
                ))}
                {connectedDeals.length === 0 && (
                  <div className="p-8 text-center text-slate-500 border border-dashed border-gray-200 dark:border-white/5 rounded-2xl">
                    No active B2B opportunities initiated for this account yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: CASCADE PARAMETERS CONFIG */}
          {activeTab === 'cascade' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs border-b border-gray-150 dark:border-white/5 pb-1.5 uppercase tracking-wider font-sans flex items-center gap-1.5">
                <span>ðŸ”„ Cascade sync company-wide updates</span>
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed dark:text-slate-400">
                Any modifications entered down below will instantly propagate to all <span className="font-bold text-blue-500">{selectedOrg.contacts.length} personnel contacts</span> registered under the firm name <span className="font-bold">'{selectedOrg.name}'</span>. This ensures dataset alignment automatically.
              </p>

              <form onSubmit={handlePerformCascadeWeb} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase select-none mb-1">Company Website Domain</label>
                    <input 
                      type="text" 
                      value={cascadeWeb}
                      onChange={e => setCascadeWeb(e.target.value)}
                      placeholder="e.g. acme.com or https://acme.org"
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase select-none mb-1">Primary Industry Sector</label>
                    <input 
                      type="text" 
                      value={cascadeIndustry}
                      onChange={e => setCascadeIndustry(e.target.value)}
                      placeholder="e.g. Hospital & Health Care"
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase select-none mb-1">Account Size Bracket</label>
                    <input 
                      type="text" 
                      value={cascadeSize}
                      onChange={e => setCascadeSize(e.target.value)}
                      placeholder="e.g. 100-500 employees"
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase select-none mb-1">Corporate Tax Identifier / TIN</label>
                    <input 
                      type="text" 
                      value={cascadeTaxId}
                      onChange={e => setCascadeTaxId(e.target.value)}
                      placeholder="e.g. TIN-238-294-110"
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase select-none mb-1">HQ Corporate Address details</label>
                    <input 
                      type="text" 
                      value={cascadeAddress}
                      onChange={e => setCascadeAddress(e.target.value)}
                      placeholder="Street, City, General Coordinates..."
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-550 text-white font-bold text-xs px-4.5 py-2 rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center gap-1.5"
                  >
                    ðŸ”„ Propagate sync to {selectedOrg.contacts.length} personnel profiles
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
