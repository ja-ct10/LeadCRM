'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { WorkflowDraft, WorkflowOptions, TriggerDefinition, ActionDefinition } from '@leadcrm/shared';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { getWorkflowMetadata, workflowsApi } from '@/shared/services/workflows.api';
import { Button } from '@/shared/components/ui/button';
import WorkflowBuilder from './visual-workflow-builder';
import { WORKFLOW_RECIPES } from '../services/workflow-recipes';
export default function WorkflowBuilderPage() {
  const router=useRouter(), params=useParams<{id?:string}>(), query=useSearchParams();
  const {tenant,user,userCan}=useAuth();
  const {addWorkflow,updateWorkflow}=useData();
  const [loaded,setLoaded]=useState<{initial:WorkflowDraft;options:WorkflowOptions;triggers:TriggerDefinition[];actions:ActionDefinition[]}|null>(null);
  const [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const canView=userCan('workflows','canView'), canEdit=userCan('workflows','canEdit'), canCreate=userCan('workflows','canCreate');
  const id=params.id, recipe=query.get('template');
  useEffect(() => {
    if (!tenant?.id || !canView || (!id && !canCreate)) return;
    let cancelled=false;setLoaded(null);setError('');
    Promise.all([getWorkflowMetadata(`${tenant.id}:${user?.id}:${user?.activeEnvironment}`),workflowsApi.options(),id ? workflowsApi.get(id) : Promise.resolve(null)]).then(([metadata,options,response]) => {
      if(cancelled)return;
      const saved=response?.data;
      const selected=recipe === null ? undefined : WORKFLOW_RECIPES[Number(recipe)];
      const initial:WorkflowDraft=saved ? {name:saved.name,description:saved.description,trigger:saved.trigger,conditions:saved.conditions,actions:saved.actions,isActive:saved.isActive} : selected ? structuredClone(selected) : {name:'',description:'',trigger:'lead.created',isActive:false,actions:[]};
      setLoaded({initial,options:options.data,...metadata});
    }).catch(failure => {if(!cancelled)setError(failure instanceof Error ? failure.message : 'Unable to load workflow.');});
    return () => {cancelled=true;};
  },[tenant?.id,user?.id,user?.activeEnvironment,id,recipe,canView,canCreate,retry]);
  if(!canView || (!id && !canCreate))return <p className="p-6">You do not have permission to open this workflow.</p>;
  if(error)return <div role="alert" className="p-6 space-y-3"><p>{error}</p><Button onClick={() => setRetry(retry+1)}>Retry</Button></div>;
  if(!loaded)return <p role="status" className="p-6">Loading workflow…</p>;
  return <WorkflowBuilder key={`${tenant?.id}:${user?.activeEnvironment}:${id ?? 'new'}:${retry}`} {...loaded} canActivate={canEdit} readOnly={!!id && !canEdit} onClose={() => router.push('/automation/workflows')} onSave={async draft => {
    if(id)await updateWorkflow(id,draft);else await addWorkflow(draft);
    toast.success(draft.isActive ? 'Workflow saved and activated.' : 'Draft saved.');
  }}/>;
}
