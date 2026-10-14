# Branch history reconciliation — October 14, 2026

The audit compared 44 remote and 17 local branch references with main revision
`c523fda5aa2447bf5a640d9b4bce83a90cfe48d6`. Fifteen references appeared ahead,
representing eleven distinct heads. Their application changes were already
integrated or superseded by later reviewed main changes.

Reconciliation records those heads as ancestors without restoring old application
code. The complete Git tree was compared with the starting main tree after every
historical merge and remained identical. This report is the sole file change in
the reconciliation PR. Normal merge commits are required to preserve the ancestry;
squashing this PR would recreate the ahead counters.

## Reviewed heads

| Branch or snapshot | Head | Evidence and retained behavior |
| --- | --- | --- |
| Local workflow-starter backup | `9f74e647` | `git cherry` identifies the same patch already in main as `626e8308`; current dynamic templates remain authoritative. |
| `codex/ci-browser-fixture-sync` | `4597584f` | Accepted by PR #126; a prospective merge produces exactly the main tree. |
| Local `codex/ci-coolify-reliability` | `b0ec4588` | Preserves five pending fixture edits and its parent `63168063`; current main retains the draft host, improved browser synchronization, and canonical fixtures. |
| `codex/ci-split-verification` | `53bd1acc` | Exact head accepted by PR #123; preserve subsequent fast-PR/full-main profiles and evidence contracts. |
| `codex/fast-pr-ci` | `fe4b17bf` | Accepted by PR #125; a prospective merge produces exactly the main tree. |
| `codex/implementation-plan` | `4ed75f64` | Exact head accepted by PR #121; preserve later contracts, security fixes, and schema retirement rules. |
| `backup-09-09` | `424fe80f` | Merge-only history; a prospective merge produces exactly the main tree. |
| `codex/sms-inbox-conversion-fixes` | `1fe47afa` | Accepted by PR #124; a prospective merge produces exactly the main tree. |
| `dev` | `a30dec58` | Historical merges from main; a prospective merge produces exactly the main tree. |
| `fix/inbox-stream-rate-limit-20261009` | `e29b4e4d` | PR #118's Retry-After handling, regression, SSE cooldown and deployment probe already exist in main. Preserve newer authorization invalidation, bounded reconnects, and the distinction between anonymous authentication checks and authorized streaming verification. |
| `main-backup-9-6-2026` | `ed15108c` | Merge-only history; a prospective merge produces exactly the main tree. |

The local conversion fixture still expected a Lead company-name mutation.
Current conversion preserves that authored value and links the Account separately;
main correctly checks `accountId`, `contactId`, `convertedAt`, and `convertedById`
without claiming status or company-name changes. The preserved local snapshot
remains recoverable through its commit rather than replacing these newer checks.

## Controls and verification

- Preserve backup branch tips and all original commits; no branch deletion,
  force push, schema change, permission change, or Coolify configuration change.
- Preserve the protected PR gate, strict/up-to-date requirement and administrator
  enforcement. Run existing PR checks before a normal merge into main.
- Before publishing, verify the only file diff is this report and every audited
  branch tip is an ancestor of the reconciliation head.
- After merging, fetch origin and verify every local/remote branch has zero commits
  ahead of `origin/main`. Fast-forward the original checkout to main and confirm
  that its working tree is clean and its main tracking counts are `0 0`.
- Full main verification remains mandatory; see the existing
  [CI and Coolify runbook](../setup/ci-coolify-release.md).

The open reverse-direction PR #117 proposes updating a historical backup from
main. It is not an incoming application change to main and is outside this
history reconciliation. Its backup snapshot remains intact.
