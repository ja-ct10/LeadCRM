import { AsyncLocalStorage } from 'node:async_hooks';
import type { CrmEnvironment } from '@leadcrm/shared';

/** Fixed for the lifetime of a request/job, even if the user switches elsewhere. */
export const environmentContext = new AsyncLocalStorage<{
  tenantId: string;
  environment: CrmEnvironment;
}>();
