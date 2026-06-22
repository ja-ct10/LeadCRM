import React from 'react';
import { useData } from '../../../../store/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from '../../../../shared/components/charts/ChartComponents';
import { Download, TrendingUp, Trophy } from 'lucide-react';

export default function ReportsPage() {
  const { contacts, deals, users } = useData();

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
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 5); // Top 5

  const COLORS = ['#0A6EFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Analytics & Reports</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gain insights into your sales performance.</p>
        </div>
        <button className="flex items-center gap-2 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Last 6 Months</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]"><TrendingUp size={20} /></div>
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
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value / 1000}k`} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#030712', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 500 }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0A6EFF" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 6, fill: '#0A6EFF', stroke: '#030712', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pipeline Value</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">By Stage</p>
            </div>
          </div>
          <div className="h-72 relative w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={pipelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value / 1000}k`} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#030712', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                />
                <Bar dataKey="value" name="Value" fill="#10B981" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contact Status */}
        <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contact Status</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Current Distribution</p>
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
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#030712', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
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
        <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] backdrop-blur-xl shadow-lg overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-white/[0.05] flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Team Leaderboard</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Top performers this month</p>
            </div>
            <div className="p-2.5 bg-yellow-500/10 rounded-xl text-yellow-500 border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]"><Trophy size={20} /></div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-white dark:bg-white/[0.02] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Sales Rep</th>
                  <th className="px-6 py-4 font-medium">Deals Won</th>
                  <th className="px-6 py-4 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {userPerformance.length > 0 ? (
                  userPerformance.map((u, i) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <span className="bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.05] text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs font-medium">
                          {u.dealsWon}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-green-400 text-right">
                        ${u.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No performance data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
