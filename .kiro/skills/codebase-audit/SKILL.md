---
name: codebase-audit
description: Comprehensive audit checklist for LeadCRM — broken imports, TypeScript violations, anti-patterns, dead code, UX issues, and architectural inconsistencies. Apply before any large refactor, after merging a feature branch, or when the codebase has accumulated drift. Every finding must pass the "legitimate purpose" test before being changed.
---

# Codebase Audit — LeadCRM

> Before making any modification, addition, removal, or refactoring, validate that the change has a legitimate purpose and a measurable benefit. Understand first. Verify dependencies. Then implement carefully.

## The Audit Principle

For every potential change, answer:
1. **Why does this element exist?** — What business or user goal does it support?
2. **What connects to it?** — Dependencies, consumers, side effects.
3. **What improves?** — Maintainability, performance, security, usability, or code quality.
4. **What could break?** — TypeScript contracts, runtime behavior, UX state.

If you cannot answer all four, **do not change it**. Research first.

---

## Category 1 — Build-Breaking Issues (fix immediately)

```
□ Import path points to non-existent file
□ @/src/ double-prefix alias (should be @/)
□ ./ui/ prefix inside a file already in ui/ folder
□ PascalCase filename imported as kebab-case (or vice versa)
□ Missing 'use client' on route files
□ Route files using static import instead of dynamic(() => import(...), { ssr: false })
```

### Audit Command
```bash
# Find all @/src/ double-prefix imports
grep -r "@/src/" frontend/src --include="*.ts" --include="*.tsx" -l

# Find all static imports in app/ route files (should be dynamic)
grep -r "^import " frontend/app --include="page.tsx" -l
```

---

## Category 2 — TypeScript Violations (fix in same PR)

```
□ catch (error: any) — use catch (err: unknown) + instanceof Error narrowing
□ function param typed as any — define proper interface
□ @ts-ignore or @ts-expect-error — fix the root cause
□ as Type used to silence errors (not to widen)
□ Exported function missing return type
□ Inline component props — use named interface
□ Forbidden names: x, data, val, res, temp, item, obj, cb
```

### Correct Catch Pattern
```typescript
// WRONG
} catch (error: any) {
  toast.error(error.message || "Failed");
}

// CORRECT
} catch (err: unknown) {
  toast.error(err instanceof Error ? err.message : "Failed");
}
```

---

## Category 3 — SaaS / Security Violations (block merge)

```
□ New record created without tenantId from useAuth()
□ tenantId sourced from user input or form data
□ addAuditLog() missing on create/update/delete
□ RBAC guard missing on create/edit/delete UI button
□ Direct localStorage in a component or hook (only AuthContext may use it)
□ console.log in non-seed, non-server production code
□ Secrets or tokens hardcoded
□ dangerouslySetInnerHTML without DOMPurify.sanitize()
```

---

## Category 4 — Frontend Standards Violations

```
□ framer-motion imported — replace with motion/react
□ Direct recharts import — replace with ChartComponents.tsx
□ Raw <select> used as filter — replace with <TrelloFilter>
□ inline style={{ }} for values achievable with Tailwind
□ Light-only UI element — add dark: variant
□ React component > 400 lines
□ React page > 800 lines
□ useEffect dep array contains Context array (contacts, deals, users, etc.) — infinite loop risk
□ Array index used as key
□ Prop drilling > 3 levels
```

---

## Category 5 — Architecture Inconsistencies

```
□ Feature folder missing index.ts public API
□ Type defined in store/types.ts directly — move to store/types/
□ Route file contains logic beyond dynamic import shell
□ Direct data mutation (no spread) in component
□ Cross-module data mutation (module A mutates module B's data directly)
□ DataContext bypassed — direct localStorage read in component
□ Service layer skipped — business logic in controller
□ Repository bypassed — raw Prisma in service
```

---

## Category 6 — Dead Code & Duplicates

```
□ Unused import (check with TypeScript or IDE)
□ Commented-out code with no explanation
□ Duplicate type definition (same interface in multiple files)
□ Duplicate utility function (same logic in multiple places)
□ Orphaned file with no consumers
□ TODO older than 30 days with no linked issue
```

---

## Audit Execution Order

Run categories in this order — earlier categories block later ones:

1. **Category 1** — Build breaks: nothing else matters until the app builds
2. **Category 3** — Security/SaaS: data integrity and access control
3. **Category 2** — TypeScript: type safety catches hidden bugs
4. **Category 4** — Frontend standards: UI quality and consistency
5. **Category 5** — Architecture: long-term maintainability
6. **Category 6** — Cleanup: dead code after everything else is green

---

## Batch Change Safety Rules

**NEVER use PowerShell/bash regex replacement on large files without:**
1. Reading the file first to understand its structure
2. Testing the regex on a single file before bulk application
3. Verifying the output immediately after each file
4. Using `str_replace` tool for surgical edits, not shell scripts for multiline transforms

**Regex replacements on TypeScript/TSX files are HIGH RISK** — PowerShell's `-replace` operator uses .NET regex which does not understand TSX syntax. Multiline catch blocks, template literals, and JSX will corrupt on unexpected match groups.

```powershell
# DANGEROUS — can corrupt files
$content -replace 'catch \(error: any\) \{(\s+)toast...', { $_.Groups[1].Value ... }

# SAFE — use str_replace tool for targeted edits
# Or: simple non-capturing literal replacements only
$content.Replace('catch (error: any)', 'catch (err: unknown)')
```

---

## Per-Change Validation Gate

Before committing any change from an audit:

```
□ Read the full file — not just the changed lines
□ Understand why the original code was written that way
□ Verify no consumers depend on the old behavior
□ Run TypeScript check: npx tsc --noEmit
□ Confirm the change compiles and renders correctly
□ Document the decision if non-obvious
```

**When uncertain, preserve stable behavior over speculative improvement.**
