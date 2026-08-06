'use client';

import React, { useState } from 'react';
import { 
  Package, Plus, Search, Filter, MoreVertical, 
  AlertTriangle, CheckCircle2, ArrowUpRight, 
  ArrowDownRight, DollarSign, Layers, ShoppingCart,
  RefreshCw, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '@/store/DataContext';
import { TrelloFilter } from '@/shared/components/trello-filter';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';

export default function InventoryPage() {
  const { inventoryItems } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStockStatuses, setFilterStockStatuses] = useState<string[]>([]);

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategories.length === 0 || filterCategories.includes(item.category);
    const stockLabel = item.quantity <= 0 ? 'Out of Stock' : item.quantity <= item.minQuantity ? 'Low Stock' : 'In Stock';
    const matchesStock = filterStockStatuses.length === 0 || filterStockStatuses.includes(stockLabel);
    return matchesSearch && matchesCategory && matchesStock;
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
    totalItems: filteredItems.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [searchQuery, filterCategories, filterStockStatuses],
  });

  const paginatedItems = paginateItems(filteredItems);

  const getStockStatus = (quantity: number, minQuantity: number) => {
    if (quantity <= 0) return { label: 'Out of Stock', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    if (quantity <= minQuantity) return { label: 'Low Stock', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { label: 'In Stock', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Layers className="text-blue-500" size={18} />
            Inventory Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Manage your stock levels, SKUs, and supplier information for hardware and equipment.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 h-9 px-3 text-xs font-medium rounded-md shadow-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ShoppingCart size={14} />
            Purchase Order
          </button>
          <button className="flex items-center gap-2 h-9 px-3 text-xs font-medium rounded-md shadow-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors">
            <Plus size={14} />
            Add Item
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Value', value: '₱1.2M', icon: DollarSign, color: 'text-emerald-400', trend: '+12%', trendUp: true },
          { label: 'Total Items', value: '452', icon: Package, color: 'text-blue-400', trend: '+5%', trendUp: true },
          { label: 'Low Stock', value: '8', icon: AlertTriangle, color: 'text-amber-400', trend: '-2', trendUp: false },
          { label: 'Out of Stock', value: '2', icon: RefreshCw, color: 'text-red-400', trend: '0', trendUp: true },
        ].map((stat, i) => (
          <div key={i} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{stat.label}</span>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className="flex items-end justify-between">
              <div className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
              <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search by name, SKU, or supplier..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <TrelloFilter
          searchTerm={searchQuery}
          setSearchTerm={setSearchQuery}
          statuses={[
            { id: 'In Stock', label: 'In Stock' },
            { id: 'Low Stock', label: 'Low Stock' },
            { id: 'Out of Stock', label: 'Out of Stock' },
          ]}
          selectedStatuses={filterStockStatuses}
          setSelectedStatuses={setFilterStockStatuses}
          labelsTitle="Category"
          labels={[
            { id: 'Security', label: 'Security' },
            { id: 'Telecom', label: 'Telecom' },
            { id: 'IT', label: 'IT' },
            { id: 'Cabling', label: 'Cabling' },
          ]}
          selectedLabels={filterCategories}
          setSelectedLabels={setFilterCategories}
        />
      </div>

      {/* Inventory List */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Item Details</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Stock Level</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <AnimatePresence mode="popLayout">
                {paginatedItems.map((item) => {
                  const status = getStockStatus(item.quantity, item.minQuantity);
                  return (
                    <motion.tr 
                      key={item.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <Package size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.name}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">{item.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {item.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between w-32">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{item.quantity} units</span>
                            <span className={`rounded-full text-[11px] font-medium px-2 py-0.5 border ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="w-32 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${item.quantity <= item.minQuantity ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min((item.quantity / (item.minQuantity * 3)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">₱{item.unitPrice.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{item.supplier}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      
      {filteredItems.length > 0 && (
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

      {/* Inventory Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 p-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            Stock Movement
          </h3>
          <div className="space-y-4">
            {[
              { action: 'Restocked', item: 'Cat6 Ethernet Cable', qty: '+20 units', date: '2 hours ago', icon: ArrowUpRight, color: 'text-emerald-400' },
              { action: 'Issued', item: 'IP Camera 4MP Dome', qty: '-4 units', date: '5 hours ago', icon: ArrowDownRight, color: 'text-red-400' },
              { action: 'Restocked', item: 'ZKTeco Biometric', qty: '+5 units', date: 'Yesterday', icon: ArrowUpRight, color: 'text-emerald-400' },
            ].map((log, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md bg-slate-100 dark:bg-slate-800 ${log.color}`}>
                    <log.icon size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{log.item}</p>
                    <p className="text-[10px] text-slate-500">{log.action} · {log.date}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold ${log.color}`}>{log.qty}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 p-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Low Stock Alerts
          </h3>
          <div className="space-y-4">
            {inventoryItems.filter(i => i.quantity <= i.minQuantity).map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
                    <Package size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-[10px] text-amber-400/70">Only {item.quantity} units left (Min: {item.minQuantity})</p>
                  </div>
                </div>
                <button className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider">
                  Order Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
