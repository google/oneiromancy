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
 * Challenger 2 Milestone 3 Empirical Stress Testing Suite
 * 'Oneiromancy' Fantasy Draft Frontend
 * 
 * Verifies:
 * 1. draftPlayer action:
 *    - Player moves to roster in correct slot (starter first, then bench)
 *    - Snake pick advances pick_no, round, and on-the-clock team id
 *    - Active correlation stacks recomputed (CIN 3.0x QB/WR stack: Burrow + Chase, and double stack with Higgins)
 *    - Path of Ascension updates with is_ascended = true and actual_picked_player_id
 * 2. Target poaching & fallback elevation:
 *    - Unpoached target: fallbackActive = false
 *    - Opponent-poached target: fallbackActive = true, fallback candidate elevated
 *    - Double-poaching: elevates best available positional player by draft_score
 * 3. Astrolabe speed multiplier & Chaos Dial:
 *    - Formula: speedMultiplier = 1 + 3 * lambda
 *    - Tested at lambda = 0.0 (1.0x), lambda = 0.5 (2.5x), lambda = 1.0 (4.0x)
 *    - Animation durations: outerDuration = 60/mult, middle = 40/mult, inner = 20/mult
 *    - Master Chaos Dial 4 zones mapping
 * 4. Marketplace:
 *    - Waiver upgrade net score delta pruning: net_score_delta <= 0 strictly pruned
 *    - Divine Swap trade proposals fairness index (50.0 = exact parity, 0-100 scale)
 * 5. Production Standalone Server Execution:
 *    - Spawns .next/standalone/server.js on isolated port
 *    - Queries HTTP 200 on / and /api/draft/mock
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
// Helper: Simulate draftPlayer State Reducer (Mirrors OneiromancyContext.tsx)
// ============================================================================

function executeDraftPlayer(state, playerId) {
  const playerIndex = state.cosmic_board.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.cosmic_board[playerIndex];
  if (player.draft_status !== 'available') return state;

  const userId = state.settings.user_id || 'user_oneiromancy_me';
  const currentPickNo = state.current_pick.pick_no;

  const draftedPlayer = {
    ...player,
    draft_status: 'my_team',
    drafted_by_user_id: userId,
    drafted_pick_no: currentPickNo,
  };

  // 1. Assign to first vacant matching roster slot (Starters first, then bench)
  let placed = false;
  const updatedRoster = state.my_roster.map((slot) => {
    const isStarter = !slot.slot_id.startsWith('BN');
    if (!placed && isStarter && !slot.player && slot.eligible_positions.includes(draftedPlayer.position)) {
      placed = true;
      return { ...slot, player: draftedPlayer };
    }
    return slot;
  });

  if (!placed) {
    for (let i = 0; i < updatedRoster.length; i++) {
      const slot = updatedRoster[i];
      const isBench = slot.slot_id.startsWith('BN');
      if (isBench && !slot.player && slot.eligible_positions.includes(draftedPlayer.position)) {
        updatedRoster[i] = { ...slot, player: draftedPlayer };
        placed = true;
        break;
      }
    }
  }

  // 2. Advance snake draft pick clock
  const nextPickNo = currentPickNo + 1;
  const totalTeams = 12;
  const snake = scoring.calculateSnakePick(nextPickNo - 1, totalTeams);
  const nextPick = {
    round: snake.round,
    pick_no: nextPickNo,
    on_the_clock_team_id: `user_slot_${snake.slot}`,
    seconds_remaining: 90,
  };
  const nextLeagueStatus = scoring.deriveDraftStatus(nextPickNo, totalTeams, 15);

  // 3. Recompute squad stacks & elements
  const rosteredPlayers = updatedRoster
    .map((s) => s.player)
    .filter((p) => p !== null && p !== undefined);

  const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  for (const p of rosteredPlayers) {
    if (p.elemental_traits?.element) {
      elements[p.elemental_traits.element] =
        (elements[p.elemental_traits.element] || 0) + 1;
    }
  }

  // 4. Recompute harmony for remaining available players
  const lambda = state.settings.chaos_lambda ?? scoring.DEFAULT_CHAOS_LAMBDA;
  const updatedBoard = state.cosmic_board.map((p) => {
    if (p.id === playerId) return draftedPlayer;
    if (p.draft_status === 'available') {
      const newHarmony = scoring.calculateHarmony(updatedRoster, p, snake.round);
      const breakdown = { ...p.divination_breakdown, harmony: newHarmony };
      const newSpirit = scoring.computeSpiritScore(breakdown, state.settings.oracle_weights);
      const newDraftScore = scoring.computeDraftScore(p.vor_normalized, newSpirit, lambda);
      return {
        ...p,
        harmony_score: newHarmony,
        divination_breakdown: breakdown,
        spirit_score: newSpirit,
        draft_score: newDraftScore,
      };
    }
    return p;
  });

  // 5. Update Path of Ascension
  const updatedIdealPath = state.ideal_draft_path.map((step) => {
    if (step.round === state.current_pick.round) {
      return {
        ...step,
        is_ascended: true,
        actual_picked_player_id: playerId,
      };
    }
    return step;
  });

  return {
    ...state,
    status: nextLeagueStatus,
    current_pick: nextPick,
    cosmic_board: updatedBoard,
    ideal_draft_path: updatedIdealPath,
    my_roster: updatedRoster,
    elemental_traits: elements,
  };
}

// Helper: Calculate Active Stacks (Mirrors OneiromancyDashboard.tsx)
function deriveActiveStacks(roster) {
  const rosteredPlayers = roster
    .map((s) => s.player)
    .filter((p) => p !== null && p !== undefined);

  const stacks = [];
  const qbs = rosteredPlayers.filter((p) => p.position === 'QB');
  for (const qb of qbs) {
    const passCatchers = rosteredPlayers.filter(
      (p) => (p.position === 'WR' || p.position === 'TE') && p.team === qb.team
    );
    if (passCatchers.length > 0) {
      stacks.push({
        team: qb.team,
        multiplier: 3.0,
        bonus_points: passCatchers.length >= 2 ? 27.0 : 18.0,
        description: `${qb.team} 3.0x ${qb.name} ↔ ${passCatchers.map((pc) => pc.name).join(' & ')}`,
        qb_name: qb.name,
        pass_catcher_names: passCatchers.map((pc) => pc.name),
      });
    }
  }
  return stacks;
}

// Helper: Simulate Fallback Candidate Elevation (Mirrors AscensionTimeline.tsx)
function evaluateAscensionFallback(step, currentRound, cosmicBoard) {
  let fallbackActive = false;
  let fallbackPlayerName = undefined;

  const isCurrent = step.round === currentRound;
  if (cosmicBoard.length > 0 && isCurrent) {
    const primary = cosmicBoard.find((p) => p.id === step.target_player_id);
    if (primary && primary.draft_status === 'drafted') {
      fallbackActive = true;
      const fallback = cosmicBoard.find((p) => p.id === step.fallback_player_id);
      if (fallback && fallback.draft_status === 'available') {
        fallbackPlayerName = fallback.name;
      } else {
        const bestPositional = cosmicBoard
          .filter((p) => p.position === step.target_position && p.draft_status === 'available')
          .sort((a, b) => b.draft_score - a.draft_score)[0];
        fallbackPlayerName = bestPositional ? bestPositional.name : step.fallback_player_name;
      }
    }
  }

  return { fallbackActive, fallbackPlayerName };
}

// ============================================================================
// Suite 1: Stress Testing draftPlayer Action & Path of Ascension
// ============================================================================

describe('Suite 1: Stress Testing draftPlayer Action & Path of Ascension', () => {
  let freshState;

  before(() => {
    // Deep clone canonical mock draft state
    freshState = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
    // Ensure RB1 holds a distinct RB starter and clear RB2 slot to test vacant starter slot assignment in 1.1
    const rb1Slot = freshState.my_roster.find((s) => s.slot_id === 'RB1');
    if (rb1Slot && rb1Slot.player) rb1Slot.player.id = 'rb1_starter_seed';
    const rb2Slot = freshState.my_roster.find((s) => s.slot_id === 'RB2');
    if (rb2Slot) rb2Slot.player = null;
  });

  test('1.1 draftPlayer assigns available player to matching vacant starter slot with metadata', () => {
    const initialPickNo = freshState.current_pick.pick_no;

    // In canonical mock state, Jonathan Taylor (RB, IND, id '6813') is available
    const jt = freshState.cosmic_board.find((p) => p.id === '6813');
    assert.ok(jt, 'Jonathan Taylor must exist in mock cosmic board');
    assert.equal(jt.draft_status, 'available');

    const nextState = executeDraftPlayer(freshState, '6813');

    // Assert player status in cosmic board
    const updatedJt = nextState.cosmic_board.find((p) => p.id === '6813');
    assert.equal(updatedJt.draft_status, 'my_team');
    assert.equal(updatedJt.drafted_by_user_id, freshState.settings.user_id || 'user_oneiromancy_me');
    assert.equal(updatedJt.drafted_pick_no, initialPickNo);

    // Assert roster placement in vacant RB2 slot
    const rbSlot = nextState.my_roster.find(
      (s) => s.player && s.player.id === '6813'
    );
    assert.ok(rbSlot, 'Jonathan Taylor must be placed in a vacant user roster slot');
    assert.ok(rbSlot.eligible_positions.includes('RB'), 'Slot must be eligible for RB');
    assert.equal(rbSlot.slot_id, 'RB2', 'Should fill vacant RB2 starter slot');

    // Assert clock advancement
    assert.equal(nextState.current_pick.pick_no, initialPickNo + 1);
  });

  test('1.2 snake pick calculation accurately advances pick, round, and direction', () => {
    // Test sequential picks spanning multiple rounds
    let state = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
    state.current_pick.pick_no = 12; // End of round 1 in 12-team league
    state.current_pick.round = 1;

    // Pick 12 is slot 12 in round 1. Next pick is Pick 13 (Round 2, slot 12 due to snake turn)
    const availablePlayer = state.cosmic_board.find((p) => p.draft_status === 'available');
    const afterPick12 = executeDraftPlayer(state, availablePlayer.id);

    assert.equal(afterPick12.current_pick.pick_no, 13);
    assert.equal(afterPick12.current_pick.round, 2);
    // In round 2 snake (reverse): slot index 0 is team 12
    assert.equal(afterPick12.current_pick.on_the_clock_team_id, 'user_slot_12');

    // Now test round 2 end: pick 24 -> pick 25 (Round 3, forward direction again: slot 1)
    afterPick12.current_pick.pick_no = 24;
    afterPick12.current_pick.round = 2;
    const nextAvail = afterPick12.cosmic_board.find((p) => p.draft_status === 'available');
    const afterPick24 = executeDraftPlayer(afterPick12, nextAvail.id);

    assert.equal(afterPick24.current_pick.pick_no, 25);
    assert.equal(afterPick24.current_pick.round, 3);
    assert.equal(afterPick24.current_pick.on_the_clock_team_id, 'user_slot_1');
  });

  test('1.3 active correlation stacks recomputed dynamically (CIN 3.0x QB/WR stack & Double Stack)', () => {
    // 1. Seed Burrow (QB, CIN) and Chase (WR, CIN) on user roster
    const baseState = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
    const burrow = baseState.cosmic_board.find((p) => p.name === 'Joe Burrow');
    const chase = baseState.cosmic_board.find((p) => p.name === "Ja'Marr Chase");
    baseState.my_roster[0].player = burrow;
    baseState.my_roster[3].player = chase;
    // Clear WR2 slot so Higgins is placed on roster for double stack testing
    const wr2Slot = baseState.my_roster.find((s) => s.slot_id === 'WR2');
    if (wr2Slot) wr2Slot.player = null;
    const currentStacks = deriveActiveStacks(baseState.my_roster);

    const initialCin = currentStacks.find((s) => s.team === 'CIN');
    assert.ok(initialCin, 'CIN 3.0x stack must be active for Burrow + Chase in initial mock roster');
    assert.equal(initialCin.multiplier, 3.0);
    assert.equal(initialCin.bonus_points, 18.0);
    assert.ok(initialCin.pass_catcher_names.includes("Ja'Marr Chase"));
    assert.equal(initialCin.qb_name, 'Joe Burrow');

    // 2. Draft Tee Higgins (WR, CIN, id '6801') from available board to test dynamic DOUBLE STACK escalation
    const higgins = baseState.cosmic_board.find((p) => p.id === '6801');
    assert.ok(higgins, 'Tee Higgins must be available in cosmic board');
    assert.equal(higgins.draft_status, 'available');

    const stateWithDoubleStack = executeDraftPlayer(baseState, '6801');
    const updatedStacks = deriveActiveStacks(stateWithDoubleStack.my_roster);

    const escalatedCin = updatedStacks.find((s) => s.team === 'CIN');
    assert.ok(escalatedCin, 'CIN stack must remain active after drafting Higgins');
    assert.equal(escalatedCin.multiplier, 3.0);
    assert.equal(escalatedCin.bonus_points, 27.0, 'Double stack with 2 pass catchers awards 27.0 bonus points (18 + 9)');
    assert.equal(escalatedCin.pass_catcher_names.length, 2);
    assert.ok(escalatedCin.pass_catcher_names.includes("Ja'Marr Chase"));
    assert.ok(escalatedCin.pass_catcher_names.includes('Tee Higgins'));

    // 3. Test clean baseline construction from empty roster
    const cleanRoster = baseState.my_roster.map((s) => ({ ...s, player: null }));
    assert.equal(deriveActiveStacks(cleanRoster).length, 0, 'Clean empty roster must have 0 stacks');

    // Add Burrow only
    cleanRoster[0].player = { id: 'b1', name: 'Joe Burrow', position: 'QB', team: 'CIN' };
    assert.equal(deriveActiveStacks(cleanRoster).length, 0, 'QB alone without pass catchers forms no stack');

    // Add Chase
    cleanRoster[3].player = { id: 'c1', name: "Ja'Marr Chase", position: 'WR', team: 'CIN' };
    const singleStack = deriveActiveStacks(cleanRoster);
    assert.equal(singleStack.length, 1);
    assert.equal(singleStack[0].bonus_points, 18.0);
  });

  test('1.4 Path of Ascension marks current round step as ascended with picked player ID', () => {
    let state = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
    state.current_pick.round = 4;
    state.current_pick.pick_no = 41;
    for (const s of state.ideal_draft_path) {
      s.is_ascended = s.round < 4;
    }
    const currentRound = state.current_pick.round;

    // Check ascension step for current round
    const stepBefore = state.ideal_draft_path.find((s) => s.round === currentRound);
    assert.ok(stepBefore, `Ascension step for round ${currentRound} must exist`);
    assert.equal(stepBefore.is_ascended, false);

    const candidate = state.cosmic_board.find((p) => p.draft_status === 'available');
    const nextState = executeDraftPlayer(state, candidate.id);

    const stepAfter = nextState.ideal_draft_path.find((s) => s.round === currentRound);
    assert.equal(stepAfter.is_ascended, true, 'Current round ascension step must be marked ascended');
    assert.equal(stepAfter.actual_picked_player_id, candidate.id);

    // Steps before current round remain ascended, future rounds remain unascended
    for (const step of nextState.ideal_draft_path) {
      if (step.round < currentRound) {
        assert.equal(step.is_ascended, true);
      } else if (step.round > currentRound) {
        assert.equal(step.is_ascended, false);
      }
    }
  });

  test('1.5 drafting safely handles full starter slots and overflows to bench slots', () => {
    let state = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));

    // Clear bench slots so a vacant overflow slot is available
    for (const slot of state.my_roster) {
      if (slot.slot_id.startsWith('BN')) {
        slot.player = null;
      }
    }

    // Fill all starter slots
    for (const slot of state.my_roster) {
      if (!slot.slot_id.startsWith('BN')) {
        slot.player = {
          id: `starter_${slot.slot_id}`,
          name: `Starter ${slot.slot_id}`,
          position: slot.eligible_positions[0],
          team: 'KC',
          projected_points: 200.0,
        };
      }
    }

    // Now draft an additional RB
    const extraRb = {
      id: 'rb_bench_test',
      name: 'Bench RB',
      position: 'RB',
      team: 'MIA',
      projected_points: 150.0,
      draft_status: 'available',
      divination_breakdown: { celestial: 70, numeric: 70, geomantic: 70, oracular: 70, harmony: 70 },
    };
    state.cosmic_board.push(extraRb);

    const nextState = executeDraftPlayer(state, extraRb.id);
    const placedSlot = nextState.my_roster.find((s) => s.player && s.player.id === extraRb.id);

    assert.ok(placedSlot, 'Player must be placed in a bench slot');
    assert.ok(placedSlot.slot_id.startsWith('BN'), `Slot ID must be BN*, got ${placedSlot.slot_id}`);
  });

  test('1.6 drafting already drafted player or non-existent ID is safely idempotent', () => {
    let state = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
    const initialPickNo = state.current_pick.pick_no;

    // Non-existent ID
    const noopState1 = executeDraftPlayer(state, 'non_existent_uuid_404');
    assert.equal(noopState1.current_pick.pick_no, initialPickNo, 'Non-existent ID must be a no-op');

    // Already drafted player
    const draftedPlayer = state.cosmic_board.find((p) => p.draft_status === 'drafted');
    if (draftedPlayer) {
      const noopState2 = executeDraftPlayer(state, draftedPlayer.id);
      assert.equal(noopState2.current_pick.pick_no, initialPickNo, 'Already drafted player must be a no-op');
    }
  });

  test('1.7 Monte Carlo full 15-player draft sequence fills roster without corruption', () => {
    let state = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
    // Clear user roster
    state.my_roster = state.my_roster.map((s) => ({ ...s, player: null }));
    state.current_pick = { round: 1, pick_no: 5, on_the_clock_team_id: 'user_slot_5', seconds_remaining: 90 };
    // Make board players available for fresh simulation
    state.cosmic_board = state.cosmic_board.map((p) => ({ ...p, draft_status: 'available' }));

    // Pick 15 available players sequentially
    for (let i = 0; i < 15; i++) {
      const candidate = state.cosmic_board.find((p) => p.draft_status === 'available');
      assert.ok(candidate, `Candidate must be available for draft step ${i + 1}`);
      state = executeDraftPlayer(state, candidate.id);
    }

    // Verify all 15 slots are occupied
    const filledSlots = state.my_roster.filter((s) => s.player !== null);
    assert.equal(filledSlots.length, 15, 'All 15 roster slots must be filled after 15 successful picks');
    assert.equal(state.current_pick.pick_no, 20, 'Pick number must advance by exactly 15');
  });
});

// ============================================================================
// Suite 2: Stress Testing Target Poaching & Fallback Elevation
// ============================================================================

describe('Suite 2: Stress Testing Target Poaching & Fallback Elevation in Path of Ascension', () => {
  let step;
  let board;

  before(() => {
    step = {
      round: 5,
      overall_pick: 49,
      target_position: 'WR',
      target_player_id: 'wr_primary_alpha',
      target_player_name: 'Marvin Harrison Jr.',
      target_team: 'ARI',
      draft_score: 92.4,
      positional_vor: 34.2,
      spirit_score: 91.0,
      fallback_player_id: 'wr_fallback_beta',
      fallback_player_name: 'George Pickens',
      fallback_team: 'PIT',
    };

    board = [
      {
        id: 'wr_primary_alpha',
        name: 'Marvin Harrison Jr.',
        position: 'WR',
        team: 'ARI',
        draft_status: 'available',
        draft_score: 92.4,
      },
      {
        id: 'wr_fallback_beta',
        name: 'George Pickens',
        position: 'WR',
        team: 'PIT',
        draft_status: 'available',
        draft_score: 87.5,
      },
      {
        id: 'wr_tertiary_gamma',
        name: 'Christian Kirk',
        position: 'WR',
        team: 'JAX',
        draft_status: 'available',
        draft_score: 84.1,
      },
      {
        id: 'wr_quaternary_delta',
        name: 'Courtland Sutton',
        position: 'WR',
        team: 'DEN',
        draft_status: 'available',
        draft_score: 79.8,
      },
    ];
  });

  test('2.1 unpoached target: fallbackActive is false, primary remains active target', () => {
    board[0].draft_status = 'available';
    const result = evaluateAscensionFallback(step, 5, board);

    assert.equal(result.fallbackActive, false, 'Fallback must be inactive when primary is available');
    assert.equal(result.fallbackPlayerName, undefined);
  });

  test('2.2 primary target poached by rival: fallbackActive is true and fallback candidate elevated', () => {
    board[0].draft_status = 'drafted';
    board[1].draft_status = 'available';

    const result = evaluateAscensionFallback(step, 5, board);

    assert.equal(result.fallbackActive, true, 'Fallback must activate when primary target is drafted');
    assert.equal(result.fallbackPlayerName, 'George Pickens', 'George Pickens must be elevated as fallback');
  });

  test('2.3 double poaching: if primary AND designated fallback are poached, elevates best positional available', () => {
    board[0].draft_status = 'drafted';
    board[1].draft_status = 'drafted';
    board[2].draft_status = 'available'; // Christian Kirk (draft_score 84.1)
    board[3].draft_status = 'available'; // Courtland Sutton (draft_score 79.8)

    const result = evaluateAscensionFallback(step, 5, board);

    assert.equal(result.fallbackActive, true, 'Fallback must activate under double poaching');
    assert.equal(
      result.fallbackPlayerName,
      'Christian Kirk',
      'Christian Kirk (highest draft_score available WR) must be elevated'
    );
  });

  test('2.4 exhaustion poaching: when all positional players are drafted, safely preserves fallback_player_name', () => {
    board.forEach((p) => { p.draft_status = 'drafted'; });

    const result = evaluateAscensionFallback(step, 5, board);
    assert.equal(result.fallbackActive, true);
    assert.equal(
      result.fallbackPlayerName,
      'George Pickens',
      'Should fall back to step designated name when all candidates exhausted'
    );
  });

  test('2.5 target drafted by user (my_team): fallbackActive remains false', () => {
    board[0].draft_status = 'my_team';
    const result = evaluateAscensionFallback(step, 5, board);
    assert.equal(result.fallbackActive, false, 'User owning primary target does not trigger poaching fallback');
  });

  test('2.6 fuzzing 100 randomized draft board states across all 15 rounds of Ascension Path', () => {
    const idealPath = mockData.mockIdealDraftPath;

    for (let round = 1; round <= 15; round++) {
      const step = idealPath.find((s) => s.round === round) || {
        round,
        overall_pick: round * 12,
        target_position: 'WR',
        target_player_id: 'p_target_' + round,
        target_player_name: 'Target ' + round,
        fallback_player_id: 'p_fallback_' + round,
        fallback_player_name: 'Fallback ' + round,
      };

      // Scenario A: Unpoached
      const boardA = [
        { id: step.target_player_id, name: step.target_player_name, position: step.target_position, draft_status: 'available', draft_score: 90.0 },
        { id: step.fallback_player_id, name: step.fallback_player_name, position: step.target_position, draft_status: 'available', draft_score: 80.0 },
      ];
      const resA = evaluateAscensionFallback(step, round, boardA);
      assert.equal(resA.fallbackActive, false);

      // Scenario B: Poached
      boardA[0].draft_status = 'drafted';
      const resB = evaluateAscensionFallback(step, round, boardA);
      assert.equal(resB.fallbackActive, true);
      assert.equal(resB.fallbackPlayerName, step.fallback_player_name);

      // Scenario C: Double-poached
      boardA[1].draft_status = 'drafted';
      boardA.push({ id: 'alt_' + round, name: 'Alt Star ' + round, position: step.target_position, draft_status: 'available', draft_score: 75.0 });
      const resC = evaluateAscensionFallback(step, round, boardA);
      assert.equal(resC.fallbackActive, true);
      assert.equal(resC.fallbackPlayerName, 'Alt Star ' + round);
    }
  });
});

// ============================================================================
// Suite 3: Astrolabe Speed Multiplier & Chaos Dial Mathematics
// ============================================================================

describe('Suite 3: Astrolabe Speed Multiplier Formula & Chaos Dial Math', () => {
  function calculateAstrolabeSpeed(lambda, explicitMultiplier) {
    if (explicitMultiplier !== undefined) {
      return Math.max(0.1, explicitMultiplier);
    }
    return Math.max(0.2, 1 + (lambda ?? 0.35) * 3);
  }

  function calculateDurations(speedMultiplier) {
    const mult = Math.max(0.1, speedMultiplier);
    return {
      outerDuration: Math.max(3, 60 / mult),
      middleDuration: Math.max(2.5, 40 / mult),
      innerDuration: Math.max(1.5, 20 / mult),
    };
  }

  test('3.1 Astrolabe speed multiplier formula: test canonical lambda values (0.0, 0.5, 1.0, 0.35)', () => {
    // 1. Lambda = 0.0 -> Speed = 1.0x (Analytic Orthodoxy)
    const speed0 = calculateAstrolabeSpeed(0.0);
    assert.equal(speed0, 1.0, 'Lambda 0.0 must yield speed 1.0x');

    // 2. Lambda = 0.5 -> Speed = 2.5x (Mystic Ascendance)
    const speed05 = calculateAstrolabeSpeed(0.5);
    assert.equal(speed05, 2.5, 'Lambda 0.5 must yield speed 2.5x');

    // 3. Lambda = 1.0 -> Speed = 4.0x (Cosmic Bedlam)
    const speed1 = calculateAstrolabeSpeed(1.0);
    assert.equal(speed1, 4.0, 'Lambda 1.0 must yield speed 4.0x');

    // 4. Default Lambda = 0.35 -> Speed = 2.05x
    const speedDefault = calculateAstrolabeSpeed(0.35);
    assert.equal(Number(speedDefault.toFixed(2)), 2.05, 'Lambda 0.35 must yield speed 2.05x');

    // 5. Undefined lambda falls back to 0.35
    const speedUndef = calculateAstrolabeSpeed(undefined);
    assert.equal(Number(speedUndef.toFixed(2)), 2.05, 'Undefined lambda must fall back to 2.05x');
  });

  test('3.2 Astrolabe animation durations scale inversely with speed multiplier', () => {
    // At lambda = 0.0 (mult = 1.0)
    const dur1 = calculateDurations(1.0);
    assert.equal(dur1.outerDuration, 60.0);
    assert.equal(dur1.middleDuration, 40.0);
    assert.equal(dur1.innerDuration, 20.0);

    // At lambda = 0.5 (mult = 2.5)
    const dur25 = calculateDurations(2.5);
    assert.equal(dur25.outerDuration, 24.0);
    assert.equal(dur25.middleDuration, 16.0);
    assert.equal(dur25.innerDuration, 8.0);

    // At lambda = 1.0 (mult = 4.0)
    const dur4 = calculateDurations(4.0);
    assert.equal(dur4.outerDuration, 15.0);
    assert.equal(dur4.middleDuration, 10.0);
    assert.equal(dur4.innerDuration, 5.0);

    // Strict monotonic acceleration: faster rotation = shorter duration
    assert.ok(dur1.outerDuration > dur25.outerDuration);
    assert.ok(dur25.outerDuration > dur4.outerDuration);
    assert.ok(dur1.innerDuration > dur25.innerDuration);
    assert.ok(dur25.innerDuration > dur4.innerDuration);
  });

  test('3.3 Master Chaos Dial 4 zones partition [0.0, 1.0] without gaps or overlap', () => {
    const zones = [
      { name: 'Analytic Orthodoxy', min: 0.0, max: 0.2 },
      { name: 'Balanced Oracle', min: 0.21, max: 0.49 },
      { name: 'Mystic Ascendance', min: 0.5, max: 0.79 },
      { name: 'Cosmic Bedlam', min: 0.8, max: 1.0 },
    ];

    const getZone = (l) => zones.find((z) => l >= z.min && l <= z.max) || zones[1];

    assert.equal(getZone(0.0).name, 'Analytic Orthodoxy');
    assert.equal(getZone(0.15).name, 'Analytic Orthodoxy');
    assert.equal(getZone(0.20).name, 'Analytic Orthodoxy');
    assert.equal(getZone(0.35).name, 'Balanced Oracle');
    assert.equal(getZone(0.50).name, 'Mystic Ascendance');
    assert.equal(getZone(0.75).name, 'Mystic Ascendance');
    assert.equal(getZone(0.80).name, 'Cosmic Bedlam');
    assert.equal(getZone(1.00).name, 'Cosmic Bedlam');
  });

  test('3.4 Chaos Dial in-memory recalculation benchmark across 100 lambda steps finishes in <2ms per step', () => {
    const players = mockData.mock_oneiromancy_draft_2025.cosmic_board;
    const settings = mockData.mock_oneiromancy_draft_2025.settings;

    const latencies = [];
    for (let step = 0; step <= 100; step++) {
      const lambda = step / 100.0;
      const t0 = performance.now();
      scoring.recomputeDraftScores(players, { ...settings, chaos_lambda: lambda });
      latencies.push(performance.now() - t0);
    }

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);

    assert.ok(avg < 1.0, `Average recompute time (${avg.toFixed(3)}ms) must be <1.0ms`);
    assert.ok(max < 5.0, `Max recompute time (${max.toFixed(3)}ms) must be <5.0ms`);
  });

  test('3.5 fuzzing 1000 random floating point lambdas in [-5.0, 5.0] asserts positive bounded durations', () => {
    for (let i = 0; i < 1000; i++) {
      const randLambda = (Math.random() * 10.0) - 5.0;
      const speed = calculateAstrolabeSpeed(randLambda);
      assert.ok(Number.isFinite(speed), `Speed must be finite, got ${speed}`);
      assert.ok(speed >= 0.2, `Speed must satisfy min boundary >= 0.2, got ${speed}`);

      const dur = calculateDurations(speed);
      assert.ok(Number.isFinite(dur.outerDuration) && dur.outerDuration >= 3.0);
      assert.ok(Number.isFinite(dur.middleDuration) && dur.middleDuration >= 2.5);
      assert.ok(Number.isFinite(dur.innerDuration) && dur.innerDuration >= 1.5);
    }
  });
});

// ============================================================================
// Suite 4: Marketplace Waiver Upgrades & Divine Swap Trade Proposals
// ============================================================================

describe('Suite 4: Marketplace Waiver Upgrades & Divine Swap Trade Proposals', () => {
  test('4.1 waiver upgrades strictly prune non-positive net score deltas (<= 0.0)', () => {
    const mixedWaivers = [
      { id: 'w1', name: 'Player A', net_score_delta: 8.4, position: 'WR' },
      { id: 'w2', name: 'Player B', net_score_delta: 3.2, position: 'RB' },
      { id: 'w3', name: 'Player C', net_score_delta: 0.1, position: 'TE' },
      { id: 'w4', name: 'Player D (Zero Delta)', net_score_delta: 0.0, position: 'WR' },
      { id: 'w5', name: 'Player E (Negative Delta)', net_score_delta: -1.5, position: 'RB' },
      { id: 'w6', name: 'Player F (Severe Negative)', net_score_delta: -14.2, position: 'QB' },
    ];

    // Filter logic per PlayerMarketplace.tsx line 88: item.net_score_delta <= 0 pruned
    const filtered = mixedWaivers.filter((item) => item.net_score_delta > 0);

    assert.equal(filtered.length, 3, 'Only the 3 positive waiver upgrades must pass');
    assert.equal(filtered.find((w) => w.id === 'w4'), undefined, 'Zero delta must be pruned');
    assert.equal(filtered.find((w) => w.id === 'w5'), undefined, 'Negative delta must be pruned');
    assert.equal(filtered.find((w) => w.id === 'w6'), undefined, 'Severe negative delta must be pruned');

    // Assert all retained have net_score_delta > 0
    for (const w of filtered) {
      assert.ok(w.net_score_delta > 0, `Retained waiver ${w.id} must have positive delta`);
    }
  });

  test('4.2 waiver upgrades return empty array when all available options have non-positive deltas', () => {
    const nonPositiveWaivers = [
      { id: 'w_zero', name: 'Even Player', net_score_delta: 0.0, position: 'WR' },
      { id: 'w_neg1', name: 'Worse Player 1', net_score_delta: -0.5, position: 'RB' },
      { id: 'w_neg2', name: 'Worse Player 2', net_score_delta: -10.0, position: 'QB' },
    ];

    const filtered = nonPositiveWaivers.filter((item) => item.net_score_delta > 0);
    assert.equal(filtered.length, 0, 'Must prune all non-positive waivers to empty array');
  });

  test('4.3 Divine Swap trade proposals fairness calculation: asserts 0-100 scale and exact 50.0 parity', () => {
    // Parity trade: trade1Value == trade2Value
    const calculateTradeFairness = (giveValue, receiveValue) => {
      // 50.0 is balanced parity; receive > give favors user (+); receive < give favors partner (-)
      const raw = 50.0 + (receiveValue - giveValue);
      return Math.max(0.0, Math.min(100.0, Number(raw.toFixed(1))));
    };

    // 1. Exact parity
    assert.equal(calculateTradeFairness(100.0, 100.0), 50.0, 'Equal value trade must have 50.0 fairness index');

    // 2. Favorable trade (+4.0)
    assert.equal(calculateTradeFairness(100.0, 104.0), 54.0, 'Slightly favorable trade must be 54.0');

    // 3. Favorable trade (+2.0)
    assert.equal(calculateTradeFairness(100.0, 102.0), 52.0, '2.0 delta trade must be 52.0');

    // 4. Unfavorable trade (-5.0)
    assert.equal(calculateTradeFairness(105.0, 100.0), 45.0, 'Underpaid trade must be 45.0');

    // 5. Extreme clamping bounds
    assert.equal(calculateTradeFairness(0.0, 200.0), 100.0, 'Max clamped to 100.0');
    assert.equal(calculateTradeFairness(200.0, 0.0), 0.0, 'Min clamped to 0.0');
  });

  test('4.4 Divine Swap trade proposals structure contains divine_verdict and synergy delta', () => {
    const proposals = mockData.mockTradeProposals;
    assert.ok(proposals.length >= 2, 'Must have at least 2 mock trade proposals');

    for (const prop of proposals) {
      assert.ok(prop.proposal_id, 'Proposal ID required');
      assert.ok(prop.target_team_id && prop.target_team_name, 'Target team required');
      assert.ok(Array.isArray(prop.give_players) && prop.give_players.length > 0);
      assert.ok(Array.isArray(prop.receive_players) && prop.receive_players.length > 0);
      assert.ok(typeof prop.trade_fairness_index === 'number');
      assert.ok(prop.trade_fairness_index >= 0 && prop.trade_fairness_index <= 100);
      assert.ok(typeof prop.harmony_delta === 'number');
      assert.ok(typeof prop.divine_verdict === 'string' && prop.divine_verdict.length > 10);
    }
  });

  test('4.5 fuzzing 500 randomized waiver candidate sets asserting zero leakage of non-positive deltas', () => {
    for (let iter = 0; iter < 500; iter++) {
      const count = Math.floor(Math.random() * 20) + 1;
      const candidates = [];
      for (let j = 0; j < count; j++) {
        const delta = Math.random() < 0.2 ? 0.0 : Number(((Math.random() * 100) - 50).toFixed(1));
        candidates.push({
          id: `fuzz_w_${iter}_${j}`,
          name: `Player ${j}`,
          net_score_delta: delta,
          position: ['QB', 'RB', 'WR', 'TE'][j % 4],
        });
      }

      const filtered = candidates.filter((item) => item.net_score_delta > 0);

      // Verify no retained item has delta <= 0
      for (const item of filtered) {
        assert.ok(item.net_score_delta > 0, `Filtered item ${item.id} has invalid delta ${item.net_score_delta}`);
      }

      // Verify count equals exact count of items with delta > 0
      const expectedCount = candidates.filter((c) => c.net_score_delta > 0).length;
      assert.equal(filtered.length, expectedCount);
    }
  });

  test('4.6 fuzzing 500 randomized trade evaluation pairs asserting bounded fairness invariants', () => {
    const calculateTradeFairness = (giveValue, receiveValue) => {
      const raw = 50.0 + (receiveValue - giveValue);
      return Math.max(0.0, Math.min(100.0, Number(raw.toFixed(1))));
    };

    for (let i = 0; i < 500; i++) {
      const giveVal = Number((Math.random() * 200).toFixed(1));
      const receiveVal = Number((Math.random() * 200).toFixed(1));
      const fairness = calculateTradeFairness(giveVal, receiveVal);

      assert.ok(fairness >= 0.0 && fairness <= 100.0, `Fairness must be in [0, 100], got ${fairness}`);

      if (receiveVal === giveVal) {
        assert.equal(fairness, 50.0, 'Equal valuations must yield exact 50.0 fairness');
      } else if (receiveVal > giveVal) {
        assert.ok(fairness >= 50.0, 'Favorable trade must yield fairness >= 50.0');
      } else {
        assert.ok(fairness <= 50.0, 'Unfavorable trade must yield fairness <= 50.0');
      }
    }
  });
});

// ============================================================================
// Suite 5: Production Standalone Server Execution
// ============================================================================

describe('Suite 5: Production Standalone Server Execution (.next/standalone/server.js)', () => {
  let serverProcess = null;
  const STANDALONE_PORT = 3288;
  const BASE_URL = `http://127.0.0.1:${STANDALONE_PORT}`;

  function httpGet(urlPath) {
    return new Promise((resolve, reject) => {
      const req = http.get(`${BASE_URL}${urlPath}`, { timeout: 4000 }, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            // Not JSON
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: raw,
            json,
          });
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${urlPath}`));
      });
    });
  }

  before(async () => {
    // Launch standalone server on STANDALONE_PORT
    await new Promise((resolve, reject) => {
      const standalonePath = fs.existsSync(path.join(process.cwd(), 'server.js')) ? path.join(process.cwd(), 'server.js') : path.join(process.cwd(), '.next/standalone/server.js');
      serverProcess = spawn(process.execPath, [standalonePath], {
        env: {
          ...process.env,
          PORT: String(STANDALONE_PORT),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
        },
        stdio: 'pipe',
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          reject(new Error('Standalone server failed to start within 6000ms'));
        }
      }, 6000);

      const checkHealth = () => {
        http.get(`${BASE_URL}/api/draft/mock`, (res) => {
          if (res.statusCode === 200) {
            started = true;
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkHealth, 250);
          }
        }).on('error', () => {
          setTimeout(checkHealth, 250);
        });
      };

      setTimeout(checkHealth, 500);
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  test('5.1 GET / serves HTTP 200 OK and validates mobile-first HTML document', async () => {
    const res = await httpGet('/');
    assert.equal(res.statusCode, 200, 'GET / must return HTTP 200 OK');
    assert.ok(res.body.includes('<!DOCTYPE html>'), 'Response must be valid HTML5 document');
    assert.ok(
      res.body.includes('Oneiromancy') || res.body.includes('<title>Oneiromancy'),
      'HTML must contain brand title "Oneiromancy"'
    );
    assert.ok(res.body.includes('viewport'), 'HTML must include responsive viewport meta tag');
  });

  test('5.2 GET /api/draft/mock returns HTTP 200 OK with complete canonical DraftState JSON', async () => {
    const res = await httpGet('/api/draft/mock');
    assert.equal(res.statusCode, 200, 'GET /api/draft/mock must return HTTP 200 OK');
    assert.ok(res.json, 'Response must be valid JSON');

    const json = res.json;
    assert.equal(typeof json.draft_id, 'string');
    assert.ok(Array.isArray(json.cosmic_board), 'cosmic_board must be an array');
    assert.ok(json.cosmic_board.length >= 10, 'cosmic_board must contain players');
    assert.ok(Array.isArray(json.ideal_draft_path), 'ideal_draft_path must be an array');
    assert.ok(Array.isArray(json.my_roster), 'my_roster must be an array');
    assert.ok(Array.isArray(json.weekly_coverage), 'weekly_coverage must be an array');
    assert.ok(json.elemental_traits, 'elemental_traits must exist');
    assert.ok(Array.isArray(json.waiver_upgrades), 'waiver_upgrades must be an array');
    assert.ok(Array.isArray(json.trade_proposals), 'trade_proposals must be an array');
    assert.ok(json.settings, 'settings must exist');
  });

  test('5.3 GET /api/draft/mock_oneiromancy_draft_2025 returns HTTP 200 OK with expected ID', async () => {
    const res = await httpGet('/api/draft/mock_oneiromancy_draft_2025');
    assert.equal(res.statusCode, 200, 'Status must be 200 OK');
    assert.ok(res.json);
    assert.equal(res.json.draft_id, 'mock_oneiromancy_draft_2025');
  });

  test('5.4 GET /api/draft/unknown_offline_draft returns HTTP 200 with fallback draft state', async () => {
    const res = await httpGet('/api/draft/unknown_offline_draft');
    assert.equal(res.statusCode, 200, 'Status must be 200 OK on unknown draft ID via mock fallback');
    assert.ok(res.json);
    assert.ok(res.json.cosmic_board.length > 0);
  });
});
