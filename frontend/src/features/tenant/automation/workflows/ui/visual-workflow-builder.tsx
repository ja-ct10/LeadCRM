'use client';
import { useState } from 'react';
import { WorkflowDraftSchema, type WorkflowDraft, type ActionDefinition, type TriggerDefinition, type WorkflowOptions } from '@leadcrm/shared';
import { ArrowDown, Plus, ChevronLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { workflowsApi } from '@/shared/services/workflows.api';
import { WorkflowDialog } from './workflow-dialog';
import { ActionFields, ConditionFields, emptyOptions, workflowControl } from './workflow-fields';
interface Props {
  initial: WorkflowDraft; triggers: TriggerDefinition[]; actions: ActionDefinition[]; options?: WorkflowOptions;
  canActivate: boolean; readOnly?: boolean; onSave: (draft: WorkflowDraft) => Promise<void>; onClose: () => void;
}
export default function WorkflowBuilder({initial,triggers,actions:definitions,options=emptyOptions,canActivate,readOnly,onSave,onClose}:Props) {
  const parsed = WorkflowDraftSchema.safeParse({...initial,name:initial.name || 'New workflow'});
  const [draft,setDraft] = useState<WorkflowDraft>(parsed.success ? {...parsed.data,name:initial.name} : {name:initial.name,description:initial.description,trigger:triggers[0]?.type ?? '',isActive:false,actions:[]});
  const [panel,setPanel] = useState<'trigger'|'conditions'|'add'|number|null>(null);
  const [editing,setEditing] = useState(draft);
  const [search,setSearch] = useState('');
  const [error,setError] = useState('');
  const [nameError,setNameError] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [confirmExit,setConfirmExit] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const trigger = triggers.find(trigger => trigger.type === draft.trigger);
  const open = (next:typeof panel) => {setEditing(structuredClone(draft));setPanel(next);setSearch('');};
  async function submit(activate:boolean,validateOnly=false) {
    setError('');setNameError('');setMessage('');
    const result = WorkflowDraftSchema.safeParse({...draft,isActive:activate});
    if (!result.success) {
      const nameIssue = result.error.issues.find(issue => issue.path[0] === 'name');
      if (nameIssue) setNameError(nameIssue.message);
      const other = result.error.issues.find(issue => issue.path[0] !== 'name');if (other) setError(other.message);
      return;
    }
    setBusy(true);
    try {if(validateOnly) setMessage((await workflowsApi.validate(result.data)).data.message);else {await onSave(result.data);onClose();}}
    catch(failure) {setError(failure instanceof Error ? failure.message : 'Unable to save workflow.');}
    finally {setBusy(false);}
  }
  function move(index:number,offset:number) {const next=[...draft.actions];[next[index+offset],next[index]]=[next[index],next[index+offset]];setDraft({...draft,actions:next});setMessage('');}
  const connector = <div className="flex justify-center py-3 text-muted-foreground" aria-hidden="true"><ArrowDown size={20}/></div>;
  const nodeClass = 'w-full rounded-xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary';
  return <div className="min-w-0 p-3 sm:p-6 text-foreground space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0 flex-1"><Button variant="ghost" onClick={() => dirty && !readOnly ? setConfirmExit(true) : onClose()} disabled={busy}><ChevronLeft size={16}/> Workflows</Button><h1 className="text-2xl font-semibold break-words">{draft.name || 'New workflow'}</h1><p className="mt-1 text-sm text-muted-foreground">{dirty ? 'Unsaved changes' : draft.isActive ? 'Active' : 'Draft'} · When → If → Then</p></div>
      {!readOnly && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void submit(false,true)}>Validate</Button><Button variant="outline" disabled={busy} onClick={() => void submit(false)}>Save draft</Button>{canActivate && <Button disabled={busy} onClick={() => void submit(true)}>Save and activate</Button>}</div>}
    </div>
    {!parsed.success && <p role="alert" className="rounded-lg border border-border p-3">This workflow uses an older configuration. Rebuild its steps and save a draft. Existing history is preserved.</p>}
    {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}{message && <p role="status" className="rounded-lg border border-border p-3">{message}</p>}
    <fieldset disabled={readOnly || busy} className="mx-auto max-w-2xl min-w-0 space-y-4">
      <label className="block space-y-1"><span>Workflow name <span className="text-red-600">*</span></span><Input aria-label="Workflow name" aria-required="true" aria-invalid={!!nameError} aria-describedby={nameError ? 'workflow-name-error' : undefined} maxLength={255} value={draft.name} onChange={event => {setDraft({...draft,name:event.target.value});setNameError('');setMessage('');}} />{nameError && <span id="workflow-name-error" role="alert" className="block text-sm text-red-600">{nameError}</span>}</label>
      <label className="block space-y-1">Description<Input maxLength={2000} value={draft.description ?? ''} onChange={event => {setDraft({...draft,description:event.target.value});setMessage('');}}/></label>
    </fieldset>
    <div className="mx-auto max-w-xl min-w-0 py-3">
      <button type="button" disabled={busy} className={nodeClass} onClick={() => open('trigger')}><span className="text-sm font-semibold text-primary">WHEN</span><span className="mt-2 block font-medium">{trigger?.label ?? 'Choose a trigger'}</span></button>
      {connector}
      <button type="button" disabled={busy} className={nodeClass} onClick={() => open('conditions')}><span className="text-sm font-semibold text-primary">IF — optional</span><span className="mt-2 block text-sm">{draft.conditions?.conditions.length ? `${draft.conditions.operator === 'AND' ? 'All' : 'Any'} of ${draft.conditions.conditions.length} conditions` : 'Continue for every matching event'}</span>{draft.conditions?.conditions.map((rule,index) => <span key={index} className="mt-1 block text-sm text-muted-foreground">{trigger?.fields.find(field => field.field === rule.field)?.label ?? 'Condition'} {rule.operator.replaceAll('_',' ')}</span>)}</button>
      {draft.actions.map((action,index) => <div key={index}>{connector}<div className="rounded-xl border border-border bg-card shadow-sm"><button disabled={busy} className="w-full p-5 text-left hover:text-primary" type="button" onClick={() => open(index)}><span className="text-sm font-semibold text-primary">THEN · {index+1}</span><span className="mt-2 block font-medium">{definitions.find(def => def.type === action.type)?.label ?? 'Configure action'}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{String(action.config.title ?? '')}</span></button>{!readOnly && <div className="flex flex-wrap gap-1 border-t border-border p-2"><Button variant="ghost" size="sm" disabled={busy || index === 0} onClick={() => move(index,-1)}>Move up</Button><Button variant="ghost" size="sm" disabled={busy || index === draft.actions.length-1} onClick={() => move(index,1)}>Move down</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => {setDraft({...draft,actions:draft.actions.filter((_,i) => i !== index)});setMessage('');}}>Remove action</Button></div>}</div></div>)}
      {!readOnly && <div className="flex justify-center pt-5"><Button variant="outline" disabled={busy || draft.actions.length >= 20} onClick={() => open('add')}><Plus size={16}/> Add step</Button></div>}
    </div>
    {panel !== null && <WorkflowDialog sidePanel title={panel === 'trigger' ? 'When this happens' : panel === 'conditions' ? 'Conditions' : panel === 'add' ? 'Add a step' : definitions.find(def => def.type === editing.actions[panel]?.type)?.label ?? 'Configure action'} onClose={() => setPanel(null)}>
      <fieldset disabled={readOnly || busy} className="min-w-0 space-y-5">
        {panel === 'trigger' && <label className="block">Trigger<select className={workflowControl} value={editing.trigger} onChange={event => {const next=triggers.find(trigger => trigger.type === event.target.value);setEditing({...editing,trigger:event.target.value,conditions:{operator:'AND',conditions:[]},actions:editing.actions.filter(action => definitions.some(def => def.type === action.type && next && def.entities.includes(next.entity)))});}}>{triggers.map(trigger => <option key={trigger.type} value={trigger.type}>{trigger.label}</option>)}</select><span className="mt-3 block text-sm text-muted-foreground">Changing the record type clears conditions and incompatible actions.</span></label>}
        {panel === 'conditions' && <ConditionFields value={editing.conditions ?? {operator:'AND',conditions:[]}} trigger={trigger} options={options} onChange={conditions => setEditing({...editing,conditions})}/>}
        {typeof panel === 'number' && editing.actions[panel] && <ActionFields action={editing.actions[panel]} definition={definitions.find(def => def.type === editing.actions[panel].type)} options={options} onChange={config => setEditing({...editing,actions:editing.actions.map((action,index) => index === panel ? {...action,config} : action)})}/>}
        {panel === 'add' && <><Input aria-label="Search steps" placeholder="Search steps…" value={search} onChange={event => setSearch(event.target.value)}/>{'condition'.includes(search.toLowerCase()) && <Button className="w-full justify-start" variant="outline" onClick={() => setPanel('conditions')}>Condition</Button>}{definitions.filter(def => trigger && def.entities.includes(trigger.entity) && def.label.toLowerCase().includes(search.toLowerCase())).map(def => <Button className="w-full justify-start" key={def.type} variant="outline" onClick={() => {setEditing({...draft,actions:[...draft.actions,{type:def.type,config:{}}]});setPanel(draft.actions.length);}}>{def.label}</Button>)}</>}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setPanel(null)}>Cancel</Button>{panel !== 'add' && !readOnly && <Button onClick={() => {setDraft(editing);setMessage('');setPanel(null);}}>Save step</Button>}</div>
    </WorkflowDialog>}
    {confirmExit && <WorkflowDialog title="Discard unsaved changes?" onClose={() => setConfirmExit(false)}><p>Your last saved workflow will be kept.</p><Button variant="outline" onClick={() => setConfirmExit(false)}>Keep editing</Button><Button onClick={onClose}>Discard changes</Button></WorkflowDialog>}
  </div>;
}
