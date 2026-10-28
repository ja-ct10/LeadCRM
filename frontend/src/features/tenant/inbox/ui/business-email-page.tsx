'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, RefreshCw, Link2, Inbox } from 'lucide-react';
import { BUSINESS_INQUIRY_EMAIL, BUSINESS_INQUIRY_MAILTO, type BusinessEmailStatus, type BusinessEmailInquiryRead } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/store/AuthContext';
import { AddLeadForm } from '@/features/tenant/crm/leads/ui/lead-form';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import type { Lead } from '@/store/types';

export default function BusinessEmailPage() {
  const { user } = useAuth();
  const admin = user?.role === 'Client Admin';
  const [status, setStatus] = useState<BusinessEmailStatus | null>(null), [rows, setRows] = useState<BusinessEmailInquiryRead[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<BusinessEmailInquiryRead | null>(null), [page, setPage] = useState(1);
  const load = async () => {
    const [s, inquiries] = await Promise.all([apiClient.get<BusinessEmailStatus>('/integrations/business-email/status'), apiClient.get<{ data: BusinessEmailInquiryRead[] }>('/integrations/business-email/inquiries', { params: { page } })]);
    setStatus(s); setRows(inquiries.data);
  };
  const run = async (work: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(''); try { await work(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to process inquiry.'); } finally { setBusy(false); } };
  useEffect(() => { if (admin) void load().catch(e => setError(e.message)); }, [admin, page]);
  useEffect(() => { if (!admin) return; const timer = setInterval(() => { void load().catch(() => {}); }, 30000); return () => clearInterval(timer); }, [admin, page]);
  const names = selected?.senderName && selected.senderName !== selected.sender ? selected.senderName.split(/\s+/) : [];
  const prefill: Partial<Lead> = { firstName: names[0] ?? '', lastName: names.slice(1).join(' '), email: selected?.sender, source: 'Direct Email' };
  if (!admin) return <div className="p-6">Business email intake is available to the Client Admin.</div>;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div><Link href="/inbox" className="text-sm text-primary hover:underline">Back to Inbox</Link><h1 className="mt-3 text-2xl font-semibold tracking-tight">Business email inquiries</h1><p className="mt-1 text-sm text-muted-foreground">Capture incoming inquiries automatically, then review them before adding a Lead.</p></div>
    <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex min-w-0 gap-3"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Mail size={22} /></div><div><h2 className="break-all font-semibold">{BUSINESS_INQUIRY_EMAIL}</h2><p className="mt-1 text-sm text-muted-foreground">{status?.connected ? 'Connected · Read-only inquiry capture' : 'Connect this mailbox to enable automatic capture'}</p><p className="mt-2 text-xs text-muted-foreground">Last checked: {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Not checked yet'}</p></div></div>
      <div className="flex flex-wrap gap-2">{!status?.connected ? <button disabled={busy} onClick={() => void run(async () => { const result = await apiClient.post<{ url: string }>('/integrations/business-email/authorize', {}); window.location.assign(result.url); })} className="flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Link2 size={16} />Connect business email</button> : <><button disabled={busy} onClick={() => void run(() => apiClient.post('/integrations/business-email/sync', {}))} className="flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm"><RefreshCw size={16} />Check for inquiries</button><button disabled={busy} onClick={() => void run(() => apiClient.post('/integrations/business-email/disconnect', {}))} className="rounded-lg border px-4 text-sm">Disconnect</button></>}<a href={BUSINESS_INQUIRY_MAILTO} className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm">Open email link</a></div>
    </section>
    {(error || status?.syncError) && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error || status?.syncError}</p>}
    <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b p-4"><h2 className="font-semibold">Needs review</h2><p className="mt-1 text-xs text-muted-foreground">New messages received after connecting. Spam, automated messages and internal senders are excluded. Related messages do not create duplicate Leads.</p></div>
      {rows.length ? <div className="divide-y">{rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{row.senderName || row.sender}</p><p className="break-all text-xs text-muted-foreground">{row.sender}</p><h3 className="mt-2 text-sm font-medium">{row.subject || '(No subject)'}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.snippet}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(row.receivedAt).toLocaleString()} · Direct Email</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => setSelected(row)} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground">Review and create Lead</button><button disabled={busy} onClick={() => void run(() => apiClient.post(`/integrations/business-email/inquiries/${row.id}/review`, { action: 'dismiss' }))} className="rounded-lg border px-3 text-sm">Dismiss</button></div></article>)}</div> : <div className="px-4 py-14 text-center"><Inbox className="mx-auto text-muted-foreground" size={32} /><h3 className="mt-3 font-medium">No inquiries waiting for review</h3><p className="mt-1 text-sm text-muted-foreground">{status?.connected ? 'Send a new inquiry from an external email address, then check for inquiries.' : 'Connect the business mailbox to get started.'}</p></div>}
      <div className="flex justify-end gap-3 border-t p-3 text-sm"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={rows.length < 30} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </section>
    <p className="text-xs text-muted-foreground">A mail link opens your email app. A Lead is created only after a message is received and reviewed. Calls and SMS are entered manually under Others.</p>
    <SlidingDrawer isOpen={!!selected} onClose={() => setSelected(null)} title="Review email inquiry">{selected && <AddLeadForm prefill={prefill} onCancel={() => setSelected(null)} onSave={async data => { await apiClient.post(`/integrations/business-email/inquiries/${selected.id}/review`, { action: 'create', lead: data }); setSelected(null); await load(); }} />}</SlidingDrawer>
  </main>;
}
