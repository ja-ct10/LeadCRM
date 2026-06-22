# Requirements Plan: LeadCRM Revisions for Camxian

## 1. Authentication & Account Access
- **OTP Verification**: Implement an OTP (One-Time Password) mechanism for email registration and login to ensure authenticity without manual steps.
- **Sandbox Access**: Add OTP verification for prospective clients requesting sandbox account access.
- **Automated Onboarding Info**: Automatically trigger account credentials or onboarding emails when new users are created by an administrator.

## 2. System Terminology & UI Consistency
- **Client Profiles**: Replace any occurrences of "Contacts" with "Client Profiles." This acts as the master record/database ("Bible") of all customer/company information.
- **Pipelines**: Represent streamlined business processes (sales inquiries, tech support, etc.). A pipeline is strictly for clients with *active* inquiries/opportunities.
- **Deals / Tickets**: Represents an active transaction, opportunity, or inquiry moving through pipeline stages.

## 3. Pipeline Structure Improvements
- Separate Deals and Pipelines clearly – a deal moves through the pipeline stages.
- Implement segmented pipelines for different business purposes:
  - Sales Inquiries
  - Technical Support
  - Project Implementation
  - After-Sales Concerns

## 4. Pipeline Stage Management
- Restrict or limit the number of stages (or provide a manageable default) per pipeline type to prevent overly complex workflows.

## 5. Client Profile Management
- **Filtering**: Add filtering functionality for Client Profiles, Leads, etc.
- **Default Views**: Ensure frequently used filters or important/prioritized records appear at the top.

## 6. Agent Assignment Improvements
- **Assigned Agent Tracking**: 
  - Allow assigning agents at the Client Profile level (who owns the relationship).
  - Allow assigning agents at the Deal/Ticket level (who handles the specific inquiry).
- **Assigned Agent Column**: Present an "Assigned Agent" column across relevant lists (Profiles, Deals).

## 7. Camxian Lead Status Definitions
Revise the status choices or definitions to match Camxian’s sales workflow:
- **Hot**: Highly likely to close this month, already billable/committed, confirmed timeline, ready to close.
- **Warm**: Responsive, still communicating, no confirmed timeline, decision pending.
- **Cold**: No response, no formal decline, opportunity remains open but inactive.
- **Cancelled**: Formally declined, opportunity will no longer proceed.
  
## 8. Client Database vs Pipeline Clarification
- Maintain a strict boundary between the "Bible" (Client Profiles) and active work (Pipelines).
- Only clients with active sales opportunities should populate Pipeline boards.

# Non-Functional Requirements

## Operational Requirements
REQ066: The system must provide concurrent access for 16 users who have authenticated and experience no performance degradation.
REQ067: All user activities that will cause data loss will require explicit confirmation in a modal dialog.
REQ068: There will be contextual help tooltips available for every form field and workflow feature.
REQ069: The system interface must provide keyboard navigation support for all interactive elements.
REQ070: All errors logged to the system will contain an anonymized user id, timestamp, action performed, error code, stack trace, etc.
REQ071: The PWA will function equally on Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge.
REQ072: The interface will be responsive to screen widths from 320 pixels up to 1920 pixels.
REQ073: Users will be able to export lead and contact data in CSV, JSON, and XLSX formats.
REQ074: The system will maintain a complete audit trail of every CRUD operation performed on lead records without being able to modify any of the underlying data.
REQ075: The System Administrator will have the ability to configure any of the new lead status types through the user interface, without requiring code changes.
REQ076: The system will have an integration with at least one third-party email service via API keys.
REQ077: The system will have an integration with at least one third-party SMS gateway provider via API keys.
REQ078: The system will be integrated with PayMongo using API keys for secure payment transactions.
REQ079: The system will perform automated database backups on a daily basis with a retention period of 30 days.
REQ080: The platform must allow for hot-deployment of non-breaking updates to the software without incurring full downtime of the environment.
REQ081: Core services must achieve at least 70% coverage on unit testing within the defined boundaries of the modular components of the system.
REQ082: An indicator will be displayed on the user interface to reflect real-time connection status to make identifying easier whether users are currently connected to the platform.
REQ083: When performing searches and/or filtering, all user query parameters must remain intact through subsequent navigation of pages within the user interface.
REQ084: All forms and input fields must be validated on the client-side (browser) prior to being submitted to the back-end of the platform.
REQ085: A loading spinner must be displayed for all operations that take longer than one second.
REQ086: Real-time progress indicators for batch message queues must be displayed during the dispatch of the messages.
REQ087: User-defined dashboard layout preferences will persist between browser sessions.
REQ088: Error messages must be specific and provide a means to correct an unsuccessful operation on the part of the user.
REQ089: All required fields must be validated against business rules prior to progressing from one stage to the next within the pipeline.
REQ090: During active editing of a draft lead entry in the system, each draft lead entry must be saved automatically to the database every 30 seconds.
REQ091: Deduplication of all requests to create leads will be handled by the system to prevent duplicate entries or records in the database.
REQ092: The CSV template for bulk importing leads must contain detailed validation feedback on each import into the system.
REQ093: Data synchronization status must be displayed to the user for all offline actions taken against the PWA’s offline queue.

## Performance Requirements
REQ094: The system shall accomplish data storage and update operations within two (2) seconds
REQ095: The system shall retrieve and display queried records within two (2) seconds or less.
REQ096: The system shall be able to handle at least fifty (50) concurrent users while maintaining a response time of two (2) seconds.
REQ097: Upon successful sign-in, the system shall fully retrieve and display all necessary data from the database within ten (10) seconds onto the dashboard.
REQ098: The system shall redirect to the user’s designated dashboard within five (5) upon successful sign-in and authentication.
REQ099: The system shall support at least one thousand (1,000) users per organization.
REQ100: Upon unexpected system failures, the system shall recover within thirty (30) seconds and draft unsaved changes.

## Security Requirements
REQ101: Users shall enforce RBAC to restrict access to company data based on the user’s assigned role and the user’s associated client organization.
REQ102: The system shall filter and display dashboard data that is associated to the user’s respective role and organization.
REQ103: In the event of an unexpected failure, all unsaved user changes shall be saved as a draft and prevent unintended data changes.
REQ104: The system shall require explicit user confirmation before performing permanent data modifications.
REQ105: The system shall require users to provide and use complex passwords, passwords with a length of 8 characters minimum, an upper and lower case letter, and at least one (1) numerical digit.
REQ106: The system shall require users to update their passwords every ninety (90) days to prevent long term access in the case that a password is compromised.
REQ107: The system shall prevent users from reusing previous passwords when performing password reset.
REQ108: The system shall lock access to the account for a minimum of five (5) minutes after five (5) consecutive failed login attempts.
REQ109: The system shall secure user passwords by using a hashing algorithm before storing within the database.
REQ110: The system shall hide user passwords via masking when attempting a login.

## Cultural and Political Requirements
REQ111: The system must follow the Data Privacy Act of 2012 (RA 10173) of the Philippines for all personal data processing.
REQ112: The system must provide support to international customers’ data in accordance with GDPR-compliant data subject rights for the handling of data of international customers.
REQ113: The system shall use English as its language.
REQ114: The system must properly format monetary values using the Philippine Peso (₱). As an option, the system will allow users to choose from other currencies in the client’s transactions.
REQ115: Date and time displayed in the system defaults to Asia/Manila time, but can also be converted to UTC.
REQ116: The system must allow for the formatting of phone numbers according to Philippine phone number standards, as well as providing phone number validation for numbers from other countries.
REQ117: At the time of user registration, the system must provide compliance notices as part of the user registration process, with regard to data consent in accordance with the laws of the home country and/or other applicable countries.
REQ118: Users must have the ability to export data subject access requests in a machine-readable format.
REQ119: The system will not retain unnecessary data such as biometric information, or sensitive government-issued identification unless there is a specific need for such data.
REQ120: The data retention policies shall allow for customers to have the company’s data permanently deleted by the client’s request in accordance with privacy legislation.
REQ121: The system will respect standard business hours in the Philippines but will allow for configuration and customization to allow the system to operate globally.
REQ122: The Bangko Sentral ng Pilipinas guidelines must also be adhered to when it comes to the electronic storage of records in accordance with all electronic transactions.
REQ123: The system will reflect the Philippine public holiday calendar and may also reflect public holidays in other countries.
REQ124: Audit logs will be stored with data residency options that are compliant with the Philippines local jurisdiction and within international cloud regions.
REQ125: Character sets will be able to accept local character sets related to customers for both name and address fields, utilizing UTF-8 international encoding.
REQ126: The date format should be displayed in a localized format consisting of MM/DD/YYYY, while providing an option to configure regional formats to specific regional settings.
REQ127: The system must provide cross-border data transfer safeguards in accordance with the National Privacy Commission advisory and corresponding international frameworks.
REQ128: The form should display phone numbers in accordance with the E.164 standard, with the default country code of the Philippines (+63).
REQ129: The system must provide disclaimer notices in relation to SMS communications in compliance with Philippine telco regulations.
REQ130: Data collection must follow data minimization principles under applicable laws and align with both Philippine and internationally recognized privacy standards.

## 9. System-Wide Module Review & Optimization Requirements
- **REQ131**: The system must enforce a Manual Status Lock on Client Profiles. Pipeline stage movements or Deal progressions must NEVER automatically change the relationship status (Hot, Warm, Cold, Cancelled, Closed) of the primary Client Profile record.
- **REQ132**: The system must provide 4 distinct pipelines, each with limited, streamlined stages (maximum 5 stages) to model diverse commercial flows: Sales Inquiries, Technical Support, Project Implementation, and After-Sales Concerns.
- **REQ133**: Client Profiles table must default to sorting "Hot" profiles directly at the top of the interface, ensuring prioritised agent follow-ups.
- **REQ134**: The system must support Individual and Organization customer records cleanly, with conditional inputs that toggle field visibility.
- **REQ135**: Modern Funnel Filter Bar must be implemented of visual pills/chips: clicking "(x)" removes the single filter parameter, and users can save these search configurations as Smart Views.
- **REQ136**: Audit trails must be detailed tabular lists, rendered in high-legibility monospace styling, tracking exact row record identifiers, user Emails, IP addresses, and previous vs. new values as Changesets.
- **REQ137**: Developer telemetry indicators (such as container loggers, port references, or server performance parameters) must be completely decoupled and removed from regular customer interfaces.
