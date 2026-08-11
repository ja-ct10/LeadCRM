# Pipeline Drag-and-Drop Fix

## Critical Issue: Cards Disappearing or Returning After Drop

### Root Cause
When dragging a card to a different column, the collision detection was returning the **card's own ID** instead of the **stage container ID** when dropping in certain areas (especially near other cards or in partially empty columns). This caused `handleDragEnd` to receive `activeId === overId` (dropping on itself), which the code treated as a no-op, making the card appear to disappear or return to its original position.

### The Fix: Optimistic State Fallback
The solution captures the **optimistic target stage** from `handleDragOver` before clearing state, then uses it when `overId` equals the card's own ID. This ensures that even if collision detection fails to detect the stage container, we honor the user's clear intent from the drag gesture.

**Key Changes in `handleDragEnd`**:
1. Capture `optimisticTargetStage` BEFORE clearing `optimisticStageMap`
2. If dropped on self AND optimistic target exists AND differs from current stage → use optimistic target
3. Handle terminal stages (Won/Lost) in the optimistic path too
4. Log the optimistic target for debugging

---

## Issue Summary
The pipeline kanban drag-and-drop was not persisting. Cards visually moved during drag but disappeared or returned to original position on drop.

## Root Causes Identified

1. **Collision detection returning card ID instead of stage ID**: When dropping in certain areas, `@dnd-kit` returned the sortable card's ID instead of the droppable stage container's ID
2. **Duplicate `.map()` call**: Line 1969 was applying `optimisticStageMap` transformation twice, which was redundant
3. **Low opacity during drag**: Cards had opacity 0.3 during drag, making them nearly invisible
4. **Insufficient visual feedback**: Drop zones weren't clearly indicating they were ready to accept cards
5. **Missing `activePipeline` in dependencies**: `pipelineDeals` memo was missing `activePipeline` dependency, causing stale stage flag lookups

## Changes Made

### 1. Added Optimistic State Fallback (CRITICAL FIX)
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Line**: ~1160

**Problem**: When dropping, collision detection sometimes returns the card's own ID instead of the stage ID, causing drops to be ignored.

**Solution**: Capture the optimistic target stage before clearing state, and use it when needed.

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  // ... 
  const activeId = active.id;
  const activeDeal = deals.find(d => d.id === activeId);
  
  // ✅ Capture optimistic target BEFORE clearing
  const optimisticTargetStage = activeDeal && optimisticStageMap[String(activeId)] 
    ? optimisticStageMap[String(activeId)]
    : null;
  
  setActiveDeal(null);
  setOptimisticStageMap({});  // Clear after capturing
  
  // ... later ...
  
  // ✅ Use optimistic target when collision detection fails
  if (activeId === overId && optimisticTargetStage && optimisticTargetStage !== activeDeal.stageId) {
    console.log('[Pipeline DnD] Dropped on self but using optimistic target:', optimisticTargetStage);
    // Handle Won/Lost stages + normal stage moves using optimistic data
    moveDealStage(String(activeId), optimisticTargetStage).catch(...);
    return;
  }
  
  // No stage change - do nothing
  if (activeId === overId) {
    console.log('[Pipeline DnD] Dropped on self - no action');
    return;
  }
}
```

### 2. Fixed Missing Dependency in pipelineDeals Memo
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Line**: ~860

**Added**: `activePipeline` to dependency array (needed for `filterStatus` stage flag lookup)

### 3. Enhanced Debug Logging
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`

**Added logging** to track:
- When drops are cancelled
- When drops are rejected (permissions)
- Full drop context (deal, stage, target, optimistic state)
- When optimistic fallback is used
- API errors with clear prefixes

### 4. Fixed Duplicate Map Application
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Line**: ~2007

**Before**:
```typescript
const stageDeals = pipelineDeals
  .map(d => optimisticStageMap[d.id] ? { ...d, stageId: optimisticStageMap[d.id] } : d)
  .map(d => optimisticStageMap[d.id] ? { ...d, stageId: optimisticStageMap[d.id] } : d) // DUPLICATE!
  .filter(d => d.stageId === stage.id);
```

**After**:
```typescript
// Apply optimistic stage override for visual feedback during drag
const stageDeals = pipelineDeals
  .map(d => optimisticStageMap[d.id] ? { ...d, stageId: optimisticStageMap[d.id] } : d)
  .filter(d => d.stageId === stage.id);
```

### 5. Improved Drag Visual Feedback
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Component**: `SortableDealCard`
**Line**: ~165

**Before**:
```typescript
const style = {
  transform: CSS.Transform.toString(transform),
  transition: isDragging ? 'none' : transition,
  opacity: isDragging ? 0.3 : 1,  // Too transparent!
  zIndex: isDragging ? 999 : 1,
};
```

**After**:
```typescript
const style = {
  transform: CSS.Transform.toString(transform),
  transition: isDragging ? 'none' : transition,
  opacity: isDragging ? 0.5 : 1,  // More visible
  zIndex: isDragging ? 999 : 1,
  cursor: isDragging ? 'grabbing' : 'pointer',  // Better cursor feedback
};
```

### 6. Enhanced Drop Zone Visual Feedback
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Component**: `DroppableStage`
**Line**: ~270

**Changes**:
- Added `ring-2 ring-blue-500/30` when hovering over a column during drag
- Reduced transition duration from 300ms to 200ms for snappier feedback
- Added color change to column title when hovering
- Enhanced shadow and scale effects

**Before**:
```typescript
className={`... transition-all duration-300 ${
  isOver 
    ? 'border-blue-500/60 bg-blue-500/[0.08] shadow-[0_0_30px_rgba(59,130,246,0.15)] scale-[1.02] z-10' 
    : ...
}`}
```

**After**:
```typescript
className={`... transition-all duration-200 ${
  isOver 
    ? 'border-blue-500/60 bg-blue-500/[0.08] shadow-[0_0_30px_rgba(59,130,246,0.2)] scale-[1.02] z-10 ring-2 ring-blue-500/30' 
    : ...
}`}
```

### 7. Improved Empty Drop Zone Indicator
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Line**: ~2054

**Before**:
```typescript
{stageDeals.length === 0 && (
  <div className="h-24 border-2 border-dashed border-gray-200 ...">
    Drop deals here
  </div>
)}
```

**After**:
```typescript
{stageDeals.length === 0 && (
  <div className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-sm transition-all ${
    !!activeDeal 
      ? 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 font-medium' 
      : 'border-gray-200 dark:border-white/[0.05] bg-white/[0.01] text-slate-500'
  }`}>
    {!!activeDeal ? '↓ Drop deal here' : 'No deals in this stage'}
  </div>
)}
```

### 8. Optimized handleDragOver State Updates
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Line**: ~1110

**Before**:
```typescript
setOptimisticStageMap(prev => ({ ...prev, [activeId]: targetStageId! }));
```

**After**:
```typescript
// Update optimistic map to show card in new column during drag
setOptimisticStageMap(prev => {
  // Only update if different from current optimistic state
  if (prev[activeId] !== targetStageId) {
    return { ...prev, [activeId]: targetStageId! };
  }
  return prev;
});
```

### 9. Enhanced handleDragStart
**File**: `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`
**Line**: ~1098

**Changes**:
- Added explicit clearing of optimistic state
- Added comment for clarity
- Grouped related state changes

## Testing Checklist

✅ **Visual Feedback**:
- [ ] Card becomes semi-transparent (50% opacity) when dragging
- [ ] Cursor changes to "grabbing" during drag
- [ ] Target column shows blue highlight and ring when hovering
- [ ] Column title changes to blue when hovering during drag
- [ ] Empty columns show "↓ Drop deal here" message during drag

✅ **Drag Behavior**:
- [ ] Card visually moves to target column immediately during drag (optimistic update)
- [ ] Card stays in target column after drop (FIXED: now uses optimistic fallback)
- [ ] No duplicate cards appear during drag
- [ ] Drag overlay shows proper card preview
- [ ] Browser console shows "[Pipeline DnD]" logs during drag/drop

✅ **Cross-Column Moves**:
- [ ] Dragging from "New Inquiry" to "Contacted" works
- [ ] Dragging to empty columns works (uses optimistic fallback)
- [ ] Dragging to columns with existing deals works
- [ ] Won/Lost stage prompts still appear correctly (both normal and optimistic paths)

✅ **Edge Cases**:
- [ ] Automated pipeline mode (locked) prevents dragging
- [ ] Permission checks prevent unauthorized drags
- [ ] Terminal stages (Won/Lost) open modals instead of immediate move
- [ ] Dropping on self with no stage change does nothing (graceful no-op)

## Technical Architecture

### DnD Flow:
1. **handleDragStart** → Clear optimistic state, set active deal
2. **handleDragOver** → Update `optimisticStageMap` with target column
3. **Render** → Apply optimistic map to show card in new position
4. **handleDragEnd** → 
   - **Capture** optimistic target BEFORE clearing
   - Clear optimistic state and active deal
   - Check collision: if dropped on self, use optimistic target as fallback
   - Otherwise use normal collision detection (stage ID or deal ID)
   - Call `moveDealStage` API
5. **Store update** → Real data replaces optimistic data

### Key Components:
- `customCollisionDetection`: 3-tier collision (pointerWithin → rectIntersection → closestCenter)
- `optimisticStageMap`: Maps dealId → temporary stageId during drag
- `optimisticTargetStage`: Captured fallback when collision detection fails
- `SortableDealCard`: Individual draggable cards with visual feedback
- `DroppableStage`: Column containers that accept drops

## Performance Notes

- `optimisticStageMap` prevents unnecessary re-renders by checking value equality
- Transition duration reduced from 300ms to 200ms for snappier UX
- `activeDeal` state drives all conditional rendering during drag
- No additional API calls during drag — only on drop
- Optimistic fallback adds zero overhead (single map lookup before clear)

## Code Review Findings

From context-gatherer subagent:

**Issues Found**:
1. ❌ **Direct localStorage usage** - 4 violations (view mode, velocity expanded, theme, automation toggle)
2. ❌ **`any` type usage** - Multiple violations in component props and callbacks
3. ❌ **Inline `style={{backgroundColor}}`** - 1 violation in stage color badge
4. ❌ **Raw `<select>` in modals** - 4 violations in Add Deal modal (should use ShadCN Select)

**Compliant**:
- ✅ No missing `tenantId` (handled by DataContext)
- ✅ No missing `addAuditLog` (handled by DataContext)
- ✅ RBAC guards present on all CUD UI elements
- ✅ Correct `motion/react` imports (not framer-motion)
- ✅ Correct chart imports via `ChartComponents.tsx`
- ✅ Filter bar uses `<TrelloFilter>` correctly
- ✅ All UI elements have dark mode classes

## Currency Symbol

As a side note, all currency symbols were already fixed in a previous iteration:
- Deal cards: `₱` (Philippine Peso)
- Deal details modal: `₱` 
- All 4 render sites now use `₱` consistently

## What To Check in Browser Console

After this fix, you should see logs like:

```
[Pipeline DnD] Dropping deal: {dealId: "...", dealTitle: "...", currentStage: "...", targetId: "...", optimisticTargetStage: "..."}
[Pipeline DnD] Dropped on self but using optimistic target: <stageId>
```

Or on successful stage detection:
```
[Pipeline DnD] Dropping deal: {...}
// (no "dropped on self" message - normal stage move)
```

## Next Steps (if still not working)

If drag-and-drop still fails after these changes:
1. Check browser console for "[Pipeline DnD]" logs - confirm optimistic target is captured
2. Check if `moveDealStage` API call succeeds (no error toast should appear)
3. Verify DataContext `setDeals` is updating correctly after API response
4. Check if filters are hiding the moved card (try clearing all filters)
5. Verify backend `/api/v1/crm/deals/:id/stage` endpoint is working

## Files Modified

- `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx` (9 changes)
