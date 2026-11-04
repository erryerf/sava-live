'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calendar,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
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

function formatEventDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
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
  const activeCount = events.filter((e) => e.status === 'active').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-white/[0.07]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Manajemen Galeri
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F4F0] mt-1">
            Daftar Acara
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Filter */}
          <div className="inline-flex p-0.5 rounded-md bg-[#141413] border border-white/[0.07]">
            {(
              [
                { key: 'all', label: 'Semua' },
                { key: 'active', label: `Aktif (${activeCount})` },
                { key: 'archived', label: 'Selesai' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChangeFilter(tab.key)}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-white/[0.1] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenCreateWizard}
            className="px-3.5 py-2 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Acara Baru</span>
          </button>
        </div>
      </div>

      {/* Events List Table */}
      <div className="rounded-lg bg-[#121211] border border-white/[0.07] overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <p className="text-sm font-medium text-neutral-200">
              Belum ada acara pada filter ini
            </p>
            <p className="text-xs text-neutral-500">
              Tekan tombol &ldquo;Acara Baru&rdquo; di kanan atas untuk membuat
              ruang galeri.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 bg-[#0E0E0D]/60">
                  <th className="py-3 px-5">Acara</th>
                  <th className="py-3 px-4">Kode / URL</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Kamera</th>
                  <th className="py-3 px-4">Batas Tamu</th>
                  <th className="py-3 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-[13px]">
                {events.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => onSelectControlRoom(evt)}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3.5">
                        {/* Cover Thumbnail or Minimalist Swatch */}
                        <div
                          className="w-11 h-8 rounded overflow-hidden bg-neutral-900 border border-white/[0.08] shrink-0 relative"
                          style={{
                            borderLeftColor: evt.theme_color,
                            borderLeftWidth: '3px',
                          }}
                        >
                          {evt.header_image_url ? (
                            <img
                              src={evt.header_image_url}
                              alt={evt.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full opacity-25"
                              style={{ backgroundColor: evt.theme_color }}
                            />
                          )}
                        </div>
                        <div>
                          {evt.header_subtitle && (
                            <div className="text-[11px] text-neutral-500 leading-none mb-1">
                              {evt.header_subtitle}
                            </div>
                          )}
                          <div className="font-medium text-[#F5F4F0] group-hover:text-white leading-tight">
                            {evt.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-neutral-400">
                      /{evt.slug}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-neutral-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                        {formatEventDate(evt.start_time)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {evt.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Berlangsung
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-neutral-400 border border-white/[0.07]">
                          Selesai
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      {evt.ftp_status?.connected ? (
                        <span className="text-emerald-400 font-medium">
                          Terhubung
                        </span>
                      ) : (
                        <span className="text-neutral-500">Siaga</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-neutral-400">
                      {evt.guest_upload_limit} foto / tamu
                    </td>

                    <td
                      className="py-3.5 px-5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectControlRoom(evt)}
                          className="px-2.5 py-1.5 rounded bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] text-xs font-medium transition-colors"
                        >
                          Kelola
                        </button>
                        <Link
                          href={`/${evt.slug}`}
                          target="_blank"
                          className="px-2.5 py-1.5 rounded bg-[#1A1A18] hover:bg-[#242422] text-neutral-300 border border-white/[0.07] text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Galeri</span>
                          <ArrowUpRight className="w-3 h-3 text-neutral-500" />
                        </Link>
                        <Link
                          href={`/live/${evt.slug}`}
                          target="_blank"
                          className="px-2.5 py-1.5 rounded bg-[#1A1A18] hover:bg-[#242422] text-neutral-300 border border-white/[0.07] text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Live Wall</span>
                          <ArrowUpRight className="w-3 h-3 text-neutral-500" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(evt)}
                          title="Pengaturan Acara"
                          className="p-1.5 rounded bg-[#1A1A18] hover:bg-[#242422] text-neutral-400 hover:text-white border border-white/[0.07] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDeleteModal(evt)}
                          title="Hapus Acara"
                          className="p-1.5 rounded bg-[#1A1A18] hover:bg-rose-950/60 text-neutral-500 hover:text-rose-300 border border-white/[0.07] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
