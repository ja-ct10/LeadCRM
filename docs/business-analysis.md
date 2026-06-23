# LeadCRM: Business Analysis & Architectural Blueprint
*Prepared by Senior SaaS CRM Product Architect & Lead Engineer*

---

## Part 1: Q&A Analysis & Identifying Missing Elements

Before writing code, we performed a thorough examination of the requirements from multiple system and compliance dimensions. Below is the multi-perspective analysis of the gaps identified between standard CRM offerings (Salesforce, HubSpot, Zoho, Pipedrive, Monday.com) and the stated business/operational mandates of LeadCRM.

### 1. Missing Requirements
- **Administrative Credentials Dispatch Flow**: When an administrator creates a user, the system must securely provision the initial login. There is a gap in defining whether this occurs via a temporary token, an auto-generated high-entropy password, or an administrative OTP initialization.
- **Support Ticket Entity & Lifecycle**: While Phase 3 designates "Support Tickets" for the System Admin side, there is currently no active representation of tickets, statuses, categories, or escalation levels in the data models.
- **PWA Off-grid Queue Reconciliation Protocol**: REQ095 and REQ075 mention offline-capabilities and data-sync displays, but do not detail collision-resolution strategies (e.g., what happens when there is a conflict in lead updates or assignments when returning online? Must implement Last-Write-Wins or Manual Merge).
- **Compliance & Sandbox Copying**: There are no specifications on how production configurations are replicated into sandboxes or if data obfuscation (masking) must occur to protect client privacy in sandbox models.

### 2. Missing Business Rules
- **Approved vs. Customer Status Transition**: 
  - Standard CRMs transition a lead to "Closed/Won" when a deal passes the final stage ("Approved" or "Contract Closed").
  - **Critical LeadCRM Business Rule**: To enforce the manual assignment rule ("the system must NEVER automatically determine lead status"), when a deal is approved:
    1. The system **MAY NOT** auto-upgrade the Lead status to "Customer".
    2. Instead, the interface displays a contextual recommendation modal guiding the authorized staff to *manually* promote the lead's status.
- **Stage Movement Integrity (Stage Validation Rules)**: REQ089 specifies that forms and fields must be validated before moving stages. The business must define exactly which attributes are mandatory for each stage (e.g., moving to "Quotation Sent" requires a non-zero estimation value and a completed quote record; moving to "Approved" requires a signed contract date).
- **Lead De-Duplication and Collision Detection**: REQ091 demands deduplication. We must define the collision keys (e.g., Exact match on Email, exact match on Phone, or phonetic matches on Company Name and Contact Person).
- **SaaS Subscription Hold Protocols**: If a tenant's subscription expires or lapses, what read-write constraints occur? (e.g., transition client to read-only sandbox mode, 14-day grace period, or complete lockout).

### 3. Missing User Roles
The current system operates on basic roles (System Admin, Client Admin, Sales Rep, Viewer, and Technician). To bridge the gap, we must declare and support:
- **Support Agent / Customer Success Manager (CSM)**: To manage support tickets, escalate service issues, and monitor SLA timers.
- **Dispatch Manager / Service Coordinator**: Responsible for scheduling technicians and tracking Service Orders.
- **Owner / Tenant Executive**: To perform billing integrations, modify subscription licenses, handle legal exports, and authorize DPA audits.

### 4. Missing Data Fields
To fulfill the compliance and structural requirements:
- **Tenant Management (RA 10173 and GDPR Enforcement)**:
  - `dpaConsentChecked` (boolean) & `dpaConsentTimestamp` (string)
  - `dataRetentionMonths` (number) & `scheduledDeletionDate` (string)
  - `preferredCurrency` (string, e.g., "PHP", "USD", "EUR")
- **Lead & Client Profile Entities**:
  - `industryType` (string) & `geographicRegion` (string) for CRM analytics.
  - `assignedAgentId` (string, owning relationship manager) vs. `assignedDealUserId` (string, specific deal handler).
  - `statusReason` (text) explaining why a lead was manually marked as 'Cancelled' or 'Cold'.
- **AuditLog Entity**:
  - `rowIdentifier` (string, matching the modified entry ID).
  - `changeset` (JSON, storing previous vs new values).
  - `ipAddress` & `userAgent` (string).

### 5. Missing CRM Processes
- **CSV Bulk Import Schema Validation**: A detailed schema validation framework mapping spreadsheet columns to DB structures with explicit row-by-row error logging (headers verification, enum mapping, phone number normalizing).
- **Archival & Purging Procedures**: To satisfy data minimization principles (RA 10173), a scheduled purging engine must identify records idle over the retention policy timeline and flag them for auto-deletion or export with notification prompts to the owner.

### 6. Missing Security Requirements
- **Rate Limiting Context**: Client-side throttle notifications and a back-end strategy for lockouts.
- **Complexity and Change Log Policy**: To support RES105, 106, 107, we must track the password history table (storing bcrypt hashes of prior entries to enforce non-reuse) and store a `passwordLastChanged` timestamp.
- **Data Protection Masking**: Sanitization rules to mask billing credentials and strip executable scripts in rich-text input boards (XSS defense).

### 7. Missing SaaS Requirements
- **Tenant Billing Tier Limits**: Features capping constraints per subscription plan:
  - *Starter*: 500 Client Profiles, 2 pipelines, 1 user.
  - *Professional*: 5,000 Client Profiles, 5 pipelines, 15 users.
  - *Enterprise*: Unlimited.
- **PayMongo Integration Gateway**: Callback URL handling and subscription state maps.

### 8. Missing Reporting Requirements
- **Pipeline Velocity Analytics**: Storing metrics for duration elapsed inside each stage for bottleneck diagnostic metrics.
- **Sales Conversion & Yield Reports**: Quantifying conversion rates from Lead -> Client Profile, and calculating pipeline performance relative to marketing campaigns.
- **DPA Audit Compliance Report**: Seamless on-demand generation and export of an unalterable tenant audit trace for regulatory inspection.

### 9. Missing Workflow Requirements
- **Inactivity Automation Triggers**: A scheduled worker tracking leads without active touches for 14 days and issuing follow-up indicators to agents.
- **Multi-channel Workflow Trees**: Branching conditions based on client response (e.g., IF client replies, trigger 'Acknowledge Email', ELSE trigger 'SMS Reminder' after 3 days).

### 10. Missing Notification Requirements
- **Bulk Queue Dispatch Progress Indicators**: Live UI tracking for campaign email/SMS batch delivery queues with error/success ratios.
- **SMS Consent Notices**: Mandatory disclaimer labels displayed to clients regarding SMS utility charges as required by PH telcos.

---

## Part 2: Critical Questions to Resolve Before Development
1. **Verification Channels**: Should the OTP mechanism support multi-channel dispatch (Email and SMS) or default to Email-based verification during the early rollouts?
2. **De-duplication Policy**: If a duplicate lead is caught on import or creation, should the system block the insert completely, or should it merge records with a visual match card?
3. **Sandbox Purging Timer**: What is the designated absolute lifetime for requested sandbox tenants? Can they upgrade automatically to production from the Admin Console?
4. **Technician Capabilities**: Can Field Technicians create additional Service Orders, or is dispatch purely top-down from Client Admins/Dispatchers?
5. **Regulatory Boundary**: To comply with BSP and NPC policies, must all audit trails be localized on hosting environments targeting specific regional zones (data residency restrictions)?
6. **Billing Grace Period**: How many calendar days should elapse between payment failure in PayMongo and full service lock or sandbox conversion?

---

# Part 3: System Blueprint & Specifications

## 1. Requirements Analysis
Our review maps functional expectations directly to ISO/IEC 25010 and local statutory compliance limits:
- **Portability & Compatibility**: Seamless performance on Apple Safari, Google Chrome, Mozilla Firefox, Microsoft Edge (PWA framework with offline service workers).
- **Operational Precision**: All write operations completed and confirmed in <2 seconds. Complete initial database load in under 10 seconds.
- **Functional Compliance**: Strict alignment with RA 10173 (Philippines DPA) and standard GDPR structures.

## 2. Functional Requirements
- **FR_AUTH_01**: User signup/login featuring secure Email OTP verification.
- **FR_AUTH_02**: Auto-notification/credential provisioning to admin-created users.
- **FR_LEAD_01**: Manual Status updates with specialized dropdown confirmations.
- **FR_LEAD_02**: Direct assignment of Agents on Client Profiles separately from pipeline Deals.
- **FR_LEAD_03**: Lead sorting forcing active "Hot" leads to persist at the top of boards.
- **FR_LEAD_04**: Advanced, multi-criteria filtration spanning Stage, Source, Status, Agent, Location, Industry, and Date ranges.
- **FR_PIPE_01**: Split Boards for Sales, Project Implementation, Tech Support, and After-Sales concerns.
- **FR_PIPE_02**: Stage configuration & boundary validation preventing improper stage progression.
- **FR_WORK_01**: Visual Builder dragging triggers and creating delay chains.
- **FR_BILL_01**: PayMongo interface parsing billing logs, plans, and subscription states.

## 3. Non-Functional Requirements
- **NFR_SEC_01**: Row-Level Security verifying all user queries use `tenantId` parameters.
- **NFR_SEC_02**: Rate limiter capping authentication attempts at 5 tries within a rolling 5-minute window.
- **NFR_SEC_03**: Password compliance enforcing minimum 8 characters, casing check, a numeral, and 90-day expiry tracker.
- **NFR_PERF_01**: Response latency <2000ms for heavy list operations using indexes.
- **NFR_USAB_01**: Accessible color contrasts complying with WCAG guidelines.

## 4. User Stories
1. **As a Lead CRM Agent**, I want to manually specify the lead category status (Hot, Warm, Cold) so that I can apply human judgment to customer situations.
2. **As an Admin**, I want to view system metrics and sandbox environments from an administrative console so that I can monitor client setups and database safety.
3. **As a Technical Support Specialist**, I want a dedicated pipeline board for technical tracking so that client problems do not clutter active sales routes.
4. **As an Organization Owner**, I want billing notifications tied to our PayMongo gateway status so that license management is completely automated.

## 5. Database Schema (TypeScript-based conceptual model)
```typescript
interface DB_Tenants {
  id: string; // Tenant isolation key
  name: string;
  planType: 'Starter' | 'Professional' | 'Enterprise';
  status: 'active' | 'suspended' | 'pending';
  sandboxMode: boolean;
  timezone: string; // Defaults to "Asia/Manila"
  currency: string; // Defaults to "PHP"
  dpaConsentChecked: boolean;
  dpaConsentTimestamp: string;
  createdAt: string;
}

interface DB_Users {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'System Admin' | 'Client Admin' | 'Sales Rep' | 'Dispatcher' | 'Technician' | 'Viewer';
  status: 'active' | 'pending' | 'inactive';
  passwordLastChanged: string;
  failedLoginAttempts: number;
  lockoutExpiry?: string;
  priorPasswords: string[]; // History to block reuse
}

interface DB_ClientProfiles { // Formerly Contacts (Master "Bible")
  id: string;
  tenantId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  industry: string;
  location: string;
  assignedAgentId: string; // Owner of Client relationship
  leadSource: string;
  status: 'Hot' | 'Warm' | 'Cold' | 'Customer' | 'Cancelled'; // Manual Only
  statusModifiedAt: string;
  statusModifiedBy: string; // Agent ID
  createdAt: string;
  updatedAt: string;
}

interface DB_Pipelines {
  id: string;
  tenantId: string;
  purpose: 'Sales' | 'TechSupport' | 'Implementation' | 'AfterSales';
  name: string;
}

interface DB_Stages {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
}

interface DB_Deals { // Active opportunities moving on pipeline stages
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  companyName: string;
  contactPerson: string;
  value: number;
  priority: 'Low' | 'Medium' | 'High';
  assignedUserId: string; // Action Officer
  expectedCloseDate: string;
  dpaCleared: boolean;
  createdAt: string;
}
```

## 6. API Design (Mock endpoints for front-to-back contract validation)
- `/api/auth/request-otp` (`POST`): Prepares and sends random 6-digit numeric login codes.
- `/api/auth/verify-otp` (`POST`): Asserts verify code, issues auth cookie/token, tracks lockout indexes on failure.
- `/api/profiles` (`GET`): Returns filtered, sorted Client Profiles. Sort rules automatically bubble `Hot` profiles to the top.
- `/api/profiles/:id/status` (`PATCH`): Explicit human status updates. Blocks automatic alterations.
- `/api/deals/:id/stage` (`PATCH`): Moves pipeline deals. Evaluates pre-transition required field rules.
- `/api/billing/paymongo/webhook` (`POST`): Monitors subscription status from PayMongo core gateways.

## 7. UI Design Style Sheet
- **Typography**: Inter (Sans-serif) for system utilities; Space Grotesk for dynamic panels; JetBrains Mono for audit trails.
- **Accents**: High-contrast Slate palette with clear, custom background depths.
- **Human Touch Elements**: Distinctive confirmation steps, detailed tooltips, and non-intrusive status flags. No excessive telemetry clutter or faux command-line loggers.

## 8. Security Design
- **RBAC**: Handled programmatically checking current user role scopes.
- **XSS & Injection Protection**: Strictly escapes form text fields.
- **CSRF**: Authenticated routes protected via custom token headers.

## 9. SaaS Architecture
- **Tenant Isolation**: Handled via global scoping wrapper `useData().leads.filter(l => l.tenantId === user.tenantId)`.
- **Sandbox Container**: Completely dynamic database contexts isolated via environment switches.

## 10. Sequential Implementation Plan
- **Phase A**: Auth OTP upgrades & Multi-pipeline layouts integration (Technical Support, Implementation, After-Sales).
- **Phase B**: Core conversion of Contacts database to "Client Profiles" with human manual status locks.
- **Phase C**: Comprehensive funnel filtration panel (9-tier parameters matching tables/kanbans).
- **Phase D**: Admin Console enhancements including PayMongo, environmental graphs, and support ticket panels.
- **Phase E**: Audit Logging validation, PWA state checks, and general verification via lint-build processes.
