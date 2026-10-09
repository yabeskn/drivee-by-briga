import { type NextRequest, NextResponse } from "next/server";
import { assignDriverToBooking } from "@/lib/appointments/service";

export const dynamic = "force-dynamic";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
	try {
		const { bookingId } = await params;
		const body = await request.json();
		const { driverId, vehicleId } = body;

		if (!driverId) {
			return NextResponse.json(
				{ success: false, error: "ID Driver wajib disertakan" },
				{ status: 400 },
			);
		}

		const result = await assignDriverToBooking(bookingId, driverId, vehicleId);

		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Gagal menugaskan driver",
			},
			{ status: 500 },
		);
	}
}
