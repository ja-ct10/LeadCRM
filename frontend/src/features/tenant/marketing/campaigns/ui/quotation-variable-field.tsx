'use client';
import React, { useRef, useState } from 'react';
import { QUOTATION_VARIABLE_GROUPS, type GroupedCampaignVariableChoice } from '@leadcrm/shared';
import { Wand2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { panelInputClass, panelLabelClass } from '@/shared/components/side-panel-styles';
import { insertVariableAtSelection } from '@/shared/utils/insert-variable';
import { CampaignVariablePicker, campaignVariableTriggerClassName } from './campaign-variable-picker';
export function QuotationVariableField({ id, label, value, onChange, choices, rows = 4 }: {
  id: string; label: string; value: string; onChange: (value: string) => void; choices: GroupedCampaignVariableChoice[]; rows?: number;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  return <div className="min-w-0 space-y-1.5">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-1"><label htmlFor={id} className={panelLabelClass}>{label}</label>
      <DropdownMenu open={open} onOpenChange={setOpen}><DropdownMenuTrigger asChild><button type="button" aria-label={`Insert Variable into ${label}`} className={campaignVariableTriggerClassName}><Wand2 size={14} /> Insert Variable</button></DropdownMenuTrigger>
        <DropdownMenuContent formContent align="end" role="group" aria-label={`Variables for ${label}`} className="w-auto p-0"><CampaignVariablePicker choices={choices} categories={QUOTATION_VARIABLE_GROUPS} onInsert={token => { insertVariableAtSelection(input.current, value, token, onChange); setOpen(false); }} /></DropdownMenuContent>
      </DropdownMenu>
    </div>
    <textarea ref={input} id={id} rows={rows} maxLength={15000} className={panelInputClass} value={value} onChange={event => onChange(event.target.value)} />
  </div>;
}
