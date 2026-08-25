# ADR-001: Hybrid Record Detail Views (Panel + Full Page)

## Status
Accepted

## Date
2026-08-23

## Context

LeadCRM's CRM modules (Leads, Contacts, Accounts, Deals) use slide-over panels (ShadCN Sheet, max 680px wide) as the only record detail view. The existing coding standard states: "Detail views: drawers/sheets only — no `[id]` routes."

This approach has limitations:

1. **Insufficient screen real estate** — 680px is too narrow for complete CRUD (all fields, related records with pagination, full activity timeline, file management).
2. **Not URL-addressable** — Records cannot be bookmarked, shared via link, or deep-linked.
3. **Limited cross-module navigation** — Jumping between related records (e.g., Account → Contact → Deal) requires closing/reopening panels or full page navigations with query params.
4. **Incomplete CRUD** — Inline edits in panels currently don't persist properly (bug: mutates prop + opens form modal instead of calling API).
5. **No room for tabs** — Complex records need Overview, Related, Timeline, and Files views that don't fit in a vertically-scrolling panel.

Modern CRMs (Zoho, HubSpot, Pipedrive, Salesforce Lightning) all use a **hybrid** approach: quick-view panel for scanning + full-page detail for deep work.

## Decision

Evolve the architecture from "drawers/sheets only" to a **hybrid model**:

1. **Side Panel (Sheet)** — retained as the quick-view experience. Row click in list opens the panel. Shows key fields, status, quick composer, truncated related records (3-5 items), and an "Open Full Page" button.

2. **Full-Page Detail Route** (`/crm/{entity}/:id`) — new dedicated route for deep CRUD. Accessible via:
   - "Open Full Page" button in the side panel
   - Double-click on list row (optional)
   - Direct URL (deep-linkable, bookmarkable)
   - Cross-module navigation (clicking a related record)

Both views share the same `DataContext` state and mutation methods, ensuring edits in one view reflect in the other immediately.

### Route Pattern

```
/crm/leads/:id
/crm/contacts/:id
/crm/accounts/:id
/crm/deals/:id
```

### App Router Structure

Each route follows the existing 3-line thin-shell convention:

```tsx
'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('...detail-page'), { ssr: false });
export default Page;
```

### Data Flow

```
Full Page → useRecordDetail hook → GET /:id + GET /:id/relationships + GET /activities?filter
                                 → Falls back to DataContext for instant rendering
                                 → Mutations go through DataContext → API → PostgreSQL
```

## Alternatives Considered

1. **Wider panels only** — Rejected. Doesn't solve URL-addressability or cross-module navigation. Tabs inside a panel feel cramped beyond 2 tabs.

2. **Replace panels with pages entirely** — Rejected. Panels provide valuable quick-view UX for scanning records without leaving the list. Removing them degrades the workflow for power users who process many records.

3. **Modal-based detail** — Rejected. Already partially exists for deals (`DealDetailsModal`). Modals block interaction with the underlying page and can't be URL-addressed.

## Consequences

### Positive
- Records are URL-addressable (bookmarkable, shareable, deep-linkable)
- Full viewport for complex CRUD operations
- Proper tab navigation (Overview, Related, Timeline, Files)
- Cross-module navigation works naturally via Next.js routing
- Side panel remains as fast quick-view (existing UX preserved)
- Both views stay synced via shared DataContext

### Negative
- New routing pattern to maintain (4 new `[id]` route directories)
- Requires a `useRecordDetail` hook for single-record API fetching
- Slightly more complex navigation model (panel vs page)
- Architecture rule change affects future module development

### Risks
- **Performance**: Full page loads record + relationships + activities (3 API calls). Mitigated by `Promise.all` parallel fetching and DataContext fallback for instant rendering.
- **State sync**: Edits in panel vs page could diverge. Mitigated by both using the same DataContext mutation methods.

## Migration

- Existing panels are NOT removed — they continue working as before
- New `[id]` routes are additive (no breaking changes)
- Navigation links in panels updated from `?id=X` query params to `/entity/:id` routes
- Inline edit bug fixed as prerequisite (panels must properly persist edits)

## Affected Files

- `.kiro/steering/structure.md` — rule update
- `frontend/app/(tenant)/crm/*/[id]/page.tsx` — new route shells
- `frontend/src/shared/hooks/use-record-detail.ts` — new hook
- `frontend/src/shared/components/crm/record-detail-*.tsx` — new layout + tab components
- `frontend/src/features/tenant/crm/*/ui/*-detail-page.tsx` — new page components
- `frontend/src/shared/components/crm/RecordPanelWrappers.tsx` — inline edit fix + "Open Full Page" button
