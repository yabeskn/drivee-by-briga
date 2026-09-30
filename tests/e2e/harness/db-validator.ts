/**
 * Database Schema and Migration Validator
 * Evaluates SQL migrations in `supabase/migrations/` and TypeScript definitions in `src/lib/supabase/schema.ts`
 * against the Database Schema Contract in PROJECT.md and ORIGINAL_REQUEST.md.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface SchemaValidationResult {
  migrationFiles: string[];
  combinedSql: string;
  tables: Record<string, boolean>;
  columns: Record<string, string[]>;
  foreignKeys: Record<string, boolean>;
  rlsEnabled: Record<string, boolean>;
  rlsPolicies: Array<{ table: string; policy: string; operation: string; checkText: string }>;
  tsSchemaContent?: string;
  violations: string[];
}

export function validateDatabaseMigrations(migrationsDir: string = resolve(process.cwd(), 'supabase/migrations')): SchemaValidationResult {
  const result: SchemaValidationResult = {
    migrationFiles: [],
    combinedSql: '',
    tables: {},
    columns: {},
    foreignKeys: {},
    rlsEnabled: {},
    rlsPolicies: [],
    violations: [],
  };

  if (!existsSync(migrationsDir)) {
    result.violations.push(`Migrations directory not found at: ${migrationsDir}`);
    return result;
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  result.migrationFiles = files;

  let combined = '';
  for (const file of files) {
    const filePath = resolve(migrationsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    combined += `\n-- FILE: ${file}\n` + content;
  }
  result.combinedSql = combined;

  // Expected tables per specification
  const requiredTables = ['drivers', 'vehicles', 'trips', 'telemetry_points', 'brigacoin_transactions'];
  for (const table of requiredTables) {
    // Regex for CREATE TABLE [IF NOT EXISTS] <table>
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(`, 'i');
    const tableExists = tableRegex.test(combined);
    result.tables[table] = tableExists;
    if (!tableExists) {
      result.violations.push(`Required table '${table}' is missing from migrations`);
    }
  }

  // Validate Foreign Keys
  const fkChecks: Array<{ id: string; pattern: RegExp; description: string }> = [
    {
      id: 'trips_driver_fk',
      pattern: /REFERENCES\s+drivers\s*\(\s*id\s*\)/i,
      description: 'trips references drivers(id)',
    },
    {
      id: 'trips_vehicle_fk',
      pattern: /REFERENCES\s+vehicles\s*\(\s*id\s*\)/i,
      description: 'trips references vehicles(id)',
    },
    {
      id: 'telemetry_trip_fk_cascade',
      pattern: /REFERENCES\s+trips\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i,
      description: 'telemetry_points references trips(id) ON DELETE CASCADE',
    },
    {
      id: 'brigacoin_driver_fk',
      pattern: /REFERENCES\s+drivers\s*\(\s*id\s*\)/i,
      description: 'brigacoin_transactions references drivers(id)',
    },
    {
      id: 'hr_rentals_company_fk',
      pattern: /(?:REFERENCES\s+companies\s*\(\s*id\s*\)|fk_hr_company)/i,
      description: 'hr_rentals references companies(id)',
    },
  ];

  for (const fk of fkChecks) {
    const hasFk = fk.pattern.test(combined);
    result.foreignKeys[fk.id] = hasFk;
    if (!hasFk) {
      result.violations.push(`Foreign key constraint missing: ${fk.description}`);
    }
  }

  // Validate RLS enabled
  for (const table of requiredTables) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    const rlsOn = rlsRegex.test(combined);
    result.rlsEnabled[table] = rlsOn;
    if (!rlsOn) {
      result.violations.push(`RLS is not enabled for table '${table}'`);
    }
  }

  // Detect RLS policies
  const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_]+)\s+FOR\s+([A-Z]+)\s+([^\;]+);/gi;
  let match;
  while ((match = policyRegex.exec(combined)) !== null) {
    result.rlsPolicies.push({
      policy: match[1],
      table: match[2],
      operation: match[3],
      checkText: match[4],
    });
  }

  // Check client direct insert on brigacoin_transactions
  const directInsertPolicy = result.rlsPolicies.find(
    p => p.table === 'brigacoin_transactions' && p.operation.toUpperCase() === 'INSERT'
  );
  if (directInsertPolicy) {
    result.violations.push(
      `Insecure client direct INSERT policy found on 'brigacoin_transactions': "${directInsertPolicy.policy}". Ledger transactions must only be inserted by server/admin.`
    );
  }

  // Read schema.ts
  const schemaTsPath = resolve(process.cwd(), 'src/lib/supabase/schema.ts');
  if (existsSync(schemaTsPath)) {
    result.tsSchemaContent = readFileSync(schemaTsPath, 'utf-8');
  }

  return result;
}

export function validateTypeScriptSchema(schemaTsContent?: string): {
  hasTelemetryPoints: boolean;
  hasDriverStreakColumns: boolean;
  hasTripTelemetryColumns: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  if (!schemaTsContent) {
    violations.push('TypeScript schema file `src/lib/supabase/schema.ts` not found');
    return {
      hasTelemetryPoints: false,
      hasDriverStreakColumns: false,
      hasTripTelemetryColumns: false,
      violations,
    };
  }

  const hasTelemetryPoints = /telemetry_points\s*:\s*\{/i.test(schemaTsContent);
  if (!hasTelemetryPoints) {
    violations.push("schema.ts missing 'telemetry_points' table definition");
  }

  const hasDriverStreakColumns =
    /current_streak/i.test(schemaTsContent) && /total_trips/i.test(schemaTsContent);
  if (!hasDriverStreakColumns) {
    violations.push("schema.ts drivers table missing 'current_streak' or 'total_trips'");
  }

  const hasTripTelemetryColumns =
    /energy_used_kwh/i.test(schemaTsContent) || /tokens_earned/i.test(schemaTsContent);
  if (!hasTripTelemetryColumns) {
    violations.push("schema.ts trips table missing telemetry columns");
  }

  return {
    hasTelemetryPoints,
    hasDriverStreakColumns,
    hasTripTelemetryColumns,
    violations,
  };
}
