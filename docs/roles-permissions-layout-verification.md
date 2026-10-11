# Roles & Permissions layout verification

Verified locally on October 11, 2026 (Asia/Manila). The repair is on the existing
`main` checkout. It has not been published or deployed to Coolify.

## Root cause

Partially selected permission groups render an absolutely positioned `sr-only`
label: "Partially enabled". The Settings content scroller did not establish a
positioned containing block. When the role editor's entry transform finished,
those labels could use the document as their containing block and escape the
intermediate overflow boundaries. Their offscreen positions expanded the
document scroll area. Scrolling the document then moved the entire correctly
sized application upward, exposing the gray document background beneath it.

This was observed in the deployed authenticated editor through read-only DOM
inspection: a 911px viewport and a correctly sized 911px shell, but a 4,019px
document scroll area. No production role was saved or permission changed.

The same failure was reproduced locally by partially selecting the Roles &
Permissions group. The original wrapper produced a 4,481px document scroll area
in a 911px viewport. Moving the document down 344px reproduced the premature
application boundary shown in the supplied screenshot.

The existing height expression is appropriate:

```text
app viewport height = 100dvh - measured install banner height
Settings height = app viewport height - 52px application header
```

The main workspace's padding is canceled by the Settings wrapper's existing
responsive negative margins. There was no duplicate header/banner subtraction.
The repair retains these dimensions and the existing mobile breakpoints.

## Exact changes

- `frontend/src/features/tenant/settings/ui/settings-page.tsx`: add `relative`
  and `min-h-0` to the existing right-hand content scroller. Absolute descendants
  are contained inside the element that owns their scrolling; the flex child can
  shrink within the bounded Settings workspace.
- `frontend/src/features/tenant/settings/ui/__tests__/settings-navigation.test.tsx`:
  correct a stale expectation from "Custom Fields" to the existing
  "Customize Fields" navigation label. The product label is unchanged.
- `scripts/verify-settings-layout.cjs`: reproducible local browser regressions
  using the actual Next frontend, canonical permission registry, and in-memory
  API fixtures. Only loopback preview URLs are accepted.
- `docs/roles-permissions-layout-verification.md`: this report.

`roles-permissions.tsx`, permission cards, toggle rules, dependency rules,
authorization, backend code, API contracts, and database schema are unchanged by
this repair. No migration is required. Unrelated pre-existing checkout edits
were left intact.

## Results

The repaired 1920x911 viewport has:

| Boundary | Result |
| --- | --- |
| Document scroll height | 911px |
| Application shell bottom | 911px |
| Application main area | top 52px, height 859px, bottom 911px |
| Settings navigation | top 52px, height 859px, bottom 911px |
| Settings content | top 52px, height 859px, bottom 911px |
| Outer main scroll range | zero |
| Permission content | scrolls through all groups inside Settings |
| Final card bottom spacing | existing padding; asserted between 20px and 60px |

108 browser checks, eight additional wrapped-description checks, and 24 focused
scrollbar checks passed with zero browser page errors. The API fixtures do not establish live database
persistence or backend authorization acceptance.

| Verification | Result |
| --- | --- |
| Desktop at 100% zoom, every permission group, final Organization Settings card | Passed |
| Create Custom Role, name/description fields, individual/group toggles | Passed |
| Dependency behavior and partial selection | Passed |
| Toggle changes before Save | No role write |
| Cancel and Back to roles | Passed; no write on Cancel |
| Create Role | One POST through the existing API client; fixture response rendered |
| Edit Role / Save Changes / reopen | Existing PUT endpoint; fixture response retained |
| Client Admin edit/archive protection | Actions remain disabled |
| Profile Settings, Appearance, General, Team Management, Roles & Permissions, Customize Fields, Products, Archived Data, Forms | Navigation and workspace geometry passed at every requested width |
| 320, 375, 390, 430, 768, 1024, 1440, 1920px | No document/content horizontal overflow, overlapping switches, or extra outer scroller |
| Multiline permission descriptions | Existing paragraph styles stress-tested at all eight widths |
| Window heights 600, 720, 1080px | Workspace updates correctly |
| Install banner visible/dismissed | Measured offset applied once; workspace resizes correctly |
| Actual Chrome browser zoom 80%, 90%, 100%, 110%, 125% | Passed |
| Second scrollbar: editor has exactly one effective scrolling ancestor | Passed at all eight requested widths |
| Wheel scrolling past final card and attempted document scrolling | Document remains at scrollY=0; workspace stays within viewport |
| Cancel after scrolling to bottom | No extra document or outer workspace scrollbar |
| Frontend TypeScript (`npm --prefix frontend run lint`) | Passed |
| Focused Vitest regressions | 49 tests passed across four files |
| Frontend production build | Passed; 180 pages generated |
| Diff whitespace validation | Passed |

Actual browser zoom was configured in disposable Chrome profiles using its
partition zoom preference. Device pixel ratios of 0.8, 0.9, 1.0, 1.1, and 1.25
were asserted after navigation. This uses Chromium's
[zoom preference implementation](https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc),
and does not use CSS zoom or pinch emulation.

The build used `API_URL=https://leadcrm-build.example/api/v1` as a build-only
configuration value. Next correctly rejected the local HTTP API URL in
production mode. Sandbox filesystem/network restrictions required approved
retries for Next, Vitest, and browser preview access.

## Screenshots and measurements

All generated evidence is outside the repository in:

```text
C:\Users\Julie Ann Tiron\.codex\visualizations\2026\10\11\01a12b6c-a7f0-7ea0-ba2c-50dcf949abb1
```

- `before-desktop-100.png`: original wrapper, reproduced document scrolling.
- `after-desktop-100.png`: repaired wrapper, final card at 1920x911 and 100% zoom.
- `after-desktop-banner-100.png`: final card with the install banner.
- `after-320.png` through `after-1920.png`: all eight requested widths.
- `single-scrollbar-320.png` through `single-scrollbar-1920.png`: final card
  after wheel scrolling at the bottom; no second document scrollbar.
- `zoom-80.png`, `zoom-90.png`, `zoom-100.png`, `zoom-110.png`, `zoom-125.png`:
  actual browser zoom screenshots.
- `before-metrics.json`, `results.json`, `wrapping-results.json`, `zoom-results.json`, `scrollbar-results.json`: measured
  boundaries and completed checks. Intermediate failure logs are not final
  acceptance results.

## Reproduction commands

Start the local frontend in development mode with
`NEXT_PUBLIC_USE_MOCK_AUTH=true` and `NEXT_PUBLIC_USE_MOCK_DATA=true` on loopback
port 3036. Do not change production configuration or write credentials into the
harness. Then run:

```powershell
# Set PLAYWRIGHT_MODULE when Playwright is supplied by the desktop runtime.
# Set SETTINGS_QA_OUTPUT to an evidence directory outside the repository.
node scripts/verify-settings-layout.cjs

npm --prefix frontend run test -- src/features/tenant/settings/ui/__tests__/roles-permissions.test.tsx src/features/tenant/settings/ui/__tests__/settings-navigation.test.tsx src/features/tenant/layout/__tests__/responsive-navigation.test.tsx src/shared/components/__tests__/pwa-install.test.tsx --maxWorkers=1
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Deployment boundary

Coolify deployment was not triggered. The deployed defect was reproduced, but
the repaired code was verified only locally. Production fix status: **I cannot
confirm this.** An authenticated post-deployment check of the partial-group
editor and final card remains required before calling production fixed.
