/**
 * Tier 1: Feature Coverage — Special Track Admin (publish & review)
 *
 * Requirements:
 * - Hanya user dengan app_metadata.role = 'admin' yang boleh mengelola lowongan.
 * - Role WAJIB dibaca dari app_metadata (sesi terverifikasi), bukan user_metadata.
 * - Ketiadaan database harus dijawab 503, bukan daftar kosong yang terlihat normal.
 * - Pembuatan lowongan memvalidasi input dan melaporkan SEMUA error sekaligus.
 * - Lowongan yang sudah punya lamaran tidak boleh dihapus diam-diam.
 * - Lamaran yang gagal dinilai tidak boleh membalas sukses palsu.
 *
 * Background: dua lowongan Special Track sebelumnya hanya bisa dibuat lewat
 * penyuntingan manual SQL — tidak ada alur publish sama sekali.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH as applicationPatch } from "@/app/api/admin/special-track/applications/[id]/route";
import { GET as applicationsGet } from "@/app/api/admin/special-track/applications/route";
import {
	DELETE as jobDelete,
	PATCH as jobPatch,
} from "@/app/api/admin/special-track/jobs/[id]/route";
import {
	GET as jobsGet,
	POST as jobsPost,
} from "@/app/api/admin/special-track/jobs/route";
import { POST as tripReview } from "@/app/api/admin/trips/review/route";
import {
	isAdminClaims,
	requireAdmin,
	resolveAdminIdentity,
} from "@/lib/admin-auth";
import { adminErrorStatus, validateJobInput } from "@/lib/special-track-admin";

function readSource(path: string): string {
	return readFileSync(resolve(process.cwd(), path), "utf-8");
}

/** Stub hanya /auth/v1/user; sisanya diteruskan ke fetch harness. */
function stubAuthApi(role: "admin" | "user" | "invalid" | "malformed") {
	const passthrough = globalThis.fetch;
	return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.toString()
					: (input as Request).url;

		if (url.includes("/auth/v1/user")) {
			if (role === "invalid") return new Response("{}", { status: 401 });
			if (role === "malformed") return new Response("[]", { status: 200 });
			return new Response(
				JSON.stringify({
					id: role === "admin" ? "admin-uid-1" : "member-uid-1",
					email: `${role}@briga.id`,
					// Sengaja TIDAK menyalin role ke user_metadata.
					app_metadata: role === "admin" ? { role: "admin" } : {},
					user_metadata: {
						full_name: role === "admin" ? "Admin Palsu" : "Driver",
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}

		return passthrough(input, init);
	});
}

function request(
	url: string,
	cookie?: string,
	init?: Record<string, unknown>,
): NextRequest {
	return new NextRequest(url, {
		...init,
		headers: {
			...((init?.headers as Record<string, string>) ?? {}),
			...(cookie ? { cookie: `sb-access-token=${cookie}` } : {}),
		},
	} as ConstructorParameters<typeof NextRequest>[1]);
}

beforeEach(() => {
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

// ─────────────────────────────────────────────────────────────
describe("Tier 1: Admin Authorization — app_metadata role", () => {
	it("1.1: hanya app_metadata yang dibaca sebagai sumber role", () => {
		// Ini inti dari helper: user_metadata bisa diubah pemilik akun sendiri,
		// sehingga mencadangkan admin dari sana berarti setiap orang bisa lifting diri.
		expect(isAdminClaims({ app_metadata: { role: "admin" } })).toBe(true);
		expect(isAdminClaims({ user_metadata: { role: "admin" } })).toBe(false);
		expect(
			isAdminClaims({ app_metadata: {}, user_metadata: { role: "admin" } }),
		).toBe(false);
	});

	it("1.2: menolak null, undefined, dan role yang tidak dikenal", () => {
		expect(isAdminClaims(null)).toBe(false);
		expect(isAdminClaims(undefined)).toBe(false);
		expect(isAdminClaims({})).toBe(false);
		expect(isAdminClaims({ app_metadata: { role: "superadmin" } })).toBe(false);
		expect(isAdminClaims({ app_metadata: { role: 123 } })).toBe(false);
	});

	it("1.3: nama role tidak membedakan huruf besar-kecil", () => {
		expect(isAdminClaims({ app_metadata: { role: "Admin" } })).toBe(true);
		expect(isAdminClaims({ app_metadata: { role: "ADMIN" } })).toBe(true);
	});

	it("1.4: tanpa cookie sesi menghasilkan 401, bukan error", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const result = await resolveAdminIdentity(
			request("http://localhost:3000/x"),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(401);
			expect(result.error).toContain("Sesi tidak ditemukan");
		}
	});

	it("1.5: sesi non-admin menghasilkan 403 dan ID admin tidak dikembalikan", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const result = await resolveAdminIdentity(
			request("http://localhost:3000/x", "member-token"),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.status).toBe(403);
	});

	it("1.6: sesi dengan role admin di app_metadata diterima beserta identitasnya", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const result = await resolveAdminIdentity(
			request("http://localhost:3000/x", "admin-token"),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.admin.id).toBe("admin-uid-1");
			expect(result.admin.email).toBe("admin@briga.id");
		}
	});

	it("1.7: respons Auth yang tidak berbentuk objek ditolak fail-closed", async () => {
		// Array `[]` adalah bentuk respons yang mungkin terjadi; tidak boleh
		// diperlakukan sebagai admin.
		vi.stubGlobal("fetch", stubAuthApi("malformed"));
		const result = await resolveAdminIdentity(
			request("http://localhost:3000/x", "admin-token"),
		);
		expect(result.ok).toBe(false);
	});

	it("1.8: requireAdmin mengembalikan objek NextResponse, bukan melempar error", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const gate = await requireAdmin(
			request("http://localhost:3000/x", "member-token"),
		);
		expect(gate.ok).toBe(false);
		if (!gate.ok) {
			expect(gate.response.status).toBe(403);
			await expect(gate.response.json()).resolves.toMatchObject({
				success: false,
			});
		}
	});
});

// ─────────────────────────────────────────────────────────────
describe("Tier 1: Admin Route Gating — semua handler dilindungi", () => {
	const adminUrl = "http://localhost:3000/api/admin/special-track";

	it("2.1: GET /admin/special-track/jobs menolak tanpa sesi dengan 401", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await jobsGet(request(`${adminUrl}/jobs`));
		expect(res.status).toBe(401);
	});

	it("2.2: GET /admin/special-track/jobs menolak non-admin dengan 403", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await jobsGet(request(`${adminUrl}/jobs`, "member-token"));
		expect(res.status).toBe(403);
	});

	it("2.3: POST /admin/special-track/jobs menolak non-admin dengan 403", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await jobsPost(
			request(`${adminUrl}/jobs`, "member-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "x", description: "y" }),
			}),
		);
		expect(res.status).toBe(403);
	});

	it("2.4: PATCH lowongan menolak non-admin dengan 403", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await jobPatch(
			request(`${adminUrl}/jobs/job-1`, "member-token", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "closed" }),
			}),
			{ params: { id: "job-1" } },
		);
		expect(res.status).toBe(403);
	});

	it("2.5: DELETE lowongan menolak non-admin dengan 403", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await jobDelete(
			request(`${adminUrl}/jobs/job-1`, "member-token"),
			{
				params: { id: "job-1" },
			},
		);
		expect(res.status).toBe(403);
	});

	it("2.6: GET lamaran menolak non-admin dengan 403", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await applicationsGet(
			request(`${adminUrl}/applications`, "member-token"),
		);
		expect(res.status).toBe(403);
	});

	it("2.7: PATCH lamaran menolak non-admin dengan 403", async () => {
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await applicationPatch(
			request(`${adminUrl}/applications/app-1`, "member-token", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "accepted" }),
			}),
			{ params: { id: "app-1" } },
		);
		expect(res.status).toBe(403);
	});

	it("2.8: /api/admin/trips/review menolak non-admin dengan 403", async () => {
		// Endpoint ini menambah saldo BrigaCoin; sebelumnya tanpa cek admin.
		vi.stubGlobal("fetch", stubAuthApi("user"));
		const res = await tripReview(
			request("http://localhost:3000/api/admin/trips/review", "member-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ trip_id: "trip-1", decision: "VERIFIED" }),
			}),
		);
		expect(res.status).toBe(403);
	});

	it("2.9: /api/admin/trips/review menolak tanpa sesi dengan 401", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await tripReview(
			request("http://localhost:3000/api/admin/trips/review", undefined, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ trip_id: "trip-1", decision: "VERIFIED" }),
			}),
		);
		expect(res.status).toBe(401);
	});
});

// ─────────────────────────────────────────────────────────────
describe("Tier 1: Special Track Admin — Honest Failure Modes", () => {
	const jobsUrl = "http://localhost:3000/api/admin/special-track/jobs";

	it("3.1: admin dengan DB tidak terkonfigurasi mendapat 503, bukan daftar kosong", async () => {
		vi.resetModules();
		const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		process.env.SUPABASE_SERVICE_ROLE_KEY = "";

		try {
			vi.stubGlobal("fetch", stubAuthApi("admin"));
			const fresh = await import("@/app/api/admin/special-track/jobs/route");
			const res = await fresh.GET(request(jobsUrl, "admin-token"));
			const data = await res.json();

			expect(res.status).toBe(503);
			expect(data.success).toBe(false);
			expect(data.code).toBe("not_configured");
			// Tidak boleh jatuh ke daftar kosong yang terlihat "normal".
			expect(data.data).toBeUndefined();
		} finally {
			process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
		}
	});

	it("3.2: POST tanpa kolom wajib ditolak 400 dengan daftar errors", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await jobsPost(
			request(jobsUrl, "admin-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.success).toBe(false);
		expect(Array.isArray(data.errors)).toBe(true);
		expect(data.errors.length).toBeGreaterThan(0);
		expect(data.data).toBeUndefined();
	});

	it("3.3: POST dengan body bukan JSON ditolak 400, bukan 500", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await jobsPost(
			request(jobsUrl, "admin-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "bukan json",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("3.4: PATCH dengan status tidak dikenal ditolak 400", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await jobPatch(
			request(`${jobsUrl}/job-1`, "admin-token", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "hampir-jadi" }),
			}),
			{ params: { id: "job-1" } },
		);
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.error).toContain("open");
	});

	it("3.5: PATCH lamaran dengan status di luar daftar review ditolak 400", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await applicationPatch(
			request(
				"http://localhost:3000/api/admin/special-track/applications/app-1",
				"admin-token",
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "submitted" }),
				},
			),
			{ params: { id: "app-1" } },
		);
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.success).toBe(false);
	});

	it("3.6: filter status yang tidak dikenal pada GET lamaran ditolak 400", async () => {
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await applicationsGet(
			request(
				"http://localhost:3000/api/admin/special-track/applications?status=entah",
				"admin-token",
			),
		);
		expect(res.status).toBe(400);
	});

	it("3.7: admin dengan DB terpasang melihat daftar kosong, bukan error", async () => {
		// Harness membalas `[]`; ini kondisi "memang belum ada lowongan".
		vi.stubGlobal("fetch", stubAuthApi("admin"));
		const res = await jobsGet(request(jobsUrl, "admin-token"));
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.data).toEqual([]);
	});

	it("3.8: adminErrorStatus memetakan kode ke status HTTP yang tepat", () => {
		expect(adminErrorStatus("not_configured")).toBe(503);
		expect(adminErrorStatus("not_found")).toBe(404);
		expect(adminErrorStatus("invalid_input")).toBe(400);
		expect(adminErrorStatus("db_error")).toBe(500);
	});
});

// ─────────────────────────────────────────────────────────────
describe("Tier 1: Special Track Admin — Input Validation", () => {
	it("4.1: judul dan deskripsi kosong ditolak", () => {
		const result = validateJobInput({ title: "   ", description: "" });
		expect(result.ok).toBe(false);
		expect(result.value).toBeNull();
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});

	it("4.2: melaporkan SEMUA error sekaligus, bukan hanya yang pertama", () => {
		const result = validateJobInput({
			title: "",
			description: "",
			vehicleCategory: "deluxe",
			minEcoScore: 150,
			status: "mau",
		});
		expect(result.ok).toBe(false);
		// judul, deskripsi, kategori, skor, status
		expect(result.errors.length).toBeGreaterThanOrEqual(5);
	});

	it("4.3: requirements dari teks baris-per-baris dibersihkan", () => {
		const result = validateJobInput({
			title: "Job",
			description: "Desc",
			requirements: "SIM B1\n\n  Minimal 1 tahun  \n",
		});
		expect(result.ok).toBe(true);
		expect(result.value?.requirements).toEqual(["SIM B1", "Minimal 1 tahun"]);
	});

	it("4.4: requirements dari array dipertahankan urutannya", () => {
		const result = validateJobInput({
			title: "Job",
			description: "Desc",
			requirements: ["A", " B ", ""],
		});
		expect(result.ok).toBe(true);
		expect(result.value?.requirements).toEqual(["A", "B"]);
	});

	it("4.5: requirements kosong diizinkan — lowongan boleh tanpa persyaratan", () => {
		const result = validateJobInput({
			title: "Job",
			description: "Desc",
			requirements: [],
		});
		expect(result.ok).toBe(true);
		expect(result.value?.requirements).toEqual([]);
	});

	it("4.6: minEcoScore di luar rentang ditolak, batas 0 dan 100 diterima", () => {
		expect(
			validateJobInput({ title: "J", description: "D", minEcoScore: 101 }).ok,
		).toBe(false);
		expect(
			validateJobInput({ title: "J", description: "D", minEcoScore: -1 }).ok,
		).toBe(false);
		expect(
			validateJobInput({ title: "J", description: "D", minEcoScore: 0 }).ok,
		).toBe(true);
		expect(
			validateJobInput({ title: "J", description: "D", minEcoScore: 100 }).ok,
		).toBe(true);
		expect(
			validateJobInput({ title: "J", description: "D", minEcoScore: "85" })
				.value?.minEcoScore,
		).toBe(85);
	});

	it("4.7: minEcoScore kosong berarti tanpa ambang, bukan nol", () => {
		const result = validateJobInput({
			title: "J",
			description: "D",
			minEcoScore: "",
		});
		expect(result.ok).toBe(true);
		expect(result.value?.minEcoScore).toBeNull();
	});

	it("4.8: kategori kendaraan di luar daftar yang dikenal ditolak", () => {
		expect(
			validateJobInput({
				title: "J",
				description: "D",
				vehicleCategory: "deluxe",
			}).ok,
		).toBe(false);
		expect(
			validateJobInput({
				title: "J",
				description: "D",
				vehicleCategory: "premium",
			}).ok,
		).toBe(true);
		expect(
			validateJobInput({ title: "J", description: "D", vehicleCategory: "" })
				.value?.vehicleCategory,
		).toBeNull();
	});

	it('4.9: status default adalah "open" saat tidak diisi', () => {
		expect(
			validateJobInput({ title: "J", description: "D" }).value?.status,
		).toBe("open");
		expect(
			validateJobInput({ title: "J", description: "D", status: "closed" }).value
				?.status,
		).toBe("closed");
	});

	it("4.10: judul dipangkas spasi dan companyId kosong menjadi null", () => {
		const result = validateJobInput({
			title: "  Paging  ",
			description: "  Desc  ",
			companyId: "   ",
		});
		expect(result.ok).toBe(true);
		expect(result.value?.title).toBe("Paging");
		expect(result.value?.description).toBe("Desc");
		expect(result.value?.companyId).toBeNull();
	});

	it("4.11: body non-objek ditolak dengan aman, tidak melempar error", () => {
		expect(validateJobInput(null).ok).toBe(false);
		expect(validateJobInput("string").ok).toBe(false);
		expect(validateJobInput(42).ok).toBe(false);
		expect(validateJobInput([1, 2, 3]).ok).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────
describe("Tier 1: Special Track Admin — Schema & Migration 011", () => {
	it("5.1: migrasi 011 menambahkan kolom audit lowongan", () => {
		const sql = readSource("supabase/migrations/011_special_track_admin.sql");
		expect(sql).toContain("created_by");
		expect(sql).toContain("closed_at");
		expect(sql).toContain("is_seed");
		expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/i);
	});

	it("5.2: migrasi 011 menambahkan kolom review lamaran", () => {
		const sql = readSource("supabase/migrations/011_special_track_admin.sql");
		expect(sql).toContain("reviewed_by");
		expect(sql).toContain("reviewed_at");
		expect(sql).toContain("review_note");
	});

	it("5.3: lowongan seed ditandai, tidak dihapus diam-diam", () => {
		const sql = readSource("supabase/migrations/011_special_track_admin.sql");
		expect(sql).toContain("UPDATE special_track_jobs");
		expect(sql).toContain("is_seed = TRUE");
		// Tidak boleh ada DELETE FROM special_track_jobs.
		expect(sql).not.toMatch(/DELETE\s+FROM\s+special_track_jobs/i);
		// Lowongan bertanda perusahaan tidak ikut ditandai.
		expect(sql).toContain("company_id IS NULL");
	});

	it("5.4: trigger updated_at mengatur closed_at sesuai transisi status", () => {
		const sql = readSource("supabase/migrations/011_special_track_admin.sql");
		expect(sql).toContain("trg_special_track_jobs_updated_at");
		expect(sql).toContain("NEW.updated_at = NOW()");
		expect(sql).toContain("NEW.closed_at = NOW()");
		expect(sql).toContain("NEW.closed_at = NULL");
	});

	it("5.5: created_by dan reviewed_by sengaja tanpa FK ke drivers", () => {
		// Admin belum tentu punya baris driver; imposing FK akan menggagalkan simpan.
		const sql = readSource("supabase/migrations/011_special_track_admin.sql");
		const fkLines = sql
			.split("\n")
			.filter((line) => /REFERENCES\s+drivers/i.test(line));
		expect(fkLines).toHaveLength(0);
		expect(sql).toContain("TANPA foreign key");
	});

	it("5.6: tipe schema TypeScript sudah sinkron dengan migrasi 011", () => {
		const schema = readSource("src/lib/supabase/schema.ts");
		const jobsBlock = schema.slice(
			schema.indexOf("special_track_jobs: {"),
			schema.indexOf("special_track_applications: {"),
		);
		expect(jobsBlock).toContain("created_by?");
		expect(jobsBlock).toContain("closed_at?");
		expect(jobsBlock).toContain("is_seed?");

		const appsBlock = schema.slice(
			schema.indexOf("special_track_applications: {"),
		);
		expect(appsBlock).toContain("reviewed_by?");
		expect(appsBlock).toContain("review_note?");
	});

	it("5.7: companies.id tetap VARCHAR — tidak boleh berubah jadi UUID", () => {
		// Regresi dari migrasi 010: FK UUID ke companies.id varchar gagal 42804.
		const sql = readSource("supabase/migrations/011_special_track_admin.sql");
		expect(sql).not.toMatch(/company_id\s+UUID/i);
	});

	it("5.8: supabase/server.ts tidak melempar saat key kosong", () => {
		// createClient melempar "supabaseKey is required" di lingkup modul,
		// sehingga konfigurasi tidak lengkap berubah crash, bukan 503.
		const server = readSource("src/lib/supabase/server.ts");
		expect(server).toMatch(/supabaseServiceKey \|\| ["']not-configured["']/);
		expect(server).toContain("isAdminConfigured");
	});

	it("5.9: halaman admin tidak lagi menampilkan lowongan hardcode", () => {
		const page = readSource("src/app/admin/special-track/page.tsx");
		expect(page).toContain("/api/admin/special-track/jobs");
		expect(page).toContain("/api/admin/special-track/applications");
		expect(page).not.toMatch(/mock:\s*true/i);
	});

	it("5.10: halaman admin menangani 401/403 secara eksplisit", () => {
		const page = readSource("src/app/admin/special-track/page.tsx");
		expect(page).toContain("res.status === 401");
		expect(page).toContain("res.status === 403");
	});
});
