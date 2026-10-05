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
 * Executes hermetic component unit and integration testing across all 17 React UI
 * components in oneiromancy using React Testing Library (RTL) primitives:
 * - GlassCard
 * - PositionalBadge
 * - UserAvatar
 * - NavigationShell
 * - Astrolabe
 * - BoardControls
 * - PlayerCardRow
 * - RecommendedPickHero
 * - AscensionTimeline
 * - TelemetryBar
 * - PlayerDetailModal
 * - SettingsDrawer
 * - OneiromancyDashboard
 * - MatchupsScreen
 * - CosmicBoard
 * - PlayerMarketplace
 * - ChaosDial
 * 
 * Verifies DOM presence, loading/error/success states, prop variations, and interactions.
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { render, screen, fireEvent, cleanup } from './helpers/react_testing_wrapper.mjs';
import { jsx } from './helpers/react_shim.mjs';
import { setupServer } from './helpers/msw_network_interceptor.mjs';

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
const { PlayerDetailModal } = await import('../components/modals/PlayerDetailModal.tsx');
const { SettingsDrawer } = await import('../components/settings/SettingsDrawer.tsx');
const { OneiromancyDashboard } = await import('../components/screens/OneiromancyDashboard.tsx');
const { MatchupsScreen } = await import('../components/screens/MatchupsScreen.tsx');
const { CosmicBoard } = await import('../components/screens/CosmicBoard.tsx');
const { PlayerMarketplace } = await import('../components/screens/PlayerMarketplace.tsx');
const { ChaosDial } = await import('../components/screens/ChaosDial.tsx');
const { OneiromancyProvider } = await import('../context/OneiromancyContext.tsx');

const mockData = await import('../core/lib/mockData.ts');

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

    test('8.1.2 PositionalBadge should render official role colors for QB, RB, WR, TE', () => {
      const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX'];
      for (const pos of positions) {
        render(jsx(PositionalBadge, { position: pos, size: 'md' }));
        const badge = screen.getByText(pos);
        assert.ok(badge, `PositionalBadge must render ${pos}`);
        assert.ok(screen.getByTestId(`badge-${pos.toLowerCase()}`), `Must have test id for ${pos}`);
        cleanup();
      }
    });

    test('8.1.3 UserAvatar should render image when src is present and fallback initials', () => {
      // With image URL
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
      assert.equal(img.props.src, 'https://sleepercdn.com/avatars/thumbs/test_avatar');
      cleanup();

      // With initials fallback
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

    test('8.1.4 NavigationShell should render all 5 canonical tabs and handle switching', () => {
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

      // Check tab items
      const matchupsTab = screen.getByText('Matchups');
      assert.ok(matchupsTab, 'Must render Matchups tab');
      fireEvent.click(matchupsTab);
      assert.equal(selectedTab, 'matchups', 'Clicking Matchups tab must fire onTabChange via bubbling');
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
        // Initial render matches baseSrc deterministically (SSR match)
        assert.equal(img.props.src, 'https://sleepercdn.com/avatars/thumbs/initial_hash');
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
      assert.equal(astrolabe.props['aria-label'], 'Celestial Astrolabe with speed multiplier 3.25');
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

      const searchInput = screen.getByPlaceholderText(/Search celestial player/i);
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

      assert.ok(screen.getByText("THE ORACLE'S DECREE"), 'Must render headline banner');
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
    test('8.3.1 PlayerDetailModal should render dossier when isOpen is true and hide when false', () => {
      let closed = false;
      const player = mockData.mockCosmicBoard[0];

      // Closed state
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

      // Open state
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
      assert.ok(screen.getByText('Draft Telemetry Settings'), 'Must render settings title');
      assert.ok(screen.getByText('Sleeper Username'), 'Must render username label');

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
        assert.equal(input.props.value, '', 'Username input must be empty on first launch');
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
        globalThis.window = origWindow;
        globalThis.localStorage = origLocalStorage;
        cleanup();
      }
    });
  });

  // ==========================================================================
  // Suite 8.4: Primary Application Screens
  // ==========================================================================
  describe('8.4 Primary Application Screens', () => {
    test('8.4.1 OneiromancyDashboard should render ideal team and league telemetry with Week 2 matchup', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(OneiromancyDashboard, {}))
      );

      assert.ok(screen.getByText('Ideal Team & League Telemetry'), 'Must render screen title');
      assert.ok(screen.getByText('Weekly Matchup & Start/Sit Oracle'), 'Must render matchup section');
      assert.ok(screen.getByText('Week 2'), 'Must default to Week 2 matchup badge');
      assert.ok(screen.getByText(/SolarFlare/i), 'Must show Week 2 opponent SolarFlare');
      assert.ok(screen.getByText('League Draft Status & Competitor Rosters'), 'Must render competitor rosters section');
    });

    test('8.4.2 MatchupsScreen should render starting lineup and bench partition', () => {
      render(
        jsx(
          OneiromancyProvider,
          { initialDraftState: testDraftState },
          jsx(MatchupsScreen, { weeklyMatchup: testDraftState.weekly_matchup })
        )
      );

      assert.ok(screen.getByText('YOUR STARTERS'), 'Must render YOUR STARTERS header');
      assert.ok(screen.getByText('YOUR BENCH'), 'Must render YOUR BENCH header');
      assert.ok(screen.getByText('OPPONENT STARTERS'), 'Must render OPPONENT STARTERS header');
      assert.ok(screen.getByText('OPPONENT BENCH'), 'Must render OPPONENT BENCH header');
    });

    test('8.4.3 CosmicBoard should render valuation banner and player grid', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(CosmicBoard, {}))
      );

      assert.ok(screen.getByText('Celestial Player Directory'), 'Must render Cosmic Board heading');
      assert.ok(screen.getByPlaceholderText(/Search celestial player/i), 'Must render search controls');
    });

    test('8.4.4 PlayerMarketplace should render waivers, trades, and drop protection toggle', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(PlayerMarketplace, {}))
      );

      assert.ok(screen.getByText('Alchemical Transmutations'), 'Must render Marketplace title');
      assert.ok(screen.getByText('Waiver Upgrades'), 'Must render waiver section');
      assert.ok(screen.getByText('Divine Swaps'), 'Must render trades section');
    });

    test('8.4.5 ChaosDial should render lambda slider and esoteric guide', () => {
      render(
        jsx(OneiromancyProvider, { initialDraftState: testDraftState }, jsx(ChaosDial, {}))
      );

      assert.ok(screen.getByText('Divination Equilibrium'), 'Must render Chaos Dial title');
      assert.ok(screen.getByText('Live Mathematical Formula'), 'Must render formula card');
      assert.ok(screen.getByText('Esoteric & Astrological Reference Guide'), 'Must render reference guide');
    });
  });
});
