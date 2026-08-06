'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { MOCK_USERS } from '@/store/mockData';
import { PATHNAME_TO_PATH, PATH_TO_PATHNAME } from '@/lib/route-map';
import { 
  LayoutDashboard, Users, Briefcase, 
  Workflow, Mail, LogOut, Menu, X, Shield, Bell, Wrench,
  Package, Receipt, Building2, CreditCard, Activity, ListTodo, Layers,
  Sun, Moon, StickyNote, Check, User, PanelLeftClose, PanelLeft, UserCheck, Settings
} from 'lucide-react';
import CommandPalette from '@/shared/components/command-palette';
import NotesSidePanel from '@/shared/components/notes-side-panel';
import { usePermissions, useHasPermission, PERMISSION_BRIDGE } from '@/shared/hooks/use-permissions';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = PATHNAME_TO_PATH[pathname] ?? 'dashboard';

  const navigate = (path: string) => {
    const target = PATH_TO_PATHNAME[path];
    if (target) {
      router.push(target);
    }
  };
  const { user, login, logout, switchRole } = useAuth();
  const { resetDemoData, isServiceModuleEnabled, isAssetModuleEnabled, isBillingModuleEnabled, roles } = useData();
  const userPermissions = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'Light' | 'Dark'>('Dark');
  const [notesOpen, setNotesOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  useEffect(() => {
    const savedCollapse = localStorage.getItem('sidebar_collapsed');
    if (savedCollapse !== null) {
      setIsCollapsed(savedCollapse === 'true');
    }
  }, []);

  const toggleDesktopSidebar = () => {
    setIsCollapsed(prev => {
      const nextVal = !prev;
      localStorage.setItem('sidebar_collapsed', String(nextVal));
      return nextVal;
    });
  };

  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('app_theme');
      if (savedTheme === 'Light' || savedTheme === 'Dark') {
        setTheme(savedTheme);
      } else {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'Dark' : 'Light');
      }
    };

    syncTheme();
    window.addEventListener('themechange', syncTheme);
    return () => window.removeEventListener('themechange', syncTheme);
  }, []);

  const isSuper = userPermissions.includes('*');

  const navItems = [
    { name: 'Dashboard',        path: 'dashboard',         icon: LayoutDashboard, permission: null,                   roles: null },
    { name: 'My Jobs',          path: 'technician-jobs',   icon: Wrench,          permission: null,                   roles: ['Technician'] },
    { name: 'Client Profiles',  path: 'contacts',          icon: Users,           permission: 'contacts.view',        roles: null },
    { name: 'Customers',        path: 'customers',         icon: UserCheck,       permission: 'contacts.view',        roles: null },
    { name: 'Pipeline',         path: 'pipeline',          icon: Briefcase,       permission: 'deals.view',           roles: null },
    { name: 'Tasks',            path: 'tasks',             icon: ListTodo,        permission: 'contacts.view',        roles: null },
    { name: 'Service Orders',   path: 'service-orders',    icon: Wrench,          permission: 'deals.view',           roles: null, enabled: isServiceModuleEnabled },
    { name: 'Asset Tracking',   path: 'assets',            icon: Package,         permission: 'audit.view',           roles: null, enabled: isAssetModuleEnabled },
    { name: 'Inventory',        path: 'inventory',         icon: Layers,          permission: 'settings.view',        roles: null, enabled: isAssetModuleEnabled },
    { name: 'Contract Billing', path: 'billing',           icon: Receipt,         permission: 'billing.view',         roles: null, enabled: isBillingModuleEnabled },
    { name: 'Workflows',        path: 'workflows',         icon: Workflow,        permission: 'workflows.view',       roles: null },
    { name: 'Campaigns',        path: 'campaigns',         icon: Mail,            permission: 'campaigns.view',       roles: null },
    { name: 'Users',            path: 'users',             icon: Users,           permission: 'users.view',           roles: null },
    { name: 'Account Details',  path: 'account-details',   icon: Shield,          permission: null,                   roles: ['Client Admin'] },
    { name: 'Audit Trail',      path: 'audit-log',         icon: Activity,        permission: 'audit.view',           roles: null },
    // System Admin only
    { name: 'Dashboard',        path: 'admin-dashboard',   icon: LayoutDashboard, permission: null,                   roles: ['System Admin'] },
    { name: 'Client Management',path: 'admin-clients',     icon: Building2,       permission: null,                   roles: ['System Admin'] },
    { name: 'Pricing',          path: 'admin-pricing',     icon: CreditCard,      permission: null,                   roles: ['System Admin'] },
    { name: 'Billing',          path: 'admin-billing',     icon: Receipt,         permission: null,                   roles: ['System Admin'] },
    { name: 'Environment Health',path:'admin-environments', icon: Activity,       permission: null,                   roles: ['System Admin'] },
    { name: 'Audit Trail',      path: 'audit-log',         icon: Activity,        permission: null,                   roles: ['System Admin'] },
  ] as const;

  const hasAccess = (item: { permission: string | null; roles: readonly string[] | null; enabled?: boolean }) => {
    // Feature flag gate
    if ('enabled' in item && item.enabled === false) return false;

    // System Admin sees only their own nav items
    if (user?.role === 'System Admin') return item.roles?.includes('System Admin') ?? false;

    // System Admin-only items are hidden from everyone else
    if (item.roles?.includes('System Admin')) return false;

    // Role-specific items (Technician, Client Admin)
    if (item.roles && !item.roles.includes('System Admin')) {
      return item.roles.includes(user?.role ?? '');
    }

    // Super roles (Client Admin) see everything except System Admin items
    if (isSuper) return true;

    // Guest: limited read-only access
    if (user?.role === 'Guest') {
      return ['Dashboard', 'Client Profiles', 'Pipeline', 'Workflows', 'Campaigns'].includes(item.permission ? item.permission.split('.')[0] : 'dashboard');
    }

    // Permission-based access
    if (!item.permission) return true; // no permission required ? visible
    const legacyIds = (PERMISSION_BRIDGE as Record<string, string[]>)[item.permission] ?? [];
    return userPermissions.includes(item.permission) ||
           legacyIds.some(id => userPermissions.includes(id));
  };

  const filteredNav = navItems.filter(item => hasAccess(item));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0c0f] font-sans selection:bg-blue-500 selection:text-white transition-colors duration-300">
      <CommandPalette navigate={navigate} isOpen={isCommandPaletteOpen} setIsOpen={setIsCommandPaletteOpen} />
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50 bg-white/[0.01] dark:bg-[#0d0f14] backdrop-blur-none border-r border-white/[0.04]
        transform transition-all duration-300 ease-in-out flex flex-col shadow-xl lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-20' : 'lg:w-52'} w-52
      `}>
        {/* Logo/Header */}
        <div className={`border-b border-white/[0.04] p-3 shrink-0 flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'}`}>
          <div 
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate('dashboard')}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white bg-opacity-95 ring-1 ring-blue-500/20 overflow-hidden shrink-0">
              <img 
                src="/leadcrm_logo.png" 
                alt="LeadCRM Logo" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {!isCollapsed && (
              <h1 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                LeadCRM
              </h1>
            )}
          </div>

          {/* Desktop Sidebar Toggle Button */}
          <button 
            onClick={toggleDesktopSidebar}
            className="hidden lg:flex text-slate-500 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-white/[0.05] transition-colors cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
          </button>

          {/* Mobile Close Button */}
          <button className="lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded cursor-pointer" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto custom-scrollbar">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            
            return (
              <button
                key={item.path + item.name}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                title={isCollapsed ? item.name : undefined}
                className={`
                  w-full flex items-center rounded-sm text-xs font-medium transition-all cursor-pointer group relative
                  ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-1.5 gap-2' : 'py-1.5 gap-2'}
                  ${isActive 
                    ? "text-white border-l-2 border-blue-500 pl-[14px] bg-white/[0.03] pr-3"
                    : "text-slate-500 dark:text-slate-500 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent pl-[14px] pr-3"}
                `}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`truncate w-full text-left ${isCollapsed ? 'lg:hidden' : 'block'}`}>{item.name}</span>
                
                {/* Tooltip on desktop when collapsed */}
                {isCollapsed && (
                  <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl whitespace-nowrap z-50 border border-slate-700 pointer-events-none items-center">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Settings sticky footer link */}
        <div className="shrink-0 border-t border-white/[0.04] px-2 pt-2 pb-1">
          <button
            onClick={() => { navigate('settings'); setSidebarOpen(false); }}
            title={isCollapsed ? 'Settings' : undefined}
            className={`w-full flex items-center rounded-sm text-xs font-medium transition-all cursor-pointer group relative
              ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-1.5 gap-2' : 'py-1.5 gap-2'}
              ${currentPath === 'settings' 
                ? 'text-white border-l-2 border-blue-500 pl-[14px] pr-3 bg-white/[0.03]'
                : 'text-slate-500 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent pl-[14px] pr-3'
              }
            `}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'block'}`}>Settings</span>
            {isCollapsed && (
              <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl whitespace-nowrap z-50 border border-slate-700 pointer-events-none items-center">
                Settings
              </div>
            )}
          </button>
        </div>

        {/* User Info & Logout */}
        <div className="shrink-0 border-t border-white/[0.04] p-2 relative" id="account-dropdown-container">
          
          {/* Custom Dropdown Menu (Popup) */}
          {isAccountDropdownOpen && (
            <div className={`absolute bottom-full mb-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-50 overflow-hidden text-sm flex flex-col py-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ${isCollapsed ? 'left-2 w-64' : 'left-4 right-4'}`}>
              
              {/* Header profile block */}
              <div className="px-4 py-3 flex flex-col items-start bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="font-extrabold text-slate-900 dark:text-white truncate max-w-full">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full mt-0.5">
                  {user?.email}
                </div>
                
                {/* Red role pill below email */}
                <div className="mt-2.5">
                  <span className="px-2.5 py-0.5 bg-red-500 text-white text-[10px] font-extrabold rounded-md uppercase tracking-wide flex items-center gap-1 select-none">
                    <Shield size={10} />
                    <span>{user?.role === 'Client Admin' ? 'Admin' : user?.role || 'User'}</span>
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06] my-1" />

              {/* Menu items */}
              <button
                onClick={() => {
                  setIsAccountDropdownOpen(false);
                  navigate('profile-settings');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2.5 font-semibold text-xs cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <span className="text-slate-500 dark:text-slate-400">
                    <User size={13} />
                  </span>
                </div>
                <span>Profile Settings</span>
              </button>

              {user?.role === 'Client Admin' && (
                <button
                  onClick={() => {
                    setIsAccountDropdownOpen(false);
                    navigate('account-details');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2.5 font-semibold text-xs cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <span className="text-slate-500 dark:text-slate-400">
                      <Shield size={13} />
                    </span>
                  </div>
                  <span>Account Details</span>
                </button>
              )}

              {/* Demo users list / role switcher */}
              <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06] my-1" />
              <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Switch Role / Demo Host
              </div>
              
              <div className="max-h-28 overflow-y-auto">
                {(() => {
                  const storedVal = localStorage.getItem('leadcrm_users');
                  const usersToRender = storedVal ? JSON.parse(storedVal) : MOCK_USERS;
                  return (usersToRender && usersToRender.length > 0) ? usersToRender : MOCK_USERS;
                })().map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setIsAccountDropdownOpen(false);
                      login(u.email).then(() => {
                        toast.success(`Switched account to: ${u.firstName} ${u.lastName} (${u.role})`);
                      });
                    }}
                    className={`w-full text-left px-4 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between text-xs ${user?.id === u.id ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}
                  >
                    <div className="flex flex-col truncate">
                      <span className={`font-semibold ${user?.id === u.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {u.role || 'User'}
                      </span>
                    </div>
                    {user?.id === u.id && (
                      <Check className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06] my-1" />

              <button
                onClick={() => {
                  setIsAccountDropdownOpen(false);
                  logout().then(() => {
                    toast.success('Logged out successfully');
                  });
                }}
                className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-2.5 font-semibold text-xs cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                  <LogOut size={13} className="text-rose-500 shrink-0" />
                </div>
                <span>Log out</span>
              </button>

            </div>
          )}

          {/* Active Profile Trigger Bar */}
          <div 
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className={`flex items-center rounded-sm hover:bg-white/[0.04] p-1.5 transition-all select-none cursor-pointer border border-transparent active:scale-[0.98] ${isCollapsed ? 'lg:justify-center' : 'gap-2'}`}
            title={isCollapsed ? `${user?.firstName} ${user?.lastName} (${user?.email})` : undefined}
          >
            {/* Round Avatar Circle */}
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-[10px] shrink-0 border border-white/[0.06]">
              {user?.firstName?.charAt(0) || 'U'}{user?.lastName?.charAt(0) || 'P'}
            </div>

            {/* Profile Text Info on Right */}
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-transparent relative">
        {/* Topbar */}
        <header className="h-16 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile Menu Button */}
            <button className="lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 transition-colors cursor-pointer" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Role Switcher for Demo */}
            {user?.tenantId !== 'system' && (
              <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-white/[0.02] px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/[0.08]">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-500">Role:</span>
                <select 
                  value={user?.role}
                  onChange={(e) => switchRole(e.target.value)}
                  className="bg-transparent text-xs font-medium text-gray-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.name} className="dark:bg-slate-900">{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {user?.role === 'System Admin' && (
              <button 
                onClick={resetDemoData}
                className="text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-medium border border-red-200 dark:border-red-500/30 cursor-pointer"
              >
                Reset Demo
              </button>
            )}



            <button
              onClick={() => {
                const nextTheme = theme === 'Light' ? 'Dark' : 'Light';
                setTheme(nextTheme);
                localStorage.setItem('app_theme', nextTheme);
                if (nextTheme === 'Light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.remove('light');
                  document.documentElement.classList.add('dark');
                }
                window.dispatchEvent(new Event('themechange'));
              }}
              className="relative p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05]"
              title={`Switch to ${theme === 'Light' ? 'Dark' : 'Light'} Mode`}
              id="header-theme-toggle"
            >
              {theme === 'Light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400" />
              )}
            </button>
            
            {/* Quick Action Notes Trigger Button */}
            <button
              onClick={() => setNotesOpen(true)}
              className="relative p-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors rounded-full hover:bg-blue-500/10"
              title="Open Scratchpad Notes"
              id="header-notes-toggle"
            >
              <StickyNote className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-slate-100 dark:border-slate-900 animate-bounce"></span>
            </button>
            
            <button className="relative p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05]">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-50 dark:border-slate-950"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 custom-scrollbar relative">
          {children}
        </div>
      </main>

      {/* Quick Scratchpad Side Panel */}
      <NotesSidePanel isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}
