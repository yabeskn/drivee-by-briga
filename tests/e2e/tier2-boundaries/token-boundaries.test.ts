/**
 * Tier 2: Boundary & Corner Cases — Token Calculations
 *
 * Boundary value analysis:
 * - Distance: 0 km (lower bound), 0.05 km (micro-trip), 500 km (upper bound)
 * - Eco score: 0 (minimum), 84.99 vs 85.00 (qualifying streak threshold), 100 (maximum)
 * - Streak milestones: 4->5 (+50 bonus), 5->6 (0 bonus), 9->10 (+50 bonus), 10->11 (0 bonus)
 * - Streak disruption: 14->0 (reset on failing score)
 *
 * Source: ORIGINAL_REQUEST.md § Acceptance Criteria, PROJECT.md § Feature 8.
 */

import { describe, it, expect } from 'vitest';
import { calculateExpectedTokens } from '../harness/oracle';

describe('Tier 2: Boundary & Corner Cases — Token Calculations', () => {
  it('B2.1: Distance boundary = 0 km results in 0 base and 0 eco multiplier tokens', () => {
    const result = calculateExpectedTokens({
      distance_km: 0,
      eco_score: 100,
      current_streak: 0,
    });
    expect(result.base_reward).toBe(0);
    expect(result.eco_multiplier_reward).toBe(0);
    expect(result.total_tokens).toBe(0);
  });

  it('B2.2: Micro-distance boundary = 0.05 km handles floating-point math cleanly', () => {
    const result = calculateExpectedTokens({
      distance_km: 0.05,
      eco_score: 90,
      current_streak: 0,
    });
    // Base = 0.05 * 10 = 0.5
    expect(result.base_reward).toBeCloseTo(0.5, 4);
    // Eco = 0.9 * 0.5 * 0.5 = 0.225
    expect(result.eco_multiplier_reward).toBeCloseTo(0.225, 4);
    expect(result.total_tokens).toBeCloseTo(0.725, 4);
  });

  it('B2.3: Eco score lower bound = 0 yields zero eco multiplier reward', () => {
    const result = calculateExpectedTokens({
      distance_km: 10,
      eco_score: 0,
      current_streak: 4,
    });
    expect(result.base_reward).toBe(100);
    expect(result.eco_multiplier_reward).toBe(0);
    // 0 is < 85, so streak breaks to 0, no bonus
    expect(result.new_streak).toBe(0);
    expect(result.streak_bonus).toBe(0);
    expect(result.total_tokens).toBe(100);
  });

  it('B2.4: Eco score streak qualifying threshold — 84.99 vs 85.00', () => {
    // 84.99 (just below 85) breaks streak
    const belowThreshold = calculateExpectedTokens({
      distance_km: 10,
      eco_score: 84.99,
      current_streak: 4,
    });
    expect(belowThreshold.is_streak_qualifying).toBe(false);
    expect(belowThreshold.new_streak).toBe(0);
    expect(belowThreshold.streak_bonus).toBe(0);

    // 85.00 (exact threshold) qualifies and triggers 5th streak bonus
    const atThreshold = calculateExpectedTokens({
      distance_km: 10,
      eco_score: 85.00,
      current_streak: 4,
    });
    expect(atThreshold.is_streak_qualifying).toBe(true);
    expect(atThreshold.new_streak).toBe(5);
    expect(atThreshold.streak_bonus).toBe(50);
  });

  it('B2.5: Eco score upper bound = 100 provides maximum eco multiplier of 0.5 * Base', () => {
    const result = calculateExpectedTokens({
      distance_km: 25,
      eco_score: 100,
      current_streak: 0,
    });
    // Base = 250
    // Eco = (100 / 100) * 0.5 * 250 = 125
    expect(result.base_reward).toBe(250);
    expect(result.eco_multiplier_reward).toBe(125);
    expect(result.total_tokens).toBe(375);
  });

  it('B2.6: Multi-milestone streak transitions — 5th, 6th, 10th, 11th, and reset from 14', () => {
    // 4 -> 5: bonus +50
    const s5 = calculateExpectedTokens({ distance_km: 10, eco_score: 90, current_streak: 4 });
    expect(s5.new_streak).toBe(5);
    expect(s5.streak_bonus).toBe(50);

    // 5 -> 6: bonus 0
    const s6 = calculateExpectedTokens({ distance_km: 10, eco_score: 90, current_streak: 5 });
    expect(s6.new_streak).toBe(6);
    expect(s6.streak_bonus).toBe(0);

    // 9 -> 10: bonus +50
    const s10 = calculateExpectedTokens({ distance_km: 10, eco_score: 90, current_streak: 9 });
    expect(s10.new_streak).toBe(10);
    expect(s10.streak_bonus).toBe(50);

    // 10 -> 11: bonus 0
    const s11 = calculateExpectedTokens({ distance_km: 10, eco_score: 90, current_streak: 10 });
    expect(s11.new_streak).toBe(11);
    expect(s11.streak_bonus).toBe(0);

    // 14 -> reset: eco_score 82 < 85 -> resets to 0, bonus 0
    const sBroken = calculateExpectedTokens({ distance_km: 10, eco_score: 82, current_streak: 14 });
    expect(sBroken.new_streak).toBe(0);
    expect(sBroken.streak_bonus).toBe(0);
  });
});
