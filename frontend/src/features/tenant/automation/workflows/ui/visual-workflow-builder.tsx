'use client';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { WorkflowDraftSchema, WorkflowConditionOperatorSchema, type WorkflowDraft, type ActionDefinition, type TriggerDefinition, type WorkflowAction } from '@leadcrm/shared';
import { useData } from '@/store/DataContext';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { WorkflowDialog } from './workflow-dialog';
import { useCampaignsData } from '@/features/tenant/marketing/campaigns/hooks/use-campaigns-data';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Template } from '@/store/types';
const control = 'w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
interface WorkflowBuilderProps {
  initial: WorkflowDraft; triggers: TriggerDefinition[]; actions: ActionDefinition[];
  canActivate: boolean; readOnly?: boolean; onSave: (draft: WorkflowDraft) => Promise<void>; onClose: () => void;
}
export default function WorkflowBuilder({ initial, triggers, actions: definitions, canActivate, readOnly, onSave, onClose }: WorkflowBuilderProps) {
  const form = useForm<WorkflowDraft>({ defaultValues: { ...initial, conditions: initial.conditions ?? { operator: 'AND', conditions: [] } } });
  const actions = useFieldArray({ control: form.control, name: 'actions' });
  const rules = useFieldArray({ control: form.control, name: 'conditions.conditions' });
  const draft = form.watch();
  const templateData = useCampaignsData({ disabled: USE_MOCK_DATA || !draft.actions.some(action => action.type === 'send_email'), intervalMs: 0 });
  const { templates: mockTemplates } = useData();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const trigger = triggers.find(entry => entry.type === draft.trigger);
  async function save(isActive: boolean) {
    const parsed = WorkflowDraftSchema.safeParse({ ...form.getValues(), isActive });
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(' ')); return; }
    setSaving(true); setError('');
    try { await onSave(parsed.data); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save workflow.'); }
    finally { setSaving(false); }
  }
  return <WorkflowDialog title={readOnly ? 'Workflow details' : 'Configure workflow'} onClose={() => { if (!saving) onClose(); }}>
    <form onSubmit={form.handleSubmit(() => save(false))} className="space-y-6">
      <fieldset disabled={readOnly || saving} className="space-y-5">
        <label className="block space-y-1"><span>Workflow name</span><Input {...form.register('name')} /></label>
        <label className="block space-y-1"><span>Description</span><Input {...form.register('description')} /></label>
        <section className="rounded-xl border border-border p-4 space-y-3"><h3 className="font-semibold">WHEN</h3>
          <label className="block space-y-1"><span>Trigger</span><select className={control} value={draft.trigger} onChange={event => {
            form.setValue('trigger', event.target.value); form.setValue('conditions', { operator: 'AND', conditions: [] });
            const entity = triggers.find(entry => entry.type === event.target.value)?.entity;
            actions.replace(draft.actions.filter(action => definitions.some(definition => definition.type === action.type && entity && definition.entities.includes(entity))));
          }}><option value="">Choose a trigger</option>{triggers.map(entry => <option key={entry.type} value={entry.type}>{entry.label}</option>)}</select></label>
        </section>
        <section className="rounded-xl border border-border p-4 space-y-3"><h3 className="font-semibold">IF — optional</h3>
          <label className="block space-y-1"><span>Match conditions</span><select className={control} {...form.register('conditions.operator')}><option value="AND">All conditions (AND)</option><option value="OR">Any condition (OR)</option></select></label>
          {rules.fields.map((rule, index) => {
            const current = draft.conditions?.conditions[index];
            const field = trigger?.fields.find(entry => entry.field === current?.field);
            return <div key={rule.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
              <label>Field<select className={control} aria-label={`Condition ${index + 1} field`} {...form.register(`conditions.conditions.${index}.field`)}><option value="">Choose a field</option>{trigger?.fields.map(entry => <option key={entry.field} value={entry.field}>{entry.label}</option>)}</select></label>
              <label>Operator<select className={control} aria-label={`Condition ${index + 1} operator`} {...form.register(`conditions.conditions.${index}.operator`)}>{WorkflowConditionOperatorSchema.options.map(operator => <option key={operator} value={operator}>{operator.replaceAll('_', ' ')}</option>)}</select></label>
              {!['is_empty', 'is_not_empty'].includes(current?.operator ?? '') && <label>Value<Input aria-label={`Condition ${index + 1} value`} type={field?.type === 'number' ? 'number' : 'text'} value={String(current?.value ?? '')} onChange={event => form.setValue(`conditions.conditions.${index}.value`, field?.type === 'number' ? Number(event.target.value) : event.target.value)} /></label>}
              <Button type="button" variant="ghost" onClick={() => rules.remove(index)}>Remove condition</Button>
            </div>;
          })}
          <Button type="button" variant="outline" disabled={!trigger} onClick={() => rules.append({ field: trigger?.fields[0]?.field ?? '', operator: 'equals', value: '' })}>Add condition</Button>
        </section>
        <section className="rounded-xl border border-border p-4 space-y-3"><h3 className="font-semibold">THEN — in this order</h3>
          {actions.fields.map((action, index) => <div key={action.id} className="rounded-lg border border-border p-4 space-y-3">
            <label>Action {index + 1}<select className={control} aria-label={`Action ${index + 1} type`} value={draft.actions[index].type} onChange={event => form.setValue(`actions.${index}`, { type: event.target.value as WorkflowAction['type'], config: {} })}>
              {definitions.filter(entry => trigger && entry.entities.includes(trigger.entity)).map(entry => <option key={entry.type} value={entry.type}>{entry.label}</option>)}
            </select></label>
            <ActionConfig templates={USE_MOCK_DATA ? mockTemplates : templateData.templates} action={draft.actions[index]} definition={definitions.find(entry => entry.type === draft.actions[index].type)} onChange={config => form.setValue(`actions.${index}.config`, config)} />
            <div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" disabled={index === 0} onClick={() => actions.move(index, index - 1)}>Move up</Button><Button type="button" variant="ghost" disabled={index === actions.fields.length - 1} onClick={() => actions.move(index, index + 1)}>Move down</Button><Button type="button" variant="ghost" onClick={() => actions.remove(index)}>Remove action</Button></div>
          </div>)}
          <Button type="button" variant="outline" onClick={() => actions.append({ type: 'create_task', config: {} })}>Add action</Button>
        </section>
      </fieldset>
      {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
      {templateData.error && <p role="alert">Email templates: {templateData.error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Close</Button>
        {!readOnly && <><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>{canActivate && <Button type="button" disabled={saving} onClick={() => void save(true)}>Save and activate</Button>}</>}
      </div>
    </form>
  </WorkflowDialog>;
}
interface ActionConfigProps { action: WorkflowAction; definition?: ActionDefinition; templates: Template[]; onChange: (config: Record<string, unknown>) => void; }
function ActionConfig({ action, definition, templates, onChange }: ActionConfigProps) {
  const { users, pipelines } = useData();
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">{definition?.description}</p>{Object.entries(definition?.configSchema ?? {}).map(([key, field]) => {
    const options = field.type === 'user' ? users.map(user => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))
      : field.type === 'template' ? templates.filter(template => template.type === 'Email').map(template => ({ id: template.id, label: template.name }))
      : field.type === 'stage' ? pipelines.flatMap(pipeline => pipeline.stages.map(stage => ({ id: stage.id, label: `${pipeline.name} / ${stage.name}` })))
      : field.options?.map(option => ({ id: option, label: option }));
    return <label key={key} className="block space-y-1"><span className="text-sm">{field.label}{field.required ? ' *' : ''}</span>{options
      ? <select className={control} value={String(action.config[key] ?? '')} onChange={event => onChange({ ...action.config, [key]: event.target.value })}><option value="">Choose…</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
      : <Input type={field.type === 'number' ? 'number' : 'text'} value={String(action.config[key] ?? '')} onChange={event => onChange({ ...action.config, [key]: field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value })} />}</label>;
  })}</div>;
}
