'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { QuotationDraftSchema, quotationNumber, quotationVariableChoices, type QuotationDraft, type QuotationPreview } from '@leadcrm/shared';
import type { Template } from '@/store/types';
import { useAuth } from '@/store/AuthContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { usePanelDraft } from '@/shared/hooks/use-panel-close-guard';
import { useProductInterests } from '@/shared/hooks/use-product-interests';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { dealsApi } from '@/shared/services/deals.api';
import { Label } from '@/shared/components/ui/label';
import { DatePicker } from '@/shared/components/ui/date-time-picker';
import { Button } from '@/shared/components/ui/button';
import { panelBodyClass, panelFooterClass, panelInputClass, panelLabelClass } from '@/shared/components/side-panel-styles';
import { apiClient, type ApiRequestError } from '@/lib/api/client';
import { formatCurrency } from '@/shared/utils/currency';
import { useCampaignVariableFields } from './campaign-variable-picker';
import { QuotationVariableField } from './quotation-variable-field';
import { FieldError } from './audience-panel';
import { quotationsApi, quotationPdfBlob, downloadQuotationPdf } from '../services/quotations.api';
import { toast } from 'sonner';

function initialDraft(templateId: string): QuotationDraft {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const until = new Date(today + 'T00:00:00Z'); until.setUTCDate(until.getUTCDate() + 30);
  return { quotationId: crypto.randomUUID(), templateId, recipientType: 'Lead', recipientId: '', dealId: '', products: [], quotationDate: today, validUntil: until.toISOString().slice(0, 10), notes: '' };
}
const noDealProduct = 'No product is associated with this Deal. Please select a Deal with an assigned product.';

export function QuotationWizard({ template, onClose }: { template: Template; onClose: () => void }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState(() => initialDraft(template.id)), [step, setStep] = useState(1);
  const [preview, setPreview] = useState<QuotationPreview | null>(null), [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ recipient?: string; deal?: string }>({});
  const lock = useRef(false), requestId = useRef(crypto.randomUUID());
  const products = useProductInterests(), catalog = useCampaignVariableFields();
  const canViewDeals = useHasPermission('deals.view'), canViewProducts = useHasPermission('products.view'), canSend = useHasPermission('campaigns.send');
  const canEditLead = useHasPermission('leads.edit'), canEditContact = useHasPermission('contacts.edit');
  const canViewLead = useHasPermission('leads.view'), canViewContact = useHasPermission('contacts.view');
  const source = draft.recipientType === 'Lead' ? 'leads' : 'contacts';
  const recipient = useCachedPage({ module: source, params: { quotationRecipient: draft.recipientId, canViewDeals }, disabled: !draft.recipientId || !(draft.recipientType === 'Lead' ? canViewLead : canViewContact), revalidateOnInvalidation: true,
    fetchFn: async signal => {
      const [record, relationships] = await Promise.all([
        apiClient.get<{ data: { assignedUserId?: string; email?: string } }>(`/crm/${source}/${draft.recipientId}`, { signal }),
        canViewDeals ? apiClient.get<{ data: { deals: { id: string; title: string }[]; hasMoreDeals: boolean } }>(`/crm/${source}/${draft.recipientId}/relationships?limit=50`, { signal }) : Promise.resolve({ data: { deals: [], hasMoreDeals: false } }),
      ]);
      return { ...record.data, ...relationships.data, recordId: draft.recipientId };
    } });
  const currentRecipient = recipient.data?.recordId === draft.recipientId ? recipient.data : null;
  const relatedDeal = canViewDeals && !!currentRecipient?.deals.some(deal => deal.id === draft.dealId);
  const deal = useCachedPage({ module: 'deals', params: { quotationDeal: draft.dealId, recipientId: draft.recipientId, recipientType: draft.recipientType },
    disabled: !relatedDeal || !canViewProducts, revalidateOnInvalidation: true,
    fetchFn: async signal => (await dealsApi.get(draft.dealId, signal)).data });
  const currentDeal = relatedDeal && deal.data?.id === draft.dealId && !deal.data.isArchived ? deal.data : null;
  const product = canViewProducts && currentDeal?.productInterestId ? products.products.find(row => row.id === currentDeal.productInterestId && row.active) : undefined;
  const productLoading = deal.isInitialLoad || products.loading;
  const productError = !canViewDeals ? 'Deals View permission is required.' : !canViewProducts ? 'Products View permission is required.'
    : recipient.error || (!relatedDeal ? 'Choose a visible Deal linked to this recipient.' : '') || deal.error || products.error
    || (!products.enabled ? 'The Product catalog is unavailable.' : '')
    || (!productLoading && currentDeal && !currentDeal.productInterestId ? noDealProduct : '')
    || (!productLoading && (!currentDeal || !product) ? 'The Deal’s Product is unavailable. Select a Deal with an available Product.' : '');
  const productId = !productError ? product?.id : undefined;
  // The cache hook scopes responses to the selected recipient/Deal and aborts old reads.
  // A background canonical Product change resets its quantity; unchanged rows retain it.
  useEffect(() => {
    if (busy || pending || sent || productLoading) return;
    setDraft(value => {
      if ((productId && value.products.length === 1 && value.products[0].productId === productId) || (!productId && !value.products.length)) return value;
      return { ...value, products: productId ? [{ productId, quantity: 1 }] : [] };
    });
  }, [draft.dealId, draft.products.length, draft.products[0]?.productId, productId, productLoading, busy, pending, sent]);
  const sourceKey = JSON.stringify([draft, productError, currentDeal?.productInterestId, product?.name, product?.category, product?.description, product?.dealValue, currentRecipient?.assignedUserId, currentRecipient?.email]);
  const currentSource = useRef(sourceKey), reviewedSource = useRef('');
  currentSource.current = sourceKey;
  useEffect(() => {
    if (!preview || busy || pending || sent || reviewedSource.current === sourceKey) return;
    setPreview(null); setStep(value => value === 4 ? 3 : value); setError('Quotation data changed. Refresh the preview before sending.');
    requestId.current = crypto.randomUUID();
  }, [sourceKey, preview, busy, pending, sent]);
  const allowedSend = canSend && (draft.recipientType === 'Lead' ? canEditLead : canEditContact) && currentRecipient?.assignedUserId === user?.id && !!currentRecipient?.email;
  const dirty = !sent && (!!draft.recipientId || !!draft.products.length || !!draft.notes);
  const close = usePanelDraft({ dirty, busy: busy || pending }) ?? onClose;
  useEffect(() => { if (!preview) { setPdfUrl(''); return; } const url = URL.createObjectURL(quotationPdfBlob(preview.pdfBase64)); setPdfUrl(url); return () => URL.revokeObjectURL(url); }, [preview]);
  useEffect(() => { if (!dirty) return; const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload); }, [dirty]);
  function change(patch: Partial<QuotationDraft>) { if (busy || pending || sent) return; setDraft(value => ({ ...value, ...patch })); setPreview(null); setError(''); setFieldErrors({}); requestId.current = crypto.randomUUID(); }
  const money = (value: number) => formatCurrency(value, undefined, 2);
  const total = draft.products.reduce((sum, line) => sum + Math.round((products.products.find(product => product.id === line.productId)?.dealValue ?? 0) * 100) * line.quantity, 0) / 100;
  async function next() {
    setError('');
    if (step === 1) {
      if (!draft.recipientId || !currentRecipient || recipient.error) { setFieldErrors({ recipient: 'Select an available recipient.' }); document.getElementById('quotation-recipient')?.focus(); return; }
      if (!draft.dealId || !relatedDeal) { setFieldErrors({ deal: !canViewDeals ? 'Deals View permission is required.' : !draft.dealId ? 'Associated Deal is required.' : 'Choose a visible Deal linked to this recipient.' }); document.getElementById('quotation-deal')?.focus(); return; }
      setFieldErrors({}); setStep(2); return;
    }
    if (step === 2) {
      if (productLoading) { setError('Loading the Deal’s Product. Please wait.'); return; }
      if (productError || !productId || draft.products.length !== 1 || draft.products[0].productId !== productId) { setError(productError ? '' : 'Review the Product associated with this Deal.'); return; }
      if (draft.products.some(line => !Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > 1000000)) { setError('Enter a positive whole-number quantity from 1 to 1,000,000.'); return; }
      setStep(3); return;
    }
    if (productLoading || productError || !productId || draft.products[0]?.productId !== productId) { setStep(2); setError(productError ? '' : 'Review the Product associated with this Deal.'); return; }
    const parsed = QuotationDraftSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (lock.current) return; lock.current = true; setBusy(true);
    const requestedSource = sourceKey;
    try { const result = await quotationsApi.preview(parsed.data);
      if (currentSource.current !== requestedSource) { setError('Quotation data changed. Refresh the preview before sending.'); return; }
      reviewedSource.current = requestedSource; setPreview(result.data); setStep(4);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate the preview.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function send() {
    if (!preview || lock.current || sent) return;
    lock.current = true; setBusy(true); setError('');
    try { await quotationsApi.send({ draft, requestId: requestId.current, fingerprint: preview.fingerprint }); setSent(true); setPending(false); toast.success('Quotation sent.'); }
    catch (reason) {
      const failure = reason as ApiRequestError;
      const uncertain = !failure.status || failure.status >= 500 || ['GMAIL_OUTCOME_UNKNOWN', 'MAILBOX_OPERATION_PENDING', 'MAILBOX_OPERATION_CLAIM_LOST'].includes(failure.code ?? '');
      setPending(uncertain);
      const message = failure.message || 'Unable to send quotation.'; setError(message); toast.error(message);
      if (failure.code === 'QUOTATION_PREVIEW_CHANGED') { setPreview(null); setStep(3); }
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="flex h-full min-w-0 flex-col">
    <ol aria-label="Quotation steps" className="grid shrink-0 grid-cols-4 gap-1 border-b border-border px-3 py-4">{['Recipient', 'Products', 'Quotation Details', 'Preview'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`min-w-0 text-center text-[10px] sm:text-xs ${step >= index + 1 ? 'text-primary' : 'text-muted-foreground'}`}><span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full border ${step >= index + 1 ? 'border-primary bg-primary text-white' : 'border-border'}`}>{step > index + 1 ? <Check size={13} /> : index + 1}</span><span>{label}</span></li>)}</ol>
    <div className={panelBodyClass + ' min-w-0 flex-1 space-y-4'}>
      <h2 className="text-lg font-semibold">{['Recipient', 'Products', 'Quotation Details', 'Preview'][step - 1]}</h2>
      {step === 1 && <div className="space-y-4"><div><Label htmlFor="quotation-recipient-type" className={panelLabelClass}>Send To <span className="text-red-500" aria-hidden="true">*</span></Label><select id="quotation-recipient-type" aria-required="true" className={panelInputClass} value={draft.recipientType} onChange={event => change({ recipientType: event.target.value as 'Lead' | 'Contact', recipientId: '', dealId: '', products: [] })}><option disabled={!canViewLead}>Lead</option><option disabled={!canViewContact}>Contact</option></select></div>
        <div><Label id="quotation-recipient-label" htmlFor="quotation-recipient" className={panelLabelClass}>Recipient <span className="text-red-500" aria-hidden="true">*</span></Label><EntityCombobox id="quotation-recipient" aria-labelledby="quotation-recipient-label" aria-required="true" error={fieldErrors.recipient} entityType={source} value={draft.recipientId || null} onChange={id => change({ recipientId: id ?? '', dealId: '', products: [] })} placeholder="Search recipient…" disabled={draft.recipientType === 'Lead' ? !canViewLead : !canViewContact} /></div>
        <div><Label htmlFor="quotation-deal" className={panelLabelClass}>Associated Deal <span className="text-red-500" aria-hidden="true">*</span></Label><select id="quotation-deal" aria-required="true" aria-invalid={!!fieldErrors.deal} aria-describedby={fieldErrors.deal ? 'quotation-deal-error' : undefined} className={panelInputClass} value={draft.dealId} disabled={!canViewDeals || !currentRecipient || !!recipient.error || recipient.isInitialLoad} onChange={event => change({ dealId: event.target.value, products: [] })}><option value="">Select associated Deal</option>{canViewDeals && currentRecipient?.deals.map(deal => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select><div id="quotation-deal-error"><FieldError message={fieldErrors.deal} /></div>{!canViewDeals && <p className="text-xs text-muted-foreground">Deals View permission is required.</p>}{currentRecipient?.hasMoreDeals && <p className="text-xs text-muted-foreground">Showing the first 50 linked Deals.</p>}</div>
        {recipient.error && <p role="alert" className="text-sm text-destructive">{recipient.error}</p>}</div>}
      {step === 2 && <div className="min-w-0 space-y-4">
        {productLoading ? <p role="status" className="text-sm text-muted-foreground">Loading the Deal’s Product…</p> : productError ? <FieldError message={productError} /> : <>
          <div className="min-w-0 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted"><tr>{['Product', 'Category', 'Description', 'Qty', 'Deal Value', 'Total'].map(label => <th key={label} scope="col" className="p-2 text-left">{label}</th>)}</tr></thead><tbody>{draft.products.filter(line => line.productId === productId).map(line => <tr key={line.productId} className="border-t border-border"><td className="max-w-48 break-words p-2">{product?.name}</td><td className="max-w-36 break-words p-2">{product?.category || '—'}</td><td className="max-w-60 break-words p-2">{product?.description || '—'}</td><td className="p-2"><input aria-label={`Quantity for ${product?.name ?? 'product'}`} className={panelInputClass + ' w-20'} type="number" min="1" max="1000000" step="1" value={line.quantity || ''} onChange={event => change({ products: [{ ...line, quantity: Number(event.target.value) }] })} /></td><td className="whitespace-nowrap p-2">{money(product?.dealValue ?? 0)}</td><td className="whitespace-nowrap p-2">{money(Math.round((product?.dealValue ?? 0) * 100) * line.quantity / 100)}</td></tr>)}</tbody></table></div>
          <p className="text-right text-sm font-semibold">Total: {money(total)}</p>
        </>}
      </div>}
      {step === 3 && <div className="space-y-4"><div><label className={panelLabelClass} htmlFor="quotation-number">Quotation Number</label><input id="quotation-number" className={panelInputClass} readOnly value={quotationNumber(draft.quotationId, draft.quotationDate)} /></div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="quotation-date" className={panelLabelClass}>Quotation Date</label><DatePicker id="quotation-date" value={draft.quotationDate} onChange={quotationDate => change({ quotationDate })} /></div><div><label htmlFor="quotation-until" className={panelLabelClass}>Valid Until</label><DatePicker id="quotation-until" value={draft.validUntil} minDate={draft.quotationDate} onChange={validUntil => change({ validUntil })} /></div></div>
        <QuotationVariableField id="quotation-notes" label="Notes" value={draft.notes} onChange={notes => change({ notes })} choices={quotationVariableChoices(catalog.fields, draft.recipientType === 'Lead' ? 'LEADS' : 'CONTACTS')} /></div>}
      {step === 4 && preview && <div className="min-w-0 space-y-3"><p className="text-sm text-muted-foreground">Review the quotation before downloading or sending.</p>{pdfUrl && <><iframe title="Quotation PDF preview" src={pdfUrl + '#view=FitH'} className="h-[55vh] min-h-80 w-full rounded border border-border" /><a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Open PDF in a new tab</a></>}<p className="text-right font-semibold">Total: {money(Number(preview.document.total))}</p>{!allowedSend && <p className="text-xs text-muted-foreground">Sending requires an email address, Campaign Send and CRM edit permissions, and this recipient’s assignment to you. Your connected Gmail account is checked when sending.</p>}{sent && <p role="status" className="text-sm text-primary">Quotation sent.</p>}</div>}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    </div>
    <div className={panelFooterClass + ' mt-auto flex flex-wrap items-center justify-between gap-2'}><Button variant="outline" disabled={busy || pending} onClick={step === 1 || sent ? close : () => setStep(value => value - 1)}>{sent ? 'Close' : step === 1 ? 'Cancel' : 'Back'}</Button>
      {step < 4 ? <Button disabled={busy} onClick={() => void next()}>{busy ? 'Generating…' : 'Next'}</Button> : <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!preview || busy} onClick={() => preview && downloadQuotationPdf(quotationPdfBlob(preview.pdfBase64), preview.filename)}>Download PDF</Button><Button disabled={busy || sent || !allowedSend} onClick={() => void send()}>{busy ? 'Sending…' : sent ? 'Sent' : pending ? 'Verify send' : 'Send'}</Button></div>}
    </div>
  </div>;
}
