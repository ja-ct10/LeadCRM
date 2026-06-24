'use client';

import React from 'react';
import { Shield, User, LogOut, Check } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { MOCK_USERS } from '@/store/mockData';
import { toast } from 'sonner';

interface AccountDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  navigate: (path: string) => void;
}

export default function AccountDropdown({ isOpen, onToggle, navigate }: AccountDropdownProps) {
  const { user, login, logout } = useAuth();

  const handleNavigate = (path: string) => {
    onToggle();
    navigate(path);
  };

  const handleSwitchUser = (email: string, name: string, role: string) => {
    onToggle();
    login(email).then(() => {
      toast.success(`Switched account to: ${name} (${role})`);
    });
  };

  const handleLogout = () => {
    onToggle();
    logout().then(() => toast.success('Logged out successfully'));
  };

  const getUsersToRender = () => {
    const storedVal = localStorage.getItem('leadcrm_users');
    const parsed = storedVal ? JSON.parse(storedVal) : MOCK_USERS;
    return (parsed && parsed.length > 0) ? parsed : MOCK_USERS;
  };

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-white/[0.08] p-4 relative" id="account-dropdown-container">
      {isOpen && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-50 overflow-hidden text-sm flex flex-col py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 flex flex-col items-start bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="font-extrabold text-slate-900 dark:text-white truncate max-w-full">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full mt-0.5">{user?.email}</div>
            <div className="mt-2.5">
              <span className="px-2.5 py-0.5 bg-red-500 text-white text-[10px] font-extrabold rounded-md uppercase tracking-wide flex items-center gap-1 select-none">
                <Shield size={10} />
                <span>{user?.role === 'Client Admin' ? 'Admin' : user?.role || 'User'}</span>
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06] my-1" />

          <button onClick={() => handleNavigate('profile-settings')}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2.5 font-semibold text-xs cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <User size={13} className="text-slate-500 dark:text-slate-400" />
            </div>
            <span>Profile Settings</span>
          </button>

          {user?.role === 'Client Admin' && (
            <button onClick={() => handleNavigate('account-details')}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2.5 font-semibold text-xs cursor-pointer">
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Shield size={13} className="text-slate-500 dark:text-slate-400" />
              </div>
              <span>Account Details</span>
            </button>
          )}

          <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06] my-1" />
          <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Role / Demo Host</div>

          <div className="max-h-28 overflow-y-auto">
            {getUsersToRender().map((u: any) => (
              <button key={u.id}
                onClick={() => handleSwitchUser(u.email, `${u.firstName} ${u.lastName}`, u.role)}
                className={`w-full text-left px-4 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between text-xs ${user?.id === u.id ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}>
                <div className="flex flex-col truncate">
                  <span className={`font-semibold ${user?.id === u.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="text-[10px] text-slate-400">{u.role || 'User'}</span>
                </div>
                {user?.id === u.id && <Check className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            ))}
          </div>

          <div className="h-[1px] bg-slate-100 dark:bg-white/[0.06] my-1" />
          <button onClick={handleLogout}
            className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-2.5 font-semibold text-xs cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
              <LogOut size={13} className="text-rose-500 shrink-0" />
            </div>
            <span>Log out</span>
          </button>
        </div>
      )}

      {/* Profile trigger bar */}
      <div onClick={onToggle}
        className="flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.04] p-2 transition-all select-none cursor-pointer border border-transparent active:scale-[0.98]">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 font-extrabold text-xs shrink-0 shadow-xs border border-slate-300/40 dark:border-white/[0.04]">
          {user?.firstName?.charAt(0) || 'U'}{user?.lastName?.charAt(0) || 'P'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.firstName} {user?.lastName}</p>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}
