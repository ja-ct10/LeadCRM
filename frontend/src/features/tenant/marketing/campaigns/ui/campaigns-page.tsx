'use client';
import DOMPurify from 'dompurify';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { Campaign, Template } from '@/store/types';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useCampaignsData } from '../hooks/use-campaigns-data';
import { campaignsApi } from '@/shared/services/campaigns.api';
import { templatesApi } from '@/shared/services/templates.api';
import { EMAIL_VARIABLE_TOKENS, MarketingTemplateSchema, renderEmailVariables } from '@leadcrm/shared';
import { FieldError } from './audience-panel';
import { TableLoadingState } from '@/shared/components/crm/table-loading-state';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { Plus, Send, X, Mail, MessageSquare, Megaphone, BarChart2, Eye, MousePointerClick, Edit2, Trash2, Play, Pause, Search, Filter, TrendingUp, TrendingDown, Copy, Calendar, ArrowLeft, SplitSquareHorizontal, ListOrdered, Monitor, Smartphone, Tags, Wand2, LayoutTemplate, Zap, Trophy, MoreVertical, Sparkles, Users, Loader2 } from 'lucide-react';
import EmptyState from '@/shared/components/empty-state';
import { ModuleFilterRail } from '@/shared/components/crm/module-filter-rail';
import { SideSheet } from '@/shared/components/side-sheet';
import { CampaignReportView } from './campaign-report-view';
import { CampaignBuilder } from './campaign-builder';

import { LeadsPagination } from '@/shared/components/crm/leads-pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';


export default function CampaignsPage() {


  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>();
  const [builderSubject, setBuilderSubject] = useState('');
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({});
  const templateLock = useRef(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms'>('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderInitialType, setBuilderInitialType] = useState<string | undefined>();
  const [builderInitialContent, setBuilderInitialContent] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [currentPage, goToPage] = useState(1);
  const [pageSize, updatePageSize] = useState(25);
  const setPageSize = (size: number) => { updatePageSize(size); goToPage(1); };
  // Route-scoped fetch — replaces DataContext Batch 2 startup load
  const {
    metrics,
    total: totalItems,
    campaigns: serverCampaigns,
    templates: serverTemplates,
    isInitialLoad,
    isRefreshing,
    error: campaignsError,
    refetch: refetchCampaigns,
  } = useCampaignsData({ query: { page: currentPage, limit: pageSize, search: searchTerm,
    status: statusFilter.map(value => value.toUpperCase()).join(','),
    type: typeFilter.map(value => value.toUpperCase().replace('-', '_')).join(','),
  } });

  const campaigns = serverCampaigns;
  const templates = serverTemplates;
  useEffect(() => { goToPage(1); }, [searchTerm, statusFilter, typeFilter, activeTab]);
  useEffect(() => {
    if (!isInitialLoad && !campaignsError && currentPage > Math.max(1, Math.ceil(totalItems / pageSize))) goToPage(Math.max(1, Math.ceil(totalItems / pageSize)));
  }, [isInitialLoad, campaignsError, currentPage, totalItems, pageSize]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<Campaign | null>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'>('sent');
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateType, setNewTemplateType] = useState<'Email' | 'SMS'>('Email');
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', content: '', category: 'Marketing' });
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const [showVarDropdown, setShowVarDropdown] = useState(false);


  useEffect(() => { setShowBuilder(false); setEditingCampaign(undefined); setSelectedCampaignForReport(null); setIsTemplateModalOpen(false); setPreviewTemplate(null); setNewTemplate({ name: '', subject: '', content: '', category: 'Marketing' }); }, [user?.tenantId, user?.activeEnvironment]);

  const getPreviewText = (text: string) => renderEmailVariables(text, { first_name: 'John', last_name: 'Doe', company_name: 'Example Company', sender_name: 'Configured sender', sender_email: 'sender@example.com', contact_number: '+639123456789', status: 'HOT' });
  // ── KPI computations (real data, no hardcoded numbers) ─────────────────────
  const activeCampaignCount = metrics.activeCampaigns;
  const totalMessagesSent = metrics.sent;
  const totalOpened = metrics.opened;
  const totalClicked = metrics.clicked;
  const avgOpenRate = totalMessagesSent ? totalOpened / totalMessagesSent * 100 : 0;
  const canCreateCampaign = useHasPermission('campaigns.create');
  const canEditCampaign = useHasPermission('campaigns.edit');
  const canDeleteCampaign = useHasPermission('campaigns.delete');
  const canSendCampaign = useHasPermission('campaigns.send');

  const handleDuplicate = async (camp: Campaign) => {
    try {
      const full = (await campaignsApi.get(camp.id)).data;
      await campaignsApi.create({ name: `${full.name.slice(0, 140)} (Copy)`, type: full.type === 'Email' ? 'EMAIL' : full.type === 'Sms' ? 'SMS' : 'MULTI_CHANNEL', subject: full.subject || '', body: full.body || '', targetAudienceId: full.targetAudienceId, audienceSource: full.audienceSource });
      refetchCampaigns(); toast.success('Draft copy created.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not duplicate campaign.'); }
  };
  const deleteCampaign = async (id: string) => {
    try { await campaignsApi.archive(id); refetchCampaigns(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not archive campaign.'); }
  };
  const handleSaveTemplate = async () => {
    if (templateLock.current) return;
    const parsed = MarketingTemplateSchema.safeParse({ ...newTemplate, type: newTemplateType });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
      setTemplateErrors(errors); return;
    }
    templateLock.current = true; setSavingTemplate(true); setTemplateErrors({});
    try {
      await templatesApi.create({ ...parsed.data, content: parsed.data.type === 'Email' ? DOMPurify.sanitize(parsed.data.content, { FORBID_TAGS: ['form', 'input', 'button', 'svg', 'iframe', 'object', 'embed'] }) : parsed.data.content });
      setIsTemplateModalOpen(false); setNewTemplate({ name: '', subject: '', content: '', category: 'Marketing' });
      refetchCampaigns(); toast.success('Template saved.');
    } catch (e) {
      const error = e as Error & { fieldErrors?: Record<string, string[]> };
      const errors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(error.fieldErrors || {})) if (messages[0]) errors[key] = messages[0];
      if (!Object.keys(errors).length) errors.form = error.message;
      setTemplateErrors(errors);
    } finally { templateLock.current = false; setSavingTemplate(false); }
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
      case 'sent':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">{status}</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">{status}</span>;
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

  const filteredCampaigns = campaigns;

  if (showBuilder) {
    return <CampaignBuilder key={`${user?.tenantId}:${user?.activeEnvironment}`} initialCampaign={editingCampaign} initialType={builderInitialType} initialContent={builderInitialContent} initialSubject={builderSubject} canSend={canSendCampaign}
      onBack={() => { setShowBuilder(false); setEditingCampaign(undefined); setBuilderInitialContent(undefined); setBuilderSubject(''); refetchCampaigns(); }} />;
  }

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

  // ── Error state (only when no data to show) ───────────────────────────────
  if (campaignsError && campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">{campaignsError}</p>
        <button
          onClick={refetchCampaigns}
          className="text-xs text-blue-500 hover:text-blue-600 underline underline-offset-2 cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 space-y-4"
    >

      {/* 1. Standardized Header Row */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Campaigns
          </h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
            {isInitialLoad ? '…' : totalItems} total
          </span>
        </div>
        {canCreateCampaign && campaigns.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setEditingCampaign(undefined);
                    setBuilderInitialType('Email');
                    setBuilderInitialContent(undefined);
                    setBuilderSubject('');
                    setShowBuilder(true);
                  }}
                  aria-label="Create campaign"
                  className="inline-flex h-9 w-9 sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 sm:px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  <Plus size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Create Campaign</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Create Campaign</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* 2. Overview Operational KPI Strip */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Active Campaigns</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{activeCampaignCount}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Total Submitted</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{totalMessagesSent.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Total Opened</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{totalOpened.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Total Clicked</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{totalClicked.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Avg Open Rate</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{avgOpenRate.toFixed(1)}%</span>
            <div className="w-12 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(avgOpenRate, 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(avgOpenRate)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Average open rate: ${avgOpenRate.toFixed(1)}%`}
            />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + contextual action per active tab */}
      <div className="flex items-center justify-between gap-2">
        {/* Tab strip */}
        <div className="flex items-center gap-1 bg-white dark:bg-white/2 p-1 rounded-lg w-fit border border-gray-200 dark:border-white/5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab('all')}
                  aria-label="All Campaigns"
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${activeTab === 'all' ? 'bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <BarChart2 size={16} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>All Campaigns</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab('email')}
                  aria-label="Email Templates"
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${activeTab === 'email' ? 'bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Mail size={16} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Email Templates</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab('sms')}
                  aria-label="SMS Templates"
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${activeTab === 'sms' ? 'bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <MessageSquare size={16} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>SMS Templates</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Contextual [+] button — changes with active tab, mobile-primary action */}
        {canCreateCampaign && (
          <TooltipProvider>
            {activeTab === 'email' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setNewTemplateType('Email'); setIsTemplateModalOpen(true); }}
                    aria-label="New Email Template"
                    className="h-8 w-8 flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer md:hidden"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New Email Template</TooltipContent>
              </Tooltip>
            )}
            {activeTab === 'sms' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setNewTemplateType('SMS'); setIsTemplateModalOpen(true); }}
                    aria-label="New SMS Template"
                    className="h-8 w-8 flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer md:hidden"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New SMS Template</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && (
        totalItems === 0 && !searchTerm && !statusFilter.length && !typeFilter.length && !isInitialLoad ? (
          <div className="py-12">
            <EmptyState
              type="campaigns"
              title="No Campaigns Created Yet"
              actionLabel={canCreateCampaign ? 'Create Campaign' : undefined}
              onAction={canCreateCampaign ? () => setShowBuilder(true) : undefined}
              secondaryActionLabel={templates.filter(t => t.type === 'Email').length === 0 ? undefined : "Browse Templates"}
              onSecondaryAction={templates.filter(t => t.type === 'Email').length === 0 ? undefined : () => setActiveTab('email')}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6B85]" />
                <input
                  type="text"
                  aria-label="Search campaigns"
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-full min-w-0 rounded-lg border border-[#E4E9F0] dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-8 text-[13px] text-[#0F172A] dark:text-slate-200 placeholder:text-[#5A6B85] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
                {searchTerm && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <button onClick={() => setSearchTerm('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#5A6B85] focus-visible:ring-2 focus-visible:ring-blue-600">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </TooltipTrigger><TooltipContent>Clear search</TooltipContent></Tooltip></TooltipProvider>
                )}
              </div>
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label="Filter campaigns"
                  aria-expanded={showFilters}
                  className={`inline-flex h-9 w-9 sm:w-auto shrink-0 items-center justify-center gap-1.5 sm:px-3 rounded-lg border text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${showFilters ? 'border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-500/10' : 'border-[#E4E9F0] bg-white text-[#5A6B85] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                >
                  <Filter size={14} aria-hidden="true" /><span className="hidden sm:inline">Filter</span>
                </button>
              </TooltipTrigger><TooltipContent>Filter</TooltipContent></Tooltip></TooltipProvider>
            </div>

            <div className="flex min-w-0 items-start gap-3">
              <ModuleFilterRail
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(false)}
                filterSearchTerm={filterSearchTerm}
                onFilterSearch={setFilterSearchTerm}
                totalRecords={totalItems}
                onClearFilters={searchTerm || statusFilter.length || typeFilter.length ? () => { setSearchTerm(''); setStatusFilter([]); setTypeFilter([]); } : undefined}
                filterGroups={[
                  { id: 'status', label: 'Status', items: [
                     { id: 'sending', label: 'Sending' },
                     { id: 'sent', label: 'Sent to provider' },
                     { id: 'partially_sent', label: 'Partially sent' },
                     { id: 'failed', label: 'Failed' },
                     { id: 'active', label: 'Active' },
                     { id: 'scheduled', label: 'Scheduled' },
                     { id: 'paused', label: 'Paused' },
                     { id: 'completed', label: 'Completed' },
                     { id: 'draft', label: 'Draft' },
                   ].map(item => ({ ...item, isChecked: statusFilter.includes(item.id) })) },
                  { id: 'type', label: 'Type', items: [
                     { id: 'email', label: 'Email' },
                     { id: 'sms', label: 'SMS' },
                     { id: 'multi-channel', label: 'Multi-Channel' },
                   ].map(item => ({ ...item, isChecked: typeFilter.includes(item.id) })) },
                ]}
                onFilterToggle={(groupId, itemId) => {
                  const setFilter = groupId === 'status' ? setStatusFilter : setTypeFilter;
                  setFilter(previous => previous.includes(itemId) ? previous.filter(id => id !== itemId) : [...previous, itemId]);
                }}
              />
              <div className="min-w-0 flex-1">
            <div className="bg-white dark:bg-white/2 rounded-xl border border-gray-200 dark:border-white/5 shadow-lg backdrop-blur-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-white/2 text-slate-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/5">
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
                  <tbody className="divide-y divide-white/5">
                    {isInitialLoad ? <tr><td colSpan={7}><TableLoadingState label="Loading campaigns..." /></td></tr> : filteredCampaigns.length > 0 ? filteredCampaigns.map(camp => (
                      <tr key={camp.id} className="hover:bg-white dark:bg-white/2 transition-colors group">
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
                            <div className="w-5 h-5 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <span className="text-sm">{camp.targetAudience}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Submitted:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{camp.sentCount}</span>
                            </div>
                            {camp.openedCount !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Opened:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{camp.openedCount} ({camp.sentCount ? Math.round((camp.openedCount / camp.sentCount) * 100) : 0}%)</span>
                              </div>
                            )}
                            {camp.clickedCount !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Clicked:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{camp.clickedCount} ({camp.sentCount ? Math.round((camp.clickedCount / camp.sentCount) * 100) : 0}%)</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-gray-50 dark:bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-slate-400 rounded-full" 
                                style={{ width: `${camp.sentCount ? Math.round((camp.openedCount || 0) / camp.sentCount * 100) : 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{camp.sentCount ? Math.round((camp.openedCount || 0) / camp.sentCount * 100) : 0}% opened</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><button
                              aria-label="View Report"
                              onClick={() => setSelectedCampaignForReport(camp)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                            >
                              <BarChart2 size={16} />
                            </button></TooltipTrigger><TooltipContent>View Report</TooltipContent></Tooltip></TooltipProvider>
                            {canCreateCampaign && (
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><button onClick={() => handleDuplicate(camp)} aria-label="Duplicate" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors">
                                <Copy size={16} />
                              </button></TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip></TooltipProvider>
                            )}
                            {canEditCampaign && camp.status === 'Draft' && (
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><button onClick={() => {
                                setEditingCampaign(camp);
                                setShowBuilder(true);
                              }} aria-label="Edit" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors">
                                <Edit2 size={16} />
                              </button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip></TooltipProvider>
                            )}
                            {canDeleteCampaign && (
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><button onClick={() => { if(confirm('Archive this campaign?')) deleteCampaign(camp.id); }} aria-label="Archive" className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors">
                                <Trash2 size={16} />
                              </button></TooltipTrigger><TooltipContent>Archive</TooltipContent></Tooltip></TooltipProvider>
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

            <div className="mt-4">
              <LeadsPagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalRecords={totalItems}
                loading={isInitialLoad} refreshing={isRefreshing} disabled={isInitialLoad || isRefreshing}
                onPageChange={goToPage}
                onPageSizeChange={setPageSize}
              />
            </div>
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
              className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New Email Template
            </button>
          </div>
          {emailTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {emailTemplates.map(template => (
                <div key={template.id} className="bg-white dark:bg-white/2 rounded-xl border border-gray-200 dark:border-white/5 p-5 shadow-lg backdrop-blur-xl flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 bg-gray-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md border border-gray-200 dark:border-white/5">
                      {template.category}
                    </span>
                    <Mail size={16} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{template.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">{template.subject}</p>
                  <div className="bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 mb-6 grow">
                    <p className="line-clamp-3">{template.content}</p>
                  </div>
                  <div className="flex gap-3 mt-auto">
                    <button onClick={() => setPreviewTemplate(template)} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-white/2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors">
                      Preview
                    </button>
                    <button onClick={() => {
                      setBuilderInitialType('Email'); setBuilderInitialContent(template.content); setBuilderSubject(template.subject || '');
                      setBuilderInitialType('Email');
                      setBuilderInitialContent(template.content); setBuilderSubject(template.subject || '');
                      setShowBuilder(true);
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
              className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New SMS Template
            </button>
          </div>
          {smsTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {smsTemplates.map(template => (
                <div key={template.id} className="bg-white dark:bg-white/2 rounded-xl border border-gray-200 dark:border-white/5 p-5 shadow-lg backdrop-blur-xl flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 bg-gray-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md border border-gray-200 dark:border-white/5">
                      {template.category}
                    </span>
                    <MessageSquare size={16} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{template.name}</h3>
                  <div className="bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 mb-2 grow">
                    <p className="line-clamp-4">{template.content}</p>
                  </div>
                  <div className="text-xs text-slate-500 mb-6">
                    {template.content.length} characters
                  </div>
                  <div className="flex gap-3 mt-auto">
                    <button onClick={() => setPreviewTemplate(template)} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-white/2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-slate-905 hover:text-slate-900 dark:hover:text-white transition-colors">
                      Preview
                    </button>
                    <button onClick={() => {
                      setBuilderInitialType('SMS'); setBuilderInitialContent(template.content);
                      setShowBuilder(true);
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

      {/* Create Campaign Side Panel */}
      {/* Create Template Side Panel */}
      <SideSheet isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title={`Create ${newTemplateType} Template`} subtitle="Save a message to reuse in future campaigns.">
        <div className="p-6 space-y-4">
              <div>
                <label htmlFor="template-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Template Name <span className="text-red-500">*</span></label>
                <input 
                  id="template-name" className="w-full bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Welcome Series - Email 1" 
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                />
                <FieldError message={templateErrors.name} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                <select 
                  className="w-full bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                >
                  <option className="bg-gray-50 dark:bg-slate-950">Marketing</option>
                  <option className="bg-gray-50 dark:bg-slate-950">Sales</option>
                  <option className="bg-gray-50 dark:bg-slate-950">Onboarding</option>
                  <option className="bg-gray-50 dark:bg-slate-950">Support</option>
                </select>
              </div>
              {newTemplateType === 'Email' && (
                <div>
                  <label htmlFor="template-subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject Line <span className="text-red-500">*</span></label>
                  <input 
                    id="template-subject" className="w-full bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Welcome to LeadCRM!" 
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({...newTemplate, subject: e.target.value})}
                  />
                  <FieldError message={templateErrors.subject} />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="template-content" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Message Content <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <button 
                      type="button"
                      onClick={() => setShowVarDropdown(!showVarDropdown)} 
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-md hover:bg-blue-500/20 transition-colors duration-200 border border-blue-500/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Wand2 size={14} /> Insert Variable
                    </button>
                    {showVarDropdown && (
                      <div className="absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden z-50 backdrop-blur-xl">
                        {EMAIL_VARIABLE_TOKENS.map(v => (
                          <button 
                            key={v} 
                            type="button"
                            onClick={() => { 
                              setNewTemplate({...newTemplate, content: newTemplate.content + v}); 
                              setShowVarDropdown(false); 
                            }} 
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <textarea 
                  id="template-content" rows={8}
                  className="w-full bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors resize-none" 
                  placeholder={`Hi {{first_name}},\n\n...`}
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                ></textarea>
                <FieldError message={templateErrors.content} />
              </div>
          <FieldError message={templateErrors.form} />
          <div className="sticky bottom-0 flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/5 bg-white dark:bg-slate-900">
            <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg border border-gray-200 dark:border-white/8 transition-colors">Cancel</button>
            <button 
              onClick={handleSaveTemplate} disabled={savingTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              {savingTemplate ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </SideSheet>
      {/* Preview Template Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/10 w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/5">
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
                  <div className="text-sm text-slate-900 dark:text-white font-medium">{getPreviewText(previewTemplate.subject || '')}</div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Content</label>
                <div className="bg-white dark:bg-white/2 border border-gray-200 dark:border-white/5 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {getPreviewText(previewTemplate.content)}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-950">
              <button onClick={() => setPreviewTemplate(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 rounded-lg transition-colors">Close</button>
              <button 
                onClick={() => {
                  setBuilderInitialType(previewTemplate.type); setBuilderInitialContent(previewTemplate.content); setBuilderSubject(previewTemplate.subject || '');
                  setShowBuilder(true);
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
    </motion.div>
  );
}
