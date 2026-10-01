import { test, expect } from "@playwright/test";
import { setValidSession } from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Session Persistence — middleware memverifikasi JWT sesi
// (bukan sekadar keberadaan cookie); localStorage flag
// drivee_logged_in sengaja TIDAK dipercaya.
// ─────────────────────────────────────────────────────────────

test.describe("Session Persistence", () => {
	test("tanpa sesi → rute privat redirect ke /login?next=", async ({
		page,
	}) => {
		await page.goto("/go");
		await expect(page).toHaveURL(/\/login\?next=/);
	});

	test("cookie acak tanpa signature valid → tetap ditolak middleware", async ({
		page,
	}) => {
		// Ini adalah regresi-guard untuk hardening middleware: nilai
		// cookie yang dipalsukan TIDAK boleh memberi akses.
		await page.context().addCookies([
			{
				name: "sb-access-token",
				value: "spoofed-token-value",
				domain: "localhost",
				path: "/",
			},
		]);
		await page.goto("/go");
		await expect(page).toHaveURL(/\/login/);
	});

	test("sesi valid (JWT ditandatangani benar) → /go dapat diakses", async ({
		page,
	}) => {
		await setValidSession(page);
		await page.goto("/go");
		await expect(page).not.toHaveURL(/\/login/);
		await expect(page.getByText("Drifee").first()).toBeVisible({
			timeout: 15_000,
		});
	});
});
