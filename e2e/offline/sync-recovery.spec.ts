import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	setValidSession,
	startTripToHud,
} from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Sync Recovery — koneksi kembali → antrian IndexedDB di-flush
// ke /api/sync (auto-sync setupAutoSync di /go).
// ─────────────────────────────────────────────────────────────

test.describe("Sync Recovery", () => {
	test("koneksi pulih → app kembali interaktif tanpa reload paksa", async ({
		page,
	}) => {
		await setValidSession(page);
		await startTripToHud(page);
		await page.context().setOffline(true);
		await page.waitForTimeout(1_500);
		await page.context().setOffline(false);
		// HUD tetap hidup dan responsif setelah online kembali
		await expect(page.getByText("OTW Jemput")).toBeVisible({
			timeout: 15_000,
		});
	});

	test("service worker menyediakan fallback offline.html untuk navigasi", () => {
		// Kontrak arsitektur: sw.js pre-cache /offline.html
		const sw = readFileSync(
			resolve(process.cwd(), "public/sw.js"),
			"utf-8",
		);
		expect(sw).toContain("offline.html");
	});
});
