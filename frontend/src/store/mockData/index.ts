/**
 * Mock data barrel — re-exports all domain seed data.
 *
 * Import from here rather than from individual domain files:
 *   import { MOCK_LEADS, MOCK_USERS } from '../store/mockData';
 *
 * Domain files:
 *   contacts.mock.ts      — MOCK_LEADS (contacts / leads)
 *   deals.mock.ts         — MOCK_PIPELINES, MOCK_DEALS
 *   workflows.mock.ts     — MOCK_WORKFLOWS, MOCK_WORKFLOW_EXECUTIONS, MOCK_TASKS
 *   campaigns.mock.ts     — MOCK_CAMPAIGNS, MOCK_TEMPLATES
 *   service-orders.mock.ts — MOCK_SERVICE_ORDERS, MOCK_ASSETS, MOCK_INVENTORY
 *   users.mock.ts         — MOCK_TENANTS, MOCK_USERS, MOCK_PERMISSIONS, MOCK_ROLES
 */

export { MOCK_LEADS } from './contacts.mock';

export { MOCK_PIPELINES, MOCK_DEALS } from './deals.mock';

export {
  MOCK_WORKFLOWS,
  MOCK_WORKFLOW_EXECUTIONS,
  MOCK_TASKS,
} from './workflows.mock';

export { MOCK_CAMPAIGNS, MOCK_TEMPLATES } from './campaigns.mock';

export {
  MOCK_SERVICE_ORDERS,
  MOCK_ASSETS,
  MOCK_INVENTORY,
} from './service-orders.mock';

export {
  MOCK_TENANTS,
  MOCK_USERS,
  MOCK_PERMISSIONS,
  MOCK_ROLES,
} from './users.mock';

export { MOCK_INVOICES } from './invoices.mock';
