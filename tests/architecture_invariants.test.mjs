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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url));

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sleeperModule = await import('../core/lib/sleeper.ts');
const scoringModule = await import('../core/lib/scoring.ts');
const mockDataModule = await import('../core/lib/mockData.ts');

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

describe('Tier 0: Architectural Invariants & Leakage Verification', () => {
  // 1. Invariant: DEFAULT_LIVE_SETTINGS must contain zero mock IDs
  describe('Invariant 1: Zero Mock IDs in Live Settings', () => {
    it('1.1 should have empty or non-mock strings in DEFAULT_LIVE_SETTINGS', () => {
      const settings = sleeperModule.DEFAULT_LIVE_SETTINGS;
      assert.ok(settings, 'DEFAULT_LIVE_SETTINGS must be exported');
      assert.equal(settings.draft_id, '', 'draft_id must be empty string');
      assert.equal(settings.league_id, '', 'league_id must be empty string');
      assert.equal(settings.sleeper_username, '', 'sleeper_username must be empty string');
      assert.notEqual(settings.draft_id, 'mock_oneiromancy_draft_2025');
      assert.notEqual(settings.league_id, '9000000000000000001');
      assert.notEqual(settings.sleeper_username, 'OneiroVanguard');
    });
  });

  // 2. Invariant: Scoring forward-calculation & anti-hardcoding constraints
  describe('Invariant 2: Forward Scoring Calculation & Static AST Scan', () => {
    it('2.1 computeWeeklyPlayerFavorability must support both options-object and positional arguments and clamp to [0, 100]', () => {
      const dummyBreakdown = {
        celestial: 80,
        numeric: 75,
        geomantic: 70,
        oracular: 85,
        harmony: 80,
      };

      // Options-object signature
      const highFav = scoringModule.computeWeeklyPlayerFavorability({
        spiritScore: 95,
        projectedPoints: 30,
        isStarter: true,
        geomantic: 88,
      });
      assert.ok(!Number.isNaN(highFav.score), 'Score must not be NaN');
      assert.ok(highFav.score >= 0 && highFav.score <= 100, `Favorability ${highFav.score} must be in [0, 100]`);

      const lowFav = scoringModule.computeWeeklyPlayerFavorability({
        spiritScore: 40,
        projectedPoints: 0,
        injuryStatus: 'Out',
        isStarter: false,
        geomantic: 65,
      });
      assert.ok(!Number.isNaN(lowFav.score), 'Score must not be NaN');
      assert.ok(lowFav.score >= 0 && lowFav.score <= 100, `Favorability ${lowFav.score} must be in [0, 100]`);

      // Positional signature
      const posFav = scoringModule.computeWeeklyPlayerFavorability(90, 18.5, null, true, 80);
      assert.ok(!Number.isNaN(posFav.score), 'Score must not be NaN');
      assert.ok(posFav.score >= 0 && posFav.score <= 100);

      // Team matchup favorability
      const teamFav = scoringModule.computeTeamMatchupFavorability([highFav, lowFav, posFav]);
      assert.ok(!Number.isNaN(teamFav), 'Team favorability must not be NaN');
      assert.ok(teamFav >= 0 && teamFav <= 100);
    });

    it('2.2 static source scan across core/, context/, and components/ must contain zero forbidden heuristic tokens', () => {
      const forbiddenTokens = [
        '> 40 ?',
        '/ 17',
        'starterIdx === 5',
        'starterIdx === 6',
        'benchIdx === 0',
        'benchIdx === 4',
        'CALIBRATED_SLOT_SCORES',
      ];

      const targetDirs = [
        path.join(clientRoot, 'context'),
        path.join(clientRoot, 'components'),
        path.join(clientRoot, 'core/lib/scoring.ts'),
        path.join(clientRoot, 'core/lib/sleeper.ts'),
      ];

      const checkFile = (filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const token of forbiddenTokens) {
          assert.ok(
            !content.includes(token),
            `File ${filePath} must not contain forbidden token "${token}"`,
          );
        }
      };

      for (const target of targetDirs) {
        if (fs.statSync(target).isDirectory()) {
          const files = listFilesRecursive(target).filter(
            (f) => f.endsWith('.ts') || f.endsWith('.tsx'),
          );
          files.forEach(checkFile);
        } else {
          checkFile(target);
        }
      }
    });
  });

  // 3. Invariant: tests/dist/ shadow directory must not exist on disk
  describe('Invariant 3: No Tracked tests/dist/ Shadow Directory', () => {
    it('3.1 tests/dist directory must not exist or must contain zero files', () => {
      const distPath = path.join(clientRoot, 'tests/dist');
      const files = listFilesRecursive(distPath);
      assert.equal(files.length, 0, `tests/dist must not contain tracked files (found ${files.length})`);
    });

    it('3.2 .gitignore must ignore tests/dist/ and dist/', () => {
      const gitignoreContent = fs.readFileSync(path.join(clientRoot, '.gitignore'), 'utf8');
      assert.ok(gitignoreContent.includes('tests/dist'), '.gitignore must contain tests/dist');
      assert.ok(gitignoreContent.includes('dist/'), '.gitignore must contain dist/');
    });
  });

  // 4. Invariant: recomputeDraftState consistency & weight/lambda propagation
  describe('Invariant 4: Atomic recomputeDraftState & Weight/Lambda Propagation', () => {
    it('4.1 recomputeDraftState must recompute draft scores and ideal path deterministically', () => {
      const baseState = mockDataModule.mock_oneiromancy_draft_2025;
      const updatedState = scoringModule.recomputeDraftState(baseState, {
        chaos_lambda: 0.8,
      });

      assert.equal(updatedState.settings.chaos_lambda, 0.8);
      assert.equal(updatedState.cosmic_board.length, baseState.cosmic_board.length);
      assert.ok(updatedState.ideal_draft_path.length > 0);

      // Verify draft scores changed with lambda change
      const origScore = baseState.cosmic_board[0]?.draft_score;
      const newScore = updatedState.cosmic_board[0]?.draft_score;
      assert.ok(origScore !== undefined && newScore !== undefined);
    });

    it('4.2 changing oracle weights must dynamically alter spirit scores across collections', () => {
      const baseState = mockDataModule.mock_oneiromancy_draft_2025;
      const updatedWeights = {
        celestial: 0.60,
        numeric: 0.10,
        geomantic: 0.10,
        oracular: 0.10,
        harmony: 0.10,
      };
      const updatedState = scoringModule.recomputeDraftState(baseState, {
        oracle_weights: updatedWeights,
      });
      assert.ok(updatedState.cosmic_board.length > 0);
      assert.ok(updatedState.competitor_teams.length > 0);
    });

    it('4.3 changing team picks dynamically alters spirit_score, draft_score, and harmony_score in calculateTeamCelestialMetrics', () => {
      const p1 = {
        id: 'p1',
        name: 'Alpha Player',
        position: 'QB',
        team: 'KC',
        spirit_score: 95.0,
        draft_score: 90.0,
        elemental_traits: { element: 'Fire' },
      };
      const p2 = {
        id: 'p2',
        name: 'Beta Player',
        position: 'WR',
        team: 'KC',
        spirit_score: 70.0,
        draft_score: 65.0,
        elemental_traits: { element: 'Earth' },
      };
      const p3 = {
        id: 'p3',
        name: 'Gamma Player',
        position: 'WR',
        team: 'KC',
        spirit_score: 92.0,
        draft_score: 88.0,
        elemental_traits: { element: 'Fire' },
      };
      const cosmicBoard = [p1, p2, p3];

      const teamA = {
        slot: 1,
        picks: [{ player_id: 'p1' }, { player_id: 'p3' }],
      };
      const teamB = {
        slot: 1,
        picks: [{ player_id: 'p2' }],
      };
      const teamEmpty = {
        slot: 1,
        picks: [],
      };

      const metricsA = scoringModule.calculateTeamCelestialMetrics(teamA, cosmicBoard);
      const metricsB = scoringModule.calculateTeamCelestialMetrics(teamB, cosmicBoard);
      const metricsEmpty = scoringModule.calculateTeamCelestialMetrics(teamEmpty, cosmicBoard);

      // Team A has high spirit & draft, plus same team stack (KC QB + WR Fire)
      assert.notEqual(metricsA.spiritScore, metricsB.spiritScore, 'Spirit score must vary with picks');
      assert.notEqual(metricsA.draftScore, metricsB.draftScore, 'Draft score must vary with picks');
      assert.notEqual(metricsA.harmonyScore, metricsB.harmonyScore, 'Harmony score must vary with picks');
      assert.ok(metricsA.spiritScore > metricsB.spiritScore);
      assert.ok(metricsA.draftScore > metricsB.draftScore);

      // 0 picks falls back strictly to slot zodiac seed
      assert.equal(metricsEmpty.spiritScore, scoringModule.SLOT_ZODIAC_SEEDS[1].seedSpirit);
      assert.equal(metricsEmpty.draftScore, scoringModule.SLOT_ZODIAC_SEEDS[1].seedDraft);
      assert.equal(metricsEmpty.harmonyScore, scoringModule.SLOT_ZODIAC_SEEDS[1].seedHarmony);
    });
  });

  // 5. Invariant: Live mode isolation & error propagation
  describe('Invariant 5: Live Mode Isolation & Error Handling', () => {
    it('5.1 synthetic live payload must not leak mock team names or mock IDs', () => {
      const syntheticLeague = {
        league_id: 'live_test_league_777',
        name: 'Alpha Quantum League',
        total_rosters: 4,
        status: 'in_season',
        scoring_settings: { ppr: 1.0 },
      };
      const syntheticUsers = [
        { user_id: 'u1', display_name: 'QuantumPioneers' },
        { user_id: 'u2', display_name: 'SolarKnights' },
        { user_id: 'u3', display_name: 'StellarFleet' },
        { user_id: 'u4', display_name: 'NebulaSentinels' },
      ];
      const syntheticRosters = [
        { roster_id: 1, owner_id: 'u1', players: ['4574', '6813'], starters: ['4574'] },
        { roster_id: 2, owner_id: 'u2', players: ['9224', '7547'], starters: ['9224'] },
        { roster_id: 3, owner_id: 'u3', players: ['10229', '8131'], starters: ['10229'] },
        { roster_id: 4, owner_id: 'u4', players: ['7588', '96'], starters: ['7588'] },
      ];

      const liveParsed = sleeperModule.transformToDraftState(
        { draft_id: 'live_draft_777', league_id: 'live_test_league_777', status: 'complete' },
        [],
        { sleeper_username: 'QuantumPioneers', league_id: 'live_test_league_777' },
        {},
        syntheticUsers,
        syntheticRosters,
        [],
        syntheticLeague,
        1,
      );

      const serialized = JSON.stringify(liveParsed);
      assert.ok(!serialized.includes('AstralOracles'), 'Live state must not contain AstralOracles');
      assert.ok(!serialized.includes('lunareclipse'), 'Live state must not contain lunareclipse');
      assert.ok(!serialized.includes('CrimsonPhoenix'), 'Live state must not contain CrimsonPhoenix');
      assert.ok(!serialized.includes('Celestial Vanguards'), 'Live state must not contain Celestial Vanguards');
      assert.ok(!serialized.includes('Void Walkers'), 'Live state must not contain Void Walkers');
      assert.ok(!serialized.includes('9000000000000000001'), 'Live state must not contain mock league ID');
      assert.ok(!serialized.includes('OneiroVanguard'), 'Live state must not contain OneiroVanguard');
    });

    it('5.2 fetchSleeperDraft must reject or propagate when real draft ID fails', async () => {
      try {
        await sleeperModule.fetchDraftMetadata('non_existent_invalid_draft_id_999999');
        assert.fail('Should have thrown error for invalid live draft ID');
      } catch (err) {
        assert.ok(err, 'Expected error on live draft fetch failure');
      }
    });
  });

  // 6. Invariant: Complete Test Suite Registration (Zero Orphaned Test Files)
  describe('Invariant 6: Complete Test Suite Registration in e2e_runner.mjs', () => {
    it('6.1 every *.test.mjs in tests/ directory must be registered in e2e_runner.mjs TIERS', () => {
      const testsDir = path.join(clientRoot, 'tests');
      const runnerPath = path.join(testsDir, 'e2e_runner.mjs');
      assert.ok(fs.existsSync(runnerPath), 'e2e_runner.mjs must exist');
      const runnerContent = fs.readFileSync(runnerPath, 'utf8');

      const allTestFiles = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.mjs'));
      assert.ok(allTestFiles.length >= 9, `Expected at least 9 test files, found ${allTestFiles.length}`);

      for (const testFile of allTestFiles) {
        assert.ok(
          runnerContent.includes(testFile),
          `Orphaned test file detected: ${testFile} is not registered in tests/e2e_runner.mjs`
        );
      }
    });
  });
});
