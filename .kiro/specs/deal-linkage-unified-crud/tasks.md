# Implementation Plan: Deal Linkage & Unified CRUD

## Overview

Surgical fix to the deal linkage plumbing. All changes are frontend-only — the backend already supports junction tables and FK-based associations. We fix the adapter layer, remove fragile string-matching filters, improve InlineDealForm UX, and add deal click navigation from record panels.

## Tasks

- [x] 1. Fix deal adapter — toBackendCreateDeal and toFrontendDeal
  - [x] 1.1 Update `toBackendCreateDeal` to map leadId→leadIds and contactId→contactIds
    - In `frontend/src/lib/api/adapters/deal.adapter.ts`
    - Normalize singular `leadId` into `leadIds[]` array with deduplication
    - Normalize singular `contactId` into `contactIds[]` array with deduplication
    - Omit `leadIds`/`contactIds` keys entirely when empty (never send undefined/null)
    - Preserve existing `organizationId` resolution from `companyId || organizationId`
    - _Requirements: 2.1, 3.1, 4.1, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.2 Update `toFrontendDeal` to extract leadIds from leadDeals junction
    - In `frontend/src/lib/api/adapters/deal.adapter.ts`
    - Extract `leadIds` from `backendDeal.leadDeals[].lead.id` (with filter(Boolean))
    - Set `leadId = leadIds[0]` for backward compatibility
    - Populate `leadPerson` from first lead in junction for display
    - Handle both `contactDeals` and `customerDeals` naming from backend
    - _Requirements: 2.4, 3.3, 9.5, 9.6_

- [x] 2. Fix panel filtering in RecordPanelWrappers
  - [x] 2.1 Replace LeadPanel deal filter with FK-only logic
    - In `frontend/src/shared/components/crm/RecordPanelWrappers.tsx`
    - Remove `companyName` string matching fallback
    - Filter: `d.leadId === lead.id || (d.leadIds ?? []).includes(lead.id)`
    - _Requirements: 5.1, 5.4_

  - [x] 2.2 Replace ContactPanel deal filter with FK-only logic
    - In `frontend/src/shared/components/crm/RecordPanelWrappers.tsx`
    - Remove any `companyName` or `leadId === contact.id` fallbacks
    - Filter: `(d.contactIds ?? []).includes(contact.id) || d.contactId === contact.id`
    - _Requirements: 5.2, 5.4_

  - [x] 2.3 Replace AccountPanel deal filter with FK-only logic
    - In `frontend/src/shared/components/crm/RecordPanelWrappers.tsx`
    - Remove `companyName` string matching fallback
    - Filter: `d.organizationId === account.id`
    - _Requirements: 5.3, 5.4_

- [x] 3. Checkpoint — Verify adapter and filtering
  - Ensure `npm run lint` passes with no TypeScript errors.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Improve InlineDealForm UX
  - [x] 4.1 Auto-select first pipeline and first stage as defaults
    - In `frontend/src/shared/components/crm/inline-deal-form.tsx`
    - Compute `defaultPipeline = pipelines[0]` and `defaultStage = defaultPipeline?.stages?.[0]`
    - Set `pipelineId` and `stageId` defaults in `useForm` defaultValues
    - _Requirements: 10.2, 10.3_

  - [x] 4.2 Add default expected close date (+30 days) and post-submit behavior
    - In `frontend/src/shared/components/crm/inline-deal-form.tsx`
    - Add `getDatePlusDays(30)` helper for ISO date string
    - Set `expectedCloseDate` default in `useForm` defaultValues
    - On successful submit: call `reset()`, call `onCancel?.()`, show `toast.success`
    - _Requirements: 10.4, 10.6_

- [x] 5. Add deal click → DealPanel navigation from record panels
  - [x] 5.1 Add DealPanel overlay to LeadPanel
    - In `frontend/src/shared/components/crm/RecordPanelWrappers.tsx`
    - Add `selectedDealId` state + click handler on deal list items
    - Render `<DealPanel>` when `selectedDealId` is set
    - Clear `selectedDealId` on DealPanel close
    - _Requirements: 7.1, 7.4_

  - [x] 5.2 Add DealPanel overlay to ContactPanel
    - In `frontend/src/shared/components/crm/RecordPanelWrappers.tsx`
    - Same pattern: `selectedDealId` state + DealPanel overlay
    - _Requirements: 7.2, 7.4_

  - [x] 5.3 Add DealPanel overlay to AccountPanel
    - In `frontend/src/shared/components/crm/RecordPanelWrappers.tsx`
    - Same pattern: `selectedDealId` state + DealPanel overlay
    - _Requirements: 7.3, 7.4_

- [x] 6. Checkpoint — Full integration verification
  - Ensure `npm run lint` passes.
  - Ensure `npm run build` completes without errors.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Property-based tests for adapter functions
  - [x]* 7.1 Write property test for leadId normalization in toBackendCreateDeal
    - **Property 1: leadId normalization in toBackendCreateDeal**
    - Generate random leadId strings + random leadIds arrays (0–5 elements)
    - Verify output contains all unique IDs, no duplicates
    - **Validates: Requirements 2.1, 8.1, 8.2**

  - [x]* 7.2 Write property test for contactId normalization in toBackendCreateDeal
    - **Property 2: contactId normalization in toBackendCreateDeal**
    - Generate random contactId strings + random contactIds arrays
    - Verify output contains all unique IDs, no duplicates
    - **Validates: Requirements 3.1, 8.3**

  - [x]* 7.3 Write property test for organizationId normalization
    - **Property 3: organizationId normalization in toBackendCreateDeal**
    - Generate random companyId and/or organizationId strings
    - Verify output uses companyId when both present
    - **Validates: Requirements 2.3, 4.1, 8.4**

  - [x]* 7.4 Write property test for empty array omission
    - **Property 4: Empty array omission in toBackendCreateDeal**
    - Generate inputs with explicitly empty/missing lead/contact fields
    - Verify output object does not contain leadIds/contactIds keys
    - **Validates: Requirements 8.5**

  - [x]* 7.5 Write property test for leadIds round-trip extraction in toFrontendDeal
    - **Property 5: leadIds round-trip extraction in toFrontendDeal**
    - Generate backend response objects with random leadDeals arrays (0–5 entries)
    - Verify extracted leadIds matches input lead IDs and leadId equals first
    - **Validates: Requirements 2.4, 9.5**

  - [x]* 7.6 Write property test for contactIds extraction in toFrontendDeal
    - **Property 6: contactIds extraction in toFrontendDeal**
    - Generate backend response objects with random contactDeals/customerDeals arrays
    - Verify extracted contactIds matches input contact IDs
    - **Validates: Requirements 3.3, 9.6**

  - [x]* 7.7 Write property test for FK-only filtering
    - **Property 7: FK-only filtering excludes non-linked deals**
    - Generate random deal arrays with varying FK fields + target record
    - Verify filter includes deal iff direct FK linkage exists
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 8. Final checkpoint — All tests pass
  - Run `npm run lint` and `npm run build`.
  - Run `npx vitest --run` to verify property tests pass.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are frontend-only — no backend modifications needed
- The backend already handles `leadIds` → `LeadDeal` junction creation and returns junction data
- Property tests use vitest + fast-check (already in project dependencies)
- DataContext real-time sync already works — no changes needed for cross-view visibility
- Tag each property test with: `Feature: deal-linkage-unified-crud, Property N: [title]`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7"] }
  ]
}
```
