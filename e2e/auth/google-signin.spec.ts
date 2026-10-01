import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// Google Sign-In — halaman login publik (tanpa sesi).
// Login utama = Supabase OAuth Google PKCE → /auth/callback.
// Halaman default bahasa EN (toggle ID/EN tersedia).
// ─────────────────────────────────────────────────────────────

test.describe("Google Sign-In", () => {
	test("menampilkan tombol Sign in with Google", async ({ page }) => {
		await page.goto("/login");
		await expect(
			page.getByRole("button", { name: "Sign in with Google" }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("menampilkan branding Drifee", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByText("Drifee").first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("tanpa form password (login via OAuth, bukan password)", async ({
		page,
	}) => {
		await page.goto("/login");
		await expect(page.locator('input[type="password"]')).toHaveCount(0);
	});
});
