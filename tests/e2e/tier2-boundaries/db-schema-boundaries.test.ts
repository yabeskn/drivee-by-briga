/**
 * Tier 2: Boundary & Corner Cases — Database Schema & Model Integrity
 *
 * Boundary value & constraint analysis:
 * - Cascade deletion: ON DELETE CASCADE on telemetry_points.trip_id
 * - Column check constraints: vehicle category and transaction types
 * - Default column values: current_streak (0), total_trips (0)
 * - Unique key constraints: drivers.email and vehicles.license_plate
 * - Foreign key constraint name: fk_hr_company referencing companies(id)
 *
 * Source: ORIGINAL_REQUEST.md § R2, PROJECT.md § Feature 1, 2.
 */

import { describe, it, expect } from 'vitest';
import { validateDatabaseMigrations } from '../harness/db-validator';

describe('Tier 2: Boundary & Corner Cases — Database Schema & Model Integrity', () => {
  const schemaResult = validateDatabaseMigrations();
  const sql = schemaResult.combinedSql;

  it('B3.1: should specify ON DELETE CASCADE on foreign keys from telemetry_points to trips', () => {
    const hasCascade = /telemetry_points[\s\S]*?REFERENCES\s+trips\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sql)
      || /REFERENCES\s+trips\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sql);
    expect(hasCascade, 'telemetry_points must cascade delete on trip deletion').toBe(true);
  });

  it('B3.2: should enforce CHECK constraint on vehicles.category enum values', () => {
    const hasCategoryCheck = /category\s+VARCHAR\(20\)\s+CHECK\s*\(\s*category\s+IN\s*\(\s*'standard'\s*,\s*'professional'\s*,\s*'premium'\s*,\s*'premium_plus'\s*\)\s*\)/i.test(sql);
    expect(hasCategoryCheck, 'vehicles table must restrict category to standard, professional, premium, premium_plus').toBe(true);
  });

  it('B3.3: should enforce CHECK constraint on brigacoin_transactions types', () => {
    const hasTypeCheck = /CHECK\s*\(\s*(?:type|transaction_type)\s+IN\s*\(/i.test(sql);
    expect(hasTypeCheck, 'brigacoin_transactions must have CHECK constraint for valid transaction types').toBe(true);
  });

  it('B3.4: should enforce DEFAULT 0 on driver streaks and statistics', () => {
    expect(sql).toMatch(/current_streak\s+INTEGER\s+DEFAULT\s+0/i);
    expect(sql).toMatch(/total_trips\s+INTEGER\s+DEFAULT\s+0/i);
  });

  it('B3.5: should enforce UNIQUE constraints on email and license plate', () => {
    expect(sql).toMatch(/email\s+VARCHAR\(\d+\)\s+UNIQUE/i);
    expect(sql).toMatch(/license_plate\s+VARCHAR\(\d+\)\s+UNIQUE/i);
  });

  it('B3.6: should enforce fk_hr_company constraint linking hr_rentals to companies table', () => {
    expect(schemaResult.foreignKeys.hr_rentals_company_fk).toBe(true);
  });
});
