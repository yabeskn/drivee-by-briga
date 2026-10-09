// ─────────────────────────────────────────────────────────────
// /api/admin/special-track/applications — tinjau lamaran (admin)
//
// Query: ?jobId=<uuid> & status=submitted|reviewing|accepted|rejected|withdrawn
// ─────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { SpecialTrackApplicationStatus } from "@/lib/special-track";
import {
	adminErrorStatus,
	listApplicationsForAdmin,
} from "@/lib/special-track-admin";

export const dynamic = "force-dynamic";

const APPLICATION_STATUSES: readonly SpecialTrackApplicationStatus[] = [
	"submitted",
	"reviewing",
	"accepted",
	"rejected",
	"withdrawn",
];

export async function GET(request: NextRequest): Promise<NextResponse> {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	const { searchParams } = request.nextUrl;
	const jobId = searchParams.get("jobId")?.trim() || undefined;
	const rawStatus = searchParams.get("status")?.trim();

	let status: SpecialTrackApplicationStatus | undefined;
	if (rawStatus) {
		if (
			!APPLICATION_STATUSES.includes(rawStatus as SpecialTrackApplicationStatus)
		) {
			return NextResponse.json(
				{
					success: false,
					error: `status tidak dikenal. Pilihan: ${APPLICATION_STATUSES.join(", ")}.`,
				},
				{ status: 400 },
			);
		}
		status = rawStatus as SpecialTrackApplicationStatus;
	}

	const result = await listApplicationsForAdmin({ jobId, status });

	if (!result.success) {
		return NextResponse.json(
			{ success: false, error: result.error, code: result.code },
			{ status: adminErrorStatus(result.code) },
		);
	}

	return NextResponse.json({ success: true, data: result.data });
}
