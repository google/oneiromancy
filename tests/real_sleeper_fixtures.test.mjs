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

      // Manual reset clears cooldown
      sleeper.resetRateLimit();
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

    test('5.17 should verify OneiromancyContext.tsx source implements decoupled slot detection and localStorage persistence', () => {
      const contextPath = path.resolve(__dirname, '../context/OneiromancyContext.tsx');
      assert.ok(fs.existsSync(contextPath), 'context/OneiromancyContext.tsx must exist');
      const contextSource = fs.readFileSync(contextPath, 'utf8');

      // 1. Decoupled activeSlotRef initialized as undefined
      assert.ok(
        contextSource.includes('const activeSlotRef = useRef<number | undefined>(undefined);'),
        'activeSlotRef must be initialized as undefined'
      );

      // 2. localStorage hydration & persistence
      assert.ok(contextSource.includes("localStorage.getItem('oneiromancy_active_slot')"));
      assert.ok(contextSource.includes("localStorage.setItem('oneiromancy_active_slot'"));

      // 3. Undefined pass-through in live mode
      assert.ok(contextSource.includes("const isMockMode = targetDraftId === 'mock' || targetDraftId === 'mock_oneiromancy_draft_2025' || targetDraftId === undefined;"));
      assert.ok(contextSource.includes(': (isMockMode ? (draftStateRef.current.settings?.user_slot || 7) : undefined);'));

      // 4. Fallback to mock engine
      assert.ok(contextSource.includes('mock_oneiromancy_draft_2025'));
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

    test('5.21 should verify OneiromancyContext implements delta checks and non-spamming error handlers', () => {
      const contextPath = path.resolve(__dirname, '../context/OneiromancyContext.tsx');
      assert.ok(fs.existsSync(contextPath), 'context/OneiromancyContext.tsx must exist');
      const contextSource = fs.readFileSync(contextPath, 'utf8');

      assert.ok(contextSource.includes('prevPickCount === newPickCount'), 'Must check pick count equality');
      assert.ok(contextSource.includes('prevBoardLen > 0'), 'Must verify existing board length');
      assert.ok(contextSource.includes('isRateLimitError(nflErr)'), 'Must suppress rate limits on NFL player fetch');
      assert.ok(contextSource.includes('isRateLimitError(err)'), 'Must suppress rate limits on live sync');
    });

    test('5.22 should verify core domain models have zero [key: string]: any index signatures', () => {
      const typesPath = path.resolve(__dirname, '../core/types/oneiromancy.ts');
      assert.ok(fs.existsSync(typesPath), 'core/types/oneiromancy.ts must exist');
      const typesSource = fs.readFileSync(typesPath, 'utf8');

      const anyIndexMatches = typesSource.match(/\[key:\s*string\]:\s*any;/g);
      assert.equal(anyIndexMatches, null, 'core/types/oneiromancy.ts must have zero [key: string]: any; index signatures');
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
  });
});
