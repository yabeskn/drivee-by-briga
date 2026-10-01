import { test, expect } from "@playwright/test";
import { setValidSession } from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// BrigaCoin Balance — halaman /rewards (rute privat,
// dilindungi middleware JWT).
// ─────────────────────────────────────────────────────────────

test.describe("BrigaCoin Balance", () => {
	test("tanpa sesi → middleware me-redirect ke /login", async ({ page }) => {
		await page.context().clearCookies();
		await page.goto("/rewards");
		await expect(page).toHaveURL(/\/login/);
	});

	test("dengan sesi valid menampilkan saldo BrigaCoin", async ({ page }) => {
		await setValidSession(page);
		await page.goto("/rewards");
		await expect(page.getByText("BrigaCoin Balance")).toBeVisible({
			timeout: 15_000,
		});
	});

	test("menampilkan panel subsidi komuter korporat (ESG Perk)", async ({
		page,
	}) => {
		await setValidSession(page);
		await page.goto("/rewards");
		await expect(
			page.getByText("Klaim Subsidi Komuter Hijau (Corporate ESG Perk)"),
		).toBeVisible({ timeout: 15_000 });
	});
});
