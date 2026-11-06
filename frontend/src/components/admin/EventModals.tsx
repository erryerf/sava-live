'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Download, Loader2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { generatePolaroidFrameFile } from '@/lib/frame-generator';
import {
  createAdminEvent,
  deleteAdminEvent,
  updateAdminEvent,
  uploadAdminCustomFrame,
  uploadAdminHeaderImage,
} from '@/lib/admin-api';
import {
  getLocalEventCustomization,
  saveLocalEventCustomization,
} from '@/lib/api';
import { AdminEvent, EventStatus } from '@/lib/types';
import { getStoredDemoEvents, saveStoredDemoEvents } from './demo-data';

interface CreateEventWizardModalProps {
  open: boolean;
  isDemoMode: boolean;
  originUrl: string;
  onClose: () => void;
  onCreatedAndOpenControlRoom: (evt: AdminEvent) => void;
  onReloadEvents: () => Promise<void>;
  showToast: (msg: string) => void;
}

export function CreateEventWizardModal({
  open,
  isDemoMode,
  originUrl,
  onClose,
  onCreatedAndOpenControlRoom,
  onReloadEvents,
  showToast,
}: CreateEventWizardModalProps) {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [submittingWizard, setSubmittingWizard] = useState(false);
  const [createdEventResult, setCreatedEventResult] =
    useState<AdminEvent | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreviewDataUrl, setHeaderPreviewDataUrl] = useState<
    string | null
  >(null);
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [wizardFrameMode, setWizardFrameMode] = useState<'polaroid' | 'custom' | 'none'>('polaroid');
  const [wizardPolaroidName, setWizardPolaroidName] = useState('');
  const [wizardPolaroidDate, setWizardPolaroidDate] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    header_subtitle: 'The Wedding of',
    slug: '',
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 3600000 * 6).toISOString().slice(0, 16),
    theme_color: '#D4AF37',
    guest_upload_limit: 5,
    require_guest_moderation: false,
    gallery_theme: 'dark' as 'dark' | 'light',
  });

  const qrCanvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setWizardStep(1);
      setCreatedEventResult(null);
      setHeaderFile(null);
      setHeaderPreviewDataUrl(null);
      setFrameFile(null);
      setFormData({
        name: '',
        header_subtitle: 'The Wedding of',
        slug: '',
        start_time: new Date().toISOString().slice(0, 16),
        end_time: new Date(Date.now() + 3600000 * 6).toISOString().slice(0, 16),
        theme_color: '#D4AF37',
        guest_upload_limit: 5,
        require_guest_moderation: false,
        gallery_theme: 'dark',
      });
    }
  }, [open]);

  if (!open) return null;

  const downloadQrCodePng = (slug: string) => {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${slug}.png`;
    a.click();
    showToast('QR Code diunduh!');
  };

  const handleHeaderFileSelect = (file: File | null) => {
    if (!file) return;
    setHeaderFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setHeaderPreviewDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingWizard) return;
    setSubmittingWizard(true);

    try {
      if (isDemoMode) {
        const slug =
          formData.slug ||
          formData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        const demoCreated: AdminEvent = {
          id: `demo-${Date.now()}`,
          name: formData.name,
          header_subtitle: formData.header_subtitle,
          slug,
          status: 'active',
          theme_color: formData.theme_color,
          header_image_url: headerPreviewDataUrl || null,
          guest_upload_limit: formData.guest_upload_limit,
          gallery_theme: formData.gallery_theme,
          is_upload_allowed: true,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString(),
          custom_frame_key: frameFile
            ? `events/${slug}/frames/${frameFile.name}`
            : null,
          custom_frame_url: null,
          require_guest_moderation: formData.require_guest_moderation,
          archive_zip_key: null,
          archive_download_url: null,
          archive_status: 'none',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ftp_status: {
            connected: false,
            active_sessions: 0,
            last_connected_at: null,
            last_upload_at: null,
          },
          ftp_credentials: {
            id: `ftp-${Date.now()}`,
            username: slug,
            password: Math.random().toString(36).slice(2, 10),
            is_active: true,
            created_at: new Date().toISOString(),
          },
        };
        saveLocalEventCustomization(slug, {
          name: formData.name,
          header_subtitle: formData.header_subtitle,
          theme_color: formData.theme_color,
          header_image_url: headerPreviewDataUrl || null,
          guest_upload_limit: Number(formData.guest_upload_limit),
          status: 'active',
          is_upload_allowed: true,
          require_guest_moderation: formData.require_guest_moderation,
          gallery_theme: formData.gallery_theme,
        });
        const updatedList = [
          demoCreated,
          ...getStoredDemoEvents().filter((item) => item.slug !== slug),
        ];
        saveStoredDemoEvents(updatedList);
        await onReloadEvents();
        setCreatedEventResult(demoCreated);
        setWizardStep(3);
        showToast('Acara berhasil dibuat.');
        return;
      }

      const created = await createAdminEvent({
        name: formData.name,
        header_subtitle: formData.header_subtitle,
        slug: formData.slug || undefined,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        theme_color: formData.theme_color,
        guest_upload_limit: Number(formData.guest_upload_limit),
        require_guest_moderation: formData.require_guest_moderation,
        gallery_theme: formData.gallery_theme,
        status: 'active',
      });

      saveLocalEventCustomization(created.slug, {
        name: created.name,
        header_subtitle: created.header_subtitle ?? formData.header_subtitle,
        theme_color: created.theme_color,
        header_image_url: headerPreviewDataUrl || created.header_image_url || null,
        guest_upload_limit: Number(formData.guest_upload_limit),
        gallery_theme: formData.gallery_theme,
        status: created.status,
        is_upload_allowed: created.is_upload_allowed,
        require_guest_moderation: formData.require_guest_moderation,
      });

      if (headerFile) {
        try {
          const uploadedHeader = await uploadAdminHeaderImage(
            created.id,
            headerFile,
          );
          created.header_image_url =
            uploadedHeader.public_url || headerPreviewDataUrl;
        } catch {
          created.header_image_url = headerPreviewDataUrl;
        }
      }

      let activeFrameFile = frameFile;
      if (wizardFrameMode === 'polaroid' && !activeFrameFile) {
        try {
          activeFrameFile = await generatePolaroidFrameFile(
            {
              names: wizardPolaroidName.trim() || formData.name || 'Nama Pasangan',
              date: wizardPolaroidDate.trim() || formatPolaroidDate(formData.start_time),
            },
            `polaroid-${created.slug}.png`,
          );
        } catch {
          // fallback
        }
      }

      if (activeFrameFile && wizardFrameMode !== 'none') {
        try {
          const uploadedFrame = await uploadAdminCustomFrame(created.id, activeFrameFile);
          created.custom_frame_key = uploadedFrame.file_key;
          created.custom_frame_url = uploadedFrame.public_url || null;
        } catch {
          showToast('Event dibuat (unggah frame dilewati).');
        }
      }

      const updatedStored = [
        created,
        ...getStoredDemoEvents().filter(
          (item) => item.id !== created.id && item.slug !== created.slug,
        ),
      ];
      saveStoredDemoEvents(updatedStored);

      setCreatedEventResult(created);
      setWizardStep(3);
      await onReloadEvents();
      showToast('Acara dan kredensial FTP siap.');
    } catch (err) {
      showToast((err as Error).message || 'Gagal membuat event.');
    } finally {
      setSubmittingWizard(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg bg-[#121211] border border-white/[0.08] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              Langkah {wizardStep} dari 3
            </span>
            <h2 className="text-lg font-semibold text-[#F5F4F0] mt-0.5">
              {wizardStep === 1
                ? 'Detail Dasar Acara'
                : wizardStep === 2
                  ? 'Tema Visual & Moderasi'
                  : 'Acara Siap • Kredensial FTP & QR'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {wizardStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Subjudul Pembuka
              </label>
              <input
                type="text"
                placeholder="Contoh: The Wedding of / The Engagement of"
                value={formData.header_subtitle}
                onChange={(e) =>
                  setFormData({ ...formData, header_subtitle: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-sm text-[#F5F4F0]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Nama Acara / Mempelai
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Budi & Ani"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-sm text-[#F5F4F0]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Kode URL &amp; Username FTP (Opsional)
              </label>
              <input
                type="text"
                placeholder="budi-ani"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-sm font-mono text-[#F5F4F0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Waktu Mulai
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Waktu Selesai
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-xs font-medium bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!formData.name.trim()}
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 rounded-md text-xs font-medium bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] disabled:opacity-40"
              >
                Lanjut &rarr;
              </button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <form onSubmit={handleCreateEventSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Warna Aksen (Hex)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.theme_color}
                    onChange={(e) =>
                      setFormData({ ...formData, theme_color: e.target.value })
                    }
                    className="w-9 h-9 rounded bg-transparent border border-white/[0.09] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.theme_color}
                    onChange={(e) =>
                      setFormData({ ...formData, theme_color: e.target.value })
                    }
                    className="flex-1 px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs font-mono text-[#F5F4F0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Batas Unggah Tamu
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={formData.guest_upload_limit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      guest_upload_limit: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Tema Tampilan Galeri Tamu
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, gallery_theme: 'dark' })
                  }
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    formData.gallery_theme === 'dark'
                      ? 'border-amber-400 bg-amber-400/10 text-white shadow-lg'
                      : 'border-white/10 bg-[#0B0B0A] text-neutral-400 hover:border-white/25'
                  }`}
                >
                  <span className="text-lg">🌙</span>
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">
                      Obsidian Dark
                    </div>
                    <div className="text-[10px] text-neutral-400 leading-tight">
                      Resepsi malam &amp; ballroom mewah
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, gallery_theme: 'light' })
                  }
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    formData.gallery_theme === 'light'
                      ? 'border-amber-400 bg-amber-400/10 text-white shadow-lg'
                      : 'border-white/10 bg-[#0B0B0A] text-neutral-400 hover:border-white/25'
                  }`}
                >
                  <span className="text-lg">☀️</span>
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">
                      Ivory Alabaster
                    </div>
                    <div className="text-[10px] text-neutral-400 leading-tight">
                      Akad pagi &amp; garden party cerah
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Foto Sampul Galeri (JPG/PNG)
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-white/15 bg-[#0B0B0A] hover:bg-[#161614] cursor-pointer text-xs text-neutral-300">
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  {headerFile
                    ? headerFile.name
                    : 'Pilih foto sampul galeri tamu'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    handleHeaderFileSelect(e.target.files?.[0] || null)
                  }
                  className="hidden"
                />
              </label>

              {headerPreviewDataUrl && (
                <div className="mt-2.5 relative h-24 rounded-md overflow-hidden border border-white/[0.08] flex flex-col items-center justify-center text-center">
                  <img
                    src={headerPreviewDataUrl}
                    alt="Pratinjau foto sampul"
                    className="absolute inset-0 w-full h-full object-cover brightness-[0.38]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-neutral-950/90" />
                  {formData.header_subtitle.trim() && (
                    <span className="relative z-10 font-display italic text-xs tracking-[0.1em] text-white/85">
                      {formData.header_subtitle}
                    </span>
                  )}
                  <span className="relative z-10 font-display text-lg font-medium text-white drop-shadow">
                    {(formData.name || 'Budi & Ani').replace(
                      /^(pernikahan|the wedding of|resepsi|engagement of)\s+/i,
                      '',
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 p-3.5 rounded-lg bg-[#0F0F0E] border border-white/[0.08]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200">
                  Bingkai Digital (.PNG)
                </label>
                {wizardFrameMode === 'polaroid' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Polaroid Otomatis
                  </span>
                )}
                {wizardFrameMode === 'custom' && frameFile && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    File Siap
                  </span>
                )}
                {wizardFrameMode === 'none' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.05] text-neutral-400 border border-white/[0.08]">
                    Tanpa Bingkai
                  </span>
                )}
              </div>

              {/* Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-md bg-[#161614] border border-white/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => setWizardFrameMode('polaroid')}
                  className={`py-1.5 px-2 rounded font-medium text-center transition-all flex items-center justify-center gap-1 ${
                    wizardFrameMode === 'polaroid'
                      ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Polaroid Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWizardFrameMode('custom')}
                  className={`py-1.5 px-2 rounded font-medium text-center transition-all flex items-center justify-center gap-1 ${
                    wizardFrameMode === 'custom'
                      ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload .PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWizardFrameMode('none')}
                  className={`py-1.5 px-2 rounded font-medium text-center transition-all flex items-center justify-center gap-1 ${
                    wizardFrameMode === 'none'
                      ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span>Tanpa Bingkai</span>
                </button>
              </div>

              {wizardFrameMode === 'polaroid' && (
                <div className="space-y-3 pt-1">
                  {/* Mini Mockup Preview */}
                  <div className="flex flex-col items-center justify-center py-3 px-2 bg-[#080807] rounded-md border border-white/[0.06]">
                    <div className="w-[140px] bg-[#FFFFFF] rounded-xs shadow-[0_8px_20px_rgba(0,0,0,0.5)] p-2 pb-2.5 border border-neutral-300 select-none">
                      <div className="relative aspect-[3/3.6] w-full bg-neutral-900 rounded-[1px] overflow-hidden border border-black/10">
                        <img
                          src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80"
                          alt="Foto Contoh"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="pt-2 text-center space-y-0.5">
                        <div
                          className="text-lg text-neutral-900 leading-tight italic truncate px-1"
                          style={{ fontFamily: "'Alex Brush', 'Dancing Script', 'Great Vibes', cursive" }}
                        >
                          {wizardPolaroidName.trim() || formData.name || 'Nama Pasangan'}
                        </div>
                        <div className="text-[9px] font-semibold text-neutral-700 tracking-wider">
                          {wizardPolaroidDate.trim() || formatPolaroidDate(formData.start_time)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-400">Nama di Bingkai</span>
                      <input
                        type="text"
                        value={wizardPolaroidName}
                        onChange={(e) => setWizardPolaroidName(e.target.value)}
                        placeholder={formData.name || 'Contoh: Olivia & Mario'}
                        className="w-full px-2.5 py-1.5 text-xs bg-[#1A1A18] border border-white/[0.08] rounded text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-400">Tanggal Acara</span>
                      <input
                        type="text"
                        value={wizardPolaroidDate}
                        onChange={(e) => setWizardPolaroidDate(e.target.value)}
                        placeholder="Contoh: 26/06/2026"
                        className="w-full px-2.5 py-1.5 text-xs bg-[#1A1A18] border border-white/[0.08] rounded text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardFrameMode === 'custom' && (
                <div className="space-y-2 pt-1">
                  <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-white/15 bg-[#0B0B0A] hover:bg-[#161614] cursor-pointer text-xs text-neutral-300">
                    <Upload className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      {frameFile ? frameFile.name : 'Pilih file PNG bingkai acara'}
                    </span>
                    <input
                      type="file"
                      accept="image/png"
                      onChange={(e) => setFrameFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <label className="flex items-center justify-between p-3 rounded-md bg-[#0B0B0A] border border-white/[0.08] cursor-pointer">
              <div>
                <div className="text-xs font-medium text-[#F5F4F0]">
                  Moderasi Foto Tamu
                </div>
                <div className="text-[11px] text-neutral-400">
                  Tahan foto tamu di antrean sampai disetujui operator
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.require_guest_moderation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    require_guest_moderation: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-white"
              />
            </label>

            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 rounded-md text-xs font-medium bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-300"
              >
                &larr; Kembali
              </button>
              <button
                type="submit"
                disabled={submittingWizard}
                className="px-4 py-2 rounded-md text-xs font-medium bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] flex items-center gap-2"
              >
                {submittingWizard && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Simpan &amp; Buat Acara</span>
              </button>
            </div>
          </form>
        )}

        {wizardStep === 3 && createdEventResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-[#0B0B0A] border border-white/[0.08] space-y-2 text-xs font-mono">
              <div className="text-[#F5F4F0] font-sans font-medium text-xs mb-1 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-neutral-400" />
                <span>Kredensial FTP Kamera</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Port:</span>
                <span className="text-neutral-200">2121</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Username (Slug):</span>
                <span className="text-[#F5F4F0]">
                  {createdEventResult.ftp_credentials?.username ||
                    createdEventResult.slug}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Password:</span>
                <span className="text-emerald-400">
                  {createdEventResult.ftp_credentials?.password ||
                    '(Tersimpan)'}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center p-4 rounded-md bg-[#0B0B0A] border border-white/[0.08] space-y-2.5">
              <div ref={qrCanvasRef} className="p-3 bg-white rounded">
                <QRCodeCanvas
                  value={`${originUrl.replace(/\/+$/, '')}/${createdEventResult.slug}?limit=${createdEventResult.guest_upload_limit}`}
                  size={140}
                  level="H"
                />
              </div>
              <button
                type="button"
                onClick={() => downloadQrCodePng(createdEventResult.slug)}
                className="text-xs font-medium text-neutral-300 hover:text-white flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh QR Code (.PNG)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onCreatedAndOpenControlRoom(createdEventResult)}
              className="w-full py-2.5 rounded-md text-xs font-medium bg-[#F5F4F0] hover:bg-white text-[#0E0E0D]"
            >
              Buka Ruang Kontrol Acara &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface EditEventModalProps {
  editingEvent: AdminEvent | null;
  isDemoMode: boolean;
  onClose: () => void;
  onEventSaved: (updated: AdminEvent) => void;
  onReloadEvents: () => Promise<void>;
  showToast: (msg: string) => void;
}

function formatPolaroidDate(isoString?: string | null): string {
  if (!isoString) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }
  try {
    const dt = new Date(isoString);
    if (isNaN(dt.getTime())) return '26/06/2026';
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  } catch {
    return '26/06/2026';
  }
}

export function EditEventModal({
  editingEvent,
  isDemoMode,
  onClose,
  onEventSaved,
  onReloadEvents,
  showToast,
}: EditEventModalProps) {
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editModalHeaderFile, setEditModalHeaderFile] = useState<File | null>(
    null,
  );
  const [editModalHeaderPreview, setEditModalHeaderPreview] = useState<
    string | null
  >(null);
  const [editModalFrameFile, setEditModalFrameFile] = useState<File | null>(
    null,
  );
  const [editModalFramePreview, setEditModalFramePreview] = useState<
    string | null
  >(null);
  const [isFrameCleared, setIsFrameCleared] = useState(false);
  const [editFrameTab, setEditFrameTab] = useState<'default_polaroid' | 'custom_upload'>(
    'default_polaroid',
  );
  const [editPolaroidName, setEditPolaroidName] = useState('');
  const [editPolaroidDate, setEditPolaroidDate] = useState('');
  const [isGeneratingPolaroid, setIsGeneratingPolaroid] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    header_subtitle: 'The Wedding of',
    slug: '',
    status: 'active' as EventStatus,
    start_time: '',
    end_time: '',
    theme_color: '#D4AF37',
    guest_upload_limit: 5,
    require_guest_moderation: false,
    gallery_theme: 'dark' as 'dark' | 'light',
  });

  useEffect(() => {
    if (!editingEvent) return;
    const localCustom = getLocalEventCustomization(editingEvent.slug);
    const toLocalInput = (iso: string) => {
      try {
        return new Date(iso).toISOString().slice(0, 16);
      } catch {
        return new Date().toISOString().slice(0, 16);
      }
    };

    setEditModalHeaderFile(null);
    setEditModalHeaderPreview(
      editingEvent.header_image_url || localCustom?.header_image_url || null,
    );
    setEditModalFrameFile(null);
    setIsFrameCleared(false);
    setEditModalFramePreview(
      editingEvent.custom_frame_url || localCustom?.custom_frame_url || null,
    );
    setEditPolaroidName(localCustom?.name || editingEvent.name || '');
    setEditPolaroidDate(formatPolaroidDate(editingEvent.start_time));
    setEditFormData({
      name: localCustom?.name || editingEvent.name,
      header_subtitle:
        localCustom?.header_subtitle !== undefined
          ? (localCustom.header_subtitle ?? '')
          : (editingEvent.header_subtitle ?? 'The Wedding of'),
      slug: editingEvent.slug,
      status: editingEvent.status,
      start_time: toLocalInput(editingEvent.start_time),
      end_time: toLocalInput(editingEvent.end_time),
      theme_color:
        localCustom?.theme_color || editingEvent.theme_color || '#D4AF37',
      guest_upload_limit:
        typeof localCustom?.guest_upload_limit === 'number'
          ? localCustom.guest_upload_limit
          : (editingEvent.guest_upload_limit ?? 5),
      require_guest_moderation: Boolean(editingEvent.require_guest_moderation),
      gallery_theme: (localCustom?.gallery_theme ||
        editingEvent.gallery_theme ||
        'dark') as 'dark' | 'light',
    });
  }, [editingEvent]);

  if (!editingEvent) return null;

  const handleGenerateEditPolaroid = async () => {
    if (isGeneratingPolaroid) return;
    setIsGeneratingPolaroid(true);
    try {
      const file = await generatePolaroidFrameFile(
        {
          names: editPolaroidName.trim() || editFormData.name || 'Nama Pasangan',
          date: editPolaroidDate.trim(),
        },
        `polaroid-${editFormData.slug || 'frame'}.png`,
      );

      setEditModalFrameFile(file);
      setIsFrameCleared(false);

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEditModalFramePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
      showToast('Bingkai Polaroid siap diterapkan! Klik Simpan Perubahan.');
    } catch (err) {
      showToast((err as Error).message || 'Gagal menghasilkan bingkai.');
    } finally {
      setIsGeneratingPolaroid(false);
    }
  };

  const handleSaveEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingEdit) return;
    setSubmittingEdit(true);

    try {
      const cleanSlug =
        editFormData.slug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-|-$/g, '') || editingEvent.slug;

      const frameUrl = isFrameCleared
        ? null
        : editModalFramePreview || editingEvent.custom_frame_url || null;
      const frameKey = isFrameCleared
        ? null
        : editModalFrameFile
          ? `events/${cleanSlug}/frames/${editModalFrameFile.name}`
          : editingEvent.custom_frame_key || null;

      saveLocalEventCustomization(cleanSlug, {
        name: editFormData.name.trim(),
        header_subtitle: editFormData.header_subtitle.trim(),
        theme_color: editFormData.theme_color,
        header_image_url: editModalHeaderPreview,
        custom_frame_url: frameUrl,
        custom_frame_key: frameKey,
        guest_upload_limit: Number(editFormData.guest_upload_limit),
        status: editFormData.status,
        is_upload_allowed: editFormData.status === 'active',
        require_guest_moderation: editFormData.require_guest_moderation,
        gallery_theme: editFormData.gallery_theme,
      });

      if (isDemoMode) {
        const updatedEvt: AdminEvent = {
          ...editingEvent,
          name: editFormData.name.trim(),
          header_subtitle: editFormData.header_subtitle.trim(),
          slug: cleanSlug,
          status: editFormData.status,
          is_upload_allowed: editFormData.status === 'active',
          start_time: new Date(editFormData.start_time).toISOString(),
          end_time: new Date(editFormData.end_time).toISOString(),
          theme_color: editFormData.theme_color,
          header_image_url: editModalHeaderPreview,
          custom_frame_url: frameUrl,
          custom_frame_key: frameKey,
          guest_upload_limit: Number(editFormData.guest_upload_limit),
          require_guest_moderation: editFormData.require_guest_moderation,
          gallery_theme: editFormData.gallery_theme,
          updated_at: new Date().toISOString(),
          ftp_credentials: editingEvent.ftp_credentials
            ? {
                ...editingEvent.ftp_credentials,
                username: cleanSlug,
                is_active: editFormData.status !== 'archived',
              }
            : undefined,
        };

        const allDemo = getStoredDemoEvents().map((item) =>
          item.id === editingEvent.id ? updatedEvt : item,
        );
        saveStoredDemoEvents(allDemo);
        onEventSaved(updatedEvt);
        await onReloadEvents();
        onClose();
        showToast('Perubahan event berhasil disimpan! ✨');
        return;
      }

      const updated = await updateAdminEvent(editingEvent.id, {
        name: editFormData.name.trim(),
        header_subtitle: editFormData.header_subtitle.trim(),
        slug: cleanSlug,
        status: editFormData.status,
        start_time: new Date(editFormData.start_time).toISOString(),
        end_time: new Date(editFormData.end_time).toISOString(),
        theme_color: editFormData.theme_color,
        guest_upload_limit: Number(editFormData.guest_upload_limit),
        require_guest_moderation: editFormData.require_guest_moderation,
        gallery_theme: editFormData.gallery_theme,
        custom_frame_key: isFrameCleared ? null : undefined,
      });

      if (isFrameCleared) {
        updated.custom_frame_key = null;
        updated.custom_frame_url = null;
      }

      if (editModalHeaderFile) {
        try {
          const uploadedHeader = await uploadAdminHeaderImage(
            editingEvent.id,
            editModalHeaderFile,
          );
          updated.header_image_url =
            uploadedHeader.public_url || editModalHeaderPreview;
        } catch {
          updated.header_image_url = editModalHeaderPreview;
        }
      }

      if (editModalFrameFile) {
        try {
          const uploadedFrame = await uploadAdminCustomFrame(
            editingEvent.id,
            editModalFrameFile,
          );
          updated.custom_frame_key = uploadedFrame.file_key;
          updated.custom_frame_url =
            uploadedFrame.public_url || editModalFramePreview;
        } catch {
          updated.custom_frame_url = editModalFramePreview;
        }
      }

      const allDemo = getStoredDemoEvents().map((item) =>
        item.id === editingEvent.id || item.slug === editingEvent.slug
          ? updated
          : item,
      );
      saveStoredDemoEvents(allDemo);

      onEventSaved(updated);
      await onReloadEvents();
      onClose();
      showToast('Perubahan acara berhasil disimpan.');
    } catch (err) {
      showToast((err as Error).message || 'Gagal memperbarui event.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSaveEditEvent}
        className="w-full max-w-lg rounded-lg bg-[#121211] border border-white/[0.08] p-6 space-y-4 shadow-2xl my-8"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              Pengaturan Acara
            </span>
            <h2 className="text-lg font-semibold text-[#F5F4F0] mt-0.5">
              {editingEvent.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Subjudul Pembuka
            </label>
            <input
              type="text"
              placeholder="Contoh: The Wedding of"
              value={editFormData.header_subtitle}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  header_subtitle: e.target.value,
                })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Nama Acara / Mempelai
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Andre & Fia"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Kode URL &amp; Username FTP
            </label>
            <input
              type="text"
              required
              value={editFormData.slug}
              onChange={(e) =>
                setEditFormData({ ...editFormData, slug: e.target.value })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs font-mono text-[#F5F4F0]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Status Acara
            </label>
            <select
              value={editFormData.status}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  status: e.target.value as EventStatus,
                })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
            >
              <option value="active">Berlangsung (Live)</option>
              <option value="draft">Draft</option>
              <option value="archived">Selesai (Diarsipkan)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Waktu Mulai
            </label>
            <input
              type="datetime-local"
              value={editFormData.start_time}
              onChange={(e) =>
                setEditFormData({ ...editFormData, start_time: e.target.value })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Waktu Selesai
            </label>
            <input
              type="datetime-local"
              value={editFormData.end_time}
              onChange={(e) =>
                setEditFormData({ ...editFormData, end_time: e.target.value })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Warna Aksen (Hex)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editFormData.theme_color}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    theme_color: e.target.value,
                  })
                }
                className="w-9 h-9 rounded bg-transparent border border-white/[0.09] cursor-pointer"
              />
              <input
                type="text"
                value={editFormData.theme_color}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    theme_color: e.target.value,
                  })
                }
                className="flex-1 px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs font-mono text-[#F5F4F0]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Batas Unggah Tamu
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={editFormData.guest_upload_limit}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  guest_upload_limit: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.09] text-xs text-[#F5F4F0]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Tema Tampilan Galeri Tamu
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() =>
                setEditFormData({ ...editFormData, gallery_theme: 'dark' })
              }
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                editFormData.gallery_theme === 'dark'
                  ? 'border-amber-400 bg-amber-400/10 text-white shadow-lg'
                  : 'border-white/10 bg-[#0B0B0A] text-neutral-400 hover:border-white/25'
              }`}
            >
              <span className="text-lg">🌙</span>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">
                  Obsidian Dark
                </div>
                <div className="text-[10px] text-neutral-400 leading-tight">
                  Resepsi malam &amp; ballroom mewah
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                setEditFormData({ ...editFormData, gallery_theme: 'light' })
              }
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                editFormData.gallery_theme === 'light'
                  ? 'border-amber-400 bg-amber-400/10 text-white shadow-lg'
                  : 'border-white/10 bg-[#0B0B0A] text-neutral-400 hover:border-white/25'
              }`}
            >
              <span className="text-lg">☀️</span>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">
                  Ivory Alabaster
                </div>
                <div className="text-[10px] text-neutral-400 leading-tight">
                  Akad pagi &amp; garden party cerah
                </div>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">
            Foto Sampul Galeri Tamu
          </label>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-white/15 bg-[#0B0B0A] hover:bg-[#161614] cursor-pointer text-xs text-neutral-300">
              <Upload className="w-3.5 h-3.5 text-neutral-400" />
              <span className="truncate">
                {editModalHeaderFile
                  ? editModalHeaderFile.name
                  : 'Pilih / Ganti Foto Sampul'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (!f) return;
                  setEditModalHeaderFile(f);
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      setEditModalHeaderPreview(reader.result);
                    }
                  };
                  reader.readAsDataURL(f);
                }}
                className="hidden"
              />
            </label>
            {editModalHeaderPreview && (
              <button
                type="button"
                onClick={() => {
                  setEditModalHeaderFile(null);
                  setEditModalHeaderPreview(null);
                }}
                className="px-3 py-2 rounded-md bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-xs text-neutral-300"
              >
                Hapus Foto
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 p-3.5 rounded-lg bg-[#0F0F0E] border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <span>Bingkai Digital (.PNG)</span>
              {(editModalFramePreview || editModalFrameFile) ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Aktif
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.05] text-neutral-400 border border-white/[0.08]">
                  Belum Ada
                </span>
              )}
            </label>

            {(editModalFramePreview || editModalFrameFile) && (
              <button
                type="button"
                onClick={() => {
                  setEditModalFrameFile(null);
                  setEditModalFramePreview(null);
                  setIsFrameCleared(true);
                }}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
              >
                Hapus Bingkai
              </button>
            )}
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-[#161614] border border-white/[0.06] text-xs">
            <button
              type="button"
              onClick={() => setEditFrameTab('default_polaroid')}
              className={`py-1.5 px-2.5 rounded font-medium text-center transition-all flex items-center justify-center gap-1.5 ${
                editFrameTab === 'default_polaroid'
                  ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Polaroid Default</span>
            </button>
            <button
              type="button"
              onClick={() => setEditFrameTab('custom_upload')}
              className={`py-1.5 px-2.5 rounded font-medium text-center transition-all flex items-center justify-center gap-1.5 ${
                editFrameTab === 'custom_upload'
                  ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload .PNG</span>
            </button>
          </div>

          {/* TAB 1: POLAROID DEFAULT */}
          {editFrameTab === 'default_polaroid' && (
            <div className="space-y-3 pt-1">
              {/* Mini Mockup Preview */}
              <div className="flex flex-col items-center justify-center py-3 px-2 bg-[#080807] rounded-md border border-white/[0.06]">
                <div className="w-[150px] bg-[#FFFFFF] rounded-xs shadow-[0_8px_20px_rgba(0,0,0,0.5)] p-2 pb-2.5 border border-neutral-300 select-none">
                  <div className="relative aspect-[3/3.6] w-full bg-neutral-900 rounded-[1px] overflow-hidden border border-black/10">
                    <img
                      src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80"
                      alt="Foto Contoh"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pt-2 text-center space-y-0.5">
                    <div
                      className="text-lg text-neutral-900 leading-tight italic truncate px-1"
                      style={{ fontFamily: "'Alex Brush', 'Dancing Script', 'Great Vibes', cursive" }}
                    >
                      {editPolaroidName.trim() || editFormData.name || 'Nama Pasangan'}
                    </div>
                    <div className="text-[9px] font-semibold text-neutral-700 tracking-wider">
                      {editPolaroidDate.trim() || '26/06/2026'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-400">Nama Pasangan</span>
                  <input
                    type="text"
                    value={editPolaroidName}
                    onChange={(e) => setEditPolaroidName(e.target.value)}
                    placeholder="Contoh: Olivia & Mario"
                    className="w-full px-2.5 py-1.5 text-xs bg-[#1A1A18] border border-white/[0.08] rounded text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/40"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-400">Tanggal Acara</span>
                  <input
                    type="text"
                    value={editPolaroidDate}
                    onChange={(e) => setEditPolaroidDate(e.target.value)}
                    placeholder="Contoh: 26/06/2026"
                    className="w-full px-2.5 py-1.5 text-xs bg-[#1A1A18] border border-white/[0.08] rounded text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/40"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isGeneratingPolaroid}
                onClick={handleGenerateEditPolaroid}
                className="w-full py-2 px-3 rounded bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isGeneratingPolaroid ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sedang Membuat Polaroid...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Buat &amp; Pasang Polaroid Ini</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: UPLOAD CUSTOM .PNG */}
          {editFrameTab === 'custom_upload' && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-white/15 bg-[#0B0B0A] hover:bg-[#161614] cursor-pointer text-xs text-neutral-300">
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span className="truncate">
                  {editModalFrameFile
                    ? editModalFrameFile.name
                    : editModalFramePreview
                      ? 'Bingkai Terpasang (Klik untuk Ganti)'
                      : 'Pilih File PNG Bingkai'}
                </span>
                <input
                  type="file"
                  accept="image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (!f) return;
                    setEditModalFrameFile(f);
                    setIsFrameCleared(false);
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setEditModalFramePreview(reader.result);
                      }
                    };
                    reader.readAsDataURL(f);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        <label className="flex items-center justify-between p-3 rounded-md bg-[#0B0B0A] border border-white/[0.08] cursor-pointer">
          <div>
            <div className="text-xs font-medium text-[#F5F4F0]">
              Moderasi Foto Tamu
            </div>
            <div className="text-[11px] text-neutral-400">
              Tahan foto tamu di antrean sampai disetujui operator
            </div>
          </div>
          <input
            type="checkbox"
            checked={editFormData.require_guest_moderation}
            onChange={(e) =>
              setEditFormData({
                ...editFormData,
                require_guest_moderation: e.target.checked,
              })
            }
            className="w-4 h-4 accent-white"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-medium bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-300"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submittingEdit}
            className="px-4 py-2 rounded-md text-xs font-medium bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] flex items-center gap-2"
          >
            {submittingEdit && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  );
}

interface DeleteEventModalProps {
  deletingEvent: AdminEvent | null;
  isDemoMode: boolean;
  onClose: () => void;
  onEventDeleted: (deletedId: string) => void;
  onReloadEvents: () => Promise<void>;
  showToast: (msg: string) => void;
}

export function DeleteEventModal({
  deletingEvent,
  isDemoMode,
  onClose,
  onEventDeleted,
  onReloadEvents,
  showToast,
}: DeleteEventModalProps) {
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [purgeStorage, setPurgeStorage] = useState(false);

  if (!deletingEvent) return null;

  const handleConfirmDeleteEvent = async () => {
    if (submittingDelete) return;
    setSubmittingDelete(true);

    try {
      // Always remove from local storage cache first to prevent resurrecting
      const remaining = getStoredDemoEvents().filter(
        (item) => item.id !== deletingEvent.id && item.slug !== deletingEvent.slug,
      );
      saveStoredDemoEvents(remaining);
      try {
        window.localStorage.removeItem(`sava_custom_${deletingEvent.slug}`);
      } catch {}

      if (!isDemoMode) {
        const res = await deleteAdminEvent(
          deletingEvent.id || deletingEvent.slug,
          purgeStorage,
        );
        if (purgeStorage && typeof res.r2_deleted_count === 'number') {
          showToast(
            `Acara dan ${res.r2_deleted_count} file di R2 berhasil dibersihkan.`,
          );
        } else {
          showToast(
            purgeStorage
              ? 'Acara dan seluruh file di R2 berhasil dihapus.'
              : 'Acara berhasil dihapus.',
          );
        }
      } else {
        showToast('Acara berhasil dihapus.');
      }

      onEventDeleted(deletingEvent.id);
      await onReloadEvents();
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Gagal menghapus acara.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-[#121211] border border-white/[0.08] p-6 space-y-4 shadow-2xl">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-[#F5F4F0]">
            Hapus Acara Ini?
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Acara <strong className="text-[#F5F4F0]">{deletingEvent.name}</strong>{' '}
            (<span className="font-mono">/{deletingEvent.slug}</span>) akan
            dinonaktifkan secara permanen.
          </p>
        </div>

        {/* Checkbox Opsi Pembersihan Cloudflare R2 */}
        <label className="flex items-start gap-3 p-3.5 rounded-lg bg-[#161615] border border-white/[0.07] cursor-pointer hover:border-white/[0.14] transition-colors select-none group">
          <input
            type="checkbox"
            checked={purgeStorage}
            onChange={(e) => setPurgeStorage(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-rose-600 focus:ring-rose-500/20 cursor-pointer accent-rose-600"
          />
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors">
              Hapus permanen file foto di Cloudflare R2
            </span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Jika dicentang, seluruh master foto asli di folder{' '}
              <code className="text-neutral-300 font-mono">events/{deletingEvent.slug}/</code>{' '}
              akan disapu bersih dari cloud storage.
            </p>
          </div>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={submittingDelete}
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-medium bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-300"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={submittingDelete}
            onClick={handleConfirmDeleteEvent}
            className="px-4 py-2 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2"
          >
            {submittingDelete && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>Hapus Acara</span>
          </button>
        </div>
      </div>
    </div>
  );
}

