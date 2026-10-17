'use client';
import { useId, useRef, useState } from 'react';
import { getWorkflowEmailVariableChoices, workflowMessageVariableError, workflowMessageVariableKeys, WORKFLOW_MODULES, type WorkflowEntity, type WorkflowOptions } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { VariablePicker } from '@/shared/components/variable-picker';
import { insertVariableAtSelection } from '@/shared/utils/insert-variable';
import { SmsFooterControl } from '@/shared/components/sms-footer-control';

export function WorkflowEmailOverride({ field, label, value, entity, options, className, onChange }: {
  field: 'subject' | 'body' | 'message'; label: string; value: string; entity?: WorkflowEntity; options: WorkflowOptions; className: string; onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const subject = useRef<HTMLInputElement>(null), body = useRef<HTMLTextAreaElement>(null);
  const layout = entity ? options.fieldLayouts?.[WORKFLOW_MODULES[entity]] : undefined;
  const choices = entity ? getWorkflowEmailVariableChoices(entity, layout, options.customFields, field === 'message') : [];
  const issue = entity ? workflowMessageVariableError(value, workflowMessageVariableKeys(entity, options.customFields, layout)) : undefined;
  return <div className="space-y-2">
    <label className="block space-y-1" htmlFor={id}>{label}{field === 'message' && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
    {field === 'subject'
      ? <input ref={subject} id={id} aria-label={label} aria-invalid={!!issue} aria-describedby={issue ? `${id}-error` : `${id}-hint`} className={className} maxLength={200} value={value} onChange={event => onChange(event.target.value)} />
      : <textarea ref={body} id={id} aria-label={label} aria-required={field === 'message' || undefined} aria-invalid={!!issue} aria-describedby={issue ? `${id}-error` : `${id}-hint`} className={className} rows={4} maxLength={field === 'message' ? 1600 : 10000} value={value} onChange={event => onChange(event.target.value)} />}
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label={`Insert Variable into ${label}`}>Insert Variable</Button></DropdownMenuTrigger>
        <DropdownMenuContent formContent align="start" role="group" aria-label={`Variables for ${label}`} className="w-auto p-0">
          <VariablePicker choices={choices} categories={field === 'message' ? undefined : ['Standard Fields', 'Custom Fields']} onInsert={token => {
            insertVariableAtSelection(field === 'subject' ? subject.current : body.current, value, token, onChange);
            setOpen(false);
          }} />
        </DropdownMenuContent>
      </DropdownMenu>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">{field === 'message' ? 'Variables use the selected recipient. Sender variables use your organization’s contact details.' : `Leave empty to use the template ${field === 'subject' ? 'subject' : 'message'}.`}</p>
    </div>
    {field === 'message' && <SmsFooterControl value={value} onChange={onChange} maxLength={1600} />}
    {issue && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{issue}</p>}
  </div>;
}
