"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { AppointmentTemplate } from "@/lib/appointments/types";

export default function CorporateAppointmentsPage() {
	const [templates, setTemplates] = useState<AppointmentTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function fetchTemplates() {
			try {
				const res = await fetch("/api/appointments/templates");
				const data = await res.json();
				if (data.success && Array.isArray(data.data)) {
					setTemplates(data.data);
				}
			} catch (e) {
				console.error("Gagal memuat template:", e);
			} finally {
				setIsLoading(false);
			}
		}
		fetchTemplates();
	}, []);

	const copyShareableLink = (slug: string) => {
		const fullUrl = `${window.location.origin}/book/${slug}`;
		navigator.clipboard.writeText(fullUrl);
		alert(`Link booking disalin:\n${fullUrl}`);
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 space-y-8">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
							B2B Executive Setter
						</span>
					</div>
					<h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
						Appointment Setter Portal
					</h1>
					<p className="text-xs text-gray-500">
						Kelola link penjadwalan mandiri armada EV untuk delegasi tamu,
						rekrutmen HR, dan kunjungan pabrik.
					</p>
				</div>

				<div className="flex gap-2">
					<Link
						href="/company"
						className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all"
					>
						Kembali ke ESG Portal
					</Link>
				</div>
			</div>

			{/* Template Cards Grid */}
			<div className="space-y-4">
				<h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
					Active Shareable Booking Links
				</h2>

				{isLoading ? (
					<div className="p-8 text-center text-xs text-gray-400">
						Memuat link agenda...
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{templates.map((tpl) => (
							<div
								key={tpl.id}
								className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
							>
								<div className="flex items-start justify-between">
									<div>
										<span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
											{tpl.payment_sponsor_mode === "corporate_esg"
												? "Corporate Sponsored"
												: "Self-Pay"}
										</span>
										<h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5">
											{tpl.title}
										</h3>
										<p className="text-xs text-gray-500 mt-1 line-clamp-2">
											{tpl.description}
										</p>
									</div>
								</div>

								<div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
									<div className="text-gray-500">
										<span className="font-semibold text-gray-700 dark:text-gray-300">
											Paket:
										</span>{" "}
										{tpl.allowed_durations.join(", ")} Jam (Default{" "}
										{tpl.default_duration}h)
									</div>

									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => copyShareableLink(tpl.slug)}
											className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg font-bold text-xs transition-all flex items-center gap-1"
										>
											<span>📋 Salin Link</span>
										</button>
										<Link
											href={`/book/${tpl.slug}`}
											target="_blank"
											className="px-3 py-1.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg font-bold text-xs transition-all flex items-center gap-1"
										>
											<span>Buka ↗</span>
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Operational Benefits Card */}
			<div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-6 shadow-lg space-y-3">
				<h3 className="text-base font-bold flex items-center gap-2">
					<span>⚡ Asset-Light Mobility & The Decoy Effect</span>
				</h3>
				<p className="text-xs text-emerald-100 leading-relaxed max-w-3xl">
					Sistem Appointment Setter mengalokasikan armada mitra pengemudi EV
					mandiri tanpa beban modal tetap (*zero idle liability*). Penetapan
					harga paket 8 jam dirancang mengoptimalkan utilisasi harian driver
					sehingga mampu melunasi sewa mobil vendor harian (Rp 260.000) dan
					mencairkan laba bersih malam hari pukul 23:00 WIB.
				</p>
			</div>
		</div>
	);
}
