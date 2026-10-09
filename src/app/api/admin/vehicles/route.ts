// ─────────────────────────────────────────────────────────────
// /api/admin/vehicles — Fleet & Rental Partner Management API
//
// Handles CRUD operations for decentralized EV vehicles,
// including Bluetooth names, QR tokens, and rental partners.
//
// CATATAN KEAMANAN: ketiga handler WAJIB lolos requireAdmin(). Sebelumnya
// endpoint ini hanya dilindungi middleware "sudah login", sehingga akun
// biasa bisa membuat dan mengubah armada.
//
// CATATAN KEBERUNTUHAN: dulu ada fallback tiruan (DEFAULT_FALLBACK_VEHICLES)
// yang membalas 201 berisi id palsu `veh_<timestamp>` tanpa menyentuh
// database. Itu dihapus — kalau database tidak terkonfigurasi, jawabannya
// 503 dengan alasan jelas, bukan keberhasilan palsu. Daftar kosong karena
// memang belum ada kendaraan tetap dibalas 200 dengan array kosong.
// ─────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";
import type { EVVehicle } from "@/types/telematics";

const DB_NOT_CONFIGURED =
	"Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";

/** Kendaraan tanpa kategori yang dikenal tidak boleh dipaksa jadi 'standard'. */
const DEFAULT_CATEGORY = "standard";

export async function GET(request: NextRequest) {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	try {
		if (!isAdminConfigured()) {
			return NextResponse.json(
				{ success: false, error: DB_NOT_CONFIGURED, source: "unavailable" },
				{ status: 503 },
			);
		}

		const { searchParams } = request.nextUrl;
		const search = searchParams.get("q")?.toLowerCase();

		let query = supabaseAdmin
			.from("vehicles")
			.select("*")
			.order("created_at", { ascending: false });

		if (search) {
			query = query.or(
				`code.ilike.%${search}%,name.ilike.%${search}%,license_plate.ilike.%${search}%,bluetooth_name.ilike.%${search}%,rental_partner_name.ilike.%${search}%`,
			);
		}

		const { data, error } = await query;

		if (error) {
			console.error("[API] Gagal memuat kendaraan:", error);
			return NextResponse.json(
				{ success: false, error: `Gagal memuat kendaraan: ${error.message}` },
				{ status: 500 },
			);
		}

		const vehicles: EVVehicle[] = (data ?? []).map((v) => ({
			id: v.id,
			code: v.code,
			name: v.name,
			model: v.model || v.name,
			licensePlate: v.license_plate,
			batteryCapacityKwh: Number(v.battery_capacity_kwh) || 30,
			currentSoC: 90,
			estimatedRangeKm: Math.round(
				((Number(v.battery_capacity_kwh) || 30) /
					(Number(v.efficiency_kwh_per_100km) || 12)) *
					100,
			),
			hubLocation: v.hub_location || "Area Bebas Koridor Cikarang",
			status: v.status || "available",
			efficiencyKwhPer100Km: Number(v.efficiency_kwh_per_100km) || 12,
			category: v.category || DEFAULT_CATEGORY,
			seats: 4,
			bluetoothName: v.bluetooth_name || null,
			rentalPartnerName: v.rental_partner_name || null,
			rentalPartnerPhone: v.rental_partner_phone || null,
			qrCodeToken: v.qr_code_token || null,
			lastOdometerKm: Number(v.last_odometer_km) || 0,
		}));

		return NextResponse.json({ success: true, vehicles, source: "supabase" });
	} catch (err) {
		return NextResponse.json(
			{ success: false, error: (err as Error).message },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	try {
		const body = await request.json();
		const {
			code,
			name,
			model,
			licensePlate,
			batteryCapacityKwh,
			efficiencyKwhPer100Km,
			bluetoothName,
			rentalPartnerName,
			rentalPartnerPhone,
			hubLocation,
			status,
		} = body;

		if (!code || !licensePlate || !name) {
			return NextResponse.json(
				{ success: false, error: "code, name, dan licensePlate wajib diisi" },
				{ status: 400 },
			);
		}

		if (!isAdminConfigured()) {
			return NextResponse.json(
				{ success: false, error: DB_NOT_CONFIGURED, persisted: false },
				{ status: 503 },
			);
		}

		const newVehicleRecord = {
			code,
			name,
			model: model || name,
			license_plate: licensePlate.toUpperCase().trim(),
			battery_capacity_kwh: Number(batteryCapacityKwh) || 30,
			efficiency_kwh_per_100km: Number(efficiencyKwhPer100Km) || 12,
			bluetooth_name: bluetoothName?.trim() || null,
			rental_partner_name: rentalPartnerName?.trim() || null,
			rental_partner_phone: rentalPartnerPhone?.trim() || null,
			qr_code_token: `QR-BRG-${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`,
			hub_location: hubLocation || "Koridor Cikarang",
			status: status || "available",
			updated_at: new Date().toISOString(),
		};

		const { data, error } = await supabaseAdmin
			.from("vehicles")
			.insert(newVehicleRecord)
			.select()
			.single();

		// `.single()` bisa mengembalikan array kosong tanpa error bila lapisan
		// HTTP tidak menerapkan semantik PostgREST. Array kosong tetap "tidak
		// ada baris tersimpan", jadi diperlakukan sebagai kegagalan — jangan
		// balas 201 dengan baris yang tidak ada.
		if (error || !data || Array.isArray(data)) {
			console.error(
				"[API] Gagal menyimpan kendaraan:",
				error ?? "respons tanpa baris",
			);
			return NextResponse.json(
				{
					success: false,
					error: `Gagal menyimpan kendaraan${error ? `: ${error.message}` : ": respons tanpa baris."}`,
					persisted: false,
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, vehicle: data }, { status: 201 });
	} catch (err) {
		return NextResponse.json(
			{ success: false, error: (err as Error).message },
			{ status: 500 },
		);
	}
}

export async function PATCH(request: NextRequest) {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	try {
		const body = await request.json();
		const { id, code, ...updates } = body;

		if (!id && !code) {
			return NextResponse.json(
				{ success: false, error: "id atau code wajib disertakan untuk update" },
				{ status: 400 },
			);
		}

		if (!isAdminConfigured()) {
			return NextResponse.json(
				{ success: false, error: DB_NOT_CONFIGURED, persisted: false },
				{ status: 503 },
			);
		}

		const payload: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};

		if (updates.name !== undefined) payload.name = updates.name;
		if (updates.model !== undefined) payload.model = updates.model;
		if (updates.licensePlate !== undefined)
			payload.license_plate = updates.licensePlate.toUpperCase().trim();
		if (updates.bluetoothName !== undefined)
			payload.bluetooth_name = updates.bluetoothName?.trim() || null;
		if (updates.rentalPartnerName !== undefined)
			payload.rental_partner_name = updates.rentalPartnerName?.trim() || null;
		if (updates.rentalPartnerPhone !== undefined)
			payload.rental_partner_phone = updates.rentalPartnerPhone?.trim() || null;
		if (updates.batteryCapacityKwh !== undefined)
			payload.battery_capacity_kwh = Number(updates.batteryCapacityKwh);
		if (updates.efficiencyKwhPer100Km !== undefined)
			payload.efficiency_kwh_per_100km = Number(updates.efficiencyKwhPer100Km);
		if (updates.status !== undefined) payload.status = updates.status;
		if (updates.hubLocation !== undefined)
			payload.hub_location = updates.hubLocation;
		if (updates.lastOdometerKm !== undefined)
			payload.last_odometer_km = Number(updates.lastOdometerKm);

		let query = supabaseAdmin.from("vehicles").update(payload);
		if (id) {
			query = query.eq("id", id);
		} else {
			query = query.eq("code", code);
		}

		const { data, error } = await query.select().single();

		if (error) {
			console.error("[API] Gagal memperbarui kendaraan:", error);
			return NextResponse.json(
				{
					success: false,
					error: `Gagal memperbarui kendaraan: ${error.message}`,
				},
				{ status: 500 },
			);
		}

		if (!data || Array.isArray(data) || !(data.code || data.id)) {
			return NextResponse.json(
				{ success: false, error: "Kendaraan tidak ditemukan." },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true, vehicle: data });
	} catch (err) {
		return NextResponse.json(
			{ success: false, error: (err as Error).message },
			{ status: 500 },
		);
	}
}
