'use client';

import React, { useState, useEffect } from "react";
import { useData } from "@/store/DataContext";
import { useAuth } from "@/store/AuthContext";
import {
  Shield,
  Building2,
  Search,
  Users,
  Lock,
  Globe,
  Mail,
  Phone,
  MapPin,
  Save,
  Layout,
  X,
  RefreshCw,
  ChevronDown,
  Receipt,
  Clock,
  DollarSign,
  Link,
  Palette,
  Moon,
  Sun,
  Monitor,
  Info,
  Archive,
  Camera,
  User,
  Building,
  CreditCard,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FormsTab } from './forms-tab';
import { TeamManagement } from './team-management';
import { RolesPermissions } from './roles-permissions';

type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'memberships'
  | 'org-general'
  | 'users'
  | 'roles'
  | 'custom-fields'
  | 'archived'
  | 'account-details'
  | 'plan'
  | 'billing'
  | 'forms';

interface NavGroup {
  label: string;
  items: { id: SettingsTab; label: string; icon: React.ElementType }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'GENERAL',
    items: [
      { id: 'profile', label: 'Profile Settings', icon: User },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'memberships', label: 'Memberships', icon: Building },
    ],
  },
  {
    label: 'ORGANIZATION',
    items: [
      { id: 'org-general', label: 'General', icon: Building2 },
      { id: 'users', label: 'Team Management', icon: Users },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    ],
  },
  {
    label: 'CUSTOMIZATION',
    items: [
      { id: 'custom-fields', label: 'Custom Fields', icon: Zap },
      { id: 'archived', label: 'Archived Data', icon: Archive },
    ],
  },
  {
    label: 'CONNECT',
    items: [
      { id: 'forms', label: 'Forms', icon: Layout },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { id: 'account-details', label: 'Account Details', icon: Shield },
      { id: 'plan', label: 'Plan & Usage', icon: CreditCard },
      { id: 'billing', label: 'Payment Methods', icon: Receipt },
    ],
  },
];

export default function SettingsPage(): React.ReactElement {
  const { user, tenant, updateProfile } = useAuth();
  const {
    organizations,
    contacts,
    deals,
    pipelines,
    workflows,
    campaigns,
    templates,
    users,
    roles,
    restoreRecord,
    isServiceModuleEnabled,
    toggleServiceModule,
    isAssetModuleEnabled,
    toggleAssetModule,
    isBillingModuleEnabled,
    toggleBillingModule,
    updateTenant,
  } = useData();

  const userRoleDef = roles.find((r) => r.name === user?.role);
  const userPerms = userRoleDef?.permissions || [];
  const isClientAdmin = user?.role === "Client Admin";
  const canEditSettings = isClientAdmin || userPerms.includes("p28");

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isFormBuilderActive, setIsFormBuilderActive] = useState(false);
  const [isRolesViewActive, setIsRolesViewActive] = useState(false);

  // Organization state
  const [orgName, setOrgName] = useState(tenant?.name || "");
  const [orgEmail, setOrgEmail] = useState(tenant?.email || "");
  const [orgPhone, setOrgPhone] = useState(tenant?.phone || "");
  const [orgAddress, setOrgAddress] = useState(tenant?.address || "");
  const [orgIndustry, setOrgIndustry] = useState(tenant?.industry || "");
  const [orgTimezone, setOrgTimezone] = useState(tenant?.timezone || "UTC");
  const [orgCurrency, setOrgCurrency] = useState(tenant?.currency || "USD");
  const [orgDomain, setOrgDomain] = useState(tenant?.domain || "");

  // Appearance state
  const [appTheme, setAppTheme] = useState(localStorage.getItem("app_theme") || "Light");
  const [appFontSize, setAppFontSize] = useState(localStorage.getItem("app_font_size") || "Medium");

  // Account (profile) state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [jobTitle, setJobTitle] = useState(user?.role === "Client Admin" ? "System Administrator" : user?.role || "");
  const [department, setDepartment] = useState("IT");
  const [timezone, setTimezone] = useState("UTC-5  Â· Eastern Time");
  const [language, setLanguage] = useState("English (US)");

  // Archived filter
  const [archivedFilter, setArchivedFilter] = useState<string>("All");

  useEffect(() => {
    const handleSync = () => { setAppTheme(localStorage.getItem("app_theme") || "Light"); };
    window.addEventListener("themechange", handleSync);
    return () => window.removeEventListener("themechange", handleSync);
  }, []);

  const handleSaveAppearance = (): void => {
    localStorage.setItem("app_theme", appTheme);
    localStorage.setItem("app_font_size", appFontSize);

    // Apply theme to the CRM container
    const container = document.querySelector('[data-theme-container]');
    if (container) {
      container.classList.remove('dark', 'theme-classic', 'theme-light', 'theme-dark');

      if (appTheme === "Dark") {
        container.classList.add("dark", "theme-dark");
      } else if (appTheme === "Classic") {
        container.classList.add("theme-classic");
      } else if (appTheme === "System") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          container.classList.add("dark", "theme-dark");
        } else {
          container.classList.add("theme-light");
        }
      } else {
        container.classList.add("theme-light");
      }
    }

    let size = "16px";
    if (appFontSize === "Small") size = "14px";
    if (appFontSize === "Large") size = "18px";
    document.documentElement.style.fontSize = size;
    toast.success("Appearance settings saved successfully");

    const resolved = appTheme === "Dark" ? "dark" : appTheme === "Classic" ? "classic" : appTheme === "System" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : "light";
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: resolved, mode: appTheme } }));
  };

  const handleSaveAccount = (e: React.FormEvent): void => {
    e.preventDefault();
    updateProfile({ firstName, lastName, email, phone, role: user?.role || "Client Admin" });
    toast.success("Profile updated successfully!");
  };

  const handleSaveOrganization = (): void => {
    if (tenant) {
      updateTenant(tenant.id, { name: orgName, email: orgEmail, phone: orgPhone, address: orgAddress, industry: orgIndustry, timezone: orgTimezone, currency: orgCurrency, domain: orgDomain });
      toast.success("Organization settings saved successfully");
    }
  };

  // â”€â”€ Profile Settings Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderProfileTab = (): React.ReactElement => (
    <form onSubmit={handleSaveAccount} className="space-y-6 max-w-2xl">
      {/* Profile Banner */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[#25313D] via-[#2E3B48] to-[#384653] relative" />
        <div className="p-5 pt-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 -mt-8 sm:items-end">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D94F4F] to-[#25313D] border-4 border-white dark:border-slate-900 flex items-center justify-center text-white text-lg font-bold shadow-md">
                {firstName.charAt(0)}{lastName.charAt(0)}
              </div>
              <button type="button" onClick={() => toast.info("Avatar upload simulated.")}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform cursor-pointer"
                aria-label="Change profile photo">
                <Camera size={11} />
              </button>
            </div>
            <div className="pb-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{firstName} {lastName}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role || "Administrator"} Â· {tenant?.name || "Organization"}</p>
            </div>
          </div>
          <span className="pb-1 px-2.5 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg border border-red-500/10 flex items-center gap-1.5 w-fit">
            <Shield size={11} /> {user?.role === "Client Admin" ? "Administrator" : user?.role || "Admin"}
          </span>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Personal Information</h3>
          <p className="text-xs text-slate-400 mt-0.5">Your name and contact details visible to teammates</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="profile-first-name">First Name</label>
            <input id="profile-first-name" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="profile-last-name">Last Name</label>
            <input id="profile-last-name" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="profile-email">Email Address</label>
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="profile-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="profile-phone">Phone Number</label>
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="profile-phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="profile-job-title">Job Title</label>
            <input id="profile-job-title" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="profile-department">Department</label>
            <input id="profile-department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock size={14} className="text-[#D94F4F]" /> Security
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Manage your password and two-factor authentication</p>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Password</p>
            <p className="text-[10px] text-slate-400">Last changed: Never</p>
          </div>
          <button type="button" onClick={() => toast.info("Password change simulated.")}
            className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer">
            Change Password
          </button>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Two-Factor Authentication</p>
            <p className="text-[10px] text-slate-400">Adds an extra layer of security</p>
          </div>
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/20">Not enabled</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="flex items-center gap-2 bg-[#D94F4F] hover:bg-[#C24545] text-white font-semibold px-5 py-2 rounded-lg text-xs transition-all shadow-sm cursor-pointer">
          <Save size={13} /> Save Changes
        </button>
      </div>
    </form>
  );

  // â”€â”€ Account Details Tab (Admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAccountDetailsTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#D94F4F]" /> Account Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Name</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{tenant?.name || 'N/A'}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account ID</p>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{tenant?.id || 'N/A'}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subscription Plan</p>
            <span className="px-2 py-0.5 bg-[#D94F4F]/10 text-[#D94F4F] dark:text-[#E05A5A] text-[10px] font-bold rounded-full border border-[#D94F4F]/20">Professional</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">Active</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{tenant?.industry || 'Not set'}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Domain</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{tenant?.domain || 'Not configured'}</p>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#D94F4F]" /> Billing Summary
        </h3>
        <div className="flex items-center justify-between p-4 bg-[#D94F4F]/5 border border-[#D94F4F]/20 rounded-xl">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Professional Plan Â· Monthly</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Next billing: September 8, 2026</p>
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">$99<span className="text-[10px] text-slate-400 font-normal">/mo</span></p>
        </div>
      </div>
    </div>
  );

  // â”€â”€ Account Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAccountTab = (): React.ReactElement => (
    <form onSubmit={handleSaveAccount} className="space-y-6 max-w-2xl">
      {/* Profile Banner */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-slate-200 via-slate-150 to-slate-100 dark:from-slate-800 dark:to-slate-850 relative" />
        <div className="p-5 pt-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 -mt-8 sm:items-end">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-slate-800 border-4 border-white dark:border-slate-900 flex items-center justify-center text-white text-lg font-bold shadow-md">
                {firstName.charAt(0)}{lastName.charAt(0)}
              </div>
              <button type="button" onClick={() => toast.info("Avatar upload simulated.")}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform cursor-pointer"
                aria-label="Change profile photo">
                <Camera size={11} />
              </button>
            </div>
            <div className="pb-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{firstName} {lastName}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role || "Administrator"} Â· {tenant?.name || "Organization"}</p>
            </div>
          </div>
          <span className="pb-1 px-2.5 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg border border-red-500/10 flex items-center gap-1.5 w-fit">
            <Shield size={11} /> {user?.role === "Client Admin" ? "Administrator" : user?.role || "Admin"}
          </span>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Basic Information</h3>
          <p className="text-xs text-slate-400 mt-0.5">Your name and contact details visible to teammates</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="settings-first-name">First Name</label>
            <input id="settings-first-name" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="settings-last-name">Last Name</label>
            <input id="settings-last-name" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="settings-email">Email Address</label>
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="settings-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="settings-phone">Phone Number</label>
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="settings-phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="settings-job-title">Job Title</label>
            <input id="settings-job-title" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider" htmlFor="settings-department">Department</label>
            <input id="settings-department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="flex items-center gap-2 bg-[#D94F4F] hover:bg-[#C24545] text-white font-semibold px-5 py-2 rounded-lg text-xs transition-all shadow-sm cursor-pointer">
          <Save size={13} /> Save Changes
        </button>
      </div>
    </form>
  );

  // â”€â”€ Appearance Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAppearanceTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-[#25313D] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#D94F4F]" /> System Appearance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose how LeadCRM looks to you. Select a theme below.</p>
        </div>

        {/* Theme Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { id: "Classic", icon: Layout, desc: "Dark sidebar + Light", preview: { bg: "#F5F6F7", sidebar: "#25313D", card: "#FFFFFF", accent: "#D94F4F" } },
            { id: "Light", icon: Sun, desc: "Fully light", preview: { bg: "#F5F6F7", sidebar: "#FFFFFF", card: "#FFFFFF", accent: "#D94F4F" } },
            { id: "Dark", icon: Moon, desc: "Fully dark", preview: { bg: "#1B252F", sidebar: "#1B252F", card: "#2E3B48", accent: "#D94F4F" } },
            { id: "System", icon: Monitor, desc: "Match your OS", preview: { bg: "#E8ECF0", sidebar: "#E8ECF0", card: "#FFFFFF", accent: "#D94F4F" } },
          ] as const).map((theme) => {
            const isSelected = appTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  setAppTheme(theme.id);
                  // Apply immediately for live preview
                  localStorage.setItem("app_theme", theme.id);
                  const container = document.querySelector('[data-theme-container]');
                  if (container) {
                    container.classList.remove('dark', 'theme-classic', 'theme-light', 'theme-dark');
                    if (theme.id === "Dark") {
                      container.classList.add("dark", "theme-dark");
                    } else if (theme.id === "Classic") {
                      container.classList.add("theme-classic");
                    } else if (theme.id === "System") {
                      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                      if (prefersDark) container.classList.add("dark", "theme-dark");
                      else container.classList.add("theme-light");
                    } else {
                      container.classList.add("theme-light");
                    }
                  }
                  const resolved = theme.id === "Dark" ? "dark" : theme.id === "Classic" ? "classic" : theme.id === "System" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : "light";
                  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: resolved, mode: theme.id } }));
                }}
                aria-pressed={isSelected}
                aria-label={`Select ${theme.id} theme`}
                className={cn(
                  'relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D94F4F]/40',
                  isSelected
                    ? 'border-[#D94F4F]/60 bg-[#D94F4F]/[0.04] shadow-sm'
                    : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14] bg-white dark:bg-white/[0.02]'
                )}
              >
                {/* Selection indicator dot */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#D94F4F]" />
                )}

                {/* Mini theme preview */}
                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden border border-gray-100 dark:border-white/[0.06] shadow-sm">
                  <div className="w-full h-full flex" style={{ backgroundColor: theme.preview.bg }}>
                    <div className="w-[22%] h-full" style={{ backgroundColor: theme.preview.sidebar }} />
                    <div className="flex-1 p-1.5 flex flex-col gap-1">
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: theme.preview.accent, opacity: 0.6 }} />
                      <div className="flex-1 rounded" style={{ backgroundColor: theme.preview.card, border: '1px solid rgba(0,0,0,0.06)' }} />
                    </div>
                  </div>
                </div>

                {/* Label */}
                <div className="text-center">
                  <div className={cn(
                    'text-xs font-semibold',
                    isSelected ? 'text-[#D94F4F]' : 'text-slate-700 dark:text-slate-200'
                  )}>{theme.id}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{theme.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Interface Density */}
        <div className="pt-5 border-t border-gray-200 dark:border-white/[0.06]">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Interface Density</label>
          <div className="flex gap-3">
            {(["Small", "Medium", "Large"] as const).map((size) => (
              <button key={size} onClick={() => setAppFontSize(size)}
                aria-pressed={appFontSize === size}
                className={cn(
                  'px-4 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer',
                  appFontSize === size
                    ? 'border-[#D94F4F]/50 bg-[#D94F4F]/[0.06] text-[#D94F4F] dark:text-[#E05A5A]'
                    : 'border-gray-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-white/[0.12]'
                )}>
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Apply button */}
        <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-white/[0.06]">
          <button onClick={handleSaveAppearance}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#D94F4F] hover:bg-[#C24545] text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer">
            <Save className="w-3.5 h-3.5" /> Apply Changes
          </button>
        </div>
      </div>
    </div>
  );

  // â”€â”€ Memberships Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderMembershipsTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Building size={14} className="text-[#D94F4F]" /> Organization Membership
        </h3>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
            <Building2 size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tenant?.name || "Organization"}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{user?.role || "Member"}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Contact a system administrator to change your organization membership.</p>
      </div>
    </div>
  );

  // â”€â”€ Org General Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderOrgGeneralTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-name">Organization Name</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input id="org-name" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-industry">Industry</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input id="org-industry" type="text" value={orgIndustry} onChange={(e) => setOrgIndustry(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-email">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input id="org-email" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-phone">Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input id="org-phone" type="text" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-domain">Domain</label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input id="org-domain" type="text" value={orgDomain} onChange={(e) => setOrgDomain(e.target.value)} placeholder="e.g., example.com"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-timezone">Timezone</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select id="org-timezone" value={orgTimezone} onChange={(e) => setOrgTimezone(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors appearance-none">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Asia/Manila">Philippine Time (PHT)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-currency">Currency</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select id="org-currency" value={orgCurrency} onChange={(e) => setOrgCurrency(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors appearance-none">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (â‚¬)</option>
              <option value="GBP">GBP (Â£)</option>
              <option value="PHP">PHP (â‚±)</option>
              <option value="AUD">AUD ($)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="org-address">Office Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500" />
            <textarea id="org-address" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} rows={2}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D94F4F] transition-colors resize-none" />
          </div>
        </div>
      </div>
      {canEditSettings && (
        <div className="flex justify-end">
          <button onClick={handleSaveOrganization}
            className="flex items-center gap-2 px-5 py-2 bg-[#D94F4F] hover:bg-[#C24545] text-white rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer">
            <Save className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      )}
    </div>
  );

  // â”€â”€ Users (Team Management) Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderUsersTab = (): React.ReactElement => <TeamManagement />;

  // â”€â”€ Archived Data Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderArchivedTab = (): React.ReactElement => {
    const allArchived = [
      ...organizations.filter((o) => o.isArchived).map((o) => ({ type: "Organization", id: o.id, name: o.name })),
      ...contacts.filter((c) => c.isArchived).map((c) => ({ type: "Contact", id: c.id, name: c.contactPerson + " (" + c.companyName + ")" })),
      ...deals.filter((d) => d.isArchived).map((d) => ({ type: "Deal", id: d.id, name: d.title })),
      ...pipelines.filter((p) => p.isArchived).map((p) => ({ type: "Pipeline", id: p.id, name: p.name })),
      ...workflows.filter((w) => w.isArchived).map((w) => ({ type: "Workflow", id: w.id, name: w.name })),
      ...campaigns.filter((c) => c.isArchived).map((c) => ({ type: "Campaign", id: c.id, name: c.name })),
      ...templates.filter((t) => t.isArchived).map((t) => ({ type: "Template", id: t.id, name: t.name })),
      ...roles.filter((r) => r.isArchived).map((r) => ({ type: "Role", id: r.id, name: r.name })),
      ...users.filter((u) => u.isArchived).map((u) => ({ type: "User", id: u.id, name: `${u.firstName} ${u.lastName}` })),
    ];
    const filteredArchived = archivedFilter === "All" ? allArchived : allArchived.filter((x) => x.type === archivedFilter);

    return (
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Archived Data Recovery</h3>
            <p className="text-xs text-slate-400 mt-0.5">Restore records previously archived instead of deleted.</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["All", "Contact", "Organization", "Deal", "Pipeline", "User", "Role", "Workflow", "Campaign", "Template"].map((type) => (
            <button key={type} onClick={() => setArchivedFilter(type)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${archivedFilter === type ? "bg-[#D94F4F] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              {type}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredArchived.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No archived records found.</p>
            </div>
          ) : (
            filteredArchived.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-[#D94F4F] uppercase tracking-wider">{item.type}</span>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">{item.name}</p>
                </div>
                <button onClick={() => { restoreRecord(item.type as Parameters<typeof restoreRecord>[0], item.id); toast.success(`${item.type} restored`); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D94F4F]/10 hover:bg-[#D94F4F]/15 dark:bg-[#D94F4F]/10 dark:hover:bg-[#D94F4F]/20 text-[#D94F4F] dark:text-[#E05A5A] rounded-lg text-xs font-semibold transition-colors cursor-pointer">
                  <RefreshCw size={12} /> Restore
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // â”€â”€ Plan & Billing Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderPlanTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#D94F4F]" /> Plan & Usage
        </h3>
        <div className="flex items-center justify-between p-4 bg-[#D94F4F]/5 dark:bg-[#D94F4F]/10 border border-[#D94F4F]/20 rounded-xl">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Professional Plan</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Active subscription</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">Active</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Users", used: users.filter((u) => !u.isArchived).length, limit: 25 }, { label: "Contacts", used: contacts.filter((c) => !c.isArchived).length, limit: 10000 }, { label: "Campaigns", used: campaigns.filter((c) => !c.isArchived).length, limit: 50 }].map((item) => (
            <div key={item.label} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-white/[0.05]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{item.used}<span className="text-xs text-slate-400 font-normal"> / {item.limit}</span></p>
              <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-[#D94F4F] rounded-full" style={{ width: `${Math.min(100, Math.round((item.used / item.limit) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBillingTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#D94F4F]" /> Payment Methods
        </h3>
        <div className="p-4 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-center">
          <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No payment methods on file.</p>
          <button className="mt-3 px-4 py-2 bg-[#D94F4F] hover:bg-[#C24545] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer">Add Payment Method</button>
        </div>
      </div>
    </div>
  );

  const renderCustomFieldsTab = (): React.ReactElement => (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#D94F4F]" /> Custom Fields
        </h3>
        <div className="text-center py-8 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
          <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Custom fields configuration coming soon.</p>
        </div>
      </div>
    </div>
  );

  const tabContentMap: Record<Exclude<SettingsTab, 'forms' | 'roles'>, () => React.ReactElement> = {
    'profile': renderProfileTab,
    'appearance': renderAppearanceTab,
    'memberships': renderMembershipsTab,
    'org-general': renderOrgGeneralTab,
    'users': renderUsersTab,
    'custom-fields': renderCustomFieldsTab,
    'archived': renderArchivedTab,
    'account-details': renderAccountDetailsTab,
    'plan': renderPlanTab,
    'billing': renderBillingTab,
  };

  const activeGroup = NAV_GROUPS.find((g) => g.items.some((i) => i.id === activeTab));
  const activeItem = activeGroup?.items.find((i) => i.id === activeTab);

  return (
    <div className="flex h-full -m-4 lg:-m-8 min-h-[calc(100vh-4rem)]">
      {/* Left Sub-Nav */}
      <aside className="w-52 shrink-0 border-r border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#0a0c0f] overflow-y-auto custom-scrollbar py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setIsFormBuilderActive(false); setIsRolesViewActive(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left
                    ${isActive
                      ? 'border-l-2 border-[#D94F4F] pl-[14px] bg-[#D94F4F]/5 dark:bg-[#D94F4F]/[0.08] text-[#D94F4F] dark:text-[#E05A5A]'
                      : 'border-l-2 border-transparent text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                    }`}
                >
                  {React.createElement(Icon as any, { className: "w-3.5 h-3.5 shrink-0" })}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Right Content */}
      {(() => {
        const isFullPane =
          (activeTab === 'forms' && isFormBuilderActive) ||
          (activeTab === 'roles' && isRolesViewActive);
        // Tabs that render their own title/header internally â€” suppress the page header
        const hasOwnHeader = activeTab === 'users' || activeTab === 'roles' || (activeTab === 'forms' && isFormBuilderActive);

        return (
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${isFullPane ? '' : 'px-6 py-5'}`}>
            {!isFullPane && !hasOwnHeader && (
              <div className="mb-5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{activeItem?.label ?? 'Settings'}</h1>
              </div>
            )}
            {activeTab === 'forms'
              ? <FormsTab onBuilderActiveChange={setIsFormBuilderActive} />
              : activeTab === 'roles'
              ? <RolesPermissions onViewActiveChange={setIsRolesViewActive} />
              : tabContentMap[activeTab as Exclude<SettingsTab, 'forms' | 'roles'>]()
            }
          </div>
        );
      })()}
    </div>
  );
}
