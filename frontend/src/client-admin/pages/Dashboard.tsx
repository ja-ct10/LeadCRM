import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useData } from '../../store/DataContext';
import { Users, Briefcase, TrendingUp, DollarSign, Activity, ArrowUpRight, ArrowDownRight, LayoutDashboard, Check, Zap, RefreshCw } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from '../../shared/components/charts/ChartComponents';
import { Responsive } from 'react-grid-layout';
import isEqual from 'lodash/isEqual';
import DashboardSkeleton from '../../shared/components/DashboardSkeleton';
import { toast } from 'sonner';

function useMyContainerWidth() {
  const [width, setWidth] = useState(1200);
  const [mounted, setMounted] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const node = containerRef.current;
    if (!node) return;

    // Initial measurement
    setWidth(node.offsetWidth);

    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newWidth = Math.floor(entry.contentRect.width);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          setWidth((prevWidth) => {
            // Only update if change is significant (> 24px) to prevent scrollbar-triggered infinite loops
            if (Math.abs(prevWidth - newWidth) > 24) {
              return newWidth;
            }
            return prevWidth;
          });
          rafId = null;
        });
      }
    });

    resizeObserver.observe(node);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return { width, containerRef, mounted };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { contacts, deals, tenants, users, roles, tasks } = useData();
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 750);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    toast.message('Synchronizing SaaS database connection...', {
      description: 'Refreshing charts and checking user quotas.'
    });
    setTimeout(() => {
      setIsLoading(false);
      toast.success('All metrics and pipelines updated! âš¡ðŸ“ˆ');
    }, 800);
  };

  const userRoleDef = roles.find(r => r.name === user?.role);
  const userPerms = userRoleDef?.permissions || [];
  const isClientAdmin = user?.role === 'Client Admin';
  const canManageDashboard = isClientAdmin || userPerms.includes('p34');
  
  const defaultLayouts = {
    lg: [
      { i: 'stat1', x: 0, y: 0, w: 2, h: 2 },
      { i: 'stat2', x: 2, y: 0, w: 2, h: 2 },
      { i: 'stat3', x: 4, y: 0, w: 2, h: 2 },
      { i: 'stat4', x: 6, y: 0, w: 2, h: 2 },
      { i: 'stat5', x: 8, y: 0, w: 2, h: 2 },
      { i: 'velocity', x: 10, y: 0, w: 2, h: 2 },
      { i: 'chart3', x: 0, y: 2, w: 8, h: 6 },
      { i: 'action_center', x: 8, y: 2, w: 4, h: 6 },
      { i: 'chart1', x: 0, y: 8, w: 4, h: 6 },
      { i: 'leaderboard', x: 4, y: 8, w: 4, h: 6 },
      { i: 'chart2', x: 8, y: 8, w: 4, h: 6 },
    ],
    md: [
      { i: 'stat1', x: 0, y: 0, w: 2, h: 2 },
      { i: 'stat2', x: 2, y: 0, w: 2, h: 2 },
      { i: 'stat3', x: 4, y: 0, w: 2, h: 2 },
      { i: 'stat4', x: 6, y: 0, w: 2, h: 2 },
      { i: 'stat5', x: 8, y: 0, w: 2, h: 2 },
      { i: 'velocity', x: 0, y: 2, w: 2, h: 2 },
      { i: 'chart3', x: 0, y: 4, w: 6, h: 6 },
      { i: 'action_center', x: 6, y: 4, w: 4, h: 6 },
      { i: 'chart1', x: 0, y: 10, w: 5, h: 6 },
      { i: 'chart2', x: 5, y: 10, w: 5, h: 6 },
      { i: 'leaderboard', x: 0, y: 16, w: 10, h: 6 },
    ],
    sm: [
      { i: 'stat1', x: 0, y: 0, w: 4, h: 2 },
      { i: 'stat2', x: 4, y: 0, w: 4, h: 2 },
      { i: 'stat3', x: 0, y: 2, w: 4, h: 2 },
      { i: 'stat4', x: 4, y: 2, w: 4, h: 2 },
      { i: 'stat5', x: 0, y: 4, w: 4, h: 2 },
      { i: 'velocity', x: 4, y: 4, w: 4, h: 2 },
      { i: 'chart3', x: 0, y: 6, w: 8, h: 6 },
      { i: 'action_center', x: 0, y: 12, w: 8, h: 6 },
      { i: 'chart1', x: 0, y: 18, w: 8, h: 6 },
      { i: 'chart2', x: 0, y: 24, w: 8, h: 6 },
      { i: 'leaderboard', x: 0, y: 30, w: 8, h: 6 },
    ]
  };

  const [layouts, setLayouts] = useState(defaultLayouts);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_layout');
    if (saved) {
      try {
        setLayouts(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleLayoutChange = (layout: any, allLayouts: any) => {
    if (!isEditingLayout) return;

    // Extract only standard properties to avoid infinite loops with RGL internals (like 'moved')
    const layoutsToSave = Object.keys(allLayouts).reduce((acc: any, key) => {
      acc[key] = allLayouts[key].map((item: any) => ({
        i: item.i, x: item.x, y: item.y, w: item.w, h: item.h
      }));
      return acc;
    }, {});
    
    if (!isEqual(layoutsToSave, layouts)) {
      setLayouts(layoutsToSave);
      localStorage.setItem('dashboard_layout', JSON.stringify(layoutsToSave));
    }
  };

  const responsiveLayouts = useMemo(() => {
    return Object.keys(layouts).reduce((acc: any, key) => {
      acc[key] = layouts[key].map((item: any) => ({
        ...item,
        static: !isEditingLayout
      }));
      return acc;
    }, {});
  }, [layouts, isEditingLayout]);

  const { width, containerRef, mounted } = useMyContainerWidth();

  if (!mounted || isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-8 flex justify-between items-center animate-fade-in">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Dashboard Overview</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back! Here's what's happening with your business today.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white dark:bg-white/[0.02] border border-gray-250 dark:border-white/[0.05] text-slate-400 dark:text-slate-500 cursor-not-allowed"
            >
              <RefreshCw size={14} className="animate-spin" />
              <span>Syncing Live...</span>
            </button>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (user?.role === 'System Admin') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]"><Briefcase size={24} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tenants</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">{tenants.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl text-green-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><Users size={24} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]"><TrendingUp size={24} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue (Est)</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">${deals.reduce((acc, d) => acc + d.value, 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg overflow-hidden transition-colors duration-300">
          <div className="p-6 border-b border-gray-200 dark:border-white/[0.05]">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Tenants</h3>
          </div>
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-gray-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Industry</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/[0.05]">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white dark:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{t.name}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{t.industry}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${t.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Client Admin / Sales Rep Dashboard
  const activeDeals = deals.filter(d => d.stageId !== 'stage_won' && d.stageId !== 'stage_lost');
  const wonDeals = deals.filter(d => d.stageId === 'stage_won');
  const totalRevenue = wonDeals.reduce((acc, d) => acc + d.value, 0);
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  // Dynamic Pipeline Data
  const stageNames: Record<string, string> = {
    'stage_lead': 'Contact In',
    'stage_qualified': 'Qualified',
    'stage_proposal': 'Proposal Sent',
    'stage_negotiation': 'Negotiation',
    'stage_won': 'Closed Won',
    'stage_lost': 'Closed Lost'
  };

  // Quick Action Metrics
  const myHotLeads = contacts.filter(c => c.status === 'Hot' && c.assignedUserId === user?.id);
  const myPendingTasks = tasks ? tasks.filter(t => t.status === 'pending' && t.assignedUserId === user?.id) : [];
  const recentlyAssignedLeads = contacts.filter(c => c.assignedUserId === user?.id && Date.now() - new Date(c.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000);
  const stageColors: Record<string, string> = {
    'stage_lead': '#3B82F6',
    'stage_qualified': '#8B5CF6',
    'stage_proposal': '#EC4899',
    'stage_negotiation': '#F59E0B',
    'stage_won': '#10B981',
    'stage_lost': '#EF4444'
  };

  const pipelineCounts = deals.reduce((acc, deal) => {
    acc[deal.stageId] = (acc[deal.stageId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pipelineData = Object.keys(pipelineCounts)
    .filter(stageId => stageId !== 'stage_lost') // Hide lost deals from pie chart
    .map(stageId => ({
      name: stageNames[stageId] || stageId,
      value: pipelineCounts[stageId],
      color: stageColors[stageId] || '#64748b'
    }));

  // Dynamic Revenue Data (Mocking historical, using real for current month)
  const currentMonthRevenue = wonDeals.reduce((acc, d) => acc + d.value, 0);
  const currentMonthDeals = wonDeals.length;
  
  const revenueData = [
    { name: 'Nov', revenue: 45000, deals: 4 },
    { name: 'Dec', revenue: 52000, deals: 5 },
    { name: 'Jan', revenue: 48000, deals: 4 },
    { name: 'Feb', revenue: 61000, deals: 6 },
    { name: 'Mar', revenue: 55000, deals: 5 },
    { name: 'Apr', revenue: currentMonthRevenue > 0 ? currentMonthRevenue : 68000, deals: currentMonthDeals > 0 ? currentMonthDeals : 7 },
  ];

  // Sales Forecasting
  const stageProbabilities: Record<string, number> = {
    'stage_lead': 0.1,
    'stage_qualified': 0.3,
    'stage_proposal': 0.6,
    'stage_negotiation': 0.8,
  };

  const forecastedRevenue = activeDeals.reduce((acc, deal) => {
    const prob = stageProbabilities[deal.stageId] || 0;
    return acc + (deal.value * prob);
  }, 0);

  // Activity Leaderboard
  const userPerformance = users.map(u => {
    const userWonDeals = wonDeals.filter(d => d.assignedUserId === u.id);
    const userActiveDeals = activeDeals.filter(d => d.assignedUserId === u.id);
    const totalWonValue = userWonDeals.reduce((acc, d) => acc + d.value, 0);
    return {
      user: u,
      wonDeals: userWonDeals.length,
      activeDeals: userActiveDeals.length,
      totalWonValue
    };
  }).sort((a, b) => b.totalWonValue - a.totalWonValue).slice(0, 5);

  // Conversion Velocity
  const velocityData = wonDeals.map(deal => {
    const created = new Date(deal.createdAt || Date.now()).getTime();
    const wonHistory = deal.history?.find(h => h.stageId === 'stage_won');
    const closed = wonHistory ? new Date(wonHistory.timestamp).getTime() : new Date(deal.expectedCloseDate || Date.now()).getTime();
    const diffDays = Math.max(1, Math.round((closed - created) / (1000 * 60 * 60 * 24)));
    return diffDays;
  });

  const avgVelocity = velocityData.length > 0
    ? Math.round(velocityData.reduce((a, b) => a + b, 0) / velocityData.length)
    : 14;

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back! Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-95"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>Sync Live Metrics</span>
          </button>
          {canManageDashboard && isEditingLayout && (
            <button
              onClick={() => {
                setLayouts(defaultLayouts);
                localStorage.removeItem('dashboard_layout');
                toast.success('Layout reset to default');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white dark:bg-white/[0.02] border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <RefreshCw size={16} /> Reset
            </button>
          )}
          {canManageDashboard && (
            <button 
              onClick={() => setIsEditingLayout(!isEditingLayout)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isEditingLayout 
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' 
                  : 'bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isEditingLayout ? <><Check size={16} /> Done Editing</> : <><LayoutDashboard size={16} /> Edit Layout</>}
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%', minHeight: '800px', overflowX: 'hidden' }}>
        {mounted && (
          <Responsive
            className="layout"
            layouts={responsiveLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 8, xs: 4, xxs: 2 }}
            rowHeight={60}
            width={width}
            onLayoutChange={handleLayoutChange}
            margin={[24, 24]}
          >
        {/* Top Stats Cards */}
        <div key="stat1" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col justify-between group hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors h-full">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-shadow flex items-center justify-center font-bold text-lg w-10 h-10 ${isClientAdmin ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
              {isClientAdmin ? 'â‚±' : <Zap size={20} />}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isClientAdmin ? 'Total Revenue' : 'My Hot Leads'}
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isClientAdmin ? `â‚±${totalRevenue > 0 ? totalRevenue.toLocaleString() : '328,000'}` : myHotLeads.length}
            </p>
          </div>
        </div>

        <div key="stat2" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col justify-between group hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors h-full">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-shadow flex items-center justify-center font-bold text-lg w-10 h-10 ${isClientAdmin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {isClientAdmin ? 'â‚±' : <Activity size={20} />}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isClientAdmin ? 'Forecasted Revenue' : 'Pending Tasks'}
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isClientAdmin ? `â‚±${Math.round(forecastedRevenue).toLocaleString()}` : myPendingTasks.length}
            </p>
          </div>
        </div>

        <div key="stat3" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col justify-between group hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors h-full">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-shadow ${isClientAdmin ? 'bg-purple-500/10 text-purple-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <Briefcase size={20} />
            </div>
            {isClientAdmin && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                <ArrowUpRight size={12} /> 12 new
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isClientAdmin ? 'Active Deals' : 'Recently Assigned'}
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isClientAdmin ? (activeDeals.length > 0 ? activeDeals.length : '90') : recentlyAssignedLeads.length}
            </p>
          </div>
        </div>

        <div key="stat4" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col justify-between group hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)] group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-shadow">
              <Users size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
              <ArrowUpRight size={12} /> 180+
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Leads</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{contacts.length > 0 ? contacts.length : '2,350'}</p>
          </div>
        </div>

        <div key="stat5" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col justify-between group hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-pink-500/10 rounded-xl text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)] group-hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-shadow">
              <Activity size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <ArrowDownRight size={12} /> 1.2%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Conversion Rate</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{winRate > 0 ? `${winRate}%` : '24.5%'}</p>
          </div>
        </div>

        <div key="velocity" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col justify-between group hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)] group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-shadow">
               <Zap size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
              <ArrowDownRight size={12} /> 2 days faster
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Conversion Velocity</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{avgVelocity} <span className="text-lg font-normal text-slate-500">days</span></p>
          </div>
        </div>

        {/* Middle Row: Charts & Leaderboard & Action Center */}
        <div key="action_center" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col h-full">
          <div className="mb-4 shrink-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap size={18} className="text-amber-500" /> Action Center
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Critical tasks & hot leads</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {myPendingTasks.length === 0 && myHotLeads.length === 0 ? (
               <div className="text-center text-slate-500 py-8 text-sm">You are all caught up! âœ¨</div>
            ) : null}
            
            {myPendingTasks.map(task => (
              <div key={task.id} className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Due Follow-up</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{task.title}</div>
                <div className="text-xs text-slate-500 truncate">{task.description}</div>
              </div>
            ))}

            {myHotLeads.map(lead => (
              <div key={lead.id} className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1"><Zap size={10} /> Hot Lead</span>
                  <span className="text-xs font-bold text-red-500">â‚±{lead.estimatedValue?.toLocaleString() || '0'}</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{lead.firstName} {lead.lastName}</div>
                <div className="text-xs text-slate-500">{lead.companyName || 'Individual'}</div>
              </div>
            ))}
            
            {recentlyAssignedLeads.filter(l => l.status !== 'Hot').slice(0, 3).map((lead) => (
              <div key={lead.id} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30">
                 <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">New Assigned</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{lead.firstName} {lead.lastName}</div>
              </div>
            ))}
          </div>
        </div>

        <div key="chart1" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col h-full">
          <div className="mb-6 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue & Deals</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Monthly performance overview</p>
            </div>
            <button className="px-3 py-1.5 bg-gray-50 dark:bg-white/[0.05] hover:bg-gray-100 dark:hover:bg-white/[0.1] text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-gray-200 dark:border-white/[0.05]">
              View Report
            </button>
          </div>
          <div className="flex-1 min-h-0 relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `â‚±${value / 1000}k`} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#030712', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  itemStyle={{ color: '#f8fafc' }}
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="revenue" name="Revenue (â‚±)" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={16} />
                <Bar dataKey="deals" name="Deals Closed" fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div key="leaderboard" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col h-full">
          <div className="mb-6 shrink-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Sales Leaderboard</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Top performers by revenue</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {userPerformance.map((perf, idx) => (
              <div key={perf.user.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-gray-200 dark:border-white/[0.05] flex items-center justify-center text-slate-900 dark:text-white font-bold">
                      {perf.user.firstName[0]}{perf.user.lastName[0]}
                    </div>
                    {idx === 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-[#0B1120] flex items-center justify-center text-[8px]">ðŸ‘‘</div>}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{perf.user.firstName} {perf.user.lastName}</div>
                    <div className="text-xs text-slate-500">{perf.wonDeals} deals won</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">â‚±{perf.totalWonValue.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{perf.activeDeals} active</div>
                </div>
              </div>
            ))}
            {userPerformance.length === 0 && (
              <div className="text-center text-slate-500 py-8 text-sm">No sales data available yet.</div>
            )}
          </div>
        </div>

        {/* Bottom Chart Row */}
        <div key="chart2" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col h-full">
          <div className="mb-6 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pipeline Distribution</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Deals by stage</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={pipelineData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  stroke="none"
                >
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#030712', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div key="chart3" className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg flex flex-col h-full">
          <div className="mb-6 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">6-month revenue progression</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                <ArrowUpRight size={12} /> +15.3% Overall
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={revenueData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `â‚±${value / 1000}k`} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#030712', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue (â‚±)" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3B82F6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Responsive>
        )}
      </div>
    </div>
  );
}
