#!/usr/bin/env node
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Oneiromancy - Master E2E Test Suite Runner
 * Executes Tier 1 (Features), Tier 2 (Boundaries), Tier 3 (Pairwise), and Tier 4 (Workloads)
 * Using Node.js 22 built-in test runner (node:test).
 */

import './helpers/runner_env.mjs';
import { cleanupRunnerDist } from './helpers/runner_env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.resolve(__dirname, '..'));

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { ensureCompiled } from './loader.mjs';
ensureCompiled();

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { execSync } from 'node:child_process';

import { TIERS } from './tiers.mjs';
export { TIERS };

export function runE2ESuite() {
  console.log(`
================================================================================
           ONEIROMANCY - CELESTIAL DRAFT FRONTEND
                  STANDALONE MASTER E2E TEST RUNNER
================================================================================
Node.js Runtime: ${process.version} (${process.platform} ${process.arch})
Target Environment: Node.js 22 Built-in Test Runner (node:test)
Executing All Tiers: Tier 0 through Tier 9
================================================================================
`);

  const startTime = performance.now();
  const tierStats = new Map();
  for (const t of TIERS) {
    tierStats.set(t.tier, { passed: 0, failed: 0, leafPassed: 0, leafFailed: 0, durationMs: 0 });
  }

  let totalLeafPassed = 0;
  let totalLeafFailed = 0;

  const testStream = run({
    files: TIERS.map((t) => t.file),
    concurrency: 1, // Sequential tier execution for clean telemetry
  });

  testStream.on('test:pass', (t) => {
    const filePath = t.file || '';
    const isLeaf = !t.name.startsWith('Tier ') && !t.name.startsWith('Feature ') && !t.name.startsWith('Boundary ');
    for (const tier of TIERS) {
      if (filePath.includes(path.basename(tier.file))) {
        tierStats.get(tier.tier).passed++;
        if (isLeaf) {
          tierStats.get(tier.tier).leafPassed++;
          totalLeafPassed++;
        }
        tierStats.get(tier.tier).durationMs += t.details?.duration_ms || 0;
        break;
      }
    }
  });

  testStream.on('test:fail', (t) => {
    const filePath = t.file || '';
    const isLeaf = !t.name.startsWith('Tier ') && !t.name.startsWith('Feature ') && !t.name.startsWith('Boundary ');
    for (const tier of TIERS) {
      if (filePath.includes(path.basename(tier.file))) {
        tierStats.get(tier.tier).failed++;
        if (isLeaf) {
          tierStats.get(tier.tier).leafFailed++;
          totalLeafFailed++;
        }
        tierStats.get(tier.tier).durationMs += t.details?.duration_ms || 0;
        break;
      }
    }
  });

  testStream.compose(spec).pipe(process.stdout);

  testStream.on('end', () => {
    const totalDurationMs = (performance.now() - startTime).toFixed(1);

    console.log(`
================================================================================
                        STRUCTURED E2E TEST SUMMARY
================================================================================`);

    console.log(`| ${'Tier'.padEnd(8)} | ${'Category'.padEnd(26)} | ${'Target'.padStart(7)} | ${'Passed'.padStart(7)} | ${'Failed'.padStart(7)} | ${'Duration'.padStart(10)} | ${'Status'.padEnd(8)} |`);
    console.log(`|${'-'.repeat(10)}|${'-'.repeat(28)}|${'-'.repeat(9)}|${'-'.repeat(9)}|${'-'.repeat(9)}|${'-'.repeat(12)}|${'-'.repeat(10)}|`);

    let allTiersPassed = true;
    for (const t of TIERS) {
      const stat = tierStats.get(t.tier);
      const count = stat.leafPassed + stat.leafFailed;
      const passed = stat.leafFailed === 0 && count >= t.expectedMinTests;
      if (!passed) allTiersPassed = false;
      const status = passed ? 'PASSED' : 'FAILED';
      console.log(
        `| ${t.tier.padEnd(8)} | ${t.name.padEnd(26)} | ${String(t.expectedMinTests).padStart(7)} | ${String(stat.leafPassed).padStart(7)} | ${String(stat.leafFailed).padStart(7)} | ${(stat.durationMs.toFixed(1) + 'ms').padStart(10)} | ${status.padEnd(8)} |`
      );
    }

    const overallSuccess = totalLeafFailed === 0 && totalLeafPassed >= 256 && allTiersPassed;
    console.log(`================================================================================`);
    console.log(`OVERALL STATUS:       ${overallSuccess ? 'SUCCESS (ALL TIERS PASSING)' : 'FAILURE'}`);
    console.log(`TOTAL LEAF TESTS:     ${totalLeafPassed} (Required: >=256)`);
    console.log(`TOTAL PASSED:         ${totalLeafPassed}`);
    console.log(`TOTAL FAILED:         ${totalLeafFailed}`);
    console.log(`TOTAL WALL DURATION:  ${totalDurationMs} ms`);
    console.log(`================================================================================\n`);

    cleanupRunnerDist();
    if (!overallSuccess) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runE2ESuite();
}
