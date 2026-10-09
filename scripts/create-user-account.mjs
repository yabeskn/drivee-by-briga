import { Client } from "pg";

const client = new Client({
	host: "aws-0-ap-southeast-1.pooler.supabase.com",
	port: 6543,
	user: "postgres.qgetspwlrrwofcttnfbx",
	password: "rqd8faPMe9U7N3dE",
	database: "postgres",
	ssl: { rejectUnauthorized: false },
});

async function main() {
	await client.connect();
	const userId = "961f359c-980e-4735-993d-1a7d87695a6c";
	const email = "yabeskn@briga.id";
	const name = "Yabes Kobriantoro Nangoi";

	// Check vehicles
	const vehRes = await client.query("SELECT id FROM vehicles LIMIT 1");
	const vehicleId = vehRes.rows[0]?.id || null;

	// Insert or update driver
	const insertDriverSql = `
    INSERT INTO drivers (
      id, email, name, full_name, phone, phone_verified,
      briga_coin_balance, current_streak, total_trips, average_eco_score,
      role, registration_status, vehicle_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $3, '081298765432', true,
      250, 0, 0, 95.0,
      'driver', 'verified', $4, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      phone_verified = true,
      registration_status = 'verified',
      updated_at = NOW()
    RETURNING *;
  `;

	const driverRes = await client.query(insertDriverSql, [
		userId,
		email,
		name,
		vehicleId,
	]);
	console.log("Driver upserted:", driverRes.rows[0]);

	// Insert or update unified_identities
	const unifiedSql = `
    INSERT INTO unified_identities (user_id, driver_id, briga_user_id, email, created_at, updated_at)
    VALUES ($1, $1, $2, $3, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      driver_id = EXCLUDED.driver_id,
      email = EXCLUDED.email,
      updated_at = NOW()
    RETURNING *;
  `;
	const unifiedRes = await client.query(unifiedSql, [
		userId,
		"briga_yabeskn",
		email,
	]);
	console.log("Unified identity upserted:", unifiedRes.rows[0]);

	// Insert or update brigacoin_balances
	const balanceSql = `
    INSERT INTO brigacoin_balances (user_id, balance, total_earned, total_spent, updated_at)
    VALUES ($1, 250, 250, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = GREATEST(brigacoin_balances.balance, 250),
      updated_at = NOW()
    RETURNING *;
  `;
	const balanceRes = await client.query(balanceSql, [userId]);
	console.log("Balance upserted:", balanceRes.rows[0]);

	await client.end();
}

main().catch((err) => {
	console.error("Error executing script:", err);
	process.exit(1);
});
