import { supabase } from "./client";

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	image?: string;
}

export async function signInWithGoogle(nextPath?: string): Promise<{
	success: boolean;
	error?: string;
}> {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
		const target = nextPath?.startsWith("/") ? nextPath : "/commuter";
		const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(target)}`;

		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo,
			},
		});
		if (error) return { success: false, error: error.message };
		return { success: true };
	} catch (err) {
		return { success: false, error: String(err) };
	}
}

export async function signOut(): Promise<void> {
	try {
		await supabase.auth.signOut();
		await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
	} catch (err) {
		console.error("Supabase signOut error:", err);
	} finally {
		if (typeof window !== "undefined") {
			localStorage.removeItem("drivee_logged_in");
			localStorage.removeItem("drivee_name");
			localStorage.removeItem("drivee_driver_id");
			localStorage.removeItem("drivee_vehicle_id");
			// Clear session cookies. Menghapus cookie HANYA bisa lewat
			// document.cookie (server tidak bisa meng-expire cookie client),
			// jadi akses ini disengaja di sisi klien.
			// biome-ignore lint/suspicious/noDocumentCookie: hanya cara klien menghapus cookie
			document.cookie =
				"sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
			// biome-ignore lint/suspicious/noDocumentCookie: hanya cara klien menghapus cookie
			document.cookie =
				"sb-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
		}
	}
}

export async function getCurrentUser(): Promise<AuthUser | null> {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;
	return {
		id: user.id,
		email: user.email || "",
		name: user.user_metadata?.full_name || user.email || "",
		image: user.user_metadata?.avatar_url,
	};
}
