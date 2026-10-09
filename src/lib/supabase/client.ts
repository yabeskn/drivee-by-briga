import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
	process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
	},
});

export const isSupabaseConfigured = (): boolean => {
	return Boolean(
		process.env.NEXT_PUBLIC_SUPABASE_URL &&
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
			process.env.NEXT_PUBLIC_SUPABASE_URL !==
				"https://placeholder.supabase.co",
	);
};

export const getSupabaseServerClient = () => {
	const serviceRoleKey =
		process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
	return createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
};
