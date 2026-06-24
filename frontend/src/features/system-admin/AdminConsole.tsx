'use client';

import React, { useState, useEffect } from 'react';
import AdminDashboard from './dashboard/AdminDashboard';
import ClientManagement from './tenants/ClientManagement';
import PricingPage from './billing/ui/pricing-page';
import AdminBillingPage from './billing/AdminBillingPage';
import EnvironmentsPage from './monitoring/EnvironmentsPage';

type TabId = 'dashboard' | 'clients' | 'pricing' | 'billing' | 'environments';

interface AdminConsoleProps {
  activeTabProp?: TabId;
}

const TAB_MAP: Record<TabId, React.ComponentType> = {
  dashboard:    AdminDashboard,
  clients:      ClientManagement,
  pricing:      PricingPage,
  billing:      AdminBillingPage,
  environments: EnvironmentsPage,
};

export default function AdminConsole({ activeTabProp = 'dashboard' }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<TabId>(activeTabProp);

  useEffect(() => {
    setActiveTab(activeTabProp);
  }, [activeTabProp]);

  const ActivePage = TAB_MAP[activeTab];

  return <ActivePage />;
}
