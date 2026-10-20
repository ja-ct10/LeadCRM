'use client';

import React, { useId, useState } from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import type { TenantGroup, TenantGroupMember } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { ModuleSearchInput } from '@/shared/components/crm/module-search-input';
import { UserAvatar, administrationAvatarUrl } from '@/shared/components/user-avatar';
import { matchesSearch } from '@/shared/utils/search';
import { cn } from '@/lib/utils';

export function GroupMemberIdentity({ user, canReadAvatars }: { user: TenantGroupMember['user']; canReadAvatars: boolean }) {
  return <div className="flex min-w-0 items-center gap-2.5">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
      <UserAvatar user={{ ...user, avatarUrl: canReadAvatars ? administrationAvatarUrl(user) : null }} />
    </div>
    <div className="min-w-0 text-left"><p className="truncate text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</p><p className="truncate text-xs text-muted-foreground">{user.role}</p></div>
  </div>;
}

export function GroupHeadDialog({ group, busy, error, canReadAvatars, onClose, onSave, onClear }: {
  group: TenantGroup;
  busy: boolean;
  error: string;
  canReadAvatars: boolean;
  onClose: () => void;
  onSave: (userId: string) => void;
  onClear: () => void;
}) {
  const id = useId();
  const head = group.members.find(member => member.isHead);
  const [selectedId, setSelectedId] = useState(head?.userId ?? '');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const eligible = group.members.filter(member => member.canBeHead);
  const selected = eligible.find(member => member.userId === selectedId);
  const visible = eligible.filter(member => matchesSearch(search, member.user.firstName, member.user.lastName, member.user.email, member.user.role));

  return <Dialog open onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent className="max-w-md" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} showClose={!busy}>
      <DialogHeader>
        <DialogTitle id={`${id}-title`}>Assign Group Head</DialogTitle>
        <DialogDescription id={`${id}-description`}>Select a member to assign as the head of this group.</DialogDescription>
      </DialogHeader>
      <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); if (!busy && selected && selectedId !== head?.userId) onSave(selectedId); }}>
        <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-primary">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div><p className="text-xs font-semibold">The group head should be a manager responsible for this team.</p><p className="mt-1 text-xs text-muted-foreground">Only current group members with an appropriate manager role can be selected.</p></div>
        </div>
        <div className={cn('space-y-2 [&>div]:w-full', open && 'pb-64')}>
          <label id={`${id}-label`} className="block text-xs font-semibold" htmlFor={`${id}-select`}>Group Head</label>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild><Button id={`${id}-select`} type="button" variant="outline" aria-labelledby={`${id}-label`} disabled={busy} className="h-auto min-h-11 w-full justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-left">{selected ? `${selected.user.firstName} ${selected.user.lastName}` : 'Select a group member…'}</span><ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" formContent aria-label="Eligible group members" className="w-[calc(100vw-3rem)] sm:w-[25rem]">
              <div className="p-1 pb-2"><ModuleSearchInput label="Search group members" placeholder="Search group members..." value={search} onChange={setSearch} fullWidth disabled={busy} /></div>
              <div className="max-h-52 overflow-y-auto overscroll-contain">
                {visible.map(member => <DropdownMenuItem key={member.id} role="menuitemradio" aria-label={`${member.user.firstName} ${member.user.lastName} ${member.user.role}`} aria-checked={selectedId === member.userId} disabled={busy} className={cn('min-h-11', selectedId === member.userId && 'bg-primary/10 hover:bg-primary/10 focus:bg-primary/10')} onSelect={() => setSelectedId(member.userId)}>
                  <div className="min-w-0 flex-1"><GroupMemberIdentity user={member.user} canReadAvatars={canReadAvatars} /></div>
                  {selectedId === member.userId && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                </DropdownMenuItem>)}
                {!visible.length && <p className="p-3 text-xs text-muted-foreground">{eligible.length ? 'No members match your search.' : 'No active Sales Managers or Heads of Sales in this group.'}</p>}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="border-t border-border pt-4">
          {head && <Button type="button" variant="ghost" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={onClear}>Clear Head</Button>}
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !selected || selectedId === head?.userId}>{busy ? 'Saving…' : head ? 'Change Head' : 'Assign Head'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
