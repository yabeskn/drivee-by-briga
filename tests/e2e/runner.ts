/**
 * E2E Test Suite Runner Harness
 *
 * Provides CLI commands and programmatic execution for the 4-tier E2E testing track:
 * - Tier 1: Feature Coverage (verify-api, token-calculation, db-schema, auth-protection)
 * - Tier 2: Boundary & Corner Cases (verify-api-boundaries, token-boundaries, db-schema-boundaries, auth-boundaries)
 * - Tier 3: Cross-Feature Combinations (cross-feature-combinations)
 * - Tier 4: Real-World Application Scenarios (real-world-scenarios)
 *
 * Usage:
 *   npx vitest run tests/e2e
 *   npx tsx tests/e2e/runner.ts
 *   node --loader ... tests/e2e/runner.ts [--tier=1|2|3|4] [--feature=verify|token|db|auth]
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface TestSuiteManifest {
  tier1: string[];
  tier2: string[];
  tier3: string[];
  tier4: string[];
}

export const MANIFEST: TestSuiteManifest = {
  tier1: [
    'tests/e2e/tier1-features/verify-api.test.ts',
    'tests/e2e/tier1-features/token-calculation.test.ts',
    'tests/e2e/tier1-features/db-schema.test.ts',
    'tests/e2e/tier1-features/auth-protection.test.ts',
  ],
  tier2: [
    'tests/e2e/tier2-boundaries/verify-api-boundaries.test.ts',
    'tests/e2e/tier2-boundaries/token-boundaries.test.ts',
    'tests/e2e/tier2-boundaries/db-schema-boundaries.test.ts',
    'tests/e2e/tier2-boundaries/auth-boundaries.test.ts',
  ],
  tier3: [
    'tests/e2e/tier3-combinations/cross-feature-combinations.test.ts',
  ],
  tier4: [
    'tests/e2e/tier4-scenarios/real-world-scenarios.test.ts',
  ],
};

export function runTests(args: string[] = process.argv.slice(2)): number {
  console.log('=================================================================');
  console.log(' Drive-e by Briga — Smart EV Fleet Telematics E2E Test Runner');
  console.log('=================================================================');

  const tierArg = args.find(a => a.startsWith('--tier='));
  const featureArg = args.find(a => a.startsWith('--feature='));

  let targetFiles: string[] = [];

  if (tierArg) {
    const tierNum = tierArg.split('=')[1];
    if (tierNum === '1') targetFiles = MANIFEST.tier1;
    else if (tierNum === '2') targetFiles = MANIFEST.tier2;
    else if (tierNum === '3') targetFiles = MANIFEST.tier3;
    else if (tierNum === '4') targetFiles = MANIFEST.tier4;
  } else {
    targetFiles = [
      ...MANIFEST.tier1,
      ...MANIFEST.tier2,
      ...MANIFEST.tier3,
      ...MANIFEST.tier4,
    ];
  }

  if (featureArg) {
    const featureName = featureArg.split('=')[1].toLowerCase();
    targetFiles = targetFiles.filter(f => f.toLowerCase().includes(featureName));
  }

  console.log(`Executing ${targetFiles.length} test target files...`);
  targetFiles.forEach(f => console.log(`  - ${f}`));
  console.log('-----------------------------------------------------------------');

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const vitestArgs = ['vitest', 'run', ...targetFiles];

  const result = spawnSync(npxCmd, vitestArgs, {
    stdio: 'inherit',
    cwd: resolve(process.cwd()),
    env: process.env,
    shell: true,
  });

  return result.status ?? 1;
}

if (process.argv[1] && process.argv[1].includes('runner')) {
  const code = runTests();
  process.exit(code);
}
