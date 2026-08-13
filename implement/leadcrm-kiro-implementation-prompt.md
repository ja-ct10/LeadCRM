# Kiro prompt — implement the redesigned LeadCRM frontend

Attach the `leadcrm-*.png` screenshots in this folder as the visual spec and copy them pixel-faithfully. Frontend only: keep the existing Next.js architecture, routes, TanStack Query hooks, API clients and domain types (`Lead`, `Contact`, `Organization`, `Deal`, `Pipeline`, `Stage`) exactly as they are. Replace presentation, not data flow.

## Reference screenshots
| File | What to copy |
| --- | --- |
| `leadcrm-01-leads-list-view.png` | Leads list view: shell, toolbar, filter rail, row anatomy |
| `leadcrm-02-contacts-list-view.png` | Contacts list view + activity flags |
| `leadcrm-03-accounts-list-view.png` | Accounts list view + KPI strip |
| `leadcrm-04-deals-kanban-view.png` | Deals kanban board + pipeline selector |
| `leadcrm-06-leads-view-switcher-menu.png` | View-switcher dropdown (Custom List View / Tile / Table…) |
| `leadcrm-07-leads-record-drawer.png` | Right-side record drawer with tabs |
| `leadcrm-08-deals-pipeline-settings-modal.png` | Pipeline configuration modal |
| `leadcrm-09-deals-table-view.png` | Dense table view |
| `leadcrm-10-deals-forecast-view.png` | Weighted forecast view |
| `leadcrm-11-contacts-tile-view.png` | Tile view cards |
| `leadcrm-12-contacts-grid-view.png` | Compact grid view |
| `leadcrm-13-leads-mobile.png` | Mobile layout |

## Design tokens (define once, use everywhere — no hardcoded colors)
- Brand blue `#2563EB` (hover `#1D4ED8`), primary action buttons and links.
- App sidebar: near-black `#0F172A` surface, white text, brand-tinted active row with a 3px left brand bar.
- Page canvas `#F6F8FB`; cards/surfaces white with `1px` border `#E4E9F0`, radius `12px`, shadow `0 1px 2px rgba(16,24,40,.06)`.
- Text: `#0F172A` primary, `#5A6B85` muted, uppercase 11.5px 600 tracking-wide section labels.
- Status tones as soft pill badges: success green, info blue, warn amber, danger red, purple/violet for nurturing & evaluator, neutral grey. Pills are `11.5–12px`, `600`, radius-full, with an optional 6px leading dot.
- Type: Inter Tight / Inter. Page title 28px 800, table cells 13px, secondary 11.5–12px, tabular-nums for all money and counts.
- Density: table rows 52px, 12px horizontal cell padding, hairline row dividers, sticky header row.

## App shell
Collapsible dark sidebar (Dashboard; CRM group: Leads, Contacts, Accounts, Customers, Deals with record-count badges; Workspace group: Operations, Marketing, Automation, Billing; System group: Administration, Settings), pinned user card + Collapse control at the bottom. Topbar: breadcrumb, centered global search with ⌘K hint, blue quick-create `+`, notifications with dot, settings, avatar. On mobile the sidebar becomes an overlay drawer with a hamburger.

## Module workspace (shared component, used by all four modules)
1. Header: title, one-line description, `Import` and a split primary button (`Create Lead` / `Create Contact` / `New Deal`) with a chevron for extra options.
2. Saved-view tabs: `All <Module>`, `My <Module>`, overflow `…`.
3. Toolbar: `Filter` toggle, `Sort`, segmented view switcher (List, Tile, Table, Kanban, Grid, plus Forecast on Deals) with a chevron menu listing the named views, refresh, module search box, manage-columns button.
4. Left filter rail (`Filter by`, close button, filter search): collapsible groups `System Defined Filters` (with counts), `Filter By Fields` (checkbox list), `Filter By Related Modules` (collapsed by default), footer `N records in this module`.
5. Content area per view:
   - **List** — full-width table, leading select-all/row checkboxes, avatar + name/subtitle primary cell, linked relationship cells in brand blue, status pills, right-aligned numeric columns, per-row hover actions menu, pink activity flag chips (task/call/meeting + date) pinned before the name, footer `Total records N` and pagination.
   - **Table** — same data, denser rows and every column visible with horizontal scroll.
   - **Tile** — 2–3 column cards with avatar, name, account, badges and a KPI footer.
   - **Grid** — 4-up compact cards.
   - **Kanban** — horizontally scrollable stage columns with colored dot, record count, probability, progress bar, draggable cards, `+ Add record` footer.
   - **Forecast** (Deals) — stage rows with value bars, deal count, probability and weighted totals.
6. Bulk-selection bar appears when rows are checked (count, clear selection, bulk actions).
7. Row/card click opens the record drawer.

## Record drawer
Right-side panel (~560px, full-width on mobile), animated in, closes on Escape/overlay click: avatar, eyebrow module label, name, subtitle with email/phone/close date, status/priority/probability badges, 4 KPI tiles, tabs `Overview` (two-column field grid), `Activity` (icon timeline: call/email/meeting/note/stage with who + when), `Related` (two related lists, e.g. contacts and deals, each row linking to its module), `Notes`/`Files`.

## Module specifics
- **Leads**: score column as a mini progress bar + number, status pills (New, Contacted, Nurturing, Qualified, Unqualified), source, est. value, owner; drawer has a `Convert Lead` action.
- **Contacts**: account name links to Accounts, customer type (Active Customer / Prospect / Evaluator), status, open deals, total value, activity flags.
- **Accounts**: KPI strip (accounts, pipeline value, open deals, avg deal size), industry, employees, revenue, owner; drawer lists related contacts and deals.
- **Deals**: pipeline selector dropdown with `Manage pipelines`, KPI strip (open pipeline, weighted forecast, won this period, at risk), rotting-deal flame icon, priority pills, pipeline settings modal with draggable stage rows (probability, rotting days, won/lost markers, add stage, create pipeline).

## Quality bar
Responsive from 360px up, keyboard focus rings on every interactive element, `aria-label`s on icon-only buttons, `role="dialog"` + `aria-modal` on modal/drawer, sr-friendly checkbox labels, truncation with `min-w-0` in every flex text container, no layout shift when the filter rail is toggled, skeleton rows for loading and an illustrated empty state per view.
