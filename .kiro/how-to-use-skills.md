# How to Use Kiro Skills — Team Guide

## What Are Skills?

Skills are instruction sets that teach Kiro how to handle specific tasks correctly. Think of them as "expert modes" — each one makes Kiro follow our team's exact standards for a domain (backend, frontend, security, etc).

**Key point:** Skills cost zero tokens until activated. They only load when needed.

---

## How to Activate a Skill

### Option 1: Automatic (just describe your task)
Kiro reads your message and auto-activates matching skills based on keywords.

```
You type: "Build a new contacts filter component"
Kiro auto-loads: frontend-patterns + leadcrm-design-system
```

### Option 2: Slash command (explicit control)
Type `/` in chat to see all available skills, then select one.

```
/frontend-patterns
/security-review
/prisma-patterns
```

### Option 3: Mention in your prompt
Just name the skill directly in your message.

```
"Using the backend-patterns skill, create the new invoice controller"
```

---

## When to Use Each Skill

### 🎨 Frontend & UI

| Skill | Use When... |
|---|---|
| `frontend-patterns` | Writing any React component, form, filter, or page |
| `leadcrm-design-system` | Need exact colors, spacing, typography, component specs |
| `ui-ux-pro-max` | Designing new UI from scratch — color palettes, font pairings, layout |
| `motion-ui` | Adding animations, transitions, entrance/exit effects |
| `nextjs-patterns` | Working on App Router files, routing, SSR boundaries, env vars |
| `react-patterns` | Hooks, useEffect, useState, component composition |
| `react-performance` | Fixing re-renders, bundle size, memoization, waterfalls |
| `accessibility` | WCAG compliance, ARIA, keyboard nav, focus management |

### ⚙️ Backend & Database

| Skill | Use When... |
|---|---|
| `backend-patterns` | Writing controllers, services, repositories, middleware |
| `prisma-patterns` | Writing queries, migrations, transactions, soft deletes |
| `api-design` | Designing new endpoints, status codes, pagination, versioning |

### 🔒 Security & SaaS

| Skill | Use When... |
|---|---|
| `security-review` | Auth, RBAC, tenant isolation, input validation, secrets |
| `saas-scalability` | Multi-tenancy, plan limits, feature flags, billing logic |

### 📋 CRM & Business Logic

| Skill | Use When... |
|---|---|
| `crm-patterns` | Deal pipeline, contact scoring, workflow engine, campaigns |

### 🧪 Testing

| Skill | Use When... |
|---|---|
| `tdd-workflow` | Writing unit tests, Vitest, coverage, TDD cycle |
| `e2e-testing` | Playwright tests, page objects, flaky test prevention |

### 🚀 Process & Quality

| Skill | Use When... |
|---|---|
| `understand-first` | Before ANY edit — understand what exists before changing it |
| `workflow-process` | Complex tasks, architecture decisions, planning |
| `verification-loop` | Before creating a PR — runs the full quality gate |
| `codebase-audit` | After a big merge, before refactors, finding tech debt |
| `git-workflow` | Creating branches, writing commits, PR descriptions |
| `docker-patterns` | Dockerfile, docker-compose, container configuration |

---

## Quick Decision Tree

```
Starting a new task?
  │
  ├── Is it a simple fix (< 3 files)? → Just describe it, Kiro auto-activates
  │
  ├── Is it a new UI component?
  │     → /frontend-patterns + /leadcrm-design-system
  │
  ├── Is it a new API endpoint?
  │     → /backend-patterns + /api-design
  │
  ├── Does it touch auth, roles, or tenant data?
  │     → /security-review + /saas-scalability
  │
  ├── Is it a complex feature (5+ files)?
  │     → /workflow-process (plans before coding)
  │     → /understand-first (reads before changing)
  │
  └── Ready to open a PR?
        → /verification-loop (runs all quality gates)
```

---

## Steering Files vs Skills — What's the Difference?

| | Steering Files | Skills |
|---|---|---|
| **Location** | `.kiro/steering/` | `.kiro/skills/` |
| **Loaded** | Automatically (always/fileMatch/manual) | On-demand only |
| **Purpose** | Rules that apply to ALL work | Deep expertise for specific tasks |
| **Token cost** | Always-loaded ones cost every message | Zero cost until activated |
| **How to use** | Automatic — no action needed | `/skill-name` or auto-detected |

### Always-Active Steering (you get these for free on every message):
- `product.md` — Tech stack, paths, API routes
- `architecture.md` — Layer contracts, RBAC, Six-Pillar rule
- `coding-standards.md` — TypeScript rules, size limits, anti-patterns
- `security.md` — Tenant isolation, auth, secrets
- `structure.md` — File naming, imports, module anatomy

### Manual Steering (load with `#filename` in chat):
- `#testing` — TDD standards, coverage requirements
- `#skill-routing` — Full skill activation matrix
- `#deployment` — Docker, CI/CD, infrastructure
- `#lessons-learned` — Team knowledge, known pitfalls

---

## How Skills Save Credits

Skills use **progressive loading** — Kiro only reads the name and description at startup (~77 tokens per skill). The full content (~3–13 KB) loads only when the skill is actually needed.

**22 skills installed × ~77 tokens metadata = ~1,700 tokens total at startup**

Compare this to putting all that knowledge in always-loaded steering: ~90 KB = ~23,000 tokens on every single message. Skills save ~90% of that cost.

---

## Common Mistakes to Avoid

❌ Don't activate 5+ skills at once — it floods context and reduces quality
✅ Activate 1–2 relevant skills per task

❌ Don't skip `understand-first` on unfamiliar code
✅ Always read before editing shared files (store/, shared/, core/)

❌ Don't use skills for simple questions ("what port does the backend use?")
✅ Skills are for implementation tasks, not Q&A

❌ Don't forget `/verification-loop` before PRs
✅ It catches missing tenantId, RBAC guards, and audit logs

---

## Adding a New Skill

If you discover a repeating pattern not covered:

```
.kiro/skills/my-new-skill/
└── SKILL.md
```

```markdown
---
name: my-new-skill
description: What it does and when to use it. Apply when [specific trigger condition].
---

# My New Skill

Instructions go here...
```

The `description` field is critical — Kiro uses it to decide when to auto-activate. Always include "Apply when..." or "Use when..." at the end.

---

## AI Model Selection

Kiro supports multiple AI models. Your skills and steering work with ALL models — nothing limits higher models.

### How Model Selection Works

| Model | Best For | Credit Cost |
|---|---|---|
| **Auto** (default) | Picks the best model per task automatically | Optimized |
| **Claude Opus 4/5** | Complex architecture, multi-file refactors, debugging | Higher |
| **Claude Sonnet** | Standard coding, fast responses | Lower |

### Key Rule: Skills Never Limit Model Output

Skills provide context, not constraints on model capability. A higher model like Opus 5 will:
- Use the same steering rules but produce more nuanced implementations
- Make better architectural decisions with the same context
- Catch more edge cases with the same security rules
- Write more complete code with the same constraints

**Auto mode is recommended** — it picks Opus for complex tasks and Sonnet for simple ones, balancing cost and quality automatically.

### When to Switch to a Higher Model Manually

- Architecture decisions affecting 10+ files
- Security-critical auth/RBAC implementations
- Complex Prisma migrations with data transformations
- Debugging subtle multi-tenant isolation bugs
- Full feature implementation in Spec mode

---

## File Map — What Lives Where

```
.kiro/
├── how-to-use-skills.md      ← This guide
├── power/
│   └── POWER.md              ← Workspace metadata for Kiro
├── settings/
│   └── mcp.json              ← MCP server config (Context7)
├── hooks/
│   ├── activate-on-task      ← Pre-task file reading (Spec mode)
│   ├── security-check-on-create ← Auto secret scan (free)
│   ├── code-review-on-write  ← Manual code review trigger
│   ├── quality-gate          ← Manual pre-PR check
│   └── session-wrap          ← Manual end-of-session summary
├── steering/
│   ├── product.md            ← [always] Stack, paths, routes
│   ├── architecture.md       ← [always] Layers, RBAC, Six-Pillar
│   ├── coding-standards.md   ← [always] TS/React rules, anti-patterns
│   ├── security.md           ← [always] Tenant isolation, auth
│   ├── structure.md          ← [always] File naming, imports
│   ├── ui-ux.md              ← [fileMatch *.tsx] Design tokens
│   ├── testing.md            ← [manual] TDD standards
│   ├── skill-routing.md      ← [manual] Skill activation matrix
│   ├── deployment.md         ← [manual] Docker, CI/CD
│   └── lessons-learned.md    ← [manual] Team knowledge base
└── skills/                   ← 22 on-demand skills (see table above)
```
