/**
 * mockData.ts — Legacy re-export shim.
 *
 * All imports that reference `src/store/mockData` continue to work unchanged.
 * The actual data now lives in `src/store/mockData/` split by domain.
 *
 * New code should import from the domain files directly:
 *   import { MOCK_LEADS } from './mockData/contacts.mock';
 *   import { MOCK_DEALS } from './mockData/deals.mock';
 *
 * Or use the barrel:
 *   import { MOCK_LEADS, MOCK_DEALS } from './mockData';
 */

export {
  MOCK_LEADS,
} from './mockData/contacts.mock';

export {
  MOCK_PIPELINES,
  MOCK_DEALS,
} from './mockData/deals.mock';

export {
  MOCK_WORKFLOWS,
  MOCK_WORKFLOW_EXECUTIONS,
  MOCK_TASKS,
} from './mockData/workflows.mock';

export {
  MOCK_CAMPAIGNS,
  MOCK_TEMPLATES,
} from './mockData/campaigns.mock';

export {
  MOCK_SERVICE_ORDERS,
  MOCK_ASSETS,
  MOCK_INVENTORY,
} from './mockData/service-orders.mock';

export {
  MOCK_TENANTS,
  MOCK_USERS,
  MOCK_PERMISSIONS,
  MOCK_ROLES,
} from './mockData/users.mock';

export { MOCK_INVOICES } from './mockData/invoices.mock';
