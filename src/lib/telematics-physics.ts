// ─────────────────────────────────────────────────────────────
// telematics-physics.ts
// Logika murni telematika EV (tanpa React) — dipakai oleh
// useTelematics (jalur GPS & mock) dan unit test Vitest.
// ─────────────────────────────────────────────────────────────

import type { DrivingStatus } from "@/types/telematics";

// ── Konstanta fisika & ambang ───────────────────────────────
export const GRAVITY = 9.81; // m/s²
export const AIR_DENSITY = 1.2; // kg/m³

export const HARSH_ACCEL_THRESHOLD = 2.5; // m/s²
export const HARSH_BRAKE_THRESHOLD = -3.0; // m/s²

/** dt valid untuk akselerasi longitudinal: 0 < dt <= 10 detik */
export const MAX_ACCEL_DT_SEC = 10;
/** Maksimum detik per gap untuk idle & integrasi SoC */
export const MAX_ENERGY_DT_SEC = 30;
/** Batas clamp akselerasi untuk model daya (m/s²) */
const ACCEL_CLAMP = 4;

// ── Profil EV ───────────────────────────────────────────────
export interface EvProfile {
	id: string;
	/** Massa kendaraan (kg) */
	massKg: number;
	/** Cd·A (m²) */
	cdA: number;
	/** Koefisien hambatan gelinding */
	crr: number;
	/** Efisiensi drivetrain baterai→roda */
	etaDrive: number;
	/** Efisiensi regenerasi roda→baterai */
	etaRegen: number;
	/** Beban auxiliary konstan (kW): HVAC/ECU/kelistrikan */
	auxKw: number;
	/** Batas daya regen ke baterai (kW) */
	maxRegenKw: number;
	/** Kapasitas baterai (kWh) jika kendaraan listrik */
	batteryCapacityKwh?: number;
	/** Tipe kendaraan untuk baseline emisi */
	vehicleType?: "car" | "motorcycle";
	/** Powertrain: EV atau Mesin Bensin (ICE) */
	powertrain?: "ev" | "ice";
	/** Jenis bahan bakar untuk kendaraan bensin */
	fuelType?: "pertalite" | "pertamax" | "solar";
	/** Baseline konsumsi BBM km/Liter (misal 42 km/L untuk X-Ride 115) */
	fuelConsumptionKmPerL?: number;
}

export type EvProfileId =
	| "byd_atto1"
	| "yamaha_xride_115"
	| "vinfast_vfe34"
	| "byd_m6"
	| "wuling_air_ev"
	| "hyundai_ioniq_5"
	| "gesits_g1"
	| "alva_cervo";

export const EV_PROFILES: Record<EvProfileId, EvProfile> = {
	byd_atto1: {
		id: "byd_atto1",
		massKg: 1400,
		cdA: 0.65,
		crr: 0.01,
		etaDrive: 0.88,
		etaRegen: 0.65,
		auxKw: 1.0,
		maxRegenKw: 30,
		batteryCapacityKwh: 30.08,
		vehicleType: "car",
		powertrain: "ev",
	},
	yamaha_xride_115: {
		id: "yamaha_xride_115",
		massKg: 173, // 98 kg motor + 75 kg rider
		cdA: 0.38,
		crr: 0.018,
		etaDrive: 0.25,
		etaRegen: 0.0,
		auxKw: 0.04,
		maxRegenKw: 0,
		vehicleType: "motorcycle",
		powertrain: "ice",
		fuelType: "pertalite",
		fuelConsumptionKmPerL: 42.0,
	},
	vinfast_vfe34: {
		id: "vinfast_vfe34",
		massKg: 1690,
		cdA: 0.72,
		crr: 0.011,
		etaDrive: 0.88,
		etaRegen: 0.6,
		auxKw: 1.2,
		maxRegenKw: 40,
		vehicleType: "car",
	},
	byd_m6: {
		id: "byd_m6",
		massKg: 1750,
		cdA: 0.8,
		crr: 0.011,
		etaDrive: 0.88,
		etaRegen: 0.6,
		auxKw: 1.3,
		maxRegenKw: 50,
		vehicleType: "car",
	},
	wuling_air_ev: {
		id: "wuling_air_ev",
		massKg: 860,
		cdA: 0.55,
		crr: 0.012,
		etaDrive: 0.87,
		etaRegen: 0.55,
		auxKw: 0.6,
		maxRegenKw: 20,
		vehicleType: "car",
	},
	hyundai_ioniq_5: {
		id: "hyundai_ioniq_5",
		massKg: 1950,
		cdA: 0.7,
		crr: 0.01,
		etaDrive: 0.9,
		etaRegen: 0.7,
		auxKw: 1.2,
		maxRegenKw: 60,
		vehicleType: "car",
	},
	gesits_g1: {
		id: "gesits_g1",
		massKg: 170, // 95 kg motor + 75 kg rider
		cdA: 0.38,
		crr: 0.018,
		etaDrive: 0.85,
		etaRegen: 0.45,
		auxKw: 0.05,
		maxRegenKw: 2,
		vehicleType: "motorcycle",
	},
	alva_cervo: {
		id: "alva_cervo",
		massKg: 210, // 135 kg motor + 75 kg rider
		cdA: 0.4,
		crr: 0.018,
		etaDrive: 0.86,
		etaRegen: 0.5,
		auxKw: 0.06,
		maxRegenKw: 3,
		vehicleType: "motorcycle",
	},
};

export const DEFAULT_EV_PROFILE: EvProfileId = "byd_atto1";

export function resolveEvProfile(p?: EvProfileId | EvProfile): EvProfile {
	if (!p) return EV_PROFILES[DEFAULT_EV_PROFILE];
	return typeof p === "string" ? EV_PROFILES[p] : p;
}

// ── Waktu & akselerasi nyata ────────────────────────────────
/**
 * dt (detik) antara dua sampel. Mengembalikan null bila tidak valid
 * (tidak ada sampel sebelumnya, dt <= 0, atau dt > 10 detik).
 */
export function validAccelDtSec(
	prevTimeMs: number | null | undefined,
	nowMs: number,
): number | null {
	if (prevTimeMs == null) return null;
	const dt = (nowMs - prevTimeMs) / 1000;
	return dt > 0 && dt <= MAX_ACCEL_DT_SEC ? dt : null;
}

/**
 * Akselerasi longitudinal = Δv/Δt nyata (m/s²).
 * null bila dt tidak valid — BUKAN 0, supaya tidak menyamar sebagai
 * "akselerasi nol" (kecepatan konstan).
 */
export function longitudinalAccel(
	speedKmh: number,
	prevSpeedKmh: number,
	dtSec: number | null,
): number | null {
	if (dtSec == null || !(dtSec > 0) || dtSec > MAX_ACCEL_DT_SEC) return null;
	return (speedKmh - prevSpeedKmh) / 3.6 / dtSec;
}

// ── Model daya road-load ────────────────────────────────────
/**
 * Daya baterai (kW, positif = konsumsi, negatif = regen).
 *   P_roda = v·(m·a + m·g·Crr + ½·ρ·CdA·v²)   [W]  → /1000 = kW
 *   P_roda ≥ 0: P_batt = P_roda/etaDrive + aux
 *   P_roda < 0: P_batt = max(P_roda·etaRegen, -maxRegen) + aux
 */
export function estimatePowerKw(
	profile: EvProfile,
	speedKmh: number,
	accelMps2: number,
): number {
	const v = Math.max(0, speedKmh) / 3.6;
	const a = Math.max(-ACCEL_CLAMP, Math.min(ACCEL_CLAMP, accelMps2));
	const wheelW =
		v *
		(profile.massKg * a +
			profile.massKg * GRAVITY * profile.crr +
			0.5 * AIR_DENSITY * profile.cdA * v * v);
	const wheelKw = wheelW / 1000;
	const batteryKw =
		wheelKw >= 0
			? wheelKw / profile.etaDrive
			: Math.max(wheelKw * profile.etaRegen, -profile.maxRegenKw);
	return Math.round((batteryKw + profile.auxKw) * 100) / 100;
}

/**
 * SoC berikutnya (%), TIDAK dibulatkan — pembulatan per langkah membuang
 * delta kecil (<0.05%) pada sampel 1 Hz. Bulatkan hanya saat ditampilkan.
 * Kembali ke prevSoc bila melewati 0/100.
 */
export function nextSoc(
	prevSoc: number,
	powerKw: number,
	dtSec: number,
	capacityKwh: number,
): number {
	if (!capacityKwh || capacityKwh <= 0) return prevSoc;
	const deltaSoc = (powerKw * (dtSec / 3600) * 100) / capacityKwh;
	const candidate = prevSoc - deltaSoc;
	if (candidate < 0 || candidate > 100) return prevSoc;
	return candidate;
}

// ── Klasifikasi ─────────────────────────────────────────────
export function classifyDriving(
	speedKmh: number,
	accelMps2: number,
): { status: DrivingStatus; msg: string } {
	if (speedKmh === 0) return { status: "idle", msg: "Idle / Macet ⏳" };
	if (accelMps2 > HARSH_ACCEL_THRESHOLD) {
		return {
			status: "harsh_accel",
			msg: `Harsh Acceleration ⚠️ (+${accelMps2.toFixed(1)} m/s²)`,
		};
	}
	if (accelMps2 < HARSH_BRAKE_THRESHOLD) {
		return {
			status: "sudden_brake",
			msg: `Pengereman Mendadak 🛑 (${accelMps2.toFixed(1)} m/s²)`,
		};
	}
	return { status: "smooth", msg: "Smooth Driving 🌿" };
}

// ── Engine stateful ─────────────────────────────────────────
export interface EngineConfig {
	profile?: EvProfileId | EvProfile;
	batteryCapacityKwh?: number;
	initialSoc?: number;
}

export interface EngineSample {
	timestampMs: number;
	speedKmh: number;
}

export interface EngineResult {
	status: DrivingStatus;
	statusMessage: string;
	/** Δv/Δt nyata; null bila dt tidak valid */
	accelMps2: number | null;
	dtSec: number | null;
	powerKw: number;
	soc: number | null;
	harshAccelCount: number;
	harshBrakeCount: number;
	idleDurationSec: number;
}

/**
 * Engine per-sampel. Satu instance per trip; dipakai bersama jalur GPS
 * dan mock sehingga logika (dt nyata, harsh per kejadian, idle, SoC)
 * identik di keduanya.
 */
export class TelematicsEngine {
	private readonly profile: EvProfile;
	private readonly capacityKwh?: number;
	private prevTimeMs: number | null = null;
	private prevSpeedKmh = 0;
	private prevStatus: DrivingStatus = "smooth";
	soc: number | null;
	harshAccelCount = 0;
	harshBrakeCount = 0;
	idleDurationSec = 0;
	/** Energi netto terintegrasi (kWh, regen mengurangi) */
	energyKwh = 0;
	distanceKm = 0;

	constructor(cfg: EngineConfig = {}) {
		this.profile = resolveEvProfile(cfg.profile);
		this.capacityKwh = cfg.batteryCapacityKwh;
		this.soc = typeof cfg.initialSoc === "number" ? cfg.initialSoc : null;
	}

	ingest(sample: EngineSample): EngineResult {
		const { timestampMs: now, speedKmh } = sample;

		// Ambil prev SEBELUM di-update
		const prevTime = this.prevTimeMs;
		const rawDtSec = prevTime == null ? 0 : (now - prevTime) / 1000;
		const dtSec = validAccelDtSec(prevTime, now);
		const accel = longitudinalAccel(speedKmh, this.prevSpeedKmh, dtSec);
		const energyDtSec = Math.min(Math.max(rawDtSec, 0), MAX_ENERGY_DT_SEC);

		const { status, msg } = classifyDriving(speedKmh, accel ?? 0);

		// Harsh: hitung hanya saat MASUK status harsh
		if (status !== this.prevStatus) {
			if (status === "harsh_accel") this.harshAccelCount += 1;
			if (status === "sudden_brake") this.harshBrakeCount += 1;
		}
		this.prevStatus = status;

		// Idle memakai dt nyata (maks 30 dtk per gap)
		if (speedKmh < 1) this.idleDurationSec += energyDtSec;

		// Daya & SoC memakai dt nyata
		const powerKw = estimatePowerKw(this.profile, speedKmh, accel ?? 0);
		if (energyDtSec > 0) {
			this.energyKwh += (powerKw * energyDtSec) / 3600;
			this.distanceKm += (speedKmh * energyDtSec) / 3600;
			if (this.capacityKwh && this.capacityKwh > 0 && this.soc != null) {
				this.soc = nextSoc(this.soc, powerKw, energyDtSec, this.capacityKwh);
			}
		}

		this.prevTimeMs = now;
		this.prevSpeedKmh = speedKmh;

		return {
			status,
			statusMessage: msg,
			accelMps2: accel,
			dtSec,
			powerKw,
			soc: this.soc == null ? null : Math.round(this.soc * 10) / 10,
			harshAccelCount: this.harshAccelCount,
			harshBrakeCount: this.harshBrakeCount,
			idleDurationSec: this.idleDurationSec,
		};
	}

	/** kWh/100 km untuk rute yang sudah diingest */
	kwhPer100Km(): number {
		return this.distanceKm > 0 ? (this.energyKwh / this.distanceKm) * 100 : 0;
	}
}
