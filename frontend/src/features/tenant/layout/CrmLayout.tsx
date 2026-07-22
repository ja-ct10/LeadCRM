'use client';

import React, { useState } from 'react';
import { StickyNote } from 'lucide-react';
import CommandPalette from '@/shared/components/CommandPalette';
import NotesSidePanel from '@/shared/components/NotesSidePanel';
import SidebarNav from './sidebar-nav';
import AccountDropdown from './account-dropdown';
import Topbar from './topbar';
import { useLayout } from './use-layout';

interface LayoutProps {
  children: React.ReactNode;
}

export default function CrmLayout({ children }: LayoutProps) {
  const { navigate } = useLayout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500 selection:text-white transition-colors duration-300">
      <CommandPalette navigate={navigate} isOpen={isCommandPaletteOpen} setIsOpen={setIsCommandPaletteOpen} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SidebarNav
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        navigate={navigate}
        isAccountDropdownOpen={isAccountDropdownOpen}
        onToggleAccountDropdown={() => setIsAccountDropdownOpen(prev => !prev)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-transparent relative">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenNotes={() => setNotesOpen(true)}
        />

        <div className="flex-1 overflow-auto p-4 lg:p-8 custom-scrollbar relative">
          {children}
        </div>
      </main>

      <NotesSidePanel isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}
