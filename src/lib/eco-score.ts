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

import type { EcoProfile, TripTelemetrySummary } from "@/types/telematics";

// ── Geofence Sederhana ──────────────────────────────────────
// Bounding-box koridor tol Jakarta-Cikampek (approximate)
const HIGHWAY_GEOFENCE = {
	minLat: -6.45,
	maxLat: -6.1,
	minLng: 106.65,
	maxLng: 107.25,
	label: "Tol Jakarta – Cikampek",
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
	penaltyPerHarshBrake: 2.5, // ← 50% diskon (stop-and-go wajar)
	penaltyPerIdleMinute: 0.3, // ← 62.5% diskon (macet bukan salah driver)
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
			return "HIGHWAY_NORMAL";
		}
	}

	// Fallback: speed-based
	return input.averageSpeedKmh >= 40 ? "HIGHWAY_NORMAL" : "URBAN_RUSH_HOUR";
}

// ── Eco Score Result ────────────────────────────────────────
export interface EcoScoreResult {
	/** Final score (0 – 100, clamped) */
	score: number;
	/** Grade letter */
	grade: "A+" | "A" | "B" | "C" | "D";
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
function scoreToGrade(score: number): {
	grade: "A+" | "A" | "B" | "C" | "D";
	title: string;
} {
	if (score >= 95) return { grade: "A+", title: "Eco Master Champion 🏆" };
	if (score >= 85) return { grade: "A", title: "Excellent Eco Driver 🌿" };
	if (score >= 70) return { grade: "B", title: "Good Eco Driver ✓" };
	if (score >= 55) return { grade: "C", title: "Average Driver ⚠️" };
	return { grade: "D", title: "Needs Improvement 🔴" };
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
export function calculateEcoScore(
	input: CalculateEcoScoreInput,
): EcoScoreResult {
	const { telemetrySummary: ts, startTime } = input;

	// 1. Detect profile
	const profile =
		input.forceProfile ??
		detectProfile({
			averageSpeedKmh: ts.average_speed_kmh,
			avgLat: input.avgLat,
			avgLng: input.avgLng,
		});

	// 2. Select config
	let config: ScoreProfileConfig;
	let rushHourApplied = false;

	if (profile === "HIGHWAY_NORMAL") {
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
	const harshAccelPenalty =
		ts.harsh_accelerations * config.penaltyPerHarshAccel;
	const harshBrakePenalty = ts.harsh_brakings * config.penaltyPerHarshBrake;
	const idleMinutes = ts.idle_duration_seconds / 60;
	const idlePenalty = idleMinutes * config.penaltyPerIdleMinute;
	const gapPenalty = ts.interpolated_gaps * config.penaltyPerGap;

	// Overspeed penalty — applied if max speed exceeds profile limit
	const overspeedPenalty =
		ts.max_speed_kmh > config.speedLimitKmh
			? config.penaltyOverspeeding *
				Math.ceil((ts.max_speed_kmh - config.speedLimitKmh) / 10)
			: 0;

	// 4. Calculate bonus
	const isClean = ts.harsh_accelerations === 0 && ts.harsh_brakings === 0;
	const cleanDrivingBonus = isClean ? config.bonusCleanDriving : 0;

	// 5. Tally
	const totalPenalty =
		harshAccelPenalty +
		harshBrakePenalty +
		idlePenalty +
		gapPenalty +
		overspeedPenalty;
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
export function calculateTokenReward(
	input: TokenRewardInput,
): TokenRewardResult {
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
	const streakBonus =
		isStreakQualifying && newStreak > 0 && newStreak % 5 === 0 ? 50 : 0;

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
 * Estimasi CO₂ yang dihindari dibandingkan mobil bensin.
 *  Pembanding bensin : ~206 g CO₂/km (0.206 kg/km)
 *  Emisi EV          : (Wh/km ÷ 1000) × faktor emisi grid (kg CO₂/kWh)
 *
 * Faktor grid bersumber dari tabel `emission_factors` (berversi,
 * migrasi 012). Konstanta di bawah hanya fallback offline.
 *
 * ⚠️ GRID_EMISSION_FACTOR_FALLBACK_VERIFIED = false: nilai 0,87 kg CO₂/kWh
 * belum diverifikasi terhadap lampiran Kepmen ESDM 163.K/HK.02/MEM.S/2021
 * (sumber sekunder hanya menyebut kisaran 0,84–0,87 untuk Jamali).
 * Jangan dipakai di laporan ESG resmi sebelum diverifikasi.
 */
export const PETROL_EMISSION_KG_PER_KM = 0.206;
export const GRID_EMISSION_FACTOR_FALLBACK_KG_PER_KWH = 0.87;
export const GRID_EMISSION_FACTOR_FALLBACK_VERIFIED = false;
/** Konsumsi EV default (Wh/km) — BYD Atto 1 ≈ 13 kWh/100 km */
export const DEFAULT_EV_WH_PER_KM = 130;
export const MOTORCYCLE_PETROL_EMISSION_KG_PER_KM = 0.065;
export const DEFAULT_EV_MOTORCYCLE_WH_PER_KM = 35; // ~3.5 kWh / 100km (Gesits / Alva)
export const PERTALITE_EMISSION_FACTOR_KG_PER_LITER = 2.31; // IPCC / KLHK faktor emisi Pertalite RON 90
export const PERTALITE_PRICE_PER_LITER = 10000; // Harga resmi subsidi Pertalite (Rp/Liter)

export interface DynamicCO2SavingsInput {
	distanceKm: number;
	vehicleType?: "car" | "motorcycle";
	powertrain?: "ev" | "ice";
	fuelType?: "pertalite" | "pertamax" | "solar";
	fuelConsumptionKmPerL?: number;
	actualEnergyKwh?: number;
	ecoScore?: number;
	evWhPerKm?: number;
	gridKgPerKwh?: number;
}

export interface DynamicCO2SavingsResult {
	totalAvoidedKg: number;
	baseTransitionSavingsKg: number;
	habitBonusSavingsKg: number;
	fuelSavedLiters: number;
	treesEquivalent: number;
	petrolBaselineKgPerKm: number;
	evActualKgPerKm: number;
	actualWhPerKm: number;
	powertrain?: "ev" | "ice";
	fuelType?: string;
	rupiahSaved?: number;
	potentialEvTransitionSavingsKg?: number;
	fuelEfficiencyKmPerLiter?: number;
}

export function calculateDynamicCO2Savings(
	input: DynamicCO2SavingsInput,
): DynamicCO2SavingsResult {
	const {
		distanceKm,
		vehicleType = "car",
		powertrain = "ev",
		fuelType = "pertalite",
		fuelConsumptionKmPerL,
		actualEnergyKwh,
		ecoScore = 80,
		evWhPerKm,
		gridKgPerKwh,
	} = input;

	const isMotorcycle = vehicleType === "motorcycle";
	const grid = gridKgPerKwh ?? GRID_EMISSION_FACTOR_FALLBACK_KG_PER_KWH;

	// ── Cabang Kendaraan Bensin Konvensional (ICE / Yamaha X-Ride 115) ──
	if (powertrain === "ice") {
		const baseKmPerL = fuelConsumptionKmPerL ?? (isMotorcycle ? 42.0 : 14.0);
		const baselineLitersPerKm = 1 / baseKmPerL;
		const baselineEmissionKgPerKm =
			baselineLitersPerKm * PERTALITE_EMISSION_FACTOR_KG_PER_LITER;

		// Pengaruh Eco-Riding Habit terhadap efisiensi bensin Pertalite
		let actualLitersPerKm = baselineLitersPerKm;
		if (ecoScore >= 85) {
			// Eco-riding halus menghemat ~15% bensin
			actualLitersPerKm = baselineLitersPerKm * 0.85;
		} else if (ecoScore < 70) {
			// Gaya agresif (gas-rem mendadak) boros ~25%
			actualLitersPerKm = baselineLitersPerKm * 1.25;
		} else {
			const factor = 1 + ((80 - ecoScore) / 100) * 0.5;
			actualLitersPerKm = baselineLitersPerKm * factor;
		}

		const aggressiveLitersPerKm = baselineLitersPerKm * 1.25;
		const actualEmissionKgPerKm =
			actualLitersPerKm * PERTALITE_EMISSION_FACTOR_KG_PER_LITER;
		const aggressiveEmissionKgPerKm =
			aggressiveLitersPerKm * PERTALITE_EMISSION_FACTOR_KG_PER_LITER;

		// Emisi yang berhasil dicegah berkat Eco-Habit vs berkendara agresif
		const habitBonusSavingsKg = round2(
			Math.max(
				0,
				(aggressiveEmissionKgPerKm - actualEmissionKgPerKm) * distanceKm,
			),
		);
		const fuelSavedLiters = round2(
			Math.max(0, (aggressiveLitersPerKm - actualLitersPerKm) * distanceKm),
		);
		const rupiahSaved = Math.round(fuelSavedLiters * PERTALITE_PRICE_PER_LITER);
		const actualKmPerLiter = round2(1 / actualLitersPerKm);

		// Potensi emisi tambahan bila dikonversi ke motor listrik
		const evEquivalentKgPerKm = ((isMotorcycle ? 35 : 120) / 1000) * grid;
		const potentialEvTransitionSavingsKg = round2(
			Math.max(0, (actualEmissionKgPerKm - evEquivalentKgPerKm) * distanceKm),
		);

		const totalAvoidedKg = habitBonusSavingsKg;
		const treesEquivalent = round2(totalAvoidedKg / 21.77);

		return {
			totalAvoidedKg,
			baseTransitionSavingsKg: 0,
			habitBonusSavingsKg,
			fuelSavedLiters,
			treesEquivalent,
			petrolBaselineKgPerKm: round2(baselineEmissionKgPerKm),
			evActualKgPerKm: 0,
			actualWhPerKm: 0,
			powertrain: "ice",
			fuelType,
			rupiahSaved,
			potentialEvTransitionSavingsKg,
			fuelEfficiencyKmPerLiter: actualKmPerLiter,
		};
	}

	// ── Cabang Kendaraan Listrik (EV / BYD Atto 1 / Wuling / Gesits) ──
	const petrolBaseline = isMotorcycle
		? MOTORCYCLE_PETROL_EMISSION_KG_PER_KM
		: PETROL_EMISSION_KG_PER_KM;
	const baseWh =
		evWhPerKm ??
		(isMotorcycle ? DEFAULT_EV_MOTORCYCLE_WH_PER_KM : DEFAULT_EV_WH_PER_KM);

	// Konsumsi aktual per km (Wh/km) dari integrasi daya riil
	let actualWh = baseWh;
	if (typeof actualEnergyKwh === "number" && distanceKm > 0.05) {
		actualWh = (actualEnergyKwh / distanceKm) * 1000;
	} else if (ecoScore < 70) {
		// Pengemudi agresif tanpa data energi riil mengonsumsi ~20% lebih banyak
		actualWh = baseWh * 1.2;
	} else if (ecoScore >= 85) {
		// Pengemudi eco menghemat ~10% energi
		actualWh = baseWh * 0.9;
	}

	const evActualKgPerKm = (actualWh / 1000) * grid;
	const evBaseKgPerKm = (baseWh / 1000) * grid;
	const aggressiveEvKgPerKm = ((baseWh * 1.25) / 1000) * grid;

	const totalAvoidedKg = round2(
		Math.max(0, (petrolBaseline - evActualKgPerKm) * distanceKm),
	);
	const baseTransitionSavingsKg = round2(
		Math.max(0, (petrolBaseline - evBaseKgPerKm) * distanceKm),
	);
	// Penghematan ekstra berkat habit berkendara halus vs agresif
	const habitBonusSavingsKg = round2(
		Math.max(0, (aggressiveEvKgPerKm - evActualKgPerKm) * distanceKm),
	);

	const fuelSavedLiters = round2(totalAvoidedKg / 2.31);
	const treesEquivalent = round2(totalAvoidedKg / 21.77);

	return {
		totalAvoidedKg,
		baseTransitionSavingsKg,
		habitBonusSavingsKg,
		fuelSavedLiters,
		treesEquivalent,
		petrolBaselineKgPerKm: petrolBaseline,
		evActualKgPerKm: round2(evActualKgPerKm),
		actualWhPerKm: round2(actualWh),
		powertrain: "ev",
	};
}

export function calculateCO2Avoided(
	distanceKm: number,
	opts: { evWhPerKm?: number; gridKgPerKwh?: number } = {},
): number {
	const whPerKm = opts.evWhPerKm ?? DEFAULT_EV_WH_PER_KM;
	const grid = opts.gridKgPerKwh ?? GRID_EMISSION_FACTOR_FALLBACK_KG_PER_KWH;
	const evKgPerKm = (whPerKm / 1000) * grid;
	const avoided = (PETROL_EMISSION_KG_PER_KM - evKgPerKm) * distanceKm;
	return round2(avoided);
}

// ── Helpers ─────────────────────────────────────────────────
function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
