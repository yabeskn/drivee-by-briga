import { test, expect } from "@playwright/test";
import {
	setValidSession,
	startTripToHud,
} from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Start Trip Flow
// Alur baru: /go → LoginVehicleScreen → geofence check (async,
// fail-closed) → tombol "Mulai Perjalanan" → DISPATCHED
// (telematik menyala). Foto wajib sengaja DIHAPUS (anti-friction).
// ─────────────────────────────────────────────────────────────

test.describe("Start Trip Flow", () => {
	test("tanpa sesi → middleware me-redirect ke /login", async ({ page }) => {
		// Tanpa setValidSession — cookie tidak boleh ada
		await page.context().clearCookies();
		await page.goto("/go");
		await expect(page).toHaveURL(/\/login/);
	});

	test("dengan sesi valid menampilkan layar awal trip", async ({ page }) => {
		await setValidSession(page);
		await page.goto("/go");
		// Auto-skip ke step vehicle via getSession() — heading step 2
		await expect(page.getByText("Pilih Kendaraan")).toBeVisible({
			timeout: 15_000,
		});
	});

	test("menampilkan tombol Masuk/Mulai Perjalanan", async ({ page }) => {
		await setValidSession(page);
		await page.goto("/go");
		const actionButton = page
			.getByRole("button", { name: /Masuk|Mulai Perjalanan|Lanjut/ })
			.first();
		await expect(actionButton).toBeVisible({ timeout: 15_000 });
	});

	test("start trip melewati geofence mock → HUD aktif (DISPATCHED)", async ({
		page,
	}) => {
		await setValidSession(page);
		// Happy path: pilih kendaraan → Mulai Perjalanan (mock GPS di Hub)
		await startTripToHud(page);
		// "OTW Jemput (Deadhead)" = label fase DISPATCHED di HUD;
		// tombol Selesai Trip = kontrol penyelesaian tersedia
		await expect(page.getByText("OTW Jemput")).toBeVisible({
			timeout: 20_000,
		});
		await expect(
			page.getByRole("button", { name: "Selesai Trip" }),
		).toBeVisible();
	});

	test("tidak ada input file upload di layar awal (anti-friction)", async ({
		page,
	}) => {
		await setValidSession(page);
		await page.goto("/go");
		await expect(page.locator('input[type="file"]')).toHaveCount(0);
	});
});
