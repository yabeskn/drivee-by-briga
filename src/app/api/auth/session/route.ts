import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { access_token, refresh_token, expires_in } = await request.json();

		if (!access_token) {
			return NextResponse.json(
				{ success: false, error: "access_token is required" },
				{ status: 400 },
			);
		}

		const response = NextResponse.json({ success: true });

		response.cookies.set("sb-access-token", access_token, {
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: expires_in || 3600,
		});

		if (refresh_token) {
			response.cookies.set("sb-refresh-token", refresh_token, {
				path: "/",
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 3600 * 24 * 30, // 30 days
			});
		}

		return response;
	} catch (error) {
		console.error("[API] Session cookie error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE() {
	const response = NextResponse.json({ success: true });
	response.cookies.set("sb-access-token", "", {
		path: "/",
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 0,
	});
	response.cookies.set("sb-refresh-token", "", {
		path: "/",
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 0,
	});
	return response;
}
