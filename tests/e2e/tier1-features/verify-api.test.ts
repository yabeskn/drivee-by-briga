/**
 * Tier 1: Feature Coverage — Trip Verification API (POST /api/trips/verify)
 *
 * Requirements:
 * - Reject speed > 160 km/h with HTTP 400.
 * - Reject negative energy (energy_used_kwh < 0) with HTTP 400.
 * - Reject manipulated/expired photo timestamps with HTTP 400.
 * - Reject missing required fields with HTTP 400.
 * - Return HTTP 200 with VERIFIED status for physically plausible valid trips.
 *
 * Source: ORIGINAL_REQUEST.md § Acceptance Criteria, PROJECT.md § Feature 4, 5, 6.
 */

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/trips/verify/route';
import {
  createValidTripPayload,
  createPhysicsViolationPayloads,
  createTimestampViolationPayloads,
  createMissingFieldsPayloads,
} from '../harness/fixtures';
import { validateExpectedPhysics } from '../harness/oracle';

describe('Tier 1: Feature Coverage — Trip Verification API', () => {
  it('1.1: should reject trips exceeding speed threshold of 160 km/h with HTTP 400', async () => {
    const physicsViolations = createPhysicsViolationPayloads();
    const payload = physicsViolations.highMaxSpeed; // max_speed_kmh = 175.0 km/h

    // Verify Oracle flags this as a physics violation
    const oracleResult = validateExpectedPhysics({
      distance_km: payload.distance_km as number,
      energy_used_kwh: payload.energy_used_kwh as number,
      max_speed_kmh: (payload.telemetry_summary as any).max_speed_kmh,
      start_time: payload.start_time as string,
      end_time: payload.end_time as string,
    });
    expect(oracleResult.passed).toBe(false);
    expect(oracleResult.violations.some(v => v.includes('160 km/h'))).toBe(true);

    // Call API Route Handler
    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    // Spec Requirement: Must reject with HTTP 400
    expect(response.status).toBe(400);
    expect(body.verification_status).toBe('REJECTED');
    expect(body.message || body.reason).toMatch(/speed|physics/i);
  });

  it('1.2: should reject trips with negative energy consumption (energy_used_kwh < 0) with HTTP 400', async () => {
    const physicsViolations = createPhysicsViolationPayloads();
    const payload = physicsViolations.negativeEnergy; // energy_used_kwh = -5.0

    // Verify Oracle check
    const oracleResult = validateExpectedPhysics({
      distance_km: payload.distance_km as number,
      energy_used_kwh: payload.energy_used_kwh as number,
      start_time: payload.start_time as string,
      end_time: payload.end_time as string,
    });
    expect(oracleResult.passed).toBe(false);
    expect(oracleResult.violations.some(v => v.includes('negative'))).toBe(true);

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    // Spec Requirement: Must reject with HTTP 400
    expect(response.status).toBe(400);
    expect(body.verification_status).toBe('REJECTED');
    expect(body.message || body.reason).toMatch(/energy|physics/i);
  });

  it('1.3: should reject manipulated/expired photo timestamp with HTTP 400', async () => {
    const timestampViolations = createTimestampViolationPayloads();
    const payload = timestampViolations.expiredPhotoTimestamp;

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.verification_status).toBe('REJECTED');
    expect(body.message || body.reason).toMatch(/photo|timestamp/i);
  });

  it('1.4: should reject submissions with missing required fields with HTTP 400', async () => {
    const missing = createMissingFieldsPayloads();
    const payload = missing.missingTripId;

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.verification_status).toBe('REJECTED');
  });

  it('1.5: should accept physically plausible valid trip with HTTP 200 and VERIFIED status', async () => {
    const payload = createValidTripPayload();

    const oracleResult = validateExpectedPhysics({
      distance_km: payload.distance_km as number,
      energy_used_kwh: payload.energy_used_kwh as number,
      max_speed_kmh: (payload.telemetry_summary as any).max_speed_kmh,
      average_speed_kmh: (payload.telemetry_summary as any).average_speed_kmh,
      start_time: payload.start_time as string,
      end_time: payload.end_time as string,
    });
    expect(oracleResult.passed).toBe(true);

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
    expect(body.tokens_earned).toBeGreaterThan(0);
  });

  it('1.6: should return deterministic failure structure on hash mismatch', async () => {
    const payload = createValidTripPayload({
      trip_hash: 'tampered-hash-000000000000000000000000000000000000000000000000000000',
    });

    const request = new Request('http://localhost:3000/api/trips/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request as any);
    const body = await response.json();

    // Spec Requirement: Rejection returns HTTP 400
    expect(response.status).toBe(400);
    expect(body.verification_status).toBe('REJECTED');
    expect(body.message || body.reason).toMatch(/hash/i);
  });
});
