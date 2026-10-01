import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// Vehicle Registration — multi-step wizard (public route).
// Sumber kebenaran string: src/i18n/translations/id.ts (t.vehicle.*)
// ─────────────────────────────────────────────────────────────

test.describe("Vehicle Registration", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/register/vehicle");
		// Halaman register default bahasa EN (ada toggle ID/EN)
		await page.getByRole("button", { name: "🇬🇧 EN" }).click();
		await expect(
			page.getByRole("heading", { name: "Vehicle Registration" }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("menampilkan form pendaftaran kendaraan", async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: "Vehicle Registration" }),
		).toBeVisible();
	});

	test("menampilkan pilihan jenis kendaraan", async ({ page }) => {
		await expect(page.getByText("Vehicle Type").first()).toBeVisible();
	});

	test("step wizard dimulai dari Vehicle Info", async ({ page }) => {
		await expect(page.getByText("Vehicle Info").first()).toBeVisible();
	});
});
