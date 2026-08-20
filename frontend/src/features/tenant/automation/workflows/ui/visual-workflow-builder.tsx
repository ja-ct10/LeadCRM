'use client';
import { uuid } from '@/lib/utils';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Zap, Plus, Trash2, Check, Play, Settings, ArrowRight, Info,
  Compass, Maximize2, Minimize2, Move, HelpCircle, FileText, Sparkles, 
  RefreshCw, Database, AlertCircle, ChevronRight, Mail, MessageSquare, 
  CheckSquare, Activity, Tag, Slack, Globe, ArrowDown, Settings2, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { BackButton } from '@/shared/components/ui/back-button';
import { ModalCloseButton } from '@/shared/components/ui/modal-close-button';

// Define Prop Interfaces
interface VisualWorkflowBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: any; // Current workflow details
  templates: any[]; // Email/SMS templates
  onSave: (updatedWorkflow: any, updatedConditionRules: any) => void;
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'logic-gate' | 'rule' | 'action';
  title: string;
  sub: string;
  x: number;
  y: number;
  data: any;
  colorClass: string;
  icon: React.ReactNode;
}

interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  type?: 'default' | 'success' | 'dashed';
}

export default function VisualWorkflowBuilder({
  isOpen,
  onClose,
  workflow,
  templates,
  onSave
}: VisualWorkflowBuilderProps) {
  
  // Canvas coordinate state for Panning & Zooming
  const [zoom, setZoom] = useState<number>(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panningStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Dragging individual nodes state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Active selected node for inspector detail sidebar page
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Nodes & Edges visual representation matching CRM trigger schema 
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);

  // Local state for editing deep properties
  const [workflowName, setWorkflowName] = useState('');
  const [workflowCategory, setWorkflowCategory] = useState('General');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [triggerType, setTriggerType] = useState('lead_created');
  
  // condition rules list
  const [logicGate, setLogicGate] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<any[]>([]);
  
  // Workflow Actions array
  const [actions, setActions] = useState<any[]>([]);

  // Drag-and-drop placeholder visual for library drops
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);

  // Initialize data on mount / trigger update
  useEffect(() => {
    if (!workflow) return;
    
    setWorkflowName(workflow.name || '');
    setWorkflowCategory(workflow.category || 'General');
    setWorkflowDescription(workflow.description || '');
    setTriggerType(workflow.trigger || 'lead_created');

    // Parse conditions
    try {
      if (workflow.condition && workflow.condition.startsWith('{')) {
        const parsed = JSON.parse(workflow.condition);
        setLogicGate(parsed.logic || 'AND');
        setRules(parsed.rules || []);
      } else {
        setLogicGate('AND');
        setRules([]);
      }
    } catch (e) {
      setLogicGate('AND');
      setRules([]);
    }

    // Process actions
    let actList = workflow.actions || [];
    if (actList.length === 0 && workflow.action) {
      actList = [{
        id: uuid(),
        type: workflow.action,
        delay: workflow.delay || 0,
        delayUnit: workflow.delayUnit || 'minutes',
        config: workflow.actionConfig || { taskTitle: '', taskDescription: '', templateId: '' }
      }];
    }
    setActions(actList);
  }, [workflow, isOpen]);

  // Construct visual flow coordinates dynamically
  useEffect(() => {
    if (!isOpen) return;
    
    // Auto arranges nodes dynamically onto coordinates
    const arrangedNodes: WorkflowNode[] = [];
    const arrangedEdges: WorkflowEdge[] = [];

    // 1. ADD TRIGGER NODE
    arrangedNodes.push({
      id: 'trigger',
      type: 'trigger',
      title: 'Trigger Event',
      sub: getTriggerName(triggerType),
      x: 60,
      y: 180,
      data: { triggerType },
      colorClass: 'from-amber-500 to-orange-500 shadow-amber-500/10 dark:shadow-amber-500/5',
      icon: <Zap className="w-5 h-5 text-amber-500" />
    });

    // 2. ADD LOGIC-GATE NODE
    arrangedNodes.push({
      id: 'logic-gate',
      type: 'logic-gate',
      title: `Match Criteria (${logicGate})`,
      sub: rules.length > 0 ? `${rules.length} Rule(s) Configured` : 'Always match (unconditional)',
      x: 340,
      y: 180,
      data: { logicGate, rulesLength: rules.length },
      colorClass: rules.length > 0 ? 'from-blue-500 to-indigo-600 shadow-blue-500/10' : 'from-slate-400 to-slate-500 shadow-slate-500/10 opacity-70',
      icon: <Database className="w-5 h-5 text-blue-500" />
    });

    arrangedEdges.push({
      id: 'edge-trig-logic',
      from: 'trigger',
      to: 'logic-gate',
      type: 'default'
    });

    // 3. ADD RULES BRANCH NODES
    rules.forEach((rule, index) => {
      const ruleId = `rule-${index}`;
      const staggerY = 50 + index * 120;
      arrangedNodes.push({
        id: ruleId,
        type: 'rule',
        title: `Filter criteria #${index + 1}`,
        sub: `${rule.field.split('.')[1] || rule.field} ${rule.operator} ${rule.value || '(empty)'}`,
        x: 620,
        y: staggerY,
        data: { rule, index },
        colorClass: 'from-emerald-500 to-teal-600 shadow-emerald-500/10',
        icon: <BarChart2 className="w-5 h-5 text-emerald-500" />
      });

      arrangedEdges.push({
        id: `edge-logic-${ruleId}`,
        from: 'logic-gate',
        to: ruleId,
        type: 'dashed'
      });
    });

    // 4. ADD ACTION NODES
    const actionX = rules.length > 0 ? 940 : 620;
    actions.forEach((act, index) => {
      const actionId = `action-${act.id || index}`;
      const staggerY = 100 + index * 150;
      
      arrangedNodes.push({
        id: actionId,
        type: 'action',
        title: `Action: ${getActionName(act.type)}`,
        sub: act.delay > 0 ? `Delayed by ${act.delay} ${act.delayUnit}` : 'Triggers instantly',
        x: actionX,
        y: staggerY,
        data: { act, index },
        colorClass: 'from-purple-500 to-fuchsia-600 shadow-purple-500/10',
        icon: getActionIcon(act.type)
      });

      // Hook up logic gate directly to actions, or rules hook up to actions
      const startConnectId = rules.length > 0 ? `rule-0` : 'logic-gate';
      arrangedEdges.push({
        id: `edge-connect-act-${index}`,
        from: startConnectId,
        to: actionId,
        type: 'success'
      });
    });

    // If there were saved custom positions, we can restore/maintain them (except on first arrange)
    setNodes(arrangedNodes);
    setEdges(arrangedEdges);
  }, [triggerType, logicGate, rules, actions, isOpen]);

  // Helper converters
  function getTriggerName(type: string) {
    const list: any = {
      lead_created: 'Contact is Created',
      deal_created: 'Deal is Created',
      deal_stage_qualified: 'Deal reaches Qualified',
      deal_stage_proposal: 'Deal reaches Proposal',
      deal_stage_negotiation: 'Deal reaches Negotiation',
      deal_stage_won: 'Closed Won (Deal won)',
      deal_stage_lost: 'Closed Lost (Deal lost)',
      deal_expected_close_date_approaching: 'Close Date Approaching',
      lead_expected_close_date_approaching: 'Check Date Approaching',
      email_opened: 'Standard Email Opened',
      meeting_scheduled: 'Client Meeting Scheduled',
      tag_added: 'SaaS Customer Tag Added'
    };
    return list[type] || 'Automation Initialized';
  }

  function getActionName(type: string) {
    const list: any = {
      send_email: 'Send Outbound Email',
      send_sms: 'Send SMS Mobile Alert',
      create_task: 'Assign Task To Owner',
      update_lead_status: 'Change CRM Contact Status',
      add_tag: 'Append System Tag',
      send_slack_notification: 'Broadcast Slack Ping',
      webhook: 'Fire External REST Webhook'
    };
    return list[type] || 'Workflow Execution';
  }

  function getActionIcon(type: string) {
    switch (type) {
      case 'send_email': return <Mail className="w-5 h-5 text-purple-400" />;
      case 'send_sms': return <MessageSquare className="w-5 h-5 text-fuchsia-400" />;
      case 'create_task': return <CheckSquare className="w-5 h-5 text-pink-400" />;
      case 'update_lead_status': return <Activity className="w-5 h-5 text-indigo-400" />;
      case 'add_tag': return <Tag className="w-5 h-5 text-blue-400" />;
      case 'send_slack_notification': return <Slack className="w-5 h-5 text-emerald-400" />;
      case 'webhook': return <Globe className="w-5 h-5 text-amber-400" />;
      default: return <Settings className="w-5 h-5 " />;
    }
  }

  // Pointer Canvas movement (Panning)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If user clicked directly on a node or button, don't initiate background canvas panning
    const target = e.target as HTMLElement;
    if (target.closest('.canvas-node') || target.closest('button') || target.closest('select') || target.closest('input')) {
      return;
    }
    
    setIsPanning(true);
    panningStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panningStart.current.x,
        y: e.clientY - panningStart.current.y
      });
    } else if (draggingNodeId) {
      // Move Node locally
      setNodes(prev => prev.map(node => {
        if (node.id === draggingNodeId) {
          // Calculate grid projection based on zoom
          const nextX = Math.round((e.clientX - pan.x - dragOffset.current.x) / zoom);
          const nextY = Math.round((e.clientY - pan.y - dragOffset.current.y) / zoom);
          return {
            ...node,
            x: Math.max(20, Math.min(2000, nextX)),
            y: Math.max(20, Math.min(1000, nextY))
          };
        }
        return node;
      }));
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
  };

  // Node Drag Trigger
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
    
    // Offset inside node card itself
    const container = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - container.left,
      y: e.clientY - container.top
    };
  };

  // Node Selection
  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
  };

  // SVG Connection Line Drawer
  // Uses beautiful bezier curve linking nodes with markers for arrows
  const drawLinkBezier = (fromId: string, toId: string) => {
    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toId);
    if (!fromNode || !toNode) return null;

    // Anchor points: right edge of 'fromNode', left edge of 'toNode'
    const x1 = fromNode.x + 240; // Card width is 240px
    const y1 = fromNode.y + 40;  // Centered vertically (card height is roughly 80px)
    const x2 = toNode.x;
    const y2 = toNode.y + 40;

    const controlOffset = Math.max(100, Math.abs(x2 - x1) * 0.5);
    const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

    return d;
  };

  // Zoom manipulation
  const adjustZoom = (delta: number) => {
    setZoom(prev => Math.min(1.5, Math.max(0.4, prev + delta)));
  };

  const resetViewport = () => {
    setZoom(0.95);
    setPan({ x: 20, y: 30 });
    setSelectedNodeId(null);
    toast.info('View centered');
  };

  // Interactive configurations update
  const handleUpdateRule = (index: number, key: string, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [key]: value };
    setRules(updated);
  };

  const handleAddRuleNode = () => {
    const newRule = { field: 'deal.value', operator: '>', value: '5000' };
    setRules([...rules, newRule]);
    setSelectedNodeId(`rule-${rules.length}`);
    toast.success('Condition added');
  };

  const handleDeleteRule = (index: number) => {
    const filtered = rules.filter((_, idx) => idx !== index);
    setRules(filtered);
    setSelectedNodeId('logic-gate');
    toast.success('Condition removed');
  };

  const handleUpdateAction = (actionId: string, key: string, value: any) => {
    const updated = actions.map(act => {
      if (act.id === actionId) {
        if (key.startsWith('config.')) {
          const configKey = key.split('.')[1];
          return {
            ...act,
            config: {
              ...(act.config || {}),
              [configKey]: value
            }
          };
        }
        return { ...act, [key]: value };
      }
      return act;
    });
    setActions(updated);
  };

  const handleAddActionNode = (type: string) => {
    const newAct = {
      id: uuid(),
      type,
      delay: 0,
      delayUnit: 'minutes',
      config: {
        taskTitle: 'Perform follow-up task',
        taskDescription: 'System generated visual workspace automation',
        templateId: ''
      }
    };
    setActions([...actions, newAct]);
    setSelectedNodeId(`action-${newAct.id}`);
    toast.success(`Action added: ${getActionName(type)}`);
  };

  const handleDeleteAction = (actionId: string) => {
    const filtered = actions.filter(act => act.id !== actionId);
    setActions(filtered);
    setSelectedNodeId('logic-gate');
    toast.success('Action removed');
  };

  // Submit complete workflow visual modifications back to the store
  const handleCompleteSave = () => {
    const finalConditionRules = {
      logic: logicGate,
      rules: rules
    };

    const finalWorkflow = {
      name: workflowName,
      category: workflowCategory,
      description: workflowDescription,
      trigger: triggerType,
      actions: actions
    };

    onSave(finalWorkflow, finalConditionRules);
    toast.success('Workflow saved successfully!');
  };

  const renderInspectorContent = () => {
    if (!selectedNodeId) {
      return (
        <div className="text-center py-20 px-4 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.02]/50 border border-gray-200 dark:border-white/[0.05] flex items-center justify-center mx-auto text-slate-400 animate-pulse">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-300">Click any Node Card</h5>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] mx-auto leading-relaxed">
              Select dynamic workflow variables directly to customize operators, delay tags, and criteria filters right here!
            </p>
          </div>
        </div>
      );
    }

    if (selectedNodeId === 'trigger') {
      return (
        <div className="space-y-4">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded w-fit block">Trigger Variable</span>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">When this happens (Trigger)</h4>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">The entry point event that activates the visual pipeline evaluation</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Event Trigger Choice</label>
            <select
              value={triggerType}
              onChange={e => setTriggerType(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg px-3.5 py-2.5 text-slate-850 dark:text-white focus:outline-none"
            >
              <option value="lead_created" className="dark:bg-slate-950">Contact is Created</option>
              <option value="deal_created" className="dark:bg-slate-950">Deal is Created</option>
              <option value="deal_stage_qualified" className="dark:bg-slate-950">Deal Stage Reached Qualified</option>
              <option value="deal_stage_proposal" className="dark:bg-slate-950">Deal Stage Reached Proposal</option>
              <option value="deal_stage_negotiation" className="dark:bg-slate-950">Deal Stage Reached Negotiation</option>
              <option value="deal_stage_won" className="dark:bg-slate-950">Deal Status Closed Won</option>
              <option value="deal_stage_lost" className="dark:bg-slate-950">Deal Status Closed Lost</option>
              <option value="deal_expected_close_date_approaching" className="dark:bg-slate-950">Expected Close Date Approaching (Deal)</option>
              <option value="lead_expected_close_date_approaching" className="dark:bg-slate-950">Expected Check Date Approaching (Contact)</option>
              <option value="email_opened" className="dark:bg-slate-950">Customer Email Opened</option>
              <option value="meeting_scheduled" className="dark:bg-slate-950">Client Meeting Scheduled</option>
              <option value="tag_added" className="dark:bg-slate-950">Append System Tag Added</option>
            </select>
          </div>
        </div>
      );
    }

    if (selectedNodeId === 'logic-gate') {
      return (
        <div className="space-y-5">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/5 border border-blue-500/10 px-2 py-1 rounded w-fit block">Decision Logic Block</span>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Matcher Operators</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">Specify if ALL conditions must evaluate successfully (AND), or if matching ANY single rule suffices (OR) to fire action steps.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Gate evaluation strategy</label>
            <select
              value={logicGate}
              onChange={e => setLogicGate(e.target.value as any)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg px-3.5 py-2.5 text-slate-850 dark:text-white focus:outline-none"
            >
              <option value="AND">All criteria must match (AND)</option>
              <option value="OR">At least one criterion matches (OR)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-white/[0.04]">
            <span className="text-xs font-semibold text-slate-400 block mb-2">Associated Filter Rules ({rules.length})</span>
            <button
              onClick={handleAddRuleNode}
              className="w-full text-center text-xs py-2 border border-dashed border-gray-300 dark:border-white/[0.1] hover:border-blue-500 hover:text-blue-500 rounded-lg text-slate-500 cursor-pointer"
            >
              + Spawn new criteria node
            </button>
          </div>
        </div>
      );
    }

    if (selectedNodeId.startsWith('rule-')) {
      const rIdx = parseInt(selectedNodeId.replace('rule-', ''));
      const rule = rules[rIdx];
      if (!rule) return null;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-2 py-1 rounded w-fit block">Filter Evaluation Criteria</span>
            <button
              onClick={() => handleDeleteRule(rIdx)}
              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Condition Parameters</h4>
            <p className="text-[11px] text-slate-500">Refine exactly what CRM parameters trigger automated triggers.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">SaaS Matching Field</label>
            <select
              value={rule.field}
              onChange={e => handleUpdateRule(rIdx, 'field', e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
            >
              <optgroup label="Deal Variables" className="dark:bg-slate-950">
                <option value="deal.title">Deal Title (text)</option>
                <option value="deal.value">Deal Value ($)</option>
                <option value="deal.daysUntilClose">Days relative to Target Close</option>
                <option value="deal.expectedCloseDate">Expected Close Date (YYYY-MM-DD)</option>
                <option value="deal.priority">Priority rating (High/Medium/Low)</option>
                <option value="deal.companyName">SaaS Company Name</option>
                <option value="deal.contactPerson">Contact Person Name</option>
              </optgroup>
              <optgroup label="Contact Variables" className="dark:bg-slate-950">
                <option value="contact.customerType">Customer Type (Individual/Organization)</option>
                <option value="contact.score">Contact Score (0 - 100)</option>
                <option value="contact.estimatedValue">Estimate Budget ($)</option>
                <option value="contact.daysUntilClose">Days remaining to Target Close</option>
                <option value="contact.status">Contact Status (Warm/Hot/Cold)</option>
                <option value="contact.leadSource">Acquisition Contact Source</option>
                <option value="contact.productInterest">Product Interest</option>
                <option value="contact.companyName">SaaS Company Name</option>
                <option value="contact.contactPerson">Contact Name</option>
                <option value="contact.email">Contact email address</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Comparison Operation</label>
            <select
              value={rule.operator}
              onChange={e => handleUpdateRule(rIdx, 'operator', e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
            >
              <option value=">" className="dark:bg-slate-950">Greater than (&gt;)</option>
              <option value="<" className="dark:bg-slate-950">Less than (&lt;)</option>
              <option value=">=" className="dark:bg-slate-950">Greater or Eq (&gt;=)</option>
              <option value="<=" className="dark:bg-slate-950">Less or Eq (&lt;=)</option>
              <option value="==" className="dark:bg-slate-950">Exact Match (==)</option>
              <option value="!=" className="dark:bg-slate-950">Exclude (!=)</option>
              <option value="contains" className="dark:bg-slate-950">Substring Contains</option>
              <option value="not_contains" className="dark:bg-slate-950">Substring Excludes</option>
              <option value="starts_with" className="dark:bg-slate-950">Starts with prefix</option>
              <option value="ends_with" className="dark:bg-slate-950">Ends with suffix</option>
              <option value="is_empty" className="dark:bg-slate-950">Is Field Null/Empty</option>
              <option value="is_not_empty" className="dark:bg-slate-950">Is Field Populated</option>
            </select>
          </div>

          {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Comparison Target Value</label>
              <input
                type="text"
                value={rule.value || ''}
                onChange={e => handleUpdateRule(rIdx, 'value', e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
                placeholder="Type test limit value..."
              />
            </div>
          )}
        </div>
      );
    }

    if (selectedNodeId.startsWith('action-')) {
      const actId = selectedNodeId.replace('action-', '');
      const act = actions.find(a => String(a.id) === actId || `action-${a.id}` === selectedNodeId);
      if (!act) return null;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/5 border border-purple-500/10 px-2 py-1 rounded w-fit block">Automation Task Action</span>
            <button
              onClick={() => handleDeleteAction(act.id)}
              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Action parameters</h4>
            <p className="text-[11px] text-slate-500">Configure parameters executed when conditions are successfully resolved.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Action execution category</label>
            <select
              value={act.type}
              onChange={e => handleUpdateAction(act.id, 'type', e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white h-10"
            >
              <option value="send_email" className="dark:bg-slate-950">Send Automated Email</option>
              <option value="send_sms" className="dark:bg-slate-950">Send Mobile SMS</option>
              <option value="create_task" className="dark:bg-slate-950">Assign Task Ticket</option>
              <option value="update_lead_status" className="dark:bg-slate-950">Update CRM Contact State</option>
              <option value="add_tag" className="dark:bg-slate-950">Append Customer Tag</option>
              <option value="send_slack_notification" className="dark:bg-slate-950">Broadcast Slack message</option>
              <option value="webhook" className="dark:bg-slate-950">Fire Webhook API call</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Execution delay</label>
              <input
                type="number"
                value={act.delay || 0}
                onChange={e => handleUpdateAction(act.id, 'delay', parseInt(e.target.value) || 0)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Delay unit</label>
              <select
                value={act.delayUnit || 'minutes'}
                onChange={e => handleUpdateAction(act.id, 'delayUnit', e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2 text-slate-900 dark:text-white"
              >
                <option value="minutes" className="dark:bg-slate-950">Minutes</option>
                <option value="hours" className="dark:bg-slate-950">Hours</option>
                <option value="days" className="dark:bg-slate-950">Days</option>
              </select>
            </div>
          </div>

          {(act.type === 'send_email' || act.type === 'send_sms') && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/[0.04]">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Selection templates</label>
              <select
                value={act.config?.templateId || ''}
                onChange={e => handleUpdateAction(act.id, 'config.templateId', e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2 text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-slate-950">Select template...</option>
                {templates
                  .filter(t => t.type === (act.type === 'send_email' ? 'Email' : 'SMS'))
                  .map(t => (
                    <option key={t.id} value={t.id} className="dark:bg-slate-950">{t.name}</option>
                  ))
                }
              </select>
            </div>
          )}

          {act.type === 'create_task' && (
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Task title</label>
                <input
                  type="text"
                  value={act.config?.taskTitle || ''}
                  onChange={e => handleUpdateAction(act.id, 'config.taskTitle', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="e.g. Schedule visual workspace survey"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-mono">Task details / specifications</label>
                <textarea
                  value={act.config?.taskDescription || ''}
                  onChange={e => handleUpdateAction(act.id, 'config.taskDescription', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white h-24 resize-none"
                  placeholder="Details relative to automated trigger..."
                />
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg">
                <span className="text-[9px] font-bold text-blue-400 block mb-1.5 uppercase">Merge tags</span>
                <div className="flex flex-wrap gap-1">
                  {['[Deal Name]', '[Contact Name]', '[Contact Person]', '[Company Name]'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        const curr = act.config?.taskDescription || '';
                        handleUpdateAction(act.id, 'config.taskDescription', curr + ' ' + tag);
                      }}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-300 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {act.type === 'update_lead_status' && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/[0.04]">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Target CRM Contact Status</label>
              <select
                value={act.config?.targetStatus || 'Hot'}
                onChange={e => handleUpdateAction(act.id, 'config.targetStatus', e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
              >
                <option value="Hot" className="dark:bg-slate-950">Hot</option>
                <option value="Warm" className="dark:bg-slate-950">Warm</option>
                <option value="Cold" className="dark:bg-slate-950">Cold</option>
                <option value="Cancelled" className="dark:bg-slate-950">Cancelled</option>
                <option value="Closed" className="dark:bg-slate-950">Closed (Converted)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Applies the designated visual category status back to the CRM candidate record instantly when this action fires.
              </p>
            </div>
          )}

          {act.type === 'add_tag' && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/[0.04] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tag Code / Name to Append</label>
                <input
                  type="text"
                  value={act.config?.tagName || ''}
                  onChange={e => handleUpdateAction(act.id, 'config.tagName', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="e.g. enterprise-deal, auto-qualified"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Appends this custom classification label on the associated customer profile for dynamic tracking rules.
              </p>
            </div>
          )}

          {act.type === 'send_slack_notification' && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/[0.04] space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Destination Channel ID</label>
                <input
                  type="text"
                  value={act.config?.slackChannel || ''}
                  onChange={e => handleUpdateAction(act.id, 'config.slackChannel', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="e.g. #sales-alerts, #contacts-feed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Slack Message Markdown</label>
                <textarea
                  value={act.config?.slackMessage || ''}
                  onChange={e => handleUpdateAction(act.id, 'config.slackMessage', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white h-24 resize-none"
                  placeholder="e.g. :tada: Attention! A hot new contact [Contact Name] has been checked!"
                />
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                <span className="text-[9px] font-bold text-emerald-400 block mb-1.5 uppercase">Merge tags</span>
                <div className="flex flex-wrap gap-1">
                  {['[Deal Name]', '[Contact Name]', '[Contact Person]', '[Company Name]', '[Value]', '[Score]'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const curr = act.config?.slackMessage || '';
                        handleUpdateAction(act.id, 'config.slackMessage', curr + ' ' + tag);
                      }}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-350 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {act.type === 'webhook' && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/[0.04] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Webhook HTTP URL Endpoint</label>
                <input
                  type="text"
                  value={act.config?.webhookUrl || ''}
                  onChange={e => handleUpdateAction(act.id, 'config.webhookUrl', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="https://zapier.com/hooks/catch/..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">HTTP Method</label>
                <select
                  value={act.config?.webhookMethod || 'POST'}
                  onChange={e => handleUpdateAction(act.id, 'config.webhookMethod', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-300 dark:border-white/[0.1] rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="POST" className="dark:bg-slate-950">POST (Send JSON payload)</option>
                  <option value="GET" className="dark:bg-slate-950">GET (Query REST status)</option>
                  <option value="PUT" className="dark:bg-slate-950">PUT (Update resource)</option>
                </select>
              </div>

              <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                <p className="text-[10px] text-amber-500 leading-relaxed font-sans">
                  <strong>Secure SaaS Forwarding:</strong> Real-time trigger events automatically transform and post complete nested contact/deal telemetry fields as standardized application/json payload objects.
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex flex-col h-screen overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* TOP BAR / COMMAND MODULE */}
        <div className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-white/[0.08] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <BackButton label="Back to Workflows" onClick={onClose} variant="subtle" />
            
            <div className="flex items-center gap-3 border-l border-slate-200 dark:border-white/10 pl-4">
              <div className="p-2 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-xl text-white shadow-[0_0_15px_rgba(10,110,255,0.3)] flex items-center justify-center animate-spin-slow">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Workspace Automation Canvas</h3>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/20">Node-Editor</span>
                </div>
                <p className="text-xs text-slate-500">Intuitively link events, cross-entity triggers, filter variables, and actions visually</p>
              </div>
            </div>
          </div>

          {/* Quick status & main controls */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1.5 bg-gray-100 dark:bg-white/[0.04] rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              SaaS Engine Ready
            </div>
            
            <button
              onClick={handleCompleteSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-md cursor-pointer transition-all active:scale-95 border border-blue-400/20"
            >
              <Check className="w-4 h-4" /> Save Visual Flow
            </button>
            <ModalCloseButton onClose={onClose} ariaLabel="Close builder" size={20} />
          </div>
        </div>

        {/* BOTTOM CORE STRUCTURE (Side Toolbar Library - Visual Canvas - Property Inspector Panel) */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* 1. NODE SELECTION TOOLBAR BAR */}
          <div className="w-64 bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-white/[0.08] p-5 flex flex-col gap-6 overflow-y-auto shrink-0 select-none">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Automation Presets</span>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Scope Title</label>
                  <input
                    type="text"
                    value={workflowName}
                    onChange={e => setWorkflowName(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-white/[0.06] px-3 py-2 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                    placeholder="e.g. Contact Auto Assign"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Industry Group</label>
                  <select
                    value={workflowCategory}
                    onChange={e => setWorkflowCategory(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-white/[0.06] px-3 py-2 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="General">General Category</option>
                    <option value="Security">Security Solutions</option>
                    <option value="Telecom">Telecom Routing</option>
                    <option value="IT">IT Solutions</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Triggers section */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3">Add Filter Rules</span>
              <button
                onClick={handleAddRuleNode}
                className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 border-dashed rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Condition Filter Node
              </button>
            </div>

            {/* Actions Library */}
            <div className="space-y-3.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Add Automation Actions</span>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { type: 'send_email', label: 'Outbound Email', bg: 'purple' },
                  { type: 'send_sms', label: 'Mobile SMS Alert', bg: 'fuchsia' },
                  { type: 'create_task', label: 'Assign CRM Task', bg: 'pink' },
                  { type: 'update_lead_status', label: 'Update Status', bg: 'indigo' },
                  { type: 'add_tag', label: 'Append Tag', bg: 'blue' },
                  { type: 'send_slack_notification', label: 'Broadcast Slack', bg: 'emerald' },
                  { type: 'webhook', label: 'REST Webhook', bg: 'amber' }
                ].map(button => (
                  <button
                    key={button.type}
                    onClick={() => handleAddActionNode(button.type)}
                    className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.05] rounded-xl text-left text-xs font-medium cursor-pointer transition-colors group"
                  >
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                      {getActionIcon(button.type)}
                    </span>
                    <span className="truncate text-slate-700 dark:text-slate-300">{button.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cross entity hint card */}
            <div className="mt-auto p-4 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 rounded-2xl flex gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-blue-500 block mb-0.5">SaaS Dynamic Links:</strong>
                All parameters automatically sync fields across corresponding Deals and Contacts.
              </p>
            </div>
          </div>

          {/* 2. CORE FLOW CANVAS VIEWPORT */}
          <div 
            className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative cursor-grab active:cursor-grabbing outline-none"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
          >
            
            {/* GRID LAYER (Emits a gorgeous SVG network background) */}
            <div 
              className="absolute inset-0 select-none z-0 pointer-events-none opacity-40 dark:opacity-30" 
              style={{
                backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundPosition: `${pan.x}px ${pan.y}px`
              }}
            />

            {/* FLOW VIEWPORT WRAPPER (Applied drag translation + dynamic zoom scaling) */}
            <div 
              className="absolute origin-top-left transition-transform duration-75 select-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
              }}
            >
              
              {/* FLOW LINES LAYER (SVG drawing connected Bezier trails with styling) */}
              <svg className="absolute overflow-visible pointer-events-none z-0 h-[2000px] w-[2000px]">
                <defs>
                  {/* Arrow marker for endpoint connections */}
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400 dark:fill-white/10" />
                  </marker>
                  <marker id="arrow-success" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-emerald-500" />
                  </marker>
                  <marker id="arrow-dashed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-blue-400" />
                  </marker>
                </defs>

                {edges.map(edge => {
                  const pathD = drawLinkBezier(edge.from, edge.to);
                  if (!pathD) return null;
                  
                  // Color styling
                  let strokeColor = 'rgba(148, 163, 184, 0.4)';
                  let markerEnd = 'url(#arrow)';
                  let strokeDash: string | undefined = undefined;

                  if (edge.type === 'dashed') {
                    strokeColor = 'rgba(59, 130, 246, 0.5)';
                    strokeDash = '5, 5';
                    markerEnd = 'url(#arrow-dashed)';
                  } else if (edge.type === 'success') {
                    strokeColor = 'rgba(16, 185, 129, 0.6)';
                    markerEnd = 'url(#arrow-success)';
                  }

                  return (
                    <g key={edge.id}>
                      {/* Active click/hover range line */}
                      <path 
                        d={pathD} 
                        stroke="transparent" 
                        strokeWidth="12" 
                        fill="none" 
                        className="cursor-pointer"
                      />
                      {/* Visual rendering line */}
                      <path 
                        d={pathD} 
                        stroke={strokeColor} 
                        strokeWidth="2.5" 
                        strokeDasharray={strokeDash}
                        fill="none" 
                        markerEnd={markerEnd}
                        className="transition-all"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* FLOW NODES LAYER (Dynamic listing of functional tiles) */}
              <div className="absolute z-10 pointer-events-auto">
                <AnimatePresence>
                  {nodes.map(node => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <motion.div
                        key={node.id}
                        layoutId={`node-visual-${node.id}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={`absolute w-[240px] p-4 rounded-2xl border bg-white dark:bg-slate-950 select-none shadow-xl cursor-default canvas-node transition-all ${
                          isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/5' 
                            : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15]'
                        }`}
                        style={{ left: node.x, top: node.y }}
                        onClick={(e) => handleNodeClick(node.id, e)}
                      >
                        {/* Drag Handle Bar */}
                        <div 
                          className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing pb-2 border-b border-gray-100 dark:border-white/[0.04]"
                          onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="p-1 rounded-md bg-gray-100 dark:bg-white/[0.04] shrink-0 text-slate-400 dark:text-slate-500">
                              <Move className="w-3.5 h-3.5 rotate-45" />
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{node.title}</span>
                          </div>
                          
                          {/* Indicator nodes badges */}
                          <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${node.colorClass}`} />
                        </div>

                        {/* Node Card Core Body */}
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-slate-50 dark:bg-white/[0.02]/30 rounded-lg shrink-0 border border-gray-100 dark:border-white/[0.04]">
                            {node.icon}
                          </div>
                          <div className="overflow-hidden min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate leading-snug">{node.sub}</p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5 font-mono">ID: {node.id}</span>
                          </div>
                        </div>

                        {/* Quick Interactive Actions */}
                        <div className="flex items-center justify-end gap-1.5 mt-3.5 pt-2 border-t border-gray-50 dark:border-white/[0.03] text-[10px]">
                          {node.type === 'rule' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRule(node.data.index);
                              }}
                              className="text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                          {node.type === 'action' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAction(node.data.act.id);
                              }}
                              className="text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNodeId(node.id);
                            }}
                            className="text-blue-500 hover:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/10 font-bold"
                          >
                            Configure
                          </button>
                        </div>

                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

            </div>

            {/* FLOAT FLOATING INTERACTION CONTROLS */}
            <div className="absolute bottom-6 left-6 bg-white dark:bg-slate-950 border border-gray-200 dark:border-white/[0.08] px-4 py-2.5 rounded-full flex items-center gap-3.5 shadow-2xl z-20">
              <button 
                onClick={() => adjustZoom(0.05)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <Maximize2 className="w-4 h-4 scale-95" />
              </button>
              <span className="text-[11px] font-bold font-mono text-slate-400">{Math.round(zoom * 100)}%</span>
              <button 
                onClick={() => adjustZoom(-0.05)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <Minimize2 className="w-4 h-4 scale-95" />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-white/[0.08]" />
              <button 
                onClick={resetViewport}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-full text-slate-500 hover:text-white transition-colors flex items-center gap-1 cursor-pointer text-xs font-semibold"
                title="Align canvas to origin fit"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recenter
              </button>
            </div>

            {/* CANVAS INTERACTIVE LEGEND */}
            <div className="absolute top-6 left-6 text-[10px] bg-slate-900/65 border border-white/[0.05] p-3 rounded-2xl flex flex-col gap-1.5 select-none text-slate-300 pointer-events-none">
              <span className="font-bold text-slate-200 uppercase tracking-widest text-[9px] mb-0.5">Canvas Guide</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Trigger (Start Anchor)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Rule logical Gate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Specific Filter evaluation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Sequential SaaS Actions</span>
              </div>
            </div>

          </div>

          {/* 3. DYNAMIC RIGHT SIDE PROPERTY INSPECTOR BAR */}
          <div className="w-96 bg-white dark:bg-slate-950 border-l border-gray-200 dark:border-white/[0.08] flex flex-col overflow-hidden shrink-0 z-10 shadow-2xl">
            
            <div className="p-5 border-b border-gray-200 dark:border-white/[0.05] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4.5 h-4.5 text-blue-500" />
                <h4 className="text-xs font-bold uppercase text-slate-900 dark:text-white tracking-widest">Instance Inspector</h4>
              </div>
              {selectedNodeId && (
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 bg-gray-100 dark:bg-white/[0.04] rounded hover:bg-[#1E293B]"
                >
                  Unselect
                </button>
              )}
            </div>

            {/* Inspections core scrollable forms */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
              {renderInspectorContent()}
            </div>

            {/* Bottom panel hint */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-gray-200 dark:border-white/[0.05] text-[10px] text-slate-500 text-center select-none flex items-center justify-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              SaaS automations build instantly relative to constraints.
            </div>

          </div>

        </div>

      </div>
    </AnimatePresence>
  );
}
