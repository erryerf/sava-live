---
description: 
---

Product Requirements Document (PRD)

Product Name: 

Nama Platform/Layanan Anda - e.g., SAVA Live


Document Version: 3.6 (In-House / Proprietary Edition - Termasuk Arsitektur CDN)
Target Platform: Web Application (Next.js), Backend (NestJS), Hardware (Mirrorless Camera + FTP)

1. Product Overview

1.1. Visi Produk
Menciptakan alat operasional eksklusif untuk memberikan layanan roving photobooth dan live gallery yang interaktif, instan, dan bebas antre bagi klien-klien yang menyewa jasa dokumentasi/EO Anda.

1.2. Model Bisnis (Layanan)

Fitur ini dijual sebagai add-on premium atau termasuk dalam Tier Paket Tertinggi pada layanan fotografi/EO Anda.

Tidak ada transaksi digital di dalam aplikasi. Pembayaran dilakukan di luar sistem melalui kontrak jasa Anda dengan klien.

2. Target Pengguna (Personas)

Admin / Operator (Internal Tim Anda): Bertugas membuat entitas event di sistem, mengunggah custom frame sesuai request klien, dan memonitor kelancaran FTP di hari-H.

Fotografer Lapangan (Internal/Freelancer): Membawa kamera yang sudah di-setting FTP-nya. Fokus murni memotret, tanpa berinteraksi dengan dashboard.

Klien / Host (Pengantin / PIC Korporat): Penyelenggara acara. Membutuhkan akses mudah untuk keluarga dan fitur download seluruh foto (ZIP).

Tamu Undangan (End-User): Memindai QR Code di meja, melihat galeri web secara real-time, mengunduh foto diri mereka, dan ikut mengunggah foto.

3. Arsitektur & Teknologi Utama

Frontend Web: Next.js (Admin Dashboard, Live Wall Proyektor, Mobile Gallery Tamu).

Backend API: NestJS (Node.js).

Real-time Engine: Redis Pub/Sub & WebSocket (Dipisahkan berdasarkan Rooms/Channels per Event).

Database: PostgreSQL (Hanya menyimpan data Event, Foto, dan Akun Internal).

Storage: S3-Compatible Cloud Storage (Cloudflare R2 / DigitalOcean Spaces) untuk memangkas biaya bandwidth (egress). Terstruktur per folder Event ID.

Content Delivery (CDN): Cloudflare CDN diaktifkan sebagai proksi penyajian gambar ke pengguna (Guest Web App) untuk mengurangi 100% beban baca (read load) dari server NestJS.

Transfer Protokol: Native FTP Background Transfer + ftp-srv di NestJS.

4. Kebutuhan Fungsional (Functional Requirements)

4.1. Modul Manajemen & Isolasi Event (Admin Internal)

FR-1: Admin dapat masuk menggunakan kredensial hardcoded atau sistem login internal standar.

FR-2: Pembuatan "Event Baru" yang terisolasi. Saat admin membuat event, form akan meminta:

Detail Dasar: Nama Acara, Tanggal Mulai, Tanggal Berakhir.

Tampilan Custom: Tema Warna UI (Hex code), File Custom Frame (.PNG).

FR-3: Generator Aset Acara (Pra-Acara). Setelah event dibuat, sistem otomatis menghasilkan:

Event_ID unik (contoh: evt_123abc).

URL & QR Code Universal siap cetak (contoh: sava.com/live/budi-ani). QR ini akan digunakan oleh tamu, keluarga, dan klien dari awal hingga pasca-acara.

Kredensial FTP dinamis khusus event ini (Username & Password sekali pakai untuk mencegah fotografer salah upload ke event lain).

FR-4: Fitur Moderation Toggle. Admin dapat menyalakan/mematikan keharusan approval untuk foto yang diunggah oleh tamu per event.

4.2. Modul Roving Capture & Processing (Backend)

FR-5: FTP Server (port 2121) memvalidasi login dari kamera. Username yang digunakan akan mendeteksi Event_ID mana yang sedang aktif.

FR-6: Saat foto masuk, sharp memproses gambar (menempelkan frame PNG khusus event tersebut) dan menyimpannya ke Cloud Storage di dalam folder spesifik: storage-bucket/events/{Event_ID}/photos/.

FR-7: Backend otomatis memancarkan notifikasi via WebSocket hanya ke room/channel milik Event_ID tersebut.

4.3. Modul Live Wall & Guest Web App (Akses via QR Universal)

FR-8: Tampilan Live Wall hanya berlangganan (subscribe) ke WebSocket room sesuai ID acara yang sedang dibuka.

FR-9: Aplikasi web merender warna tombol dan latar belakang sesuai dengan pengaturan Tema Warna dari entitas Event tersebut.

FR-10: Interaksi Real-time: Tamu dapat melihat foto yang baru difoto fotografer secara instan, dan disediakan tombol "Download" pada setiap foto agar tamu/keluarga bisa menyimpannya langsung ke perangkat mereka.

FR-11: Partisipasi Tamu: Terdapat tombol "Bagikan Momen" untuk mengunggah foto via browser HP, yang akan langsung diikat dengan Event_ID yang sesuai. Beban unggah dialihkan langsung ke cloud via Presigned URL.

FR-12: Batasan Unggahan Tamu (Anti-Spam). Sistem membatasi jumlah maksimal foto yang dapat diunggah oleh setiap tamu (menggunakan Cookies atau Local Storage pada browser tamu, misal: maksimal 5 foto per sesi).

4.4. Modul Serah Terima Klien (Post-Event Mode)

FR-13: Transisi Pasca-Acara: Setelah acara selesai, Admin menekan tombol "Akhiri Event". Tautan dan QR Code universal yang dipegang klien/tamu otomatis beralih ke mode "Read-Only/Arsip".

FR-14: Fitur Upload (kamera FTP & partisipasi tamu) akan otomatis dinonaktifkan/hangus.

FR-15: Akses Klien: Pada halaman web QR tersebut, terbuka fitur tambahan khusus yaitu tombol "Download Semua Foto (.ZIP)" untuk memudahkan keluarga dan klien mengarsipkan seluruh galeri dalam sekali klik.

FR-16: Fitur penghapusan otomatis via Lifecycle Rules di Cloud Storage (H+30 hari dari tanggal event selesai) untuk membebaskan kapasitas dan menekan biaya tagihan server.

5. Kebutuhan Non-Fungsional

Performa (NFR-1): Foto dari fotografer harus muncul di layar proyektor dalam waktu kurang dari 5 detik sejak shutter ditekan.

Reliabilitas Jaringan (NFR-2): Web App Tamu harus sangat ringan (< 1MB initial load) agar cepat dibuka meski sinyal 4G di gedung buruk.

Ketahanan FTP (NFR-3): FTP server tidak boleh crash (harus memiliki auto-restart) jika terjadi diskoneksi mendadak dari Wi-Fi kamera.

Traffic Offloading (NFR-4): 100% permintaan (read request) untuk aset gambar (thumbnail maupun resolusi tinggi) harus dilayani secara eksklusif oleh CDN, dan tidak boleh membebani siklus CPU pada server NestJS.