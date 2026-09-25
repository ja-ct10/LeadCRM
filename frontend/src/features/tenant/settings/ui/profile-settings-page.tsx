'use client';

import { SecuritySettings } from './security-settings';
import { ProfileForm } from './profile-form';
import React, { useState } from "react";
import {
  User,
  Lock,
  Bell,
  Save,
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


  // Active Tab: 'Personal Info' | 'Appearance' | 'Security' | 'Notifications'
  const [activeTab, setActiveTab] = useState<
    "Personal Info" | "Appearance" | "Security" | "Notifications"
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


  // Notification states
  const [notiEmailLeads, setNotiEmailLeads] = useState(true);
  const [notiEmailPipeline, setNotiEmailPipeline] = useState(true);
  const [notiSmsHot, setNotiSmsHot] = useState(false);
  const [notiPushAll, setNotiPushAll] = useState(true);

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

        {activeTab === "Security" && <SecuritySettings />}

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
