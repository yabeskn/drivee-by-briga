import { type NextRequest, NextResponse } from "next/server";
import { applyToJob, resolveDriverFromSession } from "@/lib/special-track";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		let body: { jobId?: unknown };
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{ success: false, error: "Request body must be valid JSON" },
				{ status: 400 },
			);
		}

		const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
		if (!jobId) {
			return NextResponse.json(
				{ success: false, error: "jobId is required" },
				{ status: 400 },
			);
		}

		// Identitas driver SELALU dari sesi terverifikasi — bukan dari body.
		const driver = await resolveDriverFromSession(request);
		if (!driver) {
			return NextResponse.json(
				{ success: false, error: "Anda harus masuk untuk melamar lowongan." },
				{ status: 401 },
			);
		}

		const result = await applyToJob(jobId, driver);

		if (!result.success) {
			// 404 bila lowongan tidak ada, 403 bila tidak memenuhi syarat.
			const isNotFound = result.error === "Lowongan tidak ditemukan.";
			const isConfigError = result.error?.startsWith(
				"Database is not configured",
			);
			const status = isConfigError ? 503 : isNotFound ? 404 : 403;
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status },
			);
		}

		return NextResponse.json(
			{
				success: true,
				data: {
					applicationId: result.applicationId,
					status: result.status,
					duplicate: result.duplicate ?? false,
				},
			},
			{ status: result.duplicate ? 200 : 201 },
		);
	} catch (error) {
		console.error("[API] Special Track apply error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
