import { expect, it } from 'vitest';
import { csvDocument, matchesDealView, DealViewFiltersSchema } from '@leadcrm/shared';
const deal = { title: 'CCTV Installation', companyName: 'Acme', contactPerson: 'Juan', stageId: 'stage', assignedUserId: 'owner', priority: 'HIGH', productInterests: ['CCTV'], createdAt: '2030-01-01', status: 'Open', leadIds: ['lead'], contactIds: ['contact'] };
it('escapes commas, quotes, newlines, unicode and spreadsheet formulas', () => {
  const csv = csvDocument([['Name', 'Description'], ['₱ Product, A', 'a"b\nc'], [' =SUM(A1)', null]]);
  expect(csv).toBe('\uFEFF"Name","Description"\r\n"₱ Product, A","a""b\nc"\r\n"\' =SUM(A1)",""');
});
it('uses all board filters and case-insensitive multi-term display search', () => {
  const view = { search: 'acme CCTV juan', my: true, filters: { stage: ['stage'], owner: ['owner'], product: ['CCTV'], status: ['Open'], priority: ['High'], created: ['7'] }, leadId: 'lead', contactId: 'contact' };
  expect(matchesDealView(deal, view, 'owner', +new Date('2030-01-02'))).toBe(true);
  expect(matchesDealView(deal, view, 'other', +new Date('2030-01-02'))).toBe(false);
  expect(matchesDealView(deal, { ...view, filters: { ...view.filters, status: ['Won'] } }, 'owner')).toBe(false);
  expect(matchesDealView(deal, view, 'owner', +new Date('2030-01-10'))).toBe(false);
  expect(DealViewFiltersSchema.safeParse({ search: '', my: false, filters: { arbitrary: ['x'] } }).success).toBe(false);
});
