'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, File, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { MailboxAttachment, MailboxMessageContent } from '@leadcrm/shared';
import type { ApiRequestError } from '@/lib/api/client';
import { AttachmentPreview, isPreviewableAttachment } from '@/shared/components/attachment-preview';
import { Button } from '@/shared/components/ui/button';
import { fetchGmailMessageContent, fetchGmailAttachment, type GmailEmail } from '../services/gmail.service';
import { mailboxReferencedContentIds } from '../services/email-html';
import { EmailHtmlFrame } from './email-html-frame';

const rasterImage = (type: string) => /^image\/(png|jpeg|gif|webp)$/i.test(type);
const previewable = isPreviewableAttachment;
type Resource = { url: string; blob: Blob };
function sizeLabel(bytes?: number) {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const typeLabel = (type: string) => type === 'application/pdf' ? 'PDF Document' : rasterImage(type) ? type.replace('image/', '').toUpperCase() + ' Image' : type;

export function EmailMessageContent({ email, onUnavailable, afterBody }: { email: GmailEmail; onUnavailable?: (error: unknown) => void; afterBody?: React.ReactNode }) {
  const [recovered, setRecovered] = useState<MailboxMessageContent>();
  const content = useMemo(() => recovered ?? { body: email.body, attachments: email.attachments ?? [] }, [recovered, email.body, email.attachments]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [resources, setResources] = useState<Record<string, Resource>>({});
  const [preview, setPreview] = useState<MailboxAttachment | null>(null), [busy, setBusy] = useState('');
  const [imageError, setImageError] = useState(false), [imageRetry, setImageRetry] = useState(0);
  const accessCallback = useRef(onUnavailable); accessCallback.current = onUnavailable;
  const resourceCache = useRef<Record<string, Resource>>({});
  const resourceRequests = useRef(new Map<string, Promise<Resource | undefined>>());
  const resourceController = useRef<AbortController | undefined>(undefined);
  const generation = useRef(0), actionPending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchGmailMessageContent(email.id, controller.signal).then(result => {
      if (!controller.signal.aborted) setRecovered(result);
    }).catch((error: ApiRequestError) => {
      if (controller.signal.aborted) return;
      if ([401, 403, 404, 409].includes(error.status ?? 0)) { setRecovered({ body: '', attachments: [] }); accessCallback.current?.(error); }
      setError(error.message || 'Unable to load the original message. Showing saved content.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [email.id, retry]);

  const referencedIds = useMemo(() => mailboxReferencedContentIds(content.body), [content.body]);

  const obtain = (file: MailboxAttachment): Promise<Resource | undefined> => {
    const cached = resourceCache.current[file.id];
    if (cached) return Promise.resolve(cached);
    const pending = resourceRequests.current.get(file.id);
    if (pending) return pending;
    const currentGeneration = generation.current;
    const request = fetchGmailAttachment(email.id, file.id, resourceController.current?.signal).then(blob => {
      if (currentGeneration !== generation.current) return;
      const resource = { blob, url: URL.createObjectURL(blob) };
      resourceCache.current[file.id] = resource;
      setResources(previous => ({ ...previous, [file.id]: resource }));
      return resource;
    }).finally(() => { if (generation.current === currentGeneration) resourceRequests.current.delete(file.id); });
    resourceRequests.current.set(file.id, request);
    return request;
  };
  const handleFileError = (error: unknown) => {
    const request = error as ApiRequestError;
    if ([401, 403, 409].includes(request.status ?? 0) || request.code === 'MAILBOX_SCOPE_CHANGED') accessCallback.current?.(error);
    setPreview(null);
    return request.message || 'This attachment is unavailable. Please try again.';
  };
  useEffect(() => {
    const controller = new AbortController(); resourceController.current = controller;
    const currentGeneration = ++generation.current;
    return () => {
      controller.abort();
      if (generation.current === currentGeneration) generation.current++;
      Object.values(resourceCache.current).forEach(resource => URL.revokeObjectURL(resource.url));
      resourceCache.current = {}; resourceRequests.current.clear();
    };
  }, [email.id]);
  useEffect(() => {
    let active = true; setImageError(false);
    void (async () => {
      for (const file of content.attachments.filter(file => rasterImage(file.mimeType))) {
        if (!active) break;
        try { await obtain(file); }
        catch (error) {
          if (active) { handleFileError(error); if (file.contentId && referencedIds.has(file.contentId)) setImageError(true); }
        }
      }
    })();
    return () => { active = false; };
    // Resources live until this message closes, including while its metadata is recovered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id, content.attachments, imageRetry]);

  const inlineImages = useMemo(() => Object.fromEntries(content.attachments.flatMap(file => file.contentId && resources[file.id] && rasterImage(resources[file.id].blob.type) ? [[file.contentId, resources[file.id].url]] : [])), [content.attachments, resources]);
  const files = content.attachments.filter(file => file.disposition !== 'inline' && !(file.contentId && referencedIds.has(file.contentId)));
  const fileAction = async (file: MailboxAttachment, download: boolean) => {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(file.id);
    const currentGeneration = generation.current;
    try {
      const resource = await obtain(file);
      if (!resource || currentGeneration !== generation.current) return;
      if (download) {
        const link = document.createElement('a'); link.href = resource.url; link.download = file.filename || 'attachment'; link.click();
      } else if (previewable(resource.blob.type)) setPreview(file);
      else toast.error('Preview is unavailable for this file. Use Download to save the original attachment.');
    } catch (error) { if (currentGeneration === generation.current) toast.error(handleFileError(error)); }
    finally { if (currentGeneration === generation.current) setBusy(''); actionPending.current = false; }
  };
  const selected = preview && resources[preview.id];
  const closePreview = () => {
    if (preview && selected && !rasterImage(selected.blob.type)) {
      URL.revokeObjectURL(selected.url); delete resourceCache.current[preview.id];
      setResources(previous => { const next = { ...previous }; delete next[preview.id]; return next; });
    }
    setPreview(null);
  };
  return <>
    {loading && <p role="status" className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" />Loading original message…</p>}
    {error && <div role="alert" className="mb-3 text-xs text-destructive">{error}<Button variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>Retry message</Button></div>}
    <EmailHtmlFrame body={content.body} inlineImages={inlineImages} />
    {imageError && <div role="status" className="mt-2 text-xs text-muted-foreground">Some inline images could not be loaded.<Button variant="ghost" size="sm" onClick={() => setImageRetry(value => value + 1)}>Retry images</Button></div>}
    {afterBody}
    {!!files.length && <section className="mt-4 min-w-0" aria-label="Message attachments">
      <p className="mb-2 text-xs font-medium">{files.length} {files.length === 1 ? 'attachment' : 'attachments'}</p>
      <ul className="min-w-0 space-y-2">{files.map(file => {
        const resource = resources[file.id], Icon = rasterImage(file.mimeType) ? ImageIcon : file.mimeType === 'application/pdf' ? FileText : File;
        return <li key={file.id} className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-3 rounded-lg border border-border p-3">
          {resource && rasterImage(resource.blob.type) ? <img src={resource.url} alt={file.filename || 'Attached image'} className="h-12 w-12 shrink-0 rounded object-contain" /> : <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <p className="text-sm font-medium" title={file.filename}>{file.filename || 'Unnamed attachment'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{typeLabel(file.mimeType)}{file.size !== undefined && ` · ${sizeLabel(file.size)}`}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {previewable(file.mimeType) && <Button size="sm" variant="outline" className="min-h-10 flex-1 sm:flex-none" disabled={!!busy} aria-label={`Preview ${file.filename}`} onClick={() => void fileAction(file, false)}>Preview</Button>}
            <Button size="sm" variant="outline" className="min-h-10 flex-1 sm:flex-none" disabled={!!busy} aria-label={`Download ${file.filename}`} onClick={() => void fileAction(file, true)}>{busy === file.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download</Button>
          </div>
        </li>;
      })}</ul>
    </section>}
    <AttachmentPreview file={selected && preview ? { name: preview.filename, url: selected.url, type: selected.blob.type } : null}
      onClose={closePreview} onDownload={() => { if (preview) void fileAction(preview, true); }} />
  </>;
}
