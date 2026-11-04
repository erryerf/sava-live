'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AdminEvent, EventStatus } from '@/lib/types';

interface EventListSectionProps {
  events: AdminEvent[];
  loading: boolean;
  statusFilter: 'all' | EventStatus;
  onChangeFilter: (filter: 'all' | EventStatus) => void;
  onOpenCreateWizard: () => void;
  onSelectControlRoom: (evt: AdminEvent) => void;
  onOpenEditModal: (evt: AdminEvent) => void;
  onOpenDeleteModal: (evt: AdminEvent) => void;
}

export default function EventListSection({
  events,
  loading,
  statusFilter,
  onChangeFilter,
  onOpenCreateWizard,
  onSelectControlRoom,
  onOpenEditModal,
  onOpenDeleteModal,
}: EventListSectionProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Daftar Event Klien
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Kelola ruang kontrol kamera FTP, moderasi tamu, dan arsip ZIP.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateWizard}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Buat Event Baru</span>
        </button>
      </div>

      {/* Filter Pills: All vs Active vs Archived */}
      <div className="flex gap-2">
        {(['all', 'active', 'archived'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => onChangeFilter(st)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition ${
              statusFilter === st
                ? 'bg-white text-neutral-950'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/10'
            }`}
          >
            {st === 'all' ? 'Semua Event' : st}
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="rounded-2xl bg-neutral-900 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-neutral-500 mx-auto" />
            <p className="text-sm font-semibold text-white">
              Belum ada event terdaftar
            </p>
            <p className="text-xs text-neutral-400">
              Klik &ldquo;Buat Event Baru&rdquo; untuk memulai acara.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                <th className="py-3.5 px-5">Nama Acara</th>
                <th className="py-3.5 px-4">Slug / FTP User</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Kamera FTP</th>
                <th className="py-3.5 px-4">Kuota Tamu</th>
                <th className="py-3.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-4 px-5 font-bold text-white flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: evt.theme_color }}
                    />
                    <div>
                      {evt.header_subtitle && (
                        <div className="text-[10px] font-normal text-neutral-400 italic leading-none mb-0.5">
                          {evt.header_subtitle}
                        </div>
                      )}
                      <div>{evt.name}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-neutral-300">
                    {evt.slug}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        evt.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {evt.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {evt.ftp_status?.connected ? (
                      <span className="text-emerald-400 font-semibold">
                        ● Terhubung
                      </span>
                    ) : (
                      <span className="text-neutral-500">Siaga</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-neutral-300">
                    Maks {evt.guest_upload_limit} foto
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectControlRoom(evt)}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold"
                      >
                        Control Room
                      </button>
                      <Link
                        href={`/live/${evt.slug}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold"
                      >
                        Live Wall
                      </Link>
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(evt)}
                        title="Edit Event"
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10"
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDeleteModal(evt)}
                        title="Hapus Event"
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

