import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// middleware.ts — Route Protection (Invisible Security layer 0)
//
// Kontrak (tests/e2e/harness/auth-guard.ts · PROJECT.md §F10-12):
//  - Rute privat WAJIB login: /admin, /company, /rewards,
//    /special-track, /verify, /go
//  - Pengunjung tanpa sesi → 307 redirect ke /login?next=<path>
//  - localStorage TIDAK dipercaya — hanya cookie sesi server
//    (sb-access-token disetel oleh /auth/callback setelah PKCE
//    exchange; next-auth.session-token untuk kompatibilitas lama)
//  - Parameter `next` disanitasi: hanya path internal relatif,
//    mencegah open-redirect
// ─────────────────────────────────────────────────────────────

/** Rute privat yang wajib sesi valid */
export const PROTECTED_ROUTES = [
	'/admin',
	'/company',
	'/rewards',
	'/special-track',
	'/verify',
	'/go',
];

/** Rute publik — tidak pernah diblokir middleware */
export const PUBLIC_ROUTES = [
	'/',
	'/login',
	'/landing',
	'/register',
	'/auth/callback',
	'/api/auth',
];

/** Cookie sesi yang diakui (Supabase PKCE + legacy next-auth) */
const SESSION_COOKIE_NAMES = [
	'sb-access-token',
	'next-auth.session-token',
	'__Secure-next-auth.session-token',
];

function hasSessionCookie(request: NextRequest): boolean {
	return SESSION_COOKIE_NAMES.some((name) =>
		Boolean(request.cookies.get(name)?.value),
	);
}

/**
 * Sanitasi parameter `next`: hanya path internal relatif yang
 * diizinkan (dimulai satu '/', bukan '//', '\', atau URL absolut)
 * untuk mencegah open-redirect ke domain eksternal.
 */
function sanitizeNextPath(rawPath: string): string {
	if (
		rawPath.startsWith('/') &&
		!rawPath.startsWith('//') &&
		!rawPath.includes('\\')
	) {
		return rawPath;
	}
	return '/go';
}

export function middleware(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	// API routes melakukan otorisasi sendiri di route handler
	// (mis. /api/trips/verify memverifikasi hash & UUID payload)
	if (pathname.startsWith('/api/')) {
		return NextResponse.next();
	}

	// Rute privat wajib sesi
	const isProtected = PROTECTED_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);
	if (!isProtected) {
		return NextResponse.next();
	}

	// Sudah punya cookie sesi → lanjutkan
	if (hasSessionCookie(request)) {
		return NextResponse.next();
	}

	// Tanpa sesi → 307 ke /login dengan `next` yang disanitasi.
	// localStorage flag (drivee_logged_in) sengaja TIDAK dipercaya:
	// bisa dipalsukan dari DevTools tanpa sesi server yang valid.
	const destination = sanitizeNextPath(`${pathname}${search}` || '/go');
	const loginUrl = new URL(
		`/login?next=${encodeURIComponent(destination)}`,
		request.url,
	);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	// Jalankan middleware di semua path kecuali aset statis & file PWA
	matcher: [
		'/((?!_next/|favicon.ico|sw.js|manifest.json|offline.html|icon-|icon.svg|browserconfig.xml).*)',
	],
};
