import Link from 'next/link';
import { Camera, MonitorPlay, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-xl w-full space-y-8 text-center">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            SAVA Live Gallery
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Roving Photobooth & Live Gallery
          </h1>
          <p className="text-sm sm:text-base text-neutral-400">
            Pilih halaman acara atau masuk ke ruang kontrol operator.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-left">
          <Link
            href="/budi-ani"
            className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800/90 border border-white/10 transition group"
          >
            <Camera className="w-6 h-6 text-amber-400 mb-3" />
            <div className="font-bold text-sm text-white group-hover:text-amber-300">
              Galeri Tamu
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Tampilan mobile tamu & unggah momen (/budi-ani)
            </p>
          </Link>

          <Link
            href="/live/budi-ani"
            className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800/90 border border-white/10 transition group"
          >
            <MonitorPlay className="w-6 h-6 text-emerald-400 mb-3" />
            <div className="font-bold text-sm text-white group-hover:text-emerald-300">
              Live Wall Proyektor
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Layar besar gedung & pop-up real-time (/live/budi-ani)
            </p>
          </Link>

          <Link
            href="/admin"
            className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800/90 border border-white/10 transition group"
          >
            <ShieldCheck className="w-6 h-6 text-sky-400 mb-3" />
            <div className="font-bold text-sm text-white group-hover:text-sky-300">
              Admin Dashboard
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Kelola event, FTP kamera, & moderasi (/admin)
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

