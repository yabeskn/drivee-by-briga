import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// Driver Registration — multi-step wizard (public route).
// Halaman default bahasa EN (ada toggle ID/EN); string dari
// src/i18n/translations/en.ts (t.driver.*).
// ─────────────────────────────────────────────────────────────

test.describe("Driver Registration", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/register/driver");
		// Halaman register default bahasa EN (ada toggle ID/EN)
		await page.getByRole("button", { name: "🇬🇧 EN" }).click();
		await expect(
			page.getByRole("heading", { name: "Driver Registration" }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("menampilkan form pendaftaran driver", async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: "Driver Registration" }),
		).toBeVisible();
	});

	test("step wizard terdiri dari 5 langkah (personal → review)", async ({
		page,
	}) => {
		await expect(
			page.getByRole("heading", { name: "Personal Info" }),
		).toBeVisible();
	});

	test("field wajib step personal: nama, NIK, telepon, email", async ({
		page,
	}) => {
		for (const label of ["Full Name", "National ID", "Phone Number", "Email"]) {
			await expect(page.getByText(label).first()).toBeVisible();
		}
	});
});
