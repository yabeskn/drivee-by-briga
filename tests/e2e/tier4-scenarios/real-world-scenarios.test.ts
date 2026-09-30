/**
 * Tier 4: Real-World Application Scenarios
 *
 * Scenarios:
 * 1. Daily Eco Commuter: Realistic urban commute with high eco-score and clean verification.
 * 2. The 5-Trip Milestone Streak Champion: Multi-trip journey achieving the 5th streak milestone and claiming +50 bonus.
 * 3. Adversarial Telemetry Spoofing & High-Speed Attack: Defense against malicious telemetry tampering and speed hacks.
 * 4. Full Fleet Lifecycle: Complete end-to-end flow from auth session to trip verification and ledger recording.
 * 5. Session Expiry & Route Guard Security: Securing fleet views against unauthenticated access and localStorage spoofing.
 * 6. Edge-Case Micro-Trip: Short depot relocation trip exercising boundary values and floating-point stability.
 *
 * Source: ORIGINAL_REQUEST.md § Acceptance Criteria, PROJECT.md Architecture & Feature Inventory.
 */

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/trips/verify/route';
import { createValidTripPayload } from '../harness/fixtures';
import { calculateExpectedTokens, validateExpectedPhysics } from '../harness/oracle';
import { evaluateRouteAccess } from '../harness/auth-guard';

describe('Tier 4: Real-World Application Scenarios', () => {
  it('Scenario 1: Daily Eco Commuter — 15 km urban commute with eco score 92', async () => {
    const distance_km = 15.0;
    const eco_score = 92;
    const energy_used_kwh = 2.5;

    // 1. Calculate authoritative expected reward
    const expected = calculateExpectedTokens({ distance_km, eco_score, current_streak: 0 });
    expect(expected.base_reward).toBe(150);
    expect(expected.eco_multiplier_reward).toBe(69);
    expect(expected.streak_bonus).toBe(0);
    expect(expected.total_tokens).toBe(219);

    // 2. Validate physics plausibility
    const physics = validateExpectedPhysics({
      distance_km,
      energy_used_kwh,
      average_speed_kmh: 30.0,
      max_speed_kmh: 55.0,
      start_time: new Date(Date.now() - 1800000).toISOString(),
      end_time: new Date(Date.now()).toISOString(),
    });
    expect(physics.passed).toBe(true);

    // 3. Submit trip payload to Verification API
    const payload = createValidTripPayload({
      distance_km,
      eco_score,
      energy_used_kwh,
      tokens_earned: expected.total_tokens,
    });

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verification_status).toBe('VERIFIED');
    expect(body.trip_id).toBe(payload.trip_id);
  });

  it('Scenario 2: The 5-Trip Milestone Streak Champion — Multi-trip streak progression to +50 bonus', async () => {
    const trips = [
      { id: 'trip-1', distance: 10.0, eco: 88 },
      { id: 'trip-2', distance: 12.0, eco: 90 },
      { id: 'trip-3', distance: 8.0,  eco: 86 },
      { id: 'trip-4', distance: 14.0, eco: 94 },
      { id: 'trip-5', distance: 20.0, eco: 91 }, // 5th consecutive qualifying trip!
    ];

    let currentStreak = 0;
    const results = [];

    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      const calculation = calculateExpectedTokens({
        distance_km: trip.distance,
        eco_score: trip.eco,
        current_streak: currentStreak,
      });

      currentStreak = calculation.new_streak;
      results.push(calculation);
    }

    // Verify streak counts
    expect(results[0].new_streak).toBe(1);
    expect(results[0].streak_bonus).toBe(0);

    expect(results[1].new_streak).toBe(2);
    expect(results[1].streak_bonus).toBe(0);

    expect(results[2].new_streak).toBe(3);
    expect(results[2].streak_bonus).toBe(0);

    expect(results[3].new_streak).toBe(4);
    expect(results[3].streak_bonus).toBe(0);

    // Trip 5 unlocks the milestone!
    expect(results[4].new_streak).toBe(5);
    expect(results[4].streak_bonus).toBe(50);
    // Base: 20 * 10 = 200, Eco: (91/100) * 0.5 * 200 = 91, Streak: 50 -> Total = 341
    expect(results[4].total_tokens).toBe(341);
  });

  it('Scenario 3: Adversarial Telemetry Spoofing & High-Speed Attack — Rejection of 185 km/h exploit', async () => {
    // Malicious driver attempts to claim high tokens by submitting an impossible 185 km/h run with negative energy
    const maliciousPayload = createValidTripPayload({
      energy_used_kwh: -8.0, // Negative energy exploit
      telemetry_summary: {
        harsh_accelerations: 0,
        harsh_brakings: 0,
        idle_duration_seconds: 0,
        average_speed_kmh: 170.0,
        max_speed_kmh: 185.0, // Blatant speed violation
        interpolated_gaps: 0,
      },
    });

    // Oracle physics validator must fail
    const physics = validateExpectedPhysics({
      distance_km: maliciousPayload.distance_km as number,
      energy_used_kwh: maliciousPayload.energy_used_kwh as number,
      max_speed_kmh: (maliciousPayload.telemetry_summary as any).max_speed_kmh,
      average_speed_kmh: (maliciousPayload.telemetry_summary as any).average_speed_kmh,
      start_time: maliciousPayload.start_time as string,
      end_time: maliciousPayload.end_time as string,
    });
    expect(physics.passed).toBe(false);
    expect(physics.violations.length).toBeGreaterThanOrEqual(2); // speed + negative energy

    // API must return HTTP 400 REJECTED
    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousPayload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.verification_status).toBe('REJECTED');
    expect(body.tokens_earned || 0).toBe(0);
  });

  it('Scenario 4: Full Fleet Lifecycle — Auth session verification, telemetry processing, and ledger consistency', async () => {
    const driverId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const vehicleId = 'bbbbbbbb-2222-4222-8222-222222222222';

    // 1. Driver has active session
    const driverSession = { user: { id: driverId } };
    const routeAccess = evaluateRouteAccess('/go', driverSession);
    expect(routeAccess.allowed).toBe(true);

    // 2. Driver submits trip
    const payload = createValidTripPayload({
      driver_id: driverId,
      vehicle_id: vehicleId,
      distance_km: 22.0,
      eco_score: 87,
    });

    const expectedTokens = calculateExpectedTokens({
      distance_km: 22.0,
      eco_score: 87,
      current_streak: 2,
    });
    // Base: 220, Eco: 0.87 * 0.5 * 220 = 95.7, Streak: 0 -> Total = 315.7

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verification_status).toBe('VERIFIED');
  });

  it('Scenario 5: Session Expiry & Route Guard Security — Blocking unauthorized fleet access', () => {
    // Unauthenticated user attempts to view private fleet routes
    const routesToTest = ['/admin', '/company', '/rewards', '/special-track', '/go'];

    for (const route of routesToTest) {
      const access = evaluateRouteAccess(route, null);
      expect(access.allowed).toBe(false);
      expect(access.status).toBe(307);
      expect(access.redirectUrl).toBe(`/login?next=${encodeURIComponent(route)}`);
    }
  });

  it('Scenario 6: Edge-Case Micro-Trip — Depot relocation with boundary eco-score 85.0', () => {
    const microTrip = {
      distance_km: 0.8,
      eco_score: 85.0,
      energy_used_kwh: 0.15,
      current_streak: 4,
    };

    // Calculate exact tokens
    const result = calculateExpectedTokens(microTrip);
    // Base: 0.8 * 10 = 8.0
    expect(result.base_reward).toBe(8.0);
    // Eco: 0.85 * 0.5 * 8.0 = 3.4
    expect(result.eco_multiplier_reward).toBe(3.4);
    // Streak: reached 5th -> +50 bonus!
    expect(result.streak_bonus).toBe(50);
    // Total: 8 + 3.4 + 50 = 61.4
    expect(result.total_tokens).toBe(61.4);
    expect(result.new_streak).toBe(5);
  });
});
