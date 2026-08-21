# Requirements Document

## Introduction

This feature establishes a unified deal creation, linkage, and CRUD system across LeadCRM's CRM panels. Currently, deals created from Lead, Contact, or Account panels rely on fragile string-matching (`companyName`) for association filtering, and the frontend adapter does not properly map `leadId` to the backend's expected `leadIds` array format. This feature fixes the linkage plumbing, ensures a single canonical deal record is accessible from every relevant view, and improves the InlineDealForm UX for faster deal creation.

## Glossary

- **Deal_Record**: A single canonical deal row in PostgreSQL, uniquely identified by its UUID, belonging to one tenant
- **LeadDeal_Junction**: The many-to-many junction table (`LeadDeal`) that links leads to deals via FK references
- **CustomerDeal_Junction**: The many-to-many junction table (`CustomerDeal`) that links contacts/customers to deals
- **Deal_Adapter**: The frontend module (`deal.adapter.ts`) that transforms frontend deal shapes to/from backend DTO formats
- **InlineDealForm**: The compact form component rendered inline within record panels for quick deal creation
- **DataContext**: The central React state store that holds all business data and provides it to all consuming components
- **Record_Panel**: A slide-over panel (LeadPanel, ContactPanel, AccountPanel, DealPanel) that displays and manages a record's details
- **FK_Filtering**: Deal association resolution using direct foreign key fields (`leadId`, `organizationId`, `contactIds`) rather than string matching

## Requirements

### Requirement 1: Single Canonical Deal Record

**User Story:** As a CRM user, I want deals created from any panel to be stored as one record in the database, so that I never have duplicate deals across different views.

#### Acceptance Criteria

1. WHEN a deal is created from the LeadPanel, THE Deal_Adapter SHALL produce a single API request to `POST /api/v1/crm/deals` that creates exactly one Deal_Record in PostgreSQL.
2. WHEN a deal is created from the ContactPanel, THE Deal_Adapter SHALL produce a single API request to `POST /api/v1/crm/deals` that creates exactly one Deal_Record in PostgreSQL.
3. WHEN a deal is created from the AccountPanel, THE Deal_Adapter SHALL produce a single API request to `POST /api/v1/crm/deals` that creates exactly one Deal_Record in PostgreSQL.
4. THE Deal_Record SHALL contain the `tenantId` of the authenticated user and SHALL be scoped to that tenant for all subsequent queries.

### Requirement 2: Proper Lead-to-Deal Linkage

**User Story:** As a sales representative, I want deals created from a lead to be linked via the LeadDeal junction table, so that the relationship is properly tracked in the database.

#### Acceptance Criteria

1. WHEN a deal is created from the LeadPanel with a `leadId`, THE Deal_Adapter SHALL map the singular `leadId` to `leadIds: [leadId]` in the backend request payload.
2. WHEN the backend receives a `createDeal` request with a non-empty `leadIds` array, THE backend SHALL create corresponding LeadDeal_Junction records linking each lead to the new deal.
3. WHEN a deal is created from the LeadPanel and the lead has an associated `accountId`, THE Deal_Adapter SHALL include `organizationId` (mapped from the lead's `accountId`) in the backend request payload.
4. WHEN the backend returns the created deal, THE Deal_Adapter SHALL populate the frontend Deal type with `leadId` set to the first lead and `leadIds` set to the full array from the LeadDeal_Junction records.

### Requirement 3: Proper Contact-to-Deal Linkage

**User Story:** As a sales representative, I want deals created from a contact panel to be linked via the CustomerDeal junction table, so that contact-deal relationships are properly tracked.

#### Acceptance Criteria

1. WHEN a deal is created from the ContactPanel with a `contactId`, THE Deal_Adapter SHALL include `contactIds: [contactId]` in the backend request payload.
2. WHEN the backend receives a `createDeal` request with a non-empty `contactIds` array, THE backend SHALL create corresponding CustomerDeal_Junction records linking each contact to the new deal.
3. WHEN the backend returns the created deal, THE Deal_Adapter SHALL populate the frontend Deal type with `contactIds` extracted from the CustomerDeal_Junction relation.

### Requirement 4: Proper Account-to-Deal Linkage

**User Story:** As a sales representative, I want deals created from an account panel to be linked via the `organizationId` FK, so that account-deal relationships are based on stable identifiers.

#### Acceptance Criteria

1. WHEN a deal is created from the AccountPanel, THE Deal_Adapter SHALL include `organizationId` set to the account's ID in the backend request payload.
2. WHEN the backend returns the created deal, THE Deal_Adapter SHALL populate the frontend Deal type with `organizationId` from the deal's `accountId` field.

### Requirement 5: FK-Based Deal Filtering in Panels

**User Story:** As a CRM user, I want deal lists in each panel to be filtered using reliable foreign key relationships, so that deals are always correctly associated regardless of name changes.

#### Acceptance Criteria

1. WHEN the LeadPanel displays associated deals, THE LeadPanel SHALL filter deals where `deal.leadId === lead.id` OR `deal.leadIds` includes `lead.id` — without fallback to `companyName` string matching.
2. WHEN the ContactPanel displays associated deals, THE ContactPanel SHALL filter deals where `deal.contactIds` includes `contact.id` OR `deal.leadId === contact.id` — without fallback to `companyName` string matching.
3. WHEN the AccountPanel displays associated deals, THE AccountPanel SHALL filter deals where `deal.organizationId === account.id` — without fallback to `companyName` string matching.
4. IF a deal has no FK linkage to the current record, THEN THE Record_Panel SHALL exclude that deal from the associated deals list.

### Requirement 6: Cross-View Visibility via Shared State

**User Story:** As a CRM user, I want a deal I just created to appear immediately in the Deals module, pipeline board, and all related panels, so that I don't need to refresh the page.

#### Acceptance Criteria

1. WHEN a deal is successfully created from any Record_Panel, THE DataContext SHALL append the new Deal_Record to the global `deals` array within the same render cycle.
2. WHILE the DataContext `deals` array is updated, THE Deals module page, pipeline kanban board, and all open Record_Panels SHALL re-render to reflect the new deal without requiring a page refresh.
3. WHEN a deal is updated from any view (DealPanel, Deals module, pipeline board), THE DataContext SHALL replace the existing Deal_Record in the global `deals` array, and all consuming views SHALL reflect the change immediately.

### Requirement 7: Edit Deal from Any Panel

**User Story:** As a CRM user, I want to click a deal shown in LeadPanel, ContactPanel, or AccountPanel and have it open for full editing in the DealPanel, so that I can manage deals from wherever I encounter them.

#### Acceptance Criteria

1. WHEN a user clicks a deal listed in the LeadPanel, THE LeadPanel SHALL open the DealPanel with the full deal record loaded for editing.
2. WHEN a user clicks a deal listed in the ContactPanel, THE ContactPanel SHALL open the DealPanel with the full deal record loaded for editing.
3. WHEN a user clicks a deal listed in the AccountPanel, THE AccountPanel SHALL open the DealPanel with the full deal record loaded for editing.
4. WHEN the user saves changes in the DealPanel opened from another panel, THE DataContext SHALL update the deal, and THE originating panel's deal list SHALL reflect the changes immediately without closing or refreshing.

### Requirement 8: Backend DTO and Adapter Mapping

**User Story:** As a developer, I want the `toBackendCreateDeal` adapter to correctly transform all linkage fields, so that the backend receives properly formatted data for junction record creation.

#### Acceptance Criteria

1. WHEN `toBackendCreateDeal` receives a payload with `leadId` (singular string), THE Deal_Adapter SHALL output `leadIds: [leadId]` in the transformed backend DTO.
2. WHEN `toBackendCreateDeal` receives a payload with both `leadId` and existing `leadIds`, THE Deal_Adapter SHALL merge them into a deduplicated `leadIds` array.
3. WHEN `toBackendCreateDeal` receives a payload with `contactId` (singular string), THE Deal_Adapter SHALL output `contactIds: [contactId]` in the transformed backend DTO.
4. WHEN `toBackendCreateDeal` receives a payload with `organizationId` or `companyId`, THE Deal_Adapter SHALL output `organizationId` in the transformed backend DTO, preferring direct ID over name-based lookup.
5. THE Deal_Adapter SHALL never send `undefined` or `null` for `leadIds` or `contactIds` — instead omitting the field entirely if no IDs are present.

### Requirement 9: Frontend Deal Type Completeness

**User Story:** As a developer, I want the frontend Deal type to include all linkage fields populated from the backend response, so that panel filtering logic has reliable data to work with.

#### Acceptance Criteria

1. THE frontend Deal type SHALL include `leadId` (optional string) representing the direct FK to the primary lead.
2. THE frontend Deal type SHALL include `leadIds` (optional string array) representing all leads linked via LeadDeal_Junction.
3. THE frontend Deal type SHALL include `contactIds` (optional string array) representing all contacts linked via CustomerDeal_Junction.
4. THE frontend Deal type SHALL include `organizationId` (optional string) representing the FK to the linked account/organization.
5. WHEN `toFrontendDeal` maps a backend deal response, THE Deal_Adapter SHALL extract `leadIds` from `deal.leadDeals[].lead.id` and populate both `leadId` (first entry) and `leadIds` (full array).
6. WHEN `toFrontendDeal` maps a backend deal response, THE Deal_Adapter SHALL extract `contactIds` from `deal.customerDeals[].customer.id` and populate the `contactIds` array.

### Requirement 10: Improved InlineDealForm UX

**User Story:** As a sales representative, I want the inline deal creation form to be quick and intuitive with smart defaults, so that I can create deals without leaving the panel context.

#### Acceptance Criteria

1. THE InlineDealForm SHALL display a confidence slider (0–100%) with a default value of 50%.
2. THE InlineDealForm SHALL auto-select the first available pipeline and its first stage as defaults when no pipeline is pre-selected.
3. WHEN the user selects a pipeline, THE InlineDealForm SHALL update the stage dropdown to show only stages belonging to the selected pipeline.
4. THE InlineDealForm SHALL default the expected close date to 30 days from the current date.
5. THE InlineDealForm SHALL display a compact single-column layout that fits within the Record_Panel width without horizontal scrolling.
6. WHEN the form is submitted successfully, THE InlineDealForm SHALL clear all fields and collapse, displaying a success toast notification.
7. IF form validation fails, THEN THE InlineDealForm SHALL display field-level error messages below each invalid field without submitting to the backend.
