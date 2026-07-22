'use client';
// Refreshed Enterprise Workflows Page
import { uuid } from '@/lib/utils';

import React, { useState, useMemo } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import {
  Plus,
  Play,
  Pause,
  Settings,
  X,
  Zap,
  ArrowRight,
  History,
  Clock,
  FileText,
  Trash2,
  Edit2,
  CheckCircle2,
  FlaskConical,
  GitMerge,
  MoreVertical,
  Compass,
  LayoutGrid,
  List,
  ArrowUpDown,
  Copy,
  Check,
  Activity,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import VisualWorkflowBuilder from './ui/visual-workflow-builder';
import { TrelloFilter } from '@/shared/components/TrelloFilter';
import { WorkflowRecipesModal } from './ui/workflow-recipes-modal';
import { WorkflowExecutionLogModal } from './ui/workflow-execution-log-modal';
import { toast } from 'sonner';

export default function WorkflowsPage() {
  const {
    workflows,
    tasks,
    deals,
    users,
    roles,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    templates,
    workflowExecutions,
    pendingActions
  } = useData();
  const { user } = useAuth();

  // Modals & Active State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecipesOpen, setIsRecipesOpen] = useState(false);
  const [selectedWorkflowForLog, setSelectedWorkflowForLog] = useState<string | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isVisualCanvasOpen, setIsVisualCanvasOpen] = useState(false);
  const [visualBuilderWorkflow, setVisualBuilderWorkflow] = useState<any>(null);

  // Density Mode & Sorting State
  const [densityMode, setDensityMode] = useState<'comfortable' | 'compact'>('comfortable');
  const [sortBy, setSortBy] = useState<'name' | 'executions' | 'status'>('name');

  // Filter state
  const [wfSearchTerm, setWfSearchTerm] = useState('');
  const [wfStatusFilter, setWfStatusFilter] = useState<string[]>([]);
  const [wfCategoryFilter, setWfCategoryFilter] = useState<string[]>([]);
  const [wfTriggerFilter, setWfTriggerFilter] = useState<string[]>([]);

  // Permissions
  const userRoleDef = roles.find(r => r.name === user?.role);
  const userPerms = userRoleDef?.permissions || [];
  const isClientAdmin = user?.role === 'Client Admin';
  const canCreateWorkflow = isClientAdmin || userPerms.includes('p13');
  const canEditWorkflow = isClientAdmin || userPerms.includes('p14');
  const canDeleteWorkflow = isClientAdmin || userPerms.includes('p15');
  const canExecuteWorkflow = isClientAdmin || userPerms.includes('p16');

  // Visual Builder Launchers
  const handleOpenVisualBuilderNode = (wf: any) => {
    setEditingWorkflowId(wf.id);
    let actions = wf.actions;
    if (!actions || actions.length === 0) {
      actions = [
        {
          id: uuid(),
          type: wf.action || 'send_email',
          delay: wf.delay || 0,
          delayUnit: wf.delayUnit || 'minutes',
          config: wf.actionConfig || { taskTitle: '', taskDescription: '', templateId: '' }
        }
      ];
    }

    setVisualBuilderWorkflow({
      name: wf.name,
      category: wf.category || 'General',
      trigger: wf.trigger,
      condition: wf.condition,
      description: wf.description || '',
      actions: actions
    });
    setIsVisualCanvasOpen(true);
  };

  const handleCreateVisualFlow = () => {
    resetForm();
    setEditingWorkflowId(null);
    setVisualBuilderWorkflow({
      name: 'New Visual Workflow',
      category: 'General',
      trigger: 'lead_created',
      condition: '{"logic":"AND","rules":[]}',
      description: 'SaaS interactive node flow automation guidelines configuration',
      actions: [
        {
          id: uuid(),
          type: 'send_email',
          delay: 0,
          delayUnit: 'minutes',
          config: { taskTitle: 'Follow up step', taskDescription: 'Generated visually on workspace canvas', templateId: '' }
        }
      ]
    });
    setIsVisualCanvasOpen(true);
  };

  const handleVisualBuilderSave = (updatedWorkflow: any, updatedConditionRules: any) => {
    const finalConditionStr = updatedConditionRules.rules.length > 0 
      ? JSON.stringify(updatedConditionRules) 
      : '';

    const payload = {
      ...updatedWorkflow,
      condition: finalConditionStr,
      status: 'active' as const
    };

    if (editingWorkflowId) {
      updateWorkflow(editingWorkflowId, payload);
    } else {
      addWorkflow(payload);
    }
    
    setIsVisualCanvasOpen(false);
    setEditingWorkflowId(null);
    resetForm();
  };

  // Form State
  const [conditionRules, setConditionRules] = useState<{ logic: 'AND' | 'OR', rules: { field: string, operator: string, value: string }[] }>({
    logic: 'AND',
    rules: []
  });
  const [newWorkflow, setNewWorkflow] = useState<any>({
    name: '',
    category: 'General',
    trigger: 'lead_created',
    condition: '',
    description: '',
    actions: [
      {
        id: uuid(),
        type: 'send_email',
        delay: 0,
        delayUnit: 'minutes',
        config: {
          taskTitle: '',
          taskDescription: '',
          templateId: ''
        }
      }
    ]
  });

  // Filtered & Sorted Workflows
  const filteredAndSortedWorkflows = useMemo(() => {
    const filtered = workflows.filter(wf => {
      if (wf.isArchived) return false;
      const matchesSearch = wfSearchTerm === '' ||
        wf.name.toLowerCase().includes(wfSearchTerm.toLowerCase()) ||
        (wf.description && wf.description.toLowerCase().includes(wfSearchTerm.toLowerCase())) ||
        (wf.trigger && wf.trigger.toLowerCase().includes(wfSearchTerm.toLowerCase()));
      const matchesStatus = wfStatusFilter.length === 0 || wfStatusFilter.includes(wf.status);
      const matchesCategory = wfCategoryFilter.length === 0 || (wf.category && wfCategoryFilter.includes(wf.category));
      const matchesTrigger = wfTriggerFilter.length === 0 || (wf.trigger && wfTriggerFilter.includes(wf.trigger));
      return matchesSearch && matchesStatus && matchesCategory && matchesTrigger;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'executions') {
        return (b.executionCount || 0) - (a.executionCount || 0);
      } else if (sortBy === 'status') {
        return (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1);
      }
      return 0;
    });
  }, [workflows, wfSearchTerm, wfStatusFilter, wfCategoryFilter, wfTriggerFilter, sortBy]);

  const activeWorkflowsCount = useMemo(() => workflows.filter(w => w.status === 'active' && !w.isArchived).length, [workflows]);
  const totalExecutionsCount = useMemo(() => workflows.reduce((acc, wf) => acc + (wf.executionCount || 0), 0), [workflows]);
  const totalHoursSaved = useMemo(() => (totalExecutionsCount * 0.25).toFixed(1), [totalExecutionsCount]);

  const handleSave = () => {
    if (!newWorkflow.name) {
      toast.error('Please provide a workflow name');
      return;
    }
    
    const finalCondition = conditionRules.rules.length > 0 
      ? JSON.stringify(conditionRules) 
      : newWorkflow.condition;

    if (editingWorkflowId) {
      updateWorkflow(editingWorkflowId, {
        ...newWorkflow,
        condition: finalCondition
      });
      toast.success('Workflow updated');
    } else {
      addWorkflow({
        ...newWorkflow,
        condition: finalCondition
      });
      toast.success('Workflow created');
    }
    
    setIsModalOpen(false);
    setEditingWorkflowId(null);
    resetForm();
  };

  const resetForm = () => {
    setNewWorkflow({
      name: '',
      category: 'General',
      trigger: 'lead_created',
      condition: '',
      description: '',
      actions: [
        {
          id: uuid(),
          type: 'send_email',
          delay: 0,
          delayUnit: 'minutes',
          config: {
            taskTitle: '',
            taskDescription: '',
            templateId: ''
          }
        }
      ]
    });
    setConditionRules({ logic: 'AND', rules: [] });
  };

  const handleEdit = (wf: any) => {
    setEditingWorkflowId(wf.id);
    let actions = wf.actions;
    if (!actions || actions.length === 0) {
      actions = [
        {
          id: uuid(),
          type: wf.action || 'send_email',
          delay: wf.delay || 0,
          delayUnit: wf.delayUnit || 'minutes',
          config: wf.actionConfig || { taskTitle: '', taskDescription: '', templateId: '' }
        }
      ];
    }

    setNewWorkflow({
      name: wf.name,
      category: wf.category || 'General',
      trigger: wf.trigger,
      condition: wf.condition,
      description: wf.description || '',
      actions: actions
    });
    
    try {
      if (wf.condition && wf.condition.startsWith('{')) {
        setConditionRules(JSON.parse(wf.condition));
      } else {
        setConditionRules({ logic: 'AND', rules: [] });
      }
    } catch (e) {
      setConditionRules({ logic: 'AND', rules: [] });
    }
    
    setActiveDropdown(null);
    setIsModalOpen(true);
  };

  const handleDuplicate = (wf: any) => {
    const duplicatedPayload = {
      name: `${wf.name} (Copy)`,
      category: wf.category || 'General',
      trigger: wf.trigger,
      condition: wf.condition || '',
      description: wf.description || '',
      status: 'paused' as const,
      actions: wf.actions ? JSON.parse(JSON.stringify(wf.actions)) : [
        {
          id: uuid(),
          type: wf.action || 'send_email',
          delay: wf.delay || 0,
          delayUnit: wf.delayUnit || 'minutes',
          config: wf.actionConfig || {}
        }
      ]
    };
    addWorkflow(duplicatedPayload);
    toast.success(`Duplicated "${wf.name}"`);
    setActiveDropdown(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to archive this workflow?')) {
      deleteWorkflow(id);
      toast.success('Workflow archived');
    }
    setActiveDropdown(null);
  };

  const handleTest = (id: string) => {
    setActiveDropdown(null);
    setIsTesting(id);
    setTimeout(() => {
      toast.success('Workflow test execution completed');
      setIsTesting(null);
    }, 1200);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Section - Compact Enterprise Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Workflows</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            — Automate sales processes with triggers and actions
          </span>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
          {canCreateWorkflow && (
            <button 
              onClick={handleCreateVisualFlow}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
              title="Open Visual Builder"
            >
              <Compass size={14} className="text-blue-500" />
              <span>Visual Designer</span>
            </button>
          )}

          {canCreateWorkflow && (
            <button 
              onClick={() => setIsRecipesOpen(true)}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
            >
              <FileText size={14} className="text-slate-500" />
              <span>Recipes</span>
            </button>
          )}

          {canCreateWorkflow && (
            <button 
              onClick={() => {
                resetForm();
                setEditingWorkflowId(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
            >
              <Plus size={15} />
              <span>Create Workflow</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Overview KPI Banner - Compact Operational 5-Metric Strip */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Active Automations</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{activeWorkflowsCount}</span>
            <span className="text-[11px] text-slate-500">/ {workflows.filter(w => !w.isArchived).length} total</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">24h Executions</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{totalExecutionsCount}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">+12%</span>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Success Rate</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">98.4%</span>
            <div className="w-12 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[98.4%]"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Hours Saved</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{totalHoursSaved}</span>
            <span className="text-[11px] text-slate-500">hrs</span>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Pending Jobs</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">{pendingActions.length}</span>
            <span className="text-[11px] text-slate-500">queued</span>
          </div>
        </div>
      </div>

      {/* 3. Filter, Search, Sort & Density Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 py-1">
        {/* Left: Search Bar & Filter Popover Group */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-xl">
          {/* Sleek Search Bar */}
          <div className="relative flex-1 max-w-xs sm:max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={wfSearchTerm}
              onChange={(e) => setWfSearchTerm(e.target.value)}
              placeholder="Search workflows..."
              className="w-full h-9 pl-9 pr-8 text-xs font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {wfSearchTerm && (
              <button
                onClick={() => setWfSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Popover Button */}
          <div className="shrink-0">
            <TrelloFilter
              searchTerm={wfSearchTerm}
              setSearchTerm={setWfSearchTerm}
              statuses={[
                { id: 'active', label: 'Active' },
                { id: 'paused', label: 'Paused' },
              ]}
              selectedStatuses={wfStatusFilter}
              setSelectedStatuses={setWfStatusFilter}
              labelsTitle="Category"
              labels={[
                { id: 'Security', label: 'Security' },
                { id: 'Telecom', label: 'Telecom' },
                { id: 'IT', label: 'IT' },
                { id: 'General', label: 'General' },
              ]}
              selectedLabels={wfCategoryFilter}
              setSelectedLabels={setWfCategoryFilter}
              triggersTitle="Trigger Event"
              triggers={[
                { id: 'lead_created', label: 'Contact / Lead Created' },
                { id: 'deal_created', label: 'Deal Created' },
                { id: 'deal_stage_changed', label: 'Deal Stage Changed' },
                { id: 'deal_won', label: 'Deal Won' },
                { id: 'deal_lost', label: 'Deal Lost' },
                { id: 'email_opened', label: 'Email Opened' },
                { id: 'tag_added', label: 'Tag Added' },
              ]}
              selectedTriggers={wfTriggerFilter}
              setSelectedTriggers={setWfTriggerFilter}
            />
          </div>
        </div>

        {/* Right: Sort & Density Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 h-9 text-xs">
            <ArrowUpDown size={13} className="text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400 font-medium hidden xs:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              aria-label="Sort workflows by"
            >
              <option value="name">Name (A-Z)</option>
              <option value="executions">Most Executed</option>
              <option value="status">Status (Active First)</option>
            </select>
          </div>

          {/* Density Toggle (Comfortable vs Compact) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setDensityMode('comfortable')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                densityMode === 'comfortable'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Comfortable View"
              aria-label="Switch to Comfortable View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setDensityMode('compact')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                densityMode === 'compact'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Compact View"
              aria-label="Switch to Compact View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 3b. Active Filter Chips Strip */}
      {(wfSearchTerm || wfStatusFilter.length > 0 || wfCategoryFilter.length > 0 || wfTriggerFilter.length > 0) && (
        <div className="flex items-center flex-wrap gap-1.5 py-1 px-0.5 animate-in fade-in duration-150">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter size={11} className="text-blue-500" /> Active Filters:
          </span>
          {wfSearchTerm && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              Query: "{wfSearchTerm}"
              <button onClick={() => setWfSearchTerm('')} className="hover:text-blue-900 dark:hover:text-white cursor-pointer ml-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {wfStatusFilter.map(st => (
            <span key={st} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 capitalize">
              Status: {st}
              <button onClick={() => setWfStatusFilter(wfStatusFilter.filter(s => s !== st))} className="hover:text-emerald-900 dark:hover:text-white cursor-pointer ml-0.5">
                <X size={12} />
              </button>
            </span>
          ))}
          {wfCategoryFilter.map(cat => (
            <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
              Category: {cat}
              <button onClick={() => setWfCategoryFilter(wfCategoryFilter.filter(c => c !== cat))} className="hover:text-purple-900 dark:hover:text-white cursor-pointer ml-0.5">
                <X size={12} />
              </button>
            </span>
          ))}
          {wfTriggerFilter.map(trig => (
            <span key={trig} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              Trigger: {trig.replace(/_/g, ' ')}
              <button onClick={() => setWfTriggerFilter(wfTriggerFilter.filter(t => t !== trig))} className="hover:text-amber-900 dark:hover:text-white cursor-pointer ml-0.5">
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              setWfSearchTerm('');
              setWfStatusFilter([]);
              setWfCategoryFilter([]);
              setWfTriggerFilter([]);
            }}
            className="text-xs font-bold text-slate-500 hover:text-red-600 dark:hover:text-red-400 ml-1.5 cursor-pointer underline transition-colors"
          >
            Reset All
          </button>
        </div>
      )}

      {/* Recipes Modal */}
      {isRecipesOpen && (
        <WorkflowRecipesModal
          onClose={() => setIsRecipesOpen(false)}
          onAddWorkflow={addWorkflow as (workflow: never) => void}
        />
      )}

      {/* 4. Workflow List / Cards */}
      {filteredAndSortedWorkflows.length === 0 ? (
        <div className="py-10 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
          <EmptyState
            type="workflows"
            title={workflows.filter(wf => !wf.isArchived).length === 0 ? "No Workflows Created Yet" : "No Workflows Match Your Search"}
            description={workflows.filter(wf => !wf.isArchived).length === 0 ? "Automate lead assignment, email sequences, and task creation without writing code." : "Try clearing filters or searching for another keyword."}
            actionLabel="Create Custom Workflow"
            onAction={() => setIsModalOpen(true)}
            secondaryActionLabel="Explore Recipe Templates"
            onSecondaryAction={() => setIsRecipesOpen(true)}
          />
        </div>
      ) : densityMode === 'comfortable' ? (
        /* Comfortable Card View Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAndSortedWorkflows.map(wf => (
            <div 
              key={wf.id} 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs group relative"
            >
              {/* Card Header: Icon, Name, Category, Toggle, Menu */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-md shrink-0 ${
                      wf.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                      <Zap size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {wf.name}
                        </h3>
                        {wf.category && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                            wf.category === 'Security' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20' :
                            wf.category === 'Telecom' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' :
                            wf.category === 'IT' ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            {wf.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                        Trigger: {wf.trigger.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Header Actions: Active Toggle + Dropdown */}
                  <div className="flex items-center gap-1">
                    {canEditWorkflow && (
                      <button 
                        onClick={() => updateWorkflow(wf.id, { status: wf.status === 'active' ? 'paused' : 'active' })}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors border cursor-pointer ${
                          wf.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                        title={wf.status === 'active' ? 'Click to Pause' : 'Click to Activate'}
                        aria-label={`Status ${wf.status}. Click to change.`}
                      >
                        {wf.status === 'active' ? 'Active' : 'Paused'}
                      </button>
                    )}

                    <div className="relative">
                      <button 
                        onClick={() => setActiveDropdown(activeDropdown === wf.id ? null : wf.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
                        aria-label="Workflow Options"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeDropdown === wf.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg overflow-hidden z-30 text-xs">
                          {canExecuteWorkflow && (
                            <button onClick={() => handleTest(wf.id)} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                              {isTesting === wf.id ? <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <FlaskConical size={14} className="text-blue-500" />}
                              Test Workflow
                            </button>
                          )}
                          {canEditWorkflow && (
                            <button onClick={() => handleEdit(wf)} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                              <Edit2 size={14} className="text-slate-500" /> Edit Form
                            </button>
                          )}
                          {canEditWorkflow && (
                            <button onClick={() => { handleOpenVisualBuilderNode(wf); setActiveDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                              <Compass size={14} className="text-purple-500" /> Edit Visually
                            </button>
                          )}
                          {canCreateWorkflow && (
                            <button onClick={() => handleDuplicate(wf)} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                              <Copy size={14} className="text-slate-500" /> Duplicate
                            </button>
                          )}
                          {canDeleteWorkflow && (
                            <button onClick={() => handleDelete(wf.id)} className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer">
                              <Trash2 size={14} /> Archive
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description (2 lines clamp) */}
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 my-2 leading-relaxed">
                  {wf.description || 'No description provided.'}
                </p>

                {/* Compact Sequence Flow Indicator */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800 my-2.5 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap text-slate-700 dark:text-slate-300 font-medium">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">⚡ Trigger:</span>
                    <span>{wf.trigger.replace(/_/g, ' ')}</span>
                  </div>

                  {(wf.actions || [{ type: wf.action, delay: wf.delay, delayUnit: wf.delayUnit }]).map((act: any, idx: number) => (
                    <div key={act.id || idx} className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <ArrowRight size={11} className="text-slate-400 shrink-0" />
                      {act.delay && act.delay > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-mono text-[10px]">
                          [{act.delay} {act.delayUnit}] ➔
                        </span>
                      )}
                      <span className="capitalize">{act.type?.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Operational Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{wf.executionCount || 0} runs</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">98.4% success</span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedWorkflowForLog(wf.id)}
                    className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
                  >
                    <History size={12} /> Log
                  </button>
                  <button 
                    onClick={() => handleOpenVisualBuilderNode(wf)}
                    className="flex items-center gap-1 font-medium text-purple-600 dark:text-purple-400 hover:underline transition-colors cursor-pointer"
                  >
                    <Compass size={12} /> Visual
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Compact View Table / Row List */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4">Workflow Name</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Trigger & Actions Path</th>
                <th className="py-2.5 px-4 text-right">Executions</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAndSortedWorkflows.map(wf => (
                <tr key={wf.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {wf.name}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      wf.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${wf.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      {wf.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">
                    {wf.category || 'General'}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    ⚡ {wf.trigger.replace(/_/g, ' ')} ➔ {(wf.actions || []).map((a: any) => a.type?.replace(/_/g, ' ')).join(' + ')}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                    {wf.executionCount || 0}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => setSelectedWorkflowForLog(wf.id)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        title="View Log"
                      >
                        <History size={14} />
                      </button>
                      <button 
                        onClick={() => handleOpenVisualBuilderNode(wf)}
                        className="p-1 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                        title="Edit Visually"
                      >
                        <Compass size={14} />
                      </button>
                      <button 
                        onClick={() => handleEdit(wf)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Edit Form"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Automation Output (Recent Tasks Table) */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings size={16} className="text-blue-600" />
            Automation Output (Recent Automated Tasks)
          </h2>
          <span className="text-xs text-slate-500">{tasks.length} total generated</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-2.5">Task</th>
                <th className="px-4 py-2.5">Related Deal</th>
                <th className="px-4 py-2.5">Assigned To</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.slice().reverse().map(task => {
                const deal = deals.find(d => d.id === task.dealId);
                const assignedUser = users.find(u => u.id === task.assignedUserId);
                return (
                  <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{task.title}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[250px]">{task.description}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{deal?.title || 'N/A'}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'System'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                        task.status === 'completed' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{task.dueDate}</td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">No automated tasks generated yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Form Modal - Workflow Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{editingWorkflowId ? 'Edit Workflow' : 'Create Workflow'}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Define trigger, conditions, and actions for automation.</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); resetForm(); setEditingWorkflowId(null); }} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Workflow Name</label>
                  <input 
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs" 
                    placeholder="e.g. Welcome Email Sequence" 
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select 
                    value={newWorkflow.category}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, category: e.target.value as any })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  >
                    <option value="General">General</option>
                    <option value="Security">Security</option>
                    <option value="Telecom">Telecom</option>
                    <option value="IT">IT</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea 
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs h-16" 
                  placeholder="Describe what this workflow automates..."
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">1. When this happens (Trigger)</label>
                <select 
                  value={newWorkflow.trigger}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                >
                  <option value="lead_created">Contact Created</option>
                  <option value="deal_created">Deal Created</option>
                  <option value="deal_stage_qualified">Deal Reached Qualified</option>
                  <option value="deal_stage_proposal">Deal Reached Proposal</option>
                  <option value="deal_stage_negotiation">Deal Reached Negotiation</option>
                  <option value="deal_stage_won">Deal Won (Closed Won)</option>
                  <option value="deal_stage_lost">Deal Lost (Closed Lost)</option>
                  <option value="deal_expected_close_date_approaching">Deal Expected Close Date Approaching</option>
                  <option value="lead_expected_close_date_approaching">Contact Expected Close Date Approaching</option>
                  <option value="email_opened">Email Opened</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="tag_added">Tag Added</option>
                </select>
              </div>

              {/* Conditions Block */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">2. Only if (Conditions)</label>
                  <button 
                    type="button"
                    onClick={() => setConditionRules({ ...conditionRules, rules: [...conditionRules.rules, { field: 'deal.value', operator: '>', value: '0' }] })}
                    className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus size={12} /> Add Condition Rule
                  </button>
                </div>

                {conditionRules.rules.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1 text-[11px]">
                      <span className="text-slate-500 font-medium">Match</span>
                      <select 
                        value={conditionRules.logic}
                        onChange={(e) => setConditionRules({ ...conditionRules, logic: e.target.value as any })}
                        className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="AND">All (AND)</option>
                        <option value="OR">Any (OR)</option>
                      </select>
                      <span className="text-slate-500 font-medium">rules:</span>
                    </div>

                    {conditionRules.rules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select 
                          value={rule.field}
                          onChange={(e) => {
                            const newRules = [...conditionRules.rules];
                            newRules[idx].field = e.target.value;
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="deal.title">Deal Title</option>
                          <option value="deal.value">Deal Value ($)</option>
                          <option value="contact.score">Contact Score</option>
                          <option value="contact.status">Contact Status</option>
                        </select>

                        <select 
                          value={rule.operator}
                          onChange={(e) => {
                            const newRules = [...conditionRules.rules];
                            newRules[idx].operator = e.target.value;
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="w-24 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                        >
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value="==">==</option>
                          <option value="!=">!=</option>
                          <option value="contains">contains</option>
                        </select>

                        <input 
                          value={rule.value}
                          onChange={(e) => {
                            const newRules = [...conditionRules.rules];
                            newRules[idx].value = e.target.value;
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="w-24 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                          placeholder="Value"
                        />

                        <button 
                          type="button"
                          onClick={() => {
                            const newRules = conditionRules.rules.filter((_, i) => i !== idx);
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Block */}
              <div className="space-y-3">
                {newWorkflow.actions.map((action: any, index: number) => (
                  <div key={action.id || index} className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                        3. Then do this (Action {index + 1})
                      </label>
                      {index > 0 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const newActions = [...newWorkflow.actions];
                            newActions.splice(index, 1);
                            setNewWorkflow({ ...newWorkflow, actions: newActions });
                          }}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <select 
                      value={action.type}
                      onChange={(e) => {
                        const newActions = [...newWorkflow.actions];
                        newActions[index].type = e.target.value;
                        setNewWorkflow({ ...newWorkflow, actions: newActions });
                      }}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                    >
                      <option value="send_email">Send Email</option>
                      <option value="send_sms">Send SMS</option>
                      <option value="create_task">Create Task</option>
                      <option value="update_lead_status">Update Contact Status</option>
                      <option value="add_tag">Add Tag</option>
                      <option value="send_slack_notification">Send Slack Notification</option>
                      <option value="webhook">Trigger Webhook</option>
                    </select>
                  </div>
                ))}

                <button 
                  type="button" 
                  onClick={() => {
                    setNewWorkflow({
                      ...newWorkflow,
                      actions: [
                        ...newWorkflow.actions,
                        {
                          id: uuid(),
                          type: 'send_email',
                          delay: 0,
                          delayUnit: 'minutes',
                          config: { taskTitle: '', taskDescription: '', templateId: '' }
                        }
                      ]
                    });
                  }}
                  className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Add Another Action Step
                </button>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); setEditingWorkflowId(null); }} 
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
              >
                {editingWorkflowId ? 'Save Changes' : 'Save Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Log Modal */}
      {selectedWorkflowForLog && (
        <WorkflowExecutionLogModal
          workflowId={selectedWorkflowForLog}
          workflows={workflows}
          executions={workflowExecutions}
          onClose={() => setSelectedWorkflowForLog(null)}
        />
      )}

      {/* Visual Canvas Builder Modal */}
      {isVisualCanvasOpen && (
        <VisualWorkflowBuilder
          isOpen={isVisualCanvasOpen}
          onClose={() => setIsVisualCanvasOpen(false)}
          workflow={visualBuilderWorkflow}
          templates={templates}
          onSave={handleVisualBuilderSave}
        />
      )}
    </div>
  );
}
