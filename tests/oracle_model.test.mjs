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
 * Tier 10: Oracle model and recommendations (core/lib/oracle.ts).
 *
 * Covers the scoring model introduced in the 2026-10-10 UX rework
 * (Stats / Stars / Oracle), the empirical backtest defaults, and the rules every
 * recommendation must follow (see changes/AGENT_UX_GUIDELINES.md).
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
const { render, screen, fireEvent, cleanup, jsx } = await import('./helpers/react_testing_wrapper.mjs');

const oracle = await import('../core/lib/oracle.ts');
const scoring = await import('../core/lib/scoring.ts');
const headshots = await import('../components/common/PlayerHeadshot.tsx');
const gameStatus = await import('../core/lib/gameStatus.ts');
const nflGames = await import('../core/lib/nflGames.ts');
const seasonContext = await import('../core/lib/seasonContext.ts');
const sleeper = await import('./dist/lib/sleeper.js');
const mockData = await import('./dist/lib/mockData.js');
const { default: OneiromancyContext } = await import('./dist/context/OneiromancyContext.js');
const { OraclePanel } = await import('./dist/components/oracle/OraclePanel.js');
const { NavigationShell } = await import('./dist/components/common/NavigationShell.js');
const { Astrolabe } = await import('./dist/components/astrolabe/Astrolabe.js');
const { SettingsDrawer } = await import('./dist/components/settings/SettingsDrawer.js');
const { WeeklyMoves } = await import('./dist/components/oneiromancy/WeeklyMoves.js');
const { TradesScreen } = await import('./dist/components/screens/TradesScreen.js');
const { PlayerMarketplace } = await import('./dist/components/screens/PlayerMarketplace.js');
const { OneiromancyDashboard } = await import('./dist/components/screens/OneiromancyDashboard.js');
const { MatchupsScreen } = await import('./dist/components/screens/MatchupsScreen.js');
const { CosmicBoard, comparePlayersForBoard } = await import('./dist/components/screens/CosmicBoard.js');
const { LeagueScreen } = await import('./dist/components/screens/LeagueScreen.js');

function buildMockCtx(overrides = {}) {
  return {
    draftState: {
      ...mockData.mock_oneiromancy_draft_2025,
      settings: {
        ...mockData.mockSettings,
        chaos_lambda: scoring.DEFAULT_CHAOS_LAMBDA,
        oracle_weights: { ...scoring.DEFAULT_ORACLE_WEIGHTS },
      },
      ...(overrides.draftState || {}),
    },
    isLoading: false,
    error: null,
    isAutoUpdate: false,
    isOfflineFallback: false,
    lastUpdated: new Date('2026-10-10T12:00:00Z'),
    activeTab: 'oneiromancy',
    boardInitialFilter: undefined,
    setTab: () => {},
    openBoardWithFilter: () => {},
    openOraclePanel: () => {},
    draftPlayer: () => {},
    setChaosLambda: () => {},
    updateChaosLambda: () => {},
    setOracleWeights: () => {},
    updateOracleWeights: () => {},
    selectPlayer: () => {},
    toggleAutoUpdate: () => {},
    setPollInterval: () => {},
    connectDraftId: async () => {},
    connectLeagueId: async () => {},
    connectSleeperUsername: async () => {},
    loadMockData: () => {},
    refreshDraft: async () => {},
    ...overrides,
  };
}

// --- fixtures -------------------------------------------------------------

let nextId = 1000;
function player(name, position, pts, spirit, extra = {}) {
  return {
    id: String(nextId++),
    name,
    position,
    team: 'DET',
    bye_week: 9,
    sleeper_projected_points: pts,
    spirit_score: spirit,
    harmony_score: 75,
    market_vor: 0,
    vor_normalized: 50,
    draft_status: 'my_team',
    elemental_traits: { element: 'Fire', sun_sign: 'Aries' },
    ...extra,
  };
}
function slot(slot_id, eligible, p) {
  return { slot_id, slot_name: slot_id, position: eligible[0], eligible_positions: eligible, player: p, is_locked: false };
}

// --- tests ------------------------------------------------------------------

describe('Tier 10: Oracle model and recommendations', () => {
  describe('10.1 Empirical backtest defaults', () => {
    it('10.1.1 default λ is the default 0.75 and star weights are 10/10/25/10/45', () => {
      assert.equal(scoring.DEFAULT_CHAOS_LAMBDA, 0.75);
      assert.deepEqual(scoring.DEFAULT_ORACLE_WEIGHTS, {
        celestial: 0.1,
        numeric: 0.1,
        geomantic: 0.25,
        oracular: 0.1,
        harmony: 0.45,
      });
    });

    it('10.1.2 UI and lib modules default to DEFAULT_CHAOS_LAMBDA (0.75) when lambda is omitted', () => {
      const testPlayer = player('Default Lambda Check', 'WR', 20, 90);
      const [recomputedWithDefault] = scoring.recomputeDraftScores([testPlayer], {});
      const [recomputedExplicit] = scoring.recomputeDraftScores([testPlayer], { chaos_lambda: scoring.DEFAULT_CHAOS_LAMBDA });
      assert.equal(recomputedWithDefault.draft_score, recomputedExplicit.draft_score);

      const { getByTestId, unmount } = render(jsx(Astrolabe, {}));
      const astrolabeEl = getByTestId('astrolabe');
      assert.ok(astrolabeEl.getAttribute('aria-label')?.includes('3.25'), 'Astrolabe defaults to DEFAULT_CHAOS_LAMBDA (0.75 -> 3.25x)');
      unmount();

      const ctx = buildMockCtx({
        draftState: {
          ...mockData.mock_oneiromancy_draft_2025,
          settings: { ...mockData.mockSettings, chaos_lambda: undefined },
        },
      });
      const drawer = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(SettingsDrawer, { isOpen: true, onClose: () => {} }),
        })
      );
      assert.ok(drawer.container.textContent.includes('Oneiromancy'), 'SettingsDrawer renders cleanly when chaos_lambda is omitted');
      drawer.unmount();
    });

    it('10.1.3 Oracle panel presets are symmetric around the default and include it', () => {
      const capturedLambdas = [];
      const ctx = buildMockCtx({
        updateChaosLambda: (val) => capturedLambdas.push(val),
      });
      const { getByTestId, unmount } = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }),
        })
      );
      const mostlyStatsPreset = getByTestId(`preset-${1 - scoring.DEFAULT_CHAOS_LAMBDA}`);
      const mostlyStarsPreset = getByTestId(`preset-${scoring.DEFAULT_CHAOS_LAMBDA}`);
      assert.ok(mostlyStatsPreset, 'Mostly stats preset (1 - DEFAULT_CHAOS_LAMBDA = 0.25) renders in DOM');
      assert.ok(mostlyStarsPreset, 'Mostly stars preset (DEFAULT_CHAOS_LAMBDA = 0.75) renders in DOM');
      fireEvent.click(mostlyStatsPreset);
      fireEvent.click(mostlyStarsPreset);
      assert.deepEqual(capturedLambdas, [1 - scoring.DEFAULT_CHAOS_LAMBDA, scoring.DEFAULT_CHAOS_LAMBDA]);
      unmount();
    });
  });

  describe('10.2 Stats, Stars and Oracle', () => {
    const p = player('Test Player', 'WR', 15, 80);

    it('10.2.1 Stats scales projected points so 25 pts = 100', () => {
      assert.equal(oracle.statsScore(player('a', 'WR', 25, 70)), 100);
      assert.equal(oracle.statsScore(player('b', 'WR', 12.5, 70)), 50);
      assert.equal(oracle.statsScore(player('c', 'WR', 40, 70)), 100, 'capped at 100');
    });

    it('10.2.2 Oracle is (1 − λ) × Stats + λ × Stars', () => {
      assert.equal(oracle.oracleScore(p, 0), Math.round(oracle.statsScore(p) * 10) / 10);
      assert.equal(oracle.oracleScore(p, 1), Math.round(oracle.starsScore(p) * 10) / 10);
      const mid = 0.25 * oracle.statsScore(p) + 0.75 * oracle.starsScore(p);
      assert.equal(oracle.oracleScore(p, 0.75), Math.round(mid * 10) / 10);
    });

    it('10.2.3 Stars responds to Spirit (and so to the star weights)', () => {
      const low = player('low', 'WR', 15, 60);
      const high = player('high', 'WR', 15, 95);
      assert.ok(oracle.starsScore(high) > oracle.starsScore(low));
    });

    it('10.2.4 one tone scale: ≥84 apex, 75-83 good, 65-74 neutral, <65 bad', () => {
      assert.equal(oracle.favorabilityTone(84), 'apex');
      // Tones classify the value as displayed (rounded), so 83.9 shows as 84 and is apex.
      assert.equal(oracle.favorabilityTone(83.9), 'apex');
      assert.equal(oracle.favorabilityTone(83.4), 'good');
      assert.equal(oracle.favorabilityTone(75), 'good');
      assert.equal(oracle.favorabilityTone(74.4), 'neutral');
      assert.equal(oracle.favorabilityTone(65), 'neutral');
      assert.equal(oracle.favorabilityTone(64.4), 'bad');
    });

    it('10.2.6 a player\'s Stars never depend on his lineup slot (no bench penalty)', () => {
      // Owner decision 2026-10-11: bench players are scored as starters everywhere.
      const benchGuy = player('Bench Guy', 'WR', 3, 70, { draft_status: 'available', divination_breakdown: { geomantic: 78 } });
      const [recomputed] = scoring.recomputeDraftScores([benchGuy], { chaos_lambda: 0.75 });
      assert.equal(recomputed.favorability_score, oracle.starsScore(benchGuy), 'board favorability equals Stars');

      const starterFav = scoring.computeWeeklyPlayerFavorability(recomputed.spirit_score, 3, null, true, 78);
      assert.equal(recomputed.favorability_score, starterFav.score, 'bench player Stars equals starter favorability');
    });

    it('10.2.5 injury codes are written out in plain English', () => {
      assert.equal(oracle.injuryStatusText('NA'), 'not active');
      assert.equal(oracle.injuryStatusText('IR'), 'on injured reserve');
      assert.equal(oracle.injuryStatusText('Sus'), 'suspended');
      assert.equal(oracle.injuryStatusText('Out'), 'out');
    });
  });

  describe('10.3 Lineup check', () => {
    it('10.3.1 recommends starting a better bench player and reports both sides', () => {
      const starter = player('Weak Starter', 'WR', 5, 60);
      const bench = player('Strong Bench', 'WR', 18, 85);
      const roster = [slot('WR', ['WR'], starter), slot('BN', ['WR', 'RB', 'TE', 'QB'], bench)];
      const swaps = oracle.computeLineupCheck(roster, 0.75);
      assert.equal(swaps.length, 1);
      assert.equal(swaps[0].playerIn.name, 'Strong Bench');
      assert.equal(swaps[0].playerOut.name, 'Weak Starter');
      assert.equal(swaps[0].statsFavor, 'in');
      assert.equal(swaps[0].starsFavor, 'in');
      assert.equal(swaps[0].flipLambda, null, 'no flip when stats and stars agree');
    });

    it('10.3.2 reports the λ at which stats and stars disagree', () => {
      const statsGuy = player('Stats Guy', 'WR', 22, 55); // big projection, poor stars
      const starsGuy = player('Stars Guy', 'WR', 8, 98); // small projection, great stars
      const roster = [slot('WR', ['WR'], statsGuy), slot('BN', ['WR'], starsGuy)];
      const swaps = oracle.computeLineupCheck(roster, 1);
      assert.equal(swaps.length, 1, 'stars-only should start the stars guy');
      assert.ok(swaps[0].flipLambda > 0 && swaps[0].flipLambda < 1, 'flip λ is inside (0, 1)');
      assert.equal(oracle.computeLineupCheck(roster, 0).length, 0, 'stats-only keeps the stats guy');
    });
  });

  describe('10.4 Waiver moves', () => {
    const base = () => {
      const qb = player('QB1', 'QB', 20, 80);
      const wr1 = player('WR1', 'WR', 15, 80);
      const wrBench = player('WR Bench', 'WR', 3, 60);
      const wrBench2 = player('WR Bench 2', 'WR', 4, 62);
      const roster = [
        slot('QB', ['QB'], qb),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'WR'], wrBench),
        slot('BN2', ['QB', 'WR'], wrBench2),
      ];
      return { qb, wr1, wrBench, wrBench2, roster };
    };

    it('10.4.1 only adds available, unrostered, healthy players and never drops a starter', () => {
      const { roster, qb, wr1 } = base();
      const fa = player('Free Agent', 'WR', 14, 82, { draft_status: 'available' });
      const injured = player('Injured FA', 'WR', 30, 99, { draft_status: 'available', injury_status: 'Out' });
      const owned = player('Owned Elsewhere', 'WR', 30, 99, { draft_status: 'drafted' });
      const moves = oracle.computeWaiverMoves([fa, injured, owned, qb, wr1], roster, 0.75, 5, 5);
      assert.ok(moves.length >= 1);
      for (const m of moves) {
        assert.equal(m.add.draft_status, 'available');
        assert.notEqual(m.add.name, 'Injured FA');
        assert.notEqual(m.drop.name, 'QB1');
        assert.notEqual(m.drop.name, 'WR1');
      }
    });

    it('10.4.2 never drops a player the lineup check says to start', () => {
      // Bench WR outranks the starting WR, so the lineup check promotes it.
      const starter = player('Fading Starter', 'WR', 4, 55);
      const rising = player('Rising Bench', 'WR', 16, 88);
      const filler = player('Filler', 'WR', 1, 50);
      const roster = [
        slot('WR', ['WR'], starter),
        slot('BN1', ['WR'], rising),
        slot('BN2', ['WR'], filler),
        slot('BN3', ['WR'], player('Depth', 'WR', 2, 52)),
      ];
      const fa = player('Waiver Star', 'WR', 17, 90, { draft_status: 'available' });
      const promoted = oracle.computeLineupCheck(roster, 0.75).map((s) => s.playerIn.name);
      assert.ok(promoted.includes('Rising Bench'));
      const moves = oracle.computeWaiverMoves([fa], roster, 0.75, 5, 5);
      for (const m of moves) assert.notEqual(m.drop.name, 'Rising Bench');
    });

    it('10.4.3 the limit applies after ranking, so "top move" is the same everywhere', () => {
      const { roster } = base();
      const fas = [
        player('Bench Upgrade', 'QB', 9, 70, { draft_status: 'available' }),
        player('Would Start', 'WR', 19, 90, { draft_status: 'available' }),
      ];
      const all = oracle.computeWaiverMoves(fas, roster, 0.75, 5, 5);
      const top = oracle.computeWaiverMoves(fas, roster, 0.75, 5, 1);
      assert.equal(top.length, 1);
      assert.equal(top[0].add.name, all[0].add.name);
      assert.ok(all[0].wouldStart, 'moves that would start rank first');
    });
  });

  describe('10.5 Trades and team ratings', () => {
    it('10.5.1 trade fit is judged by Oracle, and gains are in Oracle points', () => {
      // Both teams have spare depth at the position they give (depth = dedicated slots + 1).
      const myBenchRB = player('My Bench RB', 'RB', 15, 85);
      const myRBs = [player('My RB1', 'RB', 18, 85), player('My RB2', 'RB', 17, 85)];
      const myWR = player('My Weak WR', 'WR', 4, 60);
      const myWR2 = player('My WR2', 'WR', 3, 55);
      const theirRB = player('Their Weak RB', 'RB', 6, 60);
      const theirRB2 = player('Their RB2', 'RB', 5, 55);
      const theirBenchWR = player('Their Bench WR', 'WR', 16, 85);
      const theirWRs = [player('Their WR1', 'WR', 18, 85), player('Their WR2', 'WR', 17, 85)];
      const me = {
        roster_id: 1, slot: 1, name: 'Me (You)', is_user: true,
        players: [myBenchRB, ...myRBs, myWR, myWR2].map((x) => x.id),
        starters: [myRBs[0].id, myWR.id],
      };
      const them = {
        roster_id: 2, slot: 2, name: 'Them',
        players: [theirRB, theirRB2, theirBenchWR, ...theirWRs].map((x) => x.id),
        starters: [theirRB.id, theirWRs[0].id],
      };
      const roster = [
        slot('RB', ['RB'], myRBs[0]),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], myBenchRB),
        slot('BN2', ['RB', 'WR'], myRBs[1]),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];
      const board = [myBenchRB, ...myRBs, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];
      const [p] = oracle.computeTradePartners([me, them], board, roster, 0.75);
      assert.ok(p, 'a mutual-fit partner is found');
      assert.equal(p.give.player.name, 'My RB2', 'gives the best bench RB who would start for them');
      assert.equal(p.give.replaces.name, 'Their Weak RB');
      assert.equal(p.get.player.name, 'Their WR2');
      assert.equal(p.get.replaces.name, 'My Weak WR');
      const expected = oracle.oracleScore(p.give.player, 0.75) - oracle.oracleScore(theirRB, 0.75);
      assert.equal(p.give.gain, Math.round(expected * 10) / 10);
      assert.ok(p.summary.includes('Oracle'), 'the summary values players by Oracle, not points alone');
    });

    it('10.5.2 team ratings average the starters\' Oracle and sort high to low', () => {
      const a = player('A', 'WR', 20, 90);
      const b = player('B', 'WR', 5, 55);
      const teams = [
        { roster_id: 1, name: 'Low', starters: [b.id], players: [b.id] },
        { roster_id: 2, name: 'High', starters: [a.id], players: [a.id] },
      ];
      const r = oracle.computeTeamOracles(teams, [a, b], 0.75);
      assert.deepEqual(r.map((x) => x.team.name), ['High', 'Low']);
      assert.equal(r[0].oracle, oracle.oracleScore(a, 0.75));
    });
  });

  describe('10.6 Harmony and star weights', () => {
    it('10.6.1 the harmony breakdown adds up to the harmony score', () => {
      const lineup = [
        player('QB', 'QB', 20, 80, { team: 'NYG', elemental_traits: { element: 'Fire' } }),
        player('WR', 'WR', 10, 80, { team: 'NYG', elemental_traits: { element: 'Water' } }),
        player('RB', 'RB', 10, 80, { team: 'DAL', elemental_traits: { element: 'Earth' } }),
        player('TE', 'TE', 10, 80, { team: 'SF', elemental_traits: { element: 'Air' } }),
      ];
      const b = scoring.computeRosterHarmonyBreakdown(lineup);
      const sum = b.parts.reduce((s, x) => s + x.points, 0);
      assert.equal(b.total, Math.min(100, sum));
      assert.equal(scoring.computeRosterHarmony(lineup), b.total);
      assert.ok(b.parts.some((x) => x.label === 'QB stack'), 'NYG QB + WR is a stack');
      assert.ok(b.parts.some((x) => x.label === 'All 4 elements'));
    });

    it('10.6.2 changing a star weight changes Spirit; default weights leave it unchanged', () => {
      const breakdown = { celestial: 95, numeric: 60, geomantic: 70, oracular: 50, harmony: 65 };
      const spirit = scoring.computeSpiritScore(breakdown);
      const p = player('W', 'WR', 10, spirit, { divination_breakdown: breakdown });
      const same = scoring.recomputeDraftScores([p], { chaos_lambda: 0.75, oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS });
      assert.equal(same[0].spirit_score, spirit);
      const heavier = scoring.recomputeDraftScores([p], {
        chaos_lambda: 0.75,
        oracle_weights: { ...scoring.DEFAULT_ORACLE_WEIGHTS, celestial: 0.9 },
      });
      assert.ok(heavier[0].spirit_score > spirit, 'more weight on a strong pillar raises Spirit');
    });
  });

  describe('10.7 Images and mock mode', () => {
    it('10.7.1 headshot and logo URLs come from Sleeper\'s CDN; defenses have no headshot', () => {
      assert.equal(headshots.headshotUrl('4034'), 'https://sleepercdn.com/content/nfl/players/thumb/4034.jpg');
      assert.equal(headshots.headshotUrl('DET'), null);
      assert.equal(headshots.teamLogoUrl('DET'), 'https://sleepercdn.com/images/team_logos/nfl/det.png');
      assert.equal(headshots.teamLogoUrl('FA'), null);
    });

    it('10.7.2 loading the mock never adopts or saves a username', async () => {
      const { OneiromancyProvider, useOneiromancy } = await import('./dist/context/OneiromancyContext.js');
      const store = new Map();
      const prevStorage = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
      try {
        let triggerMock = null;
        function MockProbe() {
          const ctx = useOneiromancy();
          triggerMock = ctx.loadMockData;
          return jsx('div', { 'data-testid': 'mock-probe' }, ctx.draftState?.settings?.sleeper_username || 'none');
        }
        const { unmount } = render(jsx(OneiromancyProvider, { children: jsx(MockProbe, {}) }));
        assert.equal(typeof triggerMock, 'function');
        triggerMock();
        assert.notEqual(store.get('oneiromancy_active_username'), 'OneiroVanguard', 'mock must not save OneiroVanguard as active username');
        unmount();
      } finally {
        globalThis.localStorage = prevStorage;
      }
    });

    it('10.7.3 the app never acts on Sleeper (no action links in rendered recommendation screens)', () => {
      const ctx = buildMockCtx();
      for (const Comp of [WeeklyMoves, TradesScreen, PlayerMarketplace]) {
        const { container, unmount } = render(
          jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(Comp, {}) })
        );
        const links = container.querySelectorAll('a');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          assert.ok(!href.includes('sleeper.com/leagues'), 'Rendered screen must not link to act in Sleeper');
        }
        assert.ok(!container.textContent.includes('in Sleeper'), 'Rendered screen must not offer "... in Sleeper" actions');
        unmount();
      }
    });
  });

  describe('10.9 One lineup behind every recommendation (KaySwizz audit, 2026-10-11)', () => {
    // A superflex roster: QB Allen, FLEX Watson (WR 16.0), SUPER_FLEX Olave (WR 16.2), bench QB Willis (16.8).
    const sfRoster = () => {
      const allen = player('Josh Allen', 'QB', 23.4, 70);
      const watson = player('Christian Watson', 'WR', 14.0, 60);
      const olave = player('Chris Olave', 'WR', 16.2, 75);
      const willis = player('Malik Willis', 'QB', 18.8, 80);
      const roster = [
        slot('QB', ['QB'], allen),
        slot('FLEX', ['RB', 'WR', 'TE'], watson),
        slot('SUPER_FLEX', ['QB', 'RB', 'WR', 'TE'], olave),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], willis),
      ];
      return { roster, allen, watson, olave, willis };
    };

    it('10.9.1 a QB coming off the bench is placed at Superflex, never Flex, and the WR it displaces is named', () => {
      gameStatus.clearGameStatus();
      const { roster, watson, olave, willis } = sfRoster();
      const [swap] = oracle.computeLineupCheck(roster, 0.75);
      assert.ok(swap, 'a swap is recommended');
      assert.equal(swap.playerIn.id, willis.id);
      assert.equal(swap.playerOut.id, watson.id);
      assert.equal(swap.slot, 'Superflex', 'a QB can only go to Superflex');
      assert.equal(swap.moved?.player.id, olave.id, 'Olave moves out of Superflex');
      assert.equal(swap.moved?.to, 'Flex');
    });

    it('10.9.2 "would start" for a waiver add is judged against the recommended lineup, not the current one', () => {
      gameStatus.clearGameStatus();
      const fannin = player('Harold Fannin', 'TE', 10.5, 50);
      const loveland = player('Colston Loveland', 'TE', 10.2, 85);
      const sarratt = player('Elijah Sarratt', 'WR', 1.6, 60);
      const extraWr = player('Spare WR', 'WR', 2.0, 60);
      const otton = player('Cade Otton', 'TE', 8.7, 75, { draft_status: 'available' });
      const roster = [
        slot('TE', ['TE'], fannin),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], loveland),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], sarratt),
        slot('BN3', ['QB', 'RB', 'WR', 'TE'], extraWr),
      ];
      assert.ok(oracle.oracleScore(otton, 0.75) > oracle.oracleScore(fannin, 0.75), 'Otton beats the current TE');
      assert.ok(oracle.oracleScore(otton, 0.75) < oracle.oracleScore(loveland, 0.75), 'but not the recommended TE');
      const moves = oracle.computeWaiverMoves([otton], roster, 0.75, 5, 5);
      for (const m of moves) assert.equal(m.wouldStart, false, 'Otton would not start over Loveland');
    });

    it('10.9.3 players whose game has kicked off are never swapped, added or dropped', () => {
      const { roster, willis } = sfRoster();
      willis.team = 'MIA';
      gameStatus.setGameStatus(5, { MIA: 'in_game', DET: 'pre_game' });
      try {
        assert.equal(oracle.computeLineupCheck(roster, 0.75).length, 0, 'a locked bench player cannot come in');
        const lockedAdd = player('Locked FA', 'WR', 30, 90, { draft_status: 'available', team: 'MIA' });
        const moves = oracle.computeWaiverMoves([lockedAdd], roster, 0.75, 5, 5);
        assert.equal(moves.length, 0, 'a free agent whose game started cannot be added for this week');
      } finally {
        gameStatus.clearGameStatus();
      }
    });

    it('10.9.4 signed bench players are never dropped for unsigned free agents and droppable bench players are preserved for valid signed additions', () => {
      const te = player('Starter TE', 'TE', 10.0, 50);
      const wr1 = player('Starter WR', 'WR', 15.0, 70);
      const benchWr1 = player('Bench WR 1', 'WR', 12.0, 60);
      const droppableWr = player('Droppable WR', 'WR', 4.0, 40, { team: 'CLE' });
      const roster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], benchWr1),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], droppableWr),
      ];
      const phantomFA = player('Phantom FA', 'WR', 35, 95, { draft_status: 'available', team: 'FA' });
      const validSigned = player('Valid Signed Add', 'WR', 22, 70, { draft_status: 'available', team: 'ARI' });

      // phantomFA has higher oracle score than validSigned, but is unsigned.
      // computeWaiverMoves must not pair phantomFA with droppableWr (burning droppableWr), but instead pair validSigned with droppableWr.
      const moves = oracle.computeWaiverMoves([phantomFA, validSigned], roster, 0.75, 5, 5);
      assert.equal(moves.length, 1, 'Only the signed candidate should generate a waiver move');
      assert.equal(moves[0].add.name, 'Valid Signed Add');
      assert.equal(moves[0].drop.name, 'Droppable WR');

      // Also verify that an unsigned candidate CAN drop an already unsigned bench player
      const rosterWithUnsigned = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], benchWr1),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], droppableWr),
        slot('BN3', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      const faMoves = oracle.computeWaiverMoves([phantomFA], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(faMoves.length, 1, 'Unsigned FA can drop an unsigned bench player');
      assert.equal(faMoves[0].drop.name, 'Unsigned Bench');

      // Unsigned candidate isolation and full candidate traversal prevent >40 unsigned FAs from crowding out validSigned
      const unsignedCrowd = Array.from({ length: 45 }, (_, i) =>
        player(`Phantom FA ${i}`, 'WR', 30 + (i % 10), 90, { draft_status: 'available', team: 'FA' })
      );
      const crowdedMoves = oracle.computeWaiverMoves([...unsignedCrowd, validSigned], roster, 0.75, 5, 5);
      assert.equal(crowdedMoves.length, 1, 'Signed candidate is not crowded out by unsigned free agents');
      assert.equal(crowdedMoves[0].add.name, 'Valid Signed Add');

      // Mixed roster with both signed and unsigned bench drops: 45 unsigned FAs + validSigned
      const mixedCrowdedMoves = oracle.computeWaiverMoves([...unsignedCrowd, validSigned], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(mixedCrowdedMoves.length, 2, 'Both unsigned FA and signed candidate moves should be generated');
      assert.ok(mixedCrowdedMoves.some((m) => m.add.name === 'Valid Signed Add' && m.drop.name === 'Droppable WR'), 'Signed addition drops signed bench player');
      assert.ok(mixedCrowdedMoves.some((m) => m.drop.name === 'Unsigned Bench'), 'Unsigned addition drops unsigned bench player');

      // Case (a): Signed add ranked ABOVE unsigned FA on a mixed roster with signed and unsigned drops
      const topSigned = player('Top Signed Add', 'WR', 28, 92, { draft_status: 'available', team: 'LAR' });
      const midFA = player('Mid FA Add', 'WR', 24, 82, { draft_status: 'available', team: 'FA' });
      const rankedMoves = oracle.computeWaiverMoves([topSigned, midFA], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(rankedMoves.length, 1, 'Top signed add claims weakest unsigned drop; mid FA is not paired with signed drop');
      assert.equal(rankedMoves[0].add.name, 'Top Signed Add');
      assert.equal(rankedMoves[0].drop.name, 'Unsigned Bench');

      // With multiple unsigned drops, both top signed and mid FA receive drops without touching signed bench
      const twoUnsignedRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], benchWr1),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], droppableWr),
        slot('BN3', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench 1', 'WR', 2.0, 20, { team: 'FA' })),
        slot('BN4', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench 2', 'WR', 2.5, 22, { team: 'FA' })),
      ];
      const multiUnsignedMoves = oracle.computeWaiverMoves([topSigned, midFA], twoUnsignedRoster, 0.75, 5, 5);
      assert.equal(multiUnsignedMoves.length, 2, 'Both signed and unsigned additions receive drops when unsigned bench depth permits');
      assert.ok(multiUnsignedMoves.some((m) => m.add.name === 'Top Signed Add' && m.drop.name === 'Unsigned Bench 1'), 'Top signed add drops weakest bench');
      assert.ok(multiUnsignedMoves.some((m) => m.add.name === 'Mid FA Add' && m.drop.name === 'Unsigned Bench 2'), 'Mid FA add drops second unsigned bench');
      for (const m of multiUnsignedMoves) assert.notEqual(m.drop.name, 'Droppable WR', 'Signed bench is never dropped for unsigned add');

      // Case (b): Signed add alone on mixed roster drops the teamless unsigned player first (weakest bench)
      const aloneMoves = oracle.computeWaiverMoves([validSigned], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(aloneMoves.length, 1, 'Single signed candidate produces 1 move');
      assert.equal(aloneMoves[0].drop.name, 'Unsigned Bench', 'Signed candidate drops teamless unsigned player first');
      assert.ok(aloneMoves[0].reason.includes('weakest bench player'), 'Reason correctly cites weakest bench player');

      // Case (c): Fallback where no signed drop yields gain > 1 but unsigned drop does
      const tightRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], player('Strong Starter WR', 'WR', 25.0, 85)),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Solid Signed Bench', 'WR', 20.0, 70, { team: 'DAL' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      // Assert precondition: with unsigned drop replaced by another signed player, marginalSigned yields 0 moves
      const allSignedTightRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], player('Strong Starter WR', 'WR', 25.0, 85)),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Solid Signed Bench', 'WR', 20.0, 70, { team: 'DAL' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Extra Signed Bench', 'WR', 21.0, 75, { team: 'SF' })),
      ];
      const marginalSigned = player('Marginal Signed', 'WR', 20.2, 70, { draft_status: 'available', team: 'KC' });
      assert.equal(
        oracle.computeWaiverMoves([marginalSigned], allSignedTightRoster, 0.75, 5, 5).length,
        0,
        'Precondition verified: marginal signed candidate yields 0 moves when all bench drops are signed with gain <= 1'
      );

      const fallbackMoves = oracle.computeWaiverMoves([marginalSigned], tightRoster, 0.75, 5, 5);
      assert.equal(fallbackMoves.length, 1, 'Marginal signed candidate produces fallback move');
      assert.equal(fallbackMoves[0].drop.name, 'Unsigned Bench', 'Marginal signed candidate falls back to unsigned drop');

      // Case (d): A low-value unsigned FA does not push a top signed add onto a useful signed bench player
      const probeRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Useful Signed Bench', 'WR', 12.0, 60, { team: 'DET' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      const signedStar = player('Signed Star', 'WR', 25.0, 85, { draft_status: 'available', team: 'KC' });
      const lowFA = player('Low FA Add', 'WR', 4.0, 25, { draft_status: 'available', team: 'FA' });
      const probeMoves = oracle.computeWaiverMoves([signedStar, lowFA], probeRoster, 0.75, 5, 5);
      assert.equal(probeMoves.length, 1, 'Only signed star should produce a move; low FA must not burn signed bench');
      assert.equal(probeMoves[0].add.name, 'Signed Star');
      assert.equal(probeMoves[0].drop.name, 'Unsigned Bench', 'Signed star drops weakest unsigned player');

      // Case (e): Weak signed bench player is dropped before higher-scoring unsigned bench player
      const weakSignedRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Weak Signed Bench', 'WR', 1.0, 15, { team: 'MIA' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Decent Unsigned Bench', 'WR', 5.0, 35, { team: 'FA' })),
      ];
      const singleSignedMoves = oracle.computeWaiverMoves([signedStar], weakSignedRoster, 0.75, 5, 5);
      assert.equal(singleSignedMoves.length, 1);
      assert.equal(singleSignedMoves[0].drop.name, 'Weak Signed Bench', 'Signed addition drops weakest player regardless of signed status');

      // Case (f): Multi-signed candidates (S1, S2) competing with unsigned FA (F) do not suffer false reservation
      const twoDropRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], player('Starter WR 1', 'WR', 25.0, 85)),
        slot('BN_SIGNED', ['QB', 'RB', 'WR', 'TE'], player('Droppable WR2', 'WR', 10.0, 50, { team: 'CLE' })),
        slot('BN_UNSIGNED', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench2', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      const s1 = player('Signed S1', 'WR', 28.0, 90, { draft_status: 'available', team: 'LAR' });
      const s2 = player('Signed S2', 'WR', 27.0, 88, { draft_status: 'available', team: 'SF' });
      const faF = player('Unsigned FA F', 'WR', 26.0, 86, { draft_status: 'available', team: 'FA' });
      const multiSignedMoves = oracle.computeWaiverMoves([s1, s2, faF], twoDropRoster, 0.75, 5, 5);
      assert.equal(multiSignedMoves.length, 2, 'Exactly 2 moves for 2 droppable players');
      assert.equal(multiSignedMoves[0].add.name, 'Signed S1');
      assert.equal(multiSignedMoves[0].drop.name, 'Unsigned Bench2', 'Top signed candidate S1 gets the weakest bench drop');
      assert.equal(multiSignedMoves[1].add.name, 'Signed S2');
      assert.equal(multiSignedMoves[1].drop.name, 'Droppable WR2', 'Second signed candidate S2 gets remaining signed drop');

      // Case (g): Single top move (limit = 1) always drops weakest bench player without reservation disruption
      const topMoveOnly = oracle.computeWaiverMoves([topSigned, midFA], rosterWithUnsigned, 0.75, 5, 1);
      assert.equal(topMoveOnly.length, 1, 'limit = 1 produces strictly 1 move');
      assert.equal(topMoveOnly[0].add.name, 'Top Signed Add');
      assert.equal(topMoveOnly[0].drop.name, 'Unsigned Bench', 'Single top move drops the weakest bench player without reservation distortion');
    });
  });

  describe('10.10 Real games on the matchup cards (owner: "real kickoff times", 2026-10-11)', () => {
    it('10.10.1 the moon is computed, not picked: known new and full moons', () => {
      assert.equal(nflGames.moonAt(new Date('2024-04-08T18:00:00Z')), 'New Moon in Aries', 'the 2024 total eclipse');
      assert.match(nflGames.moonAt(new Date('2026-10-10T12:00:00Z')), /^New Moon in Libra$/);
      assert.match(nflGames.moonAt(new Date('2026-09-26T12:00:00Z')), /^Full Moon in /);
    });

    it('10.10.2 kickoff labels use Eastern time, and say TBA rather than invent a time', () => {
      assert.equal(nflGames.kickoffLabel({ kickoff: '2026-10-11T17:00Z', date: '2026-10-11' }), 'Sun, Oct 11 · 1:00 PM ET');
      assert.equal(nflGames.kickoffLabel({ kickoff: null, date: '2026-10-18' }), 'Sun, Oct 18 · time TBA');
    });

    it('10.10.3 both teams in a game share one game record; a bye has none', () => {
      nflGames.setWeekGames(5, [{ week: 5, home: 'ATL', away: 'BAL', kickoff: '2026-10-11T17:00Z', date: '2026-10-11', venue: { name: 'Mercedes-Benz Stadium', city: 'Atlanta' }, neutral: false }]);
      try {
        assert.equal(nflGames.teamGame(5, 'BAL'), nflGames.teamGame(5, 'ATL'));
        assert.equal(nflGames.teamGame(5, 'BAL').venue.name, 'Mercedes-Benz Stadium', 'road team plays at the home stadium');
        assert.equal(nflGames.teamGame(5, 'KC'), undefined);
      } finally {
        nflGames.clearNflGames();
      }
    });

    it('10.10.4 the planetary hour depends only on kickoff and venue, so teammates in one game match', () => {
      const t = new Date('2026-10-11T17:00:00Z');
      assert.equal(nflGames.planetaryHourAt(t, -88.06), nflGames.planetaryHourAt(t, -88.06));
      assert.match(nflGames.planetaryHourAt(t, -88.06), /^Hour of (Saturn|Jupiter|Mars|Sun|Venus|Mercury|Moon) \(/);
    });

    it('10.10.5 neutral sites get their own coordinates; live cards use the live game kickoff and lunar phase', () => {
      assert.deepEqual(nflGames.neutralVenueCoords('Tottenham Hotspur Stadium'), { lat: 51.6043, lon: -0.0664 });
      assert.equal(nflGames.neutralVenueCoords('Unknown Field'), null);
      nflGames.setWeekGames(5, [
        {
          week: 5,
          home: 'BUF',
          away: 'NYJ',
          kickoff: '2026-10-11T17:00:00Z',
          date: '2026-10-11',
          venue: { name: 'Highmark Stadium', city: 'Orchard Park', state: 'NY' },
          neutral: false,
        },
      ]);
      try {
        const game = nflGames.teamGame(5, 'BUF');
        assert.ok(game, 'Live game found for BUF in Week 5');
        assert.equal(nflGames.kickoffLabel(game), 'Sun, Oct 11 · 1:00 PM ET');
        assert.equal(nflGames.moonAt(new Date(game.kickoff)), 'New Moon in Scorpio');
      } finally {
        nflGames.clearNflGames();
      }
    });
  });

  describe('10.11 4-Section Consolidation, DIVINATION_PILLARS & Deduplication Invariants', () => {
    it('10.11.1 NavigationShell renders exactly the 4 tabs [oneiromancy, matchups, board, league] with labels [Roster, Matchup, Players, League]', () => {
      const ctx = buildMockCtx();
      const { getByTestId, queryByTestId, unmount } = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(NavigationShell, {
            activeTab: 'oneiromancy',
            onTabChange: () => {},
            children: jsx('div', { 'data-testid': 'shell-child' }, 'Body'),
          }),
        })
      );
      const expected = [
        ['nav-tab-oneiromancy', 'Roster'],
        ['nav-tab-matchups', 'Matchup'],
        ['nav-tab-board', 'Players'],
        ['nav-tab-league', 'League'],
      ];
      for (const [testId, label] of expected) {
        const tabBtn = getByTestId(testId);
        assert.ok(tabBtn.textContent.includes(label), `${testId} must display label ${label}`);
      }
      for (const legacyTab of ['nav-tab-waivers', 'nav-tab-trades', 'nav-tab-chaos_dial', 'nav-tab-encyclopedia']) {
        assert.equal(queryByTestId(legacyTab), null, `Legacy tab ${legacyTab} must not be rendered as a separate top-level tab`);
      }
      unmount();
    });

    it('10.11.2 All 4 primary screens render cleanly with zero duplicate sections or repeated controls', () => {
      const ctx = buildMockCtx();

      const rosterRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) })
      );
      assert.equal(rosterRender.getAllByTestId('universe-state-banner').length, 1, 'Roster renders exactly 1 universe-state-banner');
      assert.equal(rosterRender.getAllByTestId('synergy-constellation-svg').length, 1, 'Roster renders exactly 1 synergy-constellation-svg');
      assert.equal(rosterRender.getAllByTestId('18-week-coverage-strip').length, 1, 'Roster renders exactly 1 18-week-coverage-strip');
      rosterRender.unmount();

      const matchupRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, {}) })
      );
      assert.equal(matchupRender.getAllByTestId('positional-matchup-grid').length, 1, 'Matchup renders exactly 1 positional-matchup-grid');
      assert.ok(!matchupRender.container.textContent.includes('YOUR BENCH'), 'Matchup has no duplicate bench section');
      assert.ok(!matchupRender.container.textContent.includes('Comparative Advantages'), 'Matchup has no duplicate Comparative Advantages block');
      const userStarters = (ctx.draftState.weekly_matchup?.player_favorabilities || []).filter(
        (p) => p.is_user_team && !p.is_benched
      );
      for (const s of userStarters) {
        const cards = matchupRender.getAllByTestId(`matchup-starter-card-${s.player_id}`);
        assert.equal(cards.length, 1, `Starter ${s.player_name} must render exactly 1 card in positional-matchup-grid`);
      }
      matchupRender.unmount();

      const boardRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(CosmicBoard, {}) })
      );
      assert.equal(boardRender.getAllByTestId('cosmic-board-table').length, 1, 'Players renders exactly 1 cosmic-board-table');
      boardRender.unmount();

      const leagueRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(LeagueScreen, {}) })
      );
      assert.equal(leagueRender.getAllByTestId('celestial-leaderboard').length, 1, 'League renders exactly 1 celestial-leaderboard');
      leagueRender.unmount();
    });

    it('10.11.3 DIVINATION_PILLARS in core/lib/scoring.ts defines whatItMeasures and whyItMatters for all 5 pillars with defaultVal summing to 100 and matching DEFAULT_ORACLE_WEIGHTS', () => {
      assert.ok(Array.isArray(scoring.DIVINATION_PILLARS), 'DIVINATION_PILLARS must be exported as an array');
      assert.equal(scoring.DIVINATION_PILLARS.length, 5, 'Must define all 5 divination pillars');
      let sum = 0;
      for (const p of scoring.DIVINATION_PILLARS) {
        assert.ok(p.whatItMeasures && p.whatItMeasures.length > 15, `${p.key} must have whatItMeasures`);
        assert.ok(p.whyItMatters && p.whyItMatters.length > 15, `${p.key} must have whyItMatters`);
        assert.equal(p.defaultVal, Math.round(scoring.DEFAULT_ORACLE_WEIGHTS[p.key] * 100), `${p.key} defaultVal must match DEFAULT_ORACLE_WEIGHTS`);
        sum += p.defaultVal;
      }
      assert.equal(sum, 100, 'DIVINATION_PILLARS defaultVal must sum to 100');
    });

    it('10.11.4 compute18WeekByeCoverage returns 18 weeks and classifies cluster (3+), normal (1-2), and none (0)', () => {
      const roster = [
        slot('QB', ['QB'], player('P1', 'QB', 20, 80, { bye_week: 7 })),
        slot('RB1', ['RB'], player('P2', 'RB', 16, 80, { bye_week: 7 })),
        slot('WR1', ['WR'], player('P3', 'WR', 15, 80, { bye_week: 7 })),
        slot('BN1', ['RB'], player('P4', 'RB', 10, 75, { bye_week: 10 })),
      ];
      const cov = oracle.compute18WeekByeCoverage(roster);
      assert.equal(cov.length, 18);
      assert.equal(cov[6].week, 7);
      assert.equal(cov[6].severity, 'cluster');
      assert.equal(cov[6].players.length, 3);
      assert.equal(cov[9].week, 10);
      assert.equal(cov[9].severity, 'normal');
      assert.equal(cov[0].severity, 'none');
    });

    it('10.11.5 KNOWN_ROSTERED_NFL_PLAYERS includes Tyler Huntley (7083), mockCosmicBoard marks competitor starters as drafted, and UI tabs render unified tables without duplicate sections', () => {
      assert.ok(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'], 'KNOWN_ROSTERED_NFL_PLAYERS must include player 7083 (Tyler Huntley)');
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'].first_name, 'Tyler');
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'].last_name, 'Huntley');
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'].team, 'BAL');

      const allen = mockData.mockCosmicBoard.find((p) => p.id === '4984');
      assert.ok(allen, 'Josh Allen (4984) must exist on mockCosmicBoard');
      assert.equal(allen.draft_status, 'drafted', 'Josh Allen (4984) must have draft_status === drafted');
      assert.equal(allen.drafted_by, 'Supernova Surge', 'Josh Allen (4984) must record drafted_by Supernova Surge');

      const ctx = buildMockCtx();

      // CosmicBoard renders ONE unified player table across all 4 sub-modes
      const boardRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(CosmicBoard, {}) })
      );
      for (const mode of ['all', 'waivers', 'trades', 'my_team']) {
        fireEvent.click(boardRender.getByTestId(`board-mode-${mode}`));
        const tables = boardRender.getAllByTestId('cosmic-board-table');
        assert.equal(tables.length, 1, `CosmicBoard mode=${mode} must render exactly 1 unified player table`);
      }
      boardRender.unmount();

      // OneiromancyDashboard elementalDistribution counts strictly the 8 startingPlayers
      const dashRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) })
      );
      const svg = dashRender.getByTestId('synergy-constellation-svg');
      assert.ok(svg.textContent.includes('Fire (3)'), 'OneiromancyDashboard elemental distribution counts 3 Fire starters');
      assert.ok(svg.textContent.includes('Earth (3)'), 'OneiromancyDashboard counts 3 Earth starters (excluding bench)');
      assert.ok(svg.textContent.includes('Air (0)'), 'OneiromancyDashboard counts 0 Air starters (excluding 3 Air bench players)');
      dashRender.unmount();

      // OraclePanel does not render duplicate oracle-preview or duplicate formula headers
      const panelRender = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }),
        })
      );
      assert.equal(panelRender.queryByTestId('oracle-preview'), null, 'OraclePanel must not duplicate lineup/waiver move previews');
      panelRender.unmount();

      // When leagueRosters is populated, dropped draft picks become available and traded players reflect current roster owner
      const testMeta = {
        ...mockData.mockDraftMetadata,
        draft_order: { u1: 1, u2: 2 },
      };
      const testUsers = [
        { user_id: 'u1', display_name: 'AlphaTeam', username: 'alpha' },
        { user_id: 'u2', display_name: 'BetaTeam', username: 'beta' },
      ];
      const testPicks = [
        { pick_no: 1, round: 1, draft_slot: 1, player_id: '4574', picked_by: 'u1', roster_id: 1, metadata: { first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL' } },
        { pick_no: 2, round: 1, draft_slot: 2, player_id: '4984', picked_by: 'u2', roster_id: 2, metadata: { first_name: 'Josh', last_name: 'Allen', position: 'QB', team: 'BUF' } },
        { pick_no: 3, round: 2, draft_slot: 1, player_id: '7083', picked_by: 'u1', roster_id: 1, metadata: { first_name: 'Tyler', last_name: 'Huntley', position: 'QB', team: 'BAL' } },
      ];
      // 7083 was drafted by u1 and then dropped (not in any r.players); 4574 was drafted by u1 and traded to u2
      const testRosters = [
        { roster_id: 1, owner_id: 'u1', players: ['6813'], starters: ['6813'] },
        { roster_id: 2, owner_id: 'u2', players: ['4984', '4574'], starters: ['4984'] },
      ];
      const liveState = sleeper.transformToDraftState(
        testMeta,
        testPicks,
        { user_id: 'u1', user_slot: 1 },
        {},
        testUsers,
        testRosters,
      );
      const droppedPlayer = liveState.cosmic_board.find((p) => String(p.id) === '7083');
      const tradedPlayer = liveState.cosmic_board.find((p) => String(p.id) === '4574');
      assert.ok(droppedPlayer, 'Dropped draft pick 7083 exists on board');
      assert.equal(droppedPlayer.draft_status, 'available', 'Drafted-then-dropped player must have draft_status === available');
      assert.ok(tradedPlayer, 'Traded draft pick 4574 exists on board');
      assert.equal(tradedPlayer.draft_status, 'drafted', 'Traded player must have draft_status === drafted');
      assert.equal(tradedPlayer.drafted_by, 'BetaTeam', 'Traded player must be credited to current roster owner BetaTeam');
    });
  });

  describe('10.12 Live Sleeper Week 7 Payload & Null-Fuzzed NFLPlayer Behavioral Verification', () => {
    it('10.12.1 MatchupsScreen, OneiromancyDashboard, CosmicBoard, LeagueScreen, and OraclePanel render Week 7 Sleeper payloads with null stadium, null coordinates, bye_week=7, and synthesized fallback players without throwing', () => {
      const unknownPlayer = sleeper.synthesizeCosmicPlayerFromId('999999', 150, 7);
      const huntley = sleeper.synthesizeCosmicPlayerFromId('7083', 100, 7);
      assert.equal(huntley.name, 'Tyler Huntley');
      assert.equal(huntley.team, 'BAL');
      assert.ok(!unknownPlayer.name.includes('#'), 'Fallback player name must not leak raw #id');

      const byeStarter = player('Bye Week Starter', 'RB', 16.4, 82, { id: '7083', name: 'Tyler Huntley', position: 'QB', team: 'BAL', bye_week: 7 });
      const nullStadiumFav = {
        player_id: '7083',
        player_name: 'Tyler Huntley',
        position: 'QB',
        team: 'BAL',
        opponent: 'BYE',
        projected_points: 0,
        is_user_team: true,
        is_benched: false,
        spirit_score: 79,
        harmony_score: 80,
        game_kickoff: 'No game this week (Bye)',
        lunar_phase: '-',
        planetary_hour: '-',
        stadium: null,
        favorability_score: 79,
        favorability_verdict: 'FAVORED',
      };
      const nullCoordsFav = {
        player_id: '4984',
        player_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        opponent: 'TEN',
        projected_points: 24.2,
        is_user_team: false,
        is_benched: false,
        spirit_score: 88,
        harmony_score: 82,
        game_kickoff: 'Sun, Oct 20 · 1:00 PM ET',
        lunar_phase: 'Waning Gibbous in Taurus',
        planetary_hour: 'Hour of Sun (Solar Vitality)',
        stadium: {
          stadium_name: 'Highmark Stadium',
          city: 'Orchard Park',
          state: 'NY',
          coordinates: { lat: null, lon: null },
          latitude: null,
          longitude: null,
          roof_type: 'Open Air (Inland)',
          celestial_house: '10th House',
          zodiac_ascendant: 'Leo Ascendant',
          geo_magnetic_resonance: 'Lake Erie Conduit',
        },
        favorability_score: 88,
        favorability_verdict: 'HEAVILY FAVORED',
      };

      const w7Matchup = {
        ...mockData.mockWeeklyMatchup,
        week: 7,
        upcoming_matchups: [],
        user_team: {
          ...mockData.mockWeeklyMatchup.user_team,
          team_name: 'McTwerkface (You)',
          owner_name: 'McTwerkface',
          starters: ['7083', ...mockData.mockWeeklyMatchup.user_team.starters.slice(1)],
        },
        opponent_team: {
          ...mockData.mockWeeklyMatchup.opponent_team,
          team_name: 'KaySwizz',
          owner_name: 'KaySwizz',
        },
        player_favorabilities: [
          nullStadiumFav,
          nullCoordsFav,
          ...mockData.mockPlayerFavorabilities.filter((f) => f.player_id !== '4574' && f.player_id !== '11563'),
        ],
      };

      const w7Roster = [
        slot('QB', ['QB'], byeStarter),
        ...mockData.mockMyRoster.slice(1),
      ];

      const ctx = buildMockCtx({
        draftState: {
          ...mockData.mock_oneiromancy_draft_2025,
          my_roster: w7Roster,
          cosmic_board: [byeStarter, unknownPlayer, ...mockData.mockCosmicBoard],
          weekly_matchup: w7Matchup,
        },
      });

      const matchupView = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, { weeklyMatchup: w7Matchup }) })
      );
      assert.ok(matchupView.getByTestId('positional-matchup-grid'), 'MatchupsScreen renders unified positional matchup grid');
      assert.ok(!matchupView.container.textContent.includes('YOUR BENCH'), 'MatchupsScreen must not render duplicate bench section');
      const byeCallout = matchupView.getByTestId('matchup-bye-callout');
      assert.ok(byeCallout.textContent.includes('Tyler Huntley'), 'MatchupsScreen bye callout lists Week 7 bye starter Tyler Huntley');
      // Verify null-safe stadium & bye week formatting on rendered matchup cards
      assert.ok(matchupView.container.textContent.includes('No game this week (Bye)'), 'Bye starter slot renders No game this week (Bye)');
      assert.ok(!matchupView.container.textContent.includes('NaN'), 'Null coordinates must never render NaN');
      matchupView.unmount();

      for (const Comp of [OneiromancyDashboard, CosmicBoard, LeagueScreen]) {
        const view = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(Comp, {}) }));
        assert.ok(view.container.textContent.length > 0);
        view.unmount();
      }
    });
  });

  describe('10.13 Comment #92 Directives Verification', () => {
    it('10.13.1 default lambda is 0.75 across scoring, presets, and mock settings', () => {
      assert.equal(scoring.DEFAULT_CHAOS_LAMBDA, 0.75, 'scoring.DEFAULT_CHAOS_LAMBDA must be 0.75');
      assert.equal(mockData.mockSettings.chaos_lambda, 0.75, 'mockSettings.chaos_lambda must be 0.75');
      assert.equal(mockData.mockSettings.lambda_chaos, 0.75, 'mockSettings.lambda_chaos must be 0.75');

      const ctx = buildMockCtx();
      const panel = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }) })
      );
      assert.ok(panel.container.textContent.includes('λ = 0.75'), 'Oracle panel must display λ = 0.75');
      const preset075 = panel.getByTestId('preset-0.75');
      assert.ok(preset075, 'Must render preset button for 0.75');
      assert.ok(preset075.className.includes('border-purple-400'), 'preset-0.75 must have active purple border styling');
      assert.ok(preset075.textContent.includes('default'), 'preset-0.75 must display default badge');
      panel.unmount();
    });

    it('10.13.2 OneiromancyDashboard renders grounded plain-English radar telemetry copy', () => {
      const ctx = buildMockCtx();
      const dashboard = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) })
      );
      const text = dashboard.container.textContent || '';
      assert.ok(
        text.includes('Shows how balanced your lineup is, how deep your bench is, and how many points each starter and bench player is projected to score.'),
        'Dashboard must render grounded plain-English radar description'
      );
      assert.ok(
        !text.includes('5-spoke Elemental & Aspect balance radar with active Trine Thresholds and correlation stacks powering starter and bench aura cards below.'),
        'Dashboard must not render confusing astrological jargon'
      );
      dashboard.unmount();
    });

    it('10.13.3 Bye week system: bench players are not marked on bye in Week 1 or 2, and have positive projected points and real stadiums', () => {
      // 1. Setup a live SeasonContext at Week 1 with missing game schedule
      // BAL has a genuine bye scheduled for Week 7 (outside weeks 1-4)
      sleeper.setSeasonContext({
        season: '2025',
        leagueId: 'mock_league_1',
        currentWeek: 1,
        lastRegularWeek: 14,
        byeWeeks: { BAL: 7, DAL: 7, KC: 6 },
        weekDates: { 1: 'Sep 4 - Sep 8, 2025', 7: 'Oct 16 - Oct 20, 2025' },
        matchupsByWeek: { 1: [], 7: [] },
      });

      try {
        const derivedW1 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          1
        );

        // Every active starter and bench player in Week 1 must have projected_points > 0 and real stadium
        const balPlayerW1 = derivedW1.player_favorabilities.find((p) => (p.team || p.nfl_team) === 'BAL');
        assert.ok(balPlayerW1, 'BAL player must be present in derived favorabilities');
        assert.ok(balPlayerW1.projected_points > 0, `Week 1 player must have positive projections, got ${balPlayerW1.projected_points}`);
        assert.equal(balPlayerW1.stadium?.stadium_name, 'M&T Bank Stadium', 'Week 1 stadium must be M&T Bank Stadium');
        assert.equal(balPlayerW1.game_kickoff, 'Time TBA', 'Week 1 game_kickoff must be Time TBA when schedule missing');

        // Render MatchupsScreen at Week 1
        const ctxW1 = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            weekly_matchup: derivedW1,
          },
        });
        const viewW1 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW1, children: jsx(MatchupsScreen, { weeklyMatchup: derivedW1 }) })
        );
        const textW1 = viewW1.container.textContent || '';
        assert.ok(!textW1.includes('BYE WK 1'), 'Must not display BYE WK 1 badge on any player');
        assert.ok(!textW1.includes('No game this week (Bye)'), 'Must not format any Week 1 stadium as bye');
        const byeCalloutW1 = viewW1.getByTestId('matchup-bye-callout');
        assert.ok(
          byeCalloutW1.textContent.includes('Zero rostered or opponent players on bye this week.'),
          'Week 1 bye callout must report zero players on bye'
        );
        viewW1.unmount();

        // Check Week 2 as well
        const derivedW2 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          2
        );
        const balPlayerW2 = derivedW2.player_favorabilities.find((p) => (p.team || p.nfl_team) === 'BAL');
        assert.ok(balPlayerW2 && balPlayerW2.projected_points > 0, 'Week 2 player must have positive projections');
        assert.equal(balPlayerW2.stadium?.stadium_name, 'M&T Bank Stadium', 'Week 2 stadium must be M&T Bank Stadium');
        assert.notEqual(balPlayerW2.game_kickoff, 'Bye week', 'Week 2 game_kickoff must not be Bye week');

        // 2. Derive live matchup for Week 7 (genuine bye week for BAL)
        const derivedW7 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          7
        );
        const balPlayerW7 = derivedW7.player_favorabilities.find((p) => (p.team || p.nfl_team) === 'BAL');
        assert.ok(balPlayerW7, 'BAL player must be present in Week 7 favorabilities');
        assert.equal(balPlayerW7.projected_points, 0, `Week 7 bye player must have 0.0 projected points, got ${balPlayerW7.projected_points}`);
        assert.equal(balPlayerW7.game_kickoff, 'Bye week', 'Week 7 bye player kickoff must be "Bye week"');

        const ctxW7 = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            weekly_matchup: derivedW7,
          },
        });
        const viewW7 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW7, children: jsx(MatchupsScreen, { weeklyMatchup: derivedW7 }) })
        );
        const textW7 = viewW7.container.textContent || '';
        assert.ok(textW7.includes('BYE WK 7'), 'Must display BYE WK 7 badge on Baltimore player');
        assert.ok(textW7.includes('On Bye'), 'Must display On Bye label on Baltimore player');
        const byeCalloutW7 = viewW7.getByTestId('matchup-bye-callout');
        assert.ok(
          byeCalloutW7.textContent.includes(balPlayerW7.player_name),
          'Week 7 bye callout must list the bye player'
        );
        viewW7.unmount();
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.13.4 MatchupsScreen renders unclipped stadium venue names in dedicated subrow', () => {
      const ctx = buildMockCtx();
      const matchupView = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, { weeklyMatchup: ctx.draftState.weekly_matchup }) })
      );
      const starterCard = matchupView.getByTestId('matchup-starter-card-4574');
      assert.ok(starterCard, 'Starter card must be present');
      const venueSubrow = starterCard.querySelector('.border-t');
      assert.ok(venueSubrow, 'Must render dedicated venue subrow with border-t');
      assert.ok(venueSubrow.textContent.includes('Cleveland Browns Stadium'), 'Subrow must contain stadium venue name');
      matchupView.unmount();
    });

    it('10.13.5 deriveByeWeeks restricts bye week detection to valid NFL bye window (5-14), ignoring early schedule gaps', () => {
      // BAL has a missing game in Week 1 (schedule gap), plays weeks 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14
      // Missing week in valid window (5-14) is week 7.
      const games = [
        { week: 1, date: '2025-09-07', home: 'KC', away: 'LAC' },
        { week: 2, date: '2025-09-14', home: 'BAL', away: 'CLE' },
        { week: 3, date: '2025-09-21', home: 'DAL', away: 'BAL' },
        { week: 4, date: '2025-09-28', home: 'BAL', away: 'BUF' },
        { week: 5, date: '2025-10-05', home: 'CIN', away: 'BAL' },
        { week: 6, date: '2025-10-12', home: 'BAL', away: 'WAS' },
        // Week 7: BAL missing (authentic bye week)
        { week: 7, date: '2025-10-19', home: 'KC', away: 'DEN' },
        { week: 8, date: '2025-10-26', home: 'CLE', away: 'BAL' },
        { week: 9, date: '2025-11-02', home: 'BAL', away: 'DEN' },
        { week: 10, date: '2025-11-09', home: 'BAL', away: 'CIN' },
        { week: 11, date: '2025-11-16', home: 'PIT', away: 'BAL' },
        { week: 12, date: '2025-11-23', home: 'LAC', away: 'BAL' },
        { week: 13, date: '2025-11-30', home: 'BAL', away: 'PHI' },
        { week: 14, date: '2025-12-07', home: 'NYG', away: 'BAL' },
      ];
      const byes = sleeper.deriveByeWeeks(games);
      assert.equal(byes.BAL, 7, 'BAL bye week must be 7, skipping week 1 schedule gap');
    });

    it('10.13.6 isPlayerOnByeWeek comprehensive edge cases and precedence rules', () => {
      // 1. Invalid or missing week parameters must return false
      assert.equal(scoring.isPlayerOnByeWeek(undefined, 7, 'BAL'), false, 'undefined week must return false');
      assert.equal(scoring.isPlayerOnByeWeek(null, 7, 'BAL'), false, 'null week must return false');
      assert.equal(scoring.isPlayerOnByeWeek(NaN, 7, 'BAL'), false, 'NaN week must return false');

      // 2. Weeks outside the NFL bye window (5-14) must return false even if matching
      assert.equal(scoring.isPlayerOnByeWeek(1, 1, 'BAL', { BAL: 1 }), false, 'Week 1 is outside bye window');
      assert.equal(scoring.isPlayerOnByeWeek(4, 4, 'BAL'), false, 'Week 4 is outside bye window');
      assert.equal(scoring.isPlayerOnByeWeek(15, 15, 'BAL', { BAL: 15 }), false, 'Week 15 is outside bye window');
      assert.equal(scoring.isPlayerOnByeWeek(18, 18, 'BAL'), false, 'Week 18 is outside bye window');

      // 3. Empty or whitespace team code falls back to player's bye_week
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, '', { BAL: 9 }), true, 'Empty team falls back to playerByeWeek');
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, '', { BAL: 9 }), false, 'Empty team does not match season context');
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, undefined, { BAL: 9 }), true, 'undefined team falls back to playerByeWeek');

      // 4. Season byeWeeks overrides stale playerByeWeek
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, 'BAL', { BAL: 9 }), true, 'Season byeWeek (9) overrides stale playerByeWeek (7)');
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, 'BAL', { BAL: 9 }), false, 'Stale playerByeWeek (7) is ignored when season context has 9');

      // 5. Case-insensitive team code normalization
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, 'bal', { BAL: 9 }), true, 'Lowercase team code normalized to BAL');

      // 6. Team not present in season byeWeeks falls back to playerByeWeek
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, 'DET', { BAL: 9 }), true, 'DET not in seasonByeWeeks falls back to playerByeWeek');
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, 'DET', { BAL: 9 }), false, 'DET does not match week 9');
    });

    it('10.13.7 Oracle functions respect registered SeasonContext bye weeks over stale player bye_week', () => {
      // Setup players with stale bye_week: 7 on BAL, and control players on week 5
      const balStarter = player('Lamar Jackson', 'QB', 24, 92, { team: 'BAL', bye_week: 7 });
      balStarter.id = 'lamar_bal_1';

      const wrStarter = player('WR One', 'WR', 18, 88, { team: 'KC', bye_week: 5 });
      wrStarter.id = 'wr_starter_1';

      const wrExtra = player('WR Depth', 'WR', 14, 80, { team: 'BUF', bye_week: 5 });
      wrExtra.id = 'wr_depth_2';

      const balBench = player('Zay Flowers', 'WR', 10, 75, { team: 'BAL', bye_week: 7 });
      balBench.id = 'zay_bal_2';

      const testRoster = [
        slot('QB', ['QB'], balStarter),
        slot('WR1', ['WR'], wrStarter),
        slot('BN1', ['WR'], balBench),
        slot('BN2', ['WR'], wrExtra),
      ];

      // 1. Without SeasonContext, functions use player's bye_week (7)
      sleeper.setSeasonContext(null);
      const covWithoutCtx = oracle.compute18WeekByeCoverage(testRoster);
      assert.equal(covWithoutCtx.find((s) => s.week === 7)?.players.length, 2, 'Without ctx, week 7 has 2 players');
      assert.equal(covWithoutCtx.find((s) => s.week === 9)?.players.length, 0, 'Without ctx, week 9 has 0 players');

      // 2. With SeasonContext { BAL: 9 }, functions must use week 9 and ignore week 7
      try {
        sleeper.setSeasonContext({
          season: '2025',
          leagueId: 'test_league_oracle_byes',
          currentWeek: 7,
          lastRegularWeek: 14,
          byeWeeks: { BAL: 9 },
          weekDates: {},
          matchupsByWeek: {},
        });

        // 2a. compute18WeekByeCoverage
        const covWithCtx = oracle.compute18WeekByeCoverage(testRoster);
        assert.equal(covWithCtx.find((s) => s.week === 7)?.players.length, 0, 'With ctx BAL:9, week 7 must have 0 bye players');
        assert.equal(covWithCtx.find((s) => s.week === 9)?.players.length, 2, 'With ctx BAL:9, week 9 must have both BAL players');

        // 2b. computeByeOutlook from week 7 looking ahead 3 weeks (weeks 8, 9, 10)
        const alerts = oracle.computeByeOutlook(testRoster, 7, 3);
        assert.equal(alerts.length, 1, 'Must have exactly 1 bye week alert');
        assert.equal(alerts[0].week, 9, 'Alert must be for week 9');
        assert.equal(alerts[0].starters[0]?.id, 'lamar_bal_1', 'Lamar Jackson must be listed in week 9 starter byes');

        // 2c. computeWaiverMoves with currentWeek = 9: bench player on bye is protected from drops
        const waiverCandidates = [player('Waiver Target', 'WR', 22, 95, { draft_status: 'available' })];
        waiverCandidates[0].id = 'waiver_wr_1';

        // At week 9 (actual bye), BAL bench player (zay_bal_2) is on bye and protected
        const movesAtWk9 = oracle.computeWaiverMoves(waiverCandidates, testRoster, 0.75, 9, 2);
        assert.ok(!movesAtWk9.some((m) => m.drop.id === 'zay_bal_2'), 'Bench player on bye in week 9 (Zay Flowers) is protected from drop');

        // At week 7 (not a bye according to ctx), BAL bench player is not on bye and can be dropped for an upgrade
        const movesAtWk7 = oracle.computeWaiverMoves(waiverCandidates, testRoster, 0.75, 7, 2);
        assert.ok(movesAtWk7.some((m) => m.drop.id === 'zay_bal_2'), 'Bench player not on bye in week 7 (Zay Flowers) can be dropped');
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.13.8 Live McTwerkface Week 8 bye players: benched bye players appear in MatchupsScreen callout, show BYE WK 8 badges across screens, respect live playerDict team over stale draft metadata, and preserve non-bye baseline projections for future weeks', () => {
      sleeper.setSeasonContext({
        season: '2026',
        leagueId: '1378157554336559104',
        currentWeek: 8,
        lastRegularWeek: 14,
        byeWeeks: { HOU: 8, NO: 8, NYG: 8, SF: 8, BAL: 13, CIN: 6 },
        weekDates: { 6: 'Oct 15 - Oct 19, 2026', 8: 'Oct 29 - Nov 2, 2026', 9: 'Nov 5 - Nov 9, 2026' },
        matchupsByWeek: {},
      });

      try {
        const livePlayerDict = {
          '4892': { player_id: '4892', first_name: 'Baker', last_name: 'Mayfield', position: 'QB', team: 'TB', status: 'Active', number: 6 },
          '8131': { player_id: '8131', first_name: 'Isaiah', last_name: 'Likely', position: 'TE', team: 'NYG', status: 'Active', number: 80 },
          '13285': { player_id: '13285', first_name: 'Malachi', last_name: 'Fields', position: 'WR', team: 'NYG', status: 'Active', number: 81 },
          '2306': { player_id: '2306', first_name: 'Jameis', last_name: 'Winston', position: 'QB', team: 'NYG', status: 'Active', number: 19 },
          '7527': { player_id: '7527', first_name: 'Mac', last_name: 'Jones', position: 'QB', team: 'SF', status: 'Active', number: 10 },
          '9504': { player_id: '9504', first_name: 'Charlie', last_name: 'Jones', position: 'WR', team: 'NYG', status: 'Active', number: 15 },
          '8144': { player_id: '8144', first_name: 'Chris', last_name: 'Olave', position: 'WR', team: 'NO', status: 'Active', number: 12 },
          '4881': { player_id: '4881', first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL', status: 'Active', number: 8 },
        };

        // Draft picks have stale draft-day metadata (Likely on BAL, Charlie Jones on CIN)
        const picks = [
          { pick_no: 1, round: 1, draft_slot: 7, player_id: '4892', picked_by: 'u_mctwerk', metadata: { first_name: 'Baker', last_name: 'Mayfield', position: 'QB', team: 'TB' } },
          { pick_no: 2, round: 2, draft_slot: 7, player_id: '8131', picked_by: 'u_mctwerk', metadata: { first_name: 'Isaiah', last_name: 'Likely', position: 'TE', team: 'BAL' } },
          { pick_no: 3, round: 3, draft_slot: 7, player_id: '13285', picked_by: 'u_mctwerk', metadata: { first_name: 'Malachi', last_name: 'Fields', position: 'WR', team: 'NYG' } },
          { pick_no: 4, round: 4, draft_slot: 7, player_id: '2306', picked_by: 'u_mctwerk', metadata: { first_name: 'Jameis', last_name: 'Winston', position: 'QB', team: 'NYG' } },
          { pick_no: 5, round: 5, draft_slot: 7, player_id: '7527', picked_by: 'u_mctwerk', metadata: { first_name: 'Mac', last_name: 'Jones', position: 'QB', team: 'SF' } },
          { pick_no: 6, round: 6, draft_slot: 1, player_id: '9504', picked_by: 'u_opp', metadata: { first_name: 'Charlie', last_name: 'Jones', position: 'WR', team: 'CIN' } },
          { pick_no: 7, round: 7, draft_slot: 1, player_id: '8144', picked_by: 'u_opp', metadata: { first_name: 'Chris', last_name: 'Olave', position: 'WR', team: 'NO' } },
          { pick_no: 8, round: 8, draft_slot: 1, player_id: '4881', picked_by: 'u_opp', metadata: { first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL' } },
        ];

        const rosters = [
          { roster_id: 2, owner_id: 'u_mctwerk', starters: ['4892'], players: ['4892', '8131', '13285', '2306', '7527'] },
          { roster_id: 3, owner_id: 'u_opp', starters: ['4881'], players: ['4881', '8144', '9504'] },
        ];

        const matchupsW8 = [
          { roster_id: 2, matchup_id: 3, starters: ['4892'], players: ['4892', '8131', '13285', '2306', '7527'], points: 0 },
          { roster_id: 3, matchup_id: 3, starters: ['4881'], players: ['4881', '8144', '9504'], points: 0 },
        ];

        // Week 8 live projections omit NYG/SF/NO players because they are on bye in Week 8
        const weeklyProjectionsW8 = {
          '4892': { pts_ppr: 21.4 },
          '4881': { pts_ppr: 23.8 },
        };

        const state = sleeper.transformToDraftState(
          { draft_id: 'd1', status: 'complete', type: 'snake', settings: { teams: 2, rounds: 8, slots_qb: 1, slots_bn: 4 }, draft_order: { u_mctwerk: 2, u_opp: 1 } },
          picks,
          { user_id: 'u_mctwerk', username: 'McTwerkface', user_slot: 2, league_id: '1378157554336559104', roster_positions: ['QB', 'BN', 'BN', 'BN', 'BN'] },
          livePlayerDict,
          [{ user_id: 'u_mctwerk', display_name: 'McTwerkface', metadata: { team_name: 'ASStrologians' } }, { user_id: 'u_opp', display_name: 'KaySwizz', metadata: { team_name: 'SlayEmMayhem' } }],
          rosters,
          matchupsW8,
          { league_id: '1378157554336559104', name: 'Toxic Trash Talkers', season: '2026', status: 'in_season', sport: 'nfl', total_rosters: 2, settings: { leg: 8 }, roster_positions: ['QB', 'BN', 'BN', 'BN', 'BN'] },
          8,
          weeklyProjectionsW8
        );

        // 1. Live team from playerDict overrides stale draft pick metadata and updates bye_week to 8
        const likelyBoard = state.cosmic_board.find((p) => p.id === '8131');
        const charlieBoard = state.cosmic_board.find((p) => p.id === '9504');
        assert.equal(likelyBoard?.team, 'NYG', 'Isaiah Likely must use live NYG team over stale BAL draft metadata');
        assert.equal(likelyBoard?.bye_week, 8, 'Isaiah Likely bye_week must be synced to NYG Week 8 bye');
        assert.equal(charlieBoard?.team, 'NYG', 'Charlie Jones must use live NYG team over stale CIN draft metadata');
        assert.equal(charlieBoard?.bye_week, 8, 'Charlie Jones bye_week must be synced to NYG Week 8 bye');

        // 2. MatchupsScreen in Week 8 lists benched bye players in matchup-bye-callout (never "Zero rostered or opponent players on bye")
        const ctxW8 = buildMockCtx({ draftState: state });
        const matchupViewW8 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW8, children: jsx(MatchupsScreen, { weeklyMatchup: state.weekly_matchup }) })
        );
        const byeCalloutW8 = matchupViewW8.getByTestId('matchup-bye-callout');
        assert.ok(!byeCalloutW8.textContent.includes('Zero rostered or opponent players on bye this week.'), 'Must not claim zero players on bye when bench players are on bye');
        for (const name of ['Malachi Fields', 'Jameis Winston', 'Mac Jones', 'Isaiah Likely', 'Chris Olave']) {
          assert.ok(byeCalloutW8.textContent.includes(name), `Week 8 bye callout must include benched bye player ${name}`);
        }
        assert.ok(byeCalloutW8.textContent.includes('YOU · BN'), 'Week 8 bye callout must tag user bench bye players with YOU · BN');
        assert.ok(byeCalloutW8.textContent.includes('OPP · BN'), 'Week 8 bye callout must tag opponent bench bye players with OPP · BN');
        matchupViewW8.unmount();

        // 3. OneiromancyDashboard grays out benched bye players and renders both BYE WK 8 tag and muted "On Bye" label
        const dashView = render(
          jsx(OneiromancyContext.Provider, { value: ctxW8, children: jsx(OneiromancyDashboard, {}) })
        );
        const dashText = dashView.container.textContent || '';
        assert.ok(dashText.includes('BYE WK 8'), 'Roster dashboard must display BYE WK 8 badge on current-week bye players');
        assert.ok(dashText.includes('On Bye'), 'Roster dashboard must display muted On Bye label on current-week bye players');
        const bnCard = dashView.getByTestId('roster-card-BN1');
        assert.ok(bnCard.className.includes('opacity-50'), 'Bye bench card must be grayed out with opacity-50');
        const cellW8 = dashView.getByTestId('bye-week-cell-8');
        assert.ok(cellW8.textContent.includes('4'), 'Week 8 bye coverage cell must show 4 user players on bye');
        assert.ok(cellW8.className.includes('ring-purple-400'), 'Active week 8 cell must have active purple ring highlight');
        dashView.unmount();

        // 4. Future week (Week 9) restores positive baseline projections for Week 8 bye players
        const derivedW9 = sleeper.deriveWeeklyMatchup(2, state.competitor_teams, matchupsW8, state.cosmic_board, state.my_roster, 9);
        const likelyW9 = derivedW9.player_favorabilities.find((p) => String(p.player_id) === '8131');
        assert.ok(likelyW9 && likelyW9.projected_points > 0, `Week 8 bye player must have positive baseline projection in Week 9, got ${likelyW9?.projected_points}`);

        // 5. Completed past week (Week 6) uses actual points from matchObj.players_points
        const matchupsW6 = [
          { roster_id: 2, matchup_id: 3, starters: ['4892'], players: ['4892', '8131'], points: 14.2, players_points: { '4892': 14.2, '8131': 9.6 } },
          { roster_id: 3, matchup_id: 3, starters: ['4881'], players: ['4881', '8144'], points: 18.5, players_points: { '4881': 18.5, '8144': 11.1 } },
        ];
        const derivedW6 = sleeper.deriveWeeklyMatchup(2, state.competitor_teams, matchupsW6, state.cosmic_board, state.my_roster, 6);
        const bakerW6 = derivedW6.player_favorabilities.find((p) => String(p.player_id) === '4892');
        assert.equal(bakerW6?.projected_points, 14.2, 'Completed past week (Week 6) must use actual points (14.2) rather than Week 8 projection (21.4)');
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.13.9 Scorecard visual contrast and deterministic 4-row/2-row DOM hierarchy', () => {
      sleeper.setSeasonContext({
        season: '2026',
        leagueId: '1378157554336559104',
        currentWeek: 8,
        lastRegularWeek: 14,
        byeWeeks: { HOU: 8, NO: 8, NYG: 8, SF: 8, IND: 13, PIT: 9, TB: 10 },
        weekDates: { 8: 'Oct 29 - Nov 2, 2026' },
        matchupsByWeek: {},
      });

      try {
        const starterQb = player('Aaron Rodgers', 'QB', 19.6, 67, { id: '96', team: 'PIT', bye_week: 9 });
        const starterTe = player('Cade Otton', 'TE', 7.9, 74, { id: '8110', team: 'TB', bye_week: 10 });
        const benchNonBye = player('Daniel Jones', 'QB', 12.3, 69, { id: '5870', team: 'IND', bye_week: 13, draft_status: 'my_team' });
        const benchBye = player('Mac Jones', 'QB', 0.0, 40, { id: '7527', team: 'SF', bye_week: 8, draft_status: 'my_team' });
        const oppRosteredNonBye = player('Drake Maye', 'QB', 24.7, 79, { id: '11564', team: 'NE', bye_week: 11, draft_status: 'drafted', drafted_by: 'HotMulligan' });

        const customRoster = [
          { slot_id: 'QB', slot_name: 'Quarterback', position: 'QB', eligible_positions: ['QB'], player: starterQb, is_locked: false },
          { slot_id: 'TE', slot_name: 'Tight End', position: 'TE', eligible_positions: ['TE'], player: starterTe, is_locked: false },
          { slot_id: 'BN1', slot_name: 'Bench 1', position: 'BN', eligible_positions: ['BN'], player: benchNonBye, is_locked: false },
          { slot_id: 'BN2', slot_name: 'Bench 2', position: 'BN', eligible_positions: ['BN'], player: benchBye, is_locked: false },
        ];

        const ctx = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            my_roster: customRoster,
            cosmic_board: [starterQb, starterTe, benchNonBye, benchBye, oppRosteredNonBye],
            weekly_matchup: { ...mockData.mockWeeklyMatchup, week: 8 },
          },
        });

        // 1. Non-bye bench card vs Bye bench card styling contrast + 4-row deterministic layout
        const dashView = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) }));
        const nonByeCard = dashView.getByTestId('roster-card-BN1');
        const byeCard = dashView.getByTestId('roster-card-BN2');

        assert.ok(!nonByeCard.getAttribute('data-bye'), 'Non-bye bench card must not have data-bye');
        assert.strictEqual(byeCard.getAttribute('data-bye'), 'true');
        assert.ok(byeCard.className.split(/\s+/).includes('opacity-50'), 'Card missing opacity-50 class');
        assert.ok(byeCard.className.split(/\s+/).includes('grayscale'), 'Card missing grayscale class');
        assert.ok(!byeCard.className.split(/\s+/).includes('opacity-55'), 'Card should not use invalid opacity-55 class');

        // Verify all Roster scorecards (short slot "Tight End", long slot "Quarterback", Bench 1, Bench 2) have identical 4-row structure
        for (const testId of ['roster-card-QB', 'roster-card-TE', 'roster-card-BN1', 'roster-card-BN2']) {
          const card = dashView.getByTestId(testId);
          const textCol = card.querySelector('[data-testid="roster-card-text-col"]');
          assert.ok(textCol, `${testId} must have roster-card-text-col text column`);
          assert.equal(textCol.children.length, 4, `${testId} text column must have strictly 4 dedicated rows (Slot+Pos, Name, Team+Sign, Tags)`);
          assert.ok(!textCol.children[0].className.split(/\s+/).includes('flex-wrap'), `${testId} Row 1 (Slot+Pos) must not flex-wrap`);
          assert.ok(textCol.children[1].className.split(/\s+/).includes('truncate'), `${testId} Row 2 (Player Name) must be a dedicated truncate row`);
          assert.ok(textCol.children[2].className.split(/\s+/).includes('whitespace-nowrap'), `${testId} Row 3 (Team · Bye + Sign) must be whitespace-nowrap`);
        }
        dashView.unmount();

        // 2. CosmicBoard & MatchupsScreen non-bye rostered rows and 2-row Matchup starter header
        const boardView = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(CosmicBoard, {}) }));
        const allRows = Array.from(boardView.container.querySelectorAll('tr'));
        const drakeRow = allRows.find((tr) => tr.textContent?.includes('Drake Maye'));
        const macRow = allRows.find((tr) => tr.textContent?.includes('Mac Jones'));
        assert.ok(drakeRow && !drakeRow.getAttribute('data-bye'), 'Non-bye rostered player row in CosmicBoard must not have data-bye');
        assert.ok(macRow && macRow.getAttribute('data-bye') === 'true', 'Bye player row in CosmicBoard must have data-bye="true"');
        boardView.unmount();

        const matchupView = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, {}) }));
        const mCard = matchupView.getByTestId('matchup-starter-card-4574');
        const mTextCol = mCard.querySelector('[data-testid="matchup-card-text-col"]');
        assert.equal(mTextCol?.children.length, 2, 'Matchup starter card must have strictly 2 dedicated header rows ([Pos+Name], [Team·Bye+Tags])');
        matchupView.unmount();
      } finally {
        sleeper.setSeasonContext(null);
      }
    });
  });

  describe('10.14 Bye-week lookahead projections & scoring invariants', () => {
    it('10.14.1 getNextPlayWeek resolves next non-bye week across bye, non-bye, Wk 14, Wk 18, schedule-loaded gaps, and unloaded schedule', () => {
      try {
        nflGames.clearNflGames();
        const byeMap = { BUF: 7, DET: 9, SF: 14, KC: 18 };
        assert.equal(oracle.getNextPlayWeek('BUF', 7, byeMap), 8, 'Week-7 bye team returns Week 8 when schedule unloaded');
        assert.equal(oracle.getNextPlayWeek('DET', 7, byeMap), null, 'Non-bye team returns null');
        assert.equal(oracle.getNextPlayWeek('SF', 14, byeMap), 15, 'Week-14 bye team returns Week 15');
        assert.equal(oracle.getNextPlayWeek('KC', 18, byeMap), null, 'Week-18 bye team returns null');
        assert.equal(oracle.getNextPlayWeek('KC', 17, { KC: 18 }, 18), null, 'Week-17 non-bye team with Week-18 bye returns null');
        assert.equal(oracle.getNextPlayWeek('', 7, byeMap), null, 'Empty team string returns null');
        assert.equal(oracle.getNextPlayWeek('   ', 7, byeMap), null, 'Whitespace-only team string returns null');
        assert.equal(oracle.getNextPlayWeek(null, 7, byeMap), null, 'Null team returns null');
        assert.equal(oracle.getNextPlayWeek(undefined, 7, byeMap), null, 'Undefined team returns null');
        assert.equal(oracle.getNextPlayWeek('BUF', 2, { BUF: 2 }), null, 'Weeks outside NFL bye window (5..14) return null');
        assert.equal(oracle.getNextPlayWeek('BUF', 7, {}, 7), 8, 'Falls back to player bye_week when season map absent');
        assert.equal(oracle.getNextPlayWeek('FA', 7, byeMap, 7), null, 'Free agent FA returns null even with byeWeek 7');
        assert.equal(oracle.getNextPlayWeek('NFL', 7, byeMap, 7), null, 'Unsigned NFL string returns null');
        assert.equal(oracle.getNextPlayWeek('Free Agent', 7, byeMap, 7), null, 'Free Agent string returns null');
        assert.equal(sleeper.getNextPlayWeek('BUF', 7, byeMap), 8, 'sleeper re-export of getNextPlayWeek works');
        assert.equal(sleeper.getNextPlayWeek('FA', 7, byeMap, 7), null, 'sleeper re-export returns null for FA');

        nflGames.setWeekGames(8, [
          { week: 8, home: 'KC', away: 'LV', kickoff: null, date: '2026-10-25', venue: null, neutral: false },
        ]);
        nflGames.setWeekGames(9, [
          { week: 9, home: 'BUF', away: 'MIA', kickoff: null, date: '2026-11-01', venue: null, neutral: false },
        ]);
        assert.equal(
          oracle.getNextPlayWeek('BUF', 7, byeMap),
          9,
          'Skips intermediate Week 8 when loaded schedule has no game for BUF',
        );

        nflGames.setWeekGames(8, [
          { week: 8, home: 'BUF', away: 'NYJ', kickoff: null, date: '2026-10-25', venue: null, neutral: false },
        ]);
        assert.equal(
          oracle.getNextPlayWeek('BUF', 7, byeMap),
          8,
          'Returns Week 8 when loaded schedule confirms BUF plays in Week 8',
        );

        for (const w of [15, 16, 17, 18]) {
          nflGames.setWeekGames(w, [
            { week: w, home: 'KC', away: 'LV', kickoff: null, date: '2026-12-06', venue: null, neutral: false },
          ]);
        }
        assert.equal(
          oracle.getNextPlayWeek('SF', 14, byeMap),
          null,
          'Week-14 bye team returns null when Weeks 15-18 schedule has no games for team',
        );
      } finally {
        nflGames.clearNflGames();
      }
    });

    it('10.14.2 averageProjectedPoints, hasOraclePlaceholder, and oracleEffectivePoints fallback hierarchy', () => {
      const explicitAvg = player('Avg Player', 'QB', 0, 80, { bye_week: 7, average_projected_points: 17.5 });
      assert.equal(oracle.averageProjectedPoints(explicitAvg), 17.5);
      assert.equal(oracle.hasOraclePlaceholder(explicitAvg, 7), true);
      assert.equal(oracle.oracleEffectivePoints(explicitAvg, 7), 17.5);

      const baselineFallback = player('Base Player', 'QB', 0, 80, { bye_week: 7, baseline_projected_points: 16.2 });
      assert.equal(oracle.averageProjectedPoints(baselineFallback), 16.2);
      assert.equal(oracle.hasOraclePlaceholder(baselineFallback, 7), true);
      assert.equal(oracle.oracleEffectivePoints(baselineFallback, 7), 16.2);

      const seasonFallback = player('Season Player', 'QB', 0, 80, { bye_week: 7, season_projected_points: 255.0 });
      assert.equal(oracle.averageProjectedPoints(seasonFallback), 15.0);
      assert.equal(oracle.hasOraclePlaceholder(seasonFallback, 7), true);

      const activePlaying = player('Active Player', 'QB', 21.0, 80, { bye_week: 7, average_projected_points: 17.5 });
      assert.equal(oracle.hasOraclePlaceholder(activePlaying, 7), false, 'Active positive projection does not use placeholder');
      assert.equal(oracle.oracleEffectivePoints(activePlaying, 7), 21.0);

      const healthyNotOnBye = player('Healthy Zero', 'QB', 0, 80, { bye_week: 9, average_projected_points: 17.5 });
      assert.equal(oracle.hasOraclePlaceholder(healthyNotOnBye, 7), false, 'Healthy player not on bye must not receive placeholder');

      const placeholderDisabled = oracle.oracleEffectivePoints(explicitAvg, 7, { placeholder: false });
      assert.equal(placeholderDisabled, 0, 'options.placeholder=false must bypass placeholder and return raw 0');
    });

    it('10.14.3 oraclePlaceholderInfo generates explanatory tooltips for bye, IR, Out, and inactive statuses', () => {
      const byePlayer = player('Josh Allen', 'QB', 0, 82, {
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 18.5,
      });
      const byeInfo = oracle.oraclePlaceholderInfo(byePlayer, 7);
      assert.equal(byeInfo.hasPlaceholder, true);
      assert.equal(byeInfo.avgPoints, 18.5);
      assert.equal(byeInfo.reason, 'on bye');
      assert.equal(
        byeInfo.tooltipText,
        'Oracle score uses average projection (18.5 pts) as a placeholder while on bye. Will update once active.',
      );
      assert.equal(
        byeInfo.statsTooltipText,
        '0.0 pts (on bye). Oracle rating uses 18.5 pt average projection placeholder.',
      );

      const irPlayer = player('Injured Star', 'RB', 0, 80, {
        team: 'DET',
        bye_week: 9,
        injury_status: 'IR',
        average_projected_points: 14.0,
      });
      const irInfo = oracle.oraclePlaceholderInfo(irPlayer, 7);
      assert.equal(irInfo.hasPlaceholder, true);
      assert.equal(irInfo.reason, 'on injured reserve');
      assert.equal(
        irInfo.tooltipText,
        'Oracle score uses average projection (14.0 pts) as a placeholder while on injured reserve. Will update once active.',
      );
      assert.equal(
        irInfo.statsTooltipText,
        '0.0 pts (on injured reserve). Oracle rating uses 14.0 pt average projection placeholder.',
      );
    });

    it('10.14.4 oracleScore uses placeholder by default and currentWeekOracleScore evaluates raw 0 for start/sit checks', () => {
      const byePlayer = player('Healthy Bye Star', 'QB', 0, 85, {
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 18.0,
        divination_breakdown: { geomantic: 78 },
      });
      const placeholderOracle = oracle.oracleScore(byePlayer, 0.5, { currentWeek: 7 });
      const currentWeekOracle = oracle.currentWeekOracleScore(byePlayer, 0.5, 7);
      assert.ok(
        placeholderOracle > currentWeekOracle + 25.0,
        `Placeholder Oracle (${placeholderOracle}) must be much higher than currentWeekOracle (${currentWeekOracle}) for healthy bye star`,
      );

      // Verify real injury still incurs health penalty even with placeholder
      const injuredPlayer = player('Injured Star', 'QB', 0, 85, {
        team: 'BUF',
        bye_week: 7,
        injury_status: 'IR',
        average_projected_points: 18.0,
        divination_breakdown: { geomantic: 78 },
      });
      const injuredStars = oracle.starsScore(injuredPlayer, 7);
      const healthyStars = oracle.starsScore(byePlayer, 7);
      assert.ok(
        healthyStars - injuredStars >= 20.0,
        `Injured player stars (${injuredStars}) must reflect severe injury penalty compared to healthy bye player (${healthyStars})`,
      );
    });

    it('10.14.5 bye player with missing, zero, negative, NaN, or Infinity next_week_projected_points does not invent lookahead scores', () => {
      const missingNext = player('Bench Bye Missing', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        divination_breakdown: { geomantic: 78 },
      });
      const zeroNext = player('Bench Bye Zero', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: 0,
        divination_breakdown: { geomantic: 78 },
      });
      const negativeNext = player('Bench Bye Negative', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: -5,
        divination_breakdown: { geomantic: 78 },
      });
      const nanNext = player('Bench Bye NaN', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: Number.NaN,
        divination_breakdown: { geomantic: 78 },
      });
      const infNext = player('Bench Bye Infinity', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: Number.POSITIVE_INFINITY,
        divination_breakdown: { geomantic: 78 },
      });

      for (const p of [missingNext, zeroNext, negativeNext, nanNext, infNext]) {
        assert.equal(oracle.statsPoints(p), 0);
        assert.ok(oracle.starsScore(p) > 0);
        assert.ok(oracle.oracleScore(p, 0.75) > 0);
      }
    });

    it('10.14.6 spirit_score is identical with and without lookahead', () => {
      const basePlayer = player('Spirit Invariance', 'RB', 0, 75, {
        team: 'BUF',
        bye_week: 7,
        adp: 18.5,
      });
      const withLookahead = {
        ...basePlayer,
        next_play_week: 8,
        next_week_projected_points: 16.4,
      };
      const [scoredBase] = scoring.recomputeDraftScores([basePlayer], {
        chaos_lambda: 0.75,
        oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS,
      });
      const [scoredLookahead] = scoring.recomputeDraftScores([withLookahead], {
        chaos_lambda: 0.75,
        oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS,
      });
      assert.equal(scoredLookahead.spirit_score, scoredBase.spirit_score);
      assert.deepEqual(scoring.DIVINATION_PILLARS.map((p) => p.key), [
        'celestial',
        'geomantic',
        'numeric',
        'harmony',
        'oracular',
      ]);
    });

    it('10.14.7 updating lambda or oracle_weights updates oracle and stars scores', () => {
      const byePlayer = player('Weight Sensitivity', 'WR', 0, 80, {
        team: 'BUF',
        bye_week: 7,
        adp: 12,
        next_play_week: 8,
        next_week_projected_points: 15,
        divination_breakdown: {
          celestial: 92,
          numeric: 42,
          geomantic: 78,
          oracular: 65,
          harmony: 95,
        },
      });
      const statsHeavy = oracle.oracleScore(byePlayer, 0.1);
      const starsHeavy = oracle.oracleScore(byePlayer, 0.9);
      assert.notEqual(statsHeavy, starsHeavy, 'Changing lambda must update oracle score');

      const [recomputedHarmony] = scoring.recomputeDraftScores([byePlayer], {
        chaos_lambda: 0.75,
        oracle_weights: { celestial: 0, numeric: 0, geomantic: 0, oracular: 0, harmony: 1 },
      });
      const [recomputedNumeric] = scoring.recomputeDraftScores([byePlayer], {
        chaos_lambda: 0.75,
        oracle_weights: { celestial: 0, numeric: 1, geomantic: 0, oracular: 0, harmony: 0 },
      });
      assert.notEqual(
        oracle.starsScore(recomputedHarmony),
        oracle.starsScore(recomputedNumeric),
        'Updating oracle_weights must update spirit_score and stars',
      );
    });

    it('10.14.8 deriveWeeklyMatchup, computeLineupCheck, computeWaiverMoves, vor_normalized, draft_score, and board sorting remain unchanged', () => {
      const byeStarter = player('Bye Starter', 'QB', 0, 95, {
        id: 'bye_qb_1',
        team: 'BUF',
        bye_week: 7,
        vor_normalized: 88.2,
        draft_score: 91.4,
      });
      const byeStarterWithLookahead = {
        ...byeStarter,
        next_play_week: 8,
        next_week_projected_points: 24.5,
      };
      const benchHealthyQb = player('Healthy Bench QB', 'QB', 14.2, 70, {
        id: 'healthy_qb_2',
        team: 'DET',
        bye_week: 9,
        vor_normalized: 61.0,
        draft_score: 66.5,
      });
      const waiverTarget = player('Waiver QB', 'QB', 18.0, 85, {
        id: 'waiver_qb_3',
        team: 'BAL',
        bye_week: 14,
        draft_status: 'available',
        vor_normalized: 72.0,
        draft_score: 79.0,
      });

      const makeRoster = (qbStarter) => [
        slot('QB', ['QB'], qbStarter),
        slot('BN1', ['BN', 'QB', 'RB', 'WR', 'TE'], benchHealthyQb),
      ];
      const competitor = {
        roster_id: 1,
        owner_id: 'u_me',
        name: 'My Team',
        is_user: true,
        players: ['bye_qb_1', 'healthy_qb_2'],
        projected_points: 14.2,
        spirit_avg: 82.5,
      };
      const opponent = {
        roster_id: 2,
        owner_id: 'u_opp',
        name: 'Opponent',
        is_user: false,
        players: [],
        projected_points: 20.0,
        spirit_avg: 75.0,
      };
      const matchups = [
        { roster_id: 1, matchup_id: 1, starters: ['bye_qb_1'], players: ['bye_qb_1', 'healthy_qb_2'], points: 0 },
        { roster_id: 2, matchup_id: 1, starters: [], players: [], points: 20.0 },
      ];

      const mWithout = sleeper.deriveWeeklyMatchup(1, [competitor, opponent], matchups, [byeStarter, benchHealthyQb], makeRoster(byeStarter), 7);
      const mWith = sleeper.deriveWeeklyMatchup(1, [competitor, opponent], matchups, [byeStarterWithLookahead, benchHealthyQb], makeRoster(byeStarterWithLookahead), 7);
      assert.equal(mWith.user_team.projected_points, mWithout.user_team.projected_points);
      assert.equal(mWith.player_favorabilities[0].projected_points, 0);
      assert.equal(mWith.player_favorabilities[0].game_kickoff, 'Bye week');

      const optWithout = oracle.optimalLineup(makeRoster(byeStarter), 0.75);
      const optWith = oracle.optimalLineup(makeRoster(byeStarterWithLookahead), 0.75);
      assert.equal(optWith.get('QB')?.id, 'healthy_qb_2', 'optimalLineup must keep bye player out of starter slot');
      assert.equal(optWith.get('QB')?.id, optWithout.get('QB')?.id);
      const benchByeRoster = [
        slot('QB', ['QB'], benchHealthyQb),
        slot('BN1', ['BN', 'QB', 'RB', 'WR', 'TE'], byeStarterWithLookahead),
      ];
      assert.deepEqual(
        oracle.computeLineupCheck(benchByeRoster, 0.75),
        [],
        'computeLineupCheck must never promote a bye player into a starter slot',
      );

      const weakBenchQb = player('Weak Bench QB', 'QB', 8.0, 52, {
        id: 'weak_qb_4',
        team: 'CLE',
        bye_week: 10,
        vor_normalized: 45.0,
        draft_score: 51.0,
      });
      const makeFullRoster = (qbStarter) => [
        slot('QB', ['QB'], qbStarter),
        slot('BN1', ['QB'], benchHealthyQb),
        slot('BN2', ['QB'], weakBenchQb),
      ];
      const waiverBoardWithout = [byeStarter, benchHealthyQb, weakBenchQb, waiverTarget];
      const waiverBoardWith = [byeStarterWithLookahead, benchHealthyQb, weakBenchQb, waiverTarget];
      const waiversWithout = oracle.computeWaiverMoves(waiverBoardWithout, makeFullRoster(byeStarter), 0.75, 7);
      const waiversWith = oracle.computeWaiverMoves(waiverBoardWith, makeFullRoster(byeStarterWithLookahead), 0.75, 7);
      assert.ok(waiversWith.length > 0, 'computeWaiverMoves must produce real waiver candidates on valid RosterSlot[] input');
      assert.deepEqual(waiversWith, waiversWithout, 'computeWaiverMoves must be completely invariant to next-week lookahead fields');

      const [recompWithout] = scoring.recomputeDraftScores([byeStarter], { chaos_lambda: 0.75 });
      const [recomp] = scoring.recomputeDraftScores([byeStarterWithLookahead], { chaos_lambda: 0.75 });
      assert.equal(recomp.vor_normalized, recompWithout.vor_normalized);
      assert.equal(recomp.draft_score, recompWithout.draft_score, 'draft_score must remain unchanged by lookahead fields');

      assert.ok(comparePlayersForBoard(benchHealthyQb, byeStarterWithLookahead, 'oracle', 'desc', 0.75) < 0);
    });

    it('10.14.9 computeWaiverMoves gives wouldStart=false to a bye waiver add while ranking by placeholder oracle', () => {
      const activeStarterQb = player('Active Starter', 'QB', 18.0, 75, {
        id: 'act_qb',
        team: 'KC',
        bye_week: 10,
      });
      const droppableBench = player('Droppable Bench', 'QB', 5.0, 40, {
        id: 'drop_qb',
        team: 'NYJ',
        bye_week: 12,
      });
      const extraBench = player('Extra Bench', 'QB', 6.0, 42, {
        id: 'extra_qb',
        team: 'TEN',
        bye_week: 12,
      });
      const byeWaiverTarget = player('Bye Star Free Agent', 'QB', 0, 90, {
        id: 'bye_fa',
        team: 'DAL',
        bye_week: 7,
        average_projected_points: 22.0,
        draft_status: 'available',
      });
      const roster = [
        slot('QB', ['QB'], activeStarterQb),
        slot('BN1', ['QB'], droppableBench),
        slot('BN2', ['QB'], extraBench),
      ];
      const moves = oracle.computeWaiverMoves([byeWaiverTarget], roster, 0.75, 7);
      assert.ok(moves.length > 0, 'Should find waiver move for high-oracle bye player');
      assert.equal(moves[0].add.id, 'bye_fa');
      assert.equal(
        moves[0].wouldStart,
        false,
        'Bye waiver candidate must not be marked wouldStart for the current week',
      );
    });

    it('10.14.10 synthetic live players without verified projections never receive average_projected_points or placeholder', () => {
      const syntheticPlayer = player('Synthetic Depth', 'RB', 0, 50, {
        id: 'synth_rb',
        team: 'MIA',
        bye_week: 6,
      });
      assert.equal(oracle.averageProjectedPoints(syntheticPlayer), 0);
      assert.equal(oracle.hasOraclePlaceholder(syntheticPlayer, 7), false);
      const info = oracle.oraclePlaceholderInfo(syntheticPlayer, 7);
      assert.equal(info.hasPlaceholder, false);
      assert.equal(info.avgPoints, 0);
    });

    it('10.14.11 team Matchup Oracle strictly equals the mean of row Oracles when a starter is on bye', () => {
      const activeStarter = player('Active WR', 'WR', 16.0, 75, {
        id: 'act_wr',
        team: 'KC',
        bye_week: 10,
        average_projected_points: 16.0,
      });
      const byeStarter = player('Bye WR', 'WR', 0, 80, {
        id: 'bye_wr',
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 18.0,
      });
      const starters = [activeStarter, byeStarter];
      const lambda = 0.75;
      const selectedWeek = 7;

      const o1 = oracle.oracleScore(activeStarter, lambda, { currentWeek: selectedWeek });
      const o2 = oracle.oracleScore(byeStarter, lambda, { currentWeek: selectedWeek });

      assert.ok(oracle.hasOraclePlaceholder(byeStarter, selectedWeek));
      assert.equal(oracle.oracleEffectivePoints(byeStarter, selectedWeek), 18.0);
      assert.ok(o2 > 50, 'Bye starter oracle score should reflect placeholder projection');

      const sum = starters.reduce((acc, s) => acc + oracle.oracleScore(s, lambda, { currentWeek: selectedWeek }), 0);
      const teamOracle = Math.round((sum / starters.length) * 10) / 10;
      const expectedMean = Math.round(((o1 + o2) / 2) * 10) / 10;

      assert.equal(teamOracle, expectedMean, 'Team Matchup Oracle must strictly equal the mean of row Oracles with selectedWeek');

      // Verify describeValue threads currentWeek
      const desc = oracle.describeValue(byeStarter, lambda, { currentWeek: selectedWeek });
      assert.ok(desc.includes(`Oracle ${o2.toFixed(1)}`), 'describeValue must include placeholder oracle score');

      // Verify computeTeamOracles threads currentWeek
      const teamOracles = oracle.computeTeamOracles(
        [{ id: 't1', name: 'Team 1', starters: ['act_wr', 'bye_wr'] }],
        starters,
        lambda,
        { currentWeek: selectedWeek },
      );
      assert.equal(teamOracles[0].oracle, expectedMean, 'computeTeamOracles must thread currentWeek');

      // Verify MatchupsScreen rendering with week 7 bye starter
      try {
        sleeper.setSeasonContext({
          season: '2025',
          leagueId: 'mock_league_1',
          currentWeek: 7,
          lastRegularWeek: 14,
          byeWeeks: { BUF: 7 },
          weekDates: { 7: 'Oct 16 - Oct 20, 2025' },
          matchupsByWeek: { 7: [] },
        });
        const derivedW7 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          7,
        );
        const ctxW7 = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            weekly_matchup: derivedW7,
          },
        });
        const viewW7 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW7, children: jsx(MatchupsScreen, { weeklyMatchup: derivedW7 }) }),
        );
        const textW7 = viewW7.container.textContent || '';
        assert.ok(textW7.includes('Starter Oracle Average') || textW7.includes('AstralOracles'), 'MatchupsScreen must render team oracle headers');
        viewW7.unmount();
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.14.12 hasOraclePlaceholder returns false when week cannot be resolved rather than guessing week 2', () => {
      sleeper.setSeasonContext(null);
      const byePlayer = player('Bye Player', 'WR', 0, 80, {
        id: 'bye_p',
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 15.0,
      });
      // Without passing week and without season context, it must return false (no guessing week 2)
      assert.equal(oracle.hasOraclePlaceholder(byePlayer, undefined), false);
      const info = oracle.oraclePlaceholderInfo(byePlayer, undefined);
      assert.equal(info.hasPlaceholder, false);
      assert.equal(info.avgPoints, 0);

      // With explicit week 7, it activates
      assert.equal(oracle.hasOraclePlaceholder(byePlayer, 7), true);
      const infoW7 = oracle.oraclePlaceholderInfo(byePlayer, 7);
      assert.equal(infoW7.hasPlaceholder, true);
      assert.equal(infoW7.avgPoints, 15.0);
    });

    it('10.14.13 computeTradePartners threads currentWeek option correctly and protects starters on bye from being offered as trade bait', () => {
      seasonContext.setSeasonContextState(null);
      // Both teams have spare depth at the position they give (depth = dedicated slots + 1).
      // My team has a top starting RB on Week 7 bye (myByeRB, avg 18.0 pts) and active backups.
      const myByeRB = player('My Bye RB', 'RB', 0, 85, { bye_week: 7, average_projected_points: 18.0 });
      const myActiveRB1 = player('My Active RB1', 'RB', 17, 85);
      const myActiveRB2 = player('My Active RB2', 'RB', 16, 85);
      const myWR = player('My Weak WR', 'WR', 4, 60);
      const myWR2 = player('My WR2', 'WR', 3, 55);

      const theirRB = player('Their Weak RB', 'RB', 6, 60);
      const theirRB2 = player('Their RB2', 'RB', 5, 55);
      const theirBenchWR = player('Their Bench WR', 'WR', 16, 85);
      const theirWRs = [player('Their WR1', 'WR', 18, 85), player('Their WR2', 'WR', 17, 85)];

      const roster = [
        slot('RB', ['RB'], myByeRB),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], myActiveRB1),
        slot('BN2', ['RB', 'WR'], myActiveRB2),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];

      // In Week 7, optimalLineup benches myByeRB (0 stats pts) and starts active RB1 for match day
      const optimalW7 = oracle.optimalLineup(roster, 0.75, 7);
      assert.equal(optimalW7.get('RB')?.id, myActiveRB1.id, 'Week 7 optimal lineup starts active RB over bye RB');

      const me = {
        roster_id: 1,
        slot: 1,
        name: 'Me (You)',
        is_user: true,
        players: [myByeRB, myActiveRB1, myActiveRB2, myWR, myWR2].map((x) => x.id),
        starters: [myByeRB.id, myWR.id],
      };
      const them = {
        roster_id: 2,
        slot: 2,
        name: 'Them',
        players: [theirRB, theirRB2, theirBenchWR, ...theirWRs].map((x) => x.id),
        starters: [theirRB.id, theirWRs[0].id],
      };
      const board = [myByeRB, myActiveRB1, myActiveRB2, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];

      // In Week 7, trade partner evaluation considers season-long starter quality,
      // so myByeRB (top starter resting on 1-week bye) is NEVER offered as bench trade bait.
      const partnersW7 = oracle.computeTradePartners([me, them], board, roster, 0.75, { currentWeek: 7 });
      assert.ok(Array.isArray(partnersW7), 'computeTradePartners with currentWeek must return array');
      assert.ok(partnersW7.length > 0, 'Must identify mutual trade partner in Week 7');
      assert.ok(partnersW7[0].give, 'Must identify give piece');
      assert.ok(partnersW7[0].get, 'Must identify get piece');
      assert.equal(
        partnersW7[0].give.player.id,
        myActiveRB1.id,
        'Week 7 trade partner recommendation trades active backup RB1, protecting starting myByeRB on bye',
      );
      assert.notEqual(
        partnersW7[0].give.player.id,
        myByeRB.id,
        'Starter on single-week bye must never be offered as disposable bench trade bait',
      );

      // In Week 8 (non-bye), when the starter has a regular active weekly projection (18 pts),
      // they remain the starter, and active backup RB1 is traded
      const myActiveStarterRB = player('My Starter RB (W8 active)', 'RB', 18, 85, { bye_week: 7, average_projected_points: 18.0 });
      const rosterW8 = [
        slot('RB', ['RB'], myActiveStarterRB),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], myActiveRB1),
        slot('BN2', ['RB', 'WR'], myActiveRB2),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];
      const meW8 = {
        ...me,
        starters: [myActiveStarterRB.id, myWR.id],
        players: [myActiveStarterRB, myActiveRB1, myActiveRB2, myWR, myWR2].map((x) => x.id),
      };
      const boardW8 = [myActiveStarterRB, myActiveRB1, myActiveRB2, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];
      const partnersW8 = oracle.computeTradePartners([meW8, them], boardW8, rosterW8, 0.75, { currentWeek: 8 });
      assert.ok(partnersW8.length > 0, 'Must identify mutual trade partner in Week 8');
      assert.equal(
        partnersW8[0].give.player.id,
        myActiveRB1.id,
        'Week 8 trade partner recommendation keeps active starter and trades backup RB1',
      );
      assert.notEqual(
        partnersW8[0].give.player.id,
        myActiveStarterRB.id,
        'Active starter is protected in Week 8',
      );

      // If a player has 0 weekly projection and no placeholder in Week 8, they are benched,
      // so active RB1 starts and backup RB2 is offered
      const partnersW8Benched = oracle.computeTradePartners([me, them], board, roster, 0.75, { currentWeek: 8 });
      assert.ok(partnersW8Benched.length > 0, 'Must identify mutual trade partner in Week 8 when zero-projection player is benched');
      assert.equal(
        partnersW8Benched[0].give.player.id,
        myActiveRB2.id,
        'Week 8 recommendation trades active backup RB2 when zero-projection player is benched',
      );

      // Without currentWeek option, defaults cleanly to non-bye behavior trading active backup RB2
      const partnersDefault = oracle.computeTradePartners([me, them], board, roster, 0.75);
      assert.ok(partnersDefault.length > 0, 'Must identify mutual trade partner without week option');
      assert.equal(
        partnersDefault[0].give.player.id,
        myActiveRB2.id,
        'Default trade partner recommendation trades active backup RB2',
      );
    });

    it('10.14.14 computeTradePartners does not displace active healthy starters with injured or IR players during trade evaluation', () => {
      seasonContext.setSeasonContextState(null);
      // Roster with an injured star on IR with high average points (25.0) but 0 weekly projection,
      // a healthy active starter RB1 (14.0 pts), a bench backup RB2 (11.0 pts), and wide receivers.
      const irStar = player('Injured Star RB', 'RB', 0, 95, { injury_status: 'IR', average_projected_points: 25.0 });
      const healthyRB1 = player('Healthy RB1', 'RB', 14, 85);
      const healthyRB2 = player('Healthy Backup RB2', 'RB', 11, 80);
      const myWR = player('My Weak WR', 'WR', 4, 60);
      const myWR2 = player('My WR2', 'WR', 3, 55);

      const theirRB = player('Their Weak RB', 'RB', 6, 60);
      const theirRB2 = player('Their RB2', 'RB', 5, 55);
      const theirBenchWR = player('Their Bench WR', 'WR', 16, 85);
      const theirWRs = [player('Their WR1', 'WR', 18, 85), player('Their WR2', 'WR', 17, 85)];

      const roster = [
        slot('RB', ['RB'], healthyRB1),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], irStar),
        slot('BN2', ['RB', 'WR'], healthyRB2),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];

      // In Week 10, optimalLineup with byeOnly: true must select healthyRB1 as starter, NOT the injured IR star
      const optimalW10 = oracle.optimalLineup(roster, 0.75, 10, { placeholder: true, byeOnly: true });
      assert.equal(
        optimalW10.get('RB')?.id,
        healthyRB1.id,
        'optimalLineup with byeOnly: true must keep active healthy RB1 as starter over injured IR player',
      );

      const me = {
        roster_id: 1,
        slot: 1,
        name: 'Me (You)',
        is_user: true,
        players: [irStar, healthyRB1, healthyRB2, myWR, myWR2].map((x) => x.id),
        starters: [healthyRB1.id, myWR.id],
      };
      const them = {
        roster_id: 2,
        slot: 2,
        name: 'Them',
        players: [theirRB, theirRB2, theirBenchWR, ...theirWRs].map((x) => x.id),
        starters: [theirRB.id, theirWRs[0].id],
      };
      const board = [irStar, healthyRB1, healthyRB2, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];

      // Trade evaluation must NOT offer healthyRB1 (our active starting RB while the star is on IR)
      const partnersW10 = oracle.computeTradePartners([me, them], board, roster, 0.75, { currentWeek: 10 });
      assert.ok(partnersW10.length > 0, 'Must identify mutual trade partner in Week 10');
      assert.notEqual(
        partnersW10[0].give.player.id,
        healthyRB1.id,
        'Healthy active starter RB1 must NOT be offered as trade bait while star is on IR',
      );
      assert.equal(
        partnersW10[0].give.player.id,
        healthyRB2.id,
        'Trade evaluation must offer healthy backup RB2 instead',
      );
    });
  });
});
