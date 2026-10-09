// ─────────────────────────────────────────────────────────────
// appointments/service.ts — Drifee Appointment Setter Core Service
//
// Layanan logika bisnis untuk template, reservasi jadwal,
// manajemen waypoints, dan alur penugasan pengemudi EV.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";
import {
	sendBookingConfirmationToBooker,
	sendDriverAssignmentNotification,
} from "./notifications";
import { calculateAppointmentFare } from "./pricing";
import type {
	AppointmentBooking,
	AppointmentBookingStatus,
	AppointmentTemplate,
	AppointmentWaypoint,
	CreateBookingInput,
	DurationHours,
} from "./types";

// In-Memory store for tests / offline fallback
const memTemplates = new Map<string, AppointmentTemplate>();
const memBookings = new Map<string, AppointmentBooking>();
const memWaypoints = new Map<string, AppointmentWaypoint[]>();

// Seed in-memory demo template
memTemplates.set("cikarang-executive-visit", {
	id: "tpl-cikarang-01",
	slug: "cikarang-executive-visit",
	title: "Executive & HR Factory Tour (Cikarang Industrial Estate)",
	description:
		"Layanan penjemputan delegasi bisnis, rekrutmen kandidat, dan audit fasilitas industri Cikarang dengan armada EV kabin hening dan driver terlatih.",
	allowed_durations: [2, 4, 8, 12],
	default_duration: 8,
	is_destination_locked: false,
	max_waypoints: 5,
	payment_sponsor_mode: "corporate_esg",
	base_discount_brc: 0,
	buffer_minutes_between_trips: 60,
	operating_start_time: "06:00:00",
	operating_end_time: "22:00:00",
	advance_booking_days: 14,
	is_active: true,
	created_at: new Date().toISOString(),
});

/**
 * 1. Mendapatkan Template berdasarkan Slug
 */
export async function getTemplateBySlug(
	slug: string,
): Promise<AppointmentTemplate | null> {
	if (process.env.NODE_ENV !== "test" && isAdminConfigured()) {
		try {
			const { data, error } = await supabaseAdmin
				.from("appointment_templates")
				.select("*")
				.eq("slug", slug)
				.eq("is_active", true)
				.single();

			if (!error && data && data.slug) {
				return data as AppointmentTemplate;
			}
		} catch (err) {
			console.warn(
				"[Appointment Service] Supabase read failed, fallback to memory:",
				err,
			);
		}
	}

	return memTemplates.get(slug) || null;
}

/**
 * 2. Daftar Template untuk Dashboard Perusahaan / Admin
 */
export async function listTemplates(
	corporateId?: string,
): Promise<AppointmentTemplate[]> {
	if (isAdminConfigured()) {
		try {
			let query = supabaseAdmin
				.from("appointment_templates")
				.select("*")
				.order("created_at", { ascending: false });

			if (corporateId) {
				query = query.eq("corporate_id", corporateId);
			}

			const { data, error } = await query;
			if (!error && data) {
				return data as AppointmentTemplate[];
			}
		} catch (err) {
			console.warn("[Appointment Service] Supabase list failed:", err);
		}
	}

	return Array.from(memTemplates.values());
}

/**
 * 3. Membuat Pemesanan Baru (Booking)
 */
export async function createAppointmentBooking(
	input: CreateBookingInput,
): Promise<{
	success: boolean;
	booking?: AppointmentBooking;
	error?: string;
}> {
	const template = await getTemplateBySlug(input.templateSlug);
	if (!template) {
		return { success: false, error: "Template agenda tidak ditemukan" };
	}

	// Validasi durasi
	const duration: DurationHours = input.durationHours;
	if (!template.allowed_durations.includes(duration)) {
		return {
			success: false,
			error: `Durasi ${duration} jam tidak diizinkan untuk agenda ini`,
		};
	}

	// Hitung waktu selesai
	const startTime = new Date(
		`${input.scheduledDate}T${input.scheduledStartTime.includes("T") ? input.scheduledStartTime.split("T")[1] : input.scheduledStartTime}`,
	);
	const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

	// Hitung tarif & komisi
	const fareCalc = calculateAppointmentFare(duration, 0);

	// Generate kode booking & token unik
	const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
	const dateClean = input.scheduledDate.replace(/-/g, "").slice(2);
	const bookingCode = `DRF-APT-${dateClean}-${randomSuffix}`;
	const trackingSecretToken = crypto.randomBytes(24).toString("hex");

	const newBooking: AppointmentBooking = {
		id: crypto.randomUUID(),
		booking_code: bookingCode,
		template_id: template.id,
		corporate_id: template.corporate_id || null,
		booker_name: input.bookerName,
		booker_phone: input.bookerPhone,
		booker_email: input.bookerEmail || null,
		guest_count: input.guestCount || 1,
		special_notes: input.specialNotes || null,
		scheduled_date: input.scheduledDate,
		scheduled_start_time: startTime.toISOString(),
		scheduled_end_time: endTime.toISOString(),
		duration_hours: duration,
		pickup_address: input.pickupAddress,
		pickup_lat: input.pickupLat,
		pickup_lng: input.pickupLng,
		gross_fare_idr: fareCalc.baseFareIdr,
		platform_fee_idr: fareCalc.platformFeeIdr,
		driver_payout_idr: fareCalc.driverPayoutIdr,
		briga_coins_spent: 0,
		overtime_hours: 0,
		overtime_fare_idr: 0,
		payment_status:
			template.payment_sponsor_mode === "corporate_esg"
				? "sponsored_esg"
				: "pending",
		booking_status: "unassigned",
		tracking_secret_token: trackingSecretToken,
		is_settled_to_driver: false,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};

	// Persiapkan Waypoints
	const waypoints: AppointmentWaypoint[] = (input.waypoints || []).map(
		(wp, idx) => ({
			id: crypto.randomUUID(),
			booking_id: newBooking.id,
			stop_order: idx + 1,
			stop_name: wp.stop_name,
			address: wp.address,
			lat: wp.lat,
			lng: wp.lng,
			contact_person: wp.contact_person || null,
			contact_phone: wp.contact_phone || null,
			stop_notes: wp.stop_notes || null,
			is_completed: false,
		}),
	);

	newBooking.waypoints = waypoints;

	// Simpan ke Supabase jika tersedia
	if (process.env.NODE_ENV !== "test" && isAdminConfigured()) {
		try {
			const { error: bookingErr } = await supabaseAdmin
				.from("appointment_bookings")
				.insert({
					id: newBooking.id,
					booking_code: newBooking.booking_code,
					template_id: newBooking.template_id,
					corporate_id: newBooking.corporate_id,
					booker_name: newBooking.booker_name,
					booker_phone: newBooking.booker_phone,
					booker_email: newBooking.booker_email,
					guest_count: newBooking.guest_count,
					special_notes: newBooking.special_notes,
					scheduled_date: newBooking.scheduled_date,
					scheduled_start_time: newBooking.scheduled_start_time,
					scheduled_end_time: newBooking.scheduled_end_time,
					duration_hours: newBooking.duration_hours,
					pickup_address: newBooking.pickup_address,
					pickup_lat: newBooking.pickup_lat,
					pickup_lng: newBooking.pickup_lng,
					gross_fare_idr: newBooking.gross_fare_idr,
					platform_fee_idr: newBooking.platform_fee_idr,
					driver_payout_idr: newBooking.driver_payout_idr,
					payment_status: newBooking.payment_status,
					booking_status: newBooking.booking_status,
					tracking_secret_token: newBooking.tracking_secret_token,
				});

			if (bookingErr) {
				console.error(
					"[Appointment Service] Supabase insert booking error:",
					bookingErr,
				);
			} else if (waypoints.length > 0) {
				await supabaseAdmin.from("appointment_waypoints").insert(waypoints);
			}
		} catch (err) {
			console.warn(
				"[Appointment Service] Supabase insert caught exception:",
				err,
			);
		}
	}

	// Simpan ke memory fallback
	memBookings.set(newBooking.id, newBooking);
	memWaypoints.set(newBooking.id, waypoints);

	// Kirim notifikasi WhatsApp otomatis ke pemesan
	try {
		await sendBookingConfirmationToBooker(newBooking, template.title);
	} catch (e) {
		console.warn("[Appointment Service] Failed to send WA confirmation:", e);
	}

	return { success: true, booking: newBooking };
}

/**
 * 4. Cari Booking berdasarkan Secret Tracking Token
 */
export async function getBookingByTrackingToken(
	token: string,
): Promise<AppointmentBooking | null> {
	if (process.env.NODE_ENV !== "test" && isAdminConfigured()) {
		try {
			const { data: booking, error } = await supabaseAdmin
				.from("appointment_bookings")
				.select(
					"*, driver:drivers(id, name, phone, avatar_url, average_eco_score), vehicle:vehicles(id, name, model, license_plate), corporate:corporate_profiles(id, company_name)",
				)
				.eq("tracking_secret_token", token)
				.single();

			if (!error && booking) {
				const { data: waypoints } = await supabaseAdmin
					.from("appointment_waypoints")
					.select("*")
					.eq("booking_id", booking.id)
					.order("stop_order", { ascending: true });

				return {
					...booking,
					waypoints: waypoints || [],
				} as AppointmentBooking;
			}
		} catch (err) {
			console.warn("[Appointment Service] Supabase read by token failed:", err);
		}
	}

	for (const b of memBookings.values()) {
		if (b.tracking_secret_token === token) {
			return {
				...b,
				waypoints: memWaypoints.get(b.id) || [],
			};
		}
	}

	return null;
}

/**
 * 5. Cari Booking berdasarkan Booking Code
 */
export async function getBookingByCode(
	code: string,
): Promise<AppointmentBooking | null> {
	if (isAdminConfigured()) {
		try {
			const { data: booking, error } = await supabaseAdmin
				.from("appointment_bookings")
				.select(
					"*, driver:drivers(id, name, phone, avatar_url), vehicle:vehicles(id, name, model, license_plate)",
				)
				.eq("booking_code", code)
				.single();

			if (!error && booking) {
				const { data: waypoints } = await supabaseAdmin
					.from("appointment_waypoints")
					.select("*")
					.eq("booking_id", booking.id)
					.order("stop_order", { ascending: true });

				return { ...booking, waypoints: waypoints || [] } as AppointmentBooking;
			}
		} catch (err) {
			console.warn("[Appointment Service] Supabase read by code failed:", err);
		}
	}

	for (const b of memBookings.values()) {
		if (b.booking_code === code) {
			return { ...b, waypoints: memWaypoints.get(b.id) || [] };
		}
	}

	return null;
}

/**
 * 6. Penugasan Driver & Kendaraan ke Booking
 */
export async function assignDriverToBooking(
	bookingId: string,
	driverId: string,
	vehicleId?: string,
): Promise<{ success: boolean; error?: string }> {
	const booking = memBookings.get(bookingId);

	if (isAdminConfigured()) {
		try {
			const { error } = await supabaseAdmin
				.from("appointment_bookings")
				.update({
					driver_id: driverId,
					vehicle_id: vehicleId || null,
					booking_status: "assigned",
					updated_at: new Date().toISOString(),
				})
				.eq("id", bookingId);

			if (error) {
				return { success: false, error: error.message };
			}

			// Ambil detail driver untuk kirim notifikasi
			const { data: driver } = await supabaseAdmin
				.from("drivers")
				.select("id, name, phone")
				.eq("id", driverId)
				.single();

			if (driver && booking) {
				await sendDriverAssignmentNotification(
					booking,
					driver.phone,
					driver.name,
				);
			}

			return { success: true };
		} catch (err) {
			console.warn("[Appointment Service] Assign driver error:", err);
		}
	}

	if (booking) {
		booking.driver_id = driverId;
		booking.vehicle_id = vehicleId || null;
		booking.booking_status = "assigned";
		return { success: true };
	}

	return { success: false, error: "Booking tidak ditemukan" };
}

/**
 * 7. Update Status Perjalanan Booking
 */
export async function updateBookingStatus(
	bookingId: string,
	newStatus: AppointmentBookingStatus,
	notes?: string,
): Promise<{ success: boolean; error?: string }> {
	if (isAdminConfigured()) {
		try {
			const { error } = await supabaseAdmin
				.from("appointment_bookings")
				.update({
					booking_status: newStatus,
					updated_at: new Date().toISOString(),
				})
				.eq("id", bookingId);

			if (error) {
				return { success: false, error: error.message };
			}

			// Catat ke log status
			await supabaseAdmin.from("appointment_status_logs").insert({
				booking_id: bookingId,
				to_status: newStatus,
				notes: notes || null,
			});

			return { success: true };
		} catch (err) {
			console.warn("[Appointment Service] Update status error:", err);
		}
	}

	const booking = memBookings.get(bookingId);
	if (booking) {
		booking.booking_status = newStatus;
		return { success: true };
	}

	return { success: false, error: "Booking tidak ditemukan" };
}
