# Contributing to LeadCRM
Follow [AGENTS.md](AGENTS.md), [architecture](docs/ARCHITECTURE.md), [structure](docs/STRUCTURE.md) and [API contracts](docs/API.md). Install the root lockfile with `npx --yes npm@11.19.1 ci --include=dev`; do not install workspaces independently.

Use [local acceptance](docs/verification/system-qa.md) before release. Preserve tenant isolation, RBAC and migration history. Generated shared JavaScript is synchronized from TypeScript through the shared build. Production migration/provider/deployment checks remain separate from disposable QA.
