// ─────────────────────────────────────────────────────────────
// Supabase Database Schema — Drifee by Briga
//
// PostgreSQL schema via Supabase. This file defines the TypeScript
// types that mirror the database tables.
// ─────────────────────────────────────────────────────────────

export interface Database {
	public: {
		Tables: {
			drivers: {
				Row: {
					id: string;
					google_id: string | null;
					email: string;
					name: string;
					phone: string | null;
					phone_verified: boolean;
					vehicle_id: string | null;
					briga_coin_balance: number;
					current_streak: number;
					total_trips: number;
					average_eco_score: number;
					role: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					google_id?: string | null;
					email: string;
					name: string;
					phone?: string | null;
					phone_verified?: boolean;
					vehicle_id?: string | null;
					briga_coin_balance?: number;
					current_streak?: number;
					total_trips?: number;
					average_eco_score?: number;
					role?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					google_id?: string | null;
					email?: string;
					name?: string;
					phone?: string | null;
					phone_verified?: boolean;
					vehicle_id?: string | null;
					briga_coin_balance?: number;
					current_streak?: number;
					total_trips?: number;
					average_eco_score?: number;
					role?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			vehicles: {
				Row: {
					id: string;
					driver_id: string;
					category: "standard" | "professional" | "premium" | "premium_plus";
					brand: string;
					model: string;
					license_plate: string;
					battery_capacity_kwh: number;
					status: "active" | "inactive";
					created_at: string;
				};
				Insert: {
					id?: string;
					driver_id: string;
					category: "standard" | "professional" | "premium" | "premium_plus";
					brand: string;
					model: string;
					license_plate: string;
					battery_capacity_kwh: number;
					status?: "active" | "inactive";
					created_at?: string;
				};
				Update: {
					id?: string;
					driver_id?: string;
					category?: "standard" | "professional" | "premium" | "premium_plus";
					brand?: string;
					model?: string;
					license_plate?: string;
					battery_capacity_kwh?: number;
					status?: "active" | "inactive";
					created_at?: string;
				};
			};
			trips: {
				Row: {
					id: string;
					driver_id: string;
					vehicle_id: string;
					start_time: string;
					end_time: string | null;
					distance_km: number;
					eco_score: number;
					eco_grade: string;
					tokens_earned: number;
					trip_hash: string;
					verification_status: "pending" | "verified" | "rejected";
					profile_used: string | null;
					start_battery_soc: number | null;
					end_battery_soc: number | null;
					energy_used_kwh: number | null;
					harsh_accelerations: number;
					harsh_brakings: number;
					idle_duration_seconds: number;
					max_speed_kmh: number | null;
					avg_speed_kmh: number | null;
					co2_avoided_kg: number | null;
					osrm_matched_route: Record<string, unknown> | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					driver_id: string;
					vehicle_id: string;
					start_time: string;
					end_time?: string | null;
					distance_km?: number;
					eco_score?: number;
					eco_grade?: string;
					tokens_earned?: number;
					trip_hash?: string;
					verification_status?: "pending" | "verified" | "rejected";
					profile_used?: string | null;
					start_battery_soc?: number | null;
					end_battery_soc?: number | null;
					energy_used_kwh?: number | null;
					harsh_accelerations?: number;
					harsh_brakings?: number;
					idle_duration_seconds?: number;
					max_speed_kmh?: number | null;
					avg_speed_kmh?: number | null;
					co2_avoided_kg?: number | null;
					osrm_matched_route?: Record<string, unknown> | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					driver_id?: string;
					vehicle_id?: string;
					start_time?: string;
					end_time?: string | null;
					distance_km?: number;
					eco_score?: number;
					eco_grade?: string;
					tokens_earned?: number;
					trip_hash?: string;
					verification_status?: "pending" | "verified" | "rejected";
					profile_used?: string | null;
					start_battery_soc?: number | null;
					end_battery_soc?: number | null;
					energy_used_kwh?: number | null;
					harsh_accelerations?: number;
					harsh_brakings?: number;
					idle_duration_seconds?: number;
					max_speed_kmh?: number | null;
					avg_speed_kmh?: number | null;
					co2_avoided_kg?: number | null;
					osrm_matched_route?: Record<string, unknown> | null;
					created_at?: string;
				};
			};
			brigacoin_transactions: {
				Row: {
					id: string;
					driver_id: string;
					type: "earn" | "spend" | "expire" | "adjust";
					amount: number;
					balance_after: number;
					source: string;
					reference_id: string | null;
					description: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					driver_id: string;
					type: "earn" | "spend" | "expire" | "adjust";
					amount: number;
					balance_after: number;
					source: string;
					reference_id?: string | null;
					description: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					driver_id?: string;
					type?: "earn" | "spend" | "expire" | "adjust";
					amount?: number;
					balance_after?: number;
					source?: string;
					reference_id?: string | null;
					description?: string;
					created_at?: string;
				};
			};
			hr_rentals: {
				Row: {
					id: string;
					company_id: string;
					package_type: string;
					vehicle_id: string;
					driver_id: string;
					start_date: string;
					end_date: string;
					total_price: number;
					payment_status: "pending" | "paid" | "verified";
					payment_reference: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					company_id: string;
					package_type: string;
					vehicle_id: string;
					driver_id: string;
					start_date: string;
					end_date: string;
					total_price: number;
					payment_status?: "pending" | "paid" | "verified";
					payment_reference?: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					company_id?: string;
					package_type?: string;
					vehicle_id?: string;
					driver_id?: string;
					start_date?: string;
					end_date?: string;
					total_price?: number;
					payment_status?: "pending" | "paid" | "verified";
					payment_reference?: string;
					created_at?: string;
				};
			};
			scope3_emissions: {
				Row: {
					id: string;
					company_id: string;
					rental_id: string;
					category: string;
					distance_km: number;
					emission_factor: number;
					total_emission_kg: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					company_id: string;
					rental_id: string;
					category: string;
					distance_km: number;
					emission_factor: number;
					total_emission_kg: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					company_id?: string;
					rental_id?: string;
					category?: string;
					distance_km?: number;
					emission_factor?: number;
					total_emission_kg?: number;
					created_at?: string;
				};
			};
			carbon_offsets: {
				Row: {
					id: string;
					company_id: string;
					amount_kg: number;
					type: string;
					cost: number;
					brc_earned: number;
					certificate_url: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					company_id: string;
					amount_kg: number;
					type: string;
					cost: number;
					brc_earned: number;
					certificate_url?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					company_id?: string;
					amount_kg?: number;
					type?: string;
					cost?: number;
					brc_earned?: number;
					certificate_url?: string | null;
					created_at?: string;
				};
			};
			rewards: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					category: string;
					cost: number;
					stock: number;
					image_url: string | null;
					terms: string | null;
					reward_type: string | null;
					partner_id: string | null;
					vehicle_category: string | null;
					user_type: string;
					status: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					category: string;
					cost: number;
					stock?: number;
					image_url?: string | null;
					terms?: string | null;
					reward_type?: string | null;
					partner_id?: string | null;
					vehicle_category?: string | null;
					user_type?: string;
					status?: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["rewards"]["Insert"]>;
			};
			redemptions: {
				Row: {
					id: string;
					driver_id: string;
					reward_id: string;
					cost: number;
					status:
						| "pending"
						| "processing"
						| "completed"
						| "failed"
						| "cancelled";
					voucher_code: string | null;
					delivery_method: string;
					redeemed_at: string | null;
					expires_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					driver_id: string;
					reward_id: string;
					cost: number;
					status?: string;
					voucher_code?: string | null;
					delivery_method?: string;
					redeemed_at?: string | null;
					expires_at?: string | null;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["redemptions"]["Insert"]>;
			};
			companies: {
				Row: {
					id: string;
					name: string;
					email: string | null;
					industry: string | null;
					contact_phone: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					email?: string | null;
					industry?: string | null;
					contact_phone?: string | null;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
			};
			telemetry_points: {
				Row: {
					id: string;
					trip_id: string;
					timestamp: string;
					latitude: number;
					longitude: number;
					speed_kmh: number;
					battery_soc: number | null;
					power_kw: number | null;
					accelerometer_x: number | null;
					accelerometer_y: number | null;
					accelerometer_z: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					trip_id: string;
					timestamp: string;
					latitude: number;
					longitude: number;
					speed_kmh?: number;
					battery_soc?: number | null;
					power_kw?: number | null;
					accelerometer_x?: number | null;
					accelerometer_y?: number | null;
					accelerometer_z?: number | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					trip_id?: string;
					timestamp?: string;
					latitude?: number;
					longitude?: number;
					speed_kmh?: number;
					battery_soc?: number | null;
					power_kw?: number | null;
					accelerometer_x?: number | null;
					accelerometer_y?: number | null;
					accelerometer_z?: number | null;
					created_at?: string;
				};
			};
		};
	};
}

export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
export type DriverInsert = Database["public"]["Tables"]["drivers"]["Insert"];
export type DriverUpdate = Database["public"]["Tables"]["drivers"]["Update"];

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
export type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export type TripRow = Database["public"]["Tables"]["trips"]["Row"];
export type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];
export type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];

export type TelemetryPointRow =
	Database["public"]["Tables"]["telemetry_points"]["Row"];
export type TelemetryPointInsert =
	Database["public"]["Tables"]["telemetry_points"]["Insert"];
export type TelemetryPointUpdate =
	Database["public"]["Tables"]["telemetry_points"]["Update"];

export type BrigacoinTransactionRow =
	Database["public"]["Tables"]["brigacoin_transactions"]["Row"];
export type BrigacoinTransactionInsert =
	Database["public"]["Tables"]["brigacoin_transactions"]["Insert"];
export type BrigacoinTransactionUpdate =
	Database["public"]["Tables"]["brigacoin_transactions"]["Update"];
