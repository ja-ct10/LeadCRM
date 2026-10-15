# GitHub CI

Pull requests to `main`, pushes to `main`, and manual runs use one workflow with
exactly three checks:

- Frontend — TypeScript Check
- Backend — TypeScript Check
- Shared Package — TypeScript Check

The workflow installs locked dependencies, generates required Prisma/Next route
types, and checks each workspace with `tsc --noEmit`. It does not run tests,
production builds, containers, migrations, or deployments. Existing local QA
commands remain available. Coolify owns deployment through its existing setup.

## Repository settings

Configure branch protection to require the three checks above. Replace the
retired `PR CI — Required Gate` status, which is no longer produced.

Vercel deployment and preview-comment statuses come from the connected Vercel
Git integration, not from this directory. [Disconnect this repository from the
Vercel project](https://vercel.com/docs/project-configuration/git-settings)
to stop those statuses. Remove any required Vercel status from
branch protection as well. These external settings cannot be changed by editing
workflow files. Existing Actions runs remain visible as historical records.
