import { expect, it } from 'vitest';
import { dealAssociationPatch } from '@leadcrm/shared';
import { toBackendUpdateDeal } from '../deal.adapter';

it('forwards a targeted association change without replacement arrays, owner or Account edits', () => {
  const primaryAssociation = { type: 'contact' as const, id: 'new', previous: { type: 'lead' as const, id: 'old' } };
  expect(toBackendUpdateDeal({ title: 'Edited', primaryAssociation })).toEqual({ title: 'Edited', primaryAssociation });
});

it('shares the same safe relationship patch between the API and mock mode', () => {
  expect(dealAssociationPatch(['old', 'extra-lead'], ['extra-contact', 'new'], { type: 'contact', id: 'new', previous: { type: 'lead', id: 'old' } })).toEqual({ leadIds: ['extra-lead'], contactIds: ['new', 'extra-contact'] });
  expect(dealAssociationPatch(['extra-lead'], [], { type: 'contact', id: 'new', previous: { type: 'lead', id: 'missing' } })).toBeNull();
});

it('preserves ambiguous existing links when choosing a record without an explicit replacement', () => {
  expect(dealAssociationPatch(['a', 'b'], ['c'], { type: 'contact', id: 'd' })).toEqual({ leadIds: ['a', 'b'], contactIds: ['d', 'c'] });
});
