# Action Center compact spacing verification — 12 October 2026

## Result and root cause

Implemented and verified locally on main. The individual Action Center links used `h-[6.75rem] p-3`, reserving 108px at Medium density even for a single-line Hot Lead without a due date. The list separately reserved 580px on desktop (`36.25rem`) or 344px below desktop (`21.5rem`), so reducing only the links would have left an oversized viewport.

Links now use natural block height with `px-3 py-2.5`, without a fixed or minimum item height. At Medium density, horizontal padding remains 12px; vertical padding changes from 12px to 10px. Category-to-title spacing changes from 4px to 2px. Due-date spacing remains 2px, and adjacent-card spacing remains 10px.

Measured at 1440px:

| Item | Previous height | New natural height |
| --- | ---: | ---: |
| Single-line Hot Lead, no date | 108px | 59px |
| Single-line overdue Task with date | 108px | 77px |
| Two-line overdue Task with date | 108px | 97px |
| Two-line stagnant Deal, no date | 108px | 79px |

These measurements are observations, not fixed CSS dimensions. The existing two-line title clamp and complete DOM text/native link title remain. Optional dates produce no placeholder.

## Scroll and chart layout

The Action Center list measures the actual first five links and their gaps for the existing desktop breakpoint (1024px), or first three below it. A local ResizeObserver recalculates the maximum height as card widths, title wrapping, fonts or content change. Fewer actions use their natural list height. Empty states release the former fixed viewport reservation.

All actions still render with their existing stable keys and destinations. The list retains internal scrolling, stable scrollbar gutter, keyboard access and inset focus indicators. The measurement does not remount the list or assign scrollTop.

At 1440px, five overdue Tasks including one two-line title use a 445px viewport rather than 580px. Two Tasks and three Hot Leads use 391px. The sixth and later actions stay reachable. Increasing from five to six or ten actions does not increase the row height when the first five are unchanged.

Revenue Trend's grid, responsive chart wrapper, 220px minimum plot height, chart logic and calculations are unchanged. Desktop cards remain aligned; stacked layouts retain the plot minimum.

## Files changed for this fix

- `frontend/src/features/tenant/dashboard/ui/dashboard.tsx`: content-sized cards and measured scroll cap.
- `backend/scripts/verify-dashboard-leads-ui.mjs`: natural-height assertions, mixed action fixtures, all requested widths/themes and a Dashboard-only verification option.
- `backend/scripts/verify-dashboard-browser.mjs`: pass through that option and update the existing single-action geometry check.
- `docs/verification/action-center-compact-spacing.md`: this report.

The browser fixtures supply the Deal association required by the current Task API, required Lead emails, and the canonical Deal priority enum. No backend business logic, shared contract, database schema or migration was changed for this UI fix.

Unrelated authentication/lockout and schema edits appeared concurrently in the shared workspace after the build. They are outside this fix and were preserved. The successful build and TypeScript checks below cover the Dashboard patch before those concurrent edits, rather than certifying the combined workspace.

## Automated verification

| Check | Result |
| --- | --- |
| `npm run lint` | All three workspace TypeScript checks passed |
| `npm run build` | All three workspaces passed; 180 frontend pages generated |
| Dashboard hook, chart and Reports frontend tests | 13 passed |
| Reporting integration tests | 19 passed |
| Focused Dashboard browser acceptance | 97 checks passed, zero page errors |
| Broader existing Dashboard browser regression | 44 checks passed, zero page errors |
| Both verification scripts' `node --check` | Passed |
| `git diff --check` for this fix | Passed |

Build verification used a temporary command-scoped HTTPS API configuration, with mocks disabled. No environment file was edited. The browser harness overrides the API target with its actual local backend and uses real HttpOnly sessions, the Next proxy, SSE and disposable PostgreSQL-compatible SQL.

Action-count acceptance:

| Actions | Verified behavior |
| ---: | --- |
| 0 | Existing All caught up state |
| 1 | One natural 77px Task card; no fixed list reservation |
| 4 | Four complete compact cards |
| 5 | Five complete cards visible on desktop |
| 6 | Sixth reachable through internal scrolling |
| 10 | Every action retained and reachable; row stops growing after the first five |

Mouse wheel (also the touchpad scroll event path), Home/End, Tab focus, touch swipe, full titles, optional dates, overdue-first ordering, all destination links, background additions/completions without scroll resets, and Small/Medium/Large font density passed.

Week/Month/Year revenue filters, single/multiple observations, currency axis labels/tooltips, responsive canvas sizing, date filters, Sync Metrics and Reports CSV passed. The broader regression also passed real-time updates, assignment scope, permission revocation/restoration, failed-refresh recovery and historical reporting checks.

## Responsive results

Light and dark mixed-action checks passed at every requested width, with no horizontal overflow or clipped card content. Desktop tests see five full cards; smaller layouts see three.

| Width | Mixed list viewport | Revenue plot height | Visible cards |
| ---: | ---: | ---: | ---: |
| 320px | 273px | 220px | 3 |
| 375px | 253px | 220px | 3 |
| 390px | 253px | 220px | 3 |
| 430px | 253px | 220px | 3 |
| 768px | 253px | 220px | 3 |
| 1024px | 391px | 405px | 5 |
| 1440px | 391px | 405px | 5 |
| 1920px | 391px | 389px | 5 |

The root scroll width equals the viewport width at all eight sizes. Titles wrap naturally; the long Task remains clamped to two lines and its due date remains visible. Existing red/amber themes, priority styling, borders, corners and typography are retained.

## Screenshots and evidence

Matched five-Task comparison:

- `Before: five fixed-height cards` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-before/dashboard-actions-5.png`)
- `After: five natural-height cards` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final/dashboard-actions-5.png`)

Mixed cards:

- `Desktop light` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final/dashboard-compact-light-1440.png`)
- `Desktop dark` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final/dashboard-compact-dark-1440.png`)
- `320px light` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final/dashboard-compact-light-320.png`)
- `390px dark` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final/dashboard-compact-dark-390.png`)

Every requested width has light/dark screenshots in `the final evidence directory` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final`).

Acceptance records:

- `97-check final results` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final/results.json`)
- `Final browser log` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-final-run.log`)
- `44-check Dashboard regression results` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-regression/results.json`)
- `Dashboard regression log` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/12/01a12e2e-43b5-7f22-b3a1-73abf7980900/action-center-regression-run.log`)

Earlier runs stopped on fixture/setup issues that were corrected before final acceptance. The pre-change baseline later stopped on an unrelated Leads-column assertion (Source versus Assigned Agent); its screenshots are visual baseline evidence. The final focused run uses `--ui-polish --dashboard-only`; the separate Leads suite and full repository test suite are not claimed as passing.

To reproduce after workspace builds, set `UI_POLISH_OUTPUT` to an evidence directory outside the repository and run `node backend/scripts/verify-dashboard-browser.mjs <installed-playwright-path> --ui-polish --dashboard-only`. For the broader regression, set `DASHBOARD_VERIFICATION_OUTPUT` and omit those flags.

## Deployment status

No commit, push or Coolify deployment was performed for this request. Production Dashboard behavior has not been verified. These results establish the local UI fix, not a deployed production fix. No production database was contacted by the acceptance harness.


Historical link maintenance: 11 reference(s) pointed to absent local evidence or retired source. Their original labels and paths remain above as provenance; the referenced files are unavailable in this checkout. No current-release verification is inferred from those references.
