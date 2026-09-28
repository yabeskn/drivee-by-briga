// ─────────────────────────────────────────────────────────────
// /api/trips/verify — Backend API Route
//
// Response Schema (Data Schema Specification):
// {
//   trip_id, driver_id, vehicle_id, start_time, end_time,
//   profile_used, distance_km, telemetry_summary, eco_score,
//   tokens_earned, trip_hash, verification_status
// }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

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
  tokens_earned: number;
  esg_co2_avoided_kg: number;
  trip_hash: string;
  gps_points: Array<{
    lat: number;
    lng: number;
    timestamp: number;
    speed_kmh: number;
    accuracy: number;
  }>;
  photo_evidence: {
    start_odometer: string | null;
    start_battery: string | null;
    end_odometer: string | null;
    end_battery: string | null;
    captured_at: number;
    gps_location: { lat: number; lng: number } | null;
  };
}

// ── Response Schema (Data Schema Specification) ─────────────
interface TripVerifyResponse {
  // Mandatory keys
  trip_id: string;
  driver_id: string;
  vehicle_id: string;
  start_time: string;
  end_time: string;
  profile_used: string;
  distance_km: number;
  telemetry_summary: {
    harsh_accelerations: number;
    harsh_brakings: number;
    idle_duration_seconds: number;
    average_speed_kmh: number;
    max_speed_kmh: number;
    interpolated_gaps: number;
  };
  eco_score: number;
  tokens_earned: number;
  trip_hash: string;
  verification_status: 'VERIFIED' | 'REJECTED' | 'PENDING';
  // Bonus fields (for debugging)
  verification_details?: {
    osrm_matched: boolean;
    physics_check_passed: boolean;
    anti_spoofing_passed: boolean;
    gaps_interpolated: number;
    token_breakdown: {
      base_reward: number;
      eco_multiplier: number;
      multiplier_reward: number;
      streak_bonus: number;
      anti_spoofing_bonus: number;
      total_reward: number;
    };
  };
  message: string;
}

// ── Anti-Spoofing Validation ───────────────────────────────
function validatePhotoEvidence(photoEvidence: TripVerifyRequest['photo_evidence']): {
  valid: boolean;
  reason: string;
} {
  const { start_odometer, start_battery, end_odometer, end_battery, captured_at } = photoEvidence;

  if (!start_odometer || !start_battery || !end_odometer || !end_battery) {
    return { valid: false, reason: 'Missing photo evidence' };
  }

  const base64Regex = /^data:image\/(jpeg|jpg|png);base64,/;
  if (!base64Regex.test(start_odometer) || !base64Regex.test(start_battery) ||
      !base64Regex.test(end_odometer) || !base64Regex.test(end_battery)) {
    return { valid: false, reason: 'Invalid photo format' };
  }

  const maxSize = 1024 * 1024;
  if (start_odometer.length > maxSize || start_battery.length > maxSize ||
      end_odometer.length > maxSize || end_battery.length > maxSize) {
    return { valid: false, reason: 'Photo too large' };
  }

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - captured_at) > fiveMinutes) {
    return { valid: false, reason: 'Photo timestamp expired' };
  }

  return { valid: true, reason: 'Photo evidence valid' };
}

// ── Physics Sanity Check ───────────────────────────────────
function physicsSanityCheck(data: TripVerifyRequest): {
  passed: boolean;
  reason: string;
} {
  const { distance_km, energy_used_kwh, start_battery_soc, end_battery_soc, telemetry_summary } = data;

  if (distance_km > 500) {
    return { passed: false, reason: 'Distance exceeds maximum (500 km)' };
  }

  if (energy_used_kwh > 100) {
    return { passed: false, reason: 'Energy consumption exceeds maximum (100 kWh)' };
  }

  const socUsed = start_battery_soc - end_battery_soc;
  if (socUsed < 0) {
    return { passed: false, reason: 'Invalid SoC change (negative)' };
  }

  if (telemetry_summary.average_speed_kmh > 200) {
    return { passed: false, reason: 'Average speed exceeds maximum (200 km/h)' };
  }

  if (telemetry_summary.max_speed_kmh > 250) {
    return { passed: false, reason: 'Max speed exceeds maximum (250 km/h)' };
  }

  return { passed: true, reason: 'Physics check passed' };
}

// ── Token Calculation ──────────────────────────────────────
function calculateTokens(data: TripVerifyRequest, antiSpoofingValid: boolean): {
  base_reward: number;
  eco_multiplier: number;
  multiplier_reward: number;
  streak_bonus: number;
  anti_spoofing_bonus: number;
  total_reward: number;
} {
  const { distance_km, eco_score } = data;

  const base_reward = distance_km >= 15 ? 10 : 5;

  let eco_multiplier = 0.5;
  if (eco_score >= 90) eco_multiplier = 2.0;
  else if (eco_score >= 80) eco_multiplier = 1.5;
  else if (eco_score >= 70) eco_multiplier = 1.0;

  const multiplier_reward = Math.round(base_reward * eco_multiplier);
  const streak_bonus = 0;
  const anti_spoofing_bonus = antiSpoofingValid ? 10 : 0;
  const total_reward = base_reward + multiplier_reward + streak_bonus + anti_spoofing_bonus;

  return {
    base_reward,
    eco_multiplier,
    multiplier_reward,
    streak_bonus,
    anti_spoofing_bonus,
    total_reward,
  };
}

// ── OSRM Map Matching (Simplified) ─────────────────────────
function osrmMapMatching(gpsPoints: TripVerifyRequest['gps_points']): {
  matched: boolean;
  matched_route: [number, number][] | null;
  gaps_interpolated: number;
} {
  if (gpsPoints.length < 2) {
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
  try {
    const data: TripVerifyRequest = await request.json();

    // 1. Validate photo evidence (anti-spoofing)
    const photoValidation = validatePhotoEvidence(data.photo_evidence);
    if (!photoValidation.valid) {
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
        tokens_earned: 0,
        trip_hash: data.trip_hash,
        verification_status: 'REJECTED',
        verification_details: {
          osrm_matched: false,
          physics_check_passed: false,
          anti_spoofing_passed: false,
          gaps_interpolated: 0,
          token_breakdown: {
            base_reward: 0,
            eco_multiplier: 0,
            multiplier_reward: 0,
            streak_bonus: 0,
            anti_spoofing_bonus: 0,
            total_reward: 0,
          },
        },
        message: `Anti-spoofing failed: ${photoValidation.reason}`,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 2. Physics sanity check
    const physicsCheck = physicsSanityCheck(data);
    if (!physicsCheck.passed) {
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
        tokens_earned: 0,
        trip_hash: data.trip_hash,
        verification_status: 'REJECTED',
        verification_details: {
          osrm_matched: false,
          physics_check_passed: false,
          anti_spoofing_passed: true,
          gaps_interpolated: 0,
          token_breakdown: {
            base_reward: 0,
            eco_multiplier: 0,
            multiplier_reward: 0,
            streak_bonus: 0,
            anti_spoofing_bonus: 0,
            total_reward: 0,
          },
        },
        message: `Physics check failed: ${physicsCheck.reason}`,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 3. OSRM map matching
    const osrmResult = osrmMapMatching(data.gps_points);

    // 4. Calculate tokens
    const tokenBreakdown = calculateTokens(data, true);

    // 5. Build response (Data Schema Specification)
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
      tokens_earned: tokenBreakdown.total_reward,
      trip_hash: data.trip_hash,
      verification_status: 'VERIFIED',
      verification_details: {
        osrm_matched: osrmResult.matched,
        physics_check_passed: true,
        anti_spoofing_passed: true,
        gaps_interpolated: osrmResult.gaps_interpolated,
        token_breakdown: tokenBreakdown,
      },
      message: 'Trip verified and tokens awarded',
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[API] Trip verification error:', error);
    const response: TripVerifyResponse = {
      trip_id: '',
      driver_id: '',
      vehicle_id: '',
      start_time: '',
      end_time: '',
      profile_used: '',
      distance_km: 0,
      telemetry_summary: {
        harsh_accelerations: 0,
        harsh_brakings: 0,
        idle_duration_seconds: 0,
        average_speed_kmh: 0,
        max_speed_kmh: 0,
        interpolated_gaps: 0,
      },
      eco_score: 0,
      tokens_earned: 0,
      trip_hash: '',
      verification_status: 'REJECTED',
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    return NextResponse.json(response, { status: 500 });
  }
}
