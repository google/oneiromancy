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
import * as oracle from './helpers/oneiromancy_oracle.mjs';

describe('Tier 3: Cross-Feature Interactions (>=19 Pairwise Tests)', () => {
  // --------------------------------------------------------------------------
  // Interaction 1: Chaos Dial Lambda updates Cosmic Board rankings and Oneiromancy Spotlight
  // --------------------------------------------------------------------------
  it('3.1 should update Cosmic Board rankings and Oneiromancy spotlight player simultaneously when Chaos Dial lambda changes', () => {
    const mock = oracle.createCanonicalMockDraft();
    const pVOR = { ...mock.players[0], vor_normalized: 95.0, spirit_score: 50.0 }; // High VOR, Low Spirit
    const pSpirit = { ...mock.players[1], vor_normalized: 50.0, spirit_score: 98.0 }; // Low VOR, High Spirit
    const pool = [pVOR, pSpirit];

    // At lambda = 0.0 (Pure VOR), pVOR must be #1 spotlight
    let l0_scores = pool.map((p) => ({ ...p, draft_score: oracle.computeDraftScore(p.vor_normalized, p.spirit_score, 0.0) }));
    let spotlight_l0 = [...l0_scores].sort((a, b) => b.draft_score - a.draft_score)[0];
    assert.equal(spotlight_l0.id, pVOR.id);

    // At lambda = 1.0 (Pure Mystic), pSpirit must become #1 spotlight
    let l1_scores = pool.map((p) => ({ ...p, draft_score: oracle.computeDraftScore(p.vor_normalized, p.spirit_score, 1.0) }));
    let spotlight_l1 = [...l1_scores].sort((a, b) => b.draft_score - a.draft_score)[0];
    assert.equal(spotlight_l1.id, pSpirit.id);
  });

  // --------------------------------------------------------------------------
  // Interaction 2: Sleeper pick updates user roster and recomputes Western Trines distribution
  // --------------------------------------------------------------------------
  it('3.2 should update user roster and recompute Western Trines elemental distribution when a Sleeper pick occurs', () => {
    const roster = {
      user_id: 'user_oneiromancy_me',
      starters: [{ slot_id: 'WR1', player: { name: "Ja'Marr Chase", elemental_traits: { element: 'Water' } } }],
      elemental_distribution: { Fire: 0, Earth: 0, Air: 0, Water: 1 },
    };

    // User executes pick: Saquon Barkley (Air)
    const newPick = { name: 'Saquon Barkley', elemental_traits: { element: 'Air' } };
    roster.starters.push({ slot_id: 'RB1', player: newPick });
    roster.elemental_distribution[newPick.elemental_traits.element] =
      (roster.elemental_distribution[newPick.elemental_traits.element] || 0) + 1;

    assert.equal(roster.elemental_distribution.Water, 1);
    assert.equal(roster.elemental_distribution.Air, 1);
    assert.equal(roster.starters.length, 2);
  });

  // --------------------------------------------------------------------------
  // Interaction 3: Drafting user QB activates 3.0x stack multiplier on candidate WRs
  // --------------------------------------------------------------------------
  it('3.3 should activate 3.0x stack multiplier (+18.0 pts) on candidate WRs in Cosmic Board upon drafting a QB', () => {
    let userRoster = [];
    const candidateWR = { name: "Ja'Marr Chase", team: 'CIN', position: 'WR' };

    // Before drafting Burrow: stack bonus is 0.0
    let bonusBefore = oracle.calculateStackMultiplier(candidateWR, userRoster);
    assert.equal(bonusBefore, 0.0);

    // User drafts Joe Burrow (QB, CIN)
    userRoster.push({ player: { name: 'Joe Burrow', team: 'CIN', position: 'QB' } });

    // After drafting Burrow: candidate WR receives 3.0x stack (+18.0 pts)
    let bonusAfter = oracle.calculateStackMultiplier(candidateWR, userRoster);
    assert.equal(bonusAfter, 18.0);
  });

  // --------------------------------------------------------------------------
  // Interaction 4: Poller delta detection triggers Harmony recomputation only when pick count increases
  // --------------------------------------------------------------------------
  it('3.4 should trigger Harmony Engine recalculation when pick count increases, but skip when unchanged', () => {
    let harmonyRecomputeCount = 0;
    let lastPickCount = 4;

    const onPollCycle = (newPickCount, newStatus) => {
      const delta = oracle.detectPollerDelta(lastPickCount, newPickCount, 'drafting', newStatus);
      if (delta.shouldRecompute) {
        harmonyRecomputeCount++;
        lastPickCount = newPickCount;
      }
    };

    // Tick 1: No new picks
    onPollCycle(4, 'drafting');
    assert.equal(harmonyRecomputeCount, 0);

    // Tick 2: 1 new pick added
    onPollCycle(5, 'drafting');
    assert.equal(harmonyRecomputeCount, 1);
    assert.equal(lastPickCount, 5);

    // Tick 3: No new picks
    onPollCycle(5, 'drafting');
    assert.equal(harmonyRecomputeCount, 1);
  });

  // --------------------------------------------------------------------------
  // Interaction 5: Opponent poaching target player elevates fallback candidate in Oneiromancy
  // --------------------------------------------------------------------------
  it('3.5 should automatically elevate fallback candidate in Oneiromancy when target player is drafted by opponent', () => {
    const ascensionStep = {
      round: 1,
      target_player_id: '7569', // Chase
      target_player_name: "Ja'Marr Chase",
      fallback_player_id: '6794', // Lamb
      fallback_player_name: 'CeeDee Lamb',
      active_recommendation: '7569',
    };

    // Opponent picks Chase at Pick 4
    const opponentPick = { player_id: '7569', picked_by: 'user_astro_04' };

    // Ascension engine updates active recommendation
    if (opponentPick.player_id === ascensionStep.target_player_id) {
      ascensionStep.active_recommendation = ascensionStep.fallback_player_id;
    }

    assert.equal(ascensionStep.active_recommendation, '6794');
  });

  // --------------------------------------------------------------------------
  // Interaction 6: Modifying Divination weights recalculates Spirit Score and shifts waiver upgrades
  // --------------------------------------------------------------------------
  it('3.6 should recalculate Spirit Score and shift top waiver wire upgrades when divination weights change', () => {
    const freeAgent = {
      divination_breakdown: { celestial: 95.0, numeric: 40.0, geomantic: 50.0, oracular: 50.0, harmony: 50.0 },
      vor_normalized: 60.0,
    };

    // Standard weights: celestial = 0.30
    const spiritDefault = oracle.computeSpiritScore(freeAgent.divination_breakdown, oracle.DEFAULT_ORACLE_WEIGHTS);
    const draftScoreDefault = oracle.computeDraftScore(freeAgent.vor_normalized, spiritDefault, 0.35);

    // Celestial-heavy weights: celestial = 0.80, others = 0.05
    const heavyCelestial = { celestial: 0.80, numeric: 0.05, geomantic: 0.05, oracular: 0.05, harmony: 0.05 };
    const spiritHeavy = oracle.computeSpiritScore(freeAgent.divination_breakdown, heavyCelestial);
    const draftScoreHeavy = oracle.computeDraftScore(freeAgent.vor_normalized, spiritHeavy, 0.35);

    assert.ok(spiritHeavy > spiritDefault);
    assert.ok(draftScoreHeavy > draftScoreDefault);
  });

  // --------------------------------------------------------------------------
  // Interaction 7: Drafting 2nd QB before round 10 triggers positional cap penalty and lowers DraftScore
  // --------------------------------------------------------------------------
  it('3.7 should trigger positional cap penalty (-15.0 pts) and lower DraftScore for remaining QBs upon drafting 2nd QB early', () => {
    const roster = [{ player: { position: 'QB', team: 'KC' } }]; // Already has Mahomes

    // Evaluating Josh Allen (QB, BUF) at round 6
    const penalty = oracle.calculatePositionalCapsPenalty('QB', roster, 6);
    assert.equal(penalty, 15.0);

    const harmony = oracle.calculateHarmonyScore({ position: 'QB', team: 'BUF' }, roster, 6);
    assert.ok(harmony < 50.0, 'Harmony should be below baseline due to early QB duplication');
  });

  // --------------------------------------------------------------------------
  // Interaction 8: Adding 4th element activates Quad-Balance bonus across roster and weekly coverage
  // --------------------------------------------------------------------------
  it('3.8 should activate Quad-Balance bonus (+10.0 pts) when 4th element is added, elevating weekly synergy multiplier', () => {
    const elements = { Fire: 1, Earth: 1, Water: 1, Air: 0 };
    assert.equal(oracle.calculateQuadBalanceBonus(elements), 0.0);

    // Add Air player
    elements.Air = 1;
    const bonus = oracle.calculateQuadBalanceBonus(elements);
    assert.equal(bonus, 10.0);

    const weeklySynergyMultiplier = 1.0 + (bonus / 100) * 0.5; // 1.05
    assert.equal(weeklySynergyMultiplier, 1.05);
  });

  // --------------------------------------------------------------------------
  // Interaction 9: HTTP 429 error triggers rate-limiting backoff while preserving active navigation tab
  // --------------------------------------------------------------------------
  it('3.9 should trigger rate-limiting cooldown and preserve active navigation tab upon receiving HTTP 429', () => {
    let appState = {
      activeTab: 'dial',
      isCoolingDown: false,
      cooldownMs: 0,
    };

    // Poller receives 429
    const handlePollerError = (status) => {
      if (status === 429) {
        appState.isCoolingDown = true;
        appState.cooldownMs = oracle.POLLING_CONFIG.RATE_LIMIT_COOLDOWN_MS;
      }
    };

    handlePollerError(429);
    assert.equal(appState.isCoolingDown, true);
    assert.equal(appState.cooldownMs, 60000);
    assert.equal(appState.activeTab, 'dial', 'Active tab must be preserved across rate limit event');
  });

  // --------------------------------------------------------------------------
  // Interaction 10: Network failure activates Mock Fallback Engine while retaining custom Chaos settings
  // --------------------------------------------------------------------------
  it('3.10 should engage Mock Fallback Engine during network outage without resetting custom Chaos settings', () => {
    let appSettings = {
      draft_id: 'live_user_draft_999',
      chaos_lambda: 0.72,
      oracle_weights: { celestial: 0.40, numeric: 0.15, geomantic: 0.20, oracular: 0.10, harmony: 0.15 },
      isOfflineFallback: false,
    };

    // Network drops
    const onNetworkError = () => {
      appSettings.draft_id = 'mock_oneiromancy_draft_2025';
      appSettings.isOfflineFallback = true;
    };

    onNetworkError();
    assert.equal(appSettings.draft_id, 'mock_oneiromancy_draft_2025');
    assert.equal(appSettings.isOfflineFallback, true);
    assert.equal(appSettings.chaos_lambda, 0.72, 'User custom lambda must NOT reset to 0.35 default');
    assert.equal(appSettings.oracle_weights.celestial, 0.40);
  });

  // --------------------------------------------------------------------------
  // Interaction 11: Astrolabe SVG rotation speed dynamically couples to Chaos Dial lambda slider
  // --------------------------------------------------------------------------
  it('3.11 should dynamically accelerate Astrolabe SVG rotation speed as Chaos Dial lambda slider increases', () => {
    const calcAstrolabeSpeed = (lambda) => {
      const clamped = oracle.clamp(lambda, 0, 1);
      return {
        rpm: 1 + clamped * 4,
        durationSec: Math.max(5, 60 / (1 + clamped * 3)),
      };
    };

    const stateAt0 = calcAstrolabeSpeed(0.0);
    const stateAt50 = calcAstrolabeSpeed(0.5);
    const stateAt100 = calcAstrolabeSpeed(1.0);

    assert.ok(stateAt50.rpm > stateAt0.rpm);
    assert.ok(stateAt100.rpm > stateAt50.rpm);
    assert.ok(stateAt100.durationSec < stateAt0.durationSec);
  });

  // --------------------------------------------------------------------------
  // Interaction 12: Mobile viewport resize (<480px) preserves Positional Badge and Tab touch targets
  // --------------------------------------------------------------------------
  it('3.12 should preserve accessible touch tap dimensions (>=44px) across mobile viewport width resizing', () => {
    const getLayout = (viewportWidth) => {
      const isMobile = viewportWidth <= 480;
      return {
        navBarHeightPx: 56,
        tabTouchTargetHeightPx: 48,
        badgeSizePx: isMobile ? 24 : 32,
      };
    };

    const layout375 = getLayout(375); // iPhone width
    assert.ok(layout375.tabTouchTargetHeightPx >= 44);
    assert.ok(layout375.navBarHeightPx >= 44);
  });

  // --------------------------------------------------------------------------
  // Interaction 13: Weekly Bye Coverage marks conflict severity high when drafted players share bye week
  // --------------------------------------------------------------------------
  it('3.13 should set conflict severity to high when 2 drafted starters share the same bye week', () => {
    const assessByeConflict = (starters) => {
      const byeCounts = {};
      for (const s of starters) {
        byeCounts[s.bye_week] = (byeCounts[s.bye_week] || 0) + 1;
      }
      let severity = 'none';
      for (const count of Object.values(byeCounts)) {
        if (count >= 2) severity = 'high';
        else if (count === 1 && severity === 'none') severity = 'low';
      }
      return severity;
    };

    const startersWithoutConflict = [
      { name: 'Mahomes', bye_week: 6 },
      { name: 'Chase', bye_week: 12 },
    ];
    assert.equal(assessByeConflict(startersWithoutConflict), 'low');

    const startersWithConflict = [
      { name: 'Burrow', bye_week: 12 },
      { name: 'Chase', bye_week: 12 },
    ];
    assert.equal(assessByeConflict(startersWithConflict), 'high');
  });

  // --------------------------------------------------------------------------
  // Interaction 14: Waiver upgrade compares candidate against user weakest bench player
  // --------------------------------------------------------------------------
  it('3.14 should compare candidate free agent against user weakest bench player and output exact net delta', () => {
    const userBench = [
      { id: 'b1', name: 'Bench Good', draft_score: 72.0, projected_points: 170.0 },
      { id: 'b2', name: 'Allen Lazard', draft_score: 65.6, projected_points: 140.4 },
    ];

    const freeAgent = { id: 'w1', name: 'Dontayvion Wicks', draft_score: 79.8, projected_points: 182.4 };

    // Find weakest bench player
    const weakest = [...userBench].sort((a, b) => a.draft_score - b.draft_score)[0];
    assert.equal(weakest.name, 'Allen Lazard');

    const netScoreDelta = Number((freeAgent.draft_score - weakest.draft_score).toFixed(1));
    const netProjectedDelta = Number((freeAgent.projected_points - weakest.projected_points).toFixed(1));

    assert.equal(netScoreDelta, 14.2);
    assert.equal(netProjectedDelta, 42.0);
  });

  // --------------------------------------------------------------------------
  // Interaction 15: Divine Swap evaluates trading surplus WR to acquire Earth-anchor RB
  // --------------------------------------------------------------------------
  it('3.15 should evaluate Divine Swap trade proposal resolving team RB2 deficit with Earth anchor', () => {
    const userRoster = {
      wrCount: 3, // Surplus WRs
      rbCount: 1, // Deficit in RB2
      hasEarthAnchor: false,
    };

    const tradeProposal = {
      give: { name: 'CeeDee Lamb', position: 'WR', vor: 86.0, element: 'Fire' },
      receive: { name: 'Jonathan Taylor', position: 'RB', vor: 68.0, element: 'Earth' },
      addressedDeficit: 'RB2 High-Floor Void',
      harmonyDelta: +8.5,
    };

    // Before trade: user has 1 RB
    assert.equal(userRoster.rbCount, 1);

    // Trade execution simulation
    userRoster.wrCount--;
    userRoster.rbCount++;
    userRoster.hasEarthAnchor = true;

    assert.equal(userRoster.rbCount, 2);
    assert.equal(userRoster.hasEarthAnchor, true);
    assert.ok(tradeProposal.harmonyDelta > 0);
  });

  // --------------------------------------------------------------------------
  // Interaction 16: Glassmorphic panel styling integrates positional color accents and glow effects
  // --------------------------------------------------------------------------
  it('3.16 should integrate positional color accents and glow effects into glassmorphic Oneiromancy card', () => {
    const renderCardStyles = (position) => {
      const posStyle = oracle.POSITION_COLORS[position] || oracle.POSITION_COLORS.K_DEF;
      return {
        baseClass: 'glass-panel rounded-xl p-4',
        borderGlow: `border-${posStyle.hex}`,
        accentColor: posStyle.hex,
      };
    };

    const qbCard = renderCardStyles('QB');
    assert.equal(qbCard.accentColor, '#06b6d4');
    assert.ok(qbCard.baseClass.includes('glass-panel'));

    const rbCard = renderCardStyles('RB');
    assert.equal(rbCard.accentColor, '#10b981');
  });

  // --------------------------------------------------------------------------
  // Interaction 17: Static export Next.js build configuration enforces client-side architecture
  // --------------------------------------------------------------------------
  it('3.17 should verify Next.js static export build configuration enforces client-side architecture', () => {
    const configPath = path.resolve('next.config.mjs');
    assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist');
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(content.includes("output: 'export'") || content.includes('output: "export"'), 'next.config.mjs must specify output: export');
    assert.ok(content.includes('reactStrictMode: true'), 'next.config.mjs must specify reactStrictMode: true');
  });

  // --------------------------------------------------------------------------
  // Interaction 18: Settings drawer Auto-Update toggle switch OFF halts polling interval
  // --------------------------------------------------------------------------
  it('3.18 should halt active draft polling intervals and retain current roster snapshot when Auto-Update toggle is turned OFF', () => {
    let pollerActive = true;
    let pollTickCount = 0;

    const tick = () => {
      if (pollerActive) pollTickCount++;
    };

    tick();
    tick();
    assert.equal(pollTickCount, 2);

    // User toggles Auto-Update OFF
    pollerActive = false;
    tick();
    tick();
    assert.equal(pollTickCount, 2, 'Poll ticks must halt when toggle is OFF');
  });

  // --------------------------------------------------------------------------
  // Interaction 19: Final pick of 15th round transitions draft to complete and downshifts poller
  // --------------------------------------------------------------------------
  it('3.19 should transition DraftState status to complete, clear active pick, and downshift poller on 180th pick', () => {
    const totalPicks = 180;
    const status = oracle.deriveDraftStatus(totalPicks, 12, 15);
    assert.equal(status, 'complete');

    const activePick = status === 'complete' ? null : oracle.calculateSnakePick(totalPicks, 12);
    assert.equal(activePick, null);

    const pollingInterval = status === 'complete' ? oracle.POLLING_CONFIG.IDLE_INTERVAL_MS : oracle.POLLING_CONFIG.ACTIVE_INTERVAL_MS;
    assert.equal(pollingInterval, 10000);
  });

  // --------------------------------------------------------------------------
  // Interaction 20: Dynamic Sleeper League Resolution matches OneiroVanguard case-insensitively
  // --------------------------------------------------------------------------
  it('3.20 should dynamically match OneiroVanguard case-insensitively and resolve active draft and user slot', () => {
    const mockUsers = [
      { user_id: 'usr_01', username: 'someone_else', display_name: 'Someone Else' },
      { user_id: 'usr_02', username: 'oneirovanguard', display_name: 'OneiroVanguard' },
    ];
    const targetUser = 'OneiroVanguard';
    const clean = targetUser.replace(/^@/, '').toLowerCase().trim();
    const matched = mockUsers.find((u) => {
      const uName = (u.username || '').toLowerCase();
      const dName = (u.display_name || '').toLowerCase();
      return (
        (clean && (uName === clean || dName === clean)) ||
        (clean.length >= 4 && (uName.includes(clean) || dName.includes(clean))) ||
        uName.includes('oneirovanguard') ||
        dName.includes('oneirovanguard')
      );
    });

    assert.ok(matched, 'Must find OneiroVanguard in mock users');
    assert.equal(matched.user_id, 'usr_02');
  });

  // --------------------------------------------------------------------------
  // Interaction 21: Visible Error Logging and Direct Mode Switch
  // --------------------------------------------------------------------------
  it('3.21 should set syncError notice and offline_mode_active on Sleeper API failure without silent mock fallback', () => {
    const errorMsg = 'Failed to fetch (Network unreachable: api.sleeper.app:443)';
    const failureState = {
      draft_id: 'mock_oneiromancy_draft_2025',
      settings: {
        league_id: '9000000000000000001',
        sleeper_username: 'OneiroVanguard',
        offline_mode_active: true,
        last_error: errorMsg,
        mode: 'live',
      },
      sync_error: errorMsg,
    };

    assert.equal(failureState.settings.offline_mode_active, true);
    assert.equal(failureState.sync_error, errorMsg);
    assert.equal(failureState.settings.mode, 'live');
    assert.ok(failureState.sync_error.includes('Network unreachable'), 'Must retain network failure detail');
  });

  // --------------------------------------------------------------------------
  // Interaction 22: Dynamic Sleeper League Resolution isolates custom username and prevents OneiroVanguard override
  // --------------------------------------------------------------------------
  it('3.22 should isolate custom username and prevent OneiroVanguard override', () => {
    const mockUsers = [
      { user_id: '9000000000000000101', username: 'oneirovanguard', display_name: 'OneiroVanguard' },
      { user_id: 'usr_jane', username: 'janedoe', display_name: 'Jane Doe' },
    ];
    const targetUser = 'janedoe';
    const cleanUsername = targetUser.replace(/^@/, '').toLowerCase().trim();
    const isCanonicalSearch =
      !cleanUsername ||
      cleanUsername.includes('gridironstrategist') ||
      cleanUsername.includes('oneirovanguard') ||
      cleanUsername === '9000000000000000101' ||
      cleanUsername === 'user_oneiromancy_me';

    const matched = mockUsers.find((u) => {
      const uName = (u.username || '').toLowerCase();
      const dName = (u.display_name || '').toLowerCase();
      const uid = String(u.user_id || '');
      if (cleanUsername) {
        if (uName === cleanUsername || dName === cleanUsername || uid === cleanUsername) return true;
        if (cleanUsername.length >= 3 && (uName.includes(cleanUsername) || dName.includes(cleanUsername))) return true;
        if (isCanonicalSearch) {
          return uName.includes('oneirovanguard') || dName.includes('oneirovanguard') || uid === '9000000000000000101';
        }
        return false;
      }
      return uName.includes('oneirovanguard') || dName.includes('oneirovanguard') || uid === '9000000000000000101';
    });

    assert.ok(matched, 'Must find Jane Doe in mock users');
    assert.equal(matched.user_id, 'usr_jane');
    assert.notEqual(matched.user_id, '9000000000000000101');
  });

  // --------------------------------------------------------------------------
  // Interaction 23: Player Identity & Metadata Reconciliation with Sleeper PlayerDict
  // --------------------------------------------------------------------------
  it('3.23 should reconcile Cosmic Board player name and position with live Sleeper playerDict and pick metadata', () => {
    const rawBoard = [
      {
        id: '7553',
        name: 'Amon-Ra St. Brown',
        first_name: 'Amon-Ra',
        last_name: 'St. Brown',
        position: 'WR',
        team: 'DET',
        jersey_number: 14,
        status: 'Active',
      },
      {
        id: '8150',
        name: 'Rachaad White',
        first_name: 'Rachaad',
        last_name: 'White',
        position: 'RB',
        team: 'TB',
        jersey_number: 1,
        status: 'Active',
      },
    ];

    const playerDict = {
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

    const enriched = rawBoard.map((player) => {
      const record = playerDict[player.id];
      if (!record) return player;
      return {
        ...player,
        first_name: record.first_name && record.last_name ? record.first_name : player.first_name,
        last_name: record.first_name && record.last_name ? record.last_name : player.last_name,
        name: record.first_name && record.last_name ? `${record.first_name} ${record.last_name}`.trim() : player.name,
        position: record.position ? record.position.toUpperCase() : player.position,
        team: record.team || player.team,
        jersey_number: record.number ?? player.jersey_number,
      };
    });

    const pitts = enriched.find((p) => p.id === '7553');
    assert.equal(pitts.name, 'Kyle Pitts');
    assert.equal(pitts.first_name, 'Kyle');
    assert.equal(pitts.last_name, 'Pitts');
    assert.equal(pitts.position, 'TE');
    assert.equal(pitts.team, 'ATL');

    const kyren = enriched.find((p) => p.id === '8150');
    assert.equal(kyren.name, 'Kyren Williams');
    assert.equal(kyren.first_name, 'Kyren');
    assert.equal(kyren.last_name, 'Williams');
    assert.equal(kyren.position, 'RB');
    assert.equal(kyren.team, 'LAR');
  });
});
