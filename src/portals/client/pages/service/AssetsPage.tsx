import React, { useState } from 'react';
import { 
  Package, Plus, Search, Filter, MoreVertical, 
  Calendar, MapPin, User, Shield, HardDrive, 
  Cpu, Activity, AlertTriangle, CheckCircle2,
  ExternalLink, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrelloFilter } from '../../../../shared/components/TrelloFilter';

interface Asset {
  id: string;
  name: string;
  category: 'Security' | 'Telecom' | 'IT' | 'Infrastructure';
  serialNumber: string;
  client: string;
  status: 'Active' | 'Maintenance' | 'Retired' | 'Faulty';
  installDate: string;
  warrantyExpiry: string;
  location: string;
}

const MOCK_ASSETS: Asset[] = [
  {
    id: 'AST-5001',
    name: 'Hikvision 4K IP Camera',
    category: 'Security',
    serialNumber: 'HKV-99283-X1',
    client: 'SM City North EDSA',
    status: 'Active',
    installDate: '2025-12-10',
    warrantyExpiry: '2027-12-10',
    location: 'Main Entrance - Gate 1'
  },
  {
    id: 'AST-5002',
    name: 'Cisco Catalyst 9200 Switch',
    category: 'IT',
    serialNumber: 'CSCO-SW-8821',
    client: 'Ayala Malls Vertis North',
    status: 'Active',
    installDate: '2026-01-15',
    warrantyExpiry: '2029-01-15',
    location: 'Server Room - Rack A'
  },
  {
    id: 'AST-5003',
    name: 'ZKTeco Biometric Terminal',
    category: 'Security',
    serialNumber: 'ZK-BIO-7722',
    client: 'BDO Corporate Center',
    status: 'Maintenance',
    installDate: '2024-06-20',
    warrantyExpiry: '2026-06-20',
    location: 'Executive Floor - Room 402'
  },
  {
    id: 'AST-5004',
    name: 'Grandstream IP PBX UCM6302',
    category: 'Telecom',
    serialNumber: 'GS-PBX-1102',
    client: 'PLDT Enterprise Office',
    status: 'Active',
    installDate: '2026-03-01',
    warrantyExpiry: '2028-03-01',
    location: 'IT Closet'
  },
  {
    id: 'AST-5005',
    name: 'APC Smart-UPS 3000VA',
    category: 'Infrastructure',
    serialNumber: 'APC-UPS-4491',
    client: 'Robinson\'s Galleria',
    status: 'Faulty',
    installDate: '2023-11-12',
    warrantyExpiry: '2025-11-12',
    location: 'Basement Control Room'
  }
];

export default function AssetsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const filteredAssets = MOCK_ASSETS.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategories.length === 0 || filterCategories.includes(asset.category);
    const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(asset.status);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Maintenance': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Retired': return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
      case 'Faulty': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Security': return <Shield size={14} />;
      case 'IT': return <Cpu size={14} />;
      case 'Telecom': return <HardDrive size={14} />;
      case 'Infrastructure': return <Activity size={14} />;
      default: return <Package size={14} />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Package className="text-blue-500" />
            Asset Tracking
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track installed hardware, warranties, and maintenance history across client sites.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20">
          <Plus size={18} />
          Register Asset
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Assets', value: '1,248', icon: Package, color: 'text-blue-400' },
          { label: 'Under Warranty', value: '982', icon: Shield, color: 'text-emerald-400' },
          { label: 'Expiring Soon', value: '45', icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'Maintenance Due', value: '12', icon: History, color: 'text-blue-400' },
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
            placeholder="Search by name, serial number, or client..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <TrelloFilter
          searchTerm={searchQuery}
          setSearchTerm={setSearchQuery}
          statuses={[
            { id: 'Active', label: 'Active' },
            { id: 'Maintenance', label: 'Maintenance' },
            { id: 'Retired', label: 'Retired' },
            { id: 'Faulty', label: 'Faulty' },
          ]}
          selectedStatuses={filterStatuses}
          setSelectedStatuses={setFilterStatuses}
          labelsTitle="Category"
          labels={[
            { id: 'Security', label: 'Security' },
            { id: 'Telecom', label: 'Telecom' },
            { id: 'IT', label: 'IT' },
            { id: 'Infrastructure', label: 'Infrastructure' },
          ]}
          selectedLabels={filterCategories}
          setSelectedLabels={setFilterCategories}
        />
      </div>

      {/* Assets List */}
      <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.01]">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client & Location</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Serial Number</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              <AnimatePresence mode="popLayout">
                {filteredAssets.map((asset) => (
                  <motion.tr 
                    key={asset.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/[0.01] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                          {getCategoryIcon(asset.category)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">{asset.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{asset.category}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{asset.client}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <MapPin size={10} />
                          {asset.location}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-gray-100 dark:bg-white/[0.03] px-2 py-1 rounded border border-gray-200 dark:border-white/[0.05]">
                        {asset.serialNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <Calendar size={10} className="text-slate-600" />
                          Installed: {asset.installDate}
                        </div>
                        <div className={`flex items-center gap-1.5 text-[10px] ${new Date(asset.warrantyExpiry) < new Date() ? 'text-red-400' : 'text-slate-500'}`}>
                          <Shield size={10} className="text-slate-600" />
                          Warranty: {asset.warrantyExpiry}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-slate-500 hover:text-blue-400 transition-colors" title="View Details">
                          <ExternalLink size={16} />
                        </button>
                        <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance Alert */}
      <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <AlertTriangle className="text-amber-400" size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Upcoming Warranty Expirations</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            There are **12 assets** with warranties expiring in the next 30 days. We recommend reaching out to these clients to offer maintenance contracts or hardware upgrades.
          </p>
        </div>
      </div>
    </div>
  );
}
