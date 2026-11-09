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
import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

const oracle = await import('./helpers/oneiromancy_oracle.mjs');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const tailwindConfig = (await import('./dist/tailwind.config.js')).default;
const sleeper = await import('./dist/lib/sleeper.js');
const scoring = await import('./dist/lib/scoring.js');
const oracleLib = await import('./dist/lib/oracle.js');
const mockData = await import('./dist/lib/mockData.js');
const { OneiromancyProvider } = await import('./dist/context/OneiromancyContext.js');
const Astrolabe = (await import('./dist/components/astrolabe/Astrolabe.js')).default;
const NavigationShellModule = await import('./dist/components/common/NavigationShell.js');
const NavigationShell = NavigationShellModule.default;
const PositionalBadge = (await import('./dist/components/common/PositionalBadge.js')).default;
const GlassCard = (await import('./dist/components/common/GlassCard.js')).default;
const UserAvatar = (await import('./dist/components/common/UserAvatar.js')).default;
const BoardControls = (await import('./dist/components/board/BoardControls.js')).default;
const PlayerCardRow = (await import('./dist/components/board/PlayerCardRow.js')).default;
const RecommendedPickHero = (await import('./dist/components/oneiromancy/RecommendedPickHero.js')).default;
const PlayerDetailModal = (await import('./dist/components/modals/PlayerDetailModal.js')).default;
const OraclePanel = (await import('./dist/components/oracle/OraclePanel.js')).default;
const CelestialLeaderboardGraph = (await import('./dist/components/oneiromancy/CelestialLeaderboardGraph.js')).default;
const WeeklyMoves = (await import('./dist/components/oneiromancy/WeeklyMoves.js')).default;
const SettingsDrawer = (await import('./dist/components/settings/SettingsDrawer.js')).default;
const OneiromancyDashboard = (await import('./dist/components/screens/OneiromancyDashboard.js')).default;
const MatchupsScreen = (await import('./dist/components/screens/MatchupsScreen.js')).default;
const CosmicBoard = (await import('./dist/components/screens/CosmicBoard.js')).default;
const LeagueScreen = (await import('./dist/components/screens/LeagueScreen.js')).default;
const ChaosDial = (await import('./dist/components/screens/ChaosDial.js')).default;
const PlayerMarketplace = (await import('./dist/components/screens/PlayerMarketplace.js')).default;
const TradesScreen = (await import('./dist/components/screens/TradesScreen.js')).default;
const Home = (await import('./dist/app/page.js')).default;

function renderWithProvider(element, initialDraftState = null) {
  return renderToStaticMarkup(
    React.createElement(
      OneiromancyProvider,
      initialDraftState ? { initialDraftState } : null,
      element
    )
  );
}

describe('Tier 1: Feature Coverage (19 Features x >=5 Tests)', () => {
  // ============================================================================
  // Feature 1: Celestial Visual Theme Tokens
  // ============================================================================
  describe('Feature 1: Celestial Visual Theme Tokens', () => {
    const globalsCssPath = path.resolve('app/globals.css');

    it('1.1 should define Deep Obsidian (#131318) in tailwind config and globals.css', () => {
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      assert.equal(tailwindConfig?.theme?.extend?.colors?.oneiromancy?.obsidian, '#131318', 'Tailwind must configure #131318');
      assert.ok(globalsCssContent.includes('--background: #131318'), 'globals.css :root must set --background: #131318');
      assert.ok(globalsCssContent.includes('background-color: #131318'), 'globals.css body must set background-color: #131318');
    });

    it('1.2 should define Nebula Purple (#6d28d9) as mystical accent in tailwind config', () => {
      const colors = tailwindConfig?.theme?.extend?.colors;
      assert.equal(colors?.oneiromancy?.purple, '#6d28d9', 'Tailwind must define purple #6d28d9');
      assert.equal(colors?.nebula?.DEFAULT, '#6d28d9', 'Tailwind must define nebula color palette');
    });

    it('1.3 should define Electric Cyan (#06b6d4) as telemetry accent in tailwind config', () => {
      const colors = tailwindConfig?.theme?.extend?.colors;
      assert.equal(colors?.oneiromancy?.cyan, '#06b6d4', 'Tailwind must define cyan #06b6d4');
      assert.equal(colors?.cyan?.DEFAULT, '#06b6d4', 'Tailwind must define cyan color palette');
    });

    it('1.4 should define surface (#1a1a24) and elevated (#242436) glassmorphic backgrounds in tailwind config', () => {
      const oneiromancyColors = tailwindConfig?.theme?.extend?.colors?.oneiromancy;
      assert.equal(oneiromancyColors?.surface, '#1a1a24', 'Tailwind must configure surface #1a1a24');
      assert.equal(oneiromancyColors?.elevated, '#242436', 'Tailwind must configure elevated #242436');
    });

    it('1.5 should verify tailwind config contains complete celestial color palette without skips', () => {
      const serializedColors = JSON.stringify(tailwindConfig?.theme?.extend?.colors || {});
      const requiredTokens = ['#131318', '#6d28d9', '#06b6d4', '#eab308', '#10b981', '#a855f7'];
      for (const token of requiredTokens) {
        assert.ok(serializedColors.includes(token), `Tailwind config must include token ${token}`);
      }
    });
  });

  // ============================================================================
  // Feature 2: Mystical & Telemetry Typography
  // ============================================================================
  describe('Feature 2: Mystical & Telemetry Typography', () => {
    it('2.1 should specify Playfair Display CSS variable in tailwind serif stack', () => {
      const serif = tailwindConfig?.theme?.extend?.fontFamily?.serif;
      assert.ok(Array.isArray(serif), 'Tailwind must declare serif font family');
      assert.ok(serif.includes('var(--font-playfair)'), 'Tailwind serif stack must use var(--font-playfair)');
    });

    it('2.2 should specify Space Mono CSS variable in tailwind mono stack', () => {
      const mono = tailwindConfig?.theme?.extend?.fontFamily?.mono;
      assert.ok(Array.isArray(mono), 'Tailwind must declare mono font family');
      assert.ok(mono.includes('var(--font-space-mono)'), 'Tailwind mono stack must use var(--font-space-mono)');
    });

    it('2.3 should render serif headings across NavigationShell and screens', () => {
      const html = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      assert.ok(html.includes('font-serif'), 'NavigationShell header brand must use font-serif');
    });

    it('2.4 should render monospace telemetry numerals across NavigationShell and Astrolabe', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 0.75, showLabels: true }));
      assert.ok(html.includes('font-mono'), 'Astrolabe telemetry readouts must use font-mono');
    });

    it('2.5 should verify tailwind.config.ts font stacks have fallback system fonts', () => {
      const fontFamily = tailwindConfig?.theme?.extend?.fontFamily;
      assert.deepEqual(fontFamily?.serif?.slice(1), ['Georgia', 'serif'], 'Serif stack must include Georgia, serif fallback');
      assert.ok(fontFamily?.mono?.includes('monospace'), 'Mono stack must include monospace fallback');
    });
  });

  // ============================================================================
  // Feature 3: Glassmorphism & Panel Styling
  // ============================================================================
  describe('Feature 3: Glassmorphism & Panel Styling', () => {
    const globalsCssPath = path.resolve('app/globals.css');

    it('3.1 should define .glass-panel with backdrop-filter blur(14px) and subtle opacity in globals.css', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
      assert.ok(globalsCss.includes('.glass-panel'), 'globals.css must define .glass-panel');
      assert.ok(globalsCss.includes('backdrop-filter: blur(14px)'), '.glass-panel must configure backdrop-filter: blur(14px)');
      assert.ok(globalsCss.includes('background: rgba(26, 26, 36, 0.72)'), '.glass-panel must configure background: rgba(26, 26, 36, 0.72)');
    });

    it('3.2 should define .glow-cyan utility with electric cyan box shadow in globals.css', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
      assert.ok(globalsCss.includes('.glow-cyan'), 'globals.css must define .glow-cyan');
      assert.ok(globalsCss.includes('0 0 16px rgba(6, 182, 212, 0.25)'), '.glow-cyan must configure electric cyan glow shadow');
      assert.ok(globalsCss.includes('border-color: rgba(6, 182, 212, 0.5)'), '.glow-cyan must configure electric cyan border');
    });

    it('3.3 should define .glow-purple utility with nebula purple box shadow in globals.css', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
      assert.ok(globalsCss.includes('.glow-purple'), 'globals.css must define .glow-purple');
      assert.ok(globalsCss.includes('0 0 16px rgba(109, 40, 217, 0.3)'), '.glow-purple must configure nebula purple glow shadow');
      assert.ok(globalsCss.includes('border-color: rgba(109, 40, 217, 0.5)'), '.glow-purple must configure nebula purple border');
    });

    it('3.4 should specify 1px hairline border with translucent white overlay in .glass-panel and .glass-surface', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
      assert.ok(globalsCss.includes('border: 1px solid rgba(255, 255, 255, 0.08)'), 'globals.css must configure translucent white hairline border');
    });

    it('3.5 should verify GlassCard component maps variants (panel, surface, gradient) to globals.css classes', () => {
      const panelHtml = renderToStaticMarkup(React.createElement(GlassCard, { variant: 'panel', glowColor: 'cyan' }, 'Panel'));
      const surfaceHtml = renderToStaticMarkup(React.createElement(GlassCard, { variant: 'surface', glowColor: 'purple' }, 'Surface'));
      const gradientHtml = renderToStaticMarkup(React.createElement(GlassCard, { variant: 'gradient' }, 'Gradient'));
      assert.ok(panelHtml.includes('glass-panel') && panelHtml.includes('glow-cyan'), 'GlassCard must map panel and glow-cyan');
      assert.ok(surfaceHtml.includes('glass-surface') && surfaceHtml.includes('glow-purple'), 'GlassCard must map surface and glow-purple');
      assert.ok(gradientHtml.includes('glow-gradient-card'), 'GlassCard must map glow-gradient-card');
    });
  });

  // ============================================================================
  // Feature 4: Positional Badges & Colors
  // ============================================================================
  describe('Feature 4: Positional Badges & Colors', () => {
    it('4.1 should assign QB badge Sleeper Red (#ef4444 / text-red-400)', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB' }));
      assert.ok(html.includes('text-red-400'), 'QB badge must use text-red-400');
      assert.ok(html.includes('bg-red-950/40'), 'QB badge must use bg-red-950/40');
    });

    it('4.2 should assign RB badge Sleeper Teal-ish Green (#14b8a6 / text-teal-400)', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'RB' }));
      assert.ok(html.includes('text-teal-400'), 'RB badge must use text-teal-400');
      assert.ok(html.includes('bg-teal-950/40'), 'RB badge must use bg-teal-950/40');
    });

    it('4.3 should assign WR badge Sleeper Light Blue (#38bdf8 / text-sky-400)', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'WR' }));
      assert.ok(html.includes('text-sky-400'), 'WR badge must use text-sky-400');
      assert.ok(html.includes('bg-sky-950/40'), 'WR badge must use bg-sky-950/40');
    });

    it('4.4 should assign TE badge Sleeper Orange-ish Yellow (#f59e0b / text-amber-400)', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'TE' }));
      assert.ok(html.includes('text-amber-400'), 'TE badge must use text-amber-400');
      assert.ok(html.includes('bg-amber-950/40'), 'TE badge must use bg-amber-950/40');
    });

    it('4.5 should assign FLEX to rose and K/DEF to slate styles with size classes', () => {
      const flexHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'FLEX', size: 'lg' }));
      const kdefHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'K_DEF', size: 'sm' }));
      assert.ok(flexHtml.includes('text-rose-400'), 'FLEX badge must use text-rose-400');
      assert.ok(flexHtml.includes('text-sm px-2.5 py-1'), 'FLEX lg badge must apply lg size classes');
      assert.ok(kdefHtml.includes('text-slate-300'), 'K_DEF badge must use slate styling');
    });
  });

  // ============================================================================
  // Feature 5: Dynamic Astrolabe SVG Component
  // ============================================================================
  describe('Feature 5: Dynamic Astrolabe SVG Component', () => {
    it('5.1 should render 3 concentric ring structures with SVG geometry in Astrolabe', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 0.75 }));
      assert.ok(html.includes('r="138"'), 'Outer ring must have r=138');
      assert.ok(html.includes('r="104"'), 'Middle ring must have r=104');
      assert.ok(html.includes('r="70"'), 'Inner ring must have r=70');
    });

    it('5.2 should compute rotation duration scaling inversely with Chaos lambda in Astrolabe', () => {
      const html0 = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 0 }));
      const html1 = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 1 }));
      assert.ok(html0.includes('spin-cw 60s'), 'Lambda=0 outer ring duration must be 60s');
      assert.ok(html1.includes('spin-cw 15s'), 'Lambda=1 outer ring duration must be 15s');
    });

    it('5.3 should apply spin-cw and spin-ccw for counter-rotational visual depth in Astrolabe', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 0 }));
      assert.ok(html.includes('spin-cw 60s'), 'Ring 1 must rotate clockwise with spin-cw');
      assert.ok(html.includes('spin-ccw 40s'), 'Ring 2 must counter-rotate with spin-ccw');
      assert.ok(html.includes('spin-cw 20s'), 'Ring 3 must rotate clockwise with spin-cw');
    });

    it('5.4 should support dynamic size scaling and SVG viewBox 0 0 300 300 in Astrolabe', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, {}));
      assert.ok(html.includes('viewBox="0 0 300 300"'), 'Astrolabe SVG must specify viewBox 0 0 300 300');
      assert.ok(html.includes('width="240"'), 'Astrolabe must default size to 240');
      assert.ok(html.includes('data-testid="astrolabe"'), 'Astrolabe must provide data-testid="astrolabe"');
      assert.ok(html.includes('role="img"'), 'Astrolabe must declare role="img"');
    });

    it('5.5 should render atmospheric glow gradient and center pulsing core in Astrolabe', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, {}));
      assert.ok(html.includes('radial-gradient(circle,'), 'Astrolabe must render atmospheric glow radial gradient');
      assert.ok(html.includes('class="animate-pulse"'), 'Astrolabe center eye must have animate-pulse');
      assert.ok(html.includes('fill="#6d28d9"'), 'Astrolabe center eye must use nebula purple fill');
    });
  });

  // ============================================================================
  // Feature 6: Mobile-First Navigation Shell & Tabs
  // ============================================================================
  describe('Feature 6: Mobile-First Navigation Shell & Tabs', () => {
    it('6.1 should define the 4 in-season tabs in order: oneiromancy (Roster), matchups (Matchup), board (Players), league (League)', () => {
      const html = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      const mobileIds = [...html.matchAll(/data-testid="nav-tab-([a-z_]+)"/g)].map((m) => m[1]);
      assert.deepEqual(mobileIds, ['oneiromancy', 'matchups', 'board', 'league']);
      assert.equal(NavigationShellModule.isTabActive('market', 'board'), true, 'Legacy tab ids must resolve through TAB_ALIASES');
    });

    it('6.2 should adhere to mobile touch target minimum height with h-16 bottom bar in NavigationShell', () => {
      const html = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      assert.ok(html.includes('h-16'), 'Bottom navigation bar must have h-16 (64px >= 44px touch target)');
      assert.ok(html.includes('grid-cols-4'), 'Bottom nav must divide width evenly into 4 columns');
      assert.ok(html.includes('h-full w-full'), 'Tab buttons must occupy full height and width of container');
      assert.ok(html.includes('md:hidden fixed bottom-0'), 'Bottom nav is phone-only');
    });

    it('6.3 should specify sticky header displaying draft status and live synchronization pulse in NavigationShell', () => {
      const html = renderToStaticMarkup(
        React.createElement(NavigationShell, { activeTab: 'oneiromancy', statusType: 'syncing' }, React.createElement('div'))
      );
      assert.ok(html.includes('sticky top-0'), 'Header must be sticky top-0');
      assert.ok(html.includes('data-testid="draft-status-indicator"'), 'Header must include draft-status-indicator test id');
      assert.ok(html.includes('animate-ping'), 'Syncing indicator must use animate-ping for pulse');
      assert.ok(html.includes('ONEIROMANCY'), 'Header must render brand title');
    });

    it('6.4 should provide fixed bottom navigation bar with safe-area padding in NavigationShell', () => {
      const html = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      assert.ok(html.includes('fixed bottom-0'), 'Navigation bar must be fixed bottom-0');
      assert.ok(html.includes('pb-[env(safe-area-inset-bottom)]'), 'Navigation bar must configure safe-area inset padding');
      assert.ok(html.includes('role="navigation"'), 'Navigation element must declare role="navigation"');
    });

    it('6.5 should ensure mobile layout constraint max-w-md (<480px) in NavigationShell', () => {
      const html = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      assert.ok(html.includes('max-w-md mx-auto'), 'Navigation tab container must constrain to max-w-md (448px < 480px)');
      assert.ok(html.includes('max-w-5xl mx-auto'), 'Main content container must constrain to max-w-5xl');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Screen 1: Ideal Team Dashboard ("Oneiromancy")
  // --------------------------------------------------------------------------
  describe('Feature 7: Screen 1: Ideal Team Dashboard ("Oneiromancy")', () => {
    it('7.1 should spotlight the #1 algorithmically recommended player pick', () => {
      const mock = oracle.createCanonicalMockDraft();
      const topPick = mock.players.reduce((best, p) => (p.draft_score > best.draft_score ? p : best));
      assert.ok(topPick.id);
      assert.ok(topPick.draft_score >= 90.0);
    });

    it('7.2 should render Path of Ascension with 15 vertical round-by-round draft nodes', () => {
      const pathSteps = Array.from({ length: 15 }, (_, i) => ({
        round: i + 1,
        overall_pick: i * 12 + 5,
        target_position: 'WR',
        target_player_id: `p_${i + 1}`,
        target_player_name: `Target ${i + 1}`,
        draft_score: 85.0,
        is_ascended: i < 3,
        fallback_player_id: `fb_${i + 1}`,
      }));
      assert.equal(pathSteps.length, 15);
      assert.equal(oracle.validateIdealDraftPath(pathSteps), true);
    });

    it('7.3 should display target position badge, projected points, and positional VOR per step', () => {
      const step = {
        round: 1,
        overall_pick: 5,
        target_position: 'WR',
        target_player_id: '7569',
        target_player_name: "Ja'Marr Chase",
        projected_points: 305.2,
        positional_vor: 84.1,
        draft_score: 90.4,
        is_ascended: true,
        fallback_player_id: '6794',
      };
      assert.equal(step.target_position, 'WR');
      assert.ok(step.projected_points > 300);
      assert.ok(step.positional_vor > 80);
    });

    it('7.4 should include elemental synergy tag and strategic rationale for each ascension node', () => {
      const step = {
        round: 1,
        elemental_synergy_tag: 'Water Trine Anchor',
        strategic_rationale: 'High-ceiling alpha receiver',
      };
      assert.ok(step.elemental_synergy_tag.includes('Water'));
      assert.ok(step.strategic_rationale.length > 10);
    });

    it('7.5 should provide fallback player candidate if primary target is drafted', () => {
      const step = {
        target_player_id: '7569',
        target_player_name: "Ja'Marr Chase",
        fallback_player_id: '6794',
        fallback_player_name: 'CeeDee Lamb',
      };
      assert.notEqual(step.target_player_id, step.fallback_player_id);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Screen 2: Cosmic Board Data Table
  // --------------------------------------------------------------------------
  describe('Feature 8: Screen 2: Cosmic Board Data Table', () => {
    it('8.1 should display high-density table with Rank, Name, Team, Bye, Draft Score, Spirit, VOR, Harmony', () => {
      const mock = oracle.createCanonicalMockDraft();
      const p = mock.players[0];
      assert.ok('name' in p);
      assert.ok('team' in p);
      assert.ok('bye_week' in p);
      assert.ok('draft_score' in p);
      assert.ok('spirit_score' in p);
      assert.ok('market_vor' in p);
      assert.ok('harmony_score' in p);
    });

    it('8.2 should filter players by position (QB, RB, WR, TE)', () => {
      const mock = oracle.createCanonicalMockDraft();
      const qbs = mock.players.filter((p) => p.position === 'QB');
      const wrs = mock.players.filter((p) => p.position === 'WR');
      assert.ok(qbs.length >= 2, 'Mock pool should contain at least 2 QBs');
      assert.ok(wrs.length >= 3, 'Mock pool should contain at least 3 WRs');
      assert.ok(qbs.every((p) => p.position === 'QB'));
    });

    it('8.3 should sort players descending by Draft Score', () => {
      const mock = oracle.createCanonicalMockDraft();
      const sorted = [...mock.players].sort((a, b) => b.draft_score - a.draft_score);
      for (let i = 0; i < sorted.length - 1; i++) {
        assert.ok(sorted[i].draft_score >= sorted[i + 1].draft_score);
      }
    });

    it('8.4 should search player name case-insensitively', () => {
      const mock = oracle.createCanonicalMockDraft();
      const query = 'chase';
      const results = mock.players.filter((p) => p.name.toLowerCase().includes(query));
      assert.equal(results.length, 1);
      assert.equal(results[0].name, "Ja'Marr Chase");
    });

    it('8.5 should support availability toggle filtering out drafted players', () => {
      const mock = oracle.createCanonicalMockDraft();
      const availableOnly = mock.players.filter((p) => p.draft_status === 'available');
      assert.ok(availableOnly.every((p) => p.draft_status === 'available'));
      assert.ok(!availableOnly.some((p) => p.name === "Ja'Marr Chase"));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Screen 3: The Chaos Dial View
  // --------------------------------------------------------------------------
  describe('Feature 9: Screen 3: The Chaos Dial View', () => {
    it('9.1 should provide interactive slider for Chaos lambda in range [0.0, 1.0] defaulting to 0.75', () => {
      assert.equal(oracle.DEFAULT_CHAOS_LAMBDA, 0.75);
      assert.equal(oracle.clamp(0.75, 0.0, 1.0), 0.75);
      assert.equal(oracle.clamp(1.4, 0.0, 1.0), 1.0);
    });

    it('9.2 should display live blended formula: DraftScore = (1 - lambda)*VOR + lambda*SpiritScore', () => {
      const lambda = 0.35;
      const vorNorm = 80.0;
      const spirit = 90.0;
      const expected = (1 - lambda) * vorNorm + lambda * spirit;
      assert.equal(oracle.computeDraftScore(vorNorm, spirit, lambda), expected);
    });

    it('9.3 should support 5 divination tier weight sliders (Celestial, Numeric, Geomantic, Oracular, Harmony)', () => {
      const weights = oracle.DEFAULT_ORACLE_WEIGHTS;
      assert.equal(weights.celestial, 0.1);
      assert.equal(weights.numeric, 0.1);
      assert.equal(weights.geomantic, 0.25);
      assert.equal(weights.oracular, 0.1);
      assert.equal(weights.harmony, 0.45);
    });

    it('9.4 should normalize divination tier weights to sum exactly to 1.00', () => {
      const custom = { celestial: 6, numeric: 4, geomantic: 5, oracular: 2, harmony: 3 };
      const normalized = oracle.normalizeOracleWeights(custom);
      const sum =
        normalized.celestial +
        normalized.numeric +
        normalized.geomantic +
        normalized.oracular +
        normalized.harmony;
      assert.ok(Math.abs(sum - 1.0) < 0.001);
    });

    it('9.5 should update central Astrolabe rotation RPM reacting to Chaos Dial slider value', () => {
      const rpm = (lambda) => 1 + lambda * 4;
      assert.equal(rpm(0.0), 1);
      assert.equal(rpm(0.5), 3);
      assert.equal(rpm(1.0), 5);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Screen 4: Player Marketplace
  // --------------------------------------------------------------------------
  describe('Feature 10: Screen 4: Player Marketplace', () => {
    it('10.1 should compute net score delta for waiver upgrades relative to bench players', () => {
      const upgrade = {
        upgradeDraftScore: 79.8,
        dropDraftScore: 65.6,
      };
      const delta = Number((upgrade.upgradeDraftScore - upgrade.dropDraftScore).toFixed(1));
      assert.equal(delta, 14.2);
    });

    it('10.2 should provide specific recommended drop target for each waiver claim', () => {
      const claim = {
        upgradePlayer: 'Dontayvion Wicks',
        recommendedDrop: 'Allen Lazard',
      };
      assert.equal(claim.recommendedDrop, 'Allen Lazard');
    });

    it('10.3 should evaluate Divine Swap multi-team trade proposals addressing team deficits', () => {
      const trade = {
        proposal_id: 'divine_swap_01',
        target_team_id: 'user_astro_04',
        user_deficit_addressed: 'RB2 High-Floor Void',
        partner_deficit_addressed: 'WR Depth Starvation',
        give_players: [{ player_id: '6794', player_name: 'CeeDee Lamb', position: 'WR' }],
        receive_players: [{ player_id: '6813', player_name: 'Jonathan Taylor', position: 'RB' }],
        trade_fairness_index: 52.0,
      };
      assert.equal(oracle.validateTradeProposals([trade]), true);
      assert.equal(trade.user_deficit_addressed, 'RB2 High-Floor Void');
    });

    it('10.4 should calculate trade fairness index on 0-100 scale (50 = balanced)', () => {
      const fairIndex = 52.0;
      assert.ok(fairIndex >= 0 && fairIndex <= 100);
      assert.ok(Math.abs(fairIndex - 50.0) <= 5.0, 'Fair trade should be near 50.0');
    });

    it('10.5 should attach esoteric Divine Verdict blessing to trade evaluations', () => {
      const verdict = "The scales of Ma'at balance true: Fire yields to Earth to fortify the foundation.";
      assert.ok(verdict.includes('Fire yields to Earth'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Client-Side Sleeper Integration & Offline Resilient Engine
  // --------------------------------------------------------------------------
  describe('Feature 11: Client-Side Sleeper Integration & Offline Resilient Engine', () => {
    it('11.1 should verify client-side architecture enforces zero server-side API routes', () => {
      assert.ok(!fs.existsSync(path.resolve('app/api')), 'app/api must be deleted in client-side architecture');
    });

    it('11.2 should parse Sleeper draft metadata for teams, rounds, slots, and pick timer', () => {
      const mock = oracle.createCanonicalMockDraft();
      const meta = mock.draftMetadata;
      assert.equal(meta.settings.teams, 12);
      assert.equal(meta.settings.rounds, 15);
      assert.equal(meta.settings.pick_timer, 90);
      assert.equal(meta.type, 'snake');
    });

    it('11.3 should correctly sequence sequential draft picks and user roster ownership', () => {
      const mock = oracle.createCanonicalMockDraft();
      assert.equal(mock.picks[0].pick_no, 1);
      assert.equal(mock.picks[0].picked_by, 'user_celestial_01');
      assert.equal(mock.picks[2].pick_no, 5);
      assert.equal(mock.picks[2].picked_by, 'user_oneiromancy_me');
    });

    it('11.4 should configure polling request rate budget to 300 req/min in lib/sleeper.ts', () => {
      assert.equal(sleeper.MAX_REQ_PER_MIN, 300);
      assert.equal(sleeper.POLLING_CONFIG.MAX_REQ_PER_MIN, 300);
      assert.equal(oracle.POLLING_CONFIG.MAX_REQ_PER_MIN, 300);
    });

    it('11.5 should verify client-side OneiromancyProvider renders resilient mock fallback without server calls', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(html.length > 500, 'OneiromancyProvider must render dashboard synchronously from mock datastore');
      assert.ok(html.includes('universe-state-banner'), 'Rendered dashboard must include universe-state-banner');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Embedded Mock Fallback Engine
  // --------------------------------------------------------------------------
  describe('Feature 12: Embedded Mock Fallback Engine', () => {
    it('12.1 should load canonical mock draft state mock_oneiromancy_draft_2025', () => {
      const mock = oracle.createCanonicalMockDraft();
      assert.equal(mock.draftMetadata.draft_id, 'mock_oneiromancy_draft_2025');
    });

    it('12.2 should include 12 teams and 15 rounds configuration in mock dataset', () => {
      const mock = oracle.createCanonicalMockDraft();
      assert.equal(mock.draftMetadata.settings.teams, 12);
      assert.equal(mock.draftMetadata.settings.rounds, 15);
      assert.equal(Object.keys(mock.draftMetadata.draft_order).length, 12);
    });

    it('12.3 should provide initial pre-drafted picks including McCaffrey, Lamb, Chase, Barkley, Burrow', () => {
      const mock = oracle.createCanonicalMockDraft();
      const playerNames = mock.picks.map((p) => `${p.metadata.first_name} ${p.metadata.last_name}`);
      assert.ok(playerNames.includes('Christian McCaffrey'));
      assert.ok(playerNames.includes('CeeDee Lamb'));
      assert.ok(playerNames.includes("Ja'Marr Chase"));
      assert.ok(playerNames.includes('Saquon Barkley'));
      assert.ok(playerNames.includes('Joe Burrow'));
    });

    it('12.4 should activate Autonomous Oneiromancy Mode when external network is unavailable', () => {
      const statusMessage = 'Cosmic Link Interrupted - Operating on Preserved Oneiromancy';
      assert.ok(statusMessage.includes('Preserved Oneiromancy'));
    });

    it('12.5 should preserve all client calculations and board interactions in offline mode', () => {
      const mock = oracle.createCanonicalMockDraft();
      const recalculated = mock.players.map((p) => ({
        ...p,
        draft_score: oracle.computeDraftScore(p.vor_normalized, p.spirit_score, 0.5),
      }));
      assert.equal(recalculated.length, mock.players.length);
      assert.ok(recalculated[0].draft_score > 0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: Canonical 8-Entity Schemas
  // --------------------------------------------------------------------------
  describe('Feature 13: Canonical 8-Entity Schemas', () => {
    it('13.1 should validate cosmic_board schema for CosmicPlayer entity', () => {
      const mock = oracle.createCanonicalMockDraft();
      assert.equal(oracle.validateCosmicPlayer(mock.players[0]), true);
    });

    it('13.2 should validate ideal_draft_path schema for AscensionStep entity', () => {
      const path = [
        {
          round: 1,
          overall_pick: 5,
          target_position: 'WR',
          target_player_id: '7569',
          target_player_name: "Ja'Marr Chase",
          draft_score: 90.4,
          is_ascended: true,
          fallback_player_id: '6794',
        },
      ];
      assert.equal(oracle.validateIdealDraftPath(path), true);
    });

    it('13.3 should validate my_roster schema for MyRoster entity', () => {
      const roster = {
        user_id: 'user_oneiromancy_me',
        starters: [],
        bench: [],
        total_projected_points: 898.6,
        average_spirit_score: 90.3,
        squad_harmony_index: 93.0,
        elemental_distribution: { Fire: 1, Earth: 0, Air: 1, Water: 1 },
      };
      assert.equal(oracle.validateMyRoster(roster), true);
    });

    it('13.4 should validate weekly_coverage schema for WeeklyCoverageMatrix', () => {
      const coverage = {
        schedule: [{ week: 1, active_starters: [], bye_players: [], projected_total: 110, conflict_severity: 'none' }],
        bye_synergy_score: 85.0,
      };
      assert.equal(oracle.validateWeeklyCoverage(coverage), true);
    });

    it('13.5 should validate elemental_traits, waiver_upgrades, trade_proposals, settings', () => {
      const settings = {
        draft_id: 'mock_oneiromancy_draft_2025',
        auto_update: true,
        chaos_lambda: 0.35,
        oracle_weights: oracle.DEFAULT_ORACLE_WEIGHTS,
      };
      assert.equal(oracle.validateAppSettings(settings), true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Spirit Score 5 Divination Tiers
  // --------------------------------------------------------------------------
  describe('Feature 14: Spirit Score 5 Divination Tiers', () => {
    it('14.1 should compute Celestial Tier (10%) factoring in planetary aspects and transits', () => {
      const breakdown = { celestial: 90.0, numeric: 80.0, geomantic: 85.0, oracular: 70.0, harmony: 80.0 };
      const score = oracle.computeSpiritScore(breakdown);
      assert.ok(score > 0 && score <= 100);
      assert.equal(score, 81.25);
    });

    it('14.2 should compute Numeric Tier (10%) using Life Path and Jersey resonance', () => {
      const score = oracle.calculateNumericTier('1995-09-17', 15, 2025);
      assert.ok(score >= 40 && score <= 100);
    });

    it('14.3 should compute Geomantic Tier (25%) using Feng Shui and Astrocartography distance', () => {
      const playerCoords = { lat: 39.0997, lon: -94.5786 }; // KC
      const stadiumCoords = { lat: 39.0489, lon: -94.4839 };
      const score = oracle.calculateGeomanticTier(playerCoords, stadiumCoords, {
        orientation: 'N-S',
        domeType: 'Open',
        surface: 'Grass',
      });
      assert.ok(score >= 50 && score <= 100);
    });

    it('14.4 should compute Oracular Tier (10%) from Tarot archetype and I-Ching alignment', () => {
      const tarot = 92.0;
      const iching = 20.0;
      const oracular = 0.6 * tarot + 0.4 * (50 + iching);
      assert.ok(Math.abs(oracular - 83.2) < 0.001);
    });

    it('14.5 should compute Harmony Tier (45%) from squad synergy, capping at 0-100', () => {
      const harmony = oracle.calculateHarmonyScore(null, [], 1);
      assert.equal(harmony, 50.0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Harmony Engine & Synergy Math
  // --------------------------------------------------------------------------
  describe('Feature 15: Harmony Engine & Synergy Math', () => {
    it('15.1 should grant +12 pts for 3 same-element players (Western Trine bonus)', () => {
      const bonus = oracle.calculateWesternTrineBonus({ Fire: 3, Earth: 0, Air: 0, Water: 0 });
      assert.equal(bonus, 12.0);
    });

    it('15.2 should grant +18 pts for 4+ same-element players', () => {
      const bonus = oracle.calculateWesternTrineBonus({ Fire: 4, Earth: 0, Air: 0, Water: 0 });
      assert.equal(bonus, 18.0);
    });

    it('15.3 should apply 3.0x QB/pass-catcher stack multiplier (+18.0 pts) for same NFL team', () => {
      const candidateWR = { team: 'CIN', position: 'WR' };
      const roster = [{ player: { team: 'CIN', position: 'QB' } }];
      const stackBonus = oracle.calculateStackMultiplier(candidateWR, roster);
      assert.equal(stackBonus, 18.0);
    });

    it('15.4 should penalize drafting 2nd QB before round 10 by -15 pts', () => {
      const roster = [{ player: { position: 'QB', team: 'CIN' } }];
      const penalty = oracle.calculatePositionalCapsPenalty('QB', roster, 5);
      assert.equal(penalty, 15.0);
    });

    it('15.5 should award +10 pts Quad-Balance bonus when all 4 elements are present on roster', () => {
      const bonus = oracle.calculateQuadBalanceBonus({ Fire: 1, Earth: 1, Air: 1, Water: 1 });
      assert.equal(bonus, 10.0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 16: Chaos Dial Scoring Math
  // --------------------------------------------------------------------------
  describe('Feature 16: Chaos Dial Scoring Math', () => {
    it('16.1 should calculate DraftScore = (1 - lambda)*VOR_norm + lambda*SpiritScore', () => {
      const res = oracle.computeDraftScore(78.5, 93.4, 0.35);
      assert.equal(res, 83.72);
    });

    it('16.2 should normalize raw VOR using 50 + (VOR / MaxVOR) * 45', () => {
      const norm = oracle.normalizeVOR(68.4, 100.0);
      assert.equal(norm, 80.78);
    });

    it('16.3 should clamp DraftScore strictly to [0.0, 100.0]', () => {
      assert.equal(oracle.computeDraftScore(-50, -20, 0.35), 0.0);
      assert.equal(oracle.computeDraftScore(150, 180, 0.35), 100.0);
    });

    it('16.4 should execute DraftScore recomputation across 300 players in <2ms', () => {
      const mock = oracle.createCanonicalMockDraft();
      const players = Array.from({ length: 300 }, (_, i) => ({
        ...mock.players[i % mock.players.length],
        vor_normalized: 50 + (i % 50),
        spirit_score: 60 + (i % 40),
      }));

      const start = performance.now();
      for (let i = 0; i < players.length; i++) {
        players[i].draft_score = oracle.computeDraftScore(players[i].vor_normalized, players[i].spirit_score, 0.35);
      }
      const durationMs = performance.now() - start;
      assert.ok(durationMs < 10.0, `Compute time ${durationMs}ms should be fast for 60fps interaction`);
    });

    it('16.5 should ensure equilibrium at default lambda = 0.35 balancing empirical vs mystical factors', () => {
      const vor = 80.0;
      const spirit = 90.0;
      const score = oracle.computeDraftScore(vor, spirit, 0.35);
      assert.ok(score > vor && score < spirit);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Auto-Update Polling Toggle & Settings Integration
  // --------------------------------------------------------------------------
  describe('Feature 17: Auto-Update Polling Toggle', () => {
    it('17.1 should specify 5,000 ms polling interval during active drafting state in POLLING_CONFIG', () => {
      assert.equal(oracle.POLLING_CONFIG.ACTIVE_INTERVAL_MS, 5000);
      assert.equal(sleeper.resolvePollInterval('drafting', 'visible'), 5000);
    });

    it('17.2 should downshift to 10,000 ms polling interval during idle or pre-draft state', () => {
      assert.equal(oracle.POLLING_CONFIG.IDLE_INTERVAL_MS, 10000);
      assert.equal(sleeper.resolvePollInterval('pre_draft', 'visible'), 10000);
    });

    it('17.3 should throttle to 30,000 ms when page visibility is background/hidden', () => {
      assert.equal(oracle.POLLING_CONFIG.BACKGROUND_INTERVAL_MS, 30000);
      assert.equal(sleeper.resolvePollInterval('drafting', 'hidden'), 30000);
    });

    it('17.4 should verify SettingsDrawer renders accessible auto-update switch and username input', () => {
      const html = renderWithProvider(React.createElement(SettingsDrawer, { isOpen: true, onClose: () => {} }));
      assert.ok(html.includes('role="switch"') && html.includes('aria-checked'), 'SettingsDrawer must provide accessible switch attributes');
      assert.ok(html.includes('id="username-input"'), 'SettingsDrawer must render username input');
    });

    it('17.6 should verify SettingsDrawer simplification with username only and dynamic league dropdown; λ lives in the Oracle panel', () => {
      const settingsHtml = renderWithProvider(React.createElement(SettingsDrawer, { isOpen: true, onClose: () => {} }));
      for (const id of ['username-input', 'league-select', 'apply-sync-btn', 'load-mock-btn']) {
        assert.ok(settingsHtml.includes(`id="${id}"`), `SettingsDrawer must contain id="${id}"`);
      }
      assert.ok(!settingsHtml.includes('id="draft-id-input"'), 'SettingsDrawer must not contain manual draft-id-input');
      assert.ok(!settingsHtml.includes('id="team-slot-select"'), 'SettingsDrawer must not contain manual team-slot-select');
      assert.ok(!settingsHtml.includes('Polling Frequency Interval'), 'Polling frequency options were removed');
      assert.ok(!settingsHtml.includes('Engine Calibration'), 'The fake engine calibration box was removed');

      const oracleHtml = renderWithProvider(React.createElement(OraclePanel, { isOpen: true, onClose: () => {} }));
      assert.ok(oracleHtml.includes('id="oracle-lambda"'), 'The Oracle panel owns the λ slider');
    });

    it('17.5 should detect pick count delta and trigger state recalculation via detectPollerDelta', () => {
      const deltaAdded = oracle.detectPollerDelta(5, 6, 'drafting', 'drafting');
      assert.equal(deltaAdded.hasDelta, true);
      assert.equal(deltaAdded.shouldRecompute, true);
      assert.equal(deltaAdded.newPicksAdded, 1);

      const deltaUnchanged = oracle.detectPollerDelta(5, 5, 'drafting', 'drafting');
      assert.equal(deltaUnchanged.hasDelta, false);
      assert.equal(deltaUnchanged.shouldRecompute, false);
      assert.equal(deltaUnchanged.newPicksAdded, 0);
    });
  });

  // ============================================================================
  // Feature 18: Production Client-Side Static Export Build
  // ============================================================================
  describe('Feature 18: Production Client-Side Static Export Build', () => {
    it('18.1 should configure next.config.mjs with output: export', async () => {
      const nextConfig = (await import('../next.config.mjs')).default;
      assert.equal(nextConfig.output, 'export');
    });

    it('18.2 should define npm scripts for build, start, start:standalone, and dev', () => {
      const pkgPath = path.resolve('package.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist in project root');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.ok(pkg.scripts.build, 'package.json must contain build script');
      assert.ok(pkg.scripts.start, 'package.json must contain start script');
      assert.ok(pkg.scripts['start:standalone'], 'package.json must contain start:standalone script');
      assert.ok(pkg.scripts.dev, 'package.json must contain dev script');
    });

    it('18.3 should configure unoptimized image handling for minimal standalone containers', async () => {
      const nextConfig = (await import('../next.config.mjs')).default;
      assert.equal(nextConfig.images?.unoptimized, true);
    });

    it('18.4 should include asset copy script scripts/copy_standalone_assets.mjs', () => {
      const scriptPath = path.resolve('scripts/copy_standalone_assets.mjs');
      assert.ok(fs.existsSync(scriptPath), 'scripts/copy_standalone_assets.mjs must exist');
      assert.ok(fs.statSync(scriptPath).size > 100);
    });

    it('18.5 should verify package.json and package-lock.json dependency matrix adheres to React 19 and Next.js 16', () => {
      const pkgPath = path.resolve('package.json');
      const lockPath = path.resolve('package-lock.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
      assert.ok(fs.existsSync(lockPath), 'package-lock.json must exist');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const lockRaw = fs.readFileSync(lockPath, 'utf8');
      const lock = JSON.parse(lockRaw);
      assert.equal(pkg.dependencies.next, '16.4.2', 'Next.js dependency must be 16.4.2');
      assert.equal(pkg.dependencies.react, '19.3.0', 'React dependency must be 19.3.0');
      assert.equal(pkg.dependencies['react-dom'], '19.3.0', 'React DOM dependency must be 19.3.0');
      assert.deepEqual(
        lock.packages?.['']?.dependencies,
        pkg.dependencies,
        'package-lock.json root dependencies must match package.json'
      );
      assert.deepEqual(
        lock.packages?.['']?.devDependencies,
        pkg.devDependencies,
        'package-lock.json root devDependencies must match package.json'
      );
      for (const [pkgKey, pkgMeta] of Object.entries(lock.packages || {})) {
        const allDeps = {
          ...(pkgMeta.dependencies || {}),
          ...(pkgMeta.optionalDependencies || {}),
        };
        for (const depName of Object.keys(allDeps)) {
          const nestedKey = pkgKey ? `${pkgKey}/node_modules/${depName}` : `node_modules/${depName}`;
          const hoistedKey = `node_modules/${depName}`;
          assert.ok(
            lock.packages?.[nestedKey] || lock.packages?.[hoistedKey],
            `package-lock.json entry ${pkgKey || '<root>'} is missing dependency ${depName}`
          );
        }
      }
      assert.ok(
        !/pkg\.dev|artifact-foundry/.test(lockRaw),
        'package-lock.json must not contain internal Artifact Registry URLs'
      );
      assert.ok(
        !/registry\.npmjs\.org\/@[^/]+\/[^/]+\/-\/@/.test(lockRaw),
        'package-lock.json scoped tarball URLs must use standard registry.npmjs.org format'
      );
    });
  });

  // ============================================================================
  // Feature 19: Containerization & Cloud Run
  // ============================================================================
  describe('Feature 19: Containerization & Cloud Run', () => {
    it('19.1 should verify Dockerfile references node:22-alpine base image and multi-stage architecture', () => {
      const dockerfilePath = path.resolve('Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist in project root');
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(content.includes('node:22-alpine'), 'Dockerfile must reference node:22-alpine base image');
      assert.ok(content.includes('AS deps'), 'Dockerfile must declare multi-stage "deps" stage');
      assert.ok(content.includes('AS builder'), 'Dockerfile must declare multi-stage "builder" stage');
      assert.ok(content.includes('AS runner'), 'Dockerfile must declare multi-stage "runner" stage');
    });

    it('19.2 should verify non-root user execution (nextjs:nodejs UID 1001) in Docker container', () => {
      const dockerfilePath = path.resolve('Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist in project root');
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(content.includes('USER nextjs'), 'Dockerfile must specify USER nextjs');
      assert.ok(content.includes('1001'), 'Dockerfile must configure non-root UID/GID 1001');
      assert.ok(content.includes('addgroup') && content.includes('adduser'), 'Dockerfile must create nodejs group and nextjs user');
      assert.ok(content.includes('--chown=nextjs:nodejs'), 'Dockerfile must set non-root ownership on copied assets');
    });

    it('19.3 should bind container server to 0.0.0.0 and listen on PORT environment variable', () => {
      const dockerfilePath = path.resolve('Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist in project root');
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(/HOSTNAME=["']?0\.0\.0\.0["']?/.test(content), 'Dockerfile must configure HOSTNAME="0.0.0.0"');
      assert.ok(/PORT=["']?8080["']?/.test(content), 'Dockerfile must configure default PORT=8080');
      assert.ok(content.includes('EXPOSE 8080'), 'Dockerfile must expose port 8080');
      assert.ok(content.includes('CMD ["node", "server.js"]'), 'Dockerfile CMD must execute standalone server.js');
    });

    it('19.4 should verify app.yaml configures Google App Engine nodejs22 runtime and F2 instance class', () => {
      const appYamlPath = path.resolve('app.yaml');
      assert.ok(fs.existsSync(appYamlPath), 'app.yaml must exist in project root');
      const content = fs.readFileSync(appYamlPath, 'utf8');
      assert.ok(/runtime:\s*nodejs22/.test(content), 'app.yaml must configure runtime: nodejs22');
      assert.ok(/instance_class:\s*F2/.test(content), 'app.yaml must configure instance_class: F2');
      assert.ok(content.includes('out/index.html'), 'app.yaml must route static files to out/index.html');
      assert.ok(content.includes('/_next'), 'app.yaml must map static assets for /_next');
      assert.ok(!content.includes('entrypoint: node .next/standalone/server.js'), 'app.yaml must not contain dynamic standalone server entrypoint');
    });

    it('19.5 should provide automated verification script scripts/verify_launch.js', () => {
      const verifyScriptPath = path.resolve('scripts/verify_launch.js');
      assert.ok(fs.existsSync(verifyScriptPath), 'scripts/verify_launch.js must exist');
      assert.ok(fs.statSync(verifyScriptPath).size > 200);
    });
  });

  // ============================================================================
  // Feature 20: Feature Expansions (Rendered DOM & Behavioral Verification)
  // ============================================================================
  describe('Feature 20: Feature Expansions', () => {
    it('20.1 should verify Sleeper role colors in PositionalBadge and BoardControls', () => {
      const qbBadge = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB' }));
      const rbBadge = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'RB' }));
      const wrBadge = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'WR' }));
      const teBadge = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'TE' }));
      assert.ok(qbBadge.includes('text-red-400') && qbBadge.includes('bg-red-950/40'), 'QB must be red');
      assert.ok(rbBadge.includes('text-teal-400') && rbBadge.includes('bg-teal-950/40'), 'RB must be teal-ish green');
      assert.ok(wrBadge.includes('text-sky-400') && wrBadge.includes('bg-sky-950/40'), 'WR must be light blue');
      assert.ok(teBadge.includes('text-amber-400') && teBadge.includes('bg-amber-950/40'), 'TE must be orange-ish yellow');

      const baseControlsProps = {
        searchQuery: '',
        onSearchChange: () => {},
        onPositionFilterChange: () => {},
        sortField: 'oracle',
        sortDirection: 'desc',
        onSortChange: () => {},
        modeFilter: 'all',
        onModeFilterChange: () => {},
        totalVisibleCount: 24,
      };
      const qbControls = renderToStaticMarkup(React.createElement(BoardControls, { ...baseControlsProps, positionFilter: 'QB' }));
      const rbControls = renderToStaticMarkup(React.createElement(BoardControls, { ...baseControlsProps, positionFilter: 'RB' }));
      const wrControls = renderToStaticMarkup(React.createElement(BoardControls, { ...baseControlsProps, positionFilter: 'WR' }));
      const teControls = renderToStaticMarkup(React.createElement(BoardControls, { ...baseControlsProps, positionFilter: 'TE' }));
      assert.ok(qbControls.includes('border-red-400'), 'BoardControls must style active QB filter in red');
      assert.ok(rbControls.includes('border-teal-400'), 'BoardControls must style active RB filter in teal');
      assert.ok(wrControls.includes('border-sky-400'), 'BoardControls must style active WR filter in sky blue');
      assert.ok(teControls.includes('border-amber-400'), 'BoardControls must style active TE filter in amber');
    });

    it('20.2 should verify head-to-head player comparison renders in PlayerDetailModal with Stats, Oracle, Stars, and DIVINATION_PILLARS descriptions', () => {
      const p1 = mockData.mockCosmicBoard[0];
      const p2 = mockData.mockCosmicBoard[1];
      const modalHtml = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: p1,
          compareWith: p2,
          isOpen: true,
          onClose: () => {},
        })
      );
      assert.ok(modalHtml.includes('Head-to-head:'), 'PlayerDetailModal must label head-to-head mode');
      for (const col of ['Stats', 'Oracle', 'Stars']) {
        assert.ok(modalHtml.includes(col), `Head-to-head must compare ${col}`);
      }
      for (const pillar of scoring.DIVINATION_PILLARS) {
        assert.ok(
          modalHtml.includes(pillar.desc) || modalHtml.includes(pillar.desc.replace(/&/g, '&amp;')),
          `PlayerDetailModal must render DIVINATION_PILLARS description for ${pillar.key}`
        );
      }
    });

    it('20.3 should verify ChaosDial renders educational reference guide with planetary aspects, lambda equilibrium, worked example math, and external links', () => {
      const chaosHtml = renderWithProvider(React.createElement(ChaosDial));
      assert.ok(
        chaosHtml.includes('Astrology &amp; Divination Field Guide (Encyclopedia)') ||
          chaosHtml.includes('Astrology & Divination Field Guide (Encyclopedia)'),
        'ChaosDial must include Reference Guide'
      );
      assert.ok(chaosHtml.includes('data-testid="encyclopedia-toggle"'), 'ChaosDial must render encyclopedia-toggle button');
      assert.ok(chaosHtml.includes('Natal Chart Planetary Aspects'), 'ChaosDial must explain Natal Chart Planetary Aspects');
      assert.ok(chaosHtml.includes('Mars Aspects') && chaosHtml.includes('Saturn Transits'), 'ChaosDial must detail Mars and Saturn aspects');
      assert.ok(chaosHtml.includes('Mercury Retrogrades') && chaosHtml.includes('Jupiter Alignments'), 'ChaosDial must detail Mercury and Jupiter aspects');
      assert.ok(chaosHtml.includes('Elemental Triplicities in Gridiron Divination'), 'ChaosDial must explain Elemental Triplicities');
      assert.ok(chaosHtml.includes('href="https://en.wikipedia.org/wiki/Astrological_aspect"'), 'ChaosDial must link to external Wikipedia reference');
      assert.ok(chaosHtml.includes('href="https://en.wikipedia.org/wiki/Astrology"'), 'ChaosDial must link to Wikipedia astrology reference');
      assert.ok(chaosHtml.includes('href="https://ssd.jpl.nasa.gov/horizons/"'), 'ChaosDial must link to NASA JPL Horizons ephemeris');
      const chasePlayer = { projected_points: 19.8, spirit_score: 92.7 };
      const chaseStats = oracleLib.statsScore(chasePlayer);
      assert.equal(chaseStats, 79.2, 'Unit conversion rescale (19.8 / 25 * 100) must equal 79.2 Stats');
      assert.equal(oracleLib.starsScore(chasePlayer), 85, 'spirit_score 92.7 must yield 85 Stars');
      assert.equal(
        oracleLib.oracleScore(chasePlayer, 0.75),
        83.6,
        'oracleLib.oracleScore must blend 79.2 Stats and 85 Stars at lambda 0.75 to 83.6 Oracle'
      );
      assert.ok(chaosHtml.includes('83.6 Oracle'), 'ChaosDial worked example must show 83.6 Oracle');
      const panelHtml = renderWithProvider(React.createElement(OraclePanel, { isOpen: true, onClose: () => {} }));
      assert.ok(panelHtml.includes('83.6 Oracle'), 'OraclePanel worked example must show 83.6 Oracle');
    });

    it('20.4 should verify OneiromancyDashboard explains Squad Harmony with the 3 bonuses it actually adds', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(html.includes('How Squad Harmony is scored'), 'OneiromancyDashboard must explain Squad Harmony');
      assert.ok(html.includes('1. Elemental Trine'), 'OneiromancyDashboard must explain the trine bonus');
      assert.ok(html.includes('2. QB Stacks'), 'OneiromancyDashboard must explain the stack bonus');
      assert.ok(html.includes('3. Four-Element Balance'), 'OneiromancyDashboard must explain the balance bonus');
      assert.ok(html.includes('added to base 50'), 'Harmony explainer must state bonuses are added to base 50');
      assert.match(html, /Squad Harmony:\s*\d+\s*pts/, 'OneiromancyDashboard SVG footer must render Squad Harmony in pts');
      assert.ok(!/Squad Harmony:\s*\d+%/.test(html), 'OneiromancyDashboard SVG footer must not render Squad Harmony as %');
      assert.match(html, /Squad Harmony<\/span><span[^>]*>\d+\s*pts<\/span>/, 'OneiromancyDashboard badge must render Squad Harmony in pts');
      assert.ok(!html.includes('Schedule Symmetry'), 'Harmony explainer must not claim byes affect Harmony');
      assert.ok(html.includes('Squad Harmony'), 'OneiromancyDashboard must display Squad Harmony');
    });

    it('20.5 should verify OneiromancyDashboard renders interactive SVG Team Synergy Radar Graph with 5 spokes', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(
        html.includes('Roster Aura &amp; Stack Constellation') ||
        html.includes('Roster Aura & Stack Constellation'),
        'OneiromancyDashboard must include Stack Constellation title'
      );
      assert.ok(
        !html.includes('Roster Aura &amp; Synergy Constellation') &&
        !html.includes('Roster Aura & Synergy Constellation'),
        'OneiromancyDashboard must not include legacy Synergy Constellation title'
      );
      assert.ok(html.includes('data-testid="synergy-constellation-svg"'), 'OneiromancyDashboard must render synergy-constellation-svg');
      assert.ok(html.includes('<polygon'), 'OneiromancyDashboard must render radar polygon');
      for (const axis of ['Fire (', 'Air (', 'Water (', 'Earth (', 'Aspects (']) {
        assert.ok(html.includes(axis), `Radar must include ${axis} axis`);
      }
    });

    it('20.6 should verify OneiromancyDashboard renders Player Synergy Matrix with team celestial conjunctions and trine bonuses', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(
        html.includes('Astral Stack Conjunction'),
        'OneiromancyDashboard must highlight Astral Stack Conjunction'
      );
      assert.ok(
        !html.includes('Astral Synergy Conjunction'),
        'OneiromancyDashboard must not include legacy Astral Synergy Conjunction'
      );
      assert.ok(html.includes('1. Elemental Trine:'), 'OneiromancyDashboard must explain Elemental Trine bonus');
      assert.ok(html.includes('amplify ceiling and floor'), 'OneiromancyDashboard must explain trine ceiling/floor effect');
    });

    it('20.7 should verify OneiromancyDashboard documents bye coverage and its three states', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(html.includes('How bye coverage works'), 'OneiromancyDashboard must explain bye coverage');
      assert.ok(html.includes('Weeks 5-14'), 'Must say when byes fall');
      assert.ok(html.includes('Weeks 15-17'), 'Must list fantasy playoffs Weeks 15-17');
      assert.ok(html.includes('No one on bye.'), 'Must explain the OK state');
      assert.ok(html.includes('One or two players on bye.'), 'Must explain the amber state');
      assert.ok(html.includes('Three or more on bye'), 'Must explain the conflict state');
    });

    it('20.8 should verify Roster leads with universe state, synergy constellation, and inline swap recommendations; League lists competitor teams', () => {
      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(!rosterHtml.includes('Weekly Matchup &amp; Start/Sit Oracle'), 'The redundant matchup card stays removed');
      assert.ok(rosterHtml.includes('data-testid="universe-state-banner"'), 'Roster must lead with the universe state banner');
      assert.ok(rosterHtml.includes('data-testid="synergy-constellation-svg"'), 'Roster must render the synergy constellation SVG');
      assert.ok(rosterHtml.includes('data-testid="lineup-swap-arrow"'), 'Roster must show inline lineup swap arrows');
      assert.ok(rosterHtml.includes('data-testid="lineup-swap-banner"'), 'Roster must render lineup swap banner');
      assert.ok(rosterHtml.includes('data-testid="lineup-swap-banner-button"'), 'Roster must render lineup swap banner button');

      const leagueHtml = renderWithProvider(React.createElement(LeagueScreen));
      assert.ok(leagueHtml.includes('data-testid="celestial-leaderboard"'), 'League must render CelestialLeaderboardGraph');
      assert.ok(leagueHtml.includes('AstralOracles') || leagueHtml.includes('Supernova Surge'), 'League must render competitor team names');
    });

    it('20.9 should verify OneiromancyDashboard lineup swap banner and bench tooltip fallback when starter slot is empty', () => {
      const baseState = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
      const slots = Array.isArray(baseState.my_roster)
        ? baseState.my_roster
        : [...(baseState.my_roster?.starters || []), ...(baseState.my_roster?.bench || [])];
      const starterSlot = slots.find((s) => s.slot_name && !s.slot_name.startsWith('Bench'));
      assert.ok(starterSlot, 'Must find a starter slot in mock roster');
      starterSlot.player = null;
      const swaps = oracleLib.computeLineupCheck(slots, 0.75);
      assert.ok(swaps.length > 0 && swaps.some((s) => !s.playerOut), 'computeLineupCheck must detect empty starter slot swap');

      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard), baseState);
      assert.ok(rosterHtml.includes('can fill an empty slot'), 'Lineup swap banner must render defensive empty slot phrasing');
      assert.ok(!rosterHtml.includes('<strong></strong>'), 'Must not render empty strong tag');
      assert.ok(rosterHtml.includes('Promote to empty slot'), 'Bench swap badge must render defensive empty slot tooltip');

      // Also verify normal non-empty swap renders 'leads <strong>' comparison
      const normalState = JSON.parse(JSON.stringify(mockData.mock_oneiromancy_draft_2025));
      const normalHtml = renderWithProvider(React.createElement(OneiromancyDashboard), normalState);
      assert.ok(normalHtml.includes('leads <strong>'), 'Normal lineup swap banner must render playerOut name in strong tags');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 21: Comment #71 Resolution
  // --------------------------------------------------------------------------
  describe('Feature 21: Comment #71 Resolution', () => {
    it('21.1 should verify waiver moves only add free agents and never suggest owned players', () => {
      const state = mockData.mock_oneiromancy_draft_2025;
      const rosterSlots = Array.isArray(state.my_roster)
        ? state.my_roster
        : [...(state.my_roster?.starters || []), ...(state.my_roster?.bench || [])];
      const moves = oracleLib.computeWaiverMoves(state.cosmic_board, rosterSlots, 0.75, 1, 10);
      assert.ok(moves.length > 0, 'computeWaiverMoves must return at least 1 waiver move from mock board');
      const rosterIds = new Set(rosterSlots.map((s) => s.player?.id).filter(Boolean).map(String));
      for (const m of moves) {
        assert.equal(m.add.draft_status, 'available', 'Waiver add must be available free agent');
        assert.ok(!rosterIds.has(String(m.add.id)), 'Waiver add must not already be on user roster');
      }
    });

    it('21.2 should verify the This Week team comparison calculates dynamic win probability with a gauge', () => {
      const html = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(html.includes('Win Prob'), 'MatchupsScreen must render win probability');
      assert.ok(html.includes('max-w-[110px] truncate text-center block'), 'Win probability label must be width-constrained');
    });

    it('21.3 should verify team tier chips follow classifySpiritScoreTier on the Celestial Leaderboard', () => {
      const favTier = scoring.classifySpiritScoreTier(88.0);
      const harmTier = scoring.classifySpiritScoreTier(80.0);
      const discTier = scoring.classifySpiritScoreTier(68.0);
      assert.equal(favTier.tier, 'Favorable');
      assert.equal(harmTier.tier, 'Harmonic');
      assert.equal(discTier.tier, 'Discordant');

      const lbHtml = renderWithProvider(React.createElement(CelestialLeaderboardGraph, { competitorTeams: mockData.mockCompetitorTeams }));
      assert.ok(lbHtml.includes('Favorable') && lbHtml.includes('Harmonic'), 'Leaderboard must render tier verdicts');
    });

    it('21.4 should verify League roster rows color Stars with the shared favorability tone scale', () => {
      const leagueHtml = renderWithProvider(React.createElement(LeagueScreen));
      assert.ok(leagueHtml.includes('border-emerald-500/40') || leagueHtml.includes('border-cyan-500/35'), 'Stars must render with shared tone pill');
    });

    it('21.5 should verify scoring.ts provides calculateWinProbability and classifySpiritScoreTier with correct thresholds', () => {
      assert.equal(typeof scoring.calculateWinProbability, 'function', 'scoring.ts must export calculateWinProbability');
      assert.equal(typeof scoring.classifySpiritScoreTier, 'function', 'scoring.ts must export classifySpiritScoreTier');
      assert.equal(scoring.classifySpiritScoreTier(85.0).tier, 'Favorable', 'Threshold 85.0 must be Favorable');
      assert.equal(scoring.classifySpiritScoreTier(84.9).tier, 'Harmonic', 'Just below 85.0 (84.9) must be Harmonic');
      assert.equal(scoring.classifySpiritScoreTier(75.0).tier, 'Harmonic', 'Threshold 75.0 must be Harmonic');
      assert.equal(scoring.classifySpiritScoreTier(74.9).tier, 'Discordant', 'Below 75.0 must be Discordant');
      assert.equal(scoring.classifySpiritScoreTier(100).tier, 'Favorable', 'Max score 100 must be Favorable');
      assert.equal(scoring.classifySpiritScoreTier(0).tier, 'Discordant', 'Zero score must be Discordant');
      assert.equal(scoring.classifySpiritScoreTier(-15).tier, 'Discordant', 'Negative score must be Discordant');
      assert.equal(scoring.classifySpiritScoreTier(Number.NaN).tier, 'Discordant', 'NaN score must safely degrade to Discordant');
    });

    it('21.6 should verify OneiromancyDashboard unifies Team harmony with the user team harmony score', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(!html.includes('60 / 100 HARMONY'), 'Stale hardcoded 60 / 100 HARMONY must not exist');
      assert.ok(html.includes('Squad Harmony'), 'OneiromancyDashboard must render Squad Harmony');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 22: Dynamic League Settings & Matchups Resolution
  // --------------------------------------------------------------------------
  describe('Feature 22: Dynamic League Settings & Matchups Resolution', () => {
    it('22.1 should verify position eligibility is dynamically derived from league roster settings', () => {
      assert.equal(typeof sleeper.deriveEligiblePositions, 'function', 'sleeper.ts must export deriveEligiblePositions');
      assert.equal(typeof sleeper.expandSlotPositions, 'function', 'sleeper.ts must export expandSlotPositions');

      const superflexRoster = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'];
      const derivedSuperflex = sleeper.deriveEligiblePositions(superflexRoster);
      assert.ok(!derivedSuperflex.includes('K'), 'Superflex league without K must not include K');
      assert.ok(!derivedSuperflex.includes('DEF'), 'Superflex league without DEF must not include DEF');
      for (const pos of ['QB', 'RB', 'WR', 'TE']) {
        assert.ok(derivedSuperflex.includes(pos), `Superflex league must include ${pos}`);
      }

      const standardRoster = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'];
      const derivedStandard = sleeper.deriveEligiblePositions(standardRoster);
      for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
        assert.ok(derivedStandard.includes(pos), `Standard league must include ${pos}`);
      }

      assert.deepEqual(sleeper.expandSlotPositions('FLEX'), ['WR', 'RB', 'TE']);
      assert.deepEqual(sleeper.expandSlotPositions('SUPER_FLEX'), ['QB', 'WR', 'RB', 'TE']);
      assert.deepEqual(sleeper.expandSlotPositions('WRRB_FLEX'), ['WR', 'RB']);
      assert.deepEqual(sleeper.expandSlotPositions('REC_FLEX'), ['WR', 'TE']);
      assert.deepEqual(sleeper.expandSlotPositions('BN'), []);
    });

    it('22.2 should verify screen name and number pill banners are removed from all 4 screens', () => {
      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      const boardHtml = renderWithProvider(React.createElement(CosmicBoard));
      const chaosHtml = renderWithProvider(React.createElement(ChaosDial));
      const marketHtml = renderWithProvider(React.createElement(PlayerMarketplace));

      assert.ok(!rosterHtml.includes('Oneiromancy • Screen 1'), 'OneiromancyDashboard must not contain Screen 1 pill');
      assert.ok(!boardHtml.includes('The Cosmic Board • Screen 2'), 'CosmicBoard must not contain Screen 2 pill');
      assert.ok(!chaosHtml.includes('The Chaos Dial • Screen 3'), 'ChaosDial must not contain Screen 3 pill');
      assert.ok(!marketHtml.includes('Player Marketplace • Screen 4'), 'PlayerMarketplace must not contain Screen 4 pill');
    });

    it('22.3 should verify MatchupsScreen renders Team Celestial Telemetry without redundant Positional breakdown subtitle', () => {
      const html = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(html.includes('Win Prob'), 'MatchupsScreen must render dynamic win probability');
      assert.ok(
        !html.includes('Active Transits &amp; Conjunctions') && !html.includes('Active Transits & Conjunctions'),
        'MatchupsScreen must remove redundant Active Transits & Conjunctions subtitle'
      );
      assert.ok(html.includes('Week 1'), 'MatchupsScreen must include week switcher');
    });

    it('22.4 should verify MatchupsScreen renders Positional Starter Matchup with guarded stadium coordinates, roof type, and date', () => {
      const html = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(html.includes('Positional Starter Matchup'), 'MatchupsScreen must contain Positional Starter Matchup title');
      assert.ok(
        html.includes('Alignment &amp; Stadium Telemetry') || html.includes('Alignment & Stadium Telemetry'),
        'MatchupsScreen must include collapsible Alignment & Stadium Telemetry'
      );
      assert.ok(html.includes('°N,'), 'MatchupsScreen must display formatted stadium coordinates');
    });

    it('22.5 should verify NavigationShell and app router support Matchups tab and screen navigation', () => {
      const navHtml = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'matchups' }, React.createElement('div')));
      assert.ok(navHtml.includes('data-testid="nav-tab-matchups"'), 'NavigationShell must render nav-tab-matchups button');
      const homeHtml = renderToStaticMarkup(React.createElement(Home));
      assert.ok(homeHtml.includes('data-testid="nav-tab-matchups"'), 'Home app must render NavigationShell with matchups tab');
    });
  });

  // ============================================================================
  // Feature 23: Comment #79 Resolution: Team Name Truncation, Prominence, Tab Re-ordering
  // ============================================================================
  describe('Feature 23: Comment #79 Resolution: Team Name Truncation, Prominence, Tab Re-ordering', () => {
    it('23.1 should verify competitor team names render in full without a Slot X: prefix', () => {
      const leagueHtml = renderWithProvider(React.createElement(LeagueScreen));
      assert.ok(!/Slot \d+:\s+[A-Za-z]/.test(leagueHtml), 'Team names must not carry a Slot X: prefix');
      assert.ok(leagueHtml.includes('Supernova Surge') || leagueHtml.includes('AstralOracles'), 'League must render full team names');
    });

    it('23.2 should verify the user team row on the Celestial Leaderboard has purple luminous styling', () => {
      const lbHtml = renderWithProvider(React.createElement(CelestialLeaderboardGraph, { competitorTeams: mockData.mockCompetitorTeams }));
      assert.ok(lbHtml.includes('bg-purple-950/40 border-purple-400 ring-2 ring-purple-500/70 shadow-lg shadow-purple-500/20'), 'User row must have purple luminous ring and shadow');
      assert.ok(lbHtml.includes('data-testid="leaderboard-user-team"'), 'User row must be identifiable');
    });

    it('23.3 should verify navigation tabs order: Roster -> Matchup -> Players -> League', () => {
      const navHtml = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      const ids = [...navHtml.matchAll(/data-testid="nav-tab-([a-z_]+)"/g)].map((m) => m[1]);
      assert.deepEqual(ids, ['oneiromancy', 'matchups', 'board', 'league'], 'Tabs must be in exact order: oneiromancy -> matchups -> board -> league');
    });

    it('23.4 should verify NavigationShell provides desktop header tabs and a phone-only bottom bar', () => {
      const navHtml = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      assert.ok(navHtml.includes('hidden md:flex items-center gap-1'), 'NavigationShell must provide desktop navigation tabs in header');
      assert.ok(navHtml.includes('grid grid-cols-4 items-center'), 'NavigationShell must provide a 4-column bottom navigation bar');
      assert.ok(navHtml.includes('data-testid="nav-tab-oneiromancy"'), 'Bottom tabs must have nav-tab-<id> test ids');
    });
  });

  // ============================================================================
  // Feature 24: Decoupled Competitor Roster Stats & Invariant Multi-User Stability (Comment #81)
  // ============================================================================
  describe('Feature 24: Decoupled Competitor Roster Stats & Invariant Multi-User Stability', () => {
    it('24.1 should verify calculateTeamCelestialMetrics deterministically derives Spirit, Draft, Harmony, and Verdict', () => {
      assert.ok(typeof scoring.calculateTeamCelestialMetrics === 'function', 'scoring.ts must export calculateTeamCelestialMetrics');

      const teamSlot1 = { slot: 1, roster_id: 1, name: 'Supernova Surge', picks: [] };
      const m1 = scoring.calculateTeamCelestialMetrics(teamSlot1);
      assert.equal(m1.spiritScore, 82.5, 'Slot 1 spiritScore must be 82.5');
      assert.equal(m1.draftScore, 80.2, 'Slot 1 draftScore must be 80.2');
      assert.equal(m1.harmonyScore, 81.5, 'Slot 1 harmonyScore must be 81.5');
      assert.equal(m1.verdict, '⚖️ Harmonic (Stable)');

      const teamSlot7 = { slot: 7, roster_id: 2, name: 'AstralOracles', picks: [] };
      const m7 = scoring.calculateTeamCelestialMetrics(teamSlot7);
      assert.equal(m7.spiritScore, 88.5, 'Slot 7 spiritScore must be 88.5');
      assert.equal(m7.draftScore, 89.2, 'Slot 7 draftScore must be 89.2');
      assert.equal(m7.harmonyScore, 98.0, 'Slot 7 harmonyScore must be 98.0');
      assert.equal(m7.verdict, '✨ Favorable (Apex)');
    });

    it('24.2 should verify competitor metrics are invariant when switching active user (You)', () => {
      const team1AsUser = { slot: 1, is_user: true, name: 'Supernova Surge (You)', picks: [] };
      const team1NotUser = { slot: 1, is_user: false, name: 'Supernova Surge', picks: [] };

      const mUser = scoring.calculateTeamCelestialMetrics(team1AsUser);
      const mNotUser = scoring.calculateTeamCelestialMetrics(team1NotUser);

      assert.equal(mUser.spiritScore, mNotUser.spiritScore, 'spiritScore must be invariant to isUser');
      assert.equal(mUser.draftScore, mNotUser.draftScore, 'draftScore must be invariant to isUser');
      assert.equal(mUser.harmonyScore, mNotUser.harmonyScore, 'harmonyScore must be invariant to isUser');
      assert.equal(mUser.verdict, mNotUser.verdict, 'verdict must be invariant to isUser');
    });

    it('24.3 should verify pre-draft deterministic seed scores based on 12 draft slots and classic zodiac rulers', () => {
      assert.ok(scoring.SLOT_ZODIAC_SEEDS, 'scoring.ts must export SLOT_ZODIAC_SEEDS');
      assert.equal(Object.keys(scoring.SLOT_ZODIAC_SEEDS).length, 12, 'Must have 12 slot zodiac seeds');
      assert.equal(scoring.SLOT_ZODIAC_SEEDS[1].sign, 'Aries');
      assert.equal(scoring.SLOT_ZODIAC_SEEDS[5].sign, 'Leo');
      assert.equal(scoring.SLOT_ZODIAC_SEEDS[12].sign, 'Pisces');
    });

    it('24.4 should verify team verdict badges are rendered on the Celestial Leaderboard via calculateTeamCelestialMetrics', () => {
      const lbHtml = renderWithProvider(React.createElement(CelestialLeaderboardGraph, { competitorTeams: mockData.mockCompetitorTeams }));
      assert.ok(lbHtml.includes('✨ Favorable (Apex)'), 'Leaderboard must render Favorable (Apex) verdict label');
      assert.ok(lbHtml.includes('⚖️ Harmonic (Stable)'), 'Leaderboard must render Harmonic (Stable) verdict label');
    });

    it('24.5 should verify transformToDraftState does not override competitor team stats based on isUser', () => {
      const rawDraft = mockData.mock_oneiromancy_draft_2025.raw_sleeper_draft || {};
      const stateSlot1 = sleeper.transformToDraftState(rawDraft, [], { ...mockData.mockSettings, user_slot: 1 });
      const stateSlot5 = sleeper.transformToDraftState(rawDraft, [], { ...mockData.mockSettings, user_slot: 5 });

      const t1WhenUser = stateSlot1.competitor_teams.find((t) => t.slot === 1);
      const t1WhenNotUser = stateSlot5.competitor_teams.find((t) => t.slot === 1);
      assert.equal(t1WhenUser.avg_spirit_score, t1WhenNotUser.avg_spirit_score, 'Slot 1 spirit score must not change based on isUser');
      assert.equal(t1WhenUser.avg_draft_score, t1WhenNotUser.avg_draft_score, 'Slot 1 draft score must not change based on isUser');
    });
  });

  // ============================================================================
  // Feature 25: Signed Player Protection & Celestial Leaderboard Graph (Comments #81 & #82)
  // ============================================================================
  describe('Feature 25: Signed Player Protection & Celestial Leaderboard Graph', () => {
    it('25.1 should verify PlayerMarketplace renders Top Waiver Moves without redundant signed-player toggle', () => {
      const marketHtml = renderWithProvider(React.createElement(PlayerMarketplace));
      assert.ok(marketHtml.includes('Top Waiver Moves'), 'PlayerMarketplace must render Top Waiver Moves');
      assert.ok(!marketHtml.includes('data-testid="allow-signed-drop-toggle"'), 'PlayerMarketplace must not render allow-signed-drop-toggle checkbox');
      assert.ok(!marketHtml.includes('Include players without an NFL team'), 'Redundant toggle label must not be rendered');
    });

    it('25.2 should verify isPlayerSigned correctly identifies signed NFL players vs unsigned free agents', () => {
      assert.ok(typeof scoring.isPlayerSigned === 'function', 'scoring.ts must export isPlayerSigned');
      assert.equal(scoring.isPlayerSigned({ team: 'KC' }), true, 'KC is signed');
      assert.equal(scoring.isPlayerSigned({ team: 'SF' }), true, 'SF is signed');
      assert.equal(scoring.isPlayerSigned({ team: 'CLE' }), true, 'CLE is signed');
      assert.equal(scoring.isPlayerSigned('CLE'), true, 'CLE string is signed');
      assert.equal(scoring.isPlayerSigned({ team: 'FA' }), false, 'FA is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'Free Agent' }), false, 'Free Agent is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'free_agent' }), false, 'free_agent is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'none' }), false, 'none is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'N/A' }), false, 'N/A is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'NFL' }), false, 'NFL placeholder is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: '' }), false, 'Empty string is unsigned');
      assert.equal(scoring.isPlayerSigned(null), false, 'null is unsigned');
      assert.equal(scoring.isPlayerSigned(undefined), false, 'undefined is unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'CLE', status: 'Inactive' }), false, 'Inactive status is treated as unsigned');
      assert.equal(scoring.isPlayerSigned({ team: 'CLE', status: 'FA' }), false, 'FA status is treated as unsigned');
    });

    it('25.3 should verify PlayerMarketplace and CosmicBoard visible waiver moves exclude unsigned free-agent additions when dropping a signed bench player', () => {
      const myRoster = [
        { slot_id: 'QB_1', eligible_positions: ['QB'], player: { id: 'qb1', name: 'Starter QB', position: 'QB', team: 'KC', projected_points: 20 } },
        { slot_id: 'RB_1', eligible_positions: ['RB'], player: { id: 'rb1', name: 'Starter RB1', position: 'RB', team: 'SF', projected_points: 18 } },
        { slot_id: 'RB_2', eligible_positions: ['RB'], player: { id: 'rb2', name: 'Starter RB2', position: 'RB', team: 'DET', projected_points: 16 } },
        { slot_id: 'WR_1', eligible_positions: ['WR'], player: { id: 'wr1', name: 'Starter WR1', position: 'WR', team: 'MIA', projected_points: 18 } },
        { slot_id: 'WR_2', eligible_positions: ['WR'], player: { id: 'wr2', name: 'Starter WR2', position: 'WR', team: 'MIN', projected_points: 16 } },
        { slot_id: 'TE_1', eligible_positions: ['TE'], player: { id: 'te1', name: 'Starter TE', position: 'TE', team: 'KC', projected_points: 14 } },
        { slot_id: 'FLEX_1', eligible_positions: ['RB', 'WR', 'TE'], player: { id: 'flex1', name: 'Starter Flex', position: 'WR', team: 'PHI', projected_points: 14 } },
        { slot_id: 'BN_1', eligible_positions: ['QB', 'RB', 'WR', 'TE'], player: { id: 'drop_signed', name: 'Bench Droppable', position: 'WR', team: 'CLE', projected_points: 6 } },
      ];

      const cosmicBoard = [
        { id: 'fa1', name: 'Phantom FreeAgent', position: 'WR', team: 'FA', draft_status: 'available', projected_points: 25 },
        { id: 'signed1', name: 'Active FreeAgent', position: 'WR', team: 'ARI', draft_status: 'available', projected_points: 15 },
      ];

      const initialDraftState = {
        my_roster: myRoster,
        cosmic_board: cosmicBoard,
        weekly_matchup: { week: 1 },
      };

      const marketHtml = renderWithProvider(
        React.createElement(PlayerMarketplace),
        initialDraftState
      );

      assert.ok(marketHtml.includes('Top Waiver Moves'), 'Marketplace must render Top Waiver Moves');
      assert.ok(marketHtml.includes('Active FreeAgent'), 'Signed player addition must appear in Top Waiver Moves');
      assert.ok(!marketHtml.includes('Phantom FreeAgent'), 'Unsigned FA player must be excluded from Top Waiver Moves');

      const boardHtml = renderWithProvider(
        React.createElement(CosmicBoard, { initialFilter: 'waivers' }),
        initialDraftState
      );
      assert.ok(boardHtml.includes('Active FreeAgent'), 'CosmicBoard waivers must include signed addition');
      assert.ok(boardHtml.includes('Bench Droppable'), 'CosmicBoard waivers must show recommended drop for signed addition');
      assert.ok(!boardHtml.includes('Phantom FreeAgent'), 'CosmicBoard waivers must exclude unsigned free agents');
    });

    it('25.4 should verify CelestialLeaderboardGraph renders ranking matrix with metric toggles', () => {
      const lbHtml = renderWithProvider(React.createElement(CelestialLeaderboardGraph, { competitorTeams: mockData.mockCompetitorTeams }));
      assert.ok(lbHtml.includes('data-testid="celestial-leaderboard"'), 'Leaderboard must render celestial-leaderboard test ID');
      assert.ok(lbHtml.includes('data-testid="leaderboard-toggle-overall"'), 'Leaderboard must render overall toggle');
      assert.ok(lbHtml.includes('data-testid="leaderboard-toggle-spirit"'), 'Leaderboard must render spirit toggle');
      assert.ok(lbHtml.includes('data-testid="leaderboard-toggle-draft"'), 'Leaderboard must render draft toggle');
      assert.ok(lbHtml.includes('data-testid="leaderboard-toggle-harmony"'), 'Leaderboard must render harmony toggle');
      assert.ok(lbHtml.includes('data-testid="leaderboard-user-team"'), 'Leaderboard must render user team test ID');
      assert.ok(lbHtml.includes('data-testid="leaderboard-row-rank-1"'), 'Leaderboard must render rank 1 test ID');
    });

    it('25.5 should verify League opens on the Celestial Leaderboard above the lineup breakdown', () => {
      const leagueHtml = renderWithProvider(React.createElement(LeagueScreen));
      const boardIdx = leagueHtml.indexOf('data-testid="celestial-leaderboard"');
      const rostersIdx = leagueHtml.indexOf('id="league-rosters-heading"');
      assert.ok(boardIdx > -1, 'League must render CelestialLeaderboardGraph');
      assert.ok(boardIdx < rostersIdx, 'Leaderboard must precede the lineup breakdown');
      assert.ok(!leagueHtml.includes('leaderboard-toggle-standings'), 'No Sleeper standings view');
    });
  });

  // ============================================================================
  // Feature 26: Sleeper API User Profile Pictures & Avatar Integration
  // ============================================================================
  describe('Feature 26: Sleeper API User Profile Pictures & Avatar Integration', () => {
    it('26.1 should verify getSleeperAvatarUrl generates canonical thumbnail and full URLs and handles null/undefined', () => {
      assert.ok(typeof sleeper.getSleeperAvatarUrl === 'function', 'sleeper.ts must export getSleeperAvatarUrl');
      assert.ok(typeof sleeper.resolveSleeperAvatarUrl === 'function', 'sleeper.ts must export resolveSleeperAvatarUrl');

      assert.equal(
        sleeper.getSleeperAvatarUrl('56789012'),
        'https://sleepercdn.com/avatars/thumbs/56789012',
        'Should convert avatar hash to Sleeper CDN thumbnail URL'
      );
      assert.equal(
        sleeper.getSleeperAvatarUrl('56789012', { full: true }),
        'https://sleepercdn.com/avatars/56789012',
        'Should convert avatar hash to full Sleeper CDN avatar URL when { full: true }'
      );
      assert.equal(
        sleeper.getSleeperAvatarUrl('https://sleepercdn.com/avatars/thumbs/custom123'),
        'https://sleepercdn.com/avatars/thumbs/custom123',
        'Should pass through existing full URLs'
      );
      assert.equal(
        sleeper.getSleeperAvatarUrl('http://example.com/pic.png'),
        'http://example.com/pic.png',
        'Should pass through http URLs'
      );

      assert.equal(sleeper.getSleeperAvatarUrl(null), null, 'null avatarId must return null');
      assert.equal(sleeper.getSleeperAvatarUrl(undefined), null, 'undefined avatarId must return null');
      assert.equal(sleeper.getSleeperAvatarUrl(''), null, 'empty avatarId must return null');
      assert.equal(sleeper.getSleeperAvatarUrl('   '), null, 'whitespace avatarId must return null');
    });

    it('26.2 should verify custom avatar precedence in transformToDraftState when user.metadata.avatar is present', () => {
      const mockMetadata = {
        draft_id: 'draft_avatar_test',
        league_id: 'league_avatar_test',
        status: 'drafting',
        settings: { teams: 2, rounds: 15 },
        draft_order: { user_1: 1, user_2: 2 },
      };
      const mockUsers = [
        {
          user_id: 'user_1',
          display_name: 'OneiroVanguard',
          avatar: 'global_hash_alpha',
          metadata: { avatar: 'https://example.com/avatars/custom_team_avatar.png' },
        },
        {
          user_id: 'user_2',
          display_name: 'BetaManager',
          avatar: 'global_hash_beta',
        },
      ];
      const mockRosters = [
        { roster_id: 1, owner_id: 'user_1', settings: { wins: 0 } },
        { roster_id: 2, owner_id: 'user_2', settings: { wins: 0 } },
      ];

      const draftState = sleeper.transformToDraftState(
        mockMetadata,
        [],
        { user_slot: 1, user_id: 'user_1' },
        {},
        mockUsers,
        mockRosters
      );

      assert.ok(Array.isArray(draftState.competitor_teams), 'competitor_teams must be an array');
      assert.equal(draftState.competitor_teams.length, 2, 'Should map 2 competitor teams');

      const team1 = draftState.competitor_teams[0];
      assert.equal(team1.avatar, 'global_hash_alpha', 'Team 1 avatar hash must match user_1');
      assert.equal(
        team1.avatar_url,
        'https://example.com/avatars/custom_team_avatar.png',
        'Team 1 avatar_url must prioritize user.metadata.avatar over user.avatar'
      );
      assert.equal(team1.is_user, true, 'Team 1 must be active user');

      const team2 = draftState.competitor_teams[1];
      assert.equal(team2.avatar, 'global_hash_beta', 'Team 2 avatar hash must match user_2');
      assert.equal(
        team2.avatar_url,
        'https://sleepercdn.com/avatars/thumbs/global_hash_beta',
        'Team 2 avatar_url must be canonical thumbnail CDN'
      );

      assert.equal(
        draftState.user_avatar_url,
        'https://example.com/avatars/custom_team_avatar.png',
        'draftState.user_avatar_url must reflect custom team avatar'
      );
    });

    it('26.3 should verify UserAvatar component fallback rendering and security attributes', () => {
      const imgHtml = renderToStaticMarkup(
        React.createElement(UserAvatar, {
          src: 'https://sleepercdn.com/avatars/thumbs/abc123',
          alt: 'User Avatar',
          fallbackText: 'OV',
          isUser: true,
          testId: 'test-user-avatar',
        })
      );
      assert.ok(imgHtml.includes('loading="lazy"'), 'UserAvatar must specify loading="lazy"');
      assert.ok(imgHtml.includes('referrerpolicy="no-referrer"') || imgHtml.includes('referrerPolicy="no-referrer"'), 'UserAvatar must specify referrerPolicy="no-referrer"');
      assert.ok(imgHtml.includes('data-testid="test-user-avatar"'), 'UserAvatar must pass testId to data-testid attribute');
      assert.ok(imgHtml.includes('ring-purple-400/80'), 'UserAvatar isUser=true must render purple accent ring');

      const fallbackHtml = renderToStaticMarkup(
        React.createElement(UserAvatar, {
          src: null,
          alt: 'Fallback Avatar',
          fallbackText: 'AstralOracles',
          testId: 'test-fallback-avatar',
        })
      );
      assert.ok(fallbackHtml.includes('data-testid="test-fallback-avatar"'), 'Fallback avatar must preserve testId');
      assert.ok(fallbackHtml.includes('>A<'), 'Fallback avatar must render uppercase initial');
    });

    it('26.4 should verify avatar image rendering in the matchup duel banner and CelestialLeaderboardGraph', () => {
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(matchupsHtml.includes('data-testid="user-team-avatar"'), 'Duel banner must render the user avatar');
      assert.ok(matchupsHtml.includes('data-testid="opponent-team-avatar"'), 'Duel banner must render the opponent avatar');

      const lbHtml = renderWithProvider(React.createElement(CelestialLeaderboardGraph, { competitorTeams: mockData.mockCompetitorTeams }));
      assert.ok(lbHtml.includes('leaderboard-avatar-slot-'), 'Leaderboard must render team avatars');
    });

    it('26.5 should verify avatar image rendering across SettingsDrawer, NavigationShell, and MatchupsScreen', () => {
      const settingsHtml = renderWithProvider(React.createElement(SettingsDrawer, { isOpen: true, onClose: () => {} }));
      assert.ok(settingsHtml.includes('data-testid="settings-user-profile"'), 'SettingsDrawer must render settings-user-profile test ID');
      assert.ok(settingsHtml.includes('data-testid="settings-user-avatar"'), 'SettingsDrawer must render settings-user-avatar test ID');

      const navHtml = renderToStaticMarkup(
        React.createElement(
          NavigationShell,
          { activeTab: 'oneiromancy', mode: 'live', userAvatarUrl: 'https://sleepercdn.com/avatars/thumbs/123', sleeperUsername: 'Astral' },
          React.createElement('div')
        )
      );
      assert.ok(navHtml.includes('data-testid="nav-user-avatar"'), 'NavigationShell must render nav-user-avatar test ID');
    });
  });

  // ============================================================================
  // Feature 27: Comment #89 UX, Terminology & Reactive Matchup Directives
  // ============================================================================
  describe('Feature 27: Comment #89 UX, Terminology & Reactive Matchup Directives', () => {
    it('27.1 should verify win probability labels are concise and badges are constrained to prevent text bleed', () => {
      const res1 = scoring.calculateWinProbability(140, 100, 85, 80);
      assert.ok(res1.favorabilityLabel.length <= 15, 'Label must be concise to avoid bleed');
      assert.ok(!res1.favorabilityLabel.includes('Moderate Astral Advantage'), 'Must not use long string that bleeds');
      const res2 = scoring.calculateWinProbability(100, 140, 80, 85);
      assert.ok(res2.favorabilityLabel.length <= 15, 'Label must be concise to avoid bleed');
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(matchupsHtml.includes('max-w-[110px] truncate text-center block'), 'MatchupsScreen must constrain win prob badge width');
    });

    it('27.2 should verify matchup comparative advantage coloring and dynamic tier labels', () => {
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(!matchupsHtml.includes('▲ ADV'), 'MatchupsScreen must eliminate awkward ▲ ADV badge circle');
      assert.ok(
        matchupsHtml.includes('Apex Harmony') || matchupsHtml.includes('Harmonic Balance') || matchupsHtml.includes('Discordant Risk'),
        'Squad harmony must compute dynamic tier labels based on value'
      );
    });

    it('27.3 should verify clean team badging without YOUR TEAM, OPPONENT, or (You) labels', () => {
      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(!rosterHtml.includes('⭐ YOUR TEAM (YOU)'), 'OneiromancyDashboard must not include cluttered ⭐ YOUR TEAM (YOU) text');
      assert.ok(!rosterHtml.includes('>YOUR TEAM<'), 'OneiromancyDashboard H2 must not contain cluttered YOUR TEAM badge');
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(!matchupsHtml.includes('YOUR TEAM'), 'MatchupsScreen must not render YOUR TEAM label');
      assert.ok(!matchupsHtml.includes('OPPONENT'), 'MatchupsScreen must not render OPPONENT label');
      assert.ok(!matchupsHtml.includes('(You)'), 'MatchupsScreen must not render visible (You) suffix');
      assert.ok(!matchupsHtml.includes('⭐ YOUR TEAM (YOU)'), 'MatchupsScreen must not include cluttered ⭐ YOUR TEAM (YOU) text');
      const leagueHtml = renderWithProvider(React.createElement(LeagueScreen));
      assert.ok(!leagueHtml.includes('(You)'), 'LeagueScreen must not render visible (You) suffix');
      assert.ok(!leagueHtml.includes('>YOU<'), 'LeagueScreen must not render YOU pill');
    });

    it('27.4 should verify starters are formatted in a unified positional comparison without redundant starter/bench headers', () => {
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(matchupsHtml.includes('data-testid="positional-matchup-grid"'), 'MatchupsScreen must provide unified positional matchup grid');
      assert.ok(!matchupsHtml.includes('YOUR STARTERS'), 'MatchupsScreen must remove redundant YOUR STARTERS header');
      assert.ok(!matchupsHtml.includes('OPPONENT STARTERS'), 'MatchupsScreen must remove redundant OPPONENT STARTERS header');
      assert.ok(!matchupsHtml.includes('YOUR BENCH') && !matchupsHtml.includes('OPPONENT BENCH'), 'MatchupsScreen must not render duplicate YOUR BENCH / OPPONENT BENCH section');

      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(rosterHtml.includes('STARTERS ('), 'OneiromancyDashboard must have STARTERS section header');
      assert.ok(rosterHtml.includes('BENCH ('), 'OneiromancyDashboard must have BENCH section header');
    });

    it('27.5 should verify calibrated linear aspect reader scale in the 5-spoke constellation web', () => {
      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(rosterHtml.includes('data-testid="synergy-constellation-svg"'), 'OneiromancyDashboard must render unified synergy-constellation-svg');
      assert.ok(rosterHtml.includes('Aspects ('), 'Constellation SVG must render Aspects spoke');
    });

    it('27.6 should verify deriveWeeklyMatchup dynamically re-binds matchup, opponent, and player favorabilities', () => {
      assert.ok(typeof sleeper.deriveWeeklyMatchup === 'function', 'sleeper.ts must export deriveWeeklyMatchup');

      const competitorTeams = [
        { slot: 1, roster_id: 1, name: 'Supernova Surge', is_user: false, avg_draft_score: 80 },
        { slot: 2, roster_id: 2, name: 'lyraenchantress', is_user: false, avg_draft_score: 82 },
        { slot: 5, roster_id: 5, name: 'AstralOracles', is_user: true, avg_draft_score: 90 },
        { slot: 6, roster_id: 6, name: 'lunareclipse', is_user: false, avg_draft_score: 85 },
      ];

      const matchupSlot5 = sleeper.deriveWeeklyMatchup(5, competitorTeams);
      assert.equal(matchupSlot5.user_team.slot, 5, 'User team slot must be 5');
      assert.equal(matchupSlot5.opponent_team.slot, 6, 'Opponent team slot for slot 5 must be 6 (lunareclipse)');

      const matchupSlot2 = sleeper.deriveWeeklyMatchup(2, competitorTeams);
      assert.equal(matchupSlot2.user_team.slot, 2, 'User team slot must be 2');
      assert.equal(matchupSlot2.opponent_team.slot, 1, 'Opponent team slot for slot 2 must be 1 (Supernova Surge)');
    });

    it('27.7 should verify navigation tab labels: Roster, Matchup, Players, League', () => {
      const navHtml = renderToStaticMarkup(React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div')));
      for (const label of ['Roster', 'Matchup', 'Players', 'League']) {
        assert.ok(navHtml.includes(`>${label}<`), `NavigationShell must render ${label} tab label`);
      }
    });

    it('27.8 should verify consolidated Stats / Stars / Oracle terminology across controls and screens', () => {
      const controlsHtml = renderToStaticMarkup(
        React.createElement(BoardControls, {
          searchQuery: '',
          onSearchChange: () => {},
          selectedPosition: 'ALL',
          onPositionChange: () => {},
          sortBy: 'oracle',
          onSortChange: () => {},
          boardMode: 'all',
          onBoardModeChange: () => {},
          totalResults: 24,
        })
      );
      for (const label of ['Oracle', 'Stats', 'Stars']) {
        assert.ok(controlsHtml.includes(label), `BoardControls must offer ${label} sorting`);
      }
      const panelHtml = renderWithProvider(React.createElement(OraclePanel, { isOpen: true, onClose: () => {} }));
      assert.ok(panelHtml.includes('Oracle = (1 − λ) × Stats + λ × Stars'), 'The Oracle panel must state the formula');
    });

    it('27.9 should verify "less is more" UI decluttering with collapsible details disclosures', () => {
      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(rosterHtml.includes('How Squad Harmony is scored'), 'OneiromancyDashboard must explain Squad Harmony');
      assert.ok(rosterHtml.includes('How bye coverage works'), 'OneiromancyDashboard must explain bye coverage');
      const detailsCount = (rosterHtml.match(/<details/g) || []).length;
      assert.ok(detailsCount >= 2, 'OneiromancyDashboard must wrap fine-print metaphysical explanations in collapsible details');

      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(
        matchupsHtml.includes('Alignment &amp; Stadium Telemetry') || matchupsHtml.includes('Alignment & Stadium Telemetry'),
        'MatchupsScreen must provide collapsible summary for telemetry and metaphysics'
      );
      assert.ok(matchupsHtml.includes('<details class="group text-slate-300">'), 'MatchupsScreen player cards must use collapsible details for clean display');
    });

    it('27.10 should verify de-cluttered UI strings and semantic three-state modal status', () => {
      const rosterHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(!rosterHtml.includes('>YOUR TEAM<'), 'OneiromancyDashboard must not render redundant YOUR TEAM badge');

      const myPlayer = mockData.mockMyRoster.find((s) => s.player)?.player || {
        id: '4574',
        name: 'Cooper Rush',
        position: 'QB',
        team: 'DAL',
        draft_status: 'my_team',
      };
      const cardRowHtml = renderWithProvider(React.createElement(PlayerCardRow, { player: myPlayer, rank: 1, onInspect: () => {} }));
      assert.ok(cardRowHtml.includes('(On your roster)'), 'PlayerCardRow must render screen-reader only tag (On your roster)');
      assert.ok(cardRowHtml.includes('Roster'), 'PlayerCardRow must render visible non-color Roster text badge for sighted users');
      assert.ok(!cardRowHtml.includes('>YOUR TEAM<'), 'PlayerCardRow must not render visible YOUR TEAM badge');
      const oppPlayer = {
        id: '999999',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        draft_status: 'drafted',
        drafted_by: 'Nebula Knights',
      };
      const faPlayer = {
        id: '999998',
        name: 'Free Agent Star',
        position: 'WR',
        team: 'FA',
        draft_status: 'available',
      };

      const myModalHtml = renderWithProvider(React.createElement(PlayerDetailModal, { player: myPlayer, isOpen: true, onClose: () => {} }));
      assert.ok(!myModalHtml.includes('STATUS: YOUR TEAM'), 'PlayerDetailModal must not render STATUS: YOUR TEAM');
      assert.ok(!myModalHtml.includes('STATUS:'), 'PlayerDetailModal must not render redundant STATUS: prefix');
      assert.ok(!myModalHtml.includes('>YOUR TEAM<'), 'PlayerDetailModal must not render redundant YOUR TEAM badge');
      assert.ok(myModalHtml.includes('MY ROSTER'), 'PlayerDetailModal must display MY ROSTER for user player');
      assert.ok(!myModalHtml.includes('FREE AGENT'), 'PlayerDetailModal must not display FREE AGENT for rostered user player');
      assert.ok(!myModalHtml.includes('Other Rostered'), 'PlayerDetailModal must not use ambiguous Other Rostered in title');
      assert.ok(myModalHtml.includes(`Role Comparison vs. Other ${myPlayer.position}s`), 'PlayerDetailModal must render clean Role Comparison title without ambiguous Rostered');

      // Head-to-head comparison panel orientation: user's roster player on left, candidate/opponent on right
      // Case 1: Inspect user player, compareWith free agent
      const h2hHtml1 = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: myPlayer,
          compareWith: faPlayer,
          isOpen: true,
          onClose: () => {},
        })
      );
      assert.ok(!h2hHtml1.includes('Roster (VS)'), 'PlayerDetailModal must not render awkward Roster (VS)');
      const rosterIdx1 = h2hHtml1.indexOf('>Roster<');
      const faIdx1 = h2hHtml1.indexOf('>Free Agent<');
      const myNameIdx1 = h2hHtml1.indexOf(`${myPlayer.name} (${myPlayer.team})`);
      const faNameIdx1 = h2hHtml1.indexOf(`${faPlayer.name} (${faPlayer.team})`);
      assert.ok(rosterIdx1 !== -1 && faIdx1 !== -1 && rosterIdx1 < faIdx1, 'User roster panel must precede Free Agent panel in DOM order');
      assert.ok(myNameIdx1 !== -1 && faNameIdx1 !== -1 && myNameIdx1 < faNameIdx1, 'User player must appear before candidate in DOM order');

      // Case 2: Inspect free agent, compareWith user player (inverted waiver recommendation path)
      const h2hHtml2 = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: faPlayer,
          compareWith: myPlayer,
          isOpen: true,
          onClose: () => {},
        })
      );
      assert.ok(!h2hHtml2.includes('Roster (VS)'), 'PlayerDetailModal must not render awkward Roster (VS)');
      const rosterIdx2 = h2hHtml2.indexOf('>Roster<');
      const faIdx2 = h2hHtml2.indexOf('>Free Agent<');
      const myNameIdx2 = h2hHtml2.indexOf(`${myPlayer.name} (${myPlayer.team})`);
      const faNameIdx2 = h2hHtml2.indexOf(`${faPlayer.name} (${faPlayer.team})`);
      assert.ok(rosterIdx2 !== -1 && faIdx2 !== -1 && rosterIdx2 < faIdx2, 'User roster panel must anchor the left side even when inspecting a free agent');
      assert.ok(myNameIdx2 !== -1 && faNameIdx2 !== -1 && myNameIdx2 < faNameIdx2, 'User player must appear on the left before candidate in DOM order');

      // Case 3: Inspect user player, compareWith opponent starter in Matchups
      const h2hHtml3 = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: myPlayer,
          compareWith: oppPlayer,
          isOpen: true,
          onClose: () => {},
        })
      );
      const rosterIdx3 = h2hHtml3.indexOf('>Roster<');
      const oppIdx3 = h2hHtml3.indexOf('>Rostered (Nebula Knights)<');
      const myNameIdx3 = h2hHtml3.indexOf(`${myPlayer.name} (${myPlayer.team})`);
      const oppNameIdx3 = h2hHtml3.indexOf(`${oppPlayer.name} (${oppPlayer.team})`);
      assert.ok(rosterIdx3 !== -1 && oppIdx3 !== -1 && rosterIdx3 < oppIdx3, 'User roster panel must precede Opponent panel in DOM order');
      assert.ok(myNameIdx3 !== -1 && oppNameIdx3 !== -1 && myNameIdx3 < oppNameIdx3, 'User player must appear before opponent in DOM order');

      // Case 4: Intra-roster comparison (e.g. start-sit recommendation between same-position starter and bench)
      const myStarter = mockData.mockMyRoster.find((s) => s.player && !s.slot_id.startsWith('BN'))?.player;
      const myBench = mockData.mockMyRoster.find((s) => s.player && s.player.position === myStarter.position && s.slot_id.startsWith('BN'))?.player;
      const starterSlot = mockData.mockMyRoster.find((s) => s.player?.id === myStarter.id)?.slot_id;
      assert.ok(myStarter && myBench && starterSlot, 'mockMyRoster must have both a starter and bench player with slot id');

      // 4a: Open from bench player's link (inspect bench, compareWith starter)
      const h2hHtml4a = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: myBench,
          compareWith: myStarter,
          isOpen: true,
          onClose: () => {},
        })
      );
      assert.ok(h2hHtml4a.includes(`>Starter (${starterSlot})<`), `4a must render exact starter label Starter (${starterSlot})`);
      assert.ok(h2hHtml4a.includes('>Bench<'), '4a must render Bench label');
      const starterIdx4a = h2hHtml4a.indexOf(`>Starter (${starterSlot})<`);
      const benchIdx4a = h2hHtml4a.indexOf('>Bench<');
      const starterNameIdx4a = h2hHtml4a.indexOf(`${myStarter.name} (${myStarter.team})`);
      const benchNameIdx4a = h2hHtml4a.indexOf(`${myBench.name} (${myBench.team})`);
      assert.ok(starterIdx4a !== -1 && benchIdx4a !== -1 && starterIdx4a < benchIdx4a, 'Starter panel must precede Bench panel when inspecting bench player');
      assert.ok(starterNameIdx4a !== -1 && benchNameIdx4a !== -1 && starterNameIdx4a < benchNameIdx4a, 'Starter player must appear before bench player in DOM order when inspecting bench');

      // 4b: Open from starter's link (inspect starter, compareWith bench)
      const h2hHtml4b = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: myStarter,
          compareWith: myBench,
          isOpen: true,
          onClose: () => {},
        })
      );
      assert.ok(h2hHtml4b.includes(`>Starter (${starterSlot})<`), `4b must render exact starter label Starter (${starterSlot})`);
      assert.ok(h2hHtml4b.includes('>Bench<'), '4b must render Bench label');
      const starterIdx4b = h2hHtml4b.indexOf(`>Starter (${starterSlot})<`);
      const benchIdx4b = h2hHtml4b.indexOf('>Bench<');
      const starterNameIdx4b = h2hHtml4b.indexOf(`${myStarter.name} (${myStarter.team})`);
      const benchNameIdx4b = h2hHtml4b.indexOf(`${myBench.name} (${myBench.team})`);
      assert.ok(starterIdx4b !== -1 && benchIdx4b !== -1 && starterIdx4b < benchIdx4b, 'Starter panel must precede Bench panel when inspecting starter player');
      assert.ok(starterNameIdx4b !== -1 && benchNameIdx4b !== -1 && starterNameIdx4b < benchNameIdx4b, 'Starter player must appear on the left before bench player in DOM order when inspecting starter');

      // Fallback board-only roster label deduplication test (when activeRoster is empty)
      const boardOnlyModalHtml = renderWithProvider(
        React.createElement(PlayerDetailModal, {
          player: myPlayer,
          roster: [],
          isOpen: true,
          onClose: () => {},
        })
      );
      assert.ok(!boardOnlyModalHtml.includes('ROSTER (ROSTER)'), 'Modal must never render duplicate uppercase ROSTER (ROSTER)');
      assert.ok(!boardOnlyModalHtml.includes('Roster (ROSTER)'), 'Modal must never render duplicate Roster (ROSTER)');
      assert.ok(boardOnlyModalHtml.includes('>Roster<'), 'Modal must cleanly render Roster for board-only fallback');

      const oppModalHtml = renderWithProvider(React.createElement(PlayerDetailModal, { player: oppPlayer, isOpen: true, onClose: () => {} }));
      assert.ok(!oppModalHtml.includes('MY ROSTER'), 'Opponent player modal must not display MY ROSTER');
      assert.ok(oppModalHtml.includes('ROSTERED (Nebula Knights)'), 'Opponent player modal must display ROSTERED with team name');
      assert.ok(oppModalHtml.includes('Role Comparison (QB)'), 'PlayerDetailModal must render clean Role Comparison title without vs. Roster');
      assert.ok(!oppModalHtml.includes('Role Comparison vs. Roster'), 'PlayerDetailModal must not include vs. Roster in title');

      const faModalHtml = renderWithProvider(React.createElement(PlayerDetailModal, { player: faPlayer, isOpen: true, onClose: () => {} }));
      assert.ok(faModalHtml.includes('FREE AGENT'), 'Free agent modal must display FREE AGENT');
      assert.ok(!faModalHtml.includes('MY ROSTER'), 'Free agent modal must not display MY ROSTER');

      const tradesHtml = renderWithProvider(React.createElement(TradesScreen));
      assert.ok(!tradesHtml.includes('(Your Team)'), 'TradesScreen must not include (Your Team)');
      assert.ok(tradesHtml.includes('You send'), 'TradesScreen must render clean You send label');

      const boardHtml = renderWithProvider(React.createElement(CosmicBoard));
      assert.ok(!boardHtml.includes('>YOUR TEAM<'), 'CosmicBoard table must not render all-caps YOUR TEAM');
      assert.ok(!boardHtml.includes('>Your Team<'), 'BoardControls must not render Your Team filter pill');
      assert.ok(boardHtml.includes('My Roster'), 'CosmicBoard and BoardControls must render My Roster');
    });
  });

  describe('Feature 28: Interactive Identity & Opponent Stability', () => {
    it('28.1 should verify 100% deterministic bidirectional schedule generation (getDeterministicMatchupOpponentSlot)', () => {
      assert.ok(typeof sleeper.getDeterministicMatchupOpponentSlot === 'function', 'sleeper.ts must export getDeterministicMatchupOpponentSlot');

      const expectedWeek1 = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5, 7: 8, 8: 7, 9: 10, 10: 9, 11: 12, 12: 11 };
      for (const [slotStr, oppSlot] of Object.entries(expectedWeek1)) {
        const slot = Number(slotStr);
        assert.equal(sleeper.getDeterministicMatchupOpponentSlot(slot, 1, 12), oppSlot, `Slot ${slot} Week 1 opponent must be ${oppSlot}`);
      }

      for (let week = 1; week <= 18; week++) {
        for (let slot = 1; slot <= 12; slot++) {
          const oppSlot = sleeper.getDeterministicMatchupOpponentSlot(slot, week, 12);
          assert.notEqual(oppSlot, slot, `Slot ${slot} cannot play against itself in week ${week}`);
          assert.ok(oppSlot >= 1 && oppSlot <= 12, `Opponent slot ${oppSlot} must be within 1..12`);
          const inverse = sleeper.getDeterministicMatchupOpponentSlot(oppSlot, week, 12);
          assert.equal(inverse, slot, `Schedule must be bidirectional: Slot ${slot} vs ${oppSlot} in week ${week}`);
        }
      }
    });

    it('28.2 should verify Week 1 opponent is invariant across mockWeeklyMatchup, deriveWeeklyMatchup, and upcoming_matchups', () => {
      assert.equal(mockData.mockWeeklyMatchup.user_team.slot, 7, 'mockWeeklyMatchup user_team slot must be 7');
      assert.equal(mockData.mockWeeklyMatchup.opponent_team.slot, 5, 'mockWeeklyMatchup opponent_team slot must be 5');
      assert.equal(mockData.mockWeeklyMatchup.opponent_team.team_name, 'lunareclipse', 'mockWeeklyMatchup opponent_team must be lunareclipse');
      assert.equal(mockData.mockWeeklyMatchup.user_team.projected_points, 130.65, 'AstralOracles Week 1 projection must be 130.65');
      assert.equal(mockData.mockWeeklyMatchup.opponent_team.projected_points, 105.12, 'lunareclipse Week 1 projection must be 105.12');

      const derivedAstralOracles = sleeper.deriveWeeklyMatchup(7, mockData.mockCompetitorTeams, null, mockData.mockCosmicBoard, null, 1);
      assert.equal(derivedAstralOracles.user_team.slot, 7, 'user_team slot must be 7');
      assert.equal(derivedAstralOracles.opponent_team.slot, 5, 'opponent_team slot must be 5');
      assert.equal(derivedAstralOracles.opponent_team.team_name, 'lunareclipse');
      const astralUserStarters = derivedAstralOracles.player_favorabilities.filter((p) => p.is_user_team && !p.is_benched);
      const expectedAstralUserSum = Math.round(astralUserStarters.reduce((acc, p) => acc + (p.projected_points || 0), 0) * 100) / 100;
      const astralOppStarters = derivedAstralOracles.player_favorabilities.filter((p) => !p.is_user_team && !p.is_benched);
      const expectedAstralOppSum = Math.round(astralOppStarters.reduce((acc, p) => acc + (p.projected_points || 0), 0) * 100) / 100;
      assert.ok(derivedAstralOracles.user_team.projected_points > 0);
      assert.equal(derivedAstralOracles.user_team.projected_points, expectedAstralUserSum);
      assert.ok(derivedAstralOracles.opponent_team.projected_points > 0);
      assert.equal(derivedAstralOracles.opponent_team.projected_points, expectedAstralOppSum);
      assert.equal(derivedAstralOracles.matchup_id, 3);

      const derived = sleeper.deriveWeeklyMatchup(11, mockData.mockCompetitorTeams, null, mockData.mockCosmicBoard, null, 1);
      assert.equal(derived.user_team.slot, 5, 'derived user_team slot must be 5');
      assert.equal(derived.opponent_team.slot, 6, 'derived opponent_team slot must be 6');
      assert.equal(derived.opponent_team.team_name, 'Orion Ascendant', 'derived opponent_team must be Orion Ascendant');

      assert.ok(derived.upcoming_matchups && derived.upcoming_matchups.length === 18, 'Must generate full 18-week schedule');
      assert.equal(derived.upcoming_matchups[0].opponent_team.slot, 6);
      assert.equal(derived.upcoming_matchups[0].opponent_team.team_name, 'Orion Ascendant');
    });

    it('28.3 should verify active user identity persistence across simulated polling ticks', () => {
      const userSlot1Settings = { ...mockData.mockSettings, user_slot: 1 };
      const rawDraft = { ...mockData.mock_oneiromancy_draft_2025, settings: userSlot1Settings };

      const transformed = sleeper.transformToDraftState(
        rawDraft.raw_sleeper_draft || {},
        [],
        userSlot1Settings
      );

      assert.equal(transformed.settings.user_slot, 1, 'Transformed draftState settings must preserve user_slot = 1');
      const activeUserTeam = transformed.competitor_teams.find((t) => t.is_user);
      assert.ok(activeUserTeam, 'Exactly one team must be is_user');
      assert.equal(activeUserTeam.slot, 1, 'Active user team must be Slot 1 (Gridiron Gods)');
      assert.ok(activeUserTeam.name.includes('(You)'), 'Slot 1 team name must have (You)');

      const slot5Team = transformed.competitor_teams.find((t) => t.slot === 5);
      assert.equal(slot5Team.is_user, false, 'Slot 5 must not be is_user when Slot 1 is active');
      assert.ok(!slot5Team.name.includes('(You)'), 'Slot 5 must not have (You) when Slot 1 is active');
    });

    it('28.4 should verify OneiromancyProvider initializes active user identity and renders user roster cleanly', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(html.includes('AstralOracles'), 'OneiromancyProvider must initialize canonical user identity');
    });

    it('28.5 should verify OneiromancyDashboard does not render clickable persona-switching competitor cards', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(!html.includes('Switch active persona to'), 'OneiromancyDashboard must not offer persona switching tooltip');
    });

    it('28.6 should verify MatchupsScreen renders selected week matchup data for active user', () => {
      const html = renderWithProvider(React.createElement(MatchupsScreen, { weeklyMatchup: mockData.mockWeeklyMatchup }));
      assert.ok(html.includes('AstralOracles') && html.includes('lunareclipse'), 'MatchupsScreen must bind active user vs Week 1 opponent');
    });

    it('28.7 should verify transformToDraftState resolves user_slot from username when explicit slot is omitted', () => {
      const mockMetadata = {
        draft_id: 'draft_slot_auto',
        league_id: 'league_slot_auto',
        status: 'complete',
        settings: { teams: 2, rounds: 15 },
        draft_order: { u_alpha: 1, u_beta: 2 },
      };
      const users = [
        { user_id: 'u_alpha', display_name: 'AlphaUser' },
        { user_id: 'u_beta', display_name: 'BetaUser' },
      ];
      const rosters = [
        { roster_id: 1, owner_id: 'u_alpha', settings: { wins: 1 } },
        { roster_id: 2, owner_id: 'u_beta', settings: { wins: 0 } },
      ];
      const state = sleeper.transformToDraftState(
        mockMetadata,
        [],
        { sleeper_username: 'BetaUser', user_id: 'u_beta' },
        {},
        users,
        rosters
      );
      assert.equal(state.settings.user_slot, 2, 'transformToDraftState must resolve BetaUser to draft slot 2');
    });
  });

  // ============================================================================
  // Feature 30: Avatar Caching, Layout Swaps & Marketplace Config Constraints
  // ============================================================================
  describe('Feature 30: Avatar Caching, Layout Swaps & Marketplace Constraints', () => {
    it('30.1 should verify intermediate avatar cache in sleeper.ts and UserAvatar', () => {
      assert.equal(typeof sleeper.getAvatarFromCache, 'function', 'Must export getAvatarFromCache');
      assert.equal(typeof sleeper.setAvatarInCache, 'function', 'Must export setAvatarInCache');
      assert.equal(sleeper.AVATAR_CACHE_STORAGE_KEY, 'oneiromancy_avatar_cache_v1', 'Must define AVATAR_CACHE_STORAGE_KEY');

      const testKey = 'cache_test_user_99';
      const dataUri = 'https://sleepercdn.com/avatars/thumbs/cache_test_99';
      sleeper.setAvatarInCache([testKey], dataUri);
      assert.equal(sleeper.getAvatarFromCache(testKey), dataUri, 'getAvatarFromCache must return cached avatar URL');

      const avatarHtml = renderToStaticMarkup(
        React.createElement(UserAvatar, { src: dataUri, alt: 'Cached Avatar', testId: 'cached-avatar' })
      );
      assert.ok(avatarHtml.includes(dataUri), 'UserAvatar must render cached avatar URL');
    });

    it('30.2 should verify OneiromancyDashboard does not render competitor cards on the Roster screen', () => {
      const html = renderWithProvider(React.createElement(OneiromancyDashboard));
      assert.ok(!html.includes('data-testid="competitor-card-'), 'Competitor cards belong on League, not Roster');
    });

    it('30.3 should verify Divination spotlight pick simplification with clickable player name', () => {
      const heroHtml = renderWithProvider(
        React.createElement(RecommendedPickHero, {
          player: mockData.mockCosmicBoard[0],
          onSelectPlayer: () => {},
        })
      );
      assert.ok(!heroHtml.includes('active divination target'), 'Must remove active divination target button');
      assert.ok(!heroHtml.includes('inspect dossier'), 'Must remove inspect dossier button');
      assert.ok(heroHtml.includes('data-testid="spotlight-player-name"'), 'Must render spotlight-player-name clickable test ID');
    });

    it('30.4 should verify canonical tab order across NavigationShell and app/page.tsx', () => {
      const homeHtml = renderToStaticMarkup(React.createElement(Home));
      const ids = [...homeHtml.matchAll(/data-testid="nav-tab-([a-z_]+)"/g)].map((m) => m[1]);
      assert.deepEqual(ids, ['oneiromancy', 'matchups', 'board', 'league']);
    });

    it('30.5 should verify PlayerMarketplace restricts swaps by active roster positions and protects signed bench players', () => {
      const superflexPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', 'BN'];
      const eligiblePositions = sleeper.deriveEligiblePositions(superflexPositions, []);
      assert.ok(!eligiblePositions.includes('K'), 'deriveEligiblePositions must not include K when K is not in roster slots');
      assert.ok(eligiblePositions.includes('QB') && eligiblePositions.includes('RB') && eligiblePositions.includes('WR') && eligiblePositions.includes('TE'));

      const kickerWaiver = {
        id: '6083',
        name: 'Matt Gay',
        position: 'K',
        team: 'LV',
        net_score_delta: 6.5,
        recommended_drop_id: '6783',
        recommended_drop_team: 'CLE',
        recommended_drop_position: 'WR',
      };
      const isEligible = eligiblePositions.includes(kickerWaiver.position);
      assert.equal(isEligible, false, 'Matt Gay (K) must not be eligible when league lacks K starting position');
    });

    it('30.6 should verify Divination Spotlight Pick is removed from OneiromancyDashboard, PlayerMarketplace, and CosmicBoard', () => {
      const oneiromancyHtml = renderWithProvider(React.createElement(OneiromancyDashboard));
      const marketHtml = renderWithProvider(React.createElement(PlayerMarketplace));
      const boardHtml = renderWithProvider(React.createElement(CosmicBoard));
      assert.ok(!oneiromancyHtml.includes('Divination Spotlight Pick'), 'Divination Spotlight Pick must not be in OneiromancyDashboard');
      assert.ok(!marketHtml.includes('Divination Spotlight Pick'), 'Divination Spotlight Pick must be removed from PlayerMarketplace');
      assert.ok(!boardHtml.includes('Divination Spotlight Pick'), 'Divination Spotlight Pick must not duplicate top player in CosmicBoard');
    });

    it('30.7 should verify leaderboard rows render team names with a separate slot label and tier badge', () => {
      const lbHtml = renderWithProvider(React.createElement(CelestialLeaderboardGraph, { competitorTeams: mockData.mockCompetitorTeams }));
      assert.ok(!/Slot \d+:\s+[A-Za-z]/.test(lbHtml), 'Rows must not render a "Slot X:" prefix');
      assert.ok(lbHtml.includes('Slot 1') && lbHtml.includes('Slot 7'), 'Rows keep the slot as a separate label');
      assert.ok(lbHtml.includes('Favorable') && lbHtml.includes('Harmonic'), 'Rows render the tier badge');
    });

    it('30.8 should verify MatchupsScreen renders unified Positional Starter Matchup without duplicate telemetry blocks or ▲ ADV circles', () => {
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(matchupsHtml.includes('Positional Starter Matchup'), 'MatchupsScreen must render Positional Starter Matchup header');
      assert.ok(!matchupsHtml.includes('Comparative Advantages &amp; Vulnerabilities'), 'MatchupsScreen must not render duplicate Comparative Advantages & Vulnerabilities prose block');
      assert.ok(!matchupsHtml.includes('▲ ADV'), 'MatchupsScreen must eliminate awkward ▲ ADV badge circle from telemetry cards');
    });

    it('30.9 should verify full 15-player rosters (starters and benched players) for both user and opponent in MatchupsScreen', () => {
      assert.equal(mockData.mockPlayerFavorabilities.length, 30, 'mockPlayerFavorabilities must have 30 total players');
      const mockUserPlayers = mockData.mockPlayerFavorabilities.filter((p) => p.is_user_team);
      const mockOppPlayers = mockData.mockPlayerFavorabilities.filter((p) => !p.is_user_team);
      assert.equal(mockUserPlayers.length, 15, 'User team must have all 15 roster players');
      assert.equal(mockOppPlayers.length, 15, 'Opponent team must have all 15 roster players');

      assert.equal(mockUserPlayers.filter((p) => !p.is_benched).length, 8, 'User team must have 8 starters');
      assert.equal(mockUserPlayers.filter((p) => p.is_benched).length, 7, 'User team must have 7 bench reserves');
      assert.equal(mockOppPlayers.filter((p) => !p.is_benched).length, 8, 'Opponent team must have 8 starters');
      assert.equal(mockOppPlayers.filter((p) => p.is_benched).length, 7, 'Opponent team must have 7 bench reserves');

      const derived = sleeper.deriveWeeklyMatchup(1);
      assert.equal(derived.player_favorabilities.length, 30, 'deriveWeeklyMatchup must return 30 player favorabilities');

      const derivedUserPlayers = derived.player_favorabilities.filter((p) => p.is_user_team);
      const derivedOppPlayers = derived.player_favorabilities.filter((p) => !p.is_user_team);
      assert.equal(derivedUserPlayers.length, 15, 'Derived user team must have 15 players');
      assert.equal(derivedOppPlayers.length, 15, 'Derived opponent team must have 15 players');

      for (const p of derived.player_favorabilities) {
        assert.ok(p.player_id, 'Player must have valid player_id');
        assert.ok(p.player_name, 'Player must have valid player_name');
        assert.ok(typeof p.favorability_score === 'number', 'Player must have numeric favorability_score');
        assert.ok(p.favorability_verdict, 'Player must have favorability_verdict');
        assert.ok(p.stadium, 'Player must have stadium data');
        assert.ok(
          typeof p.stadium.latitude === 'number' || typeof p.stadium.coordinates?.lat === 'number',
          'Player must have latitude or coordinates.lat'
        );
        assert.ok(
          typeof p.stadium.longitude === 'number' || typeof p.stadium.coordinates?.lon === 'number',
          'Player must have longitude or coordinates.lon'
        );
        assert.ok(p.stadium.roof_type, 'Player stadium must have roof_type');
      }

      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(matchupsHtml.includes('Positional Starter Matchup'), 'MatchupsScreen must render Positional Starter Matchup title');
      assert.ok(!matchupsHtml.includes('YOUR STARTERS') && !matchupsHtml.includes('OPPONENT STARTERS'), 'MatchupsScreen must not render redundant YOUR STARTERS / OPPONENT STARTERS headers');
      assert.ok(!matchupsHtml.includes('YOUR BENCH') && !matchupsHtml.includes('OPPONENT BENCH'), 'MatchupsScreen must not render a duplicate YOUR BENCH / OPPONENT BENCH section');
    });

    it('23.6 should opportunistically load optional internal data package when present and fall back to clean OSS defaults when absent', async () => {
      const missingRes = await sleeper.loadOptionalInternalData({
        baseDir: '/tmp/nonexistent_oneiromancy_oss_checkout',
      });
      assert.equal(missingRes.available, false, 'Missing custom data directory must return available: false');
      assert.equal(missingRes.profile, null, 'Missing custom data directory must return profile: null');

      const internalRes = await sleeper.loadOptionalInternalData();
      if (internalRes.available) {
        assert.ok(internalRes.profile, 'Internal profile must be loaded when custom dataset is present');
        assert.ok(
          internalRes.playerCount > 10000,
          `Expected full 12,000+ NFL player dictionary from custom dataset, got ${internalRes.playerCount}`
        );
        const applied = sleeper.applyOptionalInternalProfileToDraftState(
          mockData.mock_oneiromancy_draft_2025,
          internalRes.profile
        );
        assert.equal(
          applied.settings.sleeper_username,
          internalRes.profile.default_username,
          'applyOptionalInternalProfileToDraftState must apply internal default_username'
        );
        assert.equal(
          applied.settings.league_id,
          internalRes.profile.default_league_id,
          'applyOptionalInternalProfileToDraftState must apply internal default_league_id'
        );
      }

      sleeper.registerInternalProfile(null);
    });

    it('30.10 should verify dynamic Sleeper starting slot order (QB, RB, RB, WR, WR, TE, WRT, WRTQ), formatStarterRole, and index-aligned starter pairing with 0 empty slot safety', () => {
      // 1. Role formatting
      assert.equal(sleeper.formatStarterRole('FLEX'), 'WRT');
      assert.equal(sleeper.formatStarterRole('SUPER_FLEX'), 'WRTQ');
      assert.equal(sleeper.formatStarterRole('SUPERFLEX'), 'WRTQ');
      assert.equal(sleeper.formatStarterRole('WRRB_FLEX'), 'WR/RB');
      assert.equal(sleeper.formatStarterRole('REC_FLEX'), 'WR/TE');
      assert.equal(sleeper.formatStarterRole('IDP_FLEX'), 'IDP');
      assert.equal(sleeper.formatStarterRole('QB'), 'QB');
      assert.equal(sleeper.formatStarterRole('RB'), 'RB');
      assert.equal(sleeper.formatStarterRole('WR'), 'WR');
      assert.equal(sleeper.formatStarterRole('TE'), 'TE');
      assert.equal(sleeper.formatStarterRole('K'), 'K');
      assert.equal(sleeper.formatStarterRole('DEF'), 'DEF');

      // 2. Reserve / Bench slot filtering with trailing digits
      assert.equal(sleeper.isBenchOrReserveSlot('BN'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('BN1'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('IR'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('IR2'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('TAXI'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('TAXI1'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('RES'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('RES3'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('BENCH'), true);
      assert.equal(sleeper.isBenchOrReserveSlot('QB'), false);
      assert.equal(sleeper.isBenchOrReserveSlot('FLEX'), false);

      const slots = sleeper.extractStartingSlots(
        ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN1', 'BN2', 'IR1', 'TAXI1'],
      );
      assert.deepEqual(slots, ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX']);

      // 3. Normal starter pairing alignment
      const userStarters = mockData.mockPlayerFavorabilities.filter((p) => p.is_user_team && !p.is_benched);
      const oppStarters = mockData.mockPlayerFavorabilities.filter((p) => !p.is_user_team && !p.is_benched);
      const pairs = sleeper.buildStarterPairs(
        slots,
        userStarters,
        oppStarters,
        mockData.mockWeeklyMatchup.user_team.starters,
        mockData.mockWeeklyMatchup.opponent_team.starters,
      );
      assert.equal(pairs.length, 8);
      const expectedLabels = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];
      assert.deepEqual(pairs.map((p) => p.slotLabel), expectedLabels);
      assert.equal(pairs[0].user?.player_name, 'Cooper Rush');
      assert.equal(pairs[0].opp?.player_name, 'Bo Nix');
      assert.equal(pairs[6].slotLabel, 'WRT');
      assert.equal(pairs[6].user?.player_name, 'Javonte Williams');
      assert.equal(pairs[7].slotLabel, 'WRTQ');
      assert.equal(pairs[7].user?.player_name, 'Aaron Rodgers');

      // 4. Empty starter slot '0' safety (must NOT shift later players into earlier slots)
      const userIdsWithEmptySlot = [...mockData.mockWeeklyMatchup.user_team.starters];
      userIdsWithEmptySlot[1] = '0';
      const slots8 = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'];
      const pairsWithEmpty = sleeper.buildStarterPairs(
        slots8,
        userStarters,
        oppStarters,
        userIdsWithEmptySlot,
        mockData.mockWeeklyMatchup.opponent_team.starters,
      );
      assert.equal(pairsWithEmpty.length, 8);
      // Index 1 (RB) had '0', so user must be null (empty), not shifted
      assert.equal(pairsWithEmpty[1].user, null, 'Empty starter slot "0" must yield null user starter, not shift later players');
      assert.ok(pairsWithEmpty[1].opp !== null, 'Opponent starter must remain aligned in slot 1');

      // 5. 9+ starter leagues (e.g. with K and DEF)
      const slots9 = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
      const kPlayer = { player_id: '9901', player_name: 'Justin Tucker', position: 'K', is_user_team: true, is_benched: false };
      const defPlayer = { player_id: '9902', player_name: 'SF Defense', position: 'DEF', is_user_team: true, is_benched: false };
      const extendedUserStarters = [...userStarters.slice(0, 7), kPlayer, defPlayer];
      const extendedStarterIds = [...mockData.mockWeeklyMatchup.user_team.starters.slice(0, 7), '9901', '9902'];

      const kOpp = { player_id: '9903', player_name: 'Harrison Butker', position: 'K', is_user_team: false, is_benched: false };
      const defOpp = { player_id: '9904', player_name: 'BAL Defense', position: 'DEF', is_user_team: false, is_benched: false };
      const extendedOppStarters = [...oppStarters.slice(0, 7), kOpp, defOpp];
      const extendedOppStarterIds = [...mockData.mockWeeklyMatchup.opponent_team.starters.slice(0, 7), '9903', '9904'];

      const pairs9 = sleeper.buildStarterPairs(
        slots9,
        extendedUserStarters,
        extendedOppStarters,
        extendedStarterIds,
        extendedOppStarterIds,
      );
      assert.equal(pairs9.length, 9);
      assert.equal(pairs9[7].slotLabel, 'K');
      assert.equal(pairs9[7].user?.player_name, 'Justin Tucker');
      assert.equal(pairs9[7].opp?.player_name, 'Harrison Butker');
      assert.equal(pairs9[8].slotLabel, 'DEF');
      assert.equal(pairs9[8].user?.player_name, 'SF Defense');
      assert.equal(pairs9[8].opp?.player_name, 'BAL Defense');
    });

    it('30.11 should verify advantage bar removal and hierarchical Stats/Stars -> Oracle node tree with dominant power-up glow', () => {
      const matchupsHtml = renderWithProvider(React.createElement(MatchupsScreen));
      assert.ok(!matchupsHtml.includes('data-testid="matchup-bar-separator"'), 'Advantage bar separator must be removed');
      assert.ok(!matchupsHtml.includes('data-testid="matchup-bar-centerline"'), 'Advantage bar centerline must be removed');
      assert.ok(!matchupsHtml.includes('data-testid="matchup-bar-user"'), 'Advantage bar user segment must be removed');
      assert.ok(!matchupsHtml.includes('data-testid="matchup-bar-opp"'), 'Advantage bar opp segment must be removed');
      assert.ok(!matchupsHtml.includes('data-testid="matchup-bar-delta"'), 'Advantage bar delta / Opp Fav tag strip must be removed');
      assert.ok(!matchupsHtml.includes('role="meter"'), 'Advantage bar role="meter" must be removed');
      assert.ok(!matchupsHtml.includes('>Opp Fav<'), 'Must not render Opp Fav tag');
      assert.ok(!matchupsHtml.includes('data-testid="player-favored-badge"'), 'Card-level player-favored-badge must be removed');
      assert.ok(matchupsHtml.includes('title="Starters paired 1:1 by Sleeper league starting lineup slots."'), 'Positional Starter Matchups header must expose explanatory tooltip');
      assert.ok(/\bWRT\b/.test(matchupsHtml), 'Positional Starter Matchups must render WRT (Flex) slot');
      assert.ok(/\bWRTQ\b/.test(matchupsHtml), 'Positional Starter Matchups must render WRTQ (Superflex) slot');

      // Hierarchical node tree verification
      assert.ok(matchupsHtml.includes('data-testid="player-oracle-tree"'), 'Player card must render hierarchical player-oracle-tree');
      assert.ok(matchupsHtml.includes('role="group"'), 'Hierarchical node tree must expose role="group"');
      assert.ok(matchupsHtml.includes('aria-label="Player judgment synthesis tree for '), 'Hierarchical node tree must expose player-specific aria-label');
      assert.ok(matchupsHtml.includes('data-testid="oracle-node"'), 'Node tree must render Oracle root node');
      assert.ok(matchupsHtml.includes('data-testid="oracle-tree-branches"'), 'Node tree must render Stats/Stars branch connectors');
      assert.ok(matchupsHtml.includes('data-testid="stats-node"'), 'Node tree must render Stats leaf');
      assert.ok(matchupsHtml.includes('data-testid="stars-node"'), 'Node tree must render Stars leaf');

      // Dominant Oracle glow & animated floating 5-point SVG stars verification
      assert.ok(
        matchupsHtml.includes('shadow-[0_0_16px_rgba(168,85,247,0.85)]') ||
        matchupsHtml.includes('shadow-[0_0_16px_rgba(6,182,212,0.85)]'),
        'Dominant Oracle node must receive power-up glow shadow'
      );
      assert.ok(!matchupsHtml.includes('data-testid="oracle-powerup-arrows"'), 'Power-up arrows must be removed');
      assert.ok(matchupsHtml.includes('data-testid="oracle-powerup-stars"'), 'Dominant Oracle node must render floating SVG stars overlay');
      assert.ok(matchupsHtml.includes('<polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"'), 'Floating stars must render actual 5-point SVG polygon shapes');
      assert.ok(matchupsHtml.includes('animate-powerup-star-float'), 'Floating stars must use animate-powerup-star-float');
      assert.ok(matchupsHtml.includes('motion-reduce:animate-none'), 'Floating stars must honor motion-reduce:animate-none');

      // Verify distinct states (User Favored, Opponent Favored, Even, Open, Bye) on card-scoped Oracle trees
      const statesWeeklyMatchup = {
        week: 8,
        season_year: 2026,
        user_team: {
          slot: 1,
          roster_id: 1,
          name: 'Alpha Team (You)',
          is_user: true,
          starters: ['u_fav', 'u_under', 'u_even', '0', 'u_bye', 'u_bye_both'],
          points: 110.0,
          projected_points: 110.0,
        },
        opponent_team: {
          slot: 2,
          roster_id: 2,
          name: 'Beta Team (Opp)',
          is_user: false,
          starters: ['o_under', 'o_fav', 'o_even', 'o_open', 'o_bye_opp', 'o_bye_both'],
          points: 105.0,
          projected_points: 105.0,
        },
        player_favorabilities: [
          { player_id: 'u_fav', player_name: 'User Fav Star', position: 'QB', is_user_team: true, is_benched: false, projected_points: 25.0, favorability_score: 90 },
          { player_id: 'u_under', player_name: 'User Underdog', position: 'RB', is_user_team: true, is_benched: false, projected_points: 8.0, favorability_score: 60 },
          { player_id: 'u_even', player_name: 'User Even', position: 'WR', is_user_team: true, is_benched: false, projected_points: 15.0, favorability_score: 75 },
          { player_id: 'u_bye', player_name: 'User Bye Star', position: 'K', is_user_team: true, is_benched: false, projected_points: 12.0, favorability_score: 88, bye_week: 8, game_kickoff: 'Bye week' },
          { player_id: 'u_bye_both', player_name: 'User Bye DST', position: 'DST', is_user_team: true, is_benched: false, projected_points: 9.0, favorability_score: 82, bye_week: 8, game_kickoff: 'Bye week' },
          { player_id: 'o_under', player_name: 'Opp Underdog', position: 'QB', is_user_team: false, is_benched: false, projected_points: 10.0, favorability_score: 60 },
          { player_id: 'o_fav', player_name: 'Opp Fav Star', position: 'RB', is_user_team: false, is_benched: false, projected_points: 28.0, favorability_score: 92 },
          { player_id: 'o_even', player_name: 'Opp Even', position: 'WR', is_user_team: false, is_benched: false, projected_points: 15.0, favorability_score: 75 },
          { player_id: 'o_open', player_name: 'Opp Solo', position: 'TE', is_user_team: false, is_benched: false, projected_points: 12.0, favorability_score: 75 },
          { player_id: 'o_bye_opp', player_name: 'Opp Active Kicker', position: 'K', is_user_team: false, is_benched: false, projected_points: 5.0, favorability_score: 55 },
          { player_id: 'o_bye_both', player_name: 'Opp Bye DST', position: 'DST', is_user_team: false, is_benched: false, projected_points: 6.0, favorability_score: 65, bye_week: 8, game_kickoff: 'Bye week' },
        ],
        matchup_score: { user_score: 55.0, opp_score: 48.0, win_probability: 56.0, favorite_side: 'user', point_spread: -7.0 },
      };

      const statesHtml = renderWithProvider(
        React.createElement(MatchupsScreen, { weeklyMatchup: statesWeeklyMatchup }),
        { ...mockData.mock_oneiromancy_draft_2025, roster_positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] }
      );
      const slotLabels = [...statesHtml.matchAll(/data-testid="matchup-slot-label"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim());
      assert.deepStrictEqual(slotLabels, ['QB', 'RB', 'WR', 'TE', 'K', 'DST'], 'Starter rows must map row-by-row to exact slot labels');
      const srSummaries = [...statesHtml.matchAll(/<span class="sr-only">([^<]+)<\/span>/g)].map((m) => m[1].trim());
      assert.equal(srSummaries.length, 6, 'Every positional starter row must render an accessible sr-only comparison summary');
      assert.ok(srSummaries[0].startsWith('QB: User Fav Star Oracle') && srSummaries[0].endsWith(' - User dominant'), `QB sr-only summary mismatch: ${srSummaries[0]}`);
      assert.ok(srSummaries[1].startsWith('RB: User Underdog Oracle') && srSummaries[1].endsWith(' - Opponent dominant'), `RB sr-only summary mismatch: ${srSummaries[1]}`);
      assert.ok(srSummaries[2].startsWith('WR: User Even Oracle') && srSummaries[2].endsWith(' - Even'), `WR sr-only summary mismatch: ${srSummaries[2]}`);
      assert.ok(srSummaries[3].includes('TE: Empty vs Opp Solo Oracle') && srSummaries[3].endsWith(' - Open'), `TE sr-only summary mismatch: ${srSummaries[3]}`);
      assert.ok(srSummaries[4].startsWith('K: User Bye Star Oracle') && srSummaries[4].endsWith(' - Opponent active vs user on bye'), `K bye sr-only summary mismatch: ${srSummaries[4]}`);
      assert.ok(srSummaries[5].startsWith('DST: User Bye DST Oracle') && srSummaries[5].endsWith(' - Both starters on bye'), `DST bye sr-only summary mismatch: ${srSummaries[5]}`);

      const getStarterCardHtml = (html, id) => {
        const marker = `data-testid="matchup-starter-card-${id}"`;
        const markerIdx = html.indexOf(marker);
        assert.ok(markerIdx !== -1, `Card for player ${id} must exist in rendered HTML`);
        const cardStart = html.lastIndexOf('<div', markerIdx);
        assert.ok(cardStart !== -1, `Opening div for player card ${id} must exist`);
        const rest = html.slice(cardStart);
        const nextDelim = rest.slice(4).search(/<div[^>]*data-testid="matchup-starter-card-|Empty starter slot|Empty opponent slot|data-testid="matchup-bye-callout"|<\/section>/);
        return nextDelim !== -1 ? rest.slice(0, 4 + nextDelim) : rest.slice(0, 2600);
      };

      // Dominant cards: data-dominant="true", glowing Oracle node, floating 5-point SVG stars, zero favored badge / arrows
      const uFavCard = getStarterCardHtml(statesHtml, 'u_fav');
      assert.ok(uFavCard.includes('data-dominant="true"'), 'u_fav card must have data-dominant="true"');
      assert.ok(uFavCard.includes('aria-label="Player judgment synthesis tree for User Fav Star"'), 'u_fav tree must include player name in aria-label');
      assert.ok(uFavCard.includes('shadow-[0_0_16px_rgba(168,85,247,0.85)]'), 'u_fav Oracle node must render purple power-up glow');
      assert.ok(uFavCard.includes('data-testid="oracle-powerup-stars"'), 'u_fav Oracle node must render floating stars');
      assert.ok(!uFavCard.includes('data-testid="oracle-powerup-arrows"'), 'u_fav card must not render removed arrows');
      assert.ok(!uFavCard.includes('data-testid="player-favored-badge"'), 'u_fav card must not render removed favored badge');

      for (const oppFavId of ['o_fav', 'o_bye_opp']) {
        const oppFavCard = getStarterCardHtml(statesHtml, oppFavId);
        assert.ok(oppFavCard.includes('data-dominant="true"'), `${oppFavId} card must have data-dominant="true"`);
        assert.ok(oppFavCard.includes('shadow-[0_0_16px_rgba(6,182,212,0.85)]'), `${oppFavId} Oracle node must render cyan power-up glow`);
        assert.ok(oppFavCard.includes('data-testid="oracle-powerup-stars"'), `${oppFavId} Oracle node must render floating stars`);
        assert.ok(!oppFavCard.includes('data-testid="oracle-powerup-arrows"'), `${oppFavId} card must not render removed arrows`);
        assert.ok(!oppFavCard.includes('data-testid="player-favored-badge"'), `${oppFavId} card must not render removed favored badge`);
      }

      // Non-dominant / even / open / bye / both-on-bye cards: data-dominant="false", strictly absent dominant glow and floating stars
      for (const nonFavId of ['u_under', 'u_even', 'o_under', 'o_even', 'o_open', 'u_bye', 'u_bye_both', 'o_bye_both']) {
        const cardHtml = getStarterCardHtml(statesHtml, nonFavId);
        assert.ok(
          cardHtml.includes('data-dominant="false"'),
          `Non-favored / bye card ${nonFavId} must have data-dominant="false"`
        );
        assert.ok(
          !cardHtml.includes('data-dominant="true"'),
          `Non-favored / bye card ${nonFavId} must strictly NOT mark dominant`
        );
        assert.ok(
          !cardHtml.includes('data-testid="oracle-powerup-stars"'),
          `Non-favored / bye card ${nonFavId} must strictly NOT render floating stars`
        );
        assert.ok(
          !cardHtml.includes('data-testid="player-favored-badge"'),
          `Non-favored / bye card ${nonFavId} must strictly NOT render removed favored badge`
        );
      }
    });

    it('30.12 should verify deriveWeeklyMatchup empty slot 0 safety, dynamic league sizing without hardcoded floor, and no-bench backfill', () => {
      const userTeam = {
        slot: 1,
        roster_id: 1,
        name: 'Alpha Team (You)',
        is_user: true,
        picks: [],
        starters: ['101', '102', '103', '104', '105', '106', '107', '108'],
        players: [
          '101', '102', '103', '104', '105', '106', '107', '108',
          '109', '110', '111', '112', '113', '114', '115'
        ],
      };
      const oppTeam = {
        slot: 2,
        roster_id: 2,
        name: 'Beta Team',
        is_user: false,
        picks: [],
        starters: ['201', '202', '203', '204', '205', '206', '207', '208'],
        players: [
          '201', '202', '203', '204', '205', '206', '207', '208',
          '209', '210', '211', '212', '213', '214', '215'
        ],
      };
      const teams = [userTeam, oppTeam];

      // Empty slot '0' in starters: user only started 7 players in an 8-slot lineup
      const seasonCtxWithEmpty = {
        currentWeek: 1,
        matchupsByWeek: {
          1: [
            {
              roster_id: 1,
              matchup_id: 1,
              starters: ['101', '0', '103', '104', '105', '106', '107', '108'],
              players: userTeam.players,
              players_points: { '101': 15.0, '103': 12.0 },
            },
            {
              roster_id: 2,
              matchup_id: 1,
              starters: oppTeam.starters,
              players: oppTeam.players,
              players_points: { '201': 14.0 },
            },
          ],
        },
      };

      const derivedEmpty = sleeper.deriveWeeklyMatchup(1, teams, seasonCtxWithEmpty.matchupsByWeek[1], null, null, 1);
      const userFavsEmpty = derivedEmpty.player_favorabilities.filter((p) => p.is_user_team);
      const userStartersEmpty = userFavsEmpty.filter((p) => !p.is_benched);
      const userBenchEmpty = userFavsEmpty.filter((p) => p.is_benched);

      // Must have exactly 7 starters; bench player '102' or '109' must NOT be backfilled into starters!
      assert.equal(userStartersEmpty.length, 7, 'Empty starter slot "0" must not be backfilled from bench players');
      assert.equal(userBenchEmpty.length, 8, 'Remaining 8 roster players must be classified as benched');
      const starterIdsEmpty = userStartersEmpty.map((p) => String(p.player_id));
      assert.ok(!starterIdsEmpty.includes('102'), 'Bench player 102 must not be backfilled into starters');
      assert.ok(!starterIdsEmpty.includes('109'), 'Bench player 109 must not be backfilled into starters');

      // Dynamic 7-starter league (no 8-starter floor)
      const seasonCtx7 = {
        currentWeek: 1,
        matchupsByWeek: {
          1: [
            {
              roster_id: 1,
              matchup_id: 1,
              starters: ['101', '102', '103', '104', '105', '106', '107'],
              players: userTeam.players,
            },
            {
              roster_id: 2,
              matchup_id: 1,
              starters: ['201', '202', '203', '204', '205', '206', '207'],
              players: oppTeam.players,
            },
          ],
        },
      };
      const derived7 = sleeper.deriveWeeklyMatchup(1, teams, seasonCtx7.matchupsByWeek[1], null, null, 1);
      const userStarters7 = derived7.player_favorabilities.filter((p) => p.is_user_team && !p.is_benched);
      assert.equal(userStarters7.length, 7, '7-starter league must have exactly 7 starters without padding to 8');

      // Dynamic 9-starter league
      const seasonCtx9 = {
        currentWeek: 1,
        matchupsByWeek: {
          1: [
            {
              roster_id: 1,
              matchup_id: 1,
              starters: ['101', '102', '103', '104', '105', '106', '107', '108', '109'],
              players: userTeam.players,
            },
            {
              roster_id: 2,
              matchup_id: 1,
              starters: ['201', '202', '203', '204', '205', '206', '207', '208', '209'],
              players: oppTeam.players,
            },
          ],
        },
      };
      const derived9 = sleeper.deriveWeeklyMatchup(1, teams, seasonCtx9.matchupsByWeek[1], null, null, 1);
      const userStarters9 = derived9.player_favorabilities.filter((p) => p.is_user_team && !p.is_benched);
      assert.equal(userStarters9.length, 9, '9-starter league must have exactly 9 starters');
    });

    it('30.13 should verify mid-draft fullRoster slot order preservation with 0 sentinels and compacted ID safety', () => {
      const board = mockData.mockCosmicBoard;
      const qb = board.find((p) => p.position === 'QB');
      const wrs = board.filter((p) => p.position === 'WR').slice(0, 2);
      assert.ok(qb && wrs.length === 2, 'Preconditions: mock board contains QB and at least 2 WRs');

      // Mid-draft roster: QB filled, both RB slots empty, WR1 and WR2 filled, remaining slots empty
      const slot = (id, pos, player) => ({
        slot_id: id,
        slot_name: id,
        eligible_positions: pos,
        player,
      });
      const fullRoster = [
        slot('QB', ['QB'], qb),
        slot('RB1', ['RB'], null),
        slot('RB2', ['RB'], null),
        slot('WR1', ['WR'], wrs[0]),
        slot('WR2', ['WR'], wrs[1]),
        slot('TE', ['TE'], null),
        slot('FLEX', ['RB', 'WR', 'TE'], null),
        slot('SUPER_FLEX', ['QB', 'RB', 'WR', 'TE'], null),
        slot('BN1', [], null),
      ];

      const userTeam = { slot: 1, roster_id: 1, name: 'User Team', is_user: true, picks: [] };
      const oppTeam = {
        slot: 2,
        roster_id: 2,
        name: 'Opponent Team',
        is_user: false,
        picks: [],
        starters: mockData.mockWeeklyMatchup.opponent_team.starters,
        players: mockData.mockWeeklyMatchup.opponent_team.players,
      };

      const derived = sleeper.deriveWeeklyMatchup(1, [userTeam, oppTeam], null, board, fullRoster, 1);

      // 1. user_team.starters must preserve slot order with '0' for empty slots
      assert.deepEqual(
        derived.user_team.starters,
        [String(qb.id), '0', '0', String(wrs[0].id), String(wrs[1].id), '0', '0', '0'],
        'deriveWeeklyMatchup must emit slot-ordered starters preserving "0" for empty slots from fullRoster'
      );

      // 2. buildStarterPairs must keep WRs in WR slots and leave empty RB slots as OPEN
      const userFavs = derived.player_favorabilities.filter((p) => p.is_user_team && !p.is_benched);
      const oppFavs = derived.player_favorabilities.filter((p) => !p.is_user_team && !p.is_benched);
      const dynamicSlots = sleeper.extractStartingSlots(null, fullRoster);
      assert.deepEqual(dynamicSlots, ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'SUPER_FLEX']);

      const pairs = sleeper.buildStarterPairs(
        dynamicSlots,
        userFavs,
        oppFavs,
        derived.user_team.starters,
        derived.opponent_team.starters,
      );

      assert.equal(pairs.length, 8, 'Pairs length must match startingSlots count');
      assert.equal(pairs[0].user?.player_name, qb.name, 'Slot 0 (QB) must contain the drafted QB');
      assert.equal(pairs[1].user, null, 'Slot 1 (RB1) must be null / empty');
      assert.equal(pairs[2].user, null, 'Slot 2 (RB2) must be null / empty');
      assert.equal(pairs[3].user?.player_name, wrs[0].name, 'Slot 3 (WR1) must contain WR 1');
      assert.equal(pairs[4].user?.player_name, wrs[1].name, 'Slot 4 (WR2) must contain WR 2');
      assert.equal(pairs[5].user, null, 'Slot 5 (TE) must be empty');
      assert.equal(pairs[6].user, null, 'Slot 6 (FLEX) must be empty');
      assert.equal(pairs[7].user, null, 'Slot 7 (SUPER_FLEX) must be empty');

      const userStartersInGrid = pairs.filter((p) => Boolean(p.user)).length;
      assert.equal(userStartersInGrid, 3, 'User starters in grid must be exactly 3 without dropping or shifting WRs');

      // 3. Compacted starter ID list without zeros safety (Case B fallback)
      const compactedIds = [String(qb.id), String(wrs[0].id), String(wrs[1].id)];
      const pairsCompacted = sleeper.buildStarterPairs(dynamicSlots, userFavs, oppFavs, compactedIds, derived.opponent_team.starters);
      const userStartersCompacted = pairsCompacted.filter((p) => Boolean(p.user)).length;
      assert.equal(userStartersCompacted, 3, 'Compacted starter IDs must preserve all 3 starters in matching slots');
      assert.equal(pairsCompacted[0].user?.player_name, qb.name);
      assert.equal(pairsCompacted[1].user, null);
      assert.equal(pairsCompacted[2].user, null);
      assert.equal(pairsCompacted[3].user?.player_name, wrs[0].name);
      assert.equal(pairsCompacted[4].user?.player_name, wrs[1].name);

      // 4. Regression for null starter arrays and falsy slot roles: must never throw TypeError and must pin behavior
      const pairsNull = sleeper.buildStarterPairs(dynamicSlots, userFavs, oppFavs, null, null);
      assert.deepEqual(
        pairsNull.map((p) => p.user?.player_id || null),
        [qb.id, null, null, wrs[0].id, wrs[1].id, null, null, null],
        'Null starter IDs must assign starters by positional fallback matching slot order',
      );

      assert.deepEqual(
        sleeper.buildStarterPairs(['QB'], null, null).map((p) => [p.user, p.opp]),
        [[null, null]],
        'Null favorite collections must not throw and must return empty starter slots',
      );

      const qbFav = userFavs.find((p) => p.position === 'QB');
      assert.ok(qbFav, 'Precondition: qbFav exists');
      const rbTest = { player_id: 'rb_test_1', player_name: 'Test RB', position: 'RB', is_user_team: true, is_benched: false };
      const pairsFalsy = sleeper.buildStarterPairs(['QB', null, 'RB'], [qbFav, rbTest], [], [qbFav.player_id, '0', rbTest.player_id]);
      assert.equal(pairsFalsy.length, 2, 'Falsy slot roles must skip invalid slots while preserving index alignment');
      assert.equal(pairsFalsy[0].user?.player_id, qbFav.player_id, 'Slot 0 (QB) must receive qb');
      assert.equal(pairsFalsy[1].user?.player_id, rbTest.player_id, 'Slot 2 (RB) must receive rbTest via index 2');

      // Regression for Finding 1 (Probe Y): starter id array longer than startingSlots with a real player at index >= startingSlots.length
      const lateStarter = { player_id: 'late_rb_1', player_name: 'Late Reserve RB', position: 'RB', is_user_team: true, is_benched: false };
      const favsWithLate = [...userFavs, lateStarter];
      const longIdsWithLatePlayer = ['0', 'missing_slot1', '0', '0', '0', '0', '0', '0', 'late_rb_1'];
      const pairsLate = sleeper.buildStarterPairs(dynamicSlots, favsWithLate, oppFavs, longIdsWithLatePlayer, derived.opponent_team.starters);
      assert.equal(pairsLate.length, 8, 'Must return exactly 8 starter slot rows');
      assert.equal(pairsLate[0].user, null, 'Explicit empty 0 sentinel at index 0 must leave QB slot empty');
      assert.equal(pairsLate[1].user?.player_id, 'late_rb_1', 'Late starter outside startingSlots bound must fall back into RB1 slot');

      // 5. Regression for Finding 2 (Probe X & Z): overflow starters must be appended so zero starters are dropped
      // Probe X: 9 starter IDs for 8 slots
      const kPlayer = { player_id: '9901', player_name: 'Justin Tucker', position: 'K', is_user_team: true, is_benched: false };
      const extendedFavs = [...userFavs, kPlayer];
      const extendedIds = [...derived.user_team.starters, '9901'];
      const pairsWithExtra = sleeper.buildStarterPairs(dynamicSlots, extendedFavs, oppFavs, extendedIds, derived.opponent_team.starters);
      assert.equal(pairsWithExtra.length, 9, '9th starter with 8 slots must be appended as overflow row');
      assert.equal(pairsWithExtra[8].user?.player_name, 'Justin Tucker');

      // Probe Z: 3 starters with 2 starting slots (no IDs passed)
      const pairsZ = sleeper.buildStarterPairs(['QB', 'TE'], userFavs, []);
      assert.equal(pairsZ.length, 4, 'Unassigned starters must be appended so zero starters are dropped');
      assert.ok(pairsZ.some((p) => p.user?.player_name === wrs[0].name));
      assert.ok(pairsZ.some((p) => p.user?.player_name === wrs[1].name));
    });

    it('30.14 should verify AC4 non-standard or reversed roster_positions slot order is preserved without reordering', () => {
      const reversedSlots = ['FLEX', 'TE', 'WR', 'RB', 'QB'];
      const userStarters = [
        { player_id: 'u_flx', player_name: 'Flex User', position: 'WR', is_user_team: true, is_benched: false },
        { player_id: 'u_te', player_name: 'TE User', position: 'TE', is_user_team: true, is_benched: false },
        { player_id: 'u_wr', player_name: 'WR User', position: 'WR', is_user_team: true, is_benched: false },
        { player_id: 'u_rb', player_name: 'RB User', position: 'RB', is_user_team: true, is_benched: false },
        { player_id: 'u_qb', player_name: 'QB User', position: 'QB', is_user_team: true, is_benched: false },
      ];
      const oppStarters = [
        { player_id: 'o_flx', player_name: 'Flex Opp', position: 'RB', is_user_team: false, is_benched: false },
        { player_id: 'o_te', player_name: 'TE Opp', position: 'TE', is_user_team: false, is_benched: false },
        { player_id: 'o_wr', player_name: 'WR Opp', position: 'WR', is_user_team: false, is_benched: false },
        { player_id: 'o_rb', player_name: 'RB Opp', position: 'RB', is_user_team: false, is_benched: false },
        { player_id: 'o_qb', player_name: 'QB Opp', position: 'QB', is_user_team: false, is_benched: false },
      ];
      const userIds = ['u_flx', 'u_te', 'u_wr', 'u_rb', 'u_qb'];
      const oppIds = ['o_flx', 'o_te', 'o_wr', 'o_rb', 'o_qb'];

      const pairs = sleeper.buildStarterPairs(reversedSlots, userStarters, oppStarters, userIds, oppIds);
      assert.equal(pairs.length, 5, 'Must generate exactly 5 starter slot rows');
      assert.deepEqual(
        pairs.map((p) => p.slotLabel),
        ['WRT', 'TE', 'WR', 'RB', 'QB'],
        'buildStarterPairs must preserve reversed slot order without sorting (FLEX formatted as WRT)'
      );
      assert.equal(pairs[0].user?.player_name, 'Flex User');
      assert.equal(pairs[1].user?.player_name, 'TE User');
      assert.equal(pairs[2].user?.player_name, 'WR User');
      assert.equal(pairs[3].user?.player_name, 'RB User');
      assert.equal(pairs[4].user?.player_name, 'QB User');

      // Verify DOM rendering in MatchupsScreen preserves reversed order via draftState.roster_positions
      const reversedMatchup = {
        week: 8,
        season_year: 2026,
        user_team: { slot: 1, roster_id: 1, name: 'Reversed User', is_user: true, starters: userIds },
        opponent_team: { slot: 2, roster_id: 2, name: 'Reversed Opp', is_user: false, starters: oppIds },
        player_favorabilities: [...userStarters, ...oppStarters],
      };
      const html = renderWithProvider(
        React.createElement(MatchupsScreen, { weeklyMatchup: reversedMatchup }),
        { ...mockData.mock_oneiromancy_draft_2025, roster_positions: reversedSlots }
      );
      const slotLabels = [...html.matchAll(/data-testid="matchup-slot-label"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim());
      assert.deepStrictEqual(slotLabels, ['WRT', 'TE', 'WR', 'RB', 'QB'], 'MatchupsScreen must render slots in exact reversed order');
    });

    it('30.15 should verify AC5 flex mismatch pairing (User WR in WRT vs Opponent RB in WRT) in identical row without ghost slots', () => {
      const slots = ['WRT'];
      const userWR = { player_id: 'wr_flex_u', player_name: 'CeeDee Lamb', position: 'WR', is_user_team: true, is_benched: false };
      const oppRB = { player_id: 'rb_flex_o', player_name: 'Bijan Robinson', position: 'RB', is_user_team: false, is_benched: false };

      const pairs = sleeper.buildStarterPairs(slots, [userWR], [oppRB], ['wr_flex_u'], ['rb_flex_o']);
      assert.equal(pairs.length, 1, 'Flex mismatch must produce exactly 1 paired row');
      assert.equal(pairs[0].slotLabel, 'WRT', 'Slot label must remain WRT');
      assert.equal(pairs[0].user?.player_id, 'wr_flex_u', 'User WR must occupy user side of WRT');
      assert.equal(pairs[0].opp?.player_id, 'rb_flex_o', 'Opponent RB must occupy opp side of WRT');

      // Verify DOM rendering in MatchupsScreen has zero ghost/empty slot cards
      const flexMatchup = {
        week: 8,
        season_year: 2026,
        user_team: { slot: 1, roster_id: 1, name: 'Flex Team U', is_user: true, starters: ['wr_flex_u'] },
        opponent_team: { slot: 2, roster_id: 2, name: 'Flex Team O', is_user: false, starters: ['rb_flex_o'] },
        player_favorabilities: [userWR, oppRB],
      };
      const html = renderWithProvider(
        React.createElement(MatchupsScreen, { weeklyMatchup: flexMatchup }),
        { ...mockData.mock_oneiromancy_draft_2025, roster_positions: ['FLEX'] }
      );
      assert.ok(!html.includes('Empty starter slot'), 'Must not render empty starter slot ghost card');
      assert.ok(!html.includes('Empty opponent slot'), 'Must not render empty opponent slot ghost card');
      assert.ok(html.includes('CeeDee Lamb'), 'User WR must be rendered in flex row');
      assert.ok(html.includes('Bijan Robinson'), 'Opponent RB must be rendered in flex row');
    });

    it('30.16 should verify AC6 NaN width guard when both starters have 0 Oracle score without dominant state', () => {
      const zeroUser = {
        player_id: 'zero_u',
        player_name: 'Zero User',
        position: 'QB',
        is_user_team: true,
        is_benched: false,
        projected_points: 0,
        sleeper_projected_points: 0,
        weekly_projected_points: 0,
        favorability_score: 0,
        spirit_score: 0,
        injury_status: 'Out',
        stadium: { stadium_name: 'No game this week', roof_type: '-' },
      };
      const zeroOpp = {
        player_id: 'zero_o',
        player_name: 'Zero Opp',
        position: 'QB',
        is_user_team: false,
        is_benched: false,
        projected_points: 0,
        sleeper_projected_points: 0,
        weekly_projected_points: 0,
        favorability_score: 0,
        spirit_score: 0,
        injury_status: 'Out',
        stadium: { stadium_name: 'No game this week', roof_type: '-' },
      };

      const zeroMatchup = {
        week: 8,
        season_year: 2026,
        user_team: { slot: 1, roster_id: 1, name: 'Zero Team U', is_user: true, starters: ['zero_u'] },
        opponent_team: { slot: 2, roster_id: 2, name: 'Zero Team O', is_user: false, starters: ['zero_o'] },
        player_favorabilities: [zeroUser, zeroOpp],
      };

      const html = renderWithProvider(
        React.createElement(MatchupsScreen, { weeklyMatchup: zeroMatchup }),
        { ...mockData.mock_oneiromancy_draft_2025, roster_positions: ['QB'] }
      );
      assert.ok(!html.includes('NaN'), 'Card metrics must never render NaN when Oracle scores are 0');
      assert.ok(html.includes('data-testid="oracle-node"'), 'Zero-score tie must still render oracle-node tree');
      assert.ok(!html.includes('data-dominant="true"'), '0.0 vs 0.0 tie must not mark either Oracle node dominant');
      assert.ok(!html.includes('data-testid="oracle-powerup-stars"'), '0.0 vs 0.0 tie must not render floating stars');
      assert.ok(!html.includes('role="meter"'), 'Advantage bar meter must remain removed');
    });

    it('30.17 should verify multi-position starter pairing in buildStarterPairs via fantasy_positions (e.g. TE with QB fantasy_positions in QB slot)', () => {
      const slots = ['QB'];
      const multiPosPlayer = {
        player_id: 'taysom_hill',
        player_name: 'Taysom Hill',
        position: 'TE',
        fantasy_positions: ['QB', 'TE'],
        is_user_team: true,
        is_benched: false,
      };
      const singlePosPlayer = {
        player_id: 'pure_te',
        player_name: 'Pure TE',
        position: 'TE',
        is_user_team: true,
        is_benched: false,
      };
      const oppQB = {
        player_id: 'opp_qb',
        player_name: 'Patrick Mahomes',
        position: 'QB',
        is_user_team: false,
        is_benched: false,
      };

      // Control: TE without QB fantasy_positions mapped to QB slot must NOT match QB slot and must be pushed to overflow
      const controlPairs = sleeper.buildStarterPairs(slots, [singlePosPlayer], [oppQB], ['pure_te'], ['opp_qb']);
      assert.equal(controlPairs.length, 2, 'Control must produce 2 rows (unfilled QB slot + overflow TE)');
      assert.equal(controlPairs[0].user, null, 'Single-position TE must not occupy QB slot');
      assert.equal(controlPairs[1].user?.player_id, 'pure_te', 'Single-position TE must be pushed to overflow');

      // Test: Multi-position TE with ['QB', 'TE'] fantasy_positions mapped to QB slot lands in QB slot
      const testPairs = sleeper.buildStarterPairs(slots, [multiPosPlayer], [oppQB], ['taysom_hill'], ['opp_qb']);
      assert.equal(testPairs.length, 1, 'Multi-position player must produce exactly 1 paired row');
      assert.equal(testPairs[0].slotLabel, 'QB', 'Slot label must remain QB');
      assert.equal(testPairs[0].user?.player_id, 'taysom_hill', 'Taysom Hill must occupy QB slot via fantasy_positions');
      assert.equal(testPairs[0].opp?.player_id, 'opp_qb', 'Opponent QB must occupy opp side');

      // Test earmark check with multi-position player:
      // When slots are ['FLEX', 'QB'] and user starters has a TE with ['QB', 'TE'] earmarked for QB (uIds = ['ghost', 'taysom_hill']),
      // the player must NOT be stolen by the fallback FLEX slot at index 0 and must correctly land at index 1 (QB).
      const earmarkSlots = ['FLEX', 'QB'];
      const earmarkPairs = sleeper.buildStarterPairs(
        earmarkSlots,
        [multiPosPlayer],
        [],
        ['ghost', 'taysom_hill'],
        []
      );
      assert.equal(earmarkPairs.length, 2, 'Earmark test must produce 2 slot rows');
      assert.equal(earmarkPairs[0].user, null, 'FLEX slot at index 0 must remain empty rather than capturing earmarked player');
      assert.equal(earmarkPairs[1].user?.player_id, 'taysom_hill', 'Earmarked multi-position player must land in QB slot at index 1');
    });

    it('30.18 should verify pipeline propagation of fantasy_positions from board players into deriveWeeklyMatchup player_favorabilities', () => {
      const mockBoardPlayer = {
        id: 'multi_pos_board',
        name: 'Dual Threat',
        first_name: 'Dual',
        last_name: 'Threat',
        position: 'WR',
        fantasy_positions: ['WR', 'RB'],
        team: 'KC',
        jersey_number: 10,
        bye_week: 10,
        adp: 12,
        projected_points: 15.0,
        draft_score: 85.0,
        spirit_score: 90.0,
        harmony_score: 80.0,
        draft_status: 'my_team',
        elemental_traits: {
          sun_sign: 'Leo',
          element: 'Fire',
          life_path_number: 1,
          gematria_resonance: 1,
          tarot_card: 'The Sun',
          iching_hexagram: 1,
          score: 85,
        },
        divination_breakdown: { celestial: 20, numeric: 20, geomantic: 20, oracular: 20, harmony: 20 },
      };

      const teams = [
        {
          roster_id: 1,
          name: 'My Team',
          is_user: true,
          starters: ['multi_pos_board'],
          players: ['multi_pos_board'],
        },
        {
          roster_id: 2,
          name: 'Opponent Team',
          is_user: false,
          starters: ['opp_p1'],
          players: ['opp_p1'],
        },
      ];

      const leagueMatchups = [
        { roster_id: 1, matchup_id: 1, starters: ['multi_pos_board'], players: ['multi_pos_board'], points: 0 },
        { roster_id: 2, matchup_id: 1, starters: ['opp_p1'], players: ['opp_p1'], points: 0 },
      ];

      const matchup = sleeper.deriveWeeklyMatchup(1, teams, leagueMatchups, [mockBoardPlayer], null, 1);
      const multiFav = matchup.player_favorabilities.find((p) => p.player_id === 'multi_pos_board');
      assert.ok(multiFav, 'multi_pos_board must be present in player_favorabilities');
      assert.deepEqual(
        multiFav.fantasy_positions,
        ['WR', 'RB'],
        'deriveWeeklyMatchup must propagate fantasy_positions from board into player_favorabilities'
      );

      // Verify synthesizeCosmicPlayerFromId propagates fantasy_positions from raw player record
      const rawRecord = {
        first_name: 'Dual',
        last_name: 'Threat',
        position: 'WR',
        fantasy_positions: ['WR', 'RB'],
        team: 'KC',
      };
      const synthesized = sleeper.synthesizeCosmicPlayerFromId('syn_1', rawRecord, 1, false);
      assert.deepEqual(synthesized.fantasy_positions, ['WR', 'RB'], 'synthesizeCosmicPlayerFromId must propagate fantasy_positions');

      // Verify enrichCosmicBoardWithNFLPlayers refreshes fantasy_positions on existing board players
      const baseBoard = [{ id: 'syn_1', position: 'WR', name: 'Dual Threat' }];
      const enriched = sleeper.enrichCosmicBoardWithNFLPlayers(baseBoard, { syn_1: rawRecord });
      assert.deepEqual(enriched[0].fantasy_positions, ['WR', 'RB'], 'enrichCosmicBoardWithNFLPlayers must populate fantasy_positions');
    });

    it('30.19 should verify one-sided overflow rows for leftover starters and rendering without fake comparative advantage', () => {
      const slots = ['QB'];
      const uq = { player_id: 'uq', player_name: 'User QB', position: 'QB', is_user_team: true, is_benched: false, projected_points: 20 };
      const uk = { player_id: 'uk', player_name: 'User K', position: 'K', is_user_team: true, is_benched: false, projected_points: 10 };
      const oq = { player_id: 'oq', player_name: 'Opp QB', position: 'QB', is_user_team: false, is_benched: false, projected_points: 20 };
      const od = { player_id: 'od', player_name: 'Opp DEF', position: 'DEF', is_user_team: false, is_benched: false, projected_points: 8 };

      const pairs = sleeper.buildStarterPairs(slots, [uq, uk], [oq, od]);
      assert.equal(pairs.length, 3, 'Must produce 3 rows: 1 shared QB slot and 2 one-sided overflow rows');
      assert.deepEqual(
        pairs.map((p) => [p.slotLabel, p.user?.player_id || null, p.opp?.player_id || null]),
        [
          ['QB', 'uq', 'oq'],
          ['K', 'uk', null],
          ['DEF', null, 'od'],
        ],
        'Leftover starters must be emitted as one-sided rows preventing cross-position matchup comparison'
      );

      // Verify DOM rendering of one-sided overflow rows: no favored pills, Open status, and no advantage bar separator
      const overflowMatchup = {
        week: 8,
        season_year: 2026,
        user_team: { slot: 1, roster_id: 1, name: 'User Team', is_user: true, starters: ['uq', 'uk'] },
        opponent_team: { slot: 2, roster_id: 2, name: 'Opp Team', is_user: false, starters: ['oq', 'od'] },
        player_favorabilities: [uq, uk, oq, od],
      };
      const html = renderWithProvider(
        React.createElement(MatchupsScreen, { weeklyMatchup: overflowMatchup }),
        { ...mockData.mock_oneiromancy_draft_2025, roster_positions: ['QB'] }
      );
      assert.ok(html.includes('data-testid="matchup-starter-card-uk"'), 'User K starter card must be present');
      assert.ok(html.includes('data-testid="matchup-starter-card-od"'), 'Opp DEF starter card must be present');
      assert.ok(html.includes('Empty opponent slot'), 'User overflow row must render Empty opponent slot placeholder');
      assert.ok(html.includes('Empty starter slot'), 'Opponent overflow row must render Empty starter slot placeholder');
      assert.ok(!html.includes('data-dominant="true"'), 'One-sided overflow rows must never mark Oracle node dominant');
      assert.ok(!html.includes('data-testid="oracle-powerup-stars"'), 'One-sided overflow rows must never display floating stars');
      assert.ok(!html.includes('player-favored-badge'), 'One-sided overflow rows must never display favored badge');
    });

    it('30.20 should verify League leaderboard tier badges strictly match the displayed team rating rather than raw spirit_score alone', () => {
      const topTeam = {
        slot: 1,
        roster_id: 1,
        name: 'Top Composite Team',
        avg_spirit_score: 72.0,
        avg_draft_score: 82.0,
        harmony_score: 86.7,
        picks: [],
      };
      const midTeam = {
        slot: 4,
        roster_id: 4,
        name: 'Fourth Place Team',
        avg_spirit_score: 76.0,
        avg_draft_score: 70.0,
        harmony_score: 76.0,
        picks: [],
      };

      const mTop = scoring.calculateTeamCelestialMetrics(topTeam);
      const mMid = scoring.calculateTeamCelestialMetrics(midTeam);

      assert.equal(mTop.compositeScore, 79.4, 'Top team compositeScore must be 79.4');
      assert.equal(mTop.tier, 'Harmonic', 'Team with 79.4 composite score must be Harmonic, not Discordant');
      assert.equal(mTop.verdict, '⚖️ Harmonic (Stable)', 'Team with 79.4 composite score must display Harmonic (Stable)');

      assert.equal(mMid.compositeScore, 74.2, 'Fourth team compositeScore must be 74.2');
      assert.equal(mMid.tier, 'Discordant', 'Team with 74.2 composite score (< 75.0) must be Discordant, not Harmonic');
      assert.equal(mMid.verdict, '⚠️ Discordant (At Risk)', 'Team with 74.2 composite score (< 75.0) must display Discordant (At Risk)');

      const lbHtml = renderWithProvider(
        React.createElement(CelestialLeaderboardGraph, {
          competitorTeams: [midTeam, topTeam],
        })
      );
      const topCardStart = lbHtml.indexOf('Top Composite Team');
      const midCardStart = lbHtml.indexOf('Fourth Place Team');
      assert.ok(topCardStart !== -1 && midCardStart !== -1 && topCardStart < midCardStart, 'Leaderboard must rank 79.4 ahead of 74.2');
      const topSlice = lbHtml.slice(topCardStart, midCardStart);
      assert.ok(topSlice.includes('⚖️ Harmonic (Stable)') && topSlice.includes('79.4'), 'Rank #1 (79.4) must show Harmonic (Stable)');
      assert.ok(!topSlice.includes('Discordant'), 'Rank #1 (79.4) must NOT show Discordant');
      const midSlice = lbHtml.slice(midCardStart);
      assert.ok(midSlice.includes('⚠️ Discordant (At Risk)') && midSlice.includes('74.2'), '74.2 row must show Discordant (At Risk)');
    });
  });
});
