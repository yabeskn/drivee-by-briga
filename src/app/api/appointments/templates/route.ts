import { type NextRequest, NextResponse } from "next/server";
import { listTemplates } from "@/lib/appointments/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(request.url);
		const corporateId = searchParams.get("corporateId") || undefined;

		const templates = await listTemplates(corporateId);

		return NextResponse.json({
			success: true,
			data: templates,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Gagal memuat template",
			},
			{ status: 500 },
		);
	}
}
