'use client';
import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, CreditCard, Receipt,
  Activity, LogOut, Shield, Sun, Moon, Menu, X
} from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { toast } from 'sonner';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  navigate: (path: string) => void;
}

const NAV_ITEMS = [
  { name: 'Dashboard',          path: 'admin-dashboard',    icon: LayoutDashboard },
  { name: 'Client Management',  path: 'admin-clients',      icon: Building2 },
  { name: 'Pricing',            path: 'admin-pricing',      icon: CreditCard },
  { name: 'Billing',            path: 'admin-billing',      icon: Receipt },
  { name: 'Environment Health', path: 'admin-environments', icon: Activity },
  { name: 'Audit Trail',        path: 'audit-log',          icon: Activity },
];

/**
 * Dedicated sidebar + topbar layout for System Admin (LeadCRM operator).
 * Completely separate from CrmLayout — different nav, different colour identity.
 */
export default function AdminLayout({ children, currentPath, navigate }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout().then(() => {
      toast.success('Logged out successfully');
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64
        bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800
        flex flex-col shadow-xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="border-b border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">LeadCRM</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest">System Admin</p>
            </div>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left
                  ${isActive
                    ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest hidden sm:block">
              System Control Plane
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            title={`Switch to ${theme === 'Light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'Light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
