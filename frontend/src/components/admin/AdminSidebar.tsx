'use client';

import React from 'react';
import { FolderKanban, LogOut, Settings, Users } from 'lucide-react';

export type AdminNavSection = 'events' | 'users' | 'settings';

interface AdminSidebarProps {
  navSection: AdminNavSection;
  isDemoMode: boolean;
  adminEmail?: string;
  onSelectNav: (section: AdminNavSection) => void;
  onLogout?: () => void;
}

export default function AdminSidebar({
  navSection,
  isDemoMode,
  adminEmail,
  onSelectNav,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="w-64 border-r border-white/10 bg-neutral-900/50 p-5 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center font-black">
            S
          </div>
          <div>
            <div className="font-extrabold text-sm text-white leading-none">
              SAVA Live
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              Operator Console
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectNav('events')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              navSection === 'events'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Event List</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              navSection === 'users'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users (Admin)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              navSection === 'settings'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings &amp; Token</span>
          </button>
        </nav>
      </div>

      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-white/10 space-y-1.5 text-xs">
          <div className="font-semibold text-neutral-300">FTP Bridge Server</div>
          <div className="text-neutral-400 font-mono text-[11px]">
            Port: 2121 (Pasif 50000-50100)
          </div>
          {isDemoMode && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300">
              Mode Cloud / Lokal Aktif
            </span>
          )}
        </div>

        {onLogout && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            {adminEmail && (
              <div className="px-2 text-[11px] text-neutral-400 truncate">
                Login: <span className="text-neutral-200 font-semibold">{adminEmail}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
