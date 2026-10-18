'use client';

import { conditionOperatorLabel, findTrigger, getAvailableActions, getWorkflowConditionFields, getWorkflowUpdateFields, WORKFLOW_MODULES,
  type WorkflowDraft, type WorkflowEntity, type WorkflowOptions } from '@leadcrm/shared';
import { safeMailboxHtml } from '@/features/tenant/inbox/services/email-html';
import { references, workflowActionLabel } from '../services/workflow-editor';

export const emptySnapshotOptions: WorkflowOptions = { users: [], pipelines: [], templates: [], campaigns: [] };
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
const methods: Record<string, string> = { round_robin: 'Round-robin', least_workload: 'Least workload', random: 'Random', availability: 'Availability-based', capacity: 'Capacity-based', sticky: 'Previous assignee / Sticky assignment' };
const referenceTypes: Record<string, string> = { id: 'user', userId: 'user', assignedUserId: 'user', pipelineId: 'pipeline', stageId: 'stage', currentStageId: 'stage', templateId: 'template', productInterestId: 'products', productInterestIds: 'products', campaignId: 'campaign', accountId: 'account', contactIds: 'contacts', leadIds: 'leads' };

function SnapshotValue({ value, fieldKey = '', referenceType, options, depth = 0 }: { value: unknown; fieldKey?: string; referenceType?: string; options: WorkflowOptions; depth?: number }) {
  if (value == null) return <span className="text-muted-foreground">Not set</span>;
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  if (depth > 10) return <span>Additional nested settings</span>;
  if (Array.isArray(value)) return value.length ? <ul className="list-inside list-disc space-y-1">{value.map((item, index) => <li key={index}><SnapshotValue value={item} fieldKey={fieldKey} referenceType={referenceType} options={options} depth={depth + 1} /></li>)}</ul> : <>None</>;
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    const type = String((value as { type?: unknown }).type ?? '');
    return <dl className="space-y-2 border-l border-border pl-3">{entries.map(([key, item]) => <div key={key}><dt className="text-xs text-muted-foreground">{label(key)}</dt><dd className="mt-0.5">
      {key === 'id' && ['role', 'group'].includes(type) ? (options[type === 'role' ? 'roles' : 'groups']?.find(option => option.id === item)?.name ?? `Unavailable ${type} (${String(item)})`)
        : <SnapshotValue value={item} fieldKey={key} options={options} depth={depth + 1} />}
    </dd></div>)}</dl>;
  }
  if (fieldKey === 'strategy') return <>{methods[String(value)] ?? label(String(value))}</>;
  if (fieldKey === 'type') return <>{value === 'record_owner' ? 'Current record agent' : label(String(value))}</>;
  if (['recipient', 'targetMode'].includes(fieldKey)) return <>{label(String(value))}</>;
  const type = referenceType ?? referenceTypes[fieldKey];
  if (type && typeof value === 'string' && value) {
    const choices = references(type, options);
    return <>{choices?.find(option => option.id === value)?.name ?? `Unavailable ${type} (${value})`}</>;
  }
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(value) || 'Empty text'}</span>;
}

/** Never normalize historical definitions using the current editor's defaults. */
export function WorkflowDefinitionSummary({ definition, options = emptySnapshotOptions }: { definition: WorkflowDraft; options?: WorkflowOptions }) {
  const trigger = findTrigger(definition.trigger);
  const entity = (trigger?.entity ?? definition.trigger.split('.')[0]) as WorkflowEntity;
  const validEntity = ['lead', 'contact', 'account', 'deal'].includes(entity);
  const fields = validEntity ? getWorkflowConditionFields(entity, definition.trigger, options.customFields, options.fieldLayouts?.[WORKFLOW_MODULES[entity]]) : [];
  const updateFields = validEntity ? getWorkflowUpdateFields(entity, options.customFields, options.fieldLayouts?.[WORKFLOW_MODULES[entity]]) : [];
  const rules = Array.isArray(definition.conditions?.conditions) ? definition.conditions.conditions : [];
  const historicalConditions = definition.conditions != null && !Array.isArray(definition.conditions.conditions);
  return <div className="mt-3 min-w-0 space-y-4 rounded-xl border border-border bg-muted/20 p-3 text-sm">
    <p className="font-medium">{definition.name}</p>
    {definition.description && <p className="whitespace-pre-wrap text-muted-foreground">{definition.description}</p>}
    <p className="text-xs text-muted-foreground">Saved settings from this run. Reference names reflect currently available records.</p>
    <section aria-label="Saved trigger"><h4 className="font-semibold">Trigger</h4><p className="mt-1">{trigger?.label ?? label(definition.trigger.replaceAll('.', ' '))}</p></section>
    <section aria-label="Saved conditions"><h4 className="font-semibold">Conditions</h4>
      {historicalConditions ? <div className="mt-2"><p className="mb-2 text-xs text-muted-foreground">Historical condition settings</p><SnapshotValue value={definition.conditions} options={options} /></div> : rules.length ? <><p className="mt-1 text-xs text-muted-foreground">{definition.conditions?.operator === 'OR' ? 'Match any condition' : 'Match all conditions'}</p><ul className="mt-2 space-y-2">{rules.map((rule, index) => {
        const field = fields.find(field => field.field === rule.field);
        return <li key={index} className="rounded-lg border border-border bg-card p-2 [overflow-wrap:anywhere]"><span className="font-medium">{field?.label ?? `Unavailable field (${rule.field})`}</span>{' '}{conditionOperatorLabel(rule.operator, 'summary', field?.type === 'date' ? 'date' : undefined)}{' '}
          {!['is_empty', 'is_not_empty'].includes(rule.operator) && <SnapshotValue value={field?.optionLabels?.[String(rule.value)] ?? rule.value} referenceType={field?.type && references(field.type, options) ? field.type : undefined} options={options} />}</li>;
      })}</ul></> : <p className="mt-1 text-muted-foreground">No conditions. Runs whenever the trigger matches.</p>}
    </section>
    <section aria-label="Saved actions"><h4 className="font-semibold">Actions</h4><ol className="mt-2 space-y-3">{(definition.actions ?? []).map((action, index) => {
      const descriptor = getAvailableActions().find(entry => entry.type === action.type);
      const config = action.config ?? {};
      const updateField = updateFields.find(field => field.field === config.field);
      const messages = Object.entries(config).filter(([key]) => ['body', 'message', 'description'].includes(key));
      const settings = Object.entries(config).filter(([key]) => !['body', 'message', 'description'].includes(key) && !(action.type === 'send_email' && key === 'senderUserId'));
      return <li key={index} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
        <p className="flex flex-wrap items-center gap-2 font-medium">{index + 1}. {workflowActionLabel(action.type)}<span className="rounded bg-muted px-2 py-0.5 text-xs font-normal">{action.enabled === false ? 'Disabled' : 'Enabled'}</span></p>
        <dl className="space-y-2">{settings.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{descriptor?.configSchema[key]?.label ?? label(key)}</dt><dd className="mt-0.5 [overflow-wrap:anywhere]">
          {key === 'field' ? updateFields.find(field => field.field === value)?.label ?? `Unavailable field (${String(value)})`
            : key === 'value' && config.clear === true ? 'Clear this field'
            : key === 'assignmentTarget' ? <details><summary className="cursor-pointer">Assignment settings</summary><div className="mt-2"><SnapshotValue value={value} options={options} /></div></details>
            : <SnapshotValue value={key === 'value' ? updateField?.optionLabels?.[String(value)] ?? value : value} fieldKey={key} referenceType={key === 'value' && updateField && references(updateField.type, options) ? updateField.type : undefined} options={options} />}
        </dd></div>)}</dl>
        {messages.map(([key, value]) => <details key={key}><summary className="cursor-pointer text-xs font-medium">{descriptor?.configSchema[key]?.label ?? label(key)}</summary>{key === 'body' && typeof value === 'string'
          ? <div className="mt-2 space-y-2 break-words text-sm [&_a]:underline" dangerouslySetInnerHTML={{ __html: safeMailboxHtml(value) }} />
          : <div className="mt-2"><SnapshotValue value={value} options={options} /></div>}</details>)}
        {!settings.length && !messages.length && <p className="text-xs text-muted-foreground">No additional settings.</p>}
      </li>;
    })}</ol>{!definition.actions?.length && <p className="mt-1 text-muted-foreground">No actions configured.</p>}</section>
  </div>;
}
