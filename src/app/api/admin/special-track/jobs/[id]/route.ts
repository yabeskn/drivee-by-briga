// ─────────────────────────────────────────────────────────────
// /api/admin/special-track/jobs/[id] — tutup/buka & hapus lowongan (admin)
//
// PATCH hanya mengubah status (open/closed). Edit isi lowongan sengaja tidak
// ada di sini: lowongan yang sudah ditutup masih dibaca driver sebagai arsip,
// dan mengubah requirements atau ambang skor di tempat bisa membingungkan.
// ─────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { SpecialTrackJobStatus } from "@/lib/special-track";
import {
	adminErrorStatus,
	deleteJob,
	JOB_STATUSES,
	setJobStatus,
} from "@/lib/special-track-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: { id: string } },
): Promise<NextResponse> {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	let body: { status?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Request body must be valid JSON" },
			{ status: 400 },
		);
	}

	const status = typeof body.status === "string" ? body.status.trim() : "";
	if (!JOB_STATUSES.includes(status as SpecialTrackJobStatus)) {
		return NextResponse.json(
			{ success: false, error: 'status harus "open" atau "closed".' },
			{ status: 400 },
		);
	}

	const result = await setJobStatus(params.id, status as SpecialTrackJobStatus);

	if (!result.success) {
		return NextResponse.json(
			{ success: false, error: result.error, code: result.code },
			{ status: adminErrorStatus(result.code) },
		);
	}

	return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } },
): Promise<NextResponse> {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	const result = await deleteJob(params.id);

	if (!result.success) {
		return NextResponse.json(
			{ success: false, error: result.error, code: result.code },
			{ status: adminErrorStatus(result.code) },
		);
	}

	return NextResponse.json({ success: true, data: result.data });
}
