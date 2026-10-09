"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────
// /admin/special-track — kelola lowongan & tinjau lamaran
//
// Halaman ini menggantikan dua lowongan hasil seed migrasi 010 yang
// sebelumnya tidak punya jalur publish sama sekali.
//
// Setiap aksi talking ke API yang sudah dijaga requireAdmin(). Bila server
// membalas 403, halaman ini menampilkan apa adanya — bukan menyamar jadi
// "tidak ada lowongan".
// ─────────────────────────────────────────────────────────────

interface AdminJob {
	id: string;
	companyId: string | null;
	title: string;
	description: string;
	requirements: string[];
	vehicleCategory: string | null;
	minEcoScore: number | null;
	status: "open" | "closed";
	createdAt: string;
	closedAt: string | null;
	isSeed: boolean;
	applicationCount: number;
}

interface AdminApplication {
	id: string;
	jobId: string;
	driverId: string;
	driverName: string | null;
	driverEmail: string | null;
	driverPhone: string | null;
	status: string;
	ecoScoreAtApply: number | null;
	vehicleCategoryAtApply: string | null;
	createdAt: string;
	reviewedAt: string | null;
	reviewNote: string | null;
}

const VEHICLE_CATEGORIES = [
	"standard",
	"professional",
	"premium",
	"premium_plus",
];

const APPLICATION_STATUS_STYLES: Record<string, string> = {
	submitted: "bg-zinc-800 text-zinc-300",
	reviewing: "bg-amber-950 text-amber-300",
	accepted: "bg-emerald-950 text-emerald-300",
	rejected: "bg-red-950 text-red-300",
	withdrawn: "bg-zinc-900 text-zinc-500",
};

interface FormState {
	title: string;
	description: string;
	requirements: string;
	vehicleCategory: string;
	minEcoScore: string;
}

const EMPTY_FORM: FormState = {
	title: "",
	description: "",
	requirements: "",
	vehicleCategory: "",
	minEcoScore: "",
};

export default function AdminSpecialTrackPage() {
	const router = useRouter();

	const [jobs, setJobs] = useState<AdminJob[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [formErrors, setFormErrors] = useState<string[]>([]);
	const [creating, setCreating] = useState(false);

	const [busyJobId, setBusyJobId] = useState<string | null>(null);
	const [flash, setFlash] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	// ── Lamaran ──
	const [selectedJobId, setSelectedJobId] = useState<string>("");
	const [applications, setApplications] = useState<AdminApplication[]>([]);
	const [appsLoading, setAppsLoading] = useState(false);
	const [appsError, setAppsError] = useState<string | null>(null);
	const [reviewingId, setReviewingId] = useState<string | null>(null);

	const loadJobs = useCallback(async () => {
		try {
			setLoadError(null);
			const res = await fetch("/api/admin/special-track/jobs");
			const payload = await res.json();

			if (res.status === 401 || res.status === 403) {
				setJobs([]);
				setLoadError(payload?.error ?? "Akses ditolak.");
				return;
			}
			if (!res.ok || !payload.success) {
				setLoadError(payload?.error ?? "Gagal memuat lowongan.");
				return;
			}
			setJobs(payload.data ?? []);
		} catch {
			setLoadError("Gagal memuat lowongan. Periksa koneksi Anda.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadJobs();
	}, [loadJobs]);

	const loadApplications = useCallback(async (jobId: string) => {
		if (!jobId) {
			setApplications([]);
			setAppsError(null);
			return;
		}
		try {
			setAppsLoading(true);
			setAppsError(null);
			const res = await fetch(
				`/api/admin/special-track/applications?jobId=${encodeURIComponent(jobId)}`,
			);
			const payload = await res.json();

			if (!res.ok || !payload.success) {
				setApplications([]);
				setAppsError(payload?.error ?? "Gagal memuat lamaran.");
				return;
			}
			setApplications(payload.data ?? []);
		} catch {
			setApplications([]);
			setAppsError("Gagal memuat lamaran. Periksa koneksi Anda.");
		} finally {
			setAppsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadApplications(selectedJobId);
	}, [selectedJobId, loadApplications]);

	// ── Aksi ──

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setCreating(true);
		setFormErrors([]);
		setFlash(null);

		try {
			const res = await fetch("/api/admin/special-track/jobs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: form.title,
					description: form.description,
					requirements: form.requirements,
					vehicleCategory: form.vehicleCategory || null,
					minEcoScore: form.minEcoScore === "" ? null : form.minEcoScore,
				}),
			});
			const payload = await res.json();

			if (!res.ok || !payload.success) {
				// Tampilkan daftar error per-field bila ada, bukan hanya pesan umum.
				setFormErrors(
					payload?.errors ?? [payload?.error ?? "Gagal membuat lowongan."],
				);
				return;
			}

			setForm(EMPTY_FORM);
			setFlash({
				type: "success",
				text: `Lowongan "${payload.data.title}" dibuat.`,
			});
			await loadJobs();
		} catch {
			setFormErrors(["Gagal membuat lowongan. Silakan coba lagi."]);
		} finally {
			setCreating(false);
		}
	};

	const handleToggleStatus = async (job: AdminJob) => {
		const next = job.status === "open" ? "closed" : "open";
		setBusyJobId(job.id);
		setFlash(null);

		try {
			const res = await fetch(`/api/admin/special-track/jobs/${job.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: next }),
			});
			const payload = await res.json();

			if (!res.ok || !payload.success) {
				setFlash({
					type: "error",
					text: payload?.error ?? "Gagal mengubah status.",
				});
				return;
			}
			setFlash({
				type: "success",
				text: `"${job.title}" kini ${next === "open" ? "dibuka" : "ditutup"}.`,
			});
			await loadJobs();
		} catch {
			setFlash({
				type: "error",
				text: "Gagal mengubah status. Silakan coba lagi.",
			});
		} finally {
			setBusyJobId(null);
		}
	};

	const handleDelete = async (job: AdminJob) => {
		if (
			!window.confirm(
				`Hapus lowongan "${job.title}"? Tindakan ini tidak bisa dibatalkan.`,
			)
		) {
			return;
		}
		setBusyJobId(job.id);
		setFlash(null);

		try {
			const res = await fetch(`/api/admin/special-track/jobs/${job.id}`, {
				method: "DELETE",
			});
			const payload = await res.json();

			if (!res.ok || !payload.success) {
				setFlash({
					type: "error",
					text: payload?.error ?? "Gagal menghapus lowongan.",
				});
				return;
			}
			if (selectedJobId === job.id) setSelectedJobId("");
			setFlash({ type: "success", text: `Lowongan "${job.title}" dihapus.` });
			await loadJobs();
		} catch {
			setFlash({ type: "error", text: "Gagal menghapus lowongan." });
		} finally {
			setBusyJobId(null);
		}
	};

	const handleReview = async (
		application: AdminApplication,
		status: "reviewing" | "accepted" | "rejected",
	) => {
		setReviewingId(application.id);
		setFlash(null);

		try {
			const res = await fetch(
				`/api/admin/special-track/applications/${application.id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status }),
				},
			);
			const payload = await res.json();

			if (!res.ok || !payload.success) {
				setFlash({
					type: "error",
					text: payload?.error ?? "Gagal menyimpan penilaian.",
				});
				return;
			}
			setFlash({
				type: "success",
				text: `Lamaran ditandai sebagai ${status}.`,
			});
			await loadApplications(selectedJobId);
			await loadJobs();
		} catch {
			setFlash({ type: "error", text: "Gagal menyimpan penilaian." });
		} finally {
			setReviewingId(null);
		}
	};

	// ── Tampilan ──

	const inputClass =
		"w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-emerald-600 focus:outline-none";
	const labelClass = "block text-xs font-medium text-zinc-400 mb-1.5";

	return (
		<div className="min-h-screen bg-black py-8 px-4">
			<div className="max-w-5xl mx-auto">
				<header className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-xl font-semibold text-white">
							Special Track — Kelola Lowongan
						</h1>
						<p className="text-sm text-zinc-500 mt-1">
							Publish lowongan driver dan tinjau lamaran yang masuk.
						</p>
					</div>
					<button
						type="button"
						onClick={() => router.refresh()}
						className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg"
					>
						Muat ulang
					</button>
				</header>

				{flash && (
					<div
						className={`p-3 rounded-lg mb-5 text-sm ${
							flash.type === "success"
								? "bg-emerald-950/50 text-emerald-300"
								: "bg-red-950/50 text-red-300"
						}`}
					>
						{flash.text}
					</div>
				)}

				{/* ── Form buat lowongan ── */}
				<section className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-8">
					<h2 className="text-sm font-semibold text-white mb-4">
						Buat lowongan baru
					</h2>

					{formErrors.length > 0 && (
						<ul className="mb-4 space-y-1">
							{formErrors.map((err) => (
								<li key={err} className="text-xs text-red-300">
									• {err}
								</li>
							))}
						</ul>
					)}

					<form onSubmit={handleCreate} className="space-y-4">
						<div>
							<label htmlFor="st-title" className={labelClass}>
								Judul
							</label>
							<input
								id="st-title"
								className={inputClass}
								value={form.title}
								onChange={(e) => setForm({ ...form, title: e.target.value })}
								placeholder="EV Fleet Driver - Koridor Cikarang"
							/>
						</div>

						<div>
							<label htmlFor="st-desc" className={labelClass}>
								Deskripsi
							</label>
							<textarea
								id="st-desc"
								rows={3}
								className={inputClass}
								value={form.description}
								onChange={(e) =>
									setForm({ ...form, description: e.target.value })
								}
								placeholder="Jelaskan pekerjaan, jadwal, dan kompensasinya."
							/>
						</div>

						<div>
							<label htmlFor="st-req" className={labelClass}>
								Persyaratan (satu per baris)
							</label>
							<textarea
								id="st-req"
								rows={3}
								className={inputClass}
								value={form.requirements}
								onChange={(e) =>
									setForm({ ...form, requirements: e.target.value })
								}
								placeholder={
									"SIM B1 aktif\nMinimal 1 tahun pengalaman\nCatatan driver bersih"
								}
							/>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label htmlFor="st-cat" className={labelClass}>
									Kategori kendaraan
								</label>
								<select
									id="st-cat"
									className={inputClass}
									value={form.vehicleCategory}
									onChange={(e) =>
										setForm({ ...form, vehicleCategory: e.target.value })
									}
								>
									<option value="">Semua kategori</option>
									{VEHICLE_CATEGORIES.map((cat) => (
										<option key={cat} value={cat}>
											{cat}
										</option>
									))}
								</select>
							</div>

							<div>
								<label htmlFor="st-eco" className={labelClass}>
									Skor eco minimal (0–100)
								</label>
								<input
									id="st-eco"
									type="number"
									min={0}
									max={100}
									className={inputClass}
									value={form.minEcoScore}
									onChange={(e) =>
										setForm({ ...form, minEcoScore: e.target.value })
									}
									placeholder="80"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={creating}
							className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
						>
							{creating ? "Menyimpan..." : "Publish lowongan"}
						</button>
					</form>
				</section>

				{/* ── Daftar lowongan ── */}
				<section className="mb-8">
					<h2 className="text-sm font-semibold text-white mb-3">
						Lowongan ({jobs.length})
					</h2>

					{loading ? (
						<div className="text-sm text-zinc-500 py-8 text-center">
							Memuat...
						</div>
					) : loadError ? (
						<div className="bg-red-950/40 border border-red-900/50 rounded-xl p-6 text-center">
							<p className="text-red-300 text-sm mb-3">{loadError}</p>
							<button
								type="button"
								onClick={() => {
									setLoading(true);
									loadJobs();
								}}
								className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg"
							>
								Coba lagi
							</button>
						</div>
					) : jobs.length === 0 ? (
						<div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 text-center">
							<p className="text-zinc-400 text-sm">
								Belum ada lowongan. Buat yang pertama di atas.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{jobs.map((job) => (
								<div
									key={job.id}
									className="bg-zinc-950 border border-zinc-800 rounded-xl p-5"
								>
									<div className="flex items-start justify-between gap-4 mb-2">
										<div className="min-w-0">
											<h3 className="text-sm font-semibold text-white truncate">
												{job.title}
											</h3>
											<p className="text-xs text-zinc-500 mt-1 line-clamp-2">
												{job.description}
											</p>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											{job.isSeed && (
												<span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300">
													seed
												</span>
											)}
											<span
												className={`px-2 py-0.5 rounded text-[10px] font-medium ${
													job.status === "open"
														? "bg-emerald-950 text-emerald-300"
														: "bg-zinc-800 text-zinc-400"
												}`}
											>
												{job.status}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-3 text-[11px] text-zinc-500 mb-3">
										<span>{job.applicationCount} lamaran</span>
										{job.vehicleCategory && (
											<span>• {job.vehicleCategory}</span>
										)}
										{job.minEcoScore !== null && (
											<span>• min skor {job.minEcoScore}</span>
										)}
										{job.closedAt && (
											<span>• ditutup {job.closedAt.slice(0, 10)}</span>
										)}
									</div>

									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => handleToggleStatus(job)}
											disabled={busyJobId === job.id}
											className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg"
										>
											{job.status === "open" ? "Tutup" : "Buka"}
										</button>
										<button
											type="button"
											onClick={() => {
												setSelectedJobId(job.id);
												document
													.getElementById("st-applications")
													?.scrollIntoView({ behavior: "smooth" });
											}}
											className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"
										>
											Lihat lamaran
										</button>
										<button
											type="button"
											onClick={() => handleDelete(job)}
											disabled={busyJobId === job.id}
											className="px-3 py-1.5 text-xs bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-300 rounded-lg"
											title={
												job.applicationCount > 0
													? "Tidak bisa dihapus karena sudah ada lamaran"
													: "Hapus lowongan"
											}
										>
											Hapus
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* ── Tinjau lamaran ── */}
				<section
					id="st-applications"
					className="bg-zinc-950 border border-zinc-800 rounded-xl p-6"
				>
					<h2 className="text-sm font-semibold text-white mb-4">
						Tinjau lamaran
					</h2>

					<div className="mb-4">
						<label htmlFor="st-job-select" className={labelClass}>
							Pilih lowongan
						</label>
						<select
							id="st-job-select"
							className={inputClass}
							value={selectedJobId}
							onChange={(e) => setSelectedJobId(e.target.value)}
						>
							<option value="">— semua lowongan —</option>
							{jobs.map((job) => (
								<option key={job.id} value={job.id}>
									{job.title} ({job.applicationCount})
								</option>
							))}
						</select>
					</div>

					{appsLoading ? (
						<p className="text-sm text-zinc-500 py-4 text-center">
							Memuat lamaran...
						</p>
					) : appsError ? (
						<div className="bg-red-950/40 border border-red-900/50 rounded-lg p-4">
							<p className="text-red-300 text-xs">{appsError}</p>
						</div>
					) : applications.length === 0 ? (
						<p className="text-sm text-zinc-500 py-4 text-center">
							Belum ada lamaran untuk lowongan ini.
						</p>
					) : (
						<div className="space-y-3">
							{applications.map((app) => (
								<div
									key={app.id}
									className="border border-zinc-800 rounded-lg p-4"
								>
									<div className="flex items-start justify-between gap-3 mb-2">
										<div className="min-w-0">
											<p className="text-sm text-white truncate">
												{app.driverName ?? "Nama tidak tercatat"}
											</p>
											<p className="text-xs text-zinc-500 truncate">
												{app.driverEmail ?? app.driverId}
											</p>
											{app.driverPhone && (
												<p className="text-xs text-zinc-600">
													{app.driverPhone}
												</p>
											)}
										</div>
										<span
											className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
												APPLICATION_STATUS_STYLES[app.status] ??
												"bg-zinc-800 text-zinc-400"
											}`}
										>
											{app.status}
										</span>
									</div>

									<div className="flex items-center gap-3 text-[11px] text-zinc-500 mb-3">
										{app.ecoScoreAtApply !== null && (
											<span>skor {app.ecoScoreAtApply}</span>
										)}
										{app.vehicleCategoryAtApply && (
											<span>• {app.vehicleCategoryAtApply}</span>
										)}
										<span>• {app.createdAt.slice(0, 10)}</span>
									</div>

									{app.reviewedAt && (
										<p className="text-[11px] text-zinc-600 mb-2">
											Ditinjau {app.reviewedAt.slice(0, 10)}
											{app.reviewNote ? ` — ${app.reviewNote}` : ""}
										</p>
									)}

									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => handleReview(app, "accepted")}
											disabled={reviewingId === app.id}
											className="px-3 py-1.5 text-xs bg-emerald-950/60 hover:bg-emerald-900/60 disabled:opacity-50 text-emerald-300 rounded-lg"
										>
											Terima
										</button>
										<button
											type="button"
											onClick={() => handleReview(app, "rejected")}
											disabled={reviewingId === app.id}
											className="px-3 py-1.5 text-xs bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-300 rounded-lg"
										>
											Tolak
										</button>
										<button
											type="button"
											onClick={() => handleReview(app, "reviewing")}
											disabled={
												reviewingId === app.id || app.status === "reviewing"
											}
											className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg"
										>
											Tandai ditinjau
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				<div className="mt-8 text-center">
					<Link
						href="/admin"
						className="text-emerald-400 hover:text-emerald-300 text-sm"
					>
						Kembali ke dashboard admin
					</Link>
				</div>
			</div>
		</div>
	);
}
