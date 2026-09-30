// ─────────────────────────────────────────────────────────────
// trip-submitter.ts — End-to-end Trip Submission Pipeline
//
// Alur:
// 1. Collect GPS points dari IndexedDB (Dexie)
// 2. Build payload trip lengkap (dengan photo evidence)
// 3. POST ke /api/trips/verify
// 4. Parse response (Data Schema Specification)
// 5. Jika VERIFIED → auto-purge IndexedDB
// 6. Jika OFFLINE → queue ke IndexedDB (bukan localStorage!)
// 7. Return hasil ke UI
// ─────────────────────────────────────────────────────────────

import { db, getTripPoints, purgeVerifiedTrip, purgeOldTrips, type PurgeResult } from '@/lib/db';
import { buildAndHashTrip, type TripHashResult } from '@/lib/trip-hasher';
import {
  calculateEcoScore,
  calculateTokenReward,
  calculateCO2Avoided,
  type EcoScoreResult,
  type TokenRewardResult,
} from '@/lib/eco-score';
import type { TripTelemetrySummary, EcoProfile, PhotoEvidence } from '@/types/telematics';
import type { TelematicsState } from '@/hooks/useTelematics';
import { queueSubmission, isOnline } from '@/lib/offline-sync';

// ── Types ───────────────────────────────────────────────────
export interface TripSubmissionInput {
  tripId: string;
  driverId: string;
  vehicleId: string;
  startTime: string;       // ISO 8601
  endTime: string;         // ISO 8601
  startBatterySoc: number;
  endBatterySoc: number;
  startOdometerKm: number;
  endOdometerKm: number;
  batteryCapacityKwh: number;
  driverCurrentStreak: number;
  /** Final telemetry state from useTelematics hook */
  telemetryState: TelematicsState;
  /**
   * Anti-spoofing photo evidence — OPSIONAL.
   * UX anti-friction: validasi manual hanya dipicu oleh watchdog
   * (ANOMALY_DETECTED via LiveProofCapture), bukan wajib di awal/akhir trip.
   */
  startPhotoEvidence: PhotoEvidence | null;
  endPhotoEvidence: PhotoEvidence | null;
  /**
   * Scope 3 absolut: rincian jarak deadhead (kosong menuju jemput)
   * vs jarak revenue. Deadhead WAJIB masuk payload — wajib dihitung
   * sejak transisi DISPATCHED.
   */
  deadheadDistanceKm?: number;
  tripPhaseTimeline?: Array<{ from: string; to: string; at: string }>;
  watchdogFlagged?: boolean;
  watchdogAnomalyReason?: string | null;
}

export interface TripSubmissionResult {
  success: boolean;
  verificationStatus: 'VERIFIED' | 'REJECTED' | 'ERROR' | 'QUEUED';
  ecoScore: EcoScoreResult;
  tokenReward: TokenRewardResult;
  co2AvoidedKg: number;
  tripHash: string;
  purge: PurgeResult | null;
  matchedRoute: [number, number][] | null;
  serverResponse: unknown;
  errorMessage?: string;
}

// ── Main Submission Function ────────────────────────────────
export async function submitAndVerifyTrip(
  input: TripSubmissionInput,
): Promise<TripSubmissionResult> {
  const {
    tripId, driverId, vehicleId,
    startTime, endTime,
    startBatterySoc, endBatterySoc,
    startOdometerKm, endOdometerKm,
    batteryCapacityKwh, driverCurrentStreak,
    telemetryState,
    startPhotoEvidence,
    endPhotoEvidence,
  } = input;

  // ── 1. Calculated metrics ──
  const distanceKm = Math.max(0, Number((endOdometerKm - startOdometerKm).toFixed(1)));
  const socUsed = Math.max(0, startBatterySoc - endBatterySoc);
  const energyUsedKwh = Number(((socUsed / 100) * batteryCapacityKwh).toFixed(2));

  // ── 1b. Scope 3 absolut — deadhead miles adalah bagian integral ──
  const deadheadDistanceKm = Math.min(input.deadheadDistanceKm ?? 0, distanceKm);
  const revenueDistanceKm = Number((distanceKm - deadheadDistanceKm).toFixed(1));

  // ── 2. Build telemetry summary ──
  const telemetrySummary: TripTelemetrySummary = {
    harsh_accelerations: telemetryState.harshAccelCount,
    harsh_brakings: telemetryState.harshBrakeCount,
    idle_duration_seconds: telemetryState.idleDurationSec,
    average_speed_kmh: distanceKm > 0 && telemetryState.tripDurationSec > 0
      ? Math.round((distanceKm / (telemetryState.tripDurationSec / 3600)) * 10) / 10
      : 0,
    max_speed_kmh: telemetryState.maxSpeedKmh,
    interpolated_gaps: 0,
  };

  // ── 3. Calculate Eco Score ──
  const ecoScore = calculateEcoScore({
    telemetrySummary,
    startTime,
  });

  // ── 4. Calculate Token Reward ──
  const tokenReward = calculateTokenReward({
    ecoScore: ecoScore.score,
    distanceKm,
    currentStreak: driverCurrentStreak,
  });

  // ── 5. Calculate CO₂ Avoided ──
  const co2AvoidedKg = calculateCO2Avoided(distanceKm);

  // ── 6. Generate SHA-256 Hash ──
  let hashResult: TripHashResult;
  try {
    hashResult = await buildAndHashTrip({
      tripId,
      driverId,
      vehicleId,
      startTime,
      endTime,
      profileUsed: ecoScore.profileUsed,
      startBatterySoc,
      endBatterySoc,
      startOdometerKm,
      endOdometerKm,
      distanceKm,
      energyUsedKwh,
      telemetrySummary,
      ecoScore: ecoScore.score,
      ecoGrade: ecoScore.grade,
      scoreBreakdown: ecoScore.breakdown,
      tokensEarned: tokenReward.totalReward,
      esgCo2AvoidedKg: co2AvoidedKg,
    });
  } catch (err) {
    return {
      success: false,
      verificationStatus: 'ERROR',
      ecoScore,
      tokenReward,
      co2AvoidedKg,
      tripHash: '',
      purge: null,
      matchedRoute: null,
      serverResponse: null,
      errorMessage: `Hash generation failed: ${(err as Error).message}`,
    };
  }

  // ── 7. Collect GPS points from IndexedDB ──
  let gpsPoints: { lat: number; lng: number; timestamp: number; speed_kmh: number; accuracy: number }[] = [];
  try {
    const points = await getTripPoints(tripId);
    gpsPoints = points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
      speed_kmh: p.speedKmh,
      accuracy: p.accuracy,
    }));
  } catch {
    // IndexedDB read failure — send without points
  }

  // ── 8. POST to backend /api/trips/verify ──
  let serverResponse: unknown = null;
  let verificationStatus: 'VERIFIED' | 'REJECTED' | 'ERROR' = 'ERROR';
  let matchedRoute: [number, number][] | null = null;

  try {
    const res = await fetch('/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: tripId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        start_time: startTime,
        end_time: endTime,
        profile_used: ecoScore.profileUsed,
        start_battery_soc: startBatterySoc,
        end_battery_soc: endBatterySoc,
        start_odometer_km: startOdometerKm,
        end_odometer_km: endOdometerKm,
        distance_km: distanceKm,
        energy_used_kwh: energyUsedKwh,
        telemetry_summary: telemetrySummary,
        eco_score: ecoScore.score,
        eco_grade: ecoScore.grade,
        score_breakdown: ecoScore.breakdown,
        tokens_earned: tokenReward.totalReward,
        esg_co2_avoided_kg: co2AvoidedKg,
        client_nonce: hashResult.payload.client_nonce,
        hashed_at: hashResult.payload.hashed_at,
        driver_current_streak: driverCurrentStreak,
        trip_hash: hashResult.hash,
        gps_points: gpsPoints,
        // Scope 3 breakdown — deadhead wajib terekam di server
        deadhead_distance_km: deadheadDistanceKm,
        revenue_distance_km: revenueDistanceKm,
        trip_phase_timeline: input.tripPhaseTimeline ?? [],
        watchdog_flagged: input.watchdogFlagged ?? false,
        watchdog_anomaly_reason: input.watchdogAnomalyReason ?? null,
        photo_evidence: {
          start_odometer: startPhotoEvidence?.odometerPhoto ?? null,
          start_battery: startPhotoEvidence?.batteryPhoto ?? null,
          end_odometer: endPhotoEvidence?.odometerPhoto ?? null,
          end_battery: endPhotoEvidence?.batteryPhoto ?? null,
          captured_at: startPhotoEvidence?.capturedAt ?? endPhotoEvidence?.capturedAt ?? 0,
          gps_location: startPhotoEvidence?.gpsLocation ?? endPhotoEvidence?.gpsLocation ?? null,
        },
      }),
    });

    serverResponse = await res.json();

    // Parse response (Data Schema Specification)
    const resp = serverResponse as {
      verification_status: 'VERIFIED' | 'REJECTED' | 'PENDING';
      matched_route?: [number, number][] | null;
      tokens_earned?: number;
    };

    if (!res.ok) {
      verificationStatus = 'REJECTED';
    } else {
      verificationStatus = resp.verification_status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';
    }
    matchedRoute = resp.matched_route ?? null;

    // Override tokens_earned from server response if available
    if (resp.tokens_earned !== undefined && resp.tokens_earned > 0) {
      tokenReward.totalReward = resp.tokens_earned;
    }
    } catch (err) {
      // ── OFFLINE FALLBACK: Queue to IndexedDB ──
      // Trip data is preserved and will auto-sync when connectivity returns
      const offlinePayload = {
        trip_id: tripId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        start_time: startTime,
        end_time: endTime,
        profile_used: ecoScore.profileUsed,
        start_battery_soc: startBatterySoc,
        end_battery_soc: endBatterySoc,
        start_odometer_km: startOdometerKm,
        end_odometer_km: endOdometerKm,
        distance_km: distanceKm,
        energy_used_kwh: energyUsedKwh,
        telemetry_summary: telemetrySummary,
        eco_score: ecoScore.score,
        eco_grade: ecoScore.grade,
        score_breakdown: ecoScore.breakdown,
        tokens_earned: tokenReward.totalReward,
        esg_co2_avoided_kg: co2AvoidedKg,
        client_nonce: hashResult.payload.client_nonce,
        hashed_at: hashResult.payload.hashed_at,
        driver_current_streak: driverCurrentStreak,
        trip_hash: hashResult.hash,
        gps_points: gpsPoints,
        // Scope 3 breakdown — ikut masuk antrian offline
        deadhead_distance_km: deadheadDistanceKm,
        revenue_distance_km: revenueDistanceKm,
        trip_phase_timeline: input.tripPhaseTimeline ?? [],
        watchdog_flagged: input.watchdogFlagged ?? false,
        watchdog_anomaly_reason: input.watchdogAnomalyReason ?? null,
        photo_evidence: {
          start_odometer: startPhotoEvidence?.odometerPhoto ?? null,
          start_battery: startPhotoEvidence?.batteryPhoto ?? null,
          end_odometer: endPhotoEvidence?.odometerPhoto ?? null,
          end_battery: endPhotoEvidence?.batteryPhoto ?? null,
          captured_at: startPhotoEvidence?.capturedAt ?? endPhotoEvidence?.capturedAt ?? 0,
          gps_location: startPhotoEvidence?.gpsLocation ?? endPhotoEvidence?.gpsLocation ?? null,
        },
      };

      try {
        await queueSubmission(tripId, offlinePayload);
        console.log(`[submit] Trip ${tripId} queued to IndexedDB (offline)`);
        return {
          success: false,
          verificationStatus: 'QUEUED' as const,
          ecoScore,
          tokenReward,
          co2AvoidedKg,
          tripHash: hashResult.hash,
          purge: null,
          matchedRoute: null,
          serverResponse: null,
          errorMessage: 'Offline — trip disimpan ke antrian lokal. Akan dikirim otomatis saat koneksi kembali.',
        };
      } catch (queueErr) {
        return {
          success: false,
          verificationStatus: 'ERROR' as const,
          ecoScore,
          tokenReward,
          co2AvoidedKg,
          tripHash: hashResult.hash,
          purge: null,
          matchedRoute: null,
          serverResponse,
          errorMessage: `Offline queue failed: ${(queueErr as Error).message}`,
        };
      }
    }

  // ── 9. Auto-purge IndexedDB on VERIFIED ──
  let purge: PurgeResult | null = null;
  if (verificationStatus === 'VERIFIED') {
    try {
      purge = await purgeVerifiedTrip(tripId);
      await purgeOldTrips(24 * 60 * 60 * 1000);
    } catch (err) {
      console.warn('[submit] Purge failed (non-critical):', err);
    }
  }

  return {
    success: verificationStatus === 'VERIFIED',
    verificationStatus,
    ecoScore,
    tokenReward,
    co2AvoidedKg,
    tripHash: hashResult.hash,
    purge,
    matchedRoute,
    serverResponse,
  };
}
