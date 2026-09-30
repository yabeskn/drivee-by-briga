import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const error = requestUrl.searchParams.get("error");
	const errorDescription = requestUrl.searchParams.get("error_description");
	let next = requestUrl.searchParams.get("next") || "/go";

	// Sanitize next param to prevent open-redirect vulnerabilities
	if (!next.startsWith("/") || next.startsWith("//")) {
		next = "/go";
	}

	// Gracefully handle OAuth provider error responses (e.g. access_denied)
	if (error || errorDescription) {
		const errorMsg = errorDescription || error || "Authentication failed";
		return NextResponse.redirect(
			new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url),
		);
	}

	if (code) {
		const { data, error: exchangeError } =
			await supabase.auth.exchangeCodeForSession(code);
		if (exchangeError) {
			return NextResponse.redirect(
				new URL(
					`/login?error=${encodeURIComponent(exchangeError.message)}`,
					request.url,
				),
			);
		}

		const redirectUrl = new URL(next, request.url);
		const response = NextResponse.redirect(redirectUrl);

		if (data?.session) {
			// Set secure cookies for session persistence across server components & middleware
			response.cookies.set("sb-access-token", data.session.access_token, {
				path: "/",
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: data.session.expires_in || 3600,
			});

			if (data.session.refresh_token) {
				response.cookies.set("sb-refresh-token", data.session.refresh_token, {
					path: "/",
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: "lax",
					maxAge: 3600 * 24 * 30, // 30 days
				});
			}
		}

		return response;
	}

	// Fallback redirect if no code was provided
	return NextResponse.redirect(new URL(next, request.url));
}
