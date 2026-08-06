import { uuid } from '@/lib/utils';
import React from 'react';
import { Zap, Plus } from 'lucide-react';
import { ModalCloseButton } from '@/shared/components/ui/modal-close-button';

interface WorkflowAction {
  id: string;
  type: string;
  delay: number;
  delayUnit: string;
  config: {
    taskTitle: string;
    taskDescription: string;
    templateId: string;
  };
}

interface WorkflowRecipe {
  name: string;
  desc: string;
  trigger: string;
  action: string;
  category: string;
  condition?: string;
  delay?: number;
  delayUnit?: string;
}

interface WorkflowRecipesModalProps {
  onClose: () => void;
  onAddWorkflow: (workflow: {
    name: string;
    description: string;
    trigger: string;
    condition: string;
    category: string;
    status: string;
    actions: WorkflowAction[];
  }) => void;
}

const WORKFLOW_RECIPES: WorkflowRecipe[] = [
  {
    name: 'Security: Site Survey Follow-up',
    desc: 'Create a task for survey 1 day after a deal reaches Qualified.',
    trigger: 'deal_stage_qualified',
    action: 'create_task',
    delay: 1,
    delayUnit: 'days',
    category: 'Security',
  },
  {
    name: 'Telecom: Welcome SMS',
    desc: 'Send a welcome SMS immediately when a new contact is created.',
    trigger: 'lead_created',
    action: 'send_sms',
    category: 'Telecom',
  },
  {
    name: 'IT: Maintenance Renewal',
    desc: 'Create a renewal task 30 days before contract expiry (Demo).',
    trigger: 'deal_created',
    action: 'create_task',
    delay: 30,
    delayUnit: 'days',
    category: 'IT',
  },
  {
    name: 'General: High Value Alert',
    desc: 'Notify manager if a deal > $50,000 is created.',
    trigger: 'deal_created',
    condition: 'deal value > 50000',
    action: 'create_task',
    category: 'General',
  },
  {
    name: 'General: Deal Expiry Alarm',
    desc: 'Auto trigger task follow-up 3 days before expected close date.',
    trigger: 'deal_expected_close_date_approaching',
    condition: '{"logic":"AND","rules":[{"field":"deal.daysUntilClose","operator":"<=","value":"3"}]}',
    action: 'create_task',
    category: 'General',
  },
];

const CATEGORY_STYLES: Record<string, string> = {
  Security: 'bg-red-500/10 text-red-400 border-red-500/20',
  Telecom: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  IT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  General: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
};

export function WorkflowRecipesModal({ onClose, onAddWorkflow }: WorkflowRecipesModalProps) {
  const handleUseRecipe = (recipe: WorkflowRecipe) => {
    onAddWorkflow({
      name: recipe.name,
      description: recipe.desc,
      trigger: recipe.trigger,
      condition: recipe.condition ?? '',
      category: recipe.category,
      status: 'active',
      actions: [
        {
          id: uuid(),
          type: recipe.action,
          delay: recipe.delay ?? 0,
          delayUnit: recipe.delayUnit ?? 'minutes',
          config: {
            taskTitle: recipe.name,
            taskDescription: recipe.desc,
            templateId: '',
          },
        },
      ],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-300 dark:border-white/[0.1] w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Workflow Recipes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Pre-configured automations for your industry.
              </p>
            </div>
          </div>
          <ModalCloseButton onClose={onClose} ariaLabel="Close recipe modal" size={20} />
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          {WORKFLOW_RECIPES.map((recipe, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl p-5 hover:border-purple-500/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[recipe.category] ?? CATEGORY_STYLES.General}`}>
                  {recipe.category}
                </span>
                <button
                  onClick={() => handleUseRecipe(recipe)}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                >
                  Use Recipe <Plus size={12} />
                </button>
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-purple-400 transition-colors">
                {recipe.name}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">{recipe.desc}</p>
            </div>
          ))}
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
