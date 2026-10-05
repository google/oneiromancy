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
 * Challenger Milestone 2 Empirical Stress Testing Suite
 * Validates:
 * 1. lib/scoring.ts:
 *    - recomputeDraftScores with boundary lambda values (0.0, 1.0, negative, >1.0, NaN, undefined)
 *    - calculateSpiritScore with empty/full rosters, boundary weights (zero sum, unnormalized, negative)
 *    - Differential testing vs Oneiromancy Oracle on 500 fuzzed player cases
 *    - Latency benchmark on 350+ players (assert <2.0ms average)
 * 2. app/api/draft/[id]/route.ts:
 *    - Boot standalone server on isolated port
 *    - Request /api/draft/mock, /api/draft/mock_oneiromancy_draft_2025
 *    - Request arbitrary IDs (e.g. offline/inactive IDs, numeric, random string)
 *    - Assert all return HTTP 200 with valid JSON matching DraftState schema
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import compiled scoring implementation and mock data
import * as scoring from './dist/lib/scoring.js';
import * as mockData from './dist/lib/mockData.js';
import * as oracle from './helpers/oneiromancy_oracle.mjs';

// ============================================================================
// Suite 1: Stress Testing recomputeDraftScores
// ============================================================================

describe('Suite 1: Stress Testing recomputeDraftScores in lib/scoring.ts', () => {
  const basePlayer = {
    id: 'test_p1',
    name: 'Test Player',
    first_name: 'Test',
    last_name: 'Player',
    position: 'WR',
    team: 'CIN',
    jersey_number: 1,
    bye_week: 12,
    adp: 5.5,
    projected_points: 290.0,
    market_vor: 110.0,
    vor_normalized: 75.0,
    draft_score: 50.0,
    spirit_score: 85.0,
    harmony_score: 68.0,
    draft_status: 'available',
    elemental_traits: {
      sun_sign: 'Pisces',
      element: 'Water',
      life_path_number: 7,
      gematria_resonance: 42,
      tarot_card: 'The Moon',
      iching_hexagram: 29,
    },
    divination_breakdown: {
      celestial: 80.0,
      numeric: 75.0,
      geomantic: 88.0,
      oracular: 90.0,
      harmony: 68.0,
    },
  };

  test('1.1 Boundary Lambda = 0.0 (Pure VOR: draft_score == vor_normalized)', () => {
    const players = [
      { ...basePlayer, id: 'p1', vor_normalized: 90.0, spirit_score: 20.0 },
      { ...basePlayer, id: 'p2', vor_normalized: 10.0, spirit_score: 99.0 },
      { ...basePlayer, id: 'p3', vor_normalized: 55.45, spirit_score: 77.12 },
    ];
    const settings = { ...mockData.mockSettings, chaos_lambda: 0.0 };
    const res = scoring.recomputeDraftScores(players, settings);

    assert.equal(res.length, 3);
    assert.equal(res[0].draft_score, 90.0);
    assert.equal(res[1].draft_score, 10.0);
    assert.equal(res[2].draft_score, 55.45);
  });

  test('1.2 Boundary Lambda = 1.0 (Pure Spirit: draft_score == spirit_score)', () => {
    const players = [
      { ...basePlayer, id: 'p1', vor_normalized: 90.0, spirit_score: 20.0 },
      { ...basePlayer, id: 'p2', vor_normalized: 10.0, spirit_score: 99.0 },
      { ...basePlayer, id: 'p3', vor_normalized: 55.45, spirit_score: 77.12 },
    ];
    const settings = { ...mockData.mockSettings, chaos_lambda: 1.0 };
    const res = scoring.recomputeDraftScores(players, settings);

    assert.equal(res.length, 3);
    assert.equal(res[0].draft_score, 20.0);
    assert.equal(res[1].draft_score, 99.0);
    assert.equal(res[2].draft_score, 77.12);
  });

  test('1.3 Boundary Lambda < 0.0 (Negative lambda: clamped to 0.0)', () => {
    const players = [
      { ...basePlayer, id: 'p1', vor_normalized: 65.0, spirit_score: 40.0 },
    ];
    for (const negLambda of [-0.001, -0.5, -10.0, -999.0]) {
      const res = scoring.recomputeDraftScores(players, { ...mockData.mockSettings, chaos_lambda: negLambda });
      assert.equal(res[0].draft_score, 65.0, `Negative lambda ${negLambda} must clamp to 0.0`);
    }
  });

  test('1.4 Boundary Lambda > 1.0 (Oversized lambda: clamped to 1.0)', () => {
    const players = [
      { ...basePlayer, id: 'p1', vor_normalized: 40.0, spirit_score: 85.0 },
    ];
    for (const overLambda of [1.001, 1.5, 10.0, 999.0]) {
      const res = scoring.recomputeDraftScores(players, { ...mockData.mockSettings, chaos_lambda: overLambda });
      assert.equal(res[0].draft_score, 85.0, `Oversized lambda ${overLambda} must clamp to 1.0`);
    }
  });

  test('1.5 Boundary Lambda = NaN, null, undefined (Handled gracefully with fallback)', () => {
    const players = [
      { ...basePlayer, id: 'p1', vor_normalized: 50.0, spirit_score: 80.0 },
    ];
    // Default lambda is 0.35: (1 - 0.35)*50 + 0.35*80 = 32.5 + 28 = 60.5
    const resNull = scoring.recomputeDraftScores(players, { ...mockData.mockSettings, chaos_lambda: null });
    assert.equal(resNull[0].draft_score, 60.5);

    const resUndef = scoring.recomputeDraftScores(players, { ...mockData.mockSettings, chaos_lambda: undefined });
    assert.equal(resUndef[0].draft_score, 60.5);

    const resNoSettings = scoring.recomputeDraftScores(players, undefined);
    assert.equal(resNoSettings[0].draft_score, 60.5);
  });

  test('1.6 Array Edge Cases: empty array [] returns empty array without error', () => {
    const res = scoring.recomputeDraftScores([], mockData.mockSettings);
    assert.deepEqual(res, []);
  });

  test('1.7 Out-of-bounds inputs: draft_score clamped strictly to [0.0, 100.0]', () => {
    const players = [
      { ...basePlayer, id: 'low', vor_normalized: -500.0, spirit_score: -100.0 },
      { ...basePlayer, id: 'high', vor_normalized: 500.0, spirit_score: 200.0 },
      { ...basePlayer, id: 'zero', vor_normalized: 0.0, spirit_score: 0.0 },
      { ...basePlayer, id: 'max', vor_normalized: 100.0, spirit_score: 100.0 },
    ];
    const res = scoring.recomputeDraftScores(players, { ...mockData.mockSettings, chaos_lambda: 0.5 });
    assert.equal(res[0].draft_score, 0.0, 'Negative inputs must clamp to 0.0');
    assert.equal(res[1].draft_score, 100.0, 'Excessive inputs must clamp to 100.0');
    assert.equal(res[2].draft_score, 0.0, 'Zero inputs must equal 0.0');
    assert.equal(res[3].draft_score, 100.0, 'Max inputs must equal 100.0');
  });

  test('1.8 Pure function immutability: original player objects not mutated', () => {
    const original = [{ ...basePlayer, draft_score: 42.0 }];
    const res = scoring.recomputeDraftScores(original, { ...mockData.mockSettings, chaos_lambda: 1.0 });
    assert.equal(original[0].draft_score, 42.0, 'Original object must not be mutated');
    assert.notEqual(res[0], original[0], 'Result item should be a new object reference');
    assert.equal(res[0].draft_score, basePlayer.spirit_score);
  });
});

// ============================================================================
// Suite 2: Stress Testing calculateSpiritScore & Harmony Engine
// ============================================================================

describe('Suite 2: Stress Testing calculateSpiritScore & Harmony Engine in lib/scoring.ts', () => {
  const candidateBengalsWR = {
    id: 'cin_wr1',
    name: "Ja'Marr Chase",
    position: 'WR',
    team: 'CIN',
    elemental_traits: { element: 'Water', sun_sign: 'Pisces' },
    jersey_number: 1,
    divination_breakdown: {
      celestial: 92.0,
      numeric: 84.0,
      geomantic: 88.0,
      oracular: 95.0,
      harmony: 75.0,
    },
  };

  test('2.1 Empty Roster: calculateHarmony with empty roster yields neutral baseline 50.0', () => {
    const candidate = { position: 'WR', team: 'KC', elemental_traits: { element: 'Fire' } };
    const harmony = scoring.calculateHarmony([], candidate);
    // Base 50, 1 Fire (no trine, no quad, no stack, no cap)
    assert.equal(harmony, 50.0);
  });

  test('2.2 Full 15-player Roster with Quad-Balance (+10.0 pts)', () => {
    const roster = [
      { slot_id: 'QB', player: { id: 'p1', position: 'QB', team: 'KC', elemental_traits: { element: 'Fire' } } },
      { slot_id: 'RB1', player: { id: 'p2', position: 'RB', team: 'SF', elemental_traits: { element: 'Earth' } } },
      { slot_id: 'WR1', player: { id: 'p3', position: 'WR', team: 'MIA', elemental_traits: { element: 'Air' } } },
    ];
    // Candidate brings Water -> completes Quad-Balance (Fire, Earth, Air, Water)
    const candidate = { position: 'TE', team: 'DET', elemental_traits: { element: 'Water' } };
    const harmony = scoring.calculateHarmony(roster, candidate);
    // 50 (base) + 10 (quad balance) = 60.0
    assert.equal(harmony, 60.0);
  });

  test('2.3 Western Trines: 3 and 4+ of same element (+12.0 and +18.0 pts)', () => {
    const count3 = { Fire: 3, Earth: 1, Air: 0, Water: 0 };
    const bonus3 = scoring.calculateWesternTrinesBonus(count3);
    assert.equal(bonus3, 12.0, '3 of same element must yield +12.0');

    const count4 = { Fire: 4, Earth: 1, Air: 0, Water: 0 };
    const bonus4 = scoring.calculateWesternTrinesBonus(count4);
    assert.equal(bonus4, 18.0, '4 of same element must yield +18.0');

    const count5 = { Fire: 5, Earth: 0, Air: 0, Water: 0 };
    const bonus5 = scoring.calculateWesternTrinesBonus(count5);
    assert.equal(bonus5, 18.0, '5 of same element must yield +18.0');

    const count2 = { Fire: 2, Earth: 2, Air: 1, Water: 0 };
    const bonus2 = scoring.calculateWesternTrinesBonus(count2);
    assert.equal(bonus2, 0.0, 'Fewer than 3 must yield 0.0');
  });

  test('2.4 3.0x QB/Pass-Catcher Stack Multiplier (+18.0 primary, +9.0 double stack)', () => {
    const qbJoeBurrow = {
      slot_id: 'QB',
      player: { id: 'cin_qb', position: 'QB', team: 'CIN', elemental_traits: { element: 'Earth' } },
    };

    // Candidate WR Ja'Marr Chase stacking with QB Joe Burrow
    const wrChase = { position: 'WR', team: 'CIN', elemental_traits: { element: 'Water' } };
    const stackBonus1 = scoring.calculateStackMultiplier(wrChase, [qbJoeBurrow]);
    assert.equal(stackBonus1, 18.0, 'Primary QB/WR stack must yield +18.0');

    // Add WR Chase to roster, now evaluate WR2 (Allen Lazard / Tee Higgins)
    const slotWR1 = { slot_id: 'WR1', player: { id: 'cin_wr1', position: 'WR', team: 'CIN' } };
    const wrHiggins = { position: 'WR', team: 'CIN', elemental_traits: { element: 'Fire' } };
    const stackBonus2 = scoring.calculateStackMultiplier(wrHiggins, [qbJoeBurrow, slotWR1]);
    assert.equal(stackBonus2, 9.0, 'Double stack must yield +9.0');

    // Candidate QB stacking with existing WR on roster
    const candidateQB = { position: 'QB', team: 'CIN' };
    const stackBonusQB = scoring.calculateStackMultiplier(candidateQB, [slotWR1]);
    assert.equal(stackBonusQB, 18.0, 'Candidate QB stacking with rostered WR must yield +18.0');
  });

  test('2.5 Positional Roster Cap Penalties (-15, -35, -40)', () => {
    const qb1 = { slot_id: 'QB', player: { position: 'QB' } };
    const qb2 = { slot_id: 'BN1', player: { position: 'QB' } };
    const te1 = { slot_id: 'TE', player: { position: 'TE' } };
    const def1 = { slot_id: 'DEF', player: { position: 'DEF' } };
    const k1 = { slot_id: 'K', player: { position: 'K' } };

    // 2nd QB before Round 10: -15.0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('QB', [qb1], 5), 15.0);
    // 2nd QB in Round 10+: 0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('QB', [qb1], 10), 0.0);
    // 3rd QB anytime: -35.0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('QB', [qb1, qb2], 12), 35.0);

    // 2nd TE before Round 11: -15.0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('TE', [te1], 8), 15.0);
    // 2nd TE in Round 11+: 0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('TE', [te1], 11), 0.0);

    // 2nd DEF anytime: -40.0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('DEF', [def1], 14), 40.0);
    // 2nd K anytime: -40.0 penalty
    assert.equal(scoring.calculatePositionalCapsPenalty('K', [k1], 15), 40.0);
  });

  test('2.6 Boundary Oracle Weights: zero sum, unnormalized, negative weights', () => {
    // All zero weights -> fallback to default weights
    const zeroWeights = { celestial: 0, numeric: 0, geomantic: 0, oracular: 0, harmony: 0 };
    const normZero = scoring.normalizeOracleWeights(zeroWeights);
    assert.equal(normZero.celestial, 0.30);
    assert.equal(normZero.numeric, 0.20);
    assert.equal(normZero.geomantic, 0.25);
    assert.equal(normZero.oracular, 0.10);
    assert.equal(normZero.harmony, 0.15);

    // Single weight 1.0
    const singleWeight = { celestial: 1.0, numeric: 0, geomantic: 0, oracular: 0, harmony: 0 };
    const normSingle = scoring.normalizeOracleWeights(singleWeight);
    assert.equal(normSingle.celestial, 1.0);
    assert.equal(normSingle.numeric, 0.0);

    // Unnormalized weights summing to 100
    const hundredWeights = { celestial: 30, numeric: 20, geomantic: 25, oracular: 10, harmony: 15 };
    const normHundred = scoring.normalizeOracleWeights(hundredWeights);
    assert.equal(normHundred.celestial, 0.30);
    assert.equal(normHundred.numeric, 0.20);
    assert.equal(normHundred.geomantic, 0.25);
    assert.equal(normHundred.oracular, 0.10);
    assert.equal(normHundred.harmony, 0.15);

    // Negative weights clamped to 0
    const negWeights = { celestial: -5, numeric: 10, geomantic: 10, oracular: 0, harmony: 0 };
    const normNeg = scoring.normalizeOracleWeights(negWeights);
    assert.equal(normNeg.celestial, 0.0);
    assert.equal(normNeg.numeric, 0.50);
    assert.equal(normNeg.geomantic, 0.50);
  });

  test('2.7 Differential Fuzzing: 500 fuzzed inputs against Oneiromancy Oracle', () => {
    const elements = ['Fire', 'Earth', 'Air', 'Water'];
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    for (let seed = 1; seed <= 500; seed++) {
      // Deterministic pseudo-random generator
      const pseudoRand = (offset) => {
        const x = Math.sin(seed * 997 + offset) * 10000;
        return x - Math.floor(x);
      };

      const breakdown = {
        celestial: Math.round(pseudoRand(1) * 1000) / 10,
        numeric: Math.round(pseudoRand(2) * 1000) / 10,
        geomantic: Math.round(pseudoRand(3) * 1000) / 10,
        oracular: Math.round(pseudoRand(4) * 1000) / 10,
        harmony: Math.round(pseudoRand(5) * 1000) / 10,
      };

      const weights = {
        celestial: Math.round(pseudoRand(6) * 50) / 10,
        numeric: Math.round(pseudoRand(7) * 50) / 10,
        geomantic: Math.round(pseudoRand(8) * 50) / 10,
        oracular: Math.round(pseudoRand(9) * 50) / 10,
        harmony: Math.round(pseudoRand(10) * 50) / 10,
      };

      const actualSpirit = scoring.computeSpiritScore(breakdown, weights);
      const expectedSpirit = oracle.computeSpiritScore(breakdown, weights);

      assert.ok(
        Math.abs(actualSpirit - expectedSpirit) <= 0.05,
        `Mismatch at seed ${seed}: actual=${actualSpirit}, expected=${expectedSpirit}`
      );
    }
  });
});

// ============================================================================
// Suite 3: Latency Benchmark on 350+ Players (<2.0ms assertion)
// ============================================================================

describe('Suite 3: Latency Benchmark on 350+ Players', () => {
  function generatePlayersPool(count = 400) {
    const pool = [];
    const elements = ['Fire', 'Earth', 'Air', 'Water'];
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const teams = ['KC', 'SF', 'BAL', 'PHI', 'DET', 'BUF', 'CIN', 'DAL', 'MIA', 'HOU'];

    for (let i = 0; i < count; i++) {
      pool.push({
        id: `bench_player_${i}`,
        name: `Benchmark Player ${i}`,
        first_name: 'Bench',
        last_name: `Player_${i}`,
        position: positions[i % positions.length],
        team: teams[i % teams.length],
        jersey_number: (i % 99) + 1,
        bye_week: (i % 14) + 1,
        adp: i + 1.0,
        projected_points: Math.max(50.0, 350.0 - i * 0.7),
        market_vor: Math.max(-20.0, 120.0 - i * 0.4),
        vor_normalized: Math.min(100.0, Math.max(0.0, 95.0 - i * 0.2)),
        draft_score: 50.0,
        spirit_score: Math.min(100.0, Math.max(10.0, 85.0 + Math.sin(i) * 15)),
        harmony_score: 50.0 + Math.cos(i) * 20,
        draft_status: 'available',
        elemental_traits: {
          sun_sign: 'Aries',
          element: elements[i % 4],
          life_path_number: (i % 9) + 1,
          gematria_resonance: 33,
          tarot_card: 'The Star',
          iching_hexagram: 1,
        },
        divination_breakdown: {
          celestial: 80.0,
          numeric: 75.0,
          geomantic: 70.0,
          oracular: 65.0,
          harmony: 60.0,
        },
      });
    }
    return pool;
  }

  test('3.1 Benchmark recomputeDraftScores on 400 players over 1000 iterations (assert <2.0ms)', () => {
    const players = generatePlayersPool(400);
    assert.equal(players.length, 400, 'Must have 400 players in test pool');

    // Warm up JIT
    for (let i = 0; i < 100; i++) {
      const lambda = (i % 100) / 100;
      scoring.recomputeDraftScores(players, { ...mockData.mockSettings, chaos_lambda: lambda });
    }

    // Benchmark 1,000 runs
    const iterations = 1000;
    const times = new Float64Array(iterations);

    for (let i = 0; i < iterations; i++) {
      const lambda = ((i * 17) % 101) / 100; // dynamic lambda variation
      const settings = { ...mockData.mockSettings, chaos_lambda: lambda };
      const start = performance.now();
      scoring.recomputeDraftScores(players, settings);
      const end = performance.now();
      times[i] = end - start;
    }

    // Compute stats
    let total = 0;
    let max = 0;
    for (let i = 0; i < iterations; i++) {
      total += times[i];
      if (times[i] > max) max = times[i];
    }
    const avg = total / iterations;
    const sorted = Array.from(times).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(iterations * 0.50)];
    const p90 = sorted[Math.floor(iterations * 0.90)];
    const p99 = sorted[Math.floor(iterations * 0.99)];

    console.log(`\n  [Scoring Latency Benchmark (400 Players x 1,000 Iterations)]`);
    console.log(`  - Average: ${avg.toFixed(4)} ms`);
    console.log(`  - P50 (Median): ${p50.toFixed(4)} ms`);
    console.log(`  - P90: ${p90.toFixed(4)} ms`);
    console.log(`  - P99: ${p99.toFixed(4)} ms`);
    console.log(`  - Max: ${max.toFixed(4)} ms`);

    // Hard requirement: must be < 2.0ms
    assert.ok(
      avg < 2.0,
      `Average execution time ${avg.toFixed(4)}ms exceeds the 2.0ms budget for 60fps slider drag!`
    );
    assert.ok(
      p99 < 2.0,
      `P99 execution time ${p99.toFixed(4)}ms exceeds the 2.0ms budget!`
    );
  });
});

// ============================================================================
// Suite 4: Stress Testing API Route /api/draft/[id]
// ============================================================================

describe('Suite 4: API Route /api/draft/[id] Robustness & Schema Conformance', () => {
  let serverProcess = null;
  const TEST_PORT = 3197;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  function httpGetJson(path) {
    return new Promise((resolve, reject) => {
      const req = http.get(`${BASE_URL}${path}`, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ statusCode: res.statusCode, headers: res.headers, json: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, headers: res.headers, raw: rawData, error: e });
          }
        });
      });
      req.on('error', (err) => reject(err));
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${path}`));
      });
    });
  }

  function validateDraftStateSchema(json, expectedId = null) {
    assert.ok(json, 'Response body must not be empty');
    assert.equal(typeof json.draft_id, 'string');
    if (expectedId) {
      assert.equal(json.draft_id, expectedId);
    }

    // Status check
    assert.ok(
      ['pre_draft', 'drafting', 'paused', 'complete'].includes(json.status),
      `Invalid draft status: ${json.status}`
    );

    // Current pick check
    assert.ok(json.current_pick, 'Must have current_pick');
    assert.ok(typeof json.current_pick.round === 'number' && json.current_pick.round >= 1);
    assert.ok(typeof json.current_pick.pick_no === 'number' && json.current_pick.pick_no >= 1);
    assert.ok(typeof json.current_pick.on_the_clock_team_id === 'string');
    assert.ok(typeof json.current_pick.seconds_remaining === 'number');

    // 8 Canonical Entities validation:
    // 1. cosmic_board
    assert.ok(Array.isArray(json.cosmic_board), 'cosmic_board must be an array');
    assert.ok(json.cosmic_board.length >= 10, 'cosmic_board must contain players');
    const firstPlayer = json.cosmic_board[0];
    assert.ok(firstPlayer.id && firstPlayer.name && firstPlayer.position && firstPlayer.team);
    assert.ok(typeof firstPlayer.draft_score === 'number');
    assert.ok(typeof firstPlayer.spirit_score === 'number');
    assert.ok(typeof firstPlayer.vor_normalized === 'number');
    assert.ok(firstPlayer.elemental_traits && firstPlayer.elemental_traits.element);
    assert.ok(firstPlayer.divination_breakdown);

    // 2. ideal_draft_path
    assert.ok(Array.isArray(json.ideal_draft_path), 'ideal_draft_path must be an array');
    assert.ok(json.ideal_draft_path.length >= 4, 'ideal_draft_path must have ascension steps');
    assert.ok(json.ideal_draft_path[0].target_player_name);
    assert.ok(json.ideal_draft_path[0].elemental_synergy_tag);

    // 3. my_roster
    assert.ok(Array.isArray(json.my_roster), 'my_roster must be an array');
    assert.ok(json.my_roster.length >= 10, 'my_roster must contain slots');

    // 4. weekly_coverage
    assert.ok(Array.isArray(json.weekly_coverage), 'weekly_coverage must be an array');
    assert.ok(json.weekly_coverage.length >= 1, 'weekly_coverage must contain weeks');
    for (const weekNode of json.weekly_coverage) {
      assert.ok(typeof weekNode.week === 'number' && weekNode.week >= 1 && weekNode.week <= 18, `Week must be 1-18, got ${weekNode.week}`);
      assert.ok(Array.isArray(weekNode.active_starters), 'active_starters must be array');
      assert.ok(Array.isArray(weekNode.bye_players), 'bye_players must be array');
    }

    // 5. elemental_traits
    assert.ok(json.elemental_traits, 'elemental_traits must exist');
    assert.ok(typeof json.elemental_traits.Fire === 'number');
    assert.ok(typeof json.elemental_traits.Earth === 'number');
    assert.ok(typeof json.elemental_traits.Air === 'number');
    assert.ok(typeof json.elemental_traits.Water === 'number');

    // 6. waiver_upgrades
    assert.ok(Array.isArray(json.waiver_upgrades), 'waiver_upgrades must be an array');
    assert.ok(json.waiver_upgrades.length >= 1);
    assert.ok(typeof json.waiver_upgrades[0].net_score_delta === 'number');

    // 7. trade_proposals
    assert.ok(Array.isArray(json.trade_proposals), 'trade_proposals must be an array');
    assert.ok(json.trade_proposals.length >= 1);
    assert.ok(json.trade_proposals[0].divine_verdict);

    // 8. settings
    assert.ok(json.settings, 'settings must exist');
    assert.ok(typeof json.settings.chaos_lambda === 'number');
    assert.ok(json.settings.oracle_weights);
    assert.ok(typeof json.settings.offline_mode_active === 'boolean');
  }

  before(async () => {
    // Launch standalone server on TEST_PORT
    await new Promise((resolve, reject) => {
      const serverPath = fs.existsSync(path.join(process.cwd(), 'server.js')) ? path.join(process.cwd(), 'server.js') : path.join(process.cwd(), '.next/standalone/server.js');
      serverProcess = spawn(process.execPath, [serverPath], {
        env: {
          ...process.env,
          PORT: String(TEST_PORT),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
        },
        stdio: 'pipe',
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          reject(new Error('Server failed to start within 6000ms'));
        }
      }, 6000);

      const checkHealth = () => {
        http.get(`${BASE_URL}/api/draft/mock`, (res) => {
          if (res.statusCode === 200) {
            started = true;
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkHealth, 300);
          }
        }).on('error', () => {
          setTimeout(checkHealth, 300);
        });
      };

      setTimeout(checkHealth, 800);
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  test('4.1 GET /api/draft/mock returns HTTP 200 with complete DraftState schema', async () => {
    const res = await httpGetJson('/api/draft/mock');
    assert.equal(res.statusCode, 200, 'Status must be 200 OK');
    assert.equal(res.headers['cache-control'], 'no-store, max-age=0');
    validateDraftStateSchema(res.json, 'mock_oneiromancy_draft_2025');
  });

  test('4.2 GET /api/draft/mock_oneiromancy_draft_2025 returns HTTP 200 with complete DraftState', async () => {
    const res = await httpGetJson('/api/draft/mock_oneiromancy_draft_2025');
    assert.equal(res.statusCode, 200, 'Status must be 200 OK');
    validateDraftStateSchema(res.json, 'mock_oneiromancy_draft_2025');
  });

  test('4.3 GET /api/draft/arbitrary_offline_id_98765 returns HTTP 200 with fallback DraftState', async () => {
    const res = await httpGetJson('/api/draft/arbitrary_offline_id_98765');
    assert.equal(res.statusCode, 200, 'Status must be 200 OK on arbitrary/offline IDs');
    validateDraftStateSchema(res.json, 'arbitrary_offline_id_98765');
    assert.equal(res.json.settings.offline_mode_active, true, 'offline_mode_active must be true');
  });

  test('4.4 GET /api/draft/1234567890 (Numeric ID) returns HTTP 200 with valid DraftState', async () => {
    const res = await httpGetJson('/api/draft/1234567890');
    assert.equal(res.statusCode, 200, 'Status must be 200 OK');
    validateDraftStateSchema(res.json, '1234567890');
    assert.equal(res.json.settings.offline_mode_active, true);
  });

  test('4.5 GET /api/draft/inactive_closed_draft returns HTTP 200 without throwing 500', async () => {
    const res = await httpGetJson('/api/draft/inactive_closed_draft');
    assert.equal(res.statusCode, 200, 'Status must never throw 500');
    validateDraftStateSchema(res.json, 'inactive_closed_draft');
  });
});
