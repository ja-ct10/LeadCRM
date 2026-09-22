import { fireWorkflowTrigger } from '../workflows/workflow.engine';
interface RecordEvent { tenantId: string; actorId?: string; }
interface ContactEvent extends RecordEvent { contact: { id: string; status: string; score?: number; assignedUserId?: string | null; source?: string | null }; }
interface LeadEvent extends RecordEvent { lead: { id: string; status: string; score?: number | null; source?: string | null; assignedUserId?: string | null; companyName?: string | null }; }
interface DealEvent extends RecordEvent { deal: { id: string; title: string; value?: number | null; assignedUserId?: string | null }; }
async function fire(params: RecordEvent, type: string, entity: string, id: string): Promise<void> {
  try { await fireWorkflowTrigger({ triggerType: type, entityType: entity, entityId: id, tenantId: params.tenantId, actorId: params.actorId, context: {} }); }
  catch { console.error('[Workflow] Event processing failed', { trigger: type, entityId: id }); }
}
export function fireLeadCreated(params: LeadEvent): Promise<void> { return fire(params, 'lead.created', 'lead', params.lead.id); }
export function fireLeadStatusChanged(params: LeadEvent & { prevStatus: string }): Promise<void> { return fire(params, 'lead.status_changed', 'lead', params.lead.id); }
export function fireContactCreated(params: ContactEvent): Promise<void> { return fire(params, 'contact.created', 'contact', params.contact.id); }
export function fireContactStatusChanged(params: ContactEvent & { prevStatus: string }): Promise<void> { return fire(params, 'contact.status_changed', 'contact', params.contact.id); }
export function fireDealCreated(params: DealEvent): Promise<void> { return fire(params, 'deal.created', 'deal', params.deal.id); }
export async function fireDealStageChanged(params: DealEvent & { newStageId: string; newStageName: string; isWon: boolean; isLost: boolean; prevStageId?: string }): Promise<void> {
  if (params.newStageId === params.prevStageId) return;
  await fire(params, 'deal.stage_changed', 'deal', params.deal.id);
  if (params.isWon) await fire(params, 'deal.closed_won', 'deal', params.deal.id);
  else if (params.isLost) await fire(params, 'deal.closed_lost', 'deal', params.deal.id);
}
