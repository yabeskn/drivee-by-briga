// ─────────────────────────────────────────────────────────────
// eco-score.ts
// Eco Score Calculator — Dual-Profile Engine
//
// Dua profil skoring:
//   HIGHWAY_NORMAL    — koridor tol, avg speed ≥ 40 km/h
//   URBAN_RUSH_HOUR   — rute kota, avg speed < 40 km/h
//
// Rush-hour window (WIB):
//   Pagi : 06:00 – 09:00
//   Sore : 16:00 – 20:00
//   → Saat rush hour pada profil URBAN, penalti idle & harsh
//     brake diturunkan karena kondisi lalu lintas tak terkendali.
// ─────────────────────────────────────────────────────────────

import type { EcoProfile, TripTelemetrySummary } from '@/types/telematics';

// ── Geofence Sederhana ──────────────────────────────────────
// Bounding-box koridor tol Jakarta-Cikampek (approximate)
const HIGHWAY_GEOFENCE = {
  minLat: -6.45,
  maxLat: -6.10,
  minLng: 106.65,
  maxLng: 107.25,
  label: 'Tol Jakarta – Cikampek',
};

// ── Score Profile Configurations ────────────────────────────
interface ScoreProfileConfig {
  /** Base score (100 = perfect) */
  baseScore: number;
  /** Penalty per harsh acceleration event */
  penaltyPerHarshAccel: number;
  /** Penalty per harsh braking event */
  penaltyPerHarshBrake: number;
  /** Penalty per minute of idle duration */
  penaltyPerIdleMinute: number;
  /** Bonus for having zero harsh events */
  bonusCleanDriving: number;
  /** Penalty per interpolation gap (GPS loss) */
  penaltyPerGap: number;
  /** Penalty for overspeeding (max > limit) */
  penaltyOverspeeding: number;
  /** Speed limit for this profile (km/h) */
  speedLimitKmh: number;
}

const HIGHWAY_CONFIG: ScoreProfileConfig = {
  baseScore: 100,
  penaltyPerHarshAccel: 5,
  penaltyPerHarshBrake: 7,
  penaltyPerIdleMinute: 1.5,
  bonusCleanDriving: 3,
  penaltyPerGap: 2,
  penaltyOverspeeding: 4,
  speedLimitKmh: 100,
};

const URBAN_CONFIG: ScoreProfileConfig = {
  baseScore: 100,
  penaltyPerHarshAccel: 4,
  penaltyPerHarshBrake: 5,
  penaltyPerIdleMinute: 0.8,
  bonusCleanDriving: 5,
  penaltyPerGap: 2,
  penaltyOverspeeding: 6,
  speedLimitKmh: 60,
};

// Rush-hour discounted config — penalti diturunkan
const URBAN_RUSH_HOUR_CONFIG: ScoreProfileConfig = {
  ...URBAN_CONFIG,
  penaltyPerHarshBrake: 2.5,    // ← 50% diskon (stop-and-go wajar)
  penaltyPerIdleMinute: 0.3,    // ← 62.5% diskon (macet bukan salah driver)
};

// ── Rush Hour Detection ─────────────────────────────────────
/**
 * Cek apakah timestamp berada di dalam jam sibuk WIB.
 *  Pagi : 06:00 – 09:00
 *  Sore : 16:00 – 20:00
 */
export function isRushHour(isoTimestamp: string): boolean {
  const date = new Date(isoTimestamp);
  // Konversi ke WIB (UTC+7)
  const utcHour = date.getUTCHours();
  const wibHour = (utcHour + 7) % 24;
  return (wibHour >= 6 && wibHour < 9) || (wibHour >= 16 && wibHour < 20);
}

// ── Profile Detection ───────────────────────────────────────
export interface ProfileDetectionInput {
  averageSpeedKmh: number;
  /** Optional: average lat/lng of the trip for geofence check */
  avgLat?: number;
  avgLng?: number;
}

/**
 * Deteksi profil berdasarkan:
 *  1. Geofence — jika posisi rata-rata berada di bounding-box tol → HIGHWAY
 *  2. Kecepatan rata-rata — ≥ 40 km/h → HIGHWAY, < 40 → URBAN
 */
export function detectProfile(input: ProfileDetectionInput): EcoProfile {
  // Check geofence first
  if (input.avgLat != null && input.avgLng != null) {
    const inHwyBox =
      input.avgLat >= HIGHWAY_GEOFENCE.minLat &&
      input.avgLat <= HIGHWAY_GEOFENCE.maxLat &&
      input.avgLng >= HIGHWAY_GEOFENCE.minLng &&
      input.avgLng <= HIGHWAY_GEOFENCE.maxLng;

    if (inHwyBox && input.averageSpeedKmh >= 35) {
      return 'HIGHWAY_NORMAL';
    }
  }

  // Fallback: speed-based
  return input.averageSpeedKmh >= 40 ? 'HIGHWAY_NORMAL' : 'URBAN_RUSH_HOUR';
}

// ── Eco Score Result ────────────────────────────────────────
export interface EcoScoreResult {
  /** Final score (0 – 100, clamped) */
  score: number;
  /** Grade letter */
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  /** Human-readable grade title */
  gradeTitle: string;
  /** Profile that was used for scoring */
  profileUsed: EcoProfile;
  /** Whether rush-hour discounts were applied */
  rushHourApplied: boolean;
  /** Itemised breakdown of penalties and bonuses */
  breakdown: EcoScoreBreakdown;
}

export interface EcoScoreBreakdown {
  baseScore: number;
  harshAccelPenalty: number;
  harshBrakePenalty: number;
  idlePenalty: number;
  gapPenalty: number;
  overspeedPenalty: number;
  cleanDrivingBonus: number;
  totalPenalty: number;
  totalBonus: number;
  finalScore: number;
}

// ── Grade Mapping ───────────────────────────────────────────
function scoreToGrade(score: number): { grade: 'A+' | 'A' | 'B' | 'C' | 'D'; title: string } {
  if (score >= 95) return { grade: 'A+', title: 'Eco Master Champion 🏆' };
  if (score >= 85) return { grade: 'A', title: 'Excellent Eco Driver 🌿' };
  if (score >= 70) return { grade: 'B', title: 'Good Eco Driver ✓' };
  if (score >= 55) return { grade: 'C', title: 'Average Driver ⚠️' };
  return { grade: 'D', title: 'Needs Improvement 🔴' };
}

// ── Main Calculation ────────────────────────────────────────
export interface CalculateEcoScoreInput {
  telemetrySummary: TripTelemetrySummary;
  /** ISO timestamp of trip start — used for rush-hour detection */
  startTime: string;
  /** Force a specific profile, or auto-detect */
  forceProfile?: EcoProfile;
  /** Average lat/lng of the trip (for geofence-based profile detection) */
  avgLat?: number;
  avgLng?: number;
}

/**
 * Kalkulasi Eco Score utama.
 *
 * Alur:
 *  1. Deteksi profil (HIGHWAY vs URBAN) dari avg speed / geofence
 *  2. Pilih config penalti sesuai profil
 *  3. Jika URBAN + jam sibuk → gunakan config rush-hour (penalti diturunkan)
 *  4. Hitung penalti per kategori
 *  5. Tambahkan bonus clean driving
 *  6. Clamp 0–100
 *  7. Map ke grade letter
 */
export function calculateEcoScore(input: CalculateEcoScoreInput): EcoScoreResult {
  const { telemetrySummary: ts, startTime } = input;

  // 1. Detect profile
  const profile = input.forceProfile ?? detectProfile({
    averageSpeedKmh: ts.average_speed_kmh,
    avgLat: input.avgLat,
    avgLng: input.avgLng,
  });

  // 2. Select config
  let config: ScoreProfileConfig;
  let rushHourApplied = false;

  if (profile === 'HIGHWAY_NORMAL') {
    config = HIGHWAY_CONFIG;
  } else {
    // Urban — check rush hour
    if (isRushHour(startTime)) {
      config = URBAN_RUSH_HOUR_CONFIG;
      rushHourApplied = true;
    } else {
      config = URBAN_CONFIG;
    }
  }

  // 3. Calculate penalties
  const harshAccelPenalty = ts.harsh_accelerations * config.penaltyPerHarshAccel;
  const harshBrakePenalty = ts.harsh_brakings * config.penaltyPerHarshBrake;
  const idleMinutes = ts.idle_duration_seconds / 60;
  const idlePenalty = idleMinutes * config.penaltyPerIdleMinute;
  const gapPenalty = ts.interpolated_gaps * config.penaltyPerGap;

  // Overspeed penalty — applied if max speed exceeds profile limit
  const overspeedPenalty = ts.max_speed_kmh > config.speedLimitKmh
    ? config.penaltyOverspeeding * Math.ceil((ts.max_speed_kmh - config.speedLimitKmh) / 10)
    : 0;

  // 4. Calculate bonus
  const isClean = ts.harsh_accelerations === 0 && ts.harsh_brakings === 0;
  const cleanDrivingBonus = isClean ? config.bonusCleanDriving : 0;

  // 5. Tally
  const totalPenalty = harshAccelPenalty + harshBrakePenalty + idlePenalty + gapPenalty + overspeedPenalty;
  const totalBonus = cleanDrivingBonus;
  const rawScore = config.baseScore - totalPenalty + totalBonus;
  const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  // 6. Grade
  const { grade, title } = scoreToGrade(finalScore);

  const breakdown: EcoScoreBreakdown = {
    baseScore: config.baseScore,
    harshAccelPenalty: round2(harshAccelPenalty),
    harshBrakePenalty: round2(harshBrakePenalty),
    idlePenalty: round2(idlePenalty),
    gapPenalty: round2(gapPenalty),
    overspeedPenalty: round2(overspeedPenalty),
    cleanDrivingBonus: round2(cleanDrivingBonus),
    totalPenalty: round2(totalPenalty),
    totalBonus: round2(totalBonus),
    finalScore,
  };

  return {
    score: finalScore,
    grade,
    gradeTitle: title,
    profileUsed: profile,
    rushHourApplied,
    breakdown,
  };
}

// ── Token Reward Calculation ────────────────────────────────
export interface TokenRewardInput {
  ecoScore: number;
  distanceKm: number;
  currentStreak: number; // consecutive trips with score ≥ 85
}

export interface TokenRewardResult {
  baseReward: number;
  ecoMultiplier: number;
  multiplierReward: number;
  streakBonus: number;
  totalReward: number;
  newStreak?: number;
  isStreakQualifying?: boolean;
}

/**
 * Kalkulasi BrigaCoins reward (ORIGINAL_REQUEST.md / PRD Section 3.1).
 *  - Base Reward = distance_km * 10
 *  - Eco Multiplier = (eco_score / 100) * 0.5 * Base Reward
 *  - Streak Bonus = +50 every 5th consecutive trip with eco_score >= 85
 *  - Total = Math.round(base_reward + multiplier_reward + streak_bonus)
 */
export function calculateTokenReward(input: TokenRewardInput): TokenRewardResult {
  const { ecoScore, distanceKm, currentStreak } = input;

  // Base reward: 10 coins per km
  const baseReward = distanceKm * 10;

  // Eco multiplier: (eco_score / 100) * 0.5 * Base
  const clampedEco = Math.max(0, Math.min(100, ecoScore));
  const ecoMultiplier = (clampedEco / 100) * 0.5;
  const multiplierReward = ecoMultiplier * baseReward;

  // Streak logic: Qualifying trip requires eco_score >= 85
  const isStreakQualifying = ecoScore >= 85;
  const newStreak = isStreakQualifying ? currentStreak + 1 : 0;

  // Streak bonus: +50 on every 5th consecutive qualifying trip (5, 10, 15, ...)
  const streakBonus = isStreakQualifying && newStreak > 0 && newStreak % 5 === 0 ? 50 : 0;

  const totalReward = Math.round(baseReward + multiplierReward + streakBonus);

  return {
    baseReward,
    ecoMultiplier,
    multiplierReward,
    streakBonus,
    totalReward,
    newStreak,
    isStreakQualifying,
  };
}

// ── ESG CO₂ Calculation ─────────────────────────────────────
/**
 * Estimasi CO₂ yang dihindari dibandingkan van diesel.
 *  Asumsi diesel van: 160g CO₂/km
 *  Asumsi EV (grid Indonesia): ~0g langsung + ~40g/km dari pembangkit
 *  Net avoided = 120g/km = 0.12 kg/km
 */
export function calculateCO2Avoided(distanceKm: number): number {
  const DIESEL_EMISSION_KG_PER_KM = 0.160;
  const EV_GRID_EMISSION_KG_PER_KM = 0.040;
  const avoided = (DIESEL_EMISSION_KG_PER_KM - EV_GRID_EMISSION_KG_PER_KM) * distanceKm;
  return round2(avoided);
}

// ── Helpers ─────────────────────────────────────────────────
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
