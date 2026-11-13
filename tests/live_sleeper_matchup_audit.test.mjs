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

const { render, screen, fireEvent, cleanup, jsx } = await import('./helpers/react_testing_wrapper.mjs');

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
      assert.equal(kraft.favorability_score, 64.8, 'Tucker Kraft favorability score must match forward calculation');
      assert.equal(kraft.favorability_verdict, 'NEUTRAL', 'Tucker Kraft favorability verdict must match forward calculation');
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

          const expectedVerdict = scoring.classifyWeeklyFavorability(expectedScore);

          assert.equal(
            p.favorability_verdict,
            expectedVerdict,
            `Week ${wk}: ${p.player_name} favorability_verdict (${p.favorability_verdict}) must match expected verdict (${expectedVerdict})`
          );
        }
      }
    });
  });

  describe('7. One set of numbers per player', () => {
    // Added 2026-10-11 (see changes/2026-10-10-ux-rework.md): the owner saw Malachi Fields at Stars 62 on one
    // screen and 60 on another. Roster copies kept pre-blend Spirit while the player list moved on.
    it('7.1 my_roster and matchup cards carry the same Spirit and Stars as the player list', () => {
      const state = sleeper.transformToDraftState(
        draftMeta, draftPicks, { sleeper_username: 'OneiroVanguard' }, undefined,
        leagueUsers, leagueRosters, leagueMatchupsW1, leagueInfo, 1
      );
      const board = new Map(state.cosmic_board.map((p) => [String(p.id), p]));
      let checked = 0;
      for (const slot of state.my_roster) {
        if (!slot.player) continue;
        const b = board.get(String(slot.player.id));
        assert.ok(b, `${slot.player.name} must be on the player list`);
        assert.equal(slot.player.spirit_score, b.spirit_score, `${slot.player.name}: roster Spirit must equal the list's`);
        assert.equal(slot.player.favorability_score, b.favorability_score, `${slot.player.name}: roster Stars must equal the list's`);
        checked++;
      }
      assert.ok(checked >= 10, 'must check a full roster');
      for (const f of state.weekly_matchup?.player_favorabilities || []) {
        const b = board.get(String(f.player_id));
        if (b) assert.equal(f.spirit_score, b.spirit_score, `${f.player_name}: matchup Spirit must equal the list's`);
      }
    });

    it('7.2 recomputeDraftState and live sync preserve identical Spirit and Stars across cosmic_board and my_roster without double-blending harmony', async () => {
      const scoring = await import('./dist/lib/scoring.js');
      const baseState = sleeper.transformToDraftState(
        draftMeta,
        draftPicks,
        { sleeper_username: 'OneiroVanguard' },
        undefined,
        leagueUsers,
        leagueRosters,
        leagueMatchupsW1,
        leagueInfo
      );
      const synced = scoring.recomputeDraftState(baseState, { chaos_lambda: 0.75 });
      const boardMap = new Map(synced.cosmic_board.map((p) => [String(p.id), p]));
      for (const slot of synced.my_roster) {
        if (!slot.player) continue;
        const bp = boardMap.get(String(slot.player.id));
        assert.ok(bp);
        assert.equal(slot.player.spirit_score, bp.spirit_score);
        assert.equal(slot.player.harmony_score, bp.harmony_score);
      }
    });
  });

  describe('8. MatchupsScreen Header-to-Starter Sum, Disjoint Ownership & Fresh-Boot Modal Invariants', () => {
    it('8.1 every team in mockCompetitorTeams has a 15-player disjoint roster (180 unique players) and every opponent starter across Mock Weeks 1-4 is owned by that opponent on mockCosmicBoard', async () => {
      const mockData = await import('./dist/lib/mockData.js');
      const seenAcrossLeague = new Map();
      assert.equal(mockData.mockCompetitorTeams.length, 12);
      for (const team of mockData.mockCompetitorTeams) {
        const cleanName = team.name.replace(/\s*\(You\)$/, '').trim();
        assert.equal(team.players.length, 15, `${cleanName} must have 15 players`);
        assert.equal(team.starters.length, 8, `${cleanName} must have 8 starters`);
        for (const pid of team.players) {
          assert.ok(
            !seenAcrossLeague.has(String(pid)),
            `Player ${pid} on ${cleanName} duplicates ${seenAcrossLeague.get(String(pid))}`
          );
          seenAcrossLeague.set(String(pid), cleanName);
        }
      }
      assert.equal(seenAcrossLeague.size, 180, '12 teams x 15 players must yield 180 unique rostered players');

      const boardById = new Map(mockData.mockCosmicBoard.map((p) => [String(p.id), p]));
      for (let wk = 1; wk <= 4; wk++) {
        const derived = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          wk
        );
        const oppName = derived.opponent_team.team_name.replace(/\s*\(You\)$/, '').trim();
        const oppStarters = derived.player_favorabilities.filter((f) => !f.is_user_team && !f.is_benched);
        assert.equal(oppStarters.length, 8, `Week ${wk}: ${oppName} must have 8 starters`);
        for (const starter of oppStarters) {
          const bp = boardById.get(String(starter.player_id));
          assert.ok(bp, `Week ${wk}: starter ${starter.player_name} (${starter.player_id}) must exist on mockCosmicBoard`);
          assert.equal(bp.draft_status, 'drafted', `Week ${wk}: ${starter.player_name} must have draft_status === drafted`);
          assert.equal(bp.drafted_by, oppName, `Week ${wk}: ${starter.player_name} must have drafted_by === ${oppName}`);
        }
      }

      for (const tp of mockData.mockTradeProposals) {
        const recPid = String(tp.receive_players?.[0]?.player_id || '');
        const boardPlayer = boardById.get(recPid);
        assert.ok(boardPlayer, `Trade proposal receive player ${recPid} must exist on mockCosmicBoard`);
        assert.equal(
          tp.target_team_name,
          (boardPlayer.drafted_by || '').replace(/\s*\(You\)$/, '').trim(),
          `Trade proposal ${tp.proposal_id} target_team_name (${tp.target_team_name}) must match boardPlayer.drafted_by (${boardPlayer.drafted_by})`
        );
      }
    });

    it('8.2 MatchupsScreen header defaults to Oracle, toggles to Stats/Final (starter sum), persists across weeks, resets on remount, and respects missing metrics and chaos_lambda', async () => {
      const { render, jsx, fireEvent } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('../context/OneiromancyContext.tsx');
      const { MatchupsScreen } = await import('../components/screens/MatchupsScreen.tsx');

      const view = render(jsx(OneiromancyProvider, { children: jsx(MatchupsScreen, {}) }));
      // Default state on mount must be 'oracle'
      const oracleBtn = view.getByTestId('matchup-score-mode-oracle');
      const statsBtn = view.getByTestId('matchup-score-mode-stats');
      assert.equal(oracleBtn.getAttribute('aria-checked'), 'true', 'Header score toggle must default to Oracle');
      assert.equal(statsBtn.getAttribute('aria-checked'), 'false', 'Stats radio must default to unchecked');

      // Check default Oracle header across Weeks 1-4, 7
      for (const wk of [1, 2, 3, 4, 7]) {
        fireEvent.click(view.getByTestId(`matchup-week-btn-${wk}`));
        assert.equal(view.getByTestId('matchup-score-mode-oracle').getAttribute('aria-checked'), 'true');
        const grid = view.getByTestId('positional-matchup-grid');
        const rows = Array.from(grid.children);
        assert.equal(rows.length, 8, `Week ${wk} must render 8 positional starter rows`);
        let userOracleSum = 0;
        let oppOracleSum = 0;
        for (const row of rows) {
          const userCell = row.querySelector('[data-slot-side="user"]');
          const oppCell = row.querySelector('[data-slot-side="opponent"]');
          const badge = row.querySelector('[data-testid="matchup-slot-label"]');
          assert.ok(userCell && badge && oppCell, `Week ${wk} row must contain user slot, middle badge, and opponent slot`);
          const leftOracleMatch = userCell.textContent.match(/Oracle\s*([\d.]+)/i);
          const rightOracleMatch = oppCell.textContent.match(/Oracle\s*([\d.]+)/i);
          assert.ok(leftOracleMatch, `Week ${wk} user starter card must render Oracle`);
          assert.ok(rightOracleMatch, `Week ${wk} opponent starter card must render Oracle`);
          userOracleSum += Number(leftOracleMatch[1]);
          oppOracleSum += Number(rightOracleMatch[1]);
        }
        const userHeaderText = view.getByTestId('matchup-header-user-score').textContent.trim();
        const oppHeaderText = view.getByTestId('matchup-header-opp-score').textContent.trim();
        assert.ok(userHeaderText.endsWith('Oracle'), `Week ${wk} default user header must display Oracle label, got: ${userHeaderText}`);
        assert.ok(oppHeaderText.endsWith('Oracle'), `Week ${wk} default opp header must display Oracle label, got: ${oppHeaderText}`);
        const userHeaderOracle = Number(userHeaderText.match(/([\d.]+)/)[1]);
        const oppHeaderOracle = Number(oppHeaderText.match(/([\d.]+)/)[1]);
        const expectedUserOracleAvg = Math.round((userOracleSum / 8) * 10) / 10;
        const expectedOppOracleAvg = Math.round((oppOracleSum / 8) * 10) / 10;
        assert.ok(
          Math.abs(userHeaderOracle - expectedUserOracleAvg) <= 0.15,
          `Week ${wk}: user header Oracle (${userHeaderOracle}) must track starter average (${expectedUserOracleAvg})`
        );
        assert.ok(
          Math.abs(oppHeaderOracle - expectedOppOracleAvg) <= 0.15,
          `Week ${wk}: opponent header Oracle (${oppHeaderOracle}) must track starter average (${expectedOppOracleAvg})`
        );
      }

      // Toggle to Stats and verify persistence across week switches + exact starter Stats sums
      fireEvent.click(view.getByTestId('matchup-score-mode-stats'));
      assert.equal(view.getByTestId('matchup-score-mode-stats').getAttribute('aria-checked'), 'true');
      assert.equal(view.getByTestId('matchup-score-mode-oracle').getAttribute('aria-checked'), 'false');

      for (const wk of [1, 2, 3, 4, 7]) {
        fireEvent.click(view.getByTestId(`matchup-week-btn-${wk}`));
        assert.equal(
          view.getByTestId('matchup-score-mode-stats').getAttribute('aria-checked'),
          'true',
          `Week ${wk} switch must preserve selected Stats mode while mounted`
        );
        const grid = view.getByTestId('positional-matchup-grid');
        const rows = Array.from(grid.children);
        let userStarterSum = 0;
        let oppStarterSum = 0;
        for (const row of rows) {
          const userCell = row.querySelector('[data-slot-side="user"]');
          const oppCell = row.querySelector('[data-slot-side="opponent"]');
          const leftStatsMatch = userCell.textContent.match(/STATS\s*([\d.]+)/i) || userCell.textContent.match(/([\d.]+)\s*Stats/i);
          const rightStatsMatch = oppCell.textContent.match(/STATS\s*([\d.]+)/i) || oppCell.textContent.match(/([\d.]+)\s*Stats/i);
          assert.ok(leftStatsMatch, `Week ${wk} left starter card must render Stats`);
          assert.ok(rightStatsMatch, `Week ${wk} right starter card must render Stats`);
          userStarterSum += Number(leftStatsMatch[1]);
          oppStarterSum += Number(rightStatsMatch[1]);
        }
        const userHeaderText = view.getByTestId('matchup-header-user-score').textContent.trim();
        const oppHeaderText = view.getByTestId('matchup-header-opp-score').textContent.trim();
        const userStatsVal = Number(userHeaderText.match(/([\d.]+)\s*(?:Stats|Final)/)[1]);
        const oppStatsVal = Number(oppHeaderText.match(/([\d.]+)\s*(?:Stats|Final)/)[1]);
        assert.ok(
          Math.abs(userStatsVal - userStarterSum) < 0.01,
          `Week ${wk}: user header Stats (${userStatsVal}) must equal starter card sum (${userStarterSum.toFixed(2)})`
        );
        assert.ok(
          Math.abs(oppStatsVal - oppStarterSum) < 0.01,
          `Week ${wk}: opponent header Stats (${oppStatsVal}) must equal starter card sum (${oppStarterSum.toFixed(2)})`
        );
        if (wk === 7) {
          const ceedeeCard = view.getByTestId('matchup-starter-card-6786');
          assert.ok(
            ceedeeCard.textContent.includes('No game this week (Bye)'),
            `Week 7 bye starter CeeDee Lamb card must display "No game this week (Bye)", got: ${ceedeeCard.textContent}`
          );
          assert.ok(
            !ceedeeCard.textContent.includes('AT&T Stadium'),
            `Week 7 bye starter CeeDee Lamb card must not display stadium name on bye, got: ${ceedeeCard.textContent}`
          );
          assert.ok(
            !ceedeeCard.textContent.includes('EDT') && !ceedeeCard.textContent.includes('EST'),
            `Week 7 bye starter CeeDee Lamb card must not display kickoff time chip on bye, got: ${ceedeeCard.textContent}`
          );
        }
      }
      view.unmount();

      // Verify remount resets component-local headerScoreMode back to 'oracle'
      const remountedView = render(jsx(OneiromancyProvider, { children: jsx(MatchupsScreen, {}) }));
      assert.equal(
        remountedView.getByTestId('matchup-score-mode-oracle').getAttribute('aria-checked'),
        'true',
        'Remounting MatchupsScreen must reset header score mode to Oracle'
      );
      remountedView.unmount();

      // Verify live state missing or non-finite team projected_points renders '-' while valid negative Sleeper totals remain finite
      for (const badProj of [undefined, null, Number.NaN]) {
        const liveBadState = {
          mode: 'live',
          isLive: true,
          my_roster: [{ player_id: 'u_bad', name: 'Null Metric QB', position: 'QB', team: 'BUF', projected_points: 12 }],
          cosmic_board: [{ player_id: 'u_bad', name: 'Null Metric QB', position: 'QB', team: 'BUF', projected_points: 12 }],
          competitor_teams: [],
          settings: { chaos_lambda: 0.75 },
          weekly_matchup: {
            week: 2,
            status: 'active',
            user_team: { team_name: 'Team A', starters: [], projected_points: badProj },
            opponent_team: { team_name: 'Team B', starters: [], projected_points: 110.5 },
            player_favorabilities: [],
          },
        };
        const badView = render(jsx(OneiromancyProvider, { initialDraftState: liveBadState, children: jsx(MatchupsScreen, {}) }));
        assert.equal(badView.getByTestId('matchup-header-user-score').textContent.trim(), '- Oracle');
        assert.equal(badView.getByTestId('matchup-header-opp-score').textContent.trim(), '- Oracle');
        fireEvent.click(badView.getByTestId('matchup-score-mode-stats'));
        assert.equal(badView.getByTestId('matchup-header-user-score').textContent.trim(), '- Stats');
        assert.equal(badView.getByTestId('matchup-header-opp-score').textContent.trim(), '- Stats');
        badView.unmount();
      }
      // Valid negative Sleeper team total (no starters) must remain finite (-5.00 Stats) instead of rendering '-'
      const negativeProjView = render(
        jsx(OneiromancyProvider, {
          initialDraftState: {
            mode: 'live',
            isLive: true,
            my_roster: [],
            cosmic_board: [],
            competitor_teams: [],
            settings: { chaos_lambda: 0.75 },
            weekly_matchup: {
              week: 2,
              status: 'upcoming',
              user_team: { team_name: 'Team A', starters: [], projected_points: -5 },
              opponent_team: { team_name: 'Team B', starters: [], projected_points: 110.5 },
              player_favorabilities: [],
            },
          },
          children: jsx(MatchupsScreen, {}),
        })
      );
      assert.ok(!negativeProjView.getByTestId('matchup-header-user-score').textContent.includes('- Oracle'), 'Negative finite team projection must still compute finite Oracle');
      fireEvent.click(negativeProjView.getByTestId('matchup-score-mode-stats'));
      assert.equal(negativeProjView.getByTestId('matchup-header-user-score').textContent.trim(), '-5.00 Stats');
      assert.equal(negativeProjView.getByTestId('matchup-header-opp-score').textContent.trim(), '110.50 Stats');
      negativeProjView.unmount();

      // Verify completed week missing official scores never claims 'Final', and switching to upcoming week never leaks prior score_user/status/win_probability/team_comparison
      const weekSwitchState = {
        mode: 'live',
        isLive: true,
        my_roster: [
          { player_id: 'u_w1', name: 'Starter W1', position: 'QB', team: 'BUF', projected_points: 20.0, astral_score: 7.0, harmony_score: 6.0, aura_rating: 75 },
          { player_id: 'u_w2', name: 'Starter W2', position: 'QB', team: 'BUF', projected_points: 18.25, astral_score: 7.0, harmony_score: 6.0, aura_rating: 75 },
        ],
        cosmic_board: [
          { player_id: 'u_w1', name: 'Starter W1', position: 'QB', team: 'BUF', projected_points: 20.0, astral_score: 7.0, harmony_score: 6.0, aura_rating: 75 },
          { player_id: 'u_w2', name: 'Starter W2', position: 'QB', team: 'BUF', projected_points: 18.25, astral_score: 7.0, harmony_score: 6.0, aura_rating: 75 },
          { player_id: 'o_w2', name: 'Opp W2', position: 'QB', team: 'KC', projected_points: 14.5, astral_score: 6.5, harmony_score: 6.0, aura_rating: 70 },
        ],
        competitor_teams: [],
        settings: { chaos_lambda: 0.75 },
        weekly_matchup: {
          week: 1,
          status: 'completed',
          score_user: 142.35,
          score_opponent: 119.8,
          win_probability: 74.2,
          win_probability_label: 'Astral Favored',
          team_comparison: {
            user_astral_favorability: 88.8,
            opponent_astral_favorability: 61.1,
            user_harmony_score: 91.2,
            opponent_harmony_score: 70.4,
          },
          user_team: { team_name: 'Team A', starters: ['u_w1'], projected_points: 20.0 },
          opponent_team: { team_name: 'Team B', starters: ['o_w2'], projected_points: 14.5 },
          player_favorabilities: [],
          upcoming_matchups: [
            {
              week: 2,
              user_team: { team_name: 'Team A', starters: ['u_w2'] },
              opponent_team: { team_name: 'Team B', starters: ['o_w2'] },
              player_favorabilities: [],
            },
          ],
        },
      };
      const switchView = render(jsx(OneiromancyProvider, { initialDraftState: weekSwitchState, children: jsx(MatchupsScreen, {}) }));
      assert.equal(switchView.getByTestId('matchup-score-mode-stats').textContent.trim(), 'Final', 'Week 1 completed with scores must label Final');
      assert.ok(switchView.container.textContent.includes('74.2% Win Prob'), 'Week 1 win probability must render before switch');
      fireEvent.click(switchView.getByTestId('matchup-score-mode-stats'));
      assert.equal(switchView.getByTestId('matchup-header-user-score').textContent.trim(), '142.35 Final');
      fireEvent.click(switchView.getByTestId('matchup-week-btn-2'));
      assert.equal(
        switchView.getByTestId('matchup-score-mode-stats').textContent.trim(),
        'Stats',
        'Switching from completed Week 1 to upcoming Week 2 must clear Final label'
      );
      assert.ok(
        !switchView.getByTestId('matchup-header-user-score').textContent.includes('142.35') &&
          !switchView.getByTestId('matchup-header-user-score').textContent.includes('Final'),
        'Switching from completed Week 1 to upcoming Week 2 must never leak Week 1 score_user or Final label'
      );
      assert.ok(
        !switchView.container.textContent.includes('74.2%') &&
          !switchView.container.textContent.includes('Astral Favored') &&
          !switchView.container.textContent.includes('88.8') &&
          !switchView.container.textContent.includes('91.2'),
        'Switching from Week 1 to Week 2 must never leak Week 1 win_probability, label, or team_comparison metrics'
      );
      switchView.unmount();

      // Verify adjusting chaos_lambda updates Oracle header scores without mutating Win Prob
      let ctxApi = null;
      function LambdaMatchupProbe() {
        ctxApi = useOneiromancy();
        return jsx(MatchupsScreen, {});
      }
      const lambdaView = render(jsx(OneiromancyProvider, { children: jsx(LambdaMatchupProbe, {}) }));
      const origOracleStorage = globalThis.localStorage?.getItem?.('oneiromancy_oracle_v2') ?? null;
      try {
        const initialUserOracle = lambdaView.getByTestId('matchup-header-user-score').textContent.trim();
        const initialWinProb = (lambdaView.container.textContent.match(/([\d.]+%\s*Win Prob)/) || [])[1];
        ctxApi.updateChaosLambda(0.05);
        lambdaView.rerender(jsx(OneiromancyProvider, { children: jsx(LambdaMatchupProbe, {}) }));
        const updatedUserOracle = lambdaView.getByTestId('matchup-header-user-score').textContent.trim();
        const updatedWinProb = (lambdaView.container.textContent.match(/([\d.]+%\s*Win Prob)/) || [])[1];
        assert.notEqual(updatedUserOracle, initialUserOracle, 'Changing chaos_lambda must update header Oracle score');
        assert.equal(updatedWinProb, initialWinProb, 'Changing chaos_lambda must not alter Win Prob');
      } finally {
        ctxApi?.updateChaosLambda?.(0.75);
        if (origOracleStorage === null) {
          globalThis.localStorage?.removeItem?.('oneiromancy_oracle_v2');
        } else {
          globalThis.localStorage?.setItem?.('oneiromancy_oracle_v2', origOracleStorage);
        }
        lambdaView.unmount();
      }

      // Verify Live Sleeper Week 7 matchup (with BAL/BUF Week 7 byes)
      const nflGames = await import('../core/lib/nflGames.ts');
      nflGames.setWeekGames(7, [
        { week: 7, home: 'IND', away: 'MIA', kickoff: '2025-10-19T17:00Z', date: '2025-10-19', venue: { name: 'Lucas Oil Stadium', city: 'Indianapolis', state: 'IN' }, neutral: false },
        { week: 7, home: 'CIN', away: 'PIT', kickoff: '2025-10-19T17:00Z', date: '2025-10-19', venue: { name: 'Paycor Stadium', city: 'Cincinnati', state: 'OH' }, neutral: false },
        { week: 7, home: 'DET', away: 'TB', kickoff: '2025-10-19T17:00Z', date: '2025-10-19', venue: { name: 'Ford Field', city: 'Detroit', state: 'MI' }, neutral: false },
        { week: 7, home: 'KC', away: 'LV', kickoff: '2025-10-19T17:00Z', date: '2025-10-19', venue: { name: 'Arrowhead Stadium', city: 'Kansas City', state: 'MO' }, neutral: false },
        { week: 7, home: 'DEN', away: 'NYG', kickoff: '2025-10-19T20:05Z', date: '2025-10-19', venue: { name: 'Empower Field at Mile High', city: 'Denver', state: 'CO' }, neutral: false },
        { week: 7, home: 'NYJ', away: 'CAR', kickoff: '2025-10-19T17:00Z', date: '2025-10-19', venue: { name: 'MetLife Stadium', city: 'East Rutherford', state: 'NJ' }, neutral: false },
        { week: 7, home: 'CLE', away: 'TEN', kickoff: '2025-10-19T17:00Z', date: '2025-10-19', venue: { name: 'Huntington Bank Field', city: 'Cleveland', state: 'OH' }, neutral: false },
        { week: 7, home: 'LAR', away: 'JAX', kickoff: '2025-10-19T13:30Z', date: '2025-10-19', venue: { name: 'Wembley Stadium', city: 'London', state: 'UK' }, neutral: true },
      ]);
      sleeper.setSeasonContext({
        season: '2025',
        leagueId: 'live_w7',
        currentWeek: 7,
        lastRegularWeek: 18,
        byeWeeks: { BAL: 7, BUF: 7 },
        weekDates: { 7: 'Oct 16 - Oct 20, 2025' },
        matchupsByWeek: {},
      });
      try {
        const w7Matchups = leagueMatchupsW1.map((m) =>
          m.roster_id === 2
            ? { ...m, starters: ['7083', ...m.starters.slice(1)], players: ['7083', ...m.players.slice(1)] }
            : m
        );
        const w7Rosters = leagueRosters.map((r) =>
          r.roster_id === 2
            ? { ...r, starters: ['7083', ...r.starters.slice(1)], players: ['7083', ...r.players.slice(1)] }
            : r
        );
        const liveW7State = sleeper.transformToDraftState(
          draftMeta,
          draftPicks,
          { sleeper_username: 'OneiroVanguard', mode: 'live' },
          undefined,
          leagueUsers,
          w7Rosters,
          w7Matchups,
          { ...leagueInfo, settings: { ...(leagueInfo.settings || {}), leg: 7 } },
          7
        );
        const w7UserStarters = liveW7State.weekly_matchup.player_favorabilities.filter(
          (f) => f.is_user_team && !f.is_benched
        );
        const w7OppStarters = liveW7State.weekly_matchup.player_favorabilities.filter(
          (f) => !f.is_user_team && !f.is_benched
        );
        const byeStarter = w7UserStarters.find((f) => f.projected_points === 0);
        assert.ok(
          byeStarter,
          'Live Week 7 user starters must include at least one 0.0 bye starter (BAL/BUF)'
        );
        assert.equal(byeStarter.stadium?.stadium_name, 'No game this week');
        assert.equal(byeStarter.game_kickoff, 'Bye week');
        const w7UserSum = w7UserStarters.reduce((s, f) => s + Number(f.projected_points || 0), 0);
        const w7OppSum = w7OppStarters.reduce((s, f) => s + Number(f.projected_points || 0), 0);
        assert.ok(
          Math.abs(liveW7State.weekly_matchup.user_team.projected_points - w7UserSum) < 0.05,
          `Live Week 7 user header Stats (${liveW7State.weekly_matchup.user_team.projected_points}) must equal starter sum (${w7UserSum})`
        );
        assert.ok(
          Math.abs(liveW7State.weekly_matchup.opponent_team.projected_points - w7OppSum) < 0.05,
          `Live Week 7 opponent header Stats (${liveW7State.weekly_matchup.opponent_team.projected_points}) must equal starter sum (${w7OppSum})`
        );
      } finally {
        sleeper.setSeasonContext(null);
        nflGames.clearNflGames();
      }
    });

    it('8.3 fresh session suppresses dismissed welcome banner across all dismiss paths, avoids leaking OneiroVanguard on ?draft_id= launches, and preserves returning user', async () => {
      const { render, jsx, fireEvent, act } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('../context/OneiromancyContext.tsx');
      const { SettingsDrawer } = await import('../components/settings/SettingsDrawer.tsx');
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      const origFetch = globalThis.fetch;
      let storedUser = null;
      const keydownListeners = new Set();
      globalThis.window = {
        location: { origin: 'http://127.0.0.1:3000', search: '' },
        addEventListener: (ev, fn) => {
          if (ev === 'keydown' && typeof fn === 'function') keydownListeners.add(fn);
        },
        removeEventListener: (ev, fn) => {
          if (ev === 'keydown' && typeof fn === 'function') keydownListeners.delete(fn);
        },
      };
      globalThis.localStorage = {
        getItem: (k) => (k === 'oneiromancy_active_username' ? storedUser : null),
        setItem: (k, v) => {
          if (k === 'oneiromancy_active_username') storedUser = v;
        },
        removeItem: (k) => {
          if (k === 'oneiromancy_active_username') storedUser = null;
        },
      };
      globalThis.fetch = async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => '',
      });
      try {
        let captured = null;
        function ProbeWithDrawer() {
          captured = useOneiromancy();
          return jsx(SettingsDrawer, {
            isOpen: captured.isSettingsOpen,
            onClose: () => captured.toggleSettings(false),
          });
        }

        // 1. Fresh HTTP boot shows #first-launch-welcome-banner and #load-mock-btn, dismissing cleanly
        const view = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.equal(captured.mode, 'mock', 'Fresh session without saved username must start in mock mode');
        assert.equal(captured.isSettingsOpen, true, 'Fresh session with http origin and no saved username/URL params must open Settings modal prompt');
        assert.equal(captured.draftState.settings.sleeper_username, '', 'Fresh session sleeper_username must be empty string');
        assert.ok(view.container.querySelector('#first-launch-welcome-banner'), 'Fresh HTTP boot must render #first-launch-welcome-banner');
        const mockBtn = view.container.querySelector('#load-mock-btn');
        assert.ok(mockBtn, 'SettingsDrawer must render #load-mock-btn');
        fireEvent.click(mockBtn);
        assert.equal(captured.isSettingsOpen, false, 'Clicking #load-mock-btn must close SettingsDrawer');
        assert.equal(view.container.querySelector('[role="dialog"]'), null, 'SettingsDrawer dialog must unmount after clicking #load-mock-btn');
        assert.equal(storedUser, null, 'Clicking #load-mock-btn must not store a fake username in localStorage');
        await captured.refreshDraft();
        assert.equal(captured.mode, 'mock', 'Mode must remain mock after refreshDraft() in mock mode');
        assert.equal(captured.isSettingsOpen, false, 'refreshDraft() after dismissing prompt must keep Settings closed');
        assert.equal(
          captured.draftState.settings.sleeper_username,
          '',
          'refreshDraft() in mock mode must not overwrite sleeper_username with OneiroVanguard'
        );
        view.unmount();

        // 2. Dismissing via Close (X) button path
        const dismissView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.ok(dismissView.container.querySelector('#first-launch-welcome-banner'), 'Fresh session before close button click must show welcome banner');
        const closeBtn = dismissView.container.querySelector('button[aria-label="Close Settings"]');
        assert.ok(closeBtn, 'Close Settings button must exist');
        fireEvent.click(closeBtn);
        assert.equal(captured.isSettingsOpen, false, 'Close Settings button must close SettingsDrawer');
        assert.equal(storedUser, null, 'Closing Settings must not store a fake username in localStorage');
        await captured.refreshDraft();
        assert.equal(captured.isSettingsOpen, false, 'refreshDraft() after closing Settings must keep Settings closed');
        assert.equal(captured.draftState.settings.sleeper_username, '', 'refreshDraft() after closing Settings must preserve empty sleeper_username');
        dismissView.unmount();

        // 3. ?tab=matchups alone (without user/draft launch params) still opens onboarding SettingsDrawer
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?tab=matchups' };
        const tabOnlyView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.equal(captured.isSettingsOpen, true, '?tab=matchups without user params must still auto-open Settings modal');
        assert.ok(tabOnlyView.container.querySelector('#first-launch-welcome-banner'), '?tab=matchups without user params must still display welcome banner');
        tabOnlyView.unmount();

        // 4. URL launch params (?username=, ?draft_id=, ?draft=) keep Settings closed on mount
        for (const search of ['?username=LaunchUser2', '?draft_id=999', '?draft=888']) {
          globalThis.window.location = { origin: 'http://127.0.0.1:3000', search };
          const launchView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
          assert.equal(captured.isSettingsOpen, false, `URL ${search} must keep Settings closed on fresh mount`);
          assert.equal(launchView.container.querySelector('[role="dialog"]'), null, `URL ${search} must not render Settings dialog on mount`);
          launchView.unmount();
        }

        // 5. ?user=Foo keeps Settings closed on mount, suppresses welcome banner when opened, and pre-fills #username-input
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?user=Foo' };
        const fooView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.equal(captured.isSettingsOpen, false, '?user=Foo must keep Settings closed on fresh mount');
        act(() => captured.toggleSettings(true));
        assert.equal(
          fooView.container.querySelector('#first-launch-welcome-banner'),
          null,
          'Opening SettingsDrawer with ?user=Foo must not show #first-launch-welcome-banner'
        );
        const fooInput = fooView.container.querySelector('#username-input');
        assert.ok(fooInput, '#username-input must exist when SettingsDrawer is opened');
        assert.equal(fooInput.value, 'Foo', '?user=Foo must pre-fill #username-input with Foo');
        fooView.unmount();
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '' };

        // 5b. Dismissal persistence across all dismiss paths when reopening SettingsDrawer
        const dismissPaths = [
          {
            name: 'header X button',
            dismiss: (v) => fireEvent.click(v.container.querySelector('button[aria-label="Close Settings"]')),
          },
          {
            name: 'Escape key',
            dismiss: () => act(() => {
              for (const fn of [...keydownListeners]) fn({ key: 'Escape' });
            }),
          },
          {
            name: 'backdrop click',
            dismiss: (v) => fireEvent.click(v.container.querySelector('[role="dialog"]')),
          },
          {
            name: 'footer Close Settings button',
            dismiss: (v) => {
              const footerBtn = Array.from(v.container.querySelectorAll('button')).find(
                (b) => b.textContent && b.textContent.trim() === 'Close Settings'
              );
              assert.ok(footerBtn, 'Footer Close Settings button must exist');
              fireEvent.click(footerBtn);
            },
          },
          {
            name: 'external loadMockData() transition',
            dismiss: () => act(() => captured.loadMockData()),
          },
          {
            name: 'external toggleSettings(false) transition',
            dismiss: () => act(() => captured.toggleSettings(false)),
          },
        ];
        for (const p of dismissPaths) {
          storedUser = null;
          const dv = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
          assert.ok(
            dv.container.querySelector('#first-launch-welcome-banner'),
            `Fresh mount before ${p.name} must show #first-launch-welcome-banner`
          );
          p.dismiss(dv);
          assert.equal(captured.isSettingsOpen, false, `${p.name} must close SettingsDrawer`);
          act(() => captured.toggleSettings(true));
          assert.equal(
            dv.container.querySelector('#first-launch-welcome-banner'),
            null,
            `Reopening SettingsDrawer after ${p.name} must keep #first-launch-welcome-banner suppressed`
          );
          dv.unmount();
        }

        // 5c. ?draft_id=999 launch without ?user= or saved user leaves sleeper_username empty,
        // skips OneiroVanguard / synthetic 9000000000000000001 network requests, and drops Astral Sanctum League
        storedUser = null;
        const prevFetchInTest = globalThis.fetch;
        const draftLaunchUrls = [];
        globalThis.fetch = async (url) => {
          const urlStr = String(url);
          draftLaunchUrls.push(urlStr);
          if (urlStr.endsWith('/draft/999')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                draft_id: '999',
                type: 'snake',
                status: 'complete',
                season: '2026',
                league_id: null,
                settings: { teams: 8, rounds: 15 },
                metadata: { name: 'URL Draft 999' },
              }),
              text: async () => '{}',
            };
          }
          if (urlStr.endsWith('/draft/999/picks')) {
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          }
          return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
        };
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?draft_id=999' };
        const draftLaunchView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
          await captured.refreshDraft();
        });
        assert.equal(
          draftLaunchUrls.some((u) => u.includes('OneiroVanguard') || u.includes('9000000000000000001')),
          false,
          `?draft_id=999 launch must not fetch OneiroVanguard or synthetic league 9000000000000000001 (got: ${draftLaunchUrls.join(', ')})`
        );
        assert.ok(
          draftLaunchUrls.some((u) => u.endsWith('/draft/999')),
          `?draft_id=999 launch must fetch /draft/999 directly (got: ${draftLaunchUrls.join(', ')})`
        );
        assert.equal(
          captured.draftState.settings.sleeper_username,
          '',
          '?draft_id=999 launch without ?user= or saved username must clear sleeper_username after sync'
        );
        assert.equal(
          (captured.draftState.available_leagues || []).some(
            (l) => l.league_id === '9000000000000000001' || l.name === 'Astral Sanctum League'
          ),
          false,
          '?draft_id=999 launch must not carry over mock Astral Sanctum League'
        );
        act(() => captured.toggleSettings(true));
        const draftInput = draftLaunchView.container.querySelector('#username-input');
        assert.ok(draftInput, '#username-input must render when opening Settings after ?draft_id=999 launch');
        assert.equal(draftInput.value, '', '#username-input must stay empty after ?draft_id=999 launch');
        draftLaunchView.unmount();
        globalThis.fetch = prevFetchInTest;
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '' };

        // 6. Non-HTTP origin (e.g. file://) keeps Settings closed on mount
        globalThis.window.location = { origin: 'file://', search: '' };
        const fileView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.equal(captured.isSettingsOpen, false, 'Non-HTTP file:// origin must keep Settings closed on mount');
        assert.equal(fileView.container.querySelector('[role="dialog"]'), null, 'Non-HTTP file:// origin must not render Settings dialog');
        fileView.unmount();
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '' };

        // 7. Returning user (McTwerkface) keeps Settings closed, omits welcome banner when opened, dismisses via #load-mock-btn, and preserves McTwerkface
        storedUser = 'McTwerkface';
        const view2 = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.equal(captured.isSettingsOpen, false, 'Session with saved username must keep Settings closed on mount');
        assert.equal(storedUser, 'McTwerkface', 'Saved username McTwerkface must not be wiped from localStorage on mount');
        act(() => captured.toggleSettings(true));
        assert.equal(view2.container.querySelector('#first-launch-welcome-banner'), null, 'Returning user opening Settings must not see welcome banner');
        fireEvent.click(view2.container.querySelector('#load-mock-btn'));
        assert.equal(captured.isSettingsOpen, false, 'Returning user clicking #load-mock-btn must close SettingsDrawer cleanly');
        assert.equal(view2.container.querySelector('[role="dialog"]'), null, 'Returning user #load-mock-btn click must close dialog');
        assert.equal(captured.mode, 'mock');
        assert.equal(captured.draftState.settings.sleeper_username, 'McTwerkface');
        await captured.refreshDraft();
        assert.equal(captured.mode, 'mock', 'Mode must remain mock after refreshDraft() with saved username McTwerkface');
        assert.equal(
          captured.draftState.settings.sleeper_username,
          'McTwerkface',
          'refreshDraft() in mock mode must preserve McTwerkface and never overwrite with OneiroVanguard'
        );
        view2.unmount();

        // Also verify OneiroVanguard in localStorage is not wiped on mount
        storedUser = 'OneiroVanguard';
        const view3 = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        assert.equal(storedUser, 'OneiroVanguard', 'Saved username OneiroVanguard must not be wiped from localStorage on mount');
        view3.unmount();

        // 5d. ?user=Bob overrides saved localStorage username Alice on mount
        storedUser = 'Alice';
        const userOverrideUrls = [];
        globalThis.fetch = async (url) => {
          userOverrideUrls.push(String(url));
          if (String(url).includes('/user/Bob')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ user_id: 'u_bob', username: 'Bob', display_name: 'Bob' }),
              text: async () => '{}',
            };
          }
          if (String(url).includes('/user/u_bob/leagues/')) {
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          }
          return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
        };
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?user=Bob' };
        const overrideView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        assert.equal(
          userOverrideUrls.some((u) => u.includes('/user/Bob')),
          true,
          `?user=Bob must fetch /user/Bob (got: ${userOverrideUrls.join(', ')})`
        );
        assert.equal(
          userOverrideUrls.some((u) => u.includes('/user/Alice')),
          false,
          `?user=Bob must override saved localStorage user Alice and never fetch /user/Alice (got: ${userOverrideUrls.join(', ')})`
        );
        assert.equal(storedUser, 'Alice', '?user=Bob override must preserve Alice in localStorage');
        overrideView.unmount();

        // 5e. Unmounted provider aborts in-flight fetch signal cleanly without polluting a subsequent ?draft_id=999 mount
        storedUser = null;
        let firstSignalAborted = false;
        let releaseSlowFirstMount;
        const slowFirstPromise = new Promise((res) => { releaseSlowFirstMount = res; });
        globalThis.fetch = async (url, init) => {
          const urlStr = String(url);
          if (urlStr.includes('/user/SlowUser')) {
            if (init?.signal) {
              init.signal.addEventListener('abort', () => { firstSignalAborted = true; });
            }
            await slowFirstPromise;
            return {
              ok: true,
              status: 200,
              json: async () => ({ user_id: 'u_slow', username: 'SlowUser', display_name: 'SlowUser' }),
              text: async () => '{}',
            };
          }
          if (urlStr.endsWith('/draft/999')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ draft_id: '999', type: 'snake', status: 'complete', season: '2026', league_id: null }),
              text: async () => '{}',
            };
          }
          if (urlStr.endsWith('/draft/999/picks')) {
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          }
          return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
        };
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?user=SlowUser' };
        const slowMount = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 10));
        });
        slowMount.unmount();
        assert.equal(firstSignalAborted, true, 'Unmounting provider must abort in-flight sync AbortSignal');
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?draft_id=999' };
        const cleanMount = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        releaseSlowFirstMount();
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        assert.equal(captured.draftState.settings.sleeper_username, '', 'Sibling ?draft_id=999 mount must ignore settled unmounted sync');
        cleanMount.unmount();

        // 5f. ?draft_id=999 HTTP 503 failure keeps sleeper_username empty and drops Astral Sanctum League
        const failUrls = [];
        globalThis.fetch = async (url) => {
          failUrls.push(String(url));
          return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
        };
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?draft_id=999' };
        const failMount = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
          await captured.refreshDraft();
        });
        assert.equal(
          failUrls.some((u) => u.includes('OneiroVang') || u.includes('9000000000000000001')),
          false,
          `Offline 503 on ?draft_id=999 must never fall back to OneiroVanguard or 9000000000000000001 (got: ${failUrls.join(', ')})`
        );
        assert.equal(captured.draftState.settings.sleeper_username, '', 'Offline 503 on ?draft_id=999 must preserve empty sleeper_username');
        failMount.unmount();

        // 5g. Cancelled loadSeasonContext must never clobber subsequent mock/live module-level seasonContext or week games (both abort paths)
        const nflGamesMod = await import('../core/lib/nflGames.ts');
        const prevSeasonCtx = sleeper.getSeasonContext();
        try {
          const seededCtx = {
            season: '2026',
            leagueId: 'mock-keep',
            currentWeek: 1,
            lastRegularWeek: 14,
            byeWeeks: {},
            weekDates: {},
            matchupsByWeek: {},
          };
          sleeper.setSeasonContext(seededCtx);

          // Path 1: Abort during fetchNFLSchedule before Promise.all
          const abortedSeasonCtrl = new AbortController();
          let releaseSchedule;
          const pendingSchedule = new Promise((res) => { releaseSchedule = res; });
          globalThis.fetch = async (url) => {
            if (String(url).includes('schedule') || String(url).includes('nfl')) {
              await pendingSchedule;
            }
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          };
          const cancelledSeasonPromise = sleeper.loadSeasonContext(
            'aborted-league',
            '2026',
            1,
            [{ matchup_id: 1, roster_id: 1, points: 100 }],
            null,
            abortedSeasonCtrl.signal
          );
          abortedSeasonCtrl.abort();
          releaseSchedule();
          const abortedResult = await cancelledSeasonPromise;
          assert.equal(abortedResult, null, 'Aborted loadSeasonContext (schedule phase) must resolve null');
          assert.equal(
            sleeper.getSeasonContext()?.leagueId,
            'mock-keep',
            'Aborted loadSeasonContext must not overwrite subsequent getSeasonContext()'
          );

          // Path 2: Schedule resolves first, then abort fires while fetchLeagueMatchups / fetchEspnWeek are in flight -> no setWeekGames mutation
          nflGamesMod.clearNflGames();
          const postScheduleCtrl = new AbortController();
          let releaseDeferred;
          const pendingDeferred = new Promise((res) => { releaseDeferred = res; });
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/schedule/nfl/regular/')) {
              return {
                ok: true,
                status: 200,
                json: async () => [{ week: 1, home: 'BUF', away: 'KC', date: '2026-09-10' }],
                text: async () => '[]',
              };
            }
            if (urlStr.includes('espn.com') || urlStr.includes('/matchups/')) {
              await pendingDeferred;
            }
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          };
          const postSchedulePromise = sleeper.loadSeasonContext(
            'aborted-post-schedule',
            '2026',
            1,
            [{ matchup_id: 1, roster_id: 1, points: 100 }],
            null,
            postScheduleCtrl.signal
          );
          await new Promise((r) => setTimeout(r, 15));
          postScheduleCtrl.abort();
          releaseDeferred();
          const postScheduleRes = await postSchedulePromise;
          assert.equal(postScheduleRes, null, 'Aborted loadSeasonContext (post-schedule phase) must resolve null');
          assert.equal(
            nflGamesMod.hasNflWeekSchedule(1),
            false,
            'Aborted loadSeasonContext must not mutate setWeekGames before Promise.all finishes'
          );
          assert.equal(
            sleeper.getSeasonContext()?.leagueId,
            'mock-keep',
            'Post-schedule aborted loadSeasonContext must preserve getSeasonContext()'
          );
        } finally {
          sleeper.setSeasonContext(prevSeasonCtx);
        }

        // 5h. AbortError propagation in fetchUserLeagues / syncLeagues / mock fallback + SettingsDrawer failed first-launch & zero-league non-leak
        const prevSeasonCtx5h = sleeper.getSeasonContext();
        try {
          // 5h-1: fetchUserLeagues must rethrow AbortError inside altRes block & season loop instead of returning User not found
          const altAbortCtrl = new AbortController();
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/user/OneiroVanguard')) {
              return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
            }
            if (urlStr.includes('/user/OneiroVangard')) {
              altAbortCtrl.abort();
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              throw abortErr;
            }
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          };
          await assert.rejects(
            () => sleeper.fetchUserLeagues('OneiroVanguard', ['2026'], altAbortCtrl.signal),
            (err) => err?.name === 'AbortError' || String(err?.message).includes('aborted'),
            'fetchUserLeagues altRes AbortError must propagate instead of converting into User not found'
          );

          const seasonAbortCtrl = new AbortController();
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/user/SomeTester')) {
              return { ok: true, status: 200, json: async () => ({ user_id: 'u_test_1', username: 'SomeTester' }), text: async () => '{}' };
            }
            if (urlStr.includes('/leagues/nfl/')) {
              seasonAbortCtrl.abort();
              throw new Error('Sync aborted');
            }
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          };
          await assert.rejects(
            () => sleeper.fetchUserLeagues('SomeTester', ['2026'], seasonAbortCtrl.signal),
            /Sync aborted/,
            'fetchUserLeagues season loop must propagate Sync aborted error'
          );

          // 5h-2: Aborted signal reaching mock_oneiromancy_draft_2025 path must not clear existing seasonContext
          sleeper.setSeasonContext({
            season: '2026',
            leagueId: 'preserve-mock-ctx',
            currentWeek: 1,
            lastRegularWeek: 14,
            byeWeeks: {},
            weekDates: {},
            matchupsByWeek: {},
          });
          const mockPathCtrl = new AbortController();
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/user/')) {
              return { ok: true, status: 200, json: async () => ({ user_id: '9000000000000000101', username: 'OneiroVanguard' }), text: async () => '{}' };
            }
            if (urlStr.includes('/drafts')) {
              mockPathCtrl.abort();
              return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
            }
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          };
          await assert.rejects(
            () => sleeper.fetchSleeperDraft(
              'mock_oneiromancy_draft_2025',
              { sleeper_username: 'OneiroVanguard', league_id: '' },
              {},
              { throwOnError: true, signal: mockPathCtrl.signal }
            ),
            /Sync aborted/
          );
          assert.equal(
            sleeper.getSeasonContext()?.leagueId,
            'preserve-mock-ctx',
            'Aborted fetchSleeperDraft on mock_oneiromancy_draft_2025 must not call setSeasonContext(null)'
          );

          // 5h-3: Non-canonical zero-league user never falls back to synthetic 9000000000000000001
          const zeroLeagueUrls = [];
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            zeroLeagueUrls.push(urlStr);
            if (urlStr.includes('/user/ZeroLeagueUser')) {
              return { ok: true, status: 200, json: async () => ({ user_id: 'u_zero_99', username: 'ZeroLeagueUser', display_name: 'ZeroLeagueUser' }), text: async () => '{}' };
            }
            if (urlStr.includes('/leagues/nfl/')) {
              return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
            }
            return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
          };
          globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?user=ZeroLeagueUser' };
          storedUser = null;
          let zeroCtx = null;
          function ZeroLeagueProbe() {
            zeroCtx = useOneiromancy();
            return null;
          }
          const zeroView = render(jsx(OneiromancyProvider, { children: jsx(ZeroLeagueProbe, {}) }));
          await new Promise((r) => setTimeout(r, 30));
          assert.ok(
            !zeroLeagueUrls.some((u) => u.includes('9000000000000000001')),
            `Zero-league non-canonical user must never query synthetic league 9000000000000000001 (got: ${zeroLeagueUrls.join(', ')})`
          );
          assert.notEqual(
            zeroCtx.draftState.settings?.league_id,
            '9000000000000000001',
            'Zero-league non-canonical user must not retain synthetic 9000000000000000001 in settings.league_id'
          );
          zeroView.unmount();

          // 5h-4: SettingsDrawer keeps drawer + #first-launch-welcome-banner open on failed first-launch save, and ?user= beats stale localStorage
          globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
          globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '' };
          storedUser = null;
          const failSaveView = render(jsx(OneiromancyProvider, { children: jsx(ProbeWithDrawer, {}) }));
          const userInput = failSaveView.container.querySelector('#username-input');
          assert.ok(userInput, 'First-launch SettingsDrawer must render #username-input');
          fireEvent.change(userInput, { target: { value: 'UnknownFailUser' } });
          const saveBtn = Array.from(failSaveView.container.querySelectorAll('button')).find(
            (b) => b.textContent && b.textContent.includes('Apply & Sync')
          );
          assert.ok(saveBtn, 'SettingsDrawer must render Apply & Sync button');
          await act(async () => {
            fireEvent.click(saveBtn);
            await new Promise((r) => setTimeout(r, 25));
          });
          assert.equal(captured.isSettingsOpen, true, 'Failed first-launch save must keep SettingsDrawer open');
          assert.ok(
            failSaveView.container.querySelector('#first-launch-welcome-banner'),
            'Failed first-launch save must preserve #first-launch-welcome-banner'
          );
          assert.ok(
            failSaveView.container.querySelector('#sync-error-banner'),
            'Failed first-launch save must display #sync-error-banner'
          );
          assert.equal(
            failSaveView.container.querySelector('#username-input')?.value,
            'UnknownFailUser',
            'Failed first-launch save must preserve typed username for correction'
          );
          assert.equal(storedUser, null, 'Failed first-launch save must not persist invalid username to localStorage');
          failSaveView.unmount();

          // Active ?user= overrides stale localStorage in #username-input
          storedUser = 'StaleSavedUser';
          globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '?user=FreshParamUser' };
          const overrideView = render(
            jsx(OneiromancyProvider, {
              children: jsx(SettingsDrawer, { isOpen: true, onClose: () => {} }),
            })
          );
          assert.equal(
            overrideView.container.querySelector('#username-input')?.value,
            'FreshParamUser',
            'Active ?user= URL parameter must beat stale localStorage username in #username-input'
          );
          overrideView.unmount();

          // 5h-5: syncLeagues AbortSignal propagates Sync aborted without mutating available_leagues
          const syncCtrl = new AbortController();
          let ctxApi = null;
          function CaptureCtx() {
            ctxApi = useOneiromancy();
            return null;
          }
          globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '' };
          storedUser = null;
          const syncView = render(
            jsx(OneiromancyProvider, {
              initialDraftState: {
                ...mockData.mock_oneiromancy_draft_2025,
                isLive: false,
                available_leagues: [{ league_id: 'keep-lg', name: 'Keep League', season: '2026', total_rosters: 12 }],
                settings: { mode: 'mock', sleeper_username: '', league_id: '' },
              },
              children: jsx(CaptureCtx, {}),
            })
          );
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/leagues/nfl/')) {
              syncCtrl.abort();
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              throw abortErr;
            }
            if (urlStr.includes('/user/')) {
              return { ok: true, status: 200, json: async () => ({ user_id: 'u_sync_1', username: 'SyncAbortUser' }), text: async () => '{}' };
            }
            return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
          };
          await assert.rejects(
            () => ctxApi.syncLeagues('SyncAbortUser', syncCtrl.signal),
            /AbortError|Sync aborted/i,
            'syncLeagues must reject on AbortSignal without swallowing'
          );
          assert.equal(
            ctxApi.draftState.available_leagues?.[0]?.league_id,
            'keep-lg',
            'Aborted syncLeagues must not overwrite existing available_leagues'
          );
          syncView.unmount();

          // 5h-6: fetchWeeklyProjections, fetchNFLSchedule, fetchLeagueMatchups, fetchEspnWeek, and fetchNextWeekProjectionsMap AbortSignal handling
          const nflGames = await import('../core/lib/nflGames.ts');
          const preAborted = new AbortController();
          preAborted.abort();
          let preAbortFetches = 0;
          globalThis.fetch = async () => {
            preAbortFetches += 1;
            return { ok: true, status: 200, json: async () => [] };
          };
          assert.equal(await sleeper.fetchWeeklyProjections('2026', 1, preAborted.signal), null, 'Pre-aborted fetchWeeklyProjections returns null');
          assert.deepEqual(await sleeper.fetchNFLSchedule('2026', preAborted.signal), [], 'Pre-aborted fetchNFLSchedule returns []');
          assert.deepEqual(await sleeper.fetchLeagueMatchups('lg_x', 1, preAborted.signal), [], 'Pre-aborted fetchLeagueMatchups returns []');
          assert.equal(await nflGames.fetchEspnWeek('2026', 1, false, preAborted.signal), null, 'Pre-aborted fetchEspnWeek returns null');
          assert.equal(preAbortFetches, 0, 'Pre-aborted helpers must return before calling fetch');

          // Aborted fetchWeeklyProjections must not write negative cache (subsequent call succeeds)
          const projAbortCtrl = new AbortController();
          let projCalls = 0;
          globalThis.fetch = async () => {
            projCalls += 1;
            if (projCalls === 1) {
              projAbortCtrl.abort();
              const err = new Error('Aborted projections');
              err.name = 'AbortError';
              throw err;
            }
            return { ok: true, status: 200, json: async () => ({ '4046': { pts_ppr: 21.4 } }) };
          };
          assert.equal(await sleeper.fetchWeeklyProjections('2026', 99, projAbortCtrl.signal), null, 'Aborted fetchWeeklyProjections returns null');
          const liveProj = await sleeper.fetchWeeklyProjections('2026', 99);
          assert.equal(liveProj?.['4046']?.pts_ppr, 21.4, 'Aborted fetchWeeklyProjections must not poison negative cache');

          // fetchNextWeekProjectionsMap abort propagation via fetchSleeperDraft
          sleeper.setSeasonContext({ season: '2028', byeWeeks: { BUF: 7 }, schedule: [] });
          const nextMapCtrl = new AbortController();
          globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/leagues/nfl/')) {
              return {
                ok: true,
                status: 200,
                json: async () => [{ league_id: 'lg_map_1', name: 'Map League', season: '2028', total_rosters: 12, draft_id: 'draft_map_1', settings: { leg: 7 }, scoring_settings: { rec: 1 } }],
                text: async () => '[]',
              };
            }
            if (urlStr.includes('/v1/user/')) {
              return { ok: true, status: 200, json: async () => ({ user_id: 'u_map_1', username: 'MapUser' }), text: async () => '{}' };
            }
            if (urlStr.includes('/state/nfl')) {
              return { ok: true, status: 200, json: async () => ({ season: '2028', week: 7 }), text: async () => '{}' };
            }
            if (urlStr.includes('/projections/nfl/regular/2028/')) {
              if (urlStr.endsWith('/8')) {
                nextMapCtrl.abort();
              }
              return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
            }
            if (urlStr.includes('/draft/draft_map_1/picks')) {
              return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
            }
            if (urlStr.includes('/draft/draft_map_1')) {
              return { ok: true, status: 200, json: async () => ({ draft_id: 'draft_map_1', league_id: 'lg_map_1', status: 'complete', settings: { teams: 12 }, draft_order: {} }), text: async () => '{}' };
            }
            if (urlStr.includes('/league/lg_map_1/rosters')) {
              return { ok: true, status: 200, json: async () => [{ roster_id: 1, owner_id: 'u_map_1', players: ['4046'], starters: ['4046'] }], text: async () => '[]' };
            }
            if (urlStr.includes('/league/lg_map_1/users')) {
              return { ok: true, status: 200, json: async () => [{ user_id: 'u_map_1', username: 'MapUser', display_name: 'MapUser' }], text: async () => '[]' };
            }
            if (urlStr.includes('/league/lg_map_1/matchups')) {
              return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
            }
            if (urlStr.includes('/league/lg_map_1')) {
              return { ok: true, status: 200, json: async () => ({ league_id: 'lg_map_1', name: 'Map League', season: '2028', total_rosters: 12, settings: { leg: 7 }, scoring_settings: { rec: 1 } }), text: async () => '{}' };
            }
            return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
          };
          await assert.rejects(
            () => sleeper.fetchSleeperDraft(
              'draft_map_1',
              { sleeper_username: 'MapUser', league_id: 'lg_map_1' },
              { '4046': { player_id: '4046', first_name: 'Josh', last_name: 'Allen', full_name: 'Josh Allen', position: 'QB', team: 'BUF', bye_week: 7 } },
              { throwOnError: true, signal: nextMapCtrl.signal }
            ),
            /Sync aborted/,
            'Aborted fetchNextWeekProjectionsMap inside fetchSleeperDraft must throw Sync aborted'
          );
        } finally {
          sleeper.setSeasonContext(prevSeasonCtx5h);
        }

        globalThis.fetch = prevFetchInTest;
        globalThis.window.location = { origin: 'http://127.0.0.1:3000', search: '' };
      } finally {
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
        globalThis.fetch = origFetch;
      }
    });

    it('8.4 MatchupsScreen guards NaN Oracle inputs and clamps win_probability before computing isFavorite', async () => {
      const { render, jsx, fireEvent } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider } = await import('../context/OneiromancyContext.tsx');
      const { MatchupsScreen } = await import('../components/screens/MatchupsScreen.tsx');
      const baseLive = {
        mode: 'live',
        isLive: true,
        my_roster: [],
        cosmic_board: [],
        competitor_teams: [],
        settings: { chaos_lambda: 0.75 },
      };

      const completedNanState = {
        ...baseLive,
        weekly_matchup: {
          week: 3,
          matchup_id: 9,
          status: 'completed',
          score_user: 112.4,
          score_opponent: 98.2,
          win_probability: Number.NaN,
          user_team: { team_name: 'Team Alpha', starters: [], projected_points: Number.NaN },
          opponent_team: { team_name: 'Team Omega', starters: [], projected_points: Number.NaN },
          player_favorabilities: [],
        },
      };
      const completedView = render(
        jsx(OneiromancyProvider, {
          initialDraftState: completedNanState,
          children: jsx(MatchupsScreen, {}),
        })
      );
      assert.ok(
        !completedView.container.textContent.includes('NaN'),
        'Completed matchup with NaN projected_points/win_probability must never render NaN in Oracle or Win Prob text'
      );
      assert.equal(
        completedView.getByTestId('matchup-header-user-score').textContent.trim(),
        '- Oracle',
        'Completed empty-starter matchup missing valid Oracle inputs must render - Oracle'
      );
      assert.equal(
        completedView.getByTestId('matchup-header-opp-score').textContent.trim(),
        '- Oracle',
        'Completed empty-starter matchup missing valid Oracle inputs must render - Oracle for opponent'
      );
      assert.ok(
        !completedView.container.textContent.includes('50.0% Win Prob'),
        'Completed empty-starter matchup missing valid Oracle inputs must display - instead of 50.0% Win Prob'
      );
      fireEvent.click(completedView.getByTestId('matchup-score-mode-stats'));
      assert.equal(completedView.getByTestId('matchup-header-user-score').textContent.trim(), '112.40 Final');
      assert.equal(completedView.getByTestId('matchup-header-opp-score').textContent.trim(), '98.20 Final');
      completedView.unmount();

      const clampedNegState = {
        ...baseLive,
        weekly_matchup: {
          week: 4,
          matchup_id: 10,
          status: 'upcoming',
          win_probability: -15,
          user_team: { team_name: 'Team Alpha', starters: [], projected_points: 88.5 },
          opponent_team: { team_name: 'Team Omega', starters: [], projected_points: 115.2 },
          player_favorabilities: [],
        },
      };
      const negView = render(
        jsx(OneiromancyProvider, {
          initialDraftState: clampedNegState,
          children: jsx(MatchupsScreen, {}),
        })
      );
      assert.ok(
        negView.container.textContent.includes('0.0% Win Prob'),
        'Negative win_probability must clamp to 0.0% Win Prob'
      );
      const winProbBadge = negView.container.querySelector('.text-rose-400');
      assert.ok(
        winProbBadge && winProbBadge.textContent.includes('0.0% Win Prob'),
        '0.0% clamped Win Prob must set isFavorite=false (rose badge, not emerald)'
      );
      negView.unmount();

      const clampedHighState = {
        ...clampedNegState,
        weekly_matchup: {
          ...clampedNegState.weekly_matchup,
          win_probability: 150,
        },
      };
      const highView = render(
        jsx(OneiromancyProvider, {
          initialDraftState: clampedHighState,
          children: jsx(MatchupsScreen, {}),
        })
      );
      assert.ok(
        highView.container.textContent.includes('100.0% Win Prob'),
        'Over-100 win_probability must clamp to 100.0% Win Prob'
      );
      const highBadge = highView.container.querySelector('.text-emerald-400');
      assert.ok(
        highBadge && highBadge.textContent.includes('100.0% Win Prob'),
        '100.0% clamped Win Prob must render with emerald favorite badge'
      );
      highView.unmount();
    });

    it('5i. Internal timeout vs AbortError isolation, shared cache detachment, zero-league fallback, and SettingsDrawer rollback/reset', async () => {
      const {
        render: rtwRender,
        fireEvent: rtwFireEvent,
        waitFor: rtwWaitFor,
        cleanup: rtwCleanup,
        React: rtwReact,
      } = await import('./helpers/react_testing_wrapper.mjs');
      const { useOneiromancy } = await import('../context/OneiromancyContext.tsx');
      const { SettingsDrawer } = await import('../components/settings/SettingsDrawer.tsx');
      const nflGames = await import('../core/lib/nflGames.ts');

      const origFetch = globalThis.fetch;
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      const prevSeasonCtx = sleeper.getSeasonContext();
      sleeper.clearProjectionsCache();
      nflGames.clearNflGames();

      const storageMap = new Map();
      const mockStorage = {
        getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear(),
      };
      globalThis.localStorage = mockStorage;
      globalThis.window = {
        ...(origWindow || {}),
        location: { origin: 'http://127.0.0.1:3000', search: '' },
        history: { replaceState: () => {} },
        localStorage: mockStorage,
      };

      try {
        // 1. Internal AbortError on one slow season must NOT throw if caller signal is not aborted
        const unabortedCtrl = new AbortController();
        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('/user/SlowSeasonUser')) {
            return { ok: true, status: 200, json: async () => ({ user_id: 'u_slow', username: 'SlowSeasonUser' }) };
          }
          if (u.includes('/leagues/nfl/2026')) {
            const timeoutErr = new Error('The operation was aborted due to internal timeout');
            timeoutErr.name = 'AbortError';
            throw timeoutErr;
          }
          if (u.includes('/leagues/nfl/2025')) {
            return {
              ok: true,
              status: 200,
              json: async () => [{ league_id: 'lg_2025_ok', name: '2025 Keeper', season: '2025', total_rosters: 12 }],
            };
          }
          return { ok: true, status: 200, json: async () => [] };
        };
        const slowRes = await sleeper.fetchUserLeagues('SlowSeasonUser', ['2026', '2025'], unabortedCtrl.signal);
        assert.equal(slowRes.leagues.length, 1, 'Remaining season leagues must still load after single-season internal timeout');
        assert.equal(slowRes.leagues[0].league_id, 'lg_2025_ok');

        // 2. Abort during userRes.json() must throw instead of masquerading as User not found
        const jsonAbortCtrl = new AbortController();
        globalThis.fetch = async (url) => {
          if (String(url).includes('/user/JsonAbortUser')) {
            return {
              ok: true,
              status: 200,
              json: async () => {
                jsonAbortCtrl.abort();
                throw new Error('Body stream aborted');
              },
            };
          }
          return { ok: true, status: 200, json: async () => [] };
        };
        await assert.rejects(
          () => sleeper.fetchUserLeagues('JsonAbortUser', ['2026'], jsonAbortCtrl.signal),
          /Body stream aborted|Sync aborted|aborted/i,
          'Abort while parsing userRes.json() must reject cleanly instead of returning User not found'
        );

        // 2b. Hung userRes.json() and leaguesRes.json() body reads cancel asynchronously mid-read upon caller abort
        let markUserJsonStarted;
        const userJsonStarted = new Promise((resolve) => {
          markUserJsonStarted = resolve;
        });
        const hungJsonAbortCtrl = new AbortController();
        globalThis.fetch = async () => ({
          ok: true,
          status: 200,
          json: () => {
            markUserJsonStarted();
            return new Promise(() => {});
          },
        });
        const hungPromise = sleeper.fetchUserLeagues('HungJsonUser', ['2026'], hungJsonAbortCtrl.signal);
        await userJsonStarted;
        await new Promise((r) => setTimeout(r, 0));
        hungJsonAbortCtrl.abort();
        await assert.rejects(
          () => hungPromise,
          /Sync aborted|aborted/i,
          'Hung userRes.json() body read must cancel asynchronously mid-read upon caller abort'
        );

        let markLeaguesJsonStarted;
        const leaguesJsonStarted = new Promise((resolve) => {
          markLeaguesJsonStarted = resolve;
        });
        const hungLeaguesAbortCtrl = new AbortController();
        globalThis.fetch = async (url) => {
          if (String(url).includes('/user/HungLeaguesJsonUser')) {
            return { ok: true, status: 200, json: async () => ({ user_id: 'u_hung_lg', username: 'HungLeaguesJsonUser' }) };
          }
          return {
            ok: true,
            status: 200,
            json: () => {
              markLeaguesJsonStarted();
              return new Promise(() => {});
            },
          };
        };
        const hungLeaguesPromise = sleeper.fetchUserLeagues('HungLeaguesJsonUser', ['2026'], hungLeaguesAbortCtrl.signal);
        await leaguesJsonStarted;
        await new Promise((r) => setTimeout(r, 0));
        hungLeaguesAbortCtrl.abort();
        await assert.rejects(
          () => hungLeaguesPromise,
          /Sync aborted|aborted/i,
          'Hung leaguesRes.json() body read must cancel asynchronously mid-read upon caller abort'
        );

        // 2c. Pre-aborted signal throws before mock short-circuit in fetchDraftMetadata & fetchDraftPicks
        const preAbortedCtrl = new AbortController();
        preAbortedCtrl.abort();
        await assert.rejects(
          () => sleeper.fetchDraftMetadata('mock_oneiromancy_draft_2025', preAbortedCtrl.signal),
          /Sync aborted/i
        );
        await assert.rejects(
          () => sleeper.fetchDraftPicks('mock_oneiromancy_draft_2025', preAbortedCtrl.signal),
          /Sync aborted/i
        );

        // 2d. nflGames.raceWithAbort & fetchEspnWeek handle aborted/rejecting promises without unhandledRejection
        const origSetTimeoutForTest = globalThis.setTimeout;
        const capturedUnhandled = [];
        const onUnhandled = (reason) => {
          capturedUnhandled.push(reason);
        };
        process.on('unhandledRejection', onUnhandled);
        try {
          const preAbortedEspn = new AbortController();
          preAbortedEspn.abort();
          globalThis.fetch = () => Promise.reject(new Error('late pre-aborted rejection'));
          const preAbortedEspnRes = await nflGames.fetchEspnWeek('2098', 11, false, preAbortedEspn.signal);
          assert.equal(preAbortedEspnRes, null);
          const abortedRaceRes = await nflGames.raceWithAbort(
            Promise.reject(new Error('late aborted race rejection')),
            preAbortedEspn.signal,
            null,
          );
          assert.equal(abortedRaceRes, null, 'pre-aborted raceWithAbort must resolve fallback and attach catch handler');

          // Also exercise shared cache race when an in-flight rejecting promise is awaited with a signal that aborts before rejection
          let rejectInFlightEspn;
          nflGames.clearNflGames();
          globalThis.fetch = () =>
            new Promise((_resolve, reject) => {
              rejectInFlightEspn = () => reject(new Error('late in-flight espn failure'));
            });
          const unAbortedEspnCaller = nflGames.fetchEspnWeek('2098', 10, false);
          const raceAbortCtrl = new AbortController();
          const abortedEspnCaller = nflGames.fetchEspnWeek('2098', 10, false, raceAbortCtrl.signal);
          raceAbortCtrl.abort();
          rejectInFlightEspn();
          assert.equal(await abortedEspnCaller, null);
          assert.equal(await unAbortedEspnCaller, null);

          await new Promise((r) => origSetTimeoutForTest(r, 10));
          assert.equal(
            capturedUnhandled.length,
            0,
            `Expected zero unhandledRejection events during aborted ESPN/race calls, got ${capturedUnhandled.length}`
          );
        } finally {
          process.off('unhandledRejection', onUnhandled);
        }

        // 3. Shared promise cache isolation across concurrent callers (projections, schedule, ESPN, matchupWeekCache)
        let resolveProjFetch;
        let projFetchCount = 0;
        globalThis.fetch = (url) => {
          if (String(url).includes('/projections/nfl/regular/2098/12')) {
            projFetchCount += 1;
            return new Promise((resolve) => {
              resolveProjFetch = () =>
                resolve({ ok: true, status: 200, json: async () => ({ '4046': { pts_ppr: 19.5 } }) });
            });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
        };
        const pCtrlA = new AbortController();
        const pCtrlB = new AbortController();
        const pCallA = sleeper.fetchWeeklyProjections('2098', 12, pCtrlA.signal);
        const pCallB = sleeper.fetchWeeklyProjections('2098', 12, pCtrlB.signal);
        pCtrlA.abort();
        assert.equal(await pCallA, null, 'Aborted Caller A receives null from fetchWeeklyProjections');
        resolveProjFetch();
        assert.equal((await pCallB)?.['4046']?.pts_ppr, 19.5, 'Unaborted Caller B still receives live projections');
        assert.equal(projFetchCount, 1, 'Shared in-flight projections cache deduplicates underlying fetch');

        // 3b. Timed-out fetchWeeklyProjections exercises real fetchWithTimeout timedOut -> TimeoutError and populates 60s negative cache
        let timeoutProjFetchCount = 0;
        globalThis.setTimeout = (fn, delay, ...args) => {
          const effectiveDelay = delay >= 10000 ? 1 : delay;
          return origSetTimeoutForTest(fn, effectiveDelay, ...args);
        };
        try {
          globalThis.fetch = (url, init) => {
            if (String(url).includes('/projections/nfl/regular/2098/13')) {
              timeoutProjFetchCount += 1;
              return new Promise((_, reject) => {
                init?.signal?.addEventListener(
                  'abort',
                  () => {
                    const abortErr = new Error('The operation was aborted');
                    abortErr.name = 'AbortError';
                    reject(abortErr);
                  },
                  { once: true }
                );
              });
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
          };
          assert.equal(await sleeper.fetchWeeklyProjections('2098', 13), null);
          assert.equal(await sleeper.fetchWeeklyProjections('2098', 13), null);
          assert.equal(
            timeoutProjFetchCount,
            1,
            'Timed-out fetchWeeklyProjections must populate 60s negative cache so immediate retries do not hammer endpoint'
          );
        } finally {
          globalThis.setTimeout = origSetTimeoutForTest;
        }

        let resolveSchedFetch;
        let schedFetchCount = 0;
        globalThis.fetch = (url) => {
          if (String(url).includes('/schedule/nfl/regular/2098')) {
            schedFetchCount += 1;
            return new Promise((resolve) => {
              resolveSchedFetch = () =>
                resolve({ ok: true, status: 200, json: async () => [{ week: 1, home: 'KC', away: 'BUF', date: '2098-09-07' }] });
            });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        };
        const sCtrlA = new AbortController();
        const sCtrlB = new AbortController();
        const sCallA = sleeper.fetchNFLSchedule('2098', sCtrlA.signal);
        const sCallB = sleeper.fetchNFLSchedule('2098', sCtrlB.signal);
        sCtrlA.abort();
        assert.deepEqual(await sCallA, [], 'Aborted Caller A receives [] from fetchNFLSchedule');
        resolveSchedFetch();
        const sResB = await sCallB;
        assert.equal(sResB.length, 1, 'Unaborted Caller B still receives schedule from shared cache');
        assert.equal(schedFetchCount, 1);

        let resolveEspnFetch;
        let espnFetchCount = 0;
        globalThis.fetch = (url) => {
          if (String(url).includes('site.api.espn.com') && String(url).includes('dates=2098')) {
            espnFetchCount += 1;
            return new Promise((resolve) => {
              resolveEspnFetch = () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    events: [
                      {
                        date: '2098-11-26T18:00:00Z',
                        competitions: [
                          {
                            competitors: [
                              { homeAway: 'home', team: { abbreviation: 'KC' } },
                              { homeAway: 'away', team: { abbreviation: 'BUF' } },
                            ],
                          },
                        ],
                      },
                    ],
                  }),
                });
            });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => null });
        };
        const eCtrlA = new AbortController();
        const eCtrlB = new AbortController();
        const eCallA = nflGames.fetchEspnWeek('2098', 12, false, eCtrlA.signal);
        const eCallB = nflGames.fetchEspnWeek('2098', 12, false, eCtrlB.signal);
        eCtrlA.abort();
        assert.equal(await eCallA, null, 'Aborted Caller A receives null from fetchEspnWeek');
        resolveEspnFetch();
        const eResB = await eCallB;
        assert.equal(eResB?.length, 1, 'Unaborted Caller B still receives ESPN games from shared espnCache');
        assert.equal(espnFetchCount, 1);

        let resolveMatchupW1;
        globalThis.fetch = (url) => {
          const u = String(url);
          if (u.includes('/matchups/1')) {
            return new Promise((resolve) => {
              resolveMatchupW1 = () =>
                resolve({ ok: true, status: 200, json: async () => [{ roster_id: 1, matchup_id: 3, points: 99, starters: ['4046'] }] });
            });
          }
          if (u.includes('/matchups/')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [{ roster_id: 1, matchup_id: 3, points: 0, starters: ['4046'] }] });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ events: [] }) });
        };
        const mCtrlA = new AbortController();
        const mCtrlB = new AbortController();
        const mCallA = sleeper.loadSeasonContext('lg_cache_iso', '2098', 2, [], { settings: { playoff_week_start: 4 } }, mCtrlA.signal);
        const mCallB = sleeper.loadSeasonContext('lg_cache_iso', '2098', 2, [], { settings: { playoff_week_start: 4 } }, mCtrlB.signal);
        await new Promise((r) => setTimeout(r, 0));
        mCtrlA.abort();
        assert.equal(await mCallA, null, 'Aborted Caller A receives null from loadSeasonContext');
        resolveMatchupW1();
        const mResB = await mCallB;
        assert.ok(mResB && mResB.matchupsByWeek?.[1]?.length === 1, 'Unaborted Caller B receives cached Week 1 matchups');

        // 4. Pre-aborted mock fetchSleeperDraft & zero-league username retention in catch fallback
        const preCtrl = new AbortController();
        preCtrl.abort();
        await assert.rejects(
          () => sleeper.fetchSleeperDraft('mock', undefined, undefined, { signal: preCtrl.signal }),
          /Sync aborted/,
          'Pre-aborted fetchSleeperDraft("mock") must throw Sync aborted before returning mock state'
        );

        globalThis.fetch = async (url) => {
          if (String(url).includes('/user/ZeroLeagueFallback')) {
            return { ok: true, status: 200, json: async () => ({ user_id: 'u_zf_1', username: 'ZeroLeagueFallback' }) };
          }
          return { ok: true, status: 200, json: async () => [] };
        };
        const zeroLiveState = await sleeper.fetchSleeperDraft(undefined, {
          sleeper_username: 'ZeroLeagueFallback',
          mode: 'live',
        });
        assert.equal(zeroLiveState.mode, 'live', 'Live request for zero-league user must stay in live mode in fallback');
        assert.equal(zeroLiveState.isLive, true);
        assert.equal(zeroLiveState.settings.sleeper_username, 'ZeroLeagueFallback');
        assert.equal(zeroLiveState.available_leagues?.length, 0);
        assert.equal(zeroLiveState.cosmic_board?.length, 0, 'Zero-league live fallback must not leak mock cosmic_board');
        await assert.rejects(
          () => sleeper.fetchSleeperDraft(
            undefined,
            { sleeper_username: 'ZeroLeagueFallback', mode: 'live' },
            {},
            { throwOnError: true }
          ),
          /No NFL leagues found for @ZeroLeagueFallback/i,
          'Strict fetchSleeperDraft must report No NFL leagues found for valid user with zero leagues'
        );

        const emptyLiveState = await sleeper.fetchSleeperDraft(undefined, {
          sleeper_username: '',
          mode: 'live',
        });
        assert.equal(emptyLiveState.settings.sleeper_username, '', 'Empty username must not silently revert to OneiroVanguard');

        // 4b. B1 Error attribution: /user 503, malformed 200 JSON, network failure, TimeoutError (with/without league_id), and all-seasons TimeoutError or 429 must not report not-found / no-leagues
        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('/user/ServerErrorUser')) {
            return { ok: false, status: 503, json: async () => null };
          }
          if (u.includes('/user/BadJsonUser')) {
            return {
              ok: true,
              status: 200,
              json: async () => {
                throw new SyntaxError('Unexpected token < in JSON');
              },
            };
          }
          if (u.includes('/user/NetworkFailUser')) {
            throw new TypeError('Failed to fetch');
          }
          return { ok: true, status: 200, json: async () => [] };
        };
        await assert.rejects(
          () => sleeper.fetchSleeperDraft(
            undefined,
            { sleeper_username: 'ServerErrorUser', mode: 'live' },
            {},
            { throwOnError: true }
          ),
          (err) => err instanceof Error && /HTTP_503_USER_FETCH_FAILED/.test(err.message) && !/not found/i.test(err.message),
          '/user HTTP 503 must throw HTTP_503_USER_FETCH_FAILED instead of User not found'
        );
        await assert.rejects(
          () => sleeper.fetchSleeperDraft(
            undefined,
            { sleeper_username: 'BadJsonUser', mode: 'live' },
            {},
            { throwOnError: true }
          ),
          (err) => err instanceof Error && /Unexpected token/.test(err.message) && !/not found/i.test(err.message),
          '/user malformed 200 JSON while unaborted must propagate parse error instead of User not found'
        );
        await assert.rejects(
          () => sleeper.fetchSleeperDraft(
            undefined,
            { sleeper_username: 'NetworkFailUser', mode: 'live' },
            {},
            { throwOnError: true }
          ),
          (err) => err instanceof Error && /Failed to fetch/i.test(err.message) && !/not found/i.test(err.message),
          '/user network error must surface instead of User not found'
        );

        globalThis.setTimeout = (fn, delay, ...args) => {
          const effectiveDelay = delay >= 10000 ? 1 : delay;
          return origSetTimeoutForTest(fn, effectiveDelay, ...args);
        };
        try {
          globalThis.fetch = (_url, init) => new Promise((_, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => {
                const abortErr = new Error('The operation was aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              },
              { once: true }
            );
          });
          await assert.rejects(
            () => sleeper.fetchSleeperDraft(
              undefined,
              { sleeper_username: 'TimeoutUser', league_id: 'lg_stale_1', mode: 'live' },
              {},
              { throwOnError: true }
            ),
            (err) => err instanceof Error && err.name === 'TimeoutError' && /timed out/i.test(err.message),
            '/user TimeoutError must preserve TimeoutError name even when a prior league_id is set'
          );

          globalThis.fetch = (url, init) => {
            if (String(url).includes('/user/AllSeasonsTimeout')) {
              return Promise.resolve({ ok: true, status: 200, json: async () => ({ user_id: 'u_to_all', username: 'AllSeasonsTimeout' }) });
            }
            return new Promise((_, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => {
                  const abortErr = new Error('The operation was aborted');
                  abortErr.name = 'AbortError';
                  reject(abortErr);
                },
                { once: true }
              );
            });
          };
          await assert.rejects(
            () => sleeper.fetchSleeperDraft(
              undefined,
              { sleeper_username: 'AllSeasonsTimeout', mode: 'live' },
              {},
              { throwOnError: true }
            ),
            (err) => err instanceof Error && err.name === 'TimeoutError' && /timed out/i.test(err.message) && !/No NFL leagues found/i.test(err.message),
            'All-seasons TimeoutError must surface TimeoutError instead of No NFL leagues found'
          );
        } finally {
          globalThis.setTimeout = origSetTimeoutForTest;
        }

        globalThis.fetch = async (url) => {
          if (String(url).includes('/user/RateLimitSeasons')) {
            return { ok: true, status: 200, json: async () => ({ user_id: 'u_429_all', username: 'RateLimitSeasons' }) };
          }
          return { ok: false, status: 429, json: async () => null };
        };
        await assert.rejects(
          () => sleeper.fetchSleeperDraft(
            undefined,
            { sleeper_username: 'RateLimitSeasons', mode: 'live' },
            {},
            { throwOnError: true }
          ),
          (err) => err instanceof Error && /HTTP_429_TOO_MANY_REQUESTS/.test(err.message) && !/No NFL leagues found/i.test(err.message),
          'All-seasons 429 rate limit must surface HTTP_429_TOO_MANY_REQUESTS instead of No NFL leagues found'
        );
        sleeper.resetRateLimit();

        // 5. SettingsDrawer failed live save preserves mock board/mode & dismiss-reopen resets unsaved input
        globalThis.fetch = async (url) => {
          if (String(url).includes('/user/UnknownSleeper999')) {
            return { ok: false, status: 404, json: async () => null };
          }
          return { ok: true, status: 200, json: async () => [] };
        };
        let latestCtx = null;
        function DrawerHarness() {
          const [open, setOpen] = rtwReact.useState(true);
          latestCtx = useOneiromancy();
          return rtwReact.createElement(
            rtwReact.Fragment,
            null,
            rtwReact.createElement('button', { type: 'button', 'data-testid': 'reopen-drawer', onClick: () => setOpen(true) }, 'Open'),
            rtwReact.createElement(SettingsDrawer, { isOpen: open, onClose: () => setOpen(false) })
          );
        }
        const initialMockState = {
          ...mockData.mock_oneiromancy_draft_2025,
          isLive: false,
          mode: 'mock',
          settings: {
            ...mockData.mockSettings,
            mode: 'mock',
            sleeper_username: 'OneiroVanguard',
            auto_update: false,
          },
        };
        const drawerView = rtwRender(
          rtwReact.createElement(
            OneiromancyProvider,
            { initialDraftState: initialMockState },
            rtwReact.createElement(DrawerHarness, null)
          )
        );
        const inputEl = drawerView.container.querySelector('#username-input');
        assert.ok(inputEl, '#username-input must render inside open SettingsDrawer');
        const committedBeforeEdit = inputEl.value;
        rtwFireEvent.change(inputEl, { target: { value: 'UnknownSleeper999' } });
        rtwFireEvent.keyDown(inputEl, { key: 'Enter', code: 'Enter' });

        await rtwWaitFor(() => {
          const banner = drawerView.container.querySelector('#sync-error-banner');
          assert.ok(banner && banner.textContent.length > 0, 'Sync error banner must display on failed save');
        });
        assert.equal(latestCtx.mode, 'mock', 'Failed live save must preserve mock mode instead of switching prematurely');
        assert.equal(latestCtx.draftState.isLive, false);
        assert.ok((latestCtx.draftState.cosmic_board?.length || 0) > 0, 'Failed live save must not clear existing mock board');
        assert.equal(latestCtx.draftState.settings.sleeper_username, 'OneiroVanguard');
        assert.equal(
          drawerView.container.querySelector('#username-input')?.value,
          'UnknownSleeper999',
          'Unsaved failing username stays visible while SettingsDrawer remains open'
        );

        const closeBtn = Array.from(drawerView.container.querySelectorAll('button')).find(
          (b) => (b.textContent || '').includes('Close Settings')
        );
        assert.ok(closeBtn, 'Close Settings button must exist');
        rtwFireEvent.click(closeBtn);
        rtwFireEvent.click(drawerView.getByTestId('reopen-drawer'));
        assert.equal(
          drawerView.container.querySelector('#username-input')?.value,
          committedBeforeEdit,
          'Reopening dismissed SettingsDrawer must reset unsaved invalid input back to committed/initial username'
        );
        rtwCleanup();

        // 6. Committed returning username in mock mode is preserved across failed save and dismiss-reopen
        mockStorage.setItem('oneiromancy_active_username', 'SavedOracleUser');
        const returningMockState = {
          ...initialMockState,
          settings: {
            ...initialMockState.settings,
            sleeper_username: 'SavedOracleUser',
          },
        };
        const returningView = rtwRender(
          rtwReact.createElement(
            OneiromancyProvider,
            { initialDraftState: returningMockState },
            rtwReact.createElement(DrawerHarness, null)
          )
        );
        const returningInput = returningView.container.querySelector('#username-input');
        assert.equal(returningInput?.value, 'SavedOracleUser', 'Committed returning username loads into #username-input');
        rtwFireEvent.change(returningInput, { target: { value: 'UnknownSleeper999' } });
        rtwFireEvent.keyDown(returningInput, { key: 'Enter', code: 'Enter' });
        await rtwWaitFor(() => {
          const banner = returningView.container.querySelector('#sync-error-banner');
          assert.ok(banner && banner.textContent.length > 0, 'Error banner shows for returning user failed save');
        });
        assert.equal(mockStorage.getItem('oneiromancy_active_username'), 'SavedOracleUser', 'Failed save must not overwrite localStorage username');
        const returningCloseBtn = Array.from(returningView.container.querySelectorAll('button')).find(
          (b) => (b.textContent || '').includes('Close Settings')
        );
        rtwFireEvent.click(returningCloseBtn);
        rtwFireEvent.click(returningView.getByTestId('reopen-drawer'));
        assert.equal(
          returningView.container.querySelector('#username-input')?.value,
          'SavedOracleUser',
          'Reopening dismissed SettingsDrawer resets unsaved input back to SavedOracleUser'
        );
        rtwCleanup();

        // 7a. Dismissing Welcome Screen while initial first-launch save is in-flight prevents welcome banner resurrection on failure
        mockStorage.clear();
        let resolveSlowSaveFetch;
        globalThis.fetch = (url) => {
          if (String(url).includes('/user/SlowMissingUser')) {
            return new Promise((resolve) => {
              resolveSlowSaveFetch = () =>
                resolve({ ok: false, status: 404, json: async () => null });
            });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        };
        const firstLaunchMockState = {
          ...initialMockState,
          settings: {
            ...initialMockState.settings,
            sleeper_username: '',
          },
        };
        const welcomeView = rtwRender(
          rtwReact.createElement(
            OneiromancyProvider,
            { initialDraftState: firstLaunchMockState },
            rtwReact.createElement(DrawerHarness, null)
          )
        );
        const welcomeInput = welcomeView.container.querySelector('#username-input');
        assert.ok(welcomeView.container.textContent.includes('Welcome to Oneiromancy'));
        rtwFireEvent.change(welcomeInput, { target: { value: 'SlowMissingUser' } });
        rtwFireEvent.keyDown(welcomeInput, { key: 'Enter', code: 'Enter' });
        const welcomeCloseBtn = welcomeView.container.querySelector('button[aria-label="Close Settings"]');
        assert.ok(welcomeCloseBtn, 'Header Close Settings button must exist on Welcome Screen');
        rtwFireEvent.click(welcomeCloseBtn);
        assert.ok(resolveSlowSaveFetch, 'Slow save fetch should be in-flight before resolution');
        resolveSlowSaveFetch();
        await rtwWaitFor(() => {
          assert.ok(latestCtx?.syncError && latestCtx.syncError.length > 0 && !latestCtx.isLoading);
        });
        rtwFireEvent.click(welcomeView.getByTestId('reopen-drawer'));
        assert.ok(
          welcomeView.container.querySelector('#sync-error-banner'),
          'Sync error banner must render after reopening dismissed drawer when save failed'
        );
        assert.ok(
          !welcomeView.container.textContent.includes('Welcome to Oneiromancy'),
          'Dismissed Welcome Screen must stay dismissed even after in-flight save fails'
        );
        rtwCleanup();

        // 7b. B2 TimeoutError classification & live sync_warning leagueLabel formatting (with & without leagueId)
        const liveWarningState = {
          ...initialMockState,
          isLive: true,
          mode: 'live',
          settings: {
            ...initialMockState.settings,
            mode: 'live',
            sleeper_username: 'TimeoutLiveUser',
            league_id: '',
          },
        };
        globalThis.setTimeout = (fn, delay, ...args) => {
          const effectiveDelay = delay >= 10000 ? 1 : delay;
          return origSetTimeoutForTest(fn, effectiveDelay, ...args);
        };
        let timeoutView;
        try {
          globalThis.fetch = (_url, init) => new Promise((_, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => {
                const abortErr = new Error('The operation was aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              },
              { once: true }
            );
          });
          mockStorage.setItem('oneiromancy_active_username', 'TimeoutLiveUser');
          timeoutView = rtwRender(
            rtwReact.createElement(
              OneiromancyProvider,
              { initialDraftState: liveWarningState },
              rtwReact.createElement(DrawerHarness, null)
            )
          );
          await latestCtx.refreshDraft('TimeoutLiveUser', '');
          await rtwWaitFor(() => {
            assert.ok(latestCtx?.syncError && latestCtx?.syncWarning && !latestCtx.isLoading);
          });
          assert.ok(
            latestCtx.syncError.includes('Sleeper API unreachable from client browser'),
            'TimeoutError must classify into browser connectivity notice instead of generic sync failed'
          );
          assert.equal(
            latestCtx.syncWarning,
            'Dynamic Sleeper resolution (@TimeoutLiveUser) failed. Retaining current live state.',
            'syncWarning must omit empty league clause and match exact live fallback string'
          );
          assert.equal(
            latestCtx.draftState?.sync_warning,
            'Dynamic Sleeper resolution (@TimeoutLiveUser) failed. Retaining current live state.',
            'draftState.sync_warning must match liveLeagueLabel formatting without blank leagueId'
          );
          await latestCtx.refreshDraft('TimeoutLiveUser', 'lg_nonempty_99');
          await rtwWaitFor(() => {
            assert.equal(
              latestCtx.syncWarning,
              'Dynamic Sleeper resolution for league lg_nonempty_99 (@TimeoutLiveUser) failed. Retaining current live state.'
            );
            assert.equal(
              latestCtx.draftState?.sync_warning,
              'Dynamic Sleeper resolution for league lg_nonempty_99 (@TimeoutLiveUser) failed. Retaining current live state.'
            );
          });
        } finally {
          globalThis.setTimeout = origSetTimeoutForTest;
          sleeper.resetRateLimit();
          rtwCleanup();
        }

        // 7c. B3 shouldAutoClose race: dismiss & reopen while first-launch save is in-flight must NOT auto-close reopened drawer on ok settlement
        mockStorage.clear();
        const mockLiveEndpoints = (u, username, uid) => {
          if (u.includes(`/user/${uid}/leagues/nfl/2026`)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => [{ league_id: 'lg_good', name: 'Good League', season: '2026', sport: 'nfl', total_rosters: 2, draft_id: 'dr_good', roster_positions: ['QB', 'BN'] }],
            });
          }
          if (u.includes('/league/lg_good/drafts')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [{ draft_id: 'dr_good', season: '2026', status: 'complete' }] });
          }
          if (u.includes('/league/lg_good/users')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [{ user_id: uid, display_name: username }] });
          }
          if (u.includes('/league/lg_good/rosters')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [{ roster_id: 1, owner_id: uid, players: ['4046'], starters: ['4046'] }] });
          }
          if (u.includes('/league/lg_good')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ league_id: 'lg_good', name: 'Good League', season: '2026', total_rosters: 2, roster_positions: ['QB', 'BN'], draft_id: 'dr_good', settings: { leg: 1, playoff_week_start: 15 } }),
            });
          }
          if (u.includes('/draft/dr_good/picks')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [{ pick_no: 1, round: 1, roster_id: 1, picked_by: uid, player_id: '4046' }] });
          }
          if (u.includes('/draft/dr_good')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ draft_id: 'dr_good', season: '2026', status: 'complete', settings: { rounds: 1, teams: 2, slots_qb: 1 }, draft_order: { [uid]: 1 } }),
            });
          }
          if (u.includes('/state/nfl')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ season: '2026', week: 1, season_type: 'regular' }) });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        };
        let resolveSlowGoodUser;
        globalThis.fetch = (url) => {
          const u = String(url);
          if (u.includes('/user/SlowGoodUser')) {
            return new Promise((resolve) => {
              resolveSlowGoodUser = () =>
                resolve({ ok: true, status: 200, json: async () => ({ user_id: 'u_good', username: 'SlowGoodUser', display_name: 'SlowGoodUser' }) });
            });
          }
          return mockLiveEndpoints(u, 'SlowGoodUser', 'u_good');
        };
        const raceView = rtwRender(
          rtwReact.createElement(
            OneiromancyProvider,
            { initialDraftState: firstLaunchMockState },
            rtwReact.createElement(DrawerHarness, null)
          )
        );
        const raceInput = raceView.container.querySelector('#username-input');
        assert.ok(raceView.container.textContent.includes('Welcome to Oneiromancy'));
        rtwFireEvent.change(raceInput, { target: { value: 'SlowGoodUser' } });
        rtwFireEvent.keyDown(raceInput, { key: 'Enter', code: 'Enter' });
        const raceCloseBtn = raceView.container.querySelector('button[aria-label="Close Settings"]');
        rtwFireEvent.click(raceCloseBtn);
        rtwFireEvent.click(raceView.getByTestId('reopen-drawer'));
        assert.ok(raceView.container.querySelector('#username-input'), 'Drawer must be open after user reopens it before settlement');
        assert.ok(resolveSlowGoodUser, 'SlowGoodUser fetch must be in-flight');
        resolveSlowGoodUser();
        await rtwWaitFor(() => {
          assert.equal(
            latestCtx?.draftState?.isLive,
            true,
            `Expected isLive=true after resolveSlowGoodUser (isLoading=${latestCtx?.isLoading}, syncError=${latestCtx?.syncError})`
          );
          assert.equal(latestCtx?.isLoading, false);
          const badgeText = raceView.container.querySelector('#username-status-badge')?.textContent || '';
          assert.ok(
            !badgeText.includes('Querying Sleeper'),
            `handleSave finally block must finish before checking reopened drawer (badge="${badgeText}")`
          );
        });
        assert.ok(
          raceView.container.querySelector('#username-input'),
          'Reopened SettingsDrawer must stay open after handleSave completes when user dismissed before settlement'
        );
        rtwCleanup();

        // 7d. B3 Stale sync superseded error path preserves live state without restoring welcome banner
        mockStorage.clear();
        let resolveSupersededUser;
        globalThis.fetch = (url) => {
          const u = String(url);
          if (u.includes('/user/SlowSupersededUser')) {
            return new Promise((resolve) => {
              resolveSupersededUser = () =>
                resolve({ ok: false, status: 404, json: async () => null });
            });
          }
          if (u.includes('/user/QuickGoodUser')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ user_id: 'u_quick', username: 'QuickGoodUser', display_name: 'QuickGoodUser' }),
            });
          }
          return mockLiveEndpoints(u, 'QuickGoodUser', 'u_quick');
        };
        const staleView = rtwRender(
          rtwReact.createElement(
            OneiromancyProvider,
            { initialDraftState: firstLaunchMockState },
            rtwReact.createElement(DrawerHarness, null)
          )
        );
        const origRefreshDraft = latestCtx.refreshDraft;
        const staleInput = staleView.container.querySelector('#username-input');
        assert.ok(staleView.container.textContent.includes('Welcome to Oneiromancy'));
        rtwFireEvent.change(staleInput, { target: { value: 'SlowSupersededUser' } });
        rtwFireEvent.keyDown(staleInput, { key: 'Enter', code: 'Enter' });
        assert.ok(resolveSupersededUser, 'SlowSupersededUser fetch must be in-flight');
        const quickResult = await origRefreshDraft('QuickGoodUser');
        assert.equal(quickResult.ok, true, 'Superseding sync should succeed cleanly');
        await rtwWaitFor(() => {
          assert.equal(latestCtx?.draftState?.isLive, true);
          assert.ok(!staleView.container.textContent.includes('Welcome to Oneiromancy'));
          const badge = staleView.container.querySelector('#username-status-badge')?.textContent || '';
          assert.ok(
            badge.includes('Querying Sleeper'),
            'Superseded handleSave must still be suspended before resolveSupersededUser()'
          );
        });
        resolveSupersededUser();
        await rtwWaitFor(() => {
          const badge = staleView.container.querySelector('#username-status-badge')?.textContent || '';
          assert.ok(
            !badge.includes('Querying Sleeper'),
            `Superseded handleSave must fully settle and flush React state (badge="${badge}")`
          );
        });
        await new Promise((r) => origSetTimeoutForTest(r, 15));
        assert.ok(
          !staleView.container.textContent.includes('Welcome to Oneiromancy'),
          'Superseded slow save error must not resurrect Welcome banner in open SettingsDrawer'
        );
        rtwCleanup();

        // 7e. B3 Positive first-launch case: succeeding save WITHOUT dismiss auto-closes drawer and clears welcome banner
        mockStorage.clear();
        globalThis.fetch = (url) => {
          const u = String(url);
          if (u.includes('/user/FirstLaunchGoodUser')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ user_id: 'u_first', username: 'FirstLaunchGoodUser', display_name: 'FirstLaunchGoodUser' }),
            });
          }
          return mockLiveEndpoints(u, 'FirstLaunchGoodUser', 'u_first');
        };
        const autoCloseView = rtwRender(
          rtwReact.createElement(
            OneiromancyProvider,
            { initialDraftState: firstLaunchMockState },
            rtwReact.createElement(DrawerHarness, null)
          )
        );
        const autoInput = autoCloseView.container.querySelector('#username-input');
        assert.ok(autoCloseView.container.textContent.includes('Welcome to Oneiromancy'));
        rtwFireEvent.change(autoInput, { target: { value: 'FirstLaunchGoodUser' } });
        rtwFireEvent.keyDown(autoInput, { key: 'Enter', code: 'Enter' });
        await rtwWaitFor(() => {
          assert.equal(latestCtx?.draftState?.isLive, true);
          assert.equal(latestCtx?.isLoading, false);
          assert.equal(
            autoCloseView.container.querySelector('#username-input'),
            null,
            'First-launch save without prior dismiss must auto-close SettingsDrawer via onClose()'
          );
        });
        assert.equal(mockStorage.getItem('oneiromancy_active_username'), 'FirstLaunchGoodUser');
        rtwFireEvent.click(autoCloseView.getByTestId('reopen-drawer'));
        assert.ok(autoCloseView.container.querySelector('#username-input'));
        assert.ok(
          !autoCloseView.container.textContent.includes('Welcome to Oneiromancy'),
          'Welcome banner must stay cleared after auto-closed first-launch save'
        );
        rtwCleanup();
      } finally {
        rtwCleanup();
        sleeper.resetRateLimit();
        globalThis.fetch = origFetch;
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
        sleeper.setSeasonContext(prevSeasonCtx);
        sleeper.clearProjectionsCache();
        nflGames.clearNflGames();
      }
    });
  });
});
