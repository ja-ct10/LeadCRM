# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for LeadCRM.

## When to Create an ADR

Create an ADR when a decision:
- Materially changes authentication or authorization
- Changes tenant architecture or isolation
- Changes database strategy or persistence architecture
- Introduces a major new dependency
- Changes API architecture or conventions
- Changes deployment architecture or infrastructure
- Introduces a major performance or caching strategy
- Replaces an existing architectural approach

## ADR Format

Use the template in `000-template.md`.

## ADR Lifecycle

- **Proposed** → Under discussion
- **Accepted** → Decision made and active
- **Superseded** → Replaced by a newer ADR (link the replacement)
- **Deprecated** → No longer relevant

When a decision becomes obsolete, do NOT delete the ADR. Create a superseding ADR and update the status of the original.

## Naming Convention

`NNN-short-description.md` — e.g. `001-shared-package-raw-typescript.md`
