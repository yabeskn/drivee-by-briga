// ─────────────────────────────────────────────────────────────
// apply-pending-migrations.mjs — Apply SQL migrations to live Supabase
//
// Butuh kredensial Postgres (DDL tidak bisa via service role):
//   SUPABASE_DB_PASSWORD  → password database project Supabase
//     (Dashboard → Project Settings → Database → Database password)
//   opsional: SUPABASE_DB_HOST (default: db.<project-ref>.supabase.co)
//
// Pemakaian:
//   npm i -D pg && node scripts/apply-pending-migrations.mjs
// Semua migration dieksekusi idempotent (IF NOT EXISTS / CREATE OR
// REPLACE) sehingga aman dijalankan ulang.
// ─────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import pg from "pg";

function loadEnv() {
	const env = {};
	for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const i = t.indexOf("=");
		if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
	}
	return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
const projectRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!projectRef) {
	console.error("Cannot derive project ref from NEXT_PUBLIC_SUPABASE_URL");
	process.exit(1);
}
const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
	console.error("SUPABASE_DB_PASSWORD missing in .env.local (Dashboard → Project Settings → Database)");
	process.exit(1);
}
const host = env.SUPABASE_DB_HOST || `db.${projectRef}.supabase.co`;

const pool = new pg.Pool({
	host,
	port: 5432,
	database: "postgres",
	user: "postgres",
	password,
	ssl: { rejectUnauthorized: false },
});

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

let failed = 0;
for (const file of files) {
	const sql = readFileSync(join(migrationsDir, file), "utf8");
	try {
		await pool.query(sql);
		console.log(`[APPLIED] ${file}`);
	} catch (err) {
		failed++;
		console.error(`[FAILED ] ${file}: ${err.message}`);
	}
}
await pool.end();
console.log(failed === 0 ? "\nSelesai — semua migration applied ✅" : `\n${failed} migration gagal ❌`);
process.exit(failed === 0 ? 0 : 1);
