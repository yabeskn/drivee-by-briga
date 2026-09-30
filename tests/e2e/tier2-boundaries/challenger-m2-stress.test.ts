/**
 * Challenger M2 Empirical Stress Test Suite
 *
 * Dedicated adversarial verification harness for Milestone 2:
 * 1. Physics boundaries (160.1 vs 159.9 km/h, -0.01 vs 0.0 kWh, zero/negative distance, inverted timestamps)
 * 2. Token economics math (Base, continuous Eco Multiplier, 5th/10th/15th streak bonuses, streak reset on < 85)
 * 3. Exact parity between route.ts calculateTokens and eco-score.ts calculateTokenReward
 * 4. End-to-end API HTTP status code & payload contract validation
 */

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/trips/verify/route';
import { calculateTokenReward } from '@/lib/eco-score';
import { createValidTripPayload } from '../harness/fixtures';
import { calculateExpectedTokens, validateExpectedPhysics } from '../harness/oracle';

describe('Challenger M2: Empirical Stress Test Suite', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. PHYSICS BOUNDARY STRESS TESTS
  // ─────────────────────────────────────────────────────────────
  describe('1. Physics Boundaries', () => {
    it('1.1: Speed boundary — 160.1 km/h is rejected (HTTP 400), 159.9 km/h is accepted (HTTP 200)', async () => {
      const now = Date.now();
      const startTime = new Date(now - 3600 * 1000).toISOString(); // 1 hour ago
      const endTime = new Date(now).toISOString();

      // Test 160.1 km/h via max_speed_kmh
      const payload160_1 = createValidTripPayload({
        start_time: startTime,
        end_time: endTime,
        distance_km: 100.0,
        telemetry_summary: {
          harsh_accelerations: 0,
          harsh_brakings: 0,
          idle_duration_seconds: 0,
          average_speed_kmh: 100.0,
          max_speed_kmh: 160.1, // Over 160 km/h
          interpolated_gaps: 0,
        },
        gps_points: [
          { lat: -6.2, lng: 106.8, timestamp: now - 3600 * 1000, speed_kmh: 50, accuracy: 5 },
          { lat: -6.25, lng: 106.85, timestamp: now, speed_kmh: 100, accuracy: 5 },
        ],
      });

      const req160_1 = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload160_1),
      });

      const res160_1 = await POST(req160_1 as any);
      expect(res160_1.status).toBe(400);
      const body160_1 = await res160_1.json();
      expect(body160_1.verification_status).toBe('REJECTED');
      expect(body160_1.message).toMatch(/160/);

      // Test 159.9 km/h via max_speed_kmh
      const payload159_9 = createValidTripPayload({
        start_time: startTime,
        end_time: endTime,
        distance_km: 100.0,
        telemetry_summary: {
          harsh_accelerations: 0,
          harsh_brakings: 0,
          idle_duration_seconds: 0,
          average_speed_kmh: 100.0,
          max_speed_kmh: 159.9, // Within 160 km/h
          interpolated_gaps: 0,
        },
        gps_points: [
          { lat: -6.2, lng: 106.8, timestamp: now - 3600 * 1000, speed_kmh: 50, accuracy: 5 },
          { lat: -6.25, lng: 106.85, timestamp: now, speed_kmh: 100, accuracy: 5 },
        ],
      });

      const req159_9 = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload159_9),
      });

      const res159_9 = await POST(req159_9 as any);
      expect(res159_9.status).toBe(200);
      const body159_9 = await res159_9.json();
      expect(body159_9.verification_status).toBe('VERIFIED');
    });

    it('1.2: Implied speed boundary — distance / duration > 160 km/h is rejected (HTTP 400)', async () => {
      const now = Date.now();
      // 161 km in 1 hour -> 161 km/h implied
      const startTime = new Date(now - 3600 * 1000).toISOString();
      const endTime = new Date(now).toISOString();

      const payload = createValidTripPayload({
        start_time: startTime,
        end_time: endTime,
        distance_km: 161.0,
        telemetry_summary: {
          harsh_accelerations: 0,
          harsh_brakings: 0,
          idle_duration_seconds: 0,
          average_speed_kmh: 100.0,
          max_speed_kmh: 120.0, // max speed claimed is low, but implied speed is 161 km/h!
          interpolated_gaps: 0,
        },
      });

      const req = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.verification_status).toBe('REJECTED');
      expect(body.message).toMatch(/calculated speed/i);
    });

    it('1.3: GPS speed boundary — any GPS point > 160 km/h is rejected (HTTP 400)', async () => {
      const now = Date.now();
      const payload = createValidTripPayload({
        gps_points: [
          { lat: -6.2, lng: 106.8, timestamp: now - 1800 * 1000, speed_kmh: 60, accuracy: 5 },
          { lat: -6.21, lng: 106.81, timestamp: now - 900 * 1000, speed_kmh: 160.5, accuracy: 4 }, // Exceeds 160!
          { lat: -6.22, lng: 106.82, timestamp: now, speed_kmh: 40, accuracy: 5 },
        ],
      });

      const req = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.verification_status).toBe('REJECTED');
      expect(body.message).toMatch(/GPS point speed/i);
    });

    it('1.4: Energy boundary — -0.01 kWh is rejected (HTTP 400), 0.0 kWh is accepted (HTTP 200)', async () => {
      // -0.01 kWh rejected
      const payloadNeg = createValidTripPayload({
        energy_used_kwh: -0.01,
      });

      const reqNeg = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNeg),
      });

      const resNeg = await POST(reqNeg as any);
      expect(resNeg.status).toBe(400);
      const bodyNeg = await resNeg.json();
      expect(bodyNeg.verification_status).toBe('REJECTED');
      expect(bodyNeg.message).toMatch(/energy.*cannot be negative/i);

      // 0.0 kWh accepted (e.g. regenerative descent or unpowered coasting)
      const payloadZero = createValidTripPayload({
        energy_used_kwh: 0.0,
      });

      const reqZero = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadZero),
      });

      const resZero = await POST(reqZero as any);
      expect(resZero.status).toBe(200);
      const bodyZero = await resZero.json();
      expect(bodyZero.verification_status).toBe('VERIFIED');
    });

    it('1.5: Distance boundary — zero or negative distance is rejected (HTTP 400)', async () => {
      // 0 km distance
      const payloadZero = createValidTripPayload({
        distance_km: 0.0,
      });

      const reqZero = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadZero),
      });

      const resZero = await POST(reqZero as any);
      expect(resZero.status).toBe(400);
      const bodyZero = await resZero.json();
      expect(bodyZero.verification_status).toBe('REJECTED');
      expect(bodyZero.message).toMatch(/distance.*greater than zero/i);

      // -5 km distance
      const payloadNeg = createValidTripPayload({
        distance_km: -5.0,
      });

      const reqNeg = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNeg),
      });

      const resNeg = await POST(reqNeg as any);
      expect(resNeg.status).toBe(400);
      const bodyNeg = await resNeg.json();
      expect(bodyNeg.verification_status).toBe('REJECTED');
      expect(bodyNeg.message).toMatch(/distance.*greater than zero/i);
    });

    it('1.6: Temporal boundary — inverted timestamps (end < start) and equal timestamps are rejected (HTTP 400)', async () => {
      const now = Date.now();
      // end_time < start_time
      const payloadInverted = createValidTripPayload({
        start_time: new Date(now).toISOString(),
        end_time: new Date(now - 600000).toISOString(),
      });

      const reqInverted = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadInverted),
      });

      const resInverted = await POST(reqInverted as any);
      expect(resInverted.status).toBe(400);
      const bodyInverted = await resInverted.json();
      expect(bodyInverted.verification_status).toBe('REJECTED');
      expect(bodyInverted.message).toMatch(/end_time.*must be strictly after start_time/i);

      // end_time == start_time
      const payloadEqual = createValidTripPayload({
        start_time: new Date(now).toISOString(),
        end_time: new Date(now).toISOString(),
      });

      const reqEqual = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadEqual),
      });

      const resEqual = await POST(reqEqual as any);
      expect(resEqual.status).toBe(400);
      const bodyEqual = await resEqual.json();
      expect(bodyEqual.verification_status).toBe('REJECTED');
      expect(bodyEqual.message).toMatch(/end_time.*must be strictly after start_time/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. TOKEN ECONOMICS MATH STRESS TESTS
  // ─────────────────────────────────────────────────────────────
  describe('2. Token Economics Calculation & Streak Hardening', () => {
    it('2.1: Mathematical parity across distance: 12.5 km -> Base = 125', () => {
      const distance_km = 12.5;
      const eco_score = 80;

      // Oracle calculation
      const oracle = calculateExpectedTokens({ distance_km, eco_score, current_streak: 0 });
      expect(oracle.base_reward).toBe(125);
      // Eco multiplier: (80 / 100) * 0.5 * 125 = 0.8 * 62.5 = 50
      expect(oracle.eco_multiplier_reward).toBe(50);
      expect(oracle.streak_bonus).toBe(0);
      expect(oracle.total_tokens).toBe(175);

      // Library calculation (src/lib/eco-score.ts)
      const libReward = calculateTokenReward({ distanceKm: distance_km, ecoScore: eco_score, currentStreak: 0 });
      expect(libReward.baseReward).toBe(125);
      expect(libReward.multiplierReward).toBe(50);
      expect(libReward.streakBonus).toBe(0);
      expect(libReward.totalReward).toBe(175);
    });

    it('2.2: Continuous Eco Multiplier formula: (eco_score / 100) * 0.5 * Base', () => {
      const scenarios = [
        { distance_km: 10, eco_score: 100, expectedBase: 100, expectedEco: 50 },  // 1.0 * 0.5 * 100 = 50
        { distance_km: 10, eco_score: 90,  expectedBase: 100, expectedEco: 45 },  // 0.9 * 0.5 * 100 = 45
        { distance_km: 10, eco_score: 80,  expectedBase: 100, expectedEco: 40 },  // 0.8 * 0.5 * 100 = 40
        { distance_km: 10, eco_score: 70,  expectedBase: 100, expectedEco: 35 },  // 0.7 * 0.5 * 100 = 35
        { distance_km: 10, eco_score: 50,  expectedBase: 100, expectedEco: 25 },  // 0.5 * 0.5 * 100 = 25
        { distance_km: 10, eco_score: 0,   expectedBase: 100, expectedEco: 0 },   // 0.0 * 0.5 * 100 = 0
        { distance_km: 25, eco_score: 88,  expectedBase: 250, expectedEco: 110 }, // 0.88 * 0.5 * 250 = 110
      ];

      for (const s of scenarios) {
        const result = calculateTokenReward({
          distanceKm: s.distance_km,
          ecoScore: s.eco_score,
          currentStreak: 0,
        });

        expect(result.baseReward).toBeCloseTo(s.expectedBase, 4);
        expect(result.multiplierReward).toBeCloseTo(s.expectedEco, 4);
      }
    });

    it('2.3: Streak bonus: exactly +50 on 5th, 10th, 15th trip with eco >= 85', () => {
      // 5th trip (streak 4 -> 5)
      const trip5 = calculateTokenReward({ distanceKm: 10, ecoScore: 85, currentStreak: 4 });
      expect(trip5.isStreakQualifying).toBe(true);
      expect(trip5.newStreak).toBe(5);
      expect(trip5.streakBonus).toBe(50);

      // 10th trip (streak 9 -> 10)
      const trip10 = calculateTokenReward({ distanceKm: 10, ecoScore: 92, currentStreak: 9 });
      expect(trip10.isStreakQualifying).toBe(true);
      expect(trip10.newStreak).toBe(10);
      expect(trip10.streakBonus).toBe(50);

      // 15th trip (streak 14 -> 15)
      const trip15 = calculateTokenReward({ distanceKm: 10, ecoScore: 88, currentStreak: 14 });
      expect(trip15.isStreakQualifying).toBe(true);
      expect(trip15.newStreak).toBe(15);
      expect(trip15.streakBonus).toBe(50);
    });

    it('2.4: Non-milestone streaks award 0 bonus', () => {
      const nonMilestoneStreaks = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16];
      for (const streak of nonMilestoneStreaks) {
        const res = calculateTokenReward({ distanceKm: 10, ecoScore: 90, currentStreak: streak });
        expect(res.streakBonus).toBe(0);
        expect(res.newStreak).toBe(streak + 1);
      }
    });

    it('2.5: Streak resets to 0 when eco_score < 85', () => {
      const resetScores = [84.99, 84, 80, 70, 50, 0];
      for (const score of resetScores) {
        // Even from streak 4 or 9 or 14, failing eco_score resets to 0
        const res4 = calculateTokenReward({ distanceKm: 10, ecoScore: score, currentStreak: 4 });
        expect(res4.isStreakQualifying).toBe(false);
        expect(res4.newStreak).toBe(0);
        expect(res4.streakBonus).toBe(0);

        const res14 = calculateTokenReward({ distanceKm: 10, ecoScore: score, currentStreak: 14 });
        expect(res14.isStreakQualifying).toBe(false);
        expect(res14.newStreak).toBe(0);
        expect(res14.streakBonus).toBe(0);
      }
    });

    it('2.6: Verify API Route calculates streak progression and awards streak bonus (+50) on 5th consecutive qualifying trip', async () => {
      // 12.5 km trip, eco_score = 88 (>= 85), prior streak = 4 -> new_streak = 5
      // Base = 125, Eco = 0.88 * 0.5 * 125 = 55, Streak Bonus = +50 -> Total = 230
      const payload = createValidTripPayload({
        distance_km: 12.5,
        eco_score: 88,
        driver_current_streak: 4,
        tokens_earned: 230,
      });

      const req = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.verification_status).toBe('VERIFIED');
      expect(body.current_streak).toBe(5);
      expect(body.tokens_earned).toBe(230);
      expect(body.verification_details.token_breakdown).toEqual({
        base_reward: 125,
        eco_multiplier: 0.44, // 0.88 * 0.5
        multiplier_reward: 55,
        eco_multiplier_reward: 55,
        streak_bonus: 50,
        anti_spoofing_bonus: 0,
        total_reward: 230,
        current_streak: 5,
      });
    });

    it('2.7: Verify API Route resets streak and awards 0 bonus when eco_score = 80 (< 85)', async () => {
      // 12.5 km trip, eco_score = 80, current_streak = 4 -> new_streak = 0
      // Base = 125, Eco = 0.80 * 0.5 * 125 = 50, Streak = 0 -> Total = 175
      const payload = createValidTripPayload({
        distance_km: 12.5,
        eco_score: 80,
        driver_current_streak: 4,
        tokens_earned: 175,
      });

      const req = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.verification_status).toBe('VERIFIED');
      expect(body.tokens_earned).toBe(175);
      expect(body.current_streak).toBe(0);
      expect(body.verification_details.token_breakdown.streak_bonus).toBe(0);
      expect(body.verification_details.token_breakdown.total_reward).toBe(175);
    });

    it('2.8: Empirical Challenge: Driver streak fallback when driver does not exist in Supabase', async () => {
      // When driver does not exist in Supabase (e.g. unseeded/offline driver '22222222-2222-4222-8222-222222222222')
      // and driver_current_streak: 4 is provided in the payload:
      // The fallback branch is evaluated when driverRecord is null/no rows,
      // correctly advancing current_streak to 5 and awarding +50 streak bonus.
      const payload = createValidTripPayload({
        driver_id: '22222222-2222-4222-8222-222222222222',
        distance_km: 12.5,
        eco_score: 88,
        driver_current_streak: 4,
        tokens_earned: 230,
      });

      const req = new Request('http://localhost:3000/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const body = await res.json();

      // Confirms driver streak fallback is honored
      expect(body.verification_status).toBe('VERIFIED');
      expect(body.current_streak).toBe(5);
      expect(body.tokens_earned).toBe(230);
      expect(body.verification_details.token_breakdown.streak_bonus).toBe(50);
    });
  });
});
