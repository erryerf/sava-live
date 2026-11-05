'use client';

import React from 'react';
import { FolderKanban, LogOut, Users } from 'lucide-react';

export type AdminNavSection = 'events' | 'users';

interface AdminSidebarProps {
  navSection: AdminNavSection;
  isDemoMode: boolean;
  adminEmail?: string;
  onSelectNav: (section: AdminNavSection) => void;
  onLogout?: () => void;
}

export default function AdminSidebar({
  navSection,
  adminEmail,
  onSelectNav,
  onLogout,
}: AdminSidebarProps) {
  const navItems: {
    id: AdminNavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'events', label: 'Daftar Acara', icon: FolderKanban },
    { id: 'users', label: 'Tim Operator', icon: Users },
  ];

  return (
    <aside className="w-60 border-r border-white/[0.07] bg-[#0E0E0D] flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/[0.07]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-[0.06em] text-[#F5F4F0]">
              SAVA
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-amber-400 font-bold">
              LIVE
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-3 space-y-0.5">
          <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = navSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                  active
                    ? 'bg-white/[0.08] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    active ? 'text-[#F5F4F0]' : 'text-neutral-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer / Account */}
      {onLogout && (
        <div className="p-4 border-t border-white/[0.07] space-y-3">
          {adminEmail && (
            <div className="px-1">
              <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                Operator Aktif
              </div>
              <div className="text-xs text-neutral-300 truncate mt-0.5 font-mono">
                {adminEmail}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-neutral-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.07] transition-colors"
          >
            <span>Keluar Sesi</span>
            <LogOut className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      )}
    </aside>
  );
}
