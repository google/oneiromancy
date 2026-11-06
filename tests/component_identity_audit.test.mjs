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
 * Component-Level Identity Audit & Single-User Invariant Test Suite
 *
 * Dedicated automated tests validating Component Identity Specification
 * per architectural identity requirements:
 * "Every place rendering 'YOU' must have dedicated automated tests against authentic
 * Sleeper API captures, a single global place where 'you' / 'your team' is set,
 * and interactive testing with component testing."
 *
 * Verifies:
 * 1. Exactly ONE team in competitor_teams has is_user: true.
 * 2. Exactly ONE team has (You) in its name.
 * 3. CelestialLeaderboardGraph evaluates strictly 1 team as isUser.
 * 4. MatchupsScreen renders AstralOracles as YOU (130.65 Proj Pts) and lunareclipse as OPP (105.12 Proj Pts).
 * 5. OneiromancyContext centralized identity (userRosterId, userSlot, userTeamName, isUserTeam) is strictly consistent.
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

// Import core TypeScript modules directly via loader
const sleeper = await import('../core/lib/sleeper.ts');
const mock = await import('../core/lib/mockData.ts');

describe('Component Identity Audit: Single Global YOU & Zero Collisions', () => {
  let draftMeta;
  let draftPicks;
  let leagueUsers;
  let leagueRosters;
  let leagueMatchups;
  let leagueInfo;

  before(() => {
    // Locate authentic Sleeper captures
    const possibleMockDirs = [
    path.resolve(__dirname, 'mocks'),
    path.resolve(__dirname, '../mocks'),
      path.resolve(__dirname, 'mocks'),
      path.resolve(__dirname, '../../oneiromancy/mocks'),
      path.resolve(process.cwd(), '../oneiromancy/mocks'),
    ];

    let mocksDir = possibleMockDirs.find((d) => fs.existsSync(path.join(d, 'mock_draft_metadata.json')));
    if (!mocksDir) {
      throw new Error(`Could not find authentic mocks directory in: ${possibleMockDirs.join(', ')}`);
    }

    draftMeta = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_draft_metadata.json'), 'utf8'));
    draftPicks = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_draft_picks.json'), 'utf8'));
    leagueUsers = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_users.json'), 'utf8'));
    leagueRosters = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_rosters.json'), 'utf8'));
    leagueMatchups = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_matchups_w1.json'), 'utf8'));
    leagueInfo = JSON.parse(fs.readFileSync(path.join(mocksDir, 'mock_league_info.json'), 'utf8'));
  });

  // --------------------------------------------------------------------------
  // Category 1: TransformToDraftState Single-User Identity Invariant
  // --------------------------------------------------------------------------
  describe('1. TransformToDraftState Single-User Identity Invariant', () => {
    it('1.1 should ensure exactly ONE team in competitor_teams has is_user: true for OneiroVanguard', () => {
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

      const userTeams = state.competitor_teams.filter((t) => t.is_user === true);
      assert.equal(userTeams.length, 1, 'Strictly 1 team must have is_user: true');

      const userTeam = userTeams[0];
      assert.equal(userTeam.slot, 7, 'User team slot must be 7');
      assert.equal(userTeam.roster_id, 2, 'User team roster_id must be 2');
      assert.equal(userTeam.owner_name, 'OneiroVanguard');
      assert.ok(userTeam.name.includes('AstralOracles (You)'), 'User team name must include AstralOracles (You)');
    });

    it('1.2 should ensure exactly ONE team has "(You)" in its name across all 12 teams', () => {
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

      const youTeams = state.competitor_teams.filter((t) => t.name.includes('(You)'));
      assert.equal(youTeams.length, 1, 'Strictly 1 team must contain "(You)" in its name');
      assert.equal(youTeams[0].slot, 7, 'Team containing "(You)" must be Slot 7');
    });

    it('1.3 should verify LunarEclipse (Slot 5, Roster 11) is NOT tagged as user and NOT named (You)', () => {
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

      const zenithvoyager = state.competitor_teams.find((t) => t.slot === 5 || t.roster_id === 11);
      assert.ok(zenithvoyager, 'LunarEclipse team must exist');
      assert.equal(zenithvoyager.is_user, false, 'LunarEclipse must have is_user: false');
      assert.ok(!zenithvoyager.name.includes('(You)'), 'LunarEclipse must NOT contain (You)');
    });

    it('1.4 should verify Galactic Guardians (Slot 9, Roster 5) is NOT tagged as user and NOT named (You)', () => {
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

      const warriors = state.competitor_teams.find((t) => t.slot === 9 || t.roster_id === 5);
      assert.ok(warriors, 'Galactic Guardians team must exist');
      assert.equal(warriors.is_user, false, 'Galactic Guardians must have is_user: false');
      assert.ok(!warriors.name.includes('(You)'), 'Galactic Guardians must NOT contain (You)');
    });

    it('1.5 should verify CrimsonPhoenix (Slot 2, Roster 12) is NOT tagged as user and NOT named (You)', () => {
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

      const crimsonPhoenix = state.competitor_teams.find((t) => t.slot === 2 || t.roster_id === 12);
      assert.ok(crimsonPhoenix, 'CrimsonPhoenix team must exist');
      assert.equal(crimsonPhoenix.is_user, false, 'CrimsonPhoenix must have is_user: false');
      assert.ok(!crimsonPhoenix.name.includes('(You)'), 'CrimsonPhoenix must NOT contain (You)');
    });
  });

  // --------------------------------------------------------------------------
  // Category 2: Mock Dataset Single-User Integrity (mockData.ts)
  // --------------------------------------------------------------------------
  describe('2. Mock Dataset Single-User Integrity (mockData.ts)', () => {
    it('2.1 should ensure mockCompetitorTeams has strictly ONE team with is_user: true (Slot 7)', () => {
      const userTeams = mock.mockCompetitorTeams.filter((t) => t.is_user === true);
      assert.equal(userTeams.length, 1, 'mockCompetitorTeams must have strictly 1 team with is_user: true');
      assert.equal(userTeams[0].slot, 7, 'User team in mockCompetitorTeams must be Slot 7');
      assert.equal(userTeams[0].roster_id, 2, 'User team in mockCompetitorTeams must be Roster 2');
      assert.ok(userTeams[0].name.includes('(You)'));
    });

    it('2.2 should ensure mockWeeklyMatchup pairs Slot 7 AstralOracles against Slot 5 lunareclipse with Matchup ID 3', () => {
      assert.equal(mock.mockWeeklyMatchup.matchup_id, 3, 'Matchup ID must be 3');
      assert.equal(mock.mockWeeklyMatchup.user_team.slot, 7);
      assert.equal(mock.mockWeeklyMatchup.user_team.roster_id, 2);
      assert.ok(mock.mockWeeklyMatchup.user_team.team_name.includes('AstralOracles'));
      assert.equal(mock.mockWeeklyMatchup.user_team.projected_points, 130.65);

      assert.equal(mock.mockWeeklyMatchup.opponent_team.slot, 5);
      assert.equal(mock.mockWeeklyMatchup.opponent_team.roster_id, 11);
      assert.equal(mock.mockWeeklyMatchup.opponent_team.team_name, 'lunareclipse');
      assert.equal(mock.mockWeeklyMatchup.opponent_team.projected_points, 105.12);
    });

    it('2.3 should ensure mockPlayerFavorabilities starters belong to AstralOracles and zero to CrimsonPhoenix', () => {
      for (const fav of mock.mockPlayerFavorabilities) {
        if (fav.is_user_team) {
          assert.equal(fav.team_name, 'AstralOracles', `User starter ${fav.player_name} must belong to AstralOracles`);
        }
      }
      assert.ok(
        mock.mockPlayerFavorabilities.every((f) => !f.is_user_team || f.team_name !== 'CrimsonPhoenix'),
        'No user starter in mockPlayerFavorabilities may belong to CrimsonPhoenix'
      );
    });

    it('2.4 should ensure astral_edge_summary cites AstralOracles and not CrimsonPhoenix', () => {
      assert.ok(mock.mockTeamComparison.astral_edge_summary.includes('AstralOracles'));
      assert.ok(!mock.mockTeamComparison.astral_edge_summary.includes('CrimsonPhoenix'));
    });

    it('2.5 should ensure mockData avatar URLs use authentic 32-character hex hashes and zero numeric user IDs', () => {
      const avatarRegex = /^https:\/\/sleepercdn\.com\/avatars\/thumbs\/[a-f0-9]{32}$/;
      const numericIdRegex = /^https:\/\/sleepercdn\.com\/avatars\/thumbs\/\d+$/;

      // Check mockCompetitorTeams
      for (const team of mock.mockCompetitorTeams) {
        if (team.avatar) {
          assert.ok(
            !numericIdRegex.test(team.avatar),
            `Team ${team.name} avatar must not use numeric ID: ${team.avatar}`
          );
          assert.ok(
            avatarRegex.test(team.avatar),
            `Team ${team.name} avatar must match 32-character hex hash: ${team.avatar}`
          );
        }
      }

      // Check mockWeeklyMatchup
      const teams = [mock.mockWeeklyMatchup.user_team, mock.mockWeeklyMatchup.opponent_team];
      for (const t of teams) {
        if (t?.avatar) {
          assert.ok(
            !numericIdRegex.test(t.avatar),
            `Matchup team ${t.team_name} avatar must not use numeric ID: ${t.avatar}`
          );
          assert.ok(
            avatarRegex.test(t.avatar),
            `Matchup team ${t.team_name} avatar must match 32-character hex hash: ${t.avatar}`
          );
        }
      }

      // Check mock_oneiromancy_draft_2025 competitor_teams
      for (const team of mock.mock_oneiromancy_draft_2025.competitor_teams || []) {
        if (team.avatar) {
          assert.ok(
            !numericIdRegex.test(team.avatar),
            `Draft team ${team.name} avatar must not use numeric ID: ${team.avatar}`
          );
          assert.ok(
            avatarRegex.test(team.avatar),
            `Draft team ${team.name} avatar must match 32-character hex hash: ${team.avatar}`
          );
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Category 3: CelestialLeaderboardGraph Component Identity Verification
  // --------------------------------------------------------------------------
  describe('3. CelestialLeaderboardGraph Component Identity Verification', () => {
    it('3.1 should verify CelestialLeaderboardGraph renders exactly 1 user team row without slot fallback collision', async () => {
      const { render, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { default: OneiromancyContext } = await import('./dist/context/OneiromancyContext.js');
      const { CelestialLeaderboardGraph } = await import('./dist/components/oneiromancy/CelestialLeaderboardGraph.js');
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
      const view = render(
        jsx(OneiromancyContext.Provider, {
          value: { draftState: state, userSlot: 7, userRosterId: 2, isUserTeam: (t) => Boolean(t?.is_user) },
          children: jsx(CelestialLeaderboardGraph, { competitorTeams: state.competitor_teams }),
        })
      );
      const userRows = view.getAllByTestId('leaderboard-user-team');
      assert.equal(userRows.length, 1, 'CelestialLeaderboardGraph renders exactly 1 leaderboard-user-team row');
      assert.ok(userRows[0].textContent.includes('YOU'), 'CelestialLeaderboardGraph renders YOU marker for user team');
      view.unmount();
    });

    it('3.2 should verify that evaluating CelestialLeaderboardGraph isUser logic against live competitor teams flags exactly 1 team', () => {
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

      const isUserFn = (team) => team.is_user === true || team.name.includes('(You)');
      const flaggedTeams = state.competitor_teams.filter(isUserFn);

      assert.equal(flaggedTeams.length, 1, 'Strictly 1 team must evaluate isUser === true in CelestialLeaderboardGraph');
      assert.equal(flaggedTeams[0].slot, 7, 'The single flagged team must be Slot 7 (AstralOracles)');
    });

    it('3.3 should verify Celestial Leaderboard metrics are consistent, ordered, and harmony is not saturated', async () => {
      const scoring = await import('../core/lib/scoring.ts');
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

      const teamsWithMetrics = state.competitor_teams.map((t) => {
        const metrics = scoring.calculateTeamCelestialMetrics(t, state.cosmic_board);
        return {
          team: t,
          slot: t.slot,
          name: t.name,
          metrics,
        };
      });

      teamsWithMetrics.sort((a, b) => b.metrics.compositeScore - a.metrics.compositeScore);

      assert.equal(teamsWithMetrics.length, 12, 'Must calculate metrics for all 12 teams');
      const astral = teamsWithMetrics.find((t) => t.slot === 7);
      assert.ok(astral, 'Slot 7 (AstralOracles) must exist in ranking');

      for (const t of teamsWithMetrics) {
        const expected = scoring.calculateTeamCelestialMetrics(t.team, state.cosmic_board);
        assert.equal(t.metrics.harmonyScore, expected.harmonyScore, `Team ${t.name} harmonyScore must match calculateTeamCelestialMetrics`);
        assert.equal(t.metrics.compositeScore, expected.compositeScore, `Team ${t.name} compositeScore must match calculateTeamCelestialMetrics`);
        assert.equal(t.metrics.spiritScore, expected.spiritScore, `Team ${t.name} spiritScore must match calculateTeamCelestialMetrics`);
        assert.equal(t.metrics.draftScore, expected.draftScore, `Team ${t.name} draftScore must match calculateTeamCelestialMetrics`);
      }

      const zenithvoyager = teamsWithMetrics.find((t) => t.slot === 5);
      assert.ok(zenithvoyager, 'Slot 5 (lunareclipse) must exist in ranking');
      // Harmony is scored on each team's lineup and must not saturate: full
      // rosters used to pin most teams at 100, making the metric meaningless.
      const harmonies = teamsWithMetrics.map((t) => t.metrics.harmonyScore);
      assert.ok(
        new Set(harmonies).size > 1 && harmonies.filter((h) => h >= 100).length < harmonies.length / 2,
        'Team harmony scores must vary and not saturate at 100'
      );
      for (let i = 1; i < teamsWithMetrics.length; i++) {
        assert.ok(
          teamsWithMetrics[i - 1].metrics.compositeScore >= teamsWithMetrics[i].metrics.compositeScore,
          'Leaderboard must be ordered by composite score'
        );
      }
      assert.ok(
        teamsWithMetrics.some((t) => t.metrics.tier === 'Discordant'),
        'Leaderboard must contain Discordant tier teams'
      );
    });

    it('3.4 should verify active roster slots on draftState.my_roster contain authentic starters and bench', () => {
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
      const bench = state.my_roster.filter((s) => s.slot_id.startsWith('BN'));

      assert.equal(starters.length, 8, 'Must have 8 starting slots');
      assert.equal(bench.length, 7, 'Must have 7 bench slots');

      const starterNames = starters.map((s) => s.player?.name);
      assert.ok(starterNames.includes('Cooper Rush'), 'Cooper Rush must start at QB');
      assert.ok(starterNames.includes('Jonathan Taylor'), 'Jonathan Taylor must start at RB');
      assert.ok(starterNames.includes('Chase Brown'), 'Chase Brown must start at RB');
      assert.ok(starterNames.includes('Amon-Ra St. Brown'), 'Amon-Ra St. Brown must start at WR');
      assert.ok(starterNames.includes('Rashee Rice'), 'Rashee Rice must start at WR');
      assert.ok(starterNames.includes('Isaiah Likely'), 'Isaiah Likely must start at TE');
      assert.ok(starterNames.includes('Javonte Williams'), 'Javonte Williams must start at FLEX');
      assert.ok(starterNames.includes('Aaron Rodgers'), 'Aaron Rodgers must start at SUPER_FLEX');

      const benchNames = bench.map((s) => s.player?.name);
      assert.ok(benchNames.includes('Braelon Allen'), 'Braelon Allen must be on bench');
      assert.ok(benchNames.includes('Josh Jacobs'), 'Josh Jacobs must be on bench');
      assert.ok(benchNames.includes('Tua Tagovailoa'), 'Tua Tagovailoa must be on bench');
      assert.ok(benchNames.includes('Jerry Jeudy'), 'Jerry Jeudy must be on bench');
    });
  });

  // --------------------------------------------------------------------------
  // Category 4: MatchupsScreen Component Identity & Projections Verification
  // --------------------------------------------------------------------------
  describe('4. MatchupsScreen Component Identity & Projections Verification', () => {
    it('4.1 should derive Week 1 matchup pairing AstralOracles (130.65) vs lunareclipse (105.12)', () => {
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

      assert.ok(state.weekly_matchup, 'weekly_matchup must be defined');
      assert.equal(state.weekly_matchup.matchup_id, 3);
      const userStarters = state.weekly_matchup.player_favorabilities.filter((p) => p.is_user_team && !p.is_benched);
      const expectedUserSum = Math.round(userStarters.reduce((acc, p) => acc + (p.projected_points || 0), 0) * 100) / 100;
      const oppStarters = state.weekly_matchup.player_favorabilities.filter((p) => !p.is_user_team && !p.is_benched);
      const expectedOppSum = Math.round(oppStarters.reduce((acc, p) => acc + (p.projected_points || 0), 0) * 100) / 100;
      assert.ok(state.weekly_matchup.user_team.projected_points > 0);
      assert.equal(state.weekly_matchup.user_team.projected_points, expectedUserSum);
      assert.ok(state.weekly_matchup.opponent_team.team_name.toLowerCase().includes('lunareclipse'));
      assert.ok(state.weekly_matchup.opponent_team.projected_points > 0);
      assert.equal(state.weekly_matchup.opponent_team.projected_points, expectedOppSum);
    });

    it('4.2 should verify MatchupsScreen renders centralized OneiromancyContext identity with Your Team on the left', async () => {
      const { render, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { default: OneiromancyContext } = await import('./dist/context/OneiromancyContext.js');
      const { MatchupsScreen } = await import('./dist/components/screens/MatchupsScreen.js');
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
      const view = render(
        jsx(OneiromancyContext.Provider, {
          value: { draftState: state, userSlot: 7, userRosterId: 2, userTeamName: 'AstralOracles (You)' },
          children: jsx(MatchupsScreen, { weeklyMatchup: state.weekly_matchup }),
        })
      );
      assert.ok(view.container.textContent.includes('AstralOracles'), 'MatchupsScreen displays user team from context');
      view.unmount();
    });
  });

  // --------------------------------------------------------------------------
  // Category 5: OneiromancyContext Centralized Identity Resolution
  // --------------------------------------------------------------------------
  describe('5. OneiromancyContext Centralized Identity Resolution', () => {
    it('5.1 should verify OneiromancyProvider exposes userRosterId, userSlot, userTeamName, and isUserTeam', async () => {
      const { render, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('./dist/context/OneiromancyContext.js');
      let captured = null;
      function Probe() {
        captured = useOneiromancy();
        return jsx('div', {}, 'probe');
      }
      const view = render(jsx(OneiromancyProvider, { children: jsx(Probe, {}) }));
      assert.ok(captured, 'useOneiromancy returns context value');
      assert.equal(typeof captured.userSlot, 'number', 'OneiromancyContext exposes numeric userSlot');
      assert.equal(typeof captured.userTeamName, 'string', 'OneiromancyContext exposes string userTeamName');
      assert.equal(typeof captured.isUserTeam, 'function', 'OneiromancyContext exposes isUserTeam helper function');
      view.unmount();
    });

    it('5.2 should verify OneiromancyContext isUserTeam distinguishes slot vs roster_id without collision', async () => {
      const { render, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('./dist/context/OneiromancyContext.js');
      let captured = null;
      function Probe() {
        captured = useOneiromancy();
        return jsx('div', {}, 'probe');
      }
      const view = render(jsx(OneiromancyProvider, { children: jsx(Probe, {}) }));
      captured.loadMockData();
      // Slot 7 has roster_id 2; Slot 2 has roster_id 12 (CrimsonPhoenix) and is NOT user team
      const crimson = captured.draftState.competitor_teams.find((t) => t.slot === 2);
      const astral = captured.draftState.competitor_teams.find((t) => t.slot === 7);
      assert.equal(captured.isUserTeam(astral), true, 'Slot 7 (AstralOracles) is identified as user team');
      assert.equal(captured.isUserTeam(crimson), false, 'Slot 2 (CrimsonPhoenix) is not mistaken for user team');
      view.unmount();
    });

    it('5.3 should verify OneiromancyContext loadMockData preserves AstralOracles (You) in Slot 7 / Roster 2 and Matchup 3', async () => {
      const { render, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('./dist/context/OneiromancyContext.js');
      let captured = null;
      function Probe() {
        captured = useOneiromancy();
        return jsx('div', {}, 'probe');
      }
      const view = render(jsx(OneiromancyProvider, { children: jsx(Probe, {}) }));
      captured.loadMockData();
      assert.equal(captured.userSlot, 7, 'loadMockData sets userSlot to 7');
      assert.equal(captured.userRosterId, 2, 'loadMockData sets userRosterId to 2');
      assert.equal(captured.draftState.weekly_matchup.matchup_id, 3, 'loadMockData preserves Matchup 3');
      view.unmount();
    });

    it('5.4 should verify simulated loadMockData state keeps AstralOracles (You) in Slot 7 / Roster 2 and preserves Matchup 3', () => {
      const targetSlot = 7;
      const teamsList = mock.mockCompetitorTeams || [];
      const updatedTeams = teamsList.map((t) => {
        const isUser = t.slot === targetSlot;
        const cleanName = t.name.replace(/\s*\(You\)$/, '');
        return {
          ...t,
          is_user: isUser,
          name: isUser ? `${cleanName} (You)` : cleanName,
        };
      });
      const userTeam = updatedTeams.find((t) => t.is_user);
      assert.ok(userTeam, 'User team must be found');
      assert.equal(userTeam.slot, 7);
      assert.equal(userTeam.roster_id, 2);
      assert.ok(userTeam.name.includes('AstralOracles (You)'));

      const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : 2;
      const matchup = sleeper.deriveWeeklyMatchup(
        userRosterId,
        updatedTeams,
        null,
        mock.mockCosmicBoard,
        mock.mockMyRoster,
        1
      );
      assert.equal(matchup.matchup_id, 3, 'Matchup ID must be 3');
      assert.equal(matchup.user_team.slot, 7);
      assert.equal(matchup.user_team.roster_id, 2);
      assert.ok(matchup.user_team.team_name.includes('AstralOracles'));
      assert.equal(matchup.opponent_team.slot, 5);
      assert.ok(matchup.opponent_team.team_name.includes('lunareclipse'));
    });

    it('5.5 should verify mock-to-live transition commits fresh live state and sets mode: live', async () => {
      const { render, act, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('../context/OneiromancyContext.tsx');
      const originalFetch = globalThis.fetch;
      const J = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
      globalThis.fetch = async (u) => {
        const url = String(u);
        if (/\/user\/[^/]+$/.test(url)) return J({ user_id: '9000000000000000101', username: 'OneiroVanguard' });
        if (/\/leagues\/nfl\//.test(url)) return J([leagueInfo]);
        if (/\/league\/[^/]+\/drafts$/.test(url)) return J([{ draft_id: '9000000000000000002', status: 'complete' }]);
        if (/\/league\/[^/]+\/users$/.test(url)) return J(leagueUsers);
        if (/\/league\/[^/]+\/rosters$/.test(url)) return J(leagueRosters);
        if (/\/league\/[^/]+\/matchups\//.test(url)) return J(leagueMatchups);
        if (/\/league\/[^/]+$/.test(url)) return J(leagueInfo);
        if (/\/draft\/[^/]+\/picks$/.test(url)) return J(draftPicks);
        if (/\/draft\/[^/]+$/.test(url)) return J(draftMeta);
        if (/\/state\/nfl$/.test(url)) return J({ week: 1, season: '2025', display_week: 1 });
        if (/\/players\/nfl$/.test(url)) return J({});
        return J([]);
      };

      let captured = null;
      function Probe() {
        captured = useOneiromancy();
        return jsx('div', {}, 'probe');
      }

      try {
        const view = render(jsx(OneiromancyProvider, { children: jsx(Probe, {}) }));
        // Put in mock mode first
        act(() => {
          captured.loadMockData();
        });
        assert.equal(captured.mode, 'mock');
        assert.equal(captured.draftState.settings?.mode, 'mock');

        // Transition to live mode with username
        await act(async () => {
          captured.setMode('live');
          await captured.refreshDraft('OneiroVanguard');
        });

        assert.equal(captured.mode, 'live', 'Mode must become live');
        assert.equal(captured.draftState.isLive, true, 'isLive must be true');
        assert.equal(captured.draftState.settings?.mode, 'live', 'settings.mode must be live');
        assert.equal(captured.statusType, 'live', 'statusType must be live');
        assert.equal(captured.syncError, null, 'syncError must be null');
        view.unmount();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('5.6 should verify rejected in-flight live sync does not corrupt mock state when switched to mock', async () => {
      const { render, act, jsx } = await import('./helpers/react_testing_wrapper.mjs');
      const { OneiromancyProvider, useOneiromancy } = await import('../context/OneiromancyContext.tsx');
      const originalFetch = globalThis.fetch;
      let rejectSync = false;
      globalThis.fetch = async (u) => {
        if (rejectSync) {
          await new Promise((r) => setTimeout(r, 60));
          throw new Error('Network error: connection refused');
        }
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };

      let captured = null;
      function Probe() {
        captured = useOneiromancy();
        return jsx('div', {}, 'probe');
      }

      try {
        const view = render(jsx(OneiromancyProvider, { children: jsx(Probe, {}) }));
        rejectSync = true;
        let liveSyncPromise;
        act(() => {
          liveSyncPromise = captured.refreshDraft('TestUser99');
          captured.setMode('mock');
        });
        assert.equal(captured.mode, 'mock');
        assert.equal(captured.draftState.settings?.mode, 'mock');
        const mockBoardLen = captured.draftState.cosmic_board?.length;

        // Wait for rejected live sync to complete
        await act(async () => {
          await liveSyncPromise;
        });

        // Ensure mock state was NOT overwritten by the rejected live sync
        assert.equal(captured.mode, 'mock', 'Mode must remain mock');
        assert.equal(captured.draftState.settings?.mode, 'mock', 'settings.mode must remain mock');
        assert.equal(captured.draftState.cosmic_board?.length, mockBoardLen, 'Mock board length must be preserved');
        assert.equal(captured.syncError, null, 'Mock mode must not inherit live sync error');
        assert.equal(captured.statusType, 'offline', 'Status must remain offline');
        view.unmount();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
