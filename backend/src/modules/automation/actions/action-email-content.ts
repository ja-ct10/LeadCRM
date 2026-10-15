import type { WorkflowAction } from '@leadcrm/shared';

/** Shared effective content without loading mailbox or dispatch dependencies. */
export function workflowEmailContent(config: WorkflowAction['config'], template?: { subject: string | null; content: string } | null) {
  return {
    subject: typeof config.subject === 'string' && config.subject.trim() ? config.subject.trim() : template?.subject ?? '',
    body: typeof config.body === 'string' && config.body.trim() ? config.body.trim() : template?.content ?? '',
  };
}
