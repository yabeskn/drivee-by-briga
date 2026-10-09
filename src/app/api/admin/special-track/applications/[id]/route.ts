// ─────────────────────────────────────────────────────────────
// /api/admin/special-track/applications/[id] — nilai lamaran (admin)
//
// Body: { status: 'reviewing' | 'accepted' | 'rejected', note?: string }
// Identitas penilai diambil dari sesi terverifikasi (gate.admin.id), bukan
// dari body — supaya jejak audit reviewed_by tidak bisa dipalsukan klien.
// ─────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { SpecialTrackApplicationStatus } from "@/lib/special-track";
import {
	adminErrorStatus,
	REVIEW_STATUSES,
	setApplicationStatus,
} from "@/lib/special-track-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: { id: string } },
): Promise<NextResponse> {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	let body: { status?: unknown; note?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Request body must be valid JSON" },
			{ status: 400 },
		);
	}

	const status = typeof body.status === "string" ? body.status.trim() : "";
	if (!REVIEW_STATUSES.includes(status as SpecialTrackApplicationStatus)) {
		return NextResponse.json(
			{
				success: false,
				error: `status harus salah satu dari: ${REVIEW_STATUSES.join(", ")}.`,
			},
			{ status: 400 },
		);
	}

	if (
		body.note !== undefined &&
		body.note !== null &&
		typeof body.note !== "string"
	) {
		return NextResponse.json(
			{ success: false, error: "note harus berupa teks." },
			{ status: 400 },
		);
	}

	const result = await setApplicationStatus(
		params.id,
		status as SpecialTrackApplicationStatus,
		gate.admin.id,
		typeof body.note === "string" ? body.note : undefined,
	);

	if (!result.success) {
		return NextResponse.json(
			{ success: false, error: result.error, code: result.code },
			{ status: adminErrorStatus(result.code) },
		);
	}

	return NextResponse.json({ success: true, data: result.data });
}
