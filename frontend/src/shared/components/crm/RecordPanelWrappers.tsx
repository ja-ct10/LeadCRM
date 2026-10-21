'use client';
import type { Lead, Contact, Deal } from '@/store/types';
import { CrmRecordPanel } from './crm-record-view';

export interface LeadPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  initialTab?: 'activity' | 'details';
  onEdit?: (lead: Lead) => void;
}
export function LeadPanel({ open, onOpenChange, lead, onEdit, initialTab }: LeadPanelProps) {
  return <CrmRecordPanel module="leads" id={lead?.id} open={open} initialTab={initialTab} onOpenChange={onOpenChange} onEdit={onEdit ? record => onEdit(record as unknown as Lead) : undefined} />;
}

export interface ContactPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  initialTab?: 'activity' | 'details';
  onEdit?: (contact: Contact) => void;
}
export function ContactPanel({ open, onOpenChange, contact, onEdit, initialTab }: ContactPanelProps) {
  return <CrmRecordPanel module="contacts" id={contact?.id} open={open} initialTab={initialTab} onOpenChange={onOpenChange} onEdit={onEdit ? record => onEdit(record as unknown as Contact) : undefined} />;
}

export interface AccountPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: { id: string } | null;
  initialTab?: 'activity' | 'details';
  onEdit?: (account: any) => void;
}
export function AccountPanel({ open, onOpenChange, account, onEdit, initialTab }: AccountPanelProps) {
  return <CrmRecordPanel module="accounts" id={account?.id} open={open} initialTab={initialTab} onOpenChange={onOpenChange} onEdit={onEdit} />;
}

export interface DealPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  initialTab?: 'activity' | 'details';
  onEdit?: (deal: Deal) => void;
  onOpenContactPanel?: (contactId: string) => void;
  onOpenAccountPanel?: (accountId: string) => void;
}

export function DealPanel({ open, onOpenChange, deal, onEdit, initialTab }: DealPanelProps) {
  return <CrmRecordPanel module="deals" id={deal?.id} open={open} initialTab={initialTab} onOpenChange={onOpenChange} />;
}
