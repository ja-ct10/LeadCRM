# Architecture Selection: manage-columns-persistence

## Recommended Architecture: Layered Service (LeadCRM Standard)

### Rationale
The Layered Service architecture (Route → Controller → Service → Repository + Column Registry) achieves the lowest cross-cutting requirement percentage (11%) and zero synchronous cycles, directly aligning with LeadCRM's existing backend contracts and frontend DataContext patterns. Its clear separation of validation (Column Registry), business logic (Service), and persistence (Repository) keeps invariant enforcement localized — each invariant is owned by exactly one component. The primary trade-off is that the Service layer concentrates orchestration responsibility (god object score: 38%), but this is acceptable for a preference subsystem with bounded complexity and matches how every other LeadCRM module is structured.

### Components
| Component | Owned State | Responsibility |
|-----------|-------------|----------------|
| Preferences Route | None | URL registration, middleware chain (authenticate, rbac, validate) |
| Preferences Controller | None | HTTP request parsing, response formatting, delegation to Service |
| Preferences Service | Resolution cache (in-memory, per-request) | Business rule orchestration: resolution hierarchy, reconciliation, audit delegation, required column enforcement |
| Preferences Repository | Database connection context | CRUD operations on UserPreference and TenantPreference tables with mandatory tenantId scoping |
| Column Registry | Static column definitions (per-module) | Source of truth for available columns, required flags, default visibility/order, module validation |
| Zod Validation | None | Schema-level input validation (format, size, duplicates) before Controller logic |
| AuditLog Service | None (writes to AuditLog table) | Persists audit entries for admin-level preference changes |
| DataContext (Frontend) | Cached effectiveColumns, optimistic state | Frontend state management: cache, optimistic updates, rollback on failure |
| Manage Columns Drawer | Local draft state | UI for column reorder/toggle/search, batches changes into single save |
| useColumnPreferences Hook | Loading/saving/error state | Orchestrates API calls, retry logic, connects Drawer to DataContext |
| Preferences API Service (Frontend) | None | HTTP client layer for preference endpoints |

### Information Flow
| From \ To | Route | Controller | Service | Repository | Registry | Zod | AuditLog | DataContext | Drawer | Hook | FE API Svc |
|-----------|-------|------------|---------|------------|----------|-----|----------|-------------|--------|------|------------|
| Route | — | → | | | | → | | | | | |
| Controller | | — | → | | | | | | | | |
| Service | | | — | → | → | | → | | | | |
| Repository | | | ← | — | | | | | | | |
| Registry | | | ← | | — | | | | | | |
| Zod | | ← | | | | — | | | | | |
| AuditLog | | | ← | | | | — | | | | |
| DataContext | | | | | | | | — | ← | ← | |
| Drawer | | | | | | | | | — | → | |
| Hook | | | | | | | | → | ← | — | → |
| FE API Svc | | | | | | | | | | ← | — |

Legend: → = calls/depends on, ← = returns to/callback

### Requirement Allocation
| Requirement | Component(s) |
|-------------|--------------|
| REQ-1 (Resolution Hierarchy) | Preferences Service |
| REQ-2 (Server-Side Persistence) | Preferences Repository, Preferences Service |
| REQ-3 (User Preference CRUD) | Preferences Controller, Preferences Service, Preferences Repository |
| REQ-4 (Tenant Default Management) | Preferences Controller, Preferences Service, Preferences Repository |
| REQ-5 (Required Columns Enforcement) | Column Registry, Preferences Service, Manage Columns Drawer |
| REQ-6 (Column Registry) | Column Registry, Preferences Service |
| REQ-7 (Multi-Tenant Isolation) | Preferences Repository, Route (authenticate middleware) |
| REQ-8 (Manage Columns Drawer UI) | Manage Columns Drawer |
| REQ-9 (Save Behavior / Optimistic Updates) | DataContext, useColumnPreferences Hook, Manage Columns Drawer |
| REQ-10 (Reset Behavior) | DataContext, useColumnPreferences Hook, Preferences Service |
| REQ-11 (Database Schema / Migration) | Preferences Repository (Prisma schema) |
| REQ-12 (Audit Trail) | Preferences Service, AuditLog Service |
| REQ-13 (Performance / Caching) | DataContext, Preferences Service |
| REQ-14 (Module-Wide Extensibility) | Column Registry, Preferences Repository, Manage Columns Drawer |
| REQ-15 (Input Validation) | Zod Validation, Preferences Service, Column Registry |
| REQ-16 (Backward Compatibility) | Preferences Service, DataContext |
| REQ-17 (Responsive Table Rendering) | Leads Table (frontend), DataContext |
| REQ-18 (System-Wide Persistence & Attribution) | Preferences Repository, Preferences Service, AuditLog Service |

### Key Design-Induced Invariants
1. **Single-writer per layer**: Only the Repository writes to database; Service never bypasses Repository for persistence — ensures all tenant scoping passes through one enforcement point.
2. **Registry immutability at runtime**: Column Registry is a static read-only definition — no component can mutate it, preventing runtime drift between validation rules and defaults.
3. **Controller statelessness**: Controllers hold no request state between calls — prevents stale tenant context or leaked user state across requests.
4. **Unidirectional backend flow**: Information flows strictly Route → Controller → Service → Repository with no reverse calls — eliminates circular dependencies and makes the call graph acyclic.
5. **Frontend cache subordination**: DataContext always overwrites cached state with server responses — prevents split-brain between client and server state.
6. **Audit is fire-and-forget**: AuditLog failure does not block preference mutations — preference operations complete independently of audit persistence.

### Alternatives Considered
| Candidate | Strength | Weakness | Why Not Selected |
|-----------|----------|----------|-----------------|
| Use-Case-Oriented (Handler per operation) | Maximum cohesion per use case; each handler owns its full vertical slice; easy to test in isolation | Shared persistence adapter creates hidden coupling; 5 handlers duplicating registry validation logic increases surface area for inconsistency; diverges entirely from existing LeadCRM module structure | Higher cross-cutting invariant % (25%), requires new architectural pattern unfamiliar to team, duplicated validation logic across handlers |
| Event-Sourced Preference Store | Full audit trail is automatic (event log = history); supports time-travel and replay; clean CQRS read/write separation | Massive over-engineering for a preference system; introduces event store infrastructure not used anywhere in LeadCRM; projector adds latency and complexity; team has zero event-sourcing experience | Highest flow density (0.36), introduces infrastructure debt, 4× complexity for equivalent functionality, zero alignment with existing patterns |

### Metrics Summary
| Metric | Layered Service (Selected) | Use-Case-Oriented | Event-Sourced |
|--------|---------------------------|-------------------|---------------|
| Cross-cutting reqs % | 11% (2/18: REQ-5, REQ-15) | 22% (4/18: REQ-5, REQ-7, REQ-15, REQ-18) | 17% (3/18: REQ-5, REQ-7, REQ-15) |
| Cross-cutting invariants % | 17% (1/6: cache subordination) | 25% (2/8: tenant scoping, validation consistency) | 20% (2/10: projection consistency, tenant scoping) |
| Flow density | 0.18 (20 edges / 110 possible for 11 nodes) | 0.24 (15 edges / 62 possible for 8+1 nodes) | 0.36 (25 edges / 72 possible for 9+1 nodes) |
| God object score | 38% (Service owns resolution + reconciliation + audit orchestration) | 28% (Persistence Adapter owns all DB state) | 30% (Projector owns read-model state) |
| Sync cycles | 0 | 0 | 0 |
| Max fan-in | 3 (Service: called by Controller, receives from Repository, Registry) | 5 (Persistence Adapter: called by all handlers) | 4 (Event Store: written by all command handlers) |
| Max fan-out | 3 (Service: calls Repository, Registry, AuditLog) | 2 (each Handler: calls Adapter + Registry) | 3 (Command Handler: calls Event Store, Registry, Validator) |
| Evolvability cost | 1.3 (avg components changed per new REQ) | 2.1 (handler + adapter + shared validation) | 2.8 (command + event + projector + read model) |
