# SAVA Live — In-House Roving Photobooth & Live Gallery

Platform *Roving Photobooth & Live Gallery* berbasis **NestJS** (Backend API, FTP Bridge, BullMQ Worker, Socket.io) dan **Next.js App Router** (Guest Mobile Gallery, Projector Live Wall, Admin Dashboard) dengan penyimpanan **Cloudflare R2** & **CDN**.

---

## Struktur Proyek

- [`backend/`](file:///c:/Users/user/Documents/Live%20photo/backend):
  - [`live-camera-server.js`](file:///c:/Users/user/Documents/Live%20photo/backend/live-camera-server.js) — Server Auto-Upload Kamera instan (FTP Server port `2121`, USB Hot-Folder Watcher, Dual-Resolution `sharp` Optimizer, & Socket.io port `3001`) yang bisa langsung jalan tanpa instalasi database.
  - `src/` — Server penuh NestJS (`/v1`), PostgreSQL TypeORM, BullMQ Worker (`photo_processing_queue` & `archive_queue`), Cloudflare R2 S3, dan Socket.io Gateway.
- [`frontend/`](file:///c:/Users/user/Documents/Live%20photo/frontend): Aplikasi Web Next.js (App Router + Tailwind CSS):
  - `/[slug]` — **Guest Web App** (Mobile-first, Header Foto Custom Gelap & Nama Pengantin Elegan, Tab Kamera Utama vs Kamera Tamu, Kamera Live Tamu dengan Input Nama di Awal, Lightbox swipe & direct download).
  - `/live/[slug]` — **Projector Live Wall** (1/4 QR Panel + 3/4 Auto-Scrolling Grid, 4-detik Spotlight Pop-up saat `NEW_PHOTO`, pita atribusi nama tamu).
  - `/admin` — **Admin Dashboard & Control Room** (Manajemen buat/edit/hapus event, pengaturan teks & foto header, status Auto-Upload Kamera Utama, moderasi foto tamu, dan unduh QR Code `.PNG` / arsip `.ZIP`).

---

## Cara Menjalankan secara Lokal (Mode Cepat Tanpa Database)

### 1. Jalankan Server Auto-Upload Kamera (FTP + WebSocket Bridge)
```powershell
cd "c:\Users\user\Documents\Live photo\backend"
node live-camera-server.js
```
- **WebSocket & Bridge API**: `http://localhost:3001`
- **FTP Auto-Upload Server**: `ftp://0.0.0.0:2121` (Passive Ports: `50000–50100`)
- **Lokasi Hot-Folder USB**: `backend/temp-ftp/{slug}/`

### 2. Jalankan Aplikasi Web Frontend (Next.js)
```powershell
cd "c:\Users\user\Documents\Live photo\frontend"
npm.cmd run dev
```
- **Admin Dashboard & Control Room**: `http://localhost:3000/admin`
- **Galeri Tamu (HP)**: `http://localhost:3000/budi-ani`
- **Live Wall Proyektor**: `http://localhost:3000/live/budi-ani`

---

## 📸 Panduan Lengkap Setting Kamera Utama (Auto-Upload Saat Memotret)

Agar setiap kali fotografer menekan tombol *shutter* (memotret), foto **langsung otomatis masuk ke server dan tampil di layar dalam hitungan detik**, tersedia **2 metode otomatis** yang bisa dipilih sesuai kondisi lokasi acara:

1. **Metode A — Tanpa Kabel via Wi-Fi / Hotspot (*Auto FTP Transfer*)**: Cocok untuk fotografer *roving* (keliling ruangan).
2. **Metode B — Menggunakan Kabel Data USB (*Tethered Hot-Folder*)**: Cocok untuk *photobooth* statis atau panggung pelaminan (paling stabil walaupun sinyal Wi-Fi gedung penuh).

---

### Persiapan Wajib di Kamera (Agar Transfer Instan < 1 Detik)

Sebelum menghubungkan kamera, atur format penyimpanan di kamera:
1. Gunakan **Dual Slot Recording** (jika kamera punya 2 slot SD Card):
   - **Slot 1**: Simpan **RAW / Fine JPEG** (untuk dokumentasi utama & editing).
   - **Slot 2**: Simpan **JPEG ukuran Small (S) atau Medium (M)** (~1.5 MB – 3 MB).
2. Pada pengaturan transfer kamera, pilih **"Transfer JPEG Only"** (Jangan mengirim file RAW 40 MB via Wi-Fi agar tidak antre lama di kamera).

---

### Metode A: Koneksi Tanpa Kabel via Wi-Fi Kamera (*Auto FTP Transfer*)

#### Langkah 1: Lihat Data Kredensial di Control Room Admin
1. Hubungkan **Laptop Operator** dan **Kamera Mirrorless** ke jaringan **Wi-Fi / Hotspot HP yang sama**.
2. Buka `http://localhost:3000/admin` &rarr; klik tombol **Control Room** pada event yang aktif (contoh: `budi-ani`).
3. Lihat kartu **"Auto-Upload Kamera Utama"** di kolom kiri atas. Catat 4 informasi berikut:
   - **Host / IP Server**: *(Contoh: `192.168.1.15` — otomatis terdeteksi di Control Room)*
   - **Port**: `2121`
   - **Username**: `budi-ani` *(sesuai slug acara)*
   - **Password**: `123456` *(atau password yang di-generate di Control Room)*

#### Langkah 2: Setting di Menu Kamera (Cukup Sekali di Awal Acara)

##### 1. Kamera Sony Alpha (A7 III, A7 IV, A7C, A6700, FX3, A9)
1. Masuk ke **Menu** &rarr; **Network (Jaringan)** &rarr; **Wi-Fi Settings** &rarr; sambungkan ke Wi-Fi/Hotspot yang sama dengan laptop.
2. Masuk ke **Network** &rarr; **FTP Transfer Func.** &rarr; **Server Setting**:
   - Pilih **Server 1**
   - **Host Name**: Masukkan **IP Server** dari Control Room (misal `192.168.1.15`)
   - **Port**: `2121`
   - **Protocol**: `FTP` (bukan FTPS)
   - **Passive Mode**: `ON` / `Enable`
   - **Destination Dir**: Kosongkan (`/`)
   - **User Name**:Masukkan *slug* acara (misal `budi-ani`)
   - **Password**: Masukkan password FTP
3. Kembali ke menu **FTP Transfer Func.** &rarr; ubah:
   - **FTP Function**: `ON`
   - **Auto FTP Transfer**: `ON` *(Wajib ON agar otomatis terkirim setiap habis memotret!)*
   - **Transfer Target (RAW+J)**: `JPEG Only`

##### 2. Kamera Canon EOS R Series (R6, R5, R8, R10, R7)
1. Masuk ke **Menu (Tab Ungu / Wireless)** &rarr; **Wi-Fi/Bluetooth Connection** &rarr; pilih **Transfer images to FTP server**.
2. Pilih **Add a device to connect to** &rarr; sambungkan ke Wi-Fi/Hotspot laptop.
3. Pada pengaturan FTP:
   - **Connection mode**: `FTP`
   - **Address setting**: Masukkan **IP Server** (misal `192.168.1.15`) dan **Port** `2121`
   - **Passive mode**: `Enable`
   - **Login method**: `Password` &rarr; masukkan **Username** (`budi-ani`) dan **Password**
   - **Target folder**: `Root folder`
4. Masuk ke menu **FTP transfer settings**:
   - **Automatic transfer**: `Enable` *(Otomatis kirim setiap jepret)*
   - **Transfer type/size**: `JPEG only` / `Smaller JPEG`

##### 3. Kamera Nikon Z Series (Z6, Z7, Z8, Zf)
1. Masuk ke **Network Menu** &rarr; **Connect to FTP server** &rarr; **Network settings** &rarr; **Create profile**.
2. Pilih **Search for Wi-Fi network** &rarr; sambungkan ke Wi-Fi/Hotspot laptop.
3. Pada bagian **FTP server**:
   - **Server type**: `FTP`
   - **Address**: Masukkan **IP Server** dari Control Room
   - **Port**: `2121`
   - **PASV mode**: `ON`
   - Masukkan **User ID** (`budi-ani`) dan **Password**
4. Masuk ke **Options** &rarr; aktifkan **Auto upload (`ON`)** dan pilih **Upload RAW + JPEG as: `JPEG only`**.

---

### Metode B: Koneksi Kabel Data USB (*Tethered Hot-Folder*)

Jika Anda menggunakan kabel data USB panjang (TetherTools / USB-C) dari kamera ke laptop operator:

1. Buka `http://localhost:3000/admin` &rarr; masuk ke **Control Room** acara.
2. Pada bagian **"2. Via Kabel USB Kamera (Tanpa Setting Wi-Fi)"**, klik kotak lokasi *Hot-Folder* untuk menyalin alamatnya:
   ```text
   c:\Users\user\Documents\Live photo\backend\temp-ftp\budi-ani
   ```
3. Buka aplikasi USB bawaan kamera di laptop Anda (*Canon EOS Utility*, *Sony Remote / Imaging Edge Desktop*, *Nikon NX Tether*, atau *Lightroom Classic Tethered Capture*).
4. Atur **Folder Tujuan Simpan Foto (Destination Folder)** di aplikasi tersebut ke alamat *Hot-Folder* di atas (`...\backend\temp-ftp\budi-ani`).
5. **Selesai!** Setiap kali fotografer menekan tombol *shutter* di kamera, file foto yang masuk ke folder tersebut **langsung dideteksi otomatis oleh server dalam < 0.5 detik**, dikompresi ke 2 resolusi, dan langsung muncul *real-time* di Live Wall & Galeri Tamu!

> **Alternatif Langsung dari Browser**: Anda juga bisa menekan tombol **"Pilih Folder Lain di Laptop"** di Control Room untuk memantau folder mana saja di laptop Anda secara otomatis.

---

### 🔧 Troubleshooting Cepat di Lapangan

1. **Kamera gagal konek ke Port `2121` dari Wi-Fi**:
   - Pastikan **Windows Defender Firewall** mengizinkan `Node.js` atau buka akses Port `2121` & `50000-50100` (jalankan sekali di PowerShell sebagai Administrator):
     ```powershell
     netsh advfirewall firewall add rule name="SAVA Live FTP" dir=in action=allow protocol=TCP localport=2121,3001,50000-50100
     ```
2. **Ingin mengetes alur tanpa kamera fisik**:
   - Buka **Control Room (`/admin`)** dan **Live Wall (`/live/budi-ani`)** berdampingan.
   - Klik tombol kuning **"⚡ Tes Simulasi Jepret Kamera"** di Control Room — server akan menyimulasikan foto baru yang masuk ke `temp-ftp/{slug}` dan langsung menampilkannya di layar!
