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
import { DealDetailsModal } from './deal-details-modal';
import { HandoffModal } from './handoff-modal';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from '@/shared/components/charts/ChartComponents';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { TrelloFilter } from '@/shared/components/trello-filter';
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
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={`deal-card-${deal.id}`}
      transition={{ type: 'spring', damping: 26, stiffness: 180 }}
      onClick={() => onClick(deal)}
      className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${
        isDragging 
          ? 'border-blue-500/50 bg-blue-500/5 ring-2 ring-blue-500/20' 
          : `${isRotting || isAging ? '' : 'bg-white dark:bg-slate-950'} ${borderStyle} shadow-sm hover:shadow-md hover:-translate-y-0.5`
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
        <div className="flex items-center gap-2">
          {stage.color && (
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} aria-hidden="true" />
          )}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-blue-400 transition-colors">{stage.name}</h3>
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
    if (deal && canEditDeal(deal)) setActiveDeal(deal);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // handleDragOver is intentionally a no-op for API calls.
    // All actual persistence happens in handleDragEnd to avoid spamming
    // the backend on every intermediate hover position during a drag.
    // Visual feedback (drag overlay) is handled by DndContext / drag state.
    if (isAutomatedOnly) return;
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
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
      const firstStage = targetPipeline.stages[0];
      if (!firstStage?.id) {
        toast.error('Target pipeline has no stages.');
        return;
      }
      // Cross-pipeline move: update pipeline first, then use moveDealStage for the stage change
      // Since pipelineId is no longer in UpdateDealSchema, we handle this as a special case
      // The backend moveDealStage already handles the deal update, so we call it directly
      moveDealStage(String(activeId), firstStage.id).catch((err: unknown) => {
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

        moveDealStage(String(activeId), String(targetStageId)).catch((err: unknown) => {
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

        moveDealStage(String(activeId), overStageId).catch((err: unknown) => {
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
    <div className="h-full flex flex-col space-y-4 relative overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Pipeline Management</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            — Track deals and stage velocity across sales pipelines
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
          <TooltipProvider>
            {/* Automation Mode toggle */}
            <UITooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleAutomatedOnly}
                  aria-label={isAutomatedOnly ? 'Automation Mode: Active' : 'Automation Mode: Off'}
                  className={`h-9 w-9 flex items-center justify-center rounded-md border transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isAutomatedOnly
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Shield size={14} className={isAutomatedOnly ? 'text-blue-500' : 'text-slate-400'} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isAutomatedOnly ? 'Automation Mode: Active (Workflows)' : 'Automation Mode: Off (Manual)'}
              </TooltipContent>
            </UITooltip>

            {canManagePipelines && (
              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsManagePipelinesModalOpen(true)}
                    aria-label="Manage Pipelines"
                    className="h-9 w-9 flex items-center justify-center text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <Settings size={14} className="text-slate-500 dark:text-slate-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Manage Pipelines</TooltipContent>
              </UITooltip>
            )}

            {canCreateDeal && activePipeline && (
              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setNewDeal({ ...newDeal, stageId: activePipeline?.stages?.[0]?.id || '' });
                      setDealTitleTouched(false);
                      setDealValueTouched(false);
                      setIsModalOpen(true);
                    }}
                    aria-label="Add Deal/Ticket"
                    className="h-9 w-9 flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <Plus size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add Deal/Ticket</TooltipContent>
              </UITooltip>
            )}
          </TooltipProvider>
        </div>
      </div>


      {/* Revenue Forecast Bar */}
      <ForecastBar deals={deals} pipelines={pipelines} />

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
        {canManagePipelines && (
          <button 
            onClick={() => {
              setPipelineModalStep('template');
              setSelectedTemplateId('inquiry');
              setNewPipelineName('');
              setIsPipelineModalOpen(true);
            }}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> New Pipeline
          </button>
        )}
      </div>

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

      {/* View Options & Advanced Funnel Filtering Bar */}
      <div className="flex flex-col gap-4 p-4 bg-white dark:bg-slate-950/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.02] p-1 rounded-xl border border-gray-200/50 dark:border-white/[0.05] w-fit">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('kanban')}
                      aria-label="Kanban View"
                      className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${
                        viewMode === 'kanban'
                          ? 'bg-white dark:bg-slate-950 text-blue-500 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-white/[0.05]'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <LayoutGrid size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Kanban View</TooltipContent>
                </UITooltip>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('table')}
                      aria-label="Table View"
                      className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${
                        viewMode === 'table'
                          ? 'bg-white dark:bg-slate-950 text-blue-500 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-white/[0.05]'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <Table size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Table View</TooltipContent>
                </UITooltip>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('list')}
                      aria-label="List View"
                      className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-slate-950 text-blue-500 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-white/[0.05]'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <List size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>List View</TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>


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

      </div>


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
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {swimlaneBy === 'none' ? (
            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex gap-6 h-full min-w-max items-start">
                {(activePipeline?.stages || []).map((stage: any) => {
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
              <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-blue-500/50 shadow-2xl flex flex-col gap-3 w-80 scale-105 rotate-2">
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

    </div>
  );
}

