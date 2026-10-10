'use client';
import React from 'react';
import { CLOSED_WON_GROUP_ID, defaultFieldLayout, getCrmFieldCatalog, type CustomFieldModule } from '@leadcrm/shared';
import { PanelSectionHeading } from '@/shared/components/side-panel-styles';
import { CustomFieldInput, CustomFieldGroup, CustomFieldExtraGroups, type useRecordCustomFields } from './record-custom-fields';

/** Reorders the existing native input controls; their validation and state stay with the form. */
export function ConfiguredFormLayout({ form, children, module = form.module }: { form: ReturnType<typeof useRecordCustomFields>; children: React.ReactNode; module?: CustomFieldModule }) {
  const controls = new Map<string, React.ReactElement>();
  const collect = (nodes: React.ReactNode): React.ReactNode => React.Children.map(nodes, node => {
    if (!React.isValidElement(node)) return node;
    const element = node as React.ReactElement<{ fieldKey?: string; 'data-crm-field-key'?: string; children?: React.ReactNode; num?: number; title?: string; label?: string }>;
    const key = element.props.fieldKey ?? element.props['data-crm-field-key'];
    if (key) { controls.set(key, element); return null; }
    if (element.type === CustomFieldGroup || element.type === CustomFieldExtraGroups || (element.props.num !== undefined && element.props.title)) return null;
    if (!Object.prototype.hasOwnProperty.call(element.props, 'children')) return element;
    const remaining = collect(element.props.children);
    return React.Children.toArray(remaining).length ? React.cloneElement(element, {}, remaining) : null;
  });
  const layout = form.layout ?? defaultFieldLayout(module ?? 'contacts');
  const remainder = collect(children), catalog = getCrmFieldCatalog(module ?? 'contacts', form.fields, layout);
  return <>{[...layout.groups].sort((a, b) => a.order - b.order).filter(group => group.id !== CLOSED_WON_GROUP_ID).map((group, index) => {
    const entries = catalog.filter(field => field.groupId === group.id && field.visibleInForm && field.active && (field.customFieldId || controls.has(field.technicalKey)));
    return entries.length ? <section key={group.id} className="min-w-0 space-y-4"><PanelSectionHeading number={index + 1}>{group.label}</PanelSectionHeading><div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">{entries.map(field => {
      if (field.customFieldId) { const definition = form.fields.find(item => item.id === field.customFieldId)!; return <CustomFieldInput key={field.technicalKey} field={definition} form={form} />; }
      const original = controls.get(field.technicalKey)! as React.ReactElement<{ label?: string }>;
      if (!layout.fields[field.technicalKey]) return React.cloneElement(original, { key: field.technicalKey });
      if (original.props.label !== undefined) return React.cloneElement(original, { key: field.technicalKey, label: field.label + (field.mandatory ? ' *' : '') });
      let replaced = false;
      const label = (nodes: React.ReactNode): React.ReactNode => React.Children.map(nodes, node => {
        if (!React.isValidElement(node)) return node;
        const child = node as React.ReactElement<{ children?: React.ReactNode }>;
        if (!replaced && (child.type === 'label' || child.type === 'span')) { replaced = true; return React.cloneElement(child, {}, field.label + (field.mandatory ? ' *' : '')); }
        return child.props.children ? React.cloneElement(child, {}, label(child.props.children)) : child;
      });
      return React.cloneElement(original as React.ReactElement<{ children?: React.ReactNode }>, { key: field.technicalKey }, label((original as React.ReactElement<{ children?: React.ReactNode }>).props.children));
    })}</div></section> : null;
  })}{remainder}{form.query?.error && <p role="alert" className="text-sm text-destructive">{form.query.error}</p>}</>;
}
