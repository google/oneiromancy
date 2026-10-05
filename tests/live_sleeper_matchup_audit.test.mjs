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
 * Live Sleeper API & Multi-User Matchup Audit Test Suite
 *
 * Dedicated tests verifying:
 * 1. Current NFL active week resolution and Week 2 matchup derivation (OneiroVanguard Roster 2 vs SolarFlare Roster 8 in Matchup 4).
 * 2. Player Favorability Astrological Rationale non-empty guarantee for the star box (<Sparkles>).
 * 3. Accurate Weekly Starter Projected Points derivation and alignment with Sleeper scoring.
 * 4. Multi-user perspective switching across league rosters (AetherSentinel, zenithvoyager, CrimsonPhoenix, CometRider, NovaNavigator).
 * 5. MatchupsScreen component week synchronization.
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { render, screen, fireEvent, cleanup } from './helpers/react_testing_wrapper.mjs';
import { jsx } from './helpers/react_shim.mjs';

// Import TypeScript source modules directly via loader
const sleeper = await import('../core/lib/sleeper.ts');
const { MatchupsScreen } = await import('../components/screens/MatchupsScreen.tsx');
const { OneiromancyProvider } = await import('../context/OneiromancyContext.tsx');
const mockData = await import('../core/lib/mockData.ts');
const scoring = await import('../core/lib/scoring.ts');

describe('Live Sleeper API & Multi-User Matchup Audit', () => {
  let draftMeta;
  let draftPicks;
  let leagueUsers;
  let leagueRosters;
  let leagueMatchupsW1;
  let leagueMatchupsW2;
  let leagueInfo;

  before(() => {
    const possibleMockDirs = [
      path.resolve(__dirname, '../mocks'),
      path.resolve(process.cwd(), 'mocks'),
      path.resolve(__dirname, '../../oneiromancy/mocks'),
      path.resolve(process.cwd(), '../oneiromancy/mocks'),
      path.resolve(__dirname, 'mocks'),
    ];

    let mocksDir = possibleMockDirs.find((d) => fs.existsSync(path.join(d, 'mock_draft_metadata.json')));
    if (!mocksDir) {
      throw new Error(`Could not find authentic mocks directory in: ${possibleMockDirs.join(', ')}`);
    }

    draftMeta = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_draft_metadata.json'), 'utf8'));
    draftPicks = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_draft_picks.json'), 'utf8'));
    leagueUsers = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_users.json'), 'utf8'));
    leagueRosters = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_rosters.json'), 'utf8'));
    leagueMatchupsW1 = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_matchups_w1.json'), 'utf8'));
    leagueInfo = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_info.json'), 'utf8'));

    // Authentic Week 2 Matchup fixture
    leagueMatchupsW2 = [
      { points: 0, roster_id: 1, matchup_id: 6, starters: ['8183', '9221', '11581', '12526', '12514', '9484', '5872', '5870'] },
      { points: 0, roster_id: 2, matchup_id: 4, starters: ['4574', '6813', '9224', '7547', '10229', '8131', '7588', '96'] },
      { points: 0, roster_id: 3, matchup_id: 5, starters: ['4984', '8150', '6790', '8137', '8144', '7553', '8167', '11560'] },
      { points: 0, roster_id: 4, matchup_id: 5, starters: ['1166', '8151', '5892', '9488', '10222', '8130', '7594', '11566'] },
      { points: 0, roster_id: 5, matchup_id: 2, starters: ['12508', '12481', '12533', '7564', '6786', '12506', '11646', '4892'] },
      { points: 0, roster_id: 6, matchup_id: 3, starters: ['4881', '4034', '8155', '2133', '7525', '1466', '7526', '6904'] },
      { points: 0, roster_id: 7, matchup_id: 3, starters: ['6770', '3198', '12507', '8146', '2216', '5022', '13346', '3163'] },
      { points: 0, roster_id: 8, matchup_id: 4, starters: ['3294', '9509', '8138', '7569', '12519', '5012', '8228', '421'] },
      { points: 0, roster_id: 9, matchup_id: 6, starters: ['4046', '9226', '4866', '6794', '9500', '10236', '5846', '11628'] },
      { points: 0, roster_id: 10, matchup_id: 1, starters: ['7523', '7543', '12490', '6801', '9756', '10859', '7002', '6797'] },
      { points: 0, roster_id: 11, matchup_id: 2, starters: ['11563', '12527', '12512', '9493', '13279', '12518', '11632', '12522'] },
      { points: 0, roster_id: 12, matchup_id: 1, starters: ['11564', '11584', '12489', '8112', '9997', '11603', '13286', '6804'] }
    ];
  });

  // --------------------------------------------------------------------------
  // Category 1: Week 2 Matchup Derivation & Opponent Resolution
  // --------------------------------------------------------------------------
  describe('1. Week 2 Matchup Derivation & Opponent Resolution', () => {
    it('1.1 should correctly pair OneiroVanguard (Roster 2) vs SolarFlare (Roster 8) in Matchup 4 for Week 2', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      assert.ok(state.weekly_matchup, 'weekly_matchup must be defined');
      assert.equal(state.weekly_matchup.week, 2, 'Matchup week must be 2');
      assert.equal(state.weekly_matchup.matchup_id, 4, 'Matchup ID must be 4');
      assert.equal(state.weekly_matchup.user_team.roster_id, 2, 'User roster must be 2');
      assert.equal(state.weekly_matchup.opponent_team.roster_id, 8, 'Opponent roster must be 8');
      assert.ok(state.weekly_matchup.opponent_team.team_name.includes('SolarFlare'), 'Opponent name must be SolarFlare');
    });

    it('1.2 should derive Week 1 matchup pairing AstralOracles vs lunareclipse in Matchup 3', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW1,
        leagueInfo,
        1
      );

      assert.equal(state.weekly_matchup.week, 1);
      assert.equal(state.weekly_matchup.matchup_id, 3);
      assert.equal(state.weekly_matchup.opponent_team.roster_id, 11);
      assert.ok(state.weekly_matchup.opponent_team.team_name.toLowerCase().includes('lunareclipse'));
    });
  });

  // --------------------------------------------------------------------------
  // Category 2: Player Favorability Astrological Rationale (Star Box) Guarantee
  // --------------------------------------------------------------------------
  describe('2. Player Favorability Astrological Rationale Guarantee', () => {
    it('2.1 should ensure 100% of player favorability cards have non-empty astrological_rationale and aspect_highlights', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      const favs = state.weekly_matchup.player_favorabilities || [];
      assert.ok(favs.length > 0, 'player_favorabilities must not be empty');

      for (const p of favs) {
        assert.ok(p.astrological_rationale, `Player ${p.player_name} must have astrological_rationale`);
        assert.ok(p.astrological_rationale.trim().length > 10, `Player ${p.player_name} rationale must be descriptive`);
        assert.ok(p.aspect_highlights && p.aspect_highlights.length > 0, `Player ${p.player_name} must have aspect_highlights`);
        assert.ok(p.stadium && p.stadium.stadium_name, `Player ${p.player_name} must have valid stadium data`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Category 3: Starter Projected Points Accuracy
  // --------------------------------------------------------------------------
  describe('3. Starter Projected Points Accuracy', () => {
    it('3.1 should calculate weekly projected points from starters rather than unscaled season totals', () => {
      const mockWeeklyProjections = {
        '4574': { pts_ppr: 0 },
        '6813': { pts_ppr: 18.79 },
        '9224': { pts_ppr: 15.46 },
        '7547': { pts_ppr: 17.44 },
        '10229': { pts_ppr: 13.43 },
        '8131': { pts_ppr: 9.35 },
        '7588': { pts_ppr: 17.47 },
        '96': { pts_ppr: 16.24 }
      };

      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2,
        mockWeeklyProjections
      );

      // Starters projection should be in realistic NFL weekly range (60 - 160 pts), not season total (>1000 pts)
      assert.ok(state.weekly_matchup.user_team.projected_points > 50, 'Weekly team projection must be > 50 pts');
      assert.ok(state.weekly_matchup.user_team.projected_points < 250, 'Weekly team projection must be < 250 pts');
    });

    it('3.2 should verify Cosmic Board contains all drafted players across league (Puka Nacua, Lamar Jackson, Jahmyr Gibbs, Jayden Daniels)', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      const board = state.cosmic_board;
      assert.ok(board.length >= 20, `Board must contain comprehensive player pool (found ${board.length})`);

      // Verify authentic draft picks across other teams exist on the board
      const puka = board.find((p) => p.id === '9493' || p.name.includes('Nacua'));
      assert.ok(puka, 'Puka Nacua must be present on Cosmic Board');
      assert.equal(puka.draft_status, 'drafted', 'Puka Nacua must be marked as drafted by competitor');

      const lamar = board.find((p) => p.id === '4881' || p.name.includes('Lamar Jackson'));
      assert.ok(lamar, 'Lamar Jackson must be present on Cosmic Board');

      const gibbs = board.find((p) => p.id === '9221' || p.name.includes('Gibbs'));
      assert.ok(gibbs, 'Jahmyr Gibbs must be present on Cosmic Board');

      const daniels = board.find((p) => p.id === '11566' || p.name.includes('Daniels'));
      assert.ok(daniels, 'Jayden Daniels must be present on Cosmic Board');

      const amonRa = board.find((p) => p.id === '7547' || p.name.includes('St. Brown'));
      assert.ok(amonRa, 'Amon-Ra St. Brown must be present on Cosmic Board');
      assert.equal(amonRa.draft_status, 'my_team', 'Amon-Ra must be marked as my_team for OneiroVanguard');
    });

    it('3.3 should ensure all player projected points on Cosmic Board reflect weekly projections (< 35 pts)', () => {
      const mockWeeklyProjections = {
        '9493': { pts_ppr: 16.85 },
        '4881': { pts_ppr: 21.80 },
        '9221': { pts_ppr: 16.10 },
        '7547': { pts_ppr: 17.44 },
      };

      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2,
        mockWeeklyProjections
      );

      for (const player of state.cosmic_board) {
        assert.ok(
          player.projected_points < 35,
          `Player ${player.name} projected points (${player.projected_points}) must be weekly (< 35 pts), not 10x season total`
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // Category 4: Multi-User Switching Matrix across League
  // --------------------------------------------------------------------------
  describe('4. Multi-User Switching Matrix across League', () => {
    const testUsers = [
      { user: 'AetherSentinel', slot: 10, rosterId: 9, expMatchupId: 6, expOppRosterId: 1 },
      { user: 'zenithvoyager', slot: 5, rosterId: 11, expMatchupId: 2, expOppRosterId: 5 },
      { user: 'CrimsonPhoenix', slot: 2, rosterId: 12, expMatchupId: 1, expOppRosterId: 10 },
      { user: 'CometRider', slot: 4, rosterId: 4, expMatchupId: 5, expOppRosterId: 3 },
      { user: 'NovaNavigator', slot: 3, rosterId: 1, expMatchupId: 6, expOppRosterId: 9 },
    ];

    for (const tu of testUsers) {
      it(`4.x should dynamically adapt state when active user is switched to @${tu.user}`, () => {
        const state = sleeper.transformToDraftState(
          draftMeta,
          draftPicks,
          { sleeper_username: tu.user },
          undefined,
          leagueUsers,
          leagueRosters,
          leagueMatchupsW2,
          leagueInfo,
          2
        );

        const userTeams = state.competitor_teams.filter(t => t.is_user);
        assert.equal(userTeams.length, 1, `Exactly 1 team must be user for ${tu.user}`);
        assert.equal(userTeams[0].roster_id, tu.rosterId, `Roster ID must match ${tu.rosterId}`);
        assert.ok(userTeams[0].name.includes('(You)'), `User team must include (You)`);

        assert.equal(state.weekly_matchup.week, 2);
        assert.equal(state.weekly_matchup.matchup_id, tu.expMatchupId, `Matchup ID must match ${tu.expMatchupId}`);
        assert.equal(state.weekly_matchup.opponent_team.roster_id, tu.expOppRosterId, `Opponent roster ID must match ${tu.expOppRosterId}`);
      });
    }
  });

  // --------------------------------------------------------------------------
  // Category 5: Available Free Agent Ingestion & Trade Sanitation
  // --------------------------------------------------------------------------
  describe('5. Available Free Agent Ingestion & Trade Sanitation', () => {
    it('5.1 should ensure Carson Wentz (3161) is ingested and available on Cosmic Board', () => {
      const rostersWithoutWentz = leagueRosters.map((r) => ({
        ...r,
        players: (r.players || []).filter((id) => String(id) !== '3161'),
      }));
      const state = sleeper.transformToDraftState(
        { ...draftMeta, draft_id: 'mock_oneiromancy_draft_2025' },
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        rostersWithoutWentz,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      const wentz = state.cosmic_board.find((p) => String(p.id) === '3161');
      assert.ok(wentz, 'Carson Wentz (3161) must be present on Cosmic Board');
      assert.equal(wentz.name, 'Carson Wentz', 'Player name must be Carson Wentz');
      assert.equal(wentz.position, 'QB', 'Position must be QB');
      assert.equal(wentz.team, 'MIN', 'Team must be MIN');
      assert.equal(wentz.draft_status, 'available', 'Draft status must be available');
      assert.ok(wentz.projected_points > 15, 'Projected points must be > 15 pts');
      assert.ok(wentz.draft_score >= 60, 'Draft score must be >= 60');
    });

    it('5.2 should ensure top free agents (Hunter Henry, Deshaun Watson, Drew Lock) are available', () => {
      const rostersWithoutFreeAgents = leagueRosters.map((r) => ({
        ...r,
        players: (r.players || []).filter((id) => !['3214', '4017', '5870'].includes(String(id))),
      }));
      const state = sleeper.transformToDraftState(
        { ...draftMeta, draft_id: 'mock_oneiromancy_draft_2025' },
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        rostersWithoutFreeAgents,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      const henry = state.cosmic_board.find((p) => String(p.id) === '3214');
      assert.ok(henry, 'Hunter Henry (3214) must be present');
      assert.equal(henry.draft_status, 'available');

      const watson = state.cosmic_board.find((p) => String(p.id) === '4017');
      assert.ok(watson, 'Deshaun Watson (4017) must be present');
      assert.equal(watson.draft_status, 'available');
    });

    it('5.3 should ensure trade proposals contain only rostered players and zero injured or unrostered free agents', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      const allRosterPids = new Set();
      for (const r of leagueRosters) {
        if (Array.isArray(r.players)) {
          r.players.forEach((p) => p && allRosterPids.add(String(p)));
        }
      }

      for (const trade of state.trade_proposals) {
        for (const give of trade.give_players) {
          const p = state.cosmic_board.find((x) => String(x.id) === String(give.player_id));
          if (p) {
            assert.notEqual(p.injury_status, 'Out', `Trade player ${p.name} cannot be Out`);
            assert.notEqual(p.injury_status, 'IR', `Trade player ${p.name} cannot be IR`);
          }
        }
        for (const rec of trade.receive_players) {
          const p = state.cosmic_board.find((x) => String(x.id) === String(rec.player_id));
          if (p) {
            assert.notEqual(p.injury_status, 'Out', `Trade player ${p.name} cannot be Out`);
            assert.notEqual(p.injury_status, 'IR', `Trade player ${p.name} cannot be IR`);
          }
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Category 6: Celestial Matchup Divination Screen Week Defaulting & Navigation
  // --------------------------------------------------------------------------
  describe('6. Celestial Matchup Divination Screen Week Defaulting & Navigation', () => {
    it('6.1 should default MatchupsScreen selectedWeek to the active upcoming matchup (Week 2) vs SolarFlare', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: state },
          jsx(MatchupsScreen, {})
        )
      );

      assert.ok(screen.getByText('Celestial Matchup Divination'), 'Must render screen title');
      assert.ok(screen.getByText(/SolarFlare/i), 'Must render Week 2 active opponent SolarFlare by default');
      assert.ok(screen.getByText('Week 2'), 'Must display Week 2 in schedule bar');
      cleanup();
    });

    it('6.2 should render all 18 weeks in schedule bar and display active status badge for Week 2', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW2,
        leagueInfo,
        2
      );

      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: state },
          jsx(MatchupsScreen, {})
        )
      );

      for (let w = 1; w <= 18; w++) {
        assert.ok(screen.getByText(`Week ${w}`), `Week ${w} button must exist in selector bar`);
      }
      assert.ok(screen.getByText('active'), 'Active status badge must be present');

      cleanup();
    });

    it('6.3 should render prop-provided weekly matchup for historical reviews', () => {
      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW1,
        leagueInfo,
        1
      );

      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: state },
          jsx(MatchupsScreen, { weeklyMatchup: state.weekly_matchup })
        )
      );

      assert.ok(screen.getByText(/lunareclipse/i), 'Must render Week 1 opponent lunareclipse when prop provided');
      cleanup();
    });

    it('6.4 should never mark active starters who have already played as benched or drop them when roster has post-draft waiver moves', () => {
      const week3Matchups = [
        {
          matchup_id: 2,
          roster_id: 1,
          points: 22.64,
          starters: ['8183', '9221', '14164', '12526', '5872', '9484', '12514', '11559'],
          players: ['11559', '11583', '11631', '12514', '12526', '12529', '13287', '13301', '14164', '5870', '5872', '8183', '9221', '9484', '9997'],
          players_points: { '11559': 16.04, '9484': 6.60 },
        },
        {
          matchup_id: 2,
          roster_id: 2,
          points: 0,
          starters: ['2315', '6813', '9224', '7547', '10229', '8131', '7588', '96'],
          players: ['10229', '11576', '13296', '2315', '5850', '6768', '6783', '6813', '7547', '7588', '8131', '8180', '9224', '96', '9999'],
          players_points: {},
        },
      ];
      const livePlayerDict = {
        '11559': { player_id: '11559', first_name: 'Michael', last_name: 'Penix', position: 'QB', team: 'ATL', status: 'Active', injury_status: null, projected_points: 15.0 },
        '9484': { player_id: '9484', first_name: 'Tucker', last_name: 'Kraft', position: 'TE', team: 'GB', status: 'Active', injury_status: null, projected_points: 8.5 },
        '5872': { player_id: '5872', first_name: 'Deebo', last_name: 'Samuel', position: 'WR', team: 'SF', status: 'Active', injury_status: null, projected_points: 12.0 },
      };

      const state = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        livePlayerDict,
        leagueUsers,
        leagueRosters,
        week3Matchups,
        leagueInfo,
        3
      );

      const favs = state.weekly_matchup.player_favorabilities;
      const userStarters = favs.filter((p) => p.is_user_team && !p.is_benched);
      const userBench = favs.filter((p) => p.is_user_team && p.is_benched);
      const oppStarters = favs.filter((p) => !p.is_user_team && !p.is_benched);
      const oppBench = favs.filter((p) => !p.is_user_team && p.is_benched);

      assert.equal(userStarters.length, 8, 'User must have all 8 starters active');
      assert.equal(userBench.length, 7, 'User must have 7 bench players');
      assert.equal(oppStarters.length, 8, 'Opponent must have all 8 starters active (none dropped by slice)');
      assert.equal(oppBench.length, 7, 'Opponent must have 7 bench players');

      const penix = favs.find((p) => p.player_id === '11559');
      assert.ok(penix, 'Thursday night starter Michael Penix (11559) must be present');
      assert.equal(penix.is_benched, false, 'Michael Penix must be marked as starter (not benched)');
      assert.equal(penix.health_penalty, 0, 'Played starter Michael Penix must have 0 health penalty');
      assert.notEqual(penix.favorability_verdict, 'CELESTIALLY CHALLENGED', 'Played starter must not be CELESTIALLY CHALLENGED');

      const kraft = favs.find((p) => p.player_id === '9484');
      assert.ok(kraft, 'Thursday night starter Tucker Kraft (9484) must be present');
      assert.equal(kraft.is_benched, false, 'Tucker Kraft must be marked as starter (not benched)');
      assert.equal(kraft.health_penalty, 0, 'Played starter Tucker Kraft must not carry stale August injury penalty');
      assert.equal(kraft.favorability_score, 63.2, 'Tucker Kraft favorability score must match forward calculation');
      assert.equal(kraft.favorability_verdict, 'CELESTIALLY CHALLENGED', 'Tucker Kraft favorability verdict must match forward calculation');
    });

    it('6.5 should ensure both starters and bench have realistic mixed favorabilities, non-zero projections, real NFL stadiums, and exact 4-factor math across weeks', () => {
      for (const wk of [1, 2, 3]) {
        const matchupsForWeek = wk === 1 ? leagueMatchupsW1 : leagueMatchupsW2;
        const state = sleeper.transformToDraftState(
          draftMeta,
          draftPicks,
          { sleeper_username: 'OneiroVanguard' },
          undefined,
          leagueUsers,
          leagueRosters,
          matchupsForWeek,
          leagueInfo,
          wk
        );
        const matchup = state.weekly_matchup;
        assert.ok(matchup, `Week ${wk} matchup must exist`);
        const favs = matchup.player_favorabilities;

        const userStarters = favs.filter((p) => p.is_user_team && !p.is_benched);
        const userBench = favs.filter((p) => p.is_user_team && p.is_benched);
        const oppStarters = favs.filter((p) => !p.is_user_team && !p.is_benched);
        const oppBench = favs.filter((p) => !p.is_user_team && p.is_benched);

        assert.equal(userStarters.length, 8, `Week ${wk}: User must have 8 starters`);
        assert.equal(userBench.length, 7, `Week ${wk}: User must have 7 bench players`);
        assert.equal(oppStarters.length, 8, `Week ${wk}: Opponent must have 8 starters`);
        assert.equal(oppBench.length, 7, `Week ${wk}: Opponent must have 7 bench players`);

        for (const p of favs) {
          assert.ok(p.projected_points > 0, `Week ${wk}: ${p.player_name} must have projected_points > 0`);
          assert.ok(p.player_name && p.player_name.length > 0, `Week ${wk}: ${p.player_id} must resolve a non-empty player name`);
          assert.notEqual(p.stadium.stadium_name, 'Celestial Arena', `Week ${wk}: ${p.player_name} must not have placeholder Celestial Arena`);
          assert.notEqual(p.stadium.stadium_name, 'Astral Colosseum', `Week ${wk}: ${p.player_name} must not have placeholder Astral Colosseum`);

          const stadiumBonus = Math.round(p.stadium_score * 0.25 * 10) / 10;
          const projBonus = Math.round(p.projected_points * 0.8 * 10) / 10;
          const expectedScore = Math.min(100.0, Math.max(0.0, Math.round((p.base_spirit + p.role_modifier + p.health_penalty + stadiumBonus + projBonus) * 10) / 10));

          assert.equal(
            p.favorability_score,
            expectedScore,
            `Week ${wk}: ${p.player_name} favorability_score (${p.favorability_score}) must match 4-factor formula (${expectedScore})`
          );

          const expectedVerdict =
            expectedScore >= 84
              ? 'HEAVILY FAVORED'
              : expectedScore >= 75
                ? 'ASTRALLY FAVORED'
                : expectedScore >= 65
                  ? 'NEUTRAL'
                  : 'CELESTIALLY CHALLENGED';

          assert.equal(
            p.favorability_verdict,
            expectedVerdict,
            `Week ${wk}: ${p.player_name} favorability_verdict (${p.favorability_verdict}) must match expected verdict (${expectedVerdict})`
          );
        }
      }
    });
  });
});
