/**
 * Authoritative Test Oracle derived strictly from:
 * - ORIGINAL_REQUEST.md § Acceptance Criteria
 * - PROJECT.md § Architecture, Feature Inventory, Interface Contracts
 *
 * Mathematical & Behavioral Specifications:
 * 1. Base Reward = distance_km * 10
 * 2. Eco Multiplier Reward = (eco_score / 100) * 0.5 * Base Reward
 * 3. Streak Bonus = +50 every 5th consecutive trip where eco_score >= 85
 * 4. Physics Validation:
 *    - Speed must not exceed 160 km/h (max_speed <= 160, avg_speed <= 160)
 *    - Energy used must be non-negative (energy_used_kwh >= 0)
 *    - Distance must be non-negative and <= 500 km
 *    - Duration must be positive (start_time < end_time)
 */

import { createHash } from 'node:crypto';

export interface TokenCalculationInput {
  distance_km: number;
  eco_score: number;
  current_streak: number; // streak prior to this trip
}

export interface TokenCalculationBreakdown {
  base_reward: number;
  eco_multiplier_reward: number;
  streak_bonus: number;
  total_tokens: number;
  new_streak: number;
  is_streak_qualifying: boolean;
}

/**
 * Authoritative Token Reward Calculation Oracle
 * Formula:
 *   Base = distance_km * 10
 *   Eco Multiplier = (eco_score / 100) * 0.5 * Base
 *   Streak Bonus = +50 every 5th consecutive trip with eco_score >= 85
 */
export function calculateExpectedTokens(input: TokenCalculationInput): TokenCalculationBreakdown {
  const { distance_km, eco_score, current_streak } = input;

  // Base reward: 10 coins per km
  const base_reward = distance_km * 10;

  // Continuous Eco Multiplier: (eco_score / 100) * 0.5 * Base
  const clamped_eco = Math.max(0, Math.min(100, eco_score));
  const eco_multiplier_reward = (clamped_eco / 100) * 0.5 * base_reward;

  // Streak logic:
  // Qualifying trip requires eco_score >= 85
  const is_streak_qualifying = eco_score >= 85;
  const new_streak = is_streak_qualifying ? current_streak + 1 : 0;

  // Streak bonus: +50 on every 5th consecutive qualifying trip (5, 10, 15, ...)
  const streak_bonus = is_streak_qualifying && new_streak > 0 && new_streak % 5 === 0 ? 50 : 0;

  const total_tokens = base_reward + eco_multiplier_reward + streak_bonus;

  return {
    base_reward,
    eco_multiplier_reward,
    streak_bonus,
    total_tokens,
    new_streak,
    is_streak_qualifying,
  };
}

export interface PhysicsCheckResult {
  passed: boolean;
  violations: string[];
}

export interface TripPhysicsInput {
  distance_km: number;
  energy_used_kwh: number;
  average_speed_kmh?: number;
  max_speed_kmh?: number;
  start_time: string;
  end_time: string;
  start_battery_soc?: number;
  end_battery_soc?: number;
  gps_points?: Array<{ speed_kmh: number; timestamp?: number }>;
}

/**
 * Authoritative Physics Validation Oracle
 * Rules per PROJECT.md and ORIGINAL_REQUEST.md:
 * - Speed <= 160 km/h
 * - Energy used >= 0 kWh
 * - Distance >= 0 km and <= 500 km
 * - Duration > 0 seconds
 * - Valid battery SOC change
 */
export function validateExpectedPhysics(input: TripPhysicsInput): PhysicsCheckResult {
  const violations: string[] = [];

  // Speed checks (Threshold: 160 km/h)
  const MAX_SPEED_THRESHOLD = 160;
  if (input.max_speed_kmh !== undefined && input.max_speed_kmh > MAX_SPEED_THRESHOLD) {
    violations.push(`Max speed ${input.max_speed_kmh} km/h exceeds maximum threshold of ${MAX_SPEED_THRESHOLD} km/h`);
  }
  if (input.average_speed_kmh !== undefined && input.average_speed_kmh > MAX_SPEED_THRESHOLD) {
    violations.push(`Average speed ${input.average_speed_kmh} km/h exceeds maximum threshold of ${MAX_SPEED_THRESHOLD} km/h`);
  }
  if (input.gps_points && input.gps_points.length > 0) {
    const excessiveGps = input.gps_points.find(p => p.speed_kmh > MAX_SPEED_THRESHOLD);
    if (excessiveGps) {
      violations.push(`GPS point speed ${excessiveGps.speed_kmh} km/h exceeds maximum threshold of ${MAX_SPEED_THRESHOLD} km/h`);
    }
  }

  // Energy checks
  if (input.energy_used_kwh < 0) {
    violations.push(`Energy used ${input.energy_used_kwh} kWh cannot be negative`);
  }
  if (input.energy_used_kwh > 100) {
    violations.push(`Energy used ${input.energy_used_kwh} kWh exceeds maximum capacity threshold (100 kWh)`);
  }

  // Distance checks
  if (input.distance_km < 0) {
    violations.push(`Distance ${input.distance_km} km cannot be negative`);
  }
  if (input.distance_km > 500) {
    violations.push(`Distance ${input.distance_km} km exceeds maximum trip limit (500 km)`);
  }

  // Timestamp & Duration checks
  const startMs = new Date(input.start_time).getTime();
  const endMs = new Date(input.end_time).getTime();
  if (isNaN(startMs) || isNaN(endMs)) {
    violations.push('Invalid ISO-8601 timestamp for start_time or end_time');
  } else if (endMs <= startMs) {
    violations.push(`Trip end_time (${input.end_time}) must be strictly after start_time (${input.start_time})`);
  }

  // Battery SOC checks
  if (input.start_battery_soc !== undefined && input.end_battery_soc !== undefined) {
    if (input.start_battery_soc < 0 || input.start_battery_soc > 100 || input.end_battery_soc < 0 || input.end_battery_soc > 100) {
      violations.push('Battery SOC percentage must be within 0 - 100 range');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Deterministic SHA-256 canonical hash computation for trips
 */
export function computeCanonicalTripHash(payload: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(payload).sort()) {
    const val = payload[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      sorted[key] = computeCanonicalTripHash(val as Record<string, unknown>);
    } else {
      sorted[key] = val;
    }
  }
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
