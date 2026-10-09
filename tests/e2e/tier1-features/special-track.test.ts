/**
 * Tier 1: Feature Coverage — Special Track (katalog lowongan & lamaran)
 *
 * Requirements:
 * - Lowongan_special track diambil dari DATABASE, bukan data hardcode di komponen.
 * - Kelayakan driver dinilai di server: skor eco minimum & kategori kendaraan.
 * - Lamaran idempoten: satu driver hanya boleh melamar satu kali per lowongan.
 * - Identitas driver berasal dari SESI terverifikasi, bukan dari body request.
 * - Halaman /special-track tidak lagi menampilkan toast sukses palsu.
 *
 * Background: halaman sebelumnya meng-hardcode 2 lowongan di dalam komponen React
 * dan tombol "Apply" hanya menampilkan "Application submitted successfully!"
 * tanpa melakukan request apa pun.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	evaluateEligibility,
	parseRequirements,
	rowToJob,
	type SpecialTrackJob,
} from "@/lib/special-track";

function readSource(path: string): string {
	return readFileSync(resolve(process.cwd(), path), "utf-8");
}

const baseJob: SpecialTrackJob = {
	id: "job-1",
	companyId: null,
	title: "EV Fleet Driver - Premium Route",
	description: "Premium EV shuttle service.",
	requirements: ["Valid SIM B1"],
	vehicleCategory: "premium",
	minEcoScore: 85,
	status: "open",
	createdAt: "2026-10-01T00:00:00.000Z",
};

// ── Kelayakan driver ────────────────────────────────────────

describe("Tier 1: Special Track — Eligibility Rules", () => {
	it("6.1: should accept a driver meeting the eco score and vehicle category", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: 92,
			vehicleCategory: "premium",
		});

		expect(result.eligible).toBe(true);
		expect(result.reasons).toHaveLength(0);
	});

	it("6.2: should reject a driver below the minimum eco score", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: 70,
			vehicleCategory: "premium",
		});

		expect(result.eligible).toBe(false);
		expect(result.reasons.join(" ")).toContain("70");
		expect(result.reasons.join(" ")).toContain("85");
	});

	it("6.3: should treat the eco score threshold as inclusive at the exact value", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: 85,
			vehicleCategory: "premium",
		});

		expect(result.eligible).toBe(true);
	});

	it("6.4: should reject a driver whose vehicle category does not match", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: 95,
			vehicleCategory: "standard",
		});

		expect(result.eligible).toBe(false);
		expect(result.reasons.join(" ")).toContain("premium");
	});

	it("6.5: should reject a driver with no registered vehicle for a categorised job", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: 95,
			vehicleCategory: null,
		});

		expect(result.eligible).toBe(false);
		expect(result.reasons.join(" ")).toContain("belum terdaftar");
	});

	it("6.6: should reject when the eco score is unknown rather than assuming eligibility", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: null,
			vehicleCategory: "premium",
		});

		expect(result.eligible).toBe(false);
		expect(result.reasons.join(" ")).toContain("belum tersedia");
	});

	it("6.7: should skip score/category checks when the job sets no threshold", () => {
		const openJob: SpecialTrackJob = {
			...baseJob,
			vehicleCategory: undefined,
			minEcoScore: undefined,
		};

		const result = evaluateEligibility(openJob, {
			ecoScore: null,
			vehicleCategory: null,
		});

		expect(result.eligible).toBe(true);
	});

	it("6.8: should reject an application to a closed job", () => {
		const closedJob: SpecialTrackJob = { ...baseJob, status: "closed" };

		const result = evaluateEligibility(closedJob, {
			ecoScore: 99,
			vehicleCategory: "premium",
		});

		expect(result.eligible).toBe(false);
		expect(result.reasons.join(" ")).toContain("ditutup");
	});

	it("6.9: should collect every failing reason, not just the first", () => {
		const result = evaluateEligibility(baseJob, {
			ecoScore: 40,
			vehicleCategory: "standard",
		});

		expect(result.eligible).toBe(false);
		expect(result.reasons.length).toBeGreaterThanOrEqual(2);
	});
});

// ── Parsing baris database ───────────────────────────────────

describe("Tier 1: Special Track — Row Parsing", () => {
	it("6.10: should map a database row into a job", () => {
		const job = rowToJob({
			id: "job-9",
			company_id: "company-1",
			title: "Corporate Shuttle Driver",
			description: "Shuttle service.",
			requirements: ["Valid SIM B1"],
			vehicle_category: "professional",
			min_eco_score: 80,
			status: "open",
			created_at: "2026-10-01T00:00:00.000Z",
		});

		expect(job.id).toBe("job-9");
		expect(job.requirements).toEqual(["Valid SIM B1"]);
		expect(job.minEcoScore).toBe(80);
		expect(job.vehicleCategory).toBe("professional");
	});

	it("6.11: should normalise null thresholds into undefined", () => {
		const job = rowToJob({
			id: "job-10",
			company_id: null,
			title: "Open Role",
			description: "No thresholds.",
			requirements: [],
			vehicle_category: null,
			min_eco_score: null,
			status: "open",
			created_at: "2026-10-01T00:00:00.000Z",
		});

		expect(job.minEcoScore).toBeUndefined();
		expect(job.vehicleCategory).toBeUndefined();
	});

	it("6.12: should parse requirements from a JSON array, a JSON string, or fall back to []", () => {
		expect(parseRequirements(["a", "b", 1])).toEqual(["a", "b"]);
		expect(parseRequirements('["x","y"]')).toEqual(["x", "y"]);
		expect(parseRequirements("bukan json")).toEqual([]);
		expect(parseRequirements(null)).toEqual([]);
		expect(parseRequirements({ nope: true })).toEqual([]);
	});
});

// ── Anti-hubungan: halaman tidak boleh memakai data palsu ────

describe("Tier 1: Special Track — No Hardcoded Data, No Fake Success", () => {
	it("6.13: /special-track page must fetch jobs from the API instead of hardcoding them", () => {
		const source = readSource("src/app/special-track/page.tsx");

		expect(source).toMatch(/fetch\(["']\/api\/special-track\/jobs["']\)/);
		// Lowongan lama yang tadinya di-hardcode tidak boleh lagi muncul di komponen.
		expect(source).not.toContain("EV Fleet Driver - Premium Route");
		expect(source).not.toContain("Corporate Shuttle Driver");
		expect(source).not.toContain("st_001");
	});

	it("6.14: /special-track page must post to the apply API, not fake success", () => {
		const source = readSource("src/app/special-track/page.tsx");

		expect(source).toMatch(/fetch\(["']\/api\/special-track\/apply["']/);
		expect(source).toMatch(/method:\s*["']POST["']/);
		// Pesan sukses hanya boleh tampil bila server memang mengonfirmasi.
		expect(source).not.toContain("Application submitted successfully!");
	});

	it("6.15: apply route must derive the driver from the session, never from the body", () => {
		const source = readSource("src/app/api/special-track/apply/route.ts");

		expect(source).toContain("resolveDriverFromSession");
		// Body hanya boleh membawa jobId — bukan driverId.
		expect(source).not.toMatch(/body\.driverId/);
		expect(source).not.toMatch(/body\.userId/);
	});

	it("6.16: apply route must reject unauthenticated callers with 401", () => {
		const source = readSource("src/app/api/special-track/apply/route.ts");

		expect(source).toContain("status: 401");
	});

	it("6.17: migration 010 must enforce one application per driver per job in the database", () => {
		const sql = readSource("supabase/migrations/010_special_track.sql");

		expect(sql).toContain("CREATE TABLE IF NOT EXISTS special_track_jobs");
		expect(sql).toContain(
			"CREATE TABLE IF NOT EXISTS special_track_applications",
		);
		// Idempotensi dijamin constraint, bukan sekadar logika aplikasi.
		expect(sql).toMatch(
			/CREATE UNIQUE INDEX[\s\S]*uq_special_track_application/,
		);
		expect(sql).toMatch(/ON special_track_applications \(job_id, driver_id\)/);
		// RLS harus menyalakan hanya lectura untuk driver sendiri.
		expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
		expect(sql).toContain("Drivers can read own applications");
	});

	it("6.18: jobs route must signal an unconfigured database instead of returning an empty list", () => {
		const source = readSource("src/app/api/special-track/jobs/route.ts");

		expect(source).toMatch(/source === ["']unavailable["']/);
		expect(source).toContain("status: 503");
	});

	it("6.20: migration 010 must match the real companies.id type (VARCHAR, not UUID)", () => {
		const sql = readSource("supabase/migrations/010_special_track.sql");

		// companies.id adalah VARCHAR(255) (migration 002). FK dengan UUID akan
		// gagal: "Key columns are of incompatible types: uuid and character varying".
		expect(sql).toMatch(/company_id VARCHAR\(255\) REFERENCES companies\(id\)/);
		expect(sql).not.toMatch(/company_id UUID REFERENCES companies\(id\)/);
	});

	it("6.21: listOpenJobs must return an unavailable source rather than a fake catalogue", () => {
		const source = readSource("src/lib/special-track.ts");

		// Tidak boleh ada katalog lowongan hardcoded di lib (fallback ke data palsu).
		expect(source).not.toContain("EV Fleet Driver - Premium Route");
		expect(source).not.toContain("Corporate Shuttle Driver");
		expect(source).toContain("source: 'unavailable'");
	});
});
