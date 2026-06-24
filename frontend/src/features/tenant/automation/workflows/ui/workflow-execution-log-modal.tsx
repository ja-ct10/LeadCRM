import React from 'react';
import { X, History, Clock, FileText } from 'lucide-react';
import { Workflow, WorkflowExecution } from '@/store/types';

interface WorkflowExecutionLogModalProps {
  workflowId: string;
  workflows: Workflow[];
  executions: WorkflowExecution[];
  onClose: () => void;
}

export function WorkflowExecutionLogModal({
  workflowId,
  workflows,
  executions,
  onClose,
}: WorkflowExecutionLogModalProps) {
  const workflowName = workflows.find(w => w.id === workflowId)?.name ?? 'Unknown Workflow';
  const relevantExecutions = executions.filter(ex => ex.workflowId === workflowId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#0A6EFF]/10 text-[#0A6EFF] border border-[#0A6EFF]/20">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Execution Log</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{workflowName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {relevantExecutions.length > 0 ? (
            relevantExecutions.map(ex => (
              <div
                key={ex.id}
                className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      ex.status === 'success'
                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                    }`} />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {ex.status === 'success' ? 'Executed Successfully' : 'Execution Failed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={12} />
                    {new Date(ex.timestamp).toLocaleString()}
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{ex.details}</p>
                {ex.relatedEntityId && (
                  <div className="flex items-center gap-2 text-xs text-[#0A6EFF] bg-[#0A6EFF]/5 px-2 py-1 rounded-md border border-[#0A6EFF]/10 w-fit">
                    <FileText size={12} />
                    Related ID: {ex.relatedEntityId}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white dark:bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-white/[0.05]">
                <History size={24} className="text-slate-600" />
              </div>
              <p className="text-slate-500 italic">No executions recorded for this workflow yet.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-50 dark:bg-white/[0.05] text-slate-900 dark:text-white text-sm font-medium rounded-lg hover:bg-gray-200 dark:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
