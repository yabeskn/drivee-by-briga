/**
 * Test Fixtures for E2E Testing Track
 * Derived from PROJECT.md Interface Contracts and data models.
 */

import { computeCanonicalTripHash } from './oracle';

export const SAMPLE_BASE64_IMAGE = 'data:image/jpeg;base64,' + Buffer.from('mock-jpeg-image-bytes-for-odometer-evidence').toString('base64');

export function createValidTripPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const startTime = new Date(now - 1800 * 1000).toISOString(); // 30 mins ago
  const endTime = new Date(now).toISOString();

  const basePayload: Record<string, unknown> = {
    trip_id: '11111111-1111-4111-8111-111111111111',
    driver_id: '22222222-2222-4222-8222-222222222222',
    vehicle_id: '33333333-3333-4333-8333-333333333333',
    start_time: startTime,
    end_time: endTime,
    profile_used: 'URBAN_RUSH_HOUR',
    start_battery_soc: 85,
    end_battery_soc: 80,
    start_odometer_km: 12000.0,
    end_odometer_km: 12015.0,
    distance_km: 15.0,
    energy_used_kwh: 2.5,
    telemetry_summary: {
      harsh_accelerations: 0,
      harsh_brakings: 0,
      idle_duration_seconds: 60,
      average_speed_kmh: 30.0,
      max_speed_kmh: 55.0,
      interpolated_gaps: 0,
    },
    score_breakdown: {
      smooth_driving: 95,
      speed_compliance: 95,
      energy_efficiency: 90,
      regenerative_braking: 88,
    },
    eco_score: 92,
    eco_grade: 'A+',
    tokens_earned: 219, // Expected Base (150) + Eco (0.92 * 0.5 * 150 = 69)
    esg_co2_avoided_kg: 1.8,
    gps_points: [
      { lat: -6.2088, lng: 106.8456, timestamp: now - 1800 * 1000, speed_kmh: 25, accuracy: 5 },
      { lat: -6.2100, lng: 106.8480, timestamp: now - 900 * 1000, speed_kmh: 45, accuracy: 4 },
      { lat: -6.2150, lng: 106.8520, timestamp: now, speed_kmh: 30, accuracy: 5 },
    ],
    photo_evidence: {
      start_odometer: SAMPLE_BASE64_IMAGE,
      start_battery: SAMPLE_BASE64_IMAGE,
      end_odometer: SAMPLE_BASE64_IMAGE,
      end_battery: SAMPLE_BASE64_IMAGE,
      captured_at: now - 60 * 1000, // captured 1 min ago
      gps_location: { lat: -6.215, lng: 106.852 },
    },
    ...overrides,
  };

  // Canonical hash fields
  const hashPayload = {
    trip_id: basePayload.trip_id,
    driver_id: basePayload.driver_id,
    vehicle_id: basePayload.vehicle_id,
    start_time: basePayload.start_time,
    end_time: basePayload.end_time,
    profile_used: basePayload.profile_used,
    start_battery_soc: basePayload.start_battery_soc,
    end_battery_soc: basePayload.end_battery_soc,
    start_odometer_km: basePayload.start_odometer_km,
    end_odometer_km: basePayload.end_odometer_km,
    distance_km: basePayload.distance_km,
    energy_used_kwh: basePayload.energy_used_kwh,
    eco_score: basePayload.eco_score,
    eco_grade: basePayload.eco_grade,
    tokens_earned: basePayload.tokens_earned,
    esg_co2_avoided_kg: basePayload.esg_co2_avoided_kg,
  };

  if (!overrides.trip_hash) {
    basePayload.trip_hash = computeCanonicalTripHash(hashPayload);
  }

  return basePayload;
}

export function createPhysicsViolationPayloads() {
  return {
    highMaxSpeed: createValidTripPayload({
      telemetry_summary: {
        harsh_accelerations: 3,
        harsh_brakings: 2,
        idle_duration_seconds: 10,
        average_speed_kmh: 110,
        max_speed_kmh: 175.0, // Violates 160 km/h threshold!
        interpolated_gaps: 0,
      },
    }),
    highAverageSpeed: createValidTripPayload({
      telemetry_summary: {
        harsh_accelerations: 1,
        harsh_brakings: 1,
        idle_duration_seconds: 0,
        average_speed_kmh: 165.0, // Violates 160 km/h threshold!
        max_speed_kmh: 170.0,
        interpolated_gaps: 0,
      },
    }),
    negativeEnergy: createValidTripPayload({
      energy_used_kwh: -5.0, // Impossible negative energy!
    }),
    negativeDistance: createValidTripPayload({
      distance_km: -12.5, // Impossible negative distance!
    }),
    excessiveDistance: createValidTripPayload({
      distance_km: 650.0, // Exceeds 500 km maximum limit!
    }),
    invertedTime: createValidTripPayload({
      start_time: new Date(Date.now()).toISOString(),
      end_time: new Date(Date.now() - 3600 * 1000).toISOString(), // Ended before start!
    }),
    excessiveGpsSpeed: createValidTripPayload({
      gps_points: [
        { lat: -6.2, lng: 106.8, timestamp: Date.now() - 1000, speed_kmh: 195.0, accuracy: 3 },
      ],
    }),
  };
}

export function createTimestampViolationPayloads() {
  const now = Date.now();
  return {
    futureTrip: createValidTripPayload({
      start_time: new Date(now + 24 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 25 * 3600 * 1000).toISOString(),
    }),
    expiredPhotoTimestamp: createValidTripPayload({
      photo_evidence: {
        start_odometer: SAMPLE_BASE64_IMAGE,
        start_battery: SAMPLE_BASE64_IMAGE,
        end_odometer: SAMPLE_BASE64_IMAGE,
        end_battery: SAMPLE_BASE64_IMAGE,
        captured_at: now - 3600 * 1000 * 24, // 24 hours ago (expired > 5 mins)
        gps_location: { lat: -6.215, lng: 106.852 },
      },
    }),
    mismatchedOrderGpsTimestamps: createValidTripPayload({
      gps_points: [
        { lat: -6.2088, lng: 106.8456, timestamp: now - 500, speed_kmh: 30, accuracy: 5 },
        { lat: -6.2100, lng: 106.8480, timestamp: now - 2000, speed_kmh: 40, accuracy: 5 }, // time went backward
      ],
    }),
  };
}

export function createMissingFieldsPayloads() {
  const base = createValidTripPayload();

  const missingTripId = { ...base };
  delete missingTripId.trip_id;

  const missingDriverId = { ...base };
  delete missingDriverId.driver_id;

  const missingVehicleId = { ...base };
  delete missingVehicleId.vehicle_id;

  const missingDistance = { ...base };
  delete missingDistance.distance_km;

  const missingEcoScore = { ...base };
  delete missingEcoScore.eco_score;

  const missingEnergy = { ...base };
  delete missingEnergy.energy_used_kwh;

  const missingHash = { ...base };
  delete missingHash.trip_hash;

  return {
    missingTripId,
    missingDriverId,
    missingVehicleId,
    missingDistance,
    missingEcoScore,
    missingEnergy,
    missingHash,
  };
}
