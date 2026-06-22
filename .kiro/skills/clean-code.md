---
name: clean-code
description: Clean Code best practices for LeadCRM — auto-applied alongside coding-standards on ALL code written in this project. Covers naming, functions, structure, security, architecture, and refactoring principles.
---

# Clean Code Best Practices

> These rules apply to every file in this project — TypeScript, React components, utilities, hooks, and future backend code.

---

## 1. Meaningful Naming

- Use clear, descriptive names that explain intent immediately
- Bad: `x`, `temp`, `data`, `val`, `res`
- Good: `userCount`, `filteredContacts`, `selectedOrganizationId`, `isFormSubmitting`
- Booleans: always start with `is`, `has`, `can`, `should` — e.g. `isOpen`, `hasError`, `canEdit`
- Functions: use verb phrases — `getFilteredDeals()`, `handleContactSave()`, `validateEmailField()`
- Components: use nouns — `ContactFormSheet`, `SectionHeader`, `TrelloFilter`

## 2. Small Functions — One Responsibility

- One function = one job
- Ideal length: 5–20 lines (longer is acceptable when logic is genuinely complex)
- If a function needs a comment to explain what it does, it should be a separate named function
- Extract repeated logic into named helpers rather than inlining it multiple times

```typescript
// BAD — does too many things
function handleSave() {
  validateForm(); buildPayload(); callApi(); showToast(); navigate();
}

// GOOD — each step is named and separated
function handleSave() {
  if (!validateForm()) return;
  const payload = buildContactPayload(formData);
  await saveContact(payload);
  toast.success('Contact saved');
}
```

## 3. Avoid Code Duplication — DRY

- If the same logic appears more than twice, extract it into a shared function, hook, or utility
- In this project: use `src/lib/utils.ts` for shared helpers, create custom hooks for shared state logic
- Never copy-paste JSX blocks — extract into a component

## 4. Write Readable Code — Self-Documenting

- Code should explain itself without comments
- Use named constants instead of magic values:

```typescript
// BAD
if (contacts.length > 250) showWarning();

// GOOD
const FREE_PLAN_CONTACT_LIMIT = 250;
if (contacts.length > FREE_PLAN_CONTACT_LIMIT) showWarning();
```

- Only add comments for **why** something is done, never **what** — the code shows what

## 5. Proper Structure & Formatting

- Consistent indentation: 2 spaces (already enforced in this project)
- Group related logic together — imports, constants, types, component, helpers
- Order in a React component: hooks → derived values → handlers → return JSX
- One blank line between logical groups, two before top-level exports

## 6. Avoid Deep Nesting — Use Early Returns

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

// GOOD — early returns flatten the logic
function processContact(contact) {
  if (!contact) return;
  if (contact.status !== 'Hot') return;
  if (!contact.assignedUserId) return;
  notifyAgent(contact.assignedUserId);
}
```

## 7. Write Tests

- New features must have tests before they are considered done
- Test file lives next to the file it tests: `ContactFormSheet.test.tsx`
- Use AAA pattern: Arrange → Act → Assert
- Test names describe behaviour: `'shows error when first name is empty'`
- Minimum 80% coverage for utilities and hooks

## 8. Handle Errors Properly

- Never ignore errors silently — always show the user or log
- Use meaningful error messages — not `'Error'` but `'Failed to save contact — please try again'`
- Wrap async operations in try/catch
- Validate before executing, fail fast with a clear message

```typescript
// BAD
try { await saveContact(data); } catch (e) {}

// GOOD
try {
  await saveContact(data);
  toast.success('Contact saved successfully');
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Failed to save contact';
  toast.error(msg);
}
```

## 9. Keep Components/Classes Focused — Single Responsibility

- One component = one purpose
- If a component has more than ~400 lines, split it
- In this project: `ContactFormSheet` handles the form, `SectionHeader` handles section display, `FieldWrap` handles field layout — each does only one thing
- Don't mix data-fetching, business logic, and rendering in the same component

## 10. Refactor Regularly

- Before adding a feature, clean up the area you're working in
- Delete unused variables, imports, functions, and dead code
- If you rename something — rename it everywhere (use semantic rename tools)
- Leave code cleaner than you found it (Boy Scout Rule)

---

## Additional Best Practices

### 11. Version Control — Commit Discipline

- Write descriptive commit messages: `feat: add follow-up toggle to contact form`
- Commit in logical, self-contained units — not one giant commit per day
- Use types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`
- Never commit broken code to `main` or `dev-copy-1`

### 12. Favor Composition Over Inheritance

- Build complex UI by combining simple, focused components
- Avoid deeply nested component hierarchies
- In React: compose via props and children, not class extension

```tsx
// GOOD — composed from small pieces
<FormSection title="Status">
  <FieldWrap label="Lead Status"><StatusSelect /></FieldWrap>
  <FieldWrap label="Product"><ProductSelect /></FieldWrap>
</FormSection>
```

### 13. Secure by Design

- Validate and sanitize ALL user input before processing
- Never hardcode API keys, passwords, or tokens — use `.env` variables
- Check RBAC permissions before showing or executing any sensitive action
- Escape data before rendering to prevent XSS (React does this by default for JSX — never use `dangerouslySetInnerHTML` without sanitizing)
- Always scope database queries by `tenantId`

### 14. Avoid Premature Optimization

- Readability and correctness come first
- Only add `useMemo` or `useCallback` when there is a measured performance problem
- Don't over-engineer — build what is needed, then improve when evidence shows it is slow
- Profile before optimizing

### 15. Consistent Project Architecture

- New pages go in `src/pages/`
- New shared components go in `src/components/`
- ShadCN UI primitives go in `src/components/ui/`
- Shared helpers go in `src/lib/`
- Data logic stays in `src/store/` (AuthContext, DataContext)
- Follow the existing pattern — if something already exists, use it before creating a new one
- Every new module follows the same structure: types → mock data → context function → page → filter

---

## Quick Checklist Before Committing

- [ ] Names are descriptive (no `x`, `temp`, `data`)
- [ ] Functions are small and do one thing
- [ ] No duplicated logic (DRY)
- [ ] No deep nesting (early returns used)
- [ ] Errors handled with meaningful messages
- [ ] No hardcoded secrets or magic numbers
- [ ] No unused imports or dead code
- [ ] Component is under 400 lines (if not, split it)
- [ ] Commit message follows `type: description` format
