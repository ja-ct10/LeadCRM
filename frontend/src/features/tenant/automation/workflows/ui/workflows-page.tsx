'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { WORKFLOW_TRIGGERS, getAvailableActions, type Workflow, type WorkflowDraft, type TriggerDefinition, type ActionDefinition } from '@leadcrm/shared';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { getWorkflowMetadata } from '@/shared/services/workflows.api';
import { Button } from '@/shared/components/ui/button';
import { TrelloFilter } from '@/shared/components/trello-filter';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import WorkflowBuilder from './visual-workflow-builder';
import { WorkflowExecutionLogModal, WorkflowTest } from './workflow-execution-log-modal';
import { WorkflowDialog } from './workflow-dialog';
import { WORKFLOW_RECIPES } from '../services/workflow-recipes';
const emptyDraft: WorkflowDraft = { name: '', description: '', trigger: 'lead.created', isActive: false, actions: [{ type: 'create_task', config: {} }] };
export function toWorkflowDraft(workflow: Workflow): WorkflowDraft {
  return { name: workflow.name, description: workflow.description, trigger: workflow.trigger, conditions: workflow.conditions,
    actions: workflow.actions, isActive: workflow.isActive };
}
export default function WorkflowsPage() {
  const { workflows, workflowsLoading, workflowsError, refreshWorkflows, addWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflow } = useData();
  const { user, tenant, userCan } = useAuth();
  const canView = userCan('workflows', 'canView'), canCreate = userCan('workflows', 'canCreate');
  const canEdit = userCan('workflows', 'canEdit'), canDelete = userCan('workflows', 'canDelete');
  const [metadata, setMetadata] = useState<{triggers:TriggerDefinition[];actions:ActionDefinition[]} | null>(null);
  const [metadataError, setMetadataError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{id?:string;draft:WorkflowDraft;readOnly?:boolean} | null>(null);
  const [runs, setRuns] = useState<Workflow | null>(null);
  const [testing, setTesting] = useState<Workflow | null>(null);
  const [archiving, setArchiving] = useState<Workflow | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!canView || !tenant?.id) return;
    let cancelled = false;
    setMetadata(null); setMetadataError('');
    const request = USE_MOCK_DATA ? Promise.resolve({ triggers: WORKFLOW_TRIGGERS, actions: getAvailableActions() })
      : getWorkflowMetadata(`${tenant.id}:${user?.id}:${user?.activeEnvironment}`);
    request.then(result => { if (!cancelled) setMetadata(result); }).catch(failure => { if (!cancelled) setMetadataError(failure instanceof Error ? failure.message : 'Unable to load workflow options.'); });
    return () => { cancelled = true; };
  }, [tenant?.id, user?.id, user?.activeEnvironment, canView, retry]);
  const filtered = useMemo(() => workflows.filter(workflow => !workflow.isArchived && workflow.name.toLowerCase().includes(search.toLowerCase()) &&
    (!statuses.length || statuses.includes(workflow.isActive ? 'active' : 'paused')) && (!triggers.length || triggers.includes(workflow.trigger))), [workflows, search, statuses, triggers]);
  const pagination = usePagination({ totalItems: filtered.length, resetDeps: [search, statuses.join(','), triggers.join(',')] });
  async function mutate(work: () => Promise<void>, message: string) {
    setBusy(true);
    try { await work(); toast.success(message); }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Unable to complete this action.'); }
    finally { setBusy(false); }
  }
  if (!canView) return <p className="p-6 text-foreground">You do not have permission to view workflows.</p>;
  return <div className="p-4 sm:p-6 space-y-6 text-foreground">
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-semibold">Workflows</h1><p className="text-sm text-muted-foreground">When something happens, check conditions and perform actions.</p></div>{canCreate && <Button disabled={!metadata || busy} onClick={() => setCreateOpen(true)}>Create workflow</Button>}</div>
    {USE_MOCK_DATA && <p className="rounded-lg border border-border p-3 text-sm">Mock workspace: configuration only. Automation and delivery require the backend.</p>}
    {metadataError && <div role="alert">{metadataError} <Button variant="outline" onClick={() => setRetry(retry + 1)}>Retry options</Button></div>}
    {workflowsError && <div role="alert">{workflowsError} <Button variant="outline" onClick={() => void refreshWorkflows()}>Retry workflows</Button></div>}
    {workflowsLoading && <p role="status">Loading workflows…</p>}
    {!USE_MOCK_DATA && <Button variant="outline" disabled={workflowsLoading} onClick={() => void refreshWorkflows()}>Refresh workflows</Button>}
    {!metadata && !metadataError && <p role="status">Loading workflow options…</p>}
    <TrelloFilter searchTerm={search} setSearchTerm={setSearch} statuses={[{id:'active',label:'Active'},{id:'paused',label:'Paused'}]} selectedStatuses={statuses} setSelectedStatuses={setStatuses}
      triggers={metadata?.triggers.map(trigger => ({id:trigger.type,label:trigger.label}))} selectedTriggers={triggers} setSelectedTriggers={setTriggers} />
    <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{['Name','Trigger','Status','Last run','Actions'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {pagination.paginateItems(filtered).map(workflow => <tr key={workflow.id} className="border-t border-border"><td className="p-3 font-medium">{workflow.name}</td><td className="p-3">{metadata?.triggers.find(trigger => trigger.type === workflow.trigger)?.label ?? workflow.trigger}</td><td className="p-3">{workflow.isActive ? 'Active' : 'Paused'}</td><td className="p-3 whitespace-nowrap">{workflow.lastRunAt ? new Date(workflow.lastRunAt).toLocaleString() : '—'}</td><td className="p-3"><div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" disabled={!metadata || busy} onClick={() => setEditing({id:workflow.id,draft:toWorkflowDraft(workflow),readOnly:!canEdit})}>{canEdit ? 'Edit' : 'Details'}</Button>
        {canCreate && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void mutate(() => addWorkflow({...toWorkflowDraft(workflow),name:`${workflow.name} (Copy)`,isActive:false}), 'Workflow duplicated as a draft.')}>Duplicate</Button>}
        <Button variant="ghost" size="sm" onClick={() => setRuns(workflow)}>View runs</Button>
        <Button variant="ghost" size="sm" onClick={() => setTesting(workflow)}>Test workflow</Button>
        {canEdit && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void mutate(() => toggleWorkflow(workflow.id), workflow.isActive ? 'Workflow paused.' : 'Workflow activated.')}>{workflow.isActive ? 'Pause' : 'Activate'}</Button>}
        {canDelete && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setArchiving(workflow)}>Archive</Button>}
      </div></td></tr>)}
      {!workflowsLoading && !workflowsError && !filtered.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No workflows match. Create a workflow or adjust your filters.</td></tr>}
    </tbody></table></div>
    <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} pageSize={pagination.pageSize} onPageChange={pagination.goToPage} onPageSizeChange={pagination.setPageSize} />
    {createOpen && <WorkflowDialog title="Create workflow" onClose={() => setCreateOpen(false)}><Button onClick={() => {setEditing({draft:emptyDraft});setCreateOpen(false);}}>Start from scratch</Button><h3 className="font-semibold">Use a template</h3>{WORKFLOW_RECIPES.map(recipe => <Button className="w-full justify-start" variant="outline" key={recipe.name} onClick={() => {setEditing({draft:structuredClone(recipe)});setCreateOpen(false);}}>{recipe.name}</Button>)}</WorkflowDialog>}
    {editing && metadata && <WorkflowBuilder initial={editing.draft} triggers={metadata.triggers} actions={metadata.actions} canActivate={canEdit} readOnly={editing.readOnly} onClose={() => setEditing(null)} onSave={async draft => {
      if (editing.id) await updateWorkflow(editing.id,draft); else await addWorkflow(draft); toast.success(draft.isActive ? 'Workflow saved and activated.' : 'Draft saved.');
    }} />}
    {runs && <WorkflowExecutionLogModal workflowId={runs.id} name={runs.name} onClose={() => setRuns(null)} />}
    {testing && <WorkflowTest workflowId={testing.id} name={testing.name} entity={metadata?.triggers.find(trigger => trigger.type === testing.trigger)?.entity ?? 'CRM record'} onClose={() => setTesting(null)} />}
    <ConfirmActionDialog open={!!archiving} onOpenChange={open => {if (!open) setArchiving(null);}} title="Archive workflow?" description="This pauses the workflow and preserves its run history." confirmLabel="Archive" variant="destructive" onConfirm={async () => { if (archiving) await mutate(async () => {await deleteWorkflow(archiving.id);setArchiving(null);},'Workflow archived.'); }} />
  </div>;
}
