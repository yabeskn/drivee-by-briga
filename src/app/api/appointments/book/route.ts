import { type NextRequest, NextResponse } from "next/server";
import { createAppointmentBooking } from "@/lib/appointments/service";
import type { CreateBookingInput } from "@/lib/appointments/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body: CreateBookingInput = await request.json();

		if (!body.templateSlug || !body.bookerName || !body.bookerPhone) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Nama pemesan, nomor telepon/WhatsApp, dan template agenda wajib diisi",
				},
				{ status: 400 },
			);
		}

		if (
			!body.scheduledDate ||
			!body.scheduledStartTime ||
			!body.durationHours
		) {
			return NextResponse.json(
				{
					success: false,
					error: "Tanggal, jam penjemputan, dan paket durasi wajib dipilih",
				},
				{ status: 400 },
			);
		}

		if (
			!body.pickupAddress ||
			typeof body.pickupLat !== "number" ||
			typeof body.pickupLng !== "number"
		) {
			return NextResponse.json(
				{
					success: false,
					error: "Alamat dan koordinat titik jemput wajib dilengkapi",
				},
				{ status: 400 },
			);
		}

		const result = await createAppointmentBooking(body);

		if (!result.success) {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 400 },
			);
		}

		return NextResponse.json({
			success: true,
			data: result.booking,
		});
	} catch (error) {
		console.error("[API book] Exception:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Gagal memproses pemesanan",
			},
			{ status: 500 },
		);
	}
}
