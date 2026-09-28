// ─────────────────────────────────────────────────────────────
// trip-hasher.ts
// SHA-256 Cryptographic Hashing via Web Crypto API
//
// Menghasilkan hash deterministik dari payload trip untuk
// mencegah manipulasi data GPS, skor, dan odometer.
// Hash ini berfungsi sebagai digital fingerprint yang bisa
// diverifikasi oleh server tanpa memerlukan private key.
// ─────────────────────────────────────────────────────────────

import type { EcoProfile, TripTelemetrySummary } from '@/types/telematics';
import type { EcoScoreBreakdown } from '@/lib/eco-score';

// ── Canonical Trip Payload ──────────────────────────────────
// Struktur data yang di-hash harus deterministik:
// - Urutan field konsisten (sorted keys)
// - Angka dibulatkan ke presisi tetap
// - Timestamp dalam ISO 8601 UTC

export interface TripHashPayload {
  trip_id: string;
  driver_id: string;
  vehicle_id: string;
  start_time: string;       // ISO 8601
  end_time: string;          // ISO 8601
  profile_used: EcoProfile;
  start_battery_soc: number;
  end_battery_soc: number;
  start_odometer_km: number;
  end_odometer_km: number;
  distance_km: number;
  energy_used_kwh: number;
  telemetry_summary: TripTelemetrySummary;
  eco_score: number;
  eco_grade: string;
  score_breakdown: EcoScoreBreakdown;
  tokens_earned: number;
  esg_co2_avoided_kg: number;
  /** Client-side nonce — mencegah replay attack */
  client_nonce: string;
  /** Timestamp saat hash di-generate (ISO 8601) */
  hashed_at: string;
}

// ── Helper: Canonical JSON ──────────────────────────────────
/**
 * Serialisasi objek ke JSON dengan key yang di-sort secara rekursif.
 * Ini memastikan hash deterministik terlepas dari urutan properti.
 */
function canonicalJSON(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'number') return Number.isFinite(obj) ? String(obj) : 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'boolean') return String(obj);

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalJSON(item));
    return `[${items.join(',')}]`;
  }

  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = sortedKeys.map((key) => {
      const value = (obj as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${canonicalJSON(value)}`;
    });
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(obj);
}

// ── Helper: Generate Nonce ──────────────────────────────────
/**
 * Generate random 16-byte hex nonce via Web Crypto API.
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for environments without crypto
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Main: SHA-256 Hash ──────────────────────────────────────
/**
 * Generate SHA-256 hash dari TripHashPayload menggunakan
 * Web Crypto API (`crypto.subtle.digest`).
 *
 * @returns Hex-encoded SHA-256 hash string (64 karakter)
 */
export async function hashTripPayload(payload: TripHashPayload): Promise<string> {
  // 1. Serialisasi ke canonical JSON (sorted keys, deterministic)
  const canonical = canonicalJSON(payload);

  // 2. Encode ke Uint8Array (UTF-8)
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);

  // 3. SHA-256 digest via Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // 4. Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

// ── Convenience: Build Payload + Hash in One Call ───────────
export interface BuildAndHashInput {
  tripId: string;
  driverId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  profileUsed: EcoProfile;
  startBatterySoc: number;
  endBatterySoc: number;
  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  energyUsedKwh: number;
  telemetrySummary: TripTelemetrySummary;
  ecoScore: number;
  ecoGrade: string;
  scoreBreakdown: EcoScoreBreakdown;
  tokensEarned: number;
  esgCo2AvoidedKg: number;
}

export interface TripHashResult {
  hash: string;
  payload: TripHashPayload;
  canonicalJson: string;
  hashedAt: string;
}

/**
 * Convenience function: Bangun payload, tambahkan nonce + timestamp,
 * lalu hash sekaligus.
 */
export async function buildAndHashTrip(input: BuildAndHashInput): Promise<TripHashResult> {
  const hashedAt = new Date().toISOString();
  const clientNonce = generateNonce();

  const payload: TripHashPayload = {
    trip_id: input.tripId,
    driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    start_time: input.startTime,
    end_time: input.endTime,
    profile_used: input.profileUsed,
    start_battery_soc: input.startBatterySoc,
    end_battery_soc: input.endBatterySoc,
    start_odometer_km: input.startOdometerKm,
    end_odometer_km: input.endOdometerKm,
    distance_km: input.distanceKm,
    energy_used_kwh: input.energyUsedKwh,
    telemetry_summary: input.telemetrySummary,
    eco_score: input.ecoScore,
    eco_grade: input.ecoGrade,
    score_breakdown: input.scoreBreakdown,
    tokens_earned: input.tokensEarned,
    esg_co2_avoided_kg: input.esgCo2AvoidedKg,
    client_nonce: clientNonce,
    hashed_at: hashedAt,
  };

  const canonical = canonicalJSON(payload);
  const hash = await hashTripPayload(payload);

  return {
    hash,
    payload,
    canonicalJson: canonical,
    hashedAt,
  };
}
