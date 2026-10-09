# Panduan Lengkap Konfigurasi Appointment Setter (Drifee by Briga)

Dokumen ini berisi panduan langkah demi langkah (*step-by-step*) yang perlu Anda lakukan untuk mengaktifkan seluruh fitur **Appointment Setter**, notifikasi multi-channel (**Email Resend** + **WhatsApp Baileys**), sistem pembayaran (**Lynk.id**), dan **Auto-Payout Driver** di Drifee.

---

## Daftar Isi
1. [Langkah 1: Migrasi Database Supabase](#langkah-1-migrasi-database-supabase)
2. [Langkah 2: Konfigurasi Email Dispatcher (Resend API)](#langkah-2-konfigurasi-email-dispatcher-resend-api)
3. [Langkah 3: Konfigurasi Pembayaran (Lynk.id Checkout & Webhook)](#langkah-3-konfigurasi-pembayaran-lynkid-checkout--webhook)
4. [Langkah 4: Konfigurasi WhatsApp Bot (Baileys)](#langkah-4-konfigurasi-whatsapp-bot-baileys)
5. [Langkah 5: Konfigurasi File Environment (.env.local)](#langkah-5-konfigurasi-file-environment-envlocal)
6. [Langkah 6: Konfigurasi Jadwal Otomatis (Cron Job 23:00 WIB)](#langkah-6-konfigurasi-jadwal-otomatis-cron-job-2300-wib)
7. [Checklist Pengujian Langsung (End-to-End Verification)](#checklist-pengujian-langsung-end-to-end-verification)

---

## Langkah 1: Migrasi Database Supabase

Sistem Appointment Setter membutuhkan 4 tabel baru (`appointment_templates`, `appointment_bookings`, `appointment_waypoints`, `appointment_status_logs`) serta aturan keamanan RLS (*Row Level Security*).

### Cara Menjalankan Migrasi:
1. Buka dashboard proyek Supabase Anda: [supabase.com/dashboard](https://supabase.com/dashboard).
2. Di bilah navigasi kiri, pilih ikon **SQL Editor** (`>_`).
3. Klik tombol **New query**.
4. Buka file migrasi lokal proyek Anda di:
   ```text
   supabase/migrations/013_appointment_setter.sql
   ```
5. Salin (*copy*) seluruh isi file tersebut, tempel (*paste*) ke SQL Editor Supabase, lalu klik tombol **Run** (atau tekan `Ctrl + Enter`).
6. **Verifikasi**: Pastikan muncul pesan `Success. No rows returned` dan tabel-tabel di atas sudah muncul di menu **Table Editor**. Tabel template otomatis diisi data demo: `cikarang-executive-visit`.

---

## Langkah 2: Konfigurasi Email Dispatcher (Resend API)

Drifee menggunakan [Resend](https://resend.com) untuk mengirimkan:
- **Konfirmasi Reservasi**: Rincian tiket digital pass dan tombol sinkronisasi ke Google Calendar.
- **Alert Driver En-Route**: Pemberitahuan saat driver mitra EV meluncur ke lokasi jemput beserta info plat nomor.
- **Sertifikat ESG & Trip Completed**: Laporan penghematan Scope 3 CO₂ setelah perjalanan selesai.

### Tahap 2.1: Buat Akun & API Key
1. Buka [resend.com](https://resend.com) dan klik **Get Started** (gratis kuota 3.000 email/bulan).
2. Masuk ke dashboard Resend, lalu di menu sebelah kiri klik **API Keys**.
3. Klik tombol **Create API Key**:
   - **Name**: `Drifee Production` (atau `Drifee Testing`)
   - **Permission**: `Full access`
   - **Domain**: Pilih `All domains`
4. Klik **Add**, lalu **salin API Key** yang muncul (dimulai dengan `re_...`). *Simpan kunci ini karena hanya ditampilkan sekali.*

### Tahap 2.2: Mode Pengujian vs Mode Domain Sendiri
- **A. Mode Cepat / Sandbox (Bisa langsung dipakai hari ini):**
  - Tanpa perlu setup domain DNS.
  - Alamat pengirim: `Drifee by Briga <onboarding@resend.dev>`.
  - **Catatan Resend Sandbox**: Email hanya bisa dikirimkan ke alamat email yang Anda gunakan saat mendaftar akun Resend tersebut.
- **B. Mode Production (Domain Resmi briga.id):**
  1. Di Resend dashboard, buka menu **Domains** -> klik **Add Domain**.
  2. Masukkan domain Anda, misal: `briga.id` atau `mail.briga.id`.
  3. Masuk ke cPanel / Cloudflare / DNS Provider domain Anda, lalu tambahkan DNS Records yang diberikan oleh Resend:
     - 1x Record TXT (SPF)
     - 1x Record MX (Feedback/Bounces)
     - 1x Record CNAME / TXT (DKIM Signature)
  4. Tunggu status domain di Resend berubah menjadi **Verified**.
  5. Setelah terverifikasi, Anda dapat mengirim email dari `Drifee by Briga <no-reply@briga.id>`.

---

## Langkah 3: Konfigurasi Pembayaran (Lynk.id Checkout & Webhook)

Lynk.id digunakan untuk pembayaran mandiri pemesan (QRIS, GoPay, ShopeePay, OVO, Virtual Account BCA/Mandiri/BRI) tanpa perlu akun manual transfer.

### Tahap 3.1: URL Halaman Pembayaran
1. Buka [lynk.id](https://lynk.id) dan buat akun toko/kreator Anda (contoh profil: `lynk.id/drifee`).
2. Buat produk atau jasa baru di Lynk.id, misalnya *"Sewa Mobil EV + Driver Kunjungan Pabrik Cikarang"*.
3. Simpan URL produk atau URL profil Anda (misal `https://lynk.id/drifee`).

### Tahap 3.2: Konfigurasi Webhook Lynk.id (Callback Otomatis)
Ketika klien berhasil membayar di Lynk.id, Lynk.id akan memanggil server Drifee secara otomatis untuk mengubah status booking menjadi `paid_online`.

1. Di dashboard Lynk.id, buka menu **Settings** -> **Developer / Webhook**.
2. Masukkan URL Webhook Drifee Anda:
   - **Production**: `https://drifee.briga.id/api/appointments/webhook/lynk`
   - **Pengujian Lokal (Development)**:
     - Jika sedang menjalankan aplikasi di laptop (`localhost:3000`), Lynk.id tidak bisa mengakses localhost secara langsung.
     - Gunakan ngrok atau Cloudflare Tunnel:
       ```bash
       npx ngrok http 3000
       ```
     - Salin URL HTTPS publik yang dihasilkan ngrok (misal `https://a1b2-xxx.ngrok-free.app`), lalu masukkan ke webhook Lynk.id:
       ```text
       https://a1b2-xxx.ngrok-free.app/api/appointments/webhook/lynk
       ```
3. Di field **Webhook Secret / Token**, buat kata kunci rahasia (misal: `drifee_lynk_secret_2026_xyz`).
4. **Mekanisme Otomatis**:
   - Sistem Drifee saat mengarahkan klien ke link Lynk.id akan menambahkan parameter:
     `https://lynk.id/drifee?notes=DRF-APT-261015-ABC123`
   - Saat pembayaran selesai, Lynk.id akan menyertakan kode `DRF-APT-...` dalam payload webhook. Server Drifee membaca kode tersebut, memperbarui status menjadi lunas, dan langsung mengirimkan email & WhatsApp konfirmasi ke klien.

---

## Langkah 4: Konfigurasi WhatsApp Bot (Baileys)

Drifee memiliki bot WhatsApp terintegrasi (Baileys) untuk mengirim pesan real-time ke pemesan dan driver.

1. Buka direktori proyek Anda di terminal.
2. Pastikan folder sesi WhatsApp lokal ada:
   ```bash
   mkdir -p sessions
   ```
3. Jalankan server aplikasi (`npm run dev`).
4. Buka halaman admin agen WhatsApp: `http://localhost:3000/api/whatsapp/status` atau scan QR code yang muncul di terminal saat instance Baileys dijalankan.
5. Gunakan nomor WhatsApp operasional resmi Drifee. Sesi login akan disimpan secara aman di folder `./sessions/` sehingga bot akan tersambung otomatis (*auto-reconnect*) setiap kali server dijalankan ulang.

---

## Langkah 5: Konfigurasi File Environment (.env.local)

Buka atau buat file `.env.local` di root direktori proyek (`c:\Users\yabes\Documents\Drive-e by Briga\.env.local`) dan pastikan baris-baris konfigurasi berikut sudah terisi:

```env
# ─────────────────────────────────────────────────────────────
# 1. Aplikasi & Domain Dasar
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Drifee

# ─────────────────────────────────────────────────────────────
# 2. Email Dispatcher (Resend API)
# ─────────────────────────────────────────────────────────────
# Ganti dengan API Key yang Anda peroleh dari dashboard Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Untuk testing awal, gunakan onboarding@resend.dev
# Jika domain briga.id sudah di-verify di Resend, ganti ke no-reply@briga.id
SENDER_EMAIL=Drifee by Briga <onboarding@resend.dev>

# ─────────────────────────────────────────────────────────────
# 3. Lynk.id Payment Gateway
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_LYNK_URL=https://lynk.id/drifee
LYNK_WEBHOOK_SECRET=drifee_lynk_secret_2026_xyz

# ─────────────────────────────────────────────────────────────
# 4. WhatsApp Dispatcher (Baileys)
# ─────────────────────────────────────────────────────────────
BAILEYS_CONFIG_PATH=./baileys-config.json
BAILEYS_SESSION_BASE_PATH=./sessions
BAILEYS_AUTO_RECONNECT=true

# ─────────────────────────────────────────────────────────────
# 5. OSRM Multi-Stop Route Optimizer (Sudah Aktif)
# ─────────────────────────────────────────────────────────────
OSRM_URL=https://router.project-osrm.org
```

---

## Langkah 6: Konfigurasi Jadwal Otomatis (Cron Job 23:00 WIB)

Untuk menjamin model kemitraan *"Bring-Your-Own-Rented-EV"* dapat melunasi sewa mobil harian vendor Rp 260.000 dengan take-rate 85% (Rp 420.750 untuk paket 8 jam), sistem memiliki cron job payout harian pada pukul **23:00 WIB**.

Endpoint payout:
```text
POST /api/cron/daily-driver-payout
```

### Opsi A: Jika Aplikasi di-Deploy ke Vercel (Rekomendasi)
Di root direktori proyek, buat/perbarui file `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-driver-payout",
      "schedule": "0 16 * * *"
    }
  ]
}
```
*(Catatan: Jam 16:00 UTC tepat sama dengan Jam 23:00 WIB)*.

### Opsi B: Menggunakan Layanan Cron Eksternal Gratis (cron-job.org / Upstash)
1. Buka [cron-job.org](https://cron-job.org).
2. Buat job baru:
   - **URL**: `https://drifee.briga.id/api/cron/daily-driver-payout`
   - **Execution Schedule**: Setiap hari pada pukul `23:00` (Pilih Timezone: `Asia/Jakarta`).
   - **Request Method**: `POST`

---

## Checklist Pengujian Langsung (End-to-End Verification)

Setelah langkah 1 hingga 5 selesai, lakukan uji coba langsung untuk memastikan seluruh rantai bekerja sempurna:

- [ ] **Test 1: Buka Halaman Booking Publik**
  - Kunjungi `http://localhost:3000/book/cikarang-executive-visit` di browser.
  - Periksa apakah opsi **8 Jam (Rekomendasi Terbaik)** terpilih secara otomatis dengan tarif Rp 495.000.
  - Tambahkan titik jemput (misal: *Stasiun Halim Whoosh*) dan 2 titik singgah pabrik (misal: *PT Astra Daihatsu Karawang* & *Kawasan GIIC Cikarang*).

- [ ] **Test 2: Submit Reservasi & Input Email Anda**
  - Masukkan nama, nomor WhatsApp, dan **alamat email Anda**.
  - Klik **Konfirmasi Reservasi EV**.
  - Sistem akan langsung mengarahkan Anda ke halaman tiket digital pass:
    `http://localhost:3000/book/track/[token-rahasia]`

- [ ] **Test 3: Periksa Email Konfirmasi**
  - Buka inbox email yang Anda masukkan tadi.
  - Pastikan email masuk berisi:
    1. Kode booking resmi (`DRF-APT-...`).
    2. Jadwal & rincian rute penjemputan.
    3. Tombol **"Buka Live Tracking Pass"**.
    4. Link **"Tambahkan ke Google Calendar"**.

- [ ] **Test 4: Uji Tombol Pembayaran Lynk.id**
  - Di halaman tracking pass (status: *Belum Dibayar / Pending*), klik tombol **"Bayar via Lynk.id (QRIS / VA)"**.
  - Pastikan halaman baru terbuka mengarah ke link Lynk.id Anda dengan parameter `notes=DRF-APT-...`.

- [ ] **Test 5: Dashboard Admin Dispatch Driver**
  - Buka dashboard admin: `http://localhost:3000/admin/appointments`.
  - Lihat daftar pemesanan masuk.
  - Klik **Tugaskan Mitra Driver** (masukkan nama driver, nomor WA, model mobil EV, dan plat nomor).
  - Segera setelah ditugaskan, periksa email dan WhatsApp: status berganti menjadi **"Driver En-Route"** lengkap dengan plat nomor dan kontak driver.

- [ ] **Test 6: Selesaikan Trip & Terima Sertifikat ESG**
  - Di dashboard admin, klik **"Selesaikan Perjalanan (Trip Completed)"**.
  - Klien otomatis menerima email penutup berisi ringkasan perjalanan dan sertifikat penurunan emisi Scope 3 ($\text{kg CO}_2\text{ avoided}$).
  - Booking tersebut otomatis masuk ke antrian pembayaran harian 85% untuk driver pada pukul 23:00 WIB.
