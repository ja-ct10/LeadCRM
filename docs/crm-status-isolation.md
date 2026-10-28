# CRM status isolation

Deal status edits use the selected Deal ID and the existing governed stage service inside the sales transaction. Views display persisted `engagementStatus` through the shared badge helpers. Stage labels remain separate. Related-record projections include the same saved status, and successful panel edits refresh the detail query and shared Deal state.

The mappings are Inquiry → Lead, Warm → Contacted, Hot → Qualified, Cancelled → the pipeline's lost stage, and Closed Deal → its won stage with existing closing requirements. Cold keeps the current open stage. Reopening to Inquiry clears current cancellation metadata while retaining history; previously won Deals remain protected.

## Reply and manual-selection boundaries

New verified inbound messages use the existing provider identity, RFC evidence, customer matching, permissions, tenant scope and Deal relationships. Ambiguous customers or Deal attribution do not select a Deal. A verified customer-only reply may update that customer alone. Automated messages and outbound send/queue/delivery/open events do not enter the response transition.

Mailbox persistence, activity, accepted reply watermarks and resulting status/stage changes share the sales transaction. Provider replays do not repeat the transition. Duplicate RFC copies retain provider history but do not become additional reply evidence. A manual thread association can establish context for later replies, never retroactively replay old messages as fresh events.

Customer checkpoints reuse `manualStatusContext`. Deal checkpoints use the single nullable field added by `20261229000000_deal_manual_status_checkpoint`; the migration is included in the existing deployment guard. Checkpoints are internal and omitted from public record responses. Manual status saves record `selectedAt` even when unchanged. Automatic classification cannot override these checkpoints through aging or old evidence. A genuinely newer accepted reply records `replyAt` and `replyKey`, and older qualification/outreach evidence cannot immediately restore the previous status.

Ordinary Deal updates no longer aggregate status into customers. Confirmed-sale Lead conversion and Contact lifecycle completion remain governed by existing requirements. Originating Deal provenance survives dependent customer/conversion events and workflow dispatch. Explicit customer workflows without Deal provenance retain their existing target selection. Customer-only replies carry an explicit absence of Deal provenance, preventing related-Deal actions.

## Detail inputs and campaigns

The shared Philippine phone input normalizes country prefixes before its ten-digit local limit, inserts pastes at the current selection and preserves the caret. Existing Philippine validation and E.164 storage conversion remain in use.

Phone and Email system fields receive scoped, distinct stored values through the existing audience-fields response's `options`. The shared Create/Edit Audience panel renders selects without changing operators or scalar condition storage. Missing saved values stay selectable and identified as unavailable. Options respect source, tenant, CRM visibility, assignment and active-record restrictions. Audience evaluation keeps its existing predicates.

Built-in Source Attribution sections and Business Email Inquiries navigation/routes are removed, including their exclusive presentation components. Ordinary Source fields, acquisition evidence, configured sections and mailbox synchronization remain available.

## Hosted archive cleanup

`backend/scripts/inventory-archived-records.cjs <tenantId>` is an operator-only, read-only inventory with no deletion mode. It reports tenant/module counts, archived IDs, direct foreign-key dependencies and delete rules, linked active records, retained audit IDs and conservative retention blockers. Products, roles and inactive users require additional semantic/retention review.

Hosted inventories, deletion manifests, screenshots and operator evidence remain local because they contain deployment-specific and organizational data. They are excluded from the public source contribution. No deletion is run by application deployment or this read-only inventory script. A cleanup uses an explicitly reviewed tenant scope, dependency inspection, a rollback rehearsal, transactional state rechecks and independent post-commit verification.

Changes are local. Apply the checkpoint migration with the matching application release before enabling the updated writers. Local component/database tests do not establish a deployed or live-provider acceptance result.
