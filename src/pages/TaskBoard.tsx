import React, { useState } from 'react';
import { 
  LayoutDashboard, Plus, Search, Filter, MoreVertical, 
  Calendar, User, CheckCircle2, Clock, AlertCircle,
  GripVertical, MessageSquare, Paperclip, ChevronRight,
  ListTodo, Kanban, ShieldAlert, Check, X, Edit, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../store/DataContext';
import { Task } from '../store/types';
import { TrelloFilter, FilterOption } from '../components/TrelloFilter';

export default function TaskBoard() {
  const { tasks, addTask, updateTask, users } = useData();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
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
  const [status, setStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

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
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      updateTask(editingTask.id, {
        title,
        description,
        assignedUserId,
        dueDate,
        status,
        priority
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
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ListTodo className="text-blue-500" />
            Task Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Organize priorities, target due dates, and track your system milestones.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-1 rounded-xl">
          <button 
            onClick={() => setView('kanban')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'kanban' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Kanban size={16} />
            Board Layout
          </button>
          <button 
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <ListTodo size={16} />
            Detailed List
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex gap-4 items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm relative z-10 w-full overflow-x-auto">
        <div className="flex-1 w-full relative flex items-center bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl transition-all duration-200 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/80 shadow-sm max-w-sm">
          <div className="pl-3.5 flex items-center gap-2 shrink-0 py-2.5">
            <Search size={15} className="text-slate-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-1.5 pr-10 py-2 text-sm bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0 pr-2">
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

        {/* Create CTA and Avatar List */}
        <div className="flex items-center justify-end gap-4 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-4">
          <div className="hidden sm:flex -space-x-2">
            {users.slice(0, 4).map((u, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-[#030712] bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-500" title={`${u.firstName} ${u.lastName}`}>
                {u.firstName[0]}{u.lastName[0]}
              </div>
            ))}
            {users.length > 4 && (
              <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-[#030712] bg-gray-50 dark:bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-slate-500">
                +{users.length - 4}
              </div>
            )}
          </div>

          <button 
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} />
            New Task
          </button>
        </div>
      </div>

      {/* Kanban Board View */}
      {view === 'kanban' ? (
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
                    {getTasksByStatus(column.id).map((task) => (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => handleOpenEditModal(task)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-4.5 rounded-xl hover:border-blue-500/40 hover:shadow-md transition-all group cursor-pointer relative"
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
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List View */
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
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
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
                        <option value="pending">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
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
