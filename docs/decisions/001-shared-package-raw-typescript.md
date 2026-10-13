# ADR-001: Shared TypeScript contracts with JavaScript compatibility

## Status and original decision

Accepted August16,2026; amended during the system-wide audit. Frontend/backend
TypeScript compilation and test aliases resolve @leadcrm/shared to shared/src.
The package main/types remain ./src/index.ts, preserving one contract source and
immediate TypeScript checking. Project references and mandatory dist declaration
consumption are not introduced.

## Current build/runtime behavior

The original no-build description was superseded. The shared build compiles
CommonJS to shared/dist and synchronizes compatibility .js companions under
shared/src for plain Node consumers. Keep those intentional companions; edit the
TypeScript source and regenerate rather than hand-editing JavaScript. Frontend
and backend declare @leadcrm/shared0.0.1 as workspace dependencies, so Turbo's
^build edge orders shared before both consumers.

Backend compilation includes shared source and emits nested
backend/dist/backend/src and backend/dist/shared/src. backend/dist/start.js
maps @leadcrm/shared to its compiled CommonJS index and launches the nested API
or notification worker. Do not replace it with a flat dist/server.js entrypoint.
Next standalone output traces from the monorepo root and starts
frontend/server.js in the container.

## Consequences and validation

Raw TypeScript remains the source of truth; lint needs no prebuilt declarations.
Shared regeneration is a required release step and CI rejects stale companions.
Root locked installation supplies all workspaces. Build consumers from the root
with shared first, then verify [local QA](../verification/system-qa.md). Historical
Git revisions preserve the original alternatives and rationale. See
[architecture](../ARCHITECTURE.md), shared/package.json, backend/start.js and the
root Turbo configuration for current implementation.
