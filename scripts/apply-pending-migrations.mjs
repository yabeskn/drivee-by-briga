// ─────────────────────────────────────────────────────────────
// apply-pending-migrations.mjs — Apply SQL migrations to live Supabase
//
// Butuh kredensial Postgres (DDL tidak bisa via service role):
//   SUPABASE_DB_PASSWORD  → password database project Supabase
//     (Dashboard → Project Settings → Database → Database password)
//   opsional: SUPABASE_DB_HOST     (default: db.<project-ref>.supabase.co)
//   opsional: SUPABASE_DB_REGION   (contoh: ap-southeast-1)
//
// Pemakaian:
//   npm i -D pg && node scripts/apply-pending-migrations.mjs
//   node scripts/apply-pending-migrations.mjs 012          // hanya satu migration
//   node scripts/apply-pending-migrations.mjs --baseline   // daftar migration yang SUDAH ada
//   node scripts/apply-pending-migrations.mjs 012 --force  // abaikan ledger, jalankan ulang
//
// SKIP VIA LEDGER: skrip menyimpan daftar migration yang sudah diterapkan di
// tabel `applied_migrations`, sehingga file yang sudah pernah sukses TIDAK
// dieksekusi lagi. Tanpa ini, migration lama (mis. 001 dengan `CREATE TABLE`
// tanpa guard) akan selalu gagal saat dijalankan ulang meski sudah ada di DB.
// Tiap migration dieksekusi dalam satu transaksi: kalau gagal, tidak ada
// DDL yang tertinggal dan file tidak masuk ledger.
//
// MEMBUAT LEDGER UNTUK DATABASE YANG SUDAH TERMIGRASI (sekali saja):
//   node scripts/apply-pending-migrations.mjs --baseline
// Perintah itu hanya MENCATAT seluruh file yang ada sebagai sudah diterapkan
// tanpa mengeksekusi apa pun. Jalankan sekali pada DB yang sudah punya
// migration, sebelum pemakaian normal.
//
// CATATAN KONEKSI: host langsung `db.<project-ref>.supabase.co` TIDAK punya
// record A — hanya AAAA (IPv6). Di jaringan tanpa IPv6 global (umumnya IPv4
// saja) host itu tidak bisa dijangkau sama sekali. Karena itu skrip ini
// mencoba beberapa endpoint berurutan: host eksplisit → host langsung →
// connection pooler (IPv4, user `postgres.<project-ref>`). Pooler selalu
// punya A record, jadi jalur IPv4 selalu ada.
// ─────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

function loadEnv() {
	const env = {};
	for (const line of readFileSync(
		resolve(process.cwd(), ".env.local"),
		"utf8",
	).split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const i = t.indexOf("=");
		if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
	}
	return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
const projectRef = supabaseUrl.match(
	/https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];
if (!projectRef) {
	console.error("Cannot derive project ref from NEXT_PUBLIC_SUPABASE_URL");
	process.exit(1);
}
const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
	console.error(
		"SUPABASE_DB_PASSWORD missing in .env.local (Dashboard → Project Settings → Database)",
	);
	process.exit(1);
}
// ── Kandidat endpoint, diurutkan dari paling khusus ──
// Port 5432 = session pooler (mendukung BEGIN/ROLLBACK eksplisit),
// 6543 = transaction pooler. Keduanya pakai user postgres.<project-ref>
// karena nama database virtual saat memakai pooler.
const REGIONS = env.SUPABASE_DB_REGION
	? [env.SUPABASE_DB_REGION]
	: [
			"ap-southeast-1",
			"ap-southeast-2",
			"ap-northeast-1",
			"ap-northeast-2",
			"ap-south-1",
			"ap-east-1",
			"us-east-1",
			"eu-central-1",
		];

const candidates = [
	...(env.SUPABASE_DB_HOST
		? [
				{
					label: `custom host (${env.SUPABASE_DB_HOST})`,
					host: env.SUPABASE_DB_HOST,
				},
			]
		: []),
	{
		label: `langsung ${`db.${projectRef}.supabase.co`} (IPv6-only)`,
		host: `db.${projectRef}.supabase.co`,
	},
	...REGIONS.flatMap((region) =>
		[5432, 6543].map((port) => ({
			label: `pooler aws-0-${region}:${port} (IPv4)`,
			host: `aws-0-${region}.pooler.supabase.com`,
			port,
			user: `postgres.${projectRef}`,
		})),
	),
];

async function connect() {
	for (const c of candidates) {
		const pool = new pg.Pool({
			host: c.host,
			port: c.port || 5432,
			database: "postgres",
			user: c.user || "postgres",
			password,
			ssl: { rejectUnauthorized: false },
			connectionTimeoutMillis: 8000,
		});
		try {
			const client = await pool.connect();
			await client.query("SELECT 1");
			client.release();
			return { pool, label: c.label };
		} catch (err) {
			await pool.end().catch(() => {});
			process.stdout.write(`  [..] ${c.label} → ${err.code || err.message}\n`);
		}
	}
	return null;
}

process.stdout.write("Mencoba endpoint:\n");
const conn = await connect();
if (!conn) {
	console.error(
		`\nGagal konek ke semua endpoint. Cek SUPABASE_DB_PASSWORD, atau set SUPABASE_DB_HOST / SUPABASE_DB_REGION secara eksplisit.`,
	);
	process.exit(1);
}
const pool = conn.pool;
console.log(`\nTerhubung lewat: ${conn.label}\n`);

// Argumen: prefix migration opsional, `--baseline`, dan/atau `--force`.
const args = process.argv.slice(2);
const baseline = args.includes("--baseline");
const force = args.includes("--force");
const only = args.find((a) => !a.startsWith("--"));
const migrationsDir = resolve(process.cwd(), "supabase/migrations");
let files = readdirSync(migrationsDir)
	.filter((f) => f.endsWith(".sql"))
	.sort();
if (only) {
	files = files.filter((f) => f.startsWith(`${only}_`));
	if (files.length === 0) {
		console.error(`Tidak ada migration dengan prefix "${only}_"`);
		await pool.end();
		process.exit(1);
	}
}

// ── Ledger ─────────────────────────────────────────────────
// Dibuat oleh skrip ini sendiri (bukan file migration) supaya ledger selalu
// ada sebelum migration pertama diperiksa — ledger tidak bisa bergantung
// pada migration yang seharusnya dilacak.
//
// RLS diaktifkan tanpa policy apa pun: PostgREST mengekspos schema `public`,
// jadi tanpa RLS tabel ini bisa dibaca anybody yang punya anon key (browser
// aplikasi). Ledger hanya/tool internal, skrip ini menulis lewat koneksi
// `postgres` yang bypass RLS — jadi menutup seluruh akses lain aman.
// Pola yang sama dipakai tabel di migrasi 009/010/012.
await pool.query(`
	CREATE TABLE IF NOT EXISTS applied_migrations (
		filename   TEXT PRIMARY KEY,
		checksum   TEXT NOT NULL,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)
`);
await pool.query("ALTER TABLE applied_migrations ENABLE ROW LEVEL SECURITY");

const checksumOf = (sql) =>
	createHash("sha256").update(sql).digest("hex").slice(0, 16);

const { rows: recordedRows } = await pool.query(
	"SELECT filename, checksum FROM applied_migrations",
);
const recorded = new Map(recordedRows.map((r) => [r.filename, r.checksum]));

// ── Baseline: catat tanpa mengeksekusi ────────────────────
if (baseline) {
	let added = 0;
	for (const file of files) {
		if (recorded.has(file)) continue;
		const sql = readFileSync(join(migrationsDir, file), "utf8");
		await pool.query(
			`INSERT INTO applied_migrations (filename, checksum)
			 VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING`,
			[file, checksumOf(sql)],
		);
		recorded.set(file, checksumOf(sql));
		added++;
	}
	await pool.end();
	console.log(
		added === 0
			? "\nBaseline: tidak ada yang perlu dicatat (ledger sudah lengkap) ✅"
			: `\nBaseline: ${added} migration dicatat sebagai sudah diterapkan ✅`,
	);
	process.exit(0);
}

let failed = 0;
let applied = 0;
let skipped = 0;
for (const file of files) {
	const sql = readFileSync(join(migrationsDir, file), "utf8");
	const sum = checksumOf(sql);

	if (!force && recorded.has(file)) {
		skipped++;
		if (recorded.get(file) !== sum) {
			// File diubah SETELAH pernah diterapkan. Bukan error (banyak repo
			// memang menyunting migration lama), tapi wajib terlihat supaya tidak
			// disalahartikan sebagai migration yang sudah ter-cover.
			console.warn(
				`[WARN  ] ${file} sudah tercatat, tetapi isi file berubah sejak itu — DB mungkin tidak sesuai`,
			);
		}
		continue;
	}

	// BEGIN..COMMIT per migration: DDL + pencatatan ledger bersifat atomik.
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query(sql);
		await client.query(
			`INSERT INTO applied_migrations (filename, checksum)
			 VALUES ($1, $2)
			 ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
			[file, sum],
		);
		await client.query("COMMIT");
		applied++;
		console.log(`[APPLIED] ${file}`);
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {});
		failed++;
		console.error(`[FAILED ] ${file}: ${err.message}`);
	} finally {
		client.release();
	}
}
await pool.end();

const summary = [];
if (applied) summary.push(`${applied} diterapkan`);
if (skipped) summary.push(`${skipped} dilewati (sudah di ledger)`);
console.log(
	failed === 0
		? `\nSelesai${summary.length ? ` — ${summary.join(", ")}` : ""} ✅`
		: `\n${failed} migration gagal ❌${summary.length ? ` — ${summary.join(", ")}` : ""}`,
);
process.exit(failed === 0 ? 0 : 1);
