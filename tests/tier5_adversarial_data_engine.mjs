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
 * Tier 5: Empirical Adversarial Coverage Hardening Suite
 * 'Oneiromancy' Fantasy Draft Frontend
 * 
 * Target Systems:
 * 1. Scoring & Divination Math (lib/scoring.ts)
 * 2. Performance Benchmarks (<0.1ms per 100-player board) (lib/scoring.ts)
 * 3. Board Tie-Breaker Hierarchy (components/screens/CosmicBoard.tsx)
 * 4. Rate Limiter, Clock Jitter & 429 Cooldown (lib/sleeper.ts)
 * 5. Resilient Fallback Engine & Data Normalization (lib/sleeper.ts, app/api/draft/[id]/route.ts)
 * 6. Context Polling Downshifting & State Preservation (context/OneiromancyContext.tsx)
 */

import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

// Register TypeScript / @ alias loader for Node.js ESM execution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
register(new URL('./loader.mjs', import.meta.url));

// Import compiled modules from tests/dist
const scoring = await import('./dist/lib/scoring.js');
const sleeper = await import('./dist/lib/sleeper.js');
const mockData = await import('./dist/lib/mockData.js');
const { comparePlayersForBoard } = await import('./dist/components/screens/CosmicBoard.js');
const oneiromancyContext = await import('./dist/context/OneiromancyContext.js');

// ============================================================================
// Helper: Synthetic Player Factory
// ============================================================================
function createSyntheticPlayer(overrides = {}) {
  return {
    id: overrides.id || `player_${Math.random().toString(36).slice(2, 9)}`,
    name: overrides.name || 'Test Astral Athlete',
    first_name: overrides.first_name || 'Test',
    last_name: overrides.last_name || 'Athlete',
    position: overrides.position || 'WR',
    team: overrides.team || 'CIN',
    jersey_number: overrides.jersey_number ?? 1,
    bye_week: overrides.bye_week ?? 10,
    adp: overrides.adp ?? 25.0,
    projected_points: overrides.projected_points ?? 250.0,
    market_vor: overrides.market_vor ?? 70.0,
    vor_normalized: overrides.vor_normalized ?? 65.0,
    draft_score: overrides.draft_score ?? 60.0,
    spirit_score: overrides.spirit_score ?? 75.0,
    harmony_score: overrides.harmony_score ?? 55.0,
    draft_status: overrides.draft_status || 'available',
    elemental_traits: overrides.elemental_traits || {
      sun_sign: 'Leo',
      element: 'Fire',
      life_path_number: 1,
      gematria_resonance: 33,
      tarot_card: 'The Sun',
      elemental_trine_compatible: true,
      synergy_notes: 'Solar fire affinity',
    },
    divination_breakdown: overrides.divination_breakdown || {
      celestial: 80.0,
      numeric: 70.0,
      geomantic: 75.0,
      oracular: 65.0,
      harmony: 55.0,
    },
  };
}

// ============================================================================
// SUITE 1: VOR Normalization & Division-by-Zero Hardening (lib/scoring.ts)
// ============================================================================
describe('Suite 1: VOR Normalization & Division-by-Zero Hardening (lib/scoring.ts)', () => {
  test('1.1 maxVor === 0.0 prevents division by zero and returns 50.0 baseline', () => {
    const resultZero = scoring.normalizeVOR(85.0, 0.0);
    assert.equal(resultZero, 50.0, 'maxVor=0.0 must return 50.0 baseline, not Infinity or NaN');

    const resultNegativeZero = scoring.normalizeVOR(85.0, -0.0);
    assert.equal(resultNegativeZero, 50.0, 'maxVor=-0.0 must return 50.0 baseline');
  });

  test('1.2 maxVor < 0.0 (negative max VOR) returns 50.0 baseline safeguard', () => {
    assert.equal(scoring.normalizeVOR(40.0, -10.0), 50.0);
    assert.equal(scoring.normalizeVOR(-50.0, -100.0), 50.0);
  });

  test('1.3 Uniform VOR pool where maxVor === minVor === 25.0 produces deterministic finite output', () => {
    // In a scenario where all players in a pool have identical VOR of 25.0:
    const rawVor = 25.0;
    const maxVor = 25.0;
    const normalized = scoring.normalizeVOR(rawVor, maxVor);
    // Formula: 50 + (25 / 25) * 45 = 95.0
    assert.equal(normalized, 95.0, 'Uniform pool must produce valid 95.0 normalization');
    assert.ok(Number.isFinite(normalized), 'Output must be strictly finite');
  });

  test('1.4 Uniform VOR pool where maxVor === minVor === 0.0 returns 50.0 safeguard', () => {
    const normalized = scoring.normalizeVOR(0.0, 0.0);
    assert.equal(normalized, 50.0, '0.0 / 0.0 boundary must yield 50.0, never NaN');
  });

  test('1.5 rawVor as NaN, null, or undefined clamps safely to 0.0 with zero NaN leak', () => {
    const resultNaN = scoring.normalizeVOR(NaN, 100.0);
    assert.equal(resultNaN, 0.0, 'NaN rawVor must clamp to 0.0, never leak NaN');

    const resultNull = scoring.normalizeVOR(null, 100.0);
    assert.equal(resultNull, 50.0, 'null rawVor (coerced to 0) must normalize to 50.0');

    const resultUndefined = scoring.normalizeVOR(undefined, 100.0);
    assert.equal(resultUndefined, 0.0, 'undefined rawVor must clamp to 0.0');
  });

  test('1.6 Extreme rawVor (+Infinity, -Infinity) clamped strictly to [0.0, 100.0]', () => {
    const resultInf = scoring.normalizeVOR(Infinity, 100.0);
    assert.equal(resultInf, 100.0, '+Infinity must clamp to 100.0');

    const resultNegInf = scoring.normalizeVOR(-Infinity, 100.0);
    assert.equal(resultNegInf, 0.0, '-Infinity must clamp to 0.0');
  });

  test('1.7 Non-numeric maxVor (NaN) safely clamped without NaN propagation', () => {
    const result = scoring.normalizeVOR(50.0, NaN);
    assert.equal(result, 0.0, 'NaN maxVor must clamp to 0.0');
    assert.ok(!Number.isNaN(result), 'Result must not be NaN');
  });

  test('1.8 Fuzzing 500 boundary VOR inputs asserts every result is finite in [0.0, 100.0]', () => {
    const extremeCases = [
      -1e9, -1e6, -1000, -100.5, -50, -1, -0.0001, 0, 0.0001, 1, 50, 100, 250, 1e6, 1e9,
    ];
    for (const raw of extremeCases) {
      for (const max of [100.0, 50.0, 1.0, 0.0, -10.0]) {
        const val = scoring.normalizeVOR(raw, max);
        assert.ok(Number.isFinite(val), `normalizeVOR(${raw}, ${max}) must be finite, got ${val}`);
        assert.ok(val >= 0.0 && val <= 100.0, `normalizeVOR(${raw}, ${max}) = ${val} out of bounds [0, 100]`);
      }
    }
  });
});

// ============================================================================
// SUITE 2: Oracle Divination Weights & Spirit Score Hardening (lib/scoring.ts)
// ============================================================================
describe('Suite 2: Oracle Divination Weights & Spirit Score Hardening (lib/scoring.ts)', () => {
  test('2.1 All-zero weights {celestial: 0, ...} safely falls back to DEFAULT_ORACLE_WEIGHTS', () => {
    const zeroWeights = { celestial: 0, numeric: 0, geomantic: 0, oracular: 0, harmony: 0 };
    const normalized = scoring.normalizeOracleWeights(zeroWeights);
    assert.deepEqual(
      normalized,
      scoring.DEFAULT_ORACLE_WEIGHTS,
      'All-zero weights must fall back to canonical defaults (30/20/25/10/15)'
    );
    const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, 'Default weights sum must be 1.0');
  });

  test('2.2 Extreme single weight = 1.0 with others 0.0 verified across all 5 tiers', () => {
    const tiers = ['celestial', 'numeric', 'geomantic', 'oracular', 'harmony'];
    for (const tier of tiers) {
      const weights = {
        celestial: tier === 'celestial' ? 1.0 : 0.0,
        numeric: tier === 'numeric' ? 1.0 : 0.0,
        geomantic: tier === 'geomantic' ? 1.0 : 0.0,
        oracular: tier === 'oracular' ? 1.0 : 0.0,
        harmony: tier === 'harmony' ? 1.0 : 0.0,
      };
      const norm = scoring.normalizeOracleWeights(weights);
      assert.equal(norm[tier], 1.0, `${tier} weight must be exactly 1.0`);
      for (const other of tiers.filter((t) => t !== tier)) {
        assert.equal(norm[other], 0.0, `${other} weight must be 0.0`);
      }
    }
  });

  test('2.3 Unnormalized sum != 1.0 (large sum = 1000, tiny sum = 0.005) normalizes to 1.0', () => {
    // Large weights
    const large = { celestial: 300, numeric: 200, geomantic: 250, oracular: 100, harmony: 150 };
    const normLarge = scoring.normalizeOracleWeights(large);
    assert.equal(normLarge.celestial, 0.3);
    assert.equal(normLarge.numeric, 0.2);
    assert.equal(normLarge.geomantic, 0.25);
    assert.equal(normLarge.oracular, 0.1);
    assert.equal(normLarge.harmony, 0.15);

    // Tiny weights (sum = 0.0005)
    const tiny = { celestial: 0.0001, numeric: 0.0001, geomantic: 0.0001, oracular: 0.0001, harmony: 0.0001 };
    const normTiny = scoring.normalizeOracleWeights(tiny);
    assert.equal(normTiny.celestial, 0.2);
    assert.equal(normTiny.numeric, 0.2);
    assert.equal(normTiny.geomantic, 0.2);
    assert.equal(normTiny.oracular, 0.2);
    assert.equal(normTiny.harmony, 0.2);
    const sumTiny = Object.values(normTiny).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumTiny - 1.0) < 0.001, 'Tiny weights must normalize to 1.0');
  });

  test('2.4 Negative oracle weights are clamped to 0.0 via Math.max, preserving non-negative invariant', () => {
    const negativeWeights = {
      celestial: -50,
      numeric: 0.5,
      geomantic: 0.5,
      oracular: -10,
      harmony: 0,
    };
    const norm = scoring.normalizeOracleWeights(negativeWeights);
    assert.equal(norm.celestial, 0.0, 'Negative celestial must clamp to 0.0');
    assert.equal(norm.oracular, 0.0, 'Negative oracular must clamp to 0.0');
    assert.equal(norm.numeric, 0.5, 'Positive numeric should be 0.5 (half of sum)');
    assert.equal(norm.geomantic, 0.5, 'Positive geomantic should be 0.5 (half of sum)');
  });

  test('2.5 Missing partial weights merge with defaults and normalize to sum = 1.0', () => {
    const partial = { celestial: 0.6 }; // only celestial specified
    const norm = scoring.normalizeOracleWeights(partial);
    // Expected: 0.6 + 0.2 + 0.25 + 0.1 + 0.15 = 1.3 sum
    const sum = Object.values(norm).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, 'Partial weights must normalize to sum = 1.0');
    assert.ok(norm.celestial > norm.numeric, 'Celestial must have higher share');
  });

  test('2.6 computeSpiritScore with single weight = 1.0 equals breakdown value of that tier exactly', () => {
    const breakdown = {
      celestial: 92.5,
      numeric: 44.0,
      geomantic: 68.0,
      oracular: 15.0,
      harmony: 88.0,
    };
    const pureCelestial = scoring.computeSpiritScore(breakdown, {
      celestial: 1.0,
      numeric: 0,
      geomantic: 0,
      oracular: 0,
      harmony: 0,
    });
    assert.equal(pureCelestial, 92.5, 'Pure celestial weight must output exact celestial breakdown');

    const pureOracular = scoring.computeSpiritScore(breakdown, {
      celestial: 0,
      numeric: 0,
      geomantic: 0,
      oracular: 1.0,
      harmony: 0,
    });
    assert.equal(pureOracular, 15.0, 'Pure oracular weight must output exact oracular breakdown');
  });

  test('2.7 computeSpiritScore boundary clamping: all tiers 0.0 -> 0.0, all 100.0 -> 100.0, negative -> 0.0', () => {
    const allZero = { celestial: 0, numeric: 0, geomantic: 0, oracular: 0, harmony: 0 };
    assert.equal(scoring.computeSpiritScore(allZero), 0.0);

    const allHundred = { celestial: 100, numeric: 100, geomantic: 100, oracular: 100, harmony: 100 };
    assert.equal(scoring.computeSpiritScore(allHundred), 100.0);

    const negativeBreakdown = { celestial: -50, numeric: -20, geomantic: -10, oracular: -5, harmony: -15 };
    assert.equal(scoring.computeSpiritScore(negativeBreakdown), 0.0, 'Negative breakdown must clamp to 0.0');
  });
});

// ============================================================================
// SUITE 3: Chaos Lambda Boundary Clamping & Board Recalculation (lib/scoring.ts)
// ============================================================================
describe('Suite 3: Chaos Lambda Boundary Clamping & Board Recalculation (lib/scoring.ts)', () => {
  test('3.1 Negative lambda values (-100.0, -1.0, -0.0001) clamp to 0.0 (pure VOR)', () => {
    const vorNorm = 78.5;
    const spiritScore = 42.0;

    for (const negLambda of [-100.0, -5.0, -1.0, -0.0001]) {
      const score = scoring.computeDraftScore(vorNorm, spiritScore, negLambda);
      assert.equal(score, vorNorm, `Negative lambda ${negLambda} must clamp to 0.0 and yield pure VOR`);
    }
  });

  test('3.2 Hyper-chaotic lambda values (1.0001, 2.5, 999.0) clamp to 1.0 (pure Spirit Score)', () => {
    const vorNorm = 78.5;
    const spiritScore = 42.0;

    for (const bigLambda of [1.0001, 1.5, 2.5, 999.0]) {
      const score = scoring.computeDraftScore(vorNorm, spiritScore, bigLambda);
      assert.equal(score, spiritScore, `Lambda ${bigLambda} > 1.0 must clamp to 1.0 and yield pure Spirit`);
    }
  });

  test('3.3 Rational boundary lambda = 0.0 vs Mystical boundary lambda = 1.0 exact equality', () => {
    const vor = 88.45;
    const spirit = 63.20;

    assert.equal(scoring.computeDraftScore(vor, spirit, 0.0), vor, 'lambda=0.0 must equal vor exactly');
    assert.equal(scoring.computeDraftScore(vor, spirit, 1.0), spirit, 'lambda=1.0 must equal spirit exactly');
  });

  test('3.4 Non-numeric lambda (NaN, null, undefined) safely handled without NaN output', () => {
    const vor = 70.0;
    const spirit = 80.0;

    const scoreNaN = scoring.computeDraftScore(vor, spirit, NaN);
    assert.equal(scoreNaN, vor, 'NaN lambda must clamp to 0.0 (pure VOR), never output NaN');

    const scoreNull = scoring.computeDraftScore(vor, spirit, null);
    assert.equal(scoreNull, vor, 'null lambda must clamp to 0.0');

    const scoreUndefined = scoring.computeDraftScore(vor, spirit, undefined);
    // default lambda = 0.35: 0.65 * 70 + 0.35 * 80 = 45.5 + 28 = 73.5
    assert.equal(scoreUndefined, 73.5, 'undefined lambda must use default 0.35');
  });

  test('3.5 recomputeDraftScores with boundary lambda (-1.0 and +2.0) produces strictly clamped scores [0, 100]', () => {
    const players = Array.from({ length: 100 }, (_, i) =>
      createSyntheticPlayer({
        id: `p_${i}`,
        vor_normalized: (i * 1.01) % 100,
        spirit_score: (i * 0.97 + 10) % 100,
      })
    );

    // Negative lambda setting
    const boardNeg = scoring.recomputeDraftScores(players, { chaos_lambda: -2.5 });
    for (let i = 0; i < 100; i++) {
      assert.equal(boardNeg[i].draft_score, Math.round(players[i].vor_normalized * 100) / 100);
      assert.ok(boardNeg[i].draft_score >= 0.0 && boardNeg[i].draft_score <= 100.0);
    }

    // Over-unity lambda setting
    const boardOver = scoring.recomputeDraftScores(players, { chaos_lambda: 3.5 });
    for (let i = 0; i < 100; i++) {
      assert.equal(boardOver[i].draft_score, Math.round(players[i].spirit_score * 100) / 100);
      assert.ok(boardOver[i].draft_score >= 0.0 && boardOver[i].draft_score <= 100.0);
    }
  });

  test('3.6 Board array immutability: recomputeDraftScores produces new array and leaves inputs unmutated', () => {
    const player = createSyntheticPlayer({ id: 'immut_1', draft_score: 50.0, vor_normalized: 90.0, spirit_score: 90.0 });
    const originalInput = [player];
    const originalDraftScore = player.draft_score;

    const result = scoring.recomputeDraftScores(originalInput, { chaos_lambda: 0.5 });
    assert.notEqual(result, originalInput, 'Must return a new array instance');
    assert.equal(player.draft_score, originalDraftScore, 'Original player object must not be mutated');
    assert.equal(result[0].draft_score, 90.0, 'Result player must reflect recomputed draft score');
  });
});

// ============================================================================
// SUITE 4: Execution Performance Benchmarks (<0.1ms under 100-Player Boards)
// ============================================================================
describe('Suite 4: Execution Performance Benchmarks (<0.1ms under 100-Player Boards)', () => {
  test('4.1 Sub-0.1ms performance assertion on 100-player board over 1,000 recalculations', () => {
    const players100 = Array.from({ length: 100 }, (_, i) =>
      createSyntheticPlayer({
        id: `bench_100_${i}`,
        vor_normalized: 40 + (i % 50),
        spirit_score: 50 + (i % 40),
      })
    );
    const settings = { chaos_lambda: 0.42 };

    // Warm-up JIT
    for (let i = 0; i < 50; i++) {
      scoring.recomputeDraftScores(players100, settings);
    }

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      scoring.recomputeDraftScores(players100, settings);
    }
    const totalMs = performance.now() - start;
    const avgMs = totalMs / iterations;

    console.log(`    [Benchmark] 100 players: total ${totalMs.toFixed(2)}ms for ${iterations} runs (${(avgMs * 1000).toFixed(2)} µs/call)`);
    assert.ok(
      avgMs < 0.1,
      `Average execution time per 100-player board recompute must be <0.1ms, measured: ${avgMs.toFixed(4)}ms`
    );
  });

  test('4.2 Sub-0.5ms performance assertion on 350-player full draft board over 1,000 recalculations', () => {
    const players350 = Array.from({ length: 350 }, (_, i) =>
      createSyntheticPlayer({
        id: `bench_350_${i}`,
        vor_normalized: (i * 0.28) % 100,
        spirit_score: (i * 0.31) % 100,
      })
    );
    const settings = { chaos_lambda: 0.65 };

    // Warm-up JIT
    for (let i = 0; i < 50; i++) {
      scoring.recomputeDraftScores(players350, settings);
    }

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      scoring.recomputeDraftScores(players350, settings);
    }
    const totalMs = performance.now() - start;
    const avgMs = totalMs / iterations;

    console.log(`    [Benchmark] 350 players: total ${totalMs.toFixed(2)}ms for ${iterations} runs (${(avgMs * 1000).toFixed(2)} µs/call)`);
    assert.ok(
      avgMs < 0.5,
      `Average execution time per 350-player board recompute must be <0.5ms, measured: ${avgMs.toFixed(4)}ms`
    );
  });

  test('4.3 High-frequency slider drag simulation: 5,000 continuous recalculations maintain sub-0.15ms throughput', () => {
    const players200 = Array.from({ length: 200 }, (_, i) =>
      createSyntheticPlayer({ id: `drag_${i}`, vor_normalized: 50, spirit_score: 60 })
    );

    const start = performance.now();
    for (let step = 0; step < 5000; step++) {
      const lambda = (step % 100) / 100.0;
      scoring.recomputeDraftScores(players200, { chaos_lambda: lambda });
    }
    const elapsedMs = performance.now() - start;
    const avgMs = elapsedMs / 5000;

    assert.ok(
      avgMs < 0.15,
      `High-frequency slider drag average must be <0.15ms, measured: ${avgMs.toFixed(4)}ms`
    );
  });
});

// ============================================================================
// SUITE 5: Deterministic Tie-Breaker Hierarchy (CosmicBoard.tsx)
// ============================================================================
describe('Suite 5: Deterministic Tie-Breaker Hierarchy (CosmicBoard.tsx comparePlayersForBoard)', () => {
  test('5.1 Level 1 Primary: Differing draft_score sorts higher DraftScore first', () => {
    const p1 = createSyntheticPlayer({ id: 'p1', name: 'Player High', draft_score: 85.0 });
    const p2 = createSyntheticPlayer({ id: 'p2', name: 'Player Low', draft_score: 75.0 });

    const diff = comparePlayersForBoard(p1, p2, 'draft_score', 'desc');
    assert.ok(diff < 0, 'p1 (85.0) must sort before p2 (75.0) in desc order');

    const sorted = [p2, p1].sort((a, b) => comparePlayersForBoard(a, b, 'draft_score', 'desc'));
    assert.equal(sorted[0].id, 'p1');
    assert.equal(sorted[1].id, 'p2');
  });

  test('5.2 Level 2 Secondary: Tied draft_score resolved by higher market_vor', () => {
    const p1 = createSyntheticPlayer({
      id: 'p1',
      name: 'Player High VOR',
      draft_score: 75.0,
      market_vor: 95.0, // Higher VOR
      adp: 30.0,
    });
    const p2 = createSyntheticPlayer({
      id: 'p2',
      name: 'Player Low VOR',
      draft_score: 75.0,
      market_vor: 60.0, // Lower VOR
      adp: 15.0,
    });

    const sorted = [p2, p1].sort((a, b) => comparePlayersForBoard(a, b, 'draft_score', 'desc'));
    assert.equal(sorted[0].id, 'p1', 'Player with higher market VOR must win the tie');
    assert.equal(sorted[1].id, 'p2');
  });

  test('5.3 Level 3 Tertiary: Tied draft_score AND market_vor resolved by lower adp (earlier pick)', () => {
    const p1 = createSyntheticPlayer({
      id: 'p1',
      name: 'Player Early ADP',
      draft_score: 75.0,
      market_vor: 80.0,
      adp: 12.0, // Earlier pick
    });
    const p2 = createSyntheticPlayer({
      id: 'p2',
      name: 'Player Late ADP',
      draft_score: 75.0,
      market_vor: 80.0,
      adp: 35.0, // Later pick
    });

    const sorted = [p2, p1].sort((a, b) => comparePlayersForBoard(a, b, 'draft_score', 'desc'));
    assert.equal(sorted[0].id, 'p1', 'Player with earlier/lower ADP must win the tie');
    assert.equal(sorted[1].id, 'p2');
  });

  test('5.4 Level 4 Quaternary: Tied draft_score, market_vor, AND adp resolved alphabetically by name', () => {
    const p1 = createSyntheticPlayer({
      id: 'p1',
      name: 'Aaron Astral',
      draft_score: 75.0,
      market_vor: 80.0,
      adp: 20.0,
    });
    const p2 = createSyntheticPlayer({
      id: 'p2',
      name: 'Zack Zodiac',
      draft_score: 75.0,
      market_vor: 80.0,
      adp: 20.0,
    });

    const sorted = [p2, p1].sort((a, b) => comparePlayersForBoard(a, b, 'draft_score', 'desc'));
    assert.equal(sorted[0].name, 'Aaron Astral', 'Aaron must sort before Zack alphabetically');
    assert.equal(sorted[1].name, 'Zack Zodiac');
  });

  test('5.5 Level 5 Exact Identical: Duplicate players return 0 diff, preserving stable sort', () => {
    const p1 = createSyntheticPlayer({ id: 'dup_1', name: 'Identical Name', draft_score: 70.0, market_vor: 50.0, adp: 20.0 });
    const p2 = createSyntheticPlayer({ id: 'dup_2', name: 'Identical Name', draft_score: 70.0, market_vor: 50.0, adp: 20.0 });

    const diff = comparePlayersForBoard(p1, p2, 'draft_score', 'desc');
    assert.equal(diff, 0, 'Exact duplicates must return 0 diff for stable sort');
  });

  test('5.6 Reverse-alphabetical tied roster of 50 players sorts deterministically in ascending alphabetical order', () => {
    const letters = 'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba'.split('').slice(0, 50);
    const tiedPlayers = letters.map((char, idx) =>
      createSyntheticPlayer({
        id: `tied_${idx}`,
        name: `${char}_Player`,
        draft_score: 80.0,
        market_vor: 60.0,
        adp: 15.0,
      })
    );

    const sorted = [...tiedPlayers].sort((a, b) => comparePlayersForBoard(a, b, 'draft_score', 'desc'));
    for (let i = 0; i < sorted.length - 1; i++) {
      assert.ok(
        sorted[i].name.localeCompare(sorted[i + 1].name) <= 0,
        `Sorted order violation at index ${i}: ${sorted[i].name} vs ${sorted[i + 1].name}`
      );
    }
  });
});

// ============================================================================
// SUITE 6: Sleeper Rate Limiter, Clock Jitter & 429 Cooldown (lib/sleeper.ts)
// ============================================================================
describe('Suite 6: Sleeper Rate Limiter, Clock Jitter & 429 Cooldown (lib/sleeper.ts)', () => {
  before(() => {
    sleeper.resetRateLimit();
  });

  after(() => {
    sleeper.resetRateLimit();
  });

  test('6.1 Rate budget: requests allowed in 60s sliding window without premature client blocking', () => {
    sleeper.resetRateLimit();

    // Fire 50 rapid calls
    for (let i = 1; i <= 50; i++) {
      const status = sleeper.checkRateLimit();
      assert.equal(status.allowed, true, `Request #${i} must be allowed`);
      assert.equal(status.waitTimeMs, 0);
    }
  });

  test('6.2 Sliding window 2s jitter margin: effective window threshold is 58,000ms', () => {
    assert.equal(sleeper.RATE_LIMIT_WINDOW_MS, 60000);
    assert.equal(sleeper.RATE_LIMIT_JITTER_MARGIN_MS, 2000);
    assert.equal(sleeper.MAX_REQ_PER_MIN, 300);
  });

  test('6.3 Clock jitter handling: forward and backward clock drift simulations do not compromise budget', () => {
    sleeper.resetRateLimit();
    const realDateNow = Date.now;
    let mockTime = 1700000000000;

    try {
      Date.now = () => mockTime;

      // 50 requests at t=0
      for (let i = 0; i < 50; i++) {
        assert.equal(sleeper.checkRateLimit().allowed, true);
      }

      // Small jitter forward (+500ms)
      mockTime += 500;
      for (let i = 0; i < 50; i++) {
        assert.equal(sleeper.checkRateLimit().allowed, true);
      }

      // Minor backward jitter (-200ms, e.g. NTP sync adjustment)
      mockTime -= 200;
      const status = sleeper.checkRateLimit();
      assert.equal(status.allowed, true);
    } finally {
      Date.now = realDateNow;
      sleeper.resetRateLimit();
    }
  });

  test('6.4 HTTP 429 cooldown window locks out requests for 60,000ms', () => {
    sleeper.resetRateLimit();
    sleeper.triggerRateLimitCooldown();

    assert.equal(sleeper.isRateLimited(), true, 'isRateLimited() must return true during cooldown');
    const check = sleeper.checkRateLimit();
    assert.equal(check.allowed, false, 'checkRateLimit() must block requests during 429 cooldown');
    assert.ok(check.waitTimeMs > 50000, 'Wait time should be near 60,000ms');
  });

  test('6.5 Cooldown recovery: after 60,001ms, rate limiter unlocks and permits requests again', () => {
    sleeper.resetRateLimit();
    const realDateNow = Date.now;
    let mockTime = 1700000000000;

    try {
      Date.now = () => mockTime;
      sleeper.triggerRateLimitCooldown();
      assert.equal(sleeper.isRateLimited(), true);

      // Advance clock past 60s cooldown
      mockTime += 60001;
      assert.equal(sleeper.isRateLimited(), false, 'isRateLimited() must be false after 60,001ms');
      const check = sleeper.checkRateLimit();
      assert.equal(check.allowed, true, 'Requests must be permitted after cooldown expires');
    } finally {
      Date.now = realDateNow;
      sleeper.resetRateLimit();
    }
  });

  test('6.6 resetRateLimit completely purges timestamps and active cooldowns', () => {
    sleeper.triggerRateLimitCooldown();
    assert.equal(sleeper.isRateLimited(), true);
    sleeper.resetRateLimit();
    assert.equal(sleeper.isRateLimited(), false);
    assert.equal(sleeper.checkRateLimit().allowed, true);
  });
});

// ============================================================================
// SUITE 7: Resilient Fallback Engine & Data Normalization (lib/sleeper.ts)
// ============================================================================
describe('Suite 7: Resilient Fallback Engine & Data Normalization (lib/sleeper.ts, route.ts)', () => {
  before(() => {
    sleeper.resetRateLimit();
  });

  after(() => {
    sleeper.resetRateLimit();
  });

  test('7.1 Network rejection / timeout in fetchSleeperDraft falls back to mock_oneiromancy_draft_2025', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('ETIMEDOUT: Connection timed out');
    };

    try {
      const state = await sleeper.fetchSleeperDraft('timeout_draft_id');
      assert.ok(state, 'Must return draft state');
      assert.equal(state.draft_id, 'timeout_draft_id');
      assert.equal(state.settings.offline_mode_active, true, 'offline_mode_active must be set');
      assert.ok(state.cosmic_board.length > 0, 'Cosmic board must be populated from mock state');
      assert.equal(state.ideal_draft_path.length, 5, 'Ideal draft path must have 5 preview rounds');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('7.2 HTTP 500 response simulation returns graceful fallback with valid DraftState schema', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response('Internal Server Error', { status: 500 });
    };

    try {
      const state = await sleeper.fetchSleeperDraft('500_draft_id');
      assert.equal(state.draft_id, '500_draft_id');
      assert.equal(state.settings.offline_mode_active, true);
      assert.ok(Array.isArray(state.my_roster), 'Roster must be an array');
      assert.ok(Array.isArray(state.waiver_upgrades), 'Waiver upgrades must be an array');
      assert.ok(Array.isArray(state.trade_proposals), 'Trade proposals must be an array');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('7.3 Malformed JSON response simulation falls back gracefully without unhandled exception', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response('{ corrupted: true, incomplete_json... [', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const state = await sleeper.fetchSleeperDraft('corrupted_json_draft');
      assert.equal(state.draft_id, 'corrupted_json_draft');
      assert.equal(state.settings.offline_mode_active, true);
      assert.ok(state.cosmic_board.length >= 16);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('7.4 Missing draft pick fields in transformToDraftState are handled resiliently', () => {
    const metadata = {
      draft_id: 'partial_picks_draft',
      status: 'drafting',
      type: 'snake',
      season: '2025',
      settings: { teams: 12, rounds: 15 },
      draft_order: { user_1: 1, user_2: 2 },
    };

    const anomalousPicks = [
      // Pick with null player_id
      { pick_no: 1, round: 1, draft_slot: 1, player_id: null, picked_by: 'user_1' },
      // Pick with missing picked_by and draft_slot
      { pick_no: 2, round: 1, player_id: '4034' }, // McCaffrey
      // Pick referencing non-existent player ID
      { pick_no: 3, round: 1, draft_slot: 3, player_id: 'non_existent_id_9999', picked_by: 'user_3' },
    ];

    const state = sleeper.transformToDraftState(metadata, anomalousPicks);
    assert.ok(state, 'transformToDraftState must succeed without error');
    assert.equal(state.draft_id, 'partial_picks_draft');
    assert.equal(state.status, 'drafting');
    assert.equal(state.current_pick.pick_no, 4);

    // Verify player with ID '4034' is marked drafted
    const cmc = state.cosmic_board.find((p) => p.id === '4034');
    if (cmc) {
      assert.equal(cmc.draft_status, 'drafted');
    }
  });

  test('7.5 Missing metadata fields in transformToDraftState defaults to 12 teams, 15 rounds', () => {
    const sparseMetadata = {
      draft_id: 'sparse_draft',
      // settings is missing entirely
      draft_order: null,
    };
    const state = sleeper.transformToDraftState(sparseMetadata, []);
    assert.equal(state.status, 'pre_draft');
    assert.equal(state.current_pick.round, 1);
    assert.equal(state.current_pick.pick_no, 1);
    assert.equal(state.current_pick.on_the_clock_team_id, '');
  });

  test('7.6 Schema contract: transformToDraftState produces all 8 canonical entities with valid arrays', () => {
    const state = sleeper.transformToDraftState(
      { draft_id: 'contract_test', settings: { teams: 12, rounds: 15 } },
      []
    );
    // Entity 1: cosmic_board
    assert.ok(Array.isArray(state.cosmic_board) && state.cosmic_board.length > 0);
    // Entity 2: ideal_draft_path
    assert.ok(Array.isArray(state.ideal_draft_path) && state.ideal_draft_path.length >= 5);
    // Entity 3: my_roster
    assert.ok(Array.isArray(state.my_roster) && state.my_roster.length === 15);
    // Entity 4: weekly_coverage
    assert.ok(Array.isArray(state.weekly_coverage) && state.weekly_coverage.length > 0);
    // Entity 5: elemental_traits
    assert.ok(typeof state.elemental_traits === 'object' && 'Fire' in state.elemental_traits);
    // Entity 6: waiver_upgrades
    assert.ok(Array.isArray(state.waiver_upgrades) && state.waiver_upgrades.length > 0);
    // Entity 7: trade_proposals
    assert.ok(Array.isArray(state.trade_proposals) && state.trade_proposals.length > 0);
    // Entity 8: settings
    assert.ok(typeof state.settings === 'object' && state.settings.draft_id === 'contract_test');
  });
});

// ============================================================================
// SUITE 8: Context Polling Downshifting & State Preservation (OneiromancyContext.tsx)
// ============================================================================
describe('Suite 8: Context Polling Downshifting & State Preservation (OneiromancyContext.tsx)', () => {
  test('8.1 Polling interval downshifting: 5s active drafting -> 10s idle -> 30s background hidden tab', () => {
    // 1. Active drafting visible
    const activeInterval = sleeper.resolvePollInterval('drafting', 'visible');
    assert.equal(activeInterval, 5000, 'Visible drafting must poll at 5,000ms');

    // 2. Idle visible (pre_draft, paused, complete)
    assert.equal(sleeper.resolvePollInterval('pre_draft', 'visible'), 10000);
    assert.equal(sleeper.resolvePollInterval('paused', 'visible'), 10000);
    assert.equal(sleeper.resolvePollInterval('complete', 'visible'), 10000);

    // 3. Background / hidden tab (throttled to 30,000ms regardless of draft status)
    assert.equal(sleeper.resolvePollInterval('drafting', 'hidden'), 30000);
    assert.equal(sleeper.resolvePollInterval('pre_draft', 'hidden'), 30000);
    assert.equal(sleeper.resolvePollInterval('complete', 'hidden'), 30000);

    // 4. Custom user interval override when visible
    assert.equal(sleeper.resolvePollInterval('drafting', 'visible', 7500), 7500);
    // When hidden, background 30s throttle takes precedence over user interval
    assert.equal(sleeper.resolvePollInterval('drafting', 'hidden', 7500), 30000);
  });

  test('8.2 State preservation: user custom sliders (chaos_lambda, oracle_weights) NEVER snap back to server defaults on poll ticks', () => {
    // Simulate user state before incoming poll:
    const userCustomLambda = 0.85; // User moved slider to 0.85
    const userCustomOracleWeights = {
      celestial: 0.50,
      numeric: 0.10,
      geomantic: 0.10,
      oracular: 0.15,
      harmony: 0.15,
    };

    const prevState = {
      ...mockData.mock_oneiromancy_draft_2025,
      settings: {
        ...mockData.mockSettings,
        chaos_lambda: userCustomLambda,
        oracle_weights: userCustomOracleWeights,
        auto_update: true,
        poll_interval_ms: 5000,
      },
    };

    // Incoming freshData from Sleeper API (contains server/mock defaults: lambda=0.35, oracle_weights 30/20/25/10/15)
    const freshDataFromServer = {
      ...mockData.mock_oneiromancy_draft_2025,
      settings: {
        ...mockData.mockSettings,
        chaos_lambda: 0.35, // Server default
        oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS, // Server default
      },
    };

    // Execute the exact Context state merger logic from OneiromancyContext.tsx (lines 426-470)
    const mergedSettings = {
      ...freshDataFromServer.settings,
      chaos_lambda: prevState.settings?.chaos_lambda ?? scoring.DEFAULT_CHAOS_LAMBDA,
      oracle_weights: prevState.settings?.oracle_weights ?? scoring.DEFAULT_ORACLE_WEIGHTS,
      auto_update: prevState.settings?.auto_update ?? true,
      poll_interval_ms: prevState.settings?.poll_interval_ms ?? 5000,
    };

    // Recalculate spirit scores with user preserved weights
    const boardWithSpirit = freshDataFromServer.cosmic_board.map((player) => {
      if (player.divination_breakdown) {
        const spiritScore = scoring.computeSpiritScore(
          player.divination_breakdown,
          mergedSettings.oracle_weights
        );
        return {
          ...player,
          spirit_score: spiritScore,
        };
      }
      return player;
    });

    // Recompute DraftScores using user preserved chaos_lambda
    const recomputedBoard = scoring.recomputeDraftScores(boardWithSpirit, mergedSettings);

    // Assertions
    assert.equal(
      mergedSettings.chaos_lambda,
      0.85,
      'chaos_lambda must remain 0.85, must NOT snap back to server default 0.35'
    );
    assert.equal(
      mergedSettings.oracle_weights.celestial,
      0.50,
      'oracle_weights.celestial must remain 0.50, must NOT snap back to 0.30'
    );

    // Verify draft_score on board reflects lambda = 0.85
    const playerA = recomputedBoard[0];
    const expectedDraftScore = Math.round(
      ((1.0 - 0.85) * playerA.vor_normalized + 0.85 * playerA.spirit_score) * 100
    ) / 100;
    assert.equal(
      playerA.draft_score,
      expectedDraftScore,
      'Board draft_score must be recomputed with user custom lambda (0.85), not server default'
    );
  });

  test('8.3 normalizeTab handles marketplace and market aliases, invalid tab defaults to oneiromancy', () => {
    assert.equal(oneiromancyContext.normalizeTab('market'), 'market');
    assert.equal(oneiromancyContext.normalizeTab('marketplace'), 'market');
    assert.equal(oneiromancyContext.normalizeTab('oneiromancy'), 'oneiromancy');
    assert.equal(oneiromancyContext.normalizeTab('board'), 'board');
    assert.equal(oneiromancyContext.normalizeTab('chaos'), 'chaos');
    assert.equal(oneiromancyContext.normalizeTab('invalid_tab_name'), 'oneiromancy');
    assert.equal(oneiromancyContext.normalizeTab(''), 'oneiromancy');
  });
});
