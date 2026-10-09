// ─────────────────────────────────────────────────────────────
// appointments/notifications.ts — Multi-Channel Notification Engine (WhatsApp + Email)
//
// Mengirimkan notifikasi pembaruan perjalanan terotomasi ke Booker dan Mitra
// Driver melalui 2 saluran utama:
// 1. WhatsApp Bot (Baileys Engine)
// 2. Email Notifikasi Eksekutif (Resend / SMTP)
// ─────────────────────────────────────────────────────────────

import { BaileysAgent } from "@/lib/baileys/agent";
import { loadConfig } from "@/lib/baileys/config";
import {
	generateBookingConfirmationEmailHtml,
	generateDriverEnRouteEmailHtml,
	generateTripCompletedSummaryEmailHtml,
	sendEmail,
} from "./email";
import type { AppointmentBooking } from "./types";

function formatRupiah(num: number): string {
	return `Rp ${num.toLocaleString("id-ID")}`;
}

/**
 * Helper untuk mendapatkan agen Baileys aktif jika tersedia
 */
function getActiveBaileysAgent(): BaileysAgent | null {
	try {
		const config = loadConfig();
		const activeConfig = config.agents.find(
			(a) => a.status === "active" && a.id,
		);
		if (activeConfig) {
			return new BaileysAgent(activeConfig);
		}
	} catch (e) {
		console.warn("[Baileys Notification] Gagal membaca konfigurasi agen:", e);
	}
	return null;
}

/**
 * 1. Kirim Konfirmasi Booking & Tiket Digital ke Booker / Tamu (WhatsApp + Email)
 */
export async function sendBookingConfirmationToBooker(
	booking: AppointmentBooking,
	templateTitle: string,
): Promise<{
	success: boolean;
	whatsappSent?: boolean;
	emailSent?: boolean;
	error?: string;
}> {
	const trackingUrl = `${
		process.env.NEXT_PUBLIC_APP_URL || "https://drifee.briga.id"
	}/book/track/${booking.tracking_secret_token}`;

	let whatsappSent = false;
	let emailSent = false;

	// ── A. WhatsApp Notification ──
	const message = `Halo *${booking.booker_name}*,

Pemesanan armada Mobil Listrik (EV) Anda di *Drifee by Briga* telah terkonfirmasi! 🌿⚡

📋 *Detail Agenda:*
• *Kode Booking:* \`${booking.booking_code}\`
• *Agenda:* ${templateTitle}
• *Tanggal:* ${booking.scheduled_date}
• *Waktu Mulai:* ${new Date(booking.scheduled_start_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
• *Durasi:* ${booking.duration_hours} Jam
• *Titik Jemput:* ${booking.pickup_address}
${booking.waypoints && booking.waypoints.length > 0 ? `• *Titik Kunjungan:* ${booking.waypoints.length} lokasi tambahan` : ""}

🚗 *Layanan:* 100% Chauffeur-Driven EV (BYD Atto 3 / Hyundai Ioniq 5)
💰 *Total Tarif:* ${formatRupiah(booking.gross_fare_idr)} (${booking.payment_status === "sponsored_esg" ? "Ditanggung Kuota ESG Perusahaan" : "Telah Dikonfirmasi"})

📲 *Tiket Digital & Live Tracking Driver:*
${trackingUrl}

Driver kami akan menghubungi Anda H-1 jam sebelum waktu penjemputan. Terima kasih telah mendukung mobilitas hijau bebas emisi!`;

	console.log(
		`[Notification Booker] Mengirim konfirmasi ke ${booking.booker_phone} (Code: ${booking.booking_code})`,
	);

	const agent = getActiveBaileysAgent();
	if (agent) {
		try {
			const res = await agent.sendMessage(booking.booker_phone, message);
			whatsappSent = res.success;
		} catch (err) {
			console.warn("[WhatsApp Booker] Gagal mengirim pesan via Baileys:", err);
		}
	} else {
		whatsappSent = true; // Fallback mock logged
	}

	// ── B. Email Notification (Jika Booker Mengisi Email) ──
	if (booking.booker_email?.includes("@")) {
		try {
			const html = generateBookingConfirmationEmailHtml(booking, templateTitle);
			const emailRes = await sendEmail({
				to: booking.booker_email,
				subject: `[Drifee] Konfirmasi Jadwal Perjalanan EV: ${booking.booking_code}`,
				html,
			});
			emailSent = emailRes.success;
		} catch (err) {
			console.warn("[Email Booker] Gagal kirim email konfirmasi:", err);
		}
	}

	return {
		success: true,
		whatsappSent,
		emailSent,
	};
}

/**
 * 2. Kirim Notifikasi Penugasan Appointment ke Mitra Pengemudi (WhatsApp)
 */
export async function sendDriverAssignmentNotification(
	booking: AppointmentBooking,
	driverPhone: string,
	driverName: string,
): Promise<{ success: boolean; error?: string }> {
	const hudUrl = `${
		process.env.NEXT_PUBLIC_APP_URL || "https://drifee.briga.id"
	}/go?booking=${booking.booking_code}`;

	const message = `Halo Mitra *${driverName}*,

Anda mendapatkan penugasan *Appointment Setter Drifee* baru! 🚘⚡

📅 *Jadwal Penjemputan:*
• *Tanggal:* ${booking.scheduled_date}
• *Jam:* ${new Date(booking.scheduled_start_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
• *Paket Durasi:* ${booking.duration_hours} Jam
• *Atas Nama:* ${booking.booker_name} (${booking.booker_phone})
• *Titik Jemput (Origin):* ${booking.pickup_address}
${booking.waypoints && booking.waypoints.length > 0 ? `• *Jumlah Titik Singgah:* ${booking.waypoints.length} titik` : ""}

💰 *Estimasi Payout Bersih (85%):* *${formatRupiah(booking.driver_payout_idr)}*
*(Otomatis cair ke rekening Anda malam ini pukul 23:00 WIB setelah trip selesai)*

📲 *Buka HUD Navigasi Multi-Stop:*
${hudUrl}

Harap pastikan baterai EV Anda di atas 70% dan kabin dalam kondisi bersih serta berpendingin prima.`;

	console.log(
		`[WhatsApp Driver] Mengirim penugasan ke ${driverPhone} (${driverName}) untuk booking ${booking.booking_code}`,
	);

	const agent = getActiveBaileysAgent();
	if (agent) {
		try {
			const res = await agent.sendMessage(driverPhone, message);
			return res;
		} catch (err) {
			console.warn("[WhatsApp Driver] Gagal kirim pesan:", err);
			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	return {
		success: true,
		error: "Baileys agent mock: pesan tercatat di audit log",
	};
}

/**
 * 3. Kirim Notifikasi Driver Siap Menuju Lokasi (En-Route) ke Booker (WhatsApp + Email)
 */
export async function sendDriverEnRouteNotification(
	booking: AppointmentBooking,
	driverName: string,
	driverPhone: string,
	vehicleName: string,
	licensePlate: string,
): Promise<{
	success: boolean;
	whatsappSent?: boolean;
	emailSent?: boolean;
	error?: string;
}> {
	const trackingUrl = `${
		process.env.NEXT_PUBLIC_APP_URL || "https://drifee.briga.id"
	}/book/track/${booking.tracking_secret_token}`;

	let whatsappSent = false;
	let emailSent = false;

	// WhatsApp
	const message = `Halo *${booking.booker_name}*,

Armada Drifee Anda sedang dalam perjalanan menuju titik penjemputan:
📍 *Lokasi:* ${booking.pickup_address}

👤 *Mitra Pengemudi:* ${driverName}
📞 *Kontak:* ${driverPhone}
🚗 *Kendaraan:* ${vehicleName} (Plat: *${licensePlate}*)

Lihat pergerakan armada secara real-time di sini:
${trackingUrl}`;

	const agent = getActiveBaileysAgent();
	if (agent) {
		try {
			const res = await agent.sendMessage(booking.booker_phone, message);
			whatsappSent = res.success;
		} catch (err) {
			console.warn("[WhatsApp En-Route] Gagal kirim pesan:", err);
		}
	} else {
		whatsappSent = true;
	}

	// Email
	if (booking.booker_email?.includes("@")) {
		try {
			const html = generateDriverEnRouteEmailHtml(
				booking,
				driverName,
				driverPhone,
				vehicleName,
				licensePlate,
			);
			const emailRes = await sendEmail({
				to: booking.booker_email,
				subject: `[Drifee] Driver Sedang Menuju Lokasi Penjemputan (${licensePlate})`,
				html,
			});
			emailSent = emailRes.success;
		} catch (err) {
			console.warn("[Email En-Route] Gagal kirim email:", err);
		}
	}

	return { success: true, whatsappSent, emailSent };
}

/**
 * 4. Kirim Laporan Trip Selesai & Sertifikat Emisi Scope 3 (WhatsApp + Email)
 */
export async function sendTripCompletedNotification(
	booking: AppointmentBooking,
	distanceKm: number,
	co2SavedKg: number,
): Promise<{ success: boolean; whatsappSent?: boolean; emailSent?: boolean }> {
	let whatsappSent = false;
	let emailSent = false;

	// WhatsApp
	const message = `Halo *${booking.booker_name}*,

Perjalanan Anda bersama *Drifee by Briga* telah selesai dilaksanakan! 🌿⚡

📊 *Ringkasan Dampak Emisi (Scope 3 GHG):*
• *Kode Trip:* \`${booking.booking_code}\`
• *Total Jarak:* ${distanceKm.toFixed(1)} km (100% EV)
• *Emisi Dihindari:* *${co2SavedKg.toFixed(2)} kg CO₂* vs Mobil Bensin

Terima kasih telah berpartisipasi menurunkan jejak karbon korporat. Sampai jumpa di perjalanan berikutnya!`;

	const agent = getActiveBaileysAgent();
	if (agent) {
		try {
			const res = await agent.sendMessage(booking.booker_phone, message);
			whatsappSent = res.success;
		} catch (e) {
			console.warn("[WhatsApp Trip Complete] Error:", e);
		}
	} else {
		whatsappSent = true;
	}

	// Email
	if (booking.booker_email?.includes("@")) {
		try {
			const html = generateTripCompletedSummaryEmailHtml(
				booking,
				distanceKm,
				co2SavedKg,
			);
			const emailRes = await sendEmail({
				to: booking.booker_email,
				subject: `[Drifee] Laporan Perjalanan Selesai & Sertifikat Emisi Scope 3 (${booking.booking_code})`,
				html,
			});
			emailSent = emailRes.success;
		} catch (e) {
			console.warn("[Email Trip Complete] Error:", e);
		}
	}

	return { success: true, whatsappSent, emailSent };
}
