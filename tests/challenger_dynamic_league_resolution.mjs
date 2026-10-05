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
 * Challenger Test Suite: Dynamic Sleeper League Resolution & Visible Error Logging
 *
 * Verifies:
 * 1. resolveLeagueDraftAndUser against authentic Sleeper API fixtures:
 *    - Matches 'OneiroVanguard' case-insensitively
 *    - Matches substring 'strategist'
 *    - Resolves active draft ID 9000000000000000002, user ID 9000000000000000101, and user draft slot 7
 *    - Handles error cases gracefully with descriptive errors
 * 2. NavigationShell Mode Switch & Visible Alert Notice:
 *    - 1-click mode switch between Live League and Mock Oneiromancy Engine
 *    - Prominent warning banner displayed on syncError with [Retry Sync] button
 *    - Live telemetry indicator displayed when connected
 * 3. Settings Simplification & Dynamic Auto-Team Derivation against authentic fixtures:
 *    - Authenticated league rosters, draft picks, and user profiles
 *    - Multi-user isolation (LyraEnchantress vs OneiroVanguard)
 * 4. 7-Point Resolution for Comment #68
 * 5. Comment #71 Resolution: Unowned Free Agents, Win Probability, SpiritScore Dynamic Range
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import compiled dist modules via dynamic import after loader registration
const sleeper = await import('./dist/lib/sleeper.js');
const mockData = await import('./dist/lib/mockData.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve authentic mocks directory resiliently
const possibleMockDirs = [
  path.resolve(__dirname, '../mocks'),
  path.resolve(process.cwd(), 'mocks'),
  path.resolve(__dirname, '../../oneiromancy/mocks'),
  path.resolve(process.cwd(), '../oneiromancy/mocks'),
  path.resolve(__dirname, 'mocks'),
];

const MOCKS_DIR = possibleMockDirs.find((dir) => fs.existsSync(dir) && fs.existsSync(path.join(dir, 'mock_league_info.json')));

if (!MOCKS_DIR) {
  throw new Error('Unable to locate authentic Sleeper API mock directory in any expected path: ' + possibleMockDirs.join(', '));
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

const REAL_LEAGUE_ID = leagueInfo.league_id; // '9000000000000000001'
const REAL_USER_ID = mockUser.user_id;       // '9000000000000000101'
const REAL_DRAFT_ID = draftMeta.draft_id;    // '9000000000000000002'

describe('Challenger: Dynamic Sleeper League Resolution', () => {

  test('1.1 should resolve draft_id, user_id, and user_slot when username is exact OneiroVanguard', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueDrafts,
        };
      }
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/users')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueUsers,
        };
      }
      if (urlStr.includes('/draft/' + REAL_DRAFT_ID)) {
        return {
          ok: true,
          status: 200,
          json: async () => draftMeta,
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    try {
      const resolved = await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'OneiroVanguard');
      assert.equal(resolved.draft_id, REAL_DRAFT_ID);
      assert.equal(resolved.user_id, REAL_USER_ID);
      assert.equal(resolved.user_slot, 7);
      assert.equal(resolved.display_name, 'OneiroVanguard');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('1.2 should resolve user when input is lowercase oneirovanguard or substring vanguard', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueDrafts,
        };
      }
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/users')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueUsers,
        };
      }
      if (urlStr.includes('/draft/' + REAL_DRAFT_ID)) {
        return {
          ok: true,
          status: 200,
          json: async () => draftMeta,
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    try {
      const resolvedSub = await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'vanguard');
      assert.equal(resolvedSub.user_id, REAL_USER_ID);
      assert.equal(resolvedSub.user_slot, 7);

      const resolvedAt = await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, '@OneiroVanguard');
      assert.equal(resolvedAt.user_id, REAL_USER_ID);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('1.3 should throw descriptive error when league has no drafts', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes('/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      await assert.rejects(
        () => sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'OneiroVanguard'),
        (err) => {
          assert.ok(err.message.includes('No drafts found for league ' + REAL_LEAGUE_ID));
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('1.4 should throw descriptive error when username is not found in league', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueDrafts,
        };
      }
      if (urlStr.includes('/users')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueUsers,
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      await assert.rejects(
        () => sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'NonExistentUser12345'),
        (err) => {
          assert.ok(err.message.includes('not found in Sleeper league'));
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Challenger: Mode Switching & Visible Error Alerting in UI', () => {
  const navSourcePath = path.resolve('components/common/NavigationShell.tsx');
  const navSource = fs.readFileSync(navSourcePath, 'utf8');

  test('2.1 should render prominent 1-click mode switch buttons with Live and Mock options', () => {
    assert.ok(navSource.includes('data-testid="mode-switch-container"'), 'Mode switch container must render');
    assert.ok(navSource.includes('data-testid="mode-live-btn"'), 'Live mode button must render');
    assert.ok(navSource.includes('data-testid="mode-mock-btn"'), 'Mock mode button must render');
    assert.ok(navSource.includes("Live ({sleeperUsername || 'OneiroVanguard'})"), 'Live button must display user name');
    assert.ok(navSource.includes('🔮 Mock'), 'Mock button must display mock indicator');
  });

  test('2.2 should render prominent warning banner and retry button when syncError is present', () => {
    assert.ok(navSource.includes('data-testid="sleeper-sync-error-banner"'), 'Error banner must render when syncError is present');
    assert.ok(navSource.includes('{syncError}'), 'Banner must display exact sync error message');
    assert.ok(navSource.includes('{syncWarning}'), 'Banner must display warning explanation');
    assert.ok(navSource.includes('data-testid="retry-sync-btn"'), 'Retry Sync button must be rendered in warning banner');
    assert.ok(navSource.includes('Retry Live Sync'), 'Button text must invite user to retry');
  });

  test('2.3 should render live sync sub-banner when live mode is active without error', () => {
    assert.ok(navSource.includes('data-testid="sleeper-live-sync-banner"'), 'Live sync banner must render');
    assert.ok(navSource.includes("LIVE SYNC: {sleeperUsername || 'OneiroVanguard'}"), 'Must display live user tag');
    assert.ok(navSource.includes("League {leagueId || '9000000000000000001'}"), 'Must display league ID');
    assert.ok(navSource.includes("mode === 'live' && !syncError"), 'No error banner when syncError is null');
  });

  test('2.4 should render mock engine banner when in mock mode', () => {
    assert.ok(navSource.includes('data-testid="sleeper-mock-banner"'), 'Mock banner must render');
    assert.ok(navSource.includes('🔮 MOCK ONEIROMANCY ENGINE'), 'Must indicate mock engine');
    assert.ok(navSource.includes('• Offline Synthetic Data'), 'Must indicate synthetic data');
  });
});

describe('Challenger: Settings Simplification & Dynamic Auto-Team Derivation', () => {
  const settingsSourcePath = './components/settings/SettingsDrawer.tsx';

  test('3.1 should render only Sleeper Username text input and no manual draft ID / team slot', async () => {
    const source = fs.readFileSync(settingsSourcePath, 'utf8');

    // Only Sleeper Username text input
    assert.ok(source.includes('id="username-input"'), 'Must have id="username-input"');
    assert.ok(source.includes('htmlFor="username-input"'), 'Must have htmlFor="username-input"');
    assert.ok(source.includes('placeholder="e.g. OneiroVanguard"'), 'Must have OneiroVanguard placeholder');
    assert.ok(source.includes('OneiroVanguard'), 'Default value must be OneiroVanguard');

    // Removed manual inputs
    assert.ok(!source.includes('id="draft-id-input"'), 'Manual draft-id-input must be removed');
    assert.ok(!source.includes('id="team-slot-select"'), 'Manual team-slot-select must be removed');
  });

  test('3.2 should render League Selector dropdown (<select id="league-select">) with {name} - {season}', async () => {
    const source = fs.readFileSync(settingsSourcePath, 'utf8');

    assert.ok(source.includes('id="league-select"'), 'Must render select with id="league-select"');
    assert.ok(source.includes('htmlFor="league-select"'), 'Must have label for league-select');
    assert.ok(source.includes('{league.name} - {league.season}'), 'Must format option as {league.name} - {league.season}');
    assert.ok(source.includes('onChange={handleLeagueChange}'), 'Must switch league immediately on change');
  });

  test('3.3 should preserve Chaos lambda slider (#chaos-lambda-slider) and Load Mock Oneiromancy Engine button (#load-mock-btn)', async () => {
    const source = fs.readFileSync(settingsSourcePath, 'utf8');

    assert.ok(source.includes('id="chaos-lambda-slider"'), 'Must contain id="chaos-lambda-slider"');
    assert.ok(source.includes('type="range"'), 'Slider must be type range');
    assert.ok(source.includes('id="load-mock-btn"'), 'Must contain id="load-mock-btn"');
    assert.ok(source.includes('🔮 Load Mock Oneiromancy Engine'), 'Must retain 🔮 Load Mock Oneiromancy Engine label');
    assert.ok(source.includes('id="apply-sync-btn"'), 'Must retain id="apply-sync-btn"');
  });

  test('3.4 should dynamically query user leagues and default to first league in list', async () => {
    const originalFetch = global.fetch;
    const MOCK_USER_ID = REAL_USER_ID;
    const MOCK_LEAGUE_1 = REAL_LEAGUE_ID;
    const MOCK_LEAGUE_2 = 'league_beta_2025';

    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/user/OneiroVanguard')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockUser,
        };
      }
      if (urlStr.includes('/user/' + MOCK_USER_ID + '/leagues/nfl/2025')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { league_id: MOCK_LEAGUE_1, name: 'Astral Sanctum League', season: '2025' },
            { league_id: MOCK_LEAGUE_2, name: 'Second League Beta', season: '2025' },
          ],
        };
      }
      if (urlStr.includes('/user/' + MOCK_USER_ID + '/leagues/nfl/2024')) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      const { user, leagues } = await sleeper.fetchUserLeagues('OneiroVanguard');
      assert.equal(user.user_id, MOCK_USER_ID);
      assert.equal(leagues.length, 2);
      assert.equal(leagues[0].league_id, MOCK_LEAGUE_1);
      assert.equal(leagues[0].name, 'Astral Sanctum League');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3.5 should derive team ownership from rosters where owner_id === user_id', () => {
    const state = sleeper.transformToDraftState(
      draftMeta,
      draftPicks,
      { user_id: REAL_USER_ID, sleeper_username: 'OneiroVanguard', league_id: REAL_LEAGUE_ID },
      undefined,
      leagueUsers,
      leagueRosters,
      leagueMatchups,
      leagueInfo
    );

    // Verify roster has players from roster 2 (owner_id === REAL_USER_ID)
    const rosteredPlayerIds = state.my_roster
      .map((slot) => slot.player?.id)
      .filter(Boolean);
    assert.ok(rosteredPlayerIds.includes('6768'), 'My roster must include player picked by derived team (Tua 6768)');
    assert.ok(rosteredPlayerIds.includes('6813'), 'My roster must include player picked by derived team (JT 6813)');
    assert.ok(!rosteredPlayerIds.includes('4984'), 'My roster must not include opponent pick (Josh Allen 4984)');
  });

  test("3.6 should ingest OneiroVanguard's live active roster with 15 players and 8 starters aligned with league superflex", () => {
    const CANONICAL_USER_ID = REAL_USER_ID;
    const CANONICAL_ROSTER_ID = 2;

    const state = sleeper.transformToDraftState(
      draftMeta,
      draftPicks,
      { user_id: CANONICAL_USER_ID, sleeper_username: 'OneiroVanguard', league_id: REAL_LEAGUE_ID },
      undefined,
      leagueUsers,
      leagueRosters,
      leagueMatchups,
      leagueInfo
    );

    // 1. my_roster must contain exactly 15 slots
    assert.equal(state.my_roster.length, 15, 'Roster must contain exactly 15 slots');

    // 2. All 15 player IDs from OneiroVanguard's live active roster must be present
    const canonicalRoster = leagueRosters.find((r) => r.roster_id === CANONICAL_ROSTER_ID);
    const rosteredIds = state.my_roster.map((s) => s.player?.id).filter(Boolean);
    assert.equal(rosteredIds.length, 15, 'All 15 players must be populated');
    for (const expectedId of canonicalRoster.players) {
      assert.ok(rosteredIds.includes(expectedId), 'Roster must include live player ' + expectedId);
    }

    // 3. Stale draft picks that were dropped/traded (1373, 10228) must NOT be in my_roster
    assert.ok(!rosteredIds.includes('1373'), 'Must not include dropped draft pick 1373 (Geno Smith)');
    assert.ok(!rosteredIds.includes('10228'), 'Must not include dropped draft pick 10228 (Charlie Jones)');

    // 4. Free agent acquisitions (13296, 4574, 5001, 8180) not in draft picks MUST be on roster
    assert.ok(rosteredIds.includes('13296'), 'Must include free agent add 13296 (Caleb Douglas)');
    assert.ok(rosteredIds.includes('4574'), 'Must include free agent add 4574 (Cooper Rush)');
    assert.ok(rosteredIds.includes('5001'), 'Must include free agent add 5001 (Dalton Schultz)');
    assert.ok(rosteredIds.includes('8180'), 'Must include free agent add 8180 (Jalen Nailor)');

    // 5. Starters must be mapped 1-to-1 to starting slots
    const starterSlots = state.my_roster.slice(0, 8);
    assert.equal(starterSlots[0].slot_id, 'QB');
    assert.equal(starterSlots[0].player?.id, '4574', 'Cooper Rush must be QB starter');
    assert.equal(starterSlots[1].slot_id, 'RB1');
    assert.equal(starterSlots[1].player?.id, '6813', 'JT must be RB1 starter');
    assert.equal(starterSlots[2].slot_id, 'RB2');
    assert.equal(starterSlots[2].player?.id, '9224', 'Chase Brown must be RB2 starter');
    assert.equal(starterSlots[3].slot_id, 'WR1');
    assert.equal(starterSlots[3].player?.id, '7547', 'Amon-Ra must be WR1 starter');
    assert.equal(starterSlots[4].slot_id, 'WR2');
    assert.equal(starterSlots[4].player?.id, '10229', 'Rashee Rice must be WR2 starter');
    assert.equal(starterSlots[5].slot_id, 'TE');
    assert.equal(starterSlots[5].player?.id, '8131', 'Likely must be TE starter');
    assert.equal(starterSlots[6].slot_id, 'FLEX');
    assert.equal(starterSlots[6].player?.id, '7588', 'Javonte must be FLEX starter');
    assert.equal(starterSlots[7].slot_id, 'SUPER_FLEX');
    assert.equal(starterSlots[7].player?.id, '96', 'Rodgers must be SUPER_FLEX starter');

    // 6. Bench slots must include Josh Jacobs (5850 - benched), Tua Tagovailoa (6768 - OUT/IR), and Braelon Allen (11576)
    const benchSlots = state.my_roster.slice(8);
    assert.equal(benchSlots.length, 7);
    const benchIds = benchSlots.map((s) => s.player?.id);
    assert.ok(benchIds.includes('5850'), 'Josh Jacobs (5850) must be on bench');
    assert.ok(benchIds.includes('11576'), 'Braelon Allen (11576) must be on bench');
    assert.ok(benchIds.includes('6768'), 'Tua Tagovailoa (6768 - Out) must be on bench');

    // 7. Team name in competitorTeams
    const userTeam = state.competitor_teams.find((t) => t.roster_id === CANONICAL_ROSTER_ID);
    assert.ok(userTeam);
    assert.ok(userTeam.name.includes('CrimsonPhoenix') || userTeam.name.includes('AstralOracles'), 'Team name must reflect CrimsonPhoenix or AstralOracles');
  });

  test('3.7 getUser resolves real user profile and handles spelling fallback', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/user/OneiroVangard')) {
        return { ok: true, status: 200, json: async () => null };
      }
      if (urlStr.includes('/user/OneiroVanguard')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockUser,
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      const user = await sleeper.getUser('OneiroVangard');
      assert.equal(user.user_id, REAL_USER_ID);
      assert.equal(user.username, 'oneirovanguard');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3.8 should resolve a different user in the league without reverting to OneiroVanguard', async () => {
    const originalFetch = global.fetch;
    const CHALLENGER_USER_ID = '9000000000000000105'; // LyraEnchantress
    const CANONICAL_USER_ID = REAL_USER_ID;

    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueDrafts,
        };
      }
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/users')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueUsers,
        };
      }
      if (urlStr.includes('/draft/' + REAL_DRAFT_ID)) {
        return {
          ok: true,
          status: 200,
          json: async () => draftMeta,
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      // 1. Test resolveLeagueDraftAndUser resolves LyraEnchantress and NOT OneiroVanguard
      const resolved = await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'lyraenchantress');
      assert.equal(resolved.user_id, CHALLENGER_USER_ID, 'Must resolve LyraEnchantress user_id');
      assert.equal(resolved.display_name, 'LyraEnchantress', 'Must resolve LyraEnchantress display name');
      assert.equal(resolved.user_slot, 1, 'Must resolve draft slot 1');
      assert.notEqual(resolved.user_id, CANONICAL_USER_ID, 'Must NOT resolve OneiroVanguard');

      // 2. Test transformToDraftState creates state for LyraEnchantress and NOT OneiroVanguard
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'lyraenchantress', league_id: REAL_LEAGUE_ID },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchups,
        leagueInfo
      );

      assert.equal(state.settings.user_id, CHALLENGER_USER_ID, 'State user_id must be LyraEnchantress');
      assert.equal(state.settings.user_slot, 1, 'State user_slot must be 1 (derived from draft_order)');

      // 3. Roster must contain LyraEnchantress's players and NOT OneiroVanguard's starters
      const rosterPlayerIds = state.my_roster.map((s) => s.player?.id).filter(Boolean);
      assert.ok(rosterPlayerIds.includes('8150'), 'Must include LyraEnchantress player 8150 (Kyren Williams)');
      assert.ok(!rosterPlayerIds.includes('6768'), 'Must NOT include OneiroVanguard player 6768 (Tua)');

      // 4. Competitor team for LyraEnchantress must have (You)
      const userTeam = state.competitor_teams.find((t) => t.owner_id === CHALLENGER_USER_ID);
      assert.ok(userTeam, 'User team must be found in competitor_teams');
      assert.ok(userTeam.name.includes('(You)'), 'Must mark LyraEnchantress team as (You)');
      assert.ok(userTeam.name.includes('Supernova Surge'), 'Must reflect LyraEnchantress team name Supernova Surge');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("3.9 should continue to resolve OneiroVanguard\'s team accurately when OneiroVanguard or OneiroVangard is requested", async () => {
    const originalFetch = global.fetch;
    const CANONICAL_USER_ID = REAL_USER_ID;

    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueDrafts,
        };
      }
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/users')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueUsers,
        };
      }
      if (urlStr.includes('/draft/' + REAL_DRAFT_ID)) {
        return {
          ok: true,
          status: 200,
          json: async () => draftMeta,
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      const resStrategist = await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'OneiroVanguard');
      assert.equal(resStrategist.user_id, CANONICAL_USER_ID);
      assert.equal(resStrategist.display_name, 'OneiroVanguard');
      assert.equal(resStrategist.user_slot, 7);

      const resStrat = await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'OneiroVangard');
      assert.equal(resStrat.user_id, CANONICAL_USER_ID);
      assert.equal(resStrat.display_name, 'OneiroVanguard');
      assert.equal(resStrat.user_slot, 7);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3.10 should throw clear error and preserve username when unknown user is queried', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/user/UnknownUserXYZ999')) {
        return { ok: false, status: 404 };
      }
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/drafts')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueDrafts,
        };
      }
      if (urlStr.includes('/league/' + REAL_LEAGUE_ID + '/users')) {
        return {
          ok: true,
          status: 200,
          json: async () => leagueUsers,
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      await assert.rejects(
        async () => {
          await sleeper.resolveLeagueDraftAndUser(REAL_LEAGUE_ID, 'UnknownUserXYZ999');
        },
        (err) => {
          assert.ok(err.message.includes('UnknownUserXYZ999'), 'Error must mention unknown user');
          assert.ok(err.message.includes('not found in Sleeper league'), 'Error must state user not found');
          return true;
        }
      );

      // Verify fetchSleeperDraft fallback preserves the typed username instead of reverting to OneiroVanguard
      const fallbackState = await sleeper.fetchSleeperDraft(
        undefined,
        { sleeper_username: 'UnknownUserXYZ999', league_id: REAL_LEAGUE_ID }
      );
      assert.equal(fallbackState.settings.sleeper_username, 'UnknownUserXYZ999', 'Username must be preserved');
      assert.ok(fallbackState.sync_error, 'Sync error must be present');
      assert.ok(fallbackState.sync_error.includes('UnknownUserXYZ999'), 'Sync error must mention UnknownUserXYZ999');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3.11 should accurately map SupernovaSurge (Slot 1) active roster with Kyren Williams and Kyle Pitts without mock name bleed', async () => {
    const SUPERNOVA_USER_ID = '9000000000000000105';

    const mockPlayerDict = {
      '4984': {
        player_id: '4984',
        first_name: 'Josh',
        last_name: 'Allen',
        full_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        status: 'Active',
        number: 17,
      },
      '7553': {
        player_id: '7553',
        first_name: 'Kyle',
        last_name: 'Pitts',
        full_name: 'Kyle Pitts',
        position: 'TE',
        team: 'ATL',
        status: 'Active',
        number: 8,
      },
      '8150': {
        player_id: '8150',
        first_name: 'Kyren',
        last_name: 'Williams',
        full_name: 'Kyren Williams',
        position: 'RB',
        team: 'LAR',
        status: 'Active',
        number: 23,
      },
    };

    const state = sleeper.transformToDraftState(
      draftMeta,
      draftPicks,
      { sleeper_username: 'LyraEnchantress', league_id: REAL_LEAGUE_ID },
      mockPlayerDict,
      leagueUsers,
      leagueRosters,
      leagueMatchups,
      leagueInfo
    );

    // 1. Verify user settings
    assert.equal(state.settings.user_id, SUPERNOVA_USER_ID);
    assert.equal(state.settings.user_slot, 1);

    // 2. Verify starters mapping
    const starters = state.my_roster.slice(0, 8);
    assert.equal(starters[0].slot_id, 'QB');
    assert.equal(starters[0].player?.name, 'Josh Allen');

    assert.equal(starters[1].slot_id, 'RB1');
    assert.equal(starters[1].player?.id, '8150');
    assert.equal(starters[1].player?.name, 'Kyren Williams', 'RB1 must be Kyren Williams');
    assert.equal(starters[1].player?.position, 'RB', 'RB1 position must be RB');
    assert.equal(starters[1].player?.team, 'LAR', 'RB1 team must be LAR');
    assert.notEqual(starters[1].player?.name, 'Rachaad White', 'Must NOT be Rachaad White');

    assert.equal(starters[5].slot_id, 'TE');
    assert.equal(starters[5].player?.id, '7553');
    assert.equal(starters[5].player?.name, 'Kyle Pitts', 'TE must be Kyle Pitts');
    assert.equal(starters[5].player?.position, 'TE', 'TE position must be TE');
    assert.equal(starters[5].player?.team, 'ATL', 'TE team must be ATL');
    assert.notEqual(starters[5].player?.name, 'Amon-Ra St. Brown', 'Must NOT be Amon-Ra St. Brown');

    // 3. Ensure no accidental Rachaad White or Amon-Ra St. Brown substitutions exist anywhere on SupernovaSurge roster
    const allRosterNames = state.my_roster.map((s) => s.player?.name).filter(Boolean);
    assert.ok(!allRosterNames.includes('Rachaad White'), 'Roster must NOT contain Rachaad White');
    assert.ok(!allRosterNames.includes('Amon-Ra St. Brown'), 'Roster must NOT contain Amon-Ra St. Brown');

    // 4. Verify enrichCosmicBoardWithNFLPlayers overrides any stale mock names and positions
    const testBoard = [
      { id: '7553', name: 'Amon-Ra St. Brown', first_name: 'Amon-Ra', last_name: 'St. Brown', position: 'WR', team: 'DET' },
      { id: '8150', name: 'Rachaad White', first_name: 'Rachaad', last_name: 'White', position: 'RB', team: 'TB' },
    ];
    const enriched = sleeper.enrichCosmicBoardWithNFLPlayers(testBoard, mockPlayerDict);
    const pitts = enriched.find((p) => p.id === '7553');
    assert.equal(pitts.name, 'Kyle Pitts');
    assert.equal(pitts.position, 'TE');
    assert.equal(pitts.team, 'ATL');
    const kyren = enriched.find((p) => p.id === '8150');
    assert.equal(kyren.name, 'Kyren Williams');
    assert.equal(kyren.position, 'RB');
    assert.equal(kyren.team, 'LAR');
  });

  // ==========================================================================
  // Section 4: 7-Point Resolution for Comment #68 Verification
  // ==========================================================================
  describe('Challenger: 7-Point Resolution for Comment #68', () => {
    test('4.1 should verify Week 1 Matchup Projections: AstralOracles 130.65 vs lunareclipse 105.12', () => {
      const matchup = mockData.mockWeeklyMatchup;
      assert.equal(matchup.week, 1);
      assert.equal(matchup.user_team.team_name, 'AstralOracles (You)');
      assert.equal(matchup.user_team.projected_points, 130.65);
      assert.equal(matchup.opponent_team.team_name, 'lunareclipse');
      assert.equal(matchup.opponent_team.projected_points, 105.12);

      // Verify OneiromancyDashboard formats projections to two decimal places
      const oneiromancyCode = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(
        oneiromancyCode.includes('weeklyMatchup.user_team.projected_points.toFixed(2)'),
        'User projected points must be formatted to 2 decimals'
      );
      assert.ok(
        oneiromancyCode.includes('weeklyMatchup.opponent_team.projected_points.toFixed(2)'),
        'Opponent projected points must be formatted to 2 decimals'
      );
    });

    test('4.2 should verify Astrological Harmony and complete purge of football coaching jargon', () => {
      const oneiromancyCode = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      // Pillar 2 must be authentic Astrological / Celestial Conjunction
      assert.ok(
        oneiromancyCode.includes('2. Celestial Conjunction & Major Aspects'),
        'Must explain Celestial Conjunction & Major Aspects pillar'
      );
      assert.ok(
        !oneiromancyCode.includes('2. Stack Amplification'),
        'Must NOT contain football stack jargon in Harmony pillar title'
      );
      assert.ok(
        !oneiromancyCode.includes('Pairing QBs with elite pass-catchers compounds drive efficiency'),
        'Must NOT contain coaching jargon about pairing QBs with pass catchers'
      );
      assert.ok(
        oneiromancyCode.includes('Elemental & Celestial Aspect Radar'),
        'Radar title must be Elemental & Celestial Aspect Radar'
      );
      assert.ok(
        oneiromancyCode.includes('Aspects ({activeAspects.length})'),
        'Radar 5th axis label must be Aspects'
      );
      assert.ok(
        oneiromancyCode.includes('Astral Synergy Conjunction'),
        'Player Synergy Matrix must refer to Astral Synergy Conjunction'
      );
      assert.ok(
        oneiromancyCode.includes('☌ (Conjunction)'),
        'Must display astrological conjunction symbol'
      );
    });

    test('4.3 should verify strict single-user competitor identity and populated aggregated metrics', () => {
      const teams = mockData.mockCompetitorTeams;
      assert.equal(teams.length, 12, 'Must have 12 competitor teams');

      // Strictly one team is marked is_user and (You)
      const userTeams = teams.filter((t) => t.is_user === true || t.name.includes('(You)'));
      assert.equal(userTeams.length, 1, 'Strictly ONE team may be marked as user team');
      assert.equal(userTeams[0].slot, 7, 'User team must be slot 7');
      assert.equal(userTeams[0].name, 'AstralOracles (You)');

      // Slots 2, 5 verification: slot 2 and 5 must NOT be user
      const slot2 = teams.find((t) => t.slot === 2);
      const slot5 = teams.find((t) => t.slot === 5);
      assert.ok(!slot2.is_user, 'Slot 2 must NOT be is_user');
      assert.ok(!slot2.name.includes('(You)'), 'Slot 2 must NOT have (You)');
      assert.ok(!slot5.is_user, 'Slot 5 must NOT be is_user');
      assert.ok(!slot5.name.includes('(You)'), 'Slot 5 must NOT have (You)');

      // Verify all competitor teams have valid DraftScore, SpiritScore, and Harmony metrics
      for (const t of teams) {
        assert.ok(typeof t.total_draft_score === 'number' && t.total_draft_score > 0, 'Team ' + t.slot + ' must have total_draft_score');
        assert.ok(typeof t.total_spirit_score === 'number' && t.total_spirit_score > 0, 'Team ' + t.slot + ' must have total_spirit_score');
        assert.ok(typeof t.avg_draft_score === 'number' && t.avg_draft_score > 0, 'Team ' + t.slot + ' must have avg_draft_score');
        assert.ok(typeof t.avg_spirit_score === 'number' && t.avg_spirit_score > 0, 'Team ' + t.slot + ' must have avg_spirit_score');
        assert.ok(typeof t.harmony_score === 'number' && t.harmony_score > 0, 'Team ' + t.slot + ' must have harmony_score');
      }
    });

    test('4.4 should verify minimized Ascension Path when draft is complete with expand/collapse toggle', () => {
      const oneiromancyCode = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancyCode.includes('isDraftComplete'), 'Must compute isDraftComplete');
      assert.ok(oneiromancyCode.includes('isAscensionExpanded'), 'Must track isAscensionExpanded state');
      assert.ok(oneiromancyCode.includes('Show Completed Ascension Path'), 'Must provide Show Completed Ascension Path button');
      assert.ok(oneiromancyCode.includes('Collapse Ascension Path'), 'Must provide Collapse Ascension Path button');
    });

    test('4.5 should verify ChaosDial covers all 8 esoteric reference topics with classical citations', () => {
      const chaosCode = fs.readFileSync(path.resolve('components/screens/ChaosDial.tsx'), 'utf8');
      assert.ok(chaosCode.includes('Western Tropical Zodiac & Natal Degrees'), 'Topic 1: Western Tropical Zodiac');
      assert.ok(chaosCode.includes('Planetary Rulerships & Domiciles'), 'Topic 2: Planetary Rulerships');
      assert.ok(chaosCode.includes('Natal Chart Planetary Aspects'), 'Topic 3: Planetary Aspects');
      assert.ok(chaosCode.includes('Elemental Triplicities in Gridiron Divination'), 'Topic 4: Elemental Triplicities');
      assert.ok(chaosCode.includes('Pythagorean Numerology & Life Path Resonance'), 'Topic 5: Pythagorean Numerology');
      assert.ok(chaosCode.includes('Lunar Phases & Void of Course (VoC) Transits'), 'Topic 6: Lunar Phases & VoC');
      assert.ok(chaosCode.includes('Chaos Dial & Lambda (λ) Mathematical Equilibrium') || chaosCode.includes('Chaos Dial &amp; Lambda (&lambda;) Mathematical Equilibrium'), 'Topic 7: Chaos Lambda');
      assert.ok(chaosCode.includes('Classical Bibliography & Ephemeris Systems') || chaosCode.includes('Classical Bibliography &amp; Ephemeris Systems'), 'Topic 8: Classical Bibliography');
      assert.ok(chaosCode.includes('Claudius Ptolemy') && chaosCode.includes('Tetrabiblos'), 'Citation: Ptolemy Tetrabiblos');
      assert.ok(chaosCode.includes('Johannes Kepler') && chaosCode.includes('Harmonices Mundi'), 'Citation: Kepler Harmonices Mundi');
      assert.ok(chaosCode.includes('NASA Jet Propulsion Laboratory') || chaosCode.includes('NASA JPL'), 'Citation: NASA JPL Horizons');
      assert.ok(chaosCode.includes('Swiss Ephemeris'), 'Citation: Swiss Ephemeris');
    });

    test('4.6 should verify roster-constrained Marketplace drops and trade proposals', () => {
      const activeRosterIds = mockData.mockMyRoster.filter((s) => s.player).map((s) => s.player.id);
      // Waiver drops must be strictly within active user roster
      for (const upgrade of mockData.mockWaiverUpgrades) {
        assert.ok(
          activeRosterIds.includes(upgrade.recommended_drop_id),
          'Recommended drop ' + upgrade.recommended_drop_name + ' (' + upgrade.recommended_drop_id + ') must be in active roster'
        );
      }

      // Trade give_players must be strictly within active user roster
      for (const trade of mockData.mockTradeProposals) {
        for (const give of trade.give_players) {
          assert.ok(
            activeRosterIds.includes(give.player_id),
            'Trade give player ' + give.player_name + ' (' + give.player_id + ') must be in active roster'
          );
        }
      }
    });

    test('4.7 should verify transformToDraftState enforces strict single-team identity dynamically', () => {
      const metadata = {
        draft_id: 'test_draft_47',
        status: 'complete',
        draft_order: { 'user_commander': 5 },
        settings: { rounds: 15, teams: 12 },
      };
      const mockUsers = [
        { user_id: 'user_commander', display_name: 'OneiroCommander', metadata: { team_name: 'AstralOracles' } },
        { user_id: 'user_opp2', display_name: 'lunareclipse' },
        { user_id: 'user_opp7', display_name: 'Other Rival' },
      ];
      const mockRosters = [
        { roster_id: 2, owner_id: 'user_opp2', players: ['8146'] },
        { roster_id: 5, owner_id: 'user_commander', players: ['4881', '7561'] },
        { roster_id: 7, owner_id: 'user_opp7', players: ['4034'] },
      ];

      const state = sleeper.transformToDraftState(
        metadata,
        [],
        { sleeper_username: 'OneiroCommander', user_id: 'user_commander', user_slot: 5 },
        {},
        mockUsers,
        mockRosters,
        [],
        { roster_positions: ['QB', 'RB', 'BN'] }
      );

      const userTeams = state.competitor_teams.filter((t) => t.is_user === true || t.name.includes('(You)'));
      assert.equal(userTeams.length, 1, 'Exactly one team must be user team');
      assert.equal(userTeams[0].roster_id, 5);

      const slot2 = state.competitor_teams.find((t) => t.roster_id === 2);
      const slot7 = state.competitor_teams.find((t) => t.roster_id === 7);
      assert.equal(slot2.is_user, false);
      assert.equal(slot2.name.includes('(You)'), false);
      assert.equal(slot7.is_user, false);
      assert.equal(slot7.name.includes('(You)'), false);
    });
  });

  describe('5. Comment #71 Resolution: Unowned Free Agents, Win Probability, SpiritScore Dynamic Range', () => {
    test('5.1 should ensure waiver upgrade targets are strictly unowned free agents across entire league', () => {
      const activeRosterIds = new Set(['4881', '7561', '5850', '8146', '6794', '4034', '8150', '284', '6783', '11576', '8145']);
      const competitorPicksIds = new Set(
        mockData.mockCompetitorTeams.flatMap((t) => t.picks?.map((p) => p.player_id) || [])
      );
      const allRosteredIds = new Set([...activeRosterIds, ...competitorPicksIds]);

      for (const upgrade of mockData.mockWaiverUpgrades) {
        assert.ok(
          !allRosteredIds.has(upgrade.id),
          'Waiver target ' + upgrade.name + ' (' + upgrade.id + ') must NOT be owned by any team in the league'
        );
      }
    });

    test('5.2 should verify dynamic win probability reflects projected point split with >70% for OneiroVanguard (+25.53 delta)', () => {
      const matchup = mockData.mockWeeklyMatchup;
      const userPts = matchup.user_team.projected_points;
      const oppPts = matchup.opponent_team.projected_points;
      const diff = userPts - oppPts;
      assert.ok(diff > 20, 'Projected point difference must be substantial (+' + diff.toFixed(2) + ')');

      const winProb = matchup.win_probability;
      assert.ok(typeof winProb === 'number', 'win_probability must be defined as a number');
      assert.ok(winProb >= 70.0, 'Win probability for +' + diff.toFixed(2) + ' point lead must exceed 70% (actual: ' + winProb + '%)');
      assert.equal(matchup.win_probability_label, 'Heavy Astral Favorite');
    });

    test('5.3 should verify competitor teams exhibit wide dynamic range (std dev > 5.0, min < 75.0, max > 88.0)', () => {
      const teams = mockData.mockCompetitorTeams;
      const scores = teams.map((t) => t.avg_spirit_score || 80.0);

      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);

      assert.ok(stdDev > 5.0, 'SpiritScore standard deviation must be > 5.0 for realistic dynamic spread (actual: ' + stdDev.toFixed(2) + ')');
      assert.ok(minScore < 75.0, 'Minimum SpiritScore must fall into discordant tier < 75.0 (actual: ' + minScore + ')');
      assert.ok(maxScore > 88.0, 'Maximum SpiritScore must reach favorable tier > 88.0 (actual: ' + maxScore + ')');
    });

    test('5.4 should verify OneiroVanguard\'s team (Slot 7) is ranked #1 in Favorable Apex tier (>= 85.0)', () => {
      const teams = mockData.mockCompetitorTeams;
      const commander = teams.find((t) => (t.slot || t.roster_id) === 7);
      assert.ok(commander, 'OneiroVanguard team (Slot 7) must exist');
      assert.ok(commander.avg_spirit_score >= 85.0, 'OneiroVanguard team SpiritScore must be >= 85.0 (actual: ' + commander.avg_spirit_score + ')');
      assert.equal(commander.favorability_tier, 'Favorable');

      // Check that OneiroVanguard is #1 among all teams
      for (const t of teams) {
        if (t.slot !== 7) {
          assert.ok(commander.avg_spirit_score >= t.avg_spirit_score, 'OneiroVanguard (' + commander.avg_spirit_score + ') must be >= ' + t.name + ' (' + t.avg_spirit_score + ')');
        }
      }
    });

    test('5.5 should verify favorability indicators properly assigned based on 85.0 and 75.0 thresholds', () => {
      const favorableTeams = mockData.mockCompetitorTeams.filter((t) => t.favorability_tier === 'Favorable');
      const harmonicTeams = mockData.mockCompetitorTeams.filter((t) => t.favorability_tier === 'Harmonic');
      const discordantTeams = mockData.mockCompetitorTeams.filter((t) => t.favorability_tier === 'Discordant');

      assert.ok(favorableTeams.length >= 2, 'Must have at least 2 Favorable teams');
      assert.ok(harmonicTeams.length >= 4, 'Must have at least 4 Harmonic teams');
      assert.ok(discordantTeams.length >= 2, 'Must have at least 2 Discordant teams');

      for (const t of favorableTeams) {
        assert.equal(t.favorability_tier, 'Favorable');
        assert.ok((t.avg_spirit_score || 0) >= 85.0, 'Favorable team score must be >= 85.0');
      }
      for (const t of harmonicTeams) {
        assert.equal(t.favorability_tier, 'Harmonic');
      }
      for (const t of discordantTeams) {
        assert.equal(t.favorability_tier, 'Discordant');
        assert.ok((t.avg_spirit_score || 0) < 75.0, 'Discordant team score must be < 75.0');
      }
    });

    test('5.6 should verify unified harmony score: top-level Harmony matches competitor roster card harmony score (98)', () => {
      const teams = mockData.mockCompetitorTeams;
      const commander = teams.find((t) => (t.slot || t.roster_id) === 7);
      assert.ok(commander, 'OneiroVanguard team must exist in mockCompetitorTeams');
      assert.equal(commander.harmony_score, 98.0, 'OneiroVanguard team harmony_score in competitor cards must be 98.0');

      const oneiromancyCode = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancyCode.includes('userTeam?.harmony_score'), 'OneiromancyDashboard must read userTeam.harmony_score');
      assert.ok(oneiromancyCode.includes('{harmonyScore} / 100 HARMONY'), 'OneiromancyDashboard must render dynamic harmonyScore in header');
      assert.ok(oneiromancyCode.includes('{harmonyScore}'), 'Radar chart center node must render harmonyScore');
    });
  });
});
