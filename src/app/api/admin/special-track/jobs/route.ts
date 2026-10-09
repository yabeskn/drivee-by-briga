// ─────────────────────────────────────────────────────────────
// /api/admin/special-track/jobs — daftar & buat lowongan (admin)
//
// Wajib lolos requireAdmin(): role dibaca dari app_metadata sesi terverifikasi.
// Tanpa itu, siapa pun yang punya sesi bisa membuat lowongan.
// ─────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
	adminErrorStatus,
	createJob,
	listAllJobsForAdmin,
	validateJobInput,
} from "@/lib/special-track-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	const result = await listAllJobsForAdmin();

	if (!result.success) {
		return NextResponse.json(
			{ success: false, error: result.error, code: result.code },
			{ status: adminErrorStatus(result.code) },
		);
	}

	return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	const gate = await requireAdmin(request);
	if (!gate.ok) return gate.response;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Request body must be valid JSON" },
			{ status: 400 },
		);
	}

	const validation = validateJobInput(body);
	if (!validation.ok || !validation.value) {
		return NextResponse.json(
			{
				success: false,
				error: "Data lowongan tidak valid.",
				errors: validation.errors,
			},
			{ status: 400 },
		);
	}

	const result = await createJob(validation.value, gate.admin.id);

	if (!result.success) {
		return NextResponse.json(
			{ success: false, error: result.error, code: result.code },
			{ status: adminErrorStatus(result.code) },
		);
	}

	return NextResponse.json(
		{ success: true, data: result.data },
		{ status: 201 },
	);
}
