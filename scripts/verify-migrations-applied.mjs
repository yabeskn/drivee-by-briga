// ─────────────────────────────────────────────────────────────
// verify-migrations-applied.mjs — Read-only schema probe
//
// Memverifikasi apakah migration 004/005/006 sudah di-apply ke
// database Supabase live dengan meng-introspeksi skema via
// OpenAPI PostgREST (GET /rest/v1/ dengan service role).
// TIDAK melakukan operasi tulis apa pun ke database.
// ─────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#")) continue;
	const eqIdx = trimmed.indexOf("=");
	if (eqIdx !== -1)
		env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
	console.error(
		"Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local",
	);
	process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey);
// Ambil token service role untuk REST introspection (GET /rest/v1/)
const restUrl = `${supabaseUrl}/rest/v1/`;

console.log(`Target: ${supabaseUrl}\n`);

// Checklist kolom per migration
const COLUMN_CHECKS = [
	{ migration: "004", table: "trips", column: "deadhead_distance_km" },
	{ migration: "004", table: "trips", column: "revenue_distance_km" },
	{ migration: "004", table: "trips", column: "trip_phase_timeline" },
	{ migration: "004", table: "trips", column: "watchdog_flagged" },
	{ migration: "004", table: "trips", column: "watchdog_anomaly_reason" },
	{ migration: "004", table: "brigacoin_transactions", column: "trip_id" },
	{ migration: "004", table: "vehicles", column: "category" },
	{ migration: "005", table: "brigacoin_transactions", column: "actor" },
	{ migration: "005", table: "brigacoin_transactions", column: "user_id" },
	{ migration: "005", table: "brigacoin_transactions", column: "external_ref" },
	// migration 009 — profil driver (CRM + registrasi)
	{ migration: "009", table: "drivers", column: "full_name" },
	{ migration: "009", table: "drivers", column: "phone_verified" },
	{ migration: "009", table: "drivers", column: "ktp" },
	{ migration: "009", table: "drivers", column: "sim_type" },
	{ migration: "009", table: "drivers", column: "sim_number" },
	{ migration: "009", table: "drivers", column: "sim_expiry" },
	{ migration: "009", table: "drivers", column: "address" },
	{ migration: "009", table: "drivers", column: "emergency_name" },
	{ migration: "009", table: "drivers", column: "emergency_phone" },
	{ migration: "009", table: "drivers", column: "emergency_relation" },
	{ migration: "009", table: "drivers", column: "bank_other" },
	{ migration: "009", table: "drivers", column: "license_type" },
	{ migration: "009", table: "drivers", column: "license_number" },
	{ migration: "009", table: "drivers", column: "license_expiry" },
	{ migration: "009", table: "drivers", column: "registration_status" },
	// migration 009 — profil kendaraan (registrasi kendaraan)
	{ migration: "009", table: "vehicles", column: "color" },
	{ migration: "009", table: "vehicles", column: "production_year" },
	{ migration: "009", table: "vehicles", column: "vehicle_type" },
	{ migration: "009", table: "vehicles", column: "chassis_number" },
	{ migration: "009", table: "vehicles", column: "engine_number" },
	{ migration: "009", table: "vehicles", column: "stnk_expiry" },
	{ migration: "009", table: "vehicles", column: "ownership_status" },
	{ migration: "009", table: "vehicles", column: "leasing_company" },
	{ migration: "009", table: "vehicles", column: "leasing_contract_end" },
	{ migration: "009", table: "vehicles", column: "consortium_name" },
	{ migration: "009", table: "vehicles", column: "consortium_members" },
	{ migration: "009", table: "vehicles", column: "registration_status" },
	// migration 009 — jejak audit aktivitas
	{ migration: "009", table: "activity_logs", column: "driver_id" },
	{ migration: "009", table: "activity_logs", column: "type" },
	{ migration: "009", table: "activity_logs", column: "action" },
	{ migration: "009", table: "activity_logs", column: "metadata" },
	{ migration: "009", table: "activity_logs", column: "ip_address" },
	// migration 010 — special track (lowongan & lamaran)
	{ migration: "010", table: "special_track_jobs", column: "title" },
	{ migration: "010", table: "special_track_jobs", column: "requirements" },
	{ migration: "010", table: "special_track_jobs", column: "vehicle_category" },
	{ migration: "010", table: "special_track_jobs", column: "min_eco_score" },
	{ migration: "010", table: "special_track_jobs", column: "status" },
	{ migration: "010", table: "special_track_applications", column: "job_id" },
	{
		migration: "010",
		table: "special_track_applications",
		column: "driver_id",
	},
	{ migration: "010", table: "special_track_applications", column: "status" },
	{
		migration: "010",
		table: "special_track_applications",
		column: "eco_score_at_apply",
	},
	{
		migration: "010",
		table: "special_track_applications",
		column: "vehicle_category_at_apply",
	},

	// migration 011 — kolom audit admin untuk alur publish & review
	{ migration: "011", table: "special_track_jobs", column: "created_by" },
	{ migration: "011", table: "special_track_jobs", column: "updated_at" },
	{ migration: "011", table: "special_track_jobs", column: "closed_at" },
	{ migration: "011", table: "special_track_jobs", column: "is_seed" },
	{
		migration: "011",
		table: "special_track_applications",
		column: "reviewed_by",
	},
	{
		migration: "011",
		table: "special_track_applications",
		column: "reviewed_at",
	},
	{
		migration: "011",
		table: "special_track_applications",
		column: "review_note",
	},
	// migration 012 — faktor emisi berversi
	{ migration: "012", table: "emission_factors", column: "factor_key" },
	{ migration: "012", table: "emission_factors", column: "kg_co2_per_kwh" },
	{ migration: "012", table: "emission_factors", column: "version" },
	{ migration: "012", table: "emission_factors", column: "valid_from" },
	{ migration: "012", table: "emission_factors", column: "source_ref" },
	{ migration: "012", table: "emission_factors", column: "verified" },
	// migration 013 — appointment setter
	{ migration: "013", table: "appointment_templates", column: "slug" },
	{ migration: "013", table: "appointment_bookings", column: "booking_code" },
	{
		migration: "013",
		table: "appointment_bookings",
		column: "tracking_secret_token",
	},
	{ migration: "013", table: "appointment_waypoints", column: "booking_id" },
	{ migration: "013", table: "appointment_status_logs", column: "booking_id" },
];

const TABLE_CHECKS = [
	{ migration: "005", table: "brigacoin_idempotency_keys" },
	{ migration: "005", table: "brigacoin_balances" },
	{ migration: "005", table: "unified_identities" },
	{ migration: "006", table: "corporate_profiles" },
	{ migration: "006", table: "corporate_allowances" },
	{ migration: "006", table: "corporate_emission_logs" },
	{ migration: "009", table: "activity_logs" },
	{ migration: "010", table: "special_track_jobs" },
	{ migration: "010", table: "special_track_applications" },
	{ migration: "012", table: "emission_factors" },
	{ migration: "013", table: "appointment_templates" },
	{ migration: "013", table: "appointment_bookings" },
	{ migration: "013", table: "appointment_waypoints" },
	{ migration: "013", table: "appointment_status_logs" },
];

let failures = 0;

// ── 1. Introspeksi skema via OpenAPI ──
const res = await fetch(restUrl, {
	headers: {
		apikey: serviceKey,
		Authorization: `Bearer ${serviceKey}`,
	},
});
if (!res.ok) {
	console.error(`OpenAPI introspection failed: HTTP ${res.status}`);
	process.exit(1);
}
const openapi = await res.json();
const definitions = openapi.definitions || openapi.components?.schemas || {};
const tableNames = new Set(Object.keys(definitions));

// ── 2. Cek tabel ──
console.log("--- Tabel ---");
for (const { migration, table } of TABLE_CHECKS) {
	const exists = tableNames.has(table);
	if (!exists) failures++;
	console.log(
		`[${exists ? "PASS" : "FAIL"}] migration ${migration}: tabel "${table}" ${exists ? "ada" : "TIDAK ADA"}`,
	);
}

// ── 3. Cek kolom ──
console.log("\n--- Kolom ---");
for (const { migration, table, column } of COLUMN_CHECKS) {
	const def = definitions[table];
	const hasColumn = Boolean(def?.properties?.[column]);
	if (!hasColumn) failures++;
	console.log(
		`[${hasColumn ? "PASS" : "FAIL"}] migration ${migration}: ${table}.${column} ${hasColumn ? "ada" : "TIDAK ADA"}`,
	);
}

// ── 4. Sanity query ringan per tabel baru (select 1 row, service role) ──
console.log("\n--- Sanity query (read-only) ---");
for (const { table } of TABLE_CHECKS) {
	const { error } = await admin.from(table).select("*").limit(1);
	const ok = !error;
	if (!ok) failures++;
	console.log(
		`[${ok ? "PASS" : "FAIL"}] SELECT ${table}: ${ok ? "ok" : `${error.code} — ${error.message}`}`,
	);
}

console.log(
	`\n=== ${failures === 0 ? "SEMUA MIGRATION SUDAH DI-APPLY ✅" : `${failures} CHECK GAGAL — MIGRATION BELUM LENGKAP ❌`} ===`,
);
process.exit(failures === 0 ? 0 : 1);
