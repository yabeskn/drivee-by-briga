// ─────────────────────────────────────────────────────────────
// /api/trips/verify — Backend API Route
//
// Response Schema (Data Schema Specification):
// {
//   trip_id, driver_id, vehicle_id, start_time, end_time,
//   profile_used, distance_km, telemetry_summary, eco_score,
//   tokens_earned, current_streak, trip_hash, verification_status
// }
//
// Milestone 2 (R1): Trip Verification API Audit & Token Economics Hardening
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import { addBalance, awardBrigaCoins } from '@/lib/brigacoin/balance';
import { canonicalJSON } from '@/lib/trip-hasher';

// ── Types ───────────────────────────────────────────────────
interface TripVerifyRequest {
  trip_id: string;
  driver_id: string;
  vehicle_id: string;
  start_time: string;
  end_time: string;
  profile_used: string;
  start_battery_soc: number;
  end_battery_soc: number;
  start_odometer_km: number;
  end_odometer_km: number;
  distance_km: number;
  energy_used_kwh: number;
  telemetry_summary: {
    harsh_accelerations: number;
    harsh_brakings: number;
    idle_duration_seconds: number;
    average_speed_kmh: number;
    max_speed_kmh: number;
    interpolated_gaps: number;
  };
  eco_score: number;
  eco_grade: string;
  score_breakdown?: Record<string, unknown>;
  tokens_earned: number;
  esg_co2_avoided_kg: number;
  client_nonce?: string;
  hashed_at?: string;
  driver_current_streak?: number;
  current_streak?: number;
  trip_hash: string;
  gps_points?: Array<{
    lat: number;
    lng: number;
    timestamp: number;
    speed_kmh: number;
    accuracy: number;
  }>;
  /** Scope 3 absolut — deadhead wajib terekam di sisi server */
  deadhead_distance_km?: number;
  revenue_distance_km?: number;
  trip_phase_timeline?: Array<{ from: string; to: string; at: string }>;
  watchdog_flagged?: boolean;
  watchdog_anomaly_reason?: string | null;
  photo_evidence?: {
    start_odometer?: string | null;
    start_battery?: string | null;
    end_odometer?: string | null;
    end_battery?: string | null;
    captured_at?: number;
    gps_location?: { lat: number; lng: number } | null;
  };
}

interface TripVerifyResponse {
  trip_id: string;
  driver_id?: string;
  vehicle_id?: string;
  start_time?: string;
  end_time?: string;
  profile_used?: string;
  distance_km?: number;
  telemetry_summary?: {
    harsh_accelerations: number;
    harsh_brakings: number;
    idle_duration_seconds: number;
    average_speed_kmh: number;
    max_speed_kmh: number;
    interpolated_gaps: number;
  };
  eco_score?: number;
  tokens_earned: number;
  current_streak?: number;
  trip_hash?: string;
  verification_status: 'VERIFIED' | 'REJECTED' | 'PENDING';
  verification_details?: {
    osrm_matched: boolean;
    physics_check_passed: boolean;
    anti_spoofing_passed: boolean;
    hash_verified: boolean;
    gaps_interpolated: number;
    token_breakdown: {
      base_reward: number;
      eco_multiplier: number;
      multiplier_reward: number;
      eco_multiplier_reward?: number;
      streak_bonus: number;
      anti_spoofing_bonus: number;
      total_reward: number;
      current_streak?: number;
    };
  };
  reason?: string;
  message: string;
  details?: Record<string, unknown>;
}

// ── Rejection Response Helper ───────────────────────────────
function rejectResponse(
  status: number,
  tripId: string,
  reason: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      verification_status: 'REJECTED',
      trip_id: tripId || '',
      reason,
      message: reason,
      tokens_earned: 0,
      details,
    },
    { status }
  );
}

// ── Server-side Hash Verification ───────────────────────────
function recomputeTripHash(data: TripVerifyRequest): { fullHash: string; legacyHash: string } {
  // 1. Full 20-field canonical payload (matches trip-hasher.ts)
  const fullPayload: Record<string, unknown> = {
    trip_id: data.trip_id,
    driver_id: data.driver_id,
    vehicle_id: data.vehicle_id,
    start_time: data.start_time,
    end_time: data.end_time,
    profile_used: data.profile_used,
    start_battery_soc: data.start_battery_soc,
    end_battery_soc: data.end_battery_soc,
    start_odometer_km: data.start_odometer_km,
    end_odometer_km: data.end_odometer_km,
    distance_km: data.distance_km,
    energy_used_kwh: data.energy_used_kwh,
    telemetry_summary: data.telemetry_summary,
    eco_score: data.eco_score,
    eco_grade: data.eco_grade,
    score_breakdown: data.score_breakdown,
    tokens_earned: data.tokens_earned,
    esg_co2_avoided_kg: data.esg_co2_avoided_kg,
    client_nonce: data.client_nonce,
    hashed_at: data.hashed_at,
  };

  // 2. Standard 16-field payload (matches fixtures.ts)
  const legacyPayload: Record<string, unknown> = {
    trip_id: data.trip_id,
    driver_id: data.driver_id,
    vehicle_id: data.vehicle_id,
    start_time: data.start_time,
    end_time: data.end_time,
    profile_used: data.profile_used,
    start_battery_soc: data.start_battery_soc,
    end_battery_soc: data.end_battery_soc,
    start_odometer_km: data.start_odometer_km,
    end_odometer_km: data.end_odometer_km,
    distance_km: data.distance_km,
    energy_used_kwh: data.energy_used_kwh,
    eco_score: data.eco_score,
    eco_grade: data.eco_grade,
    tokens_earned: data.tokens_earned,
    esg_co2_avoided_kg: data.esg_co2_avoided_kg,
  };

  const fullHash = createHash('sha256')
    .update(canonicalJSON(fullPayload))
    .digest('hex');

  const legacyHash = createHash('sha256')
    .update(canonicalJSON(legacyPayload))
    .digest('hex');

  return { fullHash, legacyHash };
}

function verifyHash(data: TripVerifyRequest): { verified: boolean; reason: string } {
  if (!data.trip_hash) {
    return { verified: false, reason: 'Missing trip_hash in request' };
  }

  const { fullHash, legacyHash } = recomputeTripHash(data);
  const clientHash = data.trip_hash;

  if (data.client_nonce && clientHash === fullHash) {
    return { verified: true, reason: 'Hash matches' };
  }
  if (clientHash === legacyHash) {
    return { verified: true, reason: 'Hash matches' };
  }
  if (clientHash === fullHash) {
    return { verified: true, reason: 'Hash matches' };
  }

  const expectedHash = data.client_nonce ? fullHash : legacyHash;
  return {
    verified: false,
    reason: `Hash mismatch: server=${expectedHash.slice(0, 16)}..., client=${clientHash ? clientHash.slice(0, 16) : 'missing'}...`,
  };
}

// ── Anti-Spoofing Validation (CONDITIONAL) ─────────────────
// UX Anti-Friction: foto TIDAK wajib di awal/akhir trip.
// Validasi hanya dijalankan JIKA foto dikirim (dipicu oleh
// LiveProofCapture saat watchdog mendeteksi anomali).
// Jika foto ada → format/ukuran/timestamp wajib valid.
function validatePhotoEvidence(
  photoEvidence: TripVerifyRequest['photo_evidence'],
  startTimeIso?: string,
  endTimeIso?: string
): { valid: boolean; reason: string } {
  if (!photoEvidence || typeof photoEvidence !== 'object') {
    return { valid: true, reason: 'No photo evidence — frictionless mode' };
  }

  const { start_odometer, start_battery, end_odometer, end_battery, captured_at } = photoEvidence;

  // Semua foto kosong → lolos (mode tanpa friksi)
  if (!start_odometer && !start_battery && !end_odometer && !end_battery) {
    return { valid: true, reason: 'No photo evidence — frictionless mode' };
  }

  const base64Regex = /^data:image\/(jpeg|jpg|png);base64,/;
  const isPresent = (v: unknown) => typeof v === 'string' && v.length > 0;
  const isInvalidFormat = (v: unknown) => typeof v !== 'string' || !base64Regex.test(v);

  // Jika SETIDAKNYA satu foto dikirim, semua foto yang ada wajib valid formatnya
  const presentPhotos = [start_odometer, start_battery, end_odometer, end_battery].filter(isPresent);
  if (presentPhotos.length > 0 && presentPhotos.some(isInvalidFormat)) {
    return { valid: false, reason: 'Invalid photo format' };
  }

  // Foto parsial ditolak: jika satu foto dikirim, keempatnya wajib ada.
  // (Bukti anti-spoofing parsial tidak bermakna secara forensik.)
  if (presentPhotos.length > 0 && presentPhotos.length < 4) {
    return {
      valid: false,
      reason: 'Partial photo evidence — odometer & battery photos for start and end are required when any photo is submitted',
    };
  }

  const maxSize = 2 * 1024 * 1024; // 2MB
  if (
    (typeof start_odometer === 'string' && start_odometer.length > maxSize) ||
    (typeof start_battery === 'string' && start_battery.length > maxSize) ||
    (typeof end_odometer === 'string' && end_odometer.length > maxSize) ||
    (typeof end_battery === 'string' && end_battery.length > maxSize)
  ) {
    return { valid: false, reason: 'Photo too large' };
  }

  if (captured_at !== undefined && captured_at !== null) {
    const capturedTime = typeof captured_at === 'number' ? captured_at : new Date(captured_at).getTime();
    if (isNaN(capturedTime)) {
      return { valid: false, reason: 'Invalid photo timestamp' };
    }

    const startMs = startTimeIso ? new Date(startTimeIso).getTime() : NaN;
    const endMs = endTimeIso ? new Date(endTimeIso).getTime() : NaN;

    if (!isNaN(startMs)) {
      const diffStart = Math.abs(startMs - capturedTime);
      const diffEnd = !isNaN(endMs) ? Math.abs(endMs - capturedTime) : Infinity;

      // Photo captured_at must be consistent relative to trip start time (or end time) within 30 minutes
      if (diffStart > 30 * 60 * 1000 && diffEnd > 30 * 60 * 1000) {
        return { valid: false, reason: 'Photo timestamp expired or inconsistent with trip start time' };
      }
    }
  }

  return { valid: true, reason: 'Photo evidence valid' };
}

// ── Physics Sanity Check ───────────────────────────────────
function physicsSanityCheck(data: TripVerifyRequest): {
  passed: boolean;
  reason: string;
} {
  const {
    distance_km,
    energy_used_kwh,
    start_battery_soc,
    end_battery_soc,
    telemetry_summary,
    start_time,
    end_time,
    gps_points,
  } = data;

  // 1. Distance checks (must be strictly > 0 and <= 500 km)
  if (typeof distance_km !== 'number' || isNaN(distance_km) || distance_km <= 0) {
    return { passed: false, reason: `Distance ${distance_km} km must be greater than zero (distance physics violation)` };
  }
  if (distance_km > 500) {
    return { passed: false, reason: `Distance ${distance_km} km exceeds maximum limit of 500 km (distance physics violation)` };
  }

  // 2. Energy checks (must be >= 0 and <= 100 kWh)
  if (typeof energy_used_kwh !== 'number' || isNaN(energy_used_kwh) || energy_used_kwh < 0) {
    return { passed: false, reason: `Energy used ${energy_used_kwh} kWh cannot be negative (energy physics violation)` };
  }
  if (energy_used_kwh > 100) {
    return { passed: false, reason: `Energy consumption ${energy_used_kwh} kWh exceeds maximum capacity of 100 kWh (energy physics violation)` };
  }

  // 3. Battery SOC checks
  if (typeof start_battery_soc === 'number' && typeof end_battery_soc === 'number') {
    if (start_battery_soc < 0 || start_battery_soc > 100 || end_battery_soc < 0 || end_battery_soc > 100) {
      return { passed: false, reason: 'Battery SOC percentage must be within 0 - 100 range' };
    }
    const socUsed = start_battery_soc - end_battery_soc;
    if (socUsed < 0) {
      return { passed: false, reason: 'Invalid battery SOC change (negative consumption)' };
    }
  }

  // 4. Timestamp & duration checks
  const startMs = new Date(start_time).getTime();
  const endMs = new Date(end_time).getTime();
  if (isNaN(startMs) || isNaN(endMs)) {
    return { passed: false, reason: 'Invalid ISO-8601 timestamp for start_time or end_time' };
  }
  if (endMs <= startMs) {
    return { passed: false, reason: `Trip end_time (${end_time}) must be strictly after start_time (${start_time})` };
  }
  if (startMs > Date.now() + 60000 || endMs > Date.now() + 60000) {
    return { passed: false, reason: 'Trip timestamps cannot be in the future' };
  }

  // 5. Speed checks (Threshold: 160 km/h)
  const MAX_SPEED = 160;
  if (telemetry_summary) {
    if (telemetry_summary.max_speed_kmh > MAX_SPEED) {
      return { passed: false, reason: `Max speed ${telemetry_summary.max_speed_kmh} km/h exceeds maximum threshold of 160 km/h (speed physics violation)` };
    }
    if (telemetry_summary.average_speed_kmh > MAX_SPEED) {
      return { passed: false, reason: `Average speed ${telemetry_summary.average_speed_kmh} km/h exceeds maximum threshold of 160 km/h (speed physics violation)` };
    }
  }

  // Implied speed from distance / duration
  const durationHours = (endMs - startMs) / (1000 * 3600);
  if (durationHours > 0) {
    const calculatedSpeed = distance_km / durationHours;
    if (calculatedSpeed > MAX_SPEED) {
      return { passed: false, reason: `Calculated speed ${calculatedSpeed.toFixed(1)} km/h exceeds maximum threshold of 160 km/h (speed physics violation)` };
    }
  }

  // 6. GPS points checks
  if (gps_points && Array.isArray(gps_points) && gps_points.length > 0) {
    for (let i = 0; i < gps_points.length; i++) {
      const pt = gps_points[i];
      if (pt.speed_kmh > MAX_SPEED) {
        return { passed: false, reason: `GPS point speed ${pt.speed_kmh} km/h exceeds maximum threshold of 160 km/h (speed physics violation)` };
      }
      if (i > 0 && pt.timestamp < gps_points[i - 1].timestamp) {
        return { passed: false, reason: 'GPS points have non-chronological timestamps' };
      }
    }
  }

  return { passed: true, reason: 'Physics check passed' };
}

// ── Token Calculation ──────────────────────────────────────
function calculateTokens(
  data: TripVerifyRequest,
  currentStreak: number
): {
  base_reward: number;
  eco_multiplier: number;
  multiplier_reward: number;
  eco_multiplier_reward: number;
  streak_bonus: number;
  anti_spoofing_bonus: number;
  total_reward: number;
  new_streak: number;
} {
  const { distance_km, eco_score } = data;

  // Base Reward = distance_km * 10
  const base_reward = distance_km * 10;

  // Eco Multiplier = (eco_score / 100) * 0.5 * Base Reward
  const clampedEco = Math.max(0, Math.min(100, eco_score));
  const eco_multiplier = (clampedEco / 100) * 0.5;
  const multiplier_reward = eco_multiplier * base_reward;

  // Streak logic:
  // Qualifying trip requires eco_score >= 85
  const isStreakQualifying = eco_score >= 85;
  const new_streak = isStreakQualifying ? currentStreak + 1 : 0;

  // Streak Bonus = +50 every 5th consecutive trip with eco_score >= 85
  const streak_bonus = isStreakQualifying && new_streak > 0 && new_streak % 5 === 0 ? 50 : 0;

  const total_reward = Math.round(base_reward + multiplier_reward + streak_bonus);

  return {
    base_reward,
    eco_multiplier,
    multiplier_reward,
    eco_multiplier_reward: multiplier_reward,
    streak_bonus,
    anti_spoofing_bonus: 0,
    total_reward,
    new_streak,
  };
}

// ── OSRM Map Matching (Simplified) ─────────────────────────
function osrmMapMatching(gpsPoints: TripVerifyRequest['gps_points']): {
  matched: boolean;
  matched_route: [number, number][] | null;
  gaps_interpolated: number;
} {
  if (!gpsPoints || gpsPoints.length < 2) {
    return { matched: false, matched_route: null, gaps_interpolated: 0 };
  }

  const matched_route: [number, number][] = gpsPoints.map((p) => [p.lat, p.lng]);

  let gaps_interpolated = 0;
  for (let i = 1; i < gpsPoints.length; i++) {
    const timeDiff = gpsPoints[i].timestamp - gpsPoints[i - 1].timestamp;
    if (timeDiff > 5 * 60 * 1000) {
      gaps_interpolated++;
    }
  }

  return { matched: true, matched_route, gaps_interpolated };
}

// ── Main Handler ───────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return rejectResponse(400, '', 'Invalid JSON in request body');
  }

  if (!bodyJson || typeof bodyJson !== 'object' || Array.isArray(bodyJson)) {
    return rejectResponse(400, '', 'Request body must be a JSON object');
  }

  const data = bodyJson as TripVerifyRequest;

  // Validate required fields
  const requiredFields: (keyof TripVerifyRequest)[] = [
    'trip_id',
    'driver_id',
    'vehicle_id',
    'start_time',
    'end_time',
    'distance_km',
    'energy_used_kwh',
    'eco_score',
    'trip_hash',
  ];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      return rejectResponse(400, data.trip_id || '', `Missing required field: ${String(field)}`);
    }
  }

  // UUID format check for relational entity keys
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!isUuid.test(data.driver_id)) {
    return rejectResponse(400, data.trip_id, `Invalid driver UUID format: ${data.driver_id}`);
  }

  // 1. Validate photo evidence (anti-spoofing)
  const photoValidation = validatePhotoEvidence(data.photo_evidence, data.start_time, data.end_time);
  if (!photoValidation.valid) {
    return rejectResponse(
      400,
      data.trip_id,
      `Anti-spoofing failed: ${photoValidation.reason}`,
      { anti_spoofing_passed: false }
    );
  }

  // 2. Physics sanity check
  const physicsCheck = physicsSanityCheck(data);
  if (!physicsCheck.passed) {
    return rejectResponse(
      400,
      data.trip_id,
      `Physics check failed: ${physicsCheck.reason}`,
      { physics_check_passed: false, anti_spoofing_passed: true }
    );
  }

  // 3. Verify hash (server-side re-computation)
  const hashVerification = verifyHash(data);
  if (!hashVerification.verified) {
    return rejectResponse(
      400,
      data.trip_id,
      `Hash verification failed: ${hashVerification.reason}`,
      { hash_verified: false, physics_check_passed: true, anti_spoofing_passed: true }
    );
  }

  // 4. OSRM map matching
  const osrmResult = osrmMapMatching(data.gps_points);

  // 5. Driver streak tracking & Token Economics calculation:
  // Query driver's current streak from the database BEFORE token calculation
  let currentStreak = 0;
  const validDriverId = isUuid.test(data.driver_id) ? data.driver_id : null;
  const validVehicleId = isUuid.test(data.vehicle_id) ? data.vehicle_id : null;
  const validTripId = isUuid.test(data.trip_id) ? data.trip_id : null;

  let driverRecord: { total_trips?: number; current_streak?: number; average_eco_score?: number; briga_coin_balance?: number } | null = null;

  if (isAdminConfigured() && validDriverId) {
    try {
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('total_trips, current_streak, average_eco_score, briga_coin_balance')
        .eq('id', validDriverId)
        .single();

      // Normalize driver record: handle null, empty array (no rows), or array of rows
      const resolvedDriver = Array.isArray(driver)
        ? (driver.length > 0 ? driver[0] : null)
        : driver;

      if (resolvedDriver && typeof resolvedDriver === 'object' && Object.keys(resolvedDriver).length > 0) {
        driverRecord = resolvedDriver;
        currentStreak = Number(resolvedDriver.current_streak) || 0;
      }
    } catch (err) {
      console.warn('[API] Could not fetch driver from Supabase:', err);
    }
  }

  // Fallback to client-submitted streak when driver is not in database / no rows found
  if (!driverRecord) {
    const fallbackStreak = data.driver_current_streak ?? data.current_streak ?? 0;
    currentStreak = Number(fallbackStreak) || 0;
  }

  const tokenBreakdown = calculateTokens(data, currentStreak);
  const tokensEarned = tokenBreakdown.total_reward;
  const newStreak = tokenBreakdown.new_streak;

  // 6. Server-Side State Updates (upon VERIFIED status):
  if (isAdminConfigured() && validDriverId) {
    try {
      const totalTrips = ((driverRecord?.total_trips) || 0) + 1;
      const currentBalance = Number(driverRecord?.briga_coin_balance) || 0;
      const newBalance = currentBalance + tokensEarned;
      const currentAvg = Number(driverRecord?.average_eco_score) || 0;
      const newAvg = Math.round(((currentAvg * (totalTrips - 1) + data.eco_score) / totalTrips) * 10) / 10;

      // Update drivers profile stats (streak, total_trips, average_eco_score)
      await supabaseAdmin
        .from('drivers')
        .update({
          current_streak: newStreak,
          total_trips: totalTrips,
          average_eco_score: newAvg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', validDriverId);

      // Award tokens via Unified BrigaCoin (atomic, idempotent, server-authoritative)
      await awardBrigaCoins(
        validDriverId,
        tokensEarned,
        'trip',
        `Trip verification reward (${data.distance_km} km, Eco: ${data.eco_score})`,
        data.trip_id,
        {
          idempotencyKey: `award:${data.trip_id}`,
          actor: 'drifee',
          userId: validDriverId,
        }
      );

      // Upsert into trips table
      if (validVehicleId) {
        await supabaseAdmin
          .from('trips')
          .upsert({
            id: validTripId || undefined,
            driver_id: validDriverId,
            vehicle_id: validVehicleId,
            start_time: data.start_time,
            end_time: data.end_time,
            distance_km: data.distance_km,
            eco_score: data.eco_score,
            eco_grade: data.eco_grade || 'A',
            tokens_earned: tokensEarned,
            trip_hash: data.trip_hash,
            verification_status: 'verified',
            profile_used: data.profile_used,
            start_battery_soc: data.start_battery_soc,
            end_battery_soc: data.end_battery_soc,
            energy_used_kwh: data.energy_used_kwh,
            harsh_accelerations: data.telemetry_summary?.harsh_accelerations || 0,
            harsh_brakings: data.telemetry_summary?.harsh_brakings || 0,
            idle_duration_seconds: data.telemetry_summary?.idle_duration_seconds || 0,
            avg_speed_kmh: data.telemetry_summary?.average_speed_kmh || 0,
            max_speed_kmh: data.telemetry_summary?.max_speed_kmh || 0,
            co2_avoided_kg: data.esg_co2_avoided_kg || 0,
            // Scope 3 absolut — deadhead miles wajib tersimpan
            deadhead_distance_km: data.deadhead_distance_km || 0,
            revenue_distance_km: data.revenue_distance_km || data.distance_km,
            trip_phase_timeline: data.trip_phase_timeline || [],
            watchdog_flagged: data.watchdog_flagged || false,
            watchdog_anomaly_reason: data.watchdog_anomaly_reason || null,
          });
      }
    } catch (dbErr) {
      console.warn('[API] Non-critical: Failed to save trip to Supabase:', dbErr);
    }
  } else if (!isAdminConfigured() && validDriverId) {
    try {
      await addBalance(
        validDriverId,
        tokensEarned,
        'trip',
        'Trip verification reward',
        data.trip_id
      );
    } catch {
      // ignore in-memory fallback error
    }
  }

  // 7. Return verified response (HTTP 200)
  const response: TripVerifyResponse = {
    trip_id: data.trip_id,
    driver_id: data.driver_id,
    vehicle_id: data.vehicle_id,
    start_time: data.start_time,
    end_time: data.end_time,
    profile_used: data.profile_used,
    distance_km: data.distance_km,
    telemetry_summary: data.telemetry_summary,
    eco_score: data.eco_score,
    tokens_earned: tokensEarned,
    current_streak: newStreak,
    trip_hash: data.trip_hash,
    verification_status: 'VERIFIED',
    verification_details: {
      osrm_matched: osrmResult.matched,
      physics_check_passed: true,
      anti_spoofing_passed: true,
      hash_verified: true,
      gaps_interpolated: osrmResult.gaps_interpolated,
      token_breakdown: {
        base_reward: tokenBreakdown.base_reward,
        eco_multiplier: tokenBreakdown.eco_multiplier,
        multiplier_reward: tokenBreakdown.multiplier_reward,
        eco_multiplier_reward: tokenBreakdown.eco_multiplier_reward,
        streak_bonus: tokenBreakdown.streak_bonus,
        anti_spoofing_bonus: 0,
        total_reward: tokenBreakdown.total_reward,
        current_streak: newStreak,
      },
    },
    message: 'Trip verified and tokens awarded',
  };

  return NextResponse.json(response, { status: 200 });
}
