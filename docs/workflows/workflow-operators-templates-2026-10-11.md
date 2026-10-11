# Workflow operators and templates — 2026-10-11

Workflow conditions now derive their operators from declared field types through a shared policy. The template chooser expands from 9 to 16 starters, including linked Deal stage routing. Existing saved Workflow operator keys and all original numeric template URLs remain compatible.

## Conditions and cross-module reuse

`shared/src/contracts/condition-operators.ts` defines labels, value shapes, declared type normalization and capability profiles. Workflow, Campaign audience and generic CRM filters use explicit profiles because their persisted keys, date behavior and empty-value semantics differ. The existing Workflow evaluator and audience/CRM query compilers remain separate.

| Declared Workflow type | Available operators | Value control |
| --- | --- | --- |
| Number, including Number Custom Fields | Equals, Not equals, Greater than, Greater than or equal, Less than, Less than or equal | Number input |
| Text | Equality, contains/not contains, starts/ends with, empty/not empty | Text or multiline input |
| Date | Equality, before/after, empty/not empty | Date input |
| Boolean | Equals, Not equals | Explicit Yes/No selection |
| Choice or reference | Equality, empty/not empty | Declared choices or tenant-owned references |
| Collection | Contains, Does not contain, empty/not empty | Declared collection/reference choices |

The frontend shares draft transitions and accessible field/operator/scalar controls. Add Condition, field selection and library placement use the same initialization rules. New Number and Boolean operands start blank; explicit `0` and `false` remain valid. Switching fields clears the operand and retains the operator only when compatible. Presence operators clear their operand. Existing unavailable fields/operators remain visible for explicit repair, with dependent controls disabled.

Workflow options refresh after relevant cache invalidations and focus/visibility events. Requests coalesce, obsolete responses are discarded, and current field definitions rebuild trigger fields without resetting edits or undo history. Permission failures clear protected choices and offer retry. A different user or workspace immediately hides the previous editor data.

Campaign audiences use the same labels and draft transitions while retaining audience-specific capabilities, including date ranges, Product ANY/NONE and presence conditions. Date comparisons use “On or after” / “On or before.” Invalid criteria clear stale recipient counts/rows; valid background refreshes mark previous results as stale. Late responses cannot restore results for superseded criteria. A blank Boolean choice remains incomplete.

Generic CRM filters now use repository-owned typed descriptors. Numeric/Boolean/date operands are validated and converted correctly; unsupported fields/operators and malformed query objects return validation errors instead of silently discarding criteria. Lead Created keeps its existing Manila calendar parser. Account size selections now toggle and send the canonical `size` field; the backend still accepts the legacy `type` alias. Fixed Deal/Pipeline, Tasks and Report filters retain their existing domain behavior.

## Template catalog and stage setup

Original recipe indexes 0–22 remain in their existing order. Four recipes append at 23–26. Stable descriptor IDs determine setup independently of editable display names. Every template opens an independent inactive draft.

| Starter | Index | Behavior |
| --- | --- | --- |
| Website Inbound Lead Triage | 2, now visible | Create a qualification task for Website Leads |
| Warm Lead Discovery Preparation | 3, now visible | Task when the status transition becomes Warm |
| Pipeline Stage Routing | 17, now visible | Match a selected pipeline/source stage, move to another open stage, then create a task |
| Hot Lead → Move Related Deal | 23, new | Move one matching persisted related open Deal when a Lead becomes Hot |
| Hot Contact → Move Related Deal | 24, new | Equivalent Contact status routing |
| Selected Stage Entry Follow-up | 25, new | Create a Deal task after entry into the selected pipeline stage |
| Ownerless Account Routing | 26, new | Assign an eligible agent after a meaningful update to an unassigned Account |

Linked stage setup appears in the condition inspector and Move Deal Stage inspector. Pipeline/source/target edits update the participating conditions and action together. Routing requires distinct open stages in one pipeline. Missing, ambiguous, terminal or incompatible selections require repair. Qualified Deal Follow-up keeps its verified never-Won guards and binds its selected stage and pipeline. Saved workflows without template context remain ordinary editable workflows. “Customize without linked template setup” explicitly releases the additional setup constraints.

Related routing defaults to one matching Deal, supports an optional Product filter, and requires explicit selection for All matching. Zero matches record a successful no-op without creating a task. Multiple matches fail in single-match mode. All matching executes sequentially and can partially complete; execution history preserves moved and failed IDs. The canonical stage transaction rechecks pipeline, source, Product, relationship, open/active state and optimistic concurrency at the read/write boundaries. Existing stage requirements, Won restrictions, tenant isolation and RBAC still apply.

Stage-entry tasks run after real transitions. Task due dates do not delay workflow execution. There are no new timers, Deal creation actions or pipeline-transfer actions. Existing domain closing/conversion behavior remains authoritative.

## Validation

- Frontend regression suite: 178 cases across 15 files passed. The final policy, metadata/user-scope and audience refinement run passed 49 cases, including the added user-scope transition case.
- Backend policy, filter, action validation and Deal lifecycle suites: 97 cases passed across 8 files.
- Authenticated HTTP and disposable database acceptance: 66 cases passed, including execution/deduplication of all 27 recipes, Account filter aliases and tenant isolation, and Lead/Contact no-match, ambiguous-match and all-matching routing.
- Workflow polish database suite: 20 cases passed, covering persisted Custom Fields, real update/stage events, dry-runs and lifecycle protections.
- Campaign HTTP/database suite: 65 cases passed with mocked delivery providers, including typed audience values, hidden active Number Custom Fields, zero, Product matching, date ranges, tenant/RBAC checks and recipient eligibility.
- Browser acceptance: 85 checks passed against the locally built app, authenticated API and disposable database. Checks include the 16-template chooser, explicit numeric zero, save/reload, metadata refresh preserving edits, linked stage persistence, assignment behavior, and responsive layouts at 1440, 1024, 768, 390, 375 and 320px. Browser runtime and transport error lists were empty; Number and linked-stage screenshots were inspected.
- Final `npm run build`, `npm run lint` and `git diff --check` passed. Shared compatibility JavaScript was regenerated by the build.

Useful commands:

```powershell
npm run lint
$env:API_URL='https://leadcrm-build.example/api/v1'
$env:NEXT_PUBLIC_USE_MOCK_DATA='false'
npm run build
npm --prefix frontend run test -- src/features/tenant/automation/workflows src/features/tenant/marketing/campaigns/ui/__tests__/audience-panel.test.tsx src/shared/services/condition-editor.test.ts --maxWorkers=2
node backend/scripts/test-workflow-polish.mjs src/modules/automation/workflows/__tests__/workflow.integration.test.ts src/modules/automation/workflows/__tests__/workflow-polish.integration.test.ts
node backend/scripts/verify-workflow-browser.mjs <installed-playwright-package-path>
```

The integration harnesses create and discard their own PGlite databases and test credentials. Delivery providers are mocked in integration suites; browser checks exercise local CRM services. These results establish local behavior, not production deployment or live delivery. No new database migration is required. Shared compatibility JavaScript is regenerated from TypeScript with the shared build.

Architecture/system-design, testing-strategy, React best-practices, full-story verification, code-review and documentation skills guided the implementation and review. Workflow UI, backend contracts and cross-module/template specialists contributed parallel audits and changes.

See [Architecture](../ARCHITECTURE.md), [API](../API.md) and [existing Workflow lifecycle notes](workflow-polish-2026-10-03.md) for the underlying platform contracts.

## Integration with main — 2026-10-12

The implementation was rebased onto `58a3efd2` (CRM access and data integrity). Its transaction-level CRM mutation checks, audience eligibility totals, campaign field bindings and required-field accessibility remain intact. The typed Account filter policy now explicitly accepts the new My Accounts scope; authenticated HTTP coverage confirms it returns only the current user's assigned accounts within their tenant.

The integrated revision passed the full three-workspace production build, 180 affected frontend cases across 15 files, 66 authenticated Workflow cases, 20 Workflow lifecycle cases and 66 campaign HTTP/database cases. The frontend total combines 156 cases from the initial run with 24 cases from the sequential retry. Initial retries encountered Windows engine locking, test-worker startup delays, five-second UI deadlines and a disposable database connection timeout under low available memory. Sequential reruns passed; the UI retry used a single thread worker and a 30-second test deadline. The 85 browser checks above apply to the implementation before this rebase.
