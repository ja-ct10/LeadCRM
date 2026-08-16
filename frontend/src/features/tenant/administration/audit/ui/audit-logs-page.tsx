'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { 
  Activity, Search, Filter, Download, Trash2, Calendar, 
  User, Mail, Globe, Clock, ChevronRight, AlertCircle, FileText,
  Wifi, WifiOff, TrendingUp, BarChart2, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, Cell
} from '@/shared/components/charts/ChartComponents';

const LIVE_SIMULATED_EVENTS = [
  { action: 'Contact Updated', details: 'Bob converted potential customer \'Aegis Technologies\' from Prospect to Closed-Won.' },
  { action: 'Auth Login', details: 'Technician logged in to system from remote mobile application client.' },
  { action: 'Workflow Automation', details: 'Cron scheduler triggered campaign delivery sequence: \'Enterprise Retargeting Wave 2\'.' },
  { action: 'Task Created', details: 'Automated workflow created follow-up support query action item for Client success relations team.' },
  { action: 'System Health Check', details: 'Database memory and replication latency parameters checked: 99.98% runtime threshold active.' },
  { action: 'Asset Updated', details: 'Updated preventative maintenance date and checkoff list for hardware item Server Rack ID 4B.' },
  { action: 'Deal Created', details: 'Commercial rep created deal estimate draft \'Custom SLA Extension Core\' valued at $45,000.' },
  { action: 'Tenant Settings', details: 'Client Admin modified tenant interface personalization parameters with custom color metrics.' }
];

import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';

export default function AuditLogsPage() {
  const { auditLogs, users, addAuditLog } = useData();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('All');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Dynamic system appearance tracking (Light vs Dark theme observer)
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('app_theme') === 'Dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Real-time Updates State
  const [isRealTime, setIsRealTime] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Periodic automatic fetch/generation trigger
  useEffect(() => {
    if (!isRealTime) {
      setSecondsLeft(30);
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Trigger automatic simulation log
          const randomIndex = Math.floor(Math.random() * LIVE_SIMULATED_EVENTS.length);
          const randomEvt = LIVE_SIMULATED_EVENTS[randomIndex];
          
          if (typeof addAuditLog === 'function') {
            addAuditLog(randomEvt.action, `[Real-time Live Event] ${randomEvt.details}`);
            toast.info(`Real-time Activity: Recorded "${randomEvt.action}"`);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRealTime, addAuditLog]);

  // Structured Category Filter Groups as requested (e.g., 'Auth', 'Contact', 'System')
  const categories = ['All', 'Auth', 'Contact', 'System'];

  // Handle Date filters
  const filterByDate = (timestamp: string, range: string) => {
    if (range === 'All') return true;
    const logDate = new Date(timestamp);
    const today = new Date();
    today.setHours(0,0,0,0);

    const diffTime = Math.abs(today.getTime() - logDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (range === 'Today') {
      return logDate >= today;
    }
    if (range === 'Yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return logDate >= yesterday && logDate < today;
    }
    if (range === 'Last 7 Days') {
      return diffDays <= 7;
    }
    if (range === 'Last 30 Days') {
      return diffDays <= 30;
    }
    return true;
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Search matching
      const matchesSearch = 
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        log.userEmail.toLowerCase().includes(search.toLowerCase());

      // Category matching
      let matchesCategory = true;
      if (selectedCategory !== 'All') {
        const actionLower = log.action.toLowerCase();
        const detailsLower = log.details.toLowerCase();

        if (selectedCategory === 'Auth') {
          matchesCategory = 
            actionLower.includes('auth') || 
            actionLower.includes('role') || 
            actionLower.includes('login') || 
            actionLower.includes('mfa') || 
            actionLower.includes('permission');
        } else if (selectedCategory === 'Contact') {
          matchesCategory = actionLower.includes('contact');
        } else if (selectedCategory === 'System') {
          matchesCategory = 
            actionLower.includes('system') || 
            actionLower.includes('workflow') || 
            actionLower.includes('health') || 
            actionLower.includes('task') ||
            actionLower.includes('campaign') ||
            actionLower.includes('order') ||
            actionLower.includes('asset') ||
            actionLower.includes('inventory') ||
            (!actionLower.includes('contact') && 
             !actionLower.includes('auth') && 
             !actionLower.includes('role') && 
             !actionLower.includes('login') && 
             !actionLower.includes('mfa') && 
             !actionLower.includes('permission'));
        }
      }

      // Date matching
      const matchesDate = filterByDate(log.timestamp, selectedDateRange);

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [auditLogs, search, selectedCategory, selectedDateRange]);

  const {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    paginateItems,
    goToPage,
    setPageSize,
  } = usePagination({
    totalItems: filteredLogs.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [search, selectedCategory, selectedDateRange],
  });

  const paginatedLogs = paginateItems(filteredLogs);

  // Trend Chart Data (Chronological buckets over time)
  const trendData = useMemo(() => {
    const now = new Date();
    
    const formatDateLabel = (d: Date) => {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatHourLabel = (hours: number) => {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      return `${displayHour} ${ampm}`;
    };

    let buckets: { label: string; start: Date; end: Date }[] = [];

    if (selectedDateRange === 'Today') {
      const todayStart = new Date(now);
      todayStart.setHours(0,0,0,0);
      for (let i = 0; i < 12; i++) {
        const start = new Date(todayStart.getTime() + i * 2 * 3600 * 1000);
        const end = new Date(start.getTime() + 2 * 3600 * 1000 - 1);
        buckets.push({
          label: formatHourLabel(start.getHours()),
          start,
          end
        });
      }
    } else if (selectedDateRange === 'Yesterday') {
      const yesterdayStart = new Date(now);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0,0,0,0);
      for (let i = 0; i < 12; i++) {
        const start = new Date(yesterdayStart.getTime() + i * 2 * 3600 * 1500);
        const end = new Date(start.getTime() + 2 * 3600 * 1500 - 1);
        buckets.push({
          label: formatHourLabel(start.getHours()),
          start,
          end
        });
      }
    } else if (selectedDateRange === 'Last 7 Days') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const start = new Date(d);
        start.setHours(0,0,0,0);
        const end = new Date(d);
        end.setHours(23,59,59,999);
        buckets.push({
          label: formatDateLabel(d),
          start,
          end
        });
      }
    } else if (selectedDateRange === 'Last 30 Days') {
      for (let i = 9; i >= 0; i--) {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 3);
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 3);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        buckets.push({
          label: `${formatDateLabel(start)} - ${formatDateLabel(end)}`,
          start,
          end
        });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const start = new Date(d);
        start.setHours(0,0,0,0);
        const end = new Date(d);
        end.setHours(23,59,59,999);
        buckets.push({
          label: formatDateLabel(d),
          start,
          end
        });
      }
    }

    return buckets.map(bucket => {
      const bucketLogs = auditLogs.filter(log => {
        const t = new Date(log.timestamp);
        return t >= bucket.start && t <= bucket.end;
      });

      let authCount = 0;
      let leadCount = 0;
      let systemCount = 0;

      bucketLogs.forEach(log => {
        const actionLower = log.action.toLowerCase();
        if (actionLower.includes('auth') || actionLower.includes('role') || actionLower.includes('login') || actionLower.includes('mfa')) {
          authCount++;
        } else if (actionLower.includes('contact')) {
          leadCount++;
        } else {
          systemCount++;
        }
      });

      return {
        name: bucket.label,
        'Auth Events': authCount,
        'Contact Events': leadCount,
        'System Events': systemCount,
        'Total Activity': bucketLogs.length,
      };
    });
  }, [auditLogs, selectedDateRange]);

  // Distribution Category Data
  const categoryData = useMemo(() => {
    let authCount = 0;
    let leadCount = 0;
    let systemCount = 0;
    let otherCount = 0;

    filteredLogs.forEach(log => {
      const actionLower = log.action.toLowerCase();
      if (actionLower.includes('auth') || actionLower.includes('role') || actionLower.includes('login') || actionLower.includes('mfa')) {
        authCount++;
      } else if (actionLower.includes('contact')) {
        leadCount++;
      } else if (actionLower.includes('system') || actionLower.includes('automation') || actionLower.includes('workflow') || actionLower.includes('health') || actionLower.includes('task')) {
        systemCount++;
      } else {
        otherCount++;
      }
    });

    const data = [
      { name: 'Auth & Access', value: authCount, fill: '#8b5cf6' },
      { name: 'Contacts & Deals', value: leadCount, fill: '#10b981' },
      { name: 'System Ops', value: systemCount, fill: '#3b82f6' }
    ];
    
    if (otherCount > 0) {
      data.push({ name: 'Others', value: otherCount, fill: '#6366f1' });
    }

    return data;
  }, [filteredLogs]);

  // Metrics calculations
  const metrics = useMemo(() => {
    const total = filteredLogs.length;
    
    // Actions in last 24h
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24h = filteredLogs.filter(l => new Date(l.timestamp) >= oneDayAgo).length;

    // Find custom roles or most active actor
    const userCounts: { [email: string]: number } = {};
    const typeCounts: { [action: string]: number } = {};
    
    filteredLogs.forEach(l => {
      userCounts[l.userEmail] = (userCounts[l.userEmail] || 0) + 1;
      typeCounts[l.action] = (typeCounts[l.action] || 0) + 1;
    });

    let topActor = 'N/A';
    let maxActorCount = 0;
    Object.entries(userCounts).forEach(([email, count]) => {
      if (count > maxActorCount) {
        maxActorCount = count;
        topActor = email;
      }
    });

    let topAction = 'N/A';
    let maxActionCount = 0;
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxActionCount) {
        maxActionCount = count;
        topAction = type;
      }
    });

    return {
      total,
      last24h,
      topActor: topActor.split('@')[0] || 'N/A',
      topAction
    };
  }, [filteredLogs]);

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No audit records to export.');
      return;
    }

    const headers = ['ID', 'Timestamp', 'Action Category', 'Email Details', 'IP Address', 'Log Details'];
    const rows = filteredLogs.map(log => [
      log.id,
      new Date(log.timestamp).toLocaleString(),
      log.action,
      log.userEmail,
      log.ipAddress || '127.0.0.1',
      `"${log.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leadcrm_audit_trail_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Successfully exported audit logs to CSV! =···');
  };

  // Clear log state (retains in-memory only or clears local storage keys safely)
  const handleClearLogs = () => {
    if (user?.role !== 'System Admin' && user?.role !== 'Client Admin') {
      toast.error('Unauthorized access. Only administrative staff can purge audit histories.');
      return;
    }

    if (window.confirm('CRITICAL WARN: Are you sure you want to permanently clear the audit history? This action is irreversible.')) {
      localStorage.setItem('leadcrm_audit_logs', JSON.stringify([]));
      toast.success('Audit trail and action logs purged successfully.');
      // Refresh window state to reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const selectedLog = useMemo(() => {
    return filteredLogs.find(l => l.id === selectedLogId);
  }, [filteredLogs, selectedLogId]);

  return (
    <div className="space-y-6">
      {/* 1. Header Section - Compact Enterprise Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Audit Trail & Activity Log</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            — Track user mutations, state transitions, security changes, and system operations
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Real-time Toggle Switch */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md">
            <div className="relative flex items-center">
              <button
                onClick={() => {
                  const val = !isRealTime;
                  setIsRealTime(val);
                  if (val) {
                    toast.success('Real-time Updates active (polling system state every 30s)');
                  } else {
                    toast.info('Real-time state updates paused');
                  }
                }}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isRealTime ? 'bg-emerald-500' : 'bg-slate-350 dark:bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isRealTime ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex flex-col pr-1 select-none">
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 leading-none">
                {isRealTime ? (
                  <>
                    <Wifi size={11} className="text-emerald-500 animate-pulse shrink-0" />
                    Real-time
                  </>
                ) : (
                  <>
                    <WifiOff size={11} className="text-slate-400 shrink-0" />
                    Synced
                  </>
                )}
              </span>
              {isRealTime ? (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium leading-none mt-0.5 animate-pulse">
                  Sync in {secondsLeft}s
                </span>
              ) : (
                <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">
                  Static Mode
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 h-9 px-3 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          
          {(user?.role === 'System Admin' || user?.role === 'Client Admin') && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 h-9 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs"
              title="Purge operations log entries"
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Total Recorded Logs</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2.5xl font-bold text-slate-900 dark:text-white">{metrics.total}</span>
            <span className="text-xs text-slate-400">tracked events</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Events (Last 24 Hours)</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2.5xl font-bold text-blue-600 dark:text-blue-400">{metrics.last24h}</span>
            <span className="text-xs text-slate-400">recent activities</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Primary Change Agent</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2.5xl font-bold text-slate-900 dark:text-white capitalize truncate max-w-[150px]" title={metrics.topActor}>
              {metrics.topActor}
            </span>
            <span className="text-xs text-slate-400">user operator</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Most Frequent Activity</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold text-slate-950 dark:text-slate-200 truncate max-w-[200px]" title={metrics.topAction}>
              {metrics.topAction}
            </span>
          </div>
        </div>
      </div>

      {/* Activity Visualizer Panel (Recharts) */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-white/[0.03] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Activity Volume Trends & Analysis</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Team usage patterns visualizer grouped by {selectedDateRange === 'All' ? 'day' : selectedDateRange.toLowerCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Total Logs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Auth & Access
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Contacts & Deals
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Area Chart */}
          <div className="lg:col-span-8 space-y-2">
            <div className="text-[11px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Volume Trend Over Time</div>
            <div className="h-[260px] w-full relative min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAuth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLead" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} />
                  <XAxis 
                    dataKey="name" 
                    stroke={isDark ? "#475569" : "#94a3b8"} 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke={isDark ? "#475569" : "#94a3b8"} 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-[#0c1120] border border-slate-200 dark:border-white/[0.08] p-3 rounded-xl shadow-xl space-y-1.5 text-xs">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{label}</p>
                            <div className="space-y-1">
                              {payload.map((p: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke || p.fill }}></span>
                                  <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
                                  <span className="font-mono font-bold text-slate-900 dark:text-slate-205">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Total Activity" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Auth Events" 
                    stroke="#8b5cf6" 
                    strokeWidth={1.5}
                    fillOpacity={1} 
                    fill="url(#colorAuth)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Contact Events" 
                    stroke="#10b981" 
                    strokeWidth={1.5}
                    fillOpacity={1} 
                    fill="url(#colorLead)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Distribution Bar Chart */}
          <div className="lg:col-span-4 space-y-2 border-t lg:border-t-0 lg:border-l border-gray-150 dark:border-white/[0.04] pt-4 lg:pt-0 lg:pl-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Filtered Distribution</span>
              <span className="text-[10px] bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                {filteredLogs.length} events
              </span>
            </div>
            
            {filteredLogs.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-slate-400 font-medium">No filtered logs inside bucket</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500">Modify filters to view logs category share</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[180px] w-full relative min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke={isDark ? "#64748b" : "#475569"} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-[#0c1120] border border-slate-200 dark:border-white/[0.08] p-2.5 rounded-xl shadow-lg text-xs">
                                <p className="font-bold text-slate-800 dark:text-slate-105">{data.name}</p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Volume: <span className="font-mono font-semibold text-slate-900 dark:text-white">{data.value}</span> ({((data.value / filteredLogs.length) * 100).toFixed(1)}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 text-[11px] max-h-[80px] overflow-y-auto custom-scrollbar select-none">
                  {categoryData.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-650 dark:text-slate-350">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.fill }}></span>
                        <span>{cat.name}</span>
                      </div>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {cat.value} ({filteredLogs.length > 0 ? ((cat.value / filteredLogs.length) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Logs Table Area */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audit actions, emails, details..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-white"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex w-full md:w-auto gap-3">
              {/* Category selector */}
              <div className="flex-1 md:flex-none">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white dark:bg-[#0c101d] border border-gray-250 dark:border-white/[0.08] rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Date Selector */}
              <div className="flex-1 md:flex-none">
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full bg-white dark:bg-[#0c101d] border border-gray-250 dark:border-white/[0.08] rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="All">All Time Range</option>
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit List Container */}
          <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
                <AlertCircle className="mx-auto text-slate-350 dark:text-slate-600" size={40} />
                <p className="text-sm font-medium">No matching audit logs found.</p>
                <p className="text-xs text-slate-400">Try modifying search term or turning off some category filters.</p>
              </div>
            ) : (
              <div className="overflow-x-hidden">
                <table className="w-full text-left font-mono border-collapse table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01] text-[9px] sm:text-[10px] uppercase text-slate-500 tracking-wider">
                      <th className="p-1 sm:p-4 py-2 sm:py-3 font-semibold break-words">Category/Action</th>
                      <th className="p-1 sm:p-4 py-2 sm:py-3 font-semibold break-words">Operator Email</th>
                      <th className="p-1 sm:p-4 py-2 sm:py-3 font-semibold break-words hidden sm:table-cell">IP Address</th>
                      <th className="p-1 sm:p-4 py-2 sm:py-3 font-semibold break-words">Details / Record ID</th>
                      <th className="p-1 sm:p-4 py-2 sm:py-3 font-semibold break-words">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04] text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300">
                    {paginatedLogs.map((log) => {
                      const isSelected = selectedLogId === log.id;
                      return (
                        <tr 
                          key={log.id}
                          onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                          className={`cursor-pointer transition-colors hover:bg-gray-55 dark:hover:bg-white/[0.01] ${
                            isSelected 
                              ? 'bg-blue-500/5 dark:bg-blue-500/[0.02] border-l-2 border-blue-500' 
                              : ''
                          }`}
                        >
                          <td className="p-1 sm:p-4">
                            <span className={`text-[9px] sm:text-[10px] font-bold uppercase px-1 sm:px-2 py-0.5 rounded break-words ${
                              log.action.includes('Created') 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                : log.action.includes('Updated') 
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/19' 
                                  : log.action.includes('Deleted')
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/19'
                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-1 sm:p-4 break-words" title={log.userEmail}>
                            <span className="font-semibold break-all">{log.userEmail.split('@')[0]}</span>
                            <span className="block text-[7px] sm:text-[8px] text-slate-400 break-all">@{log.userEmail.split('@')[1]}</span>
                            {log.operatorRole && (
                              <span className="inline-block text-[7px] sm:text-[8px] text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 px-1 rounded font-bold mt-0.5">{log.operatorRole}</span>
                            )}
                            <span className="block text-[7px] sm:text-[8px] text-slate-400 font-mono sm:hidden mt-0.5">
                              IP: {log.ipAddress || '127.0.0.1'}
                            </span>
                          </td>
                          <td className="p-1 sm:p-4 text-slate-500 dark:text-slate-400 font-mono break-words hidden sm:table-cell">
                            {log.ipAddress || '127.0.0.1'}
                          </td>
                          <td className="p-1 sm:p-4">
                            <p className="line-clamp-2 leading-relaxed break-words" title={log.details}>
                              {log.details}
                            </p>
                            {log.rowId && (
                              <span className="inline-block text-[7px] sm:text-[8px] tracking-wide font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-55/20 px-1 sm:px-1.5 py-0.5 rounded mt-1 border border-cyan-500/10 break-all">
                                Row: {log.rowId}
                              </span>
                            )}
                          </td>
                          <td className="p-1 sm:p-4 text-slate-500 dark:text-slate-400 break-words">
                            {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {filteredLogs.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageChange={goToPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>

        {/* Selected Log Inspector */}
        <div className="lg:col-span-4 h-full">
          <div className="bg-white dark:bg-white/[0.02] p-5 rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm sticky top-24 space-y-4 font-mono">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-white/[0.03]">
              <FileText className="text-blue-500" size={16} />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Audit Log Inspector</h3>
            </div>
            {selectedLog ? (
              <div className="space-y-4 text-xs animate-fade-in">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Event Reference ID</p>
                  <p className="font-mono text-slate-800 dark:text-white bg-slate-100 dark:bg-white/5 p-1.5 rounded select-all font-medium border border-slate-200 dark:border-white/[0.05]">
                    {selectedLog.id}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Category / Action</p>
                  <p className="text-slate-850 dark:text-slate-200 font-bold text-sm">
                    {selectedLog.action}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Description Summary</p>
                  <div className="text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-white/[0.01] p-3 rounded-lg border border-slate-100 dark:border-white/[0.03] leading-relaxed">
                    {selectedLog.details}
                  </div>
                </div>

                {selectedLog.operatorRole && (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Operator Authorization Role</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-xs capitalize">
                      {selectedLog.operatorRole}
                    </p>
                  </div>
                )}

                {selectedLog.rowId && (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Record / Row ID Selector</p>
                    <p className="text-cyan-600 dark:text-cyan-450 bg-cyan-100/10 px-2 py-1 rounded font-mono text-[10px] select-all border border-cyan-500/10">
                      {selectedLog.rowId}
                    </p>
                  </div>
                )}

                {selectedLog.changeset && Object.keys(selectedLog.changeset).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/[0.03]">
                    <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Changeset Details Table</p>
                    <div className="overflow-hidden border border-slate-200 dark:border-white/[0.05] rounded-lg">
                      <table className="w-full text-[10px] font-mono text-left border-collapse">
                        <thead className="bg-[#0e1626] text-slate-400">
                          <tr className="border-b border-white/[0.05]">
                            <th className="p-1 px-2 font-semibold">Field</th>
                            <th className="p-1 px-2 border-l border-white/[0.05] font-semibold">Old</th>
                            <th className="p-1 px-2 border-l border-white/[0.05] font-semibold">New</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05] bg-white dark:bg-[#080d19]">
                          {Object.entries(selectedLog.changeset).map(([field, delta]: [string, any]) => (
                            <tr key={field} className="hover:bg-white/[0.02]">
                              <td className="p-1 px-2 text-slate-900 dark:text-slate-200 font-semibold truncate max-w-[80px]" title={field}>{field}</td>
                              <td className="p-1 px-2 border-l border-white/[0.05] text-red-500 bg-red-500/5 max-w-[100px] truncate" title={delta.old === null || delta.old === undefined ? 'null' : String(delta.old)}>{delta.old === null || delta.old === undefined ? 'null' : String(delta.old)}</td>
                              <td className="p-1 px-2 border-l border-white/[0.05] text-green-500 bg-green-500/5 max-w-[100px] truncate" title={String(delta.new)}>{String(delta.new)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <User size={13} className="text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">USER OPERATOR</p>
                      <p className="text-slate-800 dark:text-slate-300 font-semibold">{selectedLog.userEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Globe size={13} className="text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">IP ADDRESS</p>
                      <p className="text-slate-850 dark:text-slate-300 font-mono font-medium">{selectedLog.ipAddress || '127.0.0.1'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock size={13} className="text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">EVENT TIMESTAMP</p>
                      <p className="text-slate-850 dark:text-slate-300 font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Structured JSON Object simulation */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-white/[0.03]">
                  <p className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Structured Metadata Payloads</p>
                  <pre className="p-3 bg-[#0a0f1d] text-slate-300 rounded-lg overflow-x-auto text-[10px] font-mono leading-tight max-h-48 custom-scrollbar border border-white/[0.05]">
                    {JSON.stringify({
                      evt_id: selectedLog.id,
                      timestamp: selectedLog.timestamp,
                      action: selectedLog.action,
                      operator: {
                        id: selectedLog.userId,
                        email: selectedLog.userEmail,
                        role: selectedLog.operatorRole
                      },
                      client_headers: {
                        user_agent: window.navigator.userAgent.slice(0, 50) + "...",
                        host_ip: selectedLog.ipAddress || "127.0.0.1"
                      },
                      compliance: {
                        is_verified: true,
                        category: selectedLog.action.split(' ')[0] || "Access",
                        changeset: selectedLog.changeset || null
                      }
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <AlertCircle size={24} className="mx-auto text-slate-300 dark:text-slate-600 animate-pulse" />
                <p className="text-xs">Select any log entry in the feed list to inspect raw details, timestamps, metadata payloads, or JSON objects.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
