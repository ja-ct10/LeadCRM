'use client';

import { uuid } from '@/lib/utils';

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
  LayoutGrid, Table, List, SlidersHorizontal, RotateCcw, Check, Archive,
  Briefcase, HeadphonesIcon, RefreshCw, UserCheck, Zap
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  useDroppable,
  type CollisionDetection,
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
import { DealDetailsModal } from './deal-details-modal';
import { HandoffModal } from './handoff-modal';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from '@/shared/components/charts/ChartComponents';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import EmptyState from '@/shared/components/empty-state';
import ForecastBar from './forecast-bar';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

interface SortableDealCardProps {
  key?: any;
  deal: any;
  assignedUser?: any;
  onClick: (deal: any) => void;
  canDrag?: boolean;
  isAutomatedOnly?: boolean;
}

const DealCardContent = ({ deal, assignedUser, canDrag = false, isAutomatedOnly = false, attributes, listeners, isDragOverlay = false }: any) => {
  // Use lastStageChangeDate if available, fall back to updatedAt then createdAt
  const stageDateStr = deal.lastStageChangeDate || deal.updatedAt || deal.createdAt || Date.now();
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(stageDateStr).getTime()) / (1000 * 3600 * 24));
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
            ₱{deal.value.toLocaleString()}
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
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 1,
    cursor: isDragging ? 'grabbing' : 'pointer',
  };

  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(deal.lastStageChangeDate || deal.updatedAt || deal.createdAt || Date.now()).getTime()) / (1000 * 3600 * 24));
  const isRotting = daysSinceUpdate >= 14;
  const isAging = daysSinceUpdate >= 7 && daysSinceUpdate < 14;

  let borderStyle = 'border-slate-200 dark:border-white/[0.05] hover:border-blue-500/40';
  
  if (isRotting) {
    borderStyle = 'border-red-300 dark:border-red-500/30 bg-red-50/10 dark:bg-red-500/5 hover:border-red-400 dark:hover:border-red-500/50';
  } else if (isAging) {
    borderStyle = 'border-amber-300 dark:border-amber-500/30 bg-amber-50/10 dark:bg-amber-500/5 hover:border-amber-400 dark:hover:border-amber-500/50';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(deal)}
      className={`p-4 rounded-xl border transition-colors cursor-pointer group relative select-none ${
        isDragging 
          ? 'border-blue-500/50 bg-blue-500/5 ring-2 ring-blue-500/20 shadow-2xl' 
          : `${isRotting || isAging ? '' : 'bg-white dark:bg-slate-950'} ${borderStyle} shadow-sm hover:shadow-md`
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
    </div>
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
      className={`w-80 flex flex-col bg-white dark:bg-white/[0.02] rounded-2xl border flex-shrink-0 max-h-full backdrop-blur-sm transition-all duration-200 ${
        isOver 
          ? 'border-blue-500/60 bg-blue-500/[0.08] shadow-[0_0_30px_rgba(59,130,246,0.2)] scale-[1.02] z-10 ring-2 ring-blue-500/30' 
          : isDraggingAny
            ? 'border-blue-500/20 bg-blue-500/[0.02]'
            : 'border-gray-200 dark:border-white/[0.05]'
      }`}
    >
      <div className="p-4 flex justify-between items-start">
        <div className="flex items-center gap-2">
          {stage.color && (
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} aria-hidden="true" />
          )}
          <div>
            <h3 className={`font-semibold text-base transition-colors ${isOver ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
              {stage.name}
            </h3>
            {stageValue > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">₱{stageValue.toLocaleString()}</p>
            )}
          </div>
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

// ── Pipeline Templates ────────────────────────────────────────────────────────
// Stage badge Tailwind classes — keyed by stage color hex so we avoid inline style={{}}
const STAGE_BADGE_CLASSES: Record<string, string> = {
  '#6366f1': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400',
  '#8b5cf6': 'bg-violet-500/10 border-violet-500/30 text-violet-500 dark:text-violet-400',
  '#0ea5e9': 'bg-sky-500/10 border-sky-500/30 text-sky-500 dark:text-sky-400',
  '#3b82f6': 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400',
  '#f59e0b': 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400',
  '#10b981': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400',
  '#ef4444': 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400',
};
const DEFAULT_STAGE_BADGE = 'bg-slate-500/10 border-slate-500/30 text-slate-500 dark:text-slate-400';

interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accentColor: string;
  stages: Array<{
    name: string;
    order: number;
    probability: number;
    color: string;
    isDefault?: boolean;
    isWon?: boolean;
    isLost?: boolean;
  }>;
}

const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'inquiry',
    name: 'Inquiry / Sales Pipeline',
    description: 'Classic B2B sales flow from first inquiry to closed deal. Ideal for IT, Telecom & consulting services.',
    icon: <Briefcase size={20} />,
    color: 'bg-blue-500/10 border-blue-500/20',
    accentColor: 'text-blue-500',
    stages: [
      { name: 'New Inquiry',       order: 1, probability: 10,  color: '#6366f1', isDefault: true },
      { name: 'Contacted',         order: 2, probability: 20,  color: '#8b5cf6' },
      { name: 'Qualified',         order: 3, probability: 40,  color: '#0ea5e9' },
      { name: 'Demo / Meeting',    order: 4, probability: 55,  color: '#3b82f6' },
      { name: 'Proposal Sent',     order: 5, probability: 70,  color: '#f59e0b' },
      { name: 'Negotiation',       order: 6, probability: 85,  color: '#f97316' },
      { name: 'Closed Won',        order: 7, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed Lost',       order: 8, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'it-telecom',
    name: 'IT / Telecom Sales',
    description: 'Tailored for IT services and telecom deals — includes technical evaluation and procurement stages common in enterprise B2B.',
    icon: <Layers size={20} />,
    color: 'bg-sky-500/10 border-sky-500/20',
    accentColor: 'text-sky-500',
    stages: [
      { name: 'Lead Identified',   order: 1, probability: 10,  color: '#6366f1', isDefault: true },
      { name: 'Discovery Call',    order: 2, probability: 25,  color: '#8b5cf6' },
      { name: 'Technical Eval',    order: 3, probability: 40,  color: '#0ea5e9' },
      { name: 'Proposal / RFP',    order: 4, probability: 55,  color: '#3b82f6' },
      { name: 'Procurement',       order: 5, probability: 70,  color: '#f59e0b' },
      { name: 'Contract Review',   order: 6, probability: 85,  color: '#f97316' },
      { name: 'Closed Won',        order: 7, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed Lost',       order: 8, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'onboarding',
    name: 'Customer Onboarding',
    description: 'Track new customers through welcome, setup, training, and go-live. Activate after a deal is won.',
    icon: <UserCheck size={20} />,
    color: 'bg-emerald-500/10 border-emerald-500/20',
    accentColor: 'text-emerald-500',
    stages: [
      { name: 'Welcome & Kickoff',   order: 1, probability: 100, color: '#6366f1', isDefault: true },
      { name: 'Requirements Gather', order: 2, probability: 100, color: '#8b5cf6' },
      { name: 'Setup & Config',      order: 3, probability: 100, color: '#0ea5e9' },
      { name: 'User Training',       order: 4, probability: 100, color: '#3b82f6' },
      { name: 'UAT / Sign-off',      order: 5, probability: 100, color: '#f59e0b' },
      { name: 'Go Live',             order: 6, probability: 100, color: '#10b981', isWon: true },
      { name: 'Cancelled',           order: 7, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'support',
    name: 'Service & Support',
    description: 'Manage service tickets, support cases, and issue resolution from open to closed.',
    icon: <HeadphonesIcon size={20} />,
    color: 'bg-amber-500/10 border-amber-500/20',
    accentColor: 'text-amber-500',
    stages: [
      { name: 'Ticket Opened',   order: 1, probability: 10,  color: '#6366f1', isDefault: true },
      { name: 'Triaged',         order: 2, probability: 25,  color: '#8b5cf6' },
      { name: 'In Progress',     order: 3, probability: 50,  color: '#0ea5e9' },
      { name: 'Awaiting Client', order: 4, probability: 60,  color: '#f59e0b' },
      { name: 'Testing / QA',    order: 5, probability: 80,  color: '#3b82f6' },
      { name: 'Resolved',        order: 6, probability: 100, color: '#10b981', isWon: true },
      { name: 'Unresolved',      order: 7, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'renewal',
    name: 'Renewal & Upsell',
    description: 'Track subscription renewals, contract expansions, and upsell opportunities with existing clients.',
    icon: <RefreshCw size={20} />,
    color: 'bg-purple-500/10 border-purple-500/20',
    accentColor: 'text-purple-500',
    stages: [
      { name: 'Renewal Due',        order: 1, probability: 40,  color: '#6366f1', isDefault: true },
      { name: 'Review Scheduled',   order: 2, probability: 55,  color: '#8b5cf6' },
      { name: 'Upsell Proposed',    order: 3, probability: 65,  color: '#0ea5e9' },
      { name: 'Negotiating Terms',  order: 4, probability: 80,  color: '#f59e0b' },
      { name: 'Contract Sent',      order: 5, probability: 90,  color: '#3b82f6' },
      { name: 'Renewed / Upsold',   order: 6, probability: 100, color: '#10b981', isWon: true },
      { name: 'Churned',            order: 7, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'custom',
    name: 'Blank / Custom',
    description: 'Start with a clean slate and build your own stages from scratch.',
    icon: <Zap size={20} />,
    color: 'bg-slate-500/10 border-slate-500/20',
    accentColor: 'text-slate-400',
    stages: [
      { name: 'Stage 1', order: 1, probability: 10,  color: '#6366f1', isDefault: true },
      { name: 'Stage 2', order: 2, probability: 50,  color: '#3b82f6' },
      { name: 'Won',     order: 3, probability: 100, color: '#10b981', isWon: true },
      { name: 'Lost',    order: 4, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
];

export default function PipelinePage({ navigate }: { navigate: (path: string) => void }) {
  const { 
    pipelines, 
    deals, 
    updateDeal, 
    moveDealStage,
    addDeal, 
    addPipeline, 
    updatePipeline, 
    deletePipeline, 
    deleteDeal, 
    reorderDeals, 
    users,
    tasks,
    addTask,
    updateTask,
    isBillingModuleEnabled,
    roles 
  } = useData();
  const { user, tenant } = useAuth();
  const [activePipelineId, setActivePipelineId] = useState(pipelines[0]?.id || '');
  
  React.useEffect(() => {
    if (!activePipelineId && pipelines.length > 0) {
      setActivePipelineId(pipelines[0].id);
    }
  }, [pipelines, activePipelineId]);
  
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

  const [filterAddress, setFilterAddress] = useState<string>('');
  const [filterAddressOp, setFilterAddressOp] = useState<string>('contains');

  const [filterProductInterests, setFilterProductInterests] = useState<string>('');
  const [filterProductInterestsOp, setFilterProductInterestsOp] = useState<string>('contains');

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
    if (filterAddress.trim() !== '') count++;
    if (filterProductInterests.trim() !== '') count++;
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
    setFilterAddress('');
    setFilterAddressOp('contains');
    setFilterProductInterests('');
    setFilterProductInterestsOp('contains');
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

  // BW-6: handleTriggerStageAutomation removed — was simulated automation with hardcoded
  // strings and setInterval(450ms). Real automation runs through the workflow engine.
  // The isTransitioning state is kept for future real async operations.

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [pipelineModalStep, setPipelineModalStep] = useState<'template' | 'name'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('inquiry');
  const [isManagePipelinesModalOpen, setIsManagePipelinesModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  // Maps dealId → stageId for optimistic column position during drag
  // Cleared on dragEnd so the real data takes over after persistence
  const [optimisticStageMap, setOptimisticStageMap] = useState<Record<string, string>>({});
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [isDeleteDealModalOpen, setIsDeleteDealModalOpen] = useState(false);
  const [pipelineToDeleteId, setPipelineToDeleteId] = useState<string | null>(null);
  const [isDeletePipelineModalOpen, setIsDeletePipelineModalOpen] = useState(false);
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [dealBeingLost, setDealBeingLost] = useState<Deal | null>(null);
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);
  const [dealBeingWon, setDealBeingWon] = useState<Deal | null>(null);
  const [targetWonStageId, setTargetWonStageId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [newDeal, setNewDeal] = useState({
    title: '', companyName: '', contactPerson: '', value: 0, priority: 'Medium', expectedCloseDate: '', description: '', assignedUserId: '', stageId: '',
    leadSource: '', industry: '', address: '', productInterests: '', campaign: '', customerType: 'New Customer', tags: ''
  });
  const [dealTitleTouched, setDealTitleTouched] = useState(false);
  const [dealValueTouched, setDealValueTouched] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement before initiating drag — prevents accidental drags on click
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Custom collision detection for a multi-container kanban.
   *
   * Strategy (per dnd-kit best-practice for kanban boards):
   *  1. First, try pointerWithin — if the pointer is inside a droppable, use that.
   *     This gives accurate column-level targeting when dragging to an empty column.
   *  2. Fall back to rectIntersection — catches cases where the pointer exits a
   *     container boundary but the drag rect still overlaps a target.
   *  3. Fall back to closestCenter as a last resort so something always matches.
   *
   * This avoids the main `closestCorners` issue: on wide kanban columns, corners
   * can be geometrically closer to the wrong column, causing cards to jump columns
   * unexpectedly when dragging near edges.
   */
  const customCollisionDetection: CollisionDetection = React.useCallback((args) => {
    // Pointer-within check first (most accurate for column drops)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // Rect intersection fallback
    const intersections = rectIntersection(args);
    if (intersections.length > 0) return intersections;
    // Closest center as final fallback
    return closestCenter(args);
  }, []);

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
      // Build flag map from stage definitions — never use name substring matching
      const stageFlagMap: Record<string, { isWon: boolean; isLost: boolean }> = {};
      activePipeline?.stages.forEach((s: Stage) => {
        stageFlagMap[s.id] = { isWon: !!s.isWon, isLost: !!s.isLost };
      });
      result = result.filter(d => {
        const flags = stageFlagMap[d.stageId];
        const isWon  = flags?.isWon  ?? false;
        const isLost = flags?.isLost ?? false;
        if (filterStatus === 'won')  return isWon;
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

    // 9. Address (Operation Aware)
    if (filterAddress.trim()) {
      result = result.filter(d => matchStringFilter(d.address, filterAddress, filterAddressOp));
    }

    // 9.5. Product Interests (Operation Aware)
    if (filterProductInterests.trim()) {
      result = result.filter(d => {
        if (!d.productInterests || !Array.isArray(d.productInterests)) return false;
        return d.productInterests.some(pi => matchStringFilter(pi, filterProductInterests, filterProductInterestsOp));
      });
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
      result = result.filter(d => matchStringFilter(d.tags?.join(', '), filterTags, filterTagsOp));
    }

    // 14. Priority
    if (filterPriority.length > 0) {
      result = result.filter(d => filterPriority.includes(d.priority));
    }

    return result;
  }, [
    allPipelineDeals, 
    activePipeline,  // Added: needed for stage flag lookup in filterStatus
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
    filterAddress, 
    filterAddressOp,
    filterProductInterests,
    filterProductInterestsOp,
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
      }
      // UX-1 fix: when no history data exists, show 0 — never fabricated averages.
      // Empty velocity states are honest; measured data appears once stage transitions
      // start flowing through the governed path (moveDealStage).

      if (avgDays < 0.2 && dealVisitCount > 0) avgDays = 0.2;

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

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDeal) return;

    const isTitleInvalid = !newDeal.title.trim();
    const isValueInvalid = newDeal.value <= 1e-9;

    if (isTitleInvalid || isValueInvalid) {
      setDealTitleTouched(true);
      setDealValueTouched(true);
      return;
    }

    try {
      await addDeal({ 
        ...newDeal, 
        productInterests: newDeal.productInterests ? newDeal.productInterests.split(',').map(s => s.trim()).filter(Boolean) : [],
        pipelineId: activePipelineId,
        order: deals.filter(d => d.pipelineId === activePipelineId && d.stageId === newDeal.stageId).length
      } as any);
      toast.success("Deal created successfully");
      setIsModalOpen(false);
      setNewDeal({ 
        title: '', companyName: '', contactPerson: '', value: 0, priority: 'Medium', expectedCloseDate: '', description: '', assignedUserId: '', stageId: '',
        leadSource: '', industry: '', address: '', productInterests: '', campaign: '', customerType: 'New Customer', tags: ''
      });
      setDealTitleTouched(false);
      setDealValueTouched(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create deal");
    }
  };

  const handleAddPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName.trim()) return;

    const template = PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId) ?? PIPELINE_TEMPLATES[0];
    const templateStages: Stage[] = template.stages.map(s => ({
      id: uuid(),
      name: s.name,
      order: s.order,
      probability: s.probability,
      color: s.color,
      isDefault: s.isDefault ?? false,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
    }));

    try {
      await addPipeline({ name: newPipelineName.trim(), stages: templateStages });
      setIsPipelineModalOpen(false);
      setPipelineModalStep('template');
      setSelectedTemplateId('inquiry');
      setNewPipelineName('');
      toast.success("Pipeline created successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create pipeline");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isAutomatedOnly) return;
    const { active } = event;
    const deal = deals.find(d => d.id === active.id);
    if (deal && canEditDeal(deal)) {
      setActiveDeal(deal);
      // Clear any previous optimistic state
      setOptimisticStageMap({});
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (isAutomatedOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId   = String(over.id);

    const dragged = deals.find(d => d.id === activeId);
    if (!dragged || !canEditDeal(dragged)) return;

    // Resolve the target stage from either a stage droppable or a card in that stage
    let targetStageId: string | null = null;

    // First check if hovering over a stage column itself
    const stageMatch = activePipeline?.stages.find((s: Stage) => s.id === overId);
    if (stageMatch) {
      targetStageId = stageMatch.id;
    } else {
      // Otherwise check if hovering over a deal card in a different column
      const overDeal = deals.find(d => d.id === overId);
      if (overDeal && overDeal.stageId !== dragged.stageId) {
        targetStageId = overDeal.stageId;
      }
    }

    // Apply optimistic update if target stage is different
    if (targetStageId && targetStageId !== dragged.stageId) {
      // Skip terminal stages — those open modals in dragEnd, not during drag
      const targetStage = activePipeline?.stages.find((s: Stage) => s.id === targetStageId);
      if (targetStage?.isWon || targetStage?.isLost) return;
      
      // Update optimistic map to show card in new column during drag
      setOptimisticStageMap(prev => {
        // Only update if different from current optimistic state
        if (prev[activeId] !== targetStageId) {
          return { ...prev, [activeId]: targetStageId! };
        }
        return prev;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isAutomatedOnly) return;
    const { active, over } = event;
    
    const activeId = active.id;
    const activeDeal = deals.find(d => d.id === activeId);
    
    // Capture the optimistic target stage BEFORE clearing state
    const optimisticTargetStage = activeDeal && optimisticStageMap[String(activeId)] 
      ? optimisticStageMap[String(activeId)]
      : null;
    
    setActiveDeal(null);
    setOptimisticStageMap({});

    if (!over) {
      console.log('[Pipeline DnD] Drop cancelled - no target');
      return;
    }

    const overId = over.id;

    if (!activeDeal || !canEditDeal(activeDeal)) {
      console.log('[Pipeline DnD] Drop rejected - no deal or no permission');
      return;
    }

    console.log('[Pipeline DnD] Dropping deal:', {
      dealId: activeId,
      dealTitle: activeDeal.title,
      currentStage: activeDeal.stageId,
      targetId: overId,
      optimisticTargetStage,
    });

    // If dropped on itself AND we have an optimistic target, use that instead
    if (activeId === overId && optimisticTargetStage && optimisticTargetStage !== activeDeal.stageId) {
      console.log('[Pipeline DnD] Dropped on self but using optimistic target:', optimisticTargetStage);
      const targetStage = activePipeline?.stages.find(s => s.id === optimisticTargetStage);
      if (targetStage) {
        // Handle terminal stages
        if (targetStage.isLost || targetStage.name === 'Closed Lost') {
          setDealBeingLost(activeDeal);
          setIsLostReasonModalOpen(true);
          setLostReason('');
          return;
        }
        if (targetStage.isWon || targetStage.name === 'Closed Won') {
          setDealBeingWon(activeDeal);
          setTargetWonStageId(targetStage.id);
          setIsHandoffModalOpen(true);
          return;
        }
        // Move to the optimistic target stage
        moveDealStage(String(activeId), optimisticTargetStage)
          .then(() => {
            const stageName = targetStage.name;
            toast.success(`Deal moved to ${stageName}`);
          })
          .catch((err: unknown) => {
            console.error('[Pipeline DnD] moveDealStage failed (optimistic):', err);
            toast.error(err instanceof Error ? err.message : 'Failed to move deal');
          });
        return;
      }
    }

    // If dropped on itself with no stage change, do nothing
    if (activeId === overId) {
      console.log('[Pipeline DnD] Dropped on self - no action');
      return;
    }

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
      const firstStage = targetPipeline.stages[0];
      if (!firstStage?.id) {
        toast.error('Target pipeline has no stages.');
        return;
      }
      // Cross-pipeline move: update pipeline first, then use moveDealStage for the stage change
      // Since pipelineId is no longer in UpdateDealSchema, we handle this as a special case
      // The backend moveDealStage already handles the deal update, so we call it directly
      moveDealStage(String(activeId), firstStage.id)
        .then(() => {
          toast.success(`Deal moved to ${targetPipeline.name} pipeline`);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Failed to move deal to new pipeline');
        });
      setActivePipelineId(targetPipeline.id);
      return;
    }

    // 2. Handle dropping on a stage column (Empty area or column header)
    const overStage = activePipeline?.stages.find(s => s.id === targetStageId);
    if (overStage) {
      // Special case: Closed Lost prompt
      if (overStage.isLost || overStage.name === 'Closed Lost') {
        setDealBeingLost(activeDeal);
        setIsLostReasonModalOpen(true);
        setLostReason('');
        return;
      }
      
      // Special case: Closed Won prompt (Handoff)
      if (overStage.isWon || overStage.name === 'Closed Won') {
        setDealBeingWon(activeDeal);
        setTargetWonStageId(overStage.id);
        setIsHandoffModalOpen(true);
        return;
      }
      
      // DI-1 fix: ALL stage changes route through moveDealStage — never updateDeal
      if (activeDeal.stageId !== targetStageId) {
        // Client-side requiredFields pre-check (REQ089) — immediate feedback before API call
        if (overStage.requiredFields && overStage.requiredFields.length > 0) {
          const missing = overStage.requiredFields.filter(field => {
            const val = (activeDeal as unknown as Record<string, unknown>)[field];
            return val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
          });
          if (missing.length > 0) {
            toast.error(`Cannot move to "${overStage.name}": missing ${missing.join(', ')}`);
            return;
          }
        }

        moveDealStage(String(activeId), String(targetStageId))
          .then(() => {
            toast.success(`Deal moved to ${overStage.name}`);
          })
          .catch((err: unknown) => {
            console.error('[Pipeline DnD] moveDealStage failed:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to move deal');
          });
      }

      // Handle swimlane property changes (priority, client) separately — these are NOT stage changes
      if (targetSwimlaneVal) {
        const swimlaneUpdates: Partial<Deal> = {};
        if (swimlaneBy === 'priority' && activeDeal.priority !== targetSwimlaneVal) {
          swimlaneUpdates.priority = targetSwimlaneVal as any;
        } else if (swimlaneBy === 'client' && activeDeal.companyName !== targetSwimlaneVal) {
          swimlaneUpdates.companyName = targetSwimlaneVal === 'General / Unassigned' ? '' : targetSwimlaneVal;
        }
        if (Object.keys(swimlaneUpdates).length > 0) {
          updateDeal(String(activeId), swimlaneUpdates).catch(console.error);
        }
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
          updateDeal(String(activeId), updates).catch(console.error);
        }
      } else {
        // Dropped on a deal in a different stage — this IS a stage change
        if (overStage?.isLost || overStage?.name === 'Closed Lost') {
          setDealBeingLost(activeDeal);
          setIsLostReasonModalOpen(true);
          setLostReason('');
          return;
        }
        
        if (overStage?.isWon || overStage?.name === 'Closed Won') {
          setDealBeingWon(activeDeal);
          setTargetWonStageId(overStage.id);
          setIsHandoffModalOpen(true);
          return;
        }

        // DI-1 fix: route through moveDealStage for cross-stage drops
        // Client-side requiredFields pre-check (REQ089)
        if (overStage?.requiredFields && overStage.requiredFields.length > 0) {
          const missing = overStage.requiredFields.filter(field => {
            const val = (activeDeal as unknown as Record<string, unknown>)[field];
            return val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
          });
          if (missing.length > 0) {
            toast.error(`Cannot move to "${overStage.name}": missing ${missing.join(', ')}`);
            return;
          }
        }

        moveDealStage(String(activeId), overStageId)
          .then(() => {
            toast.success(`Deal moved to ${overStage?.name}`);
          })
          .catch((err: unknown) => {
            console.error('[Pipeline DnD] moveDealStage failed (cross-deal drop):', err);
            toast.error(err instanceof Error ? err.message : 'Failed to move deal');
          });

        // Swimlane property changes are separate from stage changes
        if (Object.keys(updates).length > 0) {
          updateDeal(String(activeId), updates).catch(console.error);
        }
      }
    }
  };

  const handleSaveLostReason = async () => {
    if (dealBeingLost) {
      // Look up the real lost stage using isLost flag first, name as display fallback only
      const dealPipeline = pipelines.find(p => p.id === dealBeingLost.pipelineId) ?? activePipeline;
      const lostStage = dealPipeline?.stages.find(
        s => s.isLost
      ) ?? dealPipeline?.stages.find(s => s.name === 'Closed Lost');
      if (!lostStage) {
        toast.error("No lost stage found in this pipeline.");
        return;
      }
      try {
        await moveDealStage(dealBeingLost.id, lostStage.id, undefined, lostReason);
        setIsLostReasonModalOpen(false);
        setDealBeingLost(null);
        setLostReason('');
        toast.success("Deal marked as lost");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update deal");
      }
    }
  };

  const handleConfirmHandoff = async (payload: { handoff: any }) => {
    if (dealBeingWon && targetWonStageId) {
      try {
        await moveDealStage(dealBeingWon.id, targetWonStageId, undefined, undefined, payload.handoff);
        toast.success(`Deal won! ${dealBeingWon.companyName || dealBeingWon.title} is now a customer.`);
        if (payload.handoff.createServiceOrder) {
          toast.success('Service Order created for onboarding.');
        }
      } catch (error) {
        toast.error('Failed to move deal to won stage');
      }
    }
    setIsHandoffModalOpen(false);
    setDealBeingWon(null);
    setTargetWonStageId(null);
  };

  const handleUpdatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPipeline) return;
    try {
      await updatePipeline(editingPipeline.id, editingPipeline);
      setEditingPipeline(null);
      toast.success("Pipeline updated successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update pipeline");
    }
  };

  const handleDeletePipeline = (id: string) => {
    if (pipelines.length <= 1) {
      toast.error('You must have at least one pipeline.');
      return;
    }
    setPipelineToDeleteId(id);
    setIsDeletePipelineModalOpen(true);
  };

  const handleConfirmDeletePipeline = async () => {
    if (pipelineToDeleteId) {
      try {
        await deletePipeline(pipelineToDeleteId);
        if (activePipelineId === pipelineToDeleteId) {
          setActivePipelineId(pipelines.find(p => p.id !== pipelineToDeleteId)?.id || '');
        }
        setIsDeletePipelineModalOpen(false);
        setPipelineToDeleteId(null);
        toast.success('Pipeline archived successfully.');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to archive pipeline");
      }
    }
  };

  const handleConfirmArchiveDeal = async () => {
    if (dealToDelete) {
      try {
        await deleteDeal(dealToDelete.id);
        setSelectedDealId(null);
        setIsDeleteDealModalOpen(false);
        setDealToDelete(null);
        toast.success('Deal archived successfully.');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to archive deal");
      }
    }
  };



  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full flex flex-col relative overflow-hidden"
    >
      {/* ── Redesigned Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[28px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-tight">
            Deals
          </h1>
          <p className="text-[13px] text-[#5A6B85] dark:text-slate-400 mt-0.5">
            One workspace for the pipeline board, deal table and weighted forecast.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pipeline Selector */}
          {pipelines.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-[#5A6B85] dark:text-slate-400">Pipeline</span>
              <select
                value={activePipelineId}
                onChange={(e) => setActivePipelineId(e.target.value)}
                className="h-9 px-3 pr-8 text-[13px] font-semibold text-[#0F172A] dark:text-white bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235A6B85\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat' }}
              >
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* New Pipeline */}
          {canManagePipelines && (
            <button
              onClick={() => {
                setPipelineModalStep('template');
                setSelectedTemplateId('inquiry');
                setNewPipelineName('');
                setIsPipelineModalOpen(true);
              }}
              title="Create New Pipeline"
              className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Pipeline</span>
            </button>
          )}

          {/* Manage Pipelines */}
          {canManagePipelines && (
            <button
              onClick={() => setIsManagePipelinesModalOpen(true)}
              title="Manage Pipelines"
              aria-label="Manage Pipelines"
              className="h-9 w-9 flex items-center justify-center text-[#5A6B85] dark:text-slate-400 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Settings size={15} />
            </button>
          )}

          {/* Import */}
          <button className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Import
          </button>

          {/* New Deal */}
          {canCreateDeal && activePipeline && (
            <button
              onClick={() => {
                setNewDeal({ ...newDeal, stageId: activePipeline?.stages?.[0]?.id || '' });
                setDealTitleTouched(false);
                setDealValueTouched(false);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors shadow-sm"
            >
              <Plus size={14} /> New Deal
              <ChevronDown size={13} className="ml-0.5 opacity-60" />
            </button>
          )}
        </div>
      </div>

      {/* ── Saved View Tabs ───────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-3 border-b border-[#E4E9F0] dark:border-slate-700">
        <button className="px-3 py-2 text-[13px] font-medium text-[#2563EB] dark:text-blue-400 relative">
          All Deals
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB] dark:bg-blue-400 rounded-full" />
        </button>
        <button className="px-3 py-2 text-[13px] font-medium text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white transition-colors">
          My Deals
        </button>
        <button className="px-2 py-2 text-[#5A6B85] hover:text-[#0F172A] dark:hover:text-white transition-colors">
          <span className="text-lg leading-none">···</span>
        </button>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Filter Toggle */}
        <button
          onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-lg border transition-colors ${
            isFilterPanelOpen
              ? 'bg-[#2563EB] text-white border-[#2563EB]'
              : 'bg-white dark:bg-slate-800 text-[#5A6B85] dark:text-slate-300 border-[#E4E9F0] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <SlidersHorizontal size={13} />
          Filter
        </button>

        {/* Sort */}
        <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#5A6B85] dark:text-slate-300 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <ArrowRight size={13} className="rotate-90" />
          Sort
        </button>

        {/* View Switcher */}
        <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => handleViewModeChange('kanban')}
            title="Kanban View"
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'}`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => handleViewModeChange('list')}
            title="List View"
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'}`}
          >
            <List size={15} />
          </button>
          <button
            onClick={() => handleViewModeChange('table')}
            title="Table View"
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'}`}
          >
            <Table size={15} />
          </button>
        </div>

        {/* Automation Mode */}
        <button
          type="button"
          onClick={toggleAutomatedOnly}
          aria-label={isAutomatedOnly ? 'Automation Mode: Active' : 'Automation Mode: Off'}
          className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
            isAutomatedOnly
              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-200 dark:border-blue-800/60'
              : 'bg-white dark:bg-slate-800 border-[#E4E9F0] dark:border-slate-700 text-[#5A6B85] hover:bg-slate-50'
          }`}
        >
          <Shield size={13} />
        </button>

        {/* Refresh */}
        <button className="p-1.5 text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Refresh">
          <RotateCcw size={15} />
        </button>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals..."
            className="h-8 w-48 lg:w-56 pl-8 pr-3 text-[12px] rounded-lg border border-[#E4E9F0] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 placeholder:text-[#5A6B85] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B85]" />
        </div>

        <button className="p-1.5 text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Manage columns">
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-1">OPEN PIPELINE</p>
          <p className="text-xl font-extrabold text-[#0F172A] dark:text-white tabular-nums">
            ${(() => {
              const openStages = activePipeline?.stages.filter((s: Stage) => !s.isWon && !s.isLost) ?? [];
              const openValue = pipelineDeals.filter(d => openStages.some((s: Stage) => s.id === d.stageId)).reduce((sum, d) => sum + (d.value ?? 0), 0);
              return openValue >= 1000000 ? `${(openValue / 1000000).toFixed(2)}M` : openValue >= 1000 ? `${Math.round(openValue / 1000)}k` : openValue.toLocaleString();
            })()}
          </p>
          <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 mt-0.5">{pipelineDeals.filter(d => { const s = activePipeline?.stages.find((st: Stage) => st.id === d.stageId); return s && !s.isWon && !s.isLost; }).length} deals</p>
        </div>
        <div className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-1">WEIGHTED FORECAST</p>
          <p className="text-xl font-extrabold text-[#0F172A] dark:text-white tabular-nums">
            ${(() => {
              const weighted = pipelineDeals.reduce((sum, d) => {
                const stage = activePipeline?.stages.find((s: Stage) => s.id === d.stageId);
                const prob = (stage?.probability ?? 50) / 100;
                return sum + ((d.value ?? 0) * prob);
              }, 0);
              return weighted >= 1000000 ? `${(weighted / 1000000).toFixed(2)}M` : weighted >= 1000 ? `${(weighted / 1000).toFixed(1)}k` : weighted.toLocaleString();
            })()}
          </p>
          <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 mt-0.5">Probability adjusted</p>
        </div>
        <div className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-1">WON THIS PERIOD</p>
          <p className="text-xl font-extrabold text-[#0F172A] dark:text-white tabular-nums">
            ${(() => {
              const wonStages = activePipeline?.stages.filter((s: Stage) => s.isWon) ?? [];
              const wonValue = pipelineDeals.filter(d => wonStages.some((s: Stage) => s.id === d.stageId)).reduce((sum, d) => sum + (d.value ?? 0), 0);
              return wonValue >= 1000000 ? `${(wonValue / 1000000).toFixed(2)}M` : wonValue >= 1000 ? `${(wonValue / 1000).toFixed(1)}k` : wonValue.toLocaleString();
            })()}
          </p>
          <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 mt-0.5">{pipelineDeals.filter(d => activePipeline?.stages.find((s: Stage) => s.id === d.stageId)?.isWon).length} closed won</p>
        </div>
        <div className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-1">AT RISK</p>
          <p className="text-xl font-extrabold text-[#0F172A] dark:text-white tabular-nums">
            {pipelineDeals.filter(d => {
              const stageDateStr = d.lastStageChangeDate || d.updatedAt || d.createdAt;
              if (!stageDateStr) return false;
              const daysSince = Math.floor((Date.now() - new Date(stageDateStr).getTime()) / (1000 * 3600 * 24));
              const stage = activePipeline?.stages.find((s: Stage) => s.id === d.stageId);
              return stage && !stage.isWon && !stage.isLost && daysSince >= (stage.rottenAfterDays ?? 14);
            }).length}
          </p>
          <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 mt-0.5">Past stage rotting limit</p>
        </div>
      </div>

      {/* ── Main Content (existing views below) ───────────────── */}
      <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden">

      {/* Manage Pipelines Modal */}
      {isManagePipelinesModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl max-h-[80vh]">
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
                                const newStage = { id: uuid(), name: 'New Stage', order: editingPipeline.stages.length };
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

      {/* New Pipeline Modal — Template Picker */}
      {isPipelineModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-white/[0.1] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05] shrink-0">
              <div>
                {pipelineModalStep === 'template' ? (
                  <>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Choose a Pipeline Template</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Pick a starting point — you can rename stages anytime.</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Name Your Pipeline</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Based on: <span className={`font-medium ${PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.accentColor}`}>
                        {PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.name}
                      </span>
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setIsPipelineModalOpen(false);
                  setPipelineModalStep('template');
                  setSelectedTemplateId('inquiry');
                  setNewPipelineName('');
                }}
                aria-label="Close modal"
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step 1 — Template grid */}
            {pipelineModalStep === 'template' && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[60vh] custom-scrollbar">
                {PIPELINE_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setNewPipelineName(tpl.id === 'custom' ? '' : tpl.name);
                      setPipelineModalStep('name');
                    }}
                    className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.01] active:scale-[0.99] group ${
                      selectedTemplateId === tpl.id
                        ? `${tpl.color} shadow-md`
                        : 'border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.1]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${tpl.accentColor}`}>
                        {tpl.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">{tpl.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">{tpl.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {tpl.stages.filter(s => !s.isLost).map(s => (
                            <span
                              key={s.name}
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STAGE_BADGE_CLASSES[s.color] ?? DEFAULT_STAGE_BADGE}`}
                            >
                              {s.isWon && <CheckCircle2 size={9} />}
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2 — Name it */}
            {pipelineModalStep === 'name' && (
              <div className="p-6 space-y-5">
                {/* Stage preview */}
                <div className="rounded-xl border border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.02] p-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Stages included</p>
                  <div className="flex flex-wrap gap-2">
                    {(PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.stages ?? []).map((s, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${STAGE_BADGE_CLASSES[s.color] ?? DEFAULT_STAGE_BADGE}`}
                        >
                          {s.isWon && <CheckCircle2 size={11} />}
                          {s.isLost && <X size={11} />}
                          {s.name}
                        </span>
                        {idx < (PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.stages.length ?? 0) - 1 && (
                          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <form id="add-pipeline-form" onSubmit={handleAddPipeline}>
                  <label htmlFor="pipeline-name-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Pipeline Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="pipeline-name-input"
                    required
                    value={newPipelineName}
                    onChange={e => setNewPipelineName(e.target.value)}
                    className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="e.g., Q4 Sales Pipeline"
                    autoFocus
                  />
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/[0.05] shrink-0 bg-gray-50 dark:bg-slate-950">
              {pipelineModalStep === 'name' ? (
                <button
                  type="button"
                  onClick={() => setPipelineModalStep('template')}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ChevronRight size={14} className="rotate-180" /> Back
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPipelineModalOpen(false);
                    setPipelineModalStep('template');
                    setSelectedTemplateId('inquiry');
                    setNewPipelineName('');
                  }}
                  className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                {pipelineModalStep === 'template' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewPipelineName(
                        selectedTemplateId === 'custom' ? '' : (PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.name ?? '')
                      );
                      setPipelineModalStep('name');
                    }}
                    className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Use Template →
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="add-pipeline-form"
                    className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Create Pipeline
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Conditional Rendering of Views: Kanban, Table, or List */}

      {/* Apply Template Banner — shown when pipeline has only generic/blank stages */}
      {(() => {
        const stages = activePipeline?.stages || [];
        const hasGenericStages = stages.length <= 2 || stages.every(s => /^stage\s*\d+$/i.test(s.name));
        const hasNoDeals = pipelineDeals.length === 0;
        if (!(hasGenericStages && hasNoDeals && canManagePipelines)) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-dashed border-blue-500/30 bg-blue-500/[0.04] dark:bg-blue-500/[0.06] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Layers size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">This pipeline has no stages set up yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Apply a ready-to-use template to get started in seconds — stages, probabilities, and flow included.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPipelineModalStep('template');
                  setSelectedTemplateId('inquiry');
                  setNewPipelineName('');
                  setIsPipelineModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <Rocket size={14} /> Browse Templates
              </button>
            </div>
          </motion.div>
        );
      })()}
      
      {viewMode === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {swimlaneBy === 'none' ? (
            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex gap-6 h-full min-w-max items-start">
                {(activePipeline?.stages || []).map((stage: any) => {
                  // Apply optimistic stage override for visual feedback during drag
                  const stageDeals = pipelineDeals
                    .map(d => optimisticStageMap[d.id] ? { ...d, stageId: optimisticStageMap[d.id] } : d)
                    .filter(d => d.stageId === stage.id);
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
                            <div className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-sm transition-all ${
                              !!activeDeal 
                                ? 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 font-medium' 
                                : 'border-gray-200 dark:border-white/[0.05] bg-white/[0.01] text-slate-500'
                            }`}>
                              {!!activeDeal ? '↓ Drop deal here' : 'No deals in this stage'}
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

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: '0.4' } },
              }),
            }}
          >
            {activeDeal ? (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border-2 border-blue-500/60 shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col gap-3 w-80 rotate-1 cursor-grabbing">
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
        <div className="bg-white dark:bg-slate-950/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
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
                            {isSorted ? (tableSortAsc ? '?' : '?') : '?'}
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
                        {deal.tags && deal.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(deal.tags)
                              ? deal.tags
                              : String(deal.tags).split(',')
                            ).map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                              <span key={t} className="bg-slate-100 dark:bg-white/[0.05] text-slate-500 text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded">
                                {t}
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
                className="group p-4 bg-white dark:bg-slate-950/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm hover:border-blue-500/30 transition-all cursor-pointer relative flex flex-col justify-between"
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

      {/* Quick-Action Side Panel (Drawer) — extracted to DealDetailsModal */}
      <AnimatePresence>
        {selectedDeal && (
          <DealDetailsModal
            deal={selectedDeal}
            pipeline={activePipeline!}
            users={users}
            tasks={tasks}
            currentUserId={user?.id || 'system'}
            canEdit={canEditDeal(selectedDeal)}
            canDelete={canDeleteDeal(selectedDeal)}
            isAutomatedOnly={isAutomatedOnly}
            isBillingModuleEnabled={isBillingModuleEnabled}
            isTransitioning={isTransitioning}
            onClose={() => setSelectedDealId(null)}
            onUpdateDeal={updateDeal}
            onDeleteDeal={(d) => { setDealToDelete(d); setIsDeleteDealModalOpen(true); }}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onMarkLost={(d) => { setDealBeingLost(d); setLostReason(''); setIsLostReasonModalOpen(true); }}
            onNavigate={navigate}
            tenantId={tenant?.id || ''}
            moveDealStage={(dealId, stageId) => moveDealStage(dealId, stageId)}
          />
        )}
      </AnimatePresence>

         {/* Add Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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
                        {(activePipeline?.stages as any[] || []).map((s: any) => <option key={s.id} value={s.id} className="bg-gray-50 dark:bg-slate-950">{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Priority</label>
                      <select value={newDeal.priority} onChange={e => setNewDeal({...newDeal, priority: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        <option className="bg-gray-50 dark:bg-slate-950">Low</option><option className="bg-gray-50 dark:bg-slate-950">Medium</option><option className="bg-gray-50 dark:bg-slate-950">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Assigned Agent</label>
                      <select value={newDeal.assignedUserId} onChange={e => setNewDeal({...newDeal, assignedUserId: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        <option className="bg-gray-50 dark:bg-slate-950" value="">Unassigned</option>
                        {users.filter(u => u.role === 'Sales Rep' || u.role === 'Client Admin').map(u => (
                          <option key={u.id} className="bg-gray-50 dark:bg-slate-950" value={u.id}>{u.firstName} {u.lastName}</option>
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
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Product Interests (comma separated)</label>
                      <input value={newDeal.productInterests} onChange={e => setNewDeal({...newDeal, productInterests: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. CRM Enterprise, Marketing Pro" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Address</label>
                      <input value={newDeal.address} onChange={e => setNewDeal({...newDeal, address: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. California, US / Berlin, DE" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Campaign</label>
                      <input value={newDeal.campaign} onChange={e => setNewDeal({...newDeal, campaign: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" placeholder="e.g. Q2 Outreach Campaign" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Customer Type</label>
                      <select value={newDeal.customerType} onChange={e => setNewDeal({...newDeal, customerType: e.target.value})} className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all">
                        <option className="bg-gray-50 dark:bg-slate-950">New Customer</option>
                        <option className="bg-gray-50 dark:bg-slate-950">Existing Business</option>
                        <option className="bg-gray-50 dark:bg-slate-950">Partner</option>
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
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] shrink-0 bg-gray-50 dark:bg-slate-950">
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
            className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
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
            className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
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
            className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
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
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeletePipeline}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                Confirm Archive
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Handoff Modal */}
      {dealBeingWon && (
        <HandoffModal
          isOpen={isHandoffModalOpen}
          onClose={() => {
            setIsHandoffModalOpen(false);
            setDealBeingWon(null);
            setTargetWonStageId(null);
          }}
          onConfirm={handleConfirmHandoff}
          deal={dealBeingWon}
          users={users}
        />
      )}

      </div>{/* end main content wrapper */}
    </motion.div>
  );
}

