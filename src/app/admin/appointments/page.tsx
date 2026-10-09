"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { AppointmentBooking } from "@/lib/appointments/types";

export default function AdminAppointmentsPage() {
	const [_bookings, setBookings] = useState<AppointmentBooking[]>([]);
	const [_isLoading, setIsLoading] = useState(true);
	const [isTriggeringPayout, setIsTriggeringPayout] = useState(false);
	const [payoutResult, setPayoutResult] = useState<string | null>(null);

	useEffect(() => {
		async function fetchTemplates() {
			setIsLoading(true);
			try {
				const res = await fetch("/api/appointments/templates");
				const data = await res.json();
				if (data.success && Array.isArray(data.data)) {
					// placeholder for bookings
				}
			} catch (e) {
				console.error("Gagal load templates:", e);
			} finally {
				setIsLoading(false);
			}
		}
		fetchTemplates();
	}, []);

	// Trigger Nightly Cron Auto-Payout manual test
	const handleTriggerPayout = async () => {
		setIsTriggeringPayout(true);
		setPayoutResult(null);
		try {
			const res = await fetch("/api/cron/daily-driver-payout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-cron-secret": process.env.NEXT_PUBLIC_CRON_SECRET || "",
				},
				body: JSON.stringify({}),
			});
			const data = await res.json();
			setPayoutResult(
				data.success
					? `✓ Auto-payout sukses dieksekusi! ${data.drivers_count ?? 0} driver diproses.`
					: `⚠️ Gagal: ${data.error}`,
			);
		} catch (e) {
			setPayoutResult(
				`Error: ${e instanceof Error ? e.message : "Gagal memanggil cron"}`,
			);
		} finally {
			setIsTriggeringPayout(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
							Admin Operations
						</span>
					</div>
					<h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
						Fleet Dispatch & Appointment Setter
					</h1>
					<p className="text-xs text-gray-500">
						Monitoring jadwal sewa harian EV, penugasan armada mitra, dan
						settlement 85% harian.
					</p>
				</div>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleTriggerPayout}
						disabled={isTriggeringPayout}
						className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
					>
						<span>⚡ Eksekusi Auto-Payout Malam (23:00 WIB)</span>
					</button>
					<Link
						href="/admin"
						className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all"
					>
						Kembali ke SuperAdmin
					</Link>
				</div>
			</div>

			{/* Payout Feedback */}
			{payoutResult && (
				<div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-medium text-emerald-800 dark:text-emerald-300">
					{payoutResult}
				</div>
			)}

			{/* Operational Matrix */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
					<span className="text-[11px] text-gray-400 block">Skema Komisi</span>
					<span className="text-xl font-black text-gray-900 dark:text-white">
						85% Driver : 15% Platform
					</span>
				</div>
				<div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
					<span className="text-[11px] text-gray-400 block">
						Paket Terpopuler
					</span>
					<span className="text-xl font-black text-emerald-600">
						8 Jam (Best Value)
					</span>
				</div>
				<div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
					<span className="text-[11px] text-gray-400 block">
						Jadwal Pencairan Dana
					</span>
					<span className="text-xl font-black text-blue-600">
						23:00 WIB Setiap Malam
					</span>
				</div>
				<div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
					<span className="text-[11px] text-gray-400 block">
						Standar Armada
					</span>
					<span className="text-xl font-black text-gray-900 dark:text-white">
						100% Chauffeur EV
					</span>
				</div>
			</div>
		</div>
	);
}
