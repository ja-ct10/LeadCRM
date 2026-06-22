import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './store/AuthContext';
import { DataProvider } from './store/DataContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ContactsPage from './pages/ContactsPage';
import PipelinePage from './pages/PipelinePage';
import WorkflowsPage from './pages/WorkflowsPage';
import CampaignsPage from './pages/CampaignsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AdminConsole from './pages/AdminConsole';
import SettingsPage from './pages/SettingsPage';
import ServiceOrdersPage from './pages/ServiceOrdersPage';
import AssetsPage from './pages/AssetsPage';
import BillingPage from './pages/BillingPage';
import ClientBillingPage from './pages/ClientBillingPage';
import TechnicianDashboard from './pages/TechnicianDashboard';
import AccountDetailsPage from './pages/AccountDetailsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';

import { Toaster } from 'sonner';
import GlobalLoader from './components/GlobalLoader';

function AppContent() {
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState('landing');

  useEffect(() => {
    if (user && (currentPath === 'landing' || currentPath === 'login' || currentPath === 'register')) {
      if (user.role === 'Technician') {
        setCurrentPath('technician-jobs');
      } else {
        setCurrentPath('dashboard');
      }
    } else if (!user && currentPath !== 'landing' && currentPath !== 'login' && currentPath !== 'register') {
      setCurrentPath('landing');
    }
  }, [user, currentPath]);

  useEffect(() => {
    const refreshSettings = () => {
      // Apply saved appearance settings on load
      const savedTheme = localStorage.getItem('app_theme') || 'Dark';
      const savedAccent = localStorage.getItem('app_accent_color') || '#3B82F6';
      const savedFontSize = localStorage.getItem('app_font_size') || 'Medium';

      // Theme
      if (savedTheme === 'Light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else if (savedTheme === 'Dark') {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      }

      // Accent Color
      document.documentElement.style.setProperty('--color-blue-400', `color-mix(in srgb, ${savedAccent} 85%, white)`);
      document.documentElement.style.setProperty('--color-blue-500', savedAccent);
      document.documentElement.style.setProperty('--color-blue-600', `color-mix(in srgb, ${savedAccent} 85%, black)`);
      document.documentElement.style.setProperty('--color-blue-700', `color-mix(in srgb, ${savedAccent} 70%, black)`);

      // Font Size
      let size = '16px';
      if (savedFontSize === 'Small') size = '14px';
      if (savedFontSize === 'Large') size = '18px';
      document.documentElement.style.fontSize = size;
    };

    refreshSettings();
    window.addEventListener('themechange', refreshSettings);
    return () => window.removeEventListener('themechange', refreshSettings);
  }, []);

  if (!user) {
    if (currentPath === 'login') return <AuthPage mode="login" onNavigate={setCurrentPath} />;
    if (currentPath === 'register') return <AuthPage mode="register" onNavigate={setCurrentPath} />;
    return <LandingPage onNavigate={setCurrentPath} />;
  }

  const renderPage = () => {
    switch (currentPath) {
      case 'dashboard': return <Dashboard />;
      case 'contacts': return <ContactsPage />;
      case 'pipeline': return <PipelinePage navigate={setCurrentPath} />;
      case 'workflows': return <WorkflowsPage />;
      case 'campaigns': return <CampaignsPage />;
      case 'reports': return <ReportsPage />;
      case 'users': return <UsersPage />;
      case 'admin-dashboard': return <AdminConsole activeTabProp="dashboard" />;
      case 'admin-clients': return <AdminConsole activeTabProp="clients" />;
      case 'admin-pricing': return <AdminConsole activeTabProp="pricing" />;
      case 'admin-billing': return <AdminConsole activeTabProp="billing" />;
      case 'admin-environments': return <AdminConsole activeTabProp="environments" />;
      case 'settings': return <SettingsPage />;
      case 'account-details': return <AccountDetailsPage />;
      case 'profile-settings': return <ProfileSettingsPage navigate={setCurrentPath} />;
      case 'service-orders': return <ServiceOrdersPage />;
      case 'technician-jobs': return <TechnicianDashboard />;
      case 'assets': return <AssetsPage />;
      case 'billing': return <BillingPage />;
      case 'client-billing': return <ClientBillingPage />;
      case 'audit-log': return <AuditLogsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout currentPath={currentPath} navigate={setCurrentPath}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
        <GlobalLoader />
        <Toaster position="top-right" />
      </DataProvider>
    </AuthProvider>
  );
}
