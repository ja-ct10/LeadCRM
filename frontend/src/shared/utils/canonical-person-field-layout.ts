import { defaultFieldLayout, getCrmFieldCatalog, type FieldLayout } from '@leadcrm/shared';

/** Canonical presentation only; saved layout identities and field values stay intact. */
export function canonicalPersonFieldLayout(saved: FieldLayout): FieldLayout {
  if (saved.module !== 'leads' && saved.module !== 'contacts') return saved;
  const defaults = defaultFieldLayout(saved.module);
  const builtInIds = new Set(defaults.groups.map(group => group.id));
  const fields = { ...saved.fields };
  for (const field of getCrmFieldCatalog(saved.module)) {
    const override = fields[field.technicalKey];
    if (override) fields[field.technicalKey] = { ...override, groupId: field.groupId };
  }
  return {
    ...saved,
    groups: [
      ...defaults.groups.map(group => ({ ...saved.groups.find(savedGroup => savedGroup.id === group.id), ...group })),
      ...saved.groups.filter(group => !builtInIds.has(group.id)).sort((a, b) => a.order - b.order)
        .map((group, index) => ({ ...group, order: defaults.groups.length + index })),
    ],
    fields,
  };
}
