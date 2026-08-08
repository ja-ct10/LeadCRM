# LeadCRM Development System

Multi-tenant CRM + Workflow Automation platform. Next.js 15, Express.js, Prisma 5, PostgreSQL 16.

## Keywords

saas, crm, nextjs, typescript, react, multi-tenant, rbac, frontend, backend, prisma, security, leadcrm, quality, tdd

## Configuration (August 2026 — Optimized)

### Steering (always-loaded — ~4,200 tokens total)

| File | Purpose |
|---|---|
| `product.md` | Stack, paths, API routes, dev commands |
| `structure.md` | File naming, imports, module anatomy |
| `architecture.md` | Layer contracts, RBAC, Six-Pillar Rule |
| `coding-standards.md` | TypeScript, React, SaaS safety, anti-patterns |
| `security.md` | Auth, tenant isolation, secrets, rate limits |

### Steering (conditional)

| File | Mode | Loads When |
|---|---|---|
| `ui-ux.md` | fileMatch `*.tsx,*.css` | Frontend files are active |
| `testing.md` | manual (`#testing`) | Writing tests |
| `skill-routing.md` | manual (`#skill-routing`) | Planning complex tasks |
| `deployment.md` | manual (`#deployment`) | Docker/CI work |
| `lessons-learned.md` | manual (`#lessons-learned`) | Debugging, reviewing pitfalls |

### Skills (22 installed — demand-loaded, zero idle cost)

See `.kiro/how-to-use-skills.md` for the full guide.

### Hooks (credit-efficient)

| Hook | Trigger | Type | Credits |
|---|---|---|---|
| `activate-on-task` | preTaskExecution | askAgent | ~0.5/task |
| `security-check-on-create` | fileCreated (auth/api/middleware/store) | runCommand | 0 |
| `code-review-on-write` | userTriggered | askAgent | Only when you run it |
| `quality-gate` | userTriggered | askAgent | Only when you run it |
| `session-wrap` | userTriggered | askAgent | Only when you run it |

### Powers

| Power | Purpose |
|---|---|
| Context7 | Live documentation lookup (Next.js 15, Prisma 5, React 19) |
| Figma | Design-to-code implementation |
| Design System Scaffold | Component specs and theming |
| Stripe | Payment integration patterns |

### MCP Servers

| Server | Auto-Approved Tools |
|---|---|
| `context7` | `resolve-library-id`, `get-library-docs` |
