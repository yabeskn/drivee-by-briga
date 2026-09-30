/**
 * Tier 1: Feature Coverage — Database Schema & Model Integrity
 *
 * Requirements:
 * - Presence of tables: drivers, vehicles, trips, telemetry_points, brigacoin_transactions.
 * - Driver streak and telemetry columns.
 * - Foreign keys with ON DELETE CASCADE where specified.
 * - Row Level Security (RLS) enabled on all tables.
 * - RLS policy restricting direct client insert on brigacoin_transactions.
 *
 * Source: ORIGINAL_REQUEST.md § R2, PROJECT.md § Feature 1, 2, 3 & Database Schema Contract.
 */

import { describe, it, expect } from 'vitest';
import { validateDatabaseMigrations, validateTypeScriptSchema } from '../harness/db-validator';

describe('Tier 1: Feature Coverage — Database Schema & Model Integrity', () => {
  const schemaResult = validateDatabaseMigrations();

  it('3.1: should define all 5 core tables in database migrations', () => {
    const requiredTables = ['drivers', 'vehicles', 'trips', 'telemetry_points', 'brigacoin_transactions'];
    for (const table of requiredTables) {
      expect(
        schemaResult.tables[table],
        `Table '${table}' must be defined via CREATE TABLE in migrations`
      ).toBe(true);
    }
  });

  it('3.2: should define required columns on drivers table (current_streak, total_trips, role)', () => {
    const sql = schemaResult.combinedSql;
    expect(sql).toMatch(/current_streak/i);
    expect(sql).toMatch(/total_trips/i);
    expect(sql).toMatch(/average_eco_score/i);
    expect(sql).toMatch(/role/i);
  });

  it('3.3: should define telemetry_points table with proper coordinates and sensor fields', () => {
    const sql = schemaResult.combinedSql;
    expect(sql).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?telemetry_points/i);
    expect(sql).toMatch(/speed_kmh/i);
    expect(sql).toMatch(/battery_soc/i);
    expect(sql).toMatch(/latitude/i);
    expect(sql).toMatch(/longitude/i);
  });

  it('3.4: should enforce foreign keys from trips and telemetry_points to parent entities', () => {
    expect(schemaResult.foreignKeys.trips_driver_fk).toBe(true);
    expect(schemaResult.foreignKeys.trips_vehicle_fk).toBe(true);
    expect(schemaResult.foreignKeys.telemetry_trip_fk_cascade).toBe(true);
    expect(schemaResult.foreignKeys.brigacoin_driver_fk).toBe(true);
  });

  it('3.5: should enable Row Level Security (RLS) on all core tables', () => {
    const requiredTables = ['drivers', 'vehicles', 'trips', 'telemetry_points', 'brigacoin_transactions'];
    for (const table of requiredTables) {
      expect(
        schemaResult.rlsEnabled[table],
        `RLS must be enabled on table '${table}'`
      ).toBe(true);
    }
  });

  it('3.6: should restrict direct client INSERT on brigacoin_transactions via RLS', () => {
    // Check if any policy allows client users to insert directly into brigacoin_transactions
    const clientInsertPolicy = schemaResult.rlsPolicies.find(
      p => p.table === 'brigacoin_transactions' && p.operation.toUpperCase() === 'INSERT'
    );

    // Insecure policy: client can insert own transactions directly without server verification!
    // Specification requires this to be restricted/disallowed.
    expect(
      clientInsertPolicy,
      'Direct client INSERT on brigacoin_transactions must not be permitted by RLS policies'
    ).toBeUndefined();
  });

  it('3.7: should define TypeScript schema models in src/lib/supabase/schema.ts', () => {
    const tsResult = validateTypeScriptSchema(schemaResult.tsSchemaContent);
    expect(tsResult.hasTelemetryPoints, 'TypeScript schema.ts must include telemetry_points').toBe(true);
    expect(tsResult.hasDriverStreakColumns, 'TypeScript schema.ts drivers must include current_streak').toBe(true);
  });
});
