import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../store/AuthContext';
import { useData } from '../../../store/DataContext';
import { MOCK_USERS } from '../../../store/mockData';
import { 
  LayoutDashboard, Users, Briefcase, 
  Workflow, Mail, Settings, LogOut, Menu, X, Shield, Search, Bell, Wrench,
  Package, Receipt, Building2, CreditCard, Activity, ListTodo, Layers,
  Sun, Moon, StickyNote, ChevronDown, Check, Book, User
} from 'lucide-react';
import CommandPalette from '../../../shared/components/CommandPalette';
import NotesSidePanel from '../contacts/NotesSidePanel';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  navigate: (path: string) => void;
}

export default function Layout({ children, currentPath, navigate }: LayoutProps) {
  const { user, tenant, login, logout, switchRole } = useAuth();
  const { resetDemoData, isServiceModuleEnabled, isAssetModuleEnabled, isBillingModuleEnabled, roles, users: dbUsers } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'Light' | 'Dark'>('Dark');
  const [notesOpen, setNotesOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

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

  const userRoleDef = roles.find(r => r.name === user?.role);
  const userPermissions = userRoleDef?.permissions || [];

  const navItems = [
    { name: 'Dashboard', path: 'dashboard', icon: LayoutDashboard, permissions: ['p1'] },
    { name: 'My Jobs', path: 'technician-jobs', icon: Wrench, roles: ['Technician'] },
    { name: 'Client Profiles', path: 'contacts', icon: Users, permissions: ['p2', 'p2_own'] },
    { name: 'Pipeline', path: 'pipeline', icon: Briefcase, permissions: ['p7', 'p7_own'] },
    { name: 'Tasks', path: 'tasks', icon: ListTodo, permissions: ['p1', 'p2', 'p7'] },
    { name: 'Service Orders', path: 'service-orders', icon: Wrench, permissions: ['p7', 'p7_own'], enabled: isServiceModuleEnabled },
    { name: 'Asset Tracking', path: 'assets', icon: Package, permissions: ['p37'], enabled: isAssetModuleEnabled },
    { name: 'Inventory', path: 'inventory', icon: Layers, permissions: ['p35'], enabled: isAssetModuleEnabled },
    { name: 'Contract Billing', path: 'billing', icon: Receipt, permissions: ['p29'], enabled: isBillingModuleEnabled },
    { name: 'Workflows', path: 'workflows', icon: Workflow, permissions: ['p12'] },
    { name: 'Campaigns', path: 'campaigns', icon: Mail, permissions: ['p17'] },
    { name: 'Users', path: 'users', icon: Users, permissions: ['p22'] },
    { name: 'Account Details', path: 'account-details', icon: Shield, roles: ['Client Admin'] },
    { name: 'Audit Trail', path: 'audit-log', icon: Activity, permissions: ['p27'] },
    { name: 'Dashboard', path: 'admin-dashboard', icon: LayoutDashboard, roles: ['System Admin'] },
    { name: 'Client Management', path: 'admin-clients', icon: Building2, roles: ['System Admin'] },
    { name: 'Pricing', path: 'admin-pricing', icon: CreditCard, roles: ['System Admin'] },
    { name: 'Billing', path: 'admin-billing', icon: Receipt, roles: ['System Admin'] },
    { name: 'Environment Health', path: 'admin-environments', icon: Activity, roles: ['System Admin'] },
    { name: 'Audit Trail', path: 'audit-log', icon: Activity, roles: ['System Admin'] },
  ];

  const hasAccess = (item: any) => {
    // System Admin explicit check
    if (user?.role === 'System Admin') {
      return item.roles?.includes('System Admin');
    }
    
    // Client Admin sees everything except System Admin pages
    if (user?.role === 'Client Admin') {
      return !item.roles?.includes('System Admin');
    }

    // Guest sees specific read-only modules
    if (user?.role === 'Guest') {
      return ['Dashboard', 'Client Profiles', 'Pipeline', 'Workflows', 'Campaigns'].includes(item.name);
    }

    // Technician only sees their own pages
    if (user?.role === 'Technician') {
      return item.roles?.includes('Technician') || item.name === 'My Jobs';
    }

    // For all other roles (Sales Rep, Viewer, custom roles): check permissions
    // Also skip any System Admin-only nav items
    if (item.roles?.includes('System Admin')) return false;
    if (item.roles?.includes('Client Admin') && !item.permissions) return false;

    // If this nav item declares explicit role access, check it
    if (item.roles && item.roles.includes(user?.role)) return true;

    // Check permission-based access
    if (item.permissions && item.permissions.some((p: string) => userPermissions.includes(p))) return true;

    // Fallback: if the role exists in the system but has no permissions matched,
    // at least show Dashboard so the user isn't locked out with a blank screen
    if (userPermissions.length === 0 && item.name === 'Dashboard' && item.path === 'dashboard') return true;

    return false;
  };

  const filteredNav = navItems.filter(item => 
    hasAccess(item) && 
    (item.enabled === undefined || item.enabled === true)
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500 selection:text-white transition-colors duration-300">
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
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-md border-r border-slate-200/60 dark:border-white/[0.05]
        transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo/Header */}
        <div className="border-b border-gray-200 dark:border-white/[0.08] p-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white bg-opacity-95 ring-1 ring-blue-500/20 overflow-hidden shrink-0">
              <img 
                src="/leadcrm_logo.png" 
                alt="LeadCRM Logo" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                LeadCRM
              </h1>
            </div>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-lg" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto custom-scrollbar">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            
            return (
              <button
                key={item.path + item.name}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                  ${isActive 
                    ? "bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20"
                    : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white"}
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate w-full text-left">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="shrink-0 border-t border-gray-200 dark:border-white/[0.08] p-4 relative" id="account-dropdown-container">
          
          {/* Custom Dropdown Menu (Popup) */}
          {isAccountDropdownOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-50 overflow-hidden text-sm flex flex-col py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              
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
                      login(u.email);
                      toast.success(`Switched account to: ${u.firstName} ${u.lastName} (${u.role})`);
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
                  logout();
                  toast.success('Logged out successfully');
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

          {/* Active Profile Trigger Bar (matches Part B of Image 1) */}
          <div 
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className="flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.04] p-2 transition-all select-none cursor-pointer border border-transparent active:scale-[0.98]"
          >
            {/* Round Avatar Circle */}
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 font-extrabold text-xs shrink-0 shadow-xs border border-slate-300/40 dark:border-white/[0.04]">
              {user?.firstName?.charAt(0) || 'U'}{user?.lastName?.charAt(0) || 'P'}
            </div>

            {/* Profile Text Info on Right */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {user?.email}
              </p>
            </div>
          </div>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-transparent relative">
        {/* Topbar */}
        <header className="h-16 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-4 flex-1">
            <button 
              className="lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/[0.05] p-2 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
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

      {/* Floating Sticky Note Trigger */}
      <button
        onClick={() => setNotesOpen(true)}
        className="fixed bottom-6 right-6 p-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-2xl z-40 transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer group border border-blue-400/40"
        title="Quick Scratchpad Notes"
        id="floating-notes-toggle"
      >
        <StickyNote size={20} className="group-hover:rotate-12 transition-transform" />
      </button>

      {/* Quick Scratchpad Side Panel */}
      <NotesSidePanel isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}
