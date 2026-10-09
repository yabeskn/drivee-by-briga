// ─────────────────────────────────────────────────────────────
// special-track.ts — Special Track: katalog lowongan & lamaran driver
//
// Domaining logika "/special-track" yang sebelumnya hanya ada sebagai
// data hardcode di dalam komponen React.
//
// Prinsip yang dijaga di sini:
//   - Server-authoritative. Kelayakan driver dinilai di server; UI hanya
//     menampilkan hasilnya. Klien tidak boleh bypass dengan mengedit state.
//   - Idempoten. Satu driver hanya bisa melamar satu kali per lowongan.
//     Dijamin oleh UNIQUE index di DB, bukan sekadar dicegah di aplikasi.
//   - Jujur soal kegagalan. Bila database tidak dikonfigurasi, fungsi
//     mengembalikan hasil yang menyatakan hal itu secara eksplisit —
//     bukan diam-diam mengembalikan lowongan palsu seolah-olah nyata.
// ─────────────────────────────────────────────────────────────

import type { NextRequest } from "next/server";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";
import type { VehicleCategory } from "@/types/telematics";

export type SpecialTrackJobStatus = "open" | "closed";
export type SpecialTrackApplicationStatus =
	| "submitted"
	| "reviewing"
	| "accepted"
	| "rejected"
	| "withdrawn";

export interface SpecialTrackJob {
	id: string;
	companyId: string | null;
	title: string;
	description: string;
	requirements: string[];
	vehicleCategory?: VehicleCategory;
	minEcoScore?: number;
	status: SpecialTrackJobStatus;
	createdAt: string;
}

export interface DriverEligibility {
	ecoScore: number | null;
	vehicleCategory: VehicleCategory | null;
}

export interface JobEligibilityCheck {
	eligible: boolean;
	/** Alasan singkat bilingual-ish yang aman ditampilkan langsung ke pengguna. */
	reasons: string[];
}

export interface ApplyResult {
	success: boolean;
	applicationId?: string;
	/** True bila driver sudah pernah melamar sebelumnya (idempoten). */
	duplicate?: boolean;
	status?: SpecialTrackApplicationStatus;
	error?: string;
}

export interface ListJobsResult {
	jobs: SpecialTrackJob[];
	/** Sumber data: 'database' bila dari Supabase, 'unavailable' bila tidak terpasang. */
	source: "database" | "unavailable";
}

interface JobRow {
	id: string;
	company_id: string | null;
	title: string;
	description: string;
	requirements: unknown;
	vehicle_category: VehicleCategory | null;
	min_eco_score: number | null;
	status: SpecialTrackJobStatus;
	created_at: string;
}

/** Normalisasi kolom JSONB requirements → string[] (dengan fallback aman). */
export function parseRequirements(raw: unknown): string[] {
	if (Array.isArray(raw)) {
		return raw.filter((item): item is string => typeof item === "string");
	}
	// Bila kolom datang sebagai string JSON (kadang terjadi lewat driver lain).
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(item): item is string => typeof item === "string",
				);
			}
		} catch {
			return [];
		}
	}
	return [];
}

export function rowToJob(row: JobRow): SpecialTrackJob {
	return {
		id: row.id,
		companyId: row.company_id,
		title: row.title,
		description: row.description,
		requirements: parseRequirements(row.requirements),
		vehicleCategory: row.vehicle_category ?? undefined,
		minEcoScore: row.min_eco_score ?? undefined,
		status: row.status,
		createdAt: row.created_at,
	};
}

/**
 * Daftar lowongan yang masih terbuka.
 *
 * Mengembalikan `source: 'unavailable'` (bukan daftar tiruan) bila Supabase
 * belum dikonfigurasi, supaya UI bisa memberi tahu pengguna dengan jujur
 * alih-alih menampilkan lowongan palsu yang tidak bisa dilamar.
 */
export async function listOpenJobs(): Promise<ListJobsResult> {
	if (!isAdminConfigured()) {
		return { jobs: [], source: "unavailable" };
	}

	const { data, error } = await supabaseAdmin
		.from("special_track_jobs")
		.select("*")
		.eq("status", "open")
		.order("created_at", { ascending: false });

	if (error) {
		console.error("[SpecialTrack] Gagal memuat lowongan:", error);
		return { jobs: [], source: "unavailable" };
	}

	return {
		jobs: ((data ?? []) as unknown as JobRow[]).map(rowToJob),
		source: "database",
	};
}

export async function getJobById(id: string): Promise<SpecialTrackJob | null> {
	if (!isAdminConfigured()) return null;

	const { data, error } = await supabaseAdmin
		.from("special_track_jobs")
		.select("*")
		.eq("id", id)
		.maybeSingle();

	if (error) {
		console.error("[SpecialTrack] Gagal memuat lowongan:", error);
		return null;
	}

	return data ? rowToJob(data as unknown as JobRow) : null;
}

/**
 * Nilai kelayakan driver terhadap suatu lowongan.
 *
 * Dievaluasi murni (fungsi takIOD) supaya bisa diuji tanpa database.
 */
export function evaluateEligibility(
	job: SpecialTrackJob,
	driver: DriverEligibility,
): JobEligibilityCheck {
	const reasons: string[] = [];

	if (job.status !== "open") {
		reasons.push("Lowongan sudah ditutup.");
	}

	if (typeof job.minEcoScore === "number") {
		if (driver.ecoScore === null) {
			reasons.push(
				`Skor eco Anda belum tersedia. Minimal ${job.minEcoScore} diperlukan untuk lowongan ini.`,
			);
		} else if (driver.ecoScore < job.minEcoScore) {
			reasons.push(
				`Skor eco Anda ${driver.ecoScore}, minimal ${job.minEcoScore} diperlukan untuk lowongan ini.`,
			);
		}
	}

	if (job.vehicleCategory) {
		if (!driver.vehicleCategory) {
			reasons.push(
				`Kategori kendaraan Anda belum terdaftar. Lowongan ini membutuhkan ${job.vehicleCategory}.`,
			);
		} else if (driver.vehicleCategory !== job.vehicleCategory) {
			reasons.push(
				`Kategori kendaraan Anda ${driver.vehicleCategory}, lowongan ini membutuhkan ${job.vehicleCategory}.`,
			);
		}
	}

	return { eligible: reasons.length === 0, reasons };
}

/**
 * Catat lamaran driver.
 *
 * Idempoten: melamar lowongan yang sama dua kali TIDAK menghasilkan dua baris.
 * Keunikan dijamin UNIQUE index `uq_special_track_application`, dan duplikat
 * diperlakukan sebagai hasil sukses (bukan error) agar retry dari UI aman.
 */
export async function applyToJob(
	jobId: string,
	driver: DriverEligibility & { id: string },
): Promise<ApplyResult> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			error: "Database is not configured. Lowongan belum dapat diakses.",
		};
	}

	const job = await getJobById(jobId);
	if (!job) {
		return { success: false, error: "Lowongan tidak ditemukan." };
	}

	const eligibility = evaluateEligibility(job, driver);
	if (!eligibility.eligible) {
		return {
			success: false,
			error: eligibility.reasons.join(" "),
		};
	}

	const { data, error } = await supabaseAdmin
		.from("special_track_applications")
		.insert({
			job_id: jobId,
			driver_id: driver.id,
			status: "submitted",
			eco_score_at_apply: driver.ecoScore,
			vehicle_category_at_apply: driver.vehicleCategory,
		})
		.select("id, status")
		.single();

	if (error) {
		// Pelanggaran UNIQUE → driver sudah pernah melamar lowongan ini.
		const isDuplicate =
			error.code === "23505" ||
			/duplicate key|unique/i.test(error.message ?? "");
		if (isDuplicate) {
			const existing = await findExistingApplication(jobId, driver.id);
			return {
				success: true,
				applicationId: existing?.id,
				duplicate: true,
				status: existing?.status ?? "submitted",
			};
		}

		console.error("[SpecialTrack] Gagal menyimpan lamaran:", error);
		return {
			success: false,
			error: "Gagal menyimpan lamaran. Silakan coba lagi.",
		};
	}

	return {
		success: true,
		applicationId: (data as { id: string }).id,
		duplicate: false,
		status: (data as { status: SpecialTrackApplicationStatus }).status,
	};
}

async function findExistingApplication(
	jobId: string,
	driverId: string,
): Promise<{ id: string; status: SpecialTrackApplicationStatus } | null> {
	const { data, error } = await supabaseAdmin
		.from("special_track_applications")
		.select("id, status")
		.eq("job_id", jobId)
		.eq("driver_id", driverId)
		.maybeSingle();

	if (error || !data) return null;
	return data as { id: string; status: SpecialTrackApplicationStatus };
}

/**
 * Ambil profil kelayakan driver dari tabel drivers.
 *
 * Kategori kendaraan diambil lewat query TERPISAH, bukan PostgREST embed
 * (`vehicle_id ( category )`). Kolom `drivers.vehicle_id` dibuat di luar
 * berkas migrasi dan tidak dijamin punya foreign key, sedangkan embed
 * PostgREST MEMBUTUHKAN relasi FK — kalau hilang, embed akan gagal total.
 */
export async function getDriverEligibility(
	driverId: string,
): Promise<(DriverEligibility & { id: string }) | null> {
	if (!isAdminConfigured()) return null;

	const { data, error } = await supabaseAdmin
		.from("drivers")
		.select("id, average_eco_score, vehicle_id")
		.eq("id", driverId)
		.maybeSingle();

	if (error) {
		console.error("[SpecialTrack] Gagal memuat profil driver:", error);
		return null;
	}
	if (!data) return null;

	const row = data as unknown as {
		id: string;
		average_eco_score: number | null;
		vehicle_id: string | null;
	};

	let vehicleCategory: VehicleCategory | null = null;
	if (row.vehicle_id) {
		const { data: vehicle } = await supabaseAdmin
			.from("vehicles")
			.select("category")
			.eq("id", row.vehicle_id)
			.maybeSingle();
		vehicleCategory =
			(vehicle as { category: VehicleCategory | null } | null)?.category ??
			null;
	}

	return {
		id: row.id,
		ecoScore:
			row.average_eco_score === null ? null : Number(row.average_eco_score),
		vehicleCategory,
	};
}

/**
 * Ambil user id dari cookie sesi, dengan verifikasi terhadap Supabase Auth API.
 *
 * Penting: driver id SELALU berasal dari sesi terverifikasi, TIDAK pernah dari
 * body request. Kalau diambil dari body, siapa pun bisa melamar atas nama driver
 * lain hanya dengan mengutak-atik payload.
 *
 * Mengembalikan null bila tidak ada sesi valid (fail-closed).
 */
export async function resolveSessionUserId(
	request: NextRequest,
): Promise<string | null> {
	const token = request.cookies.get("sb-access-token")?.value;
	if (!token) return null;

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !anonKey) return null;

	try {
		const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
			headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
		});
		if (!res.ok) return null;
		const user = (await res.json()) as { id?: string };
		return user.id ?? null;
	} catch {
		return null;
	}
}

/**
 * Petakan user id dari sesi ke baris driver.
 *
 * Di desain Unified BrigaCoin, `drivers.id` = auth uid (lihat trigger
 * trg_sync_driver_unified di migrasi 005). Jembatan `unified_identities`
 * tetap dikonsultasikan sebagai fallback untuk akun yang hanya terpetakan
 * lewat sistem briga.id.
 */
export async function resolveDriverFromSession(
	request: NextRequest,
): Promise<(DriverEligibility & { id: string }) | null> {
	const userId = await resolveSessionUserId(request);
	if (!userId) return null;

	const direct = await getDriverEligibility(userId);
	if (direct) return direct;

	// Fallback: lewat unified_identities (user_id -> driver_id)
	const { data, error } = await supabaseAdmin
		.from("unified_identities")
		.select("driver_id")
		.eq("user_id", userId)
		.maybeSingle();

	if (error || !data) return null;

	const driverId = (data as { driver_id: string | null }).driver_id;
	return driverId ? getDriverEligibility(driverId) : null;
}
