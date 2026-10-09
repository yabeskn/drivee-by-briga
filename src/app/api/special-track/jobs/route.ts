import { NextResponse } from "next/server";
import { listOpenJobs } from "@/lib/special-track";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
	try {
		const { jobs, source } = await listOpenJobs();

		if (source === "unavailable") {
			// Jangan balas daftar lowongan kosong seolah-olah itu kondisi normal:
			// bedakan "tidak ada lowongan" dari "database tidak terkonfigurasi".
			return NextResponse.json(
				{
					success: false,
					error:
						"Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
					source,
				},
				{ status: 503 },
			);
		}

		return NextResponse.json({
			success: true,
			data: jobs,
			source,
		});
	} catch (error) {
		console.error("[API] Special Track jobs error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
