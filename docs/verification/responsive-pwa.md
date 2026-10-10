# Responsive app shell and PWA verification

## Navigation behavior

| Viewport | Default | Expansion |
| --- | --- | --- |
| Below 768px | Hidden | Modal drawer, bounded to the viewport |
| 768–1024px | 56px rail | Modal drawer over the content |
| 1025px and above | 220px sidebar | User can collapse to a 56px rail |

Desktop preferences are scoped to tenant and user. Temporary overrides do not replace the saved preference. Route changes, crossing navigation breakpoints, opening a blocking overlay, and entering app focus mode close the navigation drawer. Ordinary desktop dialogs leave the docked sidebar in place; their background is inert. Visible docked panels temporarily collapse desktop navigation only when they would leave less than 720px of usable workspace after margins.

Mobile and tablet navigation support Escape, outside dismissal, left swipe, focus trapping, and background scroll locking. Vertical movement is excluded from swipe dismissal. App focus mode and the native Fullscreen API hide navigation and restore the normal preference on exit. Mobile and tablet breakpoint changes apply their rail width immediately; desktop user collapse retains its animation. This prevents a desktop sidebar from temporarily consuming a narrow mobile viewport while resizing.

## Shared layout changes

- The top install banner occupies normal layout space. Its measured height is deducted from the app viewport; navigation starts below it.
- Page actions wrap and primary create actions retain their labels on small screens. Create dropdowns align with the left edge on mobile. Table settings submenus expand within the menu on mobile and support tap and keyboard activation.
- Shared dialogs have viewport gutters, bounded height, and internal scrolling. Sheets and record drawers use dynamic viewport height. Nested overlays retain scroll and inert locks until the final overlay closes.
- Legacy role, task, deal, handoff, scratchpad, inbox, and template preview surfaces use the shared dialog behavior. The existing form payloads and API permission checks are retained.
- Manage Columns, owner profiles and record-level lost-deal confirmation also use shared overlay handling. Columns retain save/retry/reset and unsaved-change confirmation; dismissal is blocked during a pending save. Owner profile content scrolls inside the viewport.
- Settings, filter rails, and form builder tools dock only when there is enough space. Smaller layouts use a section selector or modal drawer.
- Public and authentication pages account for banner height; mobile inputs retain a readable 16px minimum.

## PWA behavior

The banner displays only after a usable browser-issued `beforeinstallprompt` event. It is suppressed in installed display modes, after `appinstalled`, after dismissal, and after cancellation for the current session. Prompt events are consumed once, and duplicate clicks are guarded. X dismissal uses `leadcrm:pwa-install-dismissed:v1` and survives reloads. Storage failures fall back to the current session.

Successful installation shows one confirmation toast. Prompt failures show an actionable error toast. Resizing and ordinary dismissal are silent. Help includes browser-specific installation instructions when a native prompt is unavailable.

The banner has its own `ThemeScope`, so Classic, Light, Dark and System use the existing appearance store without changing the styling policy of public pages. Its CSS variables derive the green tint from `--success` and `--surface`, its text from `--text-primary`, and its Install action from the selected primary accent's darker shade. This keeps white button text readable across all seven accents. System follows live operating-system appearance changes. Appearance changes do not remount the install provider or discard a captured prompt.

Below 640px, the message uses a 13px minimum with a separate action row aligned to the right. Install is content-sized, with a 14px icon and 12px horizontal padding; it measures approximately 84px wide rather than filling the row. X retains a 44px width. At 640px and above, the message and actions share a row with a 14px message minimum. Density preferences can increase text size, while both controls retain a 44px minimum height. The measured banner height updates through `ResizeObserver`, including wrapping and density changes.

The manifest uses correctly sized 192px and 512px icons, a separately padded maskable icon, and a stable app ID. The service worker refreshes the public asset cache while preserving its existing exclusion of API, private, and dynamic CRM responses.

## Verification scope

Browser verification uses an isolated local mock session. The temporary iframe harness supports exact requested widths without changing the user's desktop zoom. Measurements use the browser's reported dimensions, which can round by a pixel at the current desktop zoom. Breakpoint boundary behavior is also covered by unit tests.

Native installation is simulated through `beforeinstallprompt`, `userChoice`, and `appinstalled`; no operating-system app is installed by these checks. The simulation verifies eligibility gating, colors, one prompt invocation, successful-install feedback, and remembered dismissal after reload.

The mock UI session has no live backend authentication. A disposable loopback fixture supplies populated dashboard/reporting data, a draft form and a connected but empty email inbox. It never forwards requests or sends mail. Other API-dependent modules use available empty, loading and recoverable error states. Automated feature tests cover populated data and existing business operations. Live backend CRUD, real device keyboards, and native Chrome/Edge/iOS installation remain release checks.

## Recorded browser checks

Before the theme refinement, the integrated mock CRM shell was measured from 320px to 2560px. Its sidebar occupied 0px on mobile, approximately 56px on tablet, and 220px on desktop. Tablet expansion and Escape dismissal, mobile navigation below the banner, route-change dismissal, create-record drawer bounds, profile menu bounds, and scroll locking were exercised. At 320px, Leads, Contacts, Accounts, Deals, Pipeline, Tasks, Campaigns, Workflows and Settings fitted their page containers. API-dependent modules used available empty/error states. This does not establish complete coverage of every module and operation.

The earlier banner theme refinement was verified using the actual production provider, theme scope, appearance store and compiled app stylesheet in a temporary component preview. Native prompt events and OS appearance changes were simulated; that preview did not recreate CRM modules. Its measurements and screenshots predate the smaller button.

| Check | Result |
| --- | --- |
| Classic, Light, Dark, System/light and System/dark at 15 widths each | 75 cases; no horizontal overflow |
| Widths | 320, 360, 375, 390, 414, 480, 639, 640, 767, 768, 1024, 1025, 1440, 1920, 2560px |
| System/dark in a 320px-high landscape viewport | Banner fitted at all 15 widths |
| Small, Medium, Large density at 6 widths | 18 cases; no overflow, text at least 13px, controls at least 44px |
| All 7 accents in Classic, Light and Dark | 21 combinations; message contrast at least 11.65:1 and Install text contrast at least 5.01:1 |
| Keyboard focus | Tab from Install reached X; visible solid focus outline |
| Keyboard installation | Enter called the retained prompt exactly once after appearance changes |
| Installation completed | Banner hidden, reserved height reset to 0px, one success toast |
| X, reload, new installable event | Banner remained dismissed |

At 320px with Medium density, the banner was approximately 108px tall. At 640px and wider it was approximately 61px tall. Browser measurements round slightly at the desktop's existing zoom; a 44px CSS target measured approximately 43.99px.

Earlier screenshots: [Dark mobile](assets/responsive-pwa/banner-dark-mobile.jpg), [Light mobile](assets/responsive-pwa/banner-light-mobile.jpg), [Classic tablet](assets/responsive-pwa/banner-classic-tablet.jpg). Raw measurements and behavior results are saved alongside these images.

## Final refinement checks

- The smaller Install button passed 60 integrated browser cases: Classic, Light, Dark and System at all 15 widths listed above. No banner or app-page overflow was measured; Install remained approximately 84px wide with a 44px height. The earlier System/light and System/dark simulations, density and contrast checks remain applicable to the unchanged theme variables.
- All nine Settings sections were checked at 320px. The populated Forms builder fitted, its tools sheet bounded itself to the viewport, keyboard focus stayed inside the sheet, tap-to-add worked and Escape restored focus to the tools trigger.
- The email composer and emoji picker fitted at 320px portrait and 740×320 landscape. Emoji controls now reflow rather than requiring horizontal scrolling; category tabs retain a bounded horizontal scroller. Escape dismissed the picker before the composer. Composer input survived desktop resizing and fullscreen toggling; navigation changed from 220px to 0px in focus mode and returned to 220px on exit.
- Dashboard captions wrap in narrow cards. Shared chart containers and canvases remain bounded to their parents while Chart.js redraws after resizing. SMS phone previews scale to their available container width.
- The final module matrix contains 182 passing layout cases across 26 routes at requested widths 320, 480, 768, 1024, 1025, 1440 and 2560px. It covers Dashboard, CRM tables and Pipeline, Tasks, Campaigns, Workflows and its builder, Inbox, Reporting, Notifications, all Settings sections, the Leads import wizard, Help, privacy, terms and support. Reporting was rechecked after the chart fix; the import wizard was retried after its first development compilation exceeded the harness wait. No page overflow remained in the recorded final cases. Shared component tests cover additional drawers, confirmations and form operations; the matrix is not a record of every possible populated screen or business operation.
- Keyboard Enter invoked the retained native prompt exactly once after actual app appearance changes and SPA navigation. Accepted installation plus `appinstalled` hid the banner, reset its reserved height to 0px and showed one success toast. X dismissal remained honored after reload and another installable event.

Current screenshots: [smaller button in Light](assets/responsive-pwa/compact-banner-light-mobile.jpg), [smaller button in Dark](assets/responsive-pwa/compact-banner-dark-mobile.jpg). Final evidence: [module measurements](assets/responsive-pwa/module-measurements.json), [theme and size measurements](assets/responsive-pwa/compact-banner-measurements.json), [install/dismissal behavior](assets/responsive-pwa/compact-banner-behavior.json). Requested and measured widths can differ by a pixel because of the desktop's existing zoom; exact navigation boundaries also pass unit tests. The theme matrix verifies rendered theme classes, not only the requested preference labels.

## Automated results

| Check | Result |
| --- | --- |
| Full frontend regression suite | 151 files / 1,272 tests passed |
| Final affected PWA, composer, Inbox, Forms, dashboard, CSS and navigation run | 8 files / 86 tests passed |
| Final charts, CSS compilation and navigation run | 3 files / 20 tests passed |
| Native fullscreen additions | Both new mobile/desktop cases passed; navigation file has 14 passing tests |
| Workspace lint/type checks | All 3 workspaces passed |
| Final Next.js production build | Passed; all 180 routes generated |

The broad run includes the shared overlay migrations, column save/discard guards, profile drawer and lost-deal confirmation. The focused runs validate the subsequent small layout refinements and native-fullscreen additions. CSS verification still compiles real Tailwind/PostCSS utilities and checks semantic variables; unrelated source scanning is disabled, with no increased timeout or removed business assertion.

The production build uses a build-only HTTPS backend placeholder, without altering saved environment configuration. Real installation and authenticated backend CRUD are outside the mock browser checks. No live records, permissions, campaigns or email deliveries were changed by the audit.

Preview preferences were restored, the temporary tab and fixture servers were closed, and the isolated frontend copy and audit harness were removed. Only the implementation, regression tests and saved verification evidence remain.
