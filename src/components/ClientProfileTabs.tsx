import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, Building, FileText, ChevronRight, MapPin, Tag, Calendar, 
  Clock, Plus, CheckCircle, MessageSquare, Send, Bell, Shield, Layers, HelpCircle, Briefcase, Activity, Edit
} from 'lucide-react';
import { Contact, User as UserType, Deal, Task, Campaign } from '../store/types';
import { ClientProfileFiles } from './ClientProfileFiles';
import { toast } from 'sonner';
import { getCRMStatusStyles, getCRMStatusStripColor } from '../lib/utils';

interface Props {
  selectedContact: Contact;
  users: UserType[];
  deals: Deal[];
  tasks: Task[];
  campaigns: Campaign[];
  currentUser: UserType | null;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  addTask: (taskData: any) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  onClose: () => void;
  onEditClick?: () => void;
}

export type TabType = 
  | 'overview' 
  | 'activities' 
  | 'notes' 
  | 'emails' 
  | 'sms' 
  | 'tasks' 
  | 'deals' 
  | 'pipelines' 
  | 'campaigns' 
  | 'files' 
  | 'audit';

export const ClientProfileTabs = ({
  selectedContact: contact,
  users,
  deals,
  tasks,
  campaigns,
  currentUser,
  updateContact,
  addTask,
  updateTask,
  onClose,
  onEditClick
}: Props) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Interactive local states for persistence
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [contactNotes, setContactNotes] = useState(contact.notes || '');
  const [internalNotes, setInternalNotes] = useState(contact.internalNotes || '');
  
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

  // Predefined email templates
  const EMAIL_TEMPLATES = [
    { id: 'intro', name: 'CRM Introduction Intro', subject: 'Welcome to TechFlow - CCTV Installation Consultation', body: `Hi ${contact.contactPerson},\n\nThank you for reaching out to us. We would love to evaluate your site for our advanced services.\n\nAre you available for a phone appointment tomorrow?\n\nBest regards,\nCRM Admin Team` },
    { id: 'followup', name: 'Standard Contact Follow Up', subject: 'Following up on your structured cabling quotation', body: `Hi ${contact.contactPerson},\n\nHope you are having a productive week.\n\nI wanted to check if you reviewed the quotation we supplied. Let me know if you would like me to adjust any items.\n\nBest,\n` },
    { id: 'meeting_con', name: 'Consultation Confirmation', subject: 'Confirmed: Technical Site Assessment', body: `Hi ${contact.contactPerson},\n\nThis email confirms your upcoming engineering evaluation scheduled for next Thursday.\n\nOur technician will communicate with you prior to the arrival.\n\nRegards,\n` }
  ];

  // Load activities of this contact
  useEffect(() => {
    const defaultActivities = [
      { id: 'e1', type: 'system', text: 'Contact / Organization CRM record registered in database.', time: contact.createdAt || '3 days ago', user: contact.createdBy || 'System Admin' },
      { id: 'e2', type: 'system', text: `Contact established with status '${contact.status}' and value of $${contact.estimatedValue?.toLocaleString()}.`, time: '3 days ago', user: 'System Admin' },
      { id: 'e3', type: 'system', text: contact.assignedUserId ? `Assigned to representative handler.` : 'Registered as unassigned account.', time: '3 days ago', user: 'System Admin' }
    ];

    const savedActivities = localStorage.getItem(`crm_activities_${contact.id}`);
    if (savedActivities) {
      setTimelineEvents(JSON.parse(savedActivities));
    } else {
      setTimelineEvents(defaultActivities);
    }

    setContactNotes(contact.notes || '');
    setInternalNotes(contact.internalNotes || '');
  }, [contact]);

  const saveActivities = (updatedList: any[]) => {
    setTimelineEvents(updatedList);
    localStorage.setItem(`crm_activities_${contact.id}`, JSON.stringify(updatedList));
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

  // Log interaction (Call / Meeting / Note)
  const handleLogInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logNotes.trim()) return;
    addActivityLog(`Logged custom ${logType}: "${logNotes}"`, 'user_action');
    setLogNotes('');
    toast.success(`Registered custom ${logType} session directly in timeline!`);
  };

  // Note handler
  const handleSaveNotes = () => {
    updateContact(contact.id, { notes: contactNotes, internalNotes: internalNotes });
    toast.success('Successfully committed notes changes!');
    addActivityLog(`Wrote and saved updated profile internal notes.`, 'user_action');
  };

  // Email simulation
  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailBody.trim()) return;
    setIsSendingEmail(true);
    setTimeout(() => {
      addActivityLog(`Email Sent to ${contact.email || 'customer'}. Subject: "${emailSubject}"`, 'email');
      toast.success(`Success! Email dispatched to ${contact.email || 'customer'}`);
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

  // SMS simulation
  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;
    setIsSendingSms(true);
    setTimeout(() => {
      addActivityLog(`SMS Sent to ${contact.phone || 'customer'}. Message: "${smsText}"`, 'sms');
      toast.success(`Sms Text delivered successfully.`);
      setIsSendingSms(false);
      setSmsText('');
    }, 1000);
  };

  // Task creation
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    addTask({
      title: `${newTaskTitle} (Linked: ${contact.contactPerson})`,
      assignedUserId: contact.assignedUserId || currentUser?.id || 'user_1',
      dueDate: newTaskDate || new Date().toISOString().split('T')[0],
      priority: newTaskPriority,
      status: 'pending',
      notes: `Linked automatically to Contact & Organization folder of ${contact.contactPerson} at ${contact.companyName}.`
    });

    addActivityLog(`Assigned new task checklist item: "${newTaskTitle}"`, 'task');
    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskPriority('Medium');
    toast.success('Task scheduled successfully on Taskboard!');
  };

  // Dynamic tags parsed
  const parsedTags = contact.tags ? contact.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Connected Deals
  const connectedDeals = deals.filter(d => 
    d.companyName?.toLowerCase() === contact.companyName?.toLowerCase() || 
    d.contactPerson?.toLowerCase() === contact.contactPerson?.toLowerCase()
  );

  // Associated Tasks
  const connectedTasks = tasks.filter(t => t.title?.includes(contact.contactPerson));

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full text-slate-800 dark:text-slate-100" id="client-profile-container">
      {/* Left Static Side card */}
      <div className="w-full md:w-72 shrink-0 space-y-6">
        <div className="bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.04] rounded-2xl p-5 text-center shadow-sm relative overflow-hidden">
          {/* Status highlight strip */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${getCRMStatusStripColor(contact.status)}`} />

          <div className="w-16 h-16 mx-auto mt-2 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 text-white font-extrabold flex items-center justify-center text-2xl uppercase shadow-md shadow-indigo-500/10">
            {contact.firstName ? contact.firstName.charAt(0) : contact.contactPerson.charAt(0)}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 flex items-center justify-center gap-1.5">
            {contact.displayName || contact.contactPerson}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {contact.customerType === 'Individual' 
              ? '🏡 Residential Customer' 
              : `${contact.jobTitle || 'Customer Client'} • ${contact.companyName}`}
          </p>
          
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getCRMStatusStyles(contact.status)}`}>
              {contact.status} Status
            </span>
            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/10">
              {contact.leadSource || 'Direct Input'}
            </span>
          </div>

          {onEditClick && (
            <button
              onClick={onEditClick}
              className="mt-4 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-550 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Edit size={12} /> Update Profile Details
            </button>
          )}

          <div className="border-t border-gray-100 dark:border-white/5 mt-5 pt-4 text-left space-y-3">
            <div className="flex items-center gap-2.5 text-xs">
              <Mail size={13} className="text-slate-400" />
              <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{contact.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <Phone size={13} className="text-slate-400" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">{contact.phone || 'No phone number'}</span>
            </div>
            {contact.customerType !== 'Individual' && contact.companyName && (
              <div className="flex items-center gap-2.5 text-xs">
                <Building size={13} className="text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{contact.companyName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Financial Worth card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-250">Estimated Potential Value</div>
          <div className="text-2xl font-bold mt-1.5 text-slate-100">${(contact.estimatedValue ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">Calculated probability score: {contact.score || 70}/100</div>
          
          <div className="border-t border-white/5 mt-4 pt-3 text-xs flex justify-between items-center text-slate-300">
            <span>Interest Tier:</span>
            <span className="font-semibold text-white">{(contact.estimatedValue ?? 0) > 80000 ? 'High Worth Asset' : 'Midtier Base'}</span>
          </div>
        </div>
      </div>

      {/* Right Details Tabs view */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 border border-gray-150 dark:border-white/[0.04] rounded-2xl p-5 shadow-sm min-w-0">
        {/* Scrollable horizontal tabs row */}
        <div className="flex gap-1.5 border-b border-gray-200 dark:border-white/5 pb-2.5 overflow-x-auto scrollbar-none shrink-0 mb-6" id="details-tabs-bar">
          {(['overview', 'activities', 'notes', 'emails', 'sms', 'tasks', 'deals', 'pipelines', 'campaigns', 'files', 'audit'] as TabType[]).map((tab) => (
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
              {tab === 'sms' ? 'SMS Messages' : tab === 'audit' ? 'Audit History' : tab}
            </button>
          ))}
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 text-left animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Section A: Demographic Basics */}
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">1. Basic Details</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">First Name</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.firstName || contact.contactPerson.split(' ')[0] || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Last Name</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.lastName || contact.contactPerson.split(' ').slice(1).join(' ') || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Preferred Name</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.preferredName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Middle Name</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.middleName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Suffix / Honorific</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.suffix || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Customer Type</span>
                      <span className="font-semibold text-slate-800 dark:text-[#a0c5f5]">{contact.customerType || 'Individual'}</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Additional Contact Info */}
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">2. Communication Directory</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Secondary Email</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{contact.secondaryEmail || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Work Email</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{contact.workEmail || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Alternate Telephone</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{contact.altPhone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">LinkedIn URL</span>
                      {contact.linkedin ? (
                        <a href={contact.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-block font-semibold truncate max-w-full">{contact.linkedin}</a>
                      ) : <span className="text-slate-400">Not linked</span>}
                    </div>
                  </div>
                </div>

                {/* Section C: Complete Address */}
                <div className="sm:col-span-2 space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">3. Address & Geographical Information</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Country</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.country || 'Philippines'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Region / Province</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.region || contact.province || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">City / Municipality</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.city || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Barangay</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.barangay || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 text-[10px] block">Street Address Details</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.streetAddress || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Building / Suite / Unit</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {[contact.building, contact.floor, contact.unit].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Postal Code</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.postalCode || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Section D: Custom fields */}
                <div className="sm:col-span-2 space-y-3 p-4 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.03] rounded-xl text-xs text-left">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/5 pb-1.5 uppercase tracking-wider text-[10px]">4. Configured Custom Segmentation Fields</h4>
                  {contact.customFields && Object.keys(contact.customFields).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(contact.customFields).map(([key, value]) => (
                        <div key={key} className="bg-white dark:bg-white/5 p-2 rounded-lg border border-gray-150 dark:border-white/5">
                          <span className="text-[10px] text-slate-400 block capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-bold text-slate-800 dark:text-white mt-0.5 inline-block">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 py-3 text-center border-dashed border border-gray-200 dark:border-white/5 rounded-lg">
                      No custom metadata tags declared. Click Edit Profile on main board to establish fields (e.g. Installation Date).
                    </div>
                  )}
                </div>

                {/* Section E: Connected Tags */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Classification Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {parsedTags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md border border-indigo-500/20">
                        Label: {tag}
                      </span>
                    ))}
                    {parsedTags.length === 0 && (
                      <span className="text-xs text-slate-500 italic">No segmentation tags attached.</span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: ACTIVITIES TIMELINE */}
          {activeTab === 'activities' && (
            <div className="space-y-6 text-left animate-in fade-in duration-100">
              
              {/* Quick Logging action box */}
              <form onSubmit={handleLogInteraction} className="bg-slate-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.04] p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-white/5">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Quick log staff engagement</h4>
                  <div className="flex gap-1">
                    {(['Call', 'Meeting', 'Note'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLogType(type)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          logType === type 
                            ? 'bg-blue-500 text-white border-blue-500' 
                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border-gray-200 dark:border-white/5'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    placeholder={`e.g. Discussed subscription configuration during outbound ${logType.toLowerCase()}...`}
                    value={logNotes}
                    onChange={e => setLogNotes(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button type="submit" className="bg-blue-500 hover:bg-blue-600 font-semibold text-white px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors">
                    <CheckCircle size={13} /> Log
                  </button>
                </div>
              </form>

              {/* Vertical timeline element */}
              <div className="relative border-l border-gray-200 dark:border-white/5 pl-5 ml-2.5 space-y-5">
                {timelineEvents.map((evt, i) => (
                  <div key={evt.id || i} className="relative animate-in fade-in duration-200">
                    {/* Circle icon */}
                    <div className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full border-2 bg-[#030712] ${
                      evt.type === 'email' ? 'border-sky-400' :
                      evt.type === 'sms' ? 'border-emerald-400' :
                      evt.type === 'task' ? 'border-purple-400' : 'border-slate-500'
                    }`} />
                    
                    <div className="text-xs">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="font-semibold text-slate-500">{evt.user || 'Admin'}</span>
                        <span>{evt.time}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 mt-1 font-medium">{evt.text}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* TAB 3: NOTES AND RICH INTERNAL PERSISTENCE */}
          {activeTab === 'notes' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">General Client Notes (Visually Shared)</label>
                <textarea 
                  rows={4} 
                  value={contactNotes} 
                  onChange={e => setContactNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all"
                  placeholder="Notes shown on main screens..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Internal Private Records (Audit-Locked)</label>
                <textarea 
                  rows={4} 
                  value={internalNotes} 
                  onChange={e => setInternalNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all font-mono text-amber-600 dark:text-amber-400"
                  placeholder="Insert confidential credit evaluation or internal warnings here..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="button" 
                  onClick={handleSaveNotes}
                  className="bg-blue-600 hover:bg-blue-500 font-bold text-white px-4 py-2 rounded-xl text-xs transition-colors shadow-md shadow-blue-500/10"
                >
                  Save Internal Notes
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: MOCK EMAILS COMPOSE */}
          {activeTab === 'emails' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <div className="bg-slate-50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/[0.03] p-3 rounded-lg text-xs space-y-1">
                <span className="font-semibold block text-slate-400 uppercase text-[9px] tracking-wider">Select templates</span>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleApplyTemplate(t.id)}
                      className="bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-[10px] px-2.5 py-1 rounded border border-gray-200 dark:border-white/5 text-slate-700 dark:text-slate-350"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendEmail} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase select-none mb-1">Outbound Email Address</label>
                  <input 
                    type="text" 
                    readOnly 
                    value={contact.email} 
                    className="w-full bg-gray-100 dark:bg-white/[0.01] opacity-75 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-1.5 text-xs text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject Header</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Brief email subject line..."
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Message Body Paragraphs</label>
                  <textarea 
                    rows={6}
                    required
                    placeholder="Enter email content..."
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] rounded-lg p-3 text-xs text-slate-900 dark:text-white focus:outline-none resize-none font-sans"
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit"
                    disabled={isSendingEmail}
                    className="bg-blue-600 hover:bg-blue-500 font-semibold text-white px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={13} /> {isSendingEmail ? 'Sending Dispatch...' : 'Dispatch Email'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: SMS DISPATCH MESSAGES */}
          {activeTab === 'sms' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <div className="bg-white dark:bg-[#040914] border border-gray-200 dark:border-white/[0.04] rounded-2xl max-w-sm mx-auto shadow-inner overflow-hidden">
                <div className="bg-slate-100 dark:bg-white/[0.02] p-3 text-center border-b border-gray-200 dark:border-white/5 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  📲 Outbound Telephony Sim
                </div>
                <div className="p-4 space-y-4 h-48 overflow-y-auto custom-scrollbar flex flex-col justify-end text-xs">
                  <div className="bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-300 p-2.5 rounded-2xl self-start max-w-[80%] text-left">
                    Hi! We received your site checkup inquiry.
                  </div>
                  <div className="bg-blue-500 text-white p-2.5 rounded-2xl self-end max-w-[80%] text-left shadow-sm">
                    Great! I will meet the representative technicians at the site.
                  </div>
                </div>

                <form onSubmit={handleSendSms} className="p-3 border-t border-gray-200 dark:border-white/5 flex gap-2">
                  <input 
                    type="text"
                    required
                    placeholder="Type SMS texts..."
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-full px-3.5 py-1 text-xs text-slate-900 dark:text-white"
                  />
                  <button 
                    type="submit"
                    disabled={isSendingSms}
                    className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shrink-0"
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: TASKS INTEGRATION */}
          {activeTab === 'tasks' && (
            <div className="space-y-5 text-left animate-in fade-in duration-100" id="profile-tasks-integration-tab">
              {/* Inline layout forms */}
              <form onSubmit={handleAddTask} className="bg-slate-50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/[0.03] p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Fast Schedule Active Task</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Task Title *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Call to finalize quote details"
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
                    <Plus size={12} /> Add Task
                  </button>
                </div>
              </form>

              {/* Connected tasks item renderer list */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active checklist queue</h5>
                {connectedTasks.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 border border-gray-150 dark:border-white/[0.03] bg-white dark:bg-white/[0.02] rounded-xl text-xs hover:border-gray-200 dark:hover:border-white/10 transition-all">
                    <div className="flex items-start gap-2.5">
                      <input 
                        type="checkbox" 
                        checked={t.status === 'completed'} 
                        onChange={() => {
                          const nextStatus = t.status === 'completed' ? 'pending' : 'completed';
                          updateTask(t.id, { status: nextStatus as any });
                          toast.success(`Updated checklist state to ${nextStatus}!`);
                        }}
                        className="rounded border-gray-300 dark:border-white/10 text-blue-500 cursor-pointer mt-0.5" 
                      />
                      <div className="text-left">
                        <span className={`font-semibold ${t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">Due: {t.dueDate} • Priority: {t.priority}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {connectedTasks.length === 0 && (
                  <div className="text-left text-slate-500 italic py-3 text-xs">
                    No active tasks are specifically scheduled on Taskboard for this lead.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: SAVED DEALS */}
          {activeTab === 'deals' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue Opportunities Queue</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {connectedDeals.map(deal => (
                  <div key={deal.id} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-xl p-4 space-y-3 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div className="truncate pr-4">
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">{deal.title}</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">Assigned Opportunity</p>
                      </div>
                      <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/10 px-2 py-0.5 rounded">
                        ${deal.value?.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-2 border-t border-gray-100 dark:border-white/5">
                      <span className="text-slate-500">Priority: <strong className="text-slate-400">{deal.priority}</strong></span>
                      <span className="text-slate-500">Close: <strong className="text-slate-400">{deal.expectedCloseDate || 'N/A'}</strong></span>
                    </div>
                  </div>
                ))}
                {connectedDeals.length === 0 && (
                  <div className="py-6 text-center text-slate-500 italic text-xs col-span-2 border border-dotted border-gray-200 dark:border-white/5 rounded-xl">
                    No active commercial deals are logged to this company database. Change status on board to Closed to trigger options.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: ACTIVE PIPELINES */}
          {activeTab === 'pipelines' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Commercial Stage Mapping</h4>
              {connectedDeals.length > 0 ? (
                <div className="space-y-4">
                  {connectedDeals.map(deal => (
                    <div key={deal.id} className="bg-slate-50 dark:bg-white/[0.01] border border-gray-250 dark:border-white/[0.03] p-4 rounded-xl space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{deal.title}</span>
                        <span className="text-blue-500">Pipeline Tracker</span>
                      </div>
                      {/* Bar indicator */}
                      <div className="grid grid-cols-5 gap-1.5 pt-1.5">
                        {['Qualification', 'Proposal Sent', 'Contract Pending', 'Nearing Close', 'Won'].map((stg, idx) => {
                          const isActive = idx < 3; // Mock active stages
                          return (
                            <div key={stg} className="space-y-1">
                              <div className={`h-1.5 rounded-full ${isActive ? 'bg-blue-500 shadow-sm' : 'bg-slate-200 dark:bg-white/5'}`} />
                              <span className="text-[8px] text-slate-550 dark:text-slate-400 block truncate">{stg}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic py-4 border border-dotted border-gray-200 dark:border-white/5 rounded-xl text-center">
                  No deals identified. Setup a deal under the Deals page tab to view pipeline status here.
                </div>
              )}
            </div>
          )}

          {/* TAB 9: CAMPAIGNS SUBSCRIPTIONS */}
          {activeTab === 'campaigns' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channel Newsletter Distributions</h4>
              <div className="space-y-2">
                {campaigns.slice(0, 2).map((camp, idx) => (
                  <div key={camp.id || idx} className="p-3.5 bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.03] rounded-xl flex items-center justify-between text-xs">
                    <div className="text-left">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{camp.name}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Subject: Welcome Promo Discount Series</span>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                      Subscribed
                    </span>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="p-3 p-y-4 bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.03] rounded-xl flex items-center justify-between text-xs">
                    <div className="text-left">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">Outbound Newsletter Loop</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Status: Not actively targeted</span>
                    </div>
                    <span className="bg-slate-500/10 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-500/20 uppercase tracking-wider">
                      Inactive
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 10: SIMULATED FILES ATTACHMENTS */}
          {activeTab === 'files' && (
            <div className="animate-in fade-in duration-100">
              <ClientProfileFiles leadId={contact.id} currentUser={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'CRM Staff'} />
            </div>
          )}

          {/* TAB 11: AUDIT RECORD HISTORY */}
          {activeTab === 'audit' && (
            <div className="space-y-4 text-left animate-in fade-in duration-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Record Modification Integrity Logs</h4>
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.02] rounded-xl text-[11px] space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-[9px] font-bold uppercase tracking-wider">
                    <span>Modifying User: CRM Web Service</span>
                    <span>Just now</span>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-350">Committed complete profile update matching the new 8 Sections Redesign system schema.</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/[0.01] border border-gray-150 dark:border-white/[0.02] rounded-xl text-[11px] space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-[9px] font-bold uppercase tracking-wider">
                    <span>Modifying User: System</span>
                    <span>3 days ago</span>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-350">Instantiated central index representation for '{contact.companyName}' with key contacts setup.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
