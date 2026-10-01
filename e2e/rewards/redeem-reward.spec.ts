import { test, expect } from "@playwright/test";
import { setValidSession } from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Redeem Reward — katalog /rewards (server-driven dari
// tabel rewards + fallback statis).
// ─────────────────────────────────────────────────────────────

test.describe("Redeem Reward", () => {
	test.beforeEach(async ({ page }) => {
		await setValidSession(page);
	});

	test("menampilkan katalog reward yang tersedia", async ({ page }) => {
		await page.goto("/rewards");
		await expect(page.getByText("Available Rewards")).toBeVisible({
			timeout: 15_000,
		});
	});

	test("katalog memuat daftar reward (katalog statis fallback atau DB)", async ({
		page,
	}) => {
		await page.goto("/rewards");
		// Katalog dirender dari /api/rewards (statis fallback pasti isi)
		await expect(page.locator("h3").first()).toBeVisible({
			timeout: 15_000,
		});
	});

	test("tombol tukar/klaim ada di katalog", async ({ page }) => {
		await page.goto("/rewards");
		// "Klaim Subsidi" (panel ESG) atau "Tukar" (kartu reward)
		await expect(
			page
				.getByRole("button", { name: /Tukar|Klaim/ })
				.first(),
		).toBeVisible({ timeout: 15_000 });
	});
});
