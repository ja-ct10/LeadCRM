# Kiro Session Modes — Complete Guide

> A bilingual guide (English + Tagalog) explaining each Kiro session mode, when to use it, and example prompts.

---

## 1. Default

**What it is:** Your everyday coding assistant. General-purpose chat mode.

*Ano ito:* Ito yung normal na coding helper mo. Para sa lahat ng uri ng tanong at gawain — edit, explain, refactor.

**When to use:**
- Quick questions about code
- Small edits (fix a bug, rename something, add a class)
- Explanations (how does this hook work?)
- Refactoring a single file or function

*Kailan gamitin:* Kapag may mabilis na tanong, gusto mo mag-edit ng code, o kailangan ng explanation. Hindi kailangan ng plan — diretso lang.

**How to use:** Just type your request naturally — like chatting with a dev partner. No setup needed.

### 5 Example Prompts

```
1. Fix the TypeScript error in leads-page.tsx
2. Add dark mode classes to this component
3. Explain how useEffect cleanup works
4. Refactor this function to be shorter and more readable
5. Add a loading spinner to the accounts table
```

---

## 2. Spec

**What it is:** Structured feature development mode. It walks you through a full process:

```
Requirements → Design → Tasks → Implementation
```

*Ano ito:* Step-by-step na feature building. Tulad ng architect — plano muna bago gawa. Kiro will create documents for requirements, design, and tasks before writing any code.

**When to use:**
- Building a NEW feature that touches multiple files
- Features that need backend + frontend + database changes
- Complex work that benefits from a plan first
- When you want documentation of what was built and why

*Kailan gamitin:* Kapag gagawa ka ng bagong feature na malaki — may backend, frontend, database changes. Gusto mo may maayos na plano at documentation.

**How to use:** Start a Spec session → describe the feature → Kiro asks clarifying questions → creates requirements doc → creates design doc → generates task list → implements step by step.

### 5 Example Prompts

```
1. Build a notification center with real-time updates and read/unread status
2. Create a customer portal where clients can view their invoices and pay online
3. Add an activity timeline feature to the deal details drawer
4. Implement email template builder with drag-and-drop blocks
5. Build a role management page where admins can create custom roles and assign permissions
```

---

## 3. Quick Spec

**What it is:** A faster version of Spec. It asks 1-2 clarifying questions, then auto-generates requirements, design, and tasks in one shot — no back-and-forth.

*Ano ito:* Mabilis na version ng Spec. Konting tanong lang, tapos diretso na generate lahat — requirements, design, tasks — in one go.

**When to use:**
- Medium-sized features where you already know what you want
- You don't need lengthy requirement discussions
- You want structure but don't want to spend time on multiple rounds of feedback

*Kailan gamitin:* Kapag alam mo na kung ano gusto mo, di mo na kailangan ng mahabang discussion. Medium-sized feature na clear na sa isip mo.

**How to use:** Start Quick Spec → describe feature clearly in one message → Kiro asks 1-2 brief clarifications → generates full spec (requirements + design + tasks) → starts implementing.

### 5 Example Prompts

```
1. Add bulk delete functionality to the leads table with confirmation modal
2. Create a saved filters feature for the deals pipeline view
3. Add CSV export button to all CRM data tables
4. Build a quick-add form that slides in from the right side for creating contacts
5. Add email sending integration to the campaign module using Resend API
```

---

## 4. Bug Fix

**What it is:** Structured bug-fixing mode. It follows a process:

```
Investigate → Diagnose Root Cause → Propose Fix → Implement Fix
```

*Ano ito:* Para sa pag-aayos ng bugs. Hindi lang basta mag-edit — mag-iimbestiga muna siya, hahanapin ang tunay na cause, tapos saka aayusin.

**When to use:**
- Something is broken and you're not sure why
- Complex bugs that span multiple files
- Errors that you've tried to fix but can't figure out
- When you want Kiro to trace the problem systematically

*Kailan gamitin:* Kapag may sira at hindi mo alam kung bakit. Lalo na kapag maraming files ang involved at gusto mo ng systematic na investigation.

**How to use:** Describe the bug clearly (what happens vs what should happen) → Kiro investigates the relevant code → identifies root cause → proposes and implements the fix.

### 5 Example Prompts

```
1. The deals table shows 0 records even though the API returns data. Network tab shows 200 response.
2. Infinite re-render loop happens when I open the contacts page. Console shows "Maximum update depth exceeded."
3. Google OAuth login redirects to a blank page instead of the dashboard after successful auth
4. Column reorder drag-and-drop saves but reverts back after page refresh
5. Bulk selection checkbox selects all rows across all pages instead of just current page
```

---

## 5. Plan

**What it is:** Planning mode ONLY. It breaks down your idea into a detailed implementation plan — but does NOT make any code changes.

*Ano ito:* Plano lang, walang gagawin sa code. Para mag-isip ka ng approach, makita mo ang affected files, at mag-decide bago ka mag-commit sa implementation.

**When to use:**
- You want to think through an approach before committing
- Architecture decisions that affect many files
- Big refactors where you need to see the full picture first
- When you want to review a plan before letting Kiro execute

*Kailan gamitin:* Kapag gusto mo lang mag-plan, hindi pa mag-code. Para sa malalaking decisions, refactors, o kapag gusto mo i-review ang approach bago i-execute.

**How to use:** Describe what you want to build or change → Kiro outputs a detailed plan with file changes, dependencies, risks, and considerations → you review → then switch to Default or Spec to execute.

### 5 Example Prompts

```
1. Plan how to migrate DataContext from a god object to per-domain TanStack Query hooks
2. Plan the database schema changes needed to support custom fields on any CRM entity
3. Plan how to add real-time WebSocket updates to the pipeline kanban board
4. Plan a migration from mock auth mode to fully production-ready OAuth + credentials
5. Plan the implementation of a multi-step workflow builder UI with conditional branching
```

---

## 6. kirocrew-heartbeat

**What it is:** An automated background worker agent. It runs maintenance/monitoring tasks on a schedule with a read-only toolset — it cannot write or edit files without approval.

*Ano ito:* Background worker na automated. Nagche-check ng status ng project mo. Read-only lang siya — hindi siya magbabago ng code nang walang permission mo.

**When to use:**
- Automated health checks on your project
- Periodic monitoring (build status, lint errors, dependency issues)
- Tasks that should run without your direct interaction

*Kailan gamitin:* Para sa automated monitoring at health checks. Hindi mo kailangan i-trigger manually every time.

**How to use:** This mode runs tasks automatically with restricted (read-only) tool access. It reports findings but doesn't modify your code.

### 5 Example Prompts

```
1. Check if the backend build is passing and report any TypeScript errors
2. Scan for any new lint warnings introduced in the last commit
3. Verify all API endpoints return proper response envelopes
4. Check if any dependencies have known security vulnerabilities
5. Report the current state of database migrations — any pending?
```

---

## 7. kirocrew-knowledge

**What it is:** Dedicated agent for extracting, categorizing, and summarizing knowledge from your codebase or documents.

*Ano ito:* Para sa pag-extract at pag-organize ng knowledge. Pag gusto mo maintindihan ang codebase, gumawa ng docs, o mag-summarize ng architecture.

**When to use:**
- Onboarding — understanding how a codebase works
- Creating documentation for existing code
- Getting a summary of patterns, flows, or architecture
- Categorizing and organizing technical knowledge

*Kailan gamitin:* Kapag gusto mo maintindihan ang existing code, gumawa ng documentation, o mag-onboard ng bagong developer sa team.

**How to use:** Ask it to analyze, summarize, or document a part of your codebase. It reads and synthesizes — focused on understanding, not changing.

### 5 Example Prompts

```
1. Summarize how authentication works in this project — both credentials and OAuth flows
2. Extract all API endpoints and organize them by module with HTTP methods
3. Document the data flow from frontend DataContext to the PostgreSQL database
4. List all shared components and explain what each one does
5. Create a knowledge summary of the RBAC permission system — how roles and permissions work
```

---

## 8. kirocrew-lite

**What it is:** A lightweight general-purpose agent. Minimal context loading, fast responses. Good for small isolated tasks.

*Ano ito:* Lightweight na agent — mabilis, simple, konting context. Para sa maliliit na tasks na hindi kailangan ng buong codebase.

**When to use:**
- Quick utility scripts or functions
- Isolated questions that don't need project context
- Simple formatting, conversion, or generation tasks
- When you want a fast answer without loading the full workspace

*Kailan gamitin:* Para sa maliliit na tasks na hindi kailangan ng buong codebase context. Mabilis lang — utility functions, conversions, quick generation.

**How to use:** Type your request — it responds quickly with minimal overhead. Best for self-contained tasks.

### 5 Example Prompts

```
1. Write a regex that validates Philippine phone numbers (09xx or +639xx format)
2. Convert this JSON to a TypeScript interface
3. Write a utility function that formats a number as PHP currency
4. Generate a Zod schema for a contact form with name, email, phone, and message
5. Write a one-liner that removes duplicates from an array by ID
```

---

## Quick Comparison Table

| Mode | Purpose | Changes Code? | Best For |
|------|---------|:---:|---------|
| **Default** | General assistant | Yes | Quick edits, questions, refactoring |
| **Spec** | Structured feature dev | Yes | Big new features (multi-file, multi-layer) |
| **Quick Spec** | Fast structured dev | Yes | Medium features (you know what you want) |
| **Bug Fix** | Investigate & fix bugs | Yes | Complex bugs you can't find yourself |
| **Plan** | Think before coding | No | Architecture decisions, big refactors |
| **kirocrew-heartbeat** | Automated monitoring | Read-only | Health checks, status reports |
| **kirocrew-knowledge** | Extract & summarize | No | Documentation, onboarding, understanding |
| **kirocrew-lite** | Lightweight helper | Yes | Small utilities, quick isolated tasks |

---

## Decision Flowchart (Paano Pumili)

```
Simple edit or question?
  → Default

Malaking feature, maraming files?
  → Spec (if you want discussion) or Quick Spec (if you know what you want)

May bug, hindi mo mahanap?
  → Bug Fix

Mag-iisip pa lang, ayaw mo pa mag-code?
  → Plan

Gusto mo maintindihan ang code?
  → kirocrew-knowledge

Mabilis na tulong, isolated task?
  → kirocrew-lite

Automated checks?
  → kirocrew-heartbeat
```

---

## Tips

1. **Start with Plan** if you're unsure, then switch to Spec or Default to execute.
2. **Use Bug Fix** instead of Default when you don't know the root cause — it investigates more deeply.
3. **Quick Spec > Spec** when you have a clear mental picture and don't need iterative discussion.
4. **Default** is your daily driver — 80% of your interactions will probably be here.
5. **kirocrew-knowledge** is great for writing docs you've been putting off.
