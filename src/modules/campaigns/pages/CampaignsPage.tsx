import React, { useState } from 'react';
import { useData } from '../../../store/DataContext';
import { useAuth } from '../../../store/AuthContext';
import { toast } from 'sonner';
import { Plus, Send, X, Mail, MessageSquare, Megaphone, BarChart2, Eye, MousePointerClick, Edit2, Trash2, Play, Pause, Search, Filter, TrendingUp, TrendingDown, Copy, Calendar, ArrowLeft, SplitSquareHorizontal, ListOrdered, Monitor, Smartphone, Tags, Wand2, LayoutTemplate, Zap, Trophy, MoreVertical, Sparkles, Users, Loader2 } from 'lucide-react';
import EmptyState from '../../../shared/components/EmptyState';
import { TrelloFilter } from '../../../shared/components/TrelloFilter';
import { CampaignReportView } from './CampaignReportView';

const reportData = [
  { name: 'Day 1', opens: 400, clicks: 240 },
  { name: 'Day 2', opens: 300, clicks: 139 },
  { name: 'Day 3', opens: 200, clicks: 980 },
  { name: 'Day 4', opens: 278, clicks: 390 },
  { name: 'Day 5', opens: 189, clicks: 480 },
  { name: 'Day 6', opens: 239, clicks: 380 },
  { name: 'Day 7', opens: 349, clicks: 430 },
];

const deviceData = [
  { name: 'Mobile', value: 55 },
  { name: 'Desktop', value: 40 },
  { name: 'Tablet', value: 5 },
];
const COLORS = ['#10B981', '#0A6EFF', '#F59E0B'];

const topLinks = [
  { url: 'https://leadcrm.com/pricing', clicks: 842 },
  { url: 'https://leadcrm.com/features/automation', clicks: 531 },
  { url: 'https://leadcrm.com/book-demo', clicks: 289 },
];

export default function CampaignsPage() {
  const { campaigns, templates, roles, addCampaign, updateCampaign, deleteCampaign, addTemplate } = useData();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<any>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<'sent' | 'delivered' | 'opened' | 'clicked' | 'responded' | 'bounced'>('sent');
  const [messageContent, setMessageContent] = useState('');
  const [isSequence, setIsSequence] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState([{ delay: 0, unit: 'days', content: '' }]);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateType, setNewTemplateType] = useState<'Email' | 'SMS'>('Email');
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', content: '', category: 'Marketing' });
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const [builderMode, setBuilderMode] = useState<'text' | 'visual'>('text');
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const [isTriggerBased, setIsTriggerBased] = useState(false);
  const [triggerEvent, setTriggerEvent] = useState('status_hot');

  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignType, setNewCampaignType] = useState('Email');
  const [newCampaignTarget, setNewCampaignTarget] = useState('All Contacts');
  const [newCampaignDate, setNewCampaignDate] = useState('');
  const [newCampaignTime, setNewCampaignTime] = useState('');

  // Target audience creation state & methods
  const [isAudienceModalOpen, setIsAudienceModalOpen] = useState(false);
  const [targetAudiences, setTargetAudiences] = useState<string[]>([
    'All Contacts', 
    'Hot Contacts', 
    'Warm Contacts', 
    'Closed Customers', 
    'Custom Segment...'
  ]);
  const [audienceName, setAudienceName] = useState('');
  const [audienceConditions, setAudienceConditions] = useState<Array<{ field: string; operator: string; value: string }>>([
    { field: 'Status', operator: 'Equals', value: '' }
  ]);

  const handleAddCondition = () => {
    setAudienceConditions(prev => [...prev, { field: 'Status', operator: 'Equals', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setAudienceConditions(prev => prev.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, key: 'field' | 'operator' | 'value', value: string) => {
    setAudienceConditions(prev => prev.map((cond, i) => i === index ? { ...cond, [key]: value } : cond));
  };

  const getEstimatedSize = () => {
    if (audienceConditions.length === 0) return 0;
    let base = 1240;
    audienceConditions.forEach(cond => {
      const valStr = (cond.value || '').toLowerCase();
      if (cond.field === 'Status') {
        if (valStr === 'hot') base = Math.floor(base * 0.16);
        else if (valStr === 'warm') base = Math.floor(base * 0.25);
        else if (valStr === 'cold') base = Math.floor(base * 0.40);
        else if (valStr) base = Math.floor(base * 0.35);
      } else if (cond.field === 'Source') {
        base = Math.floor(base * 0.22);
      } else if (cond.field === 'Industry' || cond.field === 'Role') {
        base = Math.floor(base * 0.18);
      } else {
        base = Math.max(12, Math.floor(base * 0.45));
      }
    });
    return Math.max(15, base);
  };

  const handleCreateAudience = () => {
    if (!audienceName.trim()) {
      toast.error('Audience name is required.');
      return;
    }
    if (audienceConditions.length === 0) {
      toast.error('Please add at least one condition.');
      return;
    }
    if (audienceConditions.some(c => !c.value.trim())) {
      toast.error('Please specify values for all conditions.');
      return;
    }

    const newAudName = audienceName.trim();
    if (targetAudiences.includes(newAudName)) {
      toast.error('An audience with this name already exists.');
      return;
    }

    setTargetAudiences(prev => [...prev, newAudName]);
    setNewCampaignTarget(newAudName);
    setIsAudienceModalOpen(false);
    
    // reset form
    setAudienceName('');
    setAudienceConditions([{ field: 'Status', operator: 'Equals', value: '' }]);

    toast.success(`Target Audience "${newAudName}" created and selected! 🎯`);
  };

  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormPrompt, setBrainstormPrompt] = useState('');
  const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateIdeas = () => {
    if (!brainstormPrompt.trim()) return;
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      setGeneratedIdeas([
        `Subject: Unlock Your Potential with ${newCampaignName}\n\nHi {{first_name}},\n\nWe noticed you're interested in scaling up. Let's talk about how we can help.`,
        `Subject: The secret to better results? 🤫\n\nHey {{first_name}},\n\nIf you're reading this, you probably know that managing contacts is hard. What if we told you it doesn't have to be?`,
        `Subject: Quick question about your goals, {{first_name}}\n\nHi {{first_name}},\n\nJust reaching out to see if you have 5 minutes to chat about your upcoming projects this quarter.`
      ]);
      setIsGenerating(false);
    }, 1500);
  };

  const getPreviewText = (text: string) => {
    if (!text) return '';
    let body = text;
    if (text.toLowerCase().startsWith('subject:')) {
      const parts = text.split(/\n+/);
      if (parts.length > 1) {
        body = parts.slice(1).join('\n');
      }
    }
    return body
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{last_name\}\}/g, 'Doe')
      .replace(/\{\{company_name\}\}/g, 'Acme Corporation')
      .replace(/\{\{sender_name\}\}/g, 'Sarah Jenkins')
      .replace(/\{\{sender_email\}\}/g, 'sjenkins@leadcrm.com');
  };

  const getSubjectLine = (text: string) => {
    if (!text) return `${newCampaignName || 'LeadCRM Broadcast'}`;
    const firstLine = text.split('\n')[0];
    if (firstLine.toLowerCase().startsWith('subject:')) {
      return firstLine.substring(8).trim()
        .replace(/\{\{first_name\}\}/g, 'John')
        .replace(/\{\{last_name\}\}/g, 'Doe')
        .replace(/\{\{company_name\}\}/g, 'Acme Corporation');
    }
    return `${newCampaignName || 'LeadCRM Broadcast'}`;
  };
  const userRoleDef = roles.find(r => r.name === user?.role);
  const userPerms = userRoleDef?.permissions || [];
  const isClientAdmin = user?.role === 'Client Admin';
  const canCreateCampaign = isClientAdmin || userPerms.includes('p18');
  const canEditCampaign = isClientAdmin || userPerms.includes('p19');
  const canDeleteCampaign = isClientAdmin || userPerms.includes('p20');
  const canSendCampaign = isClientAdmin || userPerms.includes('p21');

  const handleSend = () => {
    if (!newCampaignName.trim()) {
      toast.error('Please enter a campaign name.');
      return;
    }

    if (isScheduling && (!newCampaignDate || !newCampaignTime)) {
      toast.error('Please specify both Date and Time for scheduling.');
      return;
    }

    addCampaign({
      name: newCampaignName,
      type: newCampaignType as 'Email' | 'Sms' | 'Multi-Channel',
      status: isScheduling ? 'scheduled' : 'active',
      targetAudience: newCampaignTarget,
      description: isSequence ? 'Drip Sequence' : 'Standard Campaign',
    });

    toast.success(isScheduling ? `Campaign "${newCampaignName}" scheduled successfully! 📅` : `Campaign "${newCampaignName}" sent successfully! 🚀`);
    setIsModalOpen(false);
    resetCampaignForm();
  };

  const handleSaveDraft = () => {
    if (!newCampaignName.trim()) {
      toast.error('Please enter a campaign name.');
      return;
    }

    addCampaign({
      name: newCampaignName,
      type: newCampaignType as 'Email' | 'Sms' | 'Multi-Channel',
      status: 'Draft',
      targetAudience: newCampaignTarget,
      description: isSequence ? 'Drip Sequence' : 'Standard Campaign',
    });

    toast.success(`Draft campaign "${newCampaignName}" saved successfully! 💾`);
    setIsModalOpen(false);
    resetCampaignForm();
  };

  const resetCampaignForm = () => {
    setNewCampaignName('');
    setNewCampaignType('Email');
    setNewCampaignTarget('All Contacts');
    setMessageContent('');
    setIsSequence(false);
    setSequenceSteps([{ delay: 0, unit: 'days', content: '' }]);
    setIsScheduling(false);
    setIsTriggerBased(false);
    setIsBrainstorming(false);
    setBrainstormPrompt('');
    setGeneratedIdeas([]);
  };

  const handleDuplicate = (camp: any) => {
    addCampaign({
      name: `${camp.name} (Copy)`,
      type: camp.type,
      status: 'Draft',
      targetAudience: camp.targetAudience,
      description: camp.description,
    });
  };

  const handleSaveTemplate = () => {
    if (!newTemplate.name || !newTemplate.content) {
      alert('Please fill in the required fields.');
      return;
    }
    addTemplate({
      name: newTemplate.name,
      type: newTemplateType,
      category: newTemplate.category,
      subject: newTemplate.subject,
      content: newTemplate.content,
    });
    setIsTemplateModalOpen(false);
    setNewTemplate({ name: '', subject: '', content: '', category: 'Marketing' });
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'email': return <Mail size={16} className="text-slate-500 dark:text-slate-400" />;
      case 'sms': return <MessageSquare size={16} className="text-slate-500 dark:text-slate-400" />;
      default: return <Megaphone size={16} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">active</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">completed</span>;
      case 'scheduled':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">scheduled</span>;
      case 'paused':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">paused</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600">{status}</span>;
    }
  };

  const emailTemplates = templates.filter(t => t.type === 'Email');
  const smsTemplates = templates.filter(t => t.type === 'SMS');

  const filteredCampaigns = campaigns.filter(camp => {
    if (camp.isArchived) return false;
    const matchesSearch = camp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (camp.description && camp.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter.length === 0 || statusFilter.some(s => camp.status.toLowerCase() === s.toLowerCase());
    const matchesType = typeFilter.length === 0 || typeFilter.some(t => camp.type.toLowerCase() === t.toLowerCase());
    return matchesSearch && matchesStatus && matchesType;
  });

  if (selectedCampaignForReport) {
    return (
      <CampaignReportView
        campaign={selectedCampaignForReport}
        activeMetricTab={activeMetricTab}
        onMetricTabChange={setActiveMetricTab}
        onBack={() => setSelectedCampaignForReport(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Campaigns</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your marketing and sales campaigns</p>
        </div>
        {canCreateCampaign && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#0A6EFF] text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]"
          >
            <Plus size={16} /> Create Campaign
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 shadow-lg border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4 relative">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Campaigns</h3>
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <BarChart2 size={18} className="text-blue-400" />
            </div>
          </div>
          <div className="flex items-end justify-between relative">
            <div className="text-3xl font-bold text-slate-900 dark:text-white">3</div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              <TrendingUp size={12} /> +2
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 shadow-lg border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4 relative">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Sent</h3>
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Send size={18} className="text-emerald-400" />
            </div>
          </div>
          <div className="flex items-end justify-between relative">
            <div className="text-3xl font-bold text-slate-900 dark:text-white">12,480</div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              <TrendingUp size={12} /> +18%
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 shadow-lg border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4 relative">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Leads Generated</h3>
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Users size={18} className="text-purple-400" />
            </div>
          </div>
          <div className="flex items-end justify-between relative">
            <div className="text-3xl font-bold text-slate-900 dark:text-white">1,248</div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              <TrendingUp size={12} /> +12%
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 shadow-lg border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4 relative">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Closed Customers</h3>
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Trophy size={18} className="text-orange-400" />
            </div>
          </div>
          <div className="flex items-end justify-between relative">
            <div className="text-3xl font-bold text-slate-900 dark:text-white">42</div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              <TrendingUp size={12} /> +5%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-white/[0.02] p-1 rounded-lg w-fit border border-gray-200 dark:border-white/[0.05]">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-white/[0.1] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <BarChart2 size={16} /> All Campaigns
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'email' ? 'bg-white/[0.1] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <Mail size={16} /> Email Templates
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sms' ? 'bg-white/[0.1] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <MessageSquare size={16} /> SMS Templates
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && (
        campaigns.length === 0 ? (
          <div className="py-12">
            <EmptyState
              type="campaigns"
              title="No Campaigns Created Yet"
              description="Launch targeted email or SMS marketing campaigns to follow up with your contacts, educate prospects, and drive sales automatically."
              actionLabel="Create Campaign"
              onAction={() => setIsModalOpen(true)}
              secondaryActionLabel={templates.filter(t => t.type === 'Email').length === 0 ? undefined : "Browse Templates"}
              onSecondaryAction={templates.filter(t => t.type === 'Email').length === 0 ? undefined : () => setActiveTab('email')}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-white/[0.02] p-3 rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm mb-4">
              <div className="flex-1 w-full relative flex items-center bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl transition-all duration-200 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/80 shadow-sm max-w-md">
                <div className="pl-3.5 flex items-center gap-2 shrink-0 py-2.5">
                  <Search size={15} className="text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search campaigns by name or target..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-1.5 pr-10 py-2 text-sm bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2 overflow-x-auto">
                 <TrelloFilter
                   searchTerm={searchTerm}
                   setSearchTerm={setSearchTerm}
                   statuses={[
                     { id: 'active', label: 'Active' },
                     { id: 'scheduled', label: 'Scheduled' },
                     { id: 'paused', label: 'Paused' },
                     { id: 'completed', label: 'Completed' },
                     { id: 'draft', label: 'Draft' },
                   ]}
                   selectedStatuses={statusFilter}
                   setSelectedStatuses={setStatusFilter}
                   labelsTitle="Type"
                   labels={[
                     { id: 'email', label: 'Email' },
                     { id: 'sms', label: 'SMS' },
                     { id: 'multi-channel', label: 'Multi-Channel' },
                   ]}
                   selectedLabels={typeFilter}
                   setSelectedLabels={setTypeFilter}
                 />
              </div>
            </div>

            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.05] shadow-lg backdrop-blur-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/[0.05]">
                    <tr>
                      <th className="px-6 py-4 font-medium">Campaign</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Target</th>
                      <th className="px-6 py-4 font-medium">Performance</th>
                      <th className="px-6 py-4 font-medium">Engagement</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredCampaigns.length > 0 ? filteredCampaigns.map(camp => (
                      <tr key={camp.id} className="hover:bg-white dark:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">{camp.name}</div>
                          {camp.description && <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{camp.description}</div>}
                          <div className="text-slate-500 text-xs mt-1">Created: {camp.createdAt}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            {getTypeIcon(camp.type)}
                            <span>{camp.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(camp.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-gray-50 dark:bg-white/[0.05] flex items-center justify-center border border-gray-200 dark:border-white/[0.05]">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <span className="text-sm">{camp.targetAudience}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Sent:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{camp.sentCount}</span>
                            </div>
                            {camp.openedCount !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Opened:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{camp.openedCount} ({Math.round((camp.openedCount / camp.sentCount) * 100)}%)</span>
                              </div>
                            )}
                            {camp.clickedCount !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Clicked:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{camp.clickedCount} ({Math.round((camp.clickedCount / camp.sentCount) * 100)}%)</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-gray-50 dark:bg-white/[0.05] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-slate-400 rounded-full" 
                                style={{ width: `${camp.engagement}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{camp.engagement}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              title="View Report" 
                              onClick={() => setSelectedCampaignForReport(camp)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.1] rounded-md transition-colors"
                            >
                              <BarChart2 size={16} />
                            </button>
                            {canSendCampaign && (
                              <>
                                {camp.status === 'active' ? (
                                  <button onClick={() => updateCampaign(camp.id, { status: 'paused' })} title="Pause" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.1] rounded-md transition-colors">
                                    <Pause size={16} />
                                  </button>
                                ) : camp.status === 'paused' ? (
                                  <button onClick={() => updateCampaign(camp.id, { status: 'active' })} title="Resume" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.1] rounded-md transition-colors">
                                    <Play size={16} />
                                  </button>
                                ) : null}
                              </>
                            )}
                            {canCreateCampaign && (
                              <button onClick={() => handleDuplicate(camp)} title="Duplicate" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.1] rounded-md transition-colors">
                                <Copy size={16} />
                              </button>
                            )}
                            {canEditCampaign && (
                              <button onClick={() => {
                                setNewCampaignName(camp.name);
                                setNewCampaignType(camp.type);
                                setNewCampaignTarget(camp.targetAudience);
                                setIsModalOpen(true);
                              }} title="Edit" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.1] rounded-md transition-colors">
                                <Edit2 size={16} />
                              </button>
                            )}
                            {canDeleteCampaign && (
                              <button onClick={() => { if(confirm('Archive this campaign?')) deleteCampaign(camp.id); }} title="Archive" className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Search size={32} className="text-slate-600 mb-3" />
                            <p>No campaigns found matching your criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === 'email' && (
        <div>
          <div className="flex justify-end mb-4">
            <button 
              onClick={() => { setNewTemplateType('Email'); setIsTemplateModalOpen(true); }}
              className="flex items-center gap-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-300 dark:border-white/[0.1] text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors"
            >
              <Plus size={16} /> New Email Template
            </button>
          </div>
          {emailTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {emailTemplates.map(template => (
                <div key={template.id} className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.05] p-5 shadow-lg backdrop-blur-xl flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 bg-gray-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md border border-gray-200 dark:border-white/[0.05]">
                      {template.category}
                    </span>
                    <Mail size={16} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{template.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">{template.subject}</p>
                  <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 mb-6 flex-grow">
                    <p className="line-clamp-3">{template.content}</p>
                  </div>
                  <div className="flex gap-3 mt-auto">
                    <button onClick={() => setPreviewTemplate(template)} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.02] border border-gray-300 dark:border-white/[0.1] rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white transition-colors">
                      Preview
                    </button>
                    <button onClick={() => {
                      setNewCampaignType('Email');
                      setMessageContent(template.content);
                      setIsModalOpen(true);
                    }} className="flex-1 py-2 text-sm font-medium text-white bg-[#0A6EFF] rounded-lg hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8">
              <EmptyState
                type="email"
                title="No Email Templates Found"
                description="Save reusable drafts for follow-ups, newsletters, and announcements to establish consistent client touchpoints."
                actionLabel="Create First Email Template"
                onAction={() => { setNewTemplateType('Email'); setIsTemplateModalOpen(true); }}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'sms' && (
        <div>
          <div className="flex justify-end mb-4">
            <button 
              onClick={() => { setNewTemplateType('SMS'); setIsTemplateModalOpen(true); }}
              className="flex items-center gap-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-300 dark:border-white/[0.1] text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors"
            >
              <Plus size={16} /> New SMS Template
            </button>
          </div>
          {smsTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {smsTemplates.map(template => (
                <div key={template.id} className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.05] p-5 shadow-lg backdrop-blur-xl flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 bg-gray-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md border border-gray-200 dark:border-white/[0.05]">
                      {template.category}
                    </span>
                    <MessageSquare size={16} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{template.name}</h3>
                  <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 mb-2 flex-grow">
                    <p className="line-clamp-4">{template.content}</p>
                  </div>
                  <div className="text-xs text-slate-500 mb-6">
                    {template.content.length} characters
                  </div>
                  <div className="flex gap-3 mt-auto">
                    <button onClick={() => setPreviewTemplate(template)} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.02] border border-gray-300 dark:border-white/[0.1] rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.05] hover:text-slate-905 hover:text-slate-900 dark:hover:text-white transition-colors">
                      Preview
                    </button>
                    <button onClick={() => {
                      setNewCampaignType('SMS');
                      setMessageContent(template.content);
                      setIsModalOpen(true);
                    }} className="flex-1 py-2 text-sm font-medium text-white bg-[#0A6EFF] rounded-lg hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8">
              <EmptyState
                type="sms"
                title="No SMS Templates Found"
                description="Draft quick SMS templates with dynamic placeholders like {{first_name}} to let your representatives reply to prospects instantly."
                actionLabel="Create First SMS Template"
                onAction={() => { setNewTemplateType('SMS'); setIsTemplateModalOpen(true); }}
              />
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create Campaign</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Draft a new message to send to your contacts.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label htmlFor="campaign-name-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Campaign Name</label>
                  <input 
                    id="campaign-name-input" 
                    value={newCampaignName} 
                    onChange={(e) => setNewCampaignName(e.target.value)} 
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" 
                    placeholder="e.g. Q3 Newsletter" 
                  />
                </div>
                <div>
                  <label htmlFor="campaign-type-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                  <select 
                    id="campaign-type-select" 
                    value={newCampaignType} 
                    onChange={(e) => setNewCampaignType(e.target.value)} 
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all"
                  >
                    <option value="Email" className="bg-gray-50 dark:bg-[#030712]">Email</option>
                    <option value="SMS" className="bg-gray-50 dark:bg-[#030712]">SMS</option>
                    <option value="Multi-channel" className="bg-gray-50 dark:bg-[#030712]">Multi-channel</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="campaign-audience-select" className="text-sm font-medium text-slate-700 dark:text-slate-300">Target Audience</label>
                    <button 
                      type="button" 
                      onClick={() => setIsAudienceModalOpen(true)}
                      className="text-xs font-bold text-[#0A6EFF] hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/20"
                    >
                      <Plus size={11} className="stroke-[3px]" /> Create New
                    </button>
                  </div>
                  <div className="relative">
                    <select 
                      id="campaign-audience-select" 
                      value={newCampaignTarget} 
                      onChange={(e) => setNewCampaignTarget(e.target.value)} 
                      className="w-full appearance-none bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all pr-10"
                    >
                      {targetAudiences.map(aud => (
                        <option key={aud} value={aud} className="bg-gray-50 dark:bg-[#030712]">{aud}</option>
                      ))}
                    </select>
                    <Tags size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex-1 flex items-center justify-between p-4 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <ListOrdered size={16} className="text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900 dark:text-white">Drip Sequence</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Multi-step campaign</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isSequence} onChange={() => setIsSequence(!isSequence)} />
                        <div className="w-9 h-5 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-50"></div>
                      </label>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Message Content</label>
                  
                  {isSequence ? (
                    <div className="space-y-4">
                      {sequenceSteps.map((step, index) => (
                        <div key={index} className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">{index + 1}</span>
                              Step {index + 1}
                            </h5>
                            {index > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Wait</span>
                                <input 
                                  type="number" 
                                  className="w-16 bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1]" 
                                  value={step.delay} 
                                  onChange={(e) => {
                                    const newSteps = [...sequenceSteps];
                                    newSteps[index].delay = parseInt(e.target.value) || 0;
                                    setSequenceSteps(newSteps);
                                  }} 
                                />
                                <select
                                  className="bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] appearance-none"
                                  value={step.unit}
                                  onChange={(e) => {
                                    const newSteps = [...sequenceSteps];
                                    newSteps[index].unit = e.target.value;
                                    setSequenceSteps(newSteps);
                                  }}
                                >
                                  <option value="minutes" className="bg-gray-50 dark:bg-[#030712]">minutes</option>
                                  <option value="hours" className="bg-gray-50 dark:bg-[#030712]">hours</option>
                                  <option value="days" className="bg-gray-50 dark:bg-[#030712]">days</option>
                                </select>
                                <button 
                                  onClick={() => {
                                    const newSteps = sequenceSteps.filter((_, i) => i !== index);
                                    setSequenceSteps(newSteps);
                                  }} 
                                  className="text-slate-500 hover:text-red-400 ml-2 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          <textarea 
                            rows={3} 
                            className="w-full bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] transition-all resize-none" 
                            placeholder="Message content for this step..."
                            value={step.content}
                            onChange={(e) => {
                              const newSteps = [...sequenceSteps];
                              newSteps[index].content = e.target.value;
                              setSequenceSteps(newSteps);
                            }}
                          ></textarea>
                        </div>
                      ))}
                      <button 
                        onClick={() => setSequenceSteps([...sequenceSteps, { delay: 3, unit: 'days', content: '' }])}
                        className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1"
                      >
                        <Plus size={14} /> Add Next Step
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex gap-2">
                              <button onClick={() => setBuilderMode('text')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${builderMode === 'text' ? 'bg-white/[0.1] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Text Editor</button>
                              <button onClick={() => setBuilderMode('visual')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${builderMode === 'visual' ? 'bg-white/[0.1] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><LayoutTemplate size={14} /> Visual Builder</button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <button onClick={() => setShowVarDropdown(!showVarDropdown)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-md hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                                  <Wand2 size={14} /> Insert Variable
                                </button>
                                {showVarDropdown && (
                                  <div className="absolute right-0 top-full mt-1 w-48 bg-blue-50 dark:bg-[#0A1931] border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                                    {['{{first_name}}', '{{last_name}}', '{{company_name}}', '{{sender_name}}', '{{sender_email}}'].map(v => (
                                      <button key={v} onClick={() => {
                                        setMessageContent(prev => prev + v);
                                        setShowVarDropdown(false);
                                      }} className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        {v}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {isBrainstorming && (
                            <div className="mb-4 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5"><Sparkles size={14} /> AI Team Brainstorming Session</h4>
                                  <p className="text-xs text-slate-500 mt-0.5">Draft campaign ideas together with your AI assistant.</p>
                                </div>
                                <button onClick={() => setIsBrainstorming(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"><X size={16} /></button>
                              </div>
                              <div className="flex gap-2">
                                <input 
                                  value={brainstormPrompt} 
                                  onChange={(e) => setBrainstormPrompt(e.target.value)} 
                                  placeholder="e.g. Generate 3 short punchy emails for a SaaS product..." 
                                  className="flex-1 bg-white dark:bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 text-slate-900 dark:text-white placeholder-slate-400" 
                                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
                                />
                                <button onClick={handleGenerateIdeas} disabled={isGenerating || !brainstormPrompt} className="px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2 transition-colors">
                                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                  Generate
                                </button>
                              </div>
                              
                              {generatedIdeas.length > 0 && (
                                <div className="mt-4 space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                  {generatedIdeas.map((idea, i) => (
                                    <div key={i} className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg p-3 text-sm relative group hover:border-purple-500/50 transition-colors shadow-sm">
                                      <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 pr-10">{idea}</p>
                                      <button 
                                        onClick={() => {
                                          setMessageContent(idea);
                                        }} 
                                        className="absolute right-3 top-3 p-1.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-500/40 opacity-0 group-hover:opacity-100 transition-opacity" title="Use this idea"
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {builderMode === 'text' ? (
                            <textarea 
                              rows={8} 
                              className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all custom-scrollbar resize-none" 
                              placeholder="Hello {{first_name}}, ..."
                              value={messageContent}
                              onChange={(e) => setMessageContent(e.target.value)}
                            ></textarea>
                          ) : (
                            <div className="h-48 w-full bg-black/20 border border-gray-200 dark:border-white/[0.05] border-dashed rounded-lg flex flex-col items-center justify-center text-slate-500">
                              <LayoutTemplate size={32} className="mb-3 opacity-50" />
                              <p className="text-sm">Drag and drop blocks here</p>
                              <div className="flex gap-2 mt-4">
                                <span className="px-3 py-1.5 bg-gray-50 dark:bg-white/[0.05] rounded text-xs border border-gray-200 dark:border-white/[0.05] cursor-grab hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors">Text Block</span>
                                <span className="px-3 py-1.5 bg-gray-50 dark:bg-white/[0.05] rounded text-xs border border-gray-200 dark:border-white/[0.05] cursor-grab hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors">Image</span>
                                <span className="px-3 py-1.5 bg-gray-50 dark:bg-white/[0.05] rounded text-xs border border-gray-200 dark:border-white/[0.05] cursor-grab hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors">Button</span>
                              </div>
                            </div>
                          )}
                          <div className="mt-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Quick Fields (Click to insert):</span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { key: '{{first_name}}', label: 'First Name' },
                                { key: '{{last_name}}', label: 'Last Name' },
                                { key: '{{company_name}}', label: 'Company Name' },
                                { key: '{{sender_name}}', label: 'My Name' },
                                { key: '{{sender_email}}', label: 'My Email' }
                              ].map(tag => (
                                <button
                                  type="button"
                                  key={tag.key}
                                  onClick={() => setMessageContent(prev => prev + tag.key)}
                                  className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 font-medium px-2 py-1 rounded border border-gray-200 dark:border-white/[0.05] transition-all hover:border-gray-300 dark:hover:border-white/[0.1]"
                                  title={`Insert ${tag.label}`}
                                >
                                  {tag.key}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 flex flex-col h-full min-h-[300px]">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-white/[0.05]">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Live Preview
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({newCampaignType})</span>
                            </div>
                            <div className="flex gap-1 bg-black/10 dark:bg-black/20 p-0.5 rounded-md border border-gray-200 dark:border-white/[0.05]">
                              <button 
                                type="button"
                                onClick={() => setPreviewDevice('desktop')}
                                className={`p-1 rounded transition-colors ${previewDevice === 'desktop' ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}
                                title="Desktop Preview"
                              >
                                <Monitor size={14} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setPreviewDevice('mobile')}
                                className={`p-1 rounded transition-colors ${previewDevice === 'mobile' ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}
                                title="Mobile Preview"
                              >
                                <Smartphone size={14} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex-1 flex items-center justify-center py-2 bg-slate-50/50 dark:bg-black/10 rounded-lg p-3">
                            {previewDevice === 'mobile' ? (
                              <div className="w-[250px] aspect-[9/18] max-h-[360px] border-[5px] border-slate-800 dark:border-slate-700 rounded-[2rem] bg-white dark:bg-[#0c0f16] shadow-xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-lg z-10 flex items-center justify-center">
                                  <div className="w-1 h-1 bg-slate-800 rounded-full mr-2"></div>
                                  <div className="w-6 h-0.5 bg-slate-800 rounded"></div>
                                </div>
                                <div className="pt-6 px-3 pb-3 flex-1 flex flex-col overflow-hidden text-xs">
                                  {newCampaignType === 'SMS' ? (
                                    <div className="flex flex-col h-full">
                                      <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 mb-2 font-medium">Text Message: Today</div>
                                      <div className="bg-emerald-500 text-white p-2.5 rounded-2xl rounded-tr-sm max-w-[85%] self-end break-words shadow-sm text-[11px] whitespace-pre-wrap leading-relaxed">
                                        {getPreviewText(messageContent) || <span className="italic opacity-60">Message body is empty...</span>}
                                      </div>
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1 pr-1">Delivered</div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#131924] rounded-lg overflow-hidden border border-gray-200/50 dark:border-white/[0.05]">
                                      <div className="p-2 border-b border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02]">
                                        <div className="font-semibold text-slate-900 dark:text-white text-[10px] truncate">{getSubjectLine(messageContent)}</div>
                                        <div className="text-[9px] text-slate-500 mt-0.5">To: John Doe ({newCampaignTarget})</div>
                                      </div>
                                      <div className="p-2.5 flex-1 overflow-y-auto custom-scrollbar text-slate-700 dark:text-slate-300 leading-relaxed font-sans text-[10px] whitespace-pre-wrap">
                                        {getPreviewText(messageContent) || <span className="opacity-50 italic">Your email preview will appear here...</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full min-h-[180px] bg-white dark:bg-[#131924] border border-gray-200 dark:border-white/[0.05] rounded-lg flex flex-col shadow-inner overflow-hidden animate-in fade-in duration-200 text-xs">
                                {newCampaignType === 'SMS' ? (
                                  <div className="flex flex-col h-full p-4 justify-center">
                                    <div className="bg-emerald-500 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[70%] self-end break-words shadow text-sm whitespace-pre-wrap leading-relaxed">
                                      {getPreviewText(messageContent) || <span className="italic opacity-60">Message body is empty...</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1.5 pr-2 font-medium">Delivered via SMS Texting • Today</div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col h-full">
                                    <div className="p-3 border-b border-gray-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400 w-12 font-medium">Subject:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{getSubjectLine(messageContent)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400 w-12 font-medium">To:</span>
                                        <span className="text-slate-600 dark:text-slate-400 truncate">John Doe &lt;jdoe@example.com&gt; ({newCampaignTarget})</span>
                                      </div>
                                    </div>
                                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar text-slate-700 dark:text-slate-300 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                                      {getPreviewText(messageContent) || <p className="opacity-50 italic text-center py-6 text-slate-400">Your email preview will appear here...</p>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white">Schedule Campaign</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Send this campaign at a later date and time.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isScheduling} onChange={() => setIsScheduling(!isScheduling)} />
                      <div className="w-11 h-6 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6EFF]"></div>
                    </label>
                  </div>
                  {isScheduling && (
                    <div className="mt-3 grid grid-cols-2 gap-4 p-4 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label htmlFor="campaign-schedule-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Date</label>
                        <input 
                          id="campaign-schedule-date"
                          type="date" 
                          value={newCampaignDate}
                          onChange={(e) => setNewCampaignDate(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] transition-all" 
                        />
                      </div>
                      <div>
                        <label htmlFor="campaign-schedule-time" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Time</label>
                        <input 
                          id="campaign-schedule-time"
                          type="time" 
                          value={newCampaignTime}
                          onChange={(e) => setNewCampaignTime(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] transition-all" 
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg mt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <Zap size={16} className="text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">Trigger Automation</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Send automatically based on events.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isTriggerBased} onChange={() => setIsTriggerBased(!isTriggerBased)} disabled={isScheduling} />
                      <div className="w-9 h-5 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-disabled:opacity-50"></div>
                    </label>
                  </div>
                  {isTriggerBased && (
                    <div className="mt-3 p-4 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg animate-in fade-in slide-in-from-top-2">
                      <label htmlFor="campaign-trigger-event" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">When this event occurs:</label>
                      <select 
                        id="campaign-trigger-event"
                        value={triggerEvent}
                        onChange={(e) => setTriggerEvent(e.target.value)}
                        className="w-full bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] appearance-none"
                      >
                        <option value="status_hot" className="bg-gray-50 dark:bg-[#030712]">Contact Status changes to 'Hot'</option>
                        <option value="new_lead" className="bg-gray-50 dark:bg-[#030712]">New Contact is added</option>
                        <option value="deal_won" className="bg-gray-50 dark:bg-[#030712]">Deal is marked as 'Won'</option>
                        <option value="no_activity_30" className="bg-gray-50 dark:bg-[#030712]">No activity for 30 days</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#030712]">
              <button type="button" onClick={handleSaveDraft} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors">Save Draft</button>
              <button onClick={handleSend} className="flex items-center gap-2 px-4 py-2 bg-[#0A6EFF] text-slate-900 dark:text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                {isScheduling ? <Calendar size={16} /> : <Send size={16} />}
                {isScheduling ? 'Schedule' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Target Audience Modal */}
      {isAudienceModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f131a] text-slate-900 dark:text-slate-100 rounded-2xl border border-gray-200 dark:border-white/[0.08] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/[0.04]">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Target Audience</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Define conditions to segment your contacts</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAudienceModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Audience Name Field */}
              <div>
                <label id="audience-name-label" htmlFor="audience-name-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Audience Name <span className="text-red-500">*</span>
                </label>
                <input 
                  id="audience-name-input" 
                  aria-labelledby="audience-name-label"
                  value={audienceName} 
                  onChange={(e) => setAudienceName(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 transition-all" 
                  placeholder="e.g., High-Value Prospects" 
                />
              </div>

              {/* Conditions list header */}
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Conditions <span className="text-red-500">*</span>
                </span>
                <button 
                  type="button" 
                  onClick={handleAddCondition}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.1] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.05] transition-all flex items-center gap-1.5"
                >
                  <Plus size={13} className="stroke-[2.5px]" /> Add Condition
                </button>
              </div>

              {/* Conditions List */}
              <div className="space-y-3.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                {audienceConditions.map((cond, index) => (
                  <div 
                    key={index} 
                    className="p-3.5 bg-slate-50/70 dark:bg-white/[0.01] border border-gray-100 dark:border-white/[0.03] rounded-xl flex items-end gap-3 animate-in fade-in slide-in-from-top-1.5 relative group"
                  >
                    <div className="grid grid-cols-3 gap-2.5 flex-1 text-left">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Field</label>
                        <select 
                          value={cond.field} 
                          onChange={(e) => handleConditionChange(index, 'field', e.target.value)} 
                          className="w-full bg-white dark:bg-black/35 border border-gray-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="Status">Status</option>
                          <option value="Source">Source</option>
                          <option value="Industry">Industry</option>
                          <option value="Customer Type">Customer Type</option>
                          <option value="Role">Role</option>
                          <option value="Lead Score">Lead Score</option>
                          <option value="Deal Value">Deal Value ($)</option>
                          <option value="Date Created">Date Created</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Operator</label>
                        <select 
                          value={cond.operator} 
                          onChange={(e) => handleConditionChange(index, 'operator', e.target.value)} 
                          className="w-full bg-white dark:bg-black/35 border border-gray-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="Equals">Equals</option>
                          <option value="Not Equals">Not Equals</option>
                          <option value="Contains">Contains</option>
                          <option value="Greater Than">Greater Than</option>
                          <option value="Less Than">Less Than</option>
                          <option value="In Last (days)">In Last (days)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Value</label>
                        <input 
                          value={cond.value} 
                          onChange={(e) => handleConditionChange(index, 'value', e.target.value)} 
                          placeholder="Enter value" 
                          className="w-full bg-white dark:bg-black/35 border border-gray-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    
                    {audienceConditions.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveCondition(index)}
                        className="p-1.5 mb-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors"
                        title="Remove condition"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Estimated audience size banner matching style from screenshot */}
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-500/20 p-3.5 rounded-xl">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Estimated Audience Size: <span className="font-bold">~{getEstimatedSize()} contacts</span>
                </div>
                <div className="text-[10px] text-blue-500 dark:text-blue-400/80 mt-1 font-medium">
                  All conditions must be met (AND logic)
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2.5 p-4 border-t border-gray-100 dark:border-white/[0.04] bg-slate-50 dark:bg-white/[0.01]">
              <button 
                type="button" 
                onClick={() => setIsAudienceModalOpen(false)} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg border border-gray-200 dark:border-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleCreateAudience} 
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-400 text-white dark:text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Create Audience
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Create Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create {newTemplateType} Template</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Save a message to reuse in future campaigns.</p>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Template Name</label>
                <input 
                  className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" 
                  placeholder="e.g. Welcome Series - Email 1" 
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                <select 
                  className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                >
                  <option className="bg-gray-50 dark:bg-[#030712]">Marketing</option>
                  <option className="bg-gray-50 dark:bg-[#030712]">Sales</option>
                  <option className="bg-gray-50 dark:bg-[#030712]">Onboarding</option>
                  <option className="bg-gray-50 dark:bg-[#030712]">Support</option>
                </select>
              </div>
              {newTemplateType === 'Email' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject Line</label>
                  <input 
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" 
                    placeholder="Welcome to LeadCRM!" 
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({...newTemplate, subject: e.target.value})}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Message Content</label>
                <textarea 
                  rows={6} 
                  className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all custom-scrollbar resize-none" 
                  placeholder={`Hi {{first_name}},\n\n...`}
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                ></textarea>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#030712]">
              <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
              <button 
                onClick={handleSaveTemplate} 
                className="px-4 py-2 bg-[#0A6EFF] text-slate-900 dark:text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Preview Template Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Template Preview</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{previewTemplate.name}</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {previewTemplate.type === 'Email' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                  <div className="text-sm text-slate-900 dark:text-white font-medium">{previewTemplate.subject}</div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Content</label>
                <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {previewTemplate.content}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#030712]">
              <button onClick={() => setPreviewTemplate(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors">Close</button>
              <button 
                onClick={() => {
                  setNewCampaignType(previewTemplate.type);
                  setMessageContent(previewTemplate.content);
                  setIsModalOpen(true);
                  setPreviewTemplate(null);
                }} 
                className="px-4 py-2 bg-[#0A6EFF] text-slate-900 dark:text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]"
              >
                Use Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
