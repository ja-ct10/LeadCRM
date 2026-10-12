import { expect, it } from 'vitest';
import { ClosingFieldInputSchema, getCrmFieldCatalog, leadCatalogFormField } from '@leadcrm/shared';
import { paletteFieldsFromCatalog } from './field-palette';

it('hides only the standard Lead Source palette entry while retaining source mappings and custom fields', () => {
  const custom = { ...ClosingFieldInputSchema.parse({ name: 'Lead Source', type: 'Text', module: 'leads', group: 'Basic Information', required: false }), id: 'custom-source', version: 1 };
  const catalog = getCrmFieldCatalog('leads', [custom]);
  const source = catalog.find(field => field.kind === 'System' && field.technicalKey === 'source')!;
  expect(leadCatalogFormField(source)?.mapToField).toBe('source');
  const palette = paletteFieldsFromCatalog(catalog);
  expect(palette.some(field => field.section === 'standard' && field.mapToField === 'source')).toBe(false);
  expect(palette.some(field => field.customFieldId === custom.id)).toBe(true);
  expect(palette.some(field => field.mapToField === 'email')).toBe(true);
});
