'use client';

import React, { useState } from 'react';
import { 
  Package, Plus, Search, Filter, MoreVertical, 
  Calendar, MapPin, User, Shield, HardDrive, 
  Cpu, Activity, AlertTriangle, CheckCircle2,
  ExternalLink, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrelloFilter } from '@/shared/components/TrelloFilter';
import { usePagination } from '@/shared/hooks/usePagination';
import { Pagination } from '@/shared/components/ui/pagination';

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

  const {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    paginateItems,
    goToPage,
    setPageSize,
  } = usePagination({
    totalItems: filteredAssets.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [searchQuery, filterCategories, filterStatuses],
  });

  const paginatedAssets = paginateItems(filteredAssets);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Package className="text-blue-500" size={18} />
            Asset Tracking
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Track installed hardware, warranties, and maintenance history across client sites.</p>
        </div>
        <button className="flex items-center gap-2 h-9 px-3 text-xs font-medium rounded-md shadow-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors">
          <Plus size={14} />
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
          <div key={i} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{stat.label}</span>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search by name, serial number, or client..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
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
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Asset Info</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Client & Location</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Serial Number</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Dates</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <AnimatePresence mode="popLayout">
                {paginatedAssets.map((asset) => (
                  <motion.tr 
                    key={asset.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                          {getCategoryIcon(asset.category)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{asset.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">{asset.category}</span>
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
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
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
                      <span className={`rounded-full text-[11px] font-medium px-2 py-0.5 border ${getStatusColor(asset.status)}`}>
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
      
      {filteredAssets.length > 0 && (
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

      {/* Maintenance Alert */}
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-start gap-3">
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
