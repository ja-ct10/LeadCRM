import React, { useState } from 'react';
import { 
  Wrench, Plus, Search, Filter, MoreVertical, 
  Calendar, MapPin, User, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, HardDrive, Shield, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../store/DataContext';

export default function ServiceOrdersPage() {
  const { serviceOrders } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const filteredOrders = serviceOrders.filter(order => {
    const matchesSearch = 
      order.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'All' || order.status.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
      case 'pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in-progress': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'on hold': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Wrench className="text-blue-500" />
            Service Orders
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage technical installations, maintenance, and field service dispatch.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20">
          <Plus size={18} />
          New Service Order
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders', value: '12', icon: Clock, color: 'text-blue-400' },
          { label: 'Scheduled Today', value: '5', icon: Calendar, color: 'text-amber-400' },
          { label: 'Completed (MTD)', value: '48', icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Pending Issues', value: '3', icon: AlertCircle, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by client, ID, or service type..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-500" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
          >
            <option value="All" className="bg-gray-50 dark:bg-[#030712]">All Status</option>
            <option value="Scheduled" className="bg-gray-50 dark:bg-[#030712]">Scheduled</option>
            <option value="In Progress" className="bg-gray-50 dark:bg-[#030712]">In Progress</option>
            <option value="Completed" className="bg-gray-50 dark:bg-[#030712]">Completed</option>
            <option value="On Hold" className="bg-gray-50 dark:bg-[#030712]">On Hold</option>
          </select>
        </div>
      </div>

      {/* Service Orders List */}
      <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.01]">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client & Service</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Technician</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              <AnimatePresence mode="popLayout">
                {filteredOrders.map((order) => (
                  <motion.tr 
                    key={order.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/[0.01] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-bold text-blue-400">{order.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">{order.clientName}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {order.title.includes('CCTV') && <Shield size={12} className="text-slate-500" />}
                          {order.title.includes('Network') && <HardDrive size={12} className="text-slate-500" />}
                          {order.title.includes('IPBX') && <Phone size={12} className="text-slate-500" />}
                          <span className="text-xs text-slate-500">{order.title}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-900 dark:text-white border border-gray-200 dark:border-white/[0.05]">
                          {order.assignedTechnicianId.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">{order.assignedTechnicianId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <Calendar size={12} className="text-slate-500" />
                          {new Date(order.scheduledDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <MapPin size={10} />
                          {order.address}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(order.status)} uppercase`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full bg-amber-500`} />
                        <span className={`text-xs font-medium text-amber-400`}>Medium</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredOrders.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-white dark:bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No service orders found</h3>
            <p className="text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* SaaS Multi-Tenant Tip */}
      <div className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <AlertCircle className="text-blue-400" size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">SaaS Multi-Tenant Suggestion</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Since your CRM is multi-tenant, you can allow tenants like **Camxian Technologies** to enable this "Service Orders" module specifically for their technical service business, while other tenants (like a Retail store) might keep it disabled to maintain a clean UI.
          </p>
        </div>
      </div>
    </div>
  );
}
