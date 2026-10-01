import { test, expect } from "@playwright/test";
import {
	setValidSession,
	startTripToHud,
} from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Active Driving HUD — telematik real-time saat trip aktif
// (watchPosition terdaftar di telemetry-cleanup registry).
// ─────────────────────────────────────────────────────────────

test.describe("Active Driving HUD", () => {
	test.beforeEach(async ({ page }) => {
		await setValidSession(page);
	});

	test("menampilkan HUD dengan elemen telemetri setelah trip mulai", async ({
		page,
	}) => {
		await setValidSession(page);
		await startTripToHud(page);
		// Watchdog berjalan selama 2 menit pertama trip — bukti HUD aktif
		await expect(page.getByText("WATCHDOG AKTIF")).toBeVisible({
			timeout: 20_000,
		});
	});

	test("HUD memiliki tombol penyelesaian trip", async ({ page }) => {
		await setValidSession(page);
		await startTripToHud(page);
		await expect(
			page.getByRole("button", { name: "Selesai Trip" }),
		).toBeVisible({ timeout: 20_000 });
	});

	test("badge watchdog tidak menandai anomali di lingkungan e2e", async ({
		page,
	}) => {
		// simulateMode aktif otomatis (?e2e=1 / HeadlessChrome) —
		// watchdog berjalan tapi tidak pernah ANOMALY_DETECTED.
		await setValidSession(page);
		await page.goto("/go?e2e=1");
		await expect(page.getByText("ANOMALY")).toHaveCount(0, {
			timeout: 10_000,
		});
	});
});
