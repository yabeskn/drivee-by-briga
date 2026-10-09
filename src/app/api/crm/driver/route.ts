import { type NextRequest, NextResponse } from "next/server";
import type { DriverInsert, DriverUpdate } from "@/lib/supabase/schema";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";

interface DriverCRMData {
	googleId?: string;
	email: string;
	fullName: string;
	phone: string;
	phoneVerified: boolean;
	ktp?: string;
	simType?: string;
	simNumber?: string;
	simExpiry?: string;
	emergencyName?: string;
	emergencyPhone?: string;
	emergencyRelation?: string;
	bankName?: string;
	bankOther?: string;
	accountNumber?: string;
	accountHolder?: string;
}

/** Buang key yang undefined/empty agar tidak menimpa kolom yang sudah terisi. */
function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined && value !== null && value !== "") out[key] = value;
	}
	return out as Partial<T>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const data: DriverCRMData = await request.json();

		if (!data.email || !data.fullName || !data.phone) {
			return NextResponse.json(
				{ success: false, error: "Email, fullName, and phone are required" },
				{ status: 400 },
			);
		}

		if (!data.phoneVerified) {
			return NextResponse.json(
				{ success: false, error: "Phone number must be verified" },
				{ status: 400 },
			);
		}

		if (!isAdminConfigured()) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
				},
				{ status: 503 },
			);
		}

		const profileFields = definedOnly({
			google_id: data.googleId,
			full_name: data.fullName,
			phone_verified: data.phoneVerified,
			ktp: data.ktp,
			sim_type: data.simType,
			sim_number: data.simNumber,
			sim_expiry: data.simExpiry,
			emergency_name: data.emergencyName,
			emergency_phone: data.emergencyPhone,
			emergency_relation: data.emergencyRelation,
			bank_name: data.bankName,
			bank_other: data.bankOther,
			bank_account_number: data.accountNumber,
			bank_account_holder: data.accountHolder,
			registration_status: "pending_verification",
			updated_at: new Date().toISOString(),
		});

		// Email bersifat UNIQUE: driver yang sudah ada diperbarui, bukan diduplikasi.
		const { data: existing, error: lookupError } = await supabaseAdmin
			.from("drivers")
			.select("id")
			.eq("email", data.email)
			.maybeSingle();

		if (lookupError) {
			console.error("[API] CRM driver lookup error:", lookupError);
			return NextResponse.json(
				{ success: false, error: "Failed to look up driver" },
				{ status: 500 },
			);
		}

		let driverId: string;
		let created = false;

		if (existing) {
			driverId = existing.id;
			const { error: updateError } = await supabaseAdmin
				.from("drivers")
				.update(profileFields as DriverUpdate)
				.eq("id", driverId);

			if (updateError) {
				console.error("[API] CRM driver update error:", updateError);
				return NextResponse.json(
					{ success: false, error: "Failed to update driver profile" },
					{ status: 500 },
				);
			}
		} else {
			const insertPayload: DriverInsert = {
				...(profileFields as DriverInsert),
				email: data.email,
				name: data.fullName,
				phone: data.phone,
			};

			const { data: inserted, error: insertError } = await supabaseAdmin
				.from("drivers")
				.insert(insertPayload)
				.select("id")
				.single();

			if (insertError) {
				console.error("[API] CRM driver insert error:", insertError);
				return NextResponse.json(
					{ success: false, error: "Failed to register driver" },
					{ status: 500 },
				);
			}

			driverId = inserted.id;
			created = true;
		}

		return NextResponse.json(
			{
				success: true,
				message: created
					? "Driver registered successfully"
					: "Driver profile updated",
				data: {
					id: driverId,
					status: "pending_verification",
				},
			},
			{ status: created ? 201 : 200 },
		);
	} catch (error) {
		console.error("[API] CRM driver registration error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(request.url);
		const driverId = searchParams.get("id");
		const email = searchParams.get("email");

		if (!driverId && !email) {
			return NextResponse.json(
				{ success: false, error: "Driver ID or email is required" },
				{ status: 400 },
			);
		}

		if (!isAdminConfigured()) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
				},
				{ status: 503 },
			);
		}

		let query = supabaseAdmin.from("drivers").select("*");
		query = driverId
			? query.eq("id", driverId)
			: query.eq("email", email as string);

		const { data: driver, error } = await query.maybeSingle();

		if (error) {
			console.error("[API] CRM driver fetch error:", error);
			return NextResponse.json(
				{ success: false, error: "Failed to fetch driver" },
				{ status: 500 },
			);
		}

		// Driver tidak ada: kembalikan 404, bukan data hardcoded yang terlihat valid.
		if (!driver) {
			return NextResponse.json(
				{ success: false, error: "Driver not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				...driver,
				status: driver.registration_status ?? "pending_verification",
			},
		});
	} catch (error) {
		console.error("[API] CRM driver fetch error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
