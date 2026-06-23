import React, { useState, useMemo } from 'react';
import { useData } from '../../../store/DataContext';
import { useAuth } from '../../../store/AuthContext';
import { Plus, Play, Pause, Settings, X, Zap, ArrowRight, History, Clock, FileText, Trash2, Edit2, CheckCircle2, FlaskConical, GitMerge, MoreVertical, Compass } from 'lucide-react';
import EmptyState from '../../../shared/components/EmptyState';
import VisualWorkflowBuilder from '../../../portals/client/components/workflows/VisualWorkflowBuilder';
import { TrelloFilter } from '../../../shared/components/TrelloFilter';
import { WorkflowRecipesModal } from './WorkflowRecipesModal';
import { WorkflowExecutionLogModal } from './WorkflowExecutionLogModal';
import { toast } from 'sonner';

export default function WorkflowsPage() {
  const { workflows, tasks, deals, users, roles, addWorkflow, updateWorkflow, deleteWorkflow, templates, workflowExecutions, pendingActions } = useData();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecipesOpen, setIsRecipesOpen] = useState(false);
  const [selectedWorkflowForLog, setSelectedWorkflowForLog] = useState<string | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isVisualCanvasOpen, setIsVisualCanvasOpen] = useState(false);
  const [visualBuilderWorkflow, setVisualBuilderWorkflow] = useState<any>(null);

  // Filter state
  const [wfSearchTerm, setWfSearchTerm] = useState('');
  const [wfStatusFilter, setWfStatusFilter] = useState<string[]>([]);
  const [wfCategoryFilter, setWfCategoryFilter] = useState<string[]>([]);

  const handleOpenVisualBuilderNode = (wf: any) => {
    setEditingWorkflowId(wf.id);
    
    // Convert base actions format if absent
    let actions = wf.actions;
    if (!actions || actions.length === 0) {
      actions = [
        {
          id: 'action_' + Date.now(),
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
          id: 'action_init_' + Date.now(),
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
      status: 'active'
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
        id: 'action_' + Date.now(),
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

  const userRoleDef = roles.find(r => r.name === user?.role);
  const userPerms = userRoleDef?.permissions || [];
  const isClientAdmin = user?.role === 'Client Admin';
  const canCreateWorkflow = isClientAdmin || userPerms.includes('p13');
  const canEditWorkflow = isClientAdmin || userPerms.includes('p14');
  const canDeleteWorkflow = isClientAdmin || userPerms.includes('p15');
  const canExecuteWorkflow = isClientAdmin || userPerms.includes('p16');

  // Filtered workflows — funnel through search + status + category
  const filteredWorkflows = useMemo(() => {
    return workflows.filter(wf => {
      if (wf.isArchived) return false;
      const matchesSearch = wfSearchTerm === '' ||
        wf.name.toLowerCase().includes(wfSearchTerm.toLowerCase()) ||
        (wf.description && wf.description.toLowerCase().includes(wfSearchTerm.toLowerCase()));
      const matchesStatus = wfStatusFilter.length === 0 || wfStatusFilter.includes(wf.status);
      const matchesCategory = wfCategoryFilter.length === 0 || (wf.category && wfCategoryFilter.includes(wf.category));
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [workflows, wfSearchTerm, wfStatusFilter, wfCategoryFilter]);

  const handleSave = () => {
    if (!newWorkflow.name) return;
    
    const finalCondition = conditionRules.rules.length > 0 
      ? JSON.stringify(conditionRules) 
      : newWorkflow.condition;

    if (editingWorkflowId) {
      updateWorkflow(editingWorkflowId, {
        ...newWorkflow,
        condition: finalCondition
      });
    } else {
      addWorkflow({
        ...newWorkflow,
        condition: finalCondition
      });
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
          id: 'action_' + Date.now(),
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
    
    // Migrate old format to new format if needed
    let actions = wf.actions;
    if (!actions || actions.length === 0) {
      actions = [
        {
          id: 'action_' + Date.now(),
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
      alert('Test completed successfully! The workflow conditions were met and the action was simulated.');
      setIsTesting(null);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Workflow Automation</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Automate your sales processes with triggers and actions.</p>
        </div>
        <div className="flex gap-3">
          {canCreateWorkflow && (
            <button 
              onClick={handleCreateVisualFlow}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-600 hover:to-indigo-600 dark:text-white px-4 py-2.5 rounded-full text-sm font-medium transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]"
            >
              <Compass size={18} className="animate-spin-slow" /> Visual Designer 🗺️
            </button>
          )}
          {canCreateWorkflow && (
            <button 
              onClick={() => setIsRecipesOpen(true)}
              className="flex items-center gap-2 bg-gray-50 dark:bg-white/[0.05] text-slate-900 dark:text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-gray-200 dark:bg-white/10 transition-colors border border-gray-200 dark:border-white/[0.05]"
            >
              <FileText size={18} /> Recipes
            </button>
          )}
          {canCreateWorkflow && (
            <button 
              onClick={() => {
                resetForm();
                setEditingWorkflowId(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#0A6EFF] text-slate-900 dark:text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]"
            >
              <Plus size={18} /> Create Workflow
            </button>
          )}
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
          />
        </div>
      </div>

      {isRecipesOpen && (
        <WorkflowRecipesModal
          onClose={() => setIsRecipesOpen(false)}
          onAddWorkflow={addWorkflow}
        />
      )}

      {/* Automation Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Hours Saved</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {workflows.reduce((acc, wf) => acc + (wf.executionCount * 0.25), 0).toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">hours</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-green-400">
            <Zap size={12} />
            <span>+12% from last month</span>
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Zap size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Automation Success Rate</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">98.4%</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full w-[98.4%] shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <History size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Automations</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {workflows.filter(w => w.status === 'active').length}
            </span>
            <span className="text-xs text-slate-500">running</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-white/20 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400">
                  {i}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">Across 3 departments</span>
          </div>
        </div>
      </div>

      {filteredWorkflows.length === 0 ? (
        <div className="py-12">
          <EmptyState
            type="workflows"
            title={workflows.filter(wf => !wf.isArchived).length === 0 ? "Create Your First Automated Workflow" : "No Workflows Match Your Filters"}
            description={workflows.filter(wf => !wf.isArchived).length === 0 ? "Connect real-time data triggers like New Contact with actions such as Send Automation Email, Create Task, or Update Deal state without writing any code." : "Try adjusting your filters to find what you're looking for."}
            actionLabel="Create Custom Workflow"
            onAction={() => setIsModalOpen(true)}
            secondaryActionLabel="Explore Recipe Templates"
            onSecondaryAction={() => setIsRecipesOpen(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredWorkflows.map(wf => (
            <div key={wf.id} className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6 flex flex-col hover:border-[#0A6EFF]/50 transition-all group shadow-lg backdrop-blur-xl hover:shadow-[0_8px_30px_rgba(10,110,255,0.1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#0A6EFF]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${wf.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-gray-50 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-gray-200 dark:border-white/[0.05]'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-slate-900 dark:text-white text-lg group-hover:text-[#0A6EFF] transition-colors">{wf.name}</h3>
                      {wf.category && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          wf.category === 'Security' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          wf.category === 'Telecom' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          wf.category === 'IT' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
                        }`}>
                          {wf.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {canEditWorkflow && (
                  <button 
                    onClick={() => updateWorkflow(wf.id, { status: wf.status === 'active' ? 'paused' : 'active' })}
                    className={`p-2 rounded-lg transition-colors border ${wf.status === 'active' ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20' : 'bg-gray-50 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-white/10 border-gray-200 dark:border-white/[0.05]'}`}
                    title={wf.status === 'active' ? 'Pause Workflow' : 'Activate Workflow'}
                  >
                    {wf.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 flex-1 leading-relaxed">{wf.description}</p>
              
                {/* Visual Workflow Path */}
              <div className="space-y-0 mb-6 relative pl-4">
                <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-amber-500/50 z-0"></div>
                
                <div className="relative z-10 flex items-start gap-4 pb-4">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mt-1 shrink-0 bg-gray-50 dark:bg-[#030712]">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                  </div>
                  <div className="bg-white dark:bg-white/[0.02] p-3 rounded-xl border border-gray-200 dark:border-white/[0.05] flex-1 shadow-inner">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">Trigger</span>
                    <span className="text-sm text-slate-900 dark:text-white font-medium">{wf.trigger.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                
                {(wf.actions || [{ type: wf.action, delay: wf.delay, delayUnit: wf.delayUnit }]).map((act: any, index: number) => (
                  <React.Fragment key={act.id || index}>
                    {act.delay && act.delay > 0 && (
                      <div className="relative z-10 flex items-start gap-4 pb-4">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mt-1 shrink-0 bg-gray-50 dark:bg-[#030712]">
                          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                        </div>
                        <div className="bg-white dark:bg-white/[0.02] p-3 rounded-xl border border-gray-200 dark:border-white/[0.05] flex-1 shadow-inner">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">Delay</span>
                          <span className="text-sm text-slate-900 dark:text-white font-medium">{act.delay} {act.delayUnit}</span>
                        </div>
                      </div>
                    )}
                    <div className="relative z-10 flex items-start gap-4 pb-4">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center mt-1 shrink-0 bg-gray-50 dark:bg-[#030712]">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                      </div>
                      <div className="bg-white dark:bg-white/[0.02] p-3 rounded-xl border border-gray-200 dark:border-white/[0.05] flex-1 shadow-inner">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">Action {index + 1}</span>
                        <span className="text-sm text-slate-900 dark:text-white font-medium">{act.type?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-gray-50 dark:bg-white/[0.05] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.05]">{wf.executionCount} executions</span>
                  <button 
                    onClick={() => setSelectedWorkflowForLog(wf.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#0A6EFF] hover:text-blue-400 transition-colors"
                  >
                    <History size={14} /> Run Log
                  </button>
                  <button 
                    onClick={() => handleOpenVisualBuilderNode(wf)}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-500 hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    <Compass size={14} /> Visual Flow 🗺️
                  </button>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setActiveDropdown(activeDropdown === wf.id ? null : wf.id)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-2 hover:bg-gray-200 dark:bg-white/10 rounded-lg transition-colors"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {activeDropdown === wf.id && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-blue-50 dark:bg-[#0A1931] border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                      {canExecuteWorkflow && (
                        <button onClick={() => handleTest(wf.id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors">
                          {isTesting === wf.id ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> : <FlaskConical size={16} />}
                          Test Workflow
                        </button>
                      )}
                      {canEditWorkflow && (
                        <button onClick={() => handleEdit(wf)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <Edit2 size={16} /> Edit Form
                        </button>
                      )}
                      {canEditWorkflow && (
                        <button onClick={() => { handleOpenVisualBuilderNode(wf); setActiveDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <Compass size={16} className="text-blue-500" /> Edit Visually 🗺️
                        </button>
                      )}
                      {canDeleteWorkflow && (
                        <button onClick={() => handleDelete(wf.id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={16} /> Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Settings size={20} className="text-[#0A6EFF]" />
          Automation Output (Recent Tasks)
        </h3>
        <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] overflow-hidden backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Related Deal</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {tasks.slice().reverse().map(task => {
                const deal = deals.find(d => d.id === task.dealId);
                const assignedUser = users.find(u => u.id === task.assignedUserId);
                return (
                  <tr key={task.id} className="hover:bg-white dark:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-[#0A6EFF] transition-colors">{task.title}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{task.description}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{deal?.title || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'System'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        task.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">{task.dueDate}</td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">No automated tasks generated yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 dark:bg-[#030712] rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{editingWorkflowId ? 'Edit Workflow' : 'Create Workflow'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Define trigger and action for automation.</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); resetForm(); setEditingWorkflowId(null); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Workflow Name</label>
                  <input 
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all" 
                    placeholder="e.g. Welcome Email" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                  <select 
                    value={newWorkflow.category}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, category: e.target.value as any })}
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all"
                  >
                    <option className="bg-gray-50 dark:bg-[#030712]" value="General">General</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="Security">Security</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="Telecom">Telecom</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="IT">IT</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
                <textarea 
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm h-20" 
                  placeholder="What does this workflow do?"
                />
              </div>

              <div className="bg-white dark:bg-white/[0.02] p-5 rounded-xl border border-gray-200 dark:border-white/[0.05] space-y-4 relative shadow-inner">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">When this happens (Trigger)</label>
                  <select 
                    value={newWorkflow.trigger}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.2] transition-all"
                  >
                    <option className="bg-gray-50 dark:bg-[#030712]" value="lead_created">Contact Created</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_created">Deal Created</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_stage_qualified">Deal Reached Qualified</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_stage_proposal">Deal Reached Proposal</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_stage_negotiation">Deal Reached Negotiation</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_stage_won">Deal Won (Closed Won)</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_stage_lost">Deal Lost (Closed Lost)</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="deal_expected_close_date_approaching">Deal Expected Close Date Approaching (Time-based close/follow-up)</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="lead_expected_close_date_approaching">Contact Expected Close Date Approaching (Time-based check)</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="email_opened">Email Opened</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="meeting_scheduled">Meeting Scheduled</option>
                    <option className="bg-gray-50 dark:bg-[#030712]" value="tag_added">Tag Added</option>
                  </select>
                </div>
                
                <div className="absolute left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-full flex items-center justify-center z-10 shadow-lg">
                  <ArrowRight size={14} className="text-slate-500 dark:text-slate-400 rotate-90" />
                </div>
              </div>

              <div className="pl-6 border-l-2 border-gray-200 dark:border-white/[0.05] ml-6 py-2 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Only if (Conditions)</label>
                  <button 
                    type="button"
                    onClick={() => setConditionRules({ ...conditionRules, rules: [...conditionRules.rules, { field: 'deal.value', operator: '>', value: '0' }] })}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Rule
                  </button>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-300 rounded-2xl p-3.5 text-xs flex items-start gap-2.5">
                  <span className="text-sm mt-0.5" id="saas-badge-icon">💡</span>
                  <div>
                    <span className="font-bold block mb-1">SaaS Cross-Entity Resolution Active</span>
                    <p className="opacity-90 leading-relaxed text-[11px]">
                      Trigger criteria automatically match fields across corresponding Contacts and Deals by cross-referencing company names & contact details. This ensures current and future newly created automations match seamlessly without complex mapping.
                    </p>
                  </div>
                </div>

                {conditionRules.rules.length > 0 ? (
                  <div className="space-y-3 bg-white dark:bg-white/[0.02] p-4 rounded-xl border border-gray-200 dark:border-white/[0.05]">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Match</span>
                      <select 
                        value={conditionRules.logic}
                        onChange={(e) => setConditionRules({ ...conditionRules, logic: e.target.value as any })}
                        className="bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded px-2 py-0.5 text-[10px] text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="AND">All (AND)</option>
                        <option value="OR">Any (OR)</option>
                      </select>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">of the following:</span>
                    </div>

                    {conditionRules.rules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select 
                          value={rule.field}
                          onChange={(e) => {
                            const newRules = [...conditionRules.rules];
                            newRules[idx].field = e.target.value;
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="flex-1 bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                        >
                          <optgroup label="Deal Fields">
                            <option value="deal.title">Deal Title</option>
                            <option value="deal.value">Deal Value ($)</option>
                            <option value="deal.daysUntilClose">Days until Expected Close Date</option>
                            <option value="deal.expectedCloseDate">Expected Close Date (YYYY-MM-DD)</option>
                            <option value="deal.priority">Priority (Low/Medium/High)</option>
                            <option value="deal.companyName">Company Name</option>
                            <option value="deal.contactPerson">Contact Person</option>
                          </optgroup>
                          <optgroup label="Contact Fields">
                            <option value="contact.score">Contact Score (0-100)</option>
                            <option value="contact.estimatedValue">Est. Value ($)</option>
                            <option value="contact.daysUntilClose">Days until Expected Close Date</option>
                            <option value="contact.expectedCloseDate">Expected Close Date (YYYY-MM-DD)</option>
                            <option value="contact.status">Contact Status (Hot/Warm/Cold)</option>
                            <option value="contact.leadSource">Contact Source</option>
                            <option value="contact.serviceRequired">Service Required</option>
                            <option value="contact.companyName">Company Name</option>
                            <option value="contact.contactPerson">Contact Person</option>
                            <option value="contact.email">Contact Email</option>
                          </optgroup>
                        </select>

                        <select 
                          value={rule.operator}
                          onChange={(e) => {
                            const newRules = [...conditionRules.rules];
                            newRules[idx].operator = e.target.value;
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="w-28 bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value=">">Gr. Than (&gt;)</option>
                          <option value="<">Less Than (&lt;)</option>
                          <option value=">=">Gr. or Eq (&gt;=)</option>
                          <option value="<=">Less or Eq (&lt;=)</option>
                          <option value="==">Equals (==)</option>
                          <option value="!=">Not Equals (!=)</option>
                          <option value="contains">contains</option>
                          <option value="not_contains">doesn't contain</option>
                          <option value="starts_with">starts with</option>
                          <option value="ends_with">ends with</option>
                          <option value="is_empty">is empty</option>
                          <option value="is_not_empty">is not empty</option>
                        </select>

                        {(rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty') ? (
                          <input 
                            value={rule.value}
                            onChange={(e) => {
                              const newRules = [...conditionRules.rules];
                              newRules[idx].value = e.target.value;
                              setConditionRules({ ...conditionRules, rules: newRules });
                            }}
                            className="flex-1 bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                            placeholder="Value"
                          />
                        ) : (
                          <div className="flex-1 border border-dashed border-gray-200 dark:border-white/[0.08] rounded px-2 py-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500 italic bg-gray-100/50 dark:bg-white/[0.01]">
                            Value neglected
                          </div>
                        )}

                        <button 
                          type="button"
                          onClick={() => {
                            const newRules = conditionRules.rules.filter((_, i) => i !== idx);
                            setConditionRules({ ...conditionRules, rules: newRules });
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <input 
                    value={newWorkflow.condition}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, condition: e.target.value })}
                    className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm" 
                    placeholder="e.g. deal value > 5000 or contact score > 80" 
                  />
                )}
              </div>

              <div className="space-y-4">
                {newWorkflow.actions.map((action: any, index: number) => (
                  <div key={action.id} className="bg-white dark:bg-white/[0.02] p-5 rounded-xl border border-gray-200 dark:border-white/[0.05] space-y-4 shadow-inner relative">
                    {index > 0 && (
                      <button 
                        type="button"
                        onClick={() => {
                          const newActions = [...newWorkflow.actions];
                          newActions.splice(index, 1);
                          setNewWorkflow({ ...newWorkflow, actions: newActions });
                        }}
                        className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {index === 0 ? 'Then do this (Action)' : `Then do this (Action ${index + 1})`}
                      </label>
                      <select 
                        value={action.type}
                        onChange={(e) => {
                          const newActions = [...newWorkflow.actions];
                          newActions[index].type = e.target.value;
                          setNewWorkflow({ ...newWorkflow, actions: newActions });
                        }}
                        className="w-full bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.2] transition-all"
                      >
                        <option className="bg-gray-50 dark:bg-[#030712]" value="send_email">Send Email</option>
                        <option className="bg-gray-50 dark:bg-[#030712]" value="send_sms">Send SMS</option>
                        <option className="bg-gray-50 dark:bg-[#030712]" value="create_task">Create Task</option>
                        <option className="bg-gray-50 dark:bg-[#030712]" value="update_lead_status">Update Contact Status</option>
                        <option className="bg-gray-50 dark:bg-[#030712]" value="add_tag">Add Tag</option>
                        <option className="bg-gray-50 dark:bg-[#030712]" value="send_slack_notification">Send Slack Notification</option>
                        <option className="bg-gray-50 dark:bg-[#030712]" value="webhook">Trigger Webhook</option>
                      </select>
                    </div>

                    {action.type === 'create_task' && (
                      <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Title</label>
                          <input 
                            value={action.config?.taskTitle || ''}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, taskTitle: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm" 
                            placeholder="e.g. Follow up with contact" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Description</label>
                          <textarea 
                            value={action.config?.taskDescription || ''}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, taskDescription: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm h-20" 
                            placeholder="Details about the task..." 
                          />
                        </div>
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Available Merge Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {['[Deal Name]', '[Contact Name]', '[Contact Person]', '[Company Name]', '[Value]', '[Score]'].map(tag => (
                              <button 
                                key={tag}
                                onClick={() => {
                                  const currentDesc = action.config?.taskDescription || '';
                                  const newActions = [...newWorkflow.actions];
                                  newActions[index].config = { 
                                    ...newActions[index].config, 
                                    taskDescription: currentDesc + (currentDesc ? ' ' : '') + tag 
                                  };
                                  setNewWorkflow({ ...newWorkflow, actions: newActions });
                                }}
                                className="text-[10px] bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-1 rounded border border-white/10 transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <p className="text-[9px] text-slate-500 mt-2 italic">Click a tag to add it to the description.</p>
                        </div>
                      </div>
                    )}

                    {(action.type === 'send_email' || action.type === 'send_sms') && (
                      <div className="pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select {action.type === 'send_email' ? 'Email' : 'SMS'} Template</label>
                        <select 
                          value={action.config?.templateId || ''}
                          onChange={(e) => {
                            const newActions = [...newWorkflow.actions];
                            newActions[index].config = { ...newActions[index].config, templateId: e.target.value };
                            setNewWorkflow({ ...newWorkflow, actions: newActions });
                          }}
                          className="w-full bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.2] transition-all"
                        >
                          <option value="">Select a template...</option>
                          {templates.filter(t => t.type === (action.type === 'send_email' ? 'Email' : 'SMS')).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {action.type === 'update_lead_status' && (
                      <div className="pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target CRM Contact Status</label>
                        <select 
                          value={action.config?.targetStatus || 'Hot'}
                          onChange={(e) => {
                            const newActions = [...newWorkflow.actions];
                            newActions[index].config = { ...newActions[index].config, targetStatus: e.target.value };
                            setNewWorkflow({ ...newWorkflow, actions: newActions });
                          }}
                          className="w-full bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.2] transition-all"
                        >
                          <option value="Hot">Hot</option>
                          <option value="Warm">Warm</option>
                          <option value="Cold">Cold</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Closed">Closed (Converted)</option>
                        </select>
                      </div>
                    )}

                    {action.type === 'add_tag' && (
                      <div className="pt-2 border-t border-gray-200 dark:border-white/[0.05] space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tag to AppendLabel</label>
                          <input 
                            value={action.config?.tagName || ''}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, tagName: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm" 
                            placeholder="e.g. enterprise-deal" 
                          />
                        </div>
                      </div>
                    )}

                    {action.type === 'send_slack_notification' && (
                      <div className="pt-2 border-t border-gray-200 dark:border-white/[0.05] space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Slack Destination Channel ID</label>
                          <input 
                            value={action.config?.slackChannel || ''}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, slackChannel: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm" 
                            placeholder="e.g. #sales-alerts" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Slack Message Body</label>
                          <textarea 
                            value={action.config?.slackMessage || ''}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, slackMessage: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm h-20" 
                            placeholder="Type markdown messaging... Supports merge tags like [Company Name]" 
                          />
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Available Merge Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {['[Deal Name]', '[Contact Name]', '[Contact Person]', '[Company Name]', '[Value]', '[Score]'].map(tag => (
                              <button 
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const currentMsg = action.config?.slackMessage || '';
                                  const newActions = [...newWorkflow.actions];
                                  newActions[index].config = { 
                                    ...newActions[index].config, 
                                    slackMessage: currentMsg + (currentMsg ? ' ' : '') + tag 
                                  };
                                  setNewWorkflow({ ...newWorkflow, actions: newActions });
                                }}
                                className="text-[10px] bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-1 rounded border border-white/10 transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {action.type === 'webhook' && (
                      <div className="pt-2 border-t border-gray-200 dark:border-white/[0.05] space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Webhook Endpoint HTTP URL</label>
                          <input 
                            value={action.config?.webhookUrl || ''}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, webhookUrl: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm" 
                            placeholder="https://api.myapp.com/v1/alert" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">HTTP Method</label>
                          <select 
                            value={action.config?.webhookMethod || 'POST'}
                            onChange={(e) => {
                              const newActions = [...newWorkflow.actions];
                              newActions[index].config = { ...newActions[index].config, webhookMethod: e.target.value };
                              setNewWorkflow({ ...newWorkflow, actions: newActions });
                            }}
                            className="w-full bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.2] transition-all"
                          >
                            <option value="POST">POST (Send JSON payload)</option>
                            <option value="GET">GET (Query REST status)</option>
                            <option value="PUT">PUT (Update resource)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-200 dark:border-white/[0.05] grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Delay Before Action (Optional)</label>
                        <input 
                          type="number"
                          value={action.delay || 0}
                          onChange={(e) => {
                            const newActions = [...newWorkflow.actions];
                            newActions[index].delay = parseInt(e.target.value) || 0;
                            setNewWorkflow({ ...newWorkflow, actions: newActions });
                          }}
                          className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.1] focus:bg-white/[0.04] transition-all text-sm" 
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit</label>
                        <select 
                          value={action.delayUnit || 'minutes'}
                          onChange={(e) => {
                            const newActions = [...newWorkflow.actions];
                            newActions[index].delayUnit = e.target.value;
                            setNewWorkflow({ ...newWorkflow, actions: newActions });
                          }}
                          className="w-full bg-gray-50 dark:bg-[#030712] border border-gray-300 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-gray-300 dark:border-white/[0.2] transition-all"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-center">
                  <button 
                    type="button" 
                    onClick={() => {
                      setNewWorkflow({
                        ...newWorkflow,
                        actions: [
                          ...newWorkflow.actions,
                          {
                            id: 'action_' + Date.now(),
                            type: 'send_email',
                            delay: 0,
                            delayUnit: 'minutes',
                            config: { taskTitle: '', taskDescription: '', templateId: '' }
                          }
                        ]
                      });
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2 rounded-lg border border-gray-200 dark:border-white/[0.05] border-dashed hover:border-gray-300 dark:border-white/[0.2] bg-white dark:bg-white/[0.02]"
                  >
                    <GitMerge size={16} /> Add Another Action
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#030712]">
              <button onClick={() => { setIsModalOpen(false); resetForm(); setEditingWorkflowId(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:bg-white/5 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-[#0A6EFF] text-slate-900 dark:text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                {editingWorkflowId ? 'Save Changes' : 'Save Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWorkflowForLog && (
        <WorkflowExecutionLogModal
          workflowId={selectedWorkflowForLog}
          workflows={workflows}
          executions={workflowExecutions}
          onClose={() => setSelectedWorkflowForLog(null)}
        />
      )}
      {pendingActions.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Scheduled Automations</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Workflows waiting for their delay to expire.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingActions.map(pa => {
              const wf = workflows.find(w => w.id === pa.workflowId);
              return (
                <div key={pa.id} className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl p-4 flex items-center justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/5 flex items-center justify-center text-amber-500 border border-amber-500/10">
                      <Zap size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white">{wf?.name || 'Unknown Workflow'}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> Executes at {new Date(pa.executeAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                    Pending
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
