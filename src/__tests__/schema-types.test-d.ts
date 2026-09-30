import type {
	BrigacoinTransactionInsert,
	BrigacoinTransactionRow,
	BrigacoinTransactionUpdate,
	Database,
	DriverInsert,
	DriverRow,
	DriverUpdate,
	TelemetryPointInsert,
	TelemetryPointRow,
	TelemetryPointUpdate,
	TripInsert,
	TripRow,
	TripUpdate,
} from "@/lib/supabase/schema";

// ─────────────────────────────────────────────────────────────
// 1. DRIVERS TYPE VERIFICATION
// ─────────────────────────────────────────────────────────────

// Positive: Complete DriverRow
export const validDriverRow: DriverRow = {
	id: "550e8400-e29b-41d4-a716-446655440000",
	google_id: "google-oauth2|123456789",
	email: "driver@example.com",
	name: "Budi Santoso",
	phone: "+6281234567890",
	phone_verified: true,
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	briga_coin_balance: 1500,
	current_streak: 7,
	total_trips: 42,
	average_eco_score: 88.5,
	role: "driver",
	created_at: "2026-09-30T00:00:00Z",
	updated_at: "2026-09-30T01:00:00Z",
};

// Positive: Minimal DriverInsert
export const validDriverInsertMinimal: DriverInsert = {
	email: "newdriver@example.com",
	name: "Siti Rahma",
};

// Positive: Full DriverInsert
export const validDriverInsertFull: DriverInsert = {
	id: "550e8400-e29b-41d4-a716-446655440002",
	email: "newdriver@example.com",
	name: "Siti Rahma",
	current_streak: 0,
	total_trips: 0,
	average_eco_score: 0,
	role: "driver",
};

// Positive: DriverUpdate
export const validDriverUpdate: DriverUpdate = {
	current_streak: 8,
	total_trips: 43,
	average_eco_score: 89.2,
};

// Negative: DriverInsert missing required email
// @ts-expect-error missing email
export const invalidDriverInsertNoEmail: DriverInsert = {
	name: "No Email Driver",
};

// Negative: DriverInsert missing required name
// @ts-expect-error missing name
export const invalidDriverInsertNoName: DriverInsert = {
	email: "noname@example.com",
};

export const invalidDriverInsertStreakType: DriverInsert = {
	email: "test@example.com",
	name: "Test Driver",
	// @ts-expect-error current_streak should be number
	current_streak: "seven",
};

// ─────────────────────────────────────────────────────────────
// 2. TRIPS TYPE VERIFICATION (Including all 11 Telemetry Columns)
// ─────────────────────────────────────────────────────────────

// Positive: Complete TripRow with all 11 telemetry columns
export const validTripRow: TripRow = {
	id: "550e8400-e29b-41d4-a716-446655440010",
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	start_time: "2026-09-30T08:00:00Z",
	end_time: "2026-09-30T08:35:00Z",
	distance_km: 18.5,
	eco_score: 92,
	eco_grade: "A",
	tokens_earned: 145,
	trip_hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
	verification_status: "verified",
	// 11 Telemetry Columns:
	profile_used: "wuling_air_ev",
	start_battery_soc: 85,
	end_battery_soc: 72,
	energy_used_kwh: 3.25,
	harsh_accelerations: 1,
	harsh_brakings: 0,
	idle_duration_seconds: 120,
	max_speed_kmh: 78.4,
	avg_speed_kmh: 31.7,
	co2_avoided_kg: 2.45,
	osrm_matched_route: {
		distance: 18500,
		duration: 2100,
		geometry: "mock_polyline",
	},
	created_at: "2026-09-30T08:36:00Z",
};

// Positive: Minimal TripInsert
export const validTripInsertMinimal: TripInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	start_time: "2026-09-30T08:00:00Z",
};

// Positive: TripUpdate
export const validTripUpdate: TripUpdate = {
	end_time: "2026-09-30T08:40:00Z",
	eco_score: 95,
	tokens_earned: 160,
};

// Positive: TripInsert with all 11 telemetry columns
export const validTripInsertWithTelemetry: TripInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	start_time: "2026-09-30T08:00:00Z",
	profile_used: "hyundai_ioniq5",
	start_battery_soc: 90,
	end_battery_soc: 80,
	energy_used_kwh: 5.8,
	harsh_accelerations: 0,
	harsh_brakings: 1,
	idle_duration_seconds: 45,
	max_speed_kmh: 95.0,
	avg_speed_kmh: 48.2,
	co2_avoided_kg: 3.8,
	osrm_matched_route: { coordinates: [[106.8, -6.2]] },
};

// Negative: TripInsert missing driver_id
// @ts-expect-error missing driver_id
export const invalidTripInsertNoDriver: TripInsert = {
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	start_time: "2026-09-30T08:00:00Z",
};

// Negative: TripInsert missing vehicle_id
// @ts-expect-error missing vehicle_id
export const invalidTripInsertNoVehicle: TripInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	start_time: "2026-09-30T08:00:00Z",
};

// Negative: TripInsert missing start_time
// @ts-expect-error missing start_time
export const invalidTripInsertNoStartTime: TripInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
};

export const invalidTripVerificationStatus: TripInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	start_time: "2026-09-30T08:00:00Z",
	// @ts-expect-error verification_status cannot be "approved"
	verification_status: "approved",
};

export const invalidTripEnergyType: TripInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	vehicle_id: "550e8400-e29b-41d4-a716-446655440001",
	start_time: "2026-09-30T08:00:00Z",
	// @ts-expect-error energy_used_kwh should be number or null
	energy_used_kwh: "three_point_two",
};

// ─────────────────────────────────────────────────────────────
// 3. TELEMETRY POINTS TYPE VERIFICATION
// ─────────────────────────────────────────────────────────────

// Positive: Complete TelemetryPointRow
export const validTelemetryPointRow: TelemetryPointRow = {
	id: "550e8400-e29b-41d4-a716-446655440020",
	trip_id: "550e8400-e29b-41d4-a716-446655440010",
	timestamp: "2026-09-30T08:15:30Z",
	latitude: -6.2088,
	longitude: 106.8456,
	speed_kmh: 45.2,
	battery_soc: 82.5,
	power_kw: 14.8,
	accelerometer_x: 0.05,
	accelerometer_y: -0.12,
	accelerometer_z: 0.98,
	created_at: "2026-09-30T08:15:31Z",
};

// Positive: Minimal TelemetryPointInsert
export const validTelemetryPointInsertMinimal: TelemetryPointInsert = {
	trip_id: "550e8400-e29b-41d4-a716-446655440010",
	timestamp: "2026-09-30T08:15:30Z",
	latitude: -6.2088,
	longitude: 106.8456,
};

// Positive: TelemetryPointUpdate
export const validTelemetryPointUpdate: TelemetryPointUpdate = {
	speed_kmh: 50.0,
	power_kw: 18.2,
};

// Negative: TelemetryPointInsert missing trip_id
// @ts-expect-error missing trip_id
export const invalidTelemetryPointNoTrip: TelemetryPointInsert = {
	timestamp: "2026-09-30T08:15:30Z",
	latitude: -6.2088,
	longitude: 106.8456,
};

// Negative: TelemetryPointInsert missing latitude
// @ts-expect-error missing latitude
export const invalidTelemetryPointNoLat: TelemetryPointInsert = {
	trip_id: "550e8400-e29b-41d4-a716-446655440010",
	timestamp: "2026-09-30T08:15:30Z",
	longitude: 106.8456,
};

export const invalidTelemetryPointSpeedType: TelemetryPointInsert = {
	trip_id: "550e8400-e29b-41d4-a716-446655440010",
	timestamp: "2026-09-30T08:15:30Z",
	latitude: -6.2088,
	longitude: 106.8456,
	// @ts-expect-error speed_kmh must be number
	speed_kmh: "45.2 km/h",
};

// ─────────────────────────────────────────────────────────────
// 4. BRIGACOIN TRANSACTIONS TYPE VERIFICATION
// ─────────────────────────────────────────────────────────────

// Positive: Complete BrigacoinTransactionRow
export const validBrigacoinTransactionRow: BrigacoinTransactionRow = {
	id: "550e8400-e29b-41d4-a716-446655440030",
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	type: "earn",
	amount: 145,
	balance_after: 1645,
	source: "trip",
	reference_id: "trip_1727678400000_abc123",
	description: "Trip reward (18.5 km, Eco Score 92)",
	created_at: "2026-09-30T08:36:00Z",
};

// Positive: BrigacoinTransactionInsert
export const validBrigacoinTransactionInsert: BrigacoinTransactionInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	type: "spend",
	amount: 50,
	balance_after: 1595,
	source: "redemption",
	reference_id: "voucher_gofood_25k",
	description: "Voucher GoFood Rp 25K redemption",
};

export const invalidBrigacoinTxType: BrigacoinTransactionInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	// @ts-expect-error type cannot be 'purchase'
	type: "purchase",
	amount: 50,
	balance_after: 1595,
	source: "shop",
	description: "Invalid transaction type",
};

// Negative: BrigacoinTransactionInsert missing amount
// @ts-expect-error missing amount
export const invalidBrigacoinTxNoAmount: BrigacoinTransactionInsert = {
	driver_id: "550e8400-e29b-41d4-a716-446655440000",
	type: "earn",
	balance_after: 1595,
	source: "trip",
	description: "Missing amount",
};

// Positive: BrigacoinTransactionUpdate
export const validBrigacoinTransactionUpdate: BrigacoinTransactionUpdate = {
	description: "Updated transaction description",
};

// ─────────────────────────────────────────────────────────────
// 5. DATABASE INTERFACE INTEGRITY
// ─────────────────────────────────────────────────────────────
export type PublicTables = Database["public"]["Tables"];

// Ensure all 5 core tables exist in Database['public']['Tables']
export type TablesCheck = [
	PublicTables["drivers"],
	PublicTables["vehicles"],
	PublicTables["trips"],
	PublicTables["telemetry_points"],
	PublicTables["brigacoin_transactions"],
];
