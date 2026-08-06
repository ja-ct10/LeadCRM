'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, Plus, Search, Filter, MoreVertical, 
  Calendar, User, CheckCircle2, Clock, AlertCircle,
  GripVertical, MessageSquare, Paperclip, ChevronRight,
  ListTodo, Kanban, ShieldAlert, Check, X, Edit, Trash2, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorkloadView from './workload-view';
import { useData } from '@/store/DataContext';
import { Task, TaskStatus } from '@/store/types';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import { TrelloFilter, FilterOption } from '@/shared/components/trello-filter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

export default function TaskBoard() {
  const { tasks, addTask, updateTask, users } = useData();
  const [view, setView] = useState<'kanban' | 'list' | 'workload'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Dialog and Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [reassignReason, setReassignReason] = useState('');

  const columns = [
    { id: 'pending', name: 'To Do', color: 'bg-slate-500/10 text-slate-550 dark:text-slate-400' },
    { id: 'in-progress', name: 'In Progress', color: 'bg-blue-500/10 text-blue-500 dark:text-blue-400' },
    { id: 'completed', name: 'Completed', color: 'bg-emerald-500/10 text-emerald-555 dark:text-emerald-400' },
  ];

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = selectedPriorities.length === 0 || selectedPriorities.includes(t.priority || 'Medium');
    const matchesOwner = selectedOwners.length === 0 || selectedOwners.includes(t.assignedUserId || 'unassigned');
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(t.status);
    return matchesSearch && matchesPriority && matchesOwner && matchesStatus;
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginateItems,
    goToPage,
    setPageSize,
  } = usePagination({
    totalItems: filteredTasks.length,
    initialPageSize: 25,
    resetDeps: [searchQuery, selectedPriorities, selectedOwners, selectedStatuses],
  });

  const paginatedListTasks = paginateItems(filteredTasks);

  const getTasksByStatus = (status: string) => filteredTasks.filter(t => t.status === status);

  const getPriorityColor = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diff = (due.getTime() - today.getTime()) / (1000 * 3600 * 24);
    
    if (diff < 0) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (diff < 3) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  const getPriorityBadgeColors = (p?: 'Low' | 'Medium' | 'High') => {
    switch (p) {
      case 'High':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-extrabold';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-extrabold';
      case 'Low':
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-extrabold';
    }
  };

  const handleOpenAddModal = (initialStatus?: 'pending' | 'in-progress' | 'completed') => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setAssignedUserId(users[0]?.id || '');
    // Default due date to 3 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    setDueDate(defaultDate.toISOString().split('T')[0]);
    setStatus(initialStatus || 'pending');
    setPriority('Medium');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setAssignedUserId(task.assignedUserId || '');
    setDueDate(task.dueDate || '');
    setStatus(task.status || 'pending');
    setPriority(task.priority || 'Medium');
    setReassignReason('');
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      const isReassigning = assignedUserId !== editingTask.assignedUserId;
      updateTask(editingTask.id, {
        title,
        description,
        assignedUserId,
        dueDate,
        status,
        priority,
        ...(isReassigning && reassignReason ? { reassignReason } : {}),
      });
    } else {
      addTask({
        title,
        description,
        assignedUserId,
        dueDate,
        status,
        priority
      });
    }
    setIsModalOpen(false);
  };

  // TrelloFilter options
  const memberOptions: FilterOption[] = users.map(u => ({
    id: u.id,
    label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
    icon: (u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()
  }));

  const statusOptions: FilterOption[] = columns.map(c => ({
    id: c.id,
    label: c.name
  }));

  const priorityOptions: FilterOption[] = [
    { id: 'High', label: 'High Priority', color: 'bg-rose-600' },
    { id: 'Medium', label: 'Medium Priority', color: 'bg-amber-600' },
    { id: 'Low', label: 'Low Priority', color: 'bg-blue-600' }
  ];

  return (
    <div className="space-y-4">
      {/* 1. Header Section - Compact Enterprise Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Task Management</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            — Organize priorities, target due dates, and track team execution
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
          {/* Segment View Switcher — icon-only with tooltips */}
          <TooltipProvider>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView('kanban')}
                    aria-label="Board view"
                    className={`h-7 w-7 flex items-center justify-center rounded transition-colors cursor-pointer ${view === 'kanban' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    <Kanban size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Board view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView('list')}
                    aria-label="List view"
                    className={`h-7 w-7 flex items-center justify-center rounded transition-colors cursor-pointer ${view === 'list' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    <ListTodo size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>List view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView('workload')}
                    aria-label="Workload view"
                    className={`h-7 w-7 flex items-center justify-center rounded transition-colors cursor-pointer ${view === 'workload' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    <Users size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Workload view</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleOpenAddModal()}
                  aria-label="New Task"
                  className="h-9 w-9 flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
                >
                  <Plus size={15} />
                </button>
              </TooltipTrigger>
              <TooltipContent>New Task</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 py-1">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-xl">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-xs sm:max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-8 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 dark:text-white placeholder:text-slate-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <TrelloFilter
            searchTerm={searchQuery}
            setSearchTerm={setSearchQuery}
            members={memberOptions}
            selectedMembers={selectedOwners}
            setSelectedMembers={setSelectedOwners}
            statuses={statusOptions}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
            labelsTitle="Priority Levels"
            labels={priorityOptions}
            selectedLabels={selectedPriorities}
            setSelectedLabels={setSelectedPriorities}
          />
        </div>

        <div className="hidden sm:flex items-center -space-x-1.5">
          {users.slice(0, 4).map((u, i) => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-[10px] font-semibold text-blue-700 dark:text-blue-400" title={`${u.firstName} ${u.lastName}`}>
              {u.firstName[0]}{u.lastName[0]}
            </div>
          ))}
          {users.length > 4 && (
            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-400">
              +{users.length - 4}
            </div>
          )}
        </div>
      </div>


      {/* Kanban Board View */}
      {view === 'kanban' && (
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-6 h-full min-w-[900px]">
            {columns.map((column) => (
              <div key={column.id} className="flex-1 flex flex-col min-w-[300px] bg-slate-50/50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/[0.03] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${column.color}`}>
                      {column.name}
                    </span>
                    <span className="text-xs text-slate-550 font-semibold">{getTasksByStatus(column.id).length} items</span>
                  </div>
                  <button 
                    onClick={() => handleOpenAddModal(column.id as any)}
                    className="p-1 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1 max-h-[60vh]">
                  <AnimatePresence mode="popLayout">
                    {getTasksByStatus(column.id).map((task) => {
                        const isOverdue = task.status !== 'completed' && task.status !== 'cancelled' &&
                          task.dueDate && new Date(task.dueDate) < new Date();
                        return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => handleOpenEditModal(task)}
                        className={`bg-white dark:bg-slate-900 border p-4.5 rounded-xl hover:shadow-md transition-all group cursor-pointer relative ${
                          isOverdue
                            ? 'border-red-400/60 dark:border-red-500/40 hover:border-red-500/80'
                            : 'border-slate-200 dark:border-slate-800/80 hover:border-blue-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-550 dark:group-hover:text-blue-400 transition-colors leading-tight">
                            {task.title}
                          </h4>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(task);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                          {task.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Priority color coded badge */}
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider ${getPriorityBadgeColors(task.priority)}`}>
                              {task.priority || 'Medium'}
                            </span>
                            {/* Due date indicator */}
                            <div className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(task.dueDate)}`}>
                              <Clock size={10} />
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          
                          {/* Circle Avatar */}
                          <div className="w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-[8px] font-black text-blue-500 border border-blue-500/15" title={users.find(u => u.id === task.assignedUserId)?.firstName}>
                            {users.find(u => u.id === task.assignedUserId)?.firstName[0]}
                          </div>
                        </div>

                        {/* Overdue indicator */}
                        {isOverdue && (
                          <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-red-500 dark:text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                            Overdue
                          </div>
                        )}
                      </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) }

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/60">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-12 text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Task Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-28">Priority Badge</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Assigned To</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-36">Due Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Stage</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedListTasks.length > 0 ? (
                  paginatedListTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors group">
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })}
                          className={`w-5 h-5 mx-auto rounded border flex items-center justify-center transition-all ${
                            task.status === 'completed' 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-slate-300 dark:border-slate-700 hover:border-blue-500'
                          }`}
                        >
                          {task.status === 'completed' && <CheckCircle2 size={12} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenEditModal(task)}>
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${task.status === 'completed' ? 'text-slate-400 line-through font-normal' : 'text-slate-900 dark:text-white group-hover:text-blue-500'}`}>
                            {task.title}
                          </span>
                          <span className="text-xs text-slate-550 dark:text-slate-400 mt-1 line-clamp-1">{task.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenEditModal(task)}>
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg tracking-wider ${getPriorityBadgeColors(task.priority)}`}>
                          {task.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenEditModal(task)}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-[9px] font-bold text-blue-500 border border-blue-500/15">
                            {users.find(u => u.id === task.assignedUserId)?.firstName[0]}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            {users.find(u => u.id === task.assignedUserId)?.firstName} {users.find(u => u.id === task.assignedUserId)?.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenEditModal(task)}>
                        <span className={`text-xs font-extrabold font-mono px-2 py-1 rounded inline-block border ${getPriorityColor(task.dueDate)}`}>
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenEditModal(task)}>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${columns.find(c => c.id === task.status)?.color}`}>
                          {task.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleOpenEditModal(task)}
                          className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No matching tasks found. Adjust filters or register a new one to begin.
                    </td>
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
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={goToPage}
              onPageSizeChange={setPageSize}
              isLoading={false}
            />
          </div>
        </div>
      )}

      {/* Workload View */}
      {view === 'workload' && (
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Team Workload</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Open tasks per team member, sorted by total count</p>
          </div>
          <WorkloadView tasks={tasks} users={users} />
        </div>
      )}

      {/* Slide-over or Alert Dialog for Adding & Editing tasks */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Dialog Content Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden"
            >
              <form onSubmit={handleSaveTask}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-blue-500" />
                    {editingTask ? 'Edit Task Details' : 'Add New CRM Task'}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-1 rounded-md text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Task Name / Headline
                    </label>
                    <input 
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Schedule post-audit tech consultation"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Detailed Instructions / Context
                    </label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Confirm warranty registration numbers and site mapping coordinate file..."
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                    />
                  </div>

                  {/* Priority and Assigned To (Grid row) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Task Priority
                      </label>
                      <select 
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Assignee
                      </label>
                      <select 
                        value={assignedUserId}
                        onChange={(e) => setAssignedUserId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Reassignment reason — shown only when editing and assignee differs */}
                  {editingTask && assignedUserId !== editingTask.assignedUserId && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Reassignment Reason
                      </label>
                      <input
                        type="text"
                        value={reassignReason}
                        onChange={e => setReassignReason(e.target.value)}
                        placeholder="e.g. Employee Leave, Territory Transfer"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-amber-400/40 dark:border-amber-500/30 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                      />
                      <p className="text-[10px] text-amber-500 dark:text-amber-400">
                        You're reassigning this task — adding a reason helps with audit trail.
                      </p>
                    </div>
                  )}

                  {/* Due Date and Status (Grid row) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Target Due Date
                      </label>
                      <input 
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Current Stage
                      </label>
                      <select 
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 rounded-b-2xl">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-355 border border-slate-250 dark:border-slate-750 rounded-xl text-xs font-bold hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-wide shadow-lg shadow-blue-500/10 transition-all"
                  >
                    {editingTask ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
