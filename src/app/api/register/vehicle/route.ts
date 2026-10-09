import { type NextRequest, NextResponse } from "next/server";
import type { VehicleInsert } from "@/lib/supabase/schema";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";

interface VehicleRegistrationRequest {
	type: string;
	brand: string;
	model: string;
	year: string;
	color: string;
	ownershipStatus: "company" | "leased" | "personal" | "consortium";
	leasingCompany?: string;
	contractEnd?: string;
	consortiumName?: string;
	consortiumMembers?: string;
	licensePlate: string;
	chassisNumber: string;
	engineNumber: string;
	stnkExpiry: string;
	batteryCapacity: string;
	odometer: string;
}

/**
 * Bukti foto (foto kendaraan, STNK, BPKB, kontrak leasing) TIDAK pernah sampai
 * ke server: formulir melakukan JSON.stringify pada objek `File`, sehingga isinya
 * tiba sebagai `{}`. Endpoint iniMelaporkan hal tersebut secara eksplisit
 * daripada diam-diam membuang data dan mengembalikan "sukses".
 */
const PHOTO_FIELDS = [
	"vehiclePhoto",
	"stnkPhoto",
	"bpkbPhoto",
	"leasingContract",
] as const;

function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined && value !== null && value !== "") out[key] = value;
	}
	return out as Partial<T>;
}

/** Kode kendaraan turunan yang stabil & deterministik dari plat nomor. */
function buildVehicleCode(licensePlate: string): string {
	const normalized = licensePlate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
	const suffix = normalized.replace(/^(B|BA|BE)/, "");
	return `EV-${(suffix || normalized).slice(-4) || "NEW"}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const data: VehicleRegistrationRequest & Record<string, unknown> =
			await request.json();

		// Validate required fields
		const requiredFields: (keyof VehicleRegistrationRequest)[] = [
			"type",
			"brand",
			"model",
			"year",
			"color",
			"ownershipStatus",
			"licensePlate",
			"chassisNumber",
			"engineNumber",
			"stnkExpiry",
			"batteryCapacity",
			"odometer",
		];

		for (const field of requiredFields) {
			if (!data[field]) {
				return NextResponse.json(
					{ success: false, message: `Missing required field: ${field}` },
					{ status: 400 },
				);
			}
		}

		// Validate ownership-specific fields
		if (
			data.ownershipStatus === "leased" &&
			(!data.leasingCompany || !data.contractEnd)
		) {
			return NextResponse.json(
				{
					success: false,
					message:
						"Leasing company and contract end date are required for leased vehicles",
				},
				{ status: 400 },
			);
		}

		if (
			data.ownershipStatus === "consortium" &&
			(!data.consortiumName || !data.consortiumMembers)
		) {
			return NextResponse.json(
				{
					success: false,
					message:
						"Consortium name and members are required for consortium vehicles",
				},
				{ status: 400 },
			);
		}

		if (!isAdminConfigured()) {
			return NextResponse.json(
				{
					success: false,
					message:
						"Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
				},
				{ status: 503 },
			);
		}

		// Deteksi bukti foto yang terkirim: JSON.stringify(File) menghasilkan `{}`,
		// jadi isinya tidak pernah tersimpan. Kita laporkan, bukan mengabaikannya.
		const receivedButUnstoredPhotos = PHOTO_FIELDS.filter(
			(field) => data[field] !== null && data[field] !== undefined,
		);

		const insertPayload: VehicleInsert = {
			...(definedOnly({
				code: buildVehicleCode(data.licensePlate),
				brand: data.brand,
				model: data.model,
				color: data.color,
				production_year: Number(data.year),
				vehicle_type: data.type,
				license_plate: data.licensePlate,
				chassis_number: data.chassisNumber,
				engine_number: data.engineNumber,
				stnk_expiry: data.stnkExpiry,
				battery_capacity_kwh: Number(data.batteryCapacity),
				last_odometer_km: Number(data.odometer),
				ownership_status: data.ownershipStatus,
				leasing_company: data.leasingCompany,
				leasing_contract_end: data.contractEnd,
				consortium_name: data.consortiumName,
				consortium_members: data.consortiumMembers,
				registration_status: "pending_verification",
				status: "available",
			}) as VehicleInsert),
			// `name` NOT NULL di migration 001 — pakai label yang bisa dibaca manusia.
			name: `${data.brand} ${data.model}`,
		};

		const { data: inserted, error } = await supabaseAdmin
			.from("vehicles")
			.insert(insertPayload)
			.select("id, code, license_plate, registration_status")
			.single();

		if (error) {
			console.error("[API] Vehicle registration error:", error);
			return NextResponse.json(
				{ success: false, message: "Failed to register vehicle" },
				{ status: 500 },
			);
		}

		// TODO: Kirim email verifikasi (butuh kredensial SMTP).

		return NextResponse.json(
			{
				success: true,
				message: "Vehicle registration received",
				data: {
					id: inserted.id,
					code: inserted.code,
					licensePlate: inserted.license_plate,
					status: inserted.registration_status ?? "pending_verification",
				},
				// Peringatan eksplisit: bukti foto belum tersimpan sama sekali.
				warnings:
					receivedButUnstoredPhotos.length > 0
						? [
								"Photo evidence was submitted but could not be stored: the form sends JSON, so File objects arrive empty. Vehicle data was saved; photos require multipart upload to Supabase Storage.",
							]
						: [],
				photosStored: false,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("[API] Vehicle registration error:", error);
		return NextResponse.json(
			{ success: false, message: "Internal server error" },
			{ status: 500 },
		);
	}
}
