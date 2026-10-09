"use client";

import { useParams, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { CalendarPicker } from "@/components/appointments/CalendarPicker";
import {
	MultiStopWaypoints,
	type WaypointItem,
} from "@/components/appointments/MultiStopWaypoints";
import { PackageSelector } from "@/components/appointments/PackageSelector";
import { calculateAppointmentFare } from "@/lib/appointments/pricing";
import type {
	AppointmentTemplate,
	DurationHours,
} from "@/lib/appointments/types";

export default function PublicBookingPage() {
	const params = useParams();
	const router = useRouter();
	const slug = (params?.slug as string) || "cikarang-executive-visit";

	const [template, setTemplate] = useState<AppointmentTemplate | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Booking Form State
	const [selectedHours, setSelectedHours] = useState<DurationHours>(8);
	const [selectedDate, setSelectedDate] = useState<string>("");
	const [selectedTime, setSelectedTime] = useState<string>("08:00");
	const [pickupAddress, setPickupAddress] = useState<string>(
		"Stasiun Kereta Cepat Whoosh Halim",
	);
	const [pickupLat, setPickupLat] = useState<number>(-6.2483);
	const [pickupLng, setPickupLng] = useState<number>(106.8839);
	const [waypoints, setWaypoints] = useState<WaypointItem[]>([]);

	// Booker Identity
	const [bookerName, setBookerName] = useState<string>("");
	const [bookerPhone, setBookerPhone] = useState<string>("");
	const [bookerEmail, setBookerEmail] = useState<string>("");
	const [specialNotes, setSpecialNotes] = useState<string>("");

	// Submission status
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	// Set default date to tomorrow
	useEffect(() => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		setSelectedDate(tomorrow.toISOString().split("T")[0]);
	}, []);

	// Fetch template by slug
	useEffect(() => {
		async function fetchTemplate() {
			try {
				const res = await fetch(`/api/appointments/templates/${slug}`);
				const data = await res.json();
				if (data.success && data.data) {
					setTemplate(data.data);
					if (data.data.default_duration) {
						setSelectedHours(data.data.default_duration);
					}
				}
			} catch (e) {
				console.warn("Failed to fetch template:", e);
			} finally {
				setIsLoading(false);
			}
		}
		fetchTemplate();
	}, [slug]);

	// Live Fare Calculation
	const fare = calculateAppointmentFare(selectedHours, 0);

	const handleSubmitBooking = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitError(null);

		if (!bookerName.trim()) {
			setSubmitError("Nama lengkap pemesan wajib diisi");
			return;
		}
		if (!bookerPhone.trim()) {
			setSubmitError("Nomor WhatsApp aktif wajib diisi");
			return;
		}
		if (!pickupAddress.trim()) {
			setSubmitError("Alamat penjemputan wajib diisi");
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/appointments/book", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					templateSlug: slug,
					bookerName,
					bookerPhone,
					bookerEmail,
					specialNotes,
					scheduledDate: selectedDate,
					scheduledStartTime: `${selectedTime}:00`,
					durationHours: selectedHours,
					pickupAddress,
					pickupLat,
					pickupLng,
					waypoints,
				}),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error || "Gagal membuat jadwal pemesanan");
			}

			// Redirect to tracking & confirmation page
			const trackingToken = data.data.tracking_secret_token;
			router.push(`/book/track/${trackingToken}`);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : "Terjadi kesalahan sistem",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
				<div className="text-center space-y-3">
					<div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p className="text-sm font-medium text-gray-500">
						Memuat kalender agenda Drifee...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-28">
			{/* Top Branding Header */}
			<header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
				<div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
							D
						</div>
						<div>
							<h1 className="text-sm font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-1.5">
								Drifee{" "}
								<span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
									by Briga
								</span>
							</h1>
							<p className="text-[11px] text-gray-500 dark:text-gray-400">
								Chauffeur-Driven EV Mobility
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
						<span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
							Armada Siap Standby
						</span>
					</div>
				</div>
			</header>

			{/* Main Booking Container */}
			<main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
				{/* Agenda Card Header */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
							Executive On-Demand
						</span>
						<span className="text-xs text-gray-400">
							• Bebas Rute Jabodetabek
						</span>
					</div>
					<h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
						{template?.title ||
							"Executive & HR Factory Tour (Cikarang Industrial Estate)"}
					</h2>
					<p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
						{template?.description ||
							"Layanan transportasi delegasi bisnis, kandidat rekrutmen, dan audit pabrik dengan armada Mobil EV premium berpendingin kabin hening dan driver profesional."}
					</p>
				</div>

				<form onSubmit={handleSubmitBooking} className="space-y-6">
					{/* 1. Package Selector (Decoy Pricing) */}
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
						<PackageSelector
							selectedHours={selectedHours}
							allowedDurations={template?.allowed_durations || [2, 4, 8, 12]}
							onSelectHours={(h) => setSelectedHours(h)}
						/>
					</div>

					{/* 2. Calendar & Time Slot Picker */}
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
						<CalendarPicker
							selectedDate={selectedDate}
							selectedTime={selectedTime}
							onSelectDate={(d) => setSelectedDate(d)}
							onSelectTime={(t) => setSelectedTime(t)}
							advanceDays={template?.advance_booking_days || 14}
						/>
					</div>

					{/* 3. Multi-Stop Waypoints & TSP Optimization */}
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
						<MultiStopWaypoints
							pickupAddress={pickupAddress}
							pickupLat={pickupLat}
							pickupLng={pickupLng}
							waypoints={waypoints}
							maxWaypoints={template?.max_waypoints || 5}
							onChangePickup={(addr, lat, lng) => {
								setPickupAddress(addr);
								setPickupLat(lat);
								setPickupLng(lng);
							}}
							onChangeWaypoints={(wps) => setWaypoints(wps)}
						/>
					</div>

					{/* 4. Booker Identity Form */}
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
								<span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
									4
								</span>
								Data Penumpang / Pemesan
							</h3>
						</div>

						<div className="space-y-3">
							<div>
								<label
									htmlFor="booker-name"
									className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
								>
									Nama Lengkap / Tamu *
								</label>
								<input
									id="booker-name"
									type="text"
									required
									value={bookerName}
									onChange={(e) => setBookerName(e.target.value)}
									placeholder="Contoh: Budi Santoso (HR Manager)"
									className="w-full text-xs px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="booker-phone"
										className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
									>
										Nomor WhatsApp Aktif *
									</label>
									<input
										id="booker-phone"
										type="tel"
										required
										value={bookerPhone}
										onChange={(e) => setBookerPhone(e.target.value)}
										placeholder="0812xxxxxxxx"
										className="w-full text-xs px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
									/>
									<span className="text-[10px] text-gray-400 mt-0.5 block">
										Tiket & kontak driver akan dikirim ke nomor ini
									</span>
								</div>

								<div>
									<label
										htmlFor="booker-email"
										className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
									>
										Email (opsional)
									</label>
									<input
										id="booker-email"
										type="email"
										value={bookerEmail}
										onChange={(e) => setBookerEmail(e.target.value)}
										placeholder="budi@perusahaan.com"
										className="w-full text-xs px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
									/>
								</div>
							</div>

							<div>
								<label
									htmlFor="special-notes"
									className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
								>
									Catatan Khusus untuk Driver (opsional)
								</label>
								<textarea
									id="special-notes"
									rows={2}
									value={specialNotes}
									onChange={(e) => setSpecialNotes(e.target.value)}
									placeholder="Contoh: Bawa payung, tamu dari Jepang, AC dingin..."
									className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
								/>
							</div>
						</div>
					</div>

					{/* Error Notification */}
					{submitError && (
						<div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
							⚠️ {submitError}
						</div>
					)}

					{/* Sticky Bottom Summary & CTA */}
					<div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 shadow-xl z-20">
						<div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
							<div>
								<div className="text-[11px] text-gray-500 dark:text-gray-400">
									Paket {selectedHours} Jam • Termasuk {fare.includedKm} km
								</div>
								<div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
									Rp {fare.finalPayableIdr.toLocaleString("id-ID")}
								</div>
							</div>

							<button
								type="submit"
								disabled={isSubmitting}
								className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
							>
								{isSubmitting ? (
									<span>Memproses Reservasi...</span>
								) : (
									<>
										<span>Konfirmasi Jadwal Sekarang</span>
										<span>→</span>
									</>
								)}
							</button>
						</div>
					</div>
				</form>
			</main>
		</div>
	);
}
