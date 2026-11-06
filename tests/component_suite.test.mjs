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

const { render, renderToString, screen, fireEvent, waitFor, act, cleanup, jsx, Fragment, StrictMode, React } = await import('./helpers/react_testing_wrapper.mjs');
const { setupServer, http, HttpResponse } = await import('./helpers/msw_network_interceptor.mjs');

// Import UI components dynamically after loader registration
const { GlassCard } = await import('../components/common/GlassCard.tsx');
const { PositionalBadge } = await import('../components/common/PositionalBadge.tsx');
const { UserAvatar } = await import('../components/common/UserAvatar.tsx');
const { NavigationShell } = await import('../components/common/NavigationShell.tsx');
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

      // Verify mobile compare checkbox label has >= 44x44px touch target
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
      assert.ok(
        compareLabel.className.includes('min-w-[44px]') && compareLabel.className.includes('min-h-[44px]'),
        'Compare touch target label must satisfy >= 44x44px minimum touch target size',
      );
      const compareInput = compareLabel.querySelector('input[type="checkbox"]');
      assert.ok(compareInput, 'Checkbox input must be inside label');
      fireEvent.click(compareInput);
      assert.equal(toggledId, String(player.id), 'Toggling compare checkbox must invoke onToggleCompare');
      assert.equal(inspectedAfter, null, 'Clicking compare checkbox must stopPropagation and not open modal');

      // Test clicking label padding directly invokes onToggleCompare exactly once without double-toggle
      let labelToggledCount = 0;
      cleanup();
      const labelTestView = render(
        jsx(PlayerCardRow, {
          player,
          rank: 1,
          onInspect: () => {},
          onToggleCompare: () => {
            labelToggledCount++;
          },
        })
      );
      const testLabel = labelTestView.container.querySelector('label');
      assert.ok(testLabel, 'Label must exist');
      fireEvent.click(testLabel);
      assert.equal(labelToggledCount, 1, 'Clicking label padding must toggle compare exactly once');
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
  });

  // ==========================================================================
  // Suite 8.4: Primary Application Screens (4 Consolidated Sections)
  // ==========================================================================
  describe('8.4 Primary Application Screens (Roster, Matchup, Players, League & Weights)', () => {
    test('8.4.1 OneiromancyDashboard (Roster) should render My Roster, Visual Stack Constellation SVG, and Lineup Swap Arrows', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(OneiromancyDashboard, {}))
      );

      assert.ok(screen.getByText(/Roster Aura & Stack Constellation/i), 'Must render Roster Aura & Stack Constellation title');
      assert.ok(screen.getByTestId('synergy-constellation-svg'), 'Must render visual Synergy Constellation SVG');
      assert.ok(screen.getByTestId('18-week-coverage-strip'), 'Must render 18-Week Coverage strip');
    });

    test('8.4.2 MatchupsScreen (Matchup) should render unified starting lineup without duplicate bench section and Your Team on Left with purple border', () => {
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(MatchupsScreen, { weeklyMatchup: testDraftState.weekly_matchup })
        )
      );

      assert.ok(screen.getByText('YOUR STARTERS'), 'Must render YOUR STARTERS header');
      assert.ok(screen.getByText('OPPONENT STARTERS'), 'Must render OPPONENT STARTERS header');
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
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(PlayerMarketplace, {}))
      );

      assert.ok(screen.getByText('Waiver Upgrades'), 'Must render Waiver Upgrades title');
      assert.equal(screen.queryByTestId('allow-signed-drop-toggle'), null, 'Must not render redundant drop protection toggle');
      cleanup();

      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(TradesScreen, {}))
      );
      assert.ok(screen.getByText('Trades'), 'Must render Trades title');
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
        assert.ok(dashMarker.getAttribute('title')?.includes('uses average projection (15.0 pts) as a placeholder while on bye'));
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
        assert.ok(modalMarker.getAttribute('title')?.includes('uses average projection (15.0 pts) as a placeholder while on bye'));
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
      assert.ok(
        marker.getAttribute('title')?.includes('uses average projection (19.4 pts) as a placeholder while on bye'),
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
        assert.ok(
          oracleMarker.getAttribute('title')?.includes('uses average projection (16.5 pts) as a placeholder while on bye'),
          'Oracle marker tooltip must explain placeholder',
        );

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

    test('8.5.24 Multi-player comparison, stop propagation, pinned rows, head-to-head, and bottom close removal', () => {
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

        // Find compare checkboxes in table
        const allCheckboxes = boardView.querySelectorAll('input[type="checkbox"]');
        const checkboxes = allCheckboxes.filter(cb => (cb.getAttribute('aria-label') || '').startsWith('Compare '));
        assert.ok(checkboxes.length >= 2, 'Compare checkboxes must exist in table rows');

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

        // Now action bar must show 2 and render Head-to-Head Compare button
        assert.ok(actionBar.textContent.includes('Comparing 2 / 6'), 'Action bar must show 2 candidates');
        assert.ok(actionBar.className.includes('sticky') && actionBar.className.includes('bottom-4'), 'Action bar must have sticky bottom-4 layout');
        const h2hBtn = boardView.querySelector('button[data-testid="head-to-head-btn"]');
        assert.ok(h2hBtn, 'Head-to-Head Compare button must be present when exactly 2 players pinned');
        assert.ok(h2hBtn.textContent.includes('Compare Head-to-Head'), 'Button label must be Compare Head-to-Head');

        // Click Head-to-Head button: must open PlayerDetailModal comparing both players
        fireEvent.click(h2hBtn);
        const modal = boardView.querySelector('[role="dialog"]');
        assert.ok(modal, 'Head-to-head button must open PlayerDetailModal');
        assert.ok(modal.textContent.includes('Head-to-head'), 'Modal must render head-to-head comparison');
        assert.ok(modal.textContent.includes(playerName0) && modal.textContent.includes(playerName1), 'Modal must show both compared players');

        // Close modal via top-right X button
        const modalClose = modal.querySelector('button[aria-label="Close dossier"]');
        assert.ok(modalClose, 'Modal top-right close button must exist');
        fireEvent.click(modalClose);
        assert.equal(boardView.querySelector('[role="dialog"]'), null, 'Modal must close');

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

    test('8.5.27 Multi-player comparison action button and multi-candidate-grid for 3 to 6 candidates', () => {
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

        // Action bar button should say "Compare 3 Candidates"
        const compareBtn = boardView.querySelector('button[data-testid="head-to-head-btn"]');
        assert.ok(compareBtn, 'Compare button must exist for 3 pinned players');
        assert.ok(compareBtn.textContent.includes('Compare 3 Candidates'), 'Button text must say Compare 3 Candidates');

        // Click Compare 3 Candidates
        fireEvent.click(compareBtn);

        const modal = boardView.querySelector('[role="dialog"]');
        assert.ok(modal, 'Modal must open on Compare 3 Candidates click');
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

        // Close modal
        const closeBtn = modal.querySelector('button[aria-label="Close dossier"]');
        assert.ok(closeBtn);
        fireEvent.click(closeBtn);
        assert.equal(boardView.querySelector('[role="dialog"]'), null, 'Modal must close');

        cleanup();
      } finally {
        cleanup();
      }
    });
  });
});

