"use client";

import { useState } from "react";
import type {
	AppointmentBooking,
	AppointmentWaypoint,
} from "@/lib/appointments/types";

interface DriverAppointmentCardProps {
	booking: AppointmentBooking;
	onCompleteBooking?: (bookingId: string) => void;
}

export function DriverAppointmentCard({
	booking,
	onCompleteBooking,
}: DriverAppointmentCardProps) {
	const [waypoints, setWaypoints] = useState<AppointmentWaypoint[]>(
		booking.waypoints || [],
	);
	const [isCompleting, setIsCompleting] = useState(false);

	const handleToggleWaypoint = (idx: number) => {
		const updated = [...waypoints];
		updated[idx] = {
			...updated[idx],
			is_completed: !updated[idx].is_completed,
			completed_at: !updated[idx].is_completed
				? new Date().toISOString()
				: null,
		};
		setWaypoints(updated);
	};

	const handleFinishAppointment = async () => {
		if (
			!confirm(
				"Apakah seluruh agenda kunjungan & penjemputan telah selesai dilakukan?",
			)
		) {
			return;
		}

		setIsCompleting(true);
		try {
			const res = await fetch(`/api/appointments/${booking.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status: "completed",
					notes: "Diselesaikan via Driver HUD",
				}),
			});
			if (res.ok) {
				onCompleteBooking?.(booking.id);
				alert(
					`Alhamdulillah! Trip paket ${booking.duration_hours} jam selesai.\nKomisi 85% (Rp ${booking.driver_payout_idr.toLocaleString("id-ID")}) tercatat untuk pencairan otomatis pukul 23:00 WIB malam ini.`,
				);
			}
		} catch (e) {
			console.error("Gagal menyelesaikan trip:", e);
		} finally {
			setIsCompleting(false);
		}
	};

	return (
		<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-emerald-500/40 shadow-md space-y-4 text-left">
			{/* Top Header */}
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
					⚡ Jadwal Appointment Setter Terjadwal
				</span>
				<span className="text-xs font-mono font-bold text-gray-500">
					{booking.booking_code}
				</span>
			</div>

			{/* Booking Details */}
			<div className="space-y-1">
				<h4 className="text-base font-bold text-gray-900 dark:text-white">
					Tamu: {booking.booker_name}
				</h4>
				<p className="text-xs text-gray-500 flex items-center gap-2">
					<span>
						📅 {booking.scheduled_date} • Jam{" "}
						{new Date(booking.scheduled_start_time).toLocaleTimeString(
							"id-ID",
							{ hour: "2-digit", minute: "2-digit" },
						)}{" "}
						WIB
					</span>
					<span>• Paket {booking.duration_hours} Jam</span>
				</p>
			</div>

			{/* Guaranteed Payout Callout */}
			<div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between text-xs">
				<div>
					<span className="text-gray-500 dark:text-gray-400 block text-[11px]">
						Hak Komisi Driver (85%):
					</span>
					<span className="text-base font-black text-emerald-600 dark:text-emerald-400">
						Rp {booking.driver_payout_idr.toLocaleString("id-ID")}
					</span>
				</div>
				<div className="text-right text-[11px] text-gray-500 dark:text-gray-400">
					<span>Cair Otomatis:</span>
					<span className="font-bold block text-gray-700 dark:text-gray-300">
						23:00 WIB Malam Ini
					</span>
				</div>
			</div>

			{/* Multi-Stop Waypoints Progression */}
			<div className="space-y-2.5 pt-1">
				<h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
					Rute Navigasi & Titik Kunjungan:
				</h5>

				{/* Origin */}
				<div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
					<div className="flex items-center gap-2">
						<span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
						<div>
							<span className="text-[10px] text-emerald-600 font-bold block">
								Origin (Titik Awal):
							</span>
							<span className="font-semibold text-gray-800 dark:text-gray-200">
								{booking.pickup_address}
							</span>
						</div>
					</div>
					<a
						href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(booking.pickup_address)}`}
						target="_blank"
						rel="noopener noreferrer"
						className="px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:border-emerald-500"
					>
						Maps ↗
					</a>
				</div>

				{/* Waypoints */}
				{waypoints.map((wp, idx) => (
					<div
						key={wp.id || `driver-stop-${wp.address}-${idx}`}
						className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
							wp.is_completed
								? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 text-gray-400 line-through"
								: "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200"
						}`}
					>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={Boolean(wp.is_completed)}
								onChange={() => handleToggleWaypoint(idx)}
								className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
							/>
							<div>
								<span className="text-[10px] text-gray-400 block">
									Stop #{idx + 1}: {wp.stop_name}
								</span>
								<span className="font-medium">{wp.address}</span>
							</div>
						</div>

						<a
							href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(wp.address)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:border-emerald-500"
						>
							Maps ↗
						</a>
					</div>
				))}
			</div>

			{/* Finish Button */}
			<div className="pt-2">
				<button
					type="button"
					onClick={handleFinishAppointment}
					disabled={isCompleting}
					className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
				>
					{isCompleting
						? "Menyimpan Data..."
						: "✓ Selesaikan Seluruh Appointment"}
				</button>
			</div>
		</div>
	);
}
