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

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.resolve(__dirname, '..'));

const TIERS = [
  {
    tier: 'Tier 0',
    name: 'Architectural Invariants & Leakage Verification',
    file: path.join(__dirname, 'architecture_invariants.test.mjs'),
    expectedMinTests: 5,
    description: '5 mechanical acceptance criteria: zero mock IDs, forward favorability calculation, no dist tree, atomic state recomputation, live error propagation',
  },
  {
    tier: 'Tier 1',
    name: 'Feature Coverage',
    file: path.join(__dirname, 'tier1_features.test.mjs'),
    expectedMinTests: 95,
    description: '19 features x >=5 tests per feature covering visual tokens, UI, API, math, and deployment',
  },
  {
    tier: 'Tier 2',
    name: 'Boundary & Corner Cases',
    file: path.join(__dirname, 'tier2_boundaries.test.mjs'),
    expectedMinTests: 95,
    description: '19 boundary groups x 5 cases: lambda extremes, empty roster, negative VOR, 0s pick clock, rate limits',
  },
  {
    tier: 'Tier 3',
    name: 'Cross-Feature Interactions',
    file: path.join(__dirname, 'tier3_pairwise.test.mjs'),
    expectedMinTests: 19,
    description: '>=19 pairwise state interactions: lambda re-ranking, 3.0x QB stacks, poller deltas, mock fallback',
  },
  {
    tier: 'Tier 4',
    name: 'Real-World Scenarios',
    file: path.join(__dirname, 'tier4_workloads.test.mjs'),
    expectedMinTests: 10,
    description: '>=10 full draft workloads: 15-round mock simulation, Cincinnati Trinity, waiver upgrade, Divine Swap',
  },
  {
    tier: 'Tier 5',
    name: 'Real-World Sleeper Fixtures',
    file: path.join(__dirname, 'real_sleeper_fixtures.test.mjs'),
    expectedMinTests: 15,
    description: '17 tests validating real data transformation, dynamic league resolution, rate limits, and fallback against authentic Sleeper API fixtures',
  },
  {
    tier: 'Tier 6',
    name: 'Component Identity Audit',
    file: path.join(__dirname, 'component_identity_audit.test.mjs'),
    expectedMinTests: 15,
    description: '15 tests validating single global YOU, zero persona collisions, and exact UI alignment across competitor teams, matchups, leaderboard graph, and OneiromancyContext',
  },
  {
    tier: 'Tier 7',
    name: 'Offline MSW Interception',
    file: path.join(__dirname, 'msw_network.test.mjs'),
    expectedMinTests: 5,
    description: 'MSW offline interceptors ensuring zero network egress',
  },
  {
    tier: 'Tier 8',
    name: 'React Component Suite',
    file: path.join(__dirname, 'component_suite.test.mjs'),
    expectedMinTests: 17,
    description: 'React Component testing with pure RTL asserts',
  },
  {
    tier: 'Tier 9',
    name: 'Live Sleeper Matchup Audit',
    file: path.join(__dirname, 'live_sleeper_matchup_audit.test.mjs'),
    expectedMinTests: 15,
    description: 'Authentic Sleeper API matchup derivation, multi-user switching, starter projected points and 4-factor favorability',
  },
];

console.log(`
================================================================================
           ONEIROMANCY — CELESTIAL DRAFT FRONTEND
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

  for (const t of TIERS) {
    const stat = tierStats.get(t.tier);
    const count = stat.leafPassed + stat.leafFailed;
    const status = stat.leafFailed === 0 && count >= t.expectedMinTests ? 'PASSED' : 'FAILED';
    console.log(
      `| ${t.tier.padEnd(8)} | ${t.name.padEnd(26)} | ${String(t.expectedMinTests).padStart(7)} | ${String(stat.leafPassed).padStart(7)} | ${String(stat.leafFailed).padStart(7)} | ${(stat.durationMs.toFixed(1) + 'ms').padStart(10)} | ${status.padEnd(8)} |`
    );
  }

  console.log(`================================================================================`);
  console.log(`OVERALL STATUS:       ${totalLeafFailed === 0 && totalLeafPassed >= 256 ? 'SUCCESS (ALL TIERS PASSING)' : 'FAILURE'}`);
  console.log(`TOTAL LEAF TESTS:     ${totalLeafPassed} (Required: >=256)`);
  console.log(`TOTAL PASSED:         ${totalLeafPassed}`);
  console.log(`TOTAL FAILED:         ${totalLeafFailed}`);
  console.log(`TOTAL WALL DURATION:  ${totalDurationMs} ms`);
  console.log(`================================================================================\n`);

  if (totalLeafFailed > 0 || totalLeafPassed < 256) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
