import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	setValidSession,
	startTripToHud,
} from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Offline Queue — PWA offline-first. Saat offline, HUD menampilkan
// badge status dan submit trip masuk antrian IndexedDB (Dexie),
// bukan localStorage.
// ─────────────────────────────────────────────────────────────

test.describe("Offline Queue", () => {
	test("trip tetap berjalan saat koneksi terputus (offline-first)", async ({
		page,
	}) => {
		await setValidSession(page);
		await startTripToHud(page);
		await page.context().setOffline(true);
		// HUD tetap hidup (bukan crash/blank) saat offline
		await expect(
			page.getByRole("button", { name: "Selesai Trip" }),
		).toBeVisible({ timeout: 15_000 });
	});

	test("trip state bertahan saat offline (tidak ada crash/blank)", async ({
		page,
	}) => {
		await setValidSession(page);
		await startTripToHud(page);
		await page.context().setOffline(true);
		await page.waitForTimeout(2_000);
		// HUD tetap interaktif — fase deadhead masih ditampilkan
		await expect(page.getByText("OTW Jemput")).toBeVisible({
			timeout: 15_000,
		});
	});
});
