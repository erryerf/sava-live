---
description: 
---

Arsitektur Background Worker (Agent) & FTP Bridge

Platform: In-House Live Gallery

1. Konsep Dasar

Untuk mencegah server utama (API) mengalami kelebihan beban CPU (CPU blocking) dan kehabisan penyimpanan (RAM/Disk), tugas berat dan transit file didelegasikan ke arsitektur asinkron.

Message Broker: Redis (berfungsi sebagai antrean / queue).

Queue Engine: BullMQ (Library Node.js).

Eksekutor: Worker NestJS.

2. FTP Bridge Service (Pintu Masuk Kamera)

Berjalan berdampingan dengan API NestJS utama, berfungsi khusus mencegat koneksi masuk dari kamera fotografer.

Protokol: FTP (Port 21, Pasif Port 50000-50100).

Dynamic Routing: Membaca username dari kamera (diisi dengan slug event, contoh: budi-ani) untuk mengunci (chroot) sesi FTP ke folder sementara spesifik acara: /temp-ftp/budi-ani/.

Delegasi Tugas: Begitu file foto utuh diterima (Command STOR), layanan ini tidak memproses gambar, melainkan hanya melempar path lokalnya ke photo_processing_queue di Redis, lalu kembali mendengarkan jepretan kamera berikutnya.

3. Daftar Agen (Queues)

3.1. Photo Processing & Upload Agent (Sharp & S3)

Nama Antrean: photo_processing_queue
Tujuan: Mengunggah file dari VPS lokal ke Cloudflare R2, memproses ukuran/bingkai, lalu menghapus file lokal.

Trigger (Pemicu):

Event dari FTP Bridge selesai menerima file lokal (Fotografer).

Web tamu selesai mengunggah via Presigned URL (Tahap Konfirmasi).

Payload dari FTP:

{
  "eventSlug": "budi-ani",
  "tempFilePath": "/app/temp-ftp/budi-ani/DSC001.JPG"
}


Alur Kerja (Workflow Fotografer):

Agent membaca file dari tempFilePath.

Agent melakukan resize dan optimasi menggunakan sharp (opsional jika resolusi terlalu besar).

Agent mengunggah langsung ke Cloudflare R2 dengan object key terstruktur: events/budi-ani/photographer/DSC001.JPG.

Pembersihan (Garbage Collection): Agent mengeksekusi fs.unlinkSync(tempFilePath) untuk menghapus file dari VPS agar SSD tidak cepat penuh.

Agent menyimpan file_url (jalur CDN) ke tabel photos PostgreSQL.

Agent memicu event Redis Pub/Sub (NEW_PHOTO) dengan payload tanpa guest_name agar ditayangkan ke proyektor.

3.2. Archive Agent (ZIP Generator)

Nama Antrean: archive_queue
Tujuan: Mengompilasi ratusan foto dari R2 menjadi satu file .zip via Streaming tanpa menguras RAM server.

Trigger: Admin menekan "Akhiri Event & Generate ZIP" (API POST /admin/events/{id}/archive).

Payload:

{ "event_id": "uuid-1234", "slug": "budi-ani" }


Alur Kerja:

Mengubah archive_status di DB menjadi processing.

Mengambil daftar foto dari DB, yang otomatis akan berada dalam 2 jalur R2: events/budi-ani/photographer/ dan events/budi-ani/guest/.

Membuka Read Stream dari R2, mem-pipe ke archiver, dan Write Stream kembali ke R2 sebagai archives/budi-ani-all.zip. Struktur folder (fotografer vs tamu) otomatis dipertahankan di dalam file ZIP.

Menyimpan archive_zip_key ke DB dan mengubah status menjadi ready.

4. Manajemen Kegagalan (Fault Tolerance)

Auto-Retry & Backoff: Jika upload R2 gagal karena jaringan, BullMQ mengulang maksimal 3 kali.

Dead Letter Queue: Jika gagal total, tugas ditandai failed dan file temp dibiarkan di VPS agar bisa di-retry manual oleh Admin.

Concurrency: Maksimal 5 proses foto bersamaan agar pemakaian CPU stabil.