# Blueprint Arsitektur Bisnis & Operasional Drifee by Briga
**Sistem Pemesanan Armada EV Cerdas, Manajemen Janji Temu HR & Talent, Strategi Harga Multi-Trip, Arsitektur Finansial & Pencairan Komisi Mitra**

---

## 1. Ringkasan Eksekutif & Prinsip Desain Arsitektur

Integrasi ekosistem **briga.id** (Portal Rekrutmen & Manajemen Talent) dengan **Drifee** (Platform Telematika & Manajemen Armada EV Cerdas) menghadirkan solusi mobilitas hijau terpadu untuk kebutuhan korporasi maupun individu di kawasan metropolitan dan koridor industri Jabodetabek–Cikarang–Karawang. 

Platform ini didesain untuk menjembatani mobilitas hijau menyeluruh dengan kebebasan tujuan:
1. **Skenario Korporat & Bisnis Fleksibel (Universal B2B Corporate Mobility)**: 
   - Mobilisasi talent dalam agenda seleksi kerja (wawancara tatap muka, asesmen on-site, medical check-up, onboarding).
   - Perjalanan dinas manajemen, pimpinan direksi, dan ekspatriat antar-kantor pusat, cabang, maupun lintas kawasan industri.
   - Kunjungan inspeksi pabrik, audit vendor/subkontraktor, dan shuttle bandara eksekutif (Soekarno-Hatta & Halim).
   - Komuter harian terjadwal karyawan yang dibiayai via *Corporate ESG Pool* atau kuota langganan prabayar (*Prepaid Working Capital Float*).
2. **Skenario Penumpang Mandiri & Personal (B2C Multi-Stop Chauffeur)**: 
   - Memungkinkan profesional, talent, dan keluarga memesan perjalanan multi-perhentian bebas ke mana saja (urusan bisnis, rapat maraton seharian, event khusus, hingga komuter harian) dengan memanfaatkan subsidi reward *BrigaCoin* (BRC) atau pembayaran digital mandiri (QRIS, E-Wallet, Kartu Debit/Kredit).
3. **Kebebasan Tujuan Penuh (*Unrestricted Destination Geofence*)**: 
   - Layanan tidak terbatas pada rute pabrik/kantor tertentu. Pengguna bebas menentukan titik penjemputan dan rangkaian perhentian di seluruh wilayah metropolitan **DKI Jakarta, Bogor, Depok, Tangerang, Bekasi, Cikarang, Karawang, dan koridor industri sekitarnya**.

### 1.1. Dua Belas Prinsip Desain Terkalibrasi

1. **Dual-Scenario Access**: Portal terpisah untuk Recruiter (pemesanan atas nama pihak ketiga) dan Talent (pemesanan pribadi).
2. **Dual Pricing Mode**: Fleksibilitas memilih antara tarif per-kilometer (*Point-to-Point*) atau tarif sewa per jam (*Hourly Multi-Trip Charter*).
3. **Alur Janji Temu Terjadwal (Calendly & Lynk.id Style)**: Pemesanan berbasis kalender slot waktu (*time-slot*) interaktif dan tautan pemesanan publik (*Shareable Booking Link*).
4. **Dynamic Multi-Stop Waypoints (Full CRUD & Reorder)**: Pengguna memiliki kendali penuh untuk menambah, mengubah, menghapus, dan menata ulang urutan perhentian sebelum jadwal dikunci.
5. **Toggle Optimasi Rute (TSP Engine vs Sequential)**: Pilihan antara rute otomatis paling efisien (Traveling Salesperson Problem) atau urutan kronologis kaku sesuai agenda wawancara.
6. **Unit Economics Berkelanjutan (1 BRC = Rp 100)**: Kalibrasi rasio reward realistis dengan beban reward terkontrol di kisaran 5%–7% dari GMV untuk menjaga profitabilitas platform.
7. **Arsitektur Cashflow Aman (Prepaid Working Capital)**: Penerapan kas masuk di awal (*Negative Working Capital Advantage*) dari klien korporat untuk mendanai pencairan komisi mitra pengemudi.
8. **Sinkronisasi Terpadu (Planned vs Actual Telematics)**: Rekonsiliasi angka estimasi (jarak km, durasi waktu, konsumsi baterai SoC, dan reduksi karbon) dengan sensor telematika aktual kendaraan.
9. **Waypoint Arrival Lifecycle**: Deteksi otomatis kedatangan di tiap perhentian berbasis geofence (radius ≤ 50 meter) dan telematika deselerasi, memicu notifikasi real-time via WhatsApp (Baileys Engine).
10. **Punctuality SLA & Dispatch Safety Buffer**: Proteksi ketepatan waktu dengan penyediaan *dynamic buffer* (20–30 menit), konfirmasi kesiapan driver H-45 menit, dan mekanisme *Auto-Failover* ke armada cadangan di H-30 menit.
11. **Akuntansi Emisi Scope 3 Holistik (Dimulai dari Leg 0 Penjemputan)**: Sesuai pedoman GHG Protocol Scope 3 Category 7 dan regulasi POJK No. 51/2017, kalkulasi telematika dan sertifikat reduksi emisi CO₂ resmi dihitung sejak driver meluncur dari titik awal/pool menuju lokasi penjemputan pertama (*Dispatch-to-Pickup Leg*).
12. **Kebijakan Mutlak 100% Wajib Driver (Zero Self-Drive / Chauffeur-Driven Mandatory)**: Seluruh layanan Drifee **selalu menyertakan mitra pengemudi profesional (chauffeur)**. Opsi sewa "Lepas Kunci" (*self-drive*) **ditiadakan sepenuhnya**. Kebijakan ini menjamin ketenangan kandidat talent (bebas stres menyetir), proteksi keselamatan aset baterai EV tegangan tinggi, kepatuhan *eco-driving*, serta eliminasi persyaratan deposit jaminan yang memberatkan penumpang.

---

## 2. Alur Pemesanan & Janji Temu (Calendly & Lynk.id Style)

Pengalaman pengguna dalam memesan armada dirancang mengadopsi kemudahan penjadwalan modern (*appointment booking*) dengan dua pintu masuk utama.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  📅 DRIFEE APPOINTMENT & MOBILITY BOOKING ENGINE                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  Langkah 1: Pilih Kategori Layanan                                           │
│             ( ) Point-to-Point (Per-KM Reguler)                              │
│             (•) Sewa Per Jam Multi-Trip (2 Jam / 4 Jam / 8 Jam / 12 Jam)     │
│  Langkah 2: Tentukan Tanggal & Slot Waktu Mulai (Calendar Picker)            │
│  Langkah 3: Rute Multi-Perhentian (Origin, Stop 1..N, Destination)           │
│             [+ Tambah Titik]  [✎ Edit]  [🗑 Hapus]  [≡ Re-order]            │
│  Langkah 4: Opsi Navigasi: [✓] Optimasi AI (TSP)  [ ] Urutan Manual Tetap    │
│  Langkah 5: Settlement Biaya & Opsi Tol/Parkir (Reimburse vs Flat)           │
│  Langkah 6: Konfirmasi Penumpang, WhatsApp Alert & Kalender Cloud            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Dual Entry Mode

#### Mode A: Tautan Pemesanan Mandiri Kandidat (Shareable Booking Link)
* **Konteks**: Recruiter ingin mengundang kandidat dari luar kota/stasiun untuk hadir wawancara di pabrik tanpa repot menanyakan alamat lengkap penjemputan satu per satu.
* **Mekanisme**:
  1. Recruiter membuat agenda di dashboard dan membagikan link: `briga.id/book/interview/@pt-cikarang-mobility`.
  2. Titik Akhir (*Destination*) telah terkunci otomatis ke alamat pabrik/kantor perusahaan.
  3. Kandidat membuka tautan via browser/smartphone, memilih tanggal dan slot jam yang tersedia, memasukkan alamat penjemputannya (misal: Stasiun Cikarang atau kediaman pribadi), serta dapat menambahkan titik singgah (misal: singgah di percetakan dokumen).
  4. **Biaya Bebas untuk Kandidat (Rp 0)**: Seluruh tarif langsung didebit dari *Corporate ESG Pool* milik perusahaan pengundang.
  5. Konfirmasi jadwal instan terkirim ke WhatsApp kandidat beserta kartu kontak driver dan pelacakan live GPS.

#### Mode B: Direct Booking di Dashboard Pengguna
* **Konteks**: Recruiter menyusun jadwal rombongan manajemen atau talent memesan perjalanan mandiri.
* **Mekanisme**: Pengguna menyusun rute, memilih paket jam, dan melakukan checkout langsung di dalam dashboard portal.

### 2.2. Integrasi Pembayaran Lynk.id & Penanganan Webhook
Untuk pemesanan mandiri atau korporat yang melakukan top-up pool secara fleksibel:
1. Sistem Drifee membuat sesi checkout melalui API Lynk.id dengan metadata ID pemesanan.
2. Penumpang atau HR menyelesaikan pembayaran melalui metode QRIS, Virtual Account BCA/Mandiri/BRI, atau e-wallet.
3. Webhook listener pada endpoint `POST /api/webhooks/lynkid` menerima sinyal verifikasi pembayaran secara real-time.
4. Sistem memperbarui status pemesanan menjadi `CONFIRMED` di database Supabase dan langsung menugaskan armada EV terdekat melalui algoritma dispatching.

---

## 3. Manajemen Waypoint Dinamis & Optimasi Rute (TSP Engine)

Kebutuhan proses seleksi kerja sering melibatkan mobilitas multi-titik (misal: jemput kandidat A di Stasiun, jemput kandidat B di hotel transit, singgah di klinik rekanan untuk tes narkoba, lalu tiba bersama di pabrik utama).

### 3.1. Operasi Waypoint Dinamis (Full CRUD)
* **Tambah Titik (`[+ Tambah Titik]`)**: Pengguna dapat menambahkan perhentian perantara (*intermediate stops*) hingga maksimal 8 titik dalam satu sesi sewa.
* **Edit Titik (`[✎ Edit]`)**: Memperbarui lokasi, catatan instruksi khusus (misal: "Pintu Masuk Barat Lobby 2"), atau estimasi waktu singgah (*dwell time*).
* **Hapus Titik (`[🗑 Hapus]`)**: Membatalkan perhentian tertentu jika rencana berubah sebelum armada meluncur.
* **Penataan Ulang (`[≡ Re-order]`)**: Fitur drag-and-drop untuk mengubah urutan perhentian secara intuitif pada antarmuka web dan mobile.

### 3.2. Toggle Opsi Optimasi Rute

```
[ Pilihan Mode Rute Perjalanan ]
(•) Mode Rute Dioptimalkan AI (TSP Solver)
    Sistem menata ulang urutan titik singgah secara otomatis guna menghasilkan
    jarak kilometer terpendek, durasi perjalanan tercepat, dan konsumsi baterai EV terendah.
    
( ) Mode Rute Manual Kronologis (Fixed Sequence)
    Armada mengunjungi titik persis sesuai urutan yang diinput oleh pemesan.
    Wajib digunakan jika agenda wawancara memiliki urutan waktu ketat yang tidak boleh dibalik.
```

### 3.3. Siklus Hidup Kedatangan di Titik Perhentian (Waypoint Lifecycle)
Telematika Drifee memantau posisi armada secara terus-menerus:
1. **Status `EN_ROUTE`**: Driver sedang bergerak menuju waypoint target.
2. **Deteksi `ARRIVED`**: Terpicu otomatis ketika armada memasuki geofence radius ≤ 50 meter dari koordinat target DAN sensor kecepatan mendeteksi kendaraan berhenti (< 3 km/jam) selama minimal 15 detik.
3. **Notifikasi WhatsApp Instan**: Bot Baileys mengirim pesan otomatis kepada PIC atau kandidat di titik tersebut: *"Armada Drifee telah tiba di Lobby Gedung B. Driver Bpk. Joko standby di lobi."*
4. **Checklist Visual di Dashboard**: Indikator titik berubah menjadi tanda centang hijau `[✓]` disertai pencatatan timestamp aktual.

---

## 4. Strategi Harga & Benchmark Pasar Sewa EV Jabodetabek

### 4.1. Kebijakan Absolut: 100% Layanan Wajib Berpengemudi (Zero Self-Drive / Dilarang Lepas Kunci)

Drifee menetapkan aturan fundamental yang tidak dapat ditawar: **Seluruh pesanan armada EV selalu menyertakan mitra pengemudi profesional (Dedicated Chauffeur). Opsi sewa "Lepas Kunci" (menyetir sendiri) ditiadakan sepenuhnya.**

Keputusan ini didasarkan pada 5 pertimbangan strategis bisnis dan operasional:
1. **Kenyamanan & Kesiapan Mental Kandidat Talent**:
   Kandidat yang diundang wawancara sering kali berasal dari luar daerah atau belum menguasai rute jalanan kawasan industri Jabodetabek, Cikarang, dan Karawang. Membiarkan mereka menyetir sendiri menciptakan stres tinggi akibat navigasi, kemacetan, dan pencarian tempat parkir. Dengan pengemudi profesional, kandidat dapat fokus mempersiapkan diri, membaca berkas di kursi belakang, dan tiba di lokasi tes dalam kondisi mental prima.
2. **Proteksi Maksimal Aset EV & Baterai Tegangan Tinggi (High-Voltage Safety)**:
   Kendaraan listrik memiliki karakteristik handling torsi instan dan sistem pengisian daya khusus. Pengemudi awam lepas kunci berisiko tinggi salah mengoperasikan pengisian daya di SPKLU (*DC Fast Charging* vs *AC Slow Charging*), memicu insiden baterai habis total di tengah jalan (*stranding*), atau mempercepat degradasi sel baterai. Mitra pengemudi Drifee telah lulus sertifikasi SOP keselamatan armada EV.
3. **Integritas Audit Emisi Karbon Scope 3 (Eco-Driving Protocol)**:
   Untuk memenuhi standar audit POJK No. 51/2017 dan GHG Protocol, kendaraan wajib dioperasikan dengan teknik *eco-driving* (akselerasi halus dan pemanfaatan *regenerative braking*) guna meminimalkan konsumsi energi per kilometer. Driver tersertifikasi Drifee menjamin konsumsi kWh baterai berada pada titik paling efisien.
4. **Penghapusan Friksi Administrasi & Jaminan (Zero Friction / Tanpa Deposit Jaminan)**:
   Model rental lepas kunci di pasar selalu menuntut verifikasi identitas ketat, penahanan KTP/paspor asli, survei domisili, dan uang jaminan (*security deposit*) jutaan rupiah untuk risiko kecelakaan. Hal ini sangat memberatkan dan tidak realistis bagi kandidat pelamar kerja. Dengan layanan berpengemudi, **penumpang bebas 100% dari tuntutan deposit dan bebas dari tanggung jawab kerusakan mekanis armada**.
5. **Dampak Sosial & Pemberdayaan Ekonomi Pengemudi Lokal**:
   Drifee berkomitmen memberdayakan mitra pengemudi lokal di Jabodetabek dan koridor industri Jawa Barat melalui ekosistem komisi yang adil (85% hak bersih driver), membuka lapangan kerja hijau (*green jobs*) yang berkelanjutan.

---

### 4.2. Mengapa Sewa Per Jam (Hourly Multi-Trip) Sangat Unggul untuk Kebutuhan Rekrutmen?
Pada perjalanan multi-stop dengan durasi wawancara yang dinamis:
* **Menghilangkan Friksi Waktu Tunggu (*Dwell Time*)**: Pada skema argo per-km konvensional, penumpang panik saat jadwal tes molor karena khawatir argo waktu tunggu berjalan terus, atau sebaliknya pengemudi mengeluh karena mobil diam terlalu lama. Model sewa jam memberikan kepastian harga di muka.
* **Dedicated Standby Chauffeur**: Pengemudi setia mendampingi penumpang selama durasi paket. Penumpang bebas berpindah gedung tanpa perlu memesan mobil baru berkali-kali.

---

### 4.3. Benchmark Pasar Rental Mobil EV Per Jam di Jabodetabek (Riset Pasar Q4 2024 – 2025)

Riset komparasi harga rental EV di wilayah Jakarta, Bogor, Depok, Tangerang, Bekasi, dan Cikarang menunjukkan struktur tarif pasar berbasis grade kendaraan:

| Kategori Grade EV | Contoh Unit Kendaraan | Pasar Lepas Kunci (Hanya Riset - ✕ DITIADAKAN DI DRIFEE) | Pasar Dengan Driver (Kompetitor Konvensional) | Paket Drifee (100% Wajib Driver & Daya Listrik) |
|---|---|---|---|---|
| **Grade A: Compact / Urban EV** | Wuling Air ev Long Range, Wuling BinguoEV, Neta V, Seres E1 | Rp 40.000 – Rp 55.000 / jam *(+BBM/Listrik mandiri)* | Rp 85.000 – Rp 110.000 / jam | **2 Jam: Rp 160.000**<br>**4 Jam: Rp 280.000**<br>**8 Jam: Rp 520.000** |
| **Grade B: Mainstream / Executive EV** | BYD Dolphin, BYD Atto 3, MG 4 EV, Chery Omoda E5, Hyundai Ioniq 5 | Rp 70.000 – Rp 95.000 / jam *(+BBM/Listrik mandiri)* | Rp 130.000 – Rp 165.000 / jam | **2 Jam: Rp 220.000**<br>**4 Jam: Rp 390.000**<br>**8 Jam: Rp 720.000** |
| **Grade C: Premium / VIP EV** | Hyundai Ioniq 6, BYD Seal, BMW i4, BMW iX1 | Rp 140.000 – Rp 180.000 / jam *(+BBM/Listrik mandiri)* | Rp 250.000 – Rp 350.000 / jam | **4 Jam: Rp 750.000**<br>**8 Jam: Rp 1.400.000**<br>**12 Jam: Rp 1.950.000** |

> **Penegasan Operasional**: Kolom tarif lepas kunci di atas hanya disajikan sebagai pembanding intelijen pasar. Di platform Drifee, **opsi Lepas Kunci TIDAK PERNAH DISEDIAKAN**. Seluruh paket Drifee telah mencakup unit armada EV prima, jasa pengemudi profesional bersertifikasi, dan konsumsi daya listrik baterai.

---

### 4.4. Matriks Komparasi: Single Trip (Per-KM) vs Sewa Per Jam (Hourly Charter)

Tabel berikut menggambarkan titik impas (*break-even*) efisiensi biaya antara skema per-km dan sewa per jam:

| Parameter Perjalanan | Model Single Trip (Per-KM Reguler) | Model Sewa Per Jam (Hourly Charter 4 Jam) | Analisis Keuntungan & Rekomendasi |
|---|---|---|---|
| **Skenario 1: 1 Trip Langsung (Stasiun Cikarang → Pabrik)**<br>Jarak: 18 km, Waktu: 45 menit | **Rp 88.200**<br>(Rp 4.900/km) | **Rp 280.000**<br>(Paket 4 Jam Grade A) | **Pilih Per-KM**: Jauh lebih hemat untuk perjalanan titik-ke-titik langsung tanpa waktu tunggu. |
| **Skenario 2: Multi-Stop 3 Titik + Waktu Tunggu Singkat**<br>Jarak: 32 km, Total waktu: 2 Jam | **Rp 216.800**<br>(Tarif km + argo tunggu Rp 60.000) | **Rp 160.000** (Paket 2 Jam)<br>atau **Rp 280.000** (Paket 4 Jam) | **Sewa Jam Lebih Kompetitif**: Penumpang memperoleh kepastian biaya tanpa khawatir argo menit berjalan. |
| **Skenario 3: Agenda Rekrutmen Penuh (3 Kandidat + 2 Lokasi)**<br>Jarak: 48 km, Waktu tunggu: 3,5 Jam | **Rp 385.200**<br>(Tarif km + argo tunggu 3,5 jam Rp 150.000) | **Rp 280.000**<br>(Paket 4 Jam Grade A) | **Sewa Jam Menghemat 27%**: Penghematan nyata bagi korporat, sementara pengemudi menerima penghasilan bersih stabil Rp 238.000. |

---

---

### 4.5. Arsitektur Behavioral Pricing & Efek Decoy (Strategi Nudge Paket 8 Jam vs 2 Jam)

Tantangan umum dalam penjualan paket sewa jam: **Klien secara naluriah cenderung memilih paket durasi terpendek (Paket 2 Jam)** karena angka nominal rupiah di awal terlihat paling murah di kantong, meskipun pada kenyataannya durasi tersebut sering kali kurang dan menimbulkan kerepotan operasional.

Untuk menggeser keputusan konsumen secara sukarela agar **secara sadar memilih Paket 8 Jam (Full-Day Dedicated)**, Drifee menerapkan prinsip **Ekonomi Perilaku (*Behavioral Economics*)** yang dipelopori oleh Dan Ariely (*The Decoy Effect*) dan Kahneman-Tversky (*Prospect Theory & Loss Aversion*).

#### 1. Anatomi Tiga Tuas Psikologis Penentu:
1. **The Decoy Effect (Efek Umpan / Asymmetric Dominance - Teori The Economist)**:
   * Jika hanya ada pilihan Paket 2 Jam (Rp 195.000) dan Paket 8 Jam (Rp 495.000), konsumen membandingkan jarak nominal Rp 300.000 dan banyak yang memilih 2 jam.
   * Dengan menyisipkan **Paket 4 Jam sebagai Decoy seharga Rp 385.000 (Rp 96.250/jam)**, perbandingan di otak konsumen berubah drastis:
     * Selisih dari 2 Jam ke 4 Jam: Tambah Rp 190.000 (+97%) untuk ekstra 2 jam.
     * Selisih dari 4 Jam ke 8 Jam: **HANYA TAMBAH Rp 110.000 (+28%) untuk ekstra 4 jam penuh!**
   * Konsumen langsung menyimpulkan bahwa membeli 4 jam adalah keputusan yang rugi, dan mengambil 8 jam adalah *penawaran terbaik yang mutlak tidak boleh dilewatkan (no-brainer bargain)*.
2. **Extreme Price-Per-Hour Contrast Framing (Anchor Biaya Per Jam di Tampilan UI)**:
   * Pada antarmuka pemesanan, sistem Drifee tidak hanya menampilkan total harga, melainkan menyorot **Harga Efektif Per Jam**:
     * Paket 2 Jam: Rp 195.000 `[ Rp 97.500 / Jam ]`
     * Paket 4 Jam: Rp 385.000 `[ Rp 96.250 / Jam ]`
     * Paket 8 Jam: Rp 495.000 `[ HANYA Rp 61.875 / Jam - HEMAT 37% ]`
   * Secara psikologis, Paket 2 Jam dibingkai sebagai "paket darurat yang mahal per jamnya", sedangkan Paket 8 Jam adalah "paket hemat borongan".
3. **Eksploitasi Loss Aversion & Asymmetric Value Bundling ("Peace of Mind")**:
   * **Rasa Takut Kena Denda Lembur (Overtime Anxiety)**: Pada paket 2 jam, jika proses wawancara atau agenda tertahan macet selama 1,5 jam saja, klien dikenakan denda lembur 2 jam (2 × Rp 65.000 = Rp 130.000), sehingga total biaya membengkak menjadi Rp 325.000 dan berisiko jadwal driver bentrok.
   * **Paket 8 Jam Hadir sebagai Asuransi Ketenangan Pikiran**:
     * Bebas 100% dari risiko denda lembur (waktu 8 jam sangat leluasa).
     * Kuota jarak luas: 130 km (cukup untuk koridor Cikarang–Karawang–Jakarta).
     * **Bundling Spesial Paket 8 Jam**: Free kuota e-toll Rp 25.000 + Bonus 100 BRC untuk tabungan ESG korporat + Hak pergantian penumpang (*Multi-Passenger Relay Privilege* - HR dapat menjemput 3 kandidat berbeda bergantian dalam satu sesi 8 jam!).

---

### 4.6. Analisis Struktur HPP Riil (COGS Breakdown) & Limitasi Jam Narik Online Driver

Pertanyaan kritis yang wajib dijawab: **Jika harga sewa unit mobil fisiknya saja (misal BYD Atto 1 / Dolphin / Air ev) adalah Rp 260.000 per 24 jam, belum termasuk listrik, uang makan driver, dan batas jam narik manusia, apakah harga paket 8 jam sebesar Rp 495.000 terlalu murah?**

#### 1. Bedah Biaya Riil per Sesi 8 Jam (Single-Shift Baseline):
1. **Beban Sewa Mobil Fisik**: Rp 260.000 per 24 jam. Jika dalam 1 hari mobil hanya melayani 1 sesi pemesanan 8 jam (okupansi armada ~85%), maka alokasi biaya sewa mobil riil yang diserap per sesi adalah **Rp 260.000 – Rp 301.000**.
2. **Biaya Listrik EV (Charging SPKLU)**:
   * Konsumsi daya EV rata-rata: 0,14 – 0,16 kWh per km.
   * Jarak tempuh pemakaian 8 jam (kawasan Jabodetabek & industri): ~80 – 100 km.
   * Total daya terpakai: ~14 – 15 kWh.
   * Tarif listrik SPKLU Fast Charging PLN (Rp 2.466/kWh + biaya layanan): **Rp 35.000 – Rp 42.000 per sesi**.
3. **Uang Makan Driver (Meal Allowance)**: Driver bertugas 8 jam aktif mendampingi klien: **Rp 40.000 – Rp 45.000 per hari**.
4. **Upah Bersih Kerja Driver (Labor Cost)**: Standar upah kemitraan layak sesuai UMR kawasan industri Bekasi/Cikarang (Rp 5,2 Juta / 25 hari kerja): **Rp 180.000 – Rp 220.000 per hari (8 jam)**.

* **Total HPP Riil per Sesi 8 Jam (Single-Shift)**: Rp 260.000 (Mobil) + Rp 41.500 (Listrik) + Rp 40.000 (Makan) + Rp 200.000 (Upah) = **Rp 541.500 – Rp 563.000**

> **Kesimpulan Matematis**: **YA, HARGA RP 495.000 TERLALU MURAH JIKA MOBIL HANYA DIGUNAKAN 1 SHIFT 8 JAM PER HARI.** Menjual di Rp 495.000 pada skema single-shift akan menyebabkan platform mengalami **defisit kas -Rp 46.500 hingga -Rp 68.000 per sesi (-13,8%)**.

---

#### 2. Keterbatasan Durasi Narik Driver (Fatigue & Safety Regulation):
* Regulasi Kementerian Perhubungan dan keselamatan kerja (K3) transportasi membatasi jam mengemudi aktif manusia: **Maksimal 8 jam normal, toleransi lembur maksimal 10 jam per hari**, dengan kewajiban istirahat minimal 30 menit setiap 4 jam berkendara.
* Driver manusia **tidak boleh dan tidak aman dipaksa narik 24 jam**.
* Akibatnya: Jika mobil dipegang oleh 1 driver saja (*Single-Shift*), mobil menganggur selama 14–16 jam per hari (*asset underutilization*).

---

#### 3. Dua Solusi Strategis Drifee untuk Menjamin Profitabilitas Sehat:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                  DUA JALUR STRATEGIS MENGATASI HPP EV FLEET                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  JALUR 1: REKALIBRASI HARGA SINGLE-SHIFT (Rp 590.000 – Rp 650.000)           │
│  - 1 Mobil = 1 Driver Seharian Penuh.                                        │
│  - Harga dinaikkan menutup HPP Rp 541k + Margin Untung 13%–16%.              │
│  - Tetap SANGAT MURAH di pasar (Bandingkan Goldenbird EV Rp 1,3–1,6 Juta!).  │
│                                                                              │
│  JALUR 2: DOUBLE-SHIFT FLEET UTILIZATION (Armada Bergilir 2 Driver)          │
│  - 1 Mobil EV dipakai 2 Shift x 8 Jam (Shift Pagi 06-14 & Shift Sore 14-22).│
│  - Beban sewa mobil Rp 260k TERBAGI DUA menjadi Rp 130.000 / shift!          │
│  - HPP turun menjadi Rp 412.000/shift => Harga Rp 495.000 SANGAT UNTUNG!     │
└──────────────────────────────────────────────────────────────────────────────┘
```

* **Rekomendasi Penerapan**:
  * Untuk **Armada Khusus Rekrutmen HR Dedicated**: Terapkan **Tarif Kalibrasi Rp 590.000 (Paket 8 Jam)**. Di harga Rp 590.000, platform meraup margin sehat 13,2% dan driver mengantongi take-home pay Rp 5,65 Juta/bulan.
  * Untuk **Armada Operasional Pool Pabrik**: Terapkan **Sistem Double-Shift**, di mana mobil yang sama melayani HR di siang hari, lalu berganti driver di sore hari untuk melayani antar-jemput shift karyawan pabrik.

---

### 4.7. Kebijakan Biaya Tol & Parkir

Mengenai biaya jalan tol dan retribusi parkir, Drifee menerapkan dua opsi transparan:

1. **Model Utama (Rekomendasi Transparan - Pass-through Reimbursement)**:
   * Tarif paket sewa jam mencakup armada EV, pengemudi, dan konsumsi daya listrik kendaraan.
   * Biaya tol dan parkir adalah pengeluaran riil di lapangan (*pass-through cost*).
   * Pengemudi membayar menggunakan kartu e-toll / uang tunai operasional, lalu memfoto struk resmi di aplikasi Drifee saat trip berakhir.
   * Sistem otomatis membebankan total struk tersebut ke tagihan korporat tanpa mark-up sepeser pun.
2. **Model Super All-in Flat (Corporate Add-on)**:
   * Untuk korporat yang menginginkan administrasi ringkas tanpa rekap struk, tersedia opsi *Add-on Flat Tol & Parkir* (misal: +Rp 50.000 untuk paket 4 jam di wilayah Cikarang/Bekasi).
   * Kelebihan atau kekurangan biaya tol menjadi tanggungan batas toleransi platform.

### 4.8. Pagar Pengaman Bisnis (*Business Guardrails*)
* **Kuota Jarak Maksimal (*Mileage Cap*)**: Setiap paket jam memiliki batas pemakaian wajar (rata-rata 15 km/jam sewa). Kelebihan jarak dikenakan biaya **Rp 3.500 per kilometer**.
* **Biaya Kelebihan Waktu (*Overtime Fee*)**: Diberikan toleransi gratis selama 15 menit. Apabila pemakaian melebihi toleransi, berlaku biaya lembur **Rp 60.000 – Rp 65.000 per jam berikutnya**.
* **Fitur Auto-Lockout Driver Fatigue**: Aplikasi driver secara otomatis terkunci dari order baru jika driver telah mencapai 10 jam kerja aktif dalam satu hari kalender, menjamin waktu istirahat minimal 8 jam sebelum shift berikutnya.

---

## 5. Simulasi Swarm Intelligence MiroFish: Kalibrasi Unit Economics

Pengujian model bisnis Drifee dilakukan menggunakan engine simulasi kecerdasan kelompok (**MiroFish Swarm Simulator**) untuk memodelkan interaksi ribuan agen otonom (klien HR, kandidat talent, mitra pengemudi independen, dan platform finance).

### 5.1. Identifikasi Kerentanan Model Lama (1 BRC = Rp 5.000)
Pada model awal sebelum kalibrasi, nilai tukar BrigaCoin diasumsikan sebesar 1 BRC = Rp 5.000 dengan reward 2 BRC/km.
* **Temuan Simulasi MiroFish**:
  * Dalam 1.000 trip simulasi (30 hari), kewajiban pembagian reward token mencapai **Rp 6.400.000.000 (Rp 6,4 Miliar)**.
  * Padahal total omzet GMV perjalanan hanya Rp 1.000.000.000 (Rp 1 Miliar).
  * Platform mengalami defisit kas ekstrem sebesar **minus Rp 6,8 Miliar**, membuktikan bahwa rasio tersebut tidak layak secara ekonomi (*economically fatal*).

---

### 5.2. Hasil Simulasi Model Baru Terkalibrasi (1 BRC = Rp 100)
Model dikalibrasi ulang dengan parameter realistis:
* Rasio nilai: **1 BRC = Rp 100**.
* Base reward: **2 BRC / km** (setara Rp 200 / km).
* Streak bonus: **50 BRC** (setara Rp 5.000) untuk setiap pencapaian 5 trip bintang 5 berturut-turut.
* Biaya ekosistem reward kini hanya menyerap **5,4% dari total GMV**, menjamin ketahanan keuangan platform.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  📊 RINGKASAN KINERJA SIMULASI MIROFISH (30 HARI / 1.000 PERJALANAN)         │
├──────────────────────────────────────────────────────────────────────────────┤
│  Metrik Kinerja Operasional & Finansial      │ Nilai Realisasi Simulasi      │
├──────────────────────────────────────────────┼───────────────────────────────┤
│  Gross Merchandise Value (GMV Total)         │ Rp 1.589.000.000              │
│  Hak Komisi Bersih Mitra Driver (85%)        │ Rp 1.350.650.000              │
│  Rata-rata Pendapatan Driver / Bulan         │ Rp 9.480.000 / driver aktif   │
│  Platform Take-Rate (15%)                    │ Rp 238.350.000                │
│  Beban Liabilitas Reward BrigaCoin (5.4%)    │ Rp 86.200.000                 │
│  Surplus Kas Bersih Platform                 │ Rp 152.150.000 (Surplus Sehat)│
│  Tingkat Kepuasan HR Recruiter               │ 97.6% (Sangat Puas)           │
│  Tingkat Kepuasan Mitra Driver               │ 92.6% (Sangat Loyal)          │
│  Tingkat Kepuasan Eksekutif Keuangan         │ 94.8% (Cashflow Positif)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.3. Simulasi Swarm MiroFish: Uji Efektivitas Decoy Pricing & Migrasi Konsumen ke Paket 8 Jam

Untuk membuktikan secara ilmiah bagaimana psikologi harga mengubah perilaku pembeli, tim simulasi MiroFish menjalankan pengujian multi-agen berbasis *Behavioral Utility Theory* melibatkan **400 agen pengambil keputusan** (100 HR Recruiters, 150 Plant Operations Managers, 150 Talent Commuters) dalam rentang 30 hari operasional (1.200 transaksi pemesanan).

Empat arsitektur harga diuji secara komparatif:

| Parameter Evaluasi Swarm | Model 1: Baseline Linear (Status Quo) | Model 2: Hourly Gradient (Drop Tarif/Jam) | Model 3: Classic Decoy (Popcorn Pricing) | Model 4: Decoy + Value Bundle (Rekomendasi Drifee) |
|---|---|---|---|---|
| **Struktur Tarif (2h / 4h / 8h)** | Rp 160k / Rp 280k / Rp 520k | Rp 210k / Rp 360k / Rp 500k | Rp 190k / Rp 390k / Rp 480k | **Rp 195k / Rp 385k / Rp 495k** |
| **Harga Efektif Per Jam** | Rp 80k / Rp 70k / Rp 65k | Rp 105k / Rp 90k / Rp 62.5k | Rp 95k / Rp 97.5k / Rp 60k | **Rp 97.5k / Rp 96.2k / Rp 61.8k** |
| **Porsi Pilihan Paket 2 Jam** | 7.2% | 4.8% | 1.7% | **0.1% (Tereduksi Total)** |
| **Porsi Pilihan Paket 4 Jam** | 29.1% | 22.2% | 1.8% (Runtuh) | **0.6% (Berfungsi Sempurna sbg Decoy)** |
| **Porsi Pilihan Paket 8 Jam** | 63.7% | 73.0% | 96.5% | **99.3% (Mendominasi Mutlak)** |
| **Total GMV (30 Hari)** | Rp 522.480.000 | Rp 556.320.000 | Rp 571.700.000 | **Rp 596.145.000 (+Rp 73.6 Juta)** |
| **Take-Rate Platform (15%)** | Rp 78.372.000 | Rp 83.448.000 | Rp 85.755.000 | **Rp 89.421.750 (+Rp 11.0 Juta)** |
| **Pendapatan Bersih Driver** | Rp 4.441.080 / bulan | Rp 4.728.720 / bulan | Rp 4.859.450 / bulan | **Rp 5.067.232 / bulan (Optimal)** |
| **Waktu Kosong (Deadhead) Driver** | 2.8 jam / bulan | 2.4 jam / bulan | 1.4 jam / bulan | **1.2 jam / bulan (Sangat Efisien)** |
| **Skor Kepuasan Konsumen (NPS)** | 95.7% | 96.5% | 98.4% | **98.5% (Tertinggi)** |

#### Kesimpulan & Temuan Kunci Simulasi MiroFish:
1. **Paket 4 Jam Adalah Kunci Decoy**: Pada Model 1, sebanyak 29.1% konsumen terjebak memilih paket 4 jam. Namun saat harga paket 4 jam dinaikkan menjadi Rp 385.000 (mendekati Rp 495.000), konsumen merasa rugi membeli 4 jam karena *cukup menambah Rp 110.000 sudah memperoleh ekstra 4 jam penuh (seharian)*.
2. **Kemenangan Mutlak Model 4 (99.3% Migrasi ke 8 Jam)**: Ketika efek decoy digabungkan dengan *Value Bundling* (free e-toll Rp 25.000, multi-passenger relay, dan proteksi bebas lembur), hampir 100% agen HR dan korporat beralih mengambil Paket 8 Jam.
3. **Peningkatan Finansial Segitiga Stakeholder**:
   * **Bagi Korporat**: Ketenangan pikiran mutlak tanpa risiko denda lembur dan fleksibilitas penuh mengantar-jemput banyak kandidat sekaligus.
   * **Bagi Mitra Driver**: Pendapatan bulanan naik menjadi Rp 5,06 Juta dan waktu terbuang (*deadhead*) turun 57% karena memiliki kepastian kerja harian penuh.
---

### 5.4. Simulasi Swarm MiroFish: Uji Kelayakan HPP Armada (Lease Rp 260k, Listrik, Makan, & Limit Jam Narik)

Menjawab analisis kritis mengenai HPP sewa unit armada EV (BYD Atto 1 / Dolphin / Air ev seharga Rp 260.000 / 24 jam), biaya listrik SPKLU, uang makan driver, serta regulasi batas narik online manusia (Kemenhub max 8–10 jam/hari), engine MiroFish mensimulasikan operasional **50 unit armada EV** selama 30 hari penuh dalam 4 skenario:

| Metrik Finansial & Operasional | Skenario A: Harga Rp 495k (Single-Shift 1 Driver/Mobil) | Skenario B: Harga Rp 495k (Double-Shift 2 Driver/Mobil) | Skenario C: Harga Kalibrasi Rp 650k (Single-Shift) | Skenario D: Harga Optimal Rp 590k (Hybrid 1.4x Shift) |
|---|---|---|---|---|
| **Pola Operasional Shift** | 1 Driver / 1 Mobil (8 Jam) | 2 Shift Driver Bergilir (16 Jam) | 1 Driver / 1 Mobil (8 Jam) | Hybrid (Siang HR, Sore Komuter) |
| **Harga Jual Paket 8 Jam** | Rp 495.000 | Rp 495.000 | **Rp 650.000** | **Rp 590.000** |
| **Alokasi Sewa Mobil per Sesi** | Rp 301.391 (Menanggung 24h) | Rp 150.404 (Terbagi 2 Shift) | Rp 304.687 (Menanggung 24h) | Rp 225.433 (Terbagi Hybrid) |
| **Biaya Listrik SPKLU per Sesi** | Rp 41.762 | Rp 41.595 | Rp 41.589 | Rp 41.558 |
| **Uang Makan Driver per Sesi** | Rp 40.000 | Rp 40.000 | Rp 45.000 | Rp 45.000 |
| **Upah Layak Driver per Sesi** | Rp 180.000 | Rp 180.000 | Rp 220.000 | Rp 200.000 |
| **TOTAL HPP REALISTIS PER SESI** | **Rp 563.153** | **Rp 412.000** | **Rp 611.277** | **Rp 511.992** |
| **Total Omzet (30 Hari / 50 Mobil)**| Rp 640.530.000 | Rp 1.283.535.000 | Rp 832.000.000 | Rp 1.020.700.000 |
| **Total Pengeluaran COGS** | Rp 728.720.047 | Rp 1.068.317.663 | Rp 782.434.851 | Rp 885.746.205 |
| **Laba Kotor Platform** | **-Rp 88.190.047 (RUGI -13.8%)** | **+Rp 215.217.337 (UNTUNG 16.8%)**| **+Rp 49.565.149 (UNTUNG 6.0%)** | **+Rp 134.953.795 (UNTUNG 13.2%)**|
| **Take-Home Pay Driver / Bulan**| Rp 5.693.600 | Rp 5.704.600 | Rp 6.784.000 (Sangat Sejahtera) | Rp 5.651.333 |
| **Kepatuhan Jam Narik (Kemenhub)**| Terpenuhi (Max 8-10 Jam) | Terpenuhi (8 Jam per Driver) | Terpenuhi (Max 8-10 Jam) | Terpenuhi (Aplikasi Terkunci) |

#### Rangkuman Strategis untuk Manajemen PT Briga:
1. **Harga Rp 495.000 Memang Terlalu Murah JIKA Single-Shift**:
   Jika 1 mobil hanya jalan 1 kali (8 jam) sehari lalu masuk garasi, bisnis akan rugi Rp 88 Juta per bulan karena biaya sewa 24 jam (Rp 260.000) tidak tertutup oleh margin tarif.
2. **Jalur Eksekusi Terbaik: Skenario D (Rp 590.000) atau Skenario B (Double-Shift)**:
   * **Opsi 1 (Paling Cepat & Aman untuk MVP)**: Pasang harga **Rp 590.000 untuk Paket 8 Jam** (dengan Decoy 4 Jam Rp 430.000 dan 2 Jam Rp 220.000). Di harga ini, bisnis langsung menghasilkan laba bersih **Rp 134,9 Juta per bulan (13,2% margin)** tanpa perlu pusing mengatur pergantian sopir rumit di awal.
   * **Opsi 2 (Maksimalisasi Aset di Koridor Industri)**: Jika operasional siap dengan sistem 2 shift sopir (Pagi & Sore), harga Rp 495.000 bisa dipertahankan karena beban sewa mobil terbelah dua (laba Rp 215 Juta per bulan).

---

## 6. Arsitektur Cashflow, Rekening BCA & Mekanisme Payout Driver

Operasional kemitraan menghadapi tantangan likuiditas klasik: korporat membayar via termin atau langganan, sedangkan mitra driver membutuhkan uang untuk kebutuhan hidup harian.

### 6.1. Pengelolaan Kas Rekening Bank BCA PT Briga
PT Briga menggunakan rekening korporasi di **Bank Central Asia (BCA)** sebagai pusat penampungan kas (*Escrow & Cash Float*):
* **Negative Working Capital Advantage**: Klien korporat menyetorkan dana langganan prabayar (*Prepaid ESG Pool*) pada hari pertama setiap bulan. Drifee memegang kas likuid di muka sebelum layanan dijalankan.
* **Hak Komisi Mitra (85%)**: Dicatat langsung ke buku besar komisi kemitraan (*Partner Commission Ledger*) di dalam sistem detik itu juga setelah trip dinyatakan selesai.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   ARSITEKTUR LIKUIDITAS DAN PENCAIRAN DANA                   │
└──────────────────────────────────────────────────────────────────────────────┘
  [ Korporat HR ] ──(Setoran Prabayar H-0)──> [ Rekening BCA PT Briga ]
                                                        │
                      ┌─────────────────────────────────┴───────────────────┐
                      │ Pencatatan Komisi Instan di Aplikasi (H+0 Selesai)  │
                      └─────────────────────────────────┬───────────────────┘
                                                        │
         ┌──────────────────────────────────────────────┴──────────────────────────────┐
         ▼                                                                             ▼
[ REGULER MALAM - Pukul 23:00 WIB ]                           [ PENCAIRAN DARURAT SIANG HARI ]
- Otomatis ditransfer massal                                  - Driver klik [Tarik Segera] di aplikasi
- Ke Rekening BCA: Biaya Rp 0                                 - Syarat: Saldo minimal Rp 50.000
- Ke Rekening Non-BCA: BI-FAST Rp 2.500                       - Ke BCA: Biaya Rp 0
  (Disubsidi/Diserap Penuh oleh PT Briga)                     - Ke Non-BCA: Biaya BI-FAST Rp 2.500
                                                                (Dipotong dari nominal penarikan)
```

---

### 6.2. Komparasi 3 Skenario Payout Hasil Simulasi Swarm MiroFish

Simulasi MiroFish membandingkan tiga strategi waktu pencairan dana dari sudut pandang beban perbankan dan psikologi pengemudi:

| Skenario Pencairan | Beban Biaya Transfer Bank / Bulan | Kompleksitas Rekonsiliasi Finance | Skor Kepuasan Mitra Driver | Rekomendasi Swarm |
|---|---|---|---|---|
| **Skenario 1: Transfer Langsung Setiap Trip (< 1 Jam)** | **Membengkak** (Rp 2.500 × ribuan trip = Rp 4.120.000) | Sangat Tinggi (Rentan duplikasi & selisih log) | 84.2% | **Tidak Dianjurkan**: Membebani arus kas dan merepotkan divisi finance. |
| **Skenario 2: Transfer Massal Hanya Setiap Malam (23:00)** | **Sangat Hemat** (Rp 1.150.000 / bulan) | Sangat Rendah & Rapi (Satu batch harian) | 71.5% | **Cukup Baik**: Namun menimbulkan friksi bagi driver yang butuh uang makan/bensin darurat siang hari. |
| **Skenario 3: Model Hibrida Drifee (Batch Malam + Tarik Darurat)** | **Terkontrol Optimal** (Rp 1.220.000 / bulan) | Otomatis & Terstruktur | **89.6% (Tertinggi)** | **SANGAT DIREKOMENDASIKAN**: Menyeimbangkan efisiensi biaya perusahaan dan ketenangan mental driver. |

---

### 6.3. Alur Operasional Pencairan Komisi Mitra & Arsitektur Auto-Payout

#### 1. Mekanisme Auto-Payout Terjadwal Malam Hari (Pukul 23:00 WIB - Kunci Sukses Kemitraan)

* **Mengapa Pukul 23:00 WIB adalah Waktu Emas (*Golden Hour*) Pengemudi EV**:
  * Mayoritas vendor rental mobil EV memotong biaya sewa harian (Rp 260.000) tepat pada tengah malam (pukul 00:00 WIB) melalui mekanisme *auto-debit* rekening bank atau dompet pengemudi.
  * Dengan mengeksekusi transfer otomatis tepat pada pukul 23:00 WIB, rekening bank mitra pengemudi dipastikan sudah terisi penuh 1 jam sebelum potongan vendor berjalan. Pengemudi terbebas dari denda pinalti vendor dan dapat beristirahat dengan tenang.
* **Arsitektur Teknis Eksekusi Auto-Payout**:
  1. **Metode Integrasi B2B Disbursement API (Rekomendasi Utama: Flip for Business / Midtrans Iris / Xendit)**:
     - Sistem backend Drifee menjalankan layanan penjadwal (*cron job*) otomatis setiap hari tepat pukul 23:00 WIB.
     - Sistem merekap seluruh hak komisi mitra yang berstatus *Approved* dari perjalanan yang selesai hari itu.
     - Backend mengirim panggilan REST API batch (`POST /api/v2/disbursements`) ke gateway *Flip for Business* / *Midtrans Iris*.
     - Dana langsung meluncur melalui jaringan **BI-FAST 24/7** dan mendarat di rekening bank mitra (BCA, BRI, Mandiri, BNI, GoPay, OVO) dalam tempo **5 hingga 30 detik**.
     - Webhook gateway mengirim laporan sukses, database Supabase menandai status `DISBURSED`, dan bot WhatsApp Baileys mengirimkan notifikasi struk pencairan resmi ke nomor WhatsApp pengemudi: *"Selamat Bpk. Joko, hak komisi harian sebesar Rp 420.750 telah sukses ditransfer ke Rekening BCA Anda. Terima kasih atas dedikasi hijau hari ini!"*
  2. **Metode KlikBCA Bisnis (Multi-Transfer / Payroll CSV Batch - Opsi MVP)**:
     - Dashboard Admin Drifee menyediakan tombol `[ Ekspor Batch Payroll KlikBCA ]` yang menghasilkan file format teks/CSV terstandar BCA.
     - Staf Finance mengunggah file tersebut ke portal KlikBCA Bisnis dan melakukan otorisasi satu kali menggunakan KeyBCA Korporat. Transfer sesama BCA terproses seketika tanpa biaya transaksi (Rp 0).

---

#### 2. Pencairan Instan Siang Hari (On-Demand Emergency Cash-Out)
* Apabila mitra pengemudi membutuhkan uang tunai mendesak di siang hari (misal untuk kebutuhan darurat keluarga):
  1. Driver menekan tombol `[ Ajukan Pencairan Instan ]` di antarmuka buku komisi aplikasi.
  2. Batas minimal penarikan adalah **Rp 50.000**.
  3. **Ketentuan Biaya**:
     * Rekening Tujuan BCA: Biaya **Rp 0** (diterima utuh 100%).
     * Rekening Tujuan Non-BCA: Biaya BI-FAST **Rp 2.500 dipotong dari jumlah yang ditarik** (Contoh: Penarikan Rp 100.000 akan ditransfer sebesar Rp 97.500 ke rekening mitra).
  4. **Eksekusi Teknis**:
     * **Fase MVP (Bantuan Bot WhatsApp Baileys)**: Sistem memicu alert prioritas tinggi ke grup WhatsApp Finance PT Briga: `[URGENT DISBURSEMENT] Driver Bpk. Joko (Rek. BRI 1234567890) mengajukan penarikan Rp 150.000. Biaya admin BI-FAST Rp 2.500 dipotong. Nominal transfer: Rp 147.500.` Staf Finance mengeksekusi transfer via KlikBCA Bisnis dalam tempo < 15 menit.
     * **Fase Scale-Up**: Integrasi API Disbursement (Flip for Business / BCA API) memproses penarikan secara real-time detik itu juga 24/7.

---

## 7. Aspek Legalitas & Kepatuhan Regulasi Dompet Digital (Bank Indonesia Compliance)

Pertanyaan kritis yang wajib diselesaikan: **Apakah PT Briga melanggar hukum Bank Indonesia karena belum memiliki izin penyelenggara dompet digital (E-Money / E-Wallet)?**

### 7.1. Landasan Hukum Sistem Pembayaran Bank Indonesia
Berdasarkan **Peraturan Bank Indonesia (PBI) No. 23/6/PBI/2021** tentang Penyelenggara Jasa Pembayaran (PJP) dan **PADG BI No. 24/7/PADG/2022**:
* Izin Penyelenggara Jasa Pembayaran (PJP) Kategori 1 diwajibkan bagi entitas yang menyediakan fasilitas uang elektronik terbuka (*Open-Loop Electronic Money*) dan dompet elektronik (*E-Wallet*) yang menghimpun dana masyarakat, memfasilitasi transfer antar-pengguna, dan melayani pembayaran di berbagai merchant publik.
* Kewajiban lisensi PJP Kategori 1 mensyaratkan permodalan disetor minimal Rp 15 Miliar hingga Rp 30 Miliar serta proses audit keamanan berlapis.

---

### 7.2. Mengapa Model Drifee 100% Sah Tanpa Perlu Izin PJP E-Wallet?

Model pencatatan komisi Drifee dirancang agar berada sepenuhnya di luar yurisdiksi perizinan dompet digital melalui tiga batasan hukum fundamental:

1. **Bukan Uang Elektronik, Melainkan Buku Rekapitulasi Komisi Kemitraan (*Accrued Commission Ledger*)**:
   Saldo yang tercantum di aplikasi pengemudi bukanlah dana simpanan perbankan atau saldo uang elektronik, melainkan pencatatan akuntansi atas hak upah/bagi hasil kemitraan yang sedang menunggu jadwal transfer ke rekening bank resmi pengemudi.
2. **Tidak Ada Fitur Setor Dana / Top-Up dari Pengemudi**:
   Mitra pengemudi tidak memiliki akses untuk menyetor (*top-up*) uang ke dalam aplikasi. Saldo hanya bertambah dari penyelesaian pekerjaan jasa mobilitas.
3. **Non-Spendable (Tidak Dapat Dibelanjakan)**:
   Saldo komisi tidak dapat digunakan untuk membeli barang, membayar tagihan listrik, membeli pulsa, atau mentransfer uang ke sesama pengemudi. Saldo semata-mata hanya memiliki satu tujuan akhir: **ditarik (*disbursed*) ke rekening bank resmi milik mitra yang bersangkutan**.

---

### 7.3. Pedoman Terminologi Antarmuka (UI/UX) & Dokumen Hukum

Untuk menjaga kepatuhan regulasi secara ketat dan menghindari teguran dari pengawas perbankan:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TABEL PEDOMAN TERMINOLOGI RESMI (STRICT COMPLIANCE GUIDELINES)              │
├──────────────────────────────────────────────────────────────────────────────┤
│  DILARANG DIGUNAKAN (ISTILAH TERLARANG) │ WAJIB DIGUNAKAN (ISTILAH AMAN)     │
├─────────────────────────────────────────┼────────────────────────────────────┤
│  ✕ Dompet Digital / E-Wallet            │ ✓ Rekapitulasi Pendapatan Kemitraan│
│  ✕ Saldo Tersimpan / Deposit Dana       │ ✓ Hak Komisi Belum Dicairkan       │
│  ✕ Top-Up / Isi Saldo Driver            │ ✓ (Fitur Ditiadakan Sepenuhnya)    │
│  ✕ Transfer Saldo Antar Pengemudi       │ ✓ (Fitur Dilarang)                 │
│  ✕ Bayar Menggunakan Saldo Aplikasi     │ ✓ (Fitur Dilarang)                 │
│  ✕ Dompet Driver                        │ ✓ Buku Pendapatan Mitra            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.4. Karakteristik Perjanjian Kemitraan: Jasa Angkutan Berpengemudi (Bukan Rental Lepas Kunci)

Secara hukum perdata dan regulasi transportasi:
* **Bukan Perjanjian Sewa Barang Bergerak Tanpa Awak (*Bare-Boat Charter / Self-Drive*)**: PT Briga tidak menyewakan unit kendaraan kepada konsumen untuk dikemudikan sendiri.
* **Perjanjian Penyediaan Jasa Angkutan Penumpang Berpengemudi (*Chauffeur Transport Service*)**: Hubungan hukum dengan penumpang adalah pengguna jasa angkutan yang didampingi mitra pengemudi resmi. 
* **Implikasi Hukum & Keamanan**:
  1. Tanggung jawab kelaikan jalan (*roadworthiness*), keselamatan teknis kendaraan, dan pengoperasian baterai EV melekat pada mitra pengemudi tersertifikasi.
  2. Penumpang terlindungi asuransi kecelakaan penumpang komersial tanpa perlu menandatangani klausul tanggung renteng ganti rugi fisik mobil seperti pada rental lepas kunci.
  3. Dokumen Perjanjian Kemitraan (*Terms of Partnership*) PT Briga secara eksplisit mengukuhkan status mitra sebagai pengemudi independen penyedia keahlian mengemudi, bukan penyewa mobil.

---

## 8. Akuntansi Emisi Scope 3 & Sertifikasi ESG (POJK 51)

### 8.1. Mengapa Emisi Dihitung Sejak Driver Meluncur (Leg 0: Deadhead)?
Berdasarkan GHG Protocol Corporate Value Chain (Scope 3) Standard Category 7 (*Employee Commuting and Business Travel*) serta regulasi OJK (POJK No. 51/POJK.03/2017):
* Aktivitas bisnis perusahaan (undangan wawancara / inspeksi) menjadi pemicu langsung bergeraknya kendaraan operasional.
* Emisi gas rumah kaca yang dihasilkan selama armada bergerak dari pos pangkalan menuju titik jemput kandidat (*Leg 0: Dispatch Leg*) merupakan bagian integral dari jejak karbon operasional perusahaan pengundang.
* Dengan memperhitungkan Leg 0, Drifee memberikan laporan audit ESG yang transparan, jujur, dan berintegritas tinggi.

---

### 8.2. Metodologi Perhitungan Telematika Karbon
Sensor telematika OBD-II / CAN-Bus armada Drifee mencatat:
1. Konsumsi energi aktual baterai EV dalam satuan Kilowatt-hour (kWh).
2. Faktor emisi jaringan ketenagalistrikan nasional (Grid Jamali): **0,78 kg CO₂ per kWh**.
3. Baseline pembanding emisi mobil bensin konvensional (ICE 1.500cc): **0,185 kg CO₂ per kilometer**.

* **Rumus Emisi EV**: Energi Terpakai (kWh) × 0,78 kg CO₂ per kWh
* **Rumus Emisi Dihindari**: (Total Jarak KM × 0,185 kg CO₂/km) - Emisi EV

Saat sesi perjalanan selesai, dashboard korporat langsung menerbitkan **Sertifikat Pengurangan Emisi Karbon Terverifikasi** ber-barcode yang dapat langsung diimpor ke dalam Laporan Keberlanjutan Tahunan korporat.

---

## 9. Rekomendasi Langkah Eksekusi (Implementation Roadmap)

1. **Fase 1: MVP Deployment (Q4 2024 / Q1 2025)**
   * Deployment skema tabel Supabase untuk Dynamic Waypoints CRUD & Commission Ledger.
   * Integrasi payment link Lynk.id & listener webhook.
   * Notifikasi dispatch dan kedatangan waypoint via WhatsApp Baileys Engine.
   * Pencairan harian semi-otomatis menggunakan KlikBCA Bisnis (Multi-Transfer) didukung bot alert admin.
2. **Fase 2: Otomatisasi Penuh & Scale-Up (Q2 2025)**
   * Integrasi API Disbursement (Flip for Business / BCA API) untuk instant cash-out 24/7 otomatis.
   * Integrasi mesin perutean otomatis (Traveling Salesperson Problem Solver) berbasis Google Maps Distance Matrix.
   * Pemindaian struk digital tol dan parkir berbasis Computer Vision (OCR).

---
*Dokumen ini merupakan cetak biru resmi arsitektur produk dan operasional Drifee by Briga.id.*
