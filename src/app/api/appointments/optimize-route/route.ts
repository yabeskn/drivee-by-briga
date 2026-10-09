import { type NextRequest, NextResponse } from "next/server";
import { optimizeMultiStopRoute } from "@/lib/appointments/tsp-router";
import type { TspStopPoint } from "@/lib/appointments/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const { origin, waypoints, lockedDestination, roundTrip } = body;

		if (
			!origin ||
			typeof origin.lat !== "number" ||
			typeof origin.lng !== "number"
		) {
			return NextResponse.json(
				{
					success: false,
					error: "Titik awal (origin) wajib menyertakan koordinat valid",
				},
				{ status: 400 },
			);
		}

		const safeWaypoints: TspStopPoint[] = Array.isArray(waypoints)
			? waypoints.filter(
					(w) => typeof w.lat === "number" && typeof w.lng === "number",
				)
			: [];

		const result = await optimizeMultiStopRoute(origin, safeWaypoints, {
			lockedDestination: lockedDestination || null,
			roundTrip: Boolean(roundTrip),
		});

		return NextResponse.json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("[API optimize-route] Exception:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Gagal mengoptimalkan rute",
			},
			{ status: 500 },
		);
	}
}
