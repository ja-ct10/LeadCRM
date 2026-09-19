'use client';
import AdminDashboard from './dashboard/ui/admin-dashboard';
import ClientManagement from './tenants/ui/client-management';
import AuditLogsPage from '../tenant/administration/audit/ui/audit-logs-page';
const pages = { dashboard: AdminDashboard, clients: ClientManagement, audit: AuditLogsPage };
export default function AdminConsole({ activeTabProp = 'dashboard' }: { activeTabProp?: keyof typeof pages }) {
  const Page = pages[activeTabProp];
  return <Page />;
}
