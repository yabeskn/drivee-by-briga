import { NextResponse } from "next/server";

export async function POST() {
	const response = NextResponse.json({ success: true });
	response.cookies.set("sb-access-token", "preview-telemetry-tester", {
		path: "/",
		httpOnly: false,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 86400, // 24 hours
	});
	return response;
}
