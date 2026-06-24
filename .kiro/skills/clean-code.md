---
name: clean-code
description: Clean code practices for LeadCRM — naming, functions, DRY, TypeScript safety, React patterns, error handling, and file size rules. Activate alongside coding-standards for all code work.
---

# Clean Code — LeadCRM

> Applied to every file. No exceptions.

---

## 1. Meaningful Naming

- Use clear, descriptive names that explain intent immediately
- Bad: `x`, `temp`, `data`, `val`, `res`, `cb`, `d`, `e`
- Good: `userCount`, `filteredContacts`, `selectedOrganizationId`, `isFormSubmitting`
- Booleans: always `is`, `has`, `can`, `should` — `isOpen`, `hasError`, `canEdit`
- Functions: verb phrases — `getFilteredDeals()`, `handleContactSave()`, `validateEmailField()`
- Components: nouns — `ContactFormSheet`, `SectionHeader`, `TrelloFilter`
- Event handlers: `handle` prefix — `handleSubmit`, `handleFilterChange`, `handleModalClose`

---

## 2. Small, Focused Functions — One Responsibility

- One function = one job. **Maximum 40 lines. Refactor required at 40+.**
- If a function needs a comment to explain what it does → extract it into a named function
- If a name contains "and" → split it

```typescript
// BAD — does too many things
async function handleSaveAndNotifyAndAudit() { ... }

// GOOD — one job each
async function handleSave() {
  if (!validateForm()) return;
  const payload = buildContactPayload(formData);
  await saveContact(payload);
  toast.success('Contact saved');
}
```

---

## 3. Avoid Code Duplication — DRY

- Same logic more than twice → extract to shared util, hook, or service
- Use `src/lib/utils.ts` for shared helpers
- Never copy-paste JSX blocks → extract into a named component

---

## 4. Readable, Self-Documenting Code

- Code explains itself — no comments for *what*, only *why*
- Named constants over magic values:

```typescript
// BAD
if (contacts.length > 250) showWarning();

// GOOD
const FREE_PLAN_CONTACT_LIMIT = 250;
if (contacts.length > FREE_PLAN_CONTACT_LIMIT) showWarning();
```

---

## 5. TypeScript — Type Safety First

- Never use `any` — prefer explicit types, generics, or `unknown`
- Enable strict mode in `tsconfig.json` — never disable it
- Use discriminated unions over boolean flag combinations
- Always define shared domain types in `store/types/` (or `@leadcrm/shared` for new code)

```typescript
// BAD
const status: any = getStatus();

// GOOD
type LeadStatus = 'Hot' | 'Cold' | 'Warm' | 'Closed' | 'Cancelled';
const status: LeadStatus = getStatus();

// BAD — untyped error
} catch (error: any) { toast.error(error.message); }

// GOOD
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error(message);
}
```

---

## 6. React — Component and State Patterns

- Keep components pure — same props = same output
- Derive state; never duplicate it:

```typescript
// BAD — count must be kept in sync manually
const [contacts, setContacts] = useState(data);
const [count, setCount] = useState(data.length);

// GOOD — derived from source of truth
const [contacts, setContacts] = useState(data);
const count = contacts.length;
```

- Use custom hooks to extract reusable stateful logic out of components
- Never place Context arrays (`contacts`, `deals`) in `useEffect` dependency arrays — infinite loop risk
- Never use index as a React key for mutable lists
- Never use `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`

---

## 7. Avoid Deep Nesting — Early Returns

```typescript
// BAD — 3+ levels of nesting
function processContact(contact) {
  if (contact) {
    if (contact.status === 'Hot') {
      if (contact.assignedUserId) {
        notifyAgent(contact.assignedUserId);
      }
    }
  }
}

// GOOD — flat, readable
function processContact(contact) {
  if (!contact) return;
  if (contact.status !== 'Hot') return;
  if (!contact.assignedUserId) return;
  notifyAgent(contact.assignedUserId);
}
```

---

## 8. Error Handling

- Never ignore errors silently — `catch (e) {}` is forbidden
- Use meaningful messages: `'Failed to save contact — please try again'` not `'Error'`
- Wrap all async operations in `try/catch`
- Validate before executing; fail fast with a clear message

```typescript
// BAD
try { await saveContact(data); } catch (e) {}

// GOOD
try {
  await saveContact(data);
  toast.success('Contact saved successfully');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to save contact';
  toast.error(message);
}
```

---

## 9. Component Responsibility

- One component = one purpose
- Never mix data-fetching, business logic, and rendering in the same component
- Split into: **Page** (orchestrator) → **Hook** (logic) → **Component** (render)
- Components over 250 lines → split. Pages over 200 lines → extract hooks and sub-components.

---

## 10. File Size Limits

| File Type | Limit | Action if exceeded |
|---|---|---|
| React Page | 200 lines | Extract hooks and sub-components |
| React Component | 250 lines | Split into smaller focused components |
| Custom Hook | 150 lines | Extract secondary logic into a second hook |
| Frontend Service | 200 lines | Split by concern |
| Backend Controller | 100 lines | Logic belongs in service, not controller |
| Backend Service | 250 lines | Extract helpers or split by sub-domain |
| Backend Repository | 150 lines | Split by query group |
| **Any Function** | **40 lines** | **Refactor required — no exceptions** |

Files over the hard limit **must be split before adding new features**. Never extend an oversized file.

---

## 11. Module Structure — The 30-Second Rule

Any developer should locate a feature, understand its purpose, and identify where changes belong within 30 seconds. If a folder requires explanation, it is too complex.

**Every frontend module follows this anatomy:**
```
contacts/
├── ui/           ← components only, no logic
├── hooks/        ← all stateful logic
├── services/     ← all API calls (contacts.service.ts)
├── schemas/      ← Zod validation
├── types/        ← module-local types
├── constants/    ← module-level constants
└── index.ts      ← barrel export
```

**Portal separation (non-negotiable):**
- `client-admin/` code never imports from `system-admin/`
- `system-admin/` code never imports from `client-admin/`
- Shared UI only → `src/shared/`

---

## 12. Project Architecture Rules

The valid data flow is always:
```
Page → Hook → DataContext → (Future API)
```

- Never call `localStorage` inside components or hooks
- Never write business rules inside JSX
- DataContext is the only gateway to data — always

When the backend is ready, only DataContext internals change. Zero component rewrites. This is the Dependency Inversion Principle applied to the data layer.

---

## 13. Simplicity First — Delete Aggressively

- The best code is often no code
- Delete unused variables, imports, functions, and dead code as you encounter it
- Don't over-engineer — build what is needed now
- Prefer boring, readable solutions over clever ones

---

## 14. Refactor Regularly — Boy Scout Rule

- Leave every file cleaner than you found it
- If renaming — rename everywhere (use semantic rename tools, not find-and-replace)
- Delete dead code on every touch — don't accumulate it

---

## 15. Version Control — Commit Discipline

- Commit message format: `type(scope): description` — e.g. `feat(contacts): add country filter`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `security`
- Commit in logical, self-contained units — one concern per commit
- Never commit broken code to `main` or `dev-copy-1`

---

## Quick Checklist Before Every Commit

- [ ] No `any` types
- [ ] No `console.log`
- [ ] No functions over 40 lines
- [ ] No function doing more than one job (no "and" in the name)
- [ ] No files over hard limit without split
- [ ] No magic numbers/strings — use named constants
- [ ] No deep nesting — early returns used
- [ ] No silent `catch` blocks
- [ ] No unused imports or dead code
- [ ] No copy-pasted JSX — extracted to component
- [ ] No `any` types in catch blocks
- [ ] Commit message follows `type(scope): description`
