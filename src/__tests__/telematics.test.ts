import { describe, expect, it } from "vitest";
import {
	calculateCO2Avoided,
	calculateDynamicCO2Savings,
} from "@/lib/eco-score";
import {
	EV_PROFILES,
	estimatePowerKw,
	longitudinalAccel,
	TelematicsEngine,
	validAccelDtSec,
} from "@/lib/telematics-physics";

const KMH = 3.6;

/** Jalankan serangkaian akselerasi (m/s²) dengan sampel 1 Hz dari v0 (km/h). */
function driveProfile(
	engine: TelematicsEngine,
	v0Kmh: number,
	accels: number[],
	t0 = 1_000_000,
) {
	let v = v0Kmh / KMH;
	engine.ingest({ timestampMs: t0, speedKmh: v * KMH });
	accels.forEach((a, i) => {
		v += a;
		engine.ingest({ timestampMs: t0 + (i + 1) * 1000, speedKmh: v * KMH });
	});
}

describe("Telematics — akselerasi nyata (Bug B)", () => {
	it("dt = 0 tidak menghasilkan akselerasi 0 (null)", () => {
		expect(validAccelDtSec(5000, 5000)).toBeNull();
		expect(longitudinalAccel(50, 30, null)).toBeNull();
		const e = new TelematicsEngine();
		e.ingest({ timestampMs: 1000, speedKmh: 30 });
		const r = e.ingest({ timestampMs: 1000, speedKmh: 60 });
		expect(r.accelMps2).toBeNull();
		expect(r.accelMps2).not.toBe(0);
	});

	it("dt > 10 detik tidak valid; dt 1 detik = Δv/Δt", () => {
		expect(validAccelDtSec(0, 10_001)).toBeNull();
		expect(validAccelDtSec(0, 10_000)).toBe(10);
		expect(longitudinalAccel(36, 0, 2)).toBeCloseTo(5, 5);
	});
});

describe("Telematics — harsh event per kejadian", () => {
	it("driver halus menghasilkan 0 event", () => {
		const e = new TelematicsEngine();
		const a = Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.5 : -0.5));
		driveProfile(e, 50, a);
		expect(e.harshAccelCount).toBe(0);
		expect(e.harshBrakeCount).toBe(0);
	});

	it("driver agresif (3,2 / -4 m/s²) menghasilkan 20 event per jenis", () => {
		const e = new TelematicsEngine();
		const cycle = [3.2, 0.8, -4.0, 0]; // net 0, harsh dipisah sampel halus
		const accels = Array.from({ length: 20 }, () => cycle).flat();
		driveProfile(e, 54, accels);
		expect(e.harshAccelCount).toBe(20);
		expect(e.harshBrakeCount).toBe(20);
	});

	it("harsh berturut-turut dihitung satu kejadian", () => {
		const e = new TelematicsEngine();
		driveProfile(e, 40, [3.2, 3.2, 3.2, 0]);
		expect(e.harshAccelCount).toBe(1);
	});
});

describe("Telematics — idle memakai dt nyata (Bug C)", () => {
	it("idle 620 detik tercatat 620 detik (sampel 1 Hz)", () => {
		const e = new TelematicsEngine();
		for (let i = 0; i <= 620; i++)
			e.ingest({ timestampMs: i * 1000, speedKmh: 0 });
		expect(e.idleDurationSec).toBe(620);
	});

	it("idle 620 detik tercatat 620 dengan polling 5 dtk & gap dibatasi 30 dtk", () => {
		const e = new TelematicsEngine();
		for (let i = 0; i <= 124; i++)
			e.ingest({ timestampMs: i * 5000, speedKmh: 0 });
		expect(e.idleDurationSec).toBe(620);
		e.ingest({ timestampMs: 124 * 5000 + 120_000, speedKmh: 0 }); // gap 120 dtk
		expect(e.idleDurationSec).toBe(650); // hanya +30
	});
});

describe("Telematics — model road-load EV (Bug A + D)", () => {
	const atto = EV_PROFILES.byd_atto1;

	it("regen aktif saat deselerasi (daya negatif)", () => {
		const cruise = estimatePowerKw(atto, 50, 0);
		const decel = estimatePowerKw(atto, 50, -1.5);
		expect(cruise).toBeGreaterThan(atto.auxKw);
		expect(decel).toBeLessThan(0);
	});

	it("regen dibatasi maxRegenKw (+ aux)", () => {
		const p = estimatePowerKw(atto, 120, -4);
		expect(p).toBeGreaterThanOrEqual(-atto.maxRegenKw + atto.auxKw - 0.01);
	});

	it("diam hanya menarik beban aux", () => {
		expect(estimatePowerKw(atto, 0, 0)).toBeCloseTo(atto.auxKw, 2);
	});

	it("satuan benar: 50 km/h konstan ≈ 3.5–6 kW", () => {
		const p = estimatePowerKw(atto, 50, 0);
		expect(p).toBeGreaterThan(3.5);
		expect(p).toBeLessThan(6);
	});

	it("energi rute stop-go Atto 1 ≈ 12–15 kWh/100 km", () => {
		// Siklus urban yang umum: berhenti ~9% waktu (antrian lampu lalu lintas).
		// Band 12–15 kWh/100 km merujuk consumption Atto 1 saat mengendar
		// perkotaan yang relatif lancar.
		const e = new TelematicsEngine({ profile: "byd_atto1" });
		const cycle: number[] = [
			...Array(10).fill(0.6), // 0 → ~21,6 km/h
			...Array(30).fill(0), // cruise
			...Array(10).fill(-0.6), // → 0
			...Array(5).fill(0), // berhenti
		];
		const accels = Array.from({ length: 30 }, () => cycle).flat();
		driveProfile(e, 0, accels);
		const kwh100 = e.kwhPer100Km();
		expect(kwh100).toBeGreaterThanOrEqual(12);
		expect(kwh100).toBeLessThanOrEqual(15);
	});

	it("energi gridlock (berhenti 27% waktu) ≈ 15–19 kWh/100 km", () => {
		// Duty cycle terparah yang wajar: berhenti 12 dari 44 detik, vkaks
		// 0,8 m/s² — berhenti setiap ~44 detik. Angka consumption nyata Atto 1 di
		// macet sekota berada di kisaran 16–19 kWh/100 km, jadi band 12–15 milik
		// siklus lancar di atas TIDAK berlaku untuk duty cycle ini.
		const e = new TelematicsEngine({ profile: "byd_atto1" });
		const cycle: number[] = [
			...Array(11).fill(0.8), // 0 → ~31,7 km/h
			...Array(10).fill(0), // cruise pendek
			...Array(11).fill(-0.8), // → 0
			...Array(12).fill(0), // berhenti
		];
		const accels = Array.from({ length: 30 }, () => cycle).flat();
		driveProfile(e, 0, accels);
		const kwh100 = e.kwhPer100Km();
		expect(kwh100).toBeGreaterThanOrEqual(15);
		expect(kwh100).toBeLessThanOrEqual(19);
	});

	it("SoC memakai dt nyata, bukan interval polling", () => {
		const e = new TelematicsEngine({ batteryCapacityKwh: 30, initialSoc: 80 });
		e.ingest({ timestampMs: 0, speedKmh: 0 });
		for (let i = 1; i <= 3600; i++)
			e.ingest({ timestampMs: i * 1000, speedKmh: 0 });
		// 1 jam × 1 kW aux / 30 kWh ≈ 3.3 %
		expect(e.soc).toBeCloseTo(80 - (1 / 30) * 100, 0);
	});
});

describe("calculateCO2Avoided", () => {
	it("memakai pembanding bensin 206 g/km dan Wh/km × faktor grid", () => {
		const r = calculateCO2Avoided(100, { evWhPerKm: 130, gridKgPerKwh: 0.87 });
		expect(r).toBeCloseTo((0.206 - 0.13 * 0.87) * 100, 2);
	});
});

describe("calculateDynamicCO2Savings & Indonesian EV Profiles", () => {
	it("menghitung emisi mobil EV dengan detail transisi dan bonus eco-habit", () => {
		const res = calculateDynamicCO2Savings({
			distanceKm: 20,
			vehicleType: "car",
			actualEnergyKwh: 2.2, // 110 Wh/km (eco-driving)
			ecoScore: 92,
		});

		expect(res.totalAvoidedKg).toBeGreaterThan(0);
		expect(res.baseTransitionSavingsKg).toBeGreaterThan(0);
		expect(res.habitBonusSavingsKg).toBeGreaterThan(0);
		expect(res.fuelSavedLiters).toBeGreaterThan(0);
		expect(res.treesEquivalent).toBeGreaterThan(0);
		expect(res.petrolBaselineKgPerKm).toBe(0.206);
	});

	it("menghitung baseline emisi motor listrik EV (Gesits / Alva)", () => {
		const res = calculateDynamicCO2Savings({
			distanceKm: 15,
			vehicleType: "motorcycle",
			ecoScore: 88,
		});

		expect(res.petrolBaselineKgPerKm).toBe(0.065);
		expect(res.totalAvoidedKg).toBeGreaterThan(0);
		expect(res.fuelSavedLiters).toBeGreaterThan(0);
	});

	it("profil EV Indonesia terdefinisi lengkap (Wuling Air EV, Gesits, Ioniq 5, BYD Atto 1, Yamaha X-Ride)", () => {
		expect(EV_PROFILES.wuling_air_ev).toBeDefined();
		expect(EV_PROFILES.wuling_air_ev.massKg).toBe(860);
		expect(EV_PROFILES.gesits_g1).toBeDefined();
		expect(EV_PROFILES.gesits_g1.vehicleType).toBe("motorcycle");
		expect(EV_PROFILES.hyundai_ioniq_5).toBeDefined();
		expect(EV_PROFILES.hyundai_ioniq_5.massKg).toBe(1950);
		expect(EV_PROFILES.byd_atto1).toBeDefined();
		expect(EV_PROFILES.byd_atto1.batteryCapacityKwh).toBe(30.08);
		expect(EV_PROFILES.yamaha_xride_115).toBeDefined();
		expect(EV_PROFILES.yamaha_xride_115.fuelConsumptionKmPerL).toBe(42);
		expect(EV_PROFILES.yamaha_xride_115.maxRegenKw).toBe(0);
	});

	it("menghitung emisi dan penghematan BBM motor bensin ICE (Yamaha X-Ride 115 Pertalite)", () => {
		const res = calculateDynamicCO2Savings({
			distanceKm: 21,
			vehicleType: "motorcycle",
			powertrain: "ice",
			fuelType: "pertalite",
			fuelConsumptionKmPerL: 42,
			ecoScore: 92, // Eco riding
		});

		expect(res.powertrain).toBe("ice");
		expect(res.fuelType).toBe("pertalite");
		expect(res.fuelEfficiencyKmPerLiter).toBeGreaterThan(42); // Efisiensi meningkat di atas baseline
		expect(res.fuelSavedLiters).toBeGreaterThan(0);
		expect(res.rupiahSaved).toBeGreaterThan(0);
		expect(res.potentialEvTransitionSavingsKg).toBeGreaterThan(0);
		expect(res.totalAvoidedKg).toBeGreaterThan(0);
	});

	it("TelematicsEngine menangani motor ICE tanpa menghasilkan NaN pada SoC", () => {
		const engine = new TelematicsEngine({ profile: "yamaha_xride_115" });
		engine.ingest({ timestampMs: 1000, speedKmh: 40 });
		engine.ingest({ timestampMs: 2000, speedKmh: 20 });
		expect(Number.isNaN(engine.soc)).toBe(false);
	});
});
