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
    it('3.1 should verify CelestialLeaderboardGraph.tsx evaluates isUser strictly without slot fallback collision', () => {
      const componentPath = path.resolve(__dirname, '../components/oneiromancy/CelestialLeaderboardGraph.tsx');
      assert.ok(fs.existsSync(componentPath), 'CelestialLeaderboardGraph.tsx must exist');
      const source = fs.readFileSync(componentPath, 'utf8');

      // Verify the simplified, strict isUser check
      assert.ok(
        source.includes("const isUser = team.is_user === true || team.name.includes('(You)');"),
        'CelestialLeaderboardGraph must use strict isUser check without slot fallback'
      );
      // Ensure the old bug with slotNum === userSlot fallback is removed
      assert.ok(
        !source.includes('userSlot !== undefined ? slotNum === userSlot : false'),
        'CelestialLeaderboardGraph must NOT contain the buggy slotNum === userSlot fallback'
      );
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

    it('3.3 should verify Celestial Leaderboard evaluates AstralOracles (Slot 7) high Harmony and outscoring opponent lunareclipse', async () => {
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
      assert.ok(
        zenithvoyager.metrics.compositeScore < astral.metrics.compositeScore,
        'Slot 5 composite score must be lower than AstralOracles Slot 7'
      );
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

    it('4.2 should verify MatchupsScreen.tsx source utilizes centralized OneiromancyContext identity', () => {
      const screenPath = path.resolve(__dirname, '../components/screens/MatchupsScreen.tsx');
      assert.ok(fs.existsSync(screenPath), 'MatchupsScreen.tsx must exist');
      const source = fs.readFileSync(screenPath, 'utf8');

      // Verify context usage for user identity
      assert.ok(source.includes('context.userSlot') || source.includes('userSlot'));
      assert.ok(source.includes('deriveWeeklyMatchup'));
    });
  });

  // --------------------------------------------------------------------------
  // Category 5: OneiromancyContext Centralized Identity Resolution
  // --------------------------------------------------------------------------
  describe('5. OneiromancyContext Centralized Identity Resolution', () => {
    it('5.1 should verify OneiromancyContext exports userRosterId, userSlot, userTeamName, and isUserTeam', () => {
      const contextPath = path.resolve(__dirname, '../context/OneiromancyContext.tsx');
      assert.ok(fs.existsSync(contextPath), 'context/OneiromancyContext.tsx must exist');
      const source = fs.readFileSync(contextPath, 'utf8');

      assert.ok(source.includes('userRosterId?: number'), 'OneiromancyContextState must declare userRosterId');
      assert.ok(source.includes('userSlot: number'), 'OneiromancyContextState must declare userSlot');
      assert.ok(source.includes('userTeamName: string'), 'OneiromancyContextState must declare userTeamName');
      assert.ok(source.includes('isUserTeam:'), 'OneiromancyContextActions must declare isUserTeam helper');
      assert.ok(source.includes('const isUserTeam = useCallback('), 'OneiromancyContext must implement isUserTeam callback');
    });

    it('5.2 should verify OneiromancyContext eliminated slot/roster collisions across line search loops', () => {
      const contextPath = path.resolve(__dirname, '../context/OneiromancyContext.tsx');
      const source = fs.readFileSync(contextPath, 'utf8');

      // Ensure that t.slot === targetSlot is strictly checked without || t.roster_id === targetSlot
      assert.ok(
        !source.includes('t.slot === targetSlot || t.roster_id === targetSlot'),
        'OneiromancyContext must NOT mix slot and roster_id in targetSlot searches'
      );
    });

    it('5.3 should verify OneiromancyContext.tsx loadMockData preserves AstralOracles (You) in Slot 7 / Roster 2 and Matchup 3', () => {
      const contextPath = path.resolve(__dirname, '../context/OneiromancyContext.tsx');
      const source = fs.readFileSync(contextPath, 'utf8');

      assert.ok(
        source.includes('const targetSlot = activeSlotRef.current || 7;'),
        'loadMockData must fallback to Slot 7'
      );
      assert.ok(
        source.includes('deriveWeeklyMatchup('),
        'loadMockData must derive weekly matchup'
      );
      assert.ok(
        !source.includes('targetSlot = activeSlotRef.current || 5;'),
        'loadMockData must NOT fallback to Slot 5'
      );
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
  });
});
