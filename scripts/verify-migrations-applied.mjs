// ─────────────────────────────────────────────────────────────
// verify-migrations-applied.mjs — Read-only schema probe
//
// Memverifikasi apakah migration 004/005/006 sudah di-apply ke
// database Supabase live dengan meng-introspeksi skema via
// OpenAPI PostgREST (GET /rest/v1/ dengan service role).
// TIDAK melakukan operasi tulis apa pun ke database.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#")) continue;
	const eqIdx = trimmed.indexOf("=");
	if (eqIdx !== -1) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
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
];

const TABLE_CHECKS = [
	{ migration: "005", table: "brigacoin_idempotency_keys" },
	{ migration: "005", table: "brigacoin_balances" },
	{ migration: "005", table: "unified_identities" },
	{ migration: "006", table: "corporate_profiles" },
	{ migration: "006", table: "corporate_allowances" },
	{ migration: "006", table: "corporate_emission_logs" },
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
	console.log(`[${exists ? "PASS" : "FAIL"}] migration ${migration}: tabel "${table}" ${exists ? "ada" : "TIDAK ADA"}`);
}

// ── 3. Cek kolom ──
console.log("\n--- Kolom ---");
for (const { migration, table, column } of COLUMN_CHECKS) {
	const def = definitions[table];
	const hasColumn = Boolean(def?.properties?.[column]);
	if (!hasColumn) failures++;
	console.log(`[${hasColumn ? "PASS" : "FAIL"}] migration ${migration}: ${table}.${column} ${hasColumn ? "ada" : "TIDAK ADA"}`);
}

// ── 4. Sanity query ringan per tabel baru (select 1 row, service role) ──
console.log("\n--- Sanity query (read-only) ---");
for (const { migration, table } of TABLE_CHECKS) {
	const { error } = await admin.from(table).select("*").limit(1);
	const ok = !error;
	if (!ok) failures++;
	console.log(`[${ok ? "PASS" : "FAIL"}] SELECT ${table}: ${ok ? "ok" : `${error.code} — ${error.message}`}`);
}

console.log(`\n=== ${failures === 0 ? "SEMUA MIGRATION SUDAH DI-APPLY ✅" : `${failures} CHECK GAGAL — MIGRATION BELUM LENGKAP ❌`} ===`);
process.exit(failures === 0 ? 0 : 1);
