// ─────────────────────────────────────────────────────────────
// Supabase Database Schema — Drifee by Briga
//
// PostgreSQL schema via Supabase. This file defines the TypeScript
// types that mirror the database tables.
// ─────────────────────────────────────────────────────────────

/** Jenis event yang boleh dicatat di jejak audit aktivitas (migration 009) */
export type ActivityLogType =
	| "login"
	| "trip"
	| "verification"
	| "app_usage"
	| "error"
	| "feature";

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
					bank_name?: string | null;
					bank_account_number?: string | null;
					bank_account_holder?: string | null;
					/** Nama lengkap dari alur registrasi; `name` tetap jadi kolom utama (migration 009) */
					full_name?: string | null;
					/** Identitas pemerintahan (migration 009) */
					ktp?: string | null;
					sim_type?: string | null;
					sim_number?: string | null;
					sim_expiry?: string | null;
					/** Alamat & kontak darurat (migration 009) */
					address?: string | null;
					emergency_name?: string | null;
					emergency_phone?: string | null;
					emergency_relation?: string | null;
					/** Rekening & Surat Izin Mengendarai (migration 009) */
					bank_other?: string | null;
					license_type?: string | null;
					license_number?: string | null;
					license_expiry?: string | null;
					/** Status vetting driver (migration 009) */
					registration_status?: string | null;
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
					bank_name?: string | null;
					bank_account_number?: string | null;
					bank_account_holder?: string | null;
					full_name?: string | null;
					ktp?: string | null;
					sim_type?: string | null;
					sim_number?: string | null;
					sim_expiry?: string | null;
					address?: string | null;
					emergency_name?: string | null;
					emergency_phone?: string | null;
					emergency_relation?: string | null;
					bank_other?: string | null;
					license_type?: string | null;
					license_number?: string | null;
					license_expiry?: string | null;
					registration_status?: string | null;
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
					bank_name?: string | null;
					bank_account_number?: string | null;
					bank_account_holder?: string | null;
					full_name?: string | null;
					ktp?: string | null;
					sim_type?: string | null;
					sim_number?: string | null;
					sim_expiry?: string | null;
					address?: string | null;
					emergency_name?: string | null;
					emergency_phone?: string | null;
					emergency_relation?: string | null;
					bank_other?: string | null;
					license_type?: string | null;
					license_number?: string | null;
					license_expiry?: string | null;
					registration_status?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			activity_logs: {
				Row: {
					id: string;
					driver_id: string | null;
					type: ActivityLogType;
					action: string;
					status: string | null;
					metadata: Record<string, unknown>;
					ip_address: string | null;
					user_agent: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					driver_id?: string | null;
					type: ActivityLogType;
					action: string;
					status?: string | null;
					metadata?: Record<string, unknown>;
					ip_address?: string | null;
					user_agent?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					driver_id?: string | null;
					type?: ActivityLogType;
					action?: string;
					status?: string | null;
					metadata?: Record<string, unknown>;
					ip_address?: string | null;
					user_agent?: string | null;
					created_at?: string;
				};
			};
			vehicles: {
				Row: {
					id: string;
					code: string | null;
					name: string;
					driver_id: string | null;
					category:
						| "standard"
						| "professional"
						| "premium"
						| "premium_plus"
						| null;
					brand: string | null;
					model: string | null;
					license_plate: string;
					battery_capacity_kwh: number | null;
					status:
						| "available"
						| "in_service"
						| "charging"
						| "maintenance"
						| null;
					/** Profil registrasi (migration 009) */
					color?: string | null;
					production_year?: number | null;
					vehicle_type?: string | null;
					chassis_number?: string | null;
					engine_number?: string | null;
					stnk_expiry?: string | null;
					ownership_status?:
						| "company"
						| "leased"
						| "personal"
						| "consortium"
						| null;
					leasing_company?: string | null;
					leasing_contract_end?: string | null;
					consortium_name?: string | null;
					consortium_members?: string | null;
					registration_status?: string | null;
					/** Kolom operasional (migration 008) */
					bluetooth_name?: string | null;
					rental_partner_name?: string | null;
					rental_partner_phone?: string | null;
					qr_code_token?: string | null;
					hub_location?: string | null;
					efficiency_kwh_per_100km?: number | null;
					last_odometer_km?: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					code?: string | null;
					name: string;
					driver_id?: string | null;
					category?:
						| "standard"
						| "professional"
						| "premium"
						| "premium_plus"
						| null;
					brand?: string | null;
					model?: string | null;
					license_plate: string;
					battery_capacity_kwh?: number | null;
					status?:
						| "available"
						| "in_service"
						| "charging"
						| "maintenance"
						| null;
					color?: string | null;
					production_year?: number | null;
					vehicle_type?: string | null;
					chassis_number?: string | null;
					engine_number?: string | null;
					stnk_expiry?: string | null;
					ownership_status?:
						| "company"
						| "leased"
						| "personal"
						| "consortium"
						| null;
					leasing_company?: string | null;
					leasing_contract_end?: string | null;
					consortium_name?: string | null;
					consortium_members?: string | null;
					registration_status?: string | null;
					bluetooth_name?: string | null;
					rental_partner_name?: string | null;
					rental_partner_phone?: string | null;
					qr_code_token?: string | null;
					hub_location?: string | null;
					efficiency_kwh_per_100km?: number | null;
					last_odometer_km?: number | null;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
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
					/** Scope 3 absolut — deadhead (jarak kosong menuju jemput), default 0 (migration 004) */
					deadhead_distance_km: number;
					/** Scope 3 absolut — jarak dengan penumpang; deadhead + revenue = distance_km (migration 004) */
					revenue_distance_km: number;
					/** Timeline transisi fase trip: [{ from, to, at }] (migration 004) */
					trip_phase_timeline: TripPhaseTransitionRow[];
					/** Flag anomali watchdog (Fake GPS) — audit Invisible Security (migration 004) */
					watchdog_flagged: boolean;
					watchdog_anomaly_reason: string | null;
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
					deadhead_distance_km?: number;
					revenue_distance_km?: number;
					trip_phase_timeline?: TripPhaseTransitionRow[] | null;
					watchdog_flagged?: boolean;
					watchdog_anomaly_reason?: string | null;
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
					deadhead_distance_km?: number;
					revenue_distance_km?: number;
					trip_phase_timeline?: TripPhaseTransitionRow[] | null;
					watchdog_flagged?: boolean;
					watchdog_anomaly_reason?: string | null;
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
					/** Trip pemicu transaksi (migration 004) */
					trip_id: string | null;
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
					trip_id?: string | null;
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
					trip_id?: string | null;
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
			special_track_jobs: {
				Row: {
					id: string;
					/**companies.id adalah VARCHAR(255), bukan UUID (migration 002) */
					company_id: string | null;
					title: string;
					description: string;
					requirements: string[];
					vehicle_category:
						| "standard"
						| "professional"
						| "premium"
						| "premium_plus"
						| null;
					min_eco_score: number | null;
					status: "open" | "closed";
					created_at: string;
					/** Kolom audit admin (migration 011) */
					created_by?: string | null;
					updated_at?: string | null;
					closed_at?: string | null;
					/** Menandai lowongan hasil seed lama agar bisa dibedakan dari lowongan asli */
					is_seed?: boolean;
				};
				Insert: {
					id?: string;
					company_id?: string | null;
					title: string;
					description: string;
					requirements?: string[];
					vehicle_category?:
						| "standard"
						| "professional"
						| "premium"
						| "premium_plus"
						| null;
					min_eco_score?: number | null;
					status?: "open" | "closed";
					created_at?: string;
					created_by?: string | null;
					updated_at?: string | null;
					closed_at?: string | null;
					is_seed?: boolean;
				};
				Update: Partial<
					Database["public"]["Tables"]["special_track_jobs"]["Insert"]
				>;
			};
			special_track_applications: {
				Row: {
					id: string;
					job_id: string;
					driver_id: string;
					status:
						| "submitted"
						| "reviewing"
						| "accepted"
						| "rejected"
						| "withdrawn";
					eco_score_at_apply: number | null;
					vehicle_category_at_apply: string | null;
					created_at: string;
					/** Jejak review admin (migration 011). reviewed_by tanpa FK: admin belum tentu punya baris driver. */
					reviewed_by?: string | null;
					reviewed_at?: string | null;
					review_note?: string | null;
				};
				Insert: {
					id?: string;
					job_id: string;
					driver_id: string;
					status?:
						| "submitted"
						| "reviewing"
						| "accepted"
						| "rejected"
						| "withdrawn";
					eco_score_at_apply?: number | null;
					vehicle_category_at_apply?: string | null;
					created_at?: string;
					reviewed_by?: string | null;
					reviewed_at?: string | null;
					review_note?: string | null;
				};
				Update: Partial<
					Database["public"]["Tables"]["special_track_applications"]["Insert"]
				>;
			};
		};
	};
}

/** Entri timeline transisi fase trip — disimpan sebagai JSONB di trips.trip_phase_timeline */
export interface TripPhaseTransitionRow {
	/** Fase asal (mis. "IDLE") */
	from: string;
	/** Fase tujuan (mis. "DISPATCHED") */
	to: string;
	/** Waktu transisi (ISO-8601) */
	at: string;
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

export type ActivityLogRow =
	Database["public"]["Tables"]["activity_logs"]["Row"];
export type ActivityLogInsert =
	Database["public"]["Tables"]["activity_logs"]["Insert"];
export type ActivityLogUpdate =
	Database["public"]["Tables"]["activity_logs"]["Update"];
