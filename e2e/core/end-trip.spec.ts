import { test, expect } from "@playwright/test";
import {
	setValidSession,
	startTripToHud,
	endTripToDashboard,
} from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// End Trip Flow — Selesai Trip → cleanupTelemetry() (semua
// listener + clearWatch dilepas) → dashboard ringkasan eco.
// Foto akhir sengaja OPSIONAL (anti-friction).
// ─────────────────────────────────────────────────────────────

test.describe("End Trip Flow", () => {
	test("dashboard akhir trip menampilkan ringkasan eco-driving", async ({
		page,
	}) => {
		await setValidSession(page);
		await startTripToHud(page);
		await endTripToDashboard(page);
		// EndTripDashboard menampilkan ringkasan reward
		await expect(page.getByText("Verifikasi Akhir")).toBeVisible();
		await expect(
			page.getByText("BrigaCoins").first(),
		).toBeVisible();
	});

	test("tombol Selesai Trip tersedia saat trip aktif", async ({ page }) => {
		await setValidSession(page);
		await startTripToHud(page);
		await expect(
			page.getByRole("button", { name: "Selesai Trip" }),
		).toBeVisible({ timeout: 20_000 });
	});

	test("akhir trip tidak pernah meminta foto wajib (anti-friction)", async ({
		page,
	}) => {
		await setValidSession(page);
		await startTripToHud(page);
		// Kontrak: tidak ada input file yang menghalangi penyelesaian trip
		await expect(page.locator('input[type="file"]')).toHaveCount(0);
	});
});
