import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setValidSession } from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Photo Capture — kontrak BARU (anti-friction)
//
// LAMA (dihapus): input[type=file] odometer/baterai wajib di awal
// dan akhir trip. Peminta validasi manual di tepi trip adalah
// friction yang dilarang spesifikasi.
//
// BARU:
//  - Tidak pernah ada upload foto di awal/akhir trip.
//  - LiveProofCapture (kamera LIVE via getUserMedia, tanpa file
//    upload) HANYA dirender saat watchdog → ANOMALY_DETECTED,
//    mem-bekukan app sampai foto dasbor valid.
// ─────────────────────────────────────────────────────────────

test.describe("Anti-Friction Photo Policy", () => {
	test.beforeEach(async ({ page }) => {
		await setValidSession(page);
	});

	test("alur trip normal tidak pernah menampilkan modal LiveProofCapture", async ({
		page,
	}) => {
		await page.goto("/go");
		// Modal wajib TIDAK muncul pada alur normal (watchdog belum
		// mendeteksi anomali apa pun).
		await expect(page.getByRole("dialog")).toHaveCount(0, {
			timeout: 10_000,
		});
	});

	test("tidak ada elemen upload file di seluruh alur awal trip", async ({
		page,
	}) => {
		await page.goto("/go");
		await expect(page.locator('input[type="file"]')).toHaveCount(0);
	});
});

test.describe("LiveProofCapture — kontrak arsitektur", () => {
	// Guard terhadap refactor: komponen modal keamanan wajib tetap
	// kamera LIVE (getUserMedia) dan TANPA file upload.
	const componentPath = resolve(
		process.cwd(),
		"src/components/LiveProofCapture.tsx",
	);

	test("memakai kamera live (getUserMedia), bukan input file", () => {
		const source = readFileSync(componentPath, "utf-8");
		expect(source).toContain("getUserMedia");
		expect(source).not.toMatch(/type\s*=\s*["']file["']/);
	});

	test("hanya dirender saat ANOMALY_DETECTED (prop status watchdog)", () => {
		const source = readFileSync(componentPath, "utf-8");
		expect(source).toMatch(/ANOMALY_DETECTED/);
	});
});
