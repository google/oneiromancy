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
 * (Stats / Stars / Oracle), the owner's defaults, and the rules every
 * recommendation must follow (see changes/AGENT_UX_GUIDELINES.md).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

const oracle = await import('../core/lib/oracle.ts');
const scoring = await import('../core/lib/scoring.ts');
const headshots = await import('../components/common/PlayerHeadshot.tsx');
const gameStatus = await import('../core/lib/gameStatus.ts');
const nflGames = await import('../core/lib/nflGames.ts');

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
  describe('10.1 Owner defaults', () => {
    it('10.1.1 default λ is the owner\'s 0.75 and star weights are 30/20/25/10/15', () => {
      assert.equal(scoring.DEFAULT_CHAOS_LAMBDA, 0.75);
      assert.deepEqual(scoring.DEFAULT_ORACLE_WEIGHTS, {
        celestial: 0.3,
        numeric: 0.2,
        geomantic: 0.25,
        oracular: 0.1,
        harmony: 0.15,
      });
    });

    it('10.1.2 no UI or lib file hard-codes a fallback λ', () => {
      const files = [
        'core/lib/sleeper.ts',
        'components/astrolabe/Astrolabe.tsx',
        'components/settings/SettingsDrawer.tsx',
      ];
      for (const f of files) {
        const src = fs.readFileSync(path.resolve(f), 'utf8');
        assert.ok(!/chaos_lambda \?\? 0\.\d/.test(src), `${f} must read DEFAULT_CHAOS_LAMBDA`);
        assert.ok(!/lambda \?\? 0\.\d/.test(src), `${f} must read DEFAULT_CHAOS_LAMBDA`);
      }
    });

    it('10.1.3 Oracle panel presets are symmetric around the default and include it', () => {
      const panel = fs.readFileSync(path.resolve('components/oracle/OraclePanel.tsx'), 'utf8');
      assert.ok(panel.includes('value: 1 - DEFAULT_CHAOS_LAMBDA'), 'Mostly stats mirrors the default');
      assert.ok(panel.includes('value: DEFAULT_CHAOS_LAMBDA'), 'Mostly stars is the default');
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

    it('10.2.4 one tone scale: ≥84 apex, 75–83 good, 65–74 neutral, <65 bad', () => {
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
      const sleeperSrc = fs.readFileSync(path.resolve('core/lib/sleeper.ts'), 'utf8');
      const scoringSrc = fs.readFileSync(path.resolve('core/lib/scoring.ts'), 'utf8');
      assert.ok(!scoringSrc.includes('!fav.is_benched,\n          geomantic'), 'matchup recompute must not penalize the bench');
      assert.ok(!/p\.injury_status,\n\s+isStarter,\n\s+geomantic/.test(sleeperSrc), 'matchup build must not penalize the bench');
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

    it('10.7.2 loading the mock never adopts or saves a username', () => {
      const ctx = fs.readFileSync(path.resolve('context/OneiromancyContext.tsx'), 'utf8');
      const start = ctx.indexOf('const loadMockData = useCallback(');
      const body = ctx.slice(start, ctx.indexOf('}, []);', start));
      assert.ok(!body.includes("localStorage.setItem('oneiromancy_active_username'"), 'mock must not save a username');
      assert.ok(!body.includes("'OneiroVanguard'"), 'mock must not adopt the persona as the username');
    });

    it('10.7.3 the app never acts on Sleeper (no action links)', () => {
      for (const f of ['components/oneiromancy/WeeklyMoves.tsx', 'components/screens/TradesScreen.tsx', 'components/screens/PlayerMarketplace.tsx']) {
        const src = fs.readFileSync(path.resolve(f), 'utf8');
        assert.ok(!src.includes('sleeper.com/leagues'), `${f} must not link to act in Sleeper`);
        assert.ok(!/in Sleeper</.test(src), `${f} must not offer "… in Sleeper" actions`);
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

    it('10.10.5 neutral sites get their own coordinates; live cards never use the illustrative slots', () => {
      assert.deepEqual(nflGames.neutralVenueCoords('Tottenham Hotspur Stadium'), { lat: 51.6043, lon: -0.0664 });
      assert.equal(nflGames.neutralVenueCoords('Unknown Field'), null);
      const src = fs.readFileSync(path.resolve('core/lib/sleeper.ts'), 'utf8');
      assert.ok(src.includes('const gameKickoff = liveSeason'), 'kickoff must come from the real game when a season is loaded');
      assert.ok(src.includes('const lunarPhase = liveSeason'), 'moon must come from the real kickoff when a season is loaded');
    });
  });
});
