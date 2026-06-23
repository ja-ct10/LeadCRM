# Design Document: LeadCRM Revisions for Camxian

## 1. OTP Verification Flow (AuthPage & AuthContext)
- In `AuthPage.tsx`, transition the basic login and registration to require OTP.
- **Login Flow**: Input email -> "Send OTP" -> user enters OTP (e.g. `123456` in mock) -> Submit -> Login.
- **Registration Flow**: In Step 5 (or a new verification step), send an OTP to the provided admin email, require input to proceed.
- Add OTP state (`otpSent`, `otpValue`, `enteredOtp`) to `AuthPage.tsx`.

## 2. Terminology Updates
- **Client Profiles**: Update `src/pages/LeadsPage.tsx`:
  - Page title: "Contacts" -> "Client Profiles".
  - Search placeholder: "Search contacts..." -> "Search client profiles...".
  - "Add Contact" -> "Add Profile".
  - Refurbish table columns to match terminology.
- **Global Occurrences**: Ensure sidebar/nav refers to "Client Profiles" instead of "Contacts" or "Leads". Update `src/components/Layout.tsx` and `src/components/CommandPalette.tsx` mappings.

## 3. Pipeline Separation (MockData & Types)
- **Pipelines**: We will create 4 default pipelines in `src/store/mockData.ts` (if applicable) or default context state:
  - Sales Inquiries
  - Technical Support
  - Project Implementation
  - After-Sales Concerns
- **Stages limit**: Limit stages to standard, streamlined steps per pipeline. For example, Sales: `[Discovery, Assessment, Proposal, Negotiation, Closed]`.

## 4. Agent Assignment
- `LeadsPage.tsx` handles "Client Profile" assignment context. We ensure there is an "Assigned Agent" dropdown.
- Make Deals/Tickets have their own independent "Assigned Agent" dropdown in explicit Deal views or Tickets.
- Both refer to users with role "Sales Rep" or applicable agent roles.

## 5. Client Profile Filtering
- Add an explicit sorting dropdown or prioritized view in `LeadsPage.tsx` to keep "Frequently used filters or important records top default". Can default to prioritize `Hot` status profiles.

## 6. Lead Status Refinement
- Update tooltips or UI labels for statuses in `LeadsPage.tsx`:
  - **Hot**: "Qualified (Hot) - Already billable, confirmed timeline"
  - **Warm**: "Qualified (Warm) - Still communicating, no timeline"
  - **Cold**: "Lead (Cold) - No response, open opportunity"
  - **Cancelled**: "Cancelled - Formally declined"
  - **Closed**: "Customer - Closed opportunity"

## 7. System-Wide Visual & Functional Architecture Design
- **Dashboard Refinement**: Modern, compact dashboard widgets displaying performance indexes in **PHP (₱)**. Custom setups are persisted automatically via the browser's persistent key-value configuration states.
- **Master Client Profiles (Bible) View**: Conditional fields are implemented in the Profile sheets to split inputs cleanly between **Individual** and **Organization** customers. "Hot" profiles are pre-sorted at the head of lists. Relationship statuses are protected by a manual status change confirmation window.
- **Streamlined Multi-Pipeline Boards**: Implement separate swimlane visual paths for *Sales Inquiries*, *Technical Support*, *Project Implementation*, and *After-Sales Concerns*, limited to a maximum of 5 stages. Moving deals through stages triggers backend constraints checking for obligatory data parameters.
- **Funnel Filter Bar with Removable Active Chips**: Create an elegant horizontal bar with removable pills representing active filter combinations: `[Status: Warm] (x)` | `[Source: Google] (x)`. Support saving active setups as Smart Views.
- **Tabular Monospace Change Audit Log**: Audit logs are rendered using **JetBrains Mono** displaying a clean table of: Timestamp, Operator, Action, Target ID, IP Address, and Changeset previous/new value trees.
- **Decoupled Telemetry**: All raw engineering diagnostic metrics are removed from the client interfaces to support high visual fidelity.
