'use client';

import { useRef, useState } from 'react';
import type { SavedAudience } from '@leadcrm/shared';
import { Tags, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

interface AudienceSelectProps {
  value: string;
  audiences: SavedAudience[];
  onChange: (value: string) => void;
  onDelete: (audience: SavedAudience) => void;
  canDelete: boolean;
  disabled: boolean;
  className: string;
}

export function AudienceSelect({ value, audiences, onChange, onDelete, canDelete, disabled, className }: AudienceSelectProps) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(240);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', at: 0 });
  const options = [
    { id: '', name: 'Select an audience', disabled: false },
    { id: 'LEADS', name: 'All Leads', disabled: false },
    { id: 'CONTACTS', name: 'All Contacts', disabled: false },
    ...(value === 'ALL' ? [{ id: 'ALL', name: 'Legacy mixed audience — select a source', disabled: true }] : []),
    ...audiences.map(audience => ({ ...audience, disabled: audience.source === 'ALL' || !!audience.repairReason })),
  ];
  const changeOpen = (next: boolean) => {
    setOpen(next && !disabled);
    search.current = { text: '', at: 0 };
    if (next && trigger.current) setWidth(Math.max(0, trigger.current.getBoundingClientRect().width - 10));
  };
  const selected = options.find(option => option.id === value);
  return <div className="w-full [&>div]:block [&>div]:w-full">
    <DropdownMenu open={open && !disabled} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
        <button ref={trigger} id="builder-audience" type="button" value={value} aria-labelledby="builder-audience-label" disabled={disabled} className={`${className} flex items-center justify-between gap-2 text-left`}>
          <span className="min-w-0 truncate">{selected?.name || 'Select an audience'}{selected?.disabled && value !== 'ALL' ? ' — repair required' : ''}</span>
          <Tags size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label="Audience choices" className="min-w-0 !max-h-64" onKeyDown={event => {
        if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault(); event.stopPropagation();
        const now = Date.now(), previous = now - search.current.at < 700 ? search.current.text : '';
        const text = previous === event.key.toLowerCase() ? previous : previous + event.key.toLowerCase();
        search.current = { text, at: now };
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"][aria-disabled="false"]'));
        const current = items.indexOf(document.activeElement as HTMLElement);
        const start = text.length > 1 ? Math.max(0, current) : current + 1;
        const match = Array.from({ length: items.length }, (_, index) => items[(start + index) % items.length]).find(item => item.dataset.audienceName?.toLowerCase().startsWith(text));
        if (match) { event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]').forEach(item => { item.tabIndex = item === match ? 0 : -1; }); match.focus(); match.scrollIntoView?.({ block: 'nearest' }); }
      }}>
        <div style={{ width, maxWidth: 'calc(100vw - 26px)' }}>
          {options.map(option => {
            const custom = audiences.find(audience => audience.id === option.id);
            return <div key={option.id} className="group flex min-w-0 items-center gap-1">
              <DropdownMenuItem role="menuitemradio" aria-checked={value === option.id} data-audience-name={option.name} disabled={disabled || option.disabled}
                className="min-w-0 flex-1" onSelect={() => { if (!disabled) onChange(option.id); }}>
                <span className="truncate">{option.name}{custom && option.disabled ? ' — repair required' : ''}</span>
              </DropdownMenuItem>
              {custom && !['LEADS', 'CONTACTS', 'ALL'].includes(option.id) && canDelete && <Button type="button" role="menuitem" aria-disabled={disabled} disabled={disabled} size="icon" variant="ghost"
                className="h-8 w-8 shrink-0 text-destructive dark:text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:text-destructive opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`Delete ${custom.name}`} title={`Delete ${custom.name}`} onClick={event => {
                  event.preventDefault(); event.stopPropagation();
                  if (disabled) return;
                  setOpen(false); trigger.current?.focus({ preventScroll: true }); onDelete(custom);
                }}><Trash2 size={14} aria-hidden="true" /></Button>}
            </div>;
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
