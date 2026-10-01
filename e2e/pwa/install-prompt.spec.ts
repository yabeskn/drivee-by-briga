import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─────────────────────────────────────────────────────────────
// PWA Install Prompt — landing publik + manifest installable.
// Halaman default bahasa EN.
// ─────────────────────────────────────────────────────────────

test.describe("PWA Install Prompt", () => {
	test("landing page menampilkan CTA Login dan Register", async ({ page }) => {
		await page.goto("/landing");
		await expect(page.getByText("Login").first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText("Register").first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("manifest.json valid (name + icons) untuk installability", async ({
		page,
	}) => {
		const res = await page.request.get("/manifest.json");
		expect(res.ok()).toBeTruthy();
		const manifest = await res.json();
		expect(manifest.name).toBeTruthy();
		expect(
			manifest.icons?.length > 0 || manifest.screenshots?.length > 0,
		).toBeTruthy();
	});

	test("sw.js meng-cache manifest dan offline page (app shell)", () => {
		const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf-8");
		expect(sw).toContain("manifest.json");
		expect(sw).toContain("offline.html");
	});
});
