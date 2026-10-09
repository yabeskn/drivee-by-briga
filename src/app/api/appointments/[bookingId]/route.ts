import { type NextRequest, NextResponse } from "next/server";
import {
	getBookingByCode,
	getBookingByTrackingToken,
	updateBookingStatus,
} from "@/lib/appointments/service";
import type { AppointmentBookingStatus } from "@/lib/appointments/types";

export const dynamic = "force-dynamic";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
	try {
		const { bookingId } = await params;

		// 1. Coba cari dengan secret tracking token
		let booking = await getBookingByTrackingToken(bookingId);

		// 2. Jika tidak ketemu, coba cari dengan booking code
		if (!booking) {
			booking = await getBookingByCode(bookingId);
		}

		if (!booking) {
			return NextResponse.json(
				{ success: false, error: "Jadwal booking tidak ditemukan" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			data: booking,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal error",
			},
			{ status: 500 },
		);
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
	try {
		const { bookingId } = await params;
		const body = await request.json();
		const { status, notes } = body;

		if (!status) {
			return NextResponse.json(
				{ success: false, error: "Status baru wajib disertakan" },
				{ status: 400 },
			);
		}

		const result = await updateBookingStatus(
			bookingId,
			status as AppointmentBookingStatus,
			notes,
		);

		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Gagal mengupdate status",
			},
			{ status: 500 },
		);
	}
}
