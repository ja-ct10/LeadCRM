'use client';
import React from 'react';
import { Download } from 'lucide-react';
import { SideSheet } from './side-sheet';
import { Button } from './ui/button';

export const isPreviewableAttachment = (type: string) => type === 'application/pdf' || /^image\/(png|jpeg|gif|webp)$/i.test(type);

/** The Inbox's original Blob/iframe preview, shared with record Files. */
export function AttachmentPreview({ file, onClose, onDownload, downloading = false }: {
  file: { name: string; url: string; type: string } | null;
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  return <SideSheet isOpen={!!file} onClose={onClose} title={file?.name || 'Attachment Preview'} width="w-full max-w-3xl">
    {file && <div className="flex min-h-[65vh] min-w-0 flex-col gap-3 p-4">
      <Button variant="outline" className="self-start" onClick={onDownload} disabled={downloading}><Download size={16} />Download</Button>
      {file.type === 'application/pdf' ? <><iframe title="Email attachment PDF preview" src={file.url + '#view=FitH'} className="min-h-[65vh] w-full flex-1 rounded border border-border" /><a className="text-sm text-primary underline" href={file.url} target="_blank" rel="noopener noreferrer">Open PDF in a new tab</a></> : <img src={file.url} alt={file.name || 'Attached image'} className="max-h-[75vh] max-w-full self-center object-contain" />}
    </div>}
  </SideSheet>;
}
