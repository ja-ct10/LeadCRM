'use client';
import type { ActionDefinition, WorkflowAction, WorkflowCondition, WorkflowOptions, TriggerDefinition } from '@leadcrm/shared';
import { workflowOperators } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
export const workflowControl = 'w-full min-w-0 rounded-lg border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export const emptyOptions: WorkflowOptions = { users: [], pipelines: [], templates: [], campaigns: [] };
export function referenceOptions(type: string, options: WorkflowOptions) {
  if (type === 'user') return options.users;
  if (type === 'pipeline') return options.pipelines;
  if (type === 'stage') return options.pipelines.flatMap(pipeline => pipeline.stages.map(stage => ({ id: stage.id, name: `${pipeline.name} / ${stage.name}` })));
  if (type === 'template') return options.templates;
  if (type === 'campaign') return options.campaigns;
  return undefined;
}
export function ConditionFields({ value, trigger, options, onChange }: {value:WorkflowCondition;trigger?:TriggerDefinition;options:WorkflowOptions;onChange:(value:WorkflowCondition)=>void}) {
  return <div className="space-y-4">
    <label className="block">Match conditions<select className={workflowControl} value={value.operator} onChange={event => onChange({...value,operator:event.target.value as 'AND'|'OR'})}><option value="AND">All conditions (AND)</option><option value="OR">Any condition (OR)</option></select></label>
    {value.conditions.map((rule,index) => {
      const field = trigger?.fields.find(field => field.field === rule.field);
      const choices = field?.options?.map(option => ({id:option,name:option})) ?? referenceOptions(field?.type ?? '',options);
      const update = (patch: Partial<typeof rule>) => onChange({...value,conditions:value.conditions.map((entry,i) => i === index ? {...entry,...patch} : entry)});
      return <div key={index} className="space-y-3 border-t border-border pt-4">
        <label className="block">Field<select aria-label={`Condition ${index+1} field`} className={workflowControl} value={rule.field} onChange={event => {const next = trigger?.fields.find(field => field.field === event.target.value);update({field:event.target.value,operator:'equals',value:next?.type === 'number' ? 0 : ''});}}><option value="">Choose a field</option>{trigger?.fields.map(field => <option key={field.field} value={field.field}>{field.label}</option>)}</select></label>
        <label className="block">Operator<select aria-label={`Condition ${index+1} operator`} className={workflowControl} value={rule.operator} onChange={event => update({operator:event.target.value as typeof rule.operator})}>{workflowOperators(field?.type ?? 'string').map(operator => <option key={operator} value={operator}>{operator.replaceAll('_',' ')}</option>)}</select></label>
        {!['is_empty','is_not_empty'].includes(rule.operator) && <label className="block">Value{choices ? <select aria-label={`Condition ${index+1} value`} className={workflowControl} value={String(rule.value ?? '')} onChange={event => update({value:event.target.value})}><option value="">Choose…</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select> : <Input aria-label={`Condition ${index+1} value`} type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'} maxLength={1000} value={String(rule.value ?? '')} onChange={event => update({value:field?.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value})} />}</label>}
        <Button type="button" variant="ghost" onClick={() => onChange({...value,conditions:value.conditions.filter((_,i) => i !== index)})}>Remove condition</Button>
      </div>;
    })}
    <Button type="button" variant="outline" onClick={() => onChange({...value,conditions:[...value.conditions,{field:trigger?.fields[0]?.field ?? '',operator:'equals',value:''}]})} disabled={!trigger || value.conditions.length >= 30}>Add condition</Button>
  </div>;
}
export function ActionFields({action,definition,options,onChange}:{action:WorkflowAction;definition?:ActionDefinition;options:WorkflowOptions;onChange:(config:Record<string,unknown>)=>void}) {
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">{definition?.description}</p>{Object.entries(definition?.configSchema ?? {}).map(([key,field]) => {
    const choices = referenceOptions(field.type,options) ?? field.options?.map(option => ({id:option,name:option}));
    const change = (value:unknown) => onChange({...action.config,[key]:value});
    return <label key={key} className="block space-y-1"><span>{field.label}{field.required && <span className="text-red-600"> *</span>}</span>{choices ? <select className={workflowControl} value={String(action.config[key] ?? '')} onChange={event => change(event.target.value)}><option value="">Choose…</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select> : ['body','description','value'].includes(key) ? <textarea className={workflowControl} rows={5} maxLength={10000} value={String(action.config[key] ?? '')} onChange={event => change(event.target.value)} /> : <Input type={field.type === 'number' ? 'number' : 'text'} min={0} max={365} maxLength={255} value={String(action.config[key] ?? '')} onChange={event => change(field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />}</label>;
  })}<p className="text-xs text-muted-foreground">Message and task variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{email}}'}, {'{{company}}'}.</p></div>;
}
