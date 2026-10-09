import { type NextRequest, NextResponse } from "next/server";
import { getTemplateBySlug } from "@/lib/appointments/service";

export const dynamic = "force-dynamic";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
	try {
		const { slug } = await params;
		const template = await getTemplateBySlug(slug);

		if (!template) {
			return NextResponse.json(
				{ success: false, error: "Template agenda tidak ditemukan" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			data: template,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 },
		);
	}
}
