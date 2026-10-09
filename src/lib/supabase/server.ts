import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// `createClient` melempar error bila key kosong ("supabaseKey is required"),
// dan itu terjadi di lingkup modul — sehingga modul ini gagal di-import
// sebelum isAdminConfigured() sempat dipakai. Akibatnya konfigurasi yang
// tidak lengkap berubah dari "503 dengan alasan jelas" menjadi crash.
//
// Karena itu placeholder dipakai di sini. Placeholder ini tidak pernah
// dipakai ke jaringan: semua jalur query dijaga isAdminConfigured() yang
// bernilai false saat key kosong, dan jalur itu mengembalikan 503.
const CLIENT_URL = supabaseUrl || "http://localhost";
const CLIENT_KEY = supabaseServiceKey || "not-configured";

export const supabaseAdmin = createClient(CLIENT_URL, CLIENT_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

export function isAdminConfigured(): boolean {
	return Boolean(supabaseUrl && supabaseServiceKey);
}
