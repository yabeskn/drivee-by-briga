// ─────────────────────────────────────────────────────────────
// admin-auth.ts — Otorisasi admin berbasis sesi Supabase terverifikasi
//
// Latar belakang: repo ini TIDAK PUNYA konsep role admin sama sekali.
// Middleware hanya memastikan "sudah login", sehingga endpoint seperti
// /api/admin/trips/review (bisa menambah saldo BrigaCoin) bisa dipanggil
// oleh setiap pengguna yang punya sesi. Helper ini menutup celah itu.
//
// Prinsip yang dijaga:
//   - Server-authoritative. Role dibaca dari sesi yang diverifikasi ke
//     Supabase Auth, BUKAN dari header/body yang dikirim klien.
//   - app_metadata, bukan user_metadata. `user_metadata` bisa diubah sendiri
//     oleh pemilik akun (updateUser), jadi mencadangkan admin dari sana akan
//     berarti setiap pengguna bisalifting dirinya jadi admin.
//   - Fail-closed. Tanpa cookie / token invalid / role bukan admin → ditolak.
//   - 401 vs 403 dibedakan: 401 = tidak masuk, 403 = masuk tapi bukan admin.
// ─────────────────────────────────────────────────────────────

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Nilai yang harus ada di `app_metadata.role` agar dianggap admin. */
export const ADMIN_ROLE = "admin";

export interface AdminIdentity {
	id: string;
	email: string | null;
}

export interface AdminUserClaims {
	id?: string;
	email?: string;
	app_metadata?: Record<string, unknown> | null;
	user_metadata?: Record<string, unknown> | null;
}

export type AdminGateResult =
	| { ok: true; admin: AdminIdentity }
	| { ok: false; response: NextResponse };

/**
 * Apakah klaim user dari Auth API menyatakan dia admin?
 *
 * Fungsi murni (tanpa I/O) supaya bisa diuji tanpa jaringan.
 * Sengaja HANYA membaca `app_metadata`.
 */
export function isAdminClaims(
	user: AdminUserClaims | null | undefined,
): boolean {
	const role = user?.app_metadata?.role;
	return typeof role === "string" && role.toLowerCase() === ADMIN_ROLE;
}

/**
 * Ambil identitas admin dari cookie sesi, diverifikasi ke Supabase Auth.
 *
 * Mengembalikan objek UNION yang bisa dibedakan oleh `ok`, bukan dengan
 * nilai null — supaya pemanggil tidak bisa diam-diam memperlakukan
 * "gagal resolve" sebagai "admin".
 */
export async function resolveAdminIdentity(
	request: NextRequest,
): Promise<
	| { ok: true; admin: AdminIdentity }
	| { ok: false; status: 401 | 403; error: string }
> {
	const token = request.cookies.get("sb-access-token")?.value;
	if (!token) {
		return {
			ok: false,
			status: 401,
			error: "Sesi tidak ditemukan. Silakan masuk.",
		};
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !anonKey) {
		// Tanpa konfigurasi Auth tidak ada cara memverifikasi admin.
		// Menolak, bukan mengizinkan.
		return {
			ok: false,
			status: 401,
			error:
				"Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
		};
	}

	let user: AdminUserClaims;
	try {
		const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
			headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
		});
		if (!res.ok) {
			return {
				ok: false,
				status: 401,
				error: "Sesi tidak valid atau sudah berakhir.",
			};
		}
		user = (await res.json()) as AdminUserClaims;
	} catch {
		return {
			ok: false,
			status: 401,
			error: "Gagal memverifikasi sesi ke Supabase Auth.",
		};
	}

	if (!user?.id) {
		return {
			ok: false,
			status: 401,
			error: "Sesi tidak valid atau sudah berakhir.",
		};
	}

	if (!isAdminClaims(user)) {
		return {
			ok: false,
			status: 403,
			error: "Akses admin diperlukan. Akun ini tidak memiliki role admin.",
		};
	}

	return {
		ok: true,
		admin: { id: user.id, email: user.email ?? null },
	};
}

/**
 * Gerbang standar untuk route handler admin.
 *
 * Pemakaian:
 *   const gate = await requireAdmin(request);
 *   if (!gate.ok) return gate.response;
 *   // gate.admin.id sekarang aman dipakai sebagai created_by / reviewed_by
 */
export async function requireAdmin(
	request: NextRequest,
): Promise<AdminGateResult> {
	const result = await resolveAdminIdentity(request);

	if (result.ok) return { ok: true, admin: result.admin };

	return {
		ok: false,
		response: NextResponse.json(
			{ success: false, error: result.error },
			{ status: result.status },
		),
	};
}
