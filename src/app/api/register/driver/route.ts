import { type NextRequest, NextResponse } from "next/server";
import type { DriverInsert, DriverUpdate } from "@/lib/supabase/schema";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";

interface DriverRegistrationRequest {
	fullName: string;
	nationalId: string;
	phone: string;
	email: string;
	address: string;
	licenseType: string;
	licenseNumber: string;
	licenseExpiry: string;
	emergencyName: string;
	emergencyPhone: string;
	emergencyRelation: string;
	bankName: string;
	accountNumber: string;
	accountHolder: string;
}

function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined && value !== null && value !== "") out[key] = value;
	}
	return out as Partial<T>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const data: DriverRegistrationRequest = await request.json();

		// Validate required fields
		const requiredFields: (keyof DriverRegistrationRequest)[] = [
			"fullName",
			"nationalId",
			"phone",
			"email",
			"address",
			"licenseType",
			"licenseNumber",
			"licenseExpiry",
			"emergencyName",
			"emergencyPhone",
			"emergencyRelation",
			"bankName",
			"accountNumber",
			"accountHolder",
		];

		for (const field of requiredFields) {
			if (!data[field]) {
				return NextResponse.json(
					{ success: false, message: `Missing required field: ${field}` },
					{ status: 400 },
				);
			}
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

		const profileFields = definedOnly({
			full_name: data.fullName,
			ktp: data.nationalId,
			phone: data.phone,
			address: data.address,
			license_type: data.licenseType,
			license_number: data.licenseNumber,
			license_expiry: data.licenseExpiry,
			emergency_name: data.emergencyName,
			emergency_phone: data.emergencyPhone,
			emergency_relation: data.emergencyRelation,
			bank_name: data.bankName,
			bank_account_number: data.accountNumber,
			bank_account_holder: data.accountHolder,
			registration_status: "pending_verification",
			updated_at: new Date().toISOString(),
		});

		// Email UNIQUE → pakai upsert agar pendaftaran ulang memperbarui baris
		// yang sama alih-alih gagal atau menduplikasi driver.
		const { data: upserted, error } = await supabaseAdmin
			.from("drivers")
			.upsert(
				{
					...(profileFields as DriverUpdate),
					email: data.email,
					name: data.fullName,
				} as DriverInsert,
				{ onConflict: "email" },
			)
			.select("id, email, registration_status")
			.single();

		if (error) {
			console.error("[API] Driver registration error:", error);
			return NextResponse.json(
				{ success: false, message: "Failed to register driver" },
				{ status: 500 },
			);
		}

		// TODO: Kirim email verifikasi (butuh kredensial SMTP).

		return NextResponse.json(
			{
				success: true,
				message: "Driver registration received",
				data: {
					id: upserted.id,
					email: upserted.email,
					status: upserted.registration_status ?? "pending_verification",
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("[API] Driver registration error:", error);
		return NextResponse.json(
			{ success: false, message: "Internal server error" },
			{ status: 500 },
		);
	}
}
