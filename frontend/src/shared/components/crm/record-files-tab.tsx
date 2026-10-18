'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Loader2,
  Upload,
  FileText,
  Image,
  Download,
  Trash2,
  File as FileIcon,
  Plus,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { RECORD_FILE_MAX_BYTES } from '@leadcrm/shared';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { DataLoadingSkeleton } from './data-view-states';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import type { PermissionKey } from '@leadcrm/shared';
import type { RecordEmailAttachmentContext, RecordEmailAttachmentReference } from '@leadcrm/shared';
import { fetchGmailAttachment } from '@/features/tenant/inbox/services/gmail.service';
import { AttachmentPreview, isPreviewableAttachment } from '@/shared/components/attachment-preview';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  name: string;
  size?: number;
  type: string;
  uploadedAt: string;
  uploadedBy?: string;
  url?: string;
  emailAttachment?: RecordEmailAttachmentReference;
}

export interface RecordFilesTabProps {
  /** Existing files for this record */
  files: FileRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Permission key for delete access */
  deletePermission?: PermissionKey;
  /** Callback when a file is uploaded */
  onUpload?: (file: File) => Promise<void>;
  /** Callback when a file is deleted */
  onDelete?: (fileId: string) => Promise<void>;
  emailContext?: RecordEmailAttachmentContext;
  attachmentAccessKey?: string;
  onEmailUnavailable?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1);
  return `${size} ${units[idx]}`;
}

function getFileIcon(mimeType: string): React.ComponentType<{ className?: string }> {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  return FileIcon;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────

interface UploadZoneProps {
  onUpload?: (file: File) => Promise<void>;
}

function UploadZone({ onUpload }: UploadZoneProps): React.ReactElement {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    if (!onUpload || isUploading) return;
    if (!file.size || file.size > RECORD_FILE_MAX_BYTES) { toast.error('Choose a nonempty file no larger than 10 MB.'); return; }
    setIsUploading(true);
    try {
      await onUpload(file);
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/50',
        isUploading && 'opacity-50 pointer-events-none'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleChange}
        className="hidden"
        aria-label="Choose file"
        disabled={isUploading}
      />
      {isUploading ? <Loader2 role="status" aria-label="Uploading file" className="h-8 w-8 animate-spin text-primary mx-auto mb-3" /> : <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />}
      <p className="text-sm text-muted-foreground mb-1">
        {isUploading ? 'Uploading...' : 'Drag and drop a file here, or'}
      </p>
      {!isUploading ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Upload file
        </Button>
      ) : null}
    </div>
  );
}

// ─── File Row ────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileRecord;
  canDelete: boolean;
  onDelete?: (fileId: string) => Promise<void>;
  onPreview?: () => void;
  onDownload?: () => void;
  busy?: boolean;
}

function FileRow({ file, canDelete, onDelete, onPreview, onDownload, busy }: FileRowProps): React.ReactElement {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const Icon = getFileIcon(file.type);

  const handleDeleteClick = (): void => {
    if (!onDelete) return;
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(file.id);
      toast.success('File deleted');
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete file. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group',
        isDeleting && 'opacity-50 pointer-events-none',
      )}>
        {/* File icon */}
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5 text-muted-foreground" />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={file.name}>{file.name}</p>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {file.emailAttachment && `${file.type === 'application/pdf' ? 'PDF Document' : file.type.startsWith('image/') ? file.type.slice(6).toUpperCase() + ' Image' : file.type} · `}
            {file.size !== undefined && `${formatFileSize(file.size)} · `}{formatDate(file.uploadedAt)}
            {file.uploadedBy && ` · ${file.uploadedBy}`}
            {file.emailAttachment && ' · Email Attachment'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {onPreview && <button type="button" onClick={onPreview} disabled={busy} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent disabled:opacity-50" aria-label={`Preview ${file.name}`} title="Preview file"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>}
          {onDownload ? <button type="button" onClick={onDownload} disabled={busy} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent disabled:opacity-50" aria-label={`Download ${file.name}`} title="Download file">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-muted-foreground" />}</button> : file.url && (
            <TooltipProvider><Tooltip><TooltipTrigger asChild><a
              href={file.url}
              download={file.name}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
              aria-label={`Download ${file.name}`}
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a></TooltipTrigger><TooltipContent>Download file</TooltipContent></Tooltip></TooltipProvider>
          )}
          {!file.emailAttachment && canDelete && onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Delete ${file.name}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete File"
        description={`Delete "${file.name}"?`}
        warning="This file will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecordFilesTab({
  files,
  loading,
  error,
  onRetry,
  deletePermission,
  onUpload,
  onDelete,
  emailContext,
  attachmentAccessKey,
  onEmailUnavailable,
  hasMore,
  loadingMore,
  onLoadMore,
}: RecordFilesTabProps): React.ReactElement {
  const canDelete = useHasPermission(deletePermission ?? 'contacts.archive' as PermissionKey);
  const [preview, setPreview] = useState<{ file: FileRecord; url: string; type: string; identity: string } | null>(null);
  const previewIdentity = JSON.stringify([attachmentAccessKey, emailContext?.recordModule, emailContext?.recordId]);
  const [busy, setBusy] = useState('');
  const request = useRef<AbortController | null>(null), previewUrl = useRef(''), generation = useRef(0);
  const closePreview = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = ''; setPreview(null);
  };
  useEffect(() => {
    setPreview(null); setBusy('');
    return () => {
      generation.current++; request.current?.abort(); request.current = null;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = '';
    };
  }, [previewIdentity]);
  const visiblePreview = preview?.identity === previewIdentity && files.some(file => file.id === preview.file.id && file.emailAttachment) ? preview : null;
  useEffect(() => { if (preview && !visiblePreview) closePreview(); }, [preview, visiblePreview]);
  const emailAction = async (file: FileRecord, download: boolean) => {
    if (!file.emailAttachment || !emailContext || request.current) return;
    const controller = new AbortController(), current = generation.current;
    request.current = controller; setBusy(file.id);
    try {
      const reference = file.emailAttachment;
      const blob = await fetchGmailAttachment(reference.messageId, reference.attachmentId, controller.signal, { ...emailContext, accountId: reference.accountId });
      if (controller.signal.aborted || current !== generation.current) return;
      if (download) {
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = file.name || 'attachment'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } else if (isPreviewableAttachment(blob.type)) {
        closePreview(); const url = URL.createObjectURL(blob); previewUrl.current = url;
        setPreview({ file, url, type: blob.type, identity: previewIdentity });
      } else toast.error('Preview is unavailable for this file. Use Download to save the original attachment.');
    } catch (error) {
      if (controller.signal.aborted || current !== generation.current) return;
      closePreview();
      const failure = error as { status?: number; message?: string };
      if ([401, 403, 404, 409].includes(failure.status ?? 0)) onEmailUnavailable?.();
      toast.error(failure.message || 'This attachment is unavailable. Please try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(''); }
    }
  };

  return (
    <div className="w-full min-w-0 p-4 space-y-4">
      {/* Upload zone */}
      {onUpload && <UploadZone onUpload={onUpload} />}
      {loading && !files.length && <div role="status" aria-label="Loading files"><DataLoadingSkeleton rowCount={3} columnCount={2} rowHeight={76} /></div>}
      {error && <div role="alert" className="text-sm text-destructive">{error}{onRetry && <Button variant="ghost" onClick={onRetry}>Retry files</Button>}</div>}

      {/* File list */}
      {files.length > 0 ? (
        <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/50">
          {files.map((file) => (
            <FileRow
              key={`${file.emailAttachment ? 'gmail' : 'upload'}:${file.id}`}
              file={file}
              canDelete={canDelete}
              onDelete={onDelete}
              busy={!!busy}
              onPreview={file.emailAttachment && emailContext && isPreviewableAttachment(file.type) ? () => void emailAction(file, false) : undefined}
              onDownload={file.emailAttachment && emailContext ? () => void emailAction(file, true) : undefined}
            />
          ))}
        </div>
      ) : !loading && !error ? (
        <div className="text-center py-8">
          <FileIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        </div>
      ) : null}
      {hasMore && <Button variant="ghost" size="sm" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Loading older attachments…' : 'Load older attachments'}</Button>}
      <AttachmentPreview key={previewIdentity + ':' + !!visiblePreview} file={visiblePreview ? { name: visiblePreview.file.name, url: visiblePreview.url, type: visiblePreview.type } : null}
        onClose={closePreview} onDownload={() => { if (preview) void emailAction(preview.file, true); }} downloading={!!busy} />
    </div>
  );
}
