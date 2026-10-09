"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppointmentBooking } from "@/lib/appointments/types";

export default function BookingTrackingPage() {
	const params = useParams();
	const token = (params?.token as string) || "";

	const [booking, setBooking] = useState<AppointmentBooking | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchBooking() {
			try {
				const res = await fetch(`/api/appointments/${token}`);
				const data = await res.json();
				if (data.success && data.data) {
					setBooking(data.data);
				} else {
					setError(data.error || "Pemesanan tidak ditemukan");
				}
			} catch (_e) {
				setError("Gagal memuat status pemesanan");
			} finally {
				setIsLoading(false);
			}
		}
		if (token) fetchBooking();
	}, [token]);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
				<div className="text-center space-y-3">
					<div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p className="text-sm font-medium text-gray-500">
						Memuat tiket digital perjalanan...
					</p>
				</div>
			</div>
		);
	}

	if (error || !booking) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
				<div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 text-center space-y-4">
					<div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
						✕
					</div>
					<h2 className="text-lg font-bold text-gray-900 dark:text-white">
						Tiket Tidak Ditemukan
					</h2>
					<p className="text-xs text-gray-500">
						Link tiket rahasia tidak valid atau telah kedaluwarsa.
					</p>
				</div>
			</div>
		);
	}

	// Status badge mapping
	const statusBadge = {
		unassigned: {
			label: "Menunggu Penugasan Driver",
			color: "bg-amber-100 text-amber-800",
		},
		assigned: {
			label: "Mitra Driver Ditugaskan",
			color: "bg-blue-100 text-blue-800",
		},
		en_route: {
			label: "Driver Menuju Lokasi",
			color: "bg-purple-100 text-purple-800 animate-pulse",
		},
		picked_up: {
			label: "Perjalanan Sedang Berlangsung",
			color: "bg-emerald-100 text-emerald-800",
		},
		completed: {
			label: "Perjalanan Selesai",
			color: "bg-green-100 text-green-800",
		},
		cancelled: { label: "Dibatalkan", color: "bg-red-100 text-red-800" },
		no_show: { label: "No-Show", color: "bg-gray-100 text-gray-800" },
	}[booking.booking_status] || {
		label: booking.booking_status,
		color: "bg-gray-100 text-gray-800",
	};

	// Google Calendar Quick Link
	const gcalStart = new Date(booking.scheduled_start_time)
		.toISOString()
		.replace(/-|:|\.\d\d\d/g, "");
	const gcalEnd = new Date(booking.scheduled_end_time)
		.toISOString()
		.replace(/-|:|\.\d\d\d/g, "");
	const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Drifee EV Trip: ${booking.booking_code}`)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(`Paket ${booking.duration_hours} Jam Chauffeur-Driven EV. Titik Jemput: ${booking.pickup_address}`)}&location=${encodeURIComponent(booking.pickup_address)}`;

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 pb-20">
			<div className="max-w-xl mx-auto space-y-5">
				{/* Success Banner */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-emerald-500/30 shadow-md text-center space-y-3 relative overflow-hidden">
					<div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
						✓
					</div>
					<div>
						<span
							className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color} mb-2`}
						>
							{statusBadge.label}
						</span>
						<h1 className="text-xl font-black text-gray-900 dark:text-white">
							Jadwal Penjemputan Terkonfirmasi
						</h1>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							Kode Reservasi:{" "}
							<span className="font-mono font-bold text-gray-800 dark:text-gray-200">
								{booking.booking_code}
							</span>
						</p>
					</div>

					{/* Action Buttons */}
					<div className="pt-2 flex flex-wrap gap-2 justify-center">
						<a
							href={gcalUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs font-semibold px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-xl text-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5"
						>
							<span>📅 Tambah ke Google Calendar</span>
						</a>
						<button
							type="button"
							onClick={() => {
								navigator.clipboard.writeText(window.location.href);
								alert("Link tiket digital berhasil disalin!");
							}}
							className="text-xs font-semibold px-4 py-2 border border-gray-200 dark:border-gray-700 hover:border-emerald-500 rounded-xl text-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5"
						>
							<span>🔗 Salin Link Tiket</span>
						</button>
					</div>
				</div>

				{/* Digital Driver Card */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
					<div className="flex items-center justify-between">
						<h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
							Mitra Pengemudi & Kendaraan
						</h3>
						<span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
							100% Chauffeur EV
						</span>
					</div>

					<div className="flex items-center gap-3.5 pt-1">
						<div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
							{booking.driver ? booking.driver.name.charAt(0) : "D"}
						</div>
						<div className="flex-1">
							<h4 className="text-sm font-bold text-gray-900 dark:text-white">
								{booking.driver
									? booking.driver.name
									: "Mitra Drifee (Sedang Dialokasikan)"}
							</h4>
							<p className="text-xs text-gray-500">
								{booking.vehicle
									? `${booking.vehicle.model} • Plat ${booking.vehicle.license_plate}`
									: "BYD Atto 3 / Hyundai Ioniq 5"}
							</p>
						</div>

						{booking.driver?.phone && (
							<a
								href={`https://wa.me/${booking.driver.phone.replace(/\D/g, "")}`}
								target="_blank"
								rel="noopener noreferrer"
								className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
							>
								WhatsApp
							</a>
						)}
					</div>
				</div>

				{/* Trip Schedule & Waypoints Detail */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
					<h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
						Rincian Jadwal & Rute Multi-Titik
					</h3>

					<div className="grid grid-cols-2 gap-3 text-xs">
						<div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
							<span className="text-gray-400 block text-[11px]">Tanggal:</span>
							<span className="font-bold text-gray-900 dark:text-white">
								{booking.scheduled_date}
							</span>
						</div>
						<div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
							<span className="text-gray-400 block text-[11px]">Waktu:</span>
							<span className="font-bold text-gray-900 dark:text-white">
								{new Date(booking.scheduled_start_time).toLocaleTimeString(
									"id-ID",
									{
										hour: "2-digit",
										minute: "2-digit",
									},
								)}{" "}
								WIB ({booking.duration_hours} Jam)
							</span>
						</div>
					</div>

					{/* Route List */}
					<div className="space-y-3 pt-2">
						<div className="flex items-start gap-3 text-xs">
							<span className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
							<div>
								<span className="text-[10px] uppercase font-bold text-emerald-600">
									Titik Penjemputan Awal
								</span>
								<p className="font-semibold text-gray-900 dark:text-white">
									{booking.pickup_address}
								</p>
							</div>
						</div>

						{booking.waypoints?.map((wp, idx) => (
							<div
								key={wp.id || `stop-${idx}-${wp.address}`}
								className="flex items-start gap-3 text-xs pl-0.5"
							>
								<span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1 flex-shrink-0"></span>
								<div>
									<span className="text-[10px] uppercase font-bold text-gray-400">
										Titik Singgah #{idx + 1}: {wp.stop_name}
									</span>
									<p className="font-semibold text-gray-800 dark:text-gray-200">
										{wp.address}
									</p>
									{wp.contact_person && (
										<span className="text-[11px] text-gray-500">
											PIC: {wp.contact_person} ({wp.contact_phone})
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Financial Summary & Payment Action */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<span className="text-xs text-gray-500 dark:text-gray-400 block">
								Total Biaya Layanan
							</span>
							<span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
								Rp {booking.gross_fare_idr.toLocaleString("id-ID")}
							</span>
						</div>
						<div className="text-right">
							<span
								className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
									booking.payment_status === "sponsored_esg"
										? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
										: booking.payment_status === "paid_online"
											? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
											: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
								}`}
							>
								{booking.payment_status === "sponsored_esg"
									? "Ditanggung ESG Pool"
									: booking.payment_status === "paid_online"
										? "Pembayaran Sukses"
										: "Menunggu Pembayaran"}
							</span>
						</div>
					</div>

					{/* Tombol Lynk.id Checkout jika status pending */}
					{booking.payment_status === "pending" && (
						<div className="pt-2 border-t border-gray-100 dark:border-gray-800">
							<a
								href={`${
									process.env.NEXT_PUBLIC_LYNK_URL || "https://lynk.id/drifee"
								}?notes=${booking.booking_code}&order=${booking.booking_code}`}
								target="_blank"
								rel="noopener noreferrer"
								className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
							>
								<span>💳 Bayar Sekarang via Lynk.id (QRIS / Virtual Account)</span>
								<span>→</span>
							</a>
							<span className="text-[11px] text-gray-400 block text-center mt-1.5">
								Mendukung QRIS, GoPay, OVO, ShopeePay, dan Transfer Bank
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
