import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// Phone Verification — verifikasi nomor WhatsApp (fitur aktif,
// EN default). Tombol "Send Verification Link" disabled sampai
// nomor diisi; pengiriman nyata tidak diuji di e2e (butuh OTP).
// ─────────────────────────────────────────────────────────────

test.describe("Phone Verification (WhatsApp)", () => {
	test("menampilkan form verifikasi nomor HP", async ({ page }) => {
		await page.goto("/login");
		await expect(
			page.getByRole("heading", { name: "Verify Phone Number" }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('input[type="tel"]')).toBeVisible();
	});

	test("tombol kirim link disabled sebelum nomor diisi", async ({ page }) => {
		await page.goto("/login");
		const sendButton = page.getByRole("button", {
			name: "Send Verification Link",
		});
		await expect(sendButton).toBeDisabled();
	});

	test("menerima nomor valid → tombol kirim aktif", async ({ page }) => {
		await page.goto("/login");
		await page.fill('input[type="tel"]', "081234567890");
		await expect(
			page.getByRole("button", { name: "Send Verification Link" }),
		).toBeEnabled();
	});
});
