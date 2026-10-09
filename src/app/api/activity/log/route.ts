import { type NextRequest, NextResponse } from "next/server";
import type { ActivityLogInsert, ActivityLogType } from "@/lib/supabase/schema";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/server";

const VALID_TYPES: readonly ActivityLogType[] = [
	"login",
	"trip",
	"verification",
	"app_usage",
	"error",
	"feature",
];

interface ActivityLogPayload {
	driverId?: string;
	type: ActivityLogType;
	action: string;
	status?: string;
	metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const data: ActivityLogPayload = await request.json();

		if (!data.type || !VALID_TYPES.includes(data.type)) {
			return NextResponse.json(
				{
					success: false,
					error: `Invalid or missing "type". Expected one of: ${VALID_TYPES.join(", ")}`,
				},
				{ status: 400 },
			);
		}

		if (!data.action) {
			return NextResponse.json(
				{ success: false, error: "Missing required field: action" },
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

		// IP & user-agent diambil dari header request, bukan dari body —
		// agar klien tidak bisa memalsukan jejak audit.
		const ipAddress =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip") ||
			null;
		const userAgent = request.headers.get("user-agent") || null;

		const insertPayload: ActivityLogInsert = {
			driver_id: data.driverId ?? null,
			type: data.type,
			action: data.action,
			status: data.status ?? null,
			metadata: data.metadata ?? {},
			ip_address: ipAddress,
			user_agent: userAgent,
		};

		const { error } = await supabaseAdmin
			.from("activity_logs")
			.insert(insertPayload);

		if (error) {
			console.error("[API] Activity log insert error:", error);
			return NextResponse.json(
				{ success: false, error: "Failed to record activity" },
				{ status: 500 },
			);
		}

		return NextResponse.json(
			{ success: true, message: "Activity logged" },
			{ status: 201 },
		);
	} catch (error) {
		console.error("[API] Activity log error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
