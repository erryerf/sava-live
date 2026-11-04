---
description: 
---

Arsitektur UI/UX & User Flow

Platform: In-House Live Gallery

Prinsip Global UX Copywriting (Anti "AI Slop")

Untuk menjaga kesan premium dan interaksi yang cepat, seluruh penulisan teks UI (notifikasi, error, instruksi) harus mematuhi aturan berikut:

Manusiawi & Asyik: Hindari bahasa robotik atau kaku (Misal: hindari "Mohon maaf, sistem sedang memproses permintaan Anda"). Gunakan bahasa kasual namun sopan.

Singkat & Padat (Punchy): Pengguna sedang berpesta, bukan membaca koran. Pesan maksimal terdiri dari 4-6 kata.

Fokus pada Aksi (Action-Oriented): Beri tahu pengguna apa yang terjadi atau apa yang harus dilakukan selanjutnya, tanpa menjelaskan proses teknis backend.

1. Guest Web App (Mobile-First)

Target: Pengalaman tanpa hambatan (frictionless), tamu tidak perlu install aplikasi atau login.

A. Alur Utama (Saat Acara Berlangsung)

Scan QR Code: Tamu memindai QR Code di meja atau standee.

Landing Page (Gallery View) & Sistem Tab:

Header: Nama acara menempel di atas (sticky). Warna header mengikuti theme_color dari database.

Navigasi Tab (Pemisahan Konten): Di bawah header terdapat dua tab/tombol geser:

Tab 1: "Kamera Utama" (Aktif secara default) -> Menampilkan grid khusus foto beresolusi tinggi dari fotografer (via FTP).

Tab 2: "Kamera Tamu" -> Menampilkan grid khusus foto-foto hasil unggahan para tamu.

Feed Foto (Masonry Grid): Tampilan selalu diurutkan dari yang terbaru (Teratas). Jika berada di Tab "Kamera Tamu", terdapat label nama kecil di sudut bawah thumbnail.

Floating Action Button (FAB): Tombol bulat melayang di pojok kanan bawah dengan ikon Kamera/Plus. Selalu muncul terlepas dari Tab mana yang sedang dibuka.

Melihat & Mengunduh Foto:

Tamu mengetuk salah satu foto di grid.

Foto membesar (Full-screen Lightbox Modal).

Di bagian bawah layar terdapat tombol besar: "Simpan ke HP" (Memicu direct download).

Swipe kiri/kanan untuk melihat foto sebelum/sesudahnya di dalam Tab tersebut.

Mengunggah Foto (Guest Upload) & Input Nama:

Tamu mengetuk FAB "Unggah Momen".

(Sistem mengecek kuota). Jika habis: "Batas upload (5/5) penuh. Nikmati acaranya! 🎉"

Jika kuota ada, muncul pemilih file OS.

Muncul dialog konfirmasi:

Thumbnail foto.

Form Input Teks: "Nama (Opsional)"

Teks informatif: "Kirim momen ini? (Sisa kuota: 4/5)".

Tamu menekan "Kirim".

Notifikasi berhasil: "Terkirim! Tampil di layar sebentar lagi 🚀".

(Sistem otomatis mengarahkan tamu ke Tab "Kamera Tamu" agar mereka bisa melihat hasil unggahannya).

B. Alur Pasca-Acara (Archive Mode)

Jika admin sudah menekan tombol "Akhiri Event".

Perubahan UI: FAB "Unggah Momen" menghilang.

Banner Download: Di bawah Header, muncul tombol besar: "Unduh Arsip (.ZIP)".

Status Arsip: Jika ZIP sedang disiapkan, tombol disabled ("Merapikan arsip..."). Jika siap, menjadi "Unduh Arsip Lengkap". (File ZIP akan otomatis memisahkan folder "Utama" dan "Tamu").

2. Live Wall / Projector View (Desktop / TV)

Target: Tampilan memukau untuk layar besar gedung, berjalan otomatis tanpa diklik.

Akses URL: Operator membuka /live/{slug} (F11 Full Screen).

Layout Utama:

Sisi Kiri (1/4 Layar): Judul Acara, Theme Color dinamis, QR Code Besar, dan teks "Scan QR untuk simpan & bagikan foto!"

Sisi Kanan (3/4 Layar): Area Grid Foto Dinamis. (Menampilkan perpaduan kedua sumber foto secara harmonis).

Perilaku Animasi & Atribusi Nama (Real-time):

Grid foto perlahan bergeser ke atas (auto-scroll pan).

Event NEW_PHOTO (WebSocket): Ketika foto baru masuk, layar menjeda guliran.

Foto membesar (pop-up animation) ke tengah layar (3-5 detik).

Badge Nama:

Jika foto dari Fotografer: Bersih tanpa teks tambahan (menonjolkan custom frame).

Jika foto dari Tamu: Muncul pita elegan di bawah foto bertuliskan: "📸 Momen dari: [Nama Tamu]".

Setelah itu, foto masuk ke susunan teratas.

3. Admin Dashboard (Desktop)

Target: Pengelolaan operasional yang efisien, minim klik, dan visibilitas penuh.

A. Autentikasi & Navigasi Utama

Login Email/Password. Navigasi: Event List, Users, Settings.

B. Halaman "Event List" (Beranda)

Tabel event klien. Filter: Active vs Archived. Tombol "+ Buat Event Baru".

C. Alur "Create / Edit Event"

Langkah 1: Nama Acara, Waktu.

Langkah 2: Theme Color, Custom Frame (PNG), Batas Upload Tamu, Toggle Moderasi Tamu.

Langkah 3 (Sukses): Menampilkan Kredensial FTP Kamera & Tombol Unduh QR Code.

D. Halaman "Control Room" (Saat Hari-H)

Header: Nama Acara & Indikator "Live".

Seksi Kiri: Status FTP (Kamera Terhubung/Terputus), Quick Links, Tombol "Akhiri Event & Generate ZIP".

Seksi Kanan (Live Feed & Moderation):

Tab 1: Live Gallery: Terdapat Dropdown Filter untuk melihat "Semua Foto", "Hanya Fotografer", atau "Hanya Tamu". Admin bisa klik foto untuk Force Delete.

Tab 2: Moderation Queue (Opsional): Antrean foto tamu yang butuh persetujuan. Tombol "Setujui (Centang Hijau)" atau "Tolak (Silang Merah)".

E. Halaman "Archive Detail" (Pasca-Acara)

Ringkasan acara, status pembuatan ZIP, dan Link Download ZIP untuk diserahkan ke klien.