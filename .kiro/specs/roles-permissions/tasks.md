# Implementation Plan: Roles & Permissions Module (RBAC_Module)

> **STATUS: IN PROGRESS.** P1 security gap + P2 UI feature.
> Implementing in two phases: Phase A (security-critical backend) first, Phase B (full UI) separately.
> Re-verify current code before each task.

## Phase A — Backend Security & Seeding (P1 — implements Requirements 1, 12 core, escalation guard)

- [x] A1. Rewrite `rbac.middleware.ts` — live `RolePermission` DB reads replace `DEFAULT_ROLE_PERMISSIONS`
  - Bypass super roles; derive module+flag from `PermissionKey`; query `UserRole` → `RolePermission`;
    OR across all user roles; deny with 403 `{ success:false, error:"Access denied" }` (never leak permission key);
    WARN log for unrecognized roles; retain `DEFAULT_ROLE_PERMISSIONS` for seeding reference only.
  - _Requirements: 1.1–1.7_

- [x] A2. Add `getUserPermissions` repo function + service method + route endpoint
  - `GET /api/v1/administration/users/:id/permissions` — returns `ResolvedPermissions` map for AuthContext.
  - `findUserEffectivePermissions(userId, tenantId)` joins UserRole → RolePermission, ORs flags per module.
  - Super roles return full-access map.
  - _Requirements: 13.2_

- [x] A3. Seed `RolePermission` rows for system roles + block reserved names
  - Create `backend/src/database/seeders/system-roles.seed.ts` — idempotent upsert of Client Admin,
    Sales Representative, Viewer RoleDefinitions + RolePermission rows per design.md permission tables.
  - Call `seedSystemRoles` from `demo.seed.ts`, `tenant-generator.ts`, and registration path in `auth.service.ts`.
  - In `roles.service.createRole`: reject reserved names (case-insensitive).
  - _Requirements: 12.1–12.5, 4.4_

- [x] A4. Backend lint + tests pass
  - `tsc --noEmit` clean; `vitest --run` 163/163 baseline preserved.

## Phase B — Full UI Module (P2 — implements Requirements 2–11, 13–19)

> Phase B is a substantial UI implementation. To be tackled as a separate Kiro Spec session.

- [x] B1. Backend completions: `roles.repository.ts` additions (`findUserEffectivePermissions`,
    `upsertPermissions`, `findRoleById` with users+permissions includes, `findRoleByName`,
    `countActiveUserRoles`); `roles.service.ts` additions (system-role guards, name uniqueness,
    archive-with-users guard, escalation prevention); update `roles.dto.ts` to Zod schemas from design.md.
  - _Requirements: 2–6, 9, 11, 14, 15_

- [x] B2. Route additions: `GET /roles`, `GET /roles/:id`, `POST /roles`, `PUT /roles/:id`,
    `PATCH /roles/:id/archive`, `POST /roles/assign`, `DELETE /roles/unassign`, `GET /permissions`
    — all with full middleware chain.
  - _Requirements: 2.1–2.5, 3.1–3.4, 4.1–4.8, 5.1–5.6, 6.1–6.6, 7.1–7.7, 9.1–9.7_

- [x] B3. Frontend `AuthContext.tsx` — add `permissions` state, `userCan()` helper,
    `refreshPermissions()`, fetch on session restore via `GET /users/:id/permissions`.
  - _Requirements: 13.1–13.7_

- [x] B4. Frontend types + shared constants:
    `frontend/src/store/types/roles.types.ts`, `shared/src/constants/permission-modules.ts`,
    `shared/src/constants/role-templates.ts`.
  - _Requirements: 7.6, 8.1–8.5_

- [x] B5. Roles feature module UI:
    `roles-page.tsx`, `roles-tab.tsx`, `role-card.tsx`, `role-builder-modal.tsx`,
    `permission-matrix.tsx`, `permissions-tab.tsx`, `role-detail-drawer.tsx`,
    `role-users-panel.tsx`; hooks (`use-roles.ts`); service (`roles.service.ts`);
    App Router shell `app/(tenant)/administration/roles/page.tsx`.
  - _Requirements: 2.6–2.9, 3.3–3.4, 4.6–4.8, 5.5–5.6, 6.5–6.6, 7.2–7.7, 8.1–8.5, 13.3–13.5, 17–18_

- [x] B6. Phase B lint + tests + smoke.
