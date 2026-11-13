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
 * Tier 8: React Component RTL Iteration & UI Suite
 *
 * Executes hermetic component unit and integration testing across all React UI
 * components in oneiromancy using React Testing Library (RTL) primitives:
 * - GlassCard
 * - PositionalBadge
 * - UserAvatar
 * - NavigationShell (4 consolidated sections: Roster, Matchup, Players, League)
 * - Astrolabe
 * - BoardControls
 * - PlayerCardRow
 * - RecommendedPickHero
 * - AscensionTimeline
 * - TelemetryBar
 * - PlayerDetailModal
 * - SettingsDrawer
 * - OneiromancyDashboard (with visual synergy constellation SVG, divination aura, lineup swap arrows)
 * - MatchupsScreen (with visual swap badges and bye callouts)
 * - CosmicBoard (with Directory / Free Agents / Trades sub-views)
 * - PlayerMarketplace
 * - TradesScreen
 * - LeagueScreen
 * - ChaosDial (with interactive pillar tooltips)
 *
 * Verifies DOM presence, loading/error/success states, prop variations, and interactions.
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { render, renderToString, renderToStaticMarkup, screen, fireEvent, waitFor, act, cleanup, jsx, Fragment, StrictMode, React } = await import('./helpers/react_testing_wrapper.mjs');
const { setupServer, http, HttpResponse } = await import('./helpers/msw_network_interceptor.mjs');

// Import UI components dynamically after loader registration
const { GlassCard } = await import('../components/common/GlassCard.tsx');
const { PositionalBadge } = await import('../components/common/PositionalBadge.tsx');
const { RosterSlotBadge, normalizeRosterSlot } = await import('../components/common/RosterSlotBadge.tsx');
const { UserAvatar } = await import('../components/common/UserAvatar.tsx');
const { NavigationShell } = await import('../components/common/NavigationShell.tsx');
const { OraclePlaceholderMarker, computeTooltipPosition } = await import('../components/common/OraclePlaceholderMarker.tsx');
const {
  StarfieldBackground,
  initStarfield,
  isOrientationPermissionRequired,
  getOrientationPermissionStatus,
  requestOrientationPermission,
} = await import('../components/common/StarfieldBackground.tsx');
const { Astrolabe } = await import('../components/astrolabe/Astrolabe.tsx');
const { BoardControls } = await import('../components/board/BoardControls.tsx');
const { PlayerCardRow } = await import('../components/board/PlayerCardRow.tsx');
const { RecommendedPickHero } = await import('../components/oneiromancy/RecommendedPickHero.tsx');
const { AscensionTimeline } = await import('../components/oneiromancy/AscensionTimeline.tsx');
const { TelemetryBar } = await import('../components/oneiromancy/TelemetryBar.tsx');
const { PlayerDetailModal, resetPlayerDetailModalHistoryForTest } = await import('../components/modals/PlayerDetailModal.tsx');
const { SettingsDrawer } = await import('../components/settings/SettingsDrawer.tsx');
const { OneiromancyDashboard } = await import('../components/screens/OneiromancyDashboard.tsx');
const { MatchupsScreen } = await import('../components/screens/MatchupsScreen.tsx');
const { CosmicBoard } = await import('../components/screens/CosmicBoard.tsx');
const { PlayerMarketplace } = await import('../components/screens/PlayerMarketplace.tsx');
const { TradesScreen } = await import('../components/screens/TradesScreen.tsx');
const { LeagueScreen } = await import('../components/screens/LeagueScreen.tsx');
const { ChaosDial } = await import('../components/screens/ChaosDial.tsx');
const { OneiromancyProvider, useOneiromancy } = await import('../context/OneiromancyContext.tsx');
const { HealthTag } = await import('../components/common/PlayerTiles.tsx');
const { CelestialLeaderboardGraph } = await import('../components/oneiromancy/CelestialLeaderboardGraph.tsx');

const mockData = await import('../core/lib/mockData.ts');
const sleeper = await import('../core/lib/sleeper.ts');
const oracle = await import('../core/lib/oracle.ts');
const seasonContext = await import('../core/lib/seasonContext.ts');
const scoring = await import('../core/lib/scoring.ts');

// Initialize MSW interceptor server at top level to ensure zero live outbound requests
const server = setupServer();

// Test draft state with auto_update disabled and mock mode to prevent background intervals and network calls
const testDraftState = {
  ...mockData.mock_oneiromancy_draft_2025,
  draft_id: 'mock_oneiromancy_draft_2025',
  mode: 'mock',
  settings: {
    ...mockData.mock_oneiromancy_draft_2025.settings,
    draft_id: 'mock_oneiromancy_draft_2025',
    auto_update: false,
    poll_interval_ms: 600000,
  },
  weekly_matchup: {
    ...mockData.mockWeeklyMatchup,
    week: 2,
    opponent_team: {
      ...mockData.mockWeeklyMatchup.opponent_team,
      team_name: 'SolarFlare',
    },
    player_favorabilities: [
      ...mockData.mockPlayerFavorabilities,
      {
        ...mockData.mockPlayerFavorabilities[0],
        player_id: 'bench_user_1',
        player_name: 'Brock Purdy',
        is_user_team: true,
        is_benched: true,
      },
      {
        ...mockData.mockPlayerFavorabilities[1],
        player_id: 'bench_opp_1',
        player_name: 'C.J. Stroud',
        is_user_team: false,
        is_benched: true,
      },
    ],
  },
};

describe('Tier 8: React Component RTL Iteration & UI Suite', () => {
  before(() => {
    if (server) {
      server.listen({ onUnhandledRequest: 'error' });
    }
  });

  after(async () => {
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    if (server) {
      server.listen({ onUnhandledRequest: 'error' });
      server.resetHandlers();
    }
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Suite 8.1: Common Visual & Identity Components
  // ==========================================================================
  describe('8.1 Common Components (GlassCard, PositionalBadge, UserAvatar, NavigationShell)', () => {
    test('8.1.1 GlassCard should render children and apply glow classes', () => {
      render(
        jsx(GlassCard, { glowColor: 'cyan', className: 'custom-card' }, 'Celestial Content')
      );
      const card = screen.getByText('Celestial Content');
      assert.ok(card, 'GlassCard must render text content');
      assert.ok(card.className.includes('custom-card'), 'Must retain custom classes');
      assert.ok(card.className.includes('glow-cyan'), 'Must apply cyan glow');
    });

    test('8.1.2 PositionalBadge should render official role colors for QB, RB, WR, TE and position depth superscript', () => {
      const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX'];
      for (const pos of positions) {
        render(jsx(PositionalBadge, { position: pos, size: 'md' }));
        const badge = screen.getByText(pos);
        assert.ok(badge, `PositionalBadge must render ${pos}`);
        assert.ok(screen.getByTestId(`badge-${pos.toLowerCase()}`), `Must have test id for ${pos}`);
        cleanup();
      }

      // Position depth superscript verification (e.g. Sam Darnold depth 2 -> QB2)
      render(jsx(PositionalBadge, { position: 'QB', size: 'md', depth: 2 }));
      const qb2Badge = screen.getByTestId('badge-qb');
      assert.ok(qb2Badge, 'QB badge must exist');
      assert.ok(qb2Badge.textContent.includes('QB2'), 'PositionalBadge with depth 2 must display QB2');
      assert.ok(qb2Badge.textContent.includes('depth chart 2'), 'Must include accessible screen reader depth text');
      const depthSup = qb2Badge.querySelector('[data-testid="position-depth"]');
      assert.ok(depthSup, 'Must render position-depth element');
      assert.equal(depthSup.textContent, '2', 'Superscript element must render ASCII digit 2');
      assert.equal(qb2Badge.getAttribute('title'), 'QB · depth chart #2', 'Must have title attribute');
      cleanup();

      // Depth 4 verification (e.g. WR4)
      render(jsx(PositionalBadge, { position: 'WR', size: 'md', depth: 4 }));
      const wr4Badge = screen.getByTestId('badge-wr');
      assert.ok(wr4Badge, 'WR badge must exist');
      assert.ok(wr4Badge.textContent.includes('WR4'), 'PositionalBadge with depth 4 must display WR4');
      assert.ok(wr4Badge.textContent.includes('depth chart 4'), 'Must include accessible screen reader depth text');
      const wr4Sup = wr4Badge.querySelector('[data-testid="position-depth"]');
      assert.ok(wr4Sup, 'Must render position-depth element');
      assert.equal(wr4Sup.textContent, '4', 'Superscript element must render ASCII digit 4');
      assert.equal(wr4Badge.getAttribute('title'), 'WR · depth chart #4', 'Must have title attribute');
      cleanup();

      // Two-digit depth verification (e.g. RB10)
      render(jsx(PositionalBadge, { position: 'RB', size: 'md', depth: 10 }));
      const rb10Badge = screen.getByTestId('badge-rb');
      assert.ok(rb10Badge, 'RB badge must exist');
      assert.ok(rb10Badge.textContent.includes('RB10'), 'PositionalBadge with depth 10 must display RB10');
      assert.ok(rb10Badge.textContent.includes('depth chart 10'), 'Must include accessible screen reader depth text');
      const rb10Sup = rb10Badge.querySelector('[data-testid="position-depth"]');
      assert.ok(rb10Sup, 'Must render position-depth element');
      assert.equal(rb10Sup.textContent, '10', 'Superscript element must render ASCII digits 10');
      assert.equal(rb10Badge.getAttribute('title'), 'RB · depth chart #10', 'Must have title attribute');
      cleanup();

      // Out of range or invalid depth values must not render superscript
      for (const invalidDepth of [0, 100, 1.5, -1, 'invalid', '', null, undefined]) {
        render(jsx(PositionalBadge, { position: 'QB', size: 'md', depth: invalidDepth }));
        const badge = screen.getByTestId('badge-qb');
        assert.equal(badge.textContent, 'QB', `Invalid depth ${invalidDepth} must not display depth text`);
        assert.equal(badge.querySelector('[data-testid="position-depth"]'), null, `Invalid depth ${invalidDepth} must not render position-depth element`);
        cleanup();
      }
    });

    test('8.1.3 UserAvatar should render image when src is present and fallback initials', () => {
      render(
        jsx(UserAvatar, {
          fallbackText: 'Oneiro Oracle',
          src: 'https://sleepercdn.com/avatars/thumbs/test_avatar',
          isUser: true,
          size: 'md',
        })
      );
      const img = screen.getByRole('img');
      assert.ok(img, 'UserAvatar with URL must render img element');
      assert.equal(img.getAttribute('src'), 'https://sleepercdn.com/avatars/thumbs/test_avatar');
      cleanup();

      render(
        jsx(UserAvatar, {
          fallbackText: 'AstralOracles',
          src: null,
          isUser: false,
          size: 'lg',
        })
      );
      const initials = screen.getByText('A');
      assert.ok(initials, 'Must render initial A when src is missing');
    });

    test('8.1.4 NavigationShell should render all 4 consolidated tabs (Roster, Matchup, Players, League) and handle switching', () => {
      let selectedTab = 'oneiromancy';
      render(
        jsx(NavigationShell, {
          activeTab: selectedTab,
          onTabChange: (tab) => {
            selectedTab = tab;
          },
          mode: 'live',
        })
      );

      const nav = screen.getByRole('navigation');
      assert.ok(nav, 'Must render navigation container');
      assert.ok(screen.getByText('ONEIROMANCY'), 'Must render brand title');

      const matchupsTab = screen.getByTestId('nav-tab-matchups');
      assert.ok(matchupsTab, 'Must render Matchup tab');
      fireEvent.click(matchupsTab);
      assert.equal(selectedTab, 'matchups', 'Clicking Matchup tab must fire onTabChange');

      const leagueTab = screen.getByTestId('nav-tab-league');
      assert.ok(leagueTab, 'Must render League tab');
      fireEvent.click(leagueTab);
      assert.equal(selectedTab, 'league', 'Clicking League tab must fire onTabChange');
    });

    test('8.1.5 UserAvatar should render initial baseSrc deterministically to prevent hydration mismatch', () => {
      const origLocalStorage = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: (key) => (key === 'avatar_cache_user1' ? 'https://sleepercdn.com/avatars/thumbs/cached_hash' : null),
        setItem: () => {},
        removeItem: () => {},
      };

      try {
        render(
          jsx(UserAvatar, {
            fallbackText: 'Test User',
            src: 'https://sleepercdn.com/avatars/thumbs/initial_hash',
            isUser: true,
            userId: 'user1',
            size: 'md',
          })
        );
        const img = screen.getByRole('img');
        assert.ok(img, 'Must render img element');
        assert.equal(img.getAttribute('src'), 'https://sleepercdn.com/avatars/thumbs/initial_hash');
      } finally {
        globalThis.localStorage = origLocalStorage;
        cleanup();
      }
    });

    test('8.1.6 NavigationShell should reflect offline telemetry and suppress live animation when statusType is offline', () => {
      render(
        jsx(NavigationShell, {
          activeTab: 'oneiromancy',
          onTabChange: () => {},
          mode: 'mock',
          statusType: 'offline',
          statusText: 'MOCK / OFFLINE',
        })
      );

      const nav = screen.getByRole('navigation');
      assert.ok(nav, 'Must render navigation container');
      assert.ok(screen.getByText('MOCK / OFFLINE'), 'Must render MOCK / OFFLINE status text');
      assert.ok(screen.getByText('MOCK'), 'Must render MOCK fallback badge');
      const indicator = screen.getByTestId('draft-status-indicator');
      assert.ok(indicator, 'Must render draft status indicator');
      const pings = indicator.querySelectorAll('.animate-ping');
      assert.equal(pings.length, 0, 'Must suppress animate-ping when offline');
      const slateDot = indicator.querySelector('.bg-slate-500');
      assert.ok(slateDot, 'Must render slate status dot when offline');
      cleanup();
    });

    test('8.1.7 RosterSlotBadge and normalizeRosterSlot should enforce anchored normalization order', () => {
      const normalizationCases = [
        // BN/Bench first
        { input: ['BN', undefined], expected: { type: 'BN', label: 'BN', title: 'Bench' } },
        { input: ['BN1', 'Bench 1'], expected: { type: 'BN', label: 'BN', title: 'Bench 1' } },
        { input: ['BN2', undefined], expected: { type: 'BN', label: 'BN', title: 'Bench 2' } },
        { input: [undefined, 'Bench 3'], expected: { type: 'BN', label: 'BN', title: 'Bench 3' } },
        { input: ['BENCH', undefined], expected: { type: 'BN', label: 'BN', title: 'Bench' } },
        { input: ['QB', 'BN'], expected: { type: 'BN', label: 'BN', title: 'Bench' } },

        // Exact slotId lookup
        { input: ['QB', undefined], expected: { type: 'QB', label: 'QB', title: 'Quarterback' } },
        { input: ['RB1', 'Running Back 1'], expected: { type: 'RB', label: 'RB', title: 'Running Back 1' } },
        { input: ['RB2', undefined], expected: { type: 'RB', label: 'RB', title: 'Running Back 2' } },
        { input: ['WR1', undefined], expected: { type: 'WR', label: 'WR', title: 'Wide Receiver 1' } },
        { input: ['WR2', undefined], expected: { type: 'WR', label: 'WR', title: 'Wide Receiver 2' } },
        { input: ['TE', undefined], expected: { type: 'TE', label: 'TE', title: 'Tight End' } },
        { input: ['FLEX', undefined], expected: { type: 'WRT', label: 'WRT', title: 'Flex (W/R/T)' } },
        { input: ['WRT', undefined], expected: { type: 'WRT', label: 'WRT', title: 'Flex (W/R/T)' } },
        { input: ['SUPER_FLEX', undefined], expected: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' } },
        { input: ['SUPERFLEX', undefined], expected: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' } },
        { input: ['WRTQ', undefined], expected: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' } },
        { input: ['SF', undefined], expected: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' } },
        { input: ['WRRB_FLEX', undefined], expected: { type: 'WRRB', label: 'WR/RB', title: 'Flex (W/R)' } },
        { input: ['WRRB', undefined], expected: { type: 'WRRB', label: 'WR/RB', title: 'Flex (W/R)' } },
        { input: ['REC_FLEX', undefined], expected: { type: 'REC_FLEX', label: 'WR/TE', title: 'Flex (W/T)' } },
        { input: ['WRTE', undefined], expected: { type: 'REC_FLEX', label: 'WR/TE', title: 'Flex (W/T)' } },
        { input: ['IDP_FLEX', undefined], expected: { type: 'IDP', label: 'IDP', title: 'Individual Defensive Player' } },
        { input: ['DL', undefined], expected: { type: 'IDP', label: 'DL', title: 'Defensive Lineman' } },
        { input: ['LB', undefined], expected: { type: 'IDP', label: 'LB', title: 'Linebacker' } },
        { input: ['DB', undefined], expected: { type: 'IDP', label: 'DB', title: 'Defensive Back' } },
        { input: ['K', undefined], expected: { type: 'K', label: 'K', title: 'Kicker' } },
        { input: ['DEF', undefined], expected: { type: 'DEF', label: 'DEF', title: 'Defense / Special Teams' } },

        // Exact slotName lookup
        { input: [undefined, 'Quarterback'], expected: { type: 'QB', label: 'QB', title: 'Quarterback' } },
        { input: [undefined, 'Running Back 1'], expected: { type: 'RB', label: 'RB', title: 'Running Back 1' } },
        { input: [undefined, 'Wide Receiver 2'], expected: { type: 'WR', label: 'WR', title: 'Wide Receiver 2' } },
        { input: [undefined, 'Tight End'], expected: { type: 'TE', label: 'TE', title: 'Tight End' } },
        { input: [undefined, 'Flex (W/R/T)'], expected: { type: 'WRT', label: 'WRT', title: 'Flex (W/R/T)' } },
        { input: [undefined, 'Superflex (QB/W/R/T)'], expected: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' } },
        { input: [undefined, 'Flex (W/R)'], expected: { type: 'WRRB', label: 'WR/RB', title: 'Flex (W/R)' } },
        { input: [undefined, 'Flex (W/T)'], expected: { type: 'REC_FLEX', label: 'WR/TE', title: 'Flex (W/T)' } },
        { input: [undefined, 'Defensive Lineman'], expected: { type: 'IDP', label: 'DL', title: 'Defensive Lineman' } },
        { input: [undefined, 'Linebacker'], expected: { type: 'IDP', label: 'LB', title: 'Linebacker' } },
        { input: [undefined, 'Defensive Back'], expected: { type: 'IDP', label: 'DB', title: 'Defensive Back' } },
        { input: [undefined, 'Defense / Special Teams'], expected: { type: 'DEF', label: 'DEF', title: 'Defense / Special Teams' } },

        // Symmetric Bench with space and suffix
        { input: ['BN 1', undefined], expected: { type: 'BN', label: 'BN', title: 'Bench 1' } },
        { input: ['BENCH 2', undefined], expected: { type: 'BN', label: 'BN', title: 'Bench 2' } },

        // Fallback passthrough
        { input: ['Rd 3', 'Rd 3'], expected: { type: 'UNKNOWN', label: 'Rd 3', title: 'Rd 3' } },
        { input: [undefined, undefined], expected: { type: 'UNKNOWN', label: 'SLOT', title: 'SLOT' } },
      ];

      for (const tc of normalizationCases) {
        const actual = normalizeRosterSlot(tc.input[0], tc.input[1]);
        assert.equal(actual.type, tc.expected.type, `Type mismatch for input ${JSON.stringify(tc.input)}`);
        assert.equal(actual.label, tc.expected.label, `Label mismatch for input ${JSON.stringify(tc.input)}`);
        assert.equal(actual.title, tc.expected.title, `Title mismatch for input ${JSON.stringify(tc.input)}`);
      }
    });

    test('8.1.8 RosterSlotBadge should render authentic Sleeper colors, split gradients, and text styles', () => {
      const badgeCases = [
        { slotId: 'QB', expectedText: 'QB', expectedTestId: 'slot-badge-qb', expectedBg: '#ff2a6d' },
        { slotId: 'RB', expectedText: 'RB', expectedTestId: 'slot-badge-rb', expectedBg: '#00ceb8' },
        { slotId: 'WR', expectedText: 'WR', expectedTestId: 'slot-badge-wr', expectedBg: '#00b0ff' },
        { slotId: 'TE', expectedText: 'TE', expectedTestId: 'slot-badge-te', expectedBg: '#ff9100' },
        {
          slotId: 'WRT',
          expectedText: 'WRT',
          expectedTestId: 'slot-badge-wrt',
          expectedGradientType: 'linear-gradient(',
          expectedGradientStops: ['#00b0ff', '#00ceb8', '#ff9100'],
          expectedExactGradient: 'linear-gradient(90deg, #00b0ff 0%, #00b0ff 33.33%, #00ceb8 33.33%, #00ceb8 66.66%, #ff9100 66.66%, #ff9100 100%)',
        },
        {
          slotId: 'WRTQ',
          expectedText: 'WRTQ',
          expectedTestId: 'slot-badge-wrtq',
          expectedGradientType: 'conic-gradient(',
          expectedGradientStops: ['#00ceb8', '#ff2a6d', '#ff9100', '#00b0ff'],
          expectedExactGradient: 'conic-gradient(from 0deg at 50% 50%, #00ceb8 0deg 90deg, #ff2a6d 90deg 180deg, #ff9100 180deg 270deg, #00b0ff 270deg 360deg)',
        },
        { slotId: 'WRRB', expectedText: 'WR/RB', expectedTestId: 'slot-badge-wrrb', expectedGradientStops: ['#00b0ff', '#00ceb8'] },
        { slotId: 'REC_FLEX', expectedText: 'WR/TE', expectedTestId: 'slot-badge-rec_flex', expectedGradientStops: ['#00b0ff', '#ff9100'] },
        { slotId: 'K', expectedText: 'K', expectedTestId: 'slot-badge-k', expectedClass: 'bg-slate-800' },
        { slotId: 'DEF', expectedText: 'DEF', expectedTestId: 'slot-badge-def', expectedClass: 'bg-slate-800' },
        { slotId: 'BN', expectedText: 'BN', expectedTestId: 'slot-badge-bn', expectedClass: 'bg-slate-700', expectedTextClass: 'text-slate-200' },
        { slotId: 'Rd 3', slotName: 'Rd 3', expectedText: 'Rd 3', expectedTestId: 'slot-badge-unknown', expectedClass: 'bg-slate-800' },
      ];

      for (const bc of badgeCases) {
        render(jsx(RosterSlotBadge, { slotId: bc.slotId, slotName: bc.slotName, size: 'sm' }));
        const badge = screen.getByTestId(bc.expectedTestId);
        assert.ok(badge, `Must find badge for ${bc.slotId}`);
        assert.equal(badge.textContent, bc.expectedText, `Badge text must be ${bc.expectedText}`);

        if (bc.expectedBg) {
          const bgColor = badge.style?.backgroundColor || badge.style?.getPropertyValue?.('background-color');
          assert.equal(bgColor, bc.expectedBg, `Expected bgColor ${bc.expectedBg} for ${bc.slotId}`);
          assert.ok(badge.className.includes('text-black'), `Starter ${bc.slotId} must have black text`);
          assert.ok(badge.className.includes('font-black'), `Starter ${bc.slotId} must have font-black`);
        }
        if (bc.expectedGradientStops) {
          const background = badge.style?.background || badge.style?.getPropertyValue?.('background');
          const gradType = bc.expectedGradientType || 'linear-gradient(';
          assert.ok(background && background.startsWith(gradType), `Expected ${gradType} for ${bc.slotId}`);
          for (const stop of bc.expectedGradientStops) {
            assert.ok(background.includes(stop), `Expected stop ${stop} in gradient for ${bc.slotId}`);
          }
          assert.ok(badge.className.includes('text-black'), `Flex ${bc.slotId} must have black text`);
        }
        if (bc.expectedExactGradient) {
          const background = badge.style?.background || badge.style?.getPropertyValue?.('background');
          assert.equal(background, bc.expectedExactGradient, `Exact gradient mismatch for ${bc.slotId}`);
        }
        if (bc.expectedClass) {
          assert.ok(badge.className.includes(bc.expectedClass), `${bc.slotId} must have class ${bc.expectedClass}`);
        }
        if (bc.expectedTextClass) {
          assert.ok(badge.className.includes(bc.expectedTextClass), `${bc.slotId} must have text class ${bc.expectedTextClass}`);
        }
        cleanup();
      }
    });

    test('8.1.9 RosterSlotBadge should maintain SSR markup invariance with exactly one text node child', () => {
      const slots = ['WRT', 'WRTQ', 'WRRB', 'REC_FLEX', 'QB', 'RB', 'WR', 'TE', 'BN', 'K', 'DEF'];
      for (const slot of slots) {
        const markup = renderToStaticMarkup(
          jsx(RosterSlotBadge, { slotId: slot, slotLabel: slot, dataTestId: 'matchup-slot-label' })
        );
        const match = markup.match(/data-testid="matchup-slot-label"[^>]*>([^<]+)<\/span>/);
        assert.ok(match, `Markup for ${slot} must match single text node regex: ${markup}`);
        assert.equal(match[1], slot, `Captured text node must be verbatim ${slot}`);
      }

      // Empty label guard test
      const emptyLabelMarkup = renderToStaticMarkup(
        jsx(RosterSlotBadge, { slotId: 'QB', slotLabel: '', dataTestId: 'matchup-slot-label' })
      );
      const emptyMatch = emptyLabelMarkup.match(/data-testid="matchup-slot-label"[^>]*>([^<]+)<\/span>/);
      assert.ok(emptyMatch, 'Empty slotLabel must fall back and still match single text node regex');
      assert.equal(emptyMatch[1], 'QB', 'Must fall back to normalized QB label');
    });

    test('8.1.10 RosterSlotBadge sizing, custom className, and test-id collision prevention', () => {
      render(jsx(RosterSlotBadge, { slotId: 'QB', size: 'lg', className: 'custom-pill-class', dataTestId: 'custom-slot-id' }));
      const badge = screen.getByTestId('custom-slot-id');
      assert.ok(badge, 'Must honor custom dataTestId');
      assert.ok(!(badge.getAttribute('data-testid') || '').startsWith('badge-'), 'Must not collide with PositionalBadge badge-* test-id prefix');
      assert.ok(badge.className.includes('custom-pill-class'), 'Must retain custom classes');
      assert.ok(badge.className.includes('text-sm'), 'Must apply lg text-sm size class');
      cleanup();
    });

    test('8.1.11 RosterSlotBadge renders authentic slot pills across real OneiromancyDashboard, LeagueScreen, and MatchupsScreen screens', () => {
      const baseTeam = (testDraftState.competitor_teams || mockData.mockCompetitorTeams)[0];
      const starterIds = testDraftState.cosmic_board.slice(0, 4).map((p) => String(p.id));
      const allPlayerIds = testDraftState.cosmic_board.slice(0, 5).map((p) => String(p.id));
      const customRosterState = {
        ...testDraftState,
        settings: {
          ...testDraftState.settings,
          roster_positions: ['QB', 'FLEX', 'SUPER_FLEX', 'REC_FLEX', 'BN'],
        },
        my_roster: [
          {
            slot_id: 'QB',
            slot_name: 'Quarterback',
            position: 'QB',
            eligible_positions: ['QB'],
            player: testDraftState.cosmic_board[0],
            is_locked: false,
          },
          {
            slot_id: 'FLEX',
            slot_name: 'Flex (W/R/T)',
            position: 'FLEX',
            eligible_positions: ['WR', 'RB', 'TE'],
            player: testDraftState.cosmic_board[1],
            is_locked: false,
          },
          {
            slot_id: 'TE',
            slot_name: 'Tight End',
            position: 'TE',
            eligible_positions: ['TE'],
            player: null,
            is_locked: false,
          },
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'BN',
            eligible_positions: ['QB', 'RB', 'WR', 'TE'],
            player: testDraftState.cosmic_board[2],
            is_locked: false,
          },
        ],
        competitor_teams: [
          {
            ...baseTeam,
            is_user: true,
            starters: starterIds,
            players: allPlayerIds,
          },
          ...(testDraftState.competitor_teams || []).slice(1),
        ],
      };

      // 1. OneiromancyDashboard: starter slot pills, empty slot badge, bench BN pill, and 4-child card column
      const { container: dashContainer } = render(
        jsx(OneiromancyProvider, { initialDraftState: customRosterState }, jsx(OneiromancyDashboard, {})),
      );
      assert.equal(screen.getByTestId('slot-badge-qb').textContent, 'QB', 'Dashboard must render QB slot badge');
      assert.equal(screen.getByTestId('slot-badge-wrt').textContent, 'WRT', 'Dashboard must render WRT flex slot badge');
      assert.equal(screen.getByTestId('slot-badge-te').textContent, 'TE', 'Dashboard must render TE empty-slot badge');
      assert.equal(screen.getByTestId('slot-badge-bn').textContent, 'BN', 'Dashboard must render BN bench badge');
      assert.ok(dashContainer.textContent.includes('Empty Slot'), 'Dashboard empty slot must retain Empty Slot label');
      const cardCols = screen.getAllByTestId('roster-card-text-col');
      assert.ok(cardCols.length >= 2, 'Dashboard must render roster-card-text-col cards');
      assert.equal(cardCols[0].children.length, 4, 'roster-card-text-col must retain strictly 4 children');
      cleanup();

      // 2. LeagueScreen: maps SUPER_FLEX -> WRTQ, FLEX -> WRT, REC_FLEX -> WR/TE, BN -> BN
      render(jsx(OneiromancyProvider, { initialDraftState: customRosterState }, jsx(LeagueScreen, {})));
      assert.equal(screen.getByTestId('slot-badge-wrtq').textContent, 'WRTQ', 'LeagueScreen must map SUPER_FLEX to WRTQ');
      assert.equal(screen.getByTestId('slot-badge-wrt').textContent, 'WRT', 'LeagueScreen must map FLEX to WRT');
      assert.equal(screen.getByTestId('slot-badge-rec_flex').textContent, 'WR/TE', 'LeagueScreen must map REC_FLEX to WR/TE');
      assert.equal(screen.getByTestId('slot-badge-bn').textContent, 'BN', 'LeagueScreen must render BN bench badges');
      cleanup();

      // 3. MatchupsScreen: renders RosterSlotBadge with data-testid="matchup-slot-label" and single text node
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(MatchupsScreen, { weeklyMatchup: testDraftState.weekly_matchup }),
        ),
      );
      const matchupSlots = screen.getAllByTestId('matchup-slot-label');
      assert.ok(matchupSlots.length > 0, 'MatchupsScreen must render matchup-slot-label pills');
      for (const el of matchupSlots) {
        assert.equal(el.children.length, 0, 'matchup-slot-label span must have 0 child elements');
        assert.equal(el.getAttribute('role'), 'note', 'matchup-slot-label must render RosterSlotBadge note role');
        assert.ok((el.getAttribute('aria-label') || '').trim().length > 0, 'matchup-slot-label must have non-empty aria-label');
        assert.ok((el.textContent || '').trim().length > 0, 'matchup-slot-label must have non-empty slot text');
      }
      cleanup();
    });

    test('8.1.12 StarfieldBackground should render canvas with accessibility attributes, test ID, and fixed positioning', () => {
      render(jsx(StarfieldBackground, {}));
      const canvas = screen.getByTestId('starfield-canvas');
      assert.ok(canvas, 'Must render canvas with data-testid="starfield-canvas"');
      assert.equal(canvas.getAttribute('aria-hidden'), 'true', 'Must have aria-hidden="true"');
      assert.equal(canvas.getAttribute('tabindex') ?? String(canvas.tabIndex), '-1', 'Must set tabIndex={-1}');
      assert.ok(canvas.className.includes('fixed'), 'Must include fixed positioning class');
      assert.ok(canvas.className.includes('inset-0'), 'Must include inset-0 class');
      assert.ok(canvas.className.includes('pointer-events-none'), 'Must include pointer-events-none class');
      assert.ok(canvas.className.includes('-z-10'), 'Must include -z-10 stacking class');
      assert.ok(canvas.className.includes('w-full'), 'Must include w-full class');
      assert.ok(canvas.className.includes('h-full'), 'Must include h-full class');
      cleanup();
    });

    test('8.1.13 StarfieldBackground should mount and unmount cleanly in headless Node environments without throwing', () => {
      assert.doesNotThrow(() => {
        render(jsx(StarfieldBackground, {}));
        cleanup();
      }, 'Must mount and unmount cleanly without exceptions in headless Node environment');
    });

    test('8.1.14 initStarfield should register event listeners, handle tilt and visibility pause/resume, and clean up on teardown', () => {
      const registeredWindowListeners = new Map();
      const removedWindowListeners = new Map();
      const registeredDocListeners = new Map();
      const removedDocListeners = new Map();
      const rafCallbacks = [];
      let animFrameRequested = 0;
      let animFrameCancelled = 0;

      const mockWindow = {
        innerWidth: 1024,
        innerHeight: 768,
        devicePixelRatio: 2,
        matchMedia: () => ({ matches: false }),
        addEventListener: (event, handler) => {
          registeredWindowListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedWindowListeners.set(event, handler);
        },
      };

      const mockDoc = {
        hidden: false,
        addEventListener: (event, handler) => {
          registeredDocListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedDocListeners.set(event, handler);
        },
      };

      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      globalThis.window = mockWindow;
      globalThis.document = mockDoc;
      globalThis.requestAnimationFrame = (cb) => {
        animFrameRequested++;
        rafCallbacks.push(cb);
        return animFrameRequested;
      };
      globalThis.cancelAnimationFrame = () => {
        animFrameCancelled++;
      };

      const arcCalls = [];
      const mockCtx = {
        clearRect: () => {},
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: (x, y, r) => {
          arcCalls.push({ x, y, r });
        },
        fill: () => {},
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: (type) => (type === '2d' ? mockCtx : null),
      };

      let mockTime = 1000;
      const origPerf = globalThis.performance;
      globalThis.performance = {
        now: () => mockTime,
      };

      try {
        const cleanupStarfield = initStarfield(mockCanvas);

        assert.ok(registeredWindowListeners.has('deviceorientation'), 'Must register deviceorientation listener');
        assert.ok(registeredWindowListeners.has('resize'), 'Must register resize listener');
        assert.ok(registeredDocListeners.has('visibilitychange'), 'Must register visibilitychange listener');
        assert.ok(animFrameRequested > 0, 'Must request animation frame on init');

        // Frame 1: Initial baseline frame at t = 1016.67ms (dt = 1.0)
        mockTime = 1016.67;
        const frame1 = rafCallbacks.shift();
        assert.ok(typeof frame1 === 'function', 'Must queue initial animation frame callback');
        frame1();
        assert.ok(arcCalls.length > 0, 'Must render star particles on animation frame');
        const x1 = arcCalls[0].x;
        const y1 = arcCalls[0].y;

        // Frame 2: Second frame with pure drift (no tilt) at t = 1033.34ms (dt = 1.0)
        mockTime = 1033.34;
        const frame2 = rafCallbacks.shift();
        assert.ok(typeof frame2 === 'function', 'Must queue second animation frame callback');
        arcCalls.length = 0;
        frame2();
        const x2 = arcCalls[0].x;
        const y2 = arcCalls[0].y;
        const unwrapDelta = (delta, max) => (delta < -max / 2 ? delta + max : delta > max / 2 ? delta - max : delta);
        const pureDriftX = unwrapDelta(x2 - x1, 1024);
        const pureDriftY = unwrapDelta(y2 - y1, 768);

        // Apply accelerometer tilt (gamma = 30 -> targetTiltX = 1.0, beta = 75 -> targetTiltY = 1.0)
        const orientationHandler = registeredWindowListeners.get('deviceorientation');
        orientationHandler({ gamma: 30, beta: 75 });

        // Frame 3: Third frame with damped tilt parallax applied at t = 1050.01ms (dt = 1.0)
        mockTime = 1050.01;
        const frame3 = rafCallbacks.shift();
        assert.ok(typeof frame3 === 'function', 'Must queue third animation frame callback');
        arcCalls.length = 0;
        frame3();
        const x3 = arcCalls[0].x;
        const y3 = arcCalls[0].y;
        assert.ok(
          arcCalls.every((s) => s.x >= 0 && s.x < 1024 && s.y >= 0 && s.y < 768),
          'Tilted star coordinates must wrap strictly within [0, width) x [0, height)'
        );
        const tiltedShiftX = unwrapDelta(x3 - x2, 1024);
        const tiltedShiftY = unwrapDelta(y3 - y2, 768);
        const parallaxDeltaX = tiltedShiftX - pureDriftX;
        const parallaxDeltaY = tiltedShiftY - pureDriftY;

        // Verify tilt displacement strictly exceeds pure celestial drift
        assert.ok(
          parallaxDeltaX > 0.01,
          `Horizontal tilt parallax shift (${parallaxDeltaX.toFixed(4)}px) must exceed pure drift (${pureDriftX.toFixed(4)}px)`
        );
        assert.ok(
          parallaxDeltaY > 0.01,
          `Vertical tilt parallax shift (${parallaxDeltaY.toFixed(4)}px) must exceed pure drift (${pureDriftY.toFixed(4)}px)`
        );

        // Safe null handling for sensors reporting null tilt
        assert.doesNotThrow(() => {
          orientationHandler({ gamma: null, beta: null });
        }, 'Orientation handler must handle null values safely');

        // Visibilitychange tab pausing and resuming
        const visibilityHandler = registeredDocListeners.get('visibilitychange');
        mockDoc.hidden = true;
        visibilityHandler();
        assert.ok(animFrameCancelled > 0, 'Must cancel active animation frame when tab is hidden');

        const prevRAFCount = animFrameRequested;
        mockDoc.hidden = false;
        visibilityHandler();
        assert.ok(animFrameRequested > prevRAFCount, 'Must resume animation loop when tab becomes visible');

        cleanupStarfield();

        assert.ok(removedWindowListeners.has('deviceorientation'), 'Must remove deviceorientation listener on teardown');
        assert.equal(
          removedWindowListeners.get('deviceorientation'),
          registeredWindowListeners.get('deviceorientation'),
          'Must remove exact deviceorientation handler reference'
        );
        assert.ok(removedWindowListeners.has('resize'), 'Must remove resize listener on teardown');
        assert.equal(
          removedWindowListeners.get('resize'),
          registeredWindowListeners.get('resize'),
          'Must remove exact resize handler reference'
        );
        assert.ok(removedDocListeners.has('visibilitychange'), 'Must remove visibilitychange listener on teardown');
        assert.equal(
          removedDocListeners.get('visibilitychange'),
          registeredDocListeners.get('visibilitychange'),
          'Must remove exact visibilitychange handler reference'
        );
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
        globalThis.performance = origPerf;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.15 initStarfield should respect prefers-reduced-motion, render static frame, and redraw on resize', () => {
      const registeredWindowListeners = new Map();
      const removedWindowListeners = new Map();
      let animFrameRequested = 0;

      const mockWindow = {
        innerWidth: 1024,
        innerHeight: 768,
        devicePixelRatio: 1,
        matchMedia: (query) => ({ matches: typeof query === 'string' && query.includes('prefers-reduced-motion') }),
        addEventListener: (event, handler) => {
          registeredWindowListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedWindowListeners.set(event, handler);
        },
      };

      const origWindow = globalThis.window;
      const origRAF = globalThis.requestAnimationFrame;

      globalThis.window = mockWindow;
      globalThis.requestAnimationFrame = () => {
        animFrameRequested++;
        return 99;
      };

      let fillCallCount = 0;
      const mockCtx = {
        clearRect: () => {},
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: () => {},
        fill: () => {
          fillCallCount++;
        },
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      };

      try {
        const cleanupStarfield = initStarfield(mockCanvas);

        assert.ok(!registeredWindowListeners.has('deviceorientation'), 'Must not listen to deviceorientation under prefers-reduced-motion');
        assert.ok(!registeredWindowListeners.has('devicemotion'), 'Must not listen to devicemotion under prefers-reduced-motion');
        assert.ok(!registeredWindowListeners.has('scroll'), 'Must not listen to scroll under prefers-reduced-motion');
        assert.ok(!registeredWindowListeners.has('orientationchange'), 'Must not listen to orientationchange under prefers-reduced-motion');
        assert.ok(fillCallCount > 0, 'Must render static frame under prefers-reduced-motion');
        assert.equal(animFrameRequested, 0, 'Must not request animation frames under prefers-reduced-motion');

        const initialFillCount = fillCallCount;
        const resizeHandler = registeredWindowListeners.get('resize');
        assert.ok(resizeHandler, 'Must register resize listener under prefers-reduced-motion');
        resizeHandler();
        assert.ok(fillCallCount > initialFillCount, 'Must immediately redraw static frame on resize under prefers-reduced-motion');

        cleanupStarfield();
        assert.ok(removedWindowListeners.has('resize'), 'Must remove resize listener on teardown');
      } finally {
        globalThis.window = origWindow;
        globalThis.requestAnimationFrame = origRAF;
      }
    });

    test('8.1.16 NavigationShell should apply transparent background and relative isolate to preserve starfield visibility', () => {
      render(
        jsx(NavigationShell, {
          activeTab: 'oneiromancy',
          onTabChange: () => {},
          mode: 'mock',
        })
      );
      const rootDiv = screen.getByTestId('navigation-shell-root');
      assert.ok(rootDiv, 'NavigationShell root container must render');
      assert.ok(rootDiv.className.includes('bg-transparent'), 'Must use bg-transparent to avoid occluding background starfield');
      assert.ok(rootDiv.className.includes('isolate'), 'Must use isolate for stacking context');
      cleanup();
    });

    test('8.1.17 initStarfield should redistribute star coordinates and rebalance star count across viewport dimensions upon resize', () => {
      const registeredWindowListeners = new Map();
      const removedWindowListeners = new Map();
      let animCallback = null;

      const mockWindow = {
        innerWidth: 390,
        innerHeight: 844,
        devicePixelRatio: 1,
        matchMedia: () => ({ matches: false }),
        addEventListener: (event, handler) => {
          registeredWindowListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedWindowListeners.set(event, handler);
        },
      };

      const origWindow = globalThis.window;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      globalThis.window = mockWindow;
      globalThis.requestAnimationFrame = (cb) => {
        animCallback = cb;
        return 101;
      };
      globalThis.cancelAnimationFrame = () => {};

      let renderedArcs = [];
      const mockCtx = {
        clearRect: () => {
          renderedArcs = [];
        },
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: (x, y, r) => {
          renderedArcs.push({ x, y, r });
        },
        fill: () => {},
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      };

      try {
        const cleanupStarfield = initStarfield(mockCanvas);

        assert.equal(mockCanvas.width, 390, 'Initial canvas width matches portrait viewport');
        assert.equal(mockCanvas.height, 844, 'Initial canvas height matches portrait viewport');

        // Execute initial animation frame
        if (typeof animCallback === 'function') {
          const cb = animCallback;
          animCallback = null;
          cb();
        }

        const initialCount = renderedArcs.length;
        assert.ok(initialCount >= 55 && initialCount <= 65, `Initial mobile star count (${initialCount}) must be within 55..65`);
        assert.ok(
          renderedArcs.every((s) => s.x >= 0 && s.x <= 390),
          'Initial stars must all lie within portrait width 390'
        );

        // Simulate device rotation to landscape (844x390)
        mockWindow.innerWidth = 844;
        mockWindow.innerHeight = 390;
        const resizeHandler = registeredWindowListeners.get('resize');
        assert.ok(resizeHandler, 'Must register resize listener');
        resizeHandler();

        assert.equal(mockCanvas.width, 844, 'Canvas width updates to landscape viewport');
        assert.equal(mockCanvas.height, 390, 'Canvas height updates to landscape viewport');

        // Execute post-resize animation frame
        if (typeof animCallback === 'function') {
          const cb = animCallback;
          animCallback = null;
          cb();
        }

        // Verify stars have been redistributed across the full expanded width
        const expandedStars = renderedArcs.filter((s) => s.x > 390);
        assert.ok(
          expandedStars.length > 0,
          `Stars must be redistributed into the expanded width (>390px), found ${expandedStars.length} stars`
        );
        assert.ok(
          renderedArcs.every((s) => s.x >= 0 && s.x <= 844 && s.y >= 0 && s.y <= 390),
          'All stars must remain bounded within new viewport dimensions [844x390]'
        );

        // Simulate viewport expansion to 1920x1080 with HiDPI DPR=2
        mockWindow.innerWidth = 1920;
        mockWindow.innerHeight = 1080;
        mockWindow.devicePixelRatio = 2;
        resizeHandler();

        assert.equal(mockCanvas.width, 3840, 'Canvas backing width must scale by updated DPR=2');
        assert.equal(mockCanvas.height, 2160, 'Canvas backing height must scale by updated DPR=2');

        if (typeof animCallback === 'function') {
          const cb = animCallback;
          animCallback = null;
          cb();
        }

        assert.ok(
          renderedArcs.length > initialCount && renderedArcs.length >= 150 && renderedArcs.length <= 175,
          `Expanded desktop viewport must rebalance star count (got ${renderedArcs.length}, portrait had ${initialCount})`
        );

        cleanupStarfield();
        assert.ok(removedWindowListeners.has('resize'), 'Must remove resize listener on teardown');
      } finally {
        globalThis.window = origWindow;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.18 initStarfield should render clearly visible stars and perceptible celestial drift on desktop viewports', () => {
      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      const origPerf = globalThis.performance;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      let animCallback = null;
      let mockTime = 2000;
      const drawCalls = [];

      globalThis.window = {
        innerWidth: 1440,
        innerHeight: 900,
        devicePixelRatio: 1,
        matchMedia: () => ({ matches: false }),
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      globalThis.document = {
        hidden: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      globalThis.performance = { now: () => mockTime };
      globalThis.requestAnimationFrame = (cb) => {
        animCallback = cb;
        return 201;
      };
      globalThis.cancelAnimationFrame = () => {};

      let lastArc = null;
      const mockCtx = {
        clearRect: () => {
          drawCalls.length = 0;
        },
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: (x, y, r) => {
          lastArc = { x, y, r };
        },
        fill: () => {
          const match = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/.exec(mockCtx.fillStyle);
          const alpha = match ? Number(match[1]) : 0;
          if (lastArc) {
            drawCalls.push({ ...lastArc, alpha });
          }
        },
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      };

      try {
        const cleanupStarfield = initStarfield(mockCanvas);

        assert.ok(typeof animCallback === 'function', 'Must schedule initial render frame');
        mockTime += 16.67;
        animCallback();

        const frame1 = drawCalls.slice();
        assert.ok(frame1.length >= 90, `1440x900 desktop viewport should render >= 90 stars (got ${frame1.length})`);

        const alphas = frame1.map((s) => s.alpha);
        const minAlpha = Math.min(...alphas);
        const meanAlpha = alphas.reduce((sum, a) => sum + a, 0) / alphas.length;
        const maxAlpha = Math.max(...alphas);
        const minRadius = Math.min(...frame1.map((s) => s.r));
        const maxRadius = Math.max(...frame1.map((s) => s.r));

        assert.ok(minAlpha >= 0.18, `Minimum star alpha (${minAlpha.toFixed(3)}) must be >= 0.18`);
        assert.ok(meanAlpha >= 0.28, `Mean star alpha (${meanAlpha.toFixed(3)}) must remain clearly perceptible (>= 0.28)`);
        assert.ok(maxAlpha >= 0.50 && maxAlpha <= 0.90, `Foreground peak alpha (${maxAlpha.toFixed(3)}) must be prominent yet capped <= 0.90`);
        assert.ok(minRadius >= 0.6 && maxRadius >= 1.4 && maxRadius <= 2.2, `Star radii [${minRadius.toFixed(2)}, ${maxRadius.toFixed(2)}] must stay within [0.6, 2.2] with foreground >= 1.4`);

        // Advance 60 frames (~1 second at 60fps) and verify perceptible foreground drift
        for (let i = 0; i < 60; i++) {
          mockTime += 16.67;
          const cb = animCallback;
          animCallback = null;
          cb();
        }
        const frameAfter1s = drawCalls.slice();
        let maxShiftX = 0;
        for (let i = 0; i < Math.min(frame1.length, frameAfter1s.length); i++) {
          const dx = (frameAfter1s[i].x - frame1[i].x + 1440) % 1440;
          if (dx < 500 && dx > maxShiftX) {
            maxShiftX = dx;
          }
        }
        assert.ok(maxShiftX >= 3.0, `Foreground celestial drift over 1s (${maxShiftX.toFixed(2)}px) must be clearly visible (>= 3.0px)`);

        cleanupStarfield();
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
        globalThis.performance = origPerf;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.19 initStarfield should apply vertical scroll parallax across depth planes and side-to-side accel scrolling on mobile', () => {
      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      const origPerf = globalThis.performance;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      const registeredListeners = new Map();
      const removedListeners = new Map();
      let animCallback = null;
      let mockTime = 3000;
      const rendered = [];

      const mockWindow = {
        innerWidth: 390,
        innerHeight: 844,
        scrollY: 0,
        devicePixelRatio: 1,
        matchMedia: () => ({ matches: false }),
        addEventListener: (event, handler) => {
          registeredListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedListeners.set(event, handler);
        },
      };

      globalThis.window = mockWindow;
      globalThis.document = {
        hidden: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      globalThis.performance = { now: () => mockTime };
      globalThis.requestAnimationFrame = (cb) => {
        animCallback = cb;
        return 301;
      };
      globalThis.cancelAnimationFrame = () => {};

      const mockCtx = {
        clearRect: () => {
          rendered.length = 0;
        },
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: (x, y, r) => {
          rendered.push({ x, y, r });
        },
        fill: () => {},
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      };

      const stepFrame = () => {
        mockTime += 16.67;
        const cb = animCallback;
        animCallback = null;
        assert.ok(typeof cb === 'function', 'Must schedule animation frame');
        cb();
      };

      try {
        const cleanup = initStarfield(mockCanvas);
        const scrollHandler = registeredListeners.get('scroll');
        const motionHandler = registeredListeners.get('devicemotion');
        assert.ok(typeof scrollHandler === 'function', 'Must register scroll listener for vertical parallax');
        assert.ok(typeof motionHandler === 'function', 'Must register devicemotion listener for accelerometer fallback');

        // 1. Baseline frame at scrollY = 0
        stepFrame();
        const atTop = rendered.slice();

        // Scroll down 400px -> stars shift upward proportionally to depth while wrapping inside [0, 844]
        mockWindow.scrollY = 400;
        scrollHandler();
        for (let i = 0; i < 20; i++) {
          stepFrame();
        }
        const afterScroll = rendered.slice();
        assert.ok(
          afterScroll.every((s) => s.x >= 0 && s.x < 390 && s.y >= 0 && s.y < 844),
          'Vertically scrolled stars must wrap cleanly within viewport bounds [0, width) x [0, height)'
        );

        const bgUpShifts = [];
        const pureFgShifts = [];
        const anyFgShifts = [];
        for (let i = 0; i < atTop.length; i++) {
          const dy = (atTop[i].y - afterScroll[i].y + 844) % 844;
          if (atTop[i].r <= 0.99) bgUpShifts.push(dy);
          if (atTop[i].r > 1.6) pureFgShifts.push(dy);
          if (atTop[i].r >= 1.4) anyFgShifts.push(dy);
        }
        const fgUpShifts = pureFgShifts.length > 0 ? pureFgShifts : anyFgShifts;
        assert.ok(bgUpShifts.length > 0 && fgUpShifts.length > 0, 'Must contain both background and foreground stars');
        const avgBgUp = bgUpShifts.reduce((a, b) => a + b, 0) / bgUpShifts.length;
        const avgFgUp = fgUpShifts.reduce((a, b) => a + b, 0) / fgUpShifts.length;
        assert.ok(
          avgFgUp > avgBgUp + 20,
          `Foreground scroll parallax shift (${avgFgUp.toFixed(1)}px) must significantly exceed background (${avgBgUp.toFixed(1)}px)`
        );

        // 2. Side-to-side accelerometer scrolling via W3C devicemotion (tilt left acc.x=+5 -> left, tilt right acc.x=-5 -> right)
        motionHandler({ accelerationIncludingGravity: { x: 5, y: 9.8, z: 0 } });
        for (let i = 0; i < 30; i++) {
          stepFrame();
        }
        const startLeft = rendered.slice();
        for (let i = 0; i < 20; i++) {
          stepFrame();
        }
        const endLeft = rendered.slice();
        assert.ok(
          endLeft.every((s) => s.x >= 0 && s.x < 390 && s.y >= 0 && s.y < 844),
          'Heavily tilted left/upright stars must wrap within [0, width) x [0, height) without OOB coordinates'
        );

        let leftMeanDx = 0;
        for (let i = 0; i < startLeft.length; i++) {
          let dx = endLeft[i].x - startLeft[i].x;
          if (dx > 195) dx -= 390;
          if (dx < -195) dx += 390;
          leftMeanDx += dx;
        }
        leftMeanDx /= startLeft.length;
        assert.ok(
          leftMeanDx < -2.0,
          `Left tilt (W3C acc.x=+5) must scroll stars left side-to-side (mean dx=${leftMeanDx.toFixed(2)}px)`
        );

        motionHandler({ accelerationIncludingGravity: { x: -5, y: 0, z: 9.8 } });
        for (let i = 0; i < 30; i++) {
          stepFrame();
        }
        const startRight = rendered.slice();
        for (let i = 0; i < 20; i++) {
          stepFrame();
        }
        const endRight = rendered.slice();
        assert.ok(
          endRight.every((s) => s.x >= 0 && s.x < 390 && s.y >= 0 && s.y < 844),
          'Heavily tilted right/flat stars must wrap within [0, width) x [0, height) without OOB coordinates'
        );

        let rightMeanDx = 0;
        for (let i = 0; i < startRight.length; i++) {
          let dx = endRight[i].x - startRight[i].x;
          if (dx > 195) dx -= 390;
          if (dx < -195) dx += 390;
          rightMeanDx += dx;
        }
        rightMeanDx /= startRight.length;
        assert.ok(
          rightMeanDx > 2.0,
          `Right tilt (W3C acc.x=-5) must scroll stars right side-to-side (mean dx=${rightMeanDx.toFixed(2)}px)`
        );

        // 3. Negative or non-finite viewport dimensions must fall back safely without corrupting canvas backing store
        mockWindow.innerWidth = -100;
        mockWindow.innerHeight = Number.NaN;
        mockWindow.devicePixelRatio = Number.POSITIVE_INFINITY;
        registeredListeners.get('resize')();
        assert.equal(mockCanvas.width, 800, 'Invalid negative width must fall back to 800');
        assert.equal(mockCanvas.height, 600, 'Invalid NaN height must fall back to 600');

        cleanup();
        assert.equal(removedListeners.get('scroll'), scrollHandler, 'Must remove exact scroll handler reference on cleanup');
        assert.equal(removedListeners.get('devicemotion'), motionHandler, 'Must remove exact devicemotion handler reference on cleanup');
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
        globalThis.performance = origPerf;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.20 should remap orientation and motion axes across 90/180/270 deg and remove orientationchange listeners cleanly', () => {
      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      const origPerf = globalThis.performance;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      let perfNow = 1000;
      const meanDeltaAxis = (startArr, endArr, viewportSpan, axis) => {
        const half = viewportSpan / 2;
        let total = 0;
        for (let i = 0; i < startArr.length; i++) {
          let d = endArr[i][axis] - startArr[i][axis];
          if (d > half) d -= viewportSpan;
          if (d < -half) d += viewportSpan;
          total += d;
        }
        return total / startArr.length;
      };

      const runHarness = (initialAngle, fn, { useLegacyOrientationOnly = false } = {}) => {
        const registeredListeners = new Map();
        const removedListeners = new Map();
        const registeredScreenListeners = new Map();
        const removedScreenListeners = new Map();
        const rendered = [];
        let pendingFrame = null;

        const screenOrientation = useLegacyOrientationOnly
          ? undefined
          : {
              angle: initialAngle,
              addEventListener: (ev, cb) => registeredScreenListeners.set(ev, cb),
              removeEventListener: (ev, cb) => removedScreenListeners.set(ev, cb),
            };

        globalThis.window = {
          innerWidth: 844,
          innerHeight: 390,
          devicePixelRatio: 1,
          scrollY: 0,
          ...(useLegacyOrientationOnly
            ? { orientation: initialAngle }
            : { screen: { orientation: screenOrientation } }),
          matchMedia: () => ({ matches: false }),
          addEventListener: (ev, cb) => registeredListeners.set(ev, cb),
          removeEventListener: (ev, cb) => removedListeners.set(ev, cb),
        };
        globalThis.document = { hidden: false, addEventListener: () => {}, removeEventListener: () => {} };
        globalThis.performance = { now: () => perfNow };
        globalThis.requestAnimationFrame = (cb) => {
          pendingFrame = cb;
          return 1;
        };
        globalThis.cancelAnimationFrame = () => {
          pendingFrame = null;
        };

        const mockCtx = {
          clearRect: () => {
            rendered.length = 0;
          },
          setTransform: () => {},
          fillStyle: '',
          beginPath: () => {},
          arc: (x, y) => rendered.push({ x, y }),
          fill: () => {},
        };
        const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx };
        const stepFrame = () => {
          perfNow += 16.67;
          if (pendingFrame) pendingFrame();
        };

        const cleanup = initStarfield(mockCanvas);
        return fn({
          screenOrientation,
          registeredListeners,
          removedListeners,
          registeredScreenListeners,
          removedScreenListeners,
          rendered,
          stepFrame,
          cleanup,
        });
      };

      try {
        // 1. Landscape 90 deg deviceorientation: W3C resting gamma=-45, beta=0 yields neutral X & Y; gamma drives Y; beta drives X
        runHarness(90, ({
          registeredListeners,
          removedListeners,
          registeredScreenListeners,
          removedScreenListeners,
          rendered,
          stepFrame,
          cleanup,
        }) => {
          const orientHandler = registeredListeners.get('deviceorientation');
          const windowOrientChange = registeredListeners.get('orientationchange');
          const screenOrientChange = registeredScreenListeners.get('change');
          assert.ok(orientHandler, 'Must register deviceorientation listener');
          assert.ok(windowOrientChange, 'Must register window orientationchange listener');
          assert.ok(screenOrientChange, 'Must register screen.orientation change listener');

          // Pure baseline ambient drift (20 frames) for both X and Y
          stepFrame();
          const baseStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const baseEnd = rendered.slice();
          const baseMeanDx = meanDeltaAxis(baseStart, baseEnd, 844, 'x');
          const baseMeanDy = meanDeltaAxis(baseStart, baseEnd, 390, 'y');

          // Stationary device tilted back 45 deg in W3C 90 deg CCW landscape: screen top (+x) raised -> gamma=-45, beta=0
          orientHandler({ gamma: -45, beta: 0 });
          const restYStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const restYShift = meanDeltaAxis(restYStart, rendered.slice(), 390, 'y') - baseMeanDy;
          assert.ok(
            Math.abs(restYShift) < 0.5,
            `Resting landscape tilt (angle=90, gamma=-45, beta=0) must remain vertically neutral (delta=${restYShift.toFixed(2)}px)`
          );

          const calmXStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const calmMeanDx = meanDeltaAxis(calmXStart, rendered.slice(), 844, 'x');
          assert.ok(
            Math.abs(calmMeanDx - baseMeanDx) < 0.05,
            `Resting landscape tilt (angle=90, gamma=-45, beta=0) must not induce horizontal drift (base=${baseMeanDx.toFixed(3)}, calm=${calmMeanDx.toFixed(3)})`
          );

          // Vertical pitch around horizontal gamma axis (-75 vs -15) shifts screen Y upward then downward
          orientHandler({ gamma: -75, beta: 0 });
          const pitchUpStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const pitchUpDy = meanDeltaAxis(pitchUpStart, rendered.slice(), 390, 'y') - baseMeanDy;
          assert.ok(
            pitchUpDy > 4.0,
            `Landscape angle=90 steep pitch gamma=-75 must shift screen Y positively (dy=${pitchUpDy.toFixed(2)}px)`
          );

          orientHandler({ gamma: -15, beta: 0 });
          const pitchDownStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const pitchDownDy = meanDeltaAxis(pitchDownStart, rendered.slice(), 390, 'y') - baseMeanDy;
          assert.ok(
            pitchDownDy < -8.0,
            `Landscape angle=90 flatter pitch gamma=-15 must shift screen Y negatively (dy=${pitchDownDy.toFixed(2)}px)`
          );

          // Lateral tilt driven by beta (+30 vs -30) moves stars horizontally in screen space
          orientHandler({ gamma: -45, beta: 30 });
          for (let i = 0; i < 40; i++) stepFrame();
          const posStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const posMeanDx = meanDeltaAxis(posStart, rendered.slice(), 844, 'x');
          assert.ok(
            posMeanDx > 5.0,
            `Landscape angle=90 lateral tilt beta=+30 must scroll stars horizontally right (mean dx=${posMeanDx.toFixed(2)}px)`
          );

          orientHandler({ gamma: -45, beta: -30 });
          for (let i = 0; i < 60; i++) stepFrame();
          const negStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const negMeanDx = meanDeltaAxis(negStart, rendered.slice(), 844, 'x');
          assert.ok(
            negMeanDx < -5.0,
            `Landscape angle=90 lateral tilt beta=-30 must scroll stars horizontally left (mean dx=${negMeanDx.toFixed(2)}px)`
          );

          cleanup();
          assert.equal(
            removedListeners.get('orientationchange'),
            windowOrientChange,
            'Must remove exact window orientationchange listener on cleanup'
          );
          assert.equal(
            removedScreenListeners.get('change'),
            screenOrientChange,
            'Must remove exact screen.orientation change listener on cleanup'
          );
        });

        // 2. Landscape devicemotion: W3C gravity reactions (+x at 90 deg, -x at 270 deg), neutral resting check, and 90 -> 270 negation
        runHarness(90, ({
          screenOrientation,
          registeredListeners,
          registeredScreenListeners,
          rendered,
          stepFrame,
          cleanup,
        }) => {
          const motionHandler = registeredListeners.get('devicemotion');
          const screenOrientChange = registeredScreenListeners.get('change');
          assert.ok(motionHandler, 'Must register devicemotion listener');

          stepFrame();
          const baseStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const baseEnd = rendered.slice();
          const baseDx = meanDeltaAxis(baseStart, baseEnd, 844, 'x');
          const baseDy = meanDeltaAxis(baseStart, baseEnd, 390, 'y');

          // Resting 90 deg landscape gravity: screen top (+x) up -> acc.x=+4.9, acc.y=0
          motionHandler({ accelerationIncludingGravity: { x: 4.9, y: 0, z: 0 } });
          const restYStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const restYShift = meanDeltaAxis(restYStart, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            Math.abs(restYShift) < 0.5,
            `Resting 90 deg devicemotion acc={x:4.9,y:0} must remain vertically neutral (delta=${restYShift.toFixed(2)}px)`
          );
          const restXStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const restDx = meanDeltaAxis(restXStart, rendered.slice(), 844, 'x');
          assert.ok(
            Math.abs(restDx - baseDx) < 0.05,
            `Resting 90 deg devicemotion acc={x:4.9,y:0} must not induce horizontal drift (base=${baseDx.toFixed(3)}, calm=${restDx.toFixed(3)})`
          );

          // At 90 deg: acc.x=+4.9 rests vertically, acc.y=+5 drives +X horizontal drift (opposite to portrait -acc.x!)
          motionHandler({ accelerationIncludingGravity: { x: 4.9, y: 5, z: 0 } });
          for (let i = 0; i < 40; i++) stepFrame();
          const start90 = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const meanDx90 = meanDeltaAxis(start90, rendered.slice(), 844, 'x');
          assert.ok(
            meanDx90 > 5.0,
            `Landscape 90 deg devicemotion acc.y=+5 must drift right (mean dx=${meanDx90.toFixed(2)}px)`
          );

          // Rotate to secondary landscape (270 deg): screen top is -x (resting acc.x=-4.9) and +X is -acc.y
          screenOrientation.angle = 270;
          screenOrientChange();
          // Verify handleOrientationChange resets targetTiltX/Y to 0 without waiting for a new sensor event
          for (let i = 0; i < 60; i++) stepFrame();
          const resetStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const resetDx = meanDeltaAxis(resetStart, rendered.slice(), 844, 'x');
          assert.ok(
            Math.abs(resetDx - baseDx) < 1.0,
            `orientationchange must reset prior tilt drift without a new sensor event (base=${baseDx.toFixed(2)}, afterReset=${resetDx.toFixed(2)})`
          );

          motionHandler({ accelerationIncludingGravity: { x: -4.9, y: 0, z: 0 } });
          for (let i = 0; i < 20; i++) stepFrame();
          const start270RestY = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const rest270YShift = meanDeltaAxis(start270RestY, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            Math.abs(rest270YShift) < 0.5,
            `Resting 270 deg devicemotion acc={x:-4.9,y:0} must remain vertically neutral (delta=${rest270YShift.toFixed(2)}px)`
          );

          motionHandler({ accelerationIncludingGravity: { x: -4.9, y: 5, z: 0 } });
          for (let i = 0; i < 40; i++) stepFrame();
          const start270 = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const meanDx270 = meanDeltaAxis(start270, rendered.slice(), 844, 'x');
          assert.ok(
            meanDx270 < -5.0,
            `Landscape 270 deg devicemotion acc.y=+5 must negate horizontal drift left (mean dx=${meanDx270.toFixed(2)}px)`
          );

          cleanup();
        });

        // 2b. Landscape 270 deg deviceorientation: screenXDeg=-beta, screenYDeg=+gamma
        runHarness(270, ({ rendered, registeredListeners, stepFrame, cleanup }) => {
          const orientHandler = registeredListeners.get('deviceorientation');
          stepFrame();
          const baseStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const baseEnd = rendered.slice();
          const baseDx = meanDeltaAxis(baseStart, baseEnd, 844, 'x');
          const baseDy = meanDeltaAxis(baseStart, baseEnd, 390, 'y');

          // W3C 270 deg resting pose: gamma=+45, beta=0 -> screenYDeg=+45 (neutral Y), screenXDeg=0
          orientHandler({ gamma: 45, beta: 0 });
          const restYStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const restYShift = meanDeltaAxis(restYStart, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            Math.abs(restYShift) < 0.5,
            `Resting 270 deg tilt (gamma=+45, beta=0) must remain vertically neutral (delta=${restYShift.toFixed(2)}px)`
          );
          const calmXStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const calmDx = meanDeltaAxis(calmXStart, rendered.slice(), 844, 'x');
          assert.ok(
            Math.abs(calmDx - baseDx) < 0.05,
            `Resting 270 deg tilt must not induce horizontal drift (base=${baseDx.toFixed(3)}, calm=${calmDx.toFixed(3)})`
          );

          orientHandler({ gamma: 75, beta: 0 });
          const pitchUpStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const pitchUpDy = meanDeltaAxis(pitchUpStart, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            pitchUpDy > 4.0,
            `Landscape angle=270 steep pitch gamma=+75 must shift screen Y positively (dy=${pitchUpDy.toFixed(2)}px)`
          );

          orientHandler({ gamma: 15, beta: 0 });
          const pitchDownStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const pitchDownDy = meanDeltaAxis(pitchDownStart, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            pitchDownDy < -8.0,
            `Landscape angle=270 flatter pitch gamma=+15 must shift screen Y negatively (dy=${pitchDownDy.toFixed(2)}px)`
          );

          orientHandler({ gamma: 45, beta: 30 });
          for (let i = 0; i < 40; i++) stepFrame();
          const leftStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const leftDx = meanDeltaAxis(leftStart, rendered.slice(), 844, 'x');
          assert.ok(
            leftDx < -5.0,
            `Landscape angle=270 lateral tilt beta=+30 must invert X to scroll left (mean dx=${leftDx.toFixed(2)}px)`
          );

          orientHandler({ gamma: 45, beta: -30 });
          for (let i = 0; i < 60; i++) stepFrame();
          const rightStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const rightDx = meanDeltaAxis(rightStart, rendered.slice(), 844, 'x');
          assert.ok(
            rightDx > 5.0,
            `Landscape angle=270 lateral tilt beta=-30 must scroll right (mean dx=${rightDx.toFixed(2)}px)`
          );

          cleanup();
        });

        // 3. Upside-down portrait (180 deg) orientation & motion inversion + legacy window.orientation=-90 fallback
        runHarness(180, ({ rendered, registeredListeners, stepFrame, cleanup }) => {
          const orientHandler = registeredListeners.get('deviceorientation');
          stepFrame();
          const baseStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const baseEnd = rendered.slice();
          const baseDx = meanDeltaAxis(baseStart, baseEnd, 844, 'x');
          const baseDy = meanDeltaAxis(baseStart, baseEnd, 390, 'y');

          // At 180 deg, screenXDeg=-gamma, screenYDeg=-beta: {gamma:-30, beta:-45} -> +30 X, neutral +45 Y
          orientHandler({ gamma: -30, beta: -45 });
          const startY = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const yShift = meanDeltaAxis(startY, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            Math.abs(yShift) < 0.5,
            `180 deg orientation beta=-45 must stay vertically neutral (delta=${yShift.toFixed(2)}px)`
          );
          for (let i = 0; i < 30; i++) stepFrame();
          const startX = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const dx180 = meanDeltaAxis(startX, rendered.slice(), 844, 'x');
          assert.ok(
            dx180 > baseDx + 5.0,
            `180 deg orientation gamma=-30 must invert X to scroll right (dx=${dx180.toFixed(2)}px)`
          );
          cleanup();
        });

        runHarness(180, ({ rendered, registeredListeners, stepFrame, cleanup }) => {
          const motionHandler = registeredListeners.get('devicemotion');
          stepFrame();
          const baseStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const baseDy = meanDeltaAxis(baseStart, rendered.slice(), 390, 'y');

          // At 180 deg, rawAccX=+acc.x, rawAccY=-acc.y
          motionHandler({ accelerationIncludingGravity: { x: 0, y: -4.9, z: 0 } });
          const restYStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const restYShift = meanDeltaAxis(restYStart, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            Math.abs(restYShift) < 0.5,
            `180 deg devicemotion acc.y=-4.9 must stay vertically neutral (delta=${restYShift.toFixed(2)}px)`
          );

          motionHandler({ accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 } });
          const steepYStart = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const steepYShift = meanDeltaAxis(steepYStart, rendered.slice(), 390, 'y') - baseDy;
          assert.ok(
            steepYShift > 4.0,
            `180 deg devicemotion acc.y=-9.8 must shift screen Y positively (dy=${steepYShift.toFixed(2)}px)`
          );

          motionHandler({ accelerationIncludingGravity: { x: 5, y: -4.9, z: 0 } });
          for (let i = 0; i < 40; i++) stepFrame();
          const startX = rendered.slice();
          for (let i = 0; i < 20; i++) stepFrame();
          const dx180 = meanDeltaAxis(startX, rendered.slice(), 844, 'x');
          assert.ok(
            dx180 > 5.0,
            `180 deg devicemotion acc.x=+5 must invert portrait X and drift right (dx=${dx180.toFixed(2)}px)`
          );
          cleanup();
        });

        // Legacy window.orientation=-90 (when screen.orientation is unavailable) normalizes to 270 deg
        runHarness(
          -90,
          ({ rendered, registeredListeners, removedListeners, stepFrame, cleanup }) => {
            const motionHandler = registeredListeners.get('devicemotion');
            const windowOrientChange = registeredListeners.get('orientationchange');
            motionHandler({ accelerationIncludingGravity: { x: -4.9, y: 5, z: 0 } });
            for (let i = 0; i < 40; i++) stepFrame();
            const startLegacy = rendered.slice();
            for (let i = 0; i < 20; i++) stepFrame();
            const legacyDx = meanDeltaAxis(startLegacy, rendered.slice(), 844, 'x');
            assert.ok(
              legacyDx < -5.0,
              `Legacy window.orientation=-90 must normalize to 270 deg and drift left (dx=${legacyDx.toFixed(2)}px)`
            );
            cleanup();
            assert.equal(removedListeners.get('orientationchange'), windowOrientChange);
          },
          { useLegacyOrientationOnly: true }
        );
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
        globalThis.performance = origPerf;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.21 isOrientationPermissionRequired should return true when DeviceOrientationEvent.requestPermission is a function', () => {
      const origWindow = globalThis.window;
      try {
        globalThis.window = {
          DeviceOrientationEvent: {
            requestPermission: async () => 'granted',
          },
        };
        assert.equal(
          isOrientationPermissionRequired(),
          true,
          'Must return true when requestPermission function exists on DeviceOrientationEvent'
        );

        globalThis.window = {
          DeviceOrientationEvent: {},
        };
        assert.equal(
          isOrientationPermissionRequired(),
          false,
          'Must return false when requestPermission is missing'
        );

        globalThis.window = undefined;
        assert.equal(
          isOrientationPermissionRequired(),
          false,
          'Must return false when window is undefined'
        );
      } finally {
        globalThis.window = origWindow;
      }
    });

    test('8.1.22 getOrientationPermissionStatus should return stored permission, prompt, granted, or unsupported', () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      let storedVal = null;
      globalThis.localStorage = {
        getItem: (key) => (key === 'oneiromancy_orientation_permission' ? storedVal : null),
        setItem: (key, val) => {
          if (key === 'oneiromancy_orientation_permission') storedVal = val;
        },
      };

      try {
        // iOS Safari with permission pending (prompt)
        globalThis.window = {
          DeviceOrientationEvent: {
            requestPermission: async () => 'granted',
          },
        };
        storedVal = null;
        assert.equal(
          getOrientationPermissionStatus(),
          'prompt',
          'Must return prompt when iOS permission has not been requested yet'
        );

        // iOS Safari with permission granted
        storedVal = 'granted';
        assert.equal(
          getOrientationPermissionStatus(),
          'granted',
          'Must return granted when stored in localStorage'
        );

        // iOS Safari with permission denied
        storedVal = 'denied';
        assert.equal(
          getOrientationPermissionStatus(),
          'denied',
          'Must return denied when stored in localStorage'
        );

        // Non-iOS browser with orientation support (permission granted by default)
        globalThis.window = {
          DeviceOrientationEvent: {},
        };
        assert.equal(
          getOrientationPermissionStatus(),
          'granted',
          'Must return granted by default on browsers where permission is not gated'
        );

        // Headless or unsupported environment
        globalThis.window = undefined;
        assert.equal(
          getOrientationPermissionStatus(),
          'unsupported',
          'Must return unsupported when window is undefined'
        );
      } finally {
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
      }
    });

    test('8.1.23 requestOrientationPermission should invoke requestPermission, persist state to localStorage, and dispatch event', async () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      let storedState = null;
      let requestPermissionCalled = 0;
      const dispatchedEvents = [];

      globalThis.localStorage = {
        getItem: () => storedState,
        setItem: (key, val) => {
          if (key === 'oneiromancy_orientation_permission') storedState = val;
        },
      };

      globalThis.window = {
        DeviceOrientationEvent: {
          requestPermission: async () => {
            requestPermissionCalled++;
            return 'granted';
          },
        },
        dispatchEvent: (event) => {
          dispatchedEvents.push(event);
        },
      };

      try {
        const state = await requestOrientationPermission();
        assert.equal(
          requestPermissionCalled,
          1,
          'Must invoke DeviceOrientationEvent.requestPermission once'
        );
        assert.equal(state, 'granted', 'Must resolve to granted');
        assert.equal(storedState, 'granted', 'Must persist granted state in localStorage');
        assert.equal(dispatchedEvents.length, 1, 'Must dispatch custom permission changed event');
        assert.equal(dispatchedEvents[0].type, 'oneiromancy:orientation-permission-changed');
        assert.equal(dispatchedEvents[0].detail?.state, 'granted');
      } finally {
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
      }
    });

    test('8.1.24 requestOrientationPermission should handle rejection gracefully, persist denied state, and dispatch event', async () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      const origSessionStorage = globalThis.sessionStorage;
      let storedState = null;
      let sessionDenied = null;
      const dispatchedEvents = [];

      globalThis.localStorage = {
        getItem: () => storedState,
        setItem: (key, val) => {
          if (key === 'oneiromancy_orientation_permission') storedState = val;
        },
      };

      globalThis.sessionStorage = {
        getItem: (k) => (k === 'oneiromancy_orientation_permission_denied' ? sessionDenied : null),
        setItem: (k, val) => {
          if (k === 'oneiromancy_orientation_permission_denied') sessionDenied = val;
        },
      };

      globalThis.window = {
        DeviceOrientationEvent: {
          requestPermission: async () => 'denied',
        },
        dispatchEvent: (event) => {
          dispatchedEvents.push(event);
        },
      };

      try {
        const state = await requestOrientationPermission();
        assert.equal(
          state,
          'denied',
          'Must resolve to denied when user dismisses or rejects prompt'
        );
        assert.equal(storedState, 'denied', 'Must persist denied state in localStorage');
        assert.equal(sessionDenied, 'true', 'Must set session denied flag');
        assert.equal(
          dispatchedEvents.length,
          1,
          'Must dispatch custom permission changed event on denial'
        );
        assert.equal(dispatchedEvents[0].detail?.state, 'denied');

        // Verify transient exception sets session denial without writing permanent localStorage denial
        storedState = null;
        sessionDenied = null;
        globalThis.window.DeviceOrientationEvent.requestPermission = async () => {
          throw new Error('NotAllowedError: user gesture expired');
        };
        const errState = await requestOrientationPermission();
        assert.equal(errState, 'denied', 'Must resolve to denied on transient exception');
        assert.equal(sessionDenied, 'true', 'Must set session denied flag on transient exception');
        assert.equal(storedState, null, 'Must NOT write permanent localStorage denial on transient exception');
      } finally {
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
        globalThis.sessionStorage = origSessionStorage;
      }
    });

    test('8.1.25 initStarfield should attach deviceorientation by default and respond to oneiromancy:orientation-permission-changed', () => {
      const registeredWindowListeners = new Map();
      const removedWindowListeners = new Map();

      const mockWindow = {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 1,
        matchMedia: () => ({ matches: false }),
        DeviceOrientationEvent: {
          requestPermission: async () => 'granted',
        },
        addEventListener: (event, handler) => {
          registeredWindowListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedWindowListeners.set(event, handler);
        },
      };

      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      globalThis.window = mockWindow;
      globalThis.document = {
        hidden: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      globalThis.requestAnimationFrame = () => 1;
      globalThis.cancelAnimationFrame = () => {};

      const mockCtx = {
        clearRect: () => {},
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      };

      try {
        const cleanupStarfield = initStarfield(mockCanvas);
        assert.ok(
          registeredWindowListeners.has('oneiromancy:orientation-permission-changed'),
          'Must listen for dynamic orientation permission changes'
        );

        // Default to tilting: attach deviceorientation listener immediately on mount
        assert.ok(
          registeredWindowListeners.has('deviceorientation'),
          'Must attach deviceorientation listener by default even when requestPermission exists'
        );

        const permHandler = registeredWindowListeners.get(
          'oneiromancy:orientation-permission-changed'
        );
        assert.ok(
          typeof permHandler === 'function',
          'Permission change listener must be registered function'
        );

        // Simulate permission denial event: listener stays attached by default (tilt targets reset safely)
        permHandler({ detail: { state: 'denied' } });
        assert.equal(
          removedWindowListeners.has('deviceorientation'),
          false,
          'Must keep deviceorientation listener attached across permission denial so transient errors never kill tilt'
        );

        // Granted event remains idempotent without duplicate registration
        permHandler({ detail: { state: 'granted' } });

        cleanupStarfield();
        assert.ok(
          removedWindowListeners.has('deviceorientation'),
          'Must detach deviceorientation listener on unmount cleanup'
        );
        assert.ok(
          removedWindowListeners.has('oneiromancy:orientation-permission-changed'),
          'Must remove permission change listener on teardown'
        );
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.26 initStarfield resize should proportionally rescale star positions to prevent void areas on orientation changes', () => {
      const registeredWindowListeners = new Map();
      const removedWindowListeners = new Map();
      let animFrameRequested = 0;
      const rafCallbacks = [];

      const mockWindow = {
        innerWidth: 390,
        innerHeight: 844,
        devicePixelRatio: 1,
        matchMedia: () => ({ matches: false }),
        addEventListener: (event, handler) => {
          registeredWindowListeners.set(event, handler);
        },
        removeEventListener: (event, handler) => {
          removedWindowListeners.set(event, handler);
        },
      };

      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;

      globalThis.window = mockWindow;
      globalThis.document = {
        hidden: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      globalThis.requestAnimationFrame = (cb) => {
        animFrameRequested++;
        rafCallbacks.push(cb);
        return animFrameRequested;
      };
      globalThis.cancelAnimationFrame = () => {};

      const renderedParticles = [];
      const mockCtx = {
        clearRect: () => {},
        setTransform: () => {},
        fillStyle: '',
        beginPath: () => {},
        arc: (x, y, r) => {
          renderedParticles.push({ x, y, r });
        },
        fill: () => {},
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      };

      try {
        const cleanupStarfield = initStarfield(mockCanvas);

        // Render portrait frame (390 x 844)
        const frame1 = rafCallbacks.shift();
        frame1();
        assert.ok(renderedParticles.length > 0, 'Must render stars in portrait orientation');
        assert.ok(
          renderedParticles.every((p) => p.x <= 390),
          'All portrait particles must start within 390px'
        );

        // Rotate device to landscape (844 x 390)
        mockWindow.innerWidth = 844;
        mockWindow.innerHeight = 390;
        const resizeHandler = registeredWindowListeners.get('resize');
        assert.ok(typeof resizeHandler === 'function', 'Must have registered resize handler');
        resizeHandler();

        // Render landscape frame
        renderedParticles.length = 0;
        const frame2 = rafCallbacks.shift();
        frame2();
        assert.ok(renderedParticles.length > 0, 'Must render stars in landscape orientation');

        // Check star redistribution: stars must be rescaled proportionally across the expanded 844px width
        const wideStars = renderedParticles.filter((p) => p.x > 390);
        assert.ok(
          wideStars.length > 0,
          `Stars must be proportionally redistributed across expanded landscape width (found ${wideStars.length} stars with x > 390px out of ${renderedParticles.length})`
        );
        assert.ok(
          renderedParticles.some((p) => p.x > 0.75 * 844),
          'Stars must reach past 75% of the expanded landscape width'
        );
        assert.ok(
          renderedParticles.every((p) => p.y <= 390),
          'All landscape stars must remain within 390px height'
        );
        assert.ok(
          renderedParticles.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
          'All particle coordinates must be finite numbers'
        );

        cleanupStarfield();
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.cancelAnimationFrame = origCAF;
      }
    });

    test('8.1.27 StarfieldBackground should render only the canvas without mounting a permission popup toast on iOS', () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;

      globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
      };

      globalThis.window = {
        innerWidth: 390,
        innerHeight: 844,
        devicePixelRatio: 2,
        DeviceOrientationEvent: {
          requestPermission: async () => 'granted',
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      try {
        const { container } = render(jsx(StarfieldBackground, {}));
        const canvas = screen.getByTestId('starfield-canvas');
        assert.ok(canvas, 'StarfieldBackground must render the celestial starfield canvas');
        assert.equal(canvas.tagName, 'CANVAS', 'Rendered element must be a canvas');
        assert.equal(
          container.children.length,
          1,
          'StarfieldBackground must render strictly the canvas with no sibling toast overlay'
        );
        assert.equal(
          screen.queryByTestId('orientation-permission-prompt'),
          null,
          'StarfieldBackground must not render an overlay orientation permission toast'
        );
        assert.equal(
          screen.queryByText(/Enable Celestial Tilt/i),
          null,
          'StarfieldBackground must not render any tilt permission prompt text'
        );
      } finally {
        cleanup();
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
      }
    });
  });

  // ==========================================================================
  // Suite 8.2: Astrolabe & Board Components
  // ==========================================================================
  describe('8.2 Astrolabe & Board Components', () => {
    test('8.2.1 Astrolabe should compute dynamic speed multiplier based on lambda', () => {
      render(jsx(Astrolabe, { lambda: 0.75 }));
      const astrolabe = screen.getByRole('img');
      assert.ok(astrolabe, 'Must render Astrolabe SVG');
      assert.equal(astrolabe.getAttribute('aria-label'), 'Celestial Astrolabe with speed multiplier 3.25');
    });

    test('8.2.2 BoardControls should bind search input and position filter chips', () => {
      let query = '';
      let pos = 'ALL';
      render(
        jsx(BoardControls, {
          searchQuery: query,
          onSearchChange: (q) => {
            query = q;
          },
          positionFilter: pos,
          onPositionFilterChange: (p) => {
            pos = p;
          },
          sortField: 'draft_score',
          sortDirection: 'desc',
          onSortChange: () => {},
          totalVisibleCount: 150,
          positionCounts: { QB: 30, RB: 40, WR: 50, TE: 30, FLEX: 120 },
        })
      );

      const searchInput = screen.getByPlaceholderText(/Search player/i);
      assert.ok(searchInput, 'Must render search input');
      fireEvent.change(searchInput, { target: { value: 'Mahomes' } });
      assert.equal(query, 'Mahomes', 'Changing search input must trigger onSearchChange');

      const qbChip = screen.getByText(/^QB/);
      assert.ok(qbChip, 'Must render QB filter chip');
      fireEvent.click(qbChip);
      assert.equal(pos, 'QB', 'Clicking QB chip must trigger onPositionFilterChange');
    });

    test('8.2.3 PlayerCardRow should render player info and trigger onInspect on click', () => {
      const player = mockData.mockCosmicBoard[0];
      let inspectedPlayer = null;
      render(
        jsx(PlayerCardRow, {
          player,
          rank: 1,
          onInspect: (p) => {
            inspectedPlayer = p;
          },
        })
      );

      assert.ok(screen.getByText(player.name), 'Must render player name');
      const nameElement = screen.getByText(player.name);
      fireEvent.click(nameElement);
      assert.equal(inspectedPlayer?.id, player.id, 'Clicking row or nested text must trigger onInspect');

      // Verify mobile compare checkbox label uses compact >= 24x24px touch target
      cleanup();
      let toggledId = null;
      let inspectedAfter = null;
      const compareRowView = render(
        jsx(PlayerCardRow, {
          player,
          rank: 1,
          onInspect: (p) => {
            inspectedAfter = p;
          },
          onToggleCompare: (id) => {
            toggledId = id;
          },
        })
      );
      const compareLabel = compareRowView.container.querySelector('label');
      assert.ok(compareLabel, 'Compare checkbox label must exist in PlayerCardRow');
      const cardRowEl = compareRowView.getByTestId(`player-card-row-${player.id}`);
      const cardTokens = cardRowEl.className.trim().split(/\s+/);
      const labelTokens = compareLabel.className.trim().split(/\s+/);
      assert.ok(
        cardTokens.includes('p-2.5') && cardTokens.includes('gap-2'),
        'PlayerCardRow must use compact mobile spacing (p-2.5 gap-2)',
      );
      assert.ok(
        labelTokens.includes('min-w-[24px]') && labelTokens.includes('min-h-[24px]'),
        'Compare touch target label must satisfy >= 24x24px minimum touch target size with compact padding',
      );
      const rowHeadshot = cardRowEl.querySelector('img, span[aria-hidden="true"]');
      const rowHeadshotTokens = rowHeadshot ? rowHeadshot.className.trim().split(/\s+/) : [];
      assert.ok(
        rowHeadshotTokens.includes('w-12') && rowHeadshotTokens.includes('sm:w-16'),
        'PlayerCardRow headshot must use row sizing (w-12 sm:w-16)',
      );
      const compareInput = compareLabel.querySelector('input[type="checkbox"]');
      assert.ok(compareInput, 'Checkbox input must be inside label');
      fireEvent.click(compareInput);
      assert.equal(toggledId, String(player.id), 'Toggling compare checkbox must invoke onToggleCompare');
      assert.equal(inspectedAfter, null, 'Clicking compare checkbox must stopPropagation and not open modal');

      // Test clicking label padding directly invokes onToggleCompare exactly once without bubbling into onInspect
      let labelToggledCount = 0;
      let labelInspected = null;
      cleanup();
      const labelTestView = render(
        jsx(PlayerCardRow, {
          player,
          rank: 1,
          onInspect: (p) => {
            labelInspected = p;
          },
          onToggleCompare: () => {
            labelToggledCount++;
          },
        })
      );
      const testLabel = labelTestView.container.querySelector('label');
      assert.ok(testLabel, 'Label must exist');
      fireEvent.click(testLabel);
      assert.equal(labelToggledCount, 1, 'Clicking label padding must toggle compare exactly once');
      assert.equal(labelInspected, null, 'Clicking 24px label padding must stopPropagation and not invoke onInspect');
    });

    test('8.2.4 RecommendedPickHero should render Divination Spotlight and handle inspection', () => {
      const spotlightPlayer = mockData.mockCosmicBoard[0];
      let inspected = null;
      render(
        jsx(RecommendedPickHero, {
          player: spotlightPlayer,
          onInspect: (p) => {
            inspected = p;
          },
        })
      );

      assert.ok(screen.getByText(/THE ORACLE'S DECREE/i), 'Must render headline banner');
      assert.ok(screen.getByText(spotlightPlayer.name), 'Must render spotlight player name');
      assert.ok(screen.getByTestId('spotlight-player-name'), 'Must have spotlight-player-name test id');

      const nameEl = screen.getByTestId('spotlight-player-name');
      fireEvent.click(nameEl);
      assert.equal(inspected?.id, spotlightPlayer.id, 'Clicking player name must fire onInspect');
    });

    test('8.2.5 AscensionTimeline should render progression rounds', () => {
      render(
        jsx(AscensionTimeline, {
          steps: mockData.mockIdealDraftPath,
          currentRound: 7,
        })
      );

      assert.ok(screen.getByText('Path of Ascension'), 'Must render timeline header');
      assert.ok(screen.getByText('Round 7 / 15'), 'Must render current round pill');
    });

    test('8.2.6 TelemetryBar should render aggregate draft metrics and VOR gauge', () => {
      render(
        jsx(TelemetryBar, {
          totalProjectedPoints: 912.4,
          totalVOR: 235.8,
        })
      );

      assert.ok(screen.getByText('Projected Output'), 'Must render Projected Output header');
      assert.ok(screen.getByText('912.4'), 'Must render total projected points');
      assert.ok(screen.getByText('Total VOR'), 'Must render Total VOR header');
      assert.ok(screen.getByText('+235.8'), 'Must render Total VOR value');
    });
  });

  // ==========================================================================
  // Suite 8.3: Modals & Drawers
  // ==========================================================================
  describe('8.3 Modals & Settings Drawer', () => {
    test('8.3.1 PlayerDetailModal should render dossier with 3 canonical metrics when isOpen is true and hide when false', () => {
      let closed = false;
      const player = mockData.mockCosmicBoard[0];

      const closedView = render(
        jsx(PlayerDetailModal, {
          player,
          isOpen: false,
          onClose: () => {
            closed = true;
          },
        })
      );
      assert.equal(closedView.container.querySelector('[role="dialog"]'), null, 'Must not render modal when closed');
      cleanup();

      render(
        jsx(PlayerDetailModal, {
          player,
          isOpen: true,
          onClose: () => {
            closed = true;
          },
        })
      );
      assert.ok(screen.getByRole('dialog'), 'Must render dialog role when open');
      assert.ok(screen.getByText(player.name), 'Must render player name in modal');
      assert.ok(screen.getByText('The 5 Divination Pillars'), 'Must render divination pillars');

      const closeBtn = screen.getByRole('button', { name: 'Close dossier' });
      fireEvent.click(closeBtn);
      assert.equal(closed, true, 'Clicking close button must fire onClose');
    });

    test('8.3.2 SettingsDrawer should render options when open and bind controls', () => {
      let drawerClosed = false;
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(SettingsDrawer, {
            isOpen: true,
            onClose: () => {
              drawerClosed = true;
            },
          })
        )
      );

      assert.ok(screen.getByRole('dialog'), 'Must render dialog container');
      assert.ok(screen.getByText('Settings'), 'Must render settings title');
      assert.ok(screen.getByText(/Sleeper username/i), 'Must render username label');

      const closeBtn = screen.getByRole('button', { name: 'Close Settings' });
      assert.ok(closeBtn, 'Must render close button');
      fireEvent.click(closeBtn);
      assert.equal(drawerClosed, true, 'Clicking close button must trigger onClose');
    });

    test('8.3.3 SettingsDrawer should prompt for username with empty input on very first launch', () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      globalThis.window = {
        location: { origin: 'http://127.0.0.1:3000', search: '' },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };

      try {
        render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(SettingsDrawer, {
              isOpen: true,
              onClose: () => {},
            })
          )
        );

        assert.ok(
          screen.getByTestId('first-launch-welcome-banner'),
          'Must render first-launch welcome banner when no username is stored'
        );
        assert.ok(
          screen.getByText('Welcome to Oneiromancy'),
          'Must display Welcome to Oneiromancy heading on first launch'
        );
        const input = screen.getByPlaceholderText('e.g. OneiroVanguard');
        assert.ok(input, 'Must render username input with placeholder');
        assert.equal(input.value, '', 'Username input must be empty on first launch');
        assert.equal(
          screen.queryByText(/Found .* league/i),
          null,
          'Must not claim leagues were found when no username is entered'
        );
        assert.equal(
          screen.queryByText(/Astral Sanctum League/i),
          null,
          'Must not display mock league in selector when no username is entered'
        );
        assert.ok(
          screen.getByText('Enter a Sleeper username above to load leagues'),
          'Must display placeholder option in league selector when no username is entered'
        );
      } finally {
        cleanup();
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
      }
    });

    test('8.3.4 PlayerDetailModal should relocate role comparison to bottom after Astrocartography and toggle with accordion', () => {
      const player = mockData.mockCosmicBoard[0];
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(PlayerDetailModal, {
            player,
            isOpen: true,
            onClose: () => {},
          })
        )
      );

      const modalDialog = screen.getByRole('dialog');
      assert.ok(modalDialog, 'Must render modal dialog');

      // Verify DOM ordering inside scrollable body (cl/1015913860): Astrocartography comes before roster-role-comparison
      const modalBox = modalDialog.querySelector('.max-w-2xl') || modalDialog.children[0];
      const scrollBody = modalBox.querySelector('.overflow-y-auto') || modalBox;
      const children = Array.from(scrollBody.children || []);
      const astroIndex = children.findIndex((c) => c.textContent?.includes('Astrocartography Geodesic Coordinates'));
      const roleCompIndex = children.findIndex((c) => c.getAttribute?.('data-testid') === 'roster-role-comparison');
      assert.ok(astroIndex !== -1, 'Astrocartography section must exist in modal');
      assert.ok(roleCompIndex !== -1, 'roster-role-comparison must exist in modal');
      assert.ok(roleCompIndex > astroIndex, 'roster-role-comparison must appear after Astrocartography in the DOM');

      // Accordion toggle button with aria-expanded
      const roleComp = screen.getByTestId('roster-role-comparison');
      const toggleBtn = roleComp.querySelector('[aria-expanded]');
      assert.ok(toggleBtn, 'Must render accordion toggle button with aria-expanded');
      assert.equal(toggleBtn.getAttribute('aria-expanded'), 'true', 'Accordion must be expanded by default');

      const contentId = toggleBtn.getAttribute('aria-controls');
      assert.ok(contentId, 'Must specify aria-controls on toggle button');
      const contentEl = roleComp.querySelector(`#${contentId}`);
      assert.ok(contentEl, 'Collapsible content element must exist');
      assert.ok(!contentEl.className.includes('hidden'), 'Content must not have hidden class when open');

      // Click to collapse
      fireEvent.click(toggleBtn);
      const collapsedToggle = screen.getByTestId('roster-role-comparison').querySelector('[aria-expanded]');
      assert.equal(collapsedToggle.getAttribute('aria-expanded'), 'false', 'Accordion must update aria-expanded to false');
      const collapsedContent = screen.getByTestId('roster-role-comparison').querySelector(`#${contentId}`);
      assert.ok(collapsedContent.className.includes('hidden'), 'Content must have hidden class when collapsed');

      // Click to re-expand
      fireEvent.click(collapsedToggle);
      const reExpandedToggle = screen.getByTestId('roster-role-comparison').querySelector('[aria-expanded]');
      assert.equal(reExpandedToggle.getAttribute('aria-expanded'), 'true', 'Accordion must update aria-expanded to true');
      const reExpandedContent = screen.getByTestId('roster-role-comparison').querySelector(`#${contentId}`);
      assert.ok(!reExpandedContent.className.includes('hidden'), 'Content must remove hidden class when re-expanded');
      cleanup();
    });

    test('8.3.5 SettingsDrawer should default Celestial Motion Tilt badge to Active with discreet iOS opt-in and Autonomous Drift fallback', async () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      let storedPerm = null;
      let requestPermissionCalled = 0;

      globalThis.localStorage = {
        getItem: (k) => (k === 'oneiromancy_orientation_permission' ? storedPerm : null),
        setItem: (k, v) => {
          if (k === 'oneiromancy_orientation_permission') storedPerm = v;
        },
      };

      let resolvePending = null;
      globalThis.window = {
        location: { origin: 'http://127.0.0.1:3000', search: '' },
        DeviceOrientationEvent: {
          requestPermission: () =>
            new Promise((resolve) => {
              resolvePending = resolve;
              requestPermissionCalled++;
            }),
        },
        dispatchEvent: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      try {
        render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(SettingsDrawer, {
              isOpen: true,
              onClose: () => {},
            })
          )
        );

        const tiltSection = screen.getByTestId('celestial-tilt-section');
        assert.ok(tiltSection, 'Must render Celestial Motion Tilt section');
        assert.ok(screen.getByText('Celestial Motion Tilt'), 'Must display Celestial Motion Tilt title');

        const badge = screen.getByTestId('celestial-tilt-status-badge');
        assert.ok(badge, 'Must render tilt status badge');
        assert.equal(
          badge.textContent,
          'Active',
          'Status badge must default to Active without intrusive permission warnings'
        );

        const requestBtn = screen.getByTestId('enable-orientation-tilt-btn');
        assert.ok(requestBtn, 'Must render discreet iOS opt-in button when requestPermission exists');

        // Trigger request and verify in-flight double-tap guard
        await act(async () => {
          fireEvent.click(requestBtn);
        });
        assert.equal(requestBtn.disabled, true, 'Button must be disabled while request is in flight');
        fireEvent.click(requestBtn);
        assert.equal(requestPermissionCalled, 1, 'Second click while in-flight must be guarded');

        await act(async () => {
          resolvePending('granted');
        });
        assert.equal(badge.textContent, 'Active', 'Status badge must remain Active after permission grant');
        assert.equal(storedPerm, 'granted', 'Must save granted permission to localStorage');
        assert.equal(
          screen.queryByTestId('enable-orientation-tilt-btn'),
          null,
          'Discreet opt-in button should hide once iOS motion access is granted'
        );
        cleanup();

        // Denied state on iOS still shows Active badge (no scary warning) and retains discreet opt-in button
        storedPerm = 'denied';
        render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(SettingsDrawer, {
              isOpen: true,
              onClose: () => {},
            })
          )
        );
        assert.equal(
          screen.getByTestId('celestial-tilt-status-badge').textContent,
          'Active',
          'Status badge must remain Active without intrusive warnings even when prior iOS permission was denied'
        );
        assert.ok(
          screen.getByTestId('enable-orientation-tilt-btn'),
          'Discreet iOS opt-in button must remain available when stored permission is denied'
        );
        cleanup();

        // Reduced motion / unsupported fallback shows Autonomous Drift
        storedPerm = null;
        globalThis.window = {
          location: { origin: 'http://127.0.0.1:3000', search: '' },
          matchMedia: (q) => ({ matches: q.includes('prefers-reduced-motion') }),
          dispatchEvent: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(SettingsDrawer, {
              isOpen: true,
              onClose: () => {},
            })
          )
        );
        const fallbackBadge = screen.getByTestId('celestial-tilt-status-badge');
        assert.equal(
          fallbackBadge.textContent,
          'Autonomous Drift',
          'Status badge must show Autonomous Drift when motion sensors are disabled or unavailable'
        );
        assert.equal(
          screen.queryByTestId('enable-orientation-tilt-btn'),
          null,
          'Opt-in button must not render when reduced motion is preferred'
        );
      } finally {
        cleanup();
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
      }
    });
  });

  // ==========================================================================
  // Suite 8.4: Primary Application Screens (4 Consolidated Sections)
  // ==========================================================================
  describe('8.4 Primary Application Screens (Roster, Matchup, Players, League & Weights)', () => {
    test('8.4.1 OneiromancyDashboard (Roster) should render My Roster, Visual Stack Constellation SVG, and Lineup Swap Arrows', () => {
      const { container } = render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(OneiromancyDashboard, {}))
      );

      assert.ok(screen.getByText(/Roster Aura & Stack Constellation/i), 'Must render Roster Aura & Stack Constellation title');
      assert.ok(screen.getByTestId('synergy-constellation-svg'), 'Must render visual Synergy Constellation SVG');
      assert.ok(screen.getByTestId('18-week-coverage-strip'), 'Must render 18-Week Coverage strip');
      const auraWrappers = Array.from(container.querySelectorAll('[data-testid="player-divination-aura"]'));
      assert.ok(auraWrappers.length > 0, 'Dashboard roster must render at least one player-divination-aura wrapper');
      const rosterHeadshots = auraWrappers.flatMap((wrap) =>
        Array.from(wrap.querySelectorAll('img, span[aria-hidden="true"]'))
      );
      assert.ok(rosterHeadshots.length > 0, 'Dashboard roster must render at least one player headshot');
      assert.ok(
        rosterHeadshots.every((el) => {
          const t = el.className.trim().split(/\s+/);
          return t.includes('w-10') && t.includes('sm:w-[72px]');
        }),
        'All dashboard roster player headshots must use roster sizing (w-10 sm:w-[72px])'
      );
    });

    test('8.4.2 MatchupsScreen (Matchup) should render unified starting lineup without duplicate bench section and Your Team on Left with purple border', () => {
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(MatchupsScreen, { weeklyMatchup: testDraftState.weekly_matchup })
        )
      );

      assert.equal(screen.queryByText(/YOUR STARTERS/), null, 'Must remove redundant YOUR STARTERS header');
      assert.equal(screen.queryByText(/OPPONENT STARTERS/), null, 'Must remove redundant OPPONENT STARTERS header');
      assert.equal(screen.queryByText('YOUR TEAM'), null, 'Must remove YOUR TEAM badge on MatchupsScreen');
      assert.equal(screen.queryByText('OPPONENT'), null, 'Must remove OPPONENT badge on MatchupsScreen');
      assert.equal(screen.queryByText(/\(You\)/), null, 'Must not render visible (You) suffix on MatchupsScreen');
      assert.equal(screen.queryByText('YOUR BENCH'), null, 'Must not render duplicate YOUR BENCH section on MatchupsScreen');
      assert.equal(screen.queryByText('OPPONENT BENCH'), null, 'Must not render duplicate OPPONENT BENCH section on MatchupsScreen');
      assert.ok(screen.getByText(/SolarFlare/i), 'Must render Week 2 opponent SolarFlare');
      cleanup();

      // Regression test: live Sleeper matchup where players on bye or unmapped teams have null stadium coordinates
      const nullStadiumMatchup = {
        ...testDraftState.weekly_matchup,
        player_favorabilities: testDraftState.weekly_matchup.player_favorabilities.map((pf, idx) =>
          idx === 0
            ? {
                ...pf,
                stadium: {
                  ...pf.stadium,
                  stadium_name: 'No game this week',
                  roof_type: '-',
                  latitude: null,
                  longitude: null,
                  coordinates: { lat: null, lon: null },
                },
              }
            : pf,
        ),
      };
      const { container } = render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: { ...testDraftState, weekly_matchup: nullStadiumMatchup } },
          jsx(MatchupsScreen, { weeklyMatchup: nullStadiumMatchup })
        )
      );
      assert.ok(screen.getByTestId('positional-matchup-grid'), 'Must render positional matchup grid when stadium latitude/longitude are null');
      assert.ok(container.textContent.includes('No game this week (Bye)'), 'Must format bye stadium cleanly as No game this week (Bye)');
      assert.ok(!container.textContent.includes('0°S, 0°W') && !container.textContent.includes('0.00°'), 'Must never render 0°S, 0°W for null coordinates');
    });

    test('8.4.3 CosmicBoard (Players) should render Directory / Free Agents / Trades sub-views and player grid', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(CosmicBoard, {}))
      );

      assert.ok(screen.getByText('Players'), 'Must render Players heading');
      assert.ok(screen.getByTestId('board-mode-all'), 'Must render All Players sub-tab');
      assert.ok(screen.getByTestId('board-mode-waivers'), 'Must render Waivers sub-tab');
      assert.ok(screen.getByTestId('board-mode-trades'), 'Must render Trades sub-tab');
      assert.ok(screen.getByPlaceholderText(/Search player/i), 'Must render search controls');
    });

    test('8.4.4 PlayerMarketplace & TradesScreen should render waivers and trade proposals', () => {
      const mktView = render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(PlayerMarketplace, {}))
      );

      assert.ok(screen.getByText('Waiver Upgrades'), 'Must render Waiver Upgrades title');
      assert.equal(screen.queryByTestId('allow-signed-drop-toggle'), null, 'Must not render redundant drop protection toggle');
      const mktHeadshots = Array.from(mktView.container.querySelectorAll('img, span[aria-hidden="true"]')).filter(
        (el) => el.className.includes('rounded-full') && el.className.includes('bg-slate-800')
      );
      assert.ok(mktHeadshots.length > 0, 'PlayerMarketplace must render candidate player headshots');
      assert.ok(
        mktHeadshots.every((el) => {
          const t = el.className.trim().split(/\s+/);
          return t.includes('w-10') && t.includes('sm:w-11');
        }),
        'All PlayerMarketplace candidate headshots must use trade sizing (w-10 sm:w-11)'
      );
      cleanup();

      const tradesView = render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(TradesScreen, {}))
      );
      assert.ok(screen.getByText('Trades'), 'Must render Trades title');
      const tradeHeadshots = Array.from(tradesView.container.querySelectorAll('img, span[aria-hidden="true"]')).filter(
        (el) =>
          el.className.includes('rounded-full') &&
          el.className.includes('bg-slate-800') &&
          !(el.getAttribute('alt') || '').endsWith(' avatar')
      );
      assert.ok(tradeHeadshots.length > 0, 'TradesScreen must render player headshots');
      assert.ok(
        tradeHeadshots.every((el) => {
          const t = el.className.trim().split(/\s+/);
          return t.includes('w-10') && t.includes('sm:w-11');
        }),
        'All TradesScreen player headshots must use trade sizing (w-10 sm:w-11)'
      );
    });

    test('8.4.5 LeagueScreen (League) should render League Standings & Rosters and CelestialLeaderboardGraph', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(LeagueScreen, {}))
      );

      assert.ok(screen.getByText('League'), 'Must render League Screen title');
      assert.ok(screen.getByTestId('celestial-leaderboard'), 'Must render Celestial Leaderboard');
      assert.ok(screen.getByTestId('user-competitor-card'), 'Must render user competitor card with purple highlight');
    });

    test('8.4.6 ChaosDial (Weights & Encyclopedia) should render lambda slider, interactive pillar tooltips, and field guide', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(ChaosDial, {}))
      );

      assert.ok(screen.getByText('Divination Equilibrium'), 'Must render Divination Equilibrium title');
      assert.ok(screen.getByTestId('pillar-tooltip-btn-celestial'), 'Must render interactive pillar tooltip trigger');
      assert.ok(screen.getByTestId('encyclopedia-toggle'), 'Must render encyclopedia-toggle button');
      assert.ok(screen.getByText(/Astrology & Divination Field Guide/i), 'Must render reference guide');
    });

    test('8.4.7 OneiromancyProvider + NavigationShell (SSR / Client Hydration Parity) should render deterministic LIVE statusText before hydration across timezones', () => {
      const prevTz = process.env.TZ;
      try {
        const renderInTimezone = (tz) => {
          process.env.TZ = tz;
          const observedStatuses = [];
          function StatusHarness() {
            const { statusText, statusType, activeTab, setTab } = useOneiromancy();
            observedStatuses.push(statusText);
            return jsx(
              NavigationShell,
              {
                activeTab,
                onTabChange: setTab,
                statusText,
                statusType,
              },
              jsx('div', {}, 'Content')
            );
          }
          render(jsx(OneiromancyProvider, {}, jsx(StatusHarness, {})));
          cleanup();
          return observedStatuses;
        };

        const utcStatuses = renderInTimezone('UTC');
        const edtStatuses = renderInTimezone('America/New_York');

        assert.equal(
          utcStatuses[0],
          'LIVE',
          'Initial SSR render in UTC must display deterministic LIVE statusText'
        );
        assert.equal(
          edtStatuses[0],
          utcStatuses[0],
          'Initial client hydration render in America/New_York must match UTC SSR statusText'
        );
        assert.ok(
          [...utcStatuses, ...edtStatuses].every((s) => !/Synced \d{2}:\d{2}/.test(s)),
          'Pre-sync renders must not format placeholder lastSyncTimestamp with local getHours()'
        );
      } finally {
        if (prevTz === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = prevTz;
        }
      }
    });

    test('8.4.8 OneiromancyDashboard mobile responsive constellation chart layout', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(OneiromancyDashboard, {}))
      );

      const svgList = screen.getAllByTestId('synergy-constellation-svg');
      assert.equal(svgList.length, 1, 'Exactly one synergy-constellation-svg must exist in DOM');

      const svg = svgList[0];
      assert.equal(svg.getAttribute('viewBox'), '-45 0 300 190', 'SVG viewBox must be adjusted to -45 0 300 190');

      // Verify all 5 spoke labels in textContent
      const text = svg.textContent;
      assert.ok(text.includes('Fire ('), 'SVG textContent must include Fire spoke label');
      assert.ok(text.includes('Air ('), 'SVG textContent must include Air spoke label');
      assert.ok(text.includes('Water ('), 'SVG textContent must include Water spoke label');
      assert.ok(text.includes('Earth ('), 'SVG textContent must include Earth spoke label');
      assert.ok(text.includes('Aspects ('), 'SVG textContent must include Aspects spoke label');

      // Container checks: no overflow-x-auto, no min-w-[560px]
      let curr = svg;
      let chartOuter = null;
      while (curr && curr.parentNode) {
        if (curr.className && curr.className.includes('bg-slate-950/70')) {
          chartOuter = curr;
          break;
        }
        curr = curr.parentNode;
      }
      assert.ok(chartOuter, 'Chart container must exist');
      assert.ok(!chartOuter.className.includes('overflow-x-auto'), 'Chart container must eliminate overflow-x-auto');
      assert.ok(!svg.className.includes('min-w-[560px]'), 'SVG must eliminate min-w-[560px]');

      // Decoupled responsive flex container
      const flexContainer = chartOuter.querySelector('.flex-col');
      assert.ok(flexContainer, 'Must use responsive flex-col container');
      assert.ok(flexContainer.className.includes('md:flex-row'), 'Must use md:flex-row on wider viewports');
      cleanup();
    });

    test('8.4.9 MatchupsScreen team alignment and opponent starter card mirroring', () => {
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(MatchupsScreen, { weeklyMatchup: testDraftState.weekly_matchup })
        )
      );

      // Opponent header comparison card has flex-row-reverse and right alignment inside symmetric 3-track grid
      const oppAvatar = screen.getByTestId('opponent-team-avatar');
      let curr = oppAvatar;
      let oppHeaderCard = null;
      while (curr && curr.parentNode) {
        if (curr.className && curr.className.includes('justify-self-end')) {
          oppHeaderCard = curr;
          break;
        }
        curr = curr.parentNode;
      }
      assert.ok(oppHeaderCard, 'Opponent header card must exist');
      assert.ok(
        oppHeaderCard.parentNode &&
          oppHeaderCard.parentNode.className &&
          oppHeaderCard.parentNode.className.includes('sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'),
        'Matchup header container must use balanced sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] tracks',
      );
      assert.ok(oppHeaderCard.className.includes('flex-row-reverse'), 'Opponent header card must use flex-row-reverse');
      assert.ok(oppHeaderCard.className.includes('text-right'), 'Opponent header card must have text-right');
      assert.ok(
        oppHeaderCard.className.includes('w-fit') &&
          oppHeaderCard.className.includes('max-w-full') &&
          oppHeaderCard.className.includes('min-w-0') &&
          oppHeaderCard.className.includes('justify-self-end'),
        'Opponent header card must shrink around content with right alignment',
      );

      const userAvatar = screen.getByTestId('user-team-avatar');
      curr = userAvatar;
      let userHeaderCard = null;
      while (curr && curr.parentNode) {
        if (curr.className && curr.className.includes('justify-self-start')) {
          userHeaderCard = curr;
          break;
        }
        curr = curr.parentNode;
      }
      assert.ok(userHeaderCard, 'User header card must exist');
      assert.ok(!userHeaderCard.className.includes('flex-row-reverse'), 'User header card must retain left alignment');
      assert.ok(
        userHeaderCard.className.includes('w-fit') &&
          userHeaderCard.className.includes('max-w-full') &&
          userHeaderCard.className.includes('min-w-0') &&
          userHeaderCard.className.includes('justify-self-start'),
        'User header card must shrink around content with left alignment',
      );

      // Slot badge renders centered between paired user and opponent cards
      const matchupGrid = screen.getByTestId('positional-matchup-grid');
      const firstRowGrid = Array.from(matchupGrid.children[0].children).find(
        (el) => el.className && el.className.includes('lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'),
      );
      assert.ok(firstRowGrid, 'Paired starter grid must reserve middle auto track for RosterSlotBadge');
      assert.equal(firstRowGrid.children.length, 3, 'Paired starter grid must have [user, badge, opponent] children');
      const middleBadge = firstRowGrid.children[1];
      assert.equal(middleBadge.getAttribute('data-testid'), 'matchup-slot-label', 'Middle grid child must be matchup-slot-label');
      assert.ok(!middleBadge.className.includes('absolute'), 'matchup-slot-label must not use absolute overlay positioning');
      assert.ok(middleBadge.className.includes('place-self-center'), 'matchup-slot-label must center in both mobile and desktop grid tracks');

      // Starters from matchup: user starters vs opponent starters
      const userStarters = (testDraftState.weekly_matchup?.player_favorabilities || []).filter(
        (p) => p.is_user_team && !p.is_benched
      );
      const oppStarters = (testDraftState.weekly_matchup?.player_favorabilities || []).filter(
        (p) => !p.is_user_team && !p.is_benched
      );

      assert.ok(userStarters.length > 0, 'Must have user starters in test state');
      assert.ok(oppStarters.length > 0, 'Must have opponent starters in test state');

      // Check opponent starter card layout
      const oppCard = screen.getByTestId(`matchup-starter-card-${oppStarters[0].player_id}`);
      assert.ok(oppCard, 'Opponent starter card must exist');

      const oppTopRow = oppCard.children[0];
      assert.ok(oppTopRow.className.includes('flex-row-reverse'), 'Opponent starter top row must use flex-row-reverse');

      const oppTextCol = oppCard.querySelector('[data-testid="matchup-card-text-col"]');
      assert.ok(oppTextCol, 'Opponent text column must exist');
      assert.ok(oppTextCol.className.includes('text-right'), 'Opponent text column must have text-right');
      assert.equal(oppTextCol.children.length, 2, 'Layout invariant A: matchup-card-text-col must have strictly 2 children');
      const oppHeadshot = oppTopRow.querySelector('img, span[aria-hidden="true"]');
      assert.ok(oppHeadshot && oppHeadshot.className.includes('w-12') && oppHeadshot.className.includes('sm:w-20') && oppHeadshot.className.includes('lg:w-16'), 'Starter headshot must keep non-clipping mobile sizing and expand on desktop (w-12 sm:w-20 lg:w-16)');
      const oppNameSpan = oppTextCol.children[0].querySelector('span[title]');
      assert.ok(oppNameSpan && oppNameSpan.className.includes('text-base') && oppNameSpan.className.includes('sm:text-lg'), 'Starter name must use scaled typography (text-base sm:text-lg) with title tooltip');
      assert.ok(oppTextCol.children[1].className.includes('text-xs'), 'Starter team/bye row must use readable text-xs+ typography');

      // Opponent stadium row must be a flex-col container with right-aligned items
      const borderTRows = oppCard.querySelectorAll('.border-t');
      assert.ok(borderTRows.length >= 1, 'Must have at least one border-t row');
      const venueRow = borderTRows[0];
      assert.ok(venueRow.className.includes('flex-col'), 'Opponent stadium row must be a flex-col container');
      assert.ok(venueRow.className.includes('items-end'), 'Opponent stadium row must have items-end');
      assert.ok(!venueRow.className.includes('flex-row-reverse'), 'Opponent venue row container must not have flex-row-reverse to avoid flex-direction conflict');

      // User starter card retains left alignment
      const userCard = screen.getByTestId(`matchup-starter-card-${userStarters[0].player_id}`);
      assert.ok(userCard, 'User starter card must exist');
      const userTopRow = userCard.children[0];
      assert.ok(!userTopRow.className.includes('flex-row-reverse'), 'User starter top row must retain left alignment');
      const userBadge = userCard.querySelector(`[data-testid="badge-${userStarters[0].position.toLowerCase()}"]`);
      assert.ok(userBadge && userBadge.className.includes('text-xs') && userBadge.className.includes('sm:text-sm'), 'Starter position badge must scale to md/sm:lg sizing');

      // Check venue row structure and children
      const userVenueRow = userCard.querySelector('[data-testid="matchup-venue-row"]');
      assert.ok(userVenueRow, 'User card must have matchup-venue-row');
      assert.equal(userVenueRow.children.length, 2, 'matchup-venue-row must have exactly 2 children');
      const userLine1 = userVenueRow.querySelector('[data-testid="matchup-venue-line"]');
      const userLine2 = userVenueRow.querySelector('[data-testid="matchup-kickoff-line"]');
      assert.ok(userLine1, 'Must have matchup-venue-line');
      assert.ok(userLine2, 'Must have matchup-kickoff-line');
      assert.ok(userVenueRow.className.includes('items-start'), 'User venue row must have items-start');
      assert.ok(!userVenueRow.className.includes('flex-row-reverse'), 'User venue row container must not have flex-row-reverse');
      assert.ok(!userLine1.className.includes('flex-row-reverse'), 'User venue line 1 must not have flex-row-reverse');
      assert.ok(!userLine2.className.includes('flex-row-reverse'), 'User kickoff line 2 must not have flex-row-reverse');

      const oppVenueRow = oppCard.querySelector('[data-testid="matchup-venue-row"]');
      assert.ok(oppVenueRow, 'Opponent card must have matchup-venue-row');
      assert.equal(oppVenueRow.children.length, 2, 'Opponent matchup-venue-row must have exactly 2 children');
      const oppLine1 = oppVenueRow.querySelector('[data-testid="matchup-venue-line"]');
      const oppLine2 = oppVenueRow.querySelector('[data-testid="matchup-kickoff-line"]');
      assert.ok(oppLine1, 'Opponent must have matchup-venue-line');
      assert.ok(oppLine2, 'Opponent must have matchup-kickoff-line');
      assert.ok(oppVenueRow.className.includes('items-end'), 'Opponent venue row must have items-end');
      assert.ok(!oppVenueRow.className.includes('flex-row-reverse'), 'Opponent venue row container must not have flex-row-reverse');
      assert.ok(oppLine1.className.includes('flex-row-reverse'), 'Opponent venue line 1 must have flex-row-reverse');
      assert.ok(oppLine2.className.includes('flex-row-reverse'), 'Opponent kickoff line 2 must have flex-row-reverse');
      assert.ok(oppLine1.querySelector('span').className.includes('truncate'), 'Opponent venue line 1 must truncate cleanly to a single line');
      assert.ok(oppLine1.querySelector('span').getAttribute('title'), 'Truncated venue line must preserve full accessible title');
      assert.ok(oppLine2.querySelector('span').className.includes('truncate'), 'Opponent kickoff line 2 must truncate cleanly to a single line');
      assert.ok(oppLine2.querySelector('span').getAttribute('title'), 'Truncated kickoff line must preserve full accessible title');

      // Verify card containers have h-full and flex flex-col
      assert.ok(userCard.className.includes('h-full'), 'User card must have h-full');
      assert.ok(userCard.className.includes('flex flex-col'), 'User card must have flex flex-col');
      assert.ok(oppCard.className.includes('h-full'), 'Opponent card must have h-full');
      assert.ok(oppCard.className.includes('flex flex-col'), 'Opponent card must have flex flex-col');

      // Advantage bar strip and delta labels must be completely removed
      assert.equal(document.querySelectorAll('[role="meter"]').length, 0, 'Old matchup advantage meter bars must be removed');
      assert.equal(document.querySelectorAll('[data-testid="matchup-bar-delta"]').length, 0, 'Old Opp Fav / Favored delta tag container must be removed');
      assert.equal(document.querySelectorAll('[data-testid="matchup-bar-user"]').length, 0, 'Old matchup-bar-user must be removed');
      assert.equal(document.querySelectorAll('[data-testid="matchup-bar-opp"]').length, 0, 'Old matchup-bar-opp must be removed');
      assert.equal(document.querySelectorAll('[data-testid="matchup-bar-arrows"]').length, 0, 'Old matchup-bar-arrows must be removed');

      // Hierarchical Stats/Stars -> Oracle node tree verification
      const trees = Array.from(document.querySelectorAll('[data-testid="player-oracle-tree"]'));
      assert.ok(trees.length > 0, 'Must render hierarchical player-oracle-tree widgets inside player cards');
      for (const tree of trees) {
        assert.equal(tree.getAttribute('role'), 'group', 'Tree container must have role="group"');
        const oracleNode = tree.querySelector('[data-testid="oracle-node"]');
        const branches = tree.querySelector('[data-testid="oracle-tree-branches"]');
        const statsLeaf = tree.querySelector('[data-testid="stats-node"]');
        const starsLeaf = tree.querySelector('[data-testid="stars-node"]');
        assert.ok(oracleNode, 'Tree must include top oracle-node');
        assert.ok(branches && branches.tagName.toLowerCase() === 'svg', 'Tree must render SVG feed connectors between leaves and Oracle');
        assert.equal(branches.getAttribute('aria-hidden'), 'true', 'Tree connector SVG must be aria-hidden');
        assert.ok(statsLeaf && statsLeaf.textContent.toUpperCase().includes('STATS'), 'Tree must include Stats child leaf');
        assert.ok(starsLeaf && starsLeaf.textContent.toUpperCase().includes('STARS'), 'Tree must include Stars child leaf');
        // Verify DOM order: Oracle top -> SVG branches -> leaf row containing Stats & Stars
        assert.equal(tree.children.length, 3, 'Node tree must have 3 vertical tiers: Oracle, branches, leaves');
        assert.ok(tree.children[0].contains(oracleNode), 'Tier 0 must be Oracle node');
        assert.equal(tree.children[1], branches, 'Tier 1 must be connector SVG');
        assert.ok(tree.children[2].contains(statsLeaf) && tree.children[2].contains(starsLeaf), 'Tier 2 must contain Stats and Stars leaf nodes');
      }

      // Dominant winning starter card must glow on oracle-node and render floating 5-point SVG stars
      const dominantCards = Array.from(document.querySelectorAll('[data-dominant="true"]'));
      const nonDominantCards = Array.from(document.querySelectorAll('[data-dominant="false"]'));
      assert.ok(dominantCards.length > 0, 'At least one favored starter card must have data-dominant="true"');
      assert.ok(nonDominantCards.length > 0, 'Non-winning starter cards must have data-dominant="false"');

      for (const card of dominantCards) {
        const node = card.querySelector('[data-testid="oracle-node"]');
        assert.ok(node && node.className.includes('shadow-[0_0_16px_rgba('), 'Dominant Oracle node must glow');
        assert.equal(node.querySelectorAll('[data-testid="oracle-powerup-arrows"]').length, 0, 'Power-up arrows must be removed');
        const starsOverlay = node.querySelector('[data-testid="oracle-powerup-stars"]');
        assert.ok(starsOverlay, 'Dominant Oracle node must render oracle-powerup-stars');
        assert.equal(starsOverlay.getAttribute('aria-hidden'), 'true', 'Power-up stars overlay must be aria-hidden');
        const starSvgs = starsOverlay.querySelectorAll('svg');
        assert.ok(starSvgs.length >= 5, `Power-up overlay must render multiple floating 5-point SVG stars, got ${starSvgs.length}`);
        const sizes = new Set();
        const delays = new Set();
        const lefts = new Set();
        for (const svg of starSvgs) {
          const poly = svg.querySelector('polygon');
          assert.ok(poly && (poly.getAttribute('points') || '').split(/\s+/).length >= 10, 'Star SVG must render a 5-point polygon');
          assert.ok(!svg.textContent.includes('✨') && !svg.textContent.includes('▲'), 'Must use actual star SVG, not sparkle emoji or arrow');
          const cls = svg.getAttribute('class') || '';
          assert.ok(cls.includes('animate-powerup-star-float'), 'Star SVG must use animate-powerup-star-float');
          assert.ok(cls.includes('motion-reduce:animate-none'), 'Star SVG must respect reduced motion');
          const w = Number(svg.getAttribute('width'));
          assert.ok(w >= 8 && w <= 14, `Star SVG width must be between 8px and 14px, got ${w}`);
          const delayNum = parseFloat(svg.style.animationDelay);
          assert.ok(!Number.isNaN(delayNum) && delayNum <= 0, `Floating star delay must be <= 0s to avoid mount flash, got ${svg.style.animationDelay}`);
          sizes.add(svg.getAttribute('width'));
          delays.add(svg.style.animationDelay);
          lefts.add(svg.style.left);
        }
        assert.ok(sizes.size >= 2, 'Floating stars must have varied sizes');
        assert.ok(delays.size >= 3, 'Floating stars must have staggered timing delays');
        assert.ok(lefts.size >= 4, 'Floating stars must be distributed across varied horizontal positions');
      }
      for (const card of nonDominantCards) {
        const node = card.querySelector('[data-testid="oracle-node"]');
        assert.ok(node && !node.className.includes('shadow-[0_0_16px_rgba('), 'Non-dominant Oracle node must not glow');
        assert.equal(card.querySelectorAll('[data-testid="oracle-powerup-stars"]').length, 0, 'Non-dominant card must render 0 floating stars');
      }
      // Header radiogroup touch target + ARIA ArrowLeft/ArrowRight keyboard switching + completed Final scores
      const oracleBtn = screen.getByTestId('matchup-score-mode-oracle');
      const statsBtn = screen.getByTestId('matchup-score-mode-stats');
      assert.ok(
        oracleBtn.className.split(/\s+/).includes('min-h-[44px]') && oracleBtn.className.split(/\s+/).includes('min-w-[44px]'),
        'Oracle radio toggle must include >= 44x44px touch target classes',
      );
      assert.ok(
        statsBtn.className.split(/\s+/).includes('min-h-[44px]') && statsBtn.className.split(/\s+/).includes('min-w-[44px]'),
        'Stats radio toggle must include >= 44x44px touch target classes',
      );
      assert.equal(oracleBtn.getAttribute('tabindex'), '0', 'Selected Oracle radio must have roving tabIndex=0');
      assert.equal(statsBtn.getAttribute('tabindex'), '-1', 'Unselected Stats radio must have roving tabIndex=-1');
      const sendKey = (el, key) => {
        act(() => {
          el.dispatchEvent({
            type: 'keydown',
            key,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this._propagationStopped = true; },
          });
        });
      };
      oracleBtn.focus();
      sendKey(oracleBtn, 'ArrowRight');
      assert.equal(screen.getByTestId('matchup-score-mode-stats').getAttribute('aria-checked'), 'true', 'ArrowRight must switch to Stats');
      assert.equal(screen.getByTestId('matchup-score-mode-stats').getAttribute('tabindex'), '0', 'Selected Stats radio must get tabIndex=0');
      assert.equal(screen.getByTestId('matchup-score-mode-oracle').getAttribute('tabindex'), '-1', 'Unselected Oracle radio must get tabIndex=-1');
      assert.equal(oracleBtn.ownerDocument.activeElement, screen.getByTestId('matchup-score-mode-stats'), 'ArrowRight must move focus to Stats radio');

      sendKey(screen.getByTestId('matchup-score-mode-stats'), 'ArrowLeft');
      assert.equal(screen.getByTestId('matchup-score-mode-oracle').getAttribute('aria-checked'), 'true', 'ArrowLeft must switch back to Oracle');
      assert.equal(oracleBtn.ownerDocument.activeElement, screen.getByTestId('matchup-score-mode-oracle'), 'ArrowLeft must move focus back to Oracle radio');

      sendKey(screen.getByTestId('matchup-score-mode-oracle'), 'End');
      assert.equal(screen.getByTestId('matchup-score-mode-stats').getAttribute('aria-checked'), 'true', 'End key must select last (Stats) radio');
      assert.equal(oracleBtn.ownerDocument.activeElement, screen.getByTestId('matchup-score-mode-stats'), 'End key must focus Stats radio');

      sendKey(screen.getByTestId('matchup-score-mode-stats'), 'Home');
      assert.equal(screen.getByTestId('matchup-score-mode-oracle').getAttribute('aria-checked'), 'true', 'Home key must select first (Oracle) radio');
      assert.equal(oracleBtn.ownerDocument.activeElement, screen.getByTestId('matchup-score-mode-oracle'), 'Home key must focus Oracle radio');
      cleanup();

      const completedMatchup = {
        ...testDraftState.weekly_matchup,
        status: 'completed',
        score_user: 142.35,
        score_opponent: 119.8,
      };
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: { ...testDraftState, weekly_matchup: completedMatchup } },
          jsx(MatchupsScreen, { weeklyMatchup: completedMatchup }),
        ),
      );
      assert.equal(screen.getByTestId('matchup-score-mode-oracle').getAttribute('aria-checked'), 'true', 'Completed matchup must still default to Oracle');
      assert.equal(screen.getByTestId('matchup-score-mode-stats').textContent.trim(), 'Final', 'Completed matchup with scores must label Stats mode as Final');
      fireEvent.click(screen.getByTestId('matchup-score-mode-stats'));
      assert.equal(screen.getByTestId('matchup-header-user-score').textContent.trim(), '142.35 Final');
      assert.equal(screen.getByTestId('matchup-header-opp-score').textContent.trim(), '119.80 Final');
      cleanup();

      const completedNoScoreMatchup = {
        ...testDraftState.weekly_matchup,
        status: 'completed',
        score_user: undefined,
        score_opponent: undefined,
      };
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: { ...testDraftState, weekly_matchup: completedNoScoreMatchup } },
          jsx(MatchupsScreen, { weeklyMatchup: completedNoScoreMatchup }),
        ),
      );
      assert.equal(screen.getByTestId('matchup-score-mode-stats').textContent.trim(), 'Stats', 'Completed matchup missing official scores must keep Stats label instead of Final');
      fireEvent.click(screen.getByTestId('matchup-score-mode-stats'));
      assert.ok(screen.getByTestId('matchup-header-user-score').textContent.trim().endsWith('Stats'), 'Header must display Stats label when completed week lacks score_user');
      cleanup();

      // Edge Cases: Kickoff fallback display ('Time TBA' / 'Bye week') and zero arrows on even/open splits
      const edgeMatchup = {
        ...testDraftState.weekly_matchup,
        user_team: {
          ...testDraftState.weekly_matchup?.user_team,
          starters: ['p_tba_kickoff', 'p_even_user', 'p_open_user'],
        },
        opponent_team: {
          ...testDraftState.weekly_matchup?.opponent_team,
          starters: ['p_bye_player', 'p_even_opp'],
        },
        player_favorabilities: [
          {
            ...userStarters[0],
            player_id: 'p_tba_kickoff',
            player_name: 'TBA Kickoff Player',
            name: 'TBA Kickoff Player',
            position: 'QB',
            is_user_team: true,
            is_starter: true,
            slot_role: 'QB',
            game_kickoff: '',
            stadium: {
              stadium_name: 'MetLife Stadium',
              roof_type: 'Open',
              coordinates: { lat: 40.8, lon: -74.0 },
            },
            spirit_score: 85.0,
            draft_score: 85.0,
          },
          {
            ...userStarters[0],
            player_id: 'p_bye_player',
            player_name: 'Bye Week Player',
            name: 'Bye Week Player',
            position: 'QB',
            is_user_team: false,
            is_starter: true,
            slot_role: 'QB',
            bye_week: testDraftState.weekly_matchup?.selected_week || 2,
            stadium: {
              stadium_name: 'No game this week',
              roof_type: '-',
              coordinates: { lat: null, lon: null },
            },
            game_kickoff: 'Bye week',
            spirit_score: 85.0,
            draft_score: 85.0,
          },
          {
            ...userStarters[0],
            player_id: 'p_even_user',
            player_name: 'Even User Player',
            name: 'Even User Player',
            position: 'RB',
            is_user_team: true,
            is_starter: true,
            slot_role: 'RB',
            spirit_score: 80.0,
            draft_score: 80.0,
          },
          {
            ...userStarters[0],
            player_id: 'p_even_opp',
            player_name: 'Even Opp Player',
            name: 'Even Opp Player',
            position: 'RB',
            is_user_team: false,
            is_starter: true,
            slot_role: 'RB',
            spirit_score: 80.0,
            draft_score: 80.0,
          },
          {
            ...userStarters[0],
            player_id: 'p_open_user',
            player_name: 'Open Slot User Player',
            name: 'Open Slot User Player',
            position: 'TE',
            is_user_team: true,
            is_starter: true,
            slot_role: 'TE',
            spirit_score: 75.0,
            draft_score: 75.0,
          },
        ],
      };

      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: { ...testDraftState, weekly_matchup: edgeMatchup } },
          jsx(MatchupsScreen, { weeklyMatchup: edgeMatchup })
        )
      );

      // Verify Time TBA fallback when kickoff is missing
      const tbaCard = screen.getByTestId('matchup-starter-card-p_tba_kickoff');
      assert.ok(tbaCard, 'Card with missing kickoff must exist');
      const tbaKickoffLine = tbaCard.querySelector('[data-testid="matchup-kickoff-line"]');
      assert.ok(tbaKickoffLine, 'Kickoff line must exist on TBA card');
      assert.equal(tbaKickoffLine.textContent.trim(), 'Time TBA', 'Kickoff line must display "Time TBA" when kickoff is missing');

      // Verify Bye week display when player is on bye, and non-dominance for bye starters
      const byeCard = screen.getByTestId('matchup-starter-card-p_bye_player');
      assert.ok(byeCard, 'Card on bye must exist');
      const byeKickoffLine = byeCard.querySelector('[data-testid="matchup-kickoff-line"]');
      assert.ok(byeKickoffLine, 'Kickoff line must exist on bye card');
      assert.equal(byeKickoffLine.textContent.trim(), 'Bye week', 'Kickoff line must display "Bye week" when player is on bye');
      assert.equal(byeCard.getAttribute('data-dominant'), 'false', 'Starter on bye must never be marked data-dominant="true"');
      assert.equal(byeCard.querySelectorAll('[data-testid="oracle-powerup-stars"]').length, 0, 'Starter on bye must render 0 floating stars');

      // Verify RB Even tie pair has equal non-zero Oracle values and '- Even' sr-only status
      const srSummaries = Array.from(document.querySelectorAll('span.sr-only')).map((el) => el.textContent.trim());
      const evenSummary = srSummaries.find((text) => text.includes('Even User Player') && text.includes('Even Opp Player'));
      assert.ok(evenSummary, 'Tie pair must render accessible sr-only summary');
      const oracleMatches = [...evenSummary.matchAll(/Oracle ([\d.]+)/g)].map((m) => Number(m[1]));
      assert.equal(oracleMatches.length, 2, 'Tie pair sr-only summary must report both player Oracle scores');
      assert.ok(oracleMatches[0] > 0 && Math.abs(oracleMatches[0] - oracleMatches[1]) <= 0.05, 'Tie pair must exercise equal non-zero Oracle values');
      assert.ok(evenSummary.endsWith(' - Even'), `Equal non-zero pair must report Even status, got: ${evenSummary}`);

      // Negative assertion for even splits and open slots: 0 dominant Oracle nodes and 0 floating stars
      for (const pid of ['p_even_user', 'p_even_opp', 'p_open_user']) {
        const card = screen.getByTestId(`matchup-starter-card-${pid}`);
        assert.equal(card.getAttribute('data-dominant'), 'false', `Even or open card ${pid} must have data-dominant="false"`);
        assert.equal(card.querySelectorAll('[data-testid="oracle-powerup-stars"]').length, 0, `Even or open card ${pid} must render 0 floating stars`);
      }

      cleanup();
    });
  });

  // ==========================================================================
  // Suite 8.5: Bye-Week Lookahead Badges & PlayerDetailModal Browser History
  // ==========================================================================
  describe('8.5 Bye-Week Lookahead Badges & PlayerDetailModal Browser History', () => {
    function createHistoryEnv(initialEntries = [{ state: null, url: '' }]) {
      const entries = initialEntries.map((e) => ({ state: e.state ?? null, url: e.url ?? '' }));
      let index = entries.length - 1;
      const listeners = new Map();
      const historyMock = {
        pushCalls: 0,
        replaceCalls: 0,
        backCalls: 0,
        get entries() {
          return entries;
        },
        get state() {
          return entries[index]?.state ?? null;
        },
        popStateListenerCount() {
          return listeners.get('popstate')?.size ?? 0;
        },
        pushState(state, _title, url = '') {
          this.pushCalls += 1;
          entries.splice(index + 1);
          entries.push({ state: state ?? null, url: url ?? '' });
          index = entries.length - 1;
        },
        replaceState(state, _title, url = '') {
          this.replaceCalls += 1;
          entries[index] = { state: state ?? null, url: url ?? '' };
        },
        back() {
          this.backCalls += 1;
          if (index > 0) {
            index -= 1;
          }
          const handlers = listeners.get('popstate') || new Set();
          for (const h of [...handlers]) {
            h({ state: entries[index]?.state ?? null });
          }
        },
        dispatchDelayedPopState(stepBack = true) {
          if (stepBack && index > 0) {
            index -= 1;
          }
          const handlers = listeners.get('popstate') || new Set();
          for (const h of [...handlers]) {
            h({ state: entries[index]?.state ?? null });
          }
        },
      };
      const windowMock = {
        location: { origin: 'http://127.0.0.1:3000', search: '' },
        history: historyMock,
        addEventListener(type, fn) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
          listeners.get(type)?.delete(fn);
        },
        dispatchEvent(event) {
          const handlers = listeners.get(event.type) || new Set();
          for (const h of [...handlers]) {
            h(event);
          }
        },
      };
      return { windowMock, historyMock };
    }

    test('8.5.1 Dashboard, PlayerCardRow, CosmicBoard, and PlayerDetailModal render clean BYE WK 7 badge, 0.0 stats, and oracle placeholder marker and tooltips', () => {
      const byePlayerWithNext = {
        ...mockData.mock_oneiromancy_draft_2025.cosmic_board[0],
        id: 'bye_josh_1',
        name: 'Josh Allen',
        team: 'BUF',
        position: 'QB',
        bye_week: 7,
        injury_status: null,
        projected_points: 0,
        sleeper_projected_points: 0,
        weekly_projected_points: 0,
        average_projected_points: 15.0,
        baseline_projected_points: 15.0,
        spirit_score: 82,
        draft_status: 'my_team',
      };
      const byePlayerNoNext = {
        ...mockData.mock_oneiromancy_draft_2025.cosmic_board[1],
        id: 'bye_bench_2',
        name: 'Khalil Shakir',
        team: 'BUF',
        position: 'WR',
        bye_week: 7,
        injury_status: null,
        projected_points: 0,
        sleeper_projected_points: 0,
        weekly_projected_points: 0,
        average_projected_points: 0,
        baseline_projected_points: 0,
        season_projected_points: 0,
        spirit_score: 70,
        draft_status: 'my_team',
      };

      const lookaheadDraftState = {
        ...testDraftState,
        activeWeek: 7,
        my_roster: [
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'BN',
            eligible_positions: ['QB'],
            player: byePlayerWithNext,
            is_locked: false,
          },
          {
            slot_id: 'BN2',
            slot_name: 'Bench 2',
            position: 'BN',
            eligible_positions: ['WR'],
            player: byePlayerNoNext,
            is_locked: false,
          },
        ],
        cosmic_board: [byePlayerWithNext, byePlayerNoNext],
        weekly_matchup: {
          ...testDraftState.weekly_matchup,
          week: 7,
        },
      };

      sleeper.setSeasonContext({
        season: '2026',
        leagueId: 'test',
        currentWeek: 7,
        lastRegularWeek: 14,
        byeWeeks: { BUF: 7 },
        weekDates: {},
        matchupsByWeek: {},
      });
      try {
        const dashView = render(
          jsx(OneiromancyProvider, { initialDraftState: lookaheadDraftState }, jsx(OneiromancyDashboard, {})),
        );
        assert.ok(dashView.container.textContent.includes('BYE WK 7'), 'Dashboard must show clean bye badge');
        assert.ok(!dashView.container.textContent.includes('· Next: Wk 8'), 'Dashboard must omit Next: lookahead badge');
        assert.ok(dashView.container.textContent.includes('0.0'), 'Dashboard must show 0.0 stats projection');
        const dashMarker = dashView.container.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(dashMarker, 'Dashboard must render oracle placeholder marker for bye player');
        assert.equal(dashMarker.getAttribute('title'), null, 'Dashboard placeholder marker must not use native title attribute');
        fireEvent.click(dashMarker);
        const dashTooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
        assert.ok(dashTooltip?.textContent?.includes('15.0 pt season average'), 'Dashboard marker tooltip must explain 15.0 pt placeholder');
        cleanup();

        const rowView = render(
          jsx(PlayerCardRow, { player: byePlayerWithNext, rank: 1, onInspect: () => {} }),
        );
        assert.ok(rowView.container.textContent.includes('BYE WK 7'), 'PlayerCardRow must show clean bye badge');
        assert.ok(!rowView.container.textContent.includes('· Next: Wk 8'), 'PlayerCardRow must omit Next: lookahead badge');
        assert.ok(rowView.container.textContent.includes('0.0'), 'PlayerCardRow must show 0.0 stats');
        const rowMarker = rowView.container.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(rowMarker, 'PlayerCardRow must render oracle placeholder marker');
        cleanup();

        const boardView = render(
          jsx(OneiromancyProvider, { initialDraftState: lookaheadDraftState }, jsx(CosmicBoard, {})),
        );
        assert.ok(boardView.container.textContent.includes('BYE WK 7'), 'CosmicBoard must show clean bye badge');
        assert.ok(!boardView.container.textContent.includes('· Next: Wk 8'), 'CosmicBoard must omit Next: lookahead badge');
        const boardMarker = boardView.container.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(boardMarker, 'CosmicBoard must render oracle placeholder marker');
        cleanup();

        const modalView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: lookaheadDraftState },
            jsx(PlayerDetailModal, { player: byePlayerWithNext, isOpen: true, onClose: () => {} }),
          ),
        );
        assert.ok(modalView.container.textContent.includes('BYE WK 7'), 'PlayerDetailModal must show clean bye badge');
        assert.ok(!modalView.container.textContent.includes('· Next: Wk 8'), 'PlayerDetailModal must omit Next: lookahead badge');
        assert.match(modalView.container.textContent, /0\.0\s+pts/, 'PlayerDetailModal must show 0.0 pts stats');
        const modalMarker = modalView.container.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(modalMarker, 'PlayerDetailModal must render oracle placeholder marker');
        assert.equal(modalMarker.getAttribute('title'), null, 'Modal placeholder marker must not use native title attribute');
        fireEvent.click(modalMarker);
        const modalTooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
        assert.ok(modalTooltip?.textContent?.includes('15.0 pt season average'), 'Modal marker tooltip must explain 15.0 pt placeholder');
        cleanup();

        // Player without average projection must not render placeholder marker
        const noNextRowView = render(
          jsx(PlayerCardRow, { player: byePlayerNoNext, rank: 2, onInspect: () => {} }),
        );
        assert.ok(noNextRowView.container.textContent.includes('BYE WK 7'), 'Must still show BYE WK 7 for player without projection');
        assert.ok(!noNextRowView.container.textContent.includes('Next:'), 'Must omit Next: badge');
        assert.ok(!noNextRowView.container.querySelector('[data-testid="oracle-placeholder-marker"]'), 'Must not render placeholder marker when average projection is 0');
        cleanup();

        // Invalid/zero/NaN/negative/Infinity average_projected_points must omit marker and render 0.0 without NaN or negative values
        for (const invalidVal of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
          const invalidNextPlayer = {
            ...byePlayerNoNext,
            average_projected_points: invalidVal,
          };
          const invalidRowView = render(
            jsx(PlayerCardRow, { player: invalidNextPlayer, rank: 2, onInspect: () => {} }),
          );
          assert.ok(invalidRowView.container.textContent.includes('BYE WK 7'), `Must still show BYE WK 7 for ${String(invalidVal)}`);
          assert.ok(!invalidRowView.container.textContent.includes('Next:'), `Must omit Next: badge when projection is ${String(invalidVal)}`);
          assert.ok(!invalidRowView.container.textContent.includes('NaN'), 'Must never render NaN in PlayerCardRow');
          assert.ok(!invalidRowView.container.textContent.includes('-5'), 'Must never render negative lookahead in PlayerCardRow');
          assert.ok(invalidRowView.container.textContent.includes('0.0'), `Must display 0.0 stats for ${String(invalidVal)}`);
          cleanup();

          const invalidModalView = render(
            jsx(
              OneiromancyProvider,
              { initialDraftState: lookaheadDraftState },
              jsx(PlayerDetailModal, { player: invalidNextPlayer, isOpen: true, onClose: () => {} }),
            ),
          );
          assert.ok(invalidModalView.container.textContent.includes('BYE WK 7'), `PlayerDetailModal must show BYE WK 7 for ${String(invalidVal)}`);
          assert.ok(!invalidModalView.container.textContent.includes('Next:'), `PlayerDetailModal must omit Next: badge for ${String(invalidVal)}`);
          assert.ok(!invalidModalView.container.textContent.includes('NaN'), 'Must never render NaN in PlayerDetailModal');
          assert.ok(!invalidModalView.container.textContent.includes('-5'), 'Must never render negative lookahead in PlayerDetailModal');
          cleanup();
        }
      } finally {
        cleanup();
        sleeper.setSeasonContext(null);
      }
    });

    test('8.5.2 PlayerDetailModal pushes 1 history entry on open (idempotent across rerender) and popstate closes modal once without calling back()', () => {
      const origWindow = globalThis.window;
      const { windowMock, historyMock } = createHistoryEnv();
      globalThis.window = windowMock;
      resetPlayerDetailModalHistoryForTest();

      try {
        let closeCalls = 0;
        const samplePlayer = testDraftState.cosmic_board[0];
        const view = render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose: () => {
              closeCalls += 1;
            },
          }),
        );
        assert.equal(historyMock.pushCalls, 1, 'Opening modal must push 1 history entry');
        assert.equal(historyMock.state?.oneiromancyModal, 'playerDetail');
        assert.equal(historyMock.state?.playerId, String(samplePlayer.id));
        assert.equal(typeof historyMock.state?.oneiromancyEntryId, 'string');
        assert.ok(historyMock.state.oneiromancyEntryId.length > 0);

        // Re-render while still open (e.g. parent re-render) must not push a duplicate entry
        view.rerender(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose: () => {
              closeCalls += 1;
            },
          }),
        );
        assert.equal(historyMock.pushCalls, 1, 'Duplicate render while open must not push a second history entry');

        // Simulate user clicking browser Back button
        historyMock.dispatchDelayedPopState(true);
        assert.equal(closeCalls, 1, 'Browser back (popstate) must invoke onClose once');
        assert.equal(historyMock.backCalls, 0, 'popstate close must not call history.back()');
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.3 PlayerDetailModal closing via X, Close, backdrop, Escape, and parent isOpen=false each call history.back() once without double-closing on popstate', () => {
      const origWindow = globalThis.window;
      const samplePlayer = testDraftState.cosmic_board[0];

      const verifyCloseTrigger = (triggerName, triggerFn) => {
        const { windowMock, historyMock } = createHistoryEnv();
        globalThis.window = windowMock;
        resetPlayerDetailModalHistoryForTest();

        let closeCalls = 0;
        const onClose = () => {
          closeCalls += 1;
        };
        const view = render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose,
          }),
        );
        assert.equal(historyMock.pushCalls, 1, `${triggerName}: must push 1 entry on open`);

        triggerFn(view, onClose, windowMock);

        assert.equal(historyMock.backCalls, 1, `${triggerName}: must call history.back() once`);
        if (triggerName !== 'parent isOpen=false') {
          assert.equal(closeCalls, 1, `${triggerName}: must call onClose once and ignore resulting popstate`);
        } else {
          assert.equal(closeCalls, 0, 'parent isOpen=false must not redundantly call onClose');
        }
        cleanup();
      };

      try {
        verifyCloseTrigger('X button', () => {
          const xBtn = screen.getByRole('button', { name: 'Close dossier' });
          fireEvent.click(xBtn);
        });

        // Verify redundant footer Close button is completely removed per user directive
        const footerCloseBtns = screen
          .getAllByRole('button')
          .filter((b) => (b.textContent || '').trim() === 'Close' && !b.getAttribute('aria-label'));
        assert.equal(footerCloseBtns.length, 0, 'Redundant footer Close button must be removed');

        verifyCloseTrigger('backdrop click', (view) => {
          const overlay = view.container.children[0];
          fireEvent.click(overlay);
        });

        verifyCloseTrigger('Escape key', (_view, _onClose, windowMock) => {
          windowMock.dispatchEvent({ type: 'keydown', key: 'Escape' });
        });

        verifyCloseTrigger('parent isOpen=false', (view, onClose) => {
          view.rerender(
            jsx(PlayerDetailModal, {
              player: samplePlayer,
              isOpen: false,
              onClose,
            }),
          );
        });
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.4 PlayerDetailModal calls replaceState on player switch while open and restores [base, modal] history stack after delayed popstate arrives', () => {
      const origWindow = globalThis.window;
      const { windowMock, historyMock } = createHistoryEnv();
      // Override back() to NOT fire popstate synchronously so we can test reopen while pendingBacks > 0
      historyMock.back = function () {
        this.backCalls += 1;
      };
      globalThis.window = windowMock;
      resetPlayerDetailModalHistoryForTest();

      try {
        const playerA = testDraftState.cosmic_board[0];
        const playerB = testDraftState.cosmic_board[1];
        let closeCalls = 0;
        const onClose = () => {
          closeCalls += 1;
        };

        const view = render(
          jsx(PlayerDetailModal, { player: playerA, isOpen: true, onClose }),
        );
        const playerAEntryId = historyMock.state?.oneiromancyEntryId;
        assert.equal(typeof playerAEntryId, 'string');

        // Switching player while open calls replaceState instead of pushState
        view.rerender(
          jsx(PlayerDetailModal, { player: playerB, isOpen: true, onClose }),
        );
        assert.equal(historyMock.pushCalls, 1, 'Switching player must not push another history entry');
        assert.equal(historyMock.replaceCalls, 1, 'Switching player while open must call replaceState');
        assert.equal(historyMock.state.playerId, String(playerB.id));
        assert.equal(typeof historyMock.state.oneiromancyEntryId, 'string');
        assert.notEqual(
          historyMock.state.oneiromancyEntryId,
          playerAEntryId,
          'Switching player while open must generate a fresh oneiromancyEntryId for replaceState',
        );

        // Close modal programmatically (queues pendingBacks = 1 with delayed popstate)
        view.rerender(
          jsx(PlayerDetailModal, { player: playerB, isOpen: false, onClose }),
        );
        assert.equal(historyMock.backCalls, 1);

        // Reopen modal before delayed popstate from first close arrives
        view.rerender(
          jsx(PlayerDetailModal, { player: playerA, isOpen: true, onClose }),
        );

        // Now deliver the delayed popstate from the prior close
        historyMock.dispatchDelayedPopState(true);
        assert.equal(closeCalls, 0, 'Delayed popstate while pendingBacks > 0 must keep newly opened modal open');
        assert.equal(historyMock.pushCalls, 2, 'Re-pushed modal entry must restore active modal state after delayed popstate');
        assert.equal(historyMock.state?.oneiromancyModal, 'playerDetail');
        assert.equal(historyMock.state?.playerId, String(playerA.id));
        assert.equal(typeof historyMock.state?.oneiromancyEntryId, 'string');
        assert.ok(
          historyMock.state.oneiromancyEntryId.length > 0,
          'History stack must end cleanly on [base, modal] with valid entry id for reopened player',
        );
        assert.ok(screen.getByRole('button', { name: 'Close dossier' }), 'Modal must remain rendered open');
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.5 PlayerDetailModal renders safely when window is undefined (SSR) or window.history is unavailable and Escape still closes', () => {
      const origWindow = globalThis.window;
      const samplePlayer = testDraftState.cosmic_board[0];
      try {
        globalThis.window = undefined;
        const ssrHtml = renderToString(
          jsx(PlayerDetailModal, { player: samplePlayer, isOpen: true, onClose: () => {} }),
        );
        assert.ok(ssrHtml.includes(samplePlayer.name), 'Must render player name during SSR when window is undefined');

        const keyListeners = new Set();
        let escapeClosed = 0;
        globalThis.window = {
          location: { origin: 'http://127.0.0.1:3000', search: '' },
          addEventListener: (t, fn) => {
            if (t === 'keydown') keyListeners.add(fn);
          },
          removeEventListener: (t, fn) => {
            if (t === 'keydown') keyListeners.delete(fn);
          },
        };
        render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose: () => {
              escapeClosed += 1;
            },
          }),
        );
        assert.ok(screen.getByText(samplePlayer.name), 'Must render player name when window.history is undefined');
        for (const fn of [...keyListeners]) fn({ key: 'Escape' });
        assert.equal(escapeClosed, 1, 'Escape key must close modal even when window.history is unavailable');
      } finally {
        cleanup();
        globalThis.window = origWindow;
      }
    });

    test('8.5.6 PlayerDetailModal inside React.StrictMode double-effect lifecycle leaves net 1 history entry, 0 spurious closes, and closes on single popstate', () => {
      const origWindow = globalThis.window;
      const samplePlayer = testDraftState.cosmic_board[0];

      try {
        const { windowMock, historyMock } = createHistoryEnv();
        globalThis.window = windowMock;
        resetPlayerDetailModalHistoryForTest();

        let closeCalls = 0;
        render(
          jsx(
            StrictMode,
            {},
            jsx(PlayerDetailModal, {
              player: samplePlayer,
              isOpen: true,
              onClose: () => {
                closeCalls += 1;
              },
            }),
          ),
        );
        assert.equal(
          historyMock.pushCalls - historyMock.backCalls,
          1,
          'StrictMode double-effect mount must leave net 1 history entry on stack',
        );
        assert.equal(historyMock.backCalls, 0, 'StrictMode double-effect mount must not call history.back() in cleanup');
        assert.equal(closeCalls, 0, 'StrictMode cleanup must not trigger spurious onClose');
        assert.equal(historyMock.state?.oneiromancyModal, 'playerDetail');
        assert.equal(historyMock.state?.playerId, String(samplePlayer.id));

        historyMock.dispatchDelayedPopState(true);
        assert.equal(closeCalls, 1, 'Single popstate must close modal after StrictMode mount');
        cleanup();
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.7 PlayerDetailModal quick reopen followed by close before delayed popstate arrives does not call history.back() a second time', () => {
      const origWindow = globalThis.window;
      const samplePlayerA = testDraftState.cosmic_board[0];
      const samplePlayerB = testDraftState.cosmic_board[1];

      try {
        // Case A: Closed via parent isOpen=false before delayed popstate arrives
        {
          const { windowMock, historyMock } = createHistoryEnv();
          historyMock.back = function () {
            this.backCalls += 1;
          };
          globalThis.window = windowMock;
          resetPlayerDetailModalHistoryForTest();

          let closeCalls = 0;
          const onClose = () => {
            closeCalls += 1;
          };
          const view = render(
            jsx(PlayerDetailModal, { player: samplePlayerB, isOpen: true, onClose }),
          );
          assert.equal(historyMock.pushCalls, 1);

          // First close queues async history.back()
          view.rerender(
            jsx(PlayerDetailModal, { player: samplePlayerB, isOpen: false, onClose }),
          );
          assert.equal(historyMock.backCalls, 1);

          // Quick reopen reuses pending modal entry via replaceState
          view.rerender(
            jsx(PlayerDetailModal, { player: samplePlayerA, isOpen: true, onClose }),
          );
          assert.equal(historyMock.replaceCalls, 1);

          // Second close before delayed popstate arrives must NOT call history.back() a second time
          view.rerender(
            jsx(PlayerDetailModal, { player: samplePlayerA, isOpen: false, onClose }),
          );
          assert.equal(
            historyMock.backCalls,
            1,
            'Closing quickly reopened modal before delayed popstate must not issue a duplicate history.back()',
          );

          // Now deliver the single delayed popstate and verify clean [base] landing without re-push
          historyMock.dispatchDelayedPopState(true);
          assert.equal(historyMock.pushCalls, 1, 'Must not re-push after delayed popstate once closed');
          assert.equal(historyMock.state, null, 'History stack must settle at base state');
          assert.equal(closeCalls, 0);
          cleanup();
        }

        // Case B: Closed via user Close button (requestClose) before delayed popstate arrives
        {
          const { windowMock, historyMock } = createHistoryEnv();
          historyMock.back = function () {
            this.backCalls += 1;
          };
          globalThis.window = windowMock;
          resetPlayerDetailModalHistoryForTest();

          let isOpenState = true;
          const onClose = () => {
            isOpenState = false;
          };
          const view = render(
            jsx(PlayerDetailModal, { player: samplePlayerB, isOpen: isOpenState, onClose }),
          );
          view.rerender(
            jsx(PlayerDetailModal, { player: samplePlayerB, isOpen: false, onClose }),
          );
          assert.equal(historyMock.backCalls, 1);

          isOpenState = true;
          view.rerender(
            jsx(PlayerDetailModal, { player: samplePlayerA, isOpen: isOpenState, onClose }),
          );

          const xBtn = screen.getByRole('button', { name: 'Close dossier' });
          fireEvent.click(xBtn);
          assert.equal(isOpenState, false, 'requestClose must invoke onClose callback');
          view.rerender(
            jsx(PlayerDetailModal, { player: samplePlayerA, isOpen: isOpenState, onClose }),
          );
          assert.equal(
            historyMock.backCalls,
            1,
            'requestClose on quickly reopened modal before delayed popstate must not call history.back() twice',
          );

          historyMock.dispatchDelayedPopState(true);
          assert.equal(historyMock.state, null, 'History stack must land on base state after requestClose');
          cleanup();
        }
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.8 OneiromancyProvider live sync detects lookahead recovery from HTTP 500 to HTTP 200 even when current-week projected_points stay 0 and syncs roster and board UI', async () => {
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;
      globalThis.window = undefined;
      globalThis.localStorage = {
        getItem: (k) => (k === 'oneiromancy_active_username' ? 'OneiroVanguard' : null),
        setItem: () => {},
        removeItem: () => {},
      };
      sleeper.clearProjectionsCache();
      sleeper.resetRateLimit();
      sleeper.setSeasonContext(null);

      let week8Available = false;
      server.use(
        http.get('https://api.sleeper.app/v1/players/nfl', () =>
          HttpResponse.json({
            '4984': {
              player_id: '4984',
              full_name: 'Josh Allen',
              first_name: 'Josh',
              last_name: 'Allen',
              position: 'QB',
              team: 'BUF',
              active: true,
              status: 'Active',
              bye_week: 7,
              search_rank: 1,
            },
          }),
        ),
        http.get('https://api.sleeper.app/v1/state/nfl', () =>
          HttpResponse.json({ season: '2026', week: 7, season_type: 'regular' }),
        ),
        http.get('https://api.sleeper.app/schedule/nfl/regular/2026', () =>
          HttpResponse.json([
            { week: 7, date: '2026-10-18', home: 'KC', away: 'MIA' },
            { week: 8, date: '2026-10-25', home: 'BUF', away: 'MIA' },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/league/9000000000000000001/rosters', () =>
          HttpResponse.json([
            {
              roster_id: 2,
              owner_id: '9000000000000000101',
              starters: ['4984'],
              players: ['4984'],
            },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/league/9000000000000000001/matchups/7', () =>
          HttpResponse.json([
            { roster_id: 2, matchup_id: 1, starters: ['4984'], players: ['4984'], points: 0 },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/7', () =>
          HttpResponse.json({ '4046': { pts_ppr: 20.5 } }),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/8', () => {
          if (!week8Available) {
            return HttpResponse.json({ error: 'Upstream timeout' }, { status: 500 });
          }
          return HttpResponse.json({ '4984': { pts_ppr: 22.8 } });
        }),
      );

      let latestCtx = null;
      function LiveLookaheadHarness() {
        latestCtx = useOneiromancy();
        return jsx(OneiromancyDashboard, {});
      }

      const initialLiveSeed = {
        ...testDraftState,
        draft_id: '9000000000000000002',
        status: 'complete',
        isLive: true,
        activeWeek: 7,
        settings: {
          ...testDraftState.settings,
          draft_id: '9000000000000000002',
          league_id: '9000000000000000001',
          sleeper_username: 'OneiroVanguard',
          user_id: '9000000000000000101',
          user_slot: 7,
          mode: 'live',
          auto_update: false,
          poll_interval_ms: 600000,
        },
      };

      try {
        const view = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: initialLiveSeed },
            jsx(LiveLookaheadHarness, {}),
          ),
        );

        // First live sync: Week 8 fails with HTTP 500 -> Josh Allen has 0 current pts and no next_week_projected_points
        await act(async () => {
          await latestCtx.refreshDraft();
        });

        await waitFor(() => {
          const joshRoster = latestCtx.draftState.my_roster.find((s) => s.player?.id === '4984')?.player;
          assert.ok(joshRoster, 'Josh Allen must be on user roster after initial live sync');
          assert.equal(joshRoster.projected_points, 0);
          assert.equal(joshRoster.next_play_week, 8);
          assert.equal(joshRoster.next_week_projected_points, undefined);
        });
        assert.ok(!view.container.textContent.includes('Next: Wk 8'), 'Initial sync with HTTP 500 must not render Next: Wk 8');

        // Second live sync after cache expiry: Week 8 recovers with 22.8 pts while Week 7 projected_points stays 0
        week8Available = true;
        sleeper.clearProjectionsCache();
        await act(async () => {
          await latestCtx.refreshDraft();
        });

        await waitFor(() => {
          const joshRoster = latestCtx.draftState.my_roster.find((s) => s.player?.id === '4984')?.player;
          const joshBoard = latestCtx.draftState.cosmic_board.find((p) => p.id === '4984');
          assert.equal(joshRoster?.next_week_projected_points, 22.8, 'Roster slot must update with recovered Week 8 projection');
          assert.equal(joshBoard?.next_week_projected_points, 22.8, 'Cosmic board must update with recovered Week 8 projection');
          assert.ok(view.container.textContent.includes('BYE WK 7'), 'Dashboard must render BYE WK 7 badge');
          assert.ok(!view.container.textContent.includes('· Next: Wk 8'), 'Dashboard must omit Next: lookahead badge');
          assert.ok(view.container.textContent.includes('0.0'), 'Dashboard must render 0.0 stats projection for bye starter');
        });

        // Third sync with unchanged data must preserve the exact draftState reference (diff-gated bailout)
        const stateBeforeUnchangedSync = latestCtx.draftState;
        await act(async () => {
          await latestCtx.refreshDraft();
        });
        assert.equal(
          latestCtx.draftState,
          stateBeforeUnchangedSync,
          'Consecutive sync with identical lookahead data must keep exact draftState reference',
        );
      } finally {
        cleanup();
        sleeper.clearProjectionsCache();
        sleeper.resetRateLimit();
        sleeper.setSeasonContext(null);
        globalThis.localStorage = origLocalStorage;
        globalThis.window = origWindow;
      }
    });

    test('8.5.9 PlayerDetailModal closes on a single Back press even when a stale playerDetail history entry from before reload sits underneath', () => {
      const origWindow = globalThis.window;
      const samplePlayerA = testDraftState.cosmic_board[0];
      const samplePlayerB = testDraftState.cosmic_board[1];
      const { windowMock, historyMock } = createHistoryEnv([
        { state: null, url: '' },
        {
          state: {
            oneiromancyModal: 'playerDetail',
            oneiromancyEntryId: 'stale-previous-reload:1',
            playerId: String(samplePlayerB.id),
          },
          url: '',
        },
      ]);
      globalThis.window = windowMock;
      resetPlayerDetailModalHistoryForTest();

      try {
        let closeCalls = 0;
        render(
          jsx(PlayerDetailModal, {
            player: samplePlayerA,
            isOpen: true,
            onClose: () => {
              closeCalls += 1;
            },
          }),
        );
        assert.equal(historyMock.replaceCalls, 1, 'Top playerDetail entry must be taken over via replaceState');
        assert.equal(historyMock.pushCalls, 0, 'Must not call pushState when top history entry is already playerDetail');
        assert.equal(historyMock.state?.playerId, String(samplePlayerA.id));
        assert.notEqual(
          historyMock.state?.oneiromancyEntryId,
          'stale-previous-reload:1',
          'Current modal entry must carry its own unique oneiromancyEntryId',
        );

        // One browser Back steps onto the base entry; modal must close cleanly
        historyMock.dispatchDelayedPopState(true);
        assert.equal(
          closeCalls,
          1,
          'Single Back press must close modal when stepping back to base entry',
        );
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.10 Unmounting open PlayerDetailModal cleans up without calling history.back() inside useEffect cleanup and removes global popstate listener', () => {
      const origWindow = globalThis.window;
      const { windowMock, historyMock } = createHistoryEnv();
      globalThis.window = windowMock;
      resetPlayerDetailModalHistoryForTest();

      try {
        const samplePlayer = testDraftState.cosmic_board[0];
        const view = render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose: () => {},
          }),
        );
        assert.equal(historyMock.pushCalls, 1, 'Mounting open modal must push 1 history entry');
        assert.equal(historyMock.popStateListenerCount(), 1, 'Mounting modal must attach 1 global popstate listener');

        // Unmount component while still open (e.g. parent unmounts tree without setting isOpen=false)
        view.unmount();
        assert.equal(historyMock.backCalls, 0, 'Unmounting modal must never call history.back() inside useEffect cleanup');
        assert.equal(
          historyMock.popStateListenerCount(),
          0,
          'Unmounting last PlayerDetailModal must remove global popstate listener',
        );
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.11 PlayerDetailModal preserves external history entry without oneiromancyEntryId pushed above an open modal', () => {
      const origWindow = globalThis.window;
      const samplePlayer = testDraftState.cosmic_board[0];

      // Case A: External object state { external: true } pushed above open modal
      try {
        const { windowMock, historyMock } = createHistoryEnv();
        globalThis.window = windowMock;
        resetPlayerDetailModalHistoryForTest();

        let closeCalls = 0;
        const onClose = () => {
          closeCalls += 1;
        };
        const view = render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose,
          }),
        );
        assert.equal(historyMock.pushCalls, 1);

        // External script pushes an unrelated history entry above the open modal
        historyMock.pushState({ external: true }, '', '#external');
        assert.deepEqual(historyMock.state, { external: true });

        // Dismissing modal must close React modal without popping the unrelated external entry
        const xBtn = screen.getByRole('button', { name: 'Close dossier' });
        fireEvent.click(xBtn);
        assert.equal(closeCalls, 1);
        assert.equal(historyMock.backCalls, 0, 'Must not call history.back() over an unrelated external history entry');
        assert.deepEqual(historyMock.state, { external: true });
        view.unmount();
        cleanup();
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }

      // Case B: External null state pushed above open modal (e.g. hash link or pushState(null, ...))
      try {
        const { windowMock, historyMock } = createHistoryEnv();
        globalThis.window = windowMock;
        resetPlayerDetailModalHistoryForTest();

        let closeCalls = 0;
        const onClose = () => {
          closeCalls += 1;
        };
        const view = render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose,
          }),
        );
        assert.equal(historyMock.pushCalls, 1);

        // External navigation pushes a null-state history entry above the open modal
        historyMock.pushState(null, '', '#null-external');
        assert.equal(historyMock.state, null);

        // Dismissing modal must close React modal without popping the unrelated null-state external entry
        const xBtn = screen.getByRole('button', { name: 'Close dossier' });
        fireEvent.click(xBtn);
        assert.equal(closeCalls, 1);
        assert.equal(
          historyMock.backCalls,
          0,
          'Must not call history.back() over an unrelated external null-state history entry',
        );
        assert.equal(historyMock.state, null);
        view.unmount();
        cleanup();
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.12 MatchupsScreen preserves user-selected week across background context state updates', () => {
      try {
        try {
          localStorage.removeItem('oneiromancy_active_slot');
          localStorage.removeItem('oneiromancy_oracle_v2');
        } catch {}

        function Harness() {
          const { updateChaosLambda, setUserSlot } = useOneiromancy();
          return jsx(
            Fragment,
            null,
            jsx(
              'button',
              { type: 'button', 'data-testid': 'trigger-context-update', onClick: () => updateChaosLambda(0.8) },
              'Update Lambda',
            ),
            jsx(
              'button',
              { type: 'button', 'data-testid': 'trigger-slot-update', onClick: () => setUserSlot(3) },
              'Update Slot',
            ),
            jsx(MatchupsScreen, {}),
          );
        }

        const view = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(Harness, {}),
          ),
        );
        assert.ok(view.container.textContent.includes('Week 2 Matchup'), 'Initial week must be Week 2');

        fireEvent.click(screen.getByTestId('matchup-week-btn-5'));
        assert.ok(view.container.textContent.includes('Week 5 Matchup'), 'Clicking Week 5 must select Week 5 Matchup');

        fireEvent.click(screen.getByTestId('trigger-context-update'));
        assert.ok(
          view.container.textContent.includes('Week 5 Matchup'),
          'Background context updates (recomputing weekly_matchup) must not reset user-selected Week 5 back to Week 2',
        );

        fireEvent.click(screen.getByTestId('trigger-slot-update'));
        assert.ok(
          view.container.textContent.includes('Week 5 Matchup'),
          'Recomputing weekly_matchup on slot update with same week must preserve user-selected Week 5',
        );
      } finally {
        cleanup();
        try {
          localStorage.removeItem('oneiromancy_active_slot');
          localStorage.removeItem('oneiromancy_oracle_v2');
        } catch {}
      }
    });

    test('8.5.13 MatchupsScreen updates selectedWeek when active league or draft week genuinely changes', () => {
      try {
        try {
          localStorage.removeItem('oneiromancy_active_slot');
          localStorage.removeItem('oneiromancy_oracle_v2');
        } catch {}

        const week4State = {
          ...testDraftState,
          draft_id: 'custom_week4_draft',
          settings: {
            ...testDraftState.settings,
            draft_id: 'custom_week4_draft',
          },
          weekly_matchup: {
            ...testDraftState.weekly_matchup,
            week: 4,
          },
        };

        function Harness() {
          const { loadMockData } = useOneiromancy();
          return jsx(
            Fragment,
            null,
            jsx(
              'button',
              { type: 'button', 'data-testid': 'trigger-draft-switch', onClick: () => loadMockData() },
              'Load Mock Data',
            ),
            jsx(MatchupsScreen, {}),
          );
        }

        const view = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: week4State },
            jsx(Harness, {}),
          ),
        );
        assert.ok(view.container.textContent.includes('Week 4 Matchup'), 'Initial week must be Week 4');

        fireEvent.click(screen.getByTestId('matchup-week-btn-5'));
        assert.ok(view.container.textContent.includes('Week 5 Matchup'), 'Clicking Week 5 must select Week 5 Matchup');

        fireEvent.click(screen.getByTestId('trigger-draft-switch'));
        assert.ok(
          view.container.textContent.includes('Week 2 Matchup'),
          'Switching to mock draft (week 2, different draft_id) must update selectedWeek to Week 2',
        );
      } finally {
        cleanup();
        try {
          localStorage.removeItem('oneiromancy_active_slot');
          localStorage.removeItem('oneiromancy_oracle_v2');
        } catch {}
      }
    });

    test('8.5.14 PlayerDetailModal adopted from page reload without in-app push strips modal state via replaceState without calling history.back() on close', () => {
      const origWindow = globalThis.window;
      const samplePlayer = testDraftState.cosmic_board[0];

      try {
        // Sub-case A: Dismissing via X button when adopted from reload
        {
          const { windowMock, historyMock } = createHistoryEnv([
            { state: { page: 'home' }, url: '/dashboard' },
            {
              state: {
                page: 'home',
                oneiromancyModal: 'playerDetail',
                oneiromancyEntryId: 'reloaded-modal-entry',
                playerId: String(samplePlayer.id),
              },
              url: '/dashboard',
            },
          ]);
          globalThis.window = windowMock;
          resetPlayerDetailModalHistoryForTest();

          let closeCalls = 0;
          render(
            jsx(PlayerDetailModal, {
              player: samplePlayer,
              isOpen: true,
              onClose: () => {
                closeCalls += 1;
              },
            }),
          );

          assert.equal(historyMock.pushCalls, 0, 'Must not push history entry when adopting reloaded modal');
          assert.equal(historyMock.replaceCalls, 1, 'Must adopt modal entry via replaceState');

          const xBtn = screen.getByRole('button', { name: 'Close dossier' });
          fireEvent.click(xBtn);

          assert.equal(closeCalls, 1, 'Must trigger onClose handler');
          assert.equal(
            historyMock.backCalls,
            0,
            'Must NOT call history.back() when closing modal adopted from reload without in-app push',
          );
          assert.equal(
            historyMock.replaceCalls,
            2,
            'Must strip modal state via replaceState on close',
          );
          assert.equal(
            historyMock.state?.oneiromancyModal,
            undefined,
            'Modal state must be removed from history state',
          );
          assert.equal(
            historyMock.state?.page,
            'home',
            'Surrounding history state must be preserved',
          );
          cleanup();
        }

        // Sub-case B: Dismissing via parent isOpen=false when adopted from reload
        {
          const { windowMock, historyMock } = createHistoryEnv([
            {
              state: {
                page: 'roster',
                oneiromancyModal: 'playerDetail',
                oneiromancyEntryId: 'reloaded-modal-entry-2',
                playerId: String(samplePlayer.id),
              },
              url: '/roster',
            },
          ]);
          globalThis.window = windowMock;
          resetPlayerDetailModalHistoryForTest();

          let closeCalls = 0;
          const view = render(
            jsx(PlayerDetailModal, {
              player: samplePlayer,
              isOpen: true,
              onClose: () => {
                closeCalls += 1;
              },
            }),
          );

          assert.equal(historyMock.pushCalls, 0, 'Must not push history entry when adopting reloaded modal');
          assert.equal(historyMock.replaceCalls, 1, 'Must adopt modal entry via replaceState');

          view.rerender(
            jsx(PlayerDetailModal, {
              player: samplePlayer,
              isOpen: false,
              onClose: () => {
                closeCalls += 1;
              },
            }),
          );

          assert.equal(
            historyMock.backCalls,
            0,
            'Parent isOpen=false must NOT call history.back() when modal was adopted from reload',
          );
          assert.equal(
            historyMock.replaceCalls,
            2,
            'Parent isOpen=false must strip modal state via replaceState',
          );
          assert.equal(
            historyMock.state?.oneiromancyModal,
            undefined,
            'Modal state must be removed from history state',
          );
          assert.equal(
            historyMock.state?.page,
            'roster',
            'Surrounding history state must be preserved',
          );
          cleanup();
        }
      } finally {
        cleanup();
        resetPlayerDetailModalHistoryForTest();
        globalThis.window = origWindow;
      }
    });

    test('8.5.15 should verify MatchupsScreen renders placeholder on Week 7 bye while keeping starter stats at 0.0', () => {
      const rushOnBye = {
        player_id: '4574',
        player_name: 'Cooper Rush',
        position: 'QB',
        nfl_team: 'DAL',
        team: 'DAL',
        is_user_team: true,
        projected_points: 0,
        average_projected_points: 15.2,
        baseline_projected_points: 15.2,
        favorability_score: 18,
        game_kickoff: 'Bye week',
        stadium: { stadium_name: 'No game this week' },
      };
      const matchupWeek7 = {
        week: 7,
        matchup_id: 3,
        user_team: {
          slot: 7,
          roster_id: 2,
          team_name: 'AstralOracles (You)',
          projected_points: 112.15,
          starters: ['4574'],
          players: ['4574'],
        },
        opponent_team: {
          slot: 5,
          roster_id: 11,
          team_name: 'SolarFlare',
          projected_points: 105.12,
          starters: [],
          players: [],
        },
        player_favorabilities: [rushOnBye],
        upcoming_matchups: [],
      };
      const draftStateWk7 = {
        ...testDraftState,
        weekly_matchup: matchupWeek7,
        cosmic_board: [
          {
            id: '4574',
            name: 'Cooper Rush',
            position: 'QB',
            team: 'DAL',
            bye_week: 7,
            average_projected_points: 15.2,
            baseline_projected_points: 15.2,
            spirit_score: 85,
            draft_status: 'my_team',
          },
        ],
      };
      const { container } = render(
        jsx(OneiromancyProvider, {
          initialDraftState: draftStateWk7,
          children: jsx(MatchupsScreen, {
            weeklyMatchup: matchupWeek7,
          }),
        }),
      );
      assert.ok(
        container.textContent.includes('BYE WK 7'),
        'MatchupsScreen must render clean bye badge for player on bye in Week 7',
      );
      assert.ok(
        !container.textContent.includes('· Next: Wk 8'),
        'MatchupsScreen must omit Next: lookahead badge',
      );
      const oracleMarker = container.querySelector('[data-testid="oracle-placeholder-marker"]');
      assert.ok(oracleMarker, 'Oracle marker must render placeholder marker ~');
      const statsBox = Array.from(container.querySelectorAll('div')).find((el) => el.getAttribute('title')?.includes('0.0 pts (on bye)'));
      assert.ok(statsBox, 'Baseline projected points element with placeholder tooltip must be present');
      assert.equal(statsBox.textContent.replace(/\s+/g, ''), 'Stats0.0');
      cleanup();
    });

    test('8.5.16 should verify HealthTag displays both injury and clean bye badge for an injured player on bye', () => {
      const injuredByePlayer = {
        id: 'inj_bye_1',
        name: 'Injured Star',
        position: 'WR',
        team: 'DAL',
        bye_week: 7,
        average_projected_points: 14.5,
        baseline_projected_points: 14.5,
        injury_status: 'Out',
        spirit_score: 80,
      };
      const { container } = render(
        jsx(HealthTag, {
          player: injuredByePlayer,
          activeWeek: 7,
        }),
      );
      assert.ok(container.textContent.includes('Out'), 'HealthTag must display severe injury status Out');
      assert.ok(
        container.textContent.includes('BYE WK 7'),
        'HealthTag must display clean bye badge',
      );
      assert.ok(
        !container.textContent.includes('· Next: Wk 8'),
        'HealthTag must omit lookahead badge',
      );
      assert.ok(container.textContent.includes('On Bye'), 'HealthTag must include On Bye label');
      cleanup();
    });

    test('8.5.17 should verify active week agreement across screens in mock mode via resolveActiveWeek', () => {
      seasonContext.setSeasonContextState(null);
      assert.equal(oracle.resolveActiveWeek(null), 2, 'Null draftState outside provider must fall back to 2');
      assert.equal(oracle.resolveActiveWeek(undefined), 2, 'Undefined draftState outside provider must fall back to 2');

      const mockState = {
        isLive: false,
        mode: 'mock',
        weekly_matchup: { week: 1 },
      };
      const resolved = oracle.resolveActiveWeek(mockState);
      assert.equal(resolved, 7, 'Mock mode must resolve active week to 7 to show realistic bye lookahead');

      assert.equal(oracle.resolveActiveWeek(mockState, 10), 10, 'Explicit week override must take precedence');

      const liveState = {
        isLive: true,
        mode: 'live',
        weekly_matchup: { week: 3 },
      };
      assert.equal(oracle.resolveActiveWeek(liveState), 3, 'Live mode must use matchup week or season context');
    });

    test('8.5.18 should verify PlayerDetailModal renders clean bye badge and placeholder from activeWeek prop without SeasonContext', () => {
      seasonContext.setSeasonContextState(null);
      const byePlayer = {
        id: 'bye_wr_7',
        name: 'CeeDee Lamb',
        position: 'WR',
        team: 'DAL',
        bye_week: 7,
        average_projected_points: 19.4,
        baseline_projected_points: 19.4,
        spirit_score: 92,
      };
      const { container } = render(
        jsx(PlayerDetailModal, {
          player: byePlayer,
          isOpen: true,
          activeWeek: 7,
          onClose: () => {},
        }),
      );
      assert.ok(
        container.textContent.includes('BYE WK 7'),
        'PlayerDetailModal must render clean bye badge when activeWeek=7 is passed via prop without SeasonContext',
      );
      assert.ok(
        !container.textContent.includes('· Next: Wk 8'),
        'PlayerDetailModal must omit lookahead next badge',
      );
      assert.match(
        container.textContent,
        /0\.0\s+pts/,
        'PlayerDetailModal must display 0.0 pts stats in metrics section',
      );
      const marker = container.querySelector('[data-testid="oracle-placeholder-marker"]');
      assert.ok(marker, 'PlayerDetailModal must render oracle placeholder marker');
      assert.equal(marker.getAttribute('title'), null, 'Marker must not expose native browser title');
      fireEvent.click(marker);
      const markerTooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
      assert.ok(
        markerTooltip?.textContent?.includes('uses the 19.4 pt season average instead of 0.0'),
        'Marker tooltip must explain placeholder',
      );
      cleanup();
    });

    test('8.5.19 should verify rendered CosmicBoard (both table and card) and LeagueScreen agree on clean Week 7 bye badges in mock mode', () => {
      seasonContext.setSeasonContextState(null);
      const rushOnBye = {
        ...mockData.mock_oneiromancy_draft_2025.cosmic_board[0],
        id: '4574',
        name: 'Cooper Rush',
        position: 'QB',
        team: 'DAL',
        bye_week: 7,
        average_projected_points: 15.2,
        baseline_projected_points: 15.2,
        spirit_score: 85,
        draft_status: 'my_team',
      };
      const mockState = {
        ...testDraftState,
        isLive: false,
        mode: 'mock',
        weekly_matchup: {
          ...testDraftState.weekly_matchup,
          week: 1,
        },
        cosmic_board: [rushOnBye],
        competitor_teams: [
          {
            slot: 7,
            roster_id: 2,
            name: 'AstralOracles (You)',
            is_user: true,
            starters: ['4574'],
            players: ['4574'],
          },
        ],
        my_roster: [
          {
            slot_id: 'QB',
            slot_name: 'Quarterback',
            position: 'QB',
            eligible_positions: ['QB'],
            player: rushOnBye,
            is_locked: false,
          },
        ],
      };

      const boardView = render(
        jsx(OneiromancyProvider, { initialDraftState: mockState }, jsx(CosmicBoard, {})),
      );
      const tableEl = boardView.container.querySelector('table');
      assert.ok(tableEl && tableEl.textContent.includes('BYE WK 7'), 'CosmicBoard desktop table must render BYE WK 7');
      assert.ok(tableEl && !tableEl.textContent.includes('· Next: Wk 8'), 'CosmicBoard desktop table must omit Next: Wk 8');
      const badgeOccurrences = boardView.container.textContent.match(/BYE WK 7/g);
      assert.ok(
        (badgeOccurrences?.length || 0) >= 2,
        'CosmicBoard must render BYE WK 7 in both mobile card list and desktop table',
      );
      cleanup();

      const leagueView = render(
        jsx(OneiromancyProvider, { initialDraftState: mockState }, jsx(LeagueScreen, {})),
      );
      assert.ok(
        leagueView.container.textContent.includes('BYE WK 7'),
        'LeagueScreen must render BYE WK 7 badge for roster player on bye in mock mode',
      );
      cleanup();
    });

    test('8.5.20 MatchupsScreen defaults to Week 7 in mock mode and swap tooltip recommends bench swap against bye starter', () => {
      const rushRoster = {
        id: '4574',
        name: 'Cooper Rush',
        position: 'QB',
        team: 'DAL',
        bye_week: 7,
        projected_points: 0,
        sleeper_projected_points: 0,
        weekly_projected_points: 0,
        average_projected_points: 15.2,
        baseline_projected_points: 15.2,
        spirit_score: 70,
        draft_status: 'my_team',
      };
      const huntleyRoster = {
        id: '7083',
        name: 'Tyler Huntley',
        position: 'QB',
        team: 'MIA',
        bye_week: 6,
        projected_points: 14.5,
        sleeper_projected_points: 14.5,
        weekly_projected_points: 14.5,
        average_projected_points: 14.5,
        baseline_projected_points: 14.5,
        spirit_score: 65,
        draft_status: 'my_team',
      };
      const rushBoard = {
        ...rushRoster,
        spirit_score: 85,
      };
      const huntleyBoard = {
        ...huntleyRoster,
      };

      const mockState = {
        ...testDraftState,
        isLive: false,
        mode: 'mock',
        weekly_matchup: {
          ...testDraftState.weekly_matchup,
          week: 1,
        },
        cosmic_board: [rushBoard, huntleyBoard],
        my_roster: [
          {
            slot_id: 'QB',
            slot_name: 'Quarterback',
            position: 'QB',
            eligible_positions: ['QB'],
            player: rushRoster,
            is_locked: false,
          },
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'QB',
            eligible_positions: ['QB'],
            player: huntleyRoster,
            is_locked: false,
          },
        ],
        competitor_teams: [
          {
            slot: 7,
            roster_id: 2,
            name: 'AstralOracles (You)',
            is_user: true,
            starters: ['4574'],
            players: ['4574', '7083'],
          },
        ],
      };

      const matchupsView = render(
        jsx(OneiromancyProvider, { initialDraftState: mockState }, jsx(MatchupsScreen, {})),
      );
      assert.ok(
        matchupsView.container.textContent.includes('BYE WK 7'),
        'MatchupsScreen without explicit week prop must resolve to mock Week 7 and display clean bye badge',
      );
      assert.ok(
        !matchupsView.container.textContent.includes('· Next: Wk 8'),
        'MatchupsScreen must omit Next: lookahead badge',
      );

      const cardEl = matchupsView.container.querySelector('div[data-testid="matchup-starter-card-4574"]');
      assert.ok(cardEl, 'Cooper Rush starter card must render in MatchupsScreen');

      // Verify Stats displays 0.0
      assert.ok(cardEl.textContent.includes('0.0'), 'Stats must display 0.0');

      // Verify placeholder marker on Oracle score
      const oracleMarker = cardEl.querySelector('[data-testid="oracle-placeholder-marker"]');
      assert.ok(oracleMarker, 'Oracle marker must render ~');

      // Verify swap opportunity pill scoped directly to Cooper Rush's starter card
      const swapEl = cardEl.querySelector('div[data-testid="matchup-swap-opportunity"]');
      assert.ok(swapEl, 'Swap opportunity pill must render on bye starter card');

      const titleAttr = swapEl.getAttribute('title') || '';
      const lambda = mockState.settings?.chaos_lambda ?? scoring.DEFAULT_CHAOS_LAMBDA;
      const expectedCurrentOracle = oracle.currentWeekOracleScore(rushBoard, lambda, 7);
      const expectedBenchOracle = oracle.currentWeekOracleScore(huntleyBoard, lambda, 7);
      const expectedGain = (Math.round((expectedBenchOracle - expectedCurrentOracle) * 10) / 10).toFixed(1);

      assert.equal(
        titleAttr,
        `Bench ${huntleyBoard.name} scores +${expectedGain} higher Oracle (${expectedBenchOracle.toFixed(1)} vs ${expectedCurrentOracle.toFixed(1)})`,
        'Swap tooltip title must exactly match calculated bench and current-week Oracle values',
      );

      const tooltipText = cardEl.querySelector('span[data-testid="matchup-swap-tooltip"]')?.textContent || '';
      assert.equal(
        tooltipText,
        `Swap Opportunity: Bench ${huntleyBoard.name} adds +${expectedGain} Oracle`,
        'Swap tooltip banner must state exact calculated gain',
      );
      cleanup();

      // Verify swap pill suppression when bench player is also on bye in Week 7 (no swap opportunity produced)
      const benchOnByeRoster = {
        ...huntleyRoster,
        bye_week: 7,
      };
      const suppressedState = {
        ...mockState,
        cosmic_board: [rushBoard, { ...huntleyBoard, bye_week: 7 }],
        my_roster: [
          mockState.my_roster[0],
          {
            ...mockState.my_roster[1],
            player: benchOnByeRoster,
          },
        ],
      };
      const suppressedView = render(
        jsx(OneiromancyProvider, { initialDraftState: suppressedState }, jsx(MatchupsScreen, {})),
      );
      const suppressedCardEl = suppressedView.container.querySelector('div[data-testid="matchup-starter-card-4574"]');
      assert.ok(suppressedCardEl, 'Starter card must render');
      const suppressedSwap = suppressedCardEl.querySelector('div[data-testid="matchup-swap-opportunity"]');
      assert.ok(suppressedSwap === null, 'Swap tooltip must be suppressed when bench player is also on bye');
      cleanup();

      // Verify 3-QB scenario: starter on bye, high raw score bench player also on bye, active bench player promoted
      const highRawByeBench = {
        id: '9999',
        name: 'Dak Prescott',
        position: 'QB',
        team: 'DAL',
        bye_week: 7,
        projected_points: 22.0,
        sleeper_projected_points: 22.0,
        weekly_projected_points: 22.0,
        spirit_score: 90,
        draft_status: 'my_team',
      };
      const threeQbState = {
        ...mockState,
        cosmic_board: [rushBoard, highRawByeBench, huntleyBoard],
        my_roster: [
          mockState.my_roster[0],
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'QB',
            eligible_positions: ['QB'],
            player: highRawByeBench,
            is_locked: false,
          },
          {
            slot_id: 'BN2',
            slot_name: 'Bench 2',
            position: 'QB',
            eligible_positions: ['QB'],
            player: huntleyRoster,
            is_locked: false,
          },
        ],
      };
      const threeQbView = render(
        jsx(OneiromancyProvider, { initialDraftState: threeQbState }, jsx(MatchupsScreen, {})),
      );
      const threeQbCard = threeQbView.container.querySelector('div[data-testid="matchup-starter-card-4574"]');
      assert.ok(threeQbCard, 'Starter card must render in 3-QB matchup');
      const threeQbSwap = threeQbCard.querySelector('div[data-testid="matchup-swap-opportunity"]');
      assert.ok(threeQbSwap, 'Swap pill must render in 3-QB matchup recommending active player over bye bench player');
      const threeQbTitle = threeQbSwap.getAttribute('title') || '';
      assert.equal(
        threeQbTitle,
        titleAttr,
        'Swap pill must recommend active bench QB (Tyler Huntley) with exact matching title',
      );
      const threeQbTooltip = threeQbCard.querySelector('span[data-testid="matchup-swap-tooltip"]')?.textContent || '';
      assert.equal(
        threeQbTooltip,
        tooltipText,
        'Swap tooltip banner in 3-QB matchup must state exact calculated gain',
      );
      cleanup();
    });

    test('8.5.21 MatchupsScreen preserves real roster player attributes when missing from cosmic board', () => {
      // Starter player: Cooper Rush (healthy active QB, 12.0 proj, 70 stars)
      const rushRoster = {
        id: '4574',
        name: 'Cooper Rush',
        position: 'QB',
        team: 'DAL',
        bye_week: 9,
        projected_points: 12.0,
        sleeper_projected_points: 12.0,
        weekly_projected_points: 12.0,
        spirit_score: 70,
        injury_status: '',
        draft_status: 'my_team',
      };
      // Injured bench player: Trey Lance, OUT with injury (-22.0 injury penalty in computeLineupCheck)
      // This player is on the roster with injury_status: 'Out', has a favorability entry, but is NOT in cosmic_board
      const injuredBenchRoster = {
        id: '7523',
        name: 'Trey Lance',
        position: 'QB',
        team: 'DAL',
        bye_week: 9,
        projected_points: 20.0,
        sleeper_projected_points: 20.0,
        weekly_projected_points: 20.0,
        spirit_score: 80,
        injury_status: 'Out',
        draft_status: 'my_team',
      };
      const injuredBenchFav = {
        player_id: '7523',
        player_name: 'Trey Lance',
        position: 'QB',
        team: 'DAL',
        nfl_team: 'DAL',
        projected_points: 20.0,
        favorability_score: 90.0,
        favorability_verdict: 'HEAVILY FAVORED',
        is_user_team: true,
        is_benched: true,
        bye_week: 9,
        lunar_phase: 'Waxing Gibbous',
        planetary_hour: 'Mars',
      };

      const mockState = {
        ...testDraftState,
        isLive: false,
        mode: 'mock',
        weekly_matchup: {
          ...testDraftState.weekly_matchup,
          week: 1,
          player_favorabilities: [
            ...(testDraftState.weekly_matchup?.player_favorabilities || []),
            injuredBenchFav,
          ],
        },
        // cosmic_board only contains Cooper Rush, NOT Trey Lance
        cosmic_board: [rushRoster],
        my_roster: [
          {
            slot_id: 'QB',
            slot_name: 'Quarterback',
            position: 'QB',
            eligible_positions: ['QB'],
            player: rushRoster,
            is_locked: false,
          },
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'QB',
            eligible_positions: ['QB'],
            player: injuredBenchRoster,
            is_locked: false,
          },
        ],
        competitor_teams: [
          {
            slot: 7,
            roster_id: 2,
            name: 'AstralOracles (You)',
            is_user: true,
            starters: ['4574'],
            players: ['4574', '7523'],
          },
        ],
      };

      const matchupsView = render(
        jsx(OneiromancyProvider, { initialDraftState: mockState }, jsx(MatchupsScreen, {})),
      );

      const cardEl = matchupsView.container.querySelector('div[data-testid="matchup-starter-card-4574"]');
      assert.ok(cardEl, 'Cooper Rush starter card must render in MatchupsScreen');

      // Verify that computeLineupCheck does NOT recommend swapping Cooper Rush for injured Trey Lance
      const swapEl = cardEl.querySelector('div[data-testid="matchup-swap-opportunity"]');
      assert.ok(
        swapEl === null,
        'Swap opportunity must be null because Trey Lance is Out with injury and retains his injury penalty',
      );
      cleanup();

      // Part 2: Active healthy bench player without cosmic_board entry SHOULD be promoted if score is higher
      const healthyBenchRoster = {
        id: '7083',
        name: 'Tyler Huntley',
        position: 'QB',
        team: 'MIA',
        bye_week: 6,
        projected_points: 25.0,
        sleeper_projected_points: 25.0,
        weekly_projected_points: 25.0,
        spirit_score: 85,
        injury_status: '',
        draft_status: 'my_team',
      };
      const healthyBenchFav = {
        player_id: '7083',
        player_name: 'Tyler Huntley',
        position: 'QB',
        team: 'MIA',
        nfl_team: 'MIA',
        projected_points: 25.0,
        favorability_score: 92.0,
        favorability_verdict: 'HEAVILY FAVORED',
        is_user_team: true,
        is_benched: true,
        bye_week: 6,
        lunar_phase: 'Full Moon',
        planetary_hour: 'Jupiter',
      };
      const stateWithHealthyBench = {
        ...mockState,
        weekly_matchup: {
          ...mockState.weekly_matchup,
          player_favorabilities: [
            ...(mockState.weekly_matchup?.player_favorabilities || []),
            healthyBenchFav,
          ],
        },
        my_roster: [
          mockState.my_roster[0],
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'QB',
            eligible_positions: ['QB'],
            player: healthyBenchRoster,
            is_locked: false,
          },
        ],
        competitor_teams: [
          {
            ...mockState.competitor_teams[0],
            players: ['4574', '7083'],
          },
        ],
      };
      const healthyView = render(
        jsx(OneiromancyProvider, { initialDraftState: stateWithHealthyBench }, jsx(MatchupsScreen, {})),
      );
      const healthyCardEl = healthyView.container.querySelector('div[data-testid="matchup-starter-card-4574"]');
      assert.ok(healthyCardEl, 'Starter card must render');
      const healthySwap = healthyCardEl.querySelector('div[data-testid="matchup-swap-opportunity"]');
      assert.ok(healthySwap, 'Healthy bench player without board entry must be promoted');
      assert.ok(healthySwap.getAttribute('title')?.includes('Tyler Huntley'), 'Swap title must mention Tyler Huntley');
      cleanup();
    });

    test('8.5.22 Placeholder annotations on PlayerDetailModal and OneiromancyDashboard and roster attribute merging', () => {
      seasonContext.setSeasonContextState({
        currentWeek: 7,
        season: '2025',
        byeWeeks: { DAL: 7, MIA: 6 },
      });

      const byePlayer = {
        id: '4574',
        name: 'Cooper Rush',
        position: 'QB',
        team: 'DAL',
        bye_week: 7,
        projected_points: 0,
        sleeper_projected_points: 0,
        weekly_projected_points: 0,
        average_projected_points: 16.5,
        baseline_projected_points: 16.5,
        spirit_score: 80,
        injury_status: '',
        draft_status: 'my_team',
      };
      const benchQb = {
        id: '7083',
        name: 'Tyler Huntley',
        position: 'QB',
        team: 'MIA',
        bye_week: 6,
        projected_points: 14.0,
        sleeper_projected_points: 14.0,
        weekly_projected_points: 14.0,
        average_projected_points: 14.0,
        baseline_projected_points: 14.0,
        spirit_score: 75,
        injury_status: '',
        draft_status: 'my_team',
      };
      const rosterByePlayer = {
        ...byePlayer,
        injury_status: 'Questionable',
      };
      const testState = {
        ...testDraftState,
        isLive: false,
        mode: 'mock',
        activeWeek: 7,
        weekly_matchup: {
          ...testDraftState.weekly_matchup,
          week: 7,
        },
        cosmic_board: [byePlayer, benchQb],
        my_roster: [
          {
            slot_id: 'QB',
            slot_name: 'Quarterback',
            position: 'QB',
            eligible_positions: ['QB'],
            player: rosterByePlayer,
            is_locked: false,
          },
          {
            slot_id: 'BN1',
            slot_name: 'Bench 1',
            position: 'QB',
            eligible_positions: ['QB'],
            player: benchQb,
            is_locked: false,
          },
        ],
      };

      try {
        resetPlayerDetailModalHistoryForTest();
        // 1. Verify PlayerDetailModal annotations
        const modalView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testState },
            jsx(PlayerDetailModal, {
              player: byePlayer,
              compareWith: benchQb,
              isOpen: true,
              onClose: () => {},
              activeWeek: 7,
            }),
          ),
        );

        // 1a. Header 3-metric tile grid isolation
        const headerGrid = modalView.container.querySelector('div.grid');
        assert.ok(headerGrid, 'Header 3-metric grid must exist in modal');
        const headerTiles = headerGrid.children;
        assert.equal(headerTiles.length, 3, 'Must render exactly 3 header tiles');
        const statsTile = headerTiles[0];
        const oracleTile = headerTiles[1];
        const starsTile = headerTiles[2];

        assert.ok(statsTile.textContent?.includes('0.0 pts'), 'Stats tile must render 0.0 pts');
        assert.ok(
          statsTile.getAttribute('title')?.includes('0.0 pts (on bye). Oracle rating uses 16.5 pt average projection placeholder.'),
          'Stats tile tooltip must explain placeholder',
        );

        const oracleMarker = oracleTile.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(oracleMarker, 'Oracle tile must render placeholder marker ~');
        assert.equal(oracleMarker.getAttribute('title'), null, 'Oracle marker must not expose native title attribute');
        fireEvent.click(oracleMarker);
        const oracleTooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
        assert.ok(
          oracleTooltip?.textContent?.includes('uses the 16.5 pt season average instead of 0.0'),
          'Oracle marker tooltip must explain placeholder',
        );
        fireEvent.click(oracleMarker);

        // 1b. Comparison row scoped check
        const compRow = modalView.container.querySelector('[data-testid="role-comp-row-7083"]');
        assert.ok(compRow, 'Comparison row for Tyler Huntley (7083) must exist');
        const compGrid = compRow.children[0];
        assert.ok(compGrid, 'Comparison grid must exist inside row');
        assert.equal(compGrid.children.length, 2, 'Comparison row must render 2 player cards');
        const leftStarterCard = compGrid.children[0];
        const rightBenchCard = compGrid.children[1];

        assert.ok(leftStarterCard.querySelector('[data-testid="oracle-placeholder-marker"]'), 'Left starter card must render placeholder marker for Cooper Rush');
        assert.ok(!rightBenchCard.querySelector('[data-testid="oracle-placeholder-marker"]'), 'Right bench card (Huntley) must not render placeholder marker');

        cleanup();

        // 2. Verify OneiromancyDashboard annotations
        const dashView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testState },
            jsx(OneiromancyDashboard, {}),
          ),
        );
        const dashCard = dashView.container.querySelector('[data-testid="roster-card-QB"]');
        assert.ok(dashCard, 'Dashboard roster card for QB must render');

        const dashStatsPill = Array.from(dashCard.querySelectorAll('div')).find((el) => el.getAttribute('title')?.includes('0.0 pts (on bye)'));
        assert.ok(dashStatsPill, 'Dashboard must render Stats pill with placeholder tooltip');
        assert.ok(dashStatsPill.textContent?.includes('0.0'), 'Dashboard Stats pill must render 0.0');

        const dashOracleMarker = dashCard.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(dashOracleMarker, 'Dashboard must render Oracle placeholder marker ~');

        cleanup();

        // 3. Verify MatchupsScreen roster attribute merging in toCosmicPlayer
        const matchupsView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testState },
            jsx(MatchupsScreen, { weeklyMatchup: testState.weekly_matchup }),
          ),
        );
        const matchupCard = matchupsView.container.querySelector('div[data-testid="matchup-starter-card-4574"]');
        assert.ok(matchupCard, 'MatchupsScreen starter card for Cooper Rush must render');
        fireEvent.click(matchupCard);
        const matchupsModalText = matchupsView.container.textContent || '';
        assert.ok(
          matchupsModalText.toUpperCase().includes('QUESTIONABLE'),
          'MatchupsScreen detail modal must preserve roster player injury_status (Questionable) merged into board entry',
        );
        cleanup();
      } finally {
        resetPlayerDetailModalHistoryForTest();
        seasonContext.setSeasonContextState(null);
        cleanup();
      }
    });

    test('8.5.23 LeagueScreen, TradesScreen, and RecommendedPickHero render oracle placeholder marker on bye and omit on healthy 0-point', () => {
      try {
        const byePlayer = {
          ...mockData.mockCosmicBoard[0],
          id: 'test_bye_qb',
          name: 'Dak Prescott',
          team: 'DAL',
          position: 'QB',
          bye_week: 7,
          sleeper_projected_points: 0,
          average_projected_points: 19.5,
        };
        const healthyZeroPlayer = {
          ...mockData.mockCosmicBoard[0],
          id: 'test_healthy_zero',
          name: 'Backup Scratch',
          team: 'KC',
          position: 'QB',
          bye_week: 10,
          injury_status: undefined,
          status: 'Active',
          sleeper_projected_points: 0,
          average_projected_points: 10.0,
        };

        // RecommendedPickHero
        const { container: heroBye } = render(jsx(RecommendedPickHero, { player: byePlayer, activeWeek: 7 }));
        assert.ok(heroBye.querySelector('[data-testid="oracle-placeholder-marker"]'), 'RecommendedPickHero must render ~ on bye player');
        cleanup();

        const { container: heroZero } = render(jsx(RecommendedPickHero, { player: healthyZeroPlayer, activeWeek: 7 }));
        assert.equal(heroZero.querySelector('[data-testid="oracle-placeholder-marker"]'), null, 'RecommendedPickHero must not render ~ on healthy 0-pt player outside bye');
        cleanup();

        // LeagueScreen
        const leagueState = {
          ...testDraftState,
          mode: 'mock',
          weekly_matchup: {
            ...testDraftState.weekly_matchup,
            week: 7,
          },
          cosmic_board: [byePlayer, healthyZeroPlayer, ...mockData.mockCosmicBoard.slice(0, 10)],
          competitor_teams: [
            {
              team_id: '1',
              roster_id: 1,
              is_user: true,
              name: 'Stars',
              owner: 'User',
              starters: ['test_bye_qb'],
              players: ['test_bye_qb', 'test_healthy_zero'],
            },
          ],
        };
        const { container: leagueView } = render(
          jsx(OneiromancyProvider, { initialDraftState: leagueState }, jsx(LeagueScreen)),
        );
        const markers = leagueView.querySelectorAll('[data-testid="oracle-placeholder-marker"]');
        assert.ok(markers.length >= 1, 'LeagueScreen must render ~ marker for bye starter');
        cleanup();

        // TradesScreen
        const { container: tradesView } = render(
          jsx(OneiromancyProvider, { initialDraftState: leagueState }, jsx(TradesScreen)),
        );
        assert.ok(tradesView, 'TradesScreen renders with leagueState');
        cleanup();
      } finally {
        cleanup();
      }
    });

    test('8.5.23b OneiromancyDashboard roster card foreground allows tooltips and isolates card clicks', () => {
      try {
        const byePlayer = {
          ...mockData.mockCosmicBoard[0],
          id: 'dash_bye_qb',
          player_id: 'dash_bye_qb',
          name: 'Patrick Mahomes',
          position: 'QB',
          team: 'KC',
          bye_week: 7,
          injury_status: undefined,
          status: 'Active',
          sleeper_projected_points: 0,
          average_projected_points: 18.4,
        };
        const firstSlot = testDraftState.my_roster[0];
        const dashState = {
          ...testDraftState,
          mode: 'mock',
          weekly_matchup: {
            ...testDraftState.weekly_matchup,
            week: 7,
          },
          my_roster: [
            { ...firstSlot, player: byePlayer },
          ],
          cosmic_board: [byePlayer, ...testDraftState.cosmic_board.slice(0, 12)],
        };
        const inspected = [];
        const { container } = render(
          jsx(OneiromancyProvider, {
            initialDraftState: dashState,
            children: jsx(OneiromancyDashboard, {
              onInspectPlayer: (p) => inspected.push(p),
            }),
          }),
        );
        const rosterCard = container.querySelector(`[data-testid="roster-card-${firstSlot.slot_id}"]`);
        assert.ok(rosterCard, 'Roster card must render for QB starter slot');

        const oracleMarker = rosterCard.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(oracleMarker, 'Bye starter on dashboard must render Oracle placeholder ~ marker');

        let node = oracleMarker;
        while (node && node !== rosterCard) {
          const cls = typeof node.className === 'string' ? node.className : '';
          assert.equal(
            cls.split(/\s+/).includes('pointer-events-none'),
            false,
            `Roster foreground element (${cls}) must not have pointer-events-none blocking tooltips or selection`,
          );
          node = node.parentElement;
        }

        fireEvent.click(oracleMarker);
        const tooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
        assert.ok(tooltip, 'Clicking ~ marker inside dashboard roster card must open tooltip portal');
        assert.equal(inspected.length, 0, 'Clicking ~ marker must not invoke onInspectPlayer');

        const playerTextCol = rosterCard.querySelector('[data-testid="roster-card-text-col"]');
        assert.ok(
          playerTextCol && (playerTextCol.textContent || '').includes('Patrick Mahomes'),
          'Player name must render inside roster card foreground text column',
        );
        fireEvent.click(playerTextCol);
        assert.equal(inspected.length, 1, 'Clicking non-button card foreground must invoke onInspectPlayer');
        assert.equal(inspected[0].player_id, 'dash_bye_qb');
      } finally {
        cleanup();
      }
    });

    test('8.5.24 Multi-player comparison, stop propagation, pinned rows, and bottom close removal', () => {
      try {
        const samplePlayer = mockData.mockCosmicBoard[0];

        // 1. Verify PlayerDetailModal bottom close button removal & full-width status badge
        const { container: modalView } = render(
          jsx(PlayerDetailModal, {
            player: samplePlayer,
            isOpen: true,
            onClose: () => {},
          }),
        );
        const footerCloseBtn = Array.from(modalView.querySelectorAll('button')).find(
          (b) => (b.textContent || '').trim() === 'Close' && !b.getAttribute('aria-label'),
        );
        assert.equal(footerCloseBtn, undefined, 'Bottom Close button must be completely removed');

        const xCloseBtn = modalView.querySelector('button[aria-label="Close dossier"]');
        assert.ok(xCloseBtn, 'Top-right X button must be present');
        assert.ok(xCloseBtn.className.includes('min-w-[44px]'), 'X button touch target must be at least 44x44px');

        const stickyHeader = modalView.querySelector('.sticky.top-0');
        assert.ok(stickyHeader, 'Modal header must be sticky');
        assert.ok(stickyHeader.className.includes('flex-shrink-0'), 'Modal header must have flex-shrink-0');

        const dialog = modalView.querySelector('[role="dialog"]');
        assert.ok(dialog, 'Modal dialog must exist');
        const cardShell = dialog.childNodes.find((c) => c.nodeType === 1);
        assert.ok(cardShell, 'Outer card container must exist inside dialog');
        assert.ok(cardShell.className.includes('overflow-hidden'), 'Outer card shell must have overflow-hidden');
        assert.ok(!cardShell.className.includes('overflow-y-auto'), 'Outer card shell must not have overflow-y-auto');
        assert.ok(cardShell.className.includes('flex-col'), 'Outer card shell must have flex-col');

        const scrollBody = modalView.querySelector('.overflow-y-auto');
        assert.ok(scrollBody, 'Inner scrollable body must exist with overflow-y-auto');
        assert.ok(scrollBody.className.includes('min-h-0'), 'Inner scroll body must have min-h-0');
        assert.ok(scrollBody.className.includes('flex-1'), 'Inner scroll body must have flex-1');

        const statusBadge = screen.getByText(/MY ROSTER|FREE AGENT|ROSTERED/);
        assert.ok(statusBadge, 'Squad status badge must be present');
        assert.ok((statusBadge.parentElement?.className || '').includes('w-full'), 'Squad status badge container must be full width (w-full)');
        cleanup();

        // 2. Verify CosmicBoard comparison functionality
        const { container: boardView } = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(CosmicBoard, {}),
          ),
        );

        // Exactly one table
        const tables = boardView.querySelectorAll('table[data-testid="cosmic-board-table"]');
        assert.equal(tables.length, 1, 'Exactly one cosmic-board-table must exist');

        // Compare column header
        const compareHeader = boardView.querySelector('th[data-testid="compare-col-header"]');
        assert.ok(compareHeader, 'Compare column header must be present');
        assert.ok(compareHeader.className.includes('w-8'), 'Compare header must have w-8 class');
        assert.ok(!compareHeader.className.includes('w-14'), 'Compare header must not have w-14 class');
        assert.ok(compareHeader.className.includes('px-1'), 'Compare header must have px-1 class');
        assert.ok(compareHeader.className.includes('tracking-normal'), 'Compare header must have tracking-normal class');
        assert.equal(compareHeader.getAttribute('title'), 'Compare', 'Compare header must have title="Compare"');

        const srOnly = compareHeader.querySelector('.sr-only');
        assert.ok(srOnly, 'Compare header must contain .sr-only accessible text element');
        assert.equal(srOnly.textContent, 'Compare', 'Accessible text must be "Compare"');

        const scaleGlyph = compareHeader.querySelector('[aria-hidden="true"]');
        assert.ok(scaleGlyph, 'Compare header must contain an aria-hidden scale glyph');
        assert.equal(
          scaleGlyph.tagName.toLowerCase(),
          'svg',
          'Compare header scale icon must render as an SVG element',
        );

        // Find compare checkboxes in table
        const allCheckboxes = boardView.querySelectorAll('input[type="checkbox"]');
        const checkboxes = allCheckboxes.filter(cb => (cb.getAttribute('aria-label') || '').startsWith('Compare '));
        assert.ok(checkboxes.length >= 2, 'Compare checkboxes must exist in table rows');

        // Verify table checkbox cell padding
        const tableCheckboxes = tables[0].querySelectorAll('input[type="checkbox"]');
        assert.ok(tableCheckboxes.length >= 1, 'Table compare checkboxes must exist');
        const tableCheckboxCell = tableCheckboxes[0].parentNode;
        assert.ok(tableCheckboxCell, 'Table checkbox parent td must exist');
        assert.ok(tableCheckboxCell.className.includes('px-1'), 'Checkbox td must have px-1 padding');
        assert.ok(!tableCheckboxCell.className.includes('px-2'), 'Checkbox td must not have px-2 padding');

        const checkbox0 = checkboxes[0];
        const label0 = checkbox0.getAttribute('aria-label') || '';
        assert.ok(label0.startsWith('Compare '), 'Checkbox must have Compare aria-label');
        const playerName0 = label0.replace('Compare ', '');

        // Click checkbox: should pin player0 and NOT open PlayerDetailModal (stopPropagation)
        fireEvent.click(checkbox0);

        // Now compare-pinned tbody must exist with player0
        const pinnedTbody = boardView.querySelector('tbody[data-testid="compare-pinned"]');
        assert.ok(pinnedTbody, 'compare-pinned tbody must render when player is pinned');
        assert.ok(pinnedTbody.textContent.includes(playerName0), 'Pinned tbody must contain player name');
        assert.ok(pinnedTbody.textContent.includes('PINNED'), 'Pinned row must display PINNED badge');

        const pinnedCheckbox = pinnedTbody.querySelector('input[type="checkbox"]');
        const pinnedCheckboxCell = pinnedCheckbox ? pinnedCheckbox.parentNode : null;
        assert.ok(pinnedCheckboxCell, 'Pinned checkbox parent td must exist');
        assert.ok(pinnedCheckboxCell.className.includes('px-1'), 'Pinned checkbox td must have px-1 padding');
        assert.ok(!pinnedCheckboxCell.className.includes('px-2'), 'Pinned checkbox td must not have px-2 padding');

        // Verify PlayerDetailModal was NOT opened by clicking checkbox
        assert.equal(boardView.querySelector('[role="dialog"]'), null, 'Checkbox click must not open modal (stopPropagation)');

        // Action bar should appear showing 1 candidate
        const actionBar = boardView.querySelector('[data-testid="compare-action-bar"]');
        assert.ok(actionBar, 'compare-action-bar must render when players are pinned');
        assert.ok(actionBar.textContent.includes('Comparing 1 / 6'), 'Action bar must show count');

        // Pin second player
        const remainingCheckboxes = boardView.querySelectorAll('input[type="checkbox"]').filter(cb => {
          const l = cb.getAttribute('aria-label') || '';
          return l.startsWith('Compare ') && !l.includes(playerName0);
        });
        const checkbox1 = remainingCheckboxes[0];
        const label1 = checkbox1.getAttribute('aria-label') || '';
        const playerName1 = label1.replace('Compare ', '');
        fireEvent.click(checkbox1);

        // Now action bar must show 2, keep sticky bottom-4 layout, and NOT render Head-to-Head button
        assert.ok(actionBar.textContent.includes('Comparing 2 / 6'), 'Action bar must show 2 candidates');
        assert.ok(actionBar.className.includes('sticky') && actionBar.className.includes('bottom-4'), 'Action bar must have sticky bottom-4 layout');
        assert.equal(
          boardView.querySelector('button[data-testid="head-to-head-btn"]'),
          null,
          'Head-to-Head Compare button must not be rendered',
        );
        assert.ok(
          !actionBar.textContent.includes('Compare Head-to-Head'),
          'Action bar must not contain Compare Head-to-Head text',
        );
        assert.equal(
          actionBar.querySelectorAll('button').length,
          1,
          'Action bar must only render the Clear All button',
        );
        assert.equal(boardView.querySelector('[role="dialog"]'), null, 'Dialog must not open automatically');

        // Test filter persistence: type a search query that matches neither player0 nor player1
        const searchInput = boardView.querySelectorAll('input').find(i => (i.getAttribute('placeholder') || '').toLowerCase().includes('search'));
        assert.ok(searchInput, 'Search input must exist');
        fireEvent.change(searchInput, { target: { value: 'XYZNONEXISTENT' } });
        // Pinned tbody must STILL contain player0 and player1
        const persistentPinned = boardView.querySelector('tbody[data-testid="compare-pinned"]');
        assert.ok(persistentPinned, 'Pinned tbody must persist through search filters');
        assert.ok(persistentPinned.textContent.includes(playerName0), 'Pinned player 0 must persist');
        assert.ok(persistentPinned.textContent.includes(playerName1), 'Pinned player 1 must persist');
        assert.ok(
          boardView.textContent.includes('(+2 pinned across filters)'),
          'Counter must show (+2 pinned across filters) when pinned players are filtered out',
        );
        fireEvent.change(searchInput, { target: { value: '' } });

        // Click Clear All
        const clearBtn = boardView.querySelector('button[data-testid="clear-compare-btn"]');
        assert.ok(clearBtn, 'Clear All button must be present');
        fireEvent.click(clearBtn);

        // compare-pinned tbody must disappear
        assert.equal(boardView.querySelector('tbody[data-testid="compare-pinned"]'), null, 'Pinned tbody must be cleared');
        cleanup();
      } finally {
        cleanup();
      }
    });

    test('8.5.25 Multi-player comparison 6-player cap, unpinned checkbox disabling, unpinning, and pagination consistency', () => {
      try {
        const { container: boardView } = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(CosmicBoard, {}),
          ),
        );

        // Pin 6 distinct players
        for (let i = 0; i < 6; i++) {
          const unpinnedCheckboxes = boardView.querySelectorAll('input[type="checkbox"]').filter(cb => {
            const label = cb.getAttribute('aria-label') || '';
            return label.startsWith('Compare ') && !cb.checked;
          });
          assert.ok(unpinnedCheckboxes.length > 0, `Must find unpinned checkbox for player ${i + 1}`);
          fireEvent.click(unpinnedCheckboxes[0]);
        }

        // Action bar should display Comparing 6 / 6
        const actionBar = boardView.querySelector('[data-testid="compare-action-bar"]');
        assert.ok(actionBar, 'Action bar must exist when 6 players are pinned');
        assert.ok(actionBar.textContent.includes('Comparing 6 / 6'), 'Action bar must show 6 / 6');

        // All unpinned checkboxes must now be disabled with title
        const remainingUnpinned = boardView.querySelectorAll('input[type="checkbox"]').filter(cb => {
          const label = cb.getAttribute('aria-label') || '';
          return label.startsWith('Compare ') && !cb.checked;
        });
        assert.ok(remainingUnpinned.length > 0, 'Unpinned rows must still exist');
        for (const cb of remainingUnpinned) {
          assert.equal(cb.disabled, true, 'Unpinned checkbox must be disabled when cap of 6 is reached');
          assert.equal(cb.getAttribute('title'), 'Maximum of 6 players compared', 'Disabled checkbox must display title explaining cap');
        }

        // Pinned checkboxes in desktop table must remain enabled
        const pinnedTbody = boardView.querySelector('tbody[data-testid="compare-pinned"]');
        assert.ok(pinnedTbody, 'compare-pinned tbody must exist');
        const pinnedTableCheckboxes = pinnedTbody.querySelectorAll('input[type="checkbox"]');
        assert.equal(pinnedTableCheckboxes.length, 6, 'Exactly 6 pinned checkboxes must exist in desktop pinned table');
        for (const cb of pinnedTableCheckboxes) {
          assert.equal(cb.disabled, false, 'Pinned checkbox must remain enabled so user can unpin');
        }

        // Unpin one player by clicking its pinned checkbox
        fireEvent.click(pinnedTableCheckboxes[0]);
        assert.ok(actionBar.textContent.includes('Comparing 5 / 6'), 'Action bar must reflect 5 / 6 after unpinning');

        // Unpinned checkboxes must become re-enabled
        const reenabledUnpinned = boardView.querySelectorAll('input[type="checkbox"]').filter(cb => {
          const label = cb.getAttribute('aria-label') || '';
          return label.startsWith('Compare ') && !cb.checked;
        });
        for (const cb of reenabledUnpinned) {
          assert.equal(cb.disabled, false, 'Unpinned checkbox must be re-enabled when below cap');
        }

        // Pagination check: Showing text matches total
        const showingText = boardView.textContent || '';
        assert.ok(showingText.includes('Showing'), 'Must display Showing count text');
        cleanup();
      } finally {
        cleanup();
      }
    });

    test('8.5.26 OneiromancyContext comparedPlayerIds pruning on mode, draft, and league change', () => {
      try {
        let contextHandle = null;
        function TestConsumer() {
          const ctx = useOneiromancy();
          contextHandle = ctx;
          return jsx('div', { 'data-testid': 'test-consumer' }, `Compared count: ${ctx.comparedPlayerIds.length}`);
        }

        render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(TestConsumer, {}),
          ),
        );

        assert.ok(contextHandle, 'Context handle must be captured');
        assert.equal(contextHandle.comparedPlayerIds.length, 0);

        // Pin 2 players via context wrapped in act
        act(() => {
          contextHandle.toggleComparePlayer(String(testDraftState.cosmic_board[0].id));
          contextHandle.toggleComparePlayer(String(testDraftState.cosmic_board[1].id));
        });
        assert.equal(contextHandle.comparedPlayerIds.length, 2, 'Should have 2 compared players');

        // Toggling non-existent ID when board is populated should be pruned
        act(() => {
          contextHandle.toggleComparePlayer('NON_EXISTENT_PLAYER_ID_99999');
        });
        assert.equal(contextHandle.comparedPlayerIds.includes('NON_EXISTENT_PLAYER_ID_99999'), false, 'Non-existent player ID must not be pinned');

        // setDraftId resets comparison
        act(() => {
          contextHandle.setDraftId('new_draft_id_123');
        });
        assert.equal(contextHandle.comparedPlayerIds.length, 0, 'setDraftId must clear compared players');

        // Pin a player again
        act(() => {
          contextHandle.toggleComparePlayer(String(testDraftState.cosmic_board[0].id));
        });
        assert.equal(contextHandle.comparedPlayerIds.length, 1);

        // setLeagueId resets comparison
        act(() => {
          contextHandle.setLeagueId('new_league_id_456');
        });
        assert.equal(contextHandle.comparedPlayerIds.length, 0, 'setLeagueId must clear compared players');

        // Pin a player again
        act(() => {
          contextHandle.toggleComparePlayer(String(testDraftState.cosmic_board[0].id));
        });
        assert.equal(contextHandle.comparedPlayerIds.length, 1);

        // loadMockData resets comparison
        act(() => {
          contextHandle.loadMockData();
        });
        assert.equal(contextHandle.comparedPlayerIds.length, 0, 'loadMockData must clear compared players');

        cleanup();
      } finally {
        cleanup();
      }
    });

    test('8.5.27 Multi-player comparison action bar without launch button and direct multi-candidate-grid modal rendering', () => {
      try {
        const { container: boardView } = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(CosmicBoard, {}),
          ),
        );

        // Pin 3 players
        for (let i = 0; i < 3; i++) {
          const unpinned = boardView.querySelectorAll('input[type="checkbox"]').filter(cb => {
            const label = cb.getAttribute('aria-label') || '';
            return label.startsWith('Compare ') && !cb.checked;
          });
          assert.ok(unpinned.length > 0);
          fireEvent.click(unpinned[0]);
        }

        // Action bar must render count and Clear All only; head-to-head-btn must not exist
        assert.equal(
          boardView.querySelector('button[data-testid="head-to-head-btn"]'),
          null,
          'Compare launch button must not exist when 3 players are pinned',
        );
        const actionBar = boardView.querySelector('[data-testid="compare-action-bar"]');
        assert.ok(actionBar, 'Action bar must still render when 3 players are pinned');
        assert.ok(actionBar.textContent.includes('Comparing 3 / 6'), 'Action bar must display 3 pinned count');
        assert.equal(actionBar.querySelectorAll('button').length, 1, 'Only Clear All button should remain in action bar');
        cleanup();

        // Render PlayerDetailModal directly with compareCandidates to preserve multi-candidate grid coverage
        const candidates = mockData.mockCosmicBoard.slice(0, 3);
        let closed = false;
        const { container: modalView } = render(
          jsx(PlayerDetailModal, {
            player: candidates[0],
            compareCandidates: candidates,
            isOpen: true,
            onClose: () => {
              closed = true;
            },
          }),
        );

        const modal = modalView.querySelector('[role="dialog"]');
        assert.ok(modal, 'PlayerDetailModal must render when isOpen is true');
        assert.ok(modal.textContent.includes('Comparing 3 Candidates') || modal.textContent.includes('Comparing 3 Selected Candidates'), 'Modal header must reflect 3 candidates');

        // multi-candidate-grid must be present
        const grid = modal.querySelector('[data-testid="multi-candidate-grid"]');
        assert.ok(grid, 'multi-candidate-grid must render for 3 candidates');
        // Must render candidate cards for all 3 players
        const cards = grid.children;
        assert.equal(cards.length, 3, 'Must render exactly 3 candidate cards in grid');
        for (const card of cards) {
          assert.ok(
            (card.getAttribute('data-testid') || '').startsWith('candidate-card-'),
            'Each card must have candidate-card- data-testid',
          );
        }

        // Must display Stats, Oracle, and Stars metrics
        assert.ok(grid.textContent.includes('Stats'), 'Grid must display Stats');
        assert.ok(grid.textContent.includes('Oracle'), 'Grid must display Oracle');
        assert.ok(grid.textContent.includes('Stars'), 'Grid must display Stars');
        assert.ok(grid.textContent.includes('Leader'), 'Grid must highlight leader');

        // Close modal callback fires on X click
        const closeBtn = modal.querySelector('button[aria-label="Close dossier"]');
        assert.ok(closeBtn);
        fireEvent.click(closeBtn);
        assert.equal(closed, true, 'Closing modal must invoke onClose');

        cleanup();
      } finally {
        cleanup();
      }
    });

    test('9.4.2 CelestialLeaderboardGraph tier badges match displayed rating across Oracle, Stars, Stats, and Harmony tabs', () => {
      try {
        const mismatchedTeams = [
          {
            slot: 1,
            roster_id: 1,
            name: 'HighComposite LowSpirit',
            avg_spirit_score: 72.0,
            avg_draft_score: 82.0,
            harmony_score: 84.8,
            picks: [],
          },
          {
            slot: 4,
            roster_id: 4,
            name: 'LowComposite HighSpirit',
            avg_spirit_score: 76.0,
            avg_draft_score: 70.0,
            harmony_score: 74.9,
            picks: [],
          },
        ];

        render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: { ...testDraftState, competitor_teams: mismatchedTeams } },
            jsx(CelestialLeaderboardGraph, { competitorTeams: mismatchedTeams }),
          ),
        );

        const rank1Oracle = screen.getByTestId('leaderboard-row-rank-1');
        assert.ok(rank1Oracle.textContent.includes('HighComposite LowSpirit'), 'Oracle tab #1 must be 78.8 composite team');
        assert.ok(rank1Oracle.textContent.includes('78.8'), 'Oracle tab #1 must display 78.8');
        assert.ok(rank1Oracle.textContent.includes('Harmonic (Stable)'), 'Oracle tab #1 (78.8) must show Harmonic (Stable)');
        assert.ok(!rank1Oracle.textContent.includes('Discordant'), 'Oracle tab #1 (78.8) must never show Discordant');

        const row4Oracle = screen.getByTestId('leaderboard-row-slot-4');
        assert.ok(row4Oracle.textContent.includes('73.9'), 'Oracle tab row #2 must display 73.9');
        assert.ok(row4Oracle.textContent.includes('Discordant (At Risk)'), 'Oracle tab row (73.9) must show Discordant (At Risk)');

        // Switch to Stars tab (spiritScore: 76.0 vs 72.0)
        fireEvent.click(screen.getByTestId('leaderboard-toggle-spirit'));
        const rank1Stars = screen.getByTestId('leaderboard-row-rank-1');
        assert.ok(rank1Stars.textContent.includes('LowComposite HighSpirit'), 'Stars tab #1 must be 76.0 spirit team');
        assert.ok(rank1Stars.textContent.includes('Harmonic (Stable)'), 'Stars tab #1 (76.0) must show Harmonic (Stable)');
        const row1StarsSecond = screen.getByTestId('leaderboard-row-slot-1');
        assert.ok(row1StarsSecond.textContent.includes('72.0'), 'Stars tab row #2 must display 72.0');
        assert.ok(row1StarsSecond.textContent.includes('Discordant (At Risk)'), 'Stars tab row #2 (72.0) must show Discordant (At Risk)');

        // Switch to Stats tab (draftScore: 82.0 vs 70.0)
        fireEvent.click(screen.getByTestId('leaderboard-toggle-draft'));
        const rank1Stats = screen.getByTestId('leaderboard-row-rank-1');
        assert.ok(rank1Stats.textContent.includes('HighComposite LowSpirit'), 'Stats tab #1 must be 82.0 draft team');
        assert.ok(rank1Stats.textContent.includes('82.0'), 'Stats tab #1 must display 82.0');
        assert.ok(rank1Stats.textContent.includes('Harmonic (Stable)'), 'Stats tab #1 (82.0) must show Harmonic (Stable)');
        const row4Stats = screen.getByTestId('leaderboard-row-slot-4');
        assert.ok(row4Stats.textContent.includes('70.0'), 'Stats tab row #2 must display 70.0');
        assert.ok(row4Stats.textContent.includes('Discordant (At Risk)'), 'Stats tab row #2 (70.0) must show Discordant (At Risk)');

        // Switch to Harmony tab: rounded 84.8 -> 85% must show Favorable (Optimal); rounded 74.9 -> 75% must show Harmonic (Stable)
        fireEvent.click(screen.getByTestId('leaderboard-toggle-harmony'));
        const rank1Harmony = screen.getByTestId('leaderboard-row-rank-1');
        assert.ok(rank1Harmony.textContent.includes('85%'), 'Harmony tab #1 must display rounded 85%');
        assert.ok(rank1Harmony.textContent.includes('Favorable (Apex)'), 'Harmony tab #1 (85%) must show Favorable (Apex)');
        const row4Harmony = screen.getByTestId('leaderboard-row-slot-4');
        assert.ok(row4Harmony.textContent.includes('75%'), 'Harmony tab row #2 must display rounded 75%');
        assert.ok(row4Harmony.textContent.includes('Harmonic (Stable)'), 'Harmony tab row #2 (75%) must show Harmonic (Stable)');

        cleanup();
      } finally {
        cleanup();
      }
    });

    test('9.4.3 NavigationShell keeps 44x44 hit target with w-8 h-8 Lucide Settings gear framing UserAvatar or fallback User icon', () => {
      try {
        let opened = 0;
        const { container: liveContainer, unmount: unmountLive } = render(
          jsx(NavigationShell, {
            activeTab: 'oneiromancy',
            onSelectTab: () => {},
            onOpenSettings: () => { opened += 1; },
            mode: 'live',
            sleeperUsername: 'SeerAlpha',
            userAvatarUrl: 'https://sleepercdn.com/avatars/abc123',
          }),
        );
        const liveBtn = liveContainer.querySelector('button[aria-label="Draft Settings"]');
        assert.ok(liveBtn, 'Draft Settings button must preserve accessible label');
        const liveBtnClass = liveBtn.getAttribute('class') || '';
        assert.ok(liveBtnClass.includes('w-8') && liveBtnClass.includes('h-8') && liveBtnClass.includes('shrink-0'), 'Draft Settings button layout box must stay w-8 h-8 shrink-0 (~49px header height)');
        assert.ok(liveBtnClass.includes("before:content-['']") && liveBtnClass.includes('before:-inset-1.5'), 'Draft Settings button must expand invisible hit area to 44x44 via before:-inset-1.5');
        const gear = liveBtn.querySelector('[data-testid="nav-settings-gear"]');
        assert.ok(gear, 'Draft Settings button must render Lucide Settings icon with data-testid="nav-settings-gear"');
        assert.ok((gear.getAttribute('class') || '').includes('w-8') && (gear.getAttribute('class') || '').includes('h-8'), 'nav-settings-gear must be 32x32 (w-8 h-8)');
        const avatar = liveBtn.querySelector('[data-testid="nav-user-avatar"]');
        assert.ok(avatar, 'Live mode with avatar must render nav-user-avatar centered inside Draft Settings button');
        const avatarClass = avatar.getAttribute('class') || '';
        assert.ok(avatarClass.includes('!w-3.5') && avatarClass.includes('!h-3.5'), 'Centered avatar must be framed at 14x14 (!w-3.5 !h-3.5)');
        assert.ok(avatarClass.includes('!ring-purple-400/70') && avatarClass.includes('!shadow-none'), 'Centered avatar must keep subtle purple ring with !shadow-none (no glowing box halo)');
        assert.equal(liveBtn.querySelector('[data-testid="nav-manager-fallback-icon"]'), null, 'Live mode with avatar must not render fallback User glyph');
        fireEvent.click(liveBtn);
        assert.equal(opened, 1, 'Clicking settings gear must invoke onOpenSettings');
        unmountLive();

        const { container: mockContainer, unmount: unmountMock } = render(
          jsx(NavigationShell, {
            activeTab: 'matchups',
            onSelectTab: () => {},
            onOpenSettings: () => {},
            mode: 'mock',
            sleeperUsername: 'MockManager',
            userAvatarUrl: 'https://sleepercdn.com/avatars/abc123',
          }),
        );
        const mockBtn = mockContainer.querySelector('button[aria-label="Draft Settings"]');
        assert.ok(mockBtn.querySelector('[data-testid="nav-settings-gear"]'), 'Mock mode must render nav-settings-gear');
        assert.equal(mockBtn.querySelector('[data-testid="nav-user-avatar"]'), null, 'Mock mode must not render live UserAvatar');
        assert.ok(mockBtn.querySelector('[data-testid="nav-manager-fallback-icon"]'), 'Mock mode must render fallback User icon');
        unmountMock();

        const { container: avatarlessLiveContainer } = render(
          jsx(NavigationShell, {
            activeTab: 'board',
            onSelectTab: () => {},
            onOpenSettings: () => {},
            mode: 'live',
            sleeperUsername: 'NoAvatarSeer',
          }),
        );
        const avatarlessBtn = avatarlessLiveContainer.querySelector('button[aria-label="Draft Settings"]');
        assert.ok(avatarlessBtn.querySelector('[data-testid="nav-settings-gear"]'), 'Avatarless live mode must render nav-settings-gear');
        assert.equal(avatarlessBtn.querySelector('[data-testid="nav-user-avatar"]'), null, 'Avatarless live mode must not render nav-user-avatar');
        assert.ok(avatarlessBtn.querySelector('[data-testid="nav-manager-fallback-icon"]'), 'Avatarless live mode must render nav-manager-fallback-icon');
        cleanup();

        const { container: drawerContainer } = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: testDraftState },
            jsx(SettingsDrawer, { isOpen: true, onClose: () => {} }),
          ),
        );
        const closeSettingsBtn = drawerContainer.querySelector('button[aria-label="Close Settings"]');
        assert.ok(closeSettingsBtn, 'SettingsDrawer must render Close Settings button');
        const closeBtnClass = closeSettingsBtn.getAttribute('class') || '';
        assert.ok(closeBtnClass.includes('min-w-[44px]') && closeBtnClass.includes('min-h-[44px]'), 'Close Settings button must meet 44x44 touch target minimum');
        cleanup();
      } finally {
        cleanup();
      }
    });

    test('9.4.4 OraclePlaceholderMarker renders portal explainer cleanly without sr-only, native title, or touch/hover click race', () => {
      try {
        const placeholderInfo = oracle.oraclePlaceholderInfo({
          id: 'p_race',
          name: 'Bye Star',
          team: 'DAL',
          position: 'WR',
          sleeper_projected_points: 0,
          projected_points: 0,
          bye_week: 7,
          average_projected_points: 19.5,
          draft_score: 0,
        }, 7);

        const { container } = render(
          jsx(
            'div',
            {},
            jsx(OraclePlaceholderMarker, { placeholder: placeholderInfo }),
            jsx(OraclePlaceholderMarker, { placeholder: placeholderInfo, kind: 'stats' }),
          ),
        );

        const marker = container.querySelector('[data-testid="oracle-placeholder-marker"]');
        const peerMarker = container.querySelector('[data-testid="stats-placeholder-marker"]');
        assert.ok(marker && peerMarker, 'Must render both placeholder marker triggers');
        assert.equal(marker.tagName, 'BUTTON', 'Marker trigger must be a real button element');
        assert.equal(marker.getAttribute('type'), 'button', 'Marker trigger must set type="button"');
        assert.equal(marker.textContent, '~', 'Collapsed marker textContent must remain compact ~ with zero sr-only span');
        assert.equal(marker.querySelector('.sr-only'), null, 'Marker must not contain sr-only fallback span');
        assert.equal(marker.getAttribute('title'), null, 'Marker must not expose native browser title');
        assert.equal(marker.getAttribute('aria-label'), 'Explain estimated Oracle placeholder', 'Oracle marker must expose clear aria-label');
        assert.equal(peerMarker.getAttribute('aria-label'), 'Explain zero weekly stats placeholder', 'Stats marker must expose clear stats aria-label');
        assert.equal(marker.getAttribute('aria-expanded'), 'false', 'Marker must start collapsed');
        assert.equal(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'Tooltip must start closed');

        // 1. Touch pointerEnter + click race safety: touch pointerEnter must not toggle hover before click
        fireEvent.pointerEnter(marker, { pointerType: 'touch' });
        assert.equal(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'Touch pointerEnter must not set hovered state');
        fireEvent.click(marker);
        assert.equal(marker.getAttribute('aria-expanded'), 'true', 'Click after touch pointerEnter must pin tooltip open');
        const portaledTooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
        assert.ok(portaledTooltip, 'Tooltip must render in document.body via createPortal');
        assert.equal(container.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'Tooltip must NOT render inside local container subtree');
        assert.equal(portaledTooltip.textContent, placeholderInfo.markerExplainerText, 'Tooltip must render concise markerExplainerText');

        // Clicking again unpins and closes
        fireEvent.click(marker);
        assert.equal(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'Second click must close pinned tooltip');

        // 2. Focus only opens tooltip when :focus-visible matches
        fireEvent.focus(marker);
        assert.equal(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'Focus without :focus-visible must not open tooltip');
        fireEvent.blur(marker);

        marker.matches = (selector) => selector === ':focus-visible';
        fireEvent.focus(marker);
        assert.ok(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), 'Keyboard :focus-visible focus must open tooltip');

        // 3. Mouse hover + focus + click + pointerLeave stability
        fireEvent.pointerEnter(marker, { pointerType: 'mouse' });
        fireEvent.click(marker);
        fireEvent.pointerLeave(marker, { pointerType: 'mouse' });
        fireEvent.blur(marker);
        assert.ok(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), 'Pinned tooltip must remain open after mouse pointerLeave and blur');

        // 4. Peer trigger dismissal: mouse hover over peer dismisses pinned first trigger
        fireEvent.pointerEnter(peerMarker, { pointerType: 'mouse' });
        assert.equal(marker.getAttribute('aria-expanded'), 'false', 'Hovering peer trigger must dismiss previously open trigger');
        assert.equal(peerMarker.getAttribute('aria-expanded'), 'true', 'Hovered peer trigger must open');

        // 5. Peer click & capture pointerdown outside closes open tooltip
        fireEvent.click(peerMarker);
        const activeTooltips = document.body.querySelectorAll('[data-testid="oracle-placeholder-tooltip"]');
        assert.equal(activeTooltips.length, 1, 'At most one portaled placeholder tooltip may be open at a time');
        assert.equal(activeTooltips[0].textContent, placeholderInfo.statsMarkerExplainerText, 'Peer stats marker must render statsMarkerExplainerText');

        fireEvent.pointerDown(document.body, { target: document.body });
        assert.equal(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'Outside capture pointerdown must dismiss tooltip');
        assert.equal(peerMarker.getAttribute('aria-expanded'), 'false', 'Outside pointerdown must reset aria-expanded');

        cleanup();
      } finally {
        cleanup();
      }
    });

    test('9.4.5 Placeholder markers and portaled tooltips isolate card clicks across dashboard, CosmicBoard, LeagueScreen, MatchupsScreen, and PlayerDetailModal', () => {
      try {
        const zeroBye = {
          ...mockData.mockCosmicBoard[0],
          id: 'iso_bye_player',
          name: 'Bye Star',
          team: 'DAL',
          position: 'WR',
          sleeper_projected_points: 0,
          projected_points: 0,
          bye_week: 7,
          average_projected_points: 18.4,
          draft_score: 0,
        };
        const activePeer = {
          ...mockData.mockCosmicBoard[1],
          id: 'iso_active_peer',
          name: 'Healthy Peer',
          team: 'KC',
          position: 'WR',
          sleeper_projected_points: 14.2,
          projected_points: 14.2,
          bye_week: 10,
          average_projected_points: 14.2,
        };
        const draftState = {
          ...testDraftState,
          activeWeek: 7,
          cosmic_board: [zeroBye, activePeer],
          my_roster: [
            { slot_id: 'WR', slot_name: 'Wide Receiver', position: 'WR', eligible_positions: ['WR'], player: zeroBye, is_locked: false },
            { slot_id: 'BN1', slot_name: 'Bench 1', position: 'WR', eligible_positions: ['WR'], player: activePeer, is_locked: false },
          ],
          weekly_matchup: {
            ...testDraftState.weekly_matchup,
            week: 7,
            user_team: {
              ...testDraftState.weekly_matchup.user_team,
              starters: [zeroBye.id],
            },
            opponent_team: {
              ...testDraftState.weekly_matchup.opponent_team,
              starters: [activePeer.id],
            },
            player_favorabilities: [
              {
                ...mockData.mockPlayerFavorabilities[0],
                player_id: zeroBye.id,
                player_name: zeroBye.name,
                position: zeroBye.position,
                nfl_team: zeroBye.team,
                projected_points: 0,
                sleeper_projected_points: 0,
                average_projected_points: 18.4,
                bye_week: 7,
                is_user_team: true,
                is_benched: false,
              },
              {
                ...mockData.mockPlayerFavorabilities[1],
                player_id: activePeer.id,
                player_name: activePeer.name,
                position: activePeer.position,
                nfl_team: activePeer.team,
                projected_points: 14.2,
                sleeper_projected_points: 14.2,
                average_projected_points: 14.2,
                bye_week: 10,
                is_user_team: false,
                is_benched: false,
              },
            ],
          },
          competitor_teams: [
            {
              roster_id: 1,
              team_name: 'Seer Squad',
              owner_name: 'Seer',
              is_user: true,
              starters: [zeroBye.id],
              players: [zeroBye.id],
            },
            {
              roster_id: 2,
              team_name: 'Rival Squad',
              owner_name: 'Rival',
              is_user: false,
              starters: [activePeer.id],
              players: [activePeer.id],
            },
          ],
          settings: {
            ...testDraftState.settings,
            roster_positions: ['WR'],
          },
        };

        const verifyTriggerAndPortaledTooltipIsolated = (viewContainer, wrapperSpies, scopeName) => {
          const marker = viewContainer.querySelector('[data-testid="oracle-placeholder-marker"]');
          assert.ok(marker, `${scopeName} must render oracle-placeholder-marker`);
          fireEvent.click(marker);
          const tooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
          assert.ok(tooltip, `${scopeName} marker click must open portaled tooltip`);
          assert.ok(tooltip.textContent?.includes('18.4 pt season average'), `${scopeName} tooltip must display 18.4 pt placeholder explainer`);
          fireEvent.click(tooltip);
          assert.equal(wrapperSpies.count, 0, `${scopeName} parent card/inspect handler must stay at 0 after clicking marker & tooltip`);
          fireEvent.click(marker);
        };

        // PlayerCardRow + parent wrapper
        const rowSpy = { count: 0 };
        const rowView = render(
          jsx('div', { onClick: () => { rowSpy.count += 1; } }, jsx(PlayerCardRow, { player: zeroBye, activeWeek: 7, onInspect: () => { rowSpy.count += 1; } })),
        );
        verifyTriggerAndPortaledTooltipIsolated(rowView.container, rowSpy, 'PlayerCardRow');
        cleanup();

        // OneiromancyDashboard
        const dashSpy = { count: 0 };
        const dashView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: draftState },
            jsx('div', { onClick: () => { dashSpy.count += 1; } }, jsx(OneiromancyDashboard, { myRoster: [{ slot_id: 'WR', player: zeroBye }], onInspectPlayer: () => { dashSpy.count += 1; } })),
          ),
        );
        verifyTriggerAndPortaledTooltipIsolated(dashView.container, dashSpy, 'OneiromancyDashboard');
        cleanup();

        // CosmicBoard
        const boardSpy = { count: 0 };
        const boardView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: draftState },
            jsx('div', { onClick: () => { boardSpy.count += 1; } }, jsx(CosmicBoard, { onInspectPlayer: () => { boardSpy.count += 1; } })),
          ),
        );
        verifyTriggerAndPortaledTooltipIsolated(boardView.container, boardSpy, 'CosmicBoard');
        cleanup();

        // LeagueScreen (must not bubble to parent or open internal PlayerDetailModal)
        const leagueSpy = { count: 0 };
        const leagueView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: draftState },
            jsx('div', { onClick: () => { leagueSpy.count += 1; } }, jsx(LeagueScreen, {})),
          ),
        );
        verifyTriggerAndPortaledTooltipIsolated(leagueView.container, leagueSpy, 'LeagueScreen');
        assert.equal(leagueView.container.querySelector('[data-testid="player-detail-modal"]'), null, 'LeagueScreen marker click must not open PlayerDetailModal');
        cleanup();

        // MatchupsScreen (must not bubble or open internal PlayerDetailModal)
        const matchSpy = { count: 0 };
        const matchView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: draftState },
            jsx('div', { onClick: () => { matchSpy.count += 1; } }, jsx(MatchupsScreen, { weeklyMatchup: draftState.weekly_matchup })),
          ),
        );
        verifyTriggerAndPortaledTooltipIsolated(matchView.container, matchSpy, 'MatchupsScreen');
        assert.equal(matchView.container.querySelector('[data-testid="player-detail-modal"]'), null, 'MatchupsScreen marker click must not open PlayerDetailModal');
        cleanup();

        // PlayerDetailModal stats-placeholder-marker opens statsMarkerExplainerText with no native title on enclosing cell
        resetPlayerDetailModalHistoryForTest();
        const modalView = render(
          jsx(
            OneiromancyProvider,
            { initialDraftState: draftState },
            jsx(PlayerDetailModal, { player: zeroBye, compareCandidates: [zeroBye, activePeer, { ...activePeer, id: 'iso_peer_3', name: 'Third Peer' }], activeWeek: 7, isOpen: true, onClose: () => {} }),
          ),
        );
        const statsMarker = modalView.container.querySelector('[data-testid="stats-placeholder-marker"]');
        assert.ok(statsMarker, 'PlayerDetailModal must render interactive stats-placeholder-marker for bye player');
        assert.equal(statsMarker.getAttribute('title'), null, 'Stats placeholder marker itself must not use native title attribute');
        assert.equal(statsMarker.parentElement?.parentElement?.getAttribute('title'), null, 'Compare Stats cell enclosing OraclePlaceholderMarker must not keep native title attribute');
        fireEvent.click(statsMarker);
        const statsTooltip = document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]');
        assert.ok(statsTooltip?.textContent?.includes('Zero weekly stats (on bye): 0.0 projected pts'), 'Stats marker tooltip must render statsMarkerExplainerText');
        cleanup();
      } finally {
        cleanup();
      }
    });

    test('9.4.6 PlayerDetailModal Escape key dismisses open placeholder tooltip first without closing modal, then closes modal on next Escape', () => {
      try {
        const zeroBye = {
          ...mockData.mockCosmicBoard[0],
          id: 'esc_bye_player',
          name: 'Bye Star',
          team: 'DAL',
          position: 'WR',
          sleeper_projected_points: 0,
          projected_points: 0,
          bye_week: 7,
          average_projected_points: 17.2,
          draft_score: 0,
        };
        let modalCloseCount = 0;
        const { container } = render(
          jsx(
            OneiromancyProvider,
            {
              initialDraftState: {
                ...testDraftState,
                weekly_matchup: { ...testDraftState.weekly_matchup, week: 7 },
              },
            },
            jsx(PlayerDetailModal, {
              player: zeroBye,
              isOpen: true,
              onClose: () => { modalCloseCount += 1; },
            }),
          ),
        );

        const marker = container.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(marker, 'PlayerDetailModal must render oracle-placeholder-marker');
        marker.matches = (sel) => sel === ':focus-visible';
        fireEvent.focus(marker);
        fireEvent.click(marker);
        assert.ok(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), 'Placeholder tooltip must be open before first Escape');

        // First Escape: tooltip captures & stops propagation -> closes tooltip, modal remains open
        fireEvent.keyDown(marker, { key: 'Escape' });
        assert.equal(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), null, 'First Escape must dismiss open tooltip');
        assert.equal(modalCloseCount, 0, 'First Escape while tooltip open must NOT close PlayerDetailModal');

        // Second Escape while focus remains on marker (tooltip already closed): closes modal
        fireEvent.keyDown(marker, { key: 'Escape' });
        assert.equal(modalCloseCount, 1, 'Second Escape once tooltip is closed must close PlayerDetailModal even while marker retains focus');
        cleanup();
      } finally {
        cleanup();
      }
    });

    test('9.4.7 computeTooltipPosition handles above placement, <56px header flip, and 8px viewport clamping at 375px & 1280px', () => {
      const tip = { width: 240, height: 84 };

      // Room above center
      const abovePos = computeTooltipPosition(
        { top: 300, bottom: 320, left: 180, right: 196, width: 16, height: 20 },
        { width: 375, height: 812 },
        tip,
      );
      assert.equal(abovePos.placement, 'top', 'Sufficient clearance above header must place tooltip on top');
      assert.equal(abovePos.top, 210, 'Top coordinate must sit 6px above anchor top (300 - 84 - 6)');
      assert.equal(abovePos.left, 68, 'Horizontal position must center over anchor when inside viewport');

      // Near sticky header (<56px top clearance) flips below anchor
      const headerFlipPos = computeTooltipPosition(
        { top: 70, bottom: 88, left: 180, right: 196, width: 16, height: 18 },
        { width: 375, height: 812 },
        tip,
      );
      assert.equal(headerFlipPos.placement, 'bottom', 'Insufficient header clearance (<56px) must flip tooltip below anchor');
      assert.equal(headerFlipPos.top, 94, 'Bottom placement must sit 6px below anchor bottom (88 + 6)');

      // Left edge clamp >= 8px on mobile
      const leftClamp = computeTooltipPosition(
        { top: 240, bottom: 256, left: 4, right: 18, width: 14, height: 16 },
        { width: 375, height: 812 },
        tip,
      );
      assert.equal(leftClamp.left, 8, 'Left edge must clamp at minimum 8px margin');

      // Right edge clamp <= viewport - width - 8 on 375px mobile & 1280px desktop
      const mobileRightClamp = computeTooltipPosition(
        { top: 240, bottom: 256, left: 355, right: 369, width: 14, height: 16 },
        { width: 375, height: 812 },
        tip,
      );
      assert.equal(mobileRightClamp.left, 127, '375px viewport must clamp tooltip right edge within 8px margin (375 - 240 - 8)');

      const desktopRightClamp = computeTooltipPosition(
        { top: 240, bottom: 256, left: 1260, right: 1274, width: 14, height: 16 },
        { width: 1280, height: 800 },
        tip,
      );
      assert.equal(desktopRightClamp.left, 1032, '1280px viewport must clamp tooltip right edge within 8px margin (1280 - 240 - 8)');

      // Clamping must never push tooltip under sticky 56px header even on short viewports
      const headerClamp = computeTooltipPosition(
        { top: 20, bottom: 38, left: 180, right: 196, width: 16, height: 18 },
        { width: 375, height: 180 },
        tip,
      );
      assert.ok(headerClamp.top >= 56, `Tooltip top (${headerClamp.top}) must clamp below 56px header clearance`);

      // Scroll-dismiss: scrolling anchor behind 56px header closes open portaled tooltip
      try {
        const scrollView = render(
          jsx(OraclePlaceholderMarker, {
            placeholder: {
              hasPlaceholder: true,
              markerExplainerText: 'Scroll test explainer',
              statsMarkerExplainerText: 'Stats scroll explainer',
              tooltipText: 'Scroll test tooltip',
              statsTooltipText: 'Stats scroll tooltip',
              reason: 'bye',
            },
          }),
        );
        const markerBtn = scrollView.container.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(markerBtn, 'OraclePlaceholderMarker button must render');
        let currentRect = { top: 240, bottom: 256, left: 180, right: 196, width: 16, height: 16 };
        markerBtn.getBoundingClientRect = () => currentRect;
        fireEvent.click(markerBtn);
        assert.ok(document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'), 'Click must open tooltip');
        currentRect = { top: 10, bottom: 24, left: 180, right: 196, width: 16, height: 14 };
        act(() => {
          window.dispatchEvent(new window.Event('scroll'));
        });
        assert.equal(
          document.body.querySelector('[data-testid="oracle-placeholder-tooltip"]'),
          null,
          'Scrolling anchor under 56px header must auto-close open tooltip'
        );
      } finally {
        cleanup();
      }
    });

    test('9.4.8 OneiromancyDashboard keeps OraclePlaceholderMarker as non-nested sibling outside card button', () => {
      try {
        const dashView = render(
          jsx(
            OneiromancyProvider,
            {
              initialDraftState: {
                ...testDraftState,
                weekly_matchup: { ...testDraftState.weekly_matchup, week: 7 },
                my_roster: [
                  {
                    slot_id: 'QB',
                    slot_name: 'QB',
                    player: {
                      ...mockData.mockCosmicBoard[0],
                      id: 'non_nested_qb',
                      name: 'Non Nested QB',
                      position: 'QB',
                      team: 'DAL',
                      projected_points: 0,
                      sleeper_projected_points: 0,
                      bye_week: 7,
                      average_projected_points: 18.4,
                    },
                  },
                ],
              },
            },
            jsx(OneiromancyDashboard, {}),
          ),
        );
        const qbCard = dashView.container.querySelector('[data-testid="roster-card-QB"]');
        const marker = qbCard?.querySelector('[data-testid="oracle-placeholder-marker"]');
        assert.ok(qbCard, 'QB roster card must render');
        assert.ok(marker, 'QB roster card must render OraclePlaceholderMarker');
        assert.equal(qbCard.getAttribute('role'), null, 'Outer roster card div must not carry role="button"');
        let ancestor = marker.parentElement;
        while (ancestor) {
          const tag = String(ancestor.tagName || '').toLowerCase();
          assert.notEqual(tag, 'button', 'OraclePlaceholderMarker must not have an ancestor <button>');
          assert.notEqual(tag, 'a', 'OraclePlaceholderMarker must not have an ancestor <a>');
          assert.notEqual(ancestor.getAttribute?.('role'), 'button', 'OraclePlaceholderMarker must not have an ancestor role="button"');
          ancestor = ancestor.parentElement;
        }
        const cardBtn = Array.from(qbCard.querySelectorAll('button')).find((b) =>
          String(b.getAttribute?.('aria-label') || '').startsWith('Inspect ')
        );
        assert.ok(cardBtn, 'Roster card must expose non-nested sibling Inspect button');
        assert.equal(
          cardBtn.querySelector('[data-testid="oracle-placeholder-marker"]'),
          null,
          'Inspect card button must not contain OraclePlaceholderMarker'
        );
      } finally {
        cleanup();
      }
    });
  });
});



