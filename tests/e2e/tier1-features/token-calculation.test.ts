/**
 * Tier 1: Feature Coverage — Token Economics Calculation
 *
 * Requirements:
 * - Base Reward = distance_km * 10
 * - Eco Multiplier = (eco_score / 100) * 0.5 * Base
 * - Total = Base + Eco Multiplier
 * - Streak Bonus = +50 every 5th consecutive trip where eco_score >= 85
 * - Reset streak to 0 if eco_score < 85
 *
 * Source: ORIGINAL_REQUEST.md § Acceptance Criteria, PROJECT.md § Feature 8.
 */

import { describe, it, expect } from 'vitest';
import { calculateExpectedTokens } from '../harness/oracle';

describe('Tier 1: Feature Coverage — Token Economics Calculation', () => {
  it('2.1: should compute Base Reward as distance_km * 10', () => {
    const testCases = [
      { distance_km: 1.0, expectedBase: 10 },
      { distance_km: 5.5, expectedBase: 55 },
      { distance_km: 15.0, expectedBase: 150 },
      { distance_km: 42.8, expectedBase: 428 },
    ];

    for (const tc of testCases) {
      const result = calculateExpectedTokens({
        distance_km: tc.distance_km,
        eco_score: 80,
        current_streak: 0,
      });
      expect(result.base_reward).toBeCloseTo(tc.expectedBase, 4);
    }
  });

  it('2.2: should compute Eco Multiplier Reward as (eco_score / 100) * 0.5 * Base', () => {
    // 20 km -> Base = 200
    // eco_score = 90 -> Multiplier = (90/100) * 0.5 * 200 = 0.9 * 100 = 90
    const result1 = calculateExpectedTokens({
      distance_km: 20.0,
      eco_score: 90,
      current_streak: 0,
    });
    expect(result1.base_reward).toBe(200);
    expect(result1.eco_multiplier_reward).toBe(90);

    // 10 km -> Base = 100
    // eco_score = 70 -> Multiplier = (70/100) * 0.5 * 100 = 0.7 * 50 = 35
    const result2 = calculateExpectedTokens({
      distance_km: 10.0,
      eco_score: 70,
      current_streak: 0,
    });
    expect(result2.base_reward).toBe(100);
    expect(result2.eco_multiplier_reward).toBe(35);
  });

  it('2.3: should calculate total tokens as Base + Eco Multiplier for non-milestone streaks', () => {
    // distance = 12 km, Base = 120, eco_score = 80 -> eco_multiplier = 0.8 * 0.5 * 120 = 48
    // streak 1 -> streak bonus = 0 -> total = 168
    const result = calculateExpectedTokens({
      distance_km: 12.0,
      eco_score: 80,
      current_streak: 1, // streak will become 0 because 80 < 85
    });
    expect(result.base_reward).toBe(120);
    expect(result.eco_multiplier_reward).toBe(48);
    expect(result.streak_bonus).toBe(0);
    expect(result.total_tokens).toBe(168);
  });

  it('2.4: should award +50 streak bonus on every 5th consecutive qualifying trip (eco_score >= 85)', () => {
    // 5th trip in streak: current_streak was 4, eco_score = 88 (>= 85) -> new streak = 5 -> bonus = +50
    const distance_km = 10.0; // Base = 100
    const eco_score = 88; // Eco = 0.88 * 0.5 * 100 = 44
    const result = calculateExpectedTokens({
      distance_km,
      eco_score,
      current_streak: 4,
    });

    expect(result.new_streak).toBe(5);
    expect(result.is_streak_qualifying).toBe(true);
    expect(result.streak_bonus).toBe(50);
    expect(result.total_tokens).toBe(100 + 44 + 50); // 194
  });

  it('2.5: should award 0 streak bonus on intermediate trips (e.g. streaks 1, 2, 3, 4, 6)', () => {
    const intermediateStreaks = [0, 1, 2, 3, 5, 6, 7, 8];
    for (const priorStreak of intermediateStreaks) {
      const result = calculateExpectedTokens({
        distance_km: 10.0,
        eco_score: 90,
        current_streak: priorStreak,
      });
      expect(result.streak_bonus).toBe(0);
      expect(result.new_streak).toBe(priorStreak + 1);
    }
  });

  it('2.6: should reset streak to 0 and award 0 streak bonus when eco_score < 85', () => {
    // Even if current streak was 4, if trip has eco_score 84, streak breaks
    const result = calculateExpectedTokens({
      distance_km: 15.0,
      eco_score: 84, // Below 85!
      current_streak: 4,
    });

    expect(result.is_streak_qualifying).toBe(false);
    expect(result.new_streak).toBe(0);
    expect(result.streak_bonus).toBe(0);
  });
});
