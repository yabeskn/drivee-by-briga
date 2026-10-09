// ─────────────────────────────────────────────────────────────
// appointments/types.ts — Drifee Appointment Setter Core Types
// ─────────────────────────────────────────────────────────────

export type DurationHours = 2 | 4 | 8 | 12;

export type PaymentSponsorMode = "corporate_esg" | "guest_self_pay" | "split";

export type AppointmentPaymentStatus =
	| "pending"
	| "sponsored_esg"
	| "paid_online"
	| "refunded"
	| "waived";

export type AppointmentBookingStatus =
	| "unassigned"
	| "assigned"
	| "en_route"
	| "picked_up"
	| "completed"
	| "cancelled"
	| "no_show";

export interface AppointmentTemplate {
	id: string;
	host_user_id?: string | null;
	corporate_id?: string | null;
	slug: string;
	title: string;
	description?: string | null;
	banner_url?: string | null;
	allowed_durations: DurationHours[];
	default_duration: DurationHours;
	is_destination_locked: boolean;
	locked_destination_address?: string | null;
	locked_destination_lat?: number | null;
	locked_destination_lng?: number | null;
	max_waypoints: number;
	payment_sponsor_mode: PaymentSponsorMode;
	base_discount_brc: number;
	buffer_minutes_between_trips: number;
	operating_start_time: string;
	operating_end_time: string;
	advance_booking_days: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface AppointmentWaypoint {
	id?: string;
	booking_id?: string;
	stop_order: number;
	stop_name: string;
	address: string;
	lat: number;
	lng: number;
	contact_person?: string | null;
	contact_phone?: string | null;
	stop_notes?: string | null;
	estimated_duration_minutes?: number;
	is_completed?: boolean;
	completed_at?: string | null;
}

export interface AppointmentBooking {
	id: string;
	booking_code: string;
	template_id?: string | null;
	corporate_id?: string | null;
	booker_name: string;
	booker_phone: string;
	booker_email?: string | null;
	guest_count: number;
	special_notes?: string | null;
	scheduled_date: string; // YYYY-MM-DD
	scheduled_start_time: string; // ISO
	scheduled_end_time: string; // ISO
	duration_hours: DurationHours;
	pickup_address: string;
	pickup_lat: number;
	pickup_lng: number;
	gross_fare_idr: number;
	platform_fee_idr: number;
	driver_payout_idr: number;
	briga_coins_spent?: number;
	overtime_hours?: number;
	overtime_fare_idr?: number;
	payment_status: AppointmentPaymentStatus;
	payment_gateway_ref?: string | null;
	booking_status: AppointmentBookingStatus;
	driver_id?: string | null;
	vehicle_id?: string | null;
	trip_id?: string | null;
	tracking_secret_token: string;
	is_settled_to_driver?: boolean;
	settled_at?: string | null;
	created_at?: string;
	updated_at?: string;

	// Joined relations
	waypoints?: AppointmentWaypoint[];
	driver?: {
		id: string;
		name: string;
		phone: string;
		avatar_url?: string | null;
		average_eco_score?: number;
		bank_name?: string | null;
		bank_account_number?: string | null;
	} | null;
	vehicle?: {
		id: string;
		name: string;
		model: string;
		license_plate: string;
		battery_capacity_kwh?: number;
	} | null;
	corporate?: {
		id: string;
		company_name: string;
	} | null;
}

export interface AppointmentPricingTier {
	hours: DurationHours;
	grossFareIdr: number;
	driverTakeRatePct: number; // e.g. 0.85
	driverPayoutIdr: number;
	platformFeeIdr: number;
	includedKm: number;
	extraKmRateIdr: number;
	hourlyRateIdr: number;
	isPopularBadge?: boolean;
	savingsVsHourlyPct?: number;
	description: string;
}

export interface CreateBookingInput {
	templateSlug: string;
	bookerName: string;
	bookerPhone: string;
	bookerEmail?: string;
	guestCount?: number;
	specialNotes?: string;
	scheduledDate: string; // YYYY-MM-DD
	scheduledStartTime: string; // HH:mm or ISO
	durationHours: DurationHours;
	pickupAddress: string;
	pickupLat: number;
	pickupLng: number;
	waypoints?: Array<
		Omit<AppointmentWaypoint, "id" | "booking_id" | "stop_order"> & {
			stop_order?: number;
		}
	>;
	voucherCode?: string;
}

export interface TspStopPoint {
	name: string;
	address: string;
	lat: number;
	lng: number;
	isOrigin?: boolean;
	isLockedDestination?: boolean;
}

export interface TspOptimizationResult {
	originalOrder: TspStopPoint[];
	optimizedOrder: TspStopPoint[];
	waypointsIndices: number[];
	totalDistanceMeters: number;
	totalDistanceKm: number;
	totalDurationSeconds: number;
	totalDurationMinutes: number;
	distanceSavedKm: number;
	estimatedCo2AvoidedKg: number;
	polyline: [number, number][]; // [lat, lng][]
}
