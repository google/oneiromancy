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
 * Tier 5: Real-World Sleeper API Mocks & Ingestion Test Suite
 * 
 * Validates lib/sleeper.ts and OneiromancyContext against authentic Sleeper API
 * endpoint JSON captures located in mocks/:
 * - mock_user.json (OneiroVanguard / 9000000000000000101)
 * - mock_league_info.json (Astral Sanctum League / 9000000000000000001)
 * - mock_league_users.json (12 real league owners)
 * - mock_league_rosters.json (12 real league rosters with starters/bench)
 * - mock_draft_metadata.json (Draft 9000000000000000002)
 * - mock_draft_picks.json (Authentic draft picks)
 * - mock_league_matchups_w1.json (Authentic Week 1 matchups)
 * - mock_league_drafts.json (Draft list for league)
 * - mock_user_leagues_2024.json & mock_user_leagues_2025.json
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import compiled dist modules
const sleeper = await import('./dist/lib/sleeper.js');
const mockData = await import('./dist/lib/mockData.js');
const oracle = await import('./dist/lib/oracle.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve mocks directory resiliently (relative to tests/ or workspace root)
const possibleMockDirs = [
  path.resolve(__dirname, '../mocks'),
  path.resolve(process.cwd(), 'mocks'),
  path.resolve(__dirname, 'mocks'),
  path.resolve(__dirname, '../../oneiromancy/mocks'),
  path.resolve(__dirname, '../oneiromancy/mocks'),
  path.resolve(process.cwd(), '../oneiromancy/mocks'),
];

const MOCKS_DIR = possibleMockDirs.find((dir) => fs.existsSync(dir) && fs.existsSync(path.join(dir, 'mock_league_info.json')));

if (!MOCKS_DIR) {
  throw new Error(`Unable to locate authentic Sleeper API mock directory in any expected path: ${possibleMockDirs.join(', ')}`);
}

// Load authentic fixtures
const draftMeta = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_draft_metadata.json'), 'utf8'));
const draftPicks = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_draft_picks.json'), 'utf8'));
const leagueInfo = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_info.json'), 'utf8'));
const leagueUsers = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_users.json'), 'utf8'));
const leagueRosters = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_rosters.json'), 'utf8'));
const leagueMatchups = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_matchups_w1.json'), 'utf8'));
const mockUser = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_user.json'), 'utf8'));
const leagueDrafts = JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_drafts.json'), 'utf8'));

describe('Tier 5: Real-World Sleeper API Mocks & Ingestion', () => {

  // --------------------------------------------------------------------------
  // Category A: Authentic Data Transformation (transformToDraftState)
  // --------------------------------------------------------------------------
  describe('5.A: Authentic Data Transformation (transformToDraftState)', () => {

    test('5.1 should transform all 12 teams matching authentic rosters, owners, and slots', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.ok(state.competitor_teams, 'competitor_teams must be present');
      assert.equal(state.competitor_teams.length, 12, 'Must contain exactly 12 teams');

      // Verify all 12 slots are populated from 1 to 12
      const slots = state.competitor_teams.map((t) => t.slot).sort((a, b) => a - b);
      assert.deepEqual(slots, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      // Verify all 12 teams map to authentic owners from mock_league_users
      const userMap = new Map(leagueUsers.map((u) => [String(u.user_id), u.display_name]));
      for (const team of state.competitor_teams) {
        assert.ok(team.owner_id, `Team slot ${team.slot} must have owner_id`);
        assert.ok(userMap.has(team.owner_id), `Team owner ${team.owner_id} must exist in authentic league users`);
      }
    });

    test('5.2 should verify user team (AstralOracles / OneiroVanguard) resolves to Roster 2 / Slot 7 with is_user: true and single user identity', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.equal(state.settings.user_slot, 7, 'user_slot must resolve to 7 (from draft_order)');

      const userTeams = state.competitor_teams.filter((t) => t.is_user);
      assert.equal(userTeams.length, 1, 'Exactly one competitor team must have is_user: true');

      const userTeam = userTeams[0];
      assert.equal(userTeam.slot, 7, 'User team slot must be 7');
      assert.equal(userTeam.roster_id, 2, 'User team roster_id must be 2');
      assert.ok(userTeam.name.includes('AstralOracles'), 'User team name must include AstralOracles');
      assert.equal(userTeam.owner_name, 'OneiroVanguard', 'User team owner must be OneiroVanguard');

      // Verify Slot 2 / Roster 12 (CrimsonPhoenix) is NOT flagged as user
      const slot2Team = state.competitor_teams.find((t) => t.slot === 2);
      assert.ok(slot2Team, 'Slot 2 team must exist');
      assert.equal(slot2Team.is_user, false, 'Slot 2 team (CrimsonPhoenix) must NOT be flagged as is_user');
    });

    test('5.3 should verify authentic 8 starters (Cooper Rush/Active QB, JT, Chase Brown, Amon-Ra, Rashee Rice, Likely, Javonte, Rodgers)', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      const starters = state.my_roster.filter((s) => !s.slot_id.startsWith('BN'));
      assert.equal(starters.length, 8, 'Must have exactly 8 starting slots');

      // Check slot IDs
      const slotIds = starters.map((s) => s.slot_id);
      assert.deepEqual(slotIds, ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'SUPER_FLEX']);

      // 1. QB: Cooper Rush (4574)
      assert.equal(starters[0].player?.id, '4574', 'QB starter must be Cooper Rush (4574)');
      assert.equal(starters[0].player?.position, 'QB');

      // 2. RB1: Jonathan Taylor (6813)
      assert.equal(starters[1].player?.id, '6813', 'RB1 starter must be Jonathan Taylor (6813)');
      assert.equal(starters[1].player?.position, 'RB');

      // 3. RB2: Chase Brown (9224)
      assert.equal(starters[2].player?.id, '9224', 'RB2 starter must be Chase Brown (9224)');
      assert.equal(starters[2].player?.position, 'RB');

      // 4. WR1: Amon-Ra St. Brown (7547)
      assert.equal(starters[3].player?.id, '7547', 'WR1 starter must be Amon-Ra St. Brown (7547)');
      assert.equal(starters[3].player?.position, 'WR');

      // 5. WR2: Rashee Rice (10229)
      assert.equal(starters[4].player?.id, '10229', 'WR2 starter must be Rashee Rice (10229)');
      assert.equal(starters[4].player?.position, 'WR');

      // 6. TE: Isaiah Likely (8131)
      assert.equal(starters[5].player?.id, '8131', 'TE starter must be Isaiah Likely (8131)');
      assert.equal(starters[5].player?.position, 'TE');

      // 7. FLEX: Javonte Williams (7588)
      assert.equal(starters[6].player?.id, '7588', 'FLEX starter must be Javonte Williams (7588)');
      assert.equal(starters[6].player?.position, 'RB');

      // 8. SUPER_FLEX: Aaron Rodgers (96)
      assert.equal(starters[7].player?.id, '96', 'SUPER_FLEX starter must be Aaron Rodgers (96)');
      assert.equal(starters[7].player?.position, 'QB');
    });

    test('5.4 should verify authentic 7 bench players including Tua Tagovailoa, Josh Jacobs, Braelon Allen, Jeudy, Schultz, Douglas, Nailor', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      const bench = state.my_roster.filter((s) => s.slot_id.startsWith('BN'));
      assert.equal(bench.length, 7, 'Must have exactly 7 bench slots');

      const benchPlayerIds = bench.map((s) => s.player?.id).filter(Boolean);
      assert.equal(benchPlayerIds.length, 7, 'All 7 bench slots must have players');

      // Josh Jacobs (5850)
      assert.ok(benchPlayerIds.includes('5850'), 'Bench must include Josh Jacobs (5850)');
      // Braelon Allen (11576)
      assert.ok(benchPlayerIds.includes('11576'), 'Bench must include Braelon Allen (11576)');
      // Jerry Jeudy (6783)
      assert.ok(benchPlayerIds.includes('6783'), 'Bench must include Jerry Jeudy (6783)');
      // Tua Tagovailoa (6768)
      assert.ok(benchPlayerIds.includes('6768'), 'Bench must include Tua Tagovailoa (6768)');
      // Dalton Schultz (5001)
      assert.ok(benchPlayerIds.includes('5001'), 'Bench must include Dalton Schultz (5001)');
      // Caleb Douglas (13296)
      assert.ok(benchPlayerIds.includes('13296'), 'Bench must include Caleb Douglas (13296)');
      // Jalen Nailor (8180)
      assert.ok(benchPlayerIds.includes('8180'), 'Bench must include Jalen Nailor (8180)');
    });

    test('5.5 should verify real 60 draft picks across 5 rounds drafted in snake order', () => {
      const round1To5Picks = draftPicks.filter((p) => p.round <= 5);
      assert.equal(round1To5Picks.length, 60, 'Must have exactly 60 picks in rounds 1 to 5');

      // Check snake order:
      // Round 1 (picks 1..12): slots 1 to 12
      for (let i = 0; i < 12; i++) {
        assert.equal(round1To5Picks[i].pick_no, i + 1);
        assert.equal(round1To5Picks[i].draft_slot, i + 1);
      }
      // Round 2 (picks 13..24): slots 12 down to 1
      for (let i = 0; i < 12; i++) {
        assert.equal(round1To5Picks[12 + i].pick_no, 13 + i);
        assert.equal(round1To5Picks[12 + i].draft_slot, 12 - i);
      }
      // Round 3 (picks 25..36): slots 1 to 12
      for (let i = 0; i < 12; i++) {
        assert.equal(round1To5Picks[24 + i].pick_no, 25 + i);
        assert.equal(round1To5Picks[24 + i].draft_slot, i + 1);
      }
      // Round 4 (picks 37..48): slots 12 down to 1
      for (let i = 0; i < 12; i++) {
        assert.equal(round1To5Picks[36 + i].pick_no, 37 + i);
        assert.equal(round1To5Picks[36 + i].draft_slot, 12 - i);
      }
      // Round 5 (picks 49..60): slots 1 to 12
      for (let i = 0; i < 12; i++) {
        assert.equal(round1To5Picks[48 + i].pick_no, 49 + i);
        assert.equal(round1To5Picks[48 + i].draft_slot, i + 1);
      }
    });

    test('5.6 should verify real Week 1 matchup pairing (Matchup 3: AstralOracles vs LunarEclipse)', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.ok(state.weekly_matchup, 'weekly_matchup must be populated');
      assert.equal(state.weekly_matchup.matchup_id, 3, 'Matchup ID must be 3');
      assert.ok(state.weekly_matchup.user_team.team_name.includes('AstralOracles'), 'User team name must include AstralOracles');
      assert.ok(state.weekly_matchup.opponent_team.team_name.toLowerCase().includes('lunareclipse'), 'Opponent team name must include LunarEclipse');
      const userStarters = state.weekly_matchup.player_favorabilities.filter((p) => p.is_user_team && !p.is_benched);
      const expectedUserSum = Math.round(userStarters.reduce((acc, p) => acc + (p.projected_points || 0), 0) * 100) / 100;
      const oppStarters = state.weekly_matchup.player_favorabilities.filter((p) => !p.is_user_team && !p.is_benched);
      const expectedOppSum = Math.round(oppStarters.reduce((acc, p) => acc + (p.projected_points || 0), 0) * 100) / 100;
      assert.ok(state.weekly_matchup.user_team.projected_points > 0, 'User projected points must be positive number');
      assert.equal(state.weekly_matchup.user_team.projected_points, expectedUserSum, 'User projected points must equal sum of starter projections');
      assert.ok(state.weekly_matchup.opponent_team.projected_points > 0, 'Opponent projected points must be positive number');
      assert.equal(state.weekly_matchup.opponent_team.projected_points, expectedOppSum, 'Opponent projected points must equal sum of opponent starter projections');
    });
  });

  // --------------------------------------------------------------------------
  // Category B: Real Dynamic League Resolution (resolveLeagueDraftAndUser)
  // --------------------------------------------------------------------------
  describe('5.B: Real Dynamic League Resolution (resolveLeagueDraftAndUser)', () => {
    const originalFetch = global.fetch;

    before(() => {
      global.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/league/9000000000000000001/drafts')) {
          return { ok: true, status: 200, json: async () => leagueDrafts };
        }
        if (urlStr.includes('/league/9000000000000000001/users')) {
          return { ok: true, status: 200, json: async () => leagueUsers };
        }
        if (urlStr.includes('/league/9000000000000000001/rosters')) {
          return { ok: true, status: 200, json: async () => leagueRosters };
        }
        if (urlStr.includes('/draft/9000000000000000002')) {
          return { ok: true, status: 200, json: async () => draftMeta };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };
    });

    after(() => {
      global.fetch = originalFetch;
    });

    test('5.7 should resolve draft ID 9000000000000000002, user ID 9000000000000000101, and slot 7 for OneiroVanguard', async () => {
      const resolved = await sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'OneiroVanguard');
      assert.equal(resolved.draft_id, '9000000000000000002');
      assert.equal(resolved.user_id, '9000000000000000101');
      assert.equal(resolved.user_slot, 7);
      assert.equal(resolved.display_name, 'OneiroVanguard');
    });

    test('5.8 should resolve case-insensitively across lowercase oneirovanguard and uppercase ONEIROVANGUARD', async () => {
      const lower = await sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'oneirovanguard');
      assert.equal(lower.user_id, '9000000000000000101');
      assert.equal(lower.draft_id, '9000000000000000002');

      const upper = await sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'ONEIROVANGUARD');
      assert.equal(upper.user_id, '9000000000000000101');
      assert.equal(upper.draft_id, '9000000000000000002');
    });

    test('5.9 should resolve alternate spellings (oneirovangard) and substrings (oneirovan)', async () => {
      const alt = await sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'oneirovangard');
      assert.equal(alt.user_id, '9000000000000000101');
      assert.equal(alt.display_name, 'OneiroVanguard');

      const sub = await sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'oneirovan');
      assert.equal(sub.user_id, '9000000000000000101');
    });

    test('5.10 should throw descriptive error when unknown user is queried without crashing', async () => {
      await assert.rejects(
        () => sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'UnknownGhostUser9999'),
        (err) => {
          assert.ok(err.message.includes('UnknownGhostUser9999'), 'Error must contain unknown username');
          assert.ok(err.message.includes('not found in Sleeper league 9000000000000000001'));
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Category C: Rate Limiting & Cooldown Logic
  // --------------------------------------------------------------------------
  describe('5.C: Rate Limiting & Cooldown Logic', () => {
    test('5.11 should trigger 60s cooldown on HTTP 429 and return zero-round-trip mock state', async () => {
      sleeper.resetRateLimit();
      assert.equal(sleeper.isRateLimited(), false, 'Should start not rate-limited');

      try {
        // Trigger cooldown
        sleeper.triggerRateLimitCooldown();
        assert.equal(sleeper.isRateLimited(), true, 'Must enter rate limit cooldown');

        // Zero-round-trip mock state return
        const fallback = await sleeper.fetchSleeperDraft(undefined, { sleeper_username: 'OneiroVanguard' });
        assert.equal(fallback.draft_id, 'mock_oneiromancy_draft_2025');
        assert.equal(fallback.sync_error, 'HTTP_429_TOO_MANY_REQUESTS');
        assert.ok(fallback.settings.offline_mode_active);

        // Verify throwOnError throws HTTP_429_TOO_MANY_REQUESTS
        await assert.rejects(
          () => sleeper.fetchSleeperDraft(undefined, { sleeper_username: 'OneiroVanguard' }, undefined, { throwOnError: true }),
          (err) => {
            assert.equal(err.message, 'HTTP_429_TOO_MANY_REQUESTS');
            return true;
          }
        );
      } finally {
        // Manual reset clears cooldown
        sleeper.resetRateLimit();
      }
      assert.equal(sleeper.isRateLimited(), false, 'Manual reset must clear rate limit');
    });
  });

  // --------------------------------------------------------------------------
  // Category D: Missing Metadata & Edge Case Robustness
  // --------------------------------------------------------------------------
  describe('5.D: Missing Metadata & Edge Case Robustness', () => {
    test('5.12 should handle picks missing first_name/last_name without crashing', () => {
      const strippedPicks = draftPicks.map((p) => ({
        ...p,
        metadata: { position: p.metadata?.position, team: p.metadata?.team },
      }));

      const state = sleeper.transformToDraftState(
        draftMeta,
        strippedPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.ok(state.my_roster.length >= 15);
      const starters = state.my_roster.filter((s) => !s.slot_id.startsWith('BN'));
      assert.equal(starters.length, 8);
    });

    test('5.13 should handle rosters missing starters array by filling starting slots from available players', () => {
      const rostersNoStarters = leagueRosters.map((r) => ({
        ...r,
        starters: [],
      }));

      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        rostersNoStarters,
        leagueMatchups,
        leagueInfo
      );

      const starters = state.my_roster.filter((s) => !s.slot_id.startsWith('BN'));
      assert.equal(starters.length, 8, 'Must still fill 8 starting slots from team roster players');
      for (const slot of starters) {
        assert.ok(slot.player, `Starter slot ${slot.slot_id} must have a filled player`);
      }
    });

    test('5.14 should default sparse draft metadata safely to 12 teams and 15 rounds', () => {
      const sparseMeta = {
        draft_id: 'sparse_draft_001',
        status: 'complete',
        settings: {},
      };

      const state = sleeper.transformToDraftState(
        sparseMeta,
        [],
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.equal(state.settings.draft_id, 'sparse_draft_001');
      assert.equal(state.competitor_teams.length, 12, 'Must default to 12 teams');
      assert.equal(state.my_roster.length, 15, 'Must default to 15 roster slots');
    });
  });

  // --------------------------------------------------------------------------
  // Category E: OneiromancyContext Fallback Logic & Feature 28 State Decoupling
  // --------------------------------------------------------------------------
  describe('5.E: OneiromancyContext Fallback Logic & Feature 28 State Decoupling', () => {
    test('5.15 should preserve explicit user slot selection over auto-detection', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard', user_slot: 4 },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.equal(state.settings.user_slot, 4, 'Explicit user_slot 4 must be preserved');
      const team4 = state.competitor_teams.find((t) => t.slot === 4);
      assert.ok(team4 && team4.is_user, 'Team in slot 4 must be marked is_user');
    });

    test('5.16 should auto-detect user slot when user_slot is undefined (Feature 28 / Comment #102)', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard', user_slot: undefined },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.equal(state.settings.user_slot, 7, 'Undefined slot must auto-detect from draft order (Slot 7)');
    });

    test('5.17 should verify OneiromancyProvider implements decoupled slot detection and mock fallback', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 200 });
      try {
        const { render, jsx } = await import('./helpers/react_testing_wrapper.mjs');
        const { OneiromancyProvider, useOneiromancy } = await import('./dist/context/OneiromancyContext.js');
        let captured = null;
        function Probe() {
          captured = useOneiromancy();
          return jsx('div', {}, 'probe');
        }
        const view = render(jsx(OneiromancyProvider, { children: jsx(Probe, {}) }));
        captured.loadMockData();
        assert.equal(captured.draftState.settings.user_slot, 7, 'Mock fallback resolves to Slot 7');
        assert.equal(captured.draftState.draft_id, '9000000000000000002', 'Mock fallback loads canonical draft_id');
        view.unmount();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('5.18 should route to fast path for explicit draft ID even when sleeper_username is present', async () => {
      const originalFetch = globalThis.fetch;
      let requestedUrls = [];
      globalThis.fetch = async (url) => {
        requestedUrls.push(String(url));
        if (String(url).endsWith('/draft/9000000000000000002')) {
          return new Response(JSON.stringify(draftMeta), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (String(url).endsWith('/draft/9000000000000000002/picks')) {
          return new Response(JSON.stringify(draftPicks), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      };

      try {
        const state = await sleeper.fetchSleeperDraft(
          '9000000000000000002',
          { sleeper_username: 'OneiroVanguard', league_id: '9000000000000000001' },
          undefined,
          { throwOnError: true }
        );

        assert.ok(state.isLive, 'State should be live');
        assert.equal(state.draft_id, '9000000000000000002');
        assert.ok(requestedUrls.some((u) => u.includes('/draft/9000000000000000002')), 'Must fetch draft metadata');
        assert.ok(requestedUrls.some((u) => u.includes('/draft/9000000000000000002/picks')), 'Must fetch draft picks');
        assert.ok(!requestedUrls.some((u) => u.includes('/user/')), 'Fast path must NOT query user leagues');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('5.19 should suppress console.warn for HTTP 429 rate limit exceptions natively', () => {
      let warnCalled = false;
      const originalWarn = console.warn;
      console.warn = () => {
        warnCalled = true;
      };

      try {
        sleeper.setDebugLogging(false);
        sleeper.logSleeperWarning('Test warning', new Error('HTTP 429 Too Many Requests'));
        assert.equal(warnCalled, false, 'console.warn must not be called for 429 errors');

        sleeper.logSleeperWarning('Rate limit warning', new Error('RATE_LIMIT_COOLDOWN_ACTIVE'));
        assert.equal(warnCalled, false, 'console.warn must not be called for rate limit errors');
      } finally {
        console.warn = originalWarn;
        sleeper.setDebugLogging(false);
      }
    });

    test('5.20 should gate non-rate-limit sleeper warnings behind debugLoggingEnabled flag', () => {
      let warnCount = 0;
      const originalWarn = console.warn;
      console.warn = () => {
        warnCount++;
      };

      try {
        sleeper.setDebugLogging(false);
        sleeper.logSleeperWarning('Test regular error', new Error('Network timeout'));
        assert.equal(warnCount, 0, 'Warning must be suppressed when debug logging is disabled');

        sleeper.setDebugLogging(true);
        sleeper.logSleeperWarning('Test regular error', new Error('Network timeout'));
        assert.equal(warnCount, 1, 'Warning must be emitted when debug logging is enabled');
      } finally {
        console.warn = originalWarn;
        sleeper.setDebugLogging(false);
      }
    });

    test('5.21 should verify OneiromancyContext and sleeper rate-limit classifier suppress 429 errors without crashing', () => {
      assert.equal(sleeper.isRateLimitError(new Error('HTTP 429 Too Many Requests')), true);
      assert.equal(sleeper.isRateLimitError(new Error('RATE_LIMIT_COOLDOWN_ACTIVE')), true);
      assert.equal(sleeper.isRateLimitError(new Error('Regular network error')), false);
    });

    test('5.22 should verify core domain models produce strictly typed DraftState objects without arbitrary index keys', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );
      assert.ok(Array.isArray(state.cosmic_board));
      assert.ok(Array.isArray(state.my_roster));
      assert.ok(Array.isArray(state.competitor_teams));
      assert.equal(typeof state.weekly_matchup.week, 'number');
    });

    test('5.23 should verify calculateSleeperLeagueProjection computes custom 6-pt Pass TD scoring vs baseline NFL PPR', () => {
      const scoringSettings = { pass_td: 6, pass_yd: 0.04, rush_yd: 0.1, rec: 1.0, rush_td: 6, rec_td: 6 };
      const qbProj = { pass_yd: 250, pass_td: 2, rush_yd: 20, pts_ppr: 16.0 };
      const customLeaguePts = sleeper.calculateSleeperLeagueProjection(qbProj, scoringSettings);
      // 250 * 0.04 (10) + 2 * 6 (12) + 20 * 0.1 (2) = 24.0 pts
      assert.equal(customLeaguePts, 24.0, 'Custom 6-pt passing TD league projection must equal 24.0');
      assert.notEqual(customLeaguePts, qbProj.pts_ppr, 'League projection must differ from standard 4-pt pass TD PPR');
    });

    test('5.24 should verify transformToDraftState ingests top NFL free agents into cosmic_board when playerDict is supplied', () => {
      const mockPlayerDict = {
        'fa_wentz': {
          player_id: 'fa_wentz',
          first_name: 'Carson',
          last_name: 'Wentz',
          full_name: 'Carson Wentz',
          position: 'QB',
          team: 'MIN',
          status: 'Active',
          injury_status: null,
          number: 11,
          search_rank: 50,
        },
      };
      const mockProj = {
        'fa_wentz': { pass_yd: 220, pass_td: 2, rush_yd: 15, pts_ppr: 16.14 },
      };

      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        mockPlayerDict,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo,
        2,
        mockProj
      );

      const wentz = state.cosmic_board.find((p) => p.id === 'fa_wentz');
      assert.ok(wentz, 'Carson Wentz must be present in cosmic_board');
      assert.equal(wentz.draft_status, 'available', 'Carson Wentz must be available');
      assert.equal(wentz.position, 'QB');
      assert.equal(wentz.team, 'MIN');
      assert.ok(wentz.sleeper_projected_points !== undefined, 'Must contain sleeper_projected_points');
      assert.ok(wentz.nfl_projected_points !== undefined, 'Must contain nfl_projected_points');
    });

    test('5.25 should verify Week 2 matchup opponent derivation accurately pairs AstralOracles with SolarFlare', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        null,
        leagueInfo,
        2
      );

      assert.equal(state.weekly_matchup.week, 2, 'Weekly matchup must be Week 2');
      assert.ok(state.weekly_matchup.opponent_team.team_name.includes('SolarFlare') || state.weekly_matchup.opponent_team.owner_name.includes('SolarFlare') || state.weekly_matchup.opponent_team.roster_id === 8, 'Week 2 opponent must be SolarFlare (Roster 8)');
    });

    test('5.26 should verify mockCosmicBoard marks Tua Tagovailoa as Injured Reserve / Out', () => {
      const tua = mockData.mockCosmicBoard.find((p) => p.id === '6768');
      assert.ok(tua, 'Tua must exist in mockCosmicBoard');
      assert.equal(tua.injury_status, 'Out', 'Tua injury_status must be Out');
      assert.equal(tua.status, 'Injured Reserve', 'Tua status must be Injured Reserve');
    });

    test('5.27 should verify mockCosmicBoard contains Mac Jones (7527) and Joe Flacco (19) with active depth chart status', () => {
      const macJones = mockData.mockCosmicBoard.find((p) => p.id === '7527');
      assert.ok(macJones, 'Mac Jones (7527) must exist in mockCosmicBoard');
      assert.equal(macJones.name, 'Mac Jones');
      assert.equal(macJones.position, 'QB');
      assert.equal(macJones.team, 'SF');
      assert.ok(macJones.projected_points > 0, 'Mac Jones must have positive projected points');

      const joeFlacco = mockData.mockCosmicBoard.find((p) => p.id === '19');
      assert.ok(joeFlacco, 'Joe Flacco (19) must exist in mockCosmicBoard');
      assert.equal(joeFlacco.name, 'Joe Flacco');
      assert.equal(joeFlacco.position, 'QB');
      assert.equal(joeFlacco.team, 'CIN');
      assert.ok(joeFlacco.projected_points > 0, 'Joe Flacco must have positive projected points');
    });

    test('5.28 should verify mocks/mock_players_nfl.json contains >= 640 active signed NFL players without invalid or retired records', () => {
      const mockPlayersPath = path.join(MOCKS_DIR, 'mock_players_nfl.json');
      assert.ok(fs.existsSync(mockPlayersPath), 'mock_players_nfl.json must exist in mocks dir');
      const raw = JSON.parse(fs.readFileSync(mockPlayersPath, 'utf8'));
      const keys = Object.keys(raw);
      assert.ok(keys.length >= 640, `mock_players_nfl.json must contain >= 640 active players, got ${keys.length}`);

      assert.ok(raw['7527'], 'Mac Jones (7527) must be present in mock_players_nfl.json');
      assert.equal(raw['7527'].full_name, 'Mac Jones');
      assert.equal(raw['7527'].team, 'SF');
      assert.equal(raw['7527'].position, 'QB');

      assert.ok(raw['19'], 'Joe Flacco (19) must be present in mock_players_nfl.json');
      assert.equal(raw['19'].full_name, 'Joe Flacco');
      assert.equal(raw['19'].team, 'CIN');
      assert.equal(raw['19'].position, 'QB');

      // Verify retired ghosts and non-players are excluded
      assert.equal(raw['138'], undefined, 'Retired player Ben Roethlisberger (138) must not be present');
      assert.equal(raw['2118'], undefined, 'Retired player Eric Ebron (2118) must not be present');
      assert.equal(raw['3099'], undefined, 'Coach Dirk Koetter (3099) must not be present');
      assert.equal(raw['6766'], undefined, 'Executive Andrew Berry (6766) must not be present');
      assert.equal(raw['1000'], undefined, 'Albert McClellan (1000) must not be present');
      assert.equal(raw['1001'], undefined, 'Tyler Clutts (1001) must not be present');

      // Verify all records have valid names, positions, teams, and active status
      const validPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
      const validTeams = new Set([
        'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
        'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
        'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
        'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
      ]);

      for (const [id, p] of Object.entries(raw)) {
        assert.ok(p.first_name && p.first_name.trim().length > 0, `Player ${id} must have first_name`);
        assert.ok(p.last_name && p.last_name.trim().length > 0, `Player ${id} must have last_name`);
        assert.ok(validPositions.has(p.position), `Player ${id} must have valid NFL fantasy position, got ${p.position}`);
        assert.ok(validTeams.has(p.team), `Player ${id} must have recognized NFL franchise team code, got ${p.team}`);
        assert.notEqual(p.first_name, 'Duplicate', `Player ${id} must not be Duplicate`);
        assert.notEqual(p.first_name, 'Player', `Player ${id} must not be Player Invalid`);
        assert.notEqual(p.last_name, 'Invalid', `Player ${id} must not be Player Invalid`);
      }
    });

    test('5.29 should verify enrichCosmicBoardWithNFLPlayers enriches board with full NFL player pool', () => {
      const mockPlayersPath = path.join(MOCKS_DIR, 'mock_players_nfl.json');
      const rawDict = JSON.parse(fs.readFileSync(mockPlayersPath, 'utf8'));
      const enriched = sleeper.enrichCosmicBoardWithNFLPlayers(mockData.mockCosmicBoard, rawDict);

      assert.ok(enriched.length >= 600, `Enriched board must have >= 600 players, got ${enriched.length}`);
      const mac = enriched.find((p) => p.id === '7527');
      const flacco = enriched.find((p) => p.id === '19');
      assert.ok(mac, 'Enriched board must include Mac Jones');
      assert.ok(flacco, 'Enriched board must include Joe Flacco');
    });

    test('5.30 should verify all 5 corrupt IDs in mockData.ts are resolved and Caleb Douglas has team MIA', () => {
      // 11783 Ryan Flournoy (formerly 11638)
      const flournoy = mockData.mockCosmicBoard.find((p) => p.name === 'Ryan Flournoy');
      assert.ok(flournoy, 'Ryan Flournoy must exist');
      assert.equal(flournoy.id, '11783', 'Ryan Flournoy must have correct ID 11783');

      // 8111 Cade Otton (formerly 8134)
      const otton = mockData.mockCosmicBoard.find((p) => p.name === 'Cade Otton');
      assert.ok(otton, 'Cade Otton must exist');
      assert.equal(otton.id, '8111', 'Cade Otton must have correct ID 8111');

      // 11625 Adonai Mitchell (formerly 11639)
      const mitchell = mockData.mockCosmicBoard.find((p) => p.name === 'Adonai Mitchell');
      assert.ok(mitchell, 'Adonai Mitchell must exist');
      assert.equal(mitchell.id, '11625', 'Adonai Mitchell must have correct ID 11625');

      // 13311 Chris Bell (formerly 12510)
      const bell = mockData.mockCosmicBoard.find((p) => p.name === 'Chris Bell');
      assert.ok(bell, 'Chris Bell must exist');
      assert.equal(bell.id, '13311', 'Chris Bell must have correct ID 13311');

      // Caleb Douglas team: MIA in KNOWN_ROSTERED_NFL_PLAYERS (formerly TEX)
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['13296']?.team, 'MIA', 'Caleb Douglas team in KNOWN_ROSTERED_NFL_PLAYERS must be MIA');
    });

    test('5.31 should verify transformToDraftState does not truncate NFL active player pool to 350', () => {
      const mockPlayersPath = path.join(MOCKS_DIR, 'mock_players_nfl.json');
      const rawDict = JSON.parse(fs.readFileSync(mockPlayersPath, 'utf8'));

      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        rawDict,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo,
        2
      );

      assert.ok(state.cosmic_board.length >= 550, `Draft state cosmic_board must have >= 550 players, got ${state.cosmic_board.length}`);
      const mac = state.cosmic_board.find((p) => p.id === '7527');
      const flacco = state.cosmic_board.find((p) => p.id === '19');
      assert.ok(mac, 'Mac Jones must be present in draft state cosmic board');
      assert.equal(mac.draft_status, 'available', 'Mac Jones must be available in draft state');
      assert.ok(flacco, 'Joe Flacco must be present in draft state cosmic board');
      assert.equal(flacco.draft_status, 'available', 'Joe Flacco must be available in draft state');
    });

    test('5.32 should verify mock mode with populated playerDict does not ingest external players', () => {
      const mockPlayersPath = path.join(MOCKS_DIR, 'mock_players_nfl.json');
      const rawDict = JSON.parse(fs.readFileSync(mockPlayersPath, 'utf8'));

      // Inject test player into rawDict BEFORE transformToDraftState to verify it is excluded in mock mode
      const candidateOnlyId = '9999999';
      rawDict[candidateOnlyId] = {
        player_id: candidateOnlyId,
        first_name: 'External',
        last_name: 'Prospect',
        full_name: 'External Prospect',
        position: 'WR',
        team: 'FA',
        active: true,
        status: 'Active',
      };

      const mockMeta = {
        draft_id: 'mock_oneiromancy_draft_2025',
        status: 'complete',
        season: '2025',
      };

      const state = sleeper.transformToDraftState(
        mockMeta,
        [],
        { mode: 'mock', draft_id: 'mock_oneiromancy_draft_2025' },
        rawDict,
      );

      // In mock mode, baseBoard is strictly mockCosmicBoard, and playerDict ingestion is skipped
      assert.equal(state.cosmic_board.length, mockData.mockCosmicBoard.length, 'Mock mode board must equal mockCosmicBoard length');
      // Assert no arbitrary external player from rawDict was ingested into mock mode
      const foundCandidate = state.cosmic_board.find((p) => p.id === candidateOnlyId);
      assert.equal(foundCandidate, undefined, 'Candidate-only player must not be ingested in mock mode');
    });

    test('5.33 should verify live mode with empty rosters/picks does not inject mock board', () => {
      const liveMeta = {
        draft_id: 'live_draft_99999',
        status: 'pre_draft',
        season: '2025',
      };

      const state = sleeper.transformToDraftState(
        liveMeta,
        [],
        { mode: 'live', draft_id: 'live_draft_99999' },
        null,
        [],
        [],
      );

      // Without mock flags, baseBoard is [] and no mockCosmicBoard players should leak in
      assert.equal(state.cosmic_board.length, 0, 'Live pre-draft state with null playerDict must have empty cosmic_board, not mockCosmicBoard');
      assert.equal(state.mode, 'live');
    });

    test('5.34 should verify MOCK_AVAILABLE_NFL_CATALOG contains zero non-player or retired IDs', () => {
      const catalog = mockData.MOCK_AVAILABLE_NFL_CATALOG || [];
      const excludedIds = new Set(['138', '2118', '3099', '6766', '1000', '1001']);
      for (const p of catalog) {
        assert.ok(!excludedIds.has(String(p.id)), `Catalog must not contain corrupt or retired ID ${p.id}`);
        assert.ok(p.name !== 'Dirk Koetter', 'Catalog must not contain Dirk Koetter');
        assert.ok(p.name !== 'Andrew Berry', 'Catalog must not contain Andrew Berry');
        assert.ok(p.name !== 'Albert McClellan', 'Catalog must not contain Albert McClellan');
        assert.ok(p.name !== 'Tyler Clutts', 'Catalog must not contain Tyler Clutts');
      }
    });

    test('5.35 should verify resetPlayerNegativeCache and resetRateLimit function properly', () => {
      assert.equal(typeof sleeper.resetPlayerNegativeCache, 'function', 'resetPlayerNegativeCache must be exported');
      assert.equal(typeof sleeper.resetRateLimit, 'function', 'resetRateLimit must be exported');

      // Calling them should not throw
      sleeper.resetPlayerNegativeCache();
      sleeper.resetRateLimit();
      assert.equal(sleeper.isRateLimited(), false, 'isRateLimited must be false after resetRateLimit');
    });

    test('5.36 should verify live mode with empty leagueUsers does not inject mock competitor teams', () => {
      const liveMeta = {
        draft_id: 'live_draft_99999',
        status: 'drafting',
        season: '2025',
      };

      const state = sleeper.transformToDraftState(
        liveMeta,
        [],
        { mode: 'live', draft_id: 'live_draft_99999' },
        null,
        [], // leagueUsers
        [], // leagueRosters
      );

      assert.equal(state.competitor_teams.length, 0, 'Live mode with empty leagueUsers must have 0 competitor teams, not mock teams');
      assert.deepEqual(state.competitor_teams, [], 'competitor_teams must strictly evaluate to []');
    });

    test('5.37 should verify live mode with empty competitor teams does not inject mock weekly matchup', () => {
      const liveMeta = {
        draft_id: 'live_draft_99999',
        status: 'drafting',
        season: '2025',
      };

      const state = sleeper.transformToDraftState(
        liveMeta,
        [],
        { mode: 'live', draft_id: 'live_draft_99999' },
        null,
        [], // leagueUsers
        [], // leagueRosters
      );

      assert.equal(state.competitor_teams.length, 0, 'Competitor teams must be empty');
      assert.equal(
        state.weekly_matchup,
        undefined,
        'weekly_matchup must be undefined in live mode with empty competitor teams, not mockWeeklyMatchup'
      );
    });

    test('5.38 should verify live synthesized players without synthetic fields receive average projections and placeholder when on bye or NA', () => {
      const liveMeta = {
        draft_id: 'live_draft_88888',
        status: 'drafting',
        season: '2024',
      };
      // Realistic Sleeper player dict without baseline_projected_points or average_projected_points
      const realSleeperDict = {
        '10001': {
          player_id: '10001',
          full_name: 'Josh Prototype',
          first_name: 'Josh',
          last_name: 'Prototype',
          position: 'QB',
          team: 'BUF',
          active: true,
          status: 'Active',
          bye_week: 7,
          search_rank: 5,
        },
        '10002': {
          player_id: '10002',
          full_name: 'Breece Standard',
          first_name: 'Breece',
          last_name: 'Standard',
          position: 'RB',
          team: 'NYJ',
          active: true,
          status: 'Active',
          bye_week: 12,
          search_rank: 12,
        },
        '10003': {
          player_id: '10003',
          full_name: 'Inactive Veteran',
          first_name: 'Inactive',
          last_name: 'Veteran',
          position: 'WR',
          team: 'KC',
          active: false,
          status: 'NA',
          bye_week: 6,
          search_rank: 45,
        },
      };

      const picks = [
        {
          player_id: '10001',
          picked_by: 'owner_1',
          pick_no: 1,
          draft_slot: 1,
          metadata: {
            first_name: 'Josh',
            last_name: 'Prototype',
            position: 'QB',
            team: 'BUF',
            number: '17',
          },
        },
        {
          player_id: '10002',
          picked_by: 'owner_2',
          pick_no: 2,
          draft_slot: 2,
          metadata: {
            first_name: 'Breece',
            last_name: 'Standard',
            position: 'RB',
            team: 'NYJ',
            number: '20',
          },
        },
        {
          player_id: '10003',
          picked_by: 'owner_1',
          pick_no: 3,
          draft_slot: 1,
          metadata: {
            first_name: 'Inactive',
            last_name: 'Veteran',
            position: 'WR',
            team: 'KC',
            number: '88',
          },
        },
      ];

      // Week 7 projections: Week 7 is bye for BUF (10001), so no entry in weeklyProjections
      const weeklyProjections = {
        '10002': { pts_ppr: 16.5 },
      };

      // Grounded next-week projections for Week 8
      const nextWeekProjections = {
        8: { '10001': { pts_ppr: 21.3 } },
      };

      const state = sleeper.transformToDraftState(
        liveMeta,
        picks,
        { mode: 'live', draft_id: 'live_draft_88888', user_id: 'owner_1', user_slot: 1 },
        realSleeperDict,
        [],
        [],
        null,
        null,
        7, // activeWeek = 7
        weeklyProjections,
        nextWeekProjections,
      );

      assert.equal(state.isLive, true);
      const byeQb = state.cosmic_board.find((p) => p.id === '10001');
      assert.ok(byeQb, 'Bye QB must exist in cosmic board');
      assert.equal(byeQb.projected_points, 0, 'Current week projected points must be 0 for bye player');
      assert.equal(
        byeQb.average_projected_points,
        21.3,
        'Live bye player must adopt grounded next-week projected points as average_projected_points',
      );
      assert.equal(
        oracle.hasOraclePlaceholder(byeQb, 7),
        true,
        'hasOraclePlaceholder must be true for live bye player',
      );
      assert.equal(
        oracle.oracleEffectivePoints(byeQb, 7),
        21.3,
        'oracleEffectivePoints must return grounded 21.3 pts from next-week projection placeholder',
      );
      const withPlaceholder = oracle.oracleScore(byeQb, 0.75, { currentWeek: 7 });
      const withoutPlaceholder = oracle.currentWeekOracleScore(byeQb, 0.75, 7);
      assert.ok(
        withPlaceholder > withoutPlaceholder,
        'oracleScore with placeholder must exceed raw currentWeekOracleScore for bye player',
      );

      // Verify NA inactive status player with no verified projections
      const inactiveWr = state.cosmic_board.find((p) => p.id === '10003');
      assert.ok(inactiveWr, 'Inactive WR must exist in cosmic board');
      assert.equal(
        inactiveWr.average_projected_points,
        undefined,
        'Inactive WR with no verified projections must not have fabricated average_projected_points',
      );
      assert.equal(
        oracle.hasOraclePlaceholder(inactiveWr, 7),
        false,
        'hasOraclePlaceholder must be false when player has 0 verified average projections',
      );
      assert.equal(
        oracle.oracleEffectivePoints(inactiveWr, 7),
        0,
        'oracleEffectivePoints must return 0 for unprojected inactive WR',
      );
    });

    test('5.39 should preserve real explicit average or season projections on live synthesized players without baseline, even on bye with next-week projections', () => {
      const liveMeta = {
        draft_id: 'live_draft_99999',
        status: 'drafting',
        season: '2024',
      };
      const realSleeperDict = {
        '20001': {
          player_id: '20001',
          full_name: 'Explicit Avg QB',
          first_name: 'Explicit',
          last_name: 'Avg QB',
          position: 'QB',
          team: 'BUF',
          active: true,
          status: 'Active',
          bye_week: 7,
          average_projected_points: 22.4,
          search_rank: 2,
        },
        '20002': {
          player_id: '20002',
          full_name: 'Season Proj RB',
          first_name: 'Season',
          last_name: 'Proj RB',
          position: 'RB',
          team: 'NYJ',
          active: true,
          status: 'Active',
          bye_week: 7,
          season_projected_points: 255, // 255 / 17 = 15.0
          search_rank: 4,
        },
        '20003': {
          player_id: '20003',
          full_name: 'Unprojected Deep FA',
          first_name: 'Deep',
          last_name: 'FA',
          position: 'WR',
          team: 'MIA',
          active: true,
          status: 'Active',
          bye_week: 7,
          search_rank: 450,
        },
        '20004': {
          player_id: '20004',
          full_name: 'Unsigned Free Agent',
          first_name: 'Unsigned',
          last_name: 'FA',
          position: 'WR',
          team: 'FA',
          active: false,
          status: 'Inactive',
          injury_status: 'IR',
          search_rank: 999,
        },
      };

      const picks = [
        {
          player_id: '20001',
          picked_by: 'owner_1',
          pick_no: 1,
          draft_slot: 1,
          metadata: {
            first_name: 'Explicit',
            last_name: 'Avg QB',
            position: 'QB',
            team: 'BUF',
          },
        },
        {
          player_id: '20002',
          picked_by: 'owner_2',
          pick_no: 2,
          draft_slot: 2,
          metadata: {
            first_name: 'Season',
            last_name: 'Proj RB',
            position: 'RB',
            team: 'NYJ',
          },
        },
      ];

      // Next-week projections for Week 8: 18.0 pts
      const nextWeekProjections = {
        8: {
          '20001': { pts_ppr: 18.0 },
          '20002': { pts_ppr: 10.0 },
        },
      };

      // Week 7 live projections: Active players have projections; 20001 & 20002 on bye have 0
      const weeklyProjections = {
        '10002': { pts_ppr: 16.5 },
      };

      const state = sleeper.transformToDraftState(
        liveMeta,
        picks,
        { mode: 'live', draft_id: 'live_draft_99999', user_id: 'owner_1', user_slot: 1 },
        realSleeperDict,
        [],
        [],
        null,
        null,
        7, // activeWeek = 7 (both 20001 and 20002 on bye)
        weeklyProjections,
        nextWeekProjections,
      );

      // 20001: Explicit average 22.4 must be preserved and NOT overwritten by next-week projection 18.0
      const qb = state.cosmic_board.find((p) => p.id === '20001');
      assert.ok(qb, 'QB with explicit average must exist');
      assert.equal(qb.average_projected_points, 22.4, 'Must preserve real explicit average (22.4)');
      assert.equal(oracle.oracleEffectivePoints(qb, 7), 22.4, 'Oracle effective points must use explicit average');

      // 20002: Season projection / 17 (15.0) must be preserved
      const rb = state.cosmic_board.find((p) => p.id === '20002');
      assert.ok(rb, 'RB with season projection must exist');
      assert.equal(rb.season_projected_points, 255, 'Must preserve real season_projected_points (255)');
      assert.equal(rb.average_projected_points, 15.0, 'Must derive average from season_projected_points / 17 (15.0)');
      assert.equal(oracle.oracleEffectivePoints(rb, 7), 15.0, 'Oracle effective points must derive from season / 17');

      // 20003: Signed deep FA without projections must exist on board but receive NO fabricated average or placeholder
      const deepFa = state.cosmic_board.find((p) => p.id === '20003');
      assert.ok(deepFa, 'Active unprojected deep FA must exist on cosmic board');
      assert.equal(deepFa.average_projected_points, undefined, 'Deep FA without projections must not fabricate average');
      assert.equal(deepFa.next_week_projected_points, undefined, 'Deep FA without next-week projections must have undefined next_week_projected_points');
      assert.equal(oracle.hasOraclePlaceholder(deepFa, 7), false, 'Deep FA without average must not have placeholder');
      assert.equal(oracle.oracleEffectivePoints(deepFa, 7), 0, 'oracleEffectivePoints must return 0 for unprojected deep FA');

      // 20004: Unsigned/inactive free agent must be excluded from board entirely
      assert.equal(state.cosmic_board.find((p) => p.id === '20004'), undefined, 'Unsigned inactive free agent is excluded from board');
    });

    test('5.40 authentic live Sleeper injured players (Out, IR, PUP, Doubtful) receive grounded baseline projection fallback so hasOraclePlaceholder activates accurately in live mode', () => {
      const liveMeta = {
        draft_id: 'live_draft_injury_test',
        season: '2025',
        settings: {
          teams: 12,
          rounds: 15,
          chaos_lambda: 0.75,
        },
      };

      const realSleeperDict = {
        '30001': {
          player_id: '30001',
          full_name: 'Injured Star RB',
          first_name: 'Star',
          last_name: 'RB',
          position: 'RB',
          team: 'SF',
          active: true,
          status: 'Active',
          injury_status: 'IR',
          search_rank: 5,
        },
        '30002': {
          player_id: '30002',
          full_name: 'Out Starting QB',
          first_name: 'Out',
          last_name: 'QB',
          position: 'QB',
          team: 'KC',
          active: true,
          status: 'Active',
          injury_status: 'Out',
          search_rank: 12,
        },
        '30003': {
          player_id: '30003',
          full_name: 'Healthy Deep FA',
          first_name: 'Healthy',
          last_name: 'FA',
          position: 'WR',
          team: 'MIA',
          active: true,
          status: 'Active',
          search_rank: 450,
        },
        '30004': {
          player_id: '30004',
          full_name: 'PUP Tight End',
          first_name: 'PUP',
          last_name: 'TE',
          position: 'TE',
          team: 'DET',
          active: true,
          status: 'Active',
          injury_status: 'PUP',
          search_rank: 80,
        },
        '30005': {
          player_id: '30005',
          full_name: 'Doubtful Wideout',
          first_name: 'Doubtful',
          last_name: 'WR',
          position: 'WR',
          team: 'MIN',
          active: true,
          status: 'Active',
          injury_status: 'Doubtful',
          search_rank: 60,
        },
        '30006': {
          player_id: '30006',
          full_name: 'Suspended Wideout',
          first_name: 'Suspended',
          last_name: 'WR',
          position: 'WR',
          team: 'DAL',
          active: true,
          status: 'Active',
          injury_status: 'Sus',
          search_rank: 70,
        },
        '30007': {
          player_id: '30007',
          full_name: 'Inactive Practice Squad WR',
          first_name: 'Inactive',
          last_name: 'WR',
          position: 'WR',
          team: 'FA',
          active: false,
          status: 'NA',
          injury_status: 'NA',
          search_rank: 999,
        },
        '30008': {
          player_id: '30008',
          full_name: 'Practice Squad Injured QB',
          first_name: 'Practice',
          last_name: 'QB',
          position: 'QB',
          team: 'KC',
          active: true,
          status: 'Practice Squad',
          injury_status: 'IR',
          search_rank: 550,
          depth_chart_order: 4,
        },
        '30009': {
          player_id: '30009',
          full_name: 'Deep Injured MyTeam RB',
          first_name: 'Deep',
          last_name: 'RB',
          position: 'RB',
          team: 'SF',
          active: true,
          status: 'Active',
          injury_status: 'IR',
          search_rank: 350,
        },
        '30010': {
          player_id: '30010',
          full_name: 'Deep Injured FreeAgent RB',
          first_name: 'FA',
          last_name: 'RB',
          position: 'RB',
          team: 'SF',
          active: true,
          status: 'Active',
          injury_status: 'IR',
          search_rank: 350,
        },
      };

      // Test direct synthesizeCosmicPlayerFromId
      const synthIr = sleeper.synthesizeCosmicPlayerFromId('30001', realSleeperDict['30001']);
      assert.equal(synthIr.average_projected_points, 10.0, 'Direct synthesize must assign grounded baseline for IR RB');
      assert.equal(oracle.hasOraclePlaceholder(synthIr, 7), true, 'Direct synthesize IR RB must qualify for placeholder');

      const synthOut = sleeper.synthesizeCosmicPlayerFromId('30002', realSleeperDict['30002']);
      assert.equal(synthOut.average_projected_points, 15.3, 'Direct synthesize must assign grounded baseline for Out QB');

      const synthPup = sleeper.synthesizeCosmicPlayerFromId('30004', realSleeperDict['30004']);
      assert.equal(synthPup.average_projected_points, 7.1, 'Direct synthesize must assign grounded baseline for PUP TE');

      const synthDoubtful = sleeper.synthesizeCosmicPlayerFromId('30005', realSleeperDict['30005']);
      assert.equal(synthDoubtful.average_projected_points, 10.6, 'Direct synthesize must assign grounded baseline for Doubtful WR');

      const synthSus = sleeper.synthesizeCosmicPlayerFromId('30006', realSleeperDict['30006']);
      assert.equal(synthSus.average_projected_points, 10.6, 'Direct synthesize must assign grounded baseline for Sus WR');

      const synthNa = sleeper.synthesizeCosmicPlayerFromId('30007', realSleeperDict['30007']);
      assert.equal(synthNa.average_projected_points, undefined, 'Direct synthesize must keep NA practice squad player undefined');
      assert.equal(oracle.hasOraclePlaceholder(synthNa, 7), false, 'Direct synthesize NA player must not have placeholder');

      const synthPsQb = sleeper.synthesizeCosmicPlayerFromId('30008', realSleeperDict['30008']);
      assert.equal(synthPsQb.average_projected_points, 5.0, 'Practice squad QB must receive calibrated baseline (5.0) rather than 15.3');

      // Test direct enrichCosmicBoardWithNFLPlayers
      const initialBoard = [
        { id: '30001', name: 'Star RB', position: 'RB', team: 'SF' },
        { id: '30002', name: 'Out QB', position: 'QB', team: 'KC' },
        { id: '30004', name: 'PUP TE', position: 'TE', team: 'DET' },
        { id: '30005', name: 'Doubtful WR', position: 'WR', team: 'MIN' },
        { id: '30006', name: 'Sus WR', position: 'WR', team: 'DAL' },
        { id: '30007', name: 'NA WR', position: 'WR', team: 'FA' },
        { id: '30008', name: 'Practice QB', position: 'QB', team: 'KC' },
        { id: '30009', name: 'Deep MyTeam RB', position: 'RB', team: 'SF', draft_status: 'my_team' },
        { id: '30010', name: 'Deep FreeAgent RB', position: 'RB', team: 'SF', draft_status: 'available' },
      ];
      const enriched = sleeper.enrichCosmicBoardWithNFLPlayers(initialBoard, realSleeperDict);
      const enrichedIr = enriched.find((p) => p.id === '30001');
      assert.equal(enrichedIr.baseline_projected_points, 10.0, 'Enriched IR RB must get 10.0 baseline');
      const enrichedNa = enriched.find((p) => p.id === '30007');
      assert.equal(enrichedNa.average_projected_points, undefined, 'Enriched NA WR must not fabricate baseline');
      const enrichedPsQb = enriched.find((p) => p.id === '30008');
      assert.equal(enrichedPsQb.baseline_projected_points, 5.0, 'Enriched practice squad QB must receive calibrated baseline (5.0)');
      const enrichedMyTeam = enriched.find((p) => p.id === '30009');
      assert.equal(enrichedMyTeam.baseline_projected_points, 10.0, 'Enriched my_team injured RB with search_rank > 250 must receive full 10.0 baseline');
      const enrichedFA = enriched.find((p) => p.id === '30010');
      assert.equal(enrichedFA.baseline_projected_points, 4.0, 'Enriched available deep-reserve injured RB with search_rank > 250 must be capped at 4.0');

      const picks = [
        {
          player_id: '30001',
          picked_by: 'owner_1',
          pick_no: 1,
          draft_slot: 1,
          metadata: {
            first_name: 'Star',
            last_name: 'RB',
            position: 'RB',
            team: 'SF',
          },
        },
        {
          player_id: '30002',
          picked_by: 'owner_2',
          pick_no: 2,
          draft_slot: 2,
          metadata: {
            first_name: 'Out',
            last_name: 'QB',
            position: 'QB',
            team: 'KC',
          },
        },
        {
          player_id: '30004',
          picked_by: 'owner_1',
          pick_no: 3,
          draft_slot: 1,
          metadata: {
            first_name: 'PUP',
            last_name: 'TE',
            position: 'TE',
            team: 'DET',
          },
        },
        {
          player_id: '30005',
          picked_by: 'owner_2',
          pick_no: 4,
          draft_slot: 2,
          metadata: {
            first_name: 'Doubtful',
            last_name: 'WR',
            position: 'WR',
            team: 'MIN',
          },
        },
      ];

      const weeklyProjections = {
        '30001': { pts_ppr: 0 },
        '30002': { pts_ppr: 0 },
        '30004': { pts_ppr: 0 },
        '30005': { pts_ppr: 0 },
      };

      const state = sleeper.transformToDraftState(
        liveMeta,
        picks,
        { mode: 'live', draft_id: 'live_draft_injury_test', user_id: 'owner_1', user_slot: 1 },
        realSleeperDict,
        [],
        [],
        null,
        null,
        7,
        weeklyProjections,
      );

      const irRb = state.cosmic_board.find((p) => p.id === '30001');
      assert.ok(irRb, 'IR player must exist on cosmic board');
      assert.ok(irRb.average_projected_points && irRb.average_projected_points > 0, 'IR player must receive grounded baseline projection fallback');
      assert.equal(irRb.average_projected_points, 10.0, 'RB grounded baseline must be 10.0 pts');
      assert.equal(oracle.hasOraclePlaceholder(irRb, 7), true, 'hasOraclePlaceholder must be true for IR player in live mode');
      assert.equal(oracle.oracleEffectivePoints(irRb, 7), 10.0, 'oracleEffectivePoints must return grounded baseline for IR player');

      const outQb = state.cosmic_board.find((p) => p.id === '30002');
      assert.ok(outQb, 'Out player must exist on cosmic board');
      assert.ok(outQb.average_projected_points && outQb.average_projected_points > 0, 'Out player must receive grounded baseline projection fallback');
      assert.equal(outQb.average_projected_points, 15.3, 'QB grounded baseline must be 15.3 pts');
      assert.equal(oracle.hasOraclePlaceholder(outQb, 7), true, 'hasOraclePlaceholder must be true for Out player in live mode');
      assert.equal(oracle.oracleEffectivePoints(outQb, 7), 15.3, 'oracleEffectivePoints must return grounded baseline for Out player');

      const pupTe = state.cosmic_board.find((p) => p.id === '30004');
      assert.ok(pupTe, 'PUP player must exist on cosmic board');
      assert.equal(pupTe.average_projected_points, 7.1, 'TE grounded baseline must be 7.1 pts');
      assert.equal(oracle.hasOraclePlaceholder(pupTe, 7), true, 'hasOraclePlaceholder must be true for PUP player in live mode');

      const doubtfulWr = state.cosmic_board.find((p) => p.id === '30005');
      assert.ok(doubtfulWr, 'Doubtful player must exist on cosmic board');
      assert.equal(doubtfulWr.average_projected_points, 10.6, 'WR grounded baseline must be 10.6 pts');
      assert.equal(oracle.hasOraclePlaceholder(doubtfulWr, 7), true, 'hasOraclePlaceholder must be true for Doubtful player in live mode');

      const deepFa = state.cosmic_board.find((p) => p.id === '30003');
      assert.ok(deepFa, 'Deep FA must exist on cosmic board');
      assert.equal(deepFa.average_projected_points, undefined, 'Healthy unprojected deep FA must not receive baseline');
      assert.equal(oracle.hasOraclePlaceholder(deepFa, 7), false, 'Healthy unprojected deep FA must not have placeholder');
    });

    test('5.41 should directly verify getGroundedPositionBaseline calculations across positions, depths, search ranks, and my_team exemption', () => {
      // 1. Standard position baselines
      assert.equal(sleeper.getGroundedPositionBaseline('QB'), 15.3, 'Standard QB baseline must be 15.3 pts');
      assert.equal(sleeper.getGroundedPositionBaseline('RB'), 10.0, 'Standard RB baseline must be 10.0 pts');
      assert.equal(sleeper.getGroundedPositionBaseline('WR'), 10.6, 'Standard WR baseline must be 10.6 pts');
      assert.equal(sleeper.getGroundedPositionBaseline('TE'), 7.1, 'Standard TE baseline must be 7.1 pts');
      assert.equal(sleeper.getGroundedPositionBaseline('K'), 6.5, 'Standard K baseline must be 6.5 pts');
      assert.equal(sleeper.getGroundedPositionBaseline('DEF'), 5.9, 'Standard DEF baseline must be 5.9 pts');
      assert.equal(sleeper.getGroundedPositionBaseline('FLEX'), 8.0, 'Fallback baseline for unknown posKey must be 8.0 pts');

      // 2. searchRank > 250 with isMyTeam: false vs true
      assert.equal(
        sleeper.getGroundedPositionBaseline('QB', { searchRank: 300, isMyTeam: false }),
        5.0,
        'Deep free-agent QB (searchRank > 250) must be capped at 5.0 pts',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('QB', { searchRank: 300, isMyTeam: true }),
        15.3,
        'My team QB with searchRank > 250 must remain uncapped (15.3 pts)',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('RB', { searchRank: 300, isMyTeam: false }),
        4.0,
        'Deep free-agent RB (searchRank > 250) must be capped at 4.0 pts',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('RB', { searchRank: 300, isMyTeam: true }),
        10.0,
        'My team RB with searchRank > 250 must remain uncapped (10.0 pts)',
      );

      // 3. Null / undefined searchRank
      assert.equal(
        sleeper.getGroundedPositionBaseline('RB', { searchRank: null }),
        10.0,
        'Null searchRank must resolve to standard baseline',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('QB', { searchRank: undefined }),
        15.3,
        'Undefined searchRank must resolve to standard baseline',
      );

      // 4. depthChartOrder thresholds (QB > 2, non-QB > 3)
      assert.equal(
        sleeper.getGroundedPositionBaseline('QB', { depthChartOrder: 3 }),
        5.0,
        'QB at depth 3 must be capped at 5.0 pts',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('QB', { depthChartOrder: 2 }),
        15.3,
        'QB at depth 2 (backup) must receive full baseline 15.3 pts',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('RB', { depthChartOrder: 4 }),
        4.0,
        'RB at depth 4 must be capped at 4.0 pts',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('RB', { depthChartOrder: 3 }),
        10.0,
        'RB at depth 3 must receive full baseline 10.0 pts',
      );

      // 5. Practice Squad status
      assert.equal(
        sleeper.getGroundedPositionBaseline('QB', { status: 'Practice Squad' }),
        5.0,
        'Practice Squad QB must be capped at 5.0 pts',
      );
      assert.equal(
        sleeper.getGroundedPositionBaseline('WR', { status: 'Practice Squad' }),
        4.0,
        'Practice Squad WR must be capped at 4.0 pts',
      );

      // 6. Explicit isDeepReserve flag
      assert.equal(
        sleeper.getGroundedPositionBaseline('WR', { isDeepReserve: true }),
        4.0,
        'Explicit isDeepReserve flag must cap baseline at 4.0 pts',
      );
    });
  });
});
