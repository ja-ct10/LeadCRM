'use client';

import React, { useState, useEffect } from 'react';
import AdminDashboard from './dashboard/ui/admin-dashboard';
import ClientManagement from './tenants/ui/client-management';
import PricingPage from './billing/ui/pricing-page';
import AdminBillingPage from './billing/ui/admin-billing-page';
import AuditLogsPage from '../tenant/administration/audit/ui/audit-logs-page';

type TabId =
  | 'dashboard'
  | 'clients'
  | 'pricing'
  | 'billing'
  | 'audit';

interface AdminConsoleProps {
  activeTabProp?: TabId;
}

const TAB_MAP: Record<TabId, React.ComponentType> = {
  dashboard: AdminDashboard,
  clients:   ClientManagement,
  pricing:   PricingPage,
  billing:   AdminBillingPage,
  audit:     AuditLogsPage,
};

export default function AdminConsole({ activeTabProp = 'dashboard' }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<TabId>(activeTabProp);

  useEffect(() => {
    setActiveTab(activeTabProp);
  }, [activeTabProp]);

  const ActivePage = TAB_MAP[activeTab];

  return <ActivePage />;
}
