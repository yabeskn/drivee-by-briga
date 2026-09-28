export type DrivingStatus = 'smooth' | 'harsh_accel' | 'sudden_brake' | 'idle';

export type EcoProfile = 'HIGHWAY_NORMAL' | 'URBAN_RUSH_HOUR';

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
  currentSoC: number; // 0 - 100%
  estimatedRangeKm: number;
  hubLocation: string;
  status: 'available' | 'in_service' | 'charging';
  efficiencyKwhPer100Km: number;
}

export interface ActiveDrivingTelemetry {
  speedKmh: number;
  maxSpeedKmh: number;
  speedLimitKmh: number;
  accelG: number; // m/s^2
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
  pollingRateHz: number; // 1Hz, 0.2Hz, 0.067Hz
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
}

// ── Anti-Spoofing Photo Evidence ─────────────────────────────

export interface PhotoEvidence {
  odometerPhoto: string | null;  // base64 compressed JPEG
  batteryPhoto: string | null;   // base64 compressed JPEG
  capturedAt: number;            // epoch ms
  gpsLocation: { lat: number; lng: number } | null;
}

export interface TripPhotoEvidence {
  start: PhotoEvidence;
  end: PhotoEvidence;
}
