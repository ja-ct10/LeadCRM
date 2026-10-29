'use client';

import { useState } from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';
import { BUSINESS_INQUIRY_EMAIL, BUSINESS_INQUIRY_MAILTO, SOURCE_LINK_PRESETS, sourceCampaignLink } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/shared/utils/toast';
import type { FormRecord } from '../types/form.types';

interface Props {
  form: FormRecord;
  dirty: boolean;
  shareLink: string;
  /** Retained for compatibility with later embedding UI. */
  embedCode?: string;
}

const actionClass = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function FormSharePanel({ form, dirty, shareLink }: Props) {
  const [downloading, setDownloading] = useState(false);
  const published = form.status === 'published' && form.publishedVersion > 0;
  const needsPublish = dirty || form.publishedRevision !== form.revision;
  const canShare = published && !needsPublish && form.settings.trackUrlParams;

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied.'); }
    catch { toast.error('Unable to copy'); }
  };
  const download = async () => {
    if (!canShare || downloading) return;
    setDownloading(true);
    try {
      const blob = await apiClient.download(`/marketing/forms/${form.id}/source-links.pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'leadcrm-source-links.pdf';
      document.body.appendChild(anchor);
      try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to download links.'); }
    finally { setDownloading(false); }
  };

  return <div className="w-full min-w-0 space-y-4">
    {needsPublish && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">This form has unpublished edits. Publish the latest changes to enable source sharing.</p>}
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground" aria-label="Source sharing">
      <div className="space-y-2 border-b border-border p-4 sm:p-5">
        <h2 className="font-semibold">Source links and QR codes</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">Choose where you will share the form. Its source is recorded when a customer submits an inquiry.</p>
      </div>
      {!published ? <p className="p-4 text-sm text-muted-foreground sm:p-5">Publish this form to enable source links and the QR PDF.</p> : <>
        <div className="space-y-3 border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <button type="button" disabled={!canShare || downloading} onClick={() => void download()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={16} aria-hidden="true" />{downloading ? 'Preparing PDF…' : 'Download links + QR PDF'}
            </button>
          </div>
          {!form.settings.trackUrlParams && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Enable Track URL Parameters in Settings, then publish the form to use source links.</p>}
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              <th scope="col" className="px-4 py-3 font-semibold">Source category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Platform / source</th>
              <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {SOURCE_LINK_PRESETS.map(row => {
                const link = canShare ? sourceCampaignLink(shareLink, row.source, row.medium) : undefined;
                return <tr key={row.source}>
                  <th scope="row" className="px-4 py-3 font-medium">{row.category}</th>
                  <td className="px-4 py-3 text-muted-foreground">{row.source}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                    <a aria-label={`Open ${row.source} form`} aria-disabled={!link} tabIndex={link ? undefined : -1} href={link} target="_blank" rel="noopener noreferrer" className={`${actionClass} ${link ? 'text-primary hover:bg-accent' : 'cursor-not-allowed text-muted-foreground opacity-50'}`}><ExternalLink size={14} aria-hidden="true" />Open form</a>
                    <button type="button" disabled={!link} aria-label={`Copy ${row.source} link`} onClick={() => { if (link) void copy(link); }} className={`${actionClass} hover:bg-accent`}><Copy size={13} aria-hidden="true" />Copy</button>
                  </div></td>
                </tr>;
              })}
              <tr><th scope="row" className="px-4 py-3 font-medium">Direct Email</th><td className="break-all px-4 py-3 text-muted-foreground">{BUSINESS_INQUIRY_EMAIL}</td><td className="px-4 py-3"><a href={BUSINESS_INQUIRY_MAILTO} className={`${actionClass} text-primary hover:bg-accent`}>Open email</a><p className="mt-2 max-w-sm text-xs text-muted-foreground">Mailbox connection and staff review are required.</p></td></tr>
              <tr><th scope="row" className="px-4 py-3 font-medium">Others</th><td className="px-4 py-3 text-muted-foreground">Call / SMS</td><td className="px-4 py-3 text-xs text-muted-foreground">Staff create a Lead, select Others, and enter Call or SMS in Source detail.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-border p-4 text-xs text-muted-foreground">QR codes are included in the PDF. Opening a link or scanning a QR code alone creates no Lead. Use the public HTTPS form links when sharing with other devices.</p>
      </>}
    </section>
  </div>;
}
