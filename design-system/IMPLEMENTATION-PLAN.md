# LeadCRM UI/UX Redesign — Implementation Plan

> Generated: 2026-08-10  
> Severity: HIGH  
> Estimated Files: 50-70 frontend files  
> Risk: Multi-file coordinated changes while preserving functionality

---

## Overview

Transform LeadCRM from template-like admin UI to premium enterprise CRM (Linear/Attio/Notion quality) through systematic frontend-only redesign. All backend code, API routes, database schema, Prisma models, and business logic MUST remain untouched.

---

## Phase 1: Foundation — Design Tokens & Global Styles

### Files to Modify

1. **`frontend/src/index.css`** - Add CSS custom properties, update @theme

### Changes

- Add `:root` and `.dark` CSS variables for entire color system
- Implement semantic tokens: `--primary`, `--surface`, `--text-primary`, etc.
- Update existing Tailwind @theme with new font weights
- Add spacing scale CSS variables
- Add shadow system variables
- Preserve existing React Grid Layout styles

### Acceptance Criteria

- [ ] All design tokens defined in CSS variables
- [ ] Dark mode tokens complete
- [ ] No breaking changes to existing classes
- [ ] Fonts (Inter, Space Grotesk, JetBrains Mono) loading correctly

---

## Phase 2: Layout Shell Redesign

### Files to Modify

1. **`frontend/src/features/tenant/layout/sidebar-nav.tsx`**
2. **`frontend/src/features/tenant/layout/topbar.tsx`**
3. **`frontend/app/(tenant)/layout.tsx`**

### Changes

#### Sidebar (`sidebar-nav.tsx`)

- **Visual Hierarchy**: Add active vertical accent rail (4px colored bar)
- **Grouping**: Add section headers ("CRM", "Operations", "Marketing", "Admin")
- **Icon Consistency**: Ensure all nav items have proper icons
- **Spacing**: Increase spacing between groups (16px gap)
- **Active State**: More prominent highlight (bg + border + icon color)
- **Collapse Behavior**: Improve animation (spring transition)
- **Typography**: Use font-display for workspace name

#### Topbar (`topbar.tsx`)

- **Search**: Add global search bar (centered, 400px max-width)
- **Notifications**: Improve bell icon with badge positioning
- **User Menu**: Cleaner dropdown design
- **Theme Toggle**: Better sun/moon icon transition
- **Height**: Maintain 56px, improve internal spacing
- **Background**: Add backdrop-blur-sm for modern effect

#### Page Header Component (NEW)

- Create **`frontend/src/shared/components/page-header.tsx`**
- Breadcrumb-style header: "LeadCRM / {Module}"
- Sticky positioning below topbar
- Optional action buttons on right
- Height: 52-56px
- Use across all module pages

### Acceptance Criteria

- [ ] Sidebar has visual hierarchy with grouped sections
- [ ] Active state clearly visible with accent rail
- [ ] Topbar has centered search bar
- [ ] Page header component created and reusable
- [ ] All navigation still functional
- [ ] Collapse behavior smooth
- [ ] Dark mode works perfectly

---

## Phase 3: Shared Components Library

### Files to Modify

#### Buttons

1. **`frontend/src/shared/components/ui/button.tsx`**
   - Update variants to use CSS variables
   - Add `active:scale-95` to primary/destructive
   - Add `active:scale-98` to secondary
   - Refine padding, rounded values per design system
   - Ensure all variants support dark mode

#### Cards

2. **`frontend/src/shared/components/ui/card.tsx`**
   - Update border radius to `rounded-xl` (from generic)
   - Refine shadow system
   - Add hover states for interactive cards
   - Improve padding scale

#### Badges

3. **`frontend/src/shared/components/ui/badge.tsx`**
   - Update status colors to use semantic tokens
   - Add border to all variants
   - Refine size (px-2 py-0.5)
   - Ensure uppercase labels have proper tracking

#### Inputs

4. **`frontend/src/shared/components/ui/input.tsx`**
   - Add focus ring using CSS variable
   - Improve border colors
   - Add transition-all
   - Ensure placeholder color uses token

#### Empty State

5. **`frontend/src/shared/components/empty-state.tsx`**
   - Refine illustrations (more minimal, less decorative)
   - Improve animation timing (use design system values)
   - Update colors to use tokens
   - Add page-specific variants

#### TrelloFilter

6. **`frontend/src/shared/components/trello-filter.tsx`**
   - Refine dropdown design
   - Improve badge design in filters
   - Better spacing
   - Cleaner active state indicators
   - Maintain all functionality

### Acceptance Criteria

- [ ] All components use CSS variable tokens
- [ ] Dark mode works for all components
- [ ] Hover/focus states polished
- [ ] No breaking changes to props/API
- [ ] Animations use motion/react v12 only

---

## Phase 4: Module-Specific Pages

### Priority 1: High-Traffic Pages

#### Dashboard

1. **`frontend/src/features/tenant/dashboard/ui/dashboard-page.tsx`**
   - Add page header component
   - Refine KPI card design
   - Improve chart styling
   - Add distinct visual rhythm (not same as other modules)

#### Leads

2. **`frontend/src/features/tenant/crm/leads/ui/leads-page.tsx`**
   - Add page header component
   - Operational rhythm: dense table, quick actions visible
   - Refine toolbar design
   - Polish status badges
   - Improve empty state
   - Ensure filters work perfectly

3. **`frontend/src/features/tenant/crm/leads/ui/leads-table.tsx`**
   - Modernize table design
   - Better hover states
   - Improve column headers (sticky, better typography)
   - Refine action buttons

#### Pipeline

4. **`frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`**
   - Add page header component
   - Momentum rhythm: velocity indicators, age warnings
   - Polish kanban cards (rounded-lg, better shadows)
   - Improve drag-drop visual feedback
   - Refine forecast bar
   - Better swimlane headers

5. **`frontend/src/features/tenant/crm/pipeline/ui/deal-details-modal.tsx`**
   - Modernize modal design
   - Use spring animation from design system
   - Better form layout
   - Improved spacing

#### Campaigns

6. **`frontend/src/features/tenant/marketing/campaigns/ui/campaigns-page.tsx`**
   - Add page header component
   - Communication rhythm: engagement metrics prominent
   - Polish campaign cards
   - Improve status indicators
   - Better preview cards

7. **`frontend/src/features/tenant/marketing/campaigns/ui/campaign-builder.tsx`**
   - Refine visual builder UI
   - Better drag-drop zones
   - Improved step indicators

### Priority 2: Secondary Pages

#### Customers

- **`customers-page.tsx`**: Relationship rhythm (more whitespace, profile focus)

#### Accounts

- **`accounts-page.tsx`**: Polish table design

#### Deals

- **`deals-page.tsx`**: Similar to leads but with deal-specific metrics

#### Tasks

- **`task-board.tsx`**: Refine kanban board for tasks

#### Service Orders

- **`service-orders-page.tsx`**: Operational table design

#### Workflows

- **`workflows-page.tsx`**: Automation-focused design

#### Inbox

- **`email-detail-view.tsx`**: Clean email reading experience

### Acceptance Criteria (Per Module)

- [ ] Page header component integrated
- [ ] Module-specific rhythm applied
- [ ] Empty states polished
- [ ] Filters functional
- [ ] Tables/cards modernized
- [ ] All existing functionality preserved
- [ ] RBAC guards still work
- [ ] Dark mode complete

---

## Phase 5: Form & Modal Polish

### Files to Modify

1. **`lead-form.tsx`, `deal-details-modal.tsx`, `create-campaign-panel.tsx`**, etc.
   - Consistent form field spacing
   - Label above input pattern
   - Error messages below field
   - Better button placement
   - Improved modal/sheet animations

### Acceptance Criteria

- [ ] All forms use consistent spacing
- [ ] Error handling UI consistent
- [ ] Submit buttons prominent
- [ ] Cancel/close buttons clear
- [ ] Animations smooth (spring configs)

---

## Phase 6: Motion & Micro-interactions

### Files to Modify

- All page components
- All interactive elements

### Changes

- Add page entrance animations (fade-in + slide-up)
- Add staggered list animations (tables, cards)
- Improve button press feedback (active:scale-\*)
- Add skeleton loaders where missing
- Smooth theme transitions
- Sticky header reveal animations

### Acceptance Criteria

- [ ] Page entrances smooth (400ms)
- [ ] Interactions feel responsive (120-180ms)
- [ ] Reduced motion support implemented
- [ ] No jank or layout shift
- [ ] Only transform/opacity animated

---

## Phase 7: Responsive & Accessibility Pass

### Changes

- Test all pages at 360px, 768px, 1024px, 1440px
- Verify touch targets ≥ 44×44px on mobile
- Check keyboard navigation
- Verify focus states visible
- Run contrast checker (WCAG AA)
- Test screen reader compatibility

### Acceptance Criteria

- [ ] All pages responsive
- [ ] Mobile navigation works
- [ ] Sidebar overlay smooth on mobile
- [ ] Touch targets adequate
- [ ] Keyboard nav functional
- [ ] Focus states visible
- [ ] Contrast ratios pass

---

## Phase 8: Quality Gate Validation

### Pre-Delivery Checklist

#### Visual Quality

- [ ] No three identical cards in a row
- [ ] Each module has distinct visual rhythm
- [ ] Accent color swappable without breaking layout
- [ ] Dark mode visual parity with light mode
- [ ] Consistent spacing scale used throughout
- [ ] Typography scale followed precisely
- [ ] Border radius values limited to design system options
- [ ] No generic shadcn default look remaining

#### Functional Integrity

- [ ] All existing features preserved
- [ ] RBAC guards intact and functional
- [ ] Data flows unchanged
- [ ] Forms submit correctly
- [ ] Filters work as before
- [ ] Pagination functional
- [ ] Drag-drop preserved (pipeline, taskboard)
- [ ] Search works
- [ ] Notifications work
- [ ] Theme switching works

#### Performance

- [ ] Animations only on transform/opacity
- [ ] Reduced motion supported everywhere
- [ ] No layout thrashing detected
- [ ] Bundle size unchanged or smaller
- [ ] Page load times ≤ previous

#### Accessibility (WCAG AA)

- [ ] Color contrast ≥ 4.5:1 verified
- [ ] Keyboard navigation complete
- [ ] Focus states visible on all interactive elements
- [ ] Screen reader labels on icon-only buttons
- [ ] Touch targets ≥ 44×44px on mobile
- [ ] Form labels visible (not placeholder-only)
- [ ] Error messages near fields
- [ ] Semantic heading structure maintained

#### Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Implementation Strategy

### Approach

Use **general-task-execution** agent for systematic implementation:

1. **Phase-by-phase execution**: Complete Phase 1 → validate → Phase 2 → validate, etc.
2. **File batching**: Modify related files together (e.g., all sidebar files in one batch)
3. **Preserve functionality**: Never break existing behavior
4. **Test after each phase**: Manual verification before moving forward
5. **Dark mode parity**: Every change includes dark mode classes

### Git Strategy

- Branch: `feature/ui-ux-redesign`
- Commit per phase: "feat: [Phase N] - [Description]"
- Keep commits focused and reversible

### Risk Mitigation

- **High-risk changes**: Sidebar, topbar, global styles → test thoroughly
- **Medium-risk**: Individual page redesigns → validate functionality
- **Low-risk**: Color/spacing tweaks → quick visual check
- **Rollback plan**: Each phase committed separately for easy revert

---

## Files Summary

### Phase 1 (1 file)

- `frontend/src/index.css`

### Phase 2 (4 files)

- `sidebar-nav.tsx`
- `topbar.tsx`
- `layout.tsx`
- `page-header.tsx` (NEW)

### Phase 3 (6 files)

- `button.tsx`
- `card.tsx`
- `badge.tsx`
- `input.tsx`
- `empty-state.tsx`
- `trello-filter.tsx`

### Phase 4 (15+ files)

- All module page files (dashboard, leads, customers, accounts, deals, pipeline, campaigns, etc.)
- All table components
- All modal/sheet components

### Phase 5 (10+ files)

- All form components
- All modal components

### Phase 6 (All interactive files)

- Add motion to all pages

### Phase 7 (Verification only)

- No new files, testing phase

### Phase 8 (Validation only)

- Quality gate checklist

**Total Estimated:** 50-70 files modified/created

---

## Success Criteria

This redesign is successful when:

1. ✓ LeadCRM looks and feels like a premium enterprise product (Linear/Attio/Notion quality)
2. ✓ No "template-like" or "AI-generated" appearance remains
3. ✓ Each module has its own distinct visual rhythm
4. ✓ All existing functionality preserved perfectly
5. ✓ Dark mode is polished and complete
6. ✓ Accessibility standards met (WCAG AA)
7. ✓ Animations feel intentional and smooth
8. ✓ No backend code touched
9. ✓ Quality gate checklist passes 100%
10. ✓ User can swap accent color without breaking layout

---

## Next Action

Execute implementation using **general-task-execution** agent with this plan as the specification document.

**Command:**

```
Implement LeadCRM UI/UX redesign according to design-system/MASTER.md and design-system/IMPLEMENTATION-PLAN.md. Execute phases 1-8 systematically. Frontend only, no backend changes. Preserve all existing functionality.
```

---

**End of Implementation Plan**
