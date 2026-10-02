export type DrivingStatus = 'smooth' | 'harsh_accel' | 'sudden_brake' | 'idle';

export type EcoProfile = 'HIGHWAY_NORMAL' | 'URBAN_RUSH_HOUR';

// ── Trip Lifecycle (Scope 3 State Machine) ──────────────────

/**
 * State machine alur trip:
 *   IDLE → DISPATCHED → PASSENGER_PICKED_UP → COMPLETED
 *
 * Aturan keras: perekaman telematik (odometer, GPS, estimasi daya
 * baterai) WAJIB dimulai tepat pada transisi IDLE → DISPATCHED,
 * karena deadhead miles (jarak kosong menuju titik jemput) adalah
 * bagian integral dari emisi Scope 3.
 */
export type TripPhase =
  | 'IDLE'
  | 'DISPATCHED'
  | 'PASSENGER_PICKED_UP'
  | 'COMPLETED';

/**
 * Status Invisible Security watchdog.
 *   IDLE             — belum aktif
 *   RUNNING          — membaca sensor diam-diam (2 menit pertama)
 *   CLEAN            — window selesai, tidak ada anomali
 *   ANOMALY_DETECTED — indikasi Fake GPS / sensor tidak konsisten
 */
export type WatchdogStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'CLEAN'
  | 'ANOMALY_DETECTED';

export interface TripPhaseTransition {
  from: TripPhase;
  to: TripPhase;
  at: string; // ISO 8601
}

/**
 * Konteks Invisible Security & Scope 3 yang dikirim dari HUD
 * saat trip berakhir — wajib masuk payload verifikasi.
 */
export interface TripSecurityContext {
  /** Watchdog mendeteksi anomali (Fake GPS)? */
  watchdogFlagged: boolean;
  /** Alasan anomali (jika ada) */
  watchdogReason: string | null;
  /** Jarak deadhead (kosong) tercatat saat penumpang naik (km) */
  deadheadDistanceKm: number;
  /** Bukti foto live dari LiveProofCapture (jika pernah dipicu) */
  proofEvidence: PhotoEvidence | null;
  /** Info penumpang komuter yang dijemput (opsional) */
  boardedPassenger?: {
    name: string;
    companyName?: string;
    discountBrc: number;
  } | null;
}

export type VehicleCategory = 'standard' | 'professional' | 'premium' | 'premium_plus';

export type TripType = 'solo' | 'shared';

export type UserType = 'driver' | 'passenger' | 'talent' | 'company';

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  role: string;
  avatarUrl?: string;
  totalBrigaCoins: number;
  currentStreak: number;
  averageEcoScore: number;
  totalTripsCompleted: number;
}

export interface EVVehicle {
  id: string;
  code: string;
  name: string;
  model: string;
  licensePlate: string;
  batteryCapacityKwh: number;
  currentSoC: number;
  estimatedRangeKm: number;
  hubLocation: string;
  status: 'available' | 'in_service' | 'charging';
  efficiencyKwhPer100Km: number;
  category: VehicleCategory;
  seats: number;
  bluetoothName?: string;
  rentalPartnerName?: string;
  rentalPartnerPhone?: string;
  qrCodeToken?: string;
  lastOdometerKm?: number;
}

export interface ActiveDrivingTelemetry {
  speedKmh: number;
  maxSpeedKmh: number;
  speedLimitKmh: number;
  accelG: number;
  drivingStatus: DrivingStatus;
  statusMessage: string;
  activeProfile: EcoProfile;
  currentSoC: number;
  estimatedRangeKm: number;
  tripDurationSeconds: number;
  tripDistanceKm: number;
  liveEcoScore: number;
  gpsAccuracyMeters: number;
  isGpsLocked: boolean;
  wakeLockActive: boolean;
  pollingRateHz: number;
  osrmMatched: boolean;
}

export interface TripTelemetrySummary {
  harsh_accelerations: number;
  harsh_brakings: number;
  idle_duration_seconds: number;
  average_speed_kmh: number;
  max_speed_kmh: number;
  interpolated_gaps: number;
}

export interface TripRecord {
  trip_id: string;
  driver_id: string;
  driver_name: string;
  vehicle_id: string;
  vehicle_name: string;
  license_plate: string;
  start_time: string;
  end_time: string;
  profile_used: EcoProfile;
  start_battery_soc: number;
  end_battery_soc: number;
  start_odometer_km: number;
  end_odometer_km: number;
  distance_km: number;
  energy_used_soc_percent: number;
  energy_used_kwh: number;
  telemetry_summary: TripTelemetrySummary;
  eco_score: number;
  eco_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  eco_grade_title: string;
  tokens_earned: number;
  token_breakdown: {
    base_reward: number;
    eco_multiplier: number;
    multiplier_reward: number;
    streak_bonus: number;
    total_reward: number;
  };
  trip_hash: string;
  verification_status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  esg_co2_avoided_kg: number;
  // ── Scope 3 breakdown (deadhead absolut) ──
  /** Jarak kosong (deadhead) menuju titik jemput — bagian dari total */
  deadhead_distance_km?: number;
  /** Jarak dengan penumpang = total − deadhead */
  revenue_distance_km?: number;
  /** Timeline transisi state machine */
  trip_phase_timeline?: TripPhaseTransition[];
  /** Invisible Security: watchdog menandai anomali? */
  watchdog_flagged?: boolean;
  watchdog_anomaly_reason?: string | null;
  /** Bagi hasil finansial & rincian biaya platform */
  financial_split?: TripFinancialSplit;
}

export interface PhotoEvidence {
  odometerPhoto: string | null;
  batteryPhoto: string | null;
  capturedAt: number;
  gpsLocation: { lat: number; lng: number } | null;
}

export interface TripPhotoEvidence {
  start: PhotoEvidence;
  end: PhotoEvidence;
}

// ── BrigaCoin Types ─────────────────────────────────────────

export interface BrigaCoinBalance {
  driverId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: Date;
}

export interface BrigaCoinTransaction {
  id: string;
  driverId: string;
  userId?: string;
  type: 'earn' | 'spend' | 'expire' | 'adjust';
  amount: number;
  balance: number;
  source: 'trip' | 'bonus' | 'redemption' | 'referral' | 'adjustment' | 'carbon_offset' | 'corporate_allowance' | 'corporate_voucher' | 'trip_discount';
  referenceId?: string;
  description: string;
  actor?: 'drifee' | 'briga' | 'system' | 'admin';
  externalRef?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  category: 'internal' | 'voucher' | 'ewallet' | 'transport' | 'insurance' | 'maintenance' | 'carbon';
  cost: number;
  stock: number;
  image: string;
  terms: string;
  type: 'feature' | 'discount' | 'voucher' | 'auto_credit' | 'physical' | 'service';
  partnerId?: string;
  vehicleCategory?: VehicleCategory | 'all';
  userType: UserType | 'all';
  status: 'active' | 'inactive' | 'out_of_stock';
}

export interface Redemption {
  id: string;
  driverId: string;
  rewardId: string;
  cost: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  voucherCode?: string;
  deliveryMethod: 'email' | 'whatsapp' | 'auto';
  redeemedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// ── HR Rental Types ─────────────────────────────────────────

export interface RentalOrder {
  id: string;
  companyId: string;
  packageType: 'basic' | 'family' | 'executive' | 'executive_plus' | 'weekly' | 'monthly';
  vehicleId: string;
  driverId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  paymentStatus: 'pending' | 'paid' | 'verified';
  paymentMethod: 'transfer' | 'va' | 'qris';
  paymentReference: string;
  createdAt: Date;
}

export interface Scope3Emission {
  id: string;
  companyId: string;
  rentalId: string;
  category: 'business_travel' | 'commuting' | 'downstream';
  distanceKm: number;
  emissionFactor: number;
  totalEmissionKg: number;
  offsetKg: number;
  netEmissionKg: number;
  brcEarned: number;
  createdAt: Date;
}

export interface CarbonOffset {
  id: string;
  companyId: string;
  amountKg: number;
  type: 'reforestation' | 'renewable' | 'capture';
  cost: number;
  brcEarned: number;
  certificateUrl?: string;
  createdAt: Date;
}

// ── Corporate Green Commute & ESG Perks Types ───────────────

export interface CorporateProfile {
  id: string;
  companyName: string;
  domain?: string;
  brigaCoinPool: number;
  minPerEmployee: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorporateAllowance {
  id: string;
  corporateId: string;
  employeeEmail: string;
  amountBrc: number;
  status: 'allocated' | 'claimed' | 'expired' | 'revoked';
  voucherCode?: string;
  claimedByUserId?: string;
  claimedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface CorporateEmissionLog {
  id: string;
  corporateId: string;
  tripId?: string;
  employeeEmail: string;
  distanceKm: number;
  co2SavedKg: number;
  brcSpent: number;
  vehicleType: string;
  createdAt: Date;
}

// ── Special Track Types ─────────────────────────────────────

export interface SpecialTrackJob {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements: string[];
  vehicleCategory?: VehicleCategory;
  minEcoScore?: number;
  status: 'open' | 'closed' | 'filled';
  createdAt: Date;
}

export interface SpecialTrackApplication {
  id: string;
  jobId: string;
  driverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: Date;
}

// ── Unified User Types ──────────────────────────────────────

export interface UnifiedUser {
  id: string;
  email: string;
  type: UserType;
  drifeeProfile?: {
    driverId?: string;
    passengerId?: string;
    ecoScore?: number;
    totalTrips?: number;
    totalRides?: number;
    vehicleCategory?: VehicleCategory;
  };
  brigaidProfile?: {
    talentId?: string;
    companyId?: string;
    specialTrack?: boolean;
    verifiedDriver?: boolean;
  };
  wallet: {
    balance: number;
    currency: 'BRC';
    lastUpdated: Date;
  };
}

// ── Commuter & Passenger Boarding Types ─────────────────────

export interface BoardingPass {
  code: string; // e.g. "BRG-824"
  userId: string;
  passengerEmail: string;
  passengerName: string;
  corporateId?: string;
  companyName?: string;
  subsidyBalanceBrc: number;
  discountBrcSelected: number;
  estimatedFareIdr: number;
  routeCorridor?: string;
  status: 'active' | 'boarded' | 'completed' | 'expired';
  tripId?: string;
  driverId?: string;
  financialSplit?: TripFinancialSplit;
  createdAt: string;
  expiresAt: string;
}

export interface BoardingPassValidationResult {
  success: boolean;
  boardingPass?: BoardingPass;
  passengerName?: string;
  companyName?: string;
  discountBrc?: number;
  discountIdr?: number;
  error?: string;
}

// ── Financial Split & Fee Absorption Types ──────────────────

export interface TripFinancialSplit {
  /** Tarif kotor perjalanan sebelum diskon (IDR) */
  grossFareIdr: number;
  /** Pembayaran tunai/e-wallet aktual dari penumpang (IDR) */
  passengerPaidIdr: number;
  /** Nilai subsidi voucher BrigaCoin yang dipakai penumpang (IDR) */
  brcSubsidyIdr: number;
  /** Jumlah koin BrigaCoin yang digunakan */
  brcCoinsUsed: number;
  /** Persentase standar biaya layanan platform (default 0.15 = 15%) */
  standardPlatformFeeRate: number;
  /** Nilai standar biaya layanan platform sebelum subsidi (IDR) */
  standardPlatformFeeIdr: number;
  /** Nilai subsidi diskon yang diserap dari jatah platform fee (IDR) */
  platformSubsidyAbsorbedIdr: number;
  /** Biaya platform efektif yang dipotong (min 0) */
  effectivePlatformFeeIdr: number;
  /** Payout bersih yang diterima pengemudi (IDR, terlindungi penuh) */
  driverNetPayoutIdr: number;
  /** Penanda bahwa penghasilan pengemudi terlindungi 100% */
  driverEarningsProtected: boolean;
  /** Nama entitas korporat sponsor/mitra ESG */
  corporateSponsor?: string;
}
