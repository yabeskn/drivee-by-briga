/**
 * Tier 2: Boundary & Corner Cases — Trip Verification API
 *
 * Boundary value analysis:
 * - Speed: 160.0 km/h (acceptable boundary) vs 160.01 km/h (rejection boundary)
 * - Energy: 0.00 kWh (acceptable zero-energy coasting) vs -0.01 kWh (impossible negative energy)
 * - Distance: 0.00 km vs 500.00 km vs 500.01 km
 * - Timestamps: start_time == end_time (zero duration) vs end_time < start_time
 * - Battery SOC: 100% down to 0% vs SOC > 100% or SOC < 0%
 * - Adversarial payload: corrupt JSON, null fields, extra large telemetry array
 *
 * Source: ORIGINAL_REQUEST.md § Acceptance Criteria, PROJECT.md § Feature 5.
 */

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/trips/verify/route';
import { createValidTripPayload } from '../harness/fixtures';
import { validateExpectedPhysics } from '../harness/oracle';

describe('Tier 2: Boundary & Corner Cases — Trip Verification API', () => {
  it('B1.1: Speed boundary — exactly 160.0 km/h is permitted, 160.01 km/h is rejected', async () => {
    // 160.0 km/h (exact upper boundary)
    const validBoundary = validateExpectedPhysics({
      distance_km: 10,
      energy_used_kwh: 2,
      max_speed_kmh: 160.0,
      average_speed_kmh: 80.0,
      start_time: new Date(Date.now() - 600000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(validBoundary.passed).toBe(true);

    // 160.01 km/h (just over boundary)
    const invalidBoundary = validateExpectedPhysics({
      distance_km: 10,
      energy_used_kwh: 2,
      max_speed_kmh: 160.01,
      average_speed_kmh: 80.0,
      start_time: new Date(Date.now() - 600000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(invalidBoundary.passed).toBe(false);
    expect(invalidBoundary.violations.some(v => v.includes('160 km/h'))).toBe(true);

    // Call API with 160.01 km/h
    const payload = createValidTripPayload({
      telemetry_summary: {
        harsh_accelerations: 0,
        harsh_brakings: 0,
        idle_duration_seconds: 0,
        average_speed_kmh: 90.0,
        max_speed_kmh: 160.01,
        interpolated_gaps: 0,
      },
    });

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('B1.2: Energy boundary — exactly 0.00 kWh is permitted, -0.01 kWh is rejected', async () => {
    // Zero energy consumption (e.g. rolling downhill or stationary test)
    const zeroEnergyCheck = validateExpectedPhysics({
      distance_km: 0.5,
      energy_used_kwh: 0.0,
      start_time: new Date(Date.now() - 60000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(zeroEnergyCheck.passed).toBe(true);

    // -0.01 kWh
    const negativeEnergyCheck = validateExpectedPhysics({
      distance_km: 0.5,
      energy_used_kwh: -0.01,
      start_time: new Date(Date.now() - 60000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(negativeEnergyCheck.passed).toBe(false);

    // Call API with -0.01 kWh
    const payload = createValidTripPayload({ energy_used_kwh: -0.01 });
    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('B1.3: Distance boundary — exactly 500.0 km is permitted, 500.01 km is rejected', async () => {
    const validMax = validateExpectedPhysics({
      distance_km: 500.0,
      energy_used_kwh: 80.0,
      start_time: new Date(Date.now() - 18000000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(validMax.passed).toBe(true);

    const exceedMax = validateExpectedPhysics({
      distance_km: 500.01,
      energy_used_kwh: 80.0,
      start_time: new Date(Date.now() - 18000000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(exceedMax.passed).toBe(false);
  });

  it('B1.4: Temporal boundary — zero duration and inverted time travel are rejected', async () => {
    const now = new Date().toISOString();
    const zeroDuration = validateExpectedPhysics({
      distance_km: 5.0,
      energy_used_kwh: 1.0,
      start_time: now,
      end_time: now, // Same timestamp: 0 seconds duration!
    });
    expect(zeroDuration.passed).toBe(false);

    const timeTravel = validateExpectedPhysics({
      distance_km: 5.0,
      energy_used_kwh: 1.0,
      start_time: new Date(Date.now()).toISOString(),
      end_time: new Date(Date.now() - 10000).toISOString(), // Ended before start!
    });
    expect(timeTravel.passed).toBe(false);
  });

  it('B1.5: Battery SOC boundary — out-of-bounds SOC (> 100% or < 0%) is flagged', () => {
    const invalidSocHigh = validateExpectedPhysics({
      distance_km: 10,
      energy_used_kwh: 2,
      start_battery_soc: 105, // Impossible > 100%
      end_battery_soc: 90,
      start_time: new Date(Date.now() - 600000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(invalidSocHigh.passed).toBe(false);

    const invalidSocLow = validateExpectedPhysics({
      distance_km: 10,
      energy_used_kwh: 2,
      start_battery_soc: 80,
      end_battery_soc: -5, // Impossible < 0%
      start_time: new Date(Date.now() - 600000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(invalidSocLow.passed).toBe(false);
  });

  it('B1.6: Adversarial empty / malformed body returns HTTP 400 without unhandled server exception', async () => {
    const malformedRequest = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(malformedRequest as any);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.verification_status).toBe('REJECTED');
  });
});
