// ─────────────────────────────────────────────────────────────
// api/appointments/webhook/lynk/route.ts — Lynk.id Payment Webhook Listener
//
// Menerima callback instan saat tamu/booker selesai membayar
// melalui Lynk.id (QRIS, GoPay, OVO, ShopeePay, Virtual Account).
// ─────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { sendBookingConfirmationToBooker } from "@/lib/appointments/notifications";
import {
	getBookingByCode,
	getTemplateBySlug,
} from "@/lib/appointments/service";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest): Promise<NextResponse> {
	return NextResponse.json({
		success: true,
		service: "Drifee Lynk.id Webhook Listener",
		status: "active",
		timestamp: new Date().toISOString(),
	});
}

export async function OPTIONS(): Promise<NextResponse> {
	return new NextResponse(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
			"Access-Control-Allow-Headers":
				"Content-Type, Authorization, x-lynk-signature, x-webhook-secret",
		},
	});
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		let payload: Record<string, unknown> = {};
		try {
			payload = (await request.json()) as Record<string, unknown>;
		} catch {
			payload = {};
		}

		// Jika Lynk.id mengirim test ping / verifikasi koneksi awal
		if (
			!payload ||
			Object.keys(payload).length === 0 ||
			payload.event === "test" ||
			payload.event === "ping" ||
			payload.test === true
		) {
			return NextResponse.json({
				success: true,
				message: "Drifee Lynk.id webhook handshake successful",
			});
		}

		// Verifikasi secret token jika dikonfigurasi
		const webhookSecret = process.env.LYNK_WEBHOOK_SECRET;
		const incomingSecret =
			request.headers.get("x-lynk-signature") ||
			request.headers.get("x-webhook-secret") ||
			request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
			request.nextUrl.searchParams.get("secret") ||
			payload.secret ||
			payload.webhook_secret;

		if (webhookSecret && incomingSecret && incomingSecret !== webhookSecret) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized webhook signature" },
				{ status: 401 },
			);
		}

		// Jika ada URL forwarding (seperti Google Apps Script Brigawan yang lama),
		// teruskan payload ke sana secara asinkron agar automasi lama tetap berjalan lancar
		const forwardUrl = process.env.LYNK_FORWARD_WEBHOOK_URL;
		if (forwardUrl) {
			fetch(forwardUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			}).catch((err) => {
				console.warn(
					"[Lynk.id Webhook] Gagal meneruskan payload ke webhook lama:",
					err,
				);
			});
		}
		const orderId = payload.order_id || payload.id || payload.invoice_id;
		const paymentStatus = String(
			payload.status || payload.payment_status || "SUCCESS",
		).toUpperCase();
		const amount = payload.amount || payload.total_price;

		const metadata = payload.metadata as Record<string, unknown> | undefined;
		const bookingCode =
			(metadata?.booking_code as string | undefined) ||
			(payload.notes as string | undefined) ||
			(payload.custom_field as string | undefined) ||
			(payload.order_id as string | undefined);

		// Cek apakah transaksi ini ditujukan untuk Drifee
		// Mengingat akun Lynk.id bisa dipakai bersama dengan ekosistem Brigawan,
		// kita hanya memproses pesanan yang memuat prefix kode booking Drifee: DRF-APT-
		const isDrifeeBooking =
			typeof bookingCode === "string" && bookingCode.includes("DRF-APT");

		if (!isDrifeeBooking) {
			return NextResponse.json({
				success: true,
				ignored: true,
				message: "Non-Drifee order acknowledged (shared Lynk.id account)",
			});
		}

		console.log(
			`[Lynk.id Webhook] Callback diterima untuk Drifee booking ${bookingCode} (Status: ${paymentStatus}, Amount: ${amount})`,
		);

		// Cari pesanan appointment
		const booking = await getBookingByCode(bookingCode);
		if (!booking) {
			console.warn(
				`[Lynk.id Webhook] Booking code ${bookingCode} tidak ditemukan di database`,
			);
			return NextResponse.json({
				success: true,
				ignored: true,
				message: `Booking ${bookingCode} not found in Drifee records`,
			});
		}

		// Jika pembayaran sukses
		if (
			paymentStatus === "SUCCESS" ||
			paymentStatus === "PAID" ||
			paymentStatus === "COMPLETED"
		) {
			// Update status pembayaran di database
			if (isAdminConfigured()) {
				await supabaseAdmin
					.from("appointment_bookings")
					.update({
						payment_status: "paid_online",
						payment_gateway_ref: String(orderId || "LYNK-PAYMENT"),
						updated_at: new Date().toISOString(),
					})
					.eq("id", booking.id);
			}

			booking.payment_status = "paid_online";
			booking.payment_gateway_ref = String(orderId || "LYNK-PAYMENT");

			// Kirim notifikasi WhatsApp tiket digital terbaru
			const template = booking.template_id
				? await getTemplateBySlug(booking.template_id)
				: null;
			await sendBookingConfirmationToBooker(
				booking,
				template?.title || "Chauffeur-Driven EV Mobility",
			);

			return NextResponse.json({
				success: true,
				message: "Payment successfully verified and booking updated",
				booking_code: booking.booking_code,
			});
		}

		return NextResponse.json({
			success: true,
			message: `Event acknowledged: ${paymentStatus}`,
		});
	} catch (error) {
		console.error("[Lynk.id Webhook] Processing error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal error",
			},
			{ status: 500 },
		);
	}
}
