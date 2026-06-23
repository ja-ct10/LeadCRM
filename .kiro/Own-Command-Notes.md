 before do action activate agent skills, rules etc that needed in this. also drop it here what skills did you use or activate. context-gatherer,context-gatherer then general-task-execution,requirement-detailer,quick-spec,general-task-execution,architecture-selection.


_______________________

Skills list add: 
Clean Code Best Practices
1. Meaningful Naming
Use clear, descriptive names
x, temp → userCount, orderList
2. Small Functions
One function = one responsibility
Keep it short (5–20 lines ideal)
3. Avoid Code Duplication
Reuse logic
Follow DRY principle
4. Write Readable Code
Code should explain itself
Avoid unnecessary comments
5. Use Proper Structure
Follow consistent formatting
Maintain proper indentation
6. Avoid Deep Nesting
Use early returns
Keep logic simple
7. Write Tests
Ensure code reliability
Prevent bugs early
8. Handle Errors Properly
Use meaningful exception messages
Don't ignore failures
9. Keep Classes Focused
Follow Single Responsibility Principle
10. Refactor Regularly
Improve code continuously
Remove unused code
Additional Best Practices
11. Use Version Control Effectively
Write clear, descriptive commit messages.
Commit frequently in logical, self-contained chunks.
12. Favor Composition Over Inheritance
Build complex behavior by combining simple objects.
Avoid rigid, deeply nested class hierarchies.
13. Secure by Design
Validate, sanitize, and escape all user inputs.
Never hardcode sensitive credentials; use environment variables.
14. Avoid Premature Optimization
Prioritize readability and correctness first.
Only optimize code when you have measured a genuine performance bottleneck.
15. Use Consistent Project Architecture
Organize folders and files logically so any developer can navigate the project easily.
Adhere to established design patterns (e.g., MVC, Hexagonal Architecture) when applicable.

 before do action activate agent skills, rules etc that needed in this. also drop it here what skills did you use or activate. context-gatherer,context-gatherer then general-task-execution,requirement-detailer,quick-spec,general-task-execution,architecture-selection.


__________________
All installed. Here's your complete guide:

What Was Installed
.kiro/
  steering/
    project.md          ← auto-loads on EVERY message
  skills/
    coding-standards.md    ← TypeScript rules, naming, commits
    frontend-patterns.md   ← React, ShadCN, TrelloFilter, Charts, RBAC
    nextjs-patterns.md     ← App Router, SSR, CSS, assets, env vars
    backend-patterns.md    ← Express, PostgreSQL, Repository pattern, Auth
    saas-scalability.md    ← Multi-tenancy, plans, feature gating, billing
How to Use Each Skill — Simple Guide
coding-standards

Activate when: writing ANY code at all
Enforces: no any, no mutations, no console.log, proper naming, commit format
frontend-patterns

Activate when: building components, pages, filters, forms, tables, modals
Enforces: TrelloFilter rules, Chart.js only, dark mode classes, animation imports, infinite loop prevention
nextjs-patterns

Activate when: touching app/ files, adding new pages, CSS, images, env vars
Enforces: 'use client' rules, logo paths, metadata format, Tailwind v4 syntax
backend-patterns

Activate when: building any API route, database query, or auth logic
Enforces: API envelope format, Repository pattern, tenantId scoping, RBAC middleware
saas-scalability

Activate when: adding new modules, planning backend migration, designing features
Enforces: subscription plan gating, pagination, audit logging, data layer structure
The Auto-Activation Line
The steering file now tells Kiro exactly which skills to use for each type of work:

"Frontend changes → activate frontend-patterns + nextjs-patterns + coding-standards"

You don't need to say "activate frontend-patterns" — Kiro reads the steering file on every message and applies the right skills automatically based on what you're asking.

__________________
1. What Are These Skills in Kiro?
These are sub-agents — specialized AI workers Kiro can spin up to handle specific parts of a task. Think of them like hiring a specialist for each job.

How to use each one:

general-task-execution

A generalist — can do anything: read files, run commands, write code
Use it when you have a well-defined task you want to run in parallel
Example: "Delegate to general-task-execution: update all button styles to use the new design system"
context-gatherer

A researcher — explores your codebase before you start coding
Use it FIRST when you're touching an unfamiliar area
Example: "Before fixing this bug, use context-gatherer to map how authentication works across the codebase"
Do NOT use it if you already know which files to edit
custom-agent-creator

Builds new specialized sub-agents for you
Use it when you have a recurring task pattern you want a dedicated agent for
Example: "Create a custom agent that reviews every PR for accessibility issues"
requirement-detailer

Turns vague requirements into precise, well-structured specs
Use it before building features to avoid building the wrong thing
Example: "Detail this requirement: users should be able to manage their billing"
architecture-selection (the wrench icon = spec tool)

Helps you choose between technical approaches before committing
Example: "Should I use Server Components or Client Components for this dashboard?"
quick-spec (the wrench icon = spec tool)

Fast structured spec writing — requirements → design → tasks
Use it for new features you want to plan before implementing
2. What Skills Do You Need to Enhance, Debug, and Fix the CRM Project?
For your LeadCRM project — fixing user journeys, flows, bugs, and use cases — here's exactly what to use and when:

Goal	Use This
Understand how a feature works before changing it	context-gatherer
Find all bugs in a specific flow (e.g. login → dashboard)	context-gatherer then general-task-execution
Turn "fix the pipeline page" into a proper task list	requirement-detailer
Plan a new feature (e.g. notifications system)	quick-spec
Execute a fix across multiple files	general-task-execution
Decide between two implementation approaches	architecture-selection
3. Proper Prompt for Google AI Studio — Fix the Original CRM Project
Here is the prompt you paste directly into Google AI Studio to fix all the issues so the project runs cleanly:

You are an expert full-stack developer. I have a React + Vite SPA project (a CRM called LeadCRM) 
that was built in this Google AI Studio session. I need you to audit and fix ALL issues so the 
project runs successfully with `npm run dev`.

## Required Stack (do NOT change)
- Vite 6 + React 19 + TypeScript
- Tailwind CSS v4 (via @tailwindcss/vite — no tailwind.config.js)
- Recharts (keep as-is, do not replace)
- All existing packages in package.json

## Step 1 — Audit and fix package.json
- Remove any packages that are not imported anywhere in src/
- Make sure all packages that ARE imported in src/ are listed as dependencies
- Do not add new packages
- Keep all existing scripts: dev, build, preview

## Step 2 — Fix vite.config.ts
- Ensure @tailwindcss/vite plugin is properly configured
- Ensure path alias "@" resolves to the project root
- Ensure process.env.GEMINI_API_KEY is injected via define

## Step 3 — Fix tsconfig.json
- Must use "moduleResolution": "bundler"
- Must have "allowImportingTsExtensions": true
- Must have "noEmit": true
- Paths alias "@/*" must resolve to "./*"

## Step 4 — Fix src/index.css
- Must start with @import "tailwindcss"
- Keep all existing custom CSS below it
- Keep the @custom-variant dark rule
- Keep the @theme block with font definitions

## Step 5 — Fix all broken imports in src/
Check every file in src/pages/ and src/components/ for:
- Imports from paths that don't exist → fix the path or create the missing file
- Missing named exports → add them
- Type errors that block compilation → fix them with minimal changes

## Step 6 — Fix src/store/mockData.ts
- All pipeline stage IDs must match what's used in src/store/DataContext.tsx
- The stages array inside each pipeline must have IDs consistent with what 
  Dashboard.tsx and PipelinePage.tsx reference (stage_lead, stage_qualified, 
  stage_proposal, stage_negotiation, stage_won, stage_lost)

## Step 7 — Fix the logo image path
- The logo is at src/assets/images/leadcrm_logo_1780269956175.png
- Vite serves files in src/ via the dev server when using an absolute /src/ path
- Ensure all img src= references to the logo use the path: 
  /src/assets/images/leadcrm_logo_1780269956175.png

## Step 8 — Fix src/App.tsx
- Make sure all page imports resolve to actual files in src/pages/
- Make sure the routing switch covers all case paths used across the app
- Fix any TypeScript errors

## Step 9 — Fix src/store/DataContext.tsx
- Ensure all functions referenced in the DataContextType interface are 
  actually implemented in the DataProvider component
- Ensure useAuth() is imported correctly

## Step 10 — Verify everything compiles
- Run: npx tsc --noEmit
- Fix any remaining TypeScript errors that appear
- Then run: npm run dev
- Fix any Vite build/runtime errors that appear in the console

## Rules
- Do NOT change any UI, layout, styling, colors, or component structure
- Do NOT replace any packages with alternatives
- Do NOT add new features
- Only fix what is broken
- Make the smallest possible change to fix each issue
- After all fixes, the app must load in the browser showing the LandingPage, 
  then allow login with admin@democorp.com, then show the Dashboard with charts

Report each fix you make with: [FIX] filename — what you changed and why.
4. About the ECC Repo (reymarkjpanes/ECC)
Your repo is a fork of affaan-m/ECC — the "Agent Harness Operating System." Here's how to use it with Kiro and your CRM project:

What ECC gives you for this project:

Skills you can copy into .kiro/skills/ to teach Kiro how to work on your codebase (e.g. frontend-patterns, tdd-workflow, verification-loop)
Rules you can put in .kiro/steering/ to give Kiro standing instructions (e.g. always use TypeScript strict mode, always check for console.log before committing)
Agents for specialized tasks like typescript-reviewer, code-reviewer, build-error-resolver
Simple steps to use ECC with Kiro on your CRM:

Clone your ECC fork: git clone https://github.com/reymarkjpanes/ECC.git
Copy the rules you want into your CRM project:
mkdir -p .kiro/steering
copy ECC\rules\common\*.md .kiro\steering\
copy ECC\rules\typescript\*.md .kiro\steering\
Now Kiro will follow those rules automatically on every message
To add a skill (like the TDD workflow): copy ECC\skills\tdd-workflow\SKILL.md into .kiro\skills\tdd-workflow.md
Reference it in chat with #tdd-workflow

_______________
