'use client';

import { ProfileForm } from './profile-form';
import React, { useState } from "react";
import { useAuth } from "@/store/AuthContext";
import { useData } from "@/store/DataContext";
import {
  ArrowLeft,
  Camera,
  Shield,
  Mail,
  Phone,
  Building2,
  User,
  Lock,
  Bell,
  Check,
  Globe,
  HelpCircle,
  Save,
  Wrench,
  Receipt,
  Send,
  Palette,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/shared/components/ui/back-button";

interface ProfileSettingsPageProps {
  navigate: (path: string) => void;
}

export default function ProfileSettingsPage({
  navigate,
}: ProfileSettingsPageProps) {
  const { user, tenant } = useAuth();
  const {
    isBillingModuleEnabled,
    toggleBillingModule,
  } = useData();

  // Active Tab: 'Personal Info' | 'Modules' | 'Appearance' | 'Security' | 'Notifications'
  const [activeTab, setActiveTab] = useState<
    "Personal Info" | "Modules" | "Appearance" | "Security" | "Notifications"
  >("Personal Info");

  // Appearance state
  const [appTheme, setAppTheme] = useState(
    localStorage.getItem("app_theme") || "Light",
  );
  const [appFontSize, setAppFontSize] = useState(
    localStorage.getItem("app_font_size") || "Medium",
  );

  React.useEffect(() => {
    const handleSync = () => {
      setAppTheme(localStorage.getItem("app_theme") || "Light");
    };
    window.addEventListener("themechange", handleSync);
    return () => window.removeEventListener("themechange", handleSync);
  }, []);

  const handleSaveAppearance = () => {
    localStorage.setItem("app_theme", appTheme);
    localStorage.setItem("app_font_size", appFontSize);

    const container = document.querySelector('[data-theme-container]');
    if (container) {
      if (appTheme === "Light") {
        container.classList.remove("dark");
      } else if (appTheme === "Dark") {
        container.classList.add("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        container.classList.toggle("dark", prefersDark);
      }
    }

    let size = "16px";
    if (appFontSize === "Small") size = "14px";
    if (appFontSize === "Large") size = "18px";
    document.documentElement.style.fontSize = size;

    toast.success("Appearance settings saved successfully");
    window.dispatchEvent(new Event("themechange"));
  };

  const email = user?.email ?? "";

  // Security password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  // Notification states
  const [notiEmailLeads, setNotiEmailLeads] = useState(true);
  const [notiEmailPipeline, setNotiEmailPipeline] = useState(true);
  const [notiSmsHot, setNotiSmsHot] = useState(false);
  const [notiPushAll, setNotiPushAll] = useState(true);

  // States for interactive "Forgot Your Password?" card
  const [resetLinkStatus, setResetLinkStatus] = useState<
    "idle" | "sending" | "sent"
  >("idle");
  const [resetCountdown, setResetCountdown] = useState(0);

  React.useEffect(() => {
    let timer: any;
    if (resetCountdown > 0) {
      timer = setTimeout(() => {
        setResetCountdown((prev) => prev - 1);
      }, 1000);
    } else if (resetCountdown === 0 && resetLinkStatus === "sent") {
      setResetLinkStatus("idle");
    }
    return () => clearTimeout(timer);
  }, [resetCountdown, resetLinkStatus]);

  const handleSendResetLink = () => {
    if (resetLinkStatus !== "idle") return;
    setResetLinkStatus("sending");

    // Simulate nice responsive API dispatch delay
    setTimeout(() => {
      setResetLinkStatus("sent");
      setResetCountdown(30);
      toast.success(
        `Password reset verification link has been sent to ${email || "alice@company.com"}!`,
      );
    }, 1200);
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match!");
      return;
    }
    toast.success("Password changed successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSaveNotifications = () => {
    toast.success("Notification channels updated.");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Header Navigation */}
      <div className="flex items-center gap-4">
        <BackButton label="Back to Settings" onClick={() => navigate("settings")} />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your account, security, and notifications
          </p>
        </div>
      </div>

      {/* Horizontal Pills Tab Container */}
      <div className="bg-slate-150/60 dark:bg-slate-900 p-1 rounded-xl flex flex-wrap sm:flex-nowrap gap-1 w-full max-w-2xl select-none">
        <button
          onClick={() => setActiveTab("Personal Info")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "Personal Info"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <User size={13} />
          <span>Personal Info</span>
        </button>
        <button
          onClick={() => setActiveTab("Modules")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "Modules"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Wrench size={13} />
          <span>Modules</span>
        </button>
        <button
          onClick={() => setActiveTab("Appearance")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "Appearance"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Palette size={13} />
          <span>Appearance</span>
        </button>
        <button
          onClick={() => setActiveTab("Security")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "Security"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Lock size={13} />
          <span>Security</span>
        </button>
        <button
          onClick={() => setActiveTab("Notifications")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "Notifications"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Bell size={13} />
          <span>Notifications</span>
        </button>
      </div>

      {/* Tab Panes */}
      <div className="space-y-6">
        {/* Tab 1: Personal Info */}
        {activeTab === "Personal Info" && <ProfileForm />}

      {activeTab === "Modules" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench size={16} className="text-blue-500" />
                  <span>Modules & Features</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Configure corporate structures, pipelines, and optional
                  dashboards active within safety domains.
                </p>
              </div>

              {/* Grid of Modules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Module: Contract Billing */}
                <div
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-4 h-36 sm:col-span-2 lg:col-span-1 ${
                    isBillingModuleEnabled
                      ? "bg-blue-50/20 dark:bg-blue-500/[0.02] border-blue-500/20 dark:border-blue-500/30"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isBillingModuleEnabled
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      <Receipt size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>Contract Billing</span>
                        {isBillingModuleEnabled && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                        Manage customer contracts, recurring fees, and renewals.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.02]">
                    <span
                      className={`text-[10px] font-bold ${isBillingModuleEnabled ? "text-blue-500" : "text-slate-400"}`}
                    >
                      {isBillingModuleEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        toggleBillingModule();
                        toast.success(
                          `Contract Billing module is now ${!isBillingModuleEnabled ? "ENABLED" : "DISABLED"}`,
                        );
                      }}
                      className={`w-10 h-5.5 rounded-full transition-colors flex items-center p-0.5 cursor-pointer shrink-0 ${
                        isBillingModuleEnabled
                          ? "bg-blue-500"
                          : "bg-slate-300 dark:bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                          isBillingModuleEnabled
                            ? "translate-x-4.5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Scope alert */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-xl flex items-start gap-3 select-none">
                <HelpCircle
                  size={15}
                  className="text-slate-400 mt-0.5 shrink-0"
                />
                <div className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  <span className="font-bold text-slate-700 dark:text-slate-305 block mb-0.5">
                    Automated Navigation Integration
                  </span>
                  Configure the modules available in this workspace.
                  Toggling will instantly synchronize with the systems sidebar
                  menus and dynamic workspace triggers. No custom compilation
                  needed.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Appearance */}
        {activeTab === "Appearance" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette size={16} className="text-blue-500" />
                  <span>System Appearance</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Customize the visual identity, dynamic core colors, and
                  typography density of LeadCRM.
                </p>
              </div>

              {/* Theme Preference Options */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Theme Preference
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "Light",
                      icon: Sun,
                      desc: "Clean and bright workspace",
                    },
                    {
                      id: "Dark",
                      icon: Moon,
                      desc: "Cosmic slate & high contrast",
                    },
                    {
                      id: "System",
                      icon: Monitor,
                      desc: "Matches device parameters",
                    },
                  ].map((theme) => {
                    const ThemeIcon = theme.icon;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setAppTheme(theme.id)}
                        className={`group flex items-center gap-3.5 p-4 rounded-xl border transition-all text-left cursor-pointer ${
                          appTheme === theme.id
                            ? "bg-blue-50/20 dark:bg-blue-500/[0.02] border-blue-500/30 dark:border-blue-500/40 text-blue-600 dark:text-blue-400"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/10"
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-lg transition-colors ${
                            appTheme === theme.id
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-slate-50 dark:bg-white/[0.02] text-slate-400 group-hover:text-slate-500"
                          }`}
                        >
                          <ThemeIcon size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{theme.id}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                            {theme.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interface scale picker */}
              <div className="pt-5 border-t border-slate-100 dark:border-white/[0.02] space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Interface Density & scale
                  </label>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Adjust elements size and typography scale for comfortable
                    viewing.
                  </p>
                </div>
                <div className="flex gap-2 pt-1 select-none">
                  {["Small", "Medium", "Large"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setAppFontSize(size)}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        appFontSize === size
                          ? "bg-blue-50/20 dark:bg-blue-500/[0.02] border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-2xs"
                          : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-slate-350 hover:border-slate-300 dark:hover:border-white/10"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply theme row */}
              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/[0.02]">
                <button
                  type="button"
                  onClick={handleSaveAppearance}
                  className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 dark:bg-slate-50 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs select-none transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <Save size={14} />
                  <span>Apply Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security */}
        {activeTab === "Security" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Form for Password Credentials */}
            <form onSubmit={handleSaveSecurity} className="space-y-6">
              {/* Card 1: Password Credentials */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Credentials
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Update password and encryption codes
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 font-medium transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 font-medium transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                        Verify New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm"
                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 font-medium transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Save button row inline inside credentials */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 dark:bg-slate-50 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs select-none transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
                  >
                    <Save size={14} />
                    <span>Save Credentials</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Forgot Your Password Card (matches screenshot, highly structured, clean UI) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Forgot Your Password?
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 animate-pulse-slow">
                  We'll send a reset link to your email address
                </p>
              </div>

              <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06]" />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-xl text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {email || "alice@company.com"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      Reset link destination
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    resetLinkStatus === "sending" || resetLinkStatus === "sent"
                  }
                  onClick={handleSendResetLink}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 select-none shrink-0 cursor-pointer ${
                    resetLinkStatus === "sending"
                      ? "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] text-slate-400 dark:text-slate-500 cursor-not-allowed"
                      : resetLinkStatus === "sent"
                        ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold"
                        : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20 active:scale-[0.98]"
                  }`}
                >
                  {resetLinkStatus === "sending" ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-blue-500 animate-spin rounded-full shrink-0" />
                      <span>Sending...</span>
                    </>
                  ) : resetLinkStatus === "sent" ? (
                    <>
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>Sent! ({resetCountdown}s)</span>
                    </>
                  ) : (
                    <>
                      <Send
                        size={13}
                        className="text-slate-500 dark:text-slate-400 shrink-0"
                      />
                      <span>Send Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 3: Multi-factor Authentication (MFA) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Multi-factor Authentication (MFA)
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Require device keys and biometric check of session cookies
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                    twoFactorEnabled
                      ? "bg-[#0A6EFF]"
                      : "bg-slate-300 dark:bg-slate-850"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                      twoFactorEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Authorized Active Sessions
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-550 mt-0.5">
                  Currently authenticated devices accessing the workspace
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between p-3.5 bg-slate-50/55 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 rounded-xl">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      MacBook Pro · San Francisco, CA
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Active session · IP: 192.168.1.18
                    </p>
                  </div>
                  <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/15 py-0.5 px-2 rounded-md font-bold uppercase tracking-wider">
                    This device
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-slate-50/55 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 rounded-xl">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      iPhone 15 Pro · Los Angeles, CA
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Last login: 2 hours ago · IP: 198.51.100.12
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.success("Device session ended successfully.")}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Revoke Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === "Notifications" && (
          <div className="space-y-6">
            {/* Preferences */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Push & Email Reminders
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Control pipeline summaries, daily lead updates and secure
                  triggers
                </p>
              </div>

              <div className="space-y-4">
                {/* Switch item 1 */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.03]">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Lead Assignment Email Alerts
                    </span>
                    <span className="text-[10px] text-slate-400 block max-w-sm mt-0.5">
                      Notify instantly when a customer profile or organization
                      is delegated to your pipeline.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotiEmailLeads(!notiEmailLeads)}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      notiEmailLeads
                        ? "bg-[#0A6EFF]"
                        : "bg-slate-300 dark:bg-slate-850"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                        notiEmailLeads ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Switch item 2 */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.03]">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Daily Pipeline Briefing reports
                    </span>
                    <span className="text-[10px] text-slate-400 block max-w-sm mt-0.5">
                      Send a morning report summing upcoming deal expected close
                      dates and workflow tasks.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotiEmailPipeline(!notiEmailPipeline)}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      notiEmailLeads
                        ? "bg-[#0A6EFF]"
                        : "bg-slate-300 dark:bg-slate-850"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                        notiEmailPipeline ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Switch item 3 */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.03]">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Urgent hot lead SMS notification cascade
                    </span>
                    <span className="text-[10px] text-slate-400 block max-w-sm mt-0.5">
                      Send an SMS verified notification when a lead changes
                      status to hot or requires urgent callback.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotiSmsHot(!notiSmsHot)}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      notiSmsHot
                        ? "bg-[#0A6EFF]"
                        : "bg-slate-300 dark:bg-slate-850"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                        notiSmsHot ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Switch item 4 */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      In-app general push alerts
                    </span>
                    <span className="text-[10px] text-slate-400 block max-w-sm mt-0.5">
                      Enable floating window message logs from teammates and
                      workspace campaigns.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotiPushAll(!notiPushAll)}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      notiPushAll
                        ? "bg-[#0A6EFF]"
                        : "bg-slate-300 dark:bg-slate-850"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                        notiPushAll ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Save button row */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveNotifications}
                className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 dark:bg-slate-50 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs select-none transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
              >
                <Save size={14} />
                <span>Save Channels</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
