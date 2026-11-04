---
description: 
---

REST API & WebSocket Contract

Platform: In-House Live Gallery

Arsitektur Domain & Routing

Untuk mencegah server utama down saat ratusan tamu mengakses galeri bersamaan, sistem memisahkan domain untuk pengolahan data dan penyajian file:

API Server (https://api.domainanda.com/v1): Server NestJS. Hanya melayani pertukaran teks (JSON), WebSocket, dan logika otorisasi.

CDN Server (https://cdn.domainanda.com): Jaringan Distribusi Konten (misal: Cloudflare CDN) yang terhubung langsung ke S3/R2 Bucket. Semua request gambar dari web tamu akan ditarik dari cache CDN ini, bukan dari server NestJS.

1. Public / Guest API (Tanpa Autentikasi)

Digunakan oleh aplikasi Next.js saat tamu atau klien memindai QR Code.

1.1. Get Event Details

Mengambil informasi dasar acara, termasuk batas maksimal unggahan tamu. [Optimasi: Di-cache via Redis, TTL 5 menit]

Method: GET

Endpoint: /events/{slug}

Response (200 OK):

{
  "success": true,
  "data": {
    "id": "uuid-1234",
    "name": "Pernikahan Budi & Ani",
    "slug": "budi-ani",
    "status": "active",
    "theme_color": "#D4AF37",
    "guest_upload_limit": 5,
    "is_upload_allowed": true
  }
}



1.2. Get Event Photos (Cursor-based Pagination & Filtering)

Mengambil daftar foto dengan dukungan filter sumber (untuk sistem Tab di UI). [Optimasi: Cache hasil query awal di Redis]

Method: GET

Endpoint: /events/{slug}/photos?limit=30&cursor=2026-11-01T14:00:00Z&source=guest
(Parameter source opsional. Nilai valid: photographer atau guest)

Response (200 OK):

{
  "success": true,
  "meta": { "next_cursor": "2026-11-01T13:50:00Z", "has_more": true },
  "data": [
    {
      "id": "uuid-photo-1",
      "url": "https://cdn.domainanda.com/events/budi-ani/guest/frame_abc.jpg",
      "source": "guest",
      "guest_name": "Rangga",
      "created_at": "2026-11-01T14:00:00Z"
    }
  ]
}



(Catatan Frontend: Semua nilai url yang dikembalikan API sudah di-generate mengarah ke CDN. Frontend cukup menampilkannya dalam tag <img> atau Next/Image).

1.3. Guest Photo Upload (Optimized: Direct-to-Cloud)

Mencegah server down dengan mengalihkan beban upload langsung ke Cloud Storage (S3/R2). Dilakukan dalam 2 tahap.

Tahap 1: Request Izin Upload (Presigned URL)

Method: POST

Endpoint: /events/{slug}/photos/presigned-url

Body:

{ 
  "filename": "selfie.jpg", 
  "content_type": "image/jpeg", 
  "guest_identifier": "xyz123" 
}



Response (200 OK):

{
  "success": true,
  "data": {
    "upload_url": "https://storage.cloudflare.com/bucket/events/budi-ani/guest/1730700000-selfie.jpg?Signature=...",
    "file_key": "events/budi-ani/guest/1730700000-selfie.jpg"
  }
}



(Frontend Next.js kemudian melakukan PUT request berisi file gambar langsung ke upload_url tersebut tanpa melewati NestJS).

Tahap 2: Konfirmasi Upload Selesai & Kirim Nama Tamu
Setelah frontend berhasil upload ke cloud, frontend memberitahu backend untuk memproses frame dan mengirimkan data nama tamu.

Method: POST

Endpoint: /events/{slug}/photos/confirm

Body:

{ 
  "file_key": "events/budi-ani/guest/1730700000-selfie.jpg", 
  "guest_identifier": "xyz123",
  "guest_name": "Rangga" 
}



Response (202 Accepted):

{
  "success": true,
  "message": "Foto sedang diproses dan akan segera tayang."
}



1.4. Check/Download Archive (Guest/Client)

Method: GET

Endpoint: /events/{slug}/archive

Response (200 OK):

{
  "success": true,
  "data": {
    "status": "ready",
    "download_url": "https://cdn.domainanda.com/events/budi-ani/archives/budi-ani-all.zip"
  }
}



2. Admin API (Butuh Autentikasi: Bearer Token)

2.1. Create New Event

Method: POST

Endpoint: /admin/events

Body: (Data konfigurasi event, tema, batas upload, dll)

2.2. Update Event Status (End Event)

Method: PATCH

Endpoint: /admin/events/{id}/status

Body: { "status": "archived" }

2.3. Trigger Archive ZIP Generation

Memicu proses pembuatan ZIP di background worker (BullMQ).

Method: POST

Endpoint: /admin/events/{id}/archive

Response (202 Accepted):

{
  "success": true,
  "message": "Pembuatan ZIP dimasukkan ke antrean."
}



3. WebSocket / Real-Time Events (Redis Pub/Sub)

Aplikasi Next.js tamu dan proyektor terhubung ke WebSocket backend untuk menerima foto baru tanpa refresh.

Connection Endpoint: wss://api.domainanda.com/socket

Room / Channel: Client bergabung ke room dengan mengirim event:
{ "event": "subscribe", "data": { "room": "event_budi-ani" } }

3.1. Event: NEW_PHOTO

Ditembakkan oleh NestJS ke semua client di room tersebut. Data guest_name akan digunakan proyektor untuk menampilkan badge nama.

Payload:

{
  "event": "NEW_PHOTO",
  "data": {
    "id": "uuid-photo-2",
    "url": "https://cdn.domainanda.com/events/budi-ani/guest/frame_xyz.jpg",
    "source": "guest",
    "guest_name": "Rangga",
    "created_at": "2026-11-01T14:05:00Z"
  }
}

