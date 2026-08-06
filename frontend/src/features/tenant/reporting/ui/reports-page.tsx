'use client';

import React from 'react';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import { useData } from '@/store/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from '@/shared/components/charts/ChartComponents';
import { Download, TrendingUp, Trophy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

export default function ReportsPage() {
  const { contacts, deals, users } = useData();

  // Lead source attribution — won deals grouped by leadSource
  const leadSourceData = (() => {
    const map: Record<string, { name: string; wonValue: number; wonCount: number; totalCount: number }> = {};
    deals.forEach(d => {
      const src = d.leadSource || 'Unknown';
      if (!map[src]) map[src] = { name: src, wonValue: 0, wonCount: 0, totalCount: 0 };
      map[src].totalCount++;
      if (d.stageId === 'stage_won') {
        map[src].wonValue += d.value;
        map[src].wonCount++;
      }
    });
    return Object.values(map).sort((a, b) => b.wonValue - a.wonValue).slice(0, 8);
  })();

  // Prepare data for Contact Status Breakdown
  const leadStatusCounts = contacts.reduce((acc, contact) => {
    acc[contact.status] = (acc[contact.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const leadStatusData = Object.keys(leadStatusCounts).map(status => ({
    name: status,
    count: leadStatusCounts[status]
  }));

  // Prepare data for Pipeline Value by Stage
  const pipelineValueData = deals.reduce((acc, deal) => {
    const stageName = deal.stageId.replace('stage_', '').replace(/^\w/, c => c.toUpperCase());
    if (!acc[stageName]) acc[stageName] = { name: stageName, value: 0 };
    acc[stageName].value += deal.value;
    return acc;
  }, {} as Record<string, { name: string, value: number }>);

  const pipelineData = Object.values(pipelineValueData);

  // Mock Revenue Trend (historical) + Real current month
  const currentMonthRevenue = deals.filter(d => d.stageId === 'stage_won').reduce((acc, d) => acc + d.value, 0);
  const revenueTrendData = [
    { name: 'Jan', revenue: 40000 },
    { name: 'Feb', revenue: 30000 },
    { name: 'Mar', revenue: 55000 },
    { name: 'Apr', revenue: 45000 },
    { name: 'May', revenue: 70000 },
    { name: 'Jun', revenue: currentMonthRevenue > 0 ? currentMonthRevenue : 85000 },
  ];

  // Dynamic Team Leaderboard
  const userPerformance = users.filter(u => u.role === 'Sales Rep' || u.role === 'Client Admin').map(user => {
    const userWonDeals = deals.filter(d => d.assignedUserId === user.id && d.stageId === 'stage_won');
    const revenue = userWonDeals.reduce((acc, d) => acc + d.value, 0);
    return {
      ...user,
      dealsWon: userWonDeals.length,
      revenue
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginateItems,
    goToPage,
    setPageSize,
  } = usePagination({
    totalItems: userPerformance.length,
    initialPageSize: 10,
    resetDeps: [],
  });

  const paginatedPerformance = paginateItems(userPerformance);

  const COLORS = ['#0A6EFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-4">
      {/* 1. Header Section - Compact Enterprise Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Analytics & Reports</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            — Gain insights into sales performance, lead attribution, and team velocity
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Export CSV"
                className="h-9 w-9 flex items-center justify-center bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Download size={14} className="text-slate-500 dark:text-slate-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Export CSV</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Last 6 Months</p>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/60"><TrendingUp size={16} /></div>
          </div>
          <div className="h-72 relative w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={revenueTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A6EFF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0A6EFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `₱${value / 1000}k`} dx={-10} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 500 }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0A6EFF" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 5, fill: '#0A6EFF', stroke: '#0f172a', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pipeline Value</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">By Stage</p>

            </div>
          </div>
          <div className="h-72 relative w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={pipelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `₱${value / 1000}k`} dx={-10} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                />
                <Bar dataKey="value" name="Value" fill="#10B981" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contact Status */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Contact Status</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Current Distribution</p>
            </div>
          </div>
          <div className="h-72 flex items-center justify-center relative w-full min-w-0">
            {leadStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={leadStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    stroke="none"
                  >
                    {leadStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ fontWeight: 500 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-sm">No contacts available</div>
            )}
          </div>
        </div>

        {/* Team Leaderboard */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Team Leaderboard</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Top performers this month</p>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800/60"><Trophy size={16} /></div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Sales Rep</th>
                  <th className="px-4 py-3 font-medium">Deals Won</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedPerformance.length > 0 ? (
                  paginatedPerformance.map((u, i) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ${
                            i === 0 ? 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/10 text-yellow-400 border border-yellow-500/20' :
                            i === 1 ? 'bg-gradient-to-br from-slate-300/30 to-slate-400/10 text-slate-700 dark:text-slate-300 border border-slate-300/20' :
                            i === 2 ? 'bg-gradient-to-br from-amber-700/30 to-amber-800/10 text-amber-600 border border-amber-700/20' :
                            'bg-gradient-to-br from-blue-500/30 to-blue-600/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{u.firstName} {u.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs font-medium">
                          {u.dealsWon}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-green-400 text-right">
                        ₱{u.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">No performance data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              pageSizeOptions={[5, 10, 25, 50]}
              onPageChange={goToPage}
              onPageSizeChange={setPageSize}
              isLoading={false}
            />
          </div>
        </div>
      </div>
    

      {/* Lead Source Attribution */}
      {leadSourceData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lead Source Attribution</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Won deal revenue by lead source</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={leadSourceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `₱${(Number(v) / 1000).toFixed(0)}k`} />
              <ChartTooltip
                formatter={(value: number) => [`₱${value.toLocaleString('en-PH')}`, 'Won Revenue']}
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              />
              <Bar dataKey="wonValue" fill="#0A6EFF" radius={[4, 4, 0, 0]} name="Won Revenue" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {leadSourceData.slice(0, 4).map(src => (
              <div key={src.name} className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide truncate">{src.name}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  ₱{src.wonValue.toLocaleString('en-PH')}
                </p>
                <p className="text-[10px] text-slate-400">{src.wonCount} won / {src.totalCount} total</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
