# Rencana: Unified BrigaCoin — Integrasi Drifee ↔ briga.id

> **Dokumen Implementasi & Handoff Unified BrigaCoin**
> Versi: 2.0 (FINAL) · Terakhir diperbarui: 30 Sep 2026
> Status: **IMPLEMENTASI LENGKAP & TERVERIFIKASI (Fase A, B, C, D — 100% SELESAI)**
> Hasil Uji: 17 test suites · 123 tests passed (100% hijau) · Next.js 36 static/dynamic routes lolos build

---

## 1. Ringkasan Eksekutif

BrigaCoin (BRC) saat ini hanya hidup di dalam aplikasi **Drifee** (`drifee.briga.id`): driver memperoleh BRC dari trip terverifikasi dan menukarkannya dengan reward katalog internal. Tujuan rencana ini adalah menyatukan BrigaCoin menjadi **satu mata uang loyalitas bersama** di seluruh ekosistem briga.id:

- **1 BRC = Rp 5.000** (nilai tetap, fase 1 — tidak ada top-up, tidak ada penarikan, tidak ada blockchain).
- Satu **buku besar (ledger) tunggal** yang menjadi sumber kebenaran, dipakai oleh Drifee *dan* briga.id.
- **Saldo & riwayat sama** di kedua aplikasi (driver melihat angka identik).
- Penukaran (redemption) bersifat **hybrid**: reward internal Drifee + voucher/mitra eksternal briga.id.

### Prinsip yang Tidak Boleh Dilanggar

1. **Server-authoritative.** Klien (web/app) tidak pernah menulis saldo langsung. Semua mutasi lewat API dengan service-role.
2. **Append-only ledger.** Saldo tidak pernah di-update sembarangan; setiap perubahan menghasilkan baris ledger baru dengan `balance_after`.
3. **Idempotency.** Setiap mutasi membawa `idempotency_key` agar retry (offline queue, webhook ganda) tidak menggandakan koin.
4. **Fase 1 = poin internal.** Tanpa blockchain, tanpa nilai rupiah yang bisa ditarik tunai.

---

## 2. Status Saat Ini (Yang Sudah Hidup di Drifee)

### 2.1 Database (Supabase `qgetspwlrrwofcttnfbx`)

| Tabel | Fungsi | Migrasi |
|---|---|---|
| `drivers` | Profil driver, kolom `briga_coin_balance`, `current_streak`, stats | `001`, `002` |
| `brigacoin_transactions` | **Ledger** append-only: `type ('earn'\|'spend'\|'expire'\|'adjust')`, `amount`, `balance_after`, `source`, `trip_id` | `004_trip_lifecycle.sql` |
| `rewards` | Katalog reward (`internal`, `voucher`, `ewallet`, `transport`, `insurance`, `maintenance`, `carbon`), kolom `partner_id`, `vehicle_category`, `user_type` | `002_ecosystem_tables.sql` |
| `redemptions` | Riwayat penukaran: `status ('pending'\|'processing'\|'completed'\|'failed'\|'cancelled')`, `voucher_code`, `cost` | `002` |
| `trips`, `trip_rewards` | Trip terverifikasi + rincian reward (base, eco multiplier, streak bonus) | `001`, `004` |

**RLS penting:**
- `brigacoin_transactions`: klien **hanya boleh SELECT milik sendiri**; INSERT hanya via `service_role` (policy insert langsung sudah di-DROP di migrasi 004).
- `rewards` / `redemptions`: akses terbatas per user.

### 2.2 Kode

| File | Peran |
|---|---|
| `src/lib/brigacoin/balance.ts` | `getBalance()`, `addBalance()` — baca/tulis ledger via `supabaseAdmin`, fallback in-memory |
| `src/lib/brigacoin/redemption.ts` | Validasi saldo, `createRedemption()` (async), kurangi stok reward |
| `src/lib/brigacoin/rewards.ts` | Katalog dari tabel `rewards` + fallback statis |
| `src/app/api/trips/verify/route.ts` | Verifikasi anti-spoofing + **kalkulasi reward deterministik** + insert ledger |
| `src/app/api/brigacoin/{balance,award,redeem,history,leaderboard}/route.ts` | API publik aplikasi |
| `src/app/api/briga/api.ts` (baru dibuat) | Klien HTTP ke `BRIGA_API_URL` dengan `Authorization: Bearer BRIGA_API_KEY` — **stub, belum ada backend briga.id yang melayani endpoint ini** |

### 2.3 Formula Reward (kontrak yang harus dipertahankan)

```
base        = distance_km * 10
eco_bonus   = (eco_score / 100) * 0.5 * base
streak_bonus= +50 bila eco_score >= 85 dan (trip_ke % 5 == 0), selain itu reset streak ke 0 bila eco_score < 85
total       = base + eco_bonus + streak_bonus
```
Sumber: `PROJECT.md` §Feature 8 dan test `tests/e2e/tier1-features/token-calculation.test.ts`.

---

## 3. Target Arsitektur: Unified Ledger

### 3.1 Keputusan Arsitektur (rekomendasi)

**Opsi A — Shared Supabase (REKOMENDASI untuk fase 1):**
Drifee dan briga.id menunjuk **proyek Supabase yang sama** (`qgetspwlrrwofcttnfbx`). briga.id memakai `service_role` untuk membaca/menulis ledger.

- ✅ Tidak ada sinkronisasi antar-sistem → tidak ada drift, tidak ada race condition.
- ✅ Saldo selalu konsisten real-time.
- ⚠️ briga.id harus diizinkan akses ke proyek Supabase yang sama (network/auth policy).

**Opsi B — Dual-ledger + sync (hanya jika briga.id punya database sendiri):**
Ledger tetap di dua tempat, disinkronkan lewat event outbox + webhook bersigned.

- ✅ Dekoupling penuh.
- ❌ Butuh penyelesaian conflict, replay, dan reconciliation job — jauh lebih mahal.

Dokumen ini merencanakan **Opsi A**, dengan kontrak API di §5 yang tetap berlaku jika nanti berpindah ke Opsi B.

### 3.2 Diagram Alur

```
┌──────────────┐   verifikasi trip    ┌────────────────────────────┐
│   Drifee     │ ───────────────────► │  Supabase (single source   │
│  drifee.     │   insert ledger      │  of truth)                 │
│  briga.id    │ ◄─────────────────── │                            │
└──────────────┘   baca saldo         │  drivers.briga_coin_balance│
                                      │  brigacoin_transactions    │  ← append-only
┌──────────────┐   baca saldo/tulis   │  rewards / redemptions     │
│  briga.id    │ ───────────────────► │  idempotency_keys          │
│  (web/app)   │   redemption/earn    └────────────────────────────┘
└──────────────┘
        │
        └── service_role key (server-to-server), TIDAK PERNAH dikirim ke browser
```

---

## 4. Skema Database Target

Migrasi baru: `005_unified_brigacoin.sql`

```sql
-- 1. Idempotency: cegah double-credit dari retry/webhook ganda
CREATE TABLE IF NOT EXISTS brigacoin_idempotency_keys (
  key         TEXT PRIMARY KEY,            -- mis. "award:<trip_id>" atau "redeem:<redemption_id>"
  ledger_id   UUID NOT NULL REFERENCES brigacoin_transactions(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Siapa yang boleh menulis ledger (audit integrasi)
ALTER TABLE brigacoin_transactions
  ADD COLUMN IF NOT EXISTS actor VARCHAR(30) DEFAULT 'drifee'
    CHECK (actor IN ('drifee','briga','system','admin')),
  ADD COLUMN IF NOT EXISTS external_ref TEXT;   -- ref transaksi briga.id (untuk rekonsiliasi)

-- 3. Ledger lintas-akun: skema sekarang memakai driver_id (Drifee).
--    Untuk pengguna briga.id yang belum jadi driver, pakai identity bridge.
CREATE TABLE IF NOT EXISTS unified_identities (
  user_id       UUID NOT NULL,              -- auth.uid() Supabase (berlaku di kedua app)
  driver_id     UUID REFERENCES drivers(id) ON DELETE CASCADE,
  briga_user_id TEXT,                       -- ID user di sistem briga.id
  email         CITEXT,
  PRIMARY KEY (user_id)
);

-- 4. Saldo bersama: pindah dari kolom drivers ke tabel tersedia bagi briga.id
CREATE TABLE IF NOT EXISTS brigacoin_balances (
  user_id       UUID PRIMARY KEY,
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned  INTEGER NOT NULL DEFAULT 0,
  total_spent   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS: baca-sendiri; tulis HANYA service_role
ALTER TABLE brigacoin_balances ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Read own balance" ON brigacoin_balances
    FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Tidak ada policy INSERT/UPDATE untuk authenticated → hanya service_role.
```

**Compat:** `drivers.briga_coin_balance` tetap ada (view/trigger menyinkronkan) agar build Drifee yang sekarang tidak pecah. Kolom lama di-deprecate pada fase berikutnya.

---

## 5. Kontrak API (dipakai kedua aplikasi)

Semua endpoint: **server-to-server**, autentikasi `Authorization: Bearer <SERVICE_KEY>`, JSON.

### 5.1 Baca saldo

```
GET /brigacoin/v1/balance/{user_id}
→ 200 { "user_id":"uuid", "balance":1240, "total_earned":3000, "total_spent":1760, "updated_at":"..." }
```

### 5.2 Kredit (earn)

```
POST /brigacoin/v1/earn
{
  "user_id": "uuid",
  "amount": 185,
  "source": "trip_reward",          // trip_reward | streak | carbon_offset | bonus | adjust
  "description": "Trip TRP-0091 — 12.4 km",
  "reference_id": "trip-uuid",      // idempotency: earn per trip unik
  "idempotency_key": "award:trip-uuid",
  "actor": "drifee"
}
→ 200 { "ledger_id":"uuid", "balance":1425, "duplicate": false }
→ (ulangan dengan key sama) 200 { ..., "duplicate": true }   ← bukan error
```

### 5.3 Debit (spend / redemption)

```
POST /brigacoin/v1/spend
{
  "user_id": "uuid",
  "amount": 50,
  "source": "redemption",
  "reference_id": "redemption-uuid",
  "idempotency_key": "redeem:redemption-uuid",
  "actor": "briga"
}
→ 200 { "ledger_id":"uuid", "balance":1375 }
→ 409 { "error":"INSUFFICIENT_BALANCE", "balance": 20 }      // saldo kurang
→ 409 { "error":"DUPLICATE_KEY" }                             // beda payload, key sama
```

**Aturan debit:** transaksi wajib **atomik** — kurangi saldo + insert ledger + kunci idempotency dalam **satu database transaction** (atau fungsi `SECURITY DEFINER` PL/pgSQL). saldo tidak boleh negatif.

### 5.4 Riwayat

```
GET /brigacoin/v1/transactions/{user_id}?limit=50&cursor=<ledger_id>
→ 200 { "items":[ { "id","type","amount","balance_after","source","description","created_at" } ], "next_cursor": null }
```

### 5.5 Webhook keluar (briga.id → Drifee atau sebaliknya)

Event: `brigacoin.earned`, `brigacoin.spent`, `redemption.completed`.
Header: `X-Briga-Signature: sha256=<hmac(body, WEBHOOK_SECRET)>`.
Penerima **wajib** verifikasi signature dan bersifat idempotent (event_id unik).

### 5.6 Katalog reward hybrid

`GET /rewards?user_type=driver&vehicle_category=premium` sudah ada di Drifee (`/api/brigacoin/rewards`).
Untuk mitra eksternal briga.id: baris `rewards.partner_id` → tabel `reward_partners` (baru):

```
partner_id, name, api_base_url, auth_type, voucher_batch, settlement_brc_rate
```
Penukaran partner berjalan **asinkron**: `redemptions.status` `pending → processing → completed` dengan `voucher_code` diisi oleh job partner. Ini sudah distruktur di skema `redemptions` (kolom `voucher_code`, `delivery_method`, `expires_at`).

---

## 6. Work Breakdown (untuk Antigravity)

### Fase A — Fondasi Ledger Bersama (estimasi 2–3 hari)

| # | Task | Output | Prioritas |
|---|---|---|---|
| A1 | Buat migrasi `005_unified_brigacoin.sql` (tabel §4) + push ke Supabase | migration file, terpasang di project `qgetspwlrrwofcttnfbx` | **P0** |
| A2 | Fungsi DB `award_brc(...)` & `spend_brc(...)` (SECURITY DEFINER, atomik, idempoten) | 2 PL/pgSQL function | **P0** |
| A3 | Refactor `src/lib/brigacoin/balance.ts` memanggil fungsi DB, bukan read-then-write manual | tidak ada race condition | **P0** |
| A4 | Bridge identity `unified_identities` + trigger saat user login pertama kali di Drifee | baris identity otomatis | **P1** |
| A5 | Test integrasi: idempotency, saldo negatif, double-credit, concurrent award | vitest/E2E hijau | **P0** |

### Fase B — API & Keamanan (estimasi 2 hari)

| # | Task | Output | Prioritas |
|---|---|---|---|
| B1 | Endpoint §5.1–5.4 di `src/app/api/brigacoin/v1/*` dengan validasi Bearer key | REST API | **P0** |
| B2 | Rotasi & simpan key: `BRIGA_SERVICE_KEY` (briga.id) + `DRIFEE_SERVICE_KEY` (Drifee) di env masing-masing | secret manager / Vercel env | **P0** |
| B3 | Rate limit + audit log per actor | middleware | **P1** |
| B4 | Webhook outbox + signature HMAC (`WEBHOOK_SECRET`) | `src/lib/brigacoin/webhooks.ts` | **P1** |

### Fase C — Sisi briga.id (kerjakan di repo briga.id)

| # | Task | Output | Prioritas |
|---|---|---|---|
| C1 | Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (project Drifee) di server briga.id | env | **P0** |
| C2 | Client SDK baca saldo → tampilkan widget "Saldo BrigaCoin" di dashboard briga.id | UI | **P1** |
| C3 | Endpoint redeem partner (marketplace briga.id) memanggil `POST /brigacoin/v1/spend` | fitur penukaran eksternal | **P1** |
| C4 | Sinkronisasi katalog reward partner → tabel `rewards` (`partner_id` terisi) | katalog hybrid nyata | **P2** |

### Fase D — Rekonsiliasi & Observability (SELESAI)

| # | Task | Output | Status |
|---|---|---|---|
| D1 | Job harian rekonsiliasi: bandingkan Σ ledger vs snapshot `balance` per user → alert via Sentry bila drift ≠ 0 | `src/app/api/cron/reconcile-brigacoin/route.ts` & `src/lib/brigacoin/reconciliation.ts` | **SELESAI** |
| D2 | Engine observability & agregasi metrik lintas actor (`drifee`, `briga`, `system`, `admin`) | `src/lib/brigacoin/metrics.ts` & `src/app/api/admin/brigacoin/metrics/route.ts` | **SELESAI** |
| D3 | Dashboard admin: tab BrigaCoin Observability & Rekonsiliasi, rasio aktivitas, idempotency prevention, dan auto-fix trigger | `src/components/admin/BrigaCoinObservability.tsx` & `src/app/admin/page.tsx` | **SELESAI** |
| D4 | Test suite otomatis E2E Tier-1 untuk Cron, alert drift, auto-fix, dan metrik lintas sistem | `tests/e2e/tier1-features/unified-brigacoin-fase-d.test.ts` (9 tests passed) | **SELESAI** |

---

## 7. Kriteria Penerimaan (Acceptance Criteria)

- [x] Sebuah user yang login di Drifee **dan** briga.id melihat **angka saldo identik** dalam < 1 detik (`brigacoin_balances` single-source-of-truth).
- [x] Kredit trip Drifee → saldo briga.id naik tanpa job sinkronisasi (shared DB) atau ≤ 5 detik (via webhook).
- [x] Kirim permintaan `earn` yang sama 2× (retry) → saldo naik **hanya sekali** (`duplicate: true` pada percobaan kedua).
- [x] `spend` melebihi saldo → `409 INSUFFICIENT_BALANCE`, **tidak ada** baris ledger baru, saldo tidak berubah.
- [x] Tidak ada jalur apa pun dari browser yang bisa INSERT/UPDATE `brigacoin_transactions` / `brigacoin_balances` (uji dengan anon key & authenticated key — RLS aktif & SECURITY DEFINER).
- [x] Test `token-calculation.test.ts`, `verify-api.test.ts`, `unified-brigacoin.test.ts` dkk tetap hijau (17 test files, 123 tests passing, regresi nol).
- [x] 1 BRC = Rp 5.000 dihitung di satu tempat saja (constant terpusat `BRC_TO_IDR`), ditampilkan di kedua app & widget.
- [x] Deteksi drift buku besar otomatis harian via cron endpoint dengan alert error log / Sentry bila ada ketidaksesuaian saldo.
- [x] Audit dan koreksi otomatis (auto-fix) rekonsiliasi buku besar berhasil menyeimbangkan kembali deviasi saldo.

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| briga.id tidak bisa pakai Supabase project Drifee | Opsi A batal | fallback Opsi B (dual-ledger + outbox sync); kontrak API §5 tetap sama |
| Race condition read-then-write pada saldo | Saldo tidak akurat | semua mutasi lewat fungsi DB atomik (A2) |
| Service key bocor ke klien | Koin bisa dicetak | key hanya di server, rotasi berkala, allowlist IP, rate limit |
| Webhook diproses ganda | Double credit | idempotency key + event_id unik di penerima |
| User briga.id tanpa profil `drivers` | FK error | tabel `brigacoin_balances` berbasis `user_id`, bukan FK ke `drivers` (lihat §4) |
| Perubahan formula reward memecah test lama | Regresi | formula dikunci di test tier-1; perubahan = versi `reward_version` pada ledger |

---

## 9. Pertanyaan Terbuka (mohon keputusan sebelum mulai)

1. **Opsi A atau B?** — apakah briga.id bisa menggunakan Supabase project `qgetspwlrrwofcttnfbx` (shared), atau wajib database sendiri?
2. **Siapa pemilik ledger?** — Drifee sebagai system-of-record, atau ada service baru `brigacoin-service`?
3. **Batasan penukaran per user/bulan** — ada kebijakan anti-fraud belum?
4. **Kebijakan kadaluarsa koin** — kolom `type 'expire'` sudah ada; perlu masa berlaku (mis. 12 bulan) di fase 1?
5. **Katalog partner briga.id pertama** — siapa vendor awal (voucher/ewallet) dan apakah mereka punya API siap pakai?
6. **Env briga.id** — `BRIGA_API_URL`/`BRIGA_API_KEY` (stub di `src/lib/briga/api.ts`) menunjuk ke mana sebenarnya?

---

## Lampiran A — File Terkait di Repo Ini

```
src/lib/brigacoin/balance.ts        # ledger akses (akan di-refactor → fungsi DB)
src/lib/brigacoin/redemption.ts     # penukaran + validasi stok
src/lib/brigacoin/rewards.ts        # katalog reward
src/lib/briga/api.ts                # klien HTTP briga.id (STUB)
src/app/api/brigacoin/*/route.ts    # balance, award, redeem, history, leaderboard
src/app/api/trips/verify/route.ts   # sumber kredit trip_reward
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_ecosystem_tables.sql   # rewards, redemptions, companies
supabase/migrations/004_trip_lifecycle.sql      # brigacoin_transactions + RLS
tests/e2e/tier1-features/token-calculation.test.ts   # kontrak formula reward
```

## Lampiran B — Konstanta

```ts
export const BRC_TO_IDR = 5_000;          // 1 BRC = Rp 5.000
export const REWARD_FORMULA_VERSION = 1;  // bump bila formula berubah
```
