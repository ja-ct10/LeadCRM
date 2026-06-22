import React, { useState, useEffect } from "react";
import { useData } from "../store/DataContext";
import { useAuth } from "../store/AuthContext";
import {
  Shield,
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Lock,
  Globe,
  Mail,
  Phone,
  MapPin,
  Save,
  Layout,
  Copy,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Wrench,
  Package,
  Receipt,
  CreditCard,
  Zap,
  Clock,
  DollarSign,
  Link,
  Check,
  Palette,
  Moon,
  Sun,
  Monitor,
  GitBranch,
  Network,
  ArrowRight,
  ShieldAlert,
  Layers,
  Info,
  Archive,
  HelpCircle,
  GitFork,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RoleDefinition } from "../store/types";
import { toast } from "sonner";

type MainTab = "Organization" | "Appearance" | "Archived Data";
type RoleSubTab = "Roles" | "Role Hierarchy" | "All Permissions";

export default function SettingsPage() {
  const { user, tenant } = useAuth();
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
    permissions,
    addRole,
    updateRole,
    deleteRole,
    restoreRecord,
    resetDemoData,
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
  const canManageRoles = isClientAdmin || userPerms.includes("p26");
  const canEditSettings = isClientAdmin || userPerms.includes("p28");
  const canManageBilling = isClientAdmin || userPerms.includes("p29");

  const [activeTab, setActiveTab] = useState<MainTab>("Organization");
  const [activeRoleSubTab, setActiveRoleSubTab] = useState<RoleSubTab>("Roles");
  const [searchQuery, setSearchQuery] = useState("");

  // Role Modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });
  const [copyFromRoleId, setCopyFromRoleId] = useState("");

  // Role Hierarchy State
  const [selectedHierarchyRoleId, setSelectedHierarchyRoleId] =
    useState<string>("r1");
  const [hierarchySearchQuery, setHierarchySearchQuery] = useState<string>("");

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
  const [appTheme, setAppTheme] = useState(
    localStorage.getItem("app_theme") || "Dark",
  );
  const [appAccent, setAppAccent] = useState(
    localStorage.getItem("app_accent_color") || "#3B82F6",
  );
  const [appFontSize, setAppFontSize] = useState(
    localStorage.getItem("app_font_size") || "Medium",
  );

  useEffect(() => {
    const handleSync = () => {
      setAppTheme(localStorage.getItem("app_theme") || "Dark");
    };
    window.addEventListener("themechange", handleSync);
    return () => window.removeEventListener("themechange", handleSync);
  }, []);

  const handleSaveAppearance = () => {
    localStorage.setItem("app_theme", appTheme);
    localStorage.setItem("app_accent_color", appAccent);
    localStorage.setItem("app_font_size", appFontSize);

    // Apply theme
    if (appTheme === "Light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else if (appTheme === "Dark") {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    } else {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    }

    // Apply accent
    document.documentElement.style.setProperty(
      "--color-blue-400",
      `color-mix(in srgb, ${appAccent} 85%, white)`,
    );
    document.documentElement.style.setProperty("--color-blue-500", appAccent);
    document.documentElement.style.setProperty(
      "--color-blue-600",
      `color-mix(in srgb, ${appAccent} 85%, black)`,
    );
    document.documentElement.style.setProperty(
      "--color-blue-700",
      `color-mix(in srgb, ${appAccent} 70%, black)`,
    );

    // Apply font size
    let size = "16px";
    if (appFontSize === "Small") size = "14px";
    if (appFontSize === "Large") size = "18px";
    document.documentElement.style.fontSize = size;

    toast.success("Appearance settings saved successfully");
    window.dispatchEvent(new Event("themechange"));
  };

  const renderAppearanceTab = () => (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-8 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-blue-500" />
          System Appearance
        </h3>

        <div className="space-y-8">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Theme Preference
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: "Light", icon: Sun, desc: "Clean and bright" },
                {
                  id: "Dark",
                  icon: Moon,
                  desc: "Cosmic slate & high contrast",
                },
                {
                  id: "System",
                  icon: Monitor,
                  desc: "Matches device settings",
                },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setAppTheme(theme.id)}
                  className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${
                    appTheme === theme.id
                      ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/5"
                      : "border-gray-200 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600 bg-gray-50 dark:bg-slate-800/20"
                  }`}
                >
                  <div
                    className={`p-3 rounded-full ${appTheme === theme.id ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "bg-gray-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}
                  >
                    <theme.icon className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {theme.id}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {theme.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-slate-700/50">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Accent Color
            </label>
            <div className="flex flex-wrap gap-4">
              {[
                { name: "Blue", color: "#3B82F6" },
                { name: "Indigo", color: "#6366f1" },
                { name: "Violet", color: "#8b5cf6" },
                { name: "Emerald", color: "#10b981" },
                { name: "Rose", color: "#f43f5e" },
                { name: "Amber", color: "#f59e0b" },
                { name: "Slate", color: "#64748b" },
              ].map((accent) => (
                <button
                  key={accent.color}
                  onClick={() => setAppAccent(accent.color)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    appAccent === accent.color
                      ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110"
                      : "hover:scale-105"
                  }`}
                  style={
                    {
                      backgroundColor: accent.color,
                      "--tw-ring-color": accent.color,
                    } as React.CSSProperties
                  }
                  title={accent.name}
                >
                  {appAccent === accent.color && (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              This color will be used for primary buttons, active states, and
              focus rings across the application.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-slate-700/50">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Interface Density & Text
            </label>
            <div className="flex gap-4">
              {["Small", "Medium", "Large"].map((size) => (
                <button
                  key={size}
                  onClick={() => setAppFontSize(size)}
                  className={`px-6 py-2.5 rounded-xl border font-medium transition-all ${
                    appFontSize === size
                      ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end pt-6 border-t border-gray-200 dark:border-slate-700/50">
          <button
            onClick={handleSaveAppearance}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredPermissions = permissions.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const [archivedFilter, setArchivedFilter] = useState<string>("All");

  const renderArchivedDataTab = () => {
    const allArchived = [
      ...organizations
        .filter((o) => o.isArchived)
        .map((o) => ({ type: "Organization", id: o.id, name: o.name })),
      ...contacts
        .filter((c) => c.isArchived)
        .map((c) => ({
          type: "Contact",
          id: c.id,
          name: c.contactPerson + " (" + c.companyName + ")",
        })),
      ...deals
        .filter((d) => d.isArchived)
        .map((d) => ({ type: "Deal", id: d.id, name: d.title })),
      ...pipelines
        .filter((p) => p.isArchived)
        .map((p) => ({ type: "Pipeline", id: p.id, name: p.name })),
      ...workflows
        .filter((w) => w.isArchived)
        .map((w) => ({ type: "Workflow", id: w.id, name: w.name })),
      ...campaigns
        .filter((c) => c.isArchived)
        .map((c) => ({ type: "Campaign", id: c.id, name: c.name })),
      ...templates
        .filter((t) => t.isArchived)
        .map((t) => ({ type: "Template", id: t.id, name: t.name })),
      ...roles
        .filter((r) => r.isArchived)
        .map((r) => ({ type: "Role", id: r.id, name: r.name })),
      ...users
        .filter((u) => u.isArchived)
        .map((u) => ({
          type: "User",
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
        })),
    ];

    const filteredArchived =
      archivedFilter === "All"
        ? allArchived
        : allArchived.filter((x) => x.type === archivedFilter);

    return (
      <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
            <Archive className="w-5 h-5 text-red-500" />
            Archived Data Recovery
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            View and restore records that were previously archived instead of
            permanently deleted.
          </p>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              "All",
              "Contact",
              "Organization",
              "Deal",
              "Pipeline",
              "User",
              "Role",
              "Workflow",
              "Campaign",
              "Template",
            ].map((type) => (
              <button
                key={type}
                onClick={() => setArchivedFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  archivedFilter === type
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredArchived.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400">
                  No archived records found.
                </p>
              </div>
            ) : (
              filteredArchived.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700"
                >
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {item.type}
                    </span>
                    <p className="font-semibold text-slate-900 dark:text-white mt-1">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ID: {item.id}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      restoreRecord(item.type as any, item.id);
                      toast.success(`${item.type} restored successfully!`);
                    }}
                    className="mt-3 sm:mt-0 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} /> Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRolesTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>
        <button
          onClick={resetDemoData}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-all border border-gray-200 dark:border-slate-700"
          title="Reset to default system roles"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Defaults
        </button>
        {canManageRoles && (
          <button
            onClick={() => {
              setEditingRole(null);
              setRoleForm({ name: "", description: "", permissions: [] });
              setCopyFromRoleId("");
              setIsRoleModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            New Role
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRoles.map((role) => {
          const rolePermissions = permissions.filter((p) =>
            role.permissions.includes(p.id),
          );
          const categories = Array.from(
            new Set(rolePermissions.map((p) => p.category)),
          );

          return (
            <motion.div
              key={role.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6 hover:bg-white dark:hover:bg-slate-800/60 hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">
                      {role.name}
                    </h3>
                    {role.isSystemRole && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-blue-500/20">
                        System Role
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {role.description}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {canManageRoles && (
                    <>
                      <button
                        onClick={() => {
                          setEditingRole(null);
                          setRoleForm({
                            name: `${role.name} (Copy)`,
                            description: role.description,
                            permissions: [...role.permissions],
                          });
                          setCopyFromRoleId(role.id);
                          setIsRoleModalOpen(true);
                        }}
                        title="Copy Role"
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingRole(role);
                          setRoleForm({
                            name: role.name,
                            description: role.description,
                            permissions: [...role.permissions],
                          });
                          setIsRoleModalOpen(true);
                        }}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!role.isSystemRole && (
                        <button
                          onClick={() => deleteRole(role.id)}
                          className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mb-6">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{role.userCount} users</span>
                </div>
                <span className="text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{role.permissions.length} permissions</span>
                </div>
                <span className="text-slate-700">•</span>
                <span>Updated {role.updatedAt}</span>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {categories.map((category) => (
                  <div key={category} className="space-y-1.5">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      {category}:
                    </h4>
                    <div className="flex flex-col gap-2">
                      {rolePermissions
                        .filter((p) => p.category === category)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="p-2 bg-white dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-slate-700/30 hover:bg-white dark:hover:bg-slate-800/60 transition-all"
                          >
                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              {p.description}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderPermissionsTab = () => {
    const categories: string[] = Array.from(
      new Set(permissions.map((p) => p.category)),
    );

    return (
      <div className="space-y-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>

        {categories.map((category) => {
          const catPermissions = filteredPermissions.filter(
            (p) => p.category === category,
          );
          if (catPermissions.length === 0) return null;

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  {category}
                </h3>
                <div className="h-px flex-1 bg-white dark:bg-slate-800"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catPermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/30 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="mt-1 p-1.5 bg-gray-100 dark:bg-slate-700/50 rounded-lg group-hover:bg-blue-500/20 transition-all">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-0.5">
                        {permission.name}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRoleHierarchyTab = () => {
    // Determine total system permission count
    const totalPermissionCount = permissions.length || 1;

    // Resolve active role or fallback to the first available role if missing
    let activeRole = roles.find((r) => r.id === selectedHierarchyRoleId);
    if (!activeRole && roles.length > 0) {
      activeRole = roles[0];
    }
    if (!activeRole) {
      return (
        <div className="text-center py-12 text-slate-500">
          No roles found. Create a role to begin mapping.
        </div>
      );
    }

    // Dynamically resolve closest subset/parent role to show a meaningful inheritance tree
    let closestParent: RoleDefinition | null = null;
    let maxOverlapCount = -1;

    roles.forEach((sibling) => {
      if (sibling.id === activeRole!.id) return;

      const isSubset = sibling.permissions.every((perId) =>
        activeRole!.permissions.includes(perId),
      );
      if (
        isSubset &&
        sibling.permissions.length < activeRole!.permissions.length
      ) {
        if (sibling.permissions.length > maxOverlapCount) {
          maxOverlapCount = sibling.permissions.length;
          closestParent = sibling;
        }
      }
    });

    // Fallback if no strict subset role exists: find role with fewer permissions, otherwise leave as null
    if (!closestParent && roles.length > 1) {
      let absoluteBase: RoleDefinition | null = null;
      let minPerms = 999;
      roles.forEach((r) => {
        if (r.id !== activeRole!.id && r.permissions.length < minPerms) {
          minPerms = r.permissions.length;
          absoluteBase = r;
        }
      });
      if (
        absoluteBase &&
        (absoluteBase as RoleDefinition).permissions.length <
          activeRole!.permissions.length
      ) {
        closestParent = absoluteBase;
      }
    }

    // Determine permissions classification
    const inheritedPermissionIds = closestParent
      ? activeRole.permissions.filter((pId) =>
          closestParent!.permissions.includes(pId),
        )
      : [];

    const uniquePermissionIds = closestParent
      ? activeRole.permissions.filter(
          (pId) => !closestParent!.permissions.includes(pId),
        )
      : activeRole.permissions;

    // Filter permissions for display based on search query
    const inheritedPermissionsList = permissions.filter(
      (p) =>
        inheritedPermissionIds.includes(p.id) &&
        (p.name.toLowerCase().includes(hierarchySearchQuery.toLowerCase()) ||
          p.category
            .toLowerCase()
            .includes(hierarchySearchQuery.toLowerCase())),
    );

    const uniquePermissionsList = permissions.filter(
      (p) =>
        uniquePermissionIds.includes(p.id) &&
        (p.name.toLowerCase().includes(hierarchySearchQuery.toLowerCase()) ||
          p.category
            .toLowerCase()
            .includes(hierarchySearchQuery.toLowerCase())),
    );

    // Compute active percentage coverage
    const coveragePercent = Math.round(
      (activeRole.permissions.length / totalPermissionCount) * 100,
    );

    // Static categorization helper of dynamic tiers
    interface TierInfo {
      name: string;
      level: number;
      desc: string;
      icon: any;
      textColor: string;
      bgColor: string;
      borderColor: string;
      roles: RoleDefinition[];
    }

    const tierConfig: Record<number, TierInfo> = {
      4: {
        name: "Tier 4: Enterprise Administration",
        level: 4,
        desc: "Unrestricted complete system controls, security administration, database structures, billing, and integrations overrides.",
        icon: Shield,
        textColor: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-500/10 dark:bg-purple-500/5",
        borderColor: "border-purple-200 dark:border-purple-500/30",
        roles: [],
      },
      3: {
        name: "Tier 3: Systems Oversight & Management",
        level: 3,
        desc: "Departmental managers & admins with operational overrides, user assignments, template configurations, delete permissions, and workflow templates edits.",
        icon: Layers,
        textColor: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-500/10 dark:bg-cyan-500/5",
        borderColor: "border-cyan-200 dark:border-cyan-500/30",
        roles: [],
      },
      2: {
        name: "Tier 2: Operational Staff",
        level: 2,
        desc: "Core business operators, representatives, coordinators, and technical support teams with full creation and editing of records, surveys, or assigned customer portfolios.",
        icon: Users,
        textColor: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10 dark:bg-emerald-500/5",
        borderColor: "border-emerald-200 dark:border-emerald-500/30",
        roles: [],
      },
      1: {
        name: "Tier 1: Read-Only Oversight",
        level: 1,
        desc: "Auditors, clients, or executives requiring wide system insights, data dashboards, status monitors, and performance reports without mutational action gates.",
        icon: Lock,
        textColor: "text-slate-600 dark:text-slate-400",
        bgColor: "bg-slate-500/10 dark:bg-slate-500/5",
        borderColor: "border-gray-200 dark:border-slate-700/50",
        roles: [],
      },
    };

    // Distribute roles to their dynamic tiers (self-organizing based on relative privilege weight)
    roles.forEach((role) => {
      const pct = role.permissions.length / totalPermissionCount;
      const lowerName = role.name.toLowerCase();

      if (
        pct > 0.85 ||
        lowerName.includes("admin") ||
        lowerName.includes("suite") ||
        role.name === "Administrator"
      ) {
        tierConfig[4].roles.push(role);
      } else if (pct > 0.4 || lowerName.includes("manager")) {
        tierConfig[3].roles.push(role);
      } else if (
        pct > 0.15 ||
        lowerName.includes("rep") ||
        lowerName.includes("agent") ||
        lowerName.includes("tech") ||
        role.name === "Sales Representative" ||
        role.name === "Support Agent" ||
        role.name === "Technician"
      ) {
        tierConfig[2].roles.push(role);
      } else {
        tierConfig[1].roles.push(role);
      }
    });

    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
        {/* Left Column: Visual Hierarchy Flow */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/20 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-500 animate-pulse" />
              Role Permission Hierarchy Flow Map
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Below, system roles are dynamically clustered into 4 security
              levels based on their active privilege footprints. Higher tiers
              encompass the structural ground permissions of the levels below
              them. Click any role to inspect its cascading inheritance graph
              and privilege delta.
            </p>
          </div>

          <div className="relative space-y-4 pr-1">
            {/* Visual connector line running behind the tier boxes */}
            <div className="absolute left-[34px] top-12 bottom-12 w-0.5 border-l-2 border-dashed border-slate-200 dark:border-slate-800/60 -z-10" />

            {([4, 3, 2, 1] as const).map((tierLevel, idx) => {
              const config = tierConfig[tierLevel];
              const TierIcon = config.icon;
              const hasRoles = config.roles.length > 0;

              return (
                <div
                  key={tierLevel}
                  className={`border rounded-2xl p-5 transition-all ${
                    config.roles.some((r) => r.id === activeRole!.id)
                      ? "border-blue-500/40 bg-blue-500/[0.01] dark:bg-blue-500/[0.02]"
                      : "border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/10"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Circle badge of the level */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bgColor} border ${config.borderColor} shadow-sm`}
                    >
                      <TierIcon className={`w-5 h-5 ${config.textColor}`} />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                            {config.name}
                          </h5>
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            Lvl 0{tierLevel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal mt-1 max-w-2xl">
                          {config.desc}
                        </p>
                      </div>

                      {/* Render roles of this tier */}
                      <div className="flex flex-wrap gap-3">
                        {hasRoles ? (
                          config.roles.map((role) => {
                            const isSelected = role.id === activeRole!.id;

                            return (
                              <button
                                key={role.id}
                                onClick={() => {
                                  setSelectedHierarchyRoleId(role.id);
                                  setHierarchySearchQuery(""); // clear secondary search
                                }}
                                className={`text-left px-4 py-3 rounded-xl border transition-all duration-200 relative group flex items-center justify-between gap-3 min-w-[200px] max-w-xs ${
                                  isSelected
                                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]"
                                    : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/30 dark:hover:bg-slate-800/60 border-slate-250 dark:border-slate-700/80 text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight">
                                    <span>{role.name}</span>
                                    {role.isSystemRole && (
                                      <span
                                        className={`px-1.5 py-[1px] text-[8px] font-extrabold uppercase rounded-md tracking-wider border shrink-0 ${
                                          isSelected
                                            ? "bg-white/20 border-white/20 text-white"
                                            : "bg-blue-500/10 border-blue-500/10 text-blue-500"
                                        }`}
                                      >
                                        SYS
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-500 dark:text-slate-400"} font-medium mt-0.5`}
                                  >
                                    {role.permissions.length} Permissions •{" "}
                                    {role.userCount} users
                                  </div>
                                </div>

                                <ChevronRight
                                  className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "translate-x-0.5 text-white" : "text-slate-400 group-hover:text-slate-200 group-hover:translate-x-0.5"}`}
                                />
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400 italic py-1">
                            No roles allocated to this tier.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Inheritance Profile Analysis */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm sticky top-6">
            {/* Header Profiling */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-500 dark:text-blue-450 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  Access Profile Analysis
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  {activeRole.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {activeRole.description}
                </p>
              </div>

              <div className="text-right">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {coveragePercent}%
                </span>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Sys Coverage
                </div>
              </div>
            </div>

            {/* Coverage Meter */}
            <div className="py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="font-semibold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" /> Active
                  System Footprint
                </span>
                <span className="font-mono">
                  {activeRole.permissions.length} of {totalPermissionCount} keys
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-blue-550 to-indigo-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${coveragePercent}%`,
                    backgroundColor: "var(--color-blue-500)",
                  }}
                />
              </div>
            </div>

            {/* Parent Base Inheritance Link */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/10 rounded-xl border border-slate-100 dark:border-slate-850 mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                  Closest Base Ancestor
                </span>
                <span className="text-[10px] text-slate-400 italic font-mono uppercase tracking-tight">
                  Derived Subset
                </span>
              </div>

              {closestParent ? (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900/30 border border-slate-150 dark:border-slate-800 p-3 rounded-lg">
                  <div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {(closestParent as RoleDefinition).name}
                    </h5>
                    <p
                      className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]"
                      title={(closestParent as RoleDefinition).description}
                    >
                      {(closestParent as RoleDefinition).description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-mono text-[9px] font-bold border border-slate-200 dark:border-slate-700">
                      {(closestParent as RoleDefinition).permissions.length}{" "}
                      Keys
                    </span>
                    <button
                      onClick={() => {
                        setSelectedHierarchyRoleId(
                          (closestParent as RoleDefinition).id,
                        );
                        setHierarchySearchQuery("");
                      }}
                      className="p-1 px-2.5 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-550 dark:text-blue-400 text-[10px] font-bold rounded-md transition-all border border-blue-500/20"
                    >
                      Compare
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2 bg-white dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                  <Info className="w-4 h-4 text-slate-400" />
                  No base parent exists. This is a Root Administrator.
                </div>
              )}

              {closestParent && (
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  <span className="font-bold">{activeRole.name}</span> inherits
                  access levels from{" "}
                  <span className="font-bold">
                    {(closestParent as RoleDefinition).name}
                  </span>
                  , then unlocks{" "}
                  <span className="font-bold text-blue-500 dark:text-blue-400">
                    {uniquePermissionIds.length} exclusive privileges
                  </span>{" "}
                  shown below.
                </p>
              )}
            </div>

            {/* Core Search for Permissions */}
            <div className="relative mt-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Filter profile permissions..."
                value={hierarchySearchQuery}
                onChange={(e) => setHierarchySearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            {/* List of Permissions split by Direct Delta vs Inherited Base */}
            <div className="mt-6 space-y-6 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-750 scrollbar-track-transparent">
              {/* Unique Delta Permissions */}
              <div>
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 dark:border-slate-800 pb-2 mb-3">
                  <span className="text-[10px] font-black uppercase text-blue-500 dark:text-blue-400 tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Unlocked Capabilities (+{uniquePermissionIds.length})
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold rounded">
                    Privilege Escalation
                  </span>
                </div>

                {uniquePermissionsList.length > 0 ? (
                  <div className="space-y-2">
                    {uniquePermissionsList.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 bg-gradient-to-r from-blue-500/[0.03] to-indigo-500/[0.03] dark:from-blue-510/[0.01] dark:to-indigo-510/[0.01] rounded-xl border border-blue-500/15 hover:border-blue-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {p.name}
                          </span>
                          <span className="text-[9px] px-1.5 bg-blue-500/10 text-blue-450 dark:text-blue-400 font-mono rounded border border-blue-500/10">
                            {p.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                          {p.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[11px] text-slate-400 italic">
                    No matching unique capabilities.
                  </div>
                )}
              </div>

              {/* Inherited Base Permissions */}
              {closestParent && (
                <div>
                  <div className="flex items-center justify-between border-b border-dashed border-slate-200 dark:border-slate-850 pb-2 mb-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Inherited Ground Permissions (
                      {inheritedPermissionIds.length})
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded">
                      Shared Base
                    </span>
                  </div>

                  {inheritedPermissionsList.length > 0 ? (
                    <div className="space-y-2">
                      {inheritedPermissionsList.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-slate-50/55 dark:bg-slate-900/10 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-705 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              {p.name}
                            </span>
                            <span className="text-[9px] px-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono rounded">
                              {p.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-1 leading-normal">
                            {p.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-[11px] text-slate-400 italic animate-pulse">
                      No matching base ground keys.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveOrganization = () => {
    if (tenant) {
      updateTenant(tenant.id, {
        name: orgName,
        email: orgEmail,
        phone: orgPhone,
        address: orgAddress,
        industry: orgIndustry,
        timezone: orgTimezone,
        currency: orgCurrency,
        domain: orgDomain,
      });
      toast.success("Organization settings saved successfully");
    }
  };

  const renderOrganizationTab = () => (
    <div className="max-w-4xl space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            General Information
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Organization Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Industry
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={orgIndustry}
                  onChange={(e) => setOrgIndustry(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Domain
              </label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={orgDomain}
                  onChange={(e) => setOrgDomain(e.target.value)}
                  placeholder="e.g., example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            Contact Details
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Office Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <textarea
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-200 dark:border-slate-800">
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Localization
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Timezone
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select
                  value={orgTimezone}
                  onChange={(e) => setOrgTimezone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">
                    Central European Time (CET)
                  </option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                  <option value="Asia/Manila">Philippine Time (PHT)</option>
                  <option value="Australia/Sydney">
                    Australian Eastern Time (AET)
                  </option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Currency
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select
                  value={orgCurrency}
                  onChange={(e) => setOrgCurrency(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                >
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="JPY">JPY (¥) - Japanese Yen</option>
                  <option value="PHP">PHP (₱) - Philippine Peso</option>
                  <option value="AUD">AUD ($) - Australian Dollar</option>
                  <option value="CAD">CAD ($) - Canadian Dollar</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
          <Wrench className="w-5 h-5 text-blue-400" />
          Modules & Features
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Wrench className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Service Orders
                </h4>
                <p className="text-xs text-slate-500">
                  Manage technical installations and maintenance.
                </p>
              </div>
            </div>
            <button
              onClick={toggleServiceModule}
              disabled={!canEditSettings}
              className={`w-12 h-6 rounded-full transition-all relative ${
                isServiceModuleEnabled
                  ? "bg-blue-600"
                  : "bg-gray-100 dark:bg-slate-700"
              } ${!canEditSettings ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  isServiceModuleEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Asset Tracking
                </h4>
                <p className="text-xs text-slate-500">
                  Track installed hardware and warranties.
                </p>
              </div>
            </div>
            <button
              onClick={toggleAssetModule}
              disabled={!canEditSettings}
              className={`w-12 h-6 rounded-full transition-all relative ${
                isAssetModuleEnabled
                  ? "bg-blue-600"
                  : "bg-gray-100 dark:bg-slate-700"
              } ${!canEditSettings ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  isAssetModuleEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Receipt className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Contract Billing
                </h4>
                <p className="text-xs text-slate-500">
                  Manage recurring revenue and renewals.
                </p>
              </div>
            </div>
            <button
              onClick={toggleBillingModule}
              disabled={!canEditSettings}
              className={`w-12 h-6 rounded-full transition-all relative ${
                isBillingModuleEnabled
                  ? "bg-blue-600"
                  : "bg-gray-100 dark:bg-slate-700"
              } ${!canEditSettings ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  isBillingModuleEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-800 flex justify-end">
        {canEditSettings && (
          <button
            onClick={handleSaveOrganization}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        )}
      </div>
    </div>
  );

  const renderRoleModal = () => {
    if (!isRoleModalOpen) return null;

    const categories: string[] = Array.from(
      new Set(permissions.map((p) => p.category)),
    );

    const handleSave = () => {
      if (editingRole) {
        updateRole(editingRole.id, {
          name: roleForm.name,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
      } else {
        addRole({
          name: roleForm.name,
          description: roleForm.description,
          isSystemRole: false,
          userCount: 0,
          permissions: roleForm.permissions,
        });
      }
      setIsRoleModalOpen(false);
    };

    const togglePermission = (id: string) => {
      setRoleForm((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(id)
          ? prev.permissions.filter((pid) => pid !== id)
          : [...prev.permissions, id],
      }));
    };

    const toggleCategory = (category: string) => {
      const catPerms = permissions
        .filter((p) => p.category === category)
        .map((p) => p.id);
      const allSelected = catPerms.every((id) =>
        roleForm.permissions.includes(id),
      );

      if (allSelected) {
        setRoleForm((prev) => ({
          ...prev,
          permissions: prev.permissions.filter((id) => !catPerms.includes(id)),
        }));
      } else {
        setRoleForm((prev) => ({
          ...prev,
          permissions: Array.from(new Set([...prev.permissions, ...catPerms])),
        }));
      }
    };

    const handleCopyFrom = (roleId: string) => {
      setCopyFromRoleId(roleId);
      const sourceRole = roles.find((r) => r.id === roleId);
      if (sourceRole) {
        setRoleForm((prev) => ({
          ...prev,
          permissions: [...sourceRole.permissions],
        }));
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        >
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {editingRole ? "Edit Role" : "Create New Role"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Define role name, description and assign permissions.
              </p>
            </div>
            <button
              onClick={() => setIsRoleModalOpen(false)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {!editingRole && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Start from a Template
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {roles
                    .filter((r) =>
                      [
                        "Sales Manager",
                        "Support Agent",
                        "Marketing Manager",
                        "Viewer",
                      ].includes(r.name),
                    )
                    .map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setRoleForm({
                            name: template.name + " (Copy)",
                            description: template.description,
                            permissions: [...template.permissions],
                          });
                          setCopyFromRoleId(template.id);
                        }}
                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50 rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group text-center"
                      >
                        <div className="p-2 bg-gray-100 dark:bg-slate-700/50 rounded-xl group-hover:bg-blue-500/20 transition-all">
                          <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-blue-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:hover:text-white">
                          {template.name}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Senior Sales Rep"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Briefly describe the responsibilities of this role..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Copy Permissions From (Optional)
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select
                      value={copyFromRoleId}
                      onChange={(e) => handleCopyFrom(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                    >
                      <option value="">Select a role to copy from...</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Selecting a role will pre-populate the permissions below.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const allPerms = permissions.map((p) => p.id);
                      const allSelected = allPerms.every((id) =>
                        roleForm.permissions.includes(id),
                      );
                      setRoleForm((prev) => ({
                        ...prev,
                        permissions: allSelected ? [] : allPerms,
                      }));
                    }}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      permissions.every((p) =>
                        roleForm.permissions.includes(p.id),
                      )
                        ? "bg-blue-600 border-blue-600 shadow-sm shadow-blue-500/20"
                        : roleForm.permissions.length > 0
                          ? "bg-blue-600/20 border-blue-500/50"
                          : "bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {permissions.every((p) =>
                      roleForm.permissions.includes(p.id),
                    ) ? (
                      <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                    ) : roleForm.permissions.length > 0 ? (
                      <div className="w-2 h-0.5 bg-blue-400 rounded-full" />
                    ) : null}
                  </button>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Permissions
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {roleForm.permissions.length} permissions selected
                  </span>
                  <button
                    onClick={() =>
                      setRoleForm((prev) => ({
                        ...prev,
                        permissions: permissions.map((p) => p.id),
                      }))
                    }
                    className="text-blue-400 hover:text-blue-300 font-bold"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() =>
                      setRoleForm((prev) => ({ ...prev, permissions: [] }))
                    }
                    className="text-slate-500 hover:text-slate-500 dark:text-slate-400 font-bold"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                {categories.map((category) => {
                  const catPerms = permissions.filter(
                    (p) => p.category === category,
                  );
                  const selectedInCat = catPerms.filter((p) =>
                    roleForm.permissions.includes(p.id),
                  );
                  const allSelected = selectedInCat.length === catPerms.length;
                  const someSelected = selectedInCat.length > 0 && !allSelected;

                  return (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleCategory(category)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              allSelected
                                ? "bg-blue-600 border-blue-600 shadow-sm shadow-blue-500/20"
                                : someSelected
                                  ? "bg-blue-600/20 border-blue-500/50"
                                  : "bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-slate-500"
                            }`}
                          >
                            {allSelected ? (
                              <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                            ) : someSelected ? (
                              <div className="w-2 h-0.5 bg-blue-400 rounded-full" />
                            ) : null}
                          </button>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            {category}
                          </h4>
                        </div>
                        <button
                          onClick={() => toggleCategory(category)}
                          className="text-[10px] font-bold uppercase text-slate-500 hover:text-blue-400 transition-colors px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg"
                        >
                          {allSelected ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catPerms.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => togglePermission(p.id)}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left group ${
                              roleForm.permissions.includes(p.id)
                                ? "bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/10"
                                : "bg-white dark:bg-slate-800/20 border-gray-200 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600"
                            }`}
                          >
                            <div
                              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                roleForm.permissions.includes(p.id)
                                  ? "bg-blue-600 border-blue-600 shadow-sm shadow-blue-500/20"
                                  : "bg-slate-900 border-gray-200 dark:border-slate-700 group-hover:border-slate-500"
                              }`}
                            >
                              {roleForm.permissions.includes(p.id) && (
                                <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                              )}
                            </div>
                            <div>
                              <div
                                className={`text-xs font-bold transition-colors ${roleForm.permissions.includes(p.id) ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                              >
                                {p.name}
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                                {p.description}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-4 bg-slate-900/50">
            <button
              onClick={() => setIsRoleModalOpen(false)}
              className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!roleForm.name}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              {editingRole ? "Update Role" : "Create Role"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your organization preferences and system configuration.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-slate-800">
        {[
          { id: "Organization", icon: Building2 },
          { id: "Appearance", icon: Palette },
          { id: "Archived Data", icon: Archive },
        ]
          .filter((tab) => {
            if (user?.role === "System Admin") return true;
            if (isClientAdmin) return true;
            if (tab.id === "Organization") return canEditSettings;
            return true;
          })
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as MainTab)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === tab.id
                  ? "text-blue-500 text-slate-900 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.id}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                />
              )}
            </button>
          ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[600px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "Organization" && renderOrganizationTab()}
            {activeTab === "Appearance" && renderAppearanceTab()}
            {activeTab === "Archived Data" && renderArchivedDataTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
