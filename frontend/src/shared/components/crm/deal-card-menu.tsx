'use client';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil, ListPlus, StickyNote, Mail, CheckCircle2, XCircle, ArrowLeftRight, Archive, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { CrmEmailSchema, closingValueError, type ClosingRequirementsState } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ThemeScope } from '@/shared/components/theme-scope';
import { usesWorkspaceAppearance } from '@/lib/appearance-config';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { apiClient } from '@/lib/api/client';
import { toFrontendDeal } from '@/lib/api/adapters/deal.adapter';
import { USE_MOCK_DATA } from '@/lib/config';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { requestPageCache } from '@/shared/cache/page-cache';
import type { Deal } from '@/store/types';
import { DealFormSheet } from '@/features/tenant/crm/deals/ui/deal-form';
import { TaskEditor } from '@/features/tenant/operations/tasks/ui/task-editor';
import { recordEmailComposeHref } from '@/features/tenant/inbox/services/compose-navigation';
import { CrmRecordPanel } from './crm-record-view';
import { DealStageDialog } from './deal-stage-dialog';
import { dealStagePipeline } from '@/shared/utils/deal-stage-pipeline';
import { DealLostDialog } from './deal-lost-dialog';

interface DealCardMenuProps {
  dealId: string; dealTitle: string; deal?: Deal;
  onEdit?: () => void; onDelete?: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>; onDuplicated?: () => void;
  onMutated?: (deal?: Deal) => void;
}
type Recipient = { email: string; name: string };
type DealAction = 'edit' | 'task' | 'note' | 'won' | 'lost' | 'stage' | 'recipient';
type DealActionSession = DealCardMenuProps & { action: DealAction; editSnapshot?: Deal; scope: string; sequence: number };
const DealActionsContext = createContext<((session: Omit<DealActionSession, 'scope' | 'sequence'>) => void) | null>(null);

/** Keep action forms mounted when a stage update moves or filters out their card. */
export function DealActionsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, tenant } = useAuth();
  const pathname = usePathname();
  const scope = JSON.stringify([tenant?.id, user?.id, user?.role, pathname]);
  const latestScope = useRef(scope);
  latestScope.current = scope;
  const sequence = useRef(0);
  const [session, setSession] = useState<DealActionSession | null>(null);
  const current = session?.scope === scope ? session : null;
  useEffect(() => { setSession(previous => previous?.scope === scope ? previous : null); }, [scope]);
  return <DealActionsContext.Provider value={request => {
    if (scope === latestScope.current) setSession({ ...request, scope, sequence: ++sequence.current });
  }}>
    {children}
    {current && <ThemeScope enabled={usesWorkspaceAppearance(pathname, Boolean(user))} className="contents"><DealCardMenuController key={current.sequence} {...current} hostedAction={current} onActionClose={() => setSession(previous => previous?.sequence === current.sequence ? null : previous)} /></ThemeScope>}
  </DealActionsContext.Provider>;
}

export function DealCardMenu(props: DealCardMenuProps): React.ReactElement {
  return <DealCardMenuController {...props} />;
}

function DealCardMenuController({ dealId, dealTitle, deal: cardDeal, onArchive, onMutated, onDuplicated, hostedAction, onActionClose }: DealCardMenuProps & { hostedAction?: DealActionSession; onActionClose?: () => void }): React.ReactElement {
  const host = useContext(DealActionsContext);
  const router = useRouter();
  const data = useData();
  const { user, tenant } = useAuth();
  const hasEditPermission = useHasPermission('deals.edit'), hasArchivePermission = useHasPermission('deals.archive');
  const recordAccess = useCrmRecordAccess();
  const canTask = useHasPermission('tasks.create'), canLead = useHasPermission('leads.view'), canContact = useHasPermission('contacts.view');
  const canEmailLead = useHasPermission('leads.edit') && canLead && hasEditPermission, canEmailContact = useHasPermission('contacts.edit') && canContact && hasEditPermission;
  const { dialogProps, confirm } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<DealAction | null>(hostedAction?.action ?? null);
  const [editSnapshot, setEditSnapshot] = useState<Deal | undefined>(hostedAction?.editSnapshot);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]), [recipientStatus, setRecipientStatus] = useState('Loading linked recipients…');
  const query = useCachedPage<Record<string, unknown>>({ module: 'deals', params: { recordId: dealId }, disabled: USE_MOCK_DATA || (!open && !action), revalidateOnInvalidation: true,
    fetchFn: async signal => (await apiClient.get<{ data: Record<string, unknown> }>('/crm/deals/' + encodeURIComponent(dealId), { signal })).data });
  const deal = USE_MOCK_DATA ? data.deals.find(d => d.id === dealId) ?? cardDeal : query.data ? toFrontendDeal(query.data) as Deal : cardDeal;
  const canEdit = hasEditPermission && recordAccess.canMutate(deal);
  const canArchive = hasArchivePermission && recordAccess.canMutate(deal);
  const pipeline = deal && dealStagePipeline(deal, data.pipelines);
  const stage = pipeline?.stages.find(s => s.id === deal?.stageId);
  const won = pipeline?.stages.filter(s => s.isWon) ?? [], lost = pipeline?.stages.filter(s => s.isLost) ?? [];
  const closed = !!stage?.isWon || !!stage?.isLost;
  const unavailable = !USE_MOCK_DATA && query.isInitialLoad ? 'Loading deal…' : deal?.isArchived ? 'This deal is archived.' : query.error || (!deal ? 'Loading deal…' : '');
  const wonReason = unavailable || (won.length !== 1 ? 'Configure exactly one Won stage.' : stage?.isWon ? 'This deal is already won.' : stage?.isLost ? 'Reopen the lost deal in Qualified first.' : stage?.name.trim().toLowerCase() !== 'qualified' ? 'Move this deal to Qualified first.' : '');
  const lostReason = unavailable || (lost.length !== 1 ? 'Configure exactly one Lost stage.' : closed ? 'This deal is already closed.' : '');
  const stageReason = unavailable || (!pipeline || !stage ? 'Current pipeline or stage is unavailable. Refresh Deals and try again.' : closed ? 'Only open deals can change stage here.' : '');
  const actionAllowed = !deal?.isArchived && ![401, 403, 404].includes(query.errorStatus ?? 0) && recordAccess.canMutate(deal) &&
    (action === 'task' ? canTask : action === 'recipient' ? canEmailLead || canEmailContact : canEdit);
  const closeAction = () => { setAction(null); onActionClose?.(); };
  useEffect(() => {
    if (hostedAction && !actionAllowed) onActionClose?.();
  }, [hostedAction, actionAllowed, onActionClose]);
  useEffect(() => {
    if ((!open && action !== 'recipient') || !deal || closed || !(canEmailLead || canEmailContact)) return;
    const controller = new AbortController();
    setRecipientStatus('Loading linked recipients…'); setRecipients([]);
    const load = async () => {
      const links = [...(canEmailLead ? (deal.leadIds ?? (deal.leadId ? [deal.leadId] : [])).map(id => ({ id, module: 'leads' })) : []), ...(canEmailContact ? (deal.contactIds ?? (deal.contactId ? [deal.contactId] : [])).map(id => ({ id, module: 'contacts' })) : [])];
      const rows = await Promise.allSettled(links.map(async link => {
        const person = USE_MOCK_DATA ? data.contacts.find(p => p.id === link.id) : await requestPageCache<Record<string, unknown>>(link.module, tenant?.id ?? user?.tenantId ?? '', { query: { recordId: link.id }, userId: user?.id, role: user?.role }, async signal => (await apiClient.get<{ data: Record<string, unknown> }>('/crm/' + link.module + '/' + encodeURIComponent(link.id), { signal })).data, controller.signal);
        if (!person || person.isArchived || person.deletedAt || person.assignedUserId !== user?.id || link.module === 'leads' && person.convertedAt || !CrmEmailSchema.safeParse(person.email).success) return null;
        return { email: String(person.email), name: [person.firstName, person.lastName].filter(Boolean).join(' ') || String(person.email) };
      }));
      if (controller.signal.aborted) return;
      const eligible = rows.flatMap(row => row.status === 'fulfilled' && row.value ? [row.value] : []);
      const unique = [...new Map(eligible.map(person => [person.email.toLowerCase(), person])).values()];
      setRecipients(unique); setRecipientStatus(unique.length ? '' : 'No linked Lead/Contact with a valid email.');
    };
    void load(); return () => controller.abort();
  // IDs and authorization define the recipient read; unrelated renders must not reset the list.
  }, [open, action, dealId, deal?.updatedAt, deal?.pipelineId, deal?.stageId, query.data, canEmailLead, canEmailContact, closed, tenant?.id, user?.id, user?.role]);
  const changed = (next?: Deal) => { onMutated?.(next); onDuplicated?.(); };
  const show = (next: DealAction) => {
    const snapshot = next === 'edit' && deal ? structuredClone(deal) : undefined;
    setOpen(false);
    if (host && !hostedAction) host({ dealId, dealTitle, deal, onArchive, onMutated, onDuplicated, action: next, editSnapshot: snapshot });
    else { setEditSnapshot(snapshot); setAction(next); }
  };
  const send = (recipient: Recipient) => {
    const href = recordEmailComposeHref(recipient.email, dealTitle, dealId);
    if (href) { setOpen(false); closeAction(); router.push(href); }
  };
  const markWon = async () => {
    if (submitting.current || wonReason || !deal) return;
    setOpen(false); submitting.current = true; setPending(true);
    try {
      if (USE_MOCK_DATA) { show('won'); return; }
      const state = (await apiClient.get<{ data: ClosingRequirementsState }>('/crm/deals/' + encodeURIComponent(dealId) + '/closing-requirements')).data;
      if (state.locked) { changed(); setAction(null); return; }
      const incomplete = state.fields.filter(field => field.active).some(field => state.errors[field.id] || closingValueError(field, state.values[field.id]) || field.type === 'File Upload' && state.values[field.id] && !state.files.some(file => file.id === state.values[field.id]));
      if (incomplete) { show('won'); return; }
      setAction(null);
      confirm({ title: 'Mark deal as won?', description: 'The closing evidence will be validated and locked.', confirmLabel: 'Mark as won', onConfirm: async () => { const next = await data.moveDealStage(dealId, won[0].id); changed(next); toast.success('Deal closed as won'); } });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to check closing evidence.'); }
    finally { submitting.current = false; setPending(false); }
  };
  const emailReason = unavailable || (closed ? 'Contextual email is available for open deals. Use Inbox for follow-up email.' : recipientStatus);
  const item = (label: string, Icon: typeof Pencil, select: () => void, reason = '', description = '') => <DropdownMenuItem disabled={pending || !!reason} title={reason || description || undefined} onSelect={select}><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0">{label}{(reason || description) && <span className="block text-[11px] font-normal text-muted-foreground">{reason || description}</span>}</span></DropdownMenuItem>;
  return <div onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    {!hostedAction && <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 sm:h-8 sm:w-8" aria-label={'Actions for ' + dealTitle}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {canEdit && item('Edit deal', Pencil, () => show('edit'), unavailable)}
        {canTask && recordAccess.canMutate(deal) && item('Add a task', ListPlus, () => show('task'), unavailable)}
        {canEdit && item('Add a note', StickyNote, () => show('note'), unavailable)}
        {(canEmailLead || canEmailContact) && item('Send an email', Mail, () => recipients.length === 1 ? send(recipients[0]) : show('recipient'), emailReason)}
        {canEdit && <><DropdownMenuSeparator />{item('Mark as won', CheckCircle2, () => void markWon(), wonReason)}{item('Mark as lost', XCircle, () => show('lost'), lostReason)}{item('Change stage', ArrowLeftRight, () => show('stage'), stageReason, pipeline ? 'Current pipeline: ' + pipeline.name : '')}</>}
        {canArchive && <><DropdownMenuSeparator /><DropdownMenuItem destructive disabled={pending || !!unavailable} onSelect={() => {
          setOpen(false); confirm({ title: 'Archive deal?', description: 'This Deal will leave active views. You can restore it from Archived Data.', confirmLabel: 'Archive', variant: 'destructive', onConfirm: async () => { await (onArchive ?? data.deleteDeal)(dealId); changed(deal ? { ...deal, isArchived: true } : undefined); toast.success('Deal archived'); } });
        }}><Archive className="h-4 w-4" />Archive</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>}
    {actionAllowed && <>
      {action === 'edit' && deal && <DealFormSheet isOpen mode="edit" initialData={editSnapshot ?? deal} onClose={closeAction} onSubmit={async values => { const next = await data.updateDeal(dealId, values as Partial<Deal>); changed(next); closeAction(); toast.success('Deal updated'); }} />}
      {action === 'task' && <TaskEditor links={{ dealIds: [dealId] }} preserveContextLinks onClose={closeAction} />}
      {(action === 'note' || action === 'won') && <CrmRecordPanel module="deals" id={dealId} open onOpenChange={value => { if (!value) { closeAction(); changed(); } }} focusNote={action === 'note'} focusClosing={action === 'won'} />}
      {action === 'stage' && deal && <DealStageDialog deal={deal} pipelines={data.pipelines} onClose={closeAction} onMove={async stageId => { const next = await data.moveDealStage(dealId, stageId); changed(next); toast.success('Deal stage updated'); }} />}
      {action === 'lost' && lost.length === 1 && <DealLostDialog onClose={closeAction} onSave={async reason => { const next = await data.moveDealStage(dealId, lost[0].id, undefined, reason); changed(next); toast.success('Deal closed as lost'); }} />}
      {action === 'recipient' && <Dialog open onOpenChange={value => { if (!value) closeAction(); }}><DialogContent aria-label="Choose an email recipient" className="max-w-sm"><DialogHeader><DialogTitle>Choose an email recipient</DialogTitle></DialogHeader><div className="space-y-2">{recipients.map(person => <Button key={person.email} variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" onClick={() => send(person)}>{person.name} · {person.email}</Button>)}</div><Button variant="ghost" onClick={closeAction}>Cancel</Button></DialogContent></Dialog>}
    </>}
    <ConfirmActionDialog {...dialogProps} />
  </div>;
}
