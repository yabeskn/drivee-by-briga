import { expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SignJWT } from "jose";

// Playwright tidak auto-load .env.local — baca manual untuk
// mendapat SUPABASE_JWT_SECRET & NEXT_PUBLIC_SUPABASE_URL.
function loadEnvLocal(): Record<string, string> {
	const envPath = resolve(process.cwd(), ".env.local");
	const env: Record<string, string> = {};
	if (!existsSync(envPath)) return env;
	for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const i = t.indexOf("=");
		if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
	}
	return env;
}
const envLocal = loadEnvLocal();
const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || "";

/**
 * Storage key sesi supabase-js: `sb-<hostname pertama>-auth-token`.
 * Haris sama dengan yang dipakai createClient() di src/lib/supabase/client.ts
 * agar guard sisi-klien membaca sesi yang kita inject.
 */
function deriveStorageKey(): string {
	try {
		const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
		if (ref) return `sb-${ref}-auth-token`;
	} catch {
		// URL tidak valid (mis. CI tanpa env) → fallback
	}
	return "sb-e2e-auth-token";
}

// ─────────────────────────────────────────────────────────────
// session.ts — Sesi valid untuk spek yang mengakses rute privat
//
// Middleware (src/middleware.ts) memverifikasi JWT sesi Supabase
// di cookie `sb-access-token` (JWKS → HS256 SUPABASE_JWT_SECRET →
// Auth API), dan aplikasi klien membaca sesi dari localStorage
// (persistSession default supabase-js). Helper ini menyiapkan
// keduanya sehingga spek e2e mewakili pengguna yang benar-benar
// login — bukan cookie palsu yang akan ditolak middleware.
//
// Catatan lingkungan:
//  - Jalur CI: Auth API /auth/v1/user akan menerima token apa pun
//    (NEXT_PUBLIC_SUPABASE_URL belum diset di workflow e2e.yml)
//    sehingga HS256 dummy cukup untuk lulus middleware.
//  - Lokal/produksi: berikan SUPABASE_JWT_SECRET di .env.local
//    agar token ditandatangani dengan secret asli dan lolos di
//    semua konfigurasi signing.
// ─────────────────────────────────────────────────────────────

export const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_USER_EMAIL = "e2e-driver@briga.id";
export const TEST_USER_NAME = "E2E Driver";

/** JWT HS256 dengan klaim sesi Supabase standar (sub/email/exp). */
export async function createSessionToken(): Promise<string> {
	const secretValue =
		process.env.SUPABASE_JWT_SECRET || envLocal.SUPABASE_JWT_SECRET || "e2e-not-a-real-secret";
	const secret = new TextEncoder().encode(secretValue);
	const issuedAt = Math.floor(Date.now() / 1000);
	// Issuer HARUS cocok dengan yang divalidasi middleware:
	// `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1`
	const issuer = SUPABASE_URL
		? `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1`
		: "https://e2e.local/auth/v1";

	return new SignJWT({
		email: TEST_USER_EMAIL,
		role: "authenticated",
		user_metadata: { full_name: TEST_USER_NAME },
	})
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setSubject(TEST_USER_ID)
		.setIssuer(issuer)
		.setAudience("authenticated")
		.setIssuedAt(issuedAt)
		.setExpirationTime(issuedAt + 3600)
		.sign(secret);
}

/**
 * Mock geolocation di dalam radius Hub Cikarang Dry Port
 * (BRIGA_HUBS[0], radius 500 m + toleransi akurasi ≤100 m)
 * agar checkHubGeofence() lolos di e2e.
 */
export async function mockDriverHubGeolocation(page: Page): Promise<void> {
	await page.context().grantPermissions(["geolocation"], { origin: "http://localhost:3000" });
	await page.context().setGeolocation({
		latitude: -6.30816,
		longitude: 107.14987,
		accuracy: 10,
	});
}

/**
 * Klik button berdasarkan teks label via DOM atomik (bypass
 * actionability/retry loop Playwright yang bisa hang di UI yang
 * re-render agresif). Melempar bila tombol tidak ditemukan.
 */
async function clickButtonByText(page: Page, label: string): Promise<void> {
	const clicked = await page.evaluate((text) => {
		const buttons = [...document.querySelectorAll("button")];
		const target = buttons.find((b) => (b.textContent || "").includes(text));
		if (!target) return false;
		target.click();
		return true;
	}, label);
	if (!clicked) throw new Error(`Button "${label}" tidak ditemukan di DOM`);
}

/**
 * Happy path: /go → pilih kendaraan default → Mulai Perjalanan
 * (geofence lolos via mock) → HUD aktif (telematik menyala).
 * Panggil setValidSession() dulu sebelum helper ini.
 *
 * Self-healing: seluruh alur dibungkus expect().toPass() dengan
 * goto di awal tiap attempt — state wizard ter-reset tiap retry,
 * menyerap race hidrasi dev-server & re-render agresif telemetri.
 */
export async function startTripToHud(page: Page): Promise<void> {
	await mockDriverHubGeolocation(page);

	await expect(async () => {
		//.goto tiap attempt = state wizard bersih
		await page.goto("/go?e2e=1");

		// Step 1 (auth): jika guard sisi-klien belum auto-lompat via
		// getSession() (sesi ter-inject), klik Masuk.
		const enterButton = page.getByRole("button", {
			name: "Masuk",
			exact: true,
		});
		try {
			await enterButton.click({ timeout: 2_500 });
		} catch {
			// Sudah di step vehicle (sesi dikenali saat mount)
		}

		// Step 2: pilih kendaraan — klik kartu langsung memindah ke
		// step "Status Awal" (perilaku aktual LoginVehicleScreen).
		// Klik via evaluate: click locator biasa bisa hang saat
		// handshake karena node di-replace React di tengah aksi.
		await page.getByText("Wuling Air EV Long Range").first().click({
			timeout: 5_000,
		});
		// Klik "Lanjut" hanya bila masih ada (klik kartu kadang sudah
		// memindahkan step — jangan anggap gagal bila tombol hilang).
		await page.evaluate(() => {
			const btn = [...document
				.querySelectorAll("button")]
				.find((b) => (b.textContent || "").includes("Lanjut"));
			btn?.click();
		});
		await page
			.getByText("Status Awal")
			.waitFor({ state: "visible", timeout: 10_000 });

		// Step 3 (Status Awal) → Mulai Perjalanan (geofence tervalidasi
		// via mock GPS di Hub Cikarang Dry Port)
		await clickButtonByText(page, "Mulai Perjalanan");

		// HUD aktif = transisi IDLE → DISPATCHED + telematik menyala
		// ("OTW Jemput (Deadhead)" = label fase DISPATCHED di HUD)
		await page
			.getByText("OTW Jemput")
			.or(page.getByText("Selesai Trip"))
			.first()
			.waitFor({ state: "visible", timeout: 15_000 });
	}).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 4_000] });
}

/**
 * Selesaikan trip aktif → dashboard ringkasan eco (Verifikasi Akhir).
 * Panggil setelah startTripToHud().
 */
export async function endTripToDashboard(page: Page): Promise<void> {
	await clickButtonByText(page, "Selesai Trip");
	await page
		.getByText("Verifikasi Akhir")
		.waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Pasang sesi valid di browser sebelum navigasi:
 *  1. Cookie `sb-access-token` + `sb-refresh-token` (dibaca middleware).
 *  2. localStorage `sb-<auth-ref>-auth-token` (dibaca supabase-js
 *     di guard sisi-klien halaman privat).
 */
export async function setValidSession(page: Page): Promise<void> {
	const token = await createSessionToken();

	await page.context().addCookies([
		{
			name: "sb-access-token",
			value: token,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			sameSite: "Lax",
		},
		{
			name: "sb-refresh-token",
			value: "e2e-refresh-token",
			domain: "localhost",
			path: "/",
			httpOnly: true,
			sameSite: "Lax",
		},
	]);

	await page.addInitScript(
		({ storageKey, accessToken, userId, email, fullName }) => {
			window.localStorage.setItem(
				storageKey,
				JSON.stringify({
					access_token: accessToken,
					refresh_token: "e2e-refresh-token",
					token_type: "bearer",
					expires_in: 3600,
					expires_at: Math.floor(Date.now() / 1000) + 3600,
					user: {
						id: userId,
						email,
						app_metadata: { provider: "google" },
						user_metadata: { full_name: fullName },
						aud: "authenticated",
						created_at: "2026-01-01T00:00:00Z",
					},
				}),
			);
		},
		{
			storageKey: deriveStorageKey(),
			accessToken: token,
			userId: TEST_USER_ID,
			email: TEST_USER_EMAIL,
			fullName: TEST_USER_NAME,
		},
	);
}
