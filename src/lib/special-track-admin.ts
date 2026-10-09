// ─────────────────────────────────────────────────────────────
// special-track-admin.ts — Operasi admin atas lowongan Special Track
//
// Terpisah dari special-track.ts (jalur driver) dengan sengaja:
//   - special-track.ts    : apa yang boleh dan tidak boleh dilakukan driver
//   - special-track-admin.ts: membuat, menutup, dan menilai lamaran
//
// Prinsip yang sama dipegang:
//   - Tidak ada data tiruan. Bila DB tidak terkonfigurasi, hasilnya adalah
//     `code: 'not_configured'`, bukan daftar kosong yang terlihat "normal".
//   - Error database tidak diterjemahkan jadi sukses.
//   - Hitung jumlah lamaran lewat query terpisah, bukan PostgREST embed,
//     demi konsisten dengan pelajaran di getDriverEligibility(): relasi
//     yang tidak dijamin ada FK-nya akan membuat seluruh query gagal.
// ─────────────────────────────────────────────────────────────

import type {
	SpecialTrackApplicationStatus,
	SpecialTrackJobStatus,
} from "@/lib/special-track";
import { parseRequirements } from "@/lib/special-track";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";
import type { VehicleCategory } from "@/types/telematics";

export const VEHICLE_CATEGORIES: readonly VehicleCategory[] = [
	"standard",
	"professional",
	"premium",
	"premium_plus",
];

export const JOB_STATUSES: readonly SpecialTrackJobStatus[] = [
	"open",
	"closed",
];

/** Status lamaran yang boleh dipilih admin lewat UI review. */
export const REVIEW_STATUSES: readonly SpecialTrackApplicationStatus[] = [
	"reviewing",
	"accepted",
	"rejected",
];

const MAX_TITLE = 255;
const MAX_REQUIREMENTS = 20;
const MAX_REQUIREMENT_LENGTH = 200;

export interface AdminJobInput {
	title: string;
	description: string;
	requirements: string[];
	vehicleCategory: VehicleCategory | null;
	minEcoScore: number | null;
	status: SpecialTrackJobStatus;
	companyId: string | null;
}

export interface JobInputValidation {
	ok: boolean;
	/** Semua alasan penolakan sekaligus, bukan hanya yang pertama. */
	errors: string[];
	value: AdminJobInput | null;
}

export interface AdminJobView {
	id: string;
	companyId: string | null;
	title: string;
	description: string;
	requirements: string[];
	vehicleCategory: VehicleCategory | null;
	minEcoScore: number | null;
	status: SpecialTrackJobStatus;
	createdAt: string;
	updatedAt: string | null;
	closedAt: string | null;
	createdBy: string | null;
	isSeed: boolean;
	applicationCount: number;
}

export interface AdminApplicationView {
	id: string;
	jobId: string;
	driverId: string;
	driverName: string | null;
	driverEmail: string | null;
	driverPhone: string | null;
	status: SpecialTrackApplicationStatus;
	ecoScoreAtApply: number | null;
	vehicleCategoryAtApply: string | null;
	createdAt: string;
	reviewedAt: string | null;
	reviewNote: string | null;
}

export type AdminErrorCode =
	| "not_configured"
	| "not_found"
	| "db_error"
	| "invalid_input";

export type AdminResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; code: AdminErrorCode };

function asRecord(raw: unknown): Record<string, unknown> {
	return raw && typeof raw === "object" && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: {};
}

/**
 * Validasi & normalisasi payload(lowongan dari form admin.
 *
 * Fungsi murni tanpa I/O. Mengembalikan SEMUA error sekaligus supaya form
 * bisa menandai semua field bermasalah dalam satu putaran, dan supaya
 * penolakan selalu disertai alasan yang dapat ditindaklanjuti.
 */
export function validateJobInput(raw: unknown): JobInputValidation {
	const body = asRecord(raw);
	const errors: string[] = [];

	// ── title ──
	const title = typeof body.title === "string" ? body.title.trim() : "";
	if (!title) {
		errors.push("Judul lowongan wajib diisi.");
	} else if (title.length > MAX_TITLE) {
		errors.push(`Judul maksimal ${MAX_TITLE} karakter.`);
	}

	// ── description ──
	const description =
		typeof body.description === "string" ? body.description.trim() : "";
	if (!description) {
		errors.push("Deskripsi lowongan wajib diisi.");
	}

	// ── requirements ──
	// Menerima array maupun teks baris-per-baris (form textarea).
	let requirements: string[] = [];
	const rawReq = body.requirements;
	if (Array.isArray(rawReq)) {
		requirements = rawReq
			.filter((r): r is string => typeof r === "string")
			.map((r) => r.trim())
			.filter(Boolean);
	} else if (typeof rawReq === "string") {
		requirements = rawReq
			.split("\n")
			.map((r) => r.trim())
			.filter(Boolean);
	} else if (rawReq === undefined || rawReq === null) {
		requirements = [];
	} else {
		errors.push("requirements harus berupa daftar teks.");
	}

	if (requirements.length > MAX_REQUIREMENTS) {
		errors.push(`Maksimal ${MAX_REQUIREMENTS} persyaratan.`);
	}
	const tooLong = requirements.find((r) => r.length > MAX_REQUIREMENT_LENGTH);
	if (tooLong !== undefined) {
		errors.push(
			`Setiap persyaratan maksimal ${MAX_REQUIREMENT_LENGTH} karakter.`,
		);
	}

	// ── vehicleCategory ──
	let vehicleCategory: VehicleCategory | null = null;
	const rawCat = body.vehicleCategory;
	if (rawCat === undefined || rawCat === null || rawCat === "") {
		vehicleCategory = null;
	} else if (
		typeof rawCat === "string" &&
		VEHICLE_CATEGORIES.includes(rawCat as VehicleCategory)
	) {
		vehicleCategory = rawCat as VehicleCategory;
	} else {
		errors.push(
			`Kategori kendaraan tidak dikenal. Pilihan: ${VEHICLE_CATEGORIES.join(", ")}.`,
		);
	}

	// ── minEcoScore ──
	let minEcoScore: number | null = null;
	const rawScore = body.minEcoScore;
	if (rawScore === undefined || rawScore === null || rawScore === "") {
		minEcoScore = null;
	} else if (typeof rawScore === "number" && Number.isFinite(rawScore)) {
		if (rawScore < 0 || rawScore > 100) {
			errors.push("Skor eco minimal harus antara 0 dan 100.");
		} else {
			minEcoScore = Math.round(rawScore);
		}
	} else if (typeof rawScore === "string" && /^-?\d+$/.test(rawScore.trim())) {
		const parsed = Number(rawScore.trim());
		if (parsed < 0 || parsed > 100) {
			errors.push("Skor eco minimal harus antara 0 dan 100.");
		} else {
			minEcoScore = parsed;
		}
	} else {
		errors.push("Skor eco minimal harus berupa angka antara 0 dan 100.");
	}

	// ── status ──
	let status: SpecialTrackJobStatus = "open";
	const rawStatus = body.status;
	if (rawStatus === undefined || rawStatus === null || rawStatus === "") {
		status = "open";
	} else if (
		typeof rawStatus === "string" &&
		JOB_STATUSES.includes(rawStatus as SpecialTrackJobStatus)
	) {
		status = rawStatus as SpecialTrackJobStatus;
	} else {
		errors.push('Status lowongan harus "open" atau "closed".');
	}

	// ── companyId (opsional) ──
	let companyId: string | null = null;
	const rawCompany = body.companyId;
	if (rawCompany === undefined || rawCompany === null || rawCompany === "") {
		companyId = null;
	} else if (typeof rawCompany === "string") {
		const trimmed = rawCompany.trim();
		companyId = trimmed ? trimmed.slice(0, 255) : null;
	} else {
		errors.push("companyId harus berupa teks.");
	}

	if (errors.length > 0) {
		return { ok: false, errors, value: null };
	}

	return {
		ok: true,
		errors: [],
		value: {
			title,
			description,
			requirements,
			vehicleCategory,
			minEcoScore,
			status,
			companyId,
		},
	};
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
	updated_at: string | null;
	closed_at: string | null;
	created_by: string | null;
	is_seed: boolean | null;
}

function rowToAdminJob(row: JobRow, applicationCount: number): AdminJobView {
	return {
		id: row.id,
		companyId: row.company_id,
		title: row.title,
		description: row.description,
		requirements: parseRequirements(row.requirements),
		vehicleCategory: row.vehicle_category ?? null,
		minEcoScore: row.min_eco_score === null ? null : Number(row.min_eco_score),
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at ?? null,
		closedAt: row.closed_at ?? null,
		createdBy: row.created_by ?? null,
		isSeed: row.is_seed === true,
		applicationCount,
	};
}

/**
 * Daftar SEMUA lowongan (open maupun closed) untuk halaman tinjauan admin.
 * Berbeda dengan listOpenJobs() di special-track.ts yang sengaja hanya
 * menampilkan yang masih terbuka.
 */
export async function listAllJobsForAdmin(): Promise<
	AdminResult<AdminJobView[]>
> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			code: "not_configured",
			error:
				"Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
		};
	}

	const { data, error } = await supabaseAdmin
		.from("special_track_jobs")
		.select(
			"id, company_id, title, description, requirements, vehicle_category, min_eco_score, status, created_at, updated_at, closed_at, created_by, is_seed",
		)
		.order("created_at", { ascending: false });

	if (error) {
		console.error("[SpecialTrackAdmin] Gagal memuat lowongan:", error);
		return {
			success: false,
			code: "db_error",
			error: `Gagal memuat lowongan: ${error.message}`,
		};
	}

	const rows = (data ?? []) as unknown as JobRow[];

	// Hitung jumlah lamaran per lowongan lewat query terpisah.
	const counts = new Map<string, number>();
	if (rows.length > 0) {
		const { data: countsRaw } = await supabaseAdmin
			.from("special_track_applications")
			.select("job_id")
			.in(
				"job_id",
				rows.map((r) => r.id),
			);
		for (const row of (countsRaw ?? []) as unknown as { job_id: string }[]) {
			counts.set(row.job_id, (counts.get(row.job_id) ?? 0) + 1);
		}
	}

	return {
		success: true,
		data: rows.map((row) => rowToAdminJob(row, counts.get(row.id) ?? 0)),
	};
}

/** Buat lowongan baru. `adminId` berasal dari sesi terverifikasi. */
export async function createJob(
	input: AdminJobInput,
	adminId: string,
): Promise<AdminResult<AdminJobView>> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			code: "not_configured",
			error: "Database is not configured. Lowongan tidak dapat dibuat.",
		};
	}

	const { data, error } = await supabaseAdmin
		.from("special_track_jobs")
		.insert({
			title: input.title,
			description: input.description,
			requirements: input.requirements,
			vehicle_category: input.vehicleCategory,
			min_eco_score: input.minEcoScore,
			status: input.status,
			company_id: input.companyId,
			created_by: adminId,
			is_seed: false,
			// closed_at diisi bila langsung dibuat dalam keadaan tertutup,
			// supaya tidak ada lowongan "closed" tanpa jejak waktu ditutup.
			closed_at: input.status === "closed" ? new Date().toISOString() : null,
		})
		.select(
			"id, company_id, title, description, requirements, vehicle_category, min_eco_score, status, created_at, updated_at, closed_at, created_by, is_seed",
		)
		.single();

	// Array kosong dari `.single()` berarti tidak ada baris tersimpan; perlakukan
	// sebagai kegagalan supaya tidak pernah membalas 201 untuk lowongan fiktif.
	if (error || !data || Array.isArray(data)) {
		console.error(
			"[SpecialTrackAdmin] Gagal membuat lowongan:",
			error ?? "respons tanpa baris",
		);
		// Pelanggaran FK companies paling sering terjadi karena id perusahaan salah.
		const isForeignKey = error?.code === "23503";
		return {
			success: false,
			code: isForeignKey ? "invalid_input" : "db_error",
			error: isForeignKey
				? "companyId tidak merujuk perusahaan yang ada."
				: `Gagal menyimpan lowongan${error ? `: ${error.message}` : ": respons tanpa baris."}`,
		};
	}

	return { success: true, data: rowToAdminJob(data as unknown as JobRow, 0) };
}

/** Buka atau tutup lowongan. */
export async function setJobStatus(
	jobId: string,
	status: SpecialTrackJobStatus,
): Promise<AdminResult<AdminJobView>> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			code: "not_configured",
			error: "Database is not configured. Status lowongan tidak dapat diubah.",
		};
	}

	// closed_at diuruskan trigger trg_special_track_jobs_updated_at.
	const { data, error } = await supabaseAdmin
		.from("special_track_jobs")
		.update({ status })
		.eq("id", jobId)
		.select(
			"id, company_id, title, description, requirements, vehicle_category, min_eco_score, status, created_at, updated_at, closed_at, created_by, is_seed",
		)
		.maybeSingle();

	if (error) {
		console.error("[SpecialTrackAdmin] Gagal mengubah status lowongan:", error);
		return {
			success: false,
			code: "db_error",
			error: `Gagal mengubah status lowongan: ${error.message}`,
		};
	}

	if (!data || Array.isArray(data)) {
		return {
			success: false,
			code: "not_found",
			error: "Lowongan tidak ditemukan.",
		};
	}

	const { count } = await supabaseAdmin
		.from("special_track_applications")
		.select("id", { count: "exact", head: true })
		.eq("job_id", jobId);

	return {
		success: true,
		data: rowToAdminJob(data as unknown as JobRow, count ?? 0),
	};
}

/**
 * Hapus lowongan. Lamaran ikut terhapus (ON DELETE CASCADE).
 *
 * Penolakan bila lowongan sudah punya lamaran: menghapus diam-diam akan
 * membuang lamaran driver yang nyata. Admin harus menutup lowongan saja.
 */
export async function deleteJob(
	jobId: string,
): Promise<AdminResult<{ id: string }>> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			code: "not_configured",
			error: "Database is not configured. Lowongan tidak dapat dihapus.",
		};
	}

	const { count, error: countErr } = await supabaseAdmin
		.from("special_track_applications")
		.select("id", { count: "exact", head: true })
		.eq("job_id", jobId);

	if (countErr) {
		console.error("[SpecialTrackAdmin] Gagal menghitung lamaran:", countErr);
		return {
			success: false,
			code: "db_error",
			error: `Gagal memeriksa lamaran: ${countErr.message}`,
		};
	}

	if ((count ?? 0) > 0) {
		return {
			success: false,
			code: "invalid_input",
			error: `Lowongan memiliki ${count} lamaran dan tidak bisa dihapus. Tutup lowongan sebagai gantinya.`,
		};
	}

	const { data, error } = await supabaseAdmin
		.from("special_track_jobs")
		.delete()
		.eq("id", jobId)
		.select("id")
		.maybeSingle();

	if (error) {
		console.error("[SpecialTrackAdmin] Gagal menghapus lowongan:", error);
		return {
			success: false,
			code: "db_error",
			error: `Gagal menghapus lowongan: ${error.message}`,
		};
	}

	if (!data || Array.isArray(data)) {
		return {
			success: false,
			code: "not_found",
			error: "Lowongan tidak ditemukan.",
		};
	}

	return { success: true, data: { id: (data as { id: string }).id } };
}

interface ApplicationRow {
	id: string;
	job_id: string;
	driver_id: string;
	status: SpecialTrackApplicationStatus;
	eco_score_at_apply: number | null;
	vehicle_category_at_apply: string | null;
	created_at: string;
	reviewed_at: string | null;
	review_note: string | null;
}

interface DriverBriefRow {
	id: string;
	name: string | null;
	email: string | null;
	phone: string | null;
}

export interface ApplicationFilter {
	jobId?: string;
	status?: SpecialTrackApplicationStatus;
}

/**
 * Daftar lamaran untuk halaman review.
 *
 * Identitas driver diambil lewat query TERPISAH terhadap `drivers`, bukan
 * PostgREST embed `driver_id ( name, email )`: embed wajib punya FK yang
 * dijamin, dan kalau relasi berubah suatu saat seluruh endpoint ikut mati.
 */
export async function listApplicationsForAdmin(
	filter: ApplicationFilter = {},
): Promise<AdminResult<AdminApplicationView[]>> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			code: "not_configured",
			error: "Database is not configured. Lamaran tidak dapat dimuat.",
		};
	}

	let query = supabaseAdmin
		.from("special_track_applications")
		.select(
			"id, job_id, driver_id, status, eco_score_at_apply, vehicle_category_at_apply, created_at, reviewed_at, review_note",
		)
		.order("created_at", { ascending: false });

	if (filter.jobId) query = query.eq("job_id", filter.jobId);
	if (filter.status) query = query.eq("status", filter.status);

	const { data, error } = await query;

	if (error) {
		console.error("[SpecialTrackAdmin] Gagal memuat lamaran:", error);
		return {
			success: false,
			code: "db_error",
			error: `Gagal memuat lamaran: ${error.message}`,
		};
	}

	const rows = (data ?? []) as unknown as ApplicationRow[];

	// Profil driver untuk(UUID unik), sekali ambil.
	const driverIds = [...new Set(rows.map((r) => r.driver_id))];
	const drivers = new Map<string, DriverBriefRow>();
	if (driverIds.length > 0) {
		const { data: driverRows } = await supabaseAdmin
			.from("drivers")
			.select("id, name, email, phone")
			.in("id", driverIds);
		for (const d of (driverRows ?? []) as unknown as DriverBriefRow[]) {
			drivers.set(d.id, d);
		}
	}

	return {
		success: true,
		data: rows.map((row) => {
			const driver = drivers.get(row.driver_id);
			return {
				id: row.id,
				jobId: row.job_id,
				driverId: row.driver_id,
				driverName: driver?.name ?? null,
				driverEmail: driver?.email ?? null,
				driverPhone: driver?.phone ?? null,
				status: row.status,
				ecoScoreAtApply:
					row.eco_score_at_apply === null
						? null
						: Number(row.eco_score_at_apply),
				vehicleCategoryAtApply: row.vehicle_category_at_apply,
				createdAt: row.created_at,
				reviewedAt: row.reviewed_at ?? null,
				reviewNote: row.review_note ?? null,
			};
		}),
	};
}

/** Ubah status lamaran (reviewing / accepted / rejected). */
export async function setApplicationStatus(
	applicationId: string,
	status: SpecialTrackApplicationStatus,
	adminId: string,
	note?: string,
): Promise<AdminResult<{ id: string; status: SpecialTrackApplicationStatus }>> {
	if (!isAdminConfigured()) {
		return {
			success: false,
			code: "not_configured",
			error: "Database is not configured. Lamaran tidak dapat dinilai.",
		};
	}

	const { data, error } = await supabaseAdmin
		.from("special_track_applications")
		.update({
			status,
			reviewed_by: adminId,
			reviewed_at: new Date().toISOString(),
			review_note: note?.trim() ? note.trim() : null,
		})
		.eq("id", applicationId)
		.select("id, status")
		.maybeSingle();

	if (error) {
		console.error("[SpecialTrackAdmin] Gagal memperbarui lamaran:", error);
		return {
			success: false,
			code: "db_error",
			error: `Gagal memperbarui lamaran: ${error.message}`,
		};
	}

	if (!data || Array.isArray(data)) {
		return {
			success: false,
			code: "not_found",
			error: "Lamaran tidak ditemukan.",
		};
	}

	const row = data as { id: string; status: SpecialTrackApplicationStatus };
	return { success: true, data: { id: row.id, status: row.status } };
}

/** Petakan AdminErrorCode ke HTTP status yang tepat. */
export function adminErrorStatus(code: AdminErrorCode): number {
	switch (code) {
		case "not_configured":
			return 503;
		case "not_found":
			return 404;
		case "invalid_input":
			return 400;
		default:
			return 500;
	}
}
