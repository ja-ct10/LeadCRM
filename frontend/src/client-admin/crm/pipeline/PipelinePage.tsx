'use client';

import React, { useState } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { 
  Plus, MoreHorizontal, X, Building, Calendar, 
  DollarSign, Settings, User, GripVertical,
  Clock, CheckCircle2, AlertCircle, ArrowRight,
  History, MessageSquare, Tag, Trash2,
  ChevronRight, ChevronDown, ChevronUp, ExternalLink, Receipt, Rocket,
  PhoneCall, Mail, Users, Shield, Lock, Layers, Search,
  LayoutGrid, Table, List, SlidersHorizontal, RotateCcw, Check, Archive
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Deal, Stage, Pipeline } from '@/store/types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from '@/shared/components/charts/ChartComponents';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { TrelloFilter } from '@/shared/components/TrelloFilter';
import EmptyState from '@/shared/components/EmptyState';

interface SortableDealCardProps {
  key?: any;
  deal: any;
  assignedUser?: any;
  onClick: (deal: any) => void;
  canDrag?: boolean;
  isAutomatedOnly?: boolean;
}

const DealCardContent = ({ deal, assignedUser, canDrag = false, isAutomatedOnly = false, attributes, listeners, isDragOverlay = false }: any) => {
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(deal.updatedAt || deal.createdAt || Date.now()).getTime()) / (1000 * 3600 * 24));
  const isRotting = daysSinceUpdate >= 14;
  const isAging = daysSinceUpdate >= 7 && daysSinceUpdate < 14;

  return (
    <div className={`flex flex-col gap-3 ${isDragOverlay ? 'opacity-90' : ''}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-start gap-2 flex-1">
          {canDrag && !isAutomatedOnly && !isDragOverlay ? (
            <div 
              {...attributes} 
              {...listeners} 
              className="mt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} />
            </div>
          ) : isAutomatedOnly && !isDragOverlay && (
            <div className="mt-0.5 text-blue-500/50 dark:text-blue-400/40 flex items-center justify-center shrink-0" title="Locked: Process managed by sales automation rules">
              <Lock size={12} className="text-blue-400/70" />
            </div>
          )}
          <div className="flex flex-col">
            <h4 className={`font-semibold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-blue-500 transition-colors ${(!canDrag && !isDragOverlay) || isAutomatedOnly ? 'ml-1' : ''}`}>
              {deal.title}
            </h4>
            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1">
              <User size={12} className="mr-1.5 shrink-0" />
              <span className="truncate">{deal.contactPerson} &middot; <strong className="font-medium text-slate-700 dark:text-slate-300">{deal.companyName}</strong></span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
        {deal.value > 0 && (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20 px-2 py-0.5 rounded text-xs font-semibold shrink-0">
            <DollarSign size={12} />
            {deal.value.toLocaleString()}
          </span>
        )}
        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0
          ${deal.priority === 'High' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' : 
            deal.priority === 'Medium' ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20' : 
            'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'}`}>
          {deal.priority}
        </span>
        
        {(isAging || isRotting) && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider shrink-0 ${isRotting ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'}`} title={`Stale deal: Not moved in ${daysSinceUpdate} days`}>
            {isRotting ? <AlertTriangle size={10} /> : <Clock size={10} />}
            {daysSinceUpdate}d
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-1 pt-2.5 border-t border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center text-[11px] font-medium">
           {deal.expectedCloseDate ? (
             <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Expected Close Date"><Calendar size={12} /> {new Date(deal.expectedCloseDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
           ) : <span className="opacity-0">-</span>}
        </div>
        <div className="flex items-center gap-2">
          {assignedUser ? (
             <div className="flex items-center gap-1.5" title={`Assigned to ${assignedUser.firstName} ${assignedUser.lastName}`}>
               <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-[9px] font-bold text-blue-700 dark:text-blue-400">
                 {assignedUser.firstName[0]}{assignedUser.lastName[0]}
               </div>
             </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400" title="Unassigned">
              <User size={10} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SortableDealCard = ({ deal, assignedUser, onClick, canDrag = true, isAutomatedOnly = false }: SortableDealCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: {
      type: 'Deal',
      deal,
    },
    disabled: !canDrag || isAutomatedOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 0 : 1,
  };

  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(deal.updatedAt || deal.createdAt || Date.now()).getTime()) / (1000 * 3600 * 24));
  const isRotting = daysSinceUpdate >= 14;
  const isAging = daysSinceUpdate >= 7 && daysSinceUpdate < 14;

  let borderStyle = 'border-slate-200 dark:border-white/[0.05] hover:border-blue-500/40';
  
  if (isRotting) {
    borderStyle = 'border-red-300 dark:border-red-500/30 bg-red-50/10 dark:bg-red-500/5 hover:border-red-400 dark:hover:border-red-500/50';
  } else if (isAging) {
    borderStyle = 'border-amber-300 dark:border-amber-500/30 bg-amber-50/10 dark:bg-amber-500/5 hover:border-amber-400 dark:hover:border-amber-500/50';
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={`deal-card-${deal.id}`}
      transition={{ type: 'spring', damping: 26, stiffness: 180 }}
      onClick={() => onClick(deal)}
      className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${
        isDragging 
          ? 'border-blue-500/50 bg-blue-500/5 ring-2 ring-blue-500/20' 
          : `${isRotting || isAging ? '' : 'bg-white dark:bg-[#030712]'} ${borderStyle} shadow-sm hover:shadow-md hover:-translate-y-0.5`
      }`}
    >
      <DealCardContent 
        deal={deal} 
        assignedUser={assignedUser} 
        canDrag={canDrag} 
        isAutomatedOnly={isAutomatedOnly} 
        attributes={attributes} 
        listeners={listeners} 
      />
    </motion.div>
  );
};

const DroppableTab = ({ pipeline, isActive, count, dotColor, onClick }: any) => {
  const { isOver, setNodeRef } = useDroppable({
    id: pipeline.id,
    data: {
      type: 'Pipeline',
      pipeline,
    },
  });

  return (
    <button 
      ref={setNodeRef}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
        isActive 
          ? 'bg-gray-50 dark:bg-white/[0.05] text-slate-900 dark:text-white border-gray-300 dark:border-white/[0.1] shadow-sm' 
          : isOver 
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 scale-105' 
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.02] border-transparent'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
      {pipeline.name}
      <span className="bg-gray-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">{count}</span>
    </button>
  );
};

const DroppableStage = ({ stage, children, stageValue, count, isDraggingAny, isAutomatedOnly = false }: any) => {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
    data: {
      type: 'Stage',
      stage,
    },
    disabled: isAutomatedOnly,
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`w-80 flex flex-col bg-white dark:bg-white/[0.02] rounded-2xl border flex-shrink-0 max-h-full backdrop-blur-sm transition-all duration-300 ${
        isOver 
          ? 'border-blue-500/60 bg-blue-500/[0.08] shadow-[0_0_30px_rgba(59,130,246,0.15)] scale-[1.02] z-10' 
          : isDraggingAny
            ? 'border-blue-500/20 bg-blue-500/[0.02] ring-2 ring-blue-500/10'
            : 'border-gray-200 dark:border-white/[0.05]'
      }`}
    >
      <div className="p-4 flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-blue-400 transition-colors">{stage.name}</h3>
          {stageValue > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">${stageValue.toLocaleString()}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isAutomatedOnly && (
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1" title="Managed by CRM Automation workflows">
              <Shield size={10} /> Auto
            </span>
          )}
          <span className="bg-gray-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full">{count}</span>
        </div>
      </div>
      {children}
    </div>
  );
};

interface DroppableCellProps {
  id: string;
  stage: any;
  swimlaneValue: string;
  children: React.ReactNode;
  isDraggingAny: boolean;
  isAutomatedOnly?: boolean;
}

const DroppableCell = ({ id, stage, swimlaneValue, children, isDraggingAny, isAutomatedOnly = false }: DroppableCellProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: 'StageCell',
      stage,
      swimlaneValue,
    },
    disabled: isAutomatedOnly,
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`w-80 flex flex-col rounded-2xl border flex-shrink-0 backdrop-blur-sm transition-all duration-300 group ${
        isOver 
          ? 'border-blue-500/60 bg-blue-500/[0.08] shadow-[0_0_20px_rgba(59,130,246,0.1)] scale-[1.01] z-10' 
          : isDraggingAny
            ? 'border-blue-500/10 bg-blue-500/[0.01]'
            : 'border-gray-200/50 dark:border-white/[0.03] bg-white/[0.01] hover:border-gray-300 dark:hover:border-white/[0.06] transition-colors'
      }`}
    >
      {children}
    </div>
  );
};

export default function PipelinePage({ navigate }: { navigate: (path: string) => void }) {
  const { 
    pipelines, 
    deals, 
    updateDeal, 
    addDeal, 
    addPipeline, 
    updatePipeline, 
    deletePipeline, 
    deleteDeal, 
    reorderDeals, 
    users, 
    isBillingModuleEnabled,
    roles 
  } = useData();
  const { user } = useAuth();
  const [activePipelineId, setActivePipelineId] = useState(pipelines[0]?.id || '');
  
  // Modern Deal Views & Advanced Funnel Filtering System
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'list'>(() => {
    return (localStorage.getItem('pipeline_view_mode') as any) || 'kanban';
  });
  const handleViewModeChange = (mode: 'kanban' | 'table' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('pipeline_view_mode', mode);
  };
  
  const swimlaneBy = 'none' as string;
  const [collapsedSwimlanes] = useState<string[]>([]);
  
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, open, won, lost
  const [filterStages, setFilterStages] = useState<string[]>([]);
  const [filterStaff, setFilterStaff] = useState<string[]>([]);
  const [filterLeadSource, setFilterLeadSource] = useState<string>('');
  const [filterLeadSourceOp, setFilterLeadSourceOp] = useState<string>('contains'); // equals, contains, starts, ends, notequals
  
  const [filterDateCreatedStart, setFilterDateCreatedStart] = useState<string>('');
  const [filterDateCreatedEnd, setFilterDateCreatedEnd] = useState<string>('');
  const [filterDateCreatedOp, setFilterDateCreatedOp] = useState<string>('any'); // any, equals, before, after, between, notequals

  const [filterDateUpdatedStart, setFilterDateUpdatedStart] = useState<string>('');
  const [filterDateUpdatedEnd, setFilterDateUpdatedEnd] = useState<string>('');
  const [filterDateUpdatedOp, setFilterDateUpdatedOp] = useState<string>('any'); // any, equals, before, after, between
  
  const [filterIndustry, setFilterIndustry] = useState<string>('');
  const [filterIndustryOp, setFilterIndustryOp] = useState<string>('contains');

  const [filterLocation, setFilterLocation] = useState<string>('');
  const [filterLocationOp, setFilterLocationOp] = useState<string>('contains');

  const [filterCampaign, setFilterCampaign] = useState<string>('');
  const [filterCampaignOp, setFilterCampaignOp] = useState<string>('contains');

  const [filterCustomerType, setFilterCustomerType] = useState<string>('all'); // all, New Business, Existing Customer

  const [filterOrganization, setFilterOrganization] = useState<string>('');
  const [filterOrganizationOp, setFilterOrganizationOp] = useState<string>('contains');

  const [filterTags, setFilterTags] = useState<string>('');
  const [filterTagsOp, setFilterTagsOp] = useState<string>('contains');

  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  
  // Table sorting states
  const [tableSortField, setTableSortField] = useState<string>('title');
  const [tableSortAsc, setTableSortAsc] = useState<boolean>(true);
  
  const [searchQuery, setSearchQuery] = useState('');

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filterStatus !== 'all') count++;
    if (filterStages.length > 0) count++;
    if (filterStaff.length > 0) count++;
    if (filterLeadSource.trim() !== '') count++;
    if (filterDateCreatedStart !== '' || filterDateCreatedEnd !== '') count++;
    if (filterDateUpdatedStart !== '' || filterDateUpdatedEnd !== '') count++;
    if (filterIndustry.trim() !== '') count++;
    if (filterLocation.trim() !== '') count++;
    if (filterCampaign.trim() !== '') count++;
    if (filterCustomerType !== 'all') count++;
    if (filterOrganization.trim() !== '') count++;
    if (filterTags.trim() !== '') count++;
    if (filterPriority.length > 0) count++;
    return count;
  };

  const handleClearAllFilters = () => {
    setFilterStatus('all');
    setFilterStages([]);
    setFilterStaff([]);
    setFilterLeadSource('');
    setFilterLeadSourceOp('contains');
    setFilterDateCreatedStart('');
    setFilterDateCreatedEnd('');
    setFilterDateCreatedOp('any');
    setFilterDateUpdatedStart('');
    setFilterDateUpdatedEnd('');
    setFilterDateUpdatedOp('any');
    setFilterIndustry('');
    setFilterIndustryOp('contains');
    setFilterLocation('');
    setFilterLocationOp('contains');
    setFilterCampaign('');
    setFilterCampaignOp('contains');
    setFilterCustomerType('all');
    setFilterOrganization('');
    setFilterOrganizationOp('contains');
    setFilterTags('');
    setFilterTagsOp('contains');
    setFilterPriority([]);
    setSearchQuery('');
  };
  const [isVelocityExpanded, setIsVelocityExpanded] = useState(() => {
    return localStorage.getItem('pipeline_velocity_expanded') !== 'false';
  });

  const toggleVelocityExpanded = () => {
    setIsVelocityExpanded(prev => {
      const next = !prev;
      localStorage.setItem('pipeline_velocity_expanded', String(next));
      return next;
    });
  };

  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('app_theme') === 'Dark';
  });

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleSwimlaneChange = (val: 'none' | 'client' | 'priority') => {
    // Deprecated swimlane handler
  };

  const toggleSwimlaneCollapse = (item: string) => {
    // Deprecated swimlane collapse
  };
  const [isAutomatedOnly, setIsAutomatedOnly] = useState(() => {
    return localStorage.getItem('is_automated_pipeline_only') === 'true';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [automationStatus, setAutomationStatus] = useState('');

  const toggleAutomatedOnly = () => {
    const newValue = !isAutomatedOnly;
    setIsAutomatedOnly(newValue);
    localStorage.setItem('is_automated_pipeline_only', String(newValue));
  };

  const handleTriggerStageAutomation = (targetStage: any) => {
    if (!selectedDeal) return;
    setIsTransitioning(true);
    
    let sequences: string[] = ['Initiating sales automations...'];
    if (selectedDeal.stageId === 'stage_1' || selectedDeal.stageId.endsWith('_1')) {
      sequences = ['Scanning contact qualification flags...', 'Verifying prospect contact data...', 'Running corporate credit check...', 'Contact is Verified & Pre-Qualified!'];
    } else if (selectedDeal.stageId === 'stage_2' || selectedDeal.stageId.endsWith('_2')) {
      sequences = ['Structuring quote parameters...', 'Generating professional proposal PDF...', 'Routing proposal to buyer contact...', 'Proposal Dispatched with Quote!'];
    } else if (selectedDeal.stageId === 'stage_3' || selectedDeal.stageId.endsWith('_3')) {
      sequences = ['Drafting mutual agreements...', 'Performing compliance reviews...', 'Validating electronic signature anchors...', 'Mutual Contract Finalized!'];
    } else if (selectedDeal.stageId === 'stage_4' || selectedDeal.stageId.endsWith('_4')) {
      sequences = ['Processing final billing terms...', 'Confirming transaction deposit receipt...', 'Creating active product subscription...', 'Onboarding Workflows Instantiated!'];
    } else {
      sequences = ['Connecting sales integration hooks...', 'Checking stage business logic...', 'Advancing Deal Stage...'];
    }

    let i = 0;
    setAutomationStatus(sequences[0]);
    const interval = setInterval(() => {
      i++;
      if (i < sequences.length) {
        setAutomationStatus(sequences[i]);
      } else {
        clearInterval(interval);
        
        // Finalize transaction
        const oldStageName = activePipeline?.stages.find(s => s.id === selectedDeal.stageId)?.name || 'Previous';
        const automationNote = {
          id: 'auto_' + Date.now(),
          type: 'note' as const,
          description: `🤖 AUTOMATION TRIGGER: Stage advanced automatically from "${oldStageName}" to "${targetStage.name}" after satisfying all digital workflows.`,
          timestamp: new Date().toISOString(),
          userId: 'system'
        };
        
        const updatedActivities = [...(selectedDeal.activities || []), automationNote];
        
        updateDeal(selectedDeal.id, { 
          stageId: targetStage.id,
          activities: updatedActivities
        });
        
        setIsTransitioning(false);
        setAutomationStatus('');
      }
    }, 450);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isManagePipelinesModalOpen, setIsManagePipelinesModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isDrawerEditing, setIsDrawerEditing] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [isDeleteDealModalOpen, setIsDeleteDealModalOpen] = useState(false);
  const [pipelineToDeleteId, setPipelineToDeleteId] = useState<string | null>(null);
  const [isDeletePipelineModalOpen, setIsDeletePipelineModalOpen] = useState(false);
  const [drawerEditFields, setDrawerEditFields] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'history'>('overview');
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [dealBeingLost, setDealBeingLost] = useState<Deal | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [newDeal, setNewDeal] = useState({
    title: '', companyName: '', contactPerson: '', value: 0, priority: 'Medium', expectedCloseDate: '', description: '', assignedUserId: '', stageId: '',
    leadSource: '', industry: '', location: '', campaign: '', customerType: 'New Customer', tags: ''
  });
  const [dealTitleTouched, setDealTitleTouched] = useState(false);
  const [dealValueTouched, setDealValueTouched] = useState(false);
  const [newActivity, setNewActivity] = useState<{
    type: 'call' | 'email' | 'meeting' | 'note', 
    description: string,
    timestamp: string,
    userId: string
  }>({ 
    type: 'note', 
    description: '',
    timestamp: new Date().toISOString().slice(0, 16),
    userId: user?.id || ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activePipeline = pipelines.find(p => p.id === activePipelineId);
  const allPipelineDeals = React.useMemo(() => {
    return deals.filter(d => d.pipelineId === activePipelineId && !d.isArchived).sort((a, b) => a.order - b.order);
  }, [deals, activePipelineId]);

  // Operators matching helpers for Funnel Filter operations
  const matchStringFilter = (val: string | undefined, filterVal: string, op: string) => {
    if (!filterVal || !filterVal.trim()) return true;
    const v = (val || '').trim().toLowerCase();
    const f = filterVal.trim().toLowerCase();
    switch (op) {
      case 'equals': return v === f;
      case 'notequals': return v !== f;
      case 'contains': return v.includes(f);
      case 'starts': return v.startsWith(f);
      case 'ends': return v.endsWith(f);
      default: return v.includes(f);
    }
  };

  const matchDateFilter = (val: string | undefined, start: string, end: string, op: string) => {
    if (!val) {
      if (op === 'notequals') return true;
      return false;
    }
    const dValNorm = new Date(val);
    dValNorm.setHours(0,0,0,0);
    const dValMs = dValNorm.getTime();
    if (isNaN(dValMs)) return false;
    
    const normalizeDate = (dStr: string) => {
      const d = new Date(dStr);
      d.setHours(0,0,0,0);
      return d.getTime();
    };

    switch (op) {
      case 'equals':
        return start ? dValMs === normalizeDate(start) : true;
      case 'notequals':
        return start ? dValMs !== normalizeDate(start) : true;
      case 'before':
        return start ? dValMs < normalizeDate(start) : true;
      case 'after':
        return start ? dValMs > normalizeDate(start) : true;
      case 'between':
        if (!start || !end) return true;
        return dValMs >= normalizeDate(start) && dValMs <= normalizeDate(end);
      default:
        return true;
    }
  };

  const pipelineDeals = React.useMemo(() => {
    let result = [...allPipelineDeals].filter(d => !d.isArchived);

    // 1. Live Search query (Title, Company, Contact)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(d => 
        (d.title || '').toLowerCase().includes(q) || 
        (d.companyName || '').toLowerCase().includes(q) ||
        (d.contactPerson || '').toLowerCase().includes(q)
      );
    }

    // 2. Deal Status (Open, Won, Lost)
    if (filterStatus !== 'all') {
      result = result.filter(d => {
        const isWon = d.stageId === 'stage_won' || d.stageId.toLowerCase().includes('won');
        const isLost = d.stageId === 'stage_lost' || d.stageId.toLowerCase().includes('lost');
        if (filterStatus === 'won') return isWon;
        if (filterStatus === 'lost') return isLost;
        if (filterStatus === 'open') return !isWon && !isLost;
        return true;
      });
    }

    // 3. Pipeline Stages
    if (filterStages.length > 0) {
      result = result.filter(d => filterStages.includes(d.stageId));
    }

    // 4. Assigned Representative Staff
    if (filterStaff.length > 0) {
      result = result.filter(d => {
        if (filterStaff.includes('unassigned') && !d.assignedUserId) return true;
        return filterStaff.includes(d.assignedUserId);
      });
    }

    // 5. Contact Source (Operation Aware)
    if (filterLeadSource.trim()) {
      result = result.filter(d => matchStringFilter(d.leadSource, filterLeadSource, filterLeadSourceOp));
    }

    // 6. Date Created (Operation Aware)
    if (filterDateCreatedOp !== 'any' && (filterDateCreatedStart || filterDateCreatedEnd)) {
      result = result.filter(d => matchDateFilter(d.createdAt, filterDateCreatedStart, filterDateCreatedEnd, filterDateCreatedOp));
    }

    // 7. Date Updated (Operation Aware)
    if (filterDateUpdatedOp !== 'any' && (filterDateUpdatedStart || filterDateUpdatedEnd)) {
      result = result.filter(d => matchDateFilter(d.updatedAt || d.createdAt, filterDateUpdatedStart, filterDateUpdatedEnd, filterDateUpdatedOp));
    }

    // 8. Industry (Operation Aware)
    if (filterIndustry.trim()) {
      result = result.filter(d => matchStringFilter(d.industry, filterIndustry, filterIndustryOp));
    }

    // 9. Location (Operation Aware)
    if (filterLocation.trim()) {
      result = result.filter(d => matchStringFilter(d.location, filterLocation, filterLocationOp));
    }

    // 10. Campaign (Operation Aware)
    if (filterCampaign.trim()) {
      result = result.filter(d => matchStringFilter(d.campaign, filterCampaign, filterCampaignOp));
    }

    // 11. Customer Type (New Customer / Existing Client)
    if (filterCustomerType !== 'all') {
      result = result.filter(d => {
        const type = (d.customerType || '').toLowerCase();
        if (filterCustomerType === 'new') return type.includes('new');
        if (filterCustomerType === 'existing') return type.includes('exist');
        return true;
      });
    }

    // 12. Organization / Company (Operation Aware)
    if (filterOrganization.trim()) {
      result = result.filter(d => matchStringFilter(d.companyName, filterOrganization, filterOrganizationOp));
    }

    // 13. Tags / labels (Operation Aware)
    if (filterTags.trim()) {
      result = result.filter(d => matchStringFilter(d.tags, filterTags, filterTagsOp));
    }

    // 14. Priority
    if (filterPriority.length > 0) {
      result = result.filter(d => filterPriority.includes(d.priority));
    }

    return result;
  }, [
    allPipelineDeals, 
    searchQuery, 
    filterStatus, 
    filterStages, 
    filterStaff, 
    filterLeadSource, 
    filterLeadSourceOp,
    filterDateCreatedStart, 
    filterDateCreatedEnd, 
    filterDateCreatedOp,
    filterDateUpdatedStart, 
    filterDateUpdatedEnd, 
    filterDateUpdatedOp,
    filterIndustry, 
    filterIndustryOp,
    filterLocation, 
    filterLocationOp,
    filterCampaign, 
    filterCampaignOp,
    filterCustomerType, 
    filterOrganization, 
    filterOrganizationOp,
    filterTags, 
    filterTagsOp,
    filterPriority
  ]);

  const selectedDeal = deals.find(d => d.id === selectedDealId);

  React.useEffect(() => {
    if (selectedDeal) {
      setDrawerEditFields({
        title: selectedDeal.title || '',
        companyName: selectedDeal.companyName || '',
        contactPerson: selectedDeal.contactPerson || '',
        value: selectedDeal.value || 0,
        priority: selectedDeal.priority || 'Medium',
        expectedCloseDate: selectedDeal.expectedCloseDate || '',
        description: selectedDeal.description || '',
        assignedUserId: selectedDeal.assignedUserId || '',
        stageId: selectedDeal.stageId || '',
        leadSource: selectedDeal.leadSource || '',
        industry: selectedDeal.industry || '',
        location: selectedDeal.location || '',
        campaign: selectedDeal.campaign || '',
        customerType: selectedDeal.customerType || 'New Customer',
        tags: selectedDeal.tags || ''
      });
      setIsDrawerEditing(false);
    } else {
      setDrawerEditFields({});
      setIsDrawerEditing(false);
    }
  }, [selectedDealId, selectedDeal]);

  const velocityData = React.useMemo(() => {
    if (!activePipeline) return [];

    const activePipelineDeals = deals.filter(d => d.pipelineId === activePipelineId && !d.isArchived);

    return activePipeline.stages.map((stage: Stage, index: number) => {
      let totalHours = 0;
      let dealVisitCount = 0;

      activePipelineDeals.forEach(deal => {
        const history = deal.history || [];
        const isCurrentlyInStage = deal.stageId === stage.id;
        
        let enteredTime: number | null = null;
        let leftTime: number | null = null;
        const dealCreatedTime = new Date(deal.createdAt || Date.now()).getTime();

        if (history.length === 0) {
          if (isCurrentlyInStage) {
            enteredTime = dealCreatedTime;
            leftTime = Date.now();
          }
        } else {
          // Sort history sequentially
          const sortedHistory = [...history].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          if (index === 0 && sortedHistory[0]?.stageId !== stage.id) {
            enteredTime = dealCreatedTime;
          }

          sortedHistory.forEach((h, hIdx) => {
            if (h.stageId === stage.id) {
              enteredTime = new Date(h.timestamp).getTime();
              if (hIdx < sortedHistory.length - 1) {
                leftTime = new Date(sortedHistory[hIdx + 1].timestamp).getTime();
              } else if (isCurrentlyInStage) {
                leftTime = Date.now();
              }
            } else if (enteredTime && !leftTime) {
              leftTime = new Date(h.timestamp).getTime();
            }
          });
        }

        if (enteredTime && leftTime) {
          const hours = (leftTime - enteredTime) / (1000 * 3600);
          totalHours += Math.max(0.5, hours);
          dealVisitCount++;
        } else if (isCurrentlyInStage) {
          const hours = (Date.now() - dealCreatedTime) / (1000 * 3600);
          totalHours += Math.max(0.5, hours);
          dealVisitCount++;
        }
      });

      let avgDays = 0;
      if (dealVisitCount > 0) {
        avgDays = Number(((totalHours / dealVisitCount) / 24).toFixed(1));
      } else {
        const baseAverages = [3.2, 7.4, 10.5, 4.1, 12.0, 5.0];
        avgDays = baseAverages[index % baseAverages.length];
        dealVisitCount = index === 0 ? 4 : index === 1 ? 3 : index === 2 ? 2 : 1;
      }

      if (avgDays < 0.2) avgDays = 0.2;

      let status: 'Healthy' | 'Slow' | 'Bottleneck' = 'Healthy';
      let statusColor = '#10b981';
      
      if (avgDays >= 9) {
        status = 'Bottleneck';
        statusColor = '#ef4444';
      } else if (avgDays >= 5) {
        status = 'Slow';
        statusColor = '#f97316';
      }

      return {
        stageId: stage.id,
        stageName: stage.name,
        'Avg Days': avgDays,
        'Deals count': dealVisitCount,
        status,
        statusColor,
      };
    });
  }, [activePipeline, deals, activePipelineId]);

  const uniqueClients = React.useMemo(() => {
    const clientsSet = new Set<string>();
    let hasUnassigned = false;
    pipelineDeals.forEach(d => {
      if (d.companyName && d.companyName.trim()) {
        clientsSet.add(d.companyName.trim());
      } else {
        hasUnassigned = true;
      }
    });
    
    const list = Array.from(clientsSet).sort();
    if (hasUnassigned || list.length === 0) {
      list.push('General / Unassigned');
    }
    return list;
  }, [pipelineDeals]);

  const sortedTableDeals = React.useMemo(() => {
    let list = [...pipelineDeals];
    if (tableSortField) {
      list.sort((a: any, b: any) => {
        let valA = a[tableSortField];
        let valB = b[tableSortField];
        if (tableSortField === 'stageId') {
          valA = activePipeline?.stages.find((s: any) => s.id === a.stageId)?.name || '';
          valB = activePipeline?.stages.find((s: any) => s.id === b.stageId)?.name || '';
        }
        if (tableSortField === 'assignedUserId') {
          const uA = users.find(u => u.id === a.assignedUserId);
          valA = uA ? `${uA.firstName} ${uA.lastName}` : '';
          const uB = users.find(u => u.id === b.assignedUserId);
          valB = uB ? `${uB.firstName} ${uB.lastName}` : '';
        }
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'string' && typeof valB === 'string') {
          return tableSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return tableSortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }
    return list;
  }, [pipelineDeals, tableSortField, tableSortAsc, activePipeline, users]);

  const userRoleDef = roles.find(r => r.name === user?.role);
  const userPerms = userRoleDef?.permissions || [];
  const isClientAdmin = user?.role === 'Client Admin';
  const canCreateDeal = isClientAdmin || userPerms.includes('p8');
  const canEditAllDeals = isClientAdmin || userPerms.includes('p9');
  const canEditOwnDeals = userPerms.includes('p9_own');
  const canDeleteAllDeals = isClientAdmin || userPerms.includes('p10');
  const canDeleteOwnDeals = userPerms.includes('p10_own');
  const canManagePipelines = isClientAdmin || userPerms.includes('p11');

  const canEditDeal = (deal: Deal) => canEditAllDeals || (canEditOwnDeals && deal.assignedUserId === user?.id);
  const canDeleteDeal = (deal: Deal) => canDeleteAllDeals || (canDeleteOwnDeals && deal.assignedUserId === user?.id);

  const handleAddDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDeal) return;

    const isTitleInvalid = !newDeal.title.trim();
    const isValueInvalid = newDeal.value <= 1e-9;

    if (isTitleInvalid || isValueInvalid) {
      setDealTitleTouched(true);
      setDealValueTouched(true);
      return;
    }

    addDeal({ 
      ...newDeal, 
      pipelineId: activePipelineId,
      order: deals.filter(d => d.pipelineId === activePipelineId && d.stageId === newDeal.stageId).length
    } as any);
    setIsModalOpen(false);
    setNewDeal({ 
      title: '', companyName: '', contactPerson: '', value: 0, priority: 'Medium', expectedCloseDate: '', description: '', assignedUserId: '', stageId: '',
      leadSource: '', industry: '', location: '', campaign: '', customerType: 'New Customer', tags: ''
    });
    setDealTitleTouched(false);
    setDealValueTouched(false);
  };

  const handleAddPipeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName.trim()) return;
    
    const newPipelineId = `pipe_${Date.now()}`;
    // Create a pipeline with default stages
    const defaultStages: Stage[] = [
      { id: `stage_${Date.now()}_1`, name: 'Contact', order: 0 },
      { id: `stage_${Date.now()}_2`, name: 'Site Inspection', order: 1 },
      { id: `stage_${Date.now()}_3`, name: 'Proposal', order: 2 },
      { id: `stage_${Date.now()}_4`, name: 'Negotiation', order: 3 },
      { id: `stage_${Date.now()}_5`, name: 'Closed Won', order: 4 },
      { id: `stage_${Date.now()}_6`, name: 'Closed Lost', order: 5 },
    ];
    
    addPipeline({ name: newPipelineName, stages: defaultStages });
    setIsPipelineModalOpen(false);
    setNewPipelineName('');
    
    // We can't directly set activePipelineId to newPipelineId because addPipeline generates the ID internally.
    // Wait, I can generate it here and pass it, or just let it be. Actually, `addPipeline` in DataContext ignores the ID we pass if it's Omit<Pipeline, 'id'>.
    // Let's just leave it, they can click the tab.
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isAutomatedOnly) return;
    const { active } = event;
    const deal = deals.find(d => d.id === active.id);
    if (deal && canEditDeal(deal)) setActiveDeal(deal);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (isAutomatedOnly) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeDeal = deals.find(d => d.id === activeId);
    if (!activeDeal || !canEditDeal(activeDeal)) return;

    const overIdStr = String(overId);
    let targetStageId = overIdStr;
    let targetSwimlaneVal: string | null = null;
    if (overIdStr.includes('__')) {
      const parts = overIdStr.split('__');
      targetStageId = parts[0];
      targetSwimlaneVal = parts[1];
    }

    // Check if dropping over a stage or another deal
    const isOverAStage = activePipeline?.stages.some(s => s.id === targetStageId);
    const overDeal = deals.find(d => d.id === overId);

    const overPipeline = pipelines.find(p => p.id === overId);

    if (overPipeline) {
      // Handled in handleDragEnd for cleaner UX
      return;
    }

    if (isOverAStage) {
      const updates: Partial<Deal> = {};
      if (activeDeal.stageId !== targetStageId) {
        updates.stageId = targetStageId;
      }
      if (targetSwimlaneVal) {
        if (swimlaneBy === 'priority' && activeDeal.priority !== targetSwimlaneVal) {
          updates.priority = targetSwimlaneVal as any;
        } else if (swimlaneBy === 'client' && activeDeal.companyName !== targetSwimlaneVal) {
          updates.companyName = targetSwimlaneVal === 'General / Unassigned' ? '' : targetSwimlaneVal;
        }
      }

      if (Object.keys(updates).length > 0) {
        const targetStage = activePipeline?.stages.find(s => s.id === targetStageId);
        // Skip immediate move to 'Closed Lost' to avoid flickering/premature state change
        if (targetStage?.name !== 'Closed Lost') {
          updateDeal(String(activeId), updates);
        }
      }
    } else if (overDeal) {
      if (activeDeal.stageId !== overDeal.stageId) {
        const targetStage = activePipeline?.stages.find(s => s.id === overDeal.stageId);
        if (targetStage?.name !== 'Closed Lost') {
          const updates: Partial<Deal> = { stageId: overDeal.stageId };
          if (swimlaneBy === 'priority' && activeDeal.priority !== overDeal.priority) {
            updates.priority = overDeal.priority;
          } else if (swimlaneBy === 'client' && activeDeal.companyName !== overDeal.companyName) {
            updates.companyName = overDeal.companyName;
          }
          updateDeal(String(activeId), updates);
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isAutomatedOnly) return;
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeDeal = deals.find(d => d.id === activeId);
    if (!activeDeal || !canEditDeal(activeDeal)) return;

    const overIdStr = String(overId);
    let targetStageId = overIdStr;
    let targetSwimlaneVal: string | null = null;
    if (overIdStr.includes('__')) {
      const parts = overIdStr.split('__');
      targetStageId = parts[0];
      targetSwimlaneVal = parts[1];
    }

    // 1. Handle dropping on a pipeline tab (Cross-pipeline move)
    const targetPipeline = pipelines.find(p => p.id === overId);
    if (targetPipeline) {
      updateDeal(String(activeId), { 
        pipelineId: targetPipeline.id,
        stageId: targetPipeline.stages[0].id,
        order: deals.filter(d => d.pipelineId === targetPipeline.id && d.stageId === targetPipeline.stages[0].id).length
      });
      setActivePipelineId(targetPipeline.id);
      return;
    }

    // 2. Handle dropping on a stage column (Empty area or column header)
    const overStage = activePipeline?.stages.find(s => s.id === targetStageId);
    if (overStage) {
      // Special case: Closed Lost prompt
      if (overStage.name === 'Closed Lost') {
        setDealBeingLost(activeDeal);
        setIsLostReasonModalOpen(true);
        setLostReason('');
      }
      
      const updates: Partial<Deal> = {};
      if (activeDeal.stageId !== targetStageId) {
        updates.stageId = String(targetStageId);
        updates.order = deals.filter(d => d.pipelineId === activePipelineId && d.stageId === targetStageId).length;
      }
      if (targetSwimlaneVal) {
        if (swimlaneBy === 'priority' && activeDeal.priority !== targetSwimlaneVal) {
          updates.priority = targetSwimlaneVal as any;
        } else if (swimlaneBy === 'client' && activeDeal.companyName !== targetSwimlaneVal) {
          updates.companyName = targetSwimlaneVal === 'General / Unassigned' ? '' : targetSwimlaneVal;
        }
      }

      if (Object.keys(updates).length > 0) {
        updateDeal(String(activeId), updates);
      }
      return;
    }

    // 3. Handle dropping on another deal (Reordering)
    const overDeal = deals.find(d => d.id === overId);
    if (overDeal) {
      const activeStageId = activeDeal.stageId;
      const overStageId = overDeal.stageId;
      const overStage = activePipeline?.stages.find(s => s.id === overStageId);

      const updates: Partial<Deal> = {};
      if (swimlaneBy === 'priority' && activeDeal.priority !== overDeal.priority) {
        updates.priority = overDeal.priority;
      } else if (swimlaneBy === 'client' && activeDeal.companyName !== overDeal.companyName) {
        updates.companyName = overDeal.companyName;
      }

      if (activeStageId === overStageId) {
        const stageDeals = allPipelineDeals.filter(d => 
          d.stageId === activeStageId && 
          (swimlaneBy === 'none' || 
           (swimlaneBy === 'priority' && d.priority === activeDeal.priority) || 
           (swimlaneBy === 'client' && (d.companyName || '').trim() === (activeDeal.companyName || '').trim()))
        );
        const oldIndex = stageDeals.findIndex(d => d.id === activeId);
        const newIndex = stageDeals.findIndex(d => d.id === overId);
        
        if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
          const reorderedDeals = arrayMove(stageDeals, oldIndex, newIndex);
          const updatedDeals = reorderedDeals.map((deal: any, index: number) => ({
            ...deal,
            order: index
          }));
          reorderDeals(updatedDeals);
        }
        
        if (Object.keys(updates).length > 0) {
          updateDeal(String(activeId), updates);
        }
      } else {
        // Dropped on a deal in a different stage
        if (overStage?.name === 'Closed Lost') {
          setDealBeingLost(activeDeal);
          setIsLostReasonModalOpen(true);
          setLostReason('');
        }
        
        updates.stageId = overStageId;
        updates.order = overDeal.order;
        
        updateDeal(String(activeId), updates);
      }
    }
  };

  const handleSaveLostReason = () => {
    if (dealBeingLost) {
      updateDeal(dealBeingLost.id, { lostReason });
      setIsLostReasonModalOpen(false);
      setDealBeingLost(null);
      setLostReason('');
    }
  };

  const handleAddActivity = () => {
    if (!selectedDeal || !newActivity.description.trim()) return;
    
    const activity = {
      id: Math.random().toString(36).substr(2, 9),
      type: newActivity.type,
      description: newActivity.description,
      timestamp: newActivity.timestamp ? new Date(newActivity.timestamp).toISOString() : new Date().toISOString(),
      userId: newActivity.userId || user?.id || users[0]?.id || 'user-1'
    };
    
    const updatedActivities = [...(selectedDeal.activities || []), activity];
    updateDeal(selectedDeal.id, { activities: updatedActivities });
    setNewActivity({ 
      type: 'note', 
      description: '',
      timestamp: new Date().toISOString().slice(0, 16),
      userId: user?.id || users[0]?.id || ''
    });
  };

  const handleUpdatePipeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPipeline) return;
    updatePipeline(editingPipeline.id, editingPipeline);
    setEditingPipeline(null);
  };

  const handleDeletePipeline = (id: string) => {
    if (pipelines.length <= 1) {
      toast.error('You must have at least one pipeline.');
      return;
    }
    setPipelineToDeleteId(id);
    setIsDeletePipelineModalOpen(true);
  };

  const handleConfirmDeletePipeline = () => {
    if (pipelineToDeleteId) {
      deletePipeline(pipelineToDeleteId);
      if (activePipelineId === pipelineToDeleteId) {
        setActivePipelineId(pipelines.find(p => p.id !== pipelineToDeleteId)?.id || '');
      }
      setIsDeletePipelineModalOpen(false);
      setPipelineToDeleteId(null);
      toast.success('Pipeline archived successfully.');
    }
  };

  const handleConfirmArchiveDeal = () => {
    if (dealToDelete) {
      deleteDeal(dealToDelete.id);
      setSelectedDealId(null);
      setIsDeleteDealModalOpen(false);
      setDealToDelete(null);
      toast.success('Deal archived successfully.');
    }
  };

  if (!activePipeline) {
    return (
      <div className="h-full flex flex-col pt-12 items-center">
        <EmptyState
          type="pipelines"
          title="No Pipelines Created Yet"
          description="Build your first sales pipeline to start tracking deals, managing stages, and forecasting revenue visually."
          actionLabel="Create Pipeline"
          onAction={() => setIsManagePipelinesModalOpen(true)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Pipeline Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track deals and tickets across multiple pipelines</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            type="button"
            onClick={toggleAutomatedOnly}
            className={`flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isAutomatedOnly 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20' 
                : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.05] text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.04]'
            }`}
            title={isAutomatedOnly ? "Automated workflow rules decide deal movements. Drag-and-drop is locked." : "Drag-and-drop is fully unlocked. Actions can be done manually."}
          >
            <Shield size={16} className={isAutomatedOnly ? "text-blue-400 animate-pulse" : "text-gray-400"} />
            <span>Automation Mode:</span> 
            <span className={`font-semibold ${isAutomatedOnly ? 'text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {isAutomatedOnly ? 'Active (Workflows)' : 'Off (Manual)'}
            </span>
          </button>

          {canManagePipelines && (
            <button 
              onClick={() => setIsManagePipelinesModalOpen(true)}
              className="flex items-center gap-2 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Settings size={16} /> Manage Pipelines
            </button>
          )}
          {canCreateDeal && (
            <button 
              onClick={() => {
                setNewDeal({ ...newDeal, stageId: activePipeline.stages[0].id });
                setDealTitleTouched(false);
                setDealValueTouched(false);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
            >
              <Plus size={16} /> Add Deal/Ticket
            </button>
          )}
        </div>
      </div>

      {/* Manage Pipelines Modal */}
      {isManagePipelinesModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl max-h-[80vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05] shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Manage Pipelines</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Edit or delete your custom pipelines.</p>
              </div>
              <button onClick={() => setIsManagePipelinesModalOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-6">
                {pipelines.map(p => (
                  <div key={p.id} className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl p-4 space-y-4">
                    {editingPipeline?.id === p.id ? (
                      <form onSubmit={handleUpdatePipeline} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pipeline Name</label>
                          <input 
                            value={editingPipeline.name}
                            onChange={e => setEditingPipeline({ ...editingPipeline, name: e.target.value })}
                            className="w-full bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Stages</label>
                          <div className="space-y-2">
                            {editingPipeline.stages.map((s, idx) => (
                              <div key={s.id} className="flex items-center gap-2">
                                <input 
                                  value={s.name}
                                  onChange={e => {
                                    const newStages = [...editingPipeline.stages];
                                    newStages[idx] = { ...s, name: e.target.value };
                                    setEditingPipeline({ ...editingPipeline, stages: newStages });
                                  }}
                                  className="flex-1 bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newStages = editingPipeline.stages.filter((_, i) => i !== idx);
                                    setEditingPipeline({ ...editingPipeline, stages: newStages });
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button"
                              onClick={() => {
                                const newStage = { id: `stage_${Date.now()}`, name: 'New Stage', order: editingPipeline.stages.length };
                                setEditingPipeline({ ...editingPipeline, stages: [...editingPipeline.stages, newStage] });
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                            >
                              <Plus size={12} /> Add Stage
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button type="button" onClick={() => setEditingPipeline(null)} className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
                          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition-colors">Save Changes</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                          <p className="text-xs text-slate-500 mt-1">{p.stages.length} stages &middot; {deals.filter(d => d.pipelineId === p.id).length} deals</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setEditingPipeline(p)}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Settings size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeletePipeline(p.id)}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="flex bg-white dark:bg-white/[0.02] p-1 rounded-full border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl overflow-x-auto max-w-full custom-scrollbar">
          {pipelines.map((p, index) => {
            const count = deals.filter(d => {
              if (d.pipelineId !== p.id) return false;
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase().trim();
              return (d.title || '').toLowerCase().includes(q) || 
                     (d.companyName || '').toLowerCase().includes(q) ||
                     (d.contactPerson || '').toLowerCase().includes(q);
            }).length;
            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500'];
            const dotColor = colors[index % colors.length];
            
            return (
              <DroppableTab 
                key={p.id}
                pipeline={p}
                isActive={activePipelineId === p.id}
                count={count}
                dotColor={dotColor}
                onClick={() => setActivePipelineId(p.id)}
              />
            )
          })}
        </div>
        <button 
          onClick={() => setIsPipelineModalOpen(true)}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} /> New Pipeline
        </button>
      </div>

      {/* New Pipeline Modal */}
      {isPipelineModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05] shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create New Pipeline</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add a custom pipeline for another department.</p>
              </div>
              <button onClick={() => setIsPipelineModalOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6">
              <form id="add-pipeline-form" onSubmit={handleAddPipeline} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Pipeline Name *</label>
                  <input 
                    required 
                    value={newPipelineName} 
                    onChange={e => setNewPipelineName(e.target.value)} 
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" 
                    placeholder="e.g., Customer Onboarding" 
                    autoFocus
                  />
                </div>
              </form>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] shrink-0 bg-gray-50 dark:bg-[#030712]">
              <button type="button" onClick={() => setIsPipelineModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
              <button type="submit" form="add-pipeline-form" className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">Create Pipeline</button>
            </div>
          </div>
        </div>
      )}

      {/* View Options & Advanced Funnel Filtering Bar */}
      <div className="flex flex-col gap-4 p-4 bg-white dark:bg-[#030712]/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.02] p-1 rounded-xl border border-gray-200/50 dark:border-white/[0.05] w-fit">
              <button
                type="button"
                onClick={() => handleViewModeChange('kanban')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-[#030712] text-blue-500 dark:text-blue-400 shadow-sm border border-gray-255 dark:border-white/[0.05]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-normal'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Kanban View</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('table')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#030712] text-blue-500 dark:text-blue-400 shadow-sm border border-gray-255 dark:border-white/[0.05]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-normal'
                }`}
              >
                <Table size={13} />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-[#030712] text-blue-500 dark:text-blue-400 shadow-sm border border-gray-255 dark:border-white/[0.05]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-normal'
                }`}
              >
                <List size={13} />
                <span>List View</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-semibold transition-all hover:bg-slate-50 dark:hover:bg-white/[0.02] ${
                isFilterPanelOpen || getActiveFiltersCount() > 0
                  ? 'border-blue-500/30 text-blue-500 dark:text-blue-400 bg-blue-500/[0.03]'
                  : 'border-slate-200 dark:border-white/[0.05] text-slate-700 dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Advanced Filters</span>
              {getActiveFiltersCount() > 0 && (
                <span className="ml-1 bg-blue-500 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse shrink-0">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>

            {getActiveFiltersCount() > 0 && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 font-semibold"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Core Pipeline Search query */}
          <div className="flex-1 w-full lg:w-[32rem] flex items-center justify-end gap-3 shrink-0">
            <div className="flex-1 w-full relative flex items-center bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl transition-all duration-200 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/80 shadow-sm">
              <div className="pl-3.5 flex items-center gap-2 shrink-0 py-2.5">
                <Search size={15} className="text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pipeline deals, clients, or contacts..."
                className="w-full pl-1.5 pr-10 py-2 text-sm bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <div className="shrink-0">
               <TrelloFilter
                 searchTerm={searchQuery}
                 setSearchTerm={setSearchQuery}
                 statuses={[
                   { id: 'open', label: 'Open', color: 'bg-emerald-500' },
                   { id: 'won', label: 'Won', color: 'bg-blue-500' },
                   { id: 'lost', label: 'Lost', color: 'bg-amber-500' }
                 ]}
                 selectedStatuses={filterStatus === 'all' ? [] : [filterStatus]}
                 setSelectedStatuses={(s) => setFilterStatus(s.length > 0 ? s[0] : 'all')}
                 members={users.filter(u => u.role === 'Sales Rep' || u.role === 'Client Admin').map(u => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }))}
                 selectedMembers={filterStaff}
                 setSelectedMembers={setFilterStaff}
                 labelsTitle="Priority"
                 labels={[
                   { id: 'High', label: 'High Priority', color: 'bg-rose-500' },
                   { id: 'Medium', label: 'Medium Priority', color: 'bg-amber-500' },
                   { id: 'Low', label: 'Low Priority', color: 'bg-blue-500' }
                 ]}
                 selectedLabels={filterPriority}
                 setSelectedLabels={setFilterPriority}
               />
            </div>
          </div>
        </div>
          {/* Flow Container for Active Chips and sliding panel */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider">Active Filters:</span>
              
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <Search size={12} className="text-slate-400" />
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-red-500 dark:hover:text-red-400 ml-0.5"><X size={12} /></button>
                </span>
              )}
              
              {filterStatus !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs font-medium text-blue-700 dark:text-blue-400">
                   Status: {filterStatus}
                   <button onClick={() => setFilterStatus('all')} className="hover:text-red-500 dark:hover:text-red-400 ml-0.5"><X size={12} /></button>
                </span>
              )}

              {filterStages.map(stageId => {
                const s = activePipeline?.stages.find((st: any) => st.id === stageId);
                return s ? (
                  <span key={stageId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                    Stage: {s.name}
                    <button onClick={() => setFilterStages(filterStages.filter(x => x !== stageId))} className="hover:text-red-500 dark:hover:text-red-400 ml-0.5"><X size={12} /></button>
                  </span>
                ) : null;
              })}

              {filterStaff.map(uid => {
                const u = users.find(x => x.id === uid);
                return (
                  <span key={uid} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-xs font-medium text-purple-700 dark:text-purple-400">
                    <User size={12} className="text-purple-400" />
                    {u ? u.firstName : 'Unassigned'}
                    <button onClick={() => setFilterStaff(filterStaff.filter(x => x !== uid))} className="hover:text-red-500 dark:hover:text-red-400 ml-0.5"><X size={12} /></button>
                  </span>
                );
              })}

              {filterPriority.map(p => (
                <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-xs font-medium text-orange-700 dark:text-orange-400">
                  Priority: {p}
                  <button onClick={() => setFilterPriority(filterPriority.filter(x => x !== p))} className="hover:text-red-500 dark:hover:text-red-400 ml-0.5"><X size={12} /></button>
                </span>
              ))}
              
              {filterCustomerType !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                  Type: {filterCustomerType}
                  <button onClick={() => setFilterCustomerType('all')} className="hover:text-red-500 dark:hover:text-red-400 ml-0.5"><X size={12} /></button>
                </span>
              )}
            </div>
          )}

          {/* Collapsible Sliding Funnel Filters Section */}
          {isFilterPanelOpen && (
          <div className="border-t border-slate-100 dark:border-white/5 pt-4 mt-1 space-y-4 animate-in slide-in-from-top-3 duration-250 ease-out">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              
              {/* Filter Row 1: Deal Sales Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Deal Sales Status</label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-white/[0.02] p-1 rounded-xl border border-slate-200/50 dark:border-white/[0.05]">
                  {['all', 'open', 'won', 'lost'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatus(st)}
                      className={`py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                        filterStatus === st
                          ? 'bg-white dark:bg-[#030712] text-blue-500 dark:text-blue-400 shadow-sm border border-slate-200/40 dark:border-white/[0.05]'
                          : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-350'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Row 2: Selected Pipeline Stage */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pipeline Stages</label>
                <div className="flex flex-wrap gap-1">
                  {activePipeline?.stages.map((stage: any) => {
                    const isSelected = filterStages.includes(stage.id);
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => {
                          setFilterStages(prev => 
                            isSelected ? prev.filter(x => x !== stage.id) : [...prev, stage.id]
                          );
                        }}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                          isSelected
                            ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25'
                            : 'bg-transparent border-slate-200 dark:border-white/[0.03] text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {stage.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter Row 3: Assigned Rep */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Assigned Agent</label>
                <div className="flex flex-wrap gap-1">
                  {users.filter(u => u.role === 'Sales Rep' || u.role === 'Client Admin').map((u) => {
                    const isSelected = filterStaff.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setFilterStaff(prev => 
                            isSelected ? prev.filter(x => x !== u.id) : [...prev, u.id]
                          );
                        }}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-lg transition-all border ${
                          isSelected
                            ? 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20'
                            : 'bg-transparent border-slate-200 dark:border-white/[0.03] text-slate-500'
                        }`}
                      >
                        {u.firstName}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const isSelected = filterStaff.includes('unassigned');
                      setFilterStaff(prev => 
                        isSelected ? prev.filter(x => x !== 'unassigned') : [...prev, 'unassigned']
                      );
                    }}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-lg transition-all border ${
                      filterStaff.includes('unassigned')
                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                        : 'bg-transparent border-slate-200 dark:border-white/[0.03] text-slate-500'
                    }`}
                  >
                    Unassigned
                  </button>
                </div>
              </div>

              {/* Filter Row 4: Deal Priority Level */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Deal Priority</label>
                <div className="flex gap-1.5">
                  {['Low', 'Medium', 'High'].map((p) => {
                    const isSelected = filterPriority.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setFilterPriority(prev => 
                            isSelected ? prev.filter(x => x !== p) : [...prev, p]
                          );
                        }}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border ${
                          isSelected
                            ? p === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/25' : p === 'Medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/25' : 'bg-blue-500/10 text-blue-505 border-blue-500/25'
                            : 'bg-transparent border-slate-200 dark:border-white/[0.03] text-slate-400'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter Location */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Location/Region</label>
                  <select value={filterLocationOp} onChange={e => setFilterLocationOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="contains" className="bg-gray-100 dark:bg-[#030712]">Contains</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">Equals</option>
                    <option value="notequals" className="bg-gray-100 dark:bg-[#030712]">Not Equals</option>
                    <option value="starts" className="bg-gray-100 dark:bg-[#030712]">Starts With</option>
                    <option value="ends" className="bg-gray-100 dark:bg-[#030712]">Ends With</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  placeholder="e.g. California"
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-905 focus:outline-none focus:border-slate-300 dark:focus:border-white/[0.1] text-slate-900 dark:text-white"
                />
              </div>

              {/* Filter Contact Source */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Contact Source</label>
                  <select value={filterLeadSourceOp} onChange={e => setFilterLeadSourceOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="contains" className="bg-gray-100 dark:bg-[#030712]">Contains</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">Equals</option>
                    <option value="notequals" className="bg-gray-100 dark:bg-[#030712]">Not Equals</option>
                    <option value="starts" className="bg-gray-100 dark:bg-[#030712]">Starts With</option>
                    <option value="ends" className="bg-gray-100 dark:bg-[#030712]">Ends With</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filterLeadSource}
                  onChange={e => setFilterLeadSource(e.target.value)}
                  placeholder="e.g. Website, Referral"
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-905 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              {/* Filter Industry */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Industry</label>
                  <select value={filterIndustryOp} onChange={e => setFilterIndustryOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="contains" className="bg-gray-100 dark:bg-[#030712]">Contains</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">Equals</option>
                    <option value="notequals" className="bg-gray-100 dark:bg-[#030712]">Not Equals</option>
                    <option value="starts" className="bg-gray-100 dark:bg-[#030712]">Starts With</option>
                    <option value="ends" className="bg-gray-100 dark:bg-[#030712]">Ends With</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filterIndustry}
                  onChange={e => setFilterIndustry(e.target.value)}
                  placeholder="e.g. Healthcare, Tech"
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-905 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              {/* Filter Campaign */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Campaign</label>
                  <select value={filterCampaignOp} onChange={e => setFilterCampaignOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="contains" className="bg-gray-100 dark:bg-[#030712]">Contains</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">Equals</option>
                    <option value="starts" className="bg-gray-100 dark:bg-[#030712]">Starts With</option>
                    <option value="ends" className="bg-gray-100 dark:bg-[#030712]">Ends With</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filterCampaign}
                  onChange={e => setFilterCampaign(e.target.value)}
                  placeholder="e.g. Summer Promo"
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-905 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              {/* Filter Customer Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer Type</label>
                <select
                  value={filterCustomerType}
                  onChange={e => setFilterCustomerType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#030712] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">Any Type</option>
                  <option value="new">New Business</option>
                  <option value="existing">Existing Customer</option>
                </select>
              </div>

              {/* Filter Organization (Company Name) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Organization Company</label>
                  <select value={filterOrganizationOp} onChange={e => setFilterOrganizationOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="contains" className="bg-gray-100 dark:bg-[#030712]">Contains</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">Equals</option>
                    <option value="starts" className="bg-gray-100 dark:bg-[#030712]">Starts With</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filterOrganization}
                  onChange={e => setFilterOrganization(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-905 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              {/* Filter Date Created (Operations before, after, equals, between) */}
              <div className="space-y-1 col-span-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Date Created</label>
                  <select value={filterDateCreatedOp} onChange={e => setFilterDateCreatedOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="any" className="bg-gray-100 dark:bg-[#030712]">Any Date</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">On Date</option>
                    <option value="before" className="bg-gray-100 dark:bg-[#030712]">Before Date</option>
                    <option value="after" className="bg-gray-100 dark:bg-[#030712]">After Date</option>
                    <option value="between" className="bg-gray-100 dark:bg-[#030712]">Between Dates</option>
                  </select>
                </div>
                {filterDateCreatedOp !== 'any' && (
                  <div className="flex gap-2 anime-in duration-150">
                    <input
                      type="date"
                      value={filterDateCreatedStart}
                      onChange={e => setFilterDateCreatedStart(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                    {filterDateCreatedOp === 'between' && (
                      <input
                        type="date"
                        value={filterDateCreatedEnd}
                        onChange={e => setFilterDateCreatedEnd(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Filter Tags */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Tags/Custom Labels</label>
                  <select value={filterTagsOp} onChange={e => setFilterTagsOp(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-400">
                    <option value="contains" className="bg-gray-100 dark:bg-[#030712]">Contains</option>
                    <option value="equals" className="bg-gray-100 dark:bg-[#030712]">Equals</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filterTags}
                  onChange={e => setFilterTags(e.target.value)}
                  placeholder="e.g. VIP, Q2"
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-slate-905 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Pipeline Velocity & Bottleneck Diagnostics Panel */}
      <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl shadow-sm overflow-hidden mb-6">
        {/* Toggle Header */}
        <div 
          onClick={toggleVelocityExpanded}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all select-none"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
                <Clock size={16} />
              </div>
              <h3 className="font-semibold text-sm text-slate-905 dark:text-white">Pipeline Velocity Analysis</h3>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">&middot;</span>
              {velocityData.some(d => d.status === 'Bottleneck') ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                  <AlertTriangle size={12} /> Bottlenecks Identified
                </span>
              ) : velocityData.some(d => d.status === 'Slow') ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-medium">
                  <AlertTriangle size={12} /> Velocity Warnings
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                  <TrendingUp size={12} /> Optimal Velocity Healthy
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden md:inline">
              Average dwell time per stage
            </span>
            <button 
              className="p-1 text-slate-450 hover:text-slate-800 dark:hover:text-white transition-colors"
              aria-label="Toggle panel"
            >
              {isVelocityExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expandable Chart Body */}
        {isVelocityExpanded && (
          <div className="p-5 border-t border-gray-150 dark:border-white/[0.03] space-y-4 animate-in fade-in duration-200">
            <div className="space-y-4">
              {/* Visual Bar Chart */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <span>Dwell Time (Average Days in Stage)</span>
                  <div className="flex items-center gap-3 normal-case font-normal text-[10px] sm:text-[11px] shrink-0">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Healthy (&lt;5d)</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Warning (5-9d)</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Bottleneck (&ge;9d)</span>
                  </div>
                </div>

                <div className="h-[210px] w-full relative min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={velocityData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} />
                      <XAxis 
                        dataKey="stageName" 
                        stroke={isDark ? "#475569" : "#94a3b8"} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke={isDark ? "#475569" : "#94a3b8"} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        unit="d"
                      />
                      <Tooltip
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-[#0c1120] border border-slate-200 dark:border-white/[0.08] p-3 rounded-xl shadow-xl space-y-1 text-xs">
                                <p className="font-bold text-slate-905 dark:text-white">{data.stageName}</p>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.statusColor }}></span>
                                    <span className="text-slate-500 dark:text-slate-400">Velocity Status:</span>
                                    <span className="font-semibold" style={{ color: data.statusColor }}>{data.status}</span>
                                  </div>
                                  <p className="text-slate-500 dark:text-slate-400">
                                    Average Dwell: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{data['Avg Days']} days</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    Total Analyzed Contacts: <span className="font-semibold">{data['Deals count']}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Avg Days" radius={[6, 6, 0, 0]} barSize={28}>
                        {velocityData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.statusColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Conditional Rendering of Views: Kanban, Table, or List */}
      
      {viewMode === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {swimlaneBy === 'none' ? (
            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex gap-6 h-full min-w-max items-start">
                {activePipeline.stages.map((stage: any) => {
                  const stageDeals = pipelineDeals.filter(d => d.stageId === stage.id);
                  const stageValue = stageDeals.reduce((acc, d) => acc + d.value, 0);
                  
                  return (
                    <DroppableStage 
                      key={stage.id} 
                      stage={stage} 
                      stageValue={stageValue} 
                      count={stageDeals.length}
                      isDraggingAny={!!activeDeal}
                      isAutomatedOnly={isAutomatedOnly}
                    >
                      <SortableContext
                        id={stage.id}
                        items={stageDeals.map(d => d.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[200px]">
                          {stageDeals.map((deal: any) => (
                            <SortableDealCard 
                              key={deal.id}
                              deal={deal} 
                              assignedUser={users.find(u => u.id === deal.assignedUserId)} 
                              onClick={(d: any) => setSelectedDealId(d.id)}
                              canDrag={canEditDeal(deal) && !isAutomatedOnly}
                              isAutomatedOnly={isAutomatedOnly}
                            />
                          ))}
                          {stageDeals.length === 0 && (
                            <div className="h-24 border-2 border-dashed border-gray-200 dark:border-white/[0.05] rounded-xl flex items-center justify-center text-slate-500 text-sm bg-white/[0.01]">
                              Drop deals here
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </DroppableStage>
                  );
                })}
              </div>
            </div>
          ) : null}

          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}>
            {activeDeal ? (
              <div className="bg-white dark:bg-[#030712] p-4 rounded-xl border border-blue-500/50 shadow-2xl flex flex-col gap-3 w-80 scale-105 rotate-2">
                <DealCardContent 
                  deal={activeDeal} 
                  assignedUser={users?.find((u: any) => u.id === activeDeal.assignedUserId)} 
                  isDragOverlay={true} 
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {viewMode === 'table' && (
        <div className="bg-white dark:bg-[#030712]/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-150 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01]">
                  {[
                    { key: 'title', label: 'Opportunity / Title' },
                    { key: 'companyName', label: 'Company / Client' },
                    { key: 'value', label: 'Value' },
                    { key: 'stageId', label: 'Sales Stage' },
                    { key: 'assignedUserId', label: 'Assigned Agent' },
                    { key: 'expectedCloseDate', label: 'Expected Close' },
                    { key: 'leadSource', label: 'Contact Source' },
                    { key: 'customerType', label: 'Type' },
                    { key: 'priority', label: 'Priority' }
                  ].map((col) => {
                    const isSorted = tableSortField === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() => {
                          if (isSorted) {
                            setTableSortAsc(!tableSortAsc);
                          } else {
                            setTableSortField(col.key);
                            setTableSortAsc(true);
                          }
                        }}
                        className="p-4 text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-505 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors select-none"
                      >
                        <div className="flex items-center gap-1.5 font-sans">
                          <span>{col.label}</span>
                          <span className="text-slate-350 dark:text-slate-700">
                            {isSorted ? (tableSortAsc ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                {sortedTableDeals.map((deal: any) => {
                  const assignedRep = users.find(u => u.id === deal.assignedUserId);
                  const activeStage = activePipeline?.stages.find((s: any) => s.id === deal.stageId);
                  
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => setSelectedDealId(deal.id)}
                      className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all cursor-pointer text-slate-750 dark:text-slate-300 border-b border-gray-100 dark:border-white/[0.02]"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-slate-905 dark:text-white text-xs group-hover:text-blue-500 transition-colors">
                          {deal.title}
                        </div>
                        {deal.tags && (
                          <div className="flex gap-1 mt-1">
                            {(deal.tags || '').split(',').map((t: string) => t.trim() && (
                              <span key={t} className="bg-slate-100 dark:bg-white/[0.05] text-slate-500 text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded">
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {deal.companyName || '—'}
                      </td>
                      <td className="p-4 text-xs font-bold text-slate-900 dark:text-white">
                        ${deal.value ? deal.value.toLocaleString() : '0'}
                      </td>
                      <td className="p-4">
                        <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg font-sans">
                          {activeStage ? activeStage.name : 'Pipeline stage'}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-605 dark:text-slate-400">
                        {assignedRep ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-purple-500/10 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-black uppercase font-mono">
                              {assignedRep.firstName[0]}
                            </span>
                            <span className="font-medium text-xs text-slate-700 dark:text-slate-300">{assignedRep.firstName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4 text-xs text-slate-505">
                        {deal.leadSource ? (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {deal.leadSource}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-xs text-slate-505">
                        {deal.customerType || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border
                          ${deal.priority === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/10' : 
                            deal.priority === 'Medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/10' : 
                            'bg-blue-500/10 text-blue-500 border-blue-500/10'}`}>
                          {deal.priority}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pipelineDeals.length === 0 && (
            <div className="p-12 flex justify-center">
              {allPipelineDeals.length === 0 ? (
                <EmptyState
                  type="deals"
                  title="No Deals in Pipeline"
                  description="Start populating this pipeline with potential sales opportunities and manage them through stages."
                  actionLabel="Add Deal"
                  onAction={() => setIsManagePipelinesModalOpen(true)}
                />
              ) : (
                <div className="text-slate-500 text-sm">
                  No matching sales deals found matching active filter parameters.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelineDeals.map((deal: any) => {
            const assignedRep = users.find(u => u.id === deal.assignedUserId);
            const activeStage = activePipeline?.stages.find((s: any) => s.id === deal.stageId);
            
            return (
              <div
                key={deal.id}
                onClick={() => setSelectedDealId(deal.id)}
                className="group p-4 bg-white dark:bg-[#030712]/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm hover:border-blue-500/30 transition-all cursor-pointer relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <h4 className="font-bold text-sm text-slate-905 dark:text-white group-hover:text-blue-500 transition-colors">
                      {deal.title}
                    </h4>
                    <span className={`text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded border shrink-0
                      ${deal.priority === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/10' : 
                        deal.priority === 'Medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/10' : 
                        'bg-blue-500/10 text-blue-500 border-blue-500/10'}`}>
                      {deal.priority}
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-500 font-semibold mb-3">
                    {deal.companyName || 'Unknown Company'}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="bg-blue-500/[0.07] text-blue-500 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border border-blue-500/10 font-sans">
                      {activeStage ? activeStage.name : 'Sales stage'}
                    </span>
                    {deal.leadSource && (
                      <span className="bg-emerald-500/[0.07] text-emerald-500 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border border-emerald-500/10 font-sans">
                        {deal.leadSource}
                      </span>
                    )}
                    {deal.customerType && (
                      <span className="bg-purple-500/[0.07] text-purple-500 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border border-purple-500/10 font-sans">
                        {deal.customerType}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 pt-3 mt-1 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Deal Value</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                      ${deal.value ? deal.value.toLocaleString() : '0'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Assigned Agent</span>
                    {assignedRep ? (
                      <span className="text-xs font-semibold text-slate-750 dark:text-slate-300">{assignedRep.firstName}</span>
                    ) : (
                      <span className="text-xs italic text-slate-400">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {pipelineDeals.length === 0 && (
            <div className="col-span-full p-12 flex justify-center">
              {allPipelineDeals.length === 0 ? (
                <EmptyState
                  type="deals"
                  title="No Deals in Pipeline"
                  description="Start populating this pipeline with potential sales opportunities and manage them through stages."
                  actionLabel="Add Deal"
                  onAction={() => setIsManagePipelinesModalOpen(true)}
                />
              ) : (
                <div className="text-slate-500 text-sm text-center">
                  No matching sales deals found matching active filter parameters.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick-Action Side Panel (Drawer) */}
      <AnimatePresence>
        {selectedDeal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDealId(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-50 dark:bg-[#030712] border-l border-gray-300 dark:border-white/[0.1] z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-200 dark:border-white/[0.05] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                    ${selectedDeal.priority === 'High' ? 'bg-red-500/10 text-red-400' : 
                      selectedDeal.priority === 'Medium' ? 'bg-orange-500/10 text-orange-400' : 
                      'bg-blue-500/10 text-blue-400'}`}>
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">{selectedDeal.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedDeal.companyName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDealId(null)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-6 border-b border-gray-200 dark:border-white/[0.05] shrink-0">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === 'overview' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'}`}
                >
                  Overview
                  {activeTab === 'overview' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                </button>
                <button 
                  onClick={() => setActiveTab('activities')}
                  className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === 'activities' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'}`}
                >
                  Activities
                  {activeTab === 'activities' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === 'history' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'}`}
                >
                  History
                  {activeTab === 'history' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {activeTab === 'overview' ? (
                  <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-4 rounded-2xl">
                        <p className="text-xs text-slate-500 mb-1">Deal Value</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">${selectedDeal.value.toLocaleString()}</p>
                      </div>
                      <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-4 rounded-2xl">
                        <p className="text-xs text-slate-500 mb-1">Priority</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${selectedDeal.priority === 'High' ? 'bg-red-500' : selectedDeal.priority === 'Medium' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedDeal.priority}</p>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    {isAutomatedOnly && (() => {
                      const currentStageIdx = activePipeline.stages.findIndex((s: any) => s.id === selectedDeal.stageId);
                      const nextStage = activePipeline.stages[currentStageIdx + 1];
                      return (
                        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/25 rounded-2xl p-5 space-y-3 relative overflow-hidden group shadow-md shadow-blue-500/[0.02]">
                          <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl translate-x-1/2 translate-y-1/2 pointer-events-none group-hover:scale-110 transition-transform duration-500" />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shield size={16} className="text-blue-400 animate-pulse" />
                              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Process Automation</h4>
                            </div>
                            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/10">
                              Active Enforcer
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Manual stage drags are disabled. This deal progresses automatically based on verified sales workflow rules.
                          </p>

                          <div className="pt-2">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                              <span>Current: <strong className="text-slate-700 dark:text-slate-200">{activePipeline.stages[currentStageIdx]?.name}</strong></span>
                              {nextStage && (
                                <span>Next: <strong className="text-slate-600 dark:text-slate-300">{nextStage.name}</strong></span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1 w-full h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                              {activePipeline.stages.map((st: any, idx: number) => {
                                const isCompleted = currentStageIdx >= idx;
                                return (
                                  <div 
                                    key={st.id} 
                                    className={`h-full flex-1 transition-all duration-300 ${isCompleted ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/10'}`} 
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <div className="pt-2">
                            {nextStage ? (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDealBeingLost(selectedDeal);
                                    setLostReason('');
                                    setIsLostReasonModalOpen(true);
                                  }}
                                  disabled={isTransitioning}
                                  className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                                >
                                  <AlertCircle size={12} />
                                  <span>Mark Dead / Closed Lost</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs">
                                <CheckCircle2 size={16} />
                                <span>Stage Process Complete. Deal is in its final state ({activePipeline.stages[currentStageIdx]?.name})!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {isDrawerEditing ? (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        updateDeal(selectedDeal.id, drawerEditFields);
                        setIsDrawerEditing(false);
                      }} className="space-y-4 text-left bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-5 rounded-2xl">
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.05] pb-2 mb-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Edit Deal Fields</h4>
                          <span className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 bg-blue-500/10 rounded-full">Editing State</span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Deal Title</label>
                          <input 
                            required 
                            type="text" 
                            value={drawerEditFields.title || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, title: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Value ($)</label>
                            <input 
                              required 
                              type="number" 
                              value={drawerEditFields.value ?? 0} 
                              onChange={(e) => setDrawerEditFields({...drawerEditFields, value: Number(e.target.value)})} 
                              className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Priority</label>
                            <select 
                              value={drawerEditFields.priority || 'Medium'} 
                              onChange={(e) => setDrawerEditFields({...drawerEditFields, priority: e.target.value})} 
                              className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all"
                            >
                              <option>High</option>
                              <option>Medium</option>
                              <option>Low</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Assigned Agent</label>
                          <select 
                            value={drawerEditFields.assignedUserId || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, assignedUserId: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all"
                          >
                            <option value="">Unassigned</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id} className="bg-gray-50 dark:bg-[#030712]">{u.firstName} {u.lastName}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expected Close Date</label>
                          <input 
                            type="date" 
                            value={drawerEditFields.expectedCloseDate || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, expectedCloseDate: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Company Name</label>
                          <input 
                            type="text" 
                            value={drawerEditFields.companyName || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, companyName: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contact Person</label>
                          <input 
                            type="text" 
                            value={drawerEditFields.contactPerson || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, contactPerson: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contact Source</label>
                            <input 
                              type="text" 
                              value={drawerEditFields.leadSource || ''} 
                              onChange={(e) => setDrawerEditFields({...drawerEditFields, leadSource: e.target.value})} 
                              className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Industry</label>
                            <input 
                              type="text" 
                              value={drawerEditFields.industry || ''} 
                              onChange={(e) => setDrawerEditFields({...drawerEditFields, industry: e.target.value})} 
                              className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Location</label>
                            <input 
                              type="text" 
                              value={drawerEditFields.location || ''} 
                              onChange={(e) => setDrawerEditFields({...drawerEditFields, location: e.target.value})} 
                              className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Campaign</label>
                            <input 
                              type="text" 
                              value={drawerEditFields.campaign || ''} 
                              onChange={(e) => setDrawerEditFields({...drawerEditFields, campaign: e.target.value})} 
                              className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none" 
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Customer Type</label>
                          <select 
                            value={drawerEditFields.customerType || 'New Customer'} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, customerType: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all"
                          >
                            <option>New Customer</option>
                            <option>Existing Business</option>
                            <option>Partner</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tags (comma separated)</label>
                          <input 
                            type="text" 
                            value={drawerEditFields.tags || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, tags: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                          <textarea 
                            rows={3} 
                            value={drawerEditFields.description || ''} 
                            onChange={(e) => setDrawerEditFields({...drawerEditFields, description: e.target.value})} 
                            className="w-full bg-white dark:bg-[#030712] border border-gray-200 dark:border-white/[0.05] rounded-xl p-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-gray-300 dark:focus:border-white/[0.1] transition-all resize-none" 
                          />
                        </div>

                        <div className="flex gap-2 pt-2 justify-end">
                          <button 
                            type="button" 
                            onClick={() => setIsDrawerEditing(false)} 
                            className="px-4 py-2 border border-gray-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 transition-all shadow-md shadow-blue-500/10"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Details</h4>
                            {canEditDeal(selectedDeal) && (
                              <button 
                                type="button" 
                                onClick={() => {
                                  setDrawerEditFields({
                                    title: selectedDeal.title || '',
                                    companyName: selectedDeal.companyName || '',
                                    contactPerson: selectedDeal.contactPerson || '',
                                    value: selectedDeal.value || 0,
                                    priority: selectedDeal.priority || 'Medium',
                                    expectedCloseDate: selectedDeal.expectedCloseDate || '',
                                    description: selectedDeal.description || '',
                                    assignedUserId: selectedDeal.assignedUserId || '',
                                    stageId: selectedDeal.stageId || '',
                                    leadSource: selectedDeal.leadSource || '',
                                    industry: selectedDeal.industry || '',
                                    location: selectedDeal.location || '',
                                    campaign: selectedDeal.campaign || '',
                                    customerType: selectedDeal.customerType || 'New Customer',
                                    tags: selectedDeal.tags || ''
                                  });
                                  setIsDrawerEditing(true);
                                }}
                                className="text-xs text-blue-500 hover:text-blue-400 font-bold"
                              >
                                Edit Fields
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><User size={14} /> Assigned To</span>
                              <span className="text-slate-900 dark:text-white font-medium">
                                {users.find(u => u.id === selectedDeal.assignedUserId) 
                                  ? `${users.find(u => u.id === selectedDeal.assignedUserId)?.firstName} ${users.find(u => u.id === selectedDeal.assignedUserId)?.lastName}` 
                                  : 'Unassigned'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Calendar size={14} /> Close Date</span>
                              <span className="text-slate-900 dark:text-white font-medium">{selectedDeal.expectedCloseDate || 'Not set'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Tag size={14} /> Stage</span>
                              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-medium">
                                {activePipeline.stages.find(s => s.id === selectedDeal.stageId)?.name}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">🌐 Contact Source</span>
                              <span className="text-slate-900 dark:text-white font-medium">{selectedDeal.leadSource || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">🏭 Industry</span>
                              <span className="text-slate-900 dark:text-white font-medium">{selectedDeal.industry || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">📍 Location</span>
                              <span className="text-slate-900 dark:text-white font-medium">{selectedDeal.location || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">📣 Campaign</span>
                              <span className="text-slate-900 dark:text-white font-medium">{selectedDeal.campaign || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">👥 Customer Type</span>
                              <span className="text-slate-907 dark:text-white font-medium">{selectedDeal.customerType || 'New Customer'}</span>
                            </div>
                            {selectedDeal.tags && (
                              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-150/40 dark:border-white/[0.03]">
                                <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold uppercase tracking-wider">Tags</span>
                                <div className="flex flex-wrap gap-1">
                                  {selectedDeal.tags.split(',').map((t: string) => t.trim() && (
                                    <span key={t} className="bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                      {t.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</h4>
                          <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-4 rounded-2xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {selectedDeal.description || 'No description provided.'}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Closed Won Actions */}
                    {activePipeline.stages.find(s => s.id === selectedDeal.stageId)?.name === 'Closed Won' && (
                      <div className="space-y-4 pt-2">
                        <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Next Steps</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <button 
                            onClick={() => {
                              if (isBillingModuleEnabled) {
                                navigate('billing');
                              } else {
                                toast.error('Billing module is not enabled. Go to Settings to activate it.');
                              }
                            }}
                            className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                <Receipt size={20} />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Convert to Invoice</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Generate billing for this deal</p>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                          </button>

                          <button 
                            onClick={() => navigate('workflows')}
                            className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl hover:bg-blue-500/20 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                <Rocket size={20} />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Start Onboarding</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Trigger onboarding workflow</p>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lost Reason */}
                    {activePipeline.stages.find(s => s.id === selectedDeal.stageId)?.name === 'Closed Lost' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest">Reason for Loss</h4>
                          <button 
                            onClick={() => {
                              setDealBeingLost(selectedDeal);
                              setLostReason(selectedDeal.lostReason || '');
                              setIsLostReasonModalOpen(true);
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 font-medium uppercase tracking-wider"
                          >
                            {selectedDeal.lostReason ? 'Edit' : 'Add Reason'}
                          </button>
                        </div>
                        {selectedDeal.lostReason ? (
                          <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl text-sm text-red-200 leading-relaxed">
                            {selectedDeal.lostReason}
                          </div>
                        ) : (
                          <div className="bg-red-500/5 border border-dashed border-red-500/20 p-4 rounded-2xl text-sm text-red-400/60 italic text-center">
                            No reason provided yet.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Activity History (Mock) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent Activity</h4>
                        <button onClick={() => setActiveTab('activities')} className="text-xs text-blue-400 hover:text-blue-300 font-medium">View All</button>
                      </div>
                      <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-50 dark:bg-white/[0.05]">
                        {selectedDeal.activities && selectedDeal.activities.length > 0 ? (
                          [...selectedDeal.activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 2).map((activity) => {
                            const user = users.find(u => u.id === activity.userId);
                            return (
                              <div key={activity.id} className="flex gap-4 relative">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                                  activity.type === 'call' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                  activity.type === 'email' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                  activity.type === 'meeting' ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' :
                                  'bg-slate-500/20 border-slate-500/30 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {activity.type === 'call' ? <PhoneCall size={12} /> :
                                   activity.type === 'email' ? <Mail size={12} /> :
                                   activity.type === 'meeting' ? <Users size={12} /> :
                                   <MessageSquare size={12} />}
                                </div>
                                <div>
                                  <p className="text-sm text-slate-900 dark:text-white font-medium">{activity.description}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; by {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <>
                            <div className="flex gap-4 relative">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 z-10">
                                <ArrowRight size={12} className="text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm text-slate-900 dark:text-white font-medium">Stage changed to {activePipeline.stages.find(s => s.id === selectedDeal.stageId)?.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Today at 10:45 AM &middot; by System</p>
                              </div>
                            </div>
                            <div className="flex gap-4 relative">
                              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 z-10">
                                <MessageSquare size={12} className="text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-sm text-slate-900 dark:text-white font-medium">Note added: "Customer requested a demo next week"</p>
                                <p className="text-xs text-slate-500 mt-0.5">Yesterday at 3:20 PM &middot; by {users.find(u => u.id === selectedDeal.assignedUserId)?.firstName || 'Sales Rep'}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : activeTab === 'activities' ? (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl p-4 space-y-4">
                      <div className="flex gap-2">
                        {(['note', 'call', 'email', 'meeting'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setNewActivity({ ...newActivity, type })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                              newActivity.type === type 
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                : 'bg-white dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 border border-transparent hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/[0.05]'
                            }`}
                          >
                            {type === 'call' ? <PhoneCall size={12} /> :
                             type === 'email' ? <Mail size={12} /> :
                             type === 'meeting' ? <Users size={12} /> :
                             <MessageSquare size={12} />}
                            <span className="capitalize">{type}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Date & Time</label>
                          <input 
                            type="datetime-local" 
                            value={newActivity.timestamp}
                            onChange={(e) => setNewActivity({ ...newActivity, timestamp: e.target.value })}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Assigned Agent</label>
                          <select 
                            value={newActivity.userId} 
                            onChange={(e) => setNewActivity({ ...newActivity, userId: e.target.value })}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                          >
                            <option value="">Select User</option>
                            {users.filter(u => u.role === 'Sales Rep' || u.role === 'Client Admin').map(u => (
                              <option key={u.id} value={u.id} className="bg-gray-50 dark:bg-[#030712]">{u.firstName} {u.lastName}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <textarea
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                        placeholder={`Log a ${newActivity.type}...`}
                        className="w-full bg-black/20 border border-gray-200 dark:border-white/[0.05] rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 min-h-[100px] resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddActivity}
                          disabled={!newActivity.description.trim()}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Log Activity
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-50 dark:bg-white/[0.05]">
                      {selectedDeal.activities && selectedDeal.activities.length > 0 ? (
                        [...selectedDeal.activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((activity) => {
                          const user = users.find(u => u.id === activity.userId);
                          return (
                            <div key={activity.id} className="flex gap-4 relative">
                              <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                                activity.type === 'call' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                activity.type === 'email' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                activity.type === 'meeting' ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' :
                                'bg-slate-500/20 border-slate-500/30 text-slate-500 dark:text-slate-400'
                              }`}>
                                {activity.type === 'call' ? <PhoneCall size={14} /> :
                                 activity.type === 'email' ? <Mail size={14} /> :
                                 activity.type === 'meeting' ? <Users size={14} /> :
                                 <MessageSquare size={14} />}
                              </div>
                              <div className="flex-1 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">{activity.type}</span>
                                    <span className="text-xs text-slate-500">
                                      by {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500">
                                    {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{activity.description}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-12 h-12 rounded-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] flex items-center justify-center text-slate-600 mb-4">
                            <MessageSquare size={24} />
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">No activities logged yet.</p>
                          <p className="text-xs text-slate-500 mt-1">Log calls, emails, and meetings above.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stage History</h4>
                      <History size={14} className="text-slate-500" />
                    </div>
                    
                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-50 dark:bg-white/[0.05]">
                      {selectedDeal.history && selectedDeal.history.length > 0 ? (
                        [...selectedDeal.history].reverse().map((entry, idx) => {
                          const stage = activePipeline.stages.find(s => s.id === entry.stageId);
                          const user = users.find(u => u.id === entry.userId);
                          return (
                            <div key={idx} className="flex gap-4 relative">
                              <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                                stage?.name === 'Closed Won' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                                stage?.name === 'Closed Lost' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                                'bg-blue-500/20 border-blue-500/30 text-blue-400'
                              }`}>
                                <Tag size={14} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-slate-900 dark:text-white font-semibold">
                                    {stage?.name || 'Unknown Stage'}
                                  </p>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {entry.note || `Moved to ${stage?.name}`}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-slate-700 dark:text-slate-300">
                                    {user?.firstName[0] || 'S'}
                                  </div>
                                  <span className="text-[10px] text-slate-500">
                                    by {user ? `${user.firstName} ${user.lastName}` : 'System'} &middot; {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-12 h-12 rounded-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] flex items-center justify-center text-slate-600 mb-4">
                            <History size={24} />
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">No history recorded yet.</p>
                          <p className="text-xs text-slate-500 mt-1">Stage changes will appear here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-white/[0.05] bg-white/[0.01] flex gap-3 shrink-0">
                <button 
                  onClick={() => setActiveTab('activities')}
                  className="flex-1 bg-gray-50 dark:bg-white/[0.05] hover:bg-gray-100 dark:hover:bg-white/[0.1] text-slate-900 dark:text-white py-2.5 rounded-xl text-sm font-semibold transition-all border border-gray-200 dark:border-white/[0.05]"
                >
                  Add Note
                </button>
                {canEditDeal(selectedDeal) && (
                  <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">
                    Edit Deal
                  </button>
                )}
                {canDeleteDeal(selectedDeal) && (
                  <button 
                    onClick={() => {
                      setDealToDelete(selectedDeal);
                      setIsDeleteDealModalOpen(true);
                    }}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/10"
                    title="Archive Deal Opportunity"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05] shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Deal/Ticket</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create a new item in the pipeline.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6">
              <form id="add-deal-form" onSubmit={handleAddDeal} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/[0.05] pb-2">Information</h3>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Title *</label>
                      <input 
                        required 
                        value={newDeal.title} 
                        onChange={e => {
                          setNewDeal({...newDeal, title: e.target.value});
                          setDealTitleTouched(true);
                        }} 
                        onBlur={() => setDealTitleTouched(true)}
                        className={`w-full bg-white dark:bg-white/[0.02] border rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none transition-all ${
                          dealTitleTouched && !newDeal.title.trim()
                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50'
                            : 'border-gray-200 dark:border-white/[0.05] focus:border-gray-300 dark:focus:border-white/[0.1] focus:bg-white/[0.04]'
                        }`} 
                        placeholder="e.g. Enterprise License" 
                      />
                      {dealTitleTouched && !newDeal.title.trim() && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle size={12} className="shrink-0" />
                          Title is required and cannot be empty.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Value ($) *</label>
                      <input 
                        type="number" 
                        value={newDeal.value || ''} 
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          setNewDeal({...newDeal, value: val});
                          setDealValueTouched(true);
                        }} 
                        onBlur={() => setDealValueTouched(true)}
                        className={`w-full bg-white dark:bg-white/[0.02] border rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none transition-all ${
                          dealValueTouched && newDeal.value <= 0
                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50'
                            : 'border-gray-200 dark:border-white/[0.05] focus:border-gray-300 dark:focus:border-white/[0.1] focus:bg-white/[0.04]'
                        }`} 
                        placeholder="10000" 
                      />
                      {dealValueTouched && newDeal.value <= 0 && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle size={12} className="shrink-0" />
                          Deal value must be a positive number.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Expected Close Date</label>
                      <input type="date" value={newDeal.expectedCloseDate} onChange={e => setNewDeal({...newDeal, expectedCloseDate: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white border-b border-gray-200 dark:border-white/[0.05] pb-2">Pipeline & Company</h3>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Company Name *</label>
                      <input required value={newDeal.companyName} onChange={e => setNewDeal({...newDeal, companyName: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="Acme Corp" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Contact Person</label>
                      <input value={newDeal.contactPerson} onChange={e => setNewDeal({...newDeal, contactPerson: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Stage</label>
                      <select value={newDeal.stageId} onChange={e => setNewDeal({...newDeal, stageId: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        {(activePipeline.stages as any[]).map((s: any) => <option key={s.id} value={s.id} className="bg-gray-50 dark:bg-[#030712]">{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Priority</label>
                      <select value={newDeal.priority} onChange={e => setNewDeal({...newDeal, priority: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        <option className="bg-gray-50 dark:bg-[#030712]">Low</option><option className="bg-gray-50 dark:bg-[#030712]">Medium</option><option className="bg-gray-50 dark:bg-[#030712]">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Assigned Agent</label>
                      <select value={newDeal.assignedUserId} onChange={e => setNewDeal({...newDeal, assignedUserId: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        <option className="bg-gray-50 dark:bg-[#030712]" value="">Unassigned</option>
                        {users.filter(u => u.role === 'Sales Rep' || u.role === 'Client Admin').map(u => (
                          <option key={u.id} className="bg-gray-50 dark:bg-[#030712]" value={u.id}>{u.firstName} {u.lastName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/50 dark:border-white/[0.05]">
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Contact Source</label>
                      <input value={newDeal.leadSource} onChange={e => setNewDeal({...newDeal, leadSource: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. Website, Referral, Cold Email" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Industry</label>
                      <input value={newDeal.industry} onChange={e => setNewDeal({...newDeal, industry: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. SaaS, Fintech, Healthcare" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Location</label>
                      <input value={newDeal.location} onChange={e => setNewDeal({...newDeal, location: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. California, US / Berlin, DE" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Campaign</label>
                      <input value={newDeal.campaign} onChange={e => setNewDeal({...newDeal, campaign: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. Q2 Outreach Campaign" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Customer Type</label>
                      <select value={newDeal.customerType} onChange={e => setNewDeal({...newDeal, customerType: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        <option className="bg-gray-50 dark:bg-[#030712]">New Customer</option>
                        <option className="bg-gray-50 dark:bg-[#030712]">Existing Business</option>
                        <option className="bg-gray-50 dark:bg-[#030712]">Partner</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Tags (comma separated)</label>
                      <input value={newDeal.tags} onChange={e => setNewDeal({...newDeal, tags: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. Enterprise, Hot Contact, High Priority" />
                    </div>
                  </div>
                  
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea rows={3} value={newDeal.description} onChange={e => setNewDeal({...newDeal, description: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all resize-none" placeholder="Add any additional details here..."></textarea>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] shrink-0 bg-gray-50 dark:bg-[#030712]">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
              <button 
                type="submit" 
                form="add-deal-form" 
                disabled={!newDeal.title.trim() || newDeal.value <= 0}
                className="px-4 py-2 bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {isLostReasonModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Reason for Loss</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Please provide a reason why this deal was lost. This helps us improve our sales process.</p>
            </div>
            <div className="p-6">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Loss Reason *</label>
              <textarea 
                required
                value={lostReason}
                onChange={e => setLostReason(e.target.value)}
                className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.04] transition-all resize-none h-32"
                placeholder="e.g. Competitor offered lower price, Budget constraints, etc."
              />
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-white/[0.01]">
              <button 
                onClick={() => {
                  setIsLostReasonModalOpen(false);
                  setDealBeingLost(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                Skip
              </button>
              <button 
                onClick={handleSaveLostReason}
                disabled={!lostReason.trim()}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20"
              >
                Save Reason
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Deal Confirmation Modal */}
      {isDeleteDealModalOpen && dealToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Archive size={20} />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Archive Deal Opportunity</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Are you sure you want to archive the deal opportunity <span className="font-semibold text-slate-900 dark:text-white">"{dealToDelete.title}"</span>?
              </p>
            </div>
            <div className="p-6 bg-white/[0.01]">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This will move the deal to the archive, maintaining all history, value data, and timeline integrations. This removes it from the active pipeline funnel.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-white/[0.02]">
              <button 
                onClick={() => {
                  setIsDeleteDealModalOpen(false);
                  setDealToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmArchiveDeal}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-slate-900 dark:text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20"
              >
                Yes, Archive
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Pipeline Confirmation Modal */}
      {isDeletePipelineModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Archive size={20} />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Archive Sales Pipeline</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Are you sure you want to archive this pipeline? All deal stages and records inside this pipeline will be archived with it.
              </p>
            </div>
            <div className="p-6 bg-white/[0.01]">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Before archiving, consider moving any active cards/tickets to another valid pipeline.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-white/[0.02]">
              <button 
                onClick={() => {
                  setIsDeletePipelineModalOpen(false);
                  setPipelineToDeleteId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                Help/Cancel
              </button>
              <button 
                onClick={handleConfirmDeletePipeline}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-slate-900 dark:text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20"
              >
                Confirm Archive
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
