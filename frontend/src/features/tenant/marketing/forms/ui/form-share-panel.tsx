'use client';
import { toast } from '@/shared/utils/toast';
import type { FormRecord } from '../types/form.types';

export function FormSharePanel({ form, dirty, shareLink, embedCode }: { form: FormRecord; dirty: boolean; shareLink: string; embedCode: string }) {
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success('Copied.'); } catch { toast.error('Unable to copy'); } };
  return <div className="grid w-full min-w-0 gap-5 lg:grid-cols-2">
    {(dirty || form.publishedRevision !== form.revision) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 lg:col-span-2">This form has unpublished edits. Publish it in order to see the latest changes.</p>}
    {!form.publishedVersion ? <p className="text-sm text-muted-foreground lg:col-span-2">Publish this form to enable its public link and embed code.</p> : <>
      <section className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground"><h2 className="font-semibold">Embed Code</h2><pre className="max-w-full overflow-x-auto rounded bg-muted p-3 text-xs text-foreground">{embedCode}</pre><button className="min-h-10 rounded border border-border px-3 py-2 text-sm" onClick={() => void copy(embedCode)}>Copy code</button></section>
      <section className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground"><h2 className="font-semibold">Share Link</h2><a className="break-all text-sm text-primary underline" href={shareLink} target="_blank" rel="noreferrer">{shareLink}</a><button className="block min-h-10 rounded border border-border px-3 py-2 text-sm" onClick={() => void copy(shareLink)}>Copy share link</button></section>
    </>}
  </div>;
}
