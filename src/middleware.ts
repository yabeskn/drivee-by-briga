import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

// ─────────────────────────────────────────────────────────────
// middleware.ts — Route Protection (Invisible Security layer 0)
//
// Kontrak (tests/e2e/harness/auth-guard.ts · PROJECT.md §F10-12):
//  - Rute privat WAJIB login: /admin, /company, /rewards,
//    /special-track, /verify, /go
//  - Pengunjung tanpa sesi → 307 redirect ke /login?next=<path>
//  - Cookie sesi TIDAK hanya dicek keberadaannya — JWT-nya
//    DIVERIFIKASI (signature + exp) sebelum akses diberikan.
//    localStorage flag (drivee_logged_in) sengaja TIDAK dipercaya
//    (spoofable dari DevTools).
//  - Verifikasi signature:
//      1) Asimetris via JWKS proyek Supabase (JWT signing keys),
//      2) Fallback HS256 HANYA memakai SUPABASE_JWT_SECRET.
//         Anon key sengaja TIDAK dipakai sebagai secret HS256 —
//         nilainya publik dan bisa dipakai memalsukan token.
//      3) Fallback terakhir: validasi token ke Auth API Supabase
//         (/auth/v1/user) — selalu benar di semua konfigurasi.
//    Fail-closed: token tidak ada / tidak valid → redirect login.
//  - Parameter `next` disanitasi: hanya path internal relatif,
//    mencegah open-redirect
// ─────────────────────────────────────────────────────────────

/** Rute privat yang wajib sesi valid */
export const PROTECTED_ROUTES = [
	"/admin",
	"/company",
	"/rewards",
	"/special-track",
	"/verify",
	"/go",
	"/commuter",
];

/** Rute publik — tidak pernah diblokir middleware */
export const PUBLIC_ROUTES = [
	"/",
	"/login",
	"/landing",
	"/register",
	"/auth/callback",
	"/api/auth",
];

/**
 * Sanitasi parameter `next`: hanya path internal relatif yang
 * diizinkan (dimulai satu '/', bukan '//', '\', atau URL absolut)
 * untuk mencegah open-redirect ke domain eksternal.
 */
function sanitizeNextPath(rawPath: string): string {
	if (
		rawPath.startsWith("/") &&
		!rawPath.startsWith("//") &&
		!rawPath.includes("\\")
	) {
		return rawPath;
	}
	return "/go";
}

// ── Verifikasi JWT sesi Supabase ────────────────────────────

interface SessionClaims {
	sub?: string;
	email?: string;
	[key: string]: unknown;
}

// JWKS dibuat sekali per isolat & di-cache (jose meng-cache key
// secara internal dengan rate limiting fetch bawaan).
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null | undefined;

function getSupabaseUrl(): string | null {
	return process.env.NEXT_PUBLIC_SUPABASE_URL || null;
}

function getRemoteJwks() {
	if (cachedJwks !== undefined) return cachedJwks;
	const supabaseUrl = getSupabaseUrl();
	cachedJwks = supabaseUrl
		? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
		: null;
	return cachedJwks;
}

/**
 * Fallback terakhir: validasi token langsung ke Auth API Supabase.
 * Selalu benar di semua konfigurasi signing (asimetris maupun HS256
 * legacy) karena supaya keputusan ada di sisi server Supabase.
 */
async function verifyViaAuthApi(token: string): Promise<boolean> {
	const supabaseUrl = getSupabaseUrl();
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !anonKey) return false;
	try {
		const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
			headers: {
				Authorization: `Bearer ${token}`,
				apikey: anonKey,
			},
		});
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Verifikasi JWT sesi Supabase:
 *  1. Asimetris (RS/ES/EdDSA) via JWKS `NEXT_PUBLIC_SUPABASE_URL/auth/v1/`
 *     — dipakai Supabase ketika "JWT Signing Keys" asimetris aktif.
 *  2. Fallback HS256 HANYA memakai `SUPABASE_JWT_SECRET` (legacy).
 *     Anon key TIDAK dipakai sebagai secret — nilainya publik.
 *  3. Fallback terakhir: Auth API /auth/v1/user.
 * Issuer divalidasi bila URL Supabase diketahui.
 * Mengembalikan claims bila valid, null bila tidak (fail-closed).
 */
async function verifySessionJwt(token: string): Promise<SessionClaims | null> {
	const supabaseUrl = getSupabaseUrl();
	const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined;

	try {
		const jwks = getRemoteJwks();
		if (jwks) {
			try {
				const { payload } = await jwtVerify(token, jwks, { issuer });
				return payload as SessionClaims;
			} catch {
				// Bukan token asimetris / JWKS belum tersedia → coba HS256
			}
		}

		const secret = process.env.SUPABASE_JWT_SECRET;
		if (secret) {
			const key = new TextEncoder().encode(secret);
			try {
				const { payload } = await jwtVerify(token, key, { issuer });
				return payload as SessionClaims;
			} catch {
				// HS256 gagal → coba Auth API
			}
		}

		// Verifikasi otoritatif via Auth API (juga memvalidasi bahwa
			// sesi belum direvoke di server)
		return (await verifyViaAuthApi(token)) ? { sub: "supabase-auth-api" } : null;
	} catch {
		// Signature/exp/issuer tidak valid → sesi ditolak
		return null;
	}
}

export async function middleware(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	// API routes melakukan otorisasi sendiri di route handler
	// (mis. /api/trips/verify memverifikasi hash & UUID payload)
	if (pathname.startsWith("/api/")) {
		return NextResponse.next();
	}

	// Rute privat wajib sesi
	const isProtected = PROTECTED_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);
	if (!isProtected) {
		return NextResponse.next();
	}

	// Verifikasi JWT sesi — bukan sekadar keberadaan cookie.
	// Cookie spoofed tanpa signature valid → ditolak di sini.
	const token = request.cookies.get("sb-access-token")?.value;
	if (token) {
		const claims = await verifySessionJwt(token);
		if (claims?.sub) {
			return NextResponse.next();
		}
	}

	// Tanpa sesi valid → 307 ke /login dengan `next` yang disanitasi.
	// localStorage flag (drivee_logged_in) sengaja TIDAK dipercaya:
	// bisa dipalsukan dari DevTools tanpa sesi server yang valid.
	const destination = sanitizeNextPath(`${pathname}${search}` || "/go");
	const loginUrl = new URL(
		`/login?next=${encodeURIComponent(destination)}`,
		request.url,
	);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	// Jalankan middleware di semua path kecuali aset statis & file PWA
	matcher: [
		"/((?!_next/|favicon.ico|sw.js|manifest.json|offline.html|icon-|icon.svg|browserconfig.xml).*)",
	],
};
