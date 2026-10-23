import { expect, it } from 'vitest';
import { PATHNAME_TO_PATH, resolveModulePath } from './route-map';

it.each(['leads', 'contacts', 'accounts'])('keeps %s context for copied detail URLs and imports', module => {
  for (const suffix of ['', '/record-id', '/import', '/imports/run-id']) {
    expect(resolveModulePath(`/crm/${module}${suffix}`)).toBe(module);
  }
  expect(resolveModulePath(`/crm/${module}-unrelated`)).toBe('dashboard');
});
it('keeps Deals while removing explicit import mappings', () => {
  expect(PATHNAME_TO_PATH['/crm/deals']).toBe('deals');
  expect(PATHNAME_TO_PATH).not.toHaveProperty('/crm/deals/import');
  expect(PATHNAME_TO_PATH).not.toHaveProperty('/crm/deals/imports');
});
it('preserves exact route precedence and existing nested help/workflow routes', () => {
  expect(resolveModulePath('/settings/profile')).toBe('profile-settings');
  expect(resolveModulePath('/help/leads')).toBe('help');
  expect(resolveModulePath('/automation/workflows/id')).toBe('workflows');
});
it.each([
  ['/campaigns/create', 'campaigns'], ['/marketing/forms/id', 'forms'],
  ['/crm/companies/id', 'accounts'], ['/settings/profile', 'profile-settings'],
])('preserves the module context for %s', (path, module) => {
  expect(resolveModulePath(path)).toBe(module);
});

it.each([
  '/crm/deals', '/crm/deals?tab=my', '/crm/deals/record-id?tab=my#activity',
  '/crm/pipeline', '/crm/pipeline?tab=my',
])('uses the canonical Deals module for %s', path => {
  expect(resolveModulePath(path)).toBe('deals');
});

it.each(['leads', 'contacts', 'accounts'])('ignores query and hash suffixes for %s', module => {
  expect(resolveModulePath(`/crm/${module}?tab=my#activity`)).toBe(module);
  expect(resolveModulePath(`/crm/${module}/record-id?tab=my`)).toBe(module);
});

it.each(['/crm/deals-unrelated?tab=my', '/crm/pipeline-other', '/crm/dealership'])('does not match Deals for %s', path => {
  expect(resolveModulePath(path)).toBe('dashboard');
});
