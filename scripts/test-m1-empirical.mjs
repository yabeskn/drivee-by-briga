import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Read .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  const symbol = passed ? "PASS" : "FAIL";
  console.log(`[${symbol}] ${name}: ${detail}`);
}

async function runTests() {
  console.log("=== EMPIRICAL CHALLENGER TEST SUITE: MILESTONE 1 ===");
  console.log(`Target: ${supabaseUrl}`);

  // -------------------------------------------------------------
  // PART 1: RLS Verification with Anon Client
  // -------------------------------------------------------------
  console.log("\n--- Testing RLS Policies with Unauthenticated / Anon Client ---");

  // Test 1: Direct anon INSERT into brigacoin_transactions must fail
  {
    const { data, error } = await anonClient
      .from("brigacoin_transactions")
      .insert({
        driver_id: "00000000-0000-0000-0000-000000000001",
        type: "earn",
        amount: 999999,
        balance_after: 999999,
        description: "Adversarial exploit attempt",
      })
      .select();

    const passed = !!error;
    record(
      "RLS: Block Anon INSERT brigacoin_transactions",
      passed,
      error ? `Blocked with code: ${error.code} (${error.message})` : "FAILED: Row was inserted!"
    );
  }

  // Test 2: Direct anon INSERT into telemetry_points must fail
  {
    const { data, error } = await anonClient
      .from("telemetry_points")
      .insert({
        trip_id: "00000000-0000-0000-0000-000000000001",
        timestamp: new Date().toISOString(),
        latitude: -6.2,
        longitude: 106.8,
        speed_kmh: 50,
      })
      .select();

    const passed = !!error;
    record(
      "RLS: Block Anon INSERT telemetry_points",
      passed,
      error ? `Blocked with code: ${error.code} (${error.message})` : "FAILED: Row was inserted!"
    );
  }

  // Test 3: Direct anon INSERT into trips must fail
  {
    const { data, error } = await anonClient
      .from("trips")
      .insert({
        driver_id: "00000000-0000-0000-0000-000000000001",
        vehicle_id: "00000000-0000-0000-0000-000000000001",
        start_time: new Date().toISOString(),
      })
      .select();

    const passed = !!error;
    record(
      "RLS: Block Anon INSERT trips",
      passed,
      error ? `Blocked with code: ${error.code} (${error.message})` : "FAILED: Row was inserted!"
    );
  }

  // Test 4: Direct anon INSERT into drivers must fail
  {
    const { data, error } = await anonClient
      .from("drivers")
      .insert({
        email: "spoofed@drivee.briga.id",
        name: "Spoofed Driver",
      })
      .select();

    const passed = !!error;
    record(
      "RLS: Block Anon INSERT drivers",
      passed,
      error ? `Blocked with code: ${error.code} (${error.message})` : "FAILED: Row was inserted!"
    );
  }

  // Test 5: Anon SELECT on brigacoin_transactions returns 0 rows (protected)
  {
    const { data, error } = await anonClient.from("brigacoin_transactions").select("*");
    const passed = !error && data && data.length === 0;
    record(
      "RLS: Anon SELECT brigacoin_transactions returns empty",
      passed,
      error ? `Error: ${error.message}` : `Returned ${data.length} rows (RLS filtered)`
    );
  }

  // Test 6: Anon SELECT on telemetry_points returns 0 rows (protected)
  {
    const { data, error } = await anonClient.from("telemetry_points").select("*");
    const passed = !error && data && data.length === 0;
    record(
      "RLS: Anon SELECT telemetry_points returns empty",
      passed,
      error ? `Error: ${error.message}` : `Returned ${data.length} rows (RLS filtered)`
    );
  }

  // -------------------------------------------------------------
  // PART 2: Check Constraints & Validation
  // -------------------------------------------------------------
  console.log("\n--- Testing Check Constraints ---");

  // Test 7: Invalid vehicle category must fail check constraint
  {
    const { data, error } = await adminClient
      .from("vehicles")
      .insert({
        brand: "Tesla",
        model: "Model S",
        license_plate: "TEST-INV-CAT",
        category: "hypercar_supersonic", // Invalid category
      })
      .select();

    const passed = !!error && (error.message.includes("vehicles_category_check") || error.code === "23514");
    record(
      "CHECK: vehicles_category_check rejects invalid category",
      passed,
      error ? `Correctly rejected: ${error.message}` : "FAILED: Invalid category was accepted!"
    );
  }

  // Test 8: Invalid brigacoin transaction type must fail check constraint
  {
    const { data, error } = await adminClient
      .from("brigacoin_transactions")
      .insert({
        driver_id: "00000000-0000-0000-0000-000000000001",
        type: "counterfeit_mint", // Invalid type
        amount: 100,
        balance_after: 100,
        description: "Invalid type test",
      })
      .select();

    const passed = !!error && (error.message.includes("brigacoin_transactions_type_check") || error.code === "23514");
    record(
      "CHECK: brigacoin_transactions_type_check rejects invalid type",
      passed,
      error ? `Correctly rejected: ${error.message}` : "FAILED: Invalid type was accepted!"
    );
  }

  // -------------------------------------------------------------
  // PART 3: Foreign Key Constraints
  // -------------------------------------------------------------
  console.log("\n--- Testing Foreign Key Constraints ---");

  const nonExistentUuid = "11111111-2222-3333-4444-555555555555";

  // Test 9: telemetry_points FK trip_id
  {
    const { data, error } = await adminClient
      .from("telemetry_points")
      .insert({
        trip_id: nonExistentUuid,
        timestamp: new Date().toISOString(),
        latitude: -6.2088,
        longitude: 106.8456,
        speed_kmh: 45,
      })
      .select();

    const passed = !!error && (error.message.includes("telemetry_points_trip_id_fkey") || error.code === "23503");
    record(
      "FK: telemetry_points.trip_id -> trips(id)",
      passed,
      error ? `Correctly rejected: ${error.message}` : "FAILED: Insert with non-existent trip_id succeeded!"
    );
  }

  // Test 10: trips FK driver_id
  {
    const { data, error } = await adminClient
      .from("trips")
      .insert({
        driver_id: nonExistentUuid,
        start_time: new Date().toISOString(),
      })
      .select();

    const passed = !!error && (error.message.includes("trips_driver_id_fkey") || error.code === "23503");
    record(
      "FK: trips.driver_id -> drivers(id)",
      passed,
      error ? `Correctly rejected: ${error.message}` : "FAILED: Insert with non-existent driver_id succeeded!"
    );
  }

  // Test 11: trips FK vehicle_id
  {
    const { data, error } = await adminClient
      .from("trips")
      .insert({
        driver_id: null,
        vehicle_id: nonExistentUuid,
        start_time: new Date().toISOString(),
      })
      .select();

    const passed = !!error && (error.message.includes("trips_vehicle_id_fkey") || error.code === "23503");
    record(
      "FK: trips.vehicle_id -> vehicles(id)",
      passed,
      error ? `Correctly rejected: ${error.message}` : "FAILED: Insert with non-existent vehicle_id succeeded!"
    );
  }

  // Test 12: brigacoin_transactions FK driver_id
  {
    const { data, error } = await adminClient
      .from("brigacoin_transactions")
      .insert({
        driver_id: nonExistentUuid,
        type: "earn",
        amount: 50,
        balance_after: 50,
        description: "FK test",
      })
      .select();

    const passed = !!error && (error.message.includes("brigacoin_transactions_driver_id_fkey") || error.code === "23503");
    record(
      "FK: brigacoin_transactions.driver_id -> drivers(id)",
      passed,
      error ? `Correctly rejected: ${error.message}` : "FAILED: Insert with non-existent driver_id succeeded!"
    );
  }

  // -------------------------------------------------------------
  // PART 4: End-to-End Lifecycle & Cascade Validation
  // -------------------------------------------------------------
  console.log("\n--- Testing Lifecycle & Cascade Deletions ---");

  const testSuffix = Date.now();
  const testEmail = `challenger_test_${testSuffix}@drivee.test`;
  const testPlate = `B_${testSuffix.toString().slice(-4)}_CHL`;

  let createdDriverId = null;
  let createdVehicleId = null;
  let createdTripId = null;
  let createdTelemetryId = null;
  let createdTxId = null;

  try {
    // Step A: Create test driver
    const { data: driverData, error: driverErr } = await adminClient
      .from("drivers")
      .insert({
        email: testEmail,
        name: "Empirical Challenger Driver",
        current_streak: 4,
        total_trips: 10,
        average_eco_score: 88.5,
        role: "driver",
      })
      .select()
      .single();

    if (driverErr || !driverData) throw new Error(`Driver creation failed: ${driverErr?.message}`);
    createdDriverId = driverData.id;
    record("Lifecycle: Create test driver with streak/eco stats", true, `Created driver ${createdDriverId}`);

    // Step B: Create test vehicle
    const { data: vehicleData, error: vehicleErr } = await adminClient
      .from("vehicles")
      .insert({
        driver_id: createdDriverId,
        brand: "Hyundai",
        model: "Ioniq 5",
        license_plate: testPlate,
        category: "standard",
        battery_capacity_kwh: 72.6,
      })
      .select()
      .single();

    if (vehicleErr || !vehicleData) throw new Error(`Vehicle creation failed: ${vehicleErr?.message}`);
    createdVehicleId = vehicleData.id;
    record("Lifecycle: Create test vehicle with category 'standard'", true, `Created vehicle ${createdVehicleId}`);

    // Step C: Link vehicle to driver
    const { error: linkErr } = await adminClient
      .from("drivers")
      .update({ vehicle_id: createdVehicleId })
      .eq("id", createdDriverId);

    if (linkErr) throw new Error(`Link vehicle failed: ${linkErr.message}`);
    record("Lifecycle: Link vehicle to driver", true, "Vehicle attached to driver");

    // Step D: Create test trip with all telemetry summary columns
    const { data: tripData, error: tripErr } = await adminClient
      .from("trips")
      .insert({
        driver_id: createdDriverId,
        vehicle_id: createdVehicleId,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date().toISOString(),
        distance_km: 15.5,
        eco_score: 92,
        eco_grade: "A",
        tokens_earned: 150,
        verification_status: "verified",
        harsh_accelerations: 0,
        harsh_brakings: 1,
        idle_duration_seconds: 45,
        max_speed_kmh: 82.5,
        avg_speed_kmh: 42.1,
        energy_used_kwh: 2.3,
        start_battery_soc: 85,
        end_battery_soc: 81,
        co2_avoided_kg: 1.86,
      })
      .select()
      .single();

    if (tripErr || !tripData) throw new Error(`Trip creation failed: ${tripErr?.message}`);
    createdTripId = tripData.id;
    record("Lifecycle: Create trip with telemetry summary columns", true, `Created trip ${createdTripId}`);

    // Step E: Create test telemetry points
    const { data: telemData, error: telemErr } = await adminClient
      .from("telemetry_points")
      .insert([
        {
          trip_id: createdTripId,
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          latitude: -6.2088,
          longitude: 106.8456,
          speed_kmh: 45.2,
          battery_soc: 83.5,
          power_kw: 12.4,
          accelerometer_x: 0.05,
          accelerometer_y: 0.12,
          accelerometer_z: 9.81,
        },
        {
          trip_id: createdTripId,
          timestamp: new Date(Date.now() - 900000).toISOString(),
          latitude: -6.2155,
          longitude: 106.8522,
          speed_kmh: 52.8,
          battery_soc: 82.1,
          power_kw: 15.1,
          accelerometer_x: -0.02,
          accelerometer_y: 0.08,
          accelerometer_z: 9.80,
        }
      ])
      .select();

    if (telemErr || !telemData) throw new Error(`Telemetry insert failed: ${telemErr?.message}`);
    createdTelemetryId = telemData[0].id;
    record("Lifecycle: Insert 2 telemetry points with 12 columns", true, `Inserted 2 points`);

    // Step F: Create brigacoin transaction referencing trip
    const { data: txData, error: txErr } = await adminClient
      .from("brigacoin_transactions")
      .insert({
        driver_id: createdDriverId,
        type: "earn",
        amount: 150,
        balance_after: 150,
        reference_id: createdTripId,
        source: "trip_reward",
        description: "Milestone 1 empirical test reward",
      })
      .select()
      .single();

    if (txErr || !txData) throw new Error(`Transaction insert failed: ${txErr?.message}`);
    createdTxId = txData.id;
    record("Lifecycle: Insert brigacoin transaction via service role", true, `Created transaction ${createdTxId}`);

    // Step G: Test CASCADE deletion of telemetry_points on trip deletion
    const { error: delTripErr } = await adminClient
      .from("trips")
      .delete()
      .eq("id", createdTripId);

    if (delTripErr) throw new Error(`Trip delete failed: ${delTripErr.message}`);

    const { data: orphanedTelem } = await adminClient
      .from("telemetry_points")
      .select("id")
      .eq("trip_id", createdTripId);

    const cascadeTelemPassed = orphanedTelem && orphanedTelem.length === 0;
    record(
      "CASCADE: telemetry_points deleted on trip delete",
      cascadeTelemPassed,
      cascadeTelemPassed ? "All telemetry points cleanly cascaded" : `FAILED: ${orphanedTelem.length} orphaned points remain`
    );

    // Step H: Test SET NULL behavior on driver.vehicle_id when vehicle is deleted
    const { error: delVehicleErr } = await adminClient
      .from("vehicles")
      .delete()
      .eq("id", createdVehicleId);

    if (delVehicleErr) throw new Error(`Vehicle delete failed: ${delVehicleErr.message}`);

    const { data: updatedDriver } = await adminClient
      .from("drivers")
      .select("vehicle_id")
      .eq("id", createdDriverId)
      .single();

    const setNullPassed = updatedDriver && updatedDriver.vehicle_id === null;
    record(
      "CASCADE: driver.vehicle_id SET NULL on vehicle delete",
      setNullPassed,
      setNullPassed ? "vehicle_id successfully set to null" : `FAILED: vehicle_id is ${updatedDriver?.vehicle_id}`
    );

    // Step I: Test CASCADE deletion on driver delete
    const { error: delDriverErr } = await adminClient
      .from("drivers")
      .delete()
      .eq("id", createdDriverId);

    if (delDriverErr) throw new Error(`Driver delete failed: ${delDriverErr.message}`);

    const { data: orphanedTx } = await adminClient
      .from("brigacoin_transactions")
      .select("id")
      .eq("driver_id", createdDriverId);

    const cascadeTxPassed = orphanedTx && orphanedTx.length === 0;
    record(
      "CASCADE: brigacoin_transactions deleted on driver delete",
      cascadeTxPassed,
      cascadeTxPassed ? "Transactions cleanly cascaded" : `FAILED: ${orphanedTx.length} orphaned transactions remain`
    );

  } catch (err) {
    console.error("Lifecycle test exception:", err);
    record("Lifecycle Execution", false, err.message);
  } finally {
    // Cleanup if anything remaining
    if (createdTripId) {
      try { await adminClient.from("trips").delete().eq("id", createdTripId); } catch {}
    }
    if (createdVehicleId) {
      try { await adminClient.from("vehicles").delete().eq("id", createdVehicleId); } catch {}
    }
    if (createdDriverId) {
      try { await adminClient.from("drivers").delete().eq("id", createdDriverId); } catch {}
    }
  }

  console.log("\n=== TEST SUMMARY ===");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total: ${total}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
