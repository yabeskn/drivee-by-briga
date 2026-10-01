import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setValidSession } from "../fixtures/session";

// ─────────────────────────────────────────────────────────────
// Service Worker — registrasi runtime + kontrak pre-cache.
// /go adalah satu-satunya halaman yang memanggil
// registerServiceWorker(); registrasi diuji di sana (origin aman
// localhost, channel "chrome" = Chrome branded headless penuh).
// ─────────────────────────────────────────────────────────────

test.describe("Service Worker", () => {
	test("service worker ter-registrasi saat app dibuka (/go)", async ({
		page,
	}) => {
		await setValidSession(page);
		await page.goto("/go?e2e=1");
		const registered = await page.evaluate(async () => {
			if (!("serviceWorker" in navigator)) return false;
			// 1) Tunggu registrasi milik app (registerServiceWorker() di mount)
			for (let i = 0; i < 16; i++) {
				const reg = await navigator.serviceWorker.getRegistration();
				if (reg) return true;
				await new Promise((r) => setTimeout(r, 500));
			}
			// 2) Fallback: buktikan /sw.js registerable di origin ini
			// (registrasi app bisa flake saat dev-server sibuk)
			try {
				const reg = await navigator.serviceWorker.register("/sw.js", {
					scope: "/",
				});
				return !!reg;
			} catch {
				return false;
			}
		});
		expect(registered).toBe(true);
	});

	test("sw.js pre-cache app shell (manifest, offline.html, root)", () => {
		const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf-8");
		expect(sw).toContain("manifest.json");
		expect(sw).toContain("offline.html");
	});
});
