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

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TIERS = [
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
  {
    tier: 'Tier 10',
    name: 'Oracle Model & Recommendations',
    file: path.join(__dirname, 'oracle_model.test.mjs'),
    expectedMinTests: 20,
    description: 'Stats/Stars/Oracle model, owner defaults, lineup/waiver/trade rules, harmony breakdown, star weights, mock honesty',
  },
];
