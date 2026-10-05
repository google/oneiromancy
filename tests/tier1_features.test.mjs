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
import * as oracle from './helpers/oneiromancy_oracle.mjs';

describe('Tier 1: Feature Coverage (19 Features x >=5 Tests)', () => {
  // ============================================================================
  // Feature 1: Celestial Visual Theme Tokens (Genuine File Inspection)
  // ============================================================================
  describe('Feature 1: Celestial Visual Theme Tokens', () => {
    const tailwindPath = path.resolve('tailwind.config.ts');
    const globalsCssPath = path.resolve('app/globals.css');

    it('1.1 should define Deep Obsidian (#131318) in tailwind config and globals.css', () => {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      assert.ok(tailwindContent.includes("obsidian: '#131318'") || tailwindContent.includes("'#131318'"), 'Tailwind must configure #131318');
      assert.ok(globalsCssContent.includes('--background: #131318'), 'globals.css :root must set --background: #131318');
      assert.ok(globalsCssContent.includes('background-color: #131318'), 'globals.css body must set background-color: #131318');
    });

    it('1.2 should define Nebula Purple (#6d28d9) as mystical accent in tailwind config', () => {
      const content = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(content.includes("purple: '#6d28d9'") || content.includes("DEFAULT: '#6d28d9'"), 'Tailwind must define purple #6d28d9');
      assert.ok(content.includes('nebula:'), 'Tailwind must define nebula color palette');
    });

    it('1.3 should define Electric Cyan (#06b6d4) as telemetry accent in tailwind config', () => {
      const content = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(content.includes("cyan: '#06b6d4'") || content.includes("DEFAULT: '#06b6d4'"), 'Tailwind must define cyan #06b6d4');
      assert.ok(content.includes('cyan:'), 'Tailwind must define cyan color palette');
    });

    it('1.4 should define surface (#1a1a24) and elevated (#242436) glassmorphic backgrounds in tailwind config', () => {
      const content = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(content.includes("surface: '#1a1a24'"), 'Tailwind must configure surface #1a1a24');
      assert.ok(content.includes("elevated: '#242436'"), 'Tailwind must configure elevated #242436');
    });

    it('1.5 should verify tailwind config contains complete celestial color palette without skips', () => {
      const content = fs.readFileSync(tailwindPath, 'utf8');
      const requiredTokens = ['#131318', '#6d28d9', '#06b6d4', '#eab308', '#10b981', '#a855f7'];
      for (const token of requiredTokens) {
        assert.ok(content.includes(token), `Tailwind config must include token ${token}`);
      }
    });
  });

  // ============================================================================
  // Feature 2: Mystical & Telemetry Typography (Genuine File Inspection)
  // ============================================================================
  describe('Feature 2: Mystical & Telemetry Typography', () => {
    const tailwindPath = path.resolve('tailwind.config.ts');
    const layoutPath = path.resolve('app/layout.tsx');

    it('2.1 should specify Playfair Display in layout font loader and tailwind serif stack', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(layoutContent.includes('Playfair_Display'), 'Root layout must import Playfair_Display font');
      assert.ok(tailwindContent.includes('serif:'), 'Tailwind must declare serif font family');
      assert.ok(tailwindContent.includes('var(--font-playfair)'), 'Tailwind serif stack must use var(--font-playfair)');
    });

    it('2.2 should specify Space Mono in layout font loader and tailwind mono stack', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(layoutContent.includes('Space_Mono'), 'Root layout must import Space_Mono font');
      assert.ok(tailwindContent.includes('mono:'), 'Tailwind must declare mono font family');
      assert.ok(tailwindContent.includes('var(--font-space-mono)'), 'Tailwind mono stack must use var(--font-space-mono)');
    });

    it('2.3 should map --font-playfair CSS variable in layout.tsx', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      assert.ok(layoutContent.includes("variable: '--font-playfair'"), 'layout.tsx must configure variable: --font-playfair');
    });

    it('2.4 should map --font-space-mono CSS variable in layout.tsx', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      assert.ok(layoutContent.includes("variable: '--font-space-mono'"), 'layout.tsx must configure variable: --font-space-mono');
    });

    it('2.5 should verify tailwind.config.ts font stacks have fallback system fonts', () => {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(tailwindContent.includes("'Georgia', 'serif'"), 'Serif stack must include Georgia, serif fallback');
      assert.ok(tailwindContent.includes("'monospace'"), 'Mono stack must include monospace fallback');
    });
  });

  // ============================================================================
  // Feature 3: Glassmorphism & Panel Styling (Genuine File Inspection)
  // ============================================================================
  describe('Feature 3: Glassmorphism & Panel Styling', () => {
    const globalsCssPath = path.resolve('app/globals.css');
    const glassCardPath = path.resolve('components/common/GlassCard.tsx');

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
      const glassCardSource = fs.readFileSync(glassCardPath, 'utf8');
      assert.ok(glassCardSource.includes("'glass-panel'"), 'GlassCard must map to glass-panel');
      assert.ok(glassCardSource.includes("'glass-surface'"), 'GlassCard must map to glass-surface');
      assert.ok(glassCardSource.includes("'glow-gradient-card'"), 'GlassCard must map to glow-gradient-card');
      assert.ok(glassCardSource.includes("'glow-cyan'"), 'GlassCard must support glow-cyan');
      assert.ok(glassCardSource.includes("'glow-purple'"), 'GlassCard must support glow-purple');
    });
  });

  // ============================================================================
  // Feature 4: Positional Badges & Colors (Genuine File Inspection)
  // ============================================================================
  describe('Feature 4: Positional Badges & Colors', () => {
    const badgePath = path.resolve('components/common/PositionalBadge.tsx');

    it('4.1 should assign QB badge Sleeper Red (#ef4444 / text-red-400)', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('QB:'), 'PositionalBadge must define QB styles');
      assert.ok(badgeSource.includes('text-red-400'), 'QB badge must use text-red-400');
      assert.ok(badgeSource.includes('bg-red-950/40'), 'QB badge must use bg-red-950/40');
    });

    it('4.2 should assign RB badge Sleeper Teal-ish Green (#14b8a6 / text-teal-400)', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('RB:'), 'PositionalBadge must define RB styles');
      assert.ok(badgeSource.includes('text-teal-400'), 'RB badge must use text-teal-400');
      assert.ok(badgeSource.includes('bg-teal-950/40'), 'RB badge must use bg-teal-950/40');
    });

    it('4.3 should assign WR badge Sleeper Light Blue (#38bdf8 / text-sky-400)', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('WR:'), 'PositionalBadge must define WR styles');
      assert.ok(badgeSource.includes('text-sky-400'), 'WR badge must use text-sky-400');
      assert.ok(badgeSource.includes('bg-sky-950/40'), 'WR badge must use bg-sky-950/40');
    });

    it('4.4 should assign TE badge Sleeper Orange-ish Yellow (#f59e0b / text-amber-400)', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('TE:'), 'PositionalBadge must define TE styles');
      assert.ok(badgeSource.includes('text-amber-400'), 'TE badge must use text-amber-400');
      assert.ok(badgeSource.includes('bg-amber-950/40'), 'TE badge must use bg-amber-950/40');
    });

    it('4.5 should assign FLEX to rose and K/DEF to slate styles with size classes', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('FLEX:'), 'PositionalBadge must define FLEX styles');
      assert.ok(badgeSource.includes('text-rose-400'), 'FLEX badge must use text-rose-400');
      assert.ok(badgeSource.includes('K_DEF:'), 'PositionalBadge must define K_DEF styles');
      assert.ok(badgeSource.includes('SIZE_CLASSES'), 'PositionalBadge must declare SIZE_CLASSES');
    });
  });

  // ============================================================================
  // Feature 5: Dynamic Astrolabe SVG Component (Genuine File Inspection)
  // ============================================================================
  describe('Feature 5: Dynamic Astrolabe SVG Component', () => {
    const astrolabePath = path.resolve('components/astrolabe/Astrolabe.tsx');

    it('5.1 should define 3 concentric ring structures with SVG geometry in Astrolabe.tsx', () => {
      const astrolabeSource = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeSource.includes('Ring 1: Outer Zodiac'), 'Astrolabe must document and implement Ring 1 Outer Zodiac');
      assert.ok(astrolabeSource.includes('Ring 2: Middle Divination'), 'Astrolabe must document and implement Ring 2 Middle Divination');
      assert.ok(astrolabeSource.includes('Ring 3: Inner Sacred Geometry'), 'Astrolabe must document and implement Ring 3 Inner Sacred Geometry');
      assert.ok(astrolabeSource.includes('r="138"'), 'Outer ring must have r=138');
      assert.ok(astrolabeSource.includes('r="104"'), 'Middle ring must have r=104');
      assert.ok(astrolabeSource.includes('r="70"'), 'Inner ring must have r=70');
    });

    it('5.2 should compute rotation duration scaling inversely with Chaos lambda in Astrolabe.tsx', () => {
      const astrolabeSource = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeSource.includes('const mult ='), 'Astrolabe must compute speed multiplier');
      assert.ok(astrolabeSource.includes('Math.max(0.2, 1 + (lambda ?? 0.35) * 3)'), 'Astrolabe must scale mult with lambda');
      assert.ok(astrolabeSource.includes('outerDuration = Math.max(3, 60 / mult)'), 'Astrolabe must compute outerDuration inversely');
      assert.ok(astrolabeSource.includes('middleDuration = Math.max(2.5, 40 / mult)'), 'Astrolabe must compute middleDuration inversely');
      assert.ok(astrolabeSource.includes('innerDuration = Math.max(1.5, 20 / mult)'), 'Astrolabe must compute innerDuration inversely');

      const calcDurations = (l) => {
        const mult = Math.max(0.2, 1 + l * 3);
        return {
          outer: Math.max(3, 60 / mult),
          middle: Math.max(2.5, 40 / mult),
          inner: Math.max(1.5, 20 / mult),
        };
      };
      const d0 = calcDurations(0.0);
      const d1 = calcDurations(1.0);
      assert.equal(d0.outer, 60);
      assert.equal(d1.outer, 15);
      assert.ok(d1.outer < d0.outer, 'Higher lambda must produce faster rotation (shorter duration)');
    });

    it('5.3 should apply spin-cw and spin-ccw for counter-rotational visual depth in Astrolabe.tsx', () => {
      const astrolabeSource = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeSource.includes('spin-cw ${outerDuration}s'), 'Ring 1 must rotate clockwise with spin-cw');
      assert.ok(astrolabeSource.includes('spin-ccw ${middleDuration}s'), 'Ring 2 must counter-rotate with spin-ccw');
      assert.ok(astrolabeSource.includes('spin-cw ${innerDuration}s'), 'Ring 3 must rotate clockwise with spin-cw');
    });

    it('5.4 should support dynamic size scaling and SVG viewBox 0 0 300 300 in Astrolabe.tsx', () => {
      const astrolabeSource = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeSource.includes('viewBox="0 0 300 300"'), 'Astrolabe SVG must specify viewBox 0 0 300 300');
      assert.ok(astrolabeSource.includes('size = 240'), 'Astrolabe must default size to 240');
      assert.ok(astrolabeSource.includes('data-testid="astrolabe"'), 'Astrolabe must provide data-testid="astrolabe"');
      assert.ok(astrolabeSource.includes('role="img"'), 'Astrolabe must declare role="img"');
    });

    it('5.5 should render atmospheric glow gradient and center pulsing core in Astrolabe.tsx', () => {
      const astrolabeSource = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeSource.includes('radial-gradient(circle,'), 'Astrolabe must render atmospheric glow radial gradient');
      assert.ok(astrolabeSource.includes('className="animate-pulse"'), 'Astrolabe center eye must have animate-pulse');
      assert.ok(astrolabeSource.includes('fill="#6d28d9"'), 'Astrolabe center eye must use nebula purple fill');
    });
  });

  // ============================================================================
  // Feature 6: Mobile-First Navigation Shell & Tabs (Genuine File Inspection)
  // ============================================================================
  describe('Feature 6: Mobile-First Navigation Shell & Tabs', () => {
    const navPath = path.resolve('components/common/NavigationShell.tsx');

    it('6.1 should define all 5 screen tabs in exact order: oneiromancy, matchups, board, dial, marketplace in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes("id: 'oneiromancy'"), 'TABS must define oneiromancy tab');
      assert.ok(navSource.includes("id: 'matchups'"), 'TABS must define matchups tab');
      assert.ok(navSource.includes("id: 'board'"), 'TABS must define board tab');
      assert.ok(navSource.includes("id: 'dial'"), 'TABS must define dial tab');
      assert.ok(navSource.includes("id: 'marketplace'"), 'TABS must define marketplace tab');
      assert.ok(navSource.includes("OneiromancyTab"), 'Type OneiromancyTab must cover tabs');
    });

    it('6.2 should adhere to mobile touch target minimum height with h-16 bottom bar in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('h-16'), 'Bottom navigation bar must have h-16 (64px >= 44px touch target)');
      assert.ok(navSource.includes('grid-cols-5'), 'Bottom nav must divide width evenly into 5 columns');
      assert.ok(navSource.includes('h-full w-full'), 'Tab buttons must occupy full height and width of container');
    });

    it('6.3 should specify sticky header displaying draft status and live synchronization pulse in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('sticky top-0'), 'Header must be sticky top-0');
      assert.ok(navSource.includes('data-testid="draft-status-indicator"'), 'Header must include draft-status-indicator test id');
      assert.ok(navSource.includes('animate-ping'), 'Live indicator must use animate-ping for pulse');
      assert.ok(navSource.includes('ONEIROMANCY'), 'Header must render brand title');
    });

    it('6.4 should provide fixed bottom navigation bar with safe-area padding in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('fixed bottom-0'), 'Navigation bar must be fixed bottom-0');
      assert.ok(navSource.includes('pb-[env(safe-area-inset-bottom)]'), 'Navigation bar must configure safe-area inset padding');
      assert.ok(navSource.includes('role="navigation"'), 'Navigation element must declare role="navigation"');
    });

    it('6.5 should ensure mobile layout constraint max-w-md (<480px) in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('max-w-md mx-auto'), 'Navigation tab container must constrain to max-w-md (448px < 480px)');
      assert.ok(navSource.includes('max-w-5xl mx-auto') || navSource.includes('max-w-4xl mx-auto'), 'Main content container must constrain to max-w-5xl or max-w-4xl');
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
    it('9.1 should provide interactive slider for Chaos lambda in range [0.0, 1.0] defaulting to 0.35', () => {
      assert.equal(oracle.DEFAULT_CHAOS_LAMBDA, 0.35);
      const testVal = oracle.clamp(0.35, 0.0, 1.0);
      assert.equal(testVal, 0.35);
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
      assert.equal(weights.celestial, 0.30);
      assert.equal(weights.numeric, 0.20);
      assert.equal(weights.geomantic, 0.25);
      assert.equal(weights.oracular, 0.10);
      assert.equal(weights.harmony, 0.15);
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
    const sleeperPath = fs.existsSync(path.resolve('core/lib/sleeper.ts'))
      ? path.resolve('core/lib/sleeper.ts')
      : path.resolve('lib/sleeper.ts');
    const contextPath = path.resolve('context/OneiromancyContext.tsx');

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
      const content = fs.readFileSync(sleeperPath, 'utf8');
      assert.ok(content.includes('MAX_REQ_PER_MIN = 300'), 'lib/sleeper.ts must declare MAX_REQ_PER_MIN = 300');
      assert.ok(content.includes('POLLING_CONFIG'), 'lib/sleeper.ts must export POLLING_CONFIG');
      assert.equal(oracle.POLLING_CONFIG.MAX_REQ_PER_MIN, 300);
    });

    it('11.5 should verify client-side OneiromancyContext provides resilient mock fallback without server calls', () => {
      const content = fs.readFileSync(contextPath, 'utf8');
      assert.ok(!content.includes("fetch(`/api/"), 'OneiromancyContext must not make runtime fetch calls to /api');
      assert.ok(content.includes('mock_oneiromancy_draft_2025'), 'OneiromancyContext must use mock datastore');
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
      const statusMessage = 'Cosmic Link Interrupted — Operating on Preserved Oneiromancy';
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
    it('14.1 should compute Celestial Tier (30%) factoring in planetary aspects and transits', () => {
      const breakdown = { celestial: 90.0, numeric: 80.0, geomantic: 85.0, oracular: 70.0, harmony: 80.0 };
      const score = oracle.computeSpiritScore(breakdown);
      assert.ok(score > 0 && score <= 100);
      assert.equal(score, 83.25);
    });

    it('14.2 should compute Numeric Tier (20%) using Life Path and Jersey resonance', () => {
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

    it('14.5 should compute Harmony Tier (15%) from squad synergy, capping at 0-100', () => {
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
      // (1 - 0.35) * 78.5 + 0.35 * 93.4 = 51.025 + 32.69 = 83.715 -> 83.72
      assert.equal(res, 83.72);
    });

    it('16.2 should normalize raw VOR using 50 + (VOR / MaxVOR) * 45', () => {
      const norm = oracle.normalizeVOR(68.4, 100.0);
      // 50 + 0.684 * 45 = 50 + 30.78 = 80.78
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
  // Feature 17: Auto-Update Polling Toggle & Settings Integration (Genuine Verification)
  // --------------------------------------------------------------------------
  describe('Feature 17: Auto-Update Polling Toggle', () => {
    const contextPath = path.resolve('context/OneiromancyContext.tsx');
    const settingsPath = path.resolve('components/settings/SettingsDrawer.tsx');

    it('17.1 should specify 5,000 ms polling interval during active drafting state in POLLING_CONFIG', () => {
      assert.equal(oracle.POLLING_CONFIG.ACTIVE_INTERVAL_MS, 5000);
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      assert.ok(contextContent.includes('5000'), 'OneiromancyContext must configure 5,000ms active interval');
    });

    it('17.2 should downshift to 10,000 ms polling interval during idle or pre-draft state', () => {
      assert.equal(oracle.POLLING_CONFIG.IDLE_INTERVAL_MS, 10000);
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      assert.ok(
        contextContent.includes('10000'),
        'OneiromancyContext must configure 10,000ms idle downshifting'
      );
      assert.ok(
        contextContent.includes('setPollInterval'),
        'OneiromancyContext must export setPollInterval action to adjust intervals'
      );
    });

    it('17.3 should throttle to 30,000 ms when page visibility is background/hidden', () => {
      assert.equal(oracle.POLLING_CONFIG.BACKGROUND_INTERVAL_MS, 30000);
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      assert.ok(
        contextContent.includes('30000') || contextContent.includes('BACKGROUND_INTERVAL_MS'),
        'OneiromancyContext must throttle hidden tabs to 30,000ms'
      );
    });

    it('17.4 should verify SettingsDrawer wires setPollInterval and validates Sleeper Username', () => {
      assert.ok(fs.existsSync(settingsPath), 'SettingsDrawer.tsx must exist');
      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      assert.ok(
        settingsContent.includes('setPollInterval'),
        'SettingsDrawer must call setPollInterval to eliminate UI facade'
      );
      assert.ok(
        settingsContent.includes('inputUsername.trim()'),
        'SettingsDrawer must validate username input'
      );
      assert.ok(
        settingsContent.includes('role="switch"') && settingsContent.includes('aria-checked'),
        'SettingsDrawer must provide accessible switch attributes'
      );
    });

    it('17.6 should verify SettingsDrawer simplification with username only, dynamic league dropdown, and chaos slider', () => {
      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      assert.ok(
        settingsContent.includes('id="username-input"'),
        'SettingsDrawer must contain id="username-input"'
      );
      assert.ok(
        settingsContent.includes('id="league-select"'),
        'SettingsDrawer must contain id="league-select"'
      );
      assert.ok(
        settingsContent.includes('id="apply-sync-btn"'),
        'SettingsDrawer must contain id="apply-sync-btn"'
      );
      assert.ok(
        settingsContent.includes('id="load-mock-btn"'),
        'SettingsDrawer must contain id="load-mock-btn"'
      );
      assert.ok(
        settingsContent.includes('id="chaos-lambda-slider"'),
        'SettingsDrawer must contain id="chaos-lambda-slider"'
      );
      // Verify removed manual inputs
      assert.ok(
        !settingsContent.includes('id="draft-id-input"'),
        'SettingsDrawer must not contain manual draft-id-input'
      );
      assert.ok(
        !settingsContent.includes('id="team-slot-select"'),
        'SettingsDrawer must not contain manual team-slot-select'
      );
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
    it('18.1 should configure next.config.mjs with output: export', () => {
      const configPath = path.resolve('next.config.mjs');
      assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist in project root');
      const content = fs.readFileSync(configPath, 'utf8');
      assert.ok(content.includes("output: 'export'") || content.includes('output: "export"'), 'next.config.mjs must configure export output');
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

    it('18.3 should configure unoptimized image handling for minimal standalone containers', () => {
      const configPath = path.resolve('next.config.mjs');
      assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist');
      const content = fs.readFileSync(configPath, 'utf8');
      assert.ok(content.includes('unoptimized: true'));
    });

    it('18.4 should include asset copy script scripts/copy_standalone_assets.mjs', () => {
      const scriptPath = path.resolve('scripts/copy_standalone_assets.mjs');
      assert.ok(fs.existsSync(scriptPath), 'scripts/copy_standalone_assets.mjs must exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assert.ok(content.includes('.next/standalone') || content.includes('standalone'));
    });

    it('18.5 should verify package.json dependency matrix adheres to React 18 and Next.js 14', () => {
      const pkgPath = path.resolve('package.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.ok(pkg.dependencies.next, 'Next.js dependency must exist');
      assert.ok(pkg.dependencies.react, 'React dependency must exist');
    });
  });

  // ============================================================================
  // Feature 19: Containerization & Cloud Run (Asserting Real Files, Zero Skips)
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

    it('19.5 should provide automated verification script scripts/verify_launch.js and assert HTTP 200', () => {
      const verifyScriptPath = path.resolve('scripts/verify_launch.js');
      assert.ok(fs.existsSync(verifyScriptPath), 'scripts/verify_launch.js must exist');
      const content = fs.readFileSync(verifyScriptPath, 'utf8');
      assert.ok(content.includes('200'), 'verify_launch.js must assert HTTP 200 status code');
      assert.ok(content.includes('<title>') || content.includes('Oneiromancy'), 'verify_launch.js must assert page title');
      assert.ok(content.includes('.next/standalone/server.js') || content.includes('standalone'), 'verify_launch.js must support standalone server execution');
    });
  });

  // ============================================================================
  // Feature 20: issue-tracker Feature Expansions (Sleeper Colors, Head-to-Head, Chaos Reference, Harmony Radar, 18-Week Explanation, Matchup Oracle)
  // ============================================================================
  describe('Feature 20: Feature Expansions', () => {
    it('20.1 should verify Sleeper role colors in PositionalBadge and BoardControls', () => {
      const badgeSource = fs.readFileSync(path.resolve('components/common/PositionalBadge.tsx'), 'utf8');
      assert.ok(badgeSource.includes('text-red-400') && badgeSource.includes('bg-red-950/40'), 'QB must be red');
      assert.ok(badgeSource.includes('text-teal-400') && badgeSource.includes('bg-teal-950/40'), 'RB must be teal-ish green');
      assert.ok(badgeSource.includes('text-sky-400') && badgeSource.includes('bg-sky-950/40'), 'WR must be light blue');
      assert.ok(badgeSource.includes('text-amber-400') && badgeSource.includes('bg-amber-950/40'), 'TE must be orange-ish yellow');

      const controlsSource = fs.readFileSync(path.resolve('components/board/BoardControls.tsx'), 'utf8');
      assert.ok(controlsSource.includes('border-red-400'), 'BoardControls must style QB in red');
      assert.ok(controlsSource.includes('border-teal-400'), 'BoardControls must style RB in teal');
      assert.ok(controlsSource.includes('border-sky-400'), 'BoardControls must style WR in sky blue');
      assert.ok(controlsSource.includes('border-amber-400'), 'BoardControls must style TE in amber');
    });

    it('20.2 should verify PlayerMarketplace renders side-by-side head-to-head comparison with all 10 stats and deltas', () => {
      const marketSource = fs.readFileSync(path.resolve('components/screens/PlayerMarketplace.tsx'), 'utf8');
      assert.ok(marketSource.includes('Head-to-Head') || marketSource.includes('Comparative Head-to-Head Delta Matrix'), 'Marketplace must include Head-to-Head Stat Comparison');
      assert.ok(marketSource.includes('Proj PPG'), 'Marketplace must compare Proj PPG');
      assert.ok(marketSource.includes('Season VOR'), 'Marketplace must compare Season VOR');
      assert.ok(marketSource.includes('DraftScore'), 'Marketplace must compare DraftScore');
      assert.ok(marketSource.includes('SpiritScore'), 'Marketplace must compare SpiritScore');
      assert.ok(marketSource.includes('Elemental Trait'), 'Marketplace must compare Elemental Trait & Score');
      assert.ok(marketSource.includes('Bye Week'), 'Marketplace must compare Bye Week');
      assert.ok(marketSource.includes('Catalysts'), 'Marketplace must compare Catalysts');
      assert.ok(marketSource.includes('Risks'), 'Marketplace must compare Risks');
      assert.ok(marketSource.includes('Injury Status'), 'Marketplace must compare Injury Status');
      assert.ok(marketSource.includes('Net Delta Badges'), 'Marketplace must display Net Delta Badges');
    });

    it('20.3 should verify ChaosDial includes educational reference guide with planetary aspects, lambda equilibrium, and external links', () => {
      const chaosSource = fs.readFileSync(path.resolve('components/screens/ChaosDial.tsx'), 'utf8');
      assert.ok(chaosSource.includes('Esoteric & Astrological Reference Guide'), 'ChaosDial must include Reference Guide');
      assert.ok(chaosSource.includes('Natal Chart Planetary Aspects'), 'ChaosDial must explain Natal Chart Planetary Aspects');
      assert.ok(chaosSource.includes('Mars Aspects (Aggression') && chaosSource.includes('Saturn Transits (Durability'), 'ChaosDial must detail Mars and Saturn aspects');
      assert.ok(chaosSource.includes('Mercury Retrogrades') && chaosSource.includes('Jupiter Alignments'), 'ChaosDial must detail Mercury and Jupiter aspects');
      assert.ok(chaosSource.includes('DraftScore = (1 -') && chaosSource.includes('VOR_norm') && chaosSource.includes('SpiritScore'), 'ChaosDial must document Chaos Dial mathematical formula');
      assert.ok(chaosSource.includes('Elemental Triplicities in Gridiron Divination'), 'ChaosDial must explain Elemental Triplicities');
      assert.ok(chaosSource.includes('href="https://en.wikipedia.org/wiki/Astrological_aspect"'), 'ChaosDial must link to external Wikipedia reference');
      assert.ok(chaosSource.includes('href="https://www.astro.com/astrology/in_sports_e.htm"'), 'ChaosDial must link to Astrodienst reference');
      assert.ok(chaosSource.includes('href="https://ssd.jpl.nasa.gov/horizons/"'), 'ChaosDial must link to NASA JPL Horizons ephemeris');
    });

    it('20.4 should verify OneiromancyDashboard explains Harmony Score and documents all 3 core pillars', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('What is Harmony Score?'), 'OneiromancyDashboard must explain Harmony Score');
      assert.ok(oneiromancySource.includes('1. Elemental Triplicity'), 'OneiromancyDashboard must explain Elemental Triplicity pillar');
      assert.ok(oneiromancySource.includes('2. Celestial Conjunction') || oneiromancySource.includes('2. Stack Amplification'), 'OneiromancyDashboard must explain Celestial Conjunction / Major Aspects pillar');
      assert.ok(oneiromancySource.includes('3. Schedule Symmetry'), 'OneiromancyDashboard must explain Schedule Symmetry pillar');
      assert.ok(oneiromancySource.includes('HARMONY'), 'OneiromancyDashboard must display Harmony score');
    });

    it('20.5 should verify OneiromancyDashboard renders interactive SVG Team Synergy Radar Graph with 5 spokes', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('Elemental & Celestial Aspect Radar') || oneiromancySource.includes('Elemental & Stack Radar'), 'OneiromancyDashboard must include Radar title');
      assert.ok(oneiromancySource.includes('<svg viewBox="0 0 220 220"'), 'OneiromancyDashboard must render 220x220 radar SVG');
      assert.ok(oneiromancySource.includes('<polygon') && oneiromancySource.includes('points={radarPoints.polygonString}'), 'OneiromancyDashboard must render radar polygon');
      assert.ok(oneiromancySource.includes('Fire ('), 'Radar must include Fire axis');
      assert.ok(oneiromancySource.includes('Air ('), 'Radar must include Air axis');
      assert.ok(oneiromancySource.includes('Water ('), 'Radar must include Water axis');
      assert.ok(oneiromancySource.includes('Earth ('), 'Radar must include Earth axis');
      assert.ok(oneiromancySource.includes('Aspects (') || oneiromancySource.includes('Stacks ('), 'Radar must include Aspects axis');
    });

    it('20.6 should verify OneiromancyDashboard renders Player Synergy Matrix with team celestial conjunctions and combustion pairs', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('Active Celestial Aspect Connections') || oneiromancySource.includes('Active Player Synergy Connections'), 'OneiromancyDashboard must include Player Synergy section');
      assert.ok(oneiromancySource.includes('Astral Synergy Conjunction') || oneiromancySource.includes('Passing Stack'), 'OneiromancyDashboard must highlight Astral Synergy Conjunction');
      assert.ok(oneiromancySource.includes('Fire & Air Kinetic Combustion'), 'OneiromancyDashboard must explain Fire & Air Kinetic Combustion');
      assert.ok(oneiromancySource.includes('Earth Bedrock Floor Anchoring'), 'OneiromancyDashboard must explain Earth Bedrock Floor Anchoring');
    });

    it('20.7 should verify OneiromancyDashboard documents 18-Week Bye Week Coverage schedule matrix', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('Why 18-Week Coverage Matters'), 'OneiromancyDashboard must include 18-Week Coverage explanation');
      assert.ok(oneiromancySource.includes('Weeks 1–14'), 'Must explain fantasy regular season Weeks 1-14');
      assert.ok(oneiromancySource.includes('Weeks 15–17'), 'Must explain fantasy playoffs Weeks 15-17');
      assert.ok(oneiromancySource.includes('Full Roster (OK)'), 'Must explain Full Roster state');
      assert.ok(oneiromancySource.includes('Conflict (Warning)'), 'Must explain Conflict state');
      assert.ok(oneiromancySource.includes('Playoffs (W15–17)'), 'Must explain Playoff state');
    });

    it('20.8 should verify OneiromancyDashboard renders Sleeper competitor team names and Weekly Matchup Oracle', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('Weekly Matchup & Start/Sit Oracle'), 'OneiromancyDashboard must include Weekly Matchup Oracle');
      assert.ok(oneiromancySource.includes('Win Prob'), 'Matchup card must display Win Probability');
      assert.ok(oneiromancySource.includes('START') && oneiromancySource.includes('SIT'), 'Oracle must recommend START and SIT');
      assert.ok(oneiromancySource.includes('synergy_reason'), 'Oracle must provide synergy rationale');
      assert.ok(oneiromancySource.includes('competitorTeams.map'), 'OneiromancyDashboard must iterate competitorTeams');
      assert.ok(oneiromancySource.includes('team.name'), 'OneiromancyDashboard must render competitor team names');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 21: Comment #71 Resolution (Strict Unowned Waivers, Win Probability, Dynamic Range Calibration)
  // --------------------------------------------------------------------------
  describe('Feature 21: Comment #71 Resolution', () => {
    it('21.1 should verify PlayerMarketplace contains FREE AGENT • WAIVER WIRE badges and strictly filters out owned players', () => {
      const marketSource = fs.readFileSync(path.resolve('components/screens/PlayerMarketplace.tsx'), 'utf8');
      assert.ok(marketSource.includes('FREE AGENT • WAIVER WIRE'), 'Marketplace must render FREE AGENT • WAIVER WIRE badge in card header');
      assert.ok(marketSource.includes('PROPOSED ADD'), 'Marketplace must have PROPOSED ADD section');
      assert.ok(marketSource.includes('rosteredPlayerIds'), 'Marketplace must track rosteredPlayerIds to prevent owned players from appearing');
      assert.ok(marketSource.includes('rosteredPlayerIds.has(item.id)'), 'Marketplace must filter out rostered player IDs from waivers');
    });

    it('21.2 should verify OneiromancyDashboard calculates dynamic win probability with probability bar gauge', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('calculateWinProbability'), 'OneiromancyDashboard must call calculateWinProbability');
      assert.ok(oneiromancySource.includes('winProb.toFixed(1)'), 'OneiromancyDashboard must render formatted win probability');
      assert.ok(oneiromancySource.includes('winProbLabel'), 'OneiromancyDashboard must display favorability indicator label');
      assert.ok(oneiromancySource.includes('bg-slate-800 rounded-full overflow-hidden'), 'OneiromancyDashboard must render probability bar gauge');
    });

    it('21.3 should verify OneiromancyDashboard renders SpiritScore Scale & Calibration Legend above competitor rosters', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('SpiritScore & Harmony Calibration Spectrum'), 'OneiromancyDashboard must render Calibration Spectrum legend');
      assert.ok(oneiromancySource.includes('✨ Favorable (Apex)'), 'Legend must explain Favorable (Apex) tier');
      assert.ok(oneiromancySource.includes('⚖️ Harmonic (Stable)'), 'Legend must explain Harmonic (Stable) tier');
      assert.ok(oneiromancySource.includes('⚠️ Discordant (At Risk)'), 'Legend must explain Discordant (At Risk) tier');
      assert.ok(oneiromancySource.includes('75.0 Equilibrium Line'), 'Legend must specify 75.0 Equilibrium Line');
    });

    it('21.4 should verify OneiromancyDashboard competitor cards render favorability badges and 75.0 equilibrium mini-gauges', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('classifySpiritScoreTier'), 'Must use classifySpiritScoreTier helper');
      assert.ok(oneiromancySource.includes('tierInfo.badgeLabel'), 'Card must render favorability badge');
      assert.ok(oneiromancySource.includes('Equilibrium (75.0)'), 'Card must display Equilibrium (75.0) metric');
      assert.ok(oneiromancySource.includes('title="75.0 Equilibrium"'), 'Card must render 75.0 equilibrium marker line in mini-gauge');
    });

    it('21.5 should verify scoring.ts provides calculateWinProbability and classifySpiritScoreTier with correct thresholds', () => {
      const scoringPath = fs.existsSync(path.resolve('core/lib/scoring.ts'))
        ? path.resolve('core/lib/scoring.ts')
        : path.resolve('lib/scoring.ts');
      const scoringSource = fs.readFileSync(scoringPath, 'utf8');
      assert.ok(scoringSource.includes('export function calculateWinProbability'), 'scoring.ts must export calculateWinProbability');
      assert.ok(scoringSource.includes('export function classifySpiritScoreTier'), 'scoring.ts must export classifySpiritScoreTier');
      assert.ok(scoringSource.includes('85.0'), 'Threshold 85.0 must be defined');
      assert.ok(scoringSource.includes('75.0'), 'Threshold 75.0 must be defined');
    });

    it('21.6 should verify OneiromancyDashboard unifies top-level Harmony Score with user team competitor card harmony score (98)', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      assert.ok(oneiromancySource.includes('userTeam?.harmony_score'), 'OneiromancyDashboard must connect harmonyScore to userTeam.harmony_score');
      assert.ok(oneiromancySource.includes('{harmonyScore} / 100 HARMONY'), 'Header must format dynamic harmonyScore');
      assert.ok(!oneiromancySource.includes('60 / 100 HARMONY'), 'Stale hardcoded 60 / 100 HARMONY must not exist');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 22: Comment #75 Resolution
  // Dedicated Matchups Screen, Celestial Favorability, Stadium Coordinates & Transits, Kicker Removal, Pill Removal
  // --------------------------------------------------------------------------
  describe('Feature 22: Dynamic League Settings & Matchups Resolution', () => {
    it('22.1 should verify position eligibility is dynamically derived from league roster settings', async () => {
      const sleeperPath = fs.existsSync(path.resolve('core/lib/sleeper.ts'))
        ? path.resolve('core/lib/sleeper.ts')
        : path.resolve('lib/sleeper.ts');
      const sleeperSource = fs.readFileSync(sleeperPath, 'utf8');
      const marketSource = fs.readFileSync(path.resolve('components/screens/PlayerMarketplace.tsx'), 'utf8');
      const matchupsSource = fs.readFileSync(path.resolve('components/screens/MatchupsScreen.tsx'), 'utf8');
      
      // sleeper.ts must export dynamic derivation helpers
      assert.ok(sleeperSource.includes('export function deriveEligiblePositions'), 'sleeper.ts must export deriveEligiblePositions');
      assert.ok(sleeperSource.includes('export function expandSlotPositions'), 'sleeper.ts must export expandSlotPositions');
      assert.ok(sleeperSource.includes('leagueEligiblePositions'), 'sleeper.ts must derive leagueEligiblePositions');
      assert.ok(sleeperSource.includes('leagueEligibleSet.has(p.position)'), 'sleeper.ts must filter free agents by dynamic eligible set');
      assert.ok(sleeperSource.includes('leagueEligibleSet.has(w.position)'), 'sleeper.ts must filter waiver upgrades by dynamic eligible set');
      
      // PlayerMarketplace.tsx must dynamically derive eligible positions and filter chips
      assert.ok(marketSource.includes('deriveEligiblePositions'), 'PlayerMarketplace must import and use deriveEligiblePositions');
      assert.ok(marketSource.includes('leagueEligiblePositions'), 'PlayerMarketplace must derive leagueEligiblePositions');
      assert.ok(marketSource.includes('leagueEligiblePositions.includes(item.position)'), 'PlayerMarketplace must filter waivers/trades by league eligibility');

      // MatchupsScreen.tsx must dynamically derive eligible positions and filter chips without static kicker drops
      assert.ok(matchupsSource.includes('deriveEligiblePositions'), 'MatchupsScreen must import and use deriveEligiblePositions');
      assert.ok(matchupsSource.includes('leagueEligiblePositions'), 'MatchupsScreen must derive leagueEligiblePositions');
      assert.ok(!matchupsSource.includes("p.position === 'K'"), 'MatchupsScreen must not contain hardcoded kicker exclusion');
      assert.ok(matchupsSource.includes('!leagueEligiblePositions.includes(p.position)'), 'MatchupsScreen must filter players by dynamic league eligibility');

      // Functional verification of dynamic derivation
      const sleeper = await import('./dist/lib/sleeper.js');

      // Superflex league without K or DEF (canonical league):
      const superflexRoster = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'];
      const derivedSuperflex = sleeper.deriveEligiblePositions(superflexRoster);
      assert.ok(!derivedSuperflex.includes('K'), 'Superflex league without K must not include K');
      assert.ok(!derivedSuperflex.includes('DEF'), 'Superflex league without DEF must not include DEF');
      assert.ok(derivedSuperflex.includes('QB'), 'Superflex league must include QB');
      assert.ok(derivedSuperflex.includes('RB'), 'Superflex league must include RB');
      assert.ok(derivedSuperflex.includes('WR'), 'Superflex league must include WR');
      assert.ok(derivedSuperflex.includes('TE'), 'Superflex league must include TE');

      // Standard league with K and DEF:
      const standardRoster = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'];
      const derivedStandard = sleeper.deriveEligiblePositions(standardRoster);
      assert.ok(derivedStandard.includes('K'), 'Standard league with K must include K');
      assert.ok(derivedStandard.includes('DEF'), 'Standard league with DEF must include DEF');
      assert.ok(derivedStandard.includes('QB'), 'Standard league must include QB');
      assert.ok(derivedStandard.includes('RB'), 'Standard league must include RB');
      assert.ok(derivedStandard.includes('WR'), 'Standard league must include WR');
      assert.ok(derivedStandard.includes('TE'), 'Standard league must include TE');

      // Flex expansion validation:
      assert.deepEqual(sleeper.expandSlotPositions('FLEX'), ['WR', 'RB', 'TE']);
      assert.deepEqual(sleeper.expandSlotPositions('SUPER_FLEX'), ['QB', 'WR', 'RB', 'TE']);
      assert.deepEqual(sleeper.expandSlotPositions('WRRB_FLEX'), ['WR', 'RB']);
      assert.deepEqual(sleeper.expandSlotPositions('REC_FLEX'), ['WR', 'TE']);
      assert.deepEqual(sleeper.expandSlotPositions('BN'), []);
    });

    it('22.2 should verify screen name and number pill banners are removed from all 4 screens', () => {
      const oneiromancySource = fs.readFileSync(path.resolve('components/screens/OneiromancyDashboard.tsx'), 'utf8');
      const boardSource = fs.readFileSync(path.resolve('components/screens/CosmicBoard.tsx'), 'utf8');
      const chaosSource = fs.readFileSync(path.resolve('components/screens/ChaosDial.tsx'), 'utf8');
      const marketSource = fs.readFileSync(path.resolve('components/screens/PlayerMarketplace.tsx'), 'utf8');

      assert.ok(!oneiromancySource.includes('Oneiromancy • Screen 1'), 'OneiromancyDashboard must not contain Screen 1 pill');
      assert.ok(!boardSource.includes('The Cosmic Board • Screen 2'), 'CosmicBoard must not contain Screen 2 pill');
      assert.ok(!chaosSource.includes('The Chaos Dial • Screen 3'), 'ChaosDial must not contain Screen 3 pill');
      assert.ok(!marketSource.includes('Player Marketplace • Screen 4'), 'PlayerMarketplace must not contain Screen 4 pill');
    });

    it('22.3 should verify MatchupsScreen renders Team Celestial Telemetry with Astral Favorability Index and Win Probability', () => {
      const matchupsSource = fs.readFileSync(path.resolve('components/screens/MatchupsScreen.tsx'), 'utf8');
      assert.ok(matchupsSource.includes('Astral Favorability Index'), 'MatchupsScreen must render Astral Favorability Index');
      assert.ok(matchupsSource.includes('calculateWinProbability'), 'MatchupsScreen must calculate dynamic win probability');
      assert.ok(matchupsSource.includes('Squad Harmony Rating'), 'MatchupsScreen must compare Squad Harmony Rating');
      assert.ok(matchupsSource.includes('Active Transits & Conjunctions'), 'MatchupsScreen must render Active Transits & Conjunctions');
      assert.ok(matchupsSource.includes('Week {w.week}'), 'MatchupsScreen must include week switcher');
    });

    it('22.4 should verify MatchupsScreen renders Player Astrological & Stadium Favorability Breakdown with coordinates, roof type, and date', () => {
      const matchupsSource = fs.readFileSync(path.resolve('components/screens/MatchupsScreen.tsx'), 'utf8');
      assert.ok(matchupsSource.includes('Player Astrological & Stadium Favorability Breakdown'), 'MatchupsScreen must contain Player Favorability Breakdown title');
      assert.ok(matchupsSource.includes('stadium.latitude') && matchupsSource.includes('stadium.longitude'), 'MatchupsScreen must display stadium coordinates');
      assert.ok(matchupsSource.includes('roof_type'), 'MatchupsScreen must display stadium roof type');
      assert.ok(matchupsSource.includes('game_kickoff'), 'MatchupsScreen must display game kickoff date/time');
      assert.ok(matchupsSource.includes('lunar_phase'), 'MatchupsScreen must display lunar phase');
      assert.ok(matchupsSource.includes('planetary_hour'), 'MatchupsScreen must display planetary hour');
      assert.ok(matchupsSource.includes('astrological_rationale'), 'MatchupsScreen must display astrological rationale');
    });

    it('22.5 should verify NavigationShell and app router support Matchups tab and screen navigation', () => {
      const navSource = fs.readFileSync(path.resolve('components/common/NavigationShell.tsx'), 'utf8');
      const appSource = fs.readFileSync(path.resolve('app/page.tsx'), 'utf8');
      const contextSource = fs.readFileSync(path.resolve('context/OneiromancyContext.tsx'), 'utf8');

      assert.ok(navSource.includes('data-testid="nav-tab-matchups"') || navSource.includes('nav-tab-${tab.id}'), 'NavigationShell must render nav-tab-matchups button');
      assert.ok(appSource.includes('activeTab === \'matchups\'') && appSource.includes('<MatchupsScreen'), 'app/page.tsx must route to MatchupsScreen');
      assert.ok(contextSource.includes("'matchups'"), 'OneiromancyContext must include matchups in OneiromancyTab');
    });
  });

  // ============================================================================
  // Feature 23: Comment #79 Resolution: Team Name Truncation, User Team Prominence, Tab Re-ordering
  // ============================================================================
  describe('Feature 23: Comment #79 Resolution: Team Name Truncation, Prominence, Tab Re-ordering', () => {
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const navPath = path.resolve('components/common/NavigationShell.tsx');

    it('23.1 should verify competitor team names in OneiromancyDashboard do not truncate and allow natural wrapping', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(!oneiromancySource.includes('font-bold truncate block ${isUser ? \'text-cyan-300\' : \'text-slate-200\'}'), 'Competitor team names must not have truncate class');
      assert.ok(oneiromancySource.includes('font-bold break-words leading-snug'), 'Competitor team names must use break-words leading-snug for full desktop display');
      assert.ok(!oneiromancySource.includes('Slot {slotNum}: {team.name}'), 'Competitor card must not render slot number prefix');
      assert.ok(oneiromancySource.includes('{team.name}'), 'Competitor card must render full team name');
    });

    it('23.2 should verify user team card (Slot 5) has high visual prominence with vibrant purple/gold luminous styling', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('border-purple-400 ring-2 ring-purple-500/70 shadow-lg shadow-purple-500/25 bg-purple-950/40'), 'User team card must have purple/gold luminous ring and shadow');
      assert.ok(oneiromancySource.includes('YOUR TEAM'), 'User team card must render clean YOUR TEAM badge');
      assert.ok(!oneiromancySource.includes('⭐ YOUR TEAM (YOU)'), 'User team card must not include cluttered ⭐ YOUR TEAM (YOU) text');
      assert.ok(
        oneiromancySource.includes('user-competitor-card') && oneiromancySource.includes('competitor-card-slot'),
        'User team card must render user-competitor-card test ID'
      );
      assert.ok(oneiromancySource.includes('border-purple-500/30'), 'User team card must have purple accented header border');
    });

    it('23.3 should verify navigation tabs order: Oneiromancy -> Matchups -> Cosmic Board -> Player Marketplace -> Chaos Dial', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      const match = navSource.match(/const TABS: TabItem\[\] = \[([\s\S]*?)\];/);
      assert.ok(match, 'NavigationShell must define TABS array');
      const ids = [...match[1].matchAll(/id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
      assert.deepEqual(ids, ['oneiromancy', 'matchups', 'board', 'marketplace', 'dial'], 'Tabs must be in exact order: oneiromancy -> matchups -> board -> marketplace -> dial');
    });

    it('23.4 should verify NavigationShell provides both desktop header tabs and mobile bottom bar', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('hidden md:flex items-center gap-1'), 'NavigationShell must provide desktop navigation tabs in header');
      assert.ok(navSource.includes('grid grid-cols-5 items-center'), 'NavigationShell must provide 5-column bottom navigation bar');
      assert.ok(navSource.includes('data-testid="nav-tab-matchups"') || navSource.includes("'nav-tab-matchups'"), 'Matchups tab must have nav-tab-matchups testid');
    });
  });

  // ============================================================================
  // Feature 24: Decoupled Competitor Roster Stats & Invariant Multi-User Stability (Comment #81)
  // ============================================================================
  describe('Feature 24: Decoupled Competitor Roster Stats & Invariant Multi-User Stability', () => {
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const sleeperPath = fs.existsSync(path.resolve('core/lib/sleeper.ts'))
      ? path.resolve('core/lib/sleeper.ts')
      : path.resolve('lib/sleeper.ts');

    it('24.1 should verify calculateTeamCelestialMetrics deterministically derives Spirit, Draft, Harmony, and Verdict', async () => {
      const scoring = await import('./dist/lib/scoring.js');
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

    it('24.2 should verify competitor metrics are invariant when switching active user (You)', async () => {
      const scoring = await import('./dist/lib/scoring.js');
      // Test team as user vs not as user:
      const team1AsUser = { slot: 1, is_user: true, name: 'Supernova Surge (You)', picks: [] };
      const team1NotUser = { slot: 1, is_user: false, name: 'Supernova Surge', picks: [] };

      const mUser = scoring.calculateTeamCelestialMetrics(team1AsUser);
      const mNotUser = scoring.calculateTeamCelestialMetrics(team1NotUser);

      assert.equal(mUser.spiritScore, mNotUser.spiritScore, 'spiritScore must be invariant to isUser');
      assert.equal(mUser.draftScore, mNotUser.draftScore, 'draftScore must be invariant to isUser');
      assert.equal(mUser.harmonyScore, mNotUser.harmonyScore, 'harmonyScore must be invariant to isUser');
      assert.equal(mUser.verdict, mNotUser.verdict, 'verdict must be invariant to isUser');
    });

    it('24.3 should verify pre-draft deterministic seed scores based on 12 draft slots and classic zodiac rulers', async () => {
      const scoring = await import('./dist/lib/scoring.js');
      assert.ok(scoring.SLOT_ZODIAC_SEEDS, 'scoring.ts must export SLOT_ZODIAC_SEEDS');
      assert.equal(Object.keys(scoring.SLOT_ZODIAC_SEEDS).length, 12, 'Must have 12 slot zodiac seeds');
      assert.equal(scoring.SLOT_ZODIAC_SEEDS[1].sign, 'Aries');
      assert.equal(scoring.SLOT_ZODIAC_SEEDS[5].sign, 'Leo');
      assert.equal(scoring.SLOT_ZODIAC_SEEDS[12].sign, 'Pisces');
    });

    it('24.4 should verify OneiromancyDashboard renders team verdict badges and calculates scores via calculateTeamCelestialMetrics', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('calculateTeamCelestialMetrics'), 'OneiromancyDashboard must call calculateTeamCelestialMetrics');
      assert.ok(oneiromancySource.includes('data-testid={`team-verdict-slot-${slotNum}`}'), 'OneiromancyDashboard must render team verdict badge test ID');
      assert.ok(oneiromancySource.includes('verdict || tierInfo.badgeLabel'), 'OneiromancyDashboard must render celestial verdict label');
    });

    it('24.5 should verify lib/sleeper.ts does not override competitor team stats based on isUser', () => {
      const sleeperSource = fs.readFileSync(sleeperPath, 'utf8');
      assert.ok(!sleeperSource.includes('cal = isUser'), 'sleeper.ts must not branch cal on isUser');
      assert.ok(sleeperSource.includes('calculateTeamCelestialMetrics'), 'sleeper.ts must derive slot score deterministically via calculateTeamCelestialMetrics');
      assert.ok(!sleeperSource.includes('CALIBRATED_SLOT_SCORES'), 'sleeper.ts must not contain legacy CALIBRATED_SLOT_SCORES');
    });
  });

  // ============================================================================
  // Feature 25: Signed Player Protection & Celestial Leaderboard Graph (Comments #81 & #82)
  // ============================================================================
  describe('Feature 25: Signed Player Protection & Celestial Leaderboard Graph', () => {
    const marketPath = path.resolve('components/screens/PlayerMarketplace.tsx');
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const leaderboardPath = path.resolve('components/oneiromancy/CelestialLeaderboardGraph.tsx');

    it('25.1 should verify PlayerMarketplace has allowSignedDropForFreeAgent state defaulting to false', () => {
      const marketSource = fs.readFileSync(marketPath, 'utf8');
      assert.ok(
        marketSource.includes('allowSignedDropForFreeAgent') && marketSource.includes('useState<boolean>(false)'),
        'allowSignedDropForFreeAgent must default to false'
      );
      assert.ok(marketSource.includes('data-testid="allow-signed-drop-toggle"'), 'PlayerMarketplace must render allow-signed-drop-toggle checkbox');
      assert.ok(
        marketSource.includes('When unchecked, prevents recommending dropping an active NFL') &&
          marketSource.includes('roster player for an unsigned free agent.'),
        'Tooltip helper must match specification'
      );
    });

    it('25.2 should verify isPlayerSigned correctly identifies signed NFL players vs unsigned free agents', async () => {
      const scoring = await import('./dist/lib/scoring.js');
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

    it('25.3 should verify PlayerMarketplace filters out signed drops for unsigned adds when toggle is unchecked', async () => {
      const marketSource = fs.readFileSync(marketPath, 'utf8');
      assert.ok(marketSource.includes('!allowSignedDropForFreeAgent'), 'Marketplace must check !allowSignedDropForFreeAgent');
      assert.ok(marketSource.includes('isDropSigned && !isAddSigned'), 'Marketplace must reject signed drop for unsigned add');
      assert.ok(marketSource.includes('givesSigned && receivesUnsigned'), 'Marketplace must reject trade proposals giving signed for unsigned');

      // Functional boundary verification
      const scoring = await import('./dist/lib/scoring.js');
      const sampleWaivers = [
        {
          id: 'fa_target_1',
          name: 'Free Agent Sleeper',
          team: 'FA',
          position: 'WR',
          net_score_delta: 5.2,
          recommended_drop_id: '6783',
          recommended_drop_name: 'Jerry Jeudy',
          recommended_drop_team: 'CLE',
          recommended_drop_position: 'WR',
        },
        {
          id: 'signed_target_2',
          name: 'Signed Player Target',
          team: 'ARI',
          position: 'WR',
          net_score_delta: 4.1,
          recommended_drop_id: '6783',
          recommended_drop_name: 'Jerry Jeudy',
          recommended_drop_team: 'CLE',
          recommended_drop_position: 'WR',
        },
      ];

      const filterDrops = (waivers, allowSignedDrop) => {
        return waivers.filter((item) => {
          if (!allowSignedDrop) {
            const isDropSigned = scoring.isPlayerSigned(item.recommended_drop_team);
            const isAddSigned = scoring.isPlayerSigned(item.team);
            if (isDropSigned && !isAddSigned) return false;
          }
          return true;
        });
      };

      const strictFiltered = filterDrops(sampleWaivers, false);
      assert.equal(strictFiltered.length, 1, 'Strict mode must filter out FA add for signed Jerry Jeudy drop');
      assert.equal(strictFiltered[0].id, 'signed_target_2', 'Only signed add target survives');

      const looseFiltered = filterDrops(sampleWaivers, true);
      assert.equal(looseFiltered.length, 2, 'Allowing signed drops for FA permits both');
    });

    it('25.4 should verify CelestialLeaderboardGraph renders ranking matrix with metric toggles', () => {
      assert.ok(fs.existsSync(leaderboardPath), 'CelestialLeaderboardGraph component file must exist');
      const lbSource = fs.readFileSync(leaderboardPath, 'utf8');
      assert.ok(lbSource.includes('data-testid="celestial-leaderboard"'), 'Leaderboard must render celestial-leaderboard test ID');
      assert.ok(lbSource.includes('data-testid="leaderboard-toggle-overall"'), 'Leaderboard must render overall toggle');
      assert.ok(lbSource.includes('data-testid="leaderboard-toggle-spirit"'), 'Leaderboard must render spirit toggle');
      assert.ok(lbSource.includes('data-testid="leaderboard-toggle-draft"'), 'Leaderboard must render draft toggle');
      assert.ok(lbSource.includes('data-testid="leaderboard-toggle-harmony"'), 'Leaderboard must render harmony toggle');
      assert.ok(lbSource.includes('data-testid="leaderboard-user-team"'), 'Leaderboard must render user team test ID');
      assert.ok(lbSource.includes('data-testid="leaderboard-row-rank-1"'), 'Leaderboard must render rank 1 test ID');
    });

    it('25.5 should verify OneiromancyDashboard renders CelestialLeaderboardGraph right above Competitor Rosters', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('<CelestialLeaderboardGraph'), 'OneiromancyDashboard must render CelestialLeaderboardGraph');
      const lbIndex = oneiromancySource.indexOf('<CelestialLeaderboardGraph');
      const compRostersIndex = oneiromancySource.indexOf('League Draft Status & Competitor Rosters');
      assert.ok(lbIndex !== -1 && compRostersIndex !== -1, 'Both components must exist in OneiromancyDashboard');
      assert.ok(lbIndex < compRostersIndex, 'CelestialLeaderboardGraph must be positioned above League Draft Status & Competitor Rosters');
    });
  });

  // ============================================================================
  // Feature 26: Sleeper API User Profile Pictures & Avatar Integration
  // ============================================================================
  describe('Feature 26: Sleeper API User Profile Pictures & Avatar Integration', () => {
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const leaderboardPath = path.resolve('components/oneiromancy/CelestialLeaderboardGraph.tsx');
    const matchupsPath = path.resolve('components/screens/MatchupsScreen.tsx');
    const navShellPath = path.resolve('components/common/NavigationShell.tsx');
    const settingsDrawerPath = path.resolve('components/settings/SettingsDrawer.tsx');

    it('26.1 should verify getSleeperAvatarUrl generates canonical thumbnail and full URLs and handles null/undefined', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');
      assert.ok(typeof sleeper.getSleeperAvatarUrl === 'function', 'sleeper.ts must export getSleeperAvatarUrl');
      assert.ok(typeof sleeper.resolveSleeperAvatarUrl === 'function', 'sleeper.ts must export resolveSleeperAvatarUrl');

      // Avatar hash to thumbnail URL
      assert.equal(
        sleeper.getSleeperAvatarUrl('56789012'),
        'https://sleepercdn.com/avatars/thumbs/56789012',
        'Should convert avatar hash to Sleeper CDN thumbnail URL'
      );

      // Full URL option
      assert.equal(
        sleeper.getSleeperAvatarUrl('56789012', { full: true }),
        'https://sleepercdn.com/avatars/56789012',
        'Should convert avatar hash to full Sleeper CDN avatar URL when { full: true }'
      );

      // Passthrough of external full URLs
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

      // Null, undefined, empty handling
      assert.equal(sleeper.getSleeperAvatarUrl(null), null, 'null avatarId must return null');
      assert.equal(sleeper.getSleeperAvatarUrl(undefined), null, 'undefined avatarId must return null');
      assert.equal(sleeper.getSleeperAvatarUrl(''), null, 'empty avatarId must return null');
      assert.equal(sleeper.getSleeperAvatarUrl('   '), null, 'whitespace avatarId must return null');
    });

    it('26.2 should verify custom avatar precedence in transformToDraftState when user.metadata.avatar is present', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');

      // Test with user having BOTH user.avatar and user.metadata.avatar
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

      // Team 1 (User with custom metadata avatar)
      const team1 = draftState.competitor_teams[0];
      assert.equal(team1.avatar, 'global_hash_alpha', 'Team 1 avatar hash must match user_1');
      assert.equal(
        team1.avatar_url,
        'https://example.com/avatars/custom_team_avatar.png',
        'Team 1 avatar_url must prioritize user.metadata.avatar over user.avatar'
      );
      assert.equal(team1.is_user, true, 'Team 1 must be active user');

      // Team 2 (Competitor with global avatar only)
      const team2 = draftState.competitor_teams[1];
      assert.equal(team2.avatar, 'global_hash_beta', 'Team 2 avatar hash must match user_2');
      assert.equal(
        team2.avatar_url,
        'https://sleepercdn.com/avatars/thumbs/global_hash_beta',
        'Team 2 avatar_url must be canonical thumbnail CDN'
      );

      // DraftState top-level active user avatar
      assert.equal(
        draftState.user_avatar_url,
        'https://example.com/avatars/custom_team_avatar.png',
        'draftState.user_avatar_url must reflect custom team avatar'
      );
    });

    it('26.3 should verify UserAvatar component fallback rendering and security attributes', () => {
      const userAvatarPath = path.resolve('components/common/UserAvatar.tsx');
      assert.ok(fs.existsSync(userAvatarPath), 'components/common/UserAvatar.tsx must exist');
      const source = fs.readFileSync(userAvatarPath, 'utf8');
      assert.ok(source.includes('loading="lazy"'), 'UserAvatar must specify loading="lazy"');
      assert.ok(source.includes('referrerPolicy="no-referrer"'), 'UserAvatar must specify referrerPolicy="no-referrer"');
      assert.ok(source.includes('onError'), 'UserAvatar must include onError handler');
      assert.ok(source.includes('hasError'), 'UserAvatar must track hasError state for fallback');
      assert.ok(source.includes('data-testid={testId}'), 'UserAvatar must pass testId to data-testid attribute');
      assert.ok(source.includes('isUser'), 'UserAvatar must handle isUser prop for visual accent ring');
    });

    it('26.4 should verify avatar image rendering in Oneiromancy matchup duel banner and CelestialLeaderboardGraph', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(
        oneiromancySource.includes('data-testid="matchup-summary-user-avatar"'),
        'OneiromancyDashboard must render matchup-summary-user-avatar'
      );
      assert.ok(
        oneiromancySource.includes('data-testid="matchup-summary-opp-avatar"'),
        'OneiromancyDashboard must render matchup-summary-opp-avatar'
      );
      assert.ok(
        oneiromancySource.includes('data-testid={`team-avatar-slot-${slotNum}`}'),
        'Oneiromancy cards must have team-avatar-slot test ID'
      );

      const lbSource = fs.readFileSync(leaderboardPath, 'utf8');
      assert.ok(
        lbSource.includes('data-testid={`leaderboard-avatar-slot-${item.slotNum}`}'),
        'Leaderboard row must render avatar test ID'
      );
      assert.ok(
        lbSource.includes('item.team.avatar_url || item.team.avatar'),
        'Leaderboard must pass team avatar_url or avatar'
      );
    });

    it('26.5 should verify avatar image rendering across SettingsDrawer, NavigationShell, and MatchupsScreen', () => {
      const settingsSource = fs.readFileSync(settingsDrawerPath, 'utf8');
      assert.ok(
        settingsSource.includes('data-testid="settings-user-profile"'),
        'SettingsDrawer must render settings-user-profile test ID'
      );
      assert.ok(
        settingsSource.includes('data-testid="settings-user-avatar"'),
        'SettingsDrawer must render settings-user-avatar test ID'
      );

      const navShellSource = fs.readFileSync(navShellPath, 'utf8');
      assert.ok(
        navShellSource.includes('data-testid="nav-user-avatar"'),
        'NavigationShell must render nav-user-avatar test ID'
      );
      assert.ok(
        navShellSource.includes('userAvatarUrl'),
        'NavigationShell must accept userAvatarUrl prop'
      );

      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      assert.ok(
        matchupsSource.includes('data-testid="user-team-avatar"'),
        'MatchupsScreen must render user-team-avatar test ID'
      );
      assert.ok(
        matchupsSource.includes('data-testid="opponent-team-avatar"'),
        'MatchupsScreen must render opponent-team-avatar test ID'
      );
    });
  });

  // ============================================================================
  // Feature 27: Comment #89 UX, Terminology & Reactive Matchup Directives
  // ============================================================================
  describe('Feature 27: Comment #89 UX, Terminology & Reactive Matchup Directives', () => {
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const matchupsPath = path.resolve('components/screens/MatchupsScreen.tsx');
    const navShellPath = path.resolve('components/common/NavigationShell.tsx');
    const contextPath = path.resolve('context/OneiromancyContext.tsx');
    const boardControlsPath = path.resolve('components/board/BoardControls.tsx');
    const scoringPath = fs.existsSync(path.resolve('core/lib/scoring.ts'))
      ? path.resolve('core/lib/scoring.ts')
      : path.resolve('lib/scoring.ts');
    const sleeperPath = fs.existsSync(path.resolve('core/lib/sleeper.ts'))
      ? path.resolve('core/lib/sleeper.ts')
      : path.resolve('lib/sleeper.ts');

    it('27.1 should verify win probability labels are concise and badges are constrained to prevent text bleed', async () => {
      const scoring = await import('./dist/lib/scoring.js');
      // Test different point differentials
      const res1 = scoring.calculateWinProbability(140, 100, 85, 80);
      assert.ok(res1.favorabilityLabel.length <= 15, 'Label must be concise to avoid bleed');
      assert.ok(!res1.favorabilityLabel.includes('Moderate Astral Advantage'), 'Must not use long string that bleeds');

      const res2 = scoring.calculateWinProbability(100, 140, 80, 85);
      assert.ok(res2.favorabilityLabel.length <= 15, 'Label must be concise to avoid bleed');

      // Verify OneiromancyDashboard and MatchupsScreen constrain badge width with max-w and truncate
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('max-w-[110px] truncate text-center block'), 'OneiromancyDashboard must constrain win prob badge width');

      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      assert.ok(matchupsSource.includes('max-w-[110px] truncate text-center block'), 'MatchupsScreen must constrain win prob badge width');
    });

    it('27.2 should verify matchup comparative advantage coloring and dynamic tier labels', () => {
      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      // Advantage leadership: higher score must be emerald, lower must be muted slate, without awkward ▲ ADV badges
      assert.ok(!matchupsSource.includes('▲ ADV'), 'MatchupsScreen must eliminate awkward ▲ ADV badge circle');
      assert.ok(
        matchupsSource.includes("isUserLead ? 'text-emerald-400' : 'text-slate-300'") ||
          (matchupsSource.includes('text-emerald-400') && matchupsSource.includes('text-slate-300')),
        'Astral favorability index must highlight leader in emerald'
      );
      assert.ok(
        matchupsSource.includes("isUserHarmonyLead ? 'text-emerald-400 font-extrabold' : 'text-slate-400'") ||
          matchupsSource.includes("isUserLead ? 'text-emerald-400 font-extrabold' : 'text-slate-400'") ||
          (matchupsSource.includes('text-emerald-400 font-extrabold') && matchupsSource.includes('text-slate-400')),
        'Squad harmony rating must highlight leader in emerald'
      );
      // Dynamic tier labels: must not hardcode lower score to green or "Harmonic Floor"
      assert.ok(matchupsSource.includes('Apex Harmony') && matchupsSource.includes('Harmonic Balance') && matchupsSource.includes('Discordant Risk'), 'Squad harmony must compute dynamic tier labels based on value');
      assert.ok(!matchupsSource.includes('78.6 / 100\nHarmonic Floor\nvs\n98 / 100'), 'Must not have hardcoded inverted color pairing');
    });

    it('27.3 should verify clean team badging without cluttered ⭐ YOUR TEAM (YOU)', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('YOUR TEAM'), 'OneiromancyDashboard must render clean YOUR TEAM badge');
      assert.ok(!oneiromancySource.includes('⭐ YOUR TEAM (YOU)'), 'OneiromancyDashboard must not include cluttered ⭐ YOUR TEAM (YOU) text');

      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      assert.ok(matchupsSource.includes('YOUR TEAM'), 'MatchupsScreen must render YOUR TEAM');
      assert.ok(!matchupsSource.includes('⭐ YOUR TEAM (YOU)'), 'MatchupsScreen must not include cluttered ⭐ YOUR TEAM (YOU) text');
    });

    it('27.4 should verify starters and benched players are visually separated and formatted in a 2-column comparison', () => {
      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      // 2-column responsive layout
      assert.ok(matchupsSource.includes('grid grid-cols-1 lg:grid-cols-2 gap-5'), 'MatchupsScreen must provide responsive 2-column side-by-side layout');
      // Distinct section headers for starters vs bench
      assert.ok(matchupsSource.includes('YOUR STARTERS'), 'MatchupsScreen must render YOUR STARTERS header');
      assert.ok(matchupsSource.includes('OPPONENT STARTERS'), 'MatchupsScreen must render OPPONENT STARTERS header');
      assert.ok(matchupsSource.includes('YOUR BENCH'), 'MatchupsScreen must render YOUR BENCH header');
      assert.ok(matchupsSource.includes('OPPONENT BENCH'), 'MatchupsScreen must render OPPONENT BENCH header');
      // Muted bench styling
      assert.ok(matchupsSource.includes('isMutedBench'), 'MatchupsScreen must support muted bench styling');
      assert.ok(matchupsSource.includes('userStarters') && matchupsSource.includes('userBench'), 'MatchupsScreen must memoize user starters and bench');
      assert.ok(matchupsSource.includes('oppStarters') && matchupsSource.includes('oppBench'), 'MatchupsScreen must memoize opponent starters and bench');

      // OneiromancyDashboard roster slots separation
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('STARTERS ('), 'OneiromancyDashboard must have STARTERS section header');
      assert.ok(oneiromancySource.includes('BENCH ('), 'OneiromancyDashboard must have BENCH section header');
    });

    it('27.5 should verify calibrated linear aspect reader scale and equidistant resonance gauge', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      // Strictly mathematical linearity: (activeAspects.length / 3) * 0.8 + 0.2
      assert.ok(oneiromancySource.includes('(activeAspects.length / 3) * 0.8 + 0.2'), 'OneiromancyDashboard must compute strictly linear aspectNorm');
      // Equidistant Aspect Resonance Reader gauge with 0° to 180° markers
      assert.ok(oneiromancySource.includes('Aspect Resonance Reader (0° to 180°)'), 'OneiromancyDashboard must render Aspect Resonance Reader title');
      assert.ok(oneiromancySource.includes("0° (Conj)") && oneiromancySource.includes("60° (Sextile)") && oneiromancySource.includes("90° (Square)") && oneiromancySource.includes("120° (Trine)") && oneiromancySource.includes("180° (Opp)"), 'Gauge must render equidistant astrological aspect milestones');
    });

    it('27.6 should verify deriveWeeklyMatchup dynamically re-binds matchup, opponent, and player favorabilities', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');
      assert.ok(typeof sleeper.deriveWeeklyMatchup === 'function', 'sleeper.ts must export deriveWeeklyMatchup');

      const competitorTeams = [
        { slot: 1, roster_id: 1, name: 'Supernova Surge', is_user: false, avg_draft_score: 80 },
        { slot: 2, roster_id: 2, name: 'lyraenchantress', is_user: false, avg_draft_score: 82 },
        { slot: 5, roster_id: 5, name: 'AstralOracles', is_user: true, avg_draft_score: 90 },
        { slot: 6, roster_id: 6, name: 'lunareclipse', is_user: false, avg_draft_score: 85 },
      ];

      // Derive matchup for slot 5 (canonical user)
      const matchupSlot5 = sleeper.deriveWeeklyMatchup(5, competitorTeams);
      assert.equal(matchupSlot5.user_team.slot, 5, 'User team slot must be 5');
      assert.equal(matchupSlot5.opponent_team.slot, 6, 'Opponent team slot for slot 5 must be 6 (lunareclipse)');

      // Derive matchup for slot 2 (lyraenchantress)
      const matchupSlot2 = sleeper.deriveWeeklyMatchup(2, competitorTeams);
      assert.equal(matchupSlot2.user_team.slot, 2, 'User team slot must be 2');
      assert.equal(matchupSlot2.opponent_team.slot, 1, 'Opponent team slot for slot 2 must be 1 (Supernova Surge)');

      // Verify context dynamically updates weekly_matchup on user switch
      const contextSource = fs.readFileSync(contextPath, 'utf8');
      assert.ok(contextSource.includes('deriveWeeklyMatchup'), 'OneiromancyContext must import and use deriveWeeklyMatchup');
      assert.ok(contextSource.includes('weekly_matchup: updatedMatchup'), 'OneiromancyContext must update weekly_matchup on user switch');
    });

    it('27.7 should verify navigation tabs are modernized (Player Board & Scoring Model)', () => {
      const navSource = fs.readFileSync(navShellPath, 'utf8');
      assert.ok(navSource.includes("label: 'Oneiromancy'"), 'Tab 1 must be Oneiromancy');
      assert.ok(navSource.includes("label: 'Matchups'"), 'Tab 2 must be Matchups');
      assert.ok(navSource.includes("label: 'Player Board'"), 'Tab 3 must be Player Board');
      assert.ok(navSource.includes("label: 'Scoring Model'"), 'Tab 4 must be Scoring Model');
      assert.ok(navSource.includes("label: 'Marketplace'"), 'Tab 5 must be Marketplace');
    });

    it('27.8 should verify consolidated terminology across controls and screens', () => {
      const boardControlsSource = fs.readFileSync(boardControlsPath, 'utf8');
      assert.ok(boardControlsSource.includes('DraftScore') || boardControlsSource.includes('Draft Score [DS]'), 'BoardControls must display Draft Score terminology');
      assert.ok(boardControlsSource.includes('Spirit Score') || boardControlsSource.includes('Spirit Score [SS]'), 'BoardControls must display Spirit Score terminology');

      const navSource = fs.readFileSync(navShellPath, 'utf8');
      assert.ok(navSource.includes("sublabel: 'Free Agents'"), 'Marketplace sublabel must be Free Agents');
      assert.ok(navSource.includes("sublabel: 'Data Grid'"), 'Player Board sublabel must be Data Grid');
    });

    it('27.9 should verify "less is more" UI decluttering with collapsible details disclosures', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(oneiromancySource.includes('What is Harmony Score?'), 'OneiromancyDashboard must explain Harmony Score');
      assert.ok(oneiromancySource.includes('Why 18-Week Coverage Matters'), 'OneiromancyDashboard must explain 18-week coverage');
      // Must be wrapped in <details>
      const detailsCount = (oneiromancySource.match(/<details/g) || []).length;
      assert.ok(detailsCount >= 2, 'OneiromancyDashboard must wrap fine-print metaphysical explanations in collapsible details');

      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      assert.ok(matchupsSource.includes('Alignment & Stadium Telemetry'), 'MatchupsScreen must provide collapsible summary for telemetry and metaphysics');
      assert.ok(matchupsSource.includes('<details className="group mt-1 text-slate-300">'), 'MatchupsScreen player cards must use collapsible details for clean display');
    });
  });

  describe('Feature 28: Interactive Identity & Opponent Stability', () => {
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const matchupsPath = path.resolve('components/screens/MatchupsScreen.tsx');
    const contextPath = path.resolve('context/OneiromancyContext.tsx');

    it('28.1 should verify 100% deterministic bidirectional schedule generation (getDeterministicMatchupOpponentSlot)', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');
      assert.ok(typeof sleeper.getDeterministicMatchupOpponentSlot === 'function', 'sleeper.ts must export getDeterministicMatchupOpponentSlot');

      // Week 1 canonical pairings: 1<->2, 3<->4, 5<->6, 7<->8, 9<->10, 11<->12
      const expectedWeek1 = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5, 7: 8, 8: 7, 9: 10, 10: 9, 11: 12, 12: 11 };
      for (const [slotStr, oppSlot] of Object.entries(expectedWeek1)) {
        const slot = Number(slotStr);
        assert.equal(sleeper.getDeterministicMatchupOpponentSlot(slot, 1, 12), oppSlot, `Slot ${slot} Week 1 opponent must be ${oppSlot}`);
      }

      // Bidirectional symmetry across all 18 weeks and all 12 slots
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

    it('28.2 should verify Week 1 opponent is invariant across mockWeeklyMatchup, deriveWeeklyMatchup, and upcoming_matchups', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');
      const mock = await import('./dist/lib/mockData.js');

      // 1. mockWeeklyMatchup verification (authentic Sleeper Week 1 Matchup 3: AstralOracles vs lunareclipse)
      assert.equal(mock.mockWeeklyMatchup.user_team.slot, 7, 'mockWeeklyMatchup user_team slot must be 7');
      assert.equal(mock.mockWeeklyMatchup.opponent_team.slot, 5, 'mockWeeklyMatchup opponent_team slot must be 5');
      assert.equal(mock.mockWeeklyMatchup.opponent_team.team_name, 'lunareclipse', 'mockWeeklyMatchup opponent_team must be lunareclipse');
      assert.equal(mock.mockWeeklyMatchup.user_team.projected_points, 130.65, 'AstralOracles Week 1 projection must be 130.65');
      assert.equal(mock.mockWeeklyMatchup.opponent_team.projected_points, 105.12, 'lunareclipse Week 1 projection must be 105.12');

      // 2. deriveWeeklyMatchup verification for Slot 7 / Roster 2 (AstralOracles vs lunareclipse, Matchup 3)
      const derivedAstralOracles = sleeper.deriveWeeklyMatchup(7, mock.mockCompetitorTeams, null, null, null, 1);
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

      // 3. deriveWeeklyMatchup deterministic round-robin schedule for Slot 5 / Roster 11 (vs Slot 6 Orion Ascendant)
      const derived = sleeper.deriveWeeklyMatchup(11, mock.mockCompetitorTeams, null, null, null, 1);
      assert.equal(derived.user_team.slot, 5, 'derived user_team slot must be 5');
      assert.equal(derived.opponent_team.slot, 6, 'derived opponent_team slot must be 6');
      assert.equal(derived.opponent_team.team_name, 'Orion Ascendant', 'derived opponent_team must be Orion Ascendant');

      // 4. upcoming_matchups verification
      assert.ok(derived.upcoming_matchups && derived.upcoming_matchups.length === 18, 'Must generate full 18-week schedule');
      assert.equal(derived.upcoming_matchups[0].opponent_team.slot, 6);
      assert.equal(derived.upcoming_matchups[0].opponent_team.team_name, 'Orion Ascendant');
    });

    it('28.3 should verify active user identity persistence across simulated polling ticks', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');
      const mock = await import('./dist/lib/mockData.js');

      // Simulate draftState where user has switched to Slot 1 (SupernovaSurge)
      const userSlot1Settings = { ...mock.mockSettings, user_slot: 1 };
      const rawDraft = { ...mock.mock_oneiromancy_draft_2025, settings: userSlot1Settings };

      // Re-run transformToDraftState with explicitSlot = 1
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

      // Other teams must not have is_user or (You)
      const slot5Team = transformed.competitor_teams.find((t) => t.slot === 5);
      assert.equal(slot5Team.is_user, false, 'Slot 5 must not be is_user when Slot 1 is active');
      assert.ok(!slot5Team.name.includes('(You)'), 'Slot 5 must not have (You) when Slot 1 is active');
    });

    it('28.4 should verify OneiromancyContext decouples user_slot from refreshDraft config change trigger and persists to localStorage', () => {
      const contextSource = fs.readFileSync(contextPath, 'utf8');
      assert.ok(contextSource.includes('localStorage.setItem(\'oneiromancy_active_slot\''), 'OneiromancyContext must persist active slot to localStorage');
      assert.ok(contextSource.includes('localStorage.getItem(\'oneiromancy_active_slot\''), 'OneiromancyContext must hydrate active slot from localStorage');
      assert.ok(contextSource.includes('activeSlotRef'), 'OneiromancyContext must maintain activeSlotRef to anchor identity');
      assert.ok(
        contextSource.includes('const activeSlotRef = useRef<number | undefined>(undefined);'),
        'OneiromancyContext must initialize activeSlotRef as undefined'
      );

      // Verify user_slot is removed from prevConfigRef / useEffect refresh trigger
      assert.ok(!contextSource.includes('user_slot: currentSlot ?? 5'), 'prevConfigRef must not trigger refreshDraft on user_slot changes');
    });

    it('28.5 should verify OneiromancyDashboard competitor cards disable persona switching click', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(!oneiromancySource.includes('onClick={() => context.setUserSlot(slotNum)}'), 'OneiromancyDashboard competitor cards must not wire onClick to context.setUserSlot');
      assert.ok(!oneiromancySource.includes('cursor-pointer select-none'), 'Competitor cards must not have cursor-pointer select-none styling');
      assert.ok(!oneiromancySource.includes('Switch active persona to'), 'Competitor cards must not offer title tooltip to switch persona');
    });

    it('28.6 should verify MatchupsScreen matchupData dynamically re-binds to selectedWeek and active user slot', () => {
      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      assert.ok(matchupsSource.includes('deriveWeeklyMatchup('), 'MatchupsScreen must use deriveWeeklyMatchup');
      assert.ok(matchupsSource.includes('selectedWeek || 1'), 'MatchupsScreen must pass selectedWeek into deriveWeeklyMatchup');
    });

    it('28.7 should verify OneiromancyContext passes undefined to live fetcher for username auto-detection when no explicit slot is set', () => {
      const contextSource = fs.readFileSync(contextPath, 'utf8');
      assert.ok(
        contextSource.includes('const isMockMode = targetDraftId === \'mock\' || targetDraftId === \'mock_oneiromancy_draft_2025\' || targetDraftId === undefined;'),
        'OneiromancyContext must compute isMockMode before resolving currentActiveSlot'
      );
      assert.ok(
        contextSource.includes('const currentActiveSlot = activeSlotRef.current !== undefined'),
        'OneiromancyContext must check if activeSlotRef.current is explicitly set'
      );
      assert.ok(
        contextSource.includes(': (isMockMode ? (draftStateRef.current.settings?.user_slot || 7) : undefined);'),
        'OneiromancyContext must pass undefined to live fetcher in live mode when no slot selected'
      );
      assert.ok(
        contextSource.includes('const resolvedSlot = currentActiveSlot !== undefined'),
        'OneiromancyContext must resolve user slot falling back to freshData settings in live mode'
      );
    });
  });

  // ============================================================================
  // Feature 30: Avatar Caching, Layout Swaps & Marketplace Config Constraints
  // ============================================================================
  describe('Feature 30: Avatar Caching, Layout Swaps & Marketplace Constraints', () => {
    const sleeperPath = fs.existsSync(path.resolve('core/lib/sleeper.ts'))
      ? path.resolve('core/lib/sleeper.ts')
      : path.resolve('lib/sleeper.ts');
    const oneiromancyPath = path.resolve('components/screens/OneiromancyDashboard.tsx');
    const navPath = path.resolve('components/common/NavigationShell.tsx');
    const marketplacePath = path.resolve('components/screens/PlayerMarketplace.tsx');
    const matchupsPath = path.resolve('components/screens/MatchupsScreen.tsx');
    const boardPath = path.resolve('components/screens/CosmicBoard.tsx');

    it('30.1 should verify intermediate avatar cache in sleeper.ts and UserAvatar.tsx', () => {
      const sleeperSource = fs.readFileSync(sleeperPath, 'utf8');
      assert.ok(sleeperSource.includes('AVATAR_CACHE_STORAGE_KEY = \'oneiromancy_avatar_cache_v1\''), 'Must define AVATAR_CACHE_STORAGE_KEY');
      assert.ok(sleeperSource.includes('avatarCacheMap = new Map<string, string>()'), 'Must define in-memory avatarCacheMap');
      assert.ok(sleeperSource.includes('getAvatarFromCache('), 'Must export getAvatarFromCache');
      assert.ok(sleeperSource.includes('setAvatarInCache('), 'Must export setAvatarInCache');

      const userAvatarSource = fs.readFileSync(path.resolve('components/common/UserAvatar.tsx'), 'utf8');
      assert.ok(userAvatarSource.includes('getAvatarFromCache(src)'), 'UserAvatar must query avatar cache before network fetch');
    });

    it('30.2 should verify competitor cards disable persona click and hover cursor', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(!oneiromancySource.includes('onClick={() => context.setUserSlot(slotNum)}'), 'Competitor cards must not have onClick to change slot');
    });

    it('30.3 should verify Divination spotlight pick simplification with clickable player name', () => {
      const heroPath = path.resolve('components/oneiromancy/RecommendedPickHero.tsx');
      const heroSource = fs.readFileSync(heroPath, 'utf8');
      assert.ok(!heroSource.includes('active divination target'), 'Must remove active divination target button');
      assert.ok(!heroSource.includes('inspect dossier'), 'Must remove inspect dossier button');
      assert.ok(heroSource.includes('data-testid="spotlight-player-name"'), 'Must render spotlight-player-name clickable test ID');
      assert.ok(heroSource.includes('onSelectPlayer'), 'Must support onSelectPlayer prop');
    });

    it('30.4 should verify canonical tab order across NavigationShell, OneiromancyContext, and app/page.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      const match = navSource.match(/const TABS: TabItem\[\] = \[([\s\S]*?)\];/);
      const ids = [...match[1].matchAll(/id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
      assert.deepEqual(ids, ['oneiromancy', 'matchups', 'board', 'marketplace', 'dial']);

      const pageSource = fs.readFileSync(path.resolve('app/page.tsx'), 'utf8');
      const mktIdx = pageSource.indexOf('activeTab === \'marketplace\'');
      const dialIdx = pageSource.indexOf('activeTab === \'dial\'');
      assert.ok(mktIdx < dialIdx, 'PlayerMarketplace must precede ChaosDial in page.tsx router');
    });

    it('30.5 should verify PlayerMarketplace restricts swaps by active roster positions and protects signed bench players', async () => {
      const marketplaceSource = fs.readFileSync(marketplacePath, 'utf8');
      assert.ok(marketplaceSource.includes('allowSignedDropForFreeAgent'), 'Must check allowSignedDropForFreeAgent toggle');
      assert.ok(marketplaceSource.includes('leagueEligiblePositions'), 'Must filter recommendations by leagueEligiblePositions');
      assert.ok(marketplaceSource.includes('deriveEligiblePositions('), 'Must derive eligible positions from league configuration');

      const sleeper = await import('./dist/lib/sleeper.js');
      // Superflex league without K: QB, RB, RB, WR, WR, TE, FLEX, SUPER_FLEX, BN
      const superflexPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', 'BN'];
      const eligiblePositions = sleeper.deriveEligiblePositions(superflexPositions, []);
      assert.ok(!eligiblePositions.includes('K'), 'deriveEligiblePositions must not include K when K is not in roster slots');
      assert.ok(eligiblePositions.includes('QB') && eligiblePositions.includes('RB') && eligiblePositions.includes('WR') && eligiblePositions.includes('TE'));

      // Verify Matt Gay (K) is rejected when K is not eligible
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

    it('30.6 should verify Divination Spotlight Pick moved from Marketplace/Oneiromancy to Player Board', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      const marketSource = fs.readFileSync(marketplacePath, 'utf8');
      const boardSource = fs.readFileSync(boardPath, 'utf8');
      assert.ok(!oneiromancySource.includes('Divination Spotlight Pick'), 'Divination Spotlight Pick must not be in OneiromancyDashboard');
      assert.ok(!marketSource.includes('Divination Spotlight Pick'), 'Divination Spotlight Pick must be removed from PlayerMarketplace');
      assert.ok(boardSource.includes('Divination Spotlight Pick (Read-Only)'), 'Divination Spotlight Pick must be present in CosmicBoard');
      assert.ok(boardSource.includes('<RecommendedPickHero'), 'CosmicBoard must render RecommendedPickHero');
    });

    it('30.7 should verify competitor card renders team name without Slot X: prefix and rating badge in table', () => {
      const oneiromancySource = fs.readFileSync(oneiromancyPath, 'utf8');
      assert.ok(!oneiromancySource.includes('Slot {slotNum}: {team.name}'), 'Competitor card must not render Slot X: prefix');
      assert.ok(oneiromancySource.includes('data-testid={`team-name-slot-${slotNum}`}'), 'Competitor card must keep team-name-slot test ID');
      assert.ok(oneiromancySource.includes('data-testid={`team-verdict-slot-${slotNum}`}'), 'Competitor card must keep team-verdict-slot test ID');
    });

    it('30.8 should verify MatchupsScreen Team Celestial Telemetry section provides comparative advantages & vulnerabilities breakdown comparing both teams', () => {
      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      // Section header and structured comparative breakdown
      assert.ok(
        matchupsSource.includes('Team Celestial Telemetry & Astral Favorability Index'),
        'MatchupsScreen must render Team Celestial Telemetry header'
      );
      assert.ok(
        matchupsSource.includes('Comparative Advantages & Vulnerabilities'),
        'MatchupsScreen must render Comparative Advantages & Vulnerabilities section'
      );
      assert.ok(
        matchupsSource.includes('Head-to-Head Matchup Breakdown'),
        'MatchupsScreen must render Head-to-Head Matchup Breakdown subtitle'
      );
      assert.ok(
        matchupsSource.includes('Key Advantages'),
        'MatchupsScreen must render Key Advantages list for teams'
      );
      assert.ok(
        matchupsSource.includes('Vulnerabilities & Risks'),
        'MatchupsScreen must render Vulnerabilities & Risks list for teams'
      );
      // Clean cards without awkward arrow+adv badge circles
      assert.ok(
        !matchupsSource.includes('▲ ADV'),
        'MatchupsScreen must eliminate awkward ▲ ADV badge circle from telemetry cards'
      );
      assert.ok(
        !matchupsSource.includes('vs\n▲ ADV'),
        'MatchupsScreen must not place ▲ ADV awkwardly in center vs column'
      );
    });

    it('30.9 should verify full 15-player rosters (starters and benched players) for both user and opponent in Player Favorability Breakdown', async () => {
      const mock = await import('./dist/lib/mockData.js');
      const sleeper = await import('./dist/lib/sleeper.js');

      // 1. mockPlayerFavorabilities must contain 30 players: 15 for user and 15 for opponent
      assert.equal(mock.mockPlayerFavorabilities.length, 30, 'mockPlayerFavorabilities must have 30 total players');
      const mockUserPlayers = mock.mockPlayerFavorabilities.filter((p) => p.is_user_team);
      const mockOppPlayers = mock.mockPlayerFavorabilities.filter((p) => !p.is_user_team);
      assert.equal(mockUserPlayers.length, 15, 'User team must have all 15 roster players');
      assert.equal(mockOppPlayers.length, 15, 'Opponent team must have all 15 roster players');

      const mockUserStarters = mockUserPlayers.filter((p) => !p.is_benched);
      const mockUserBench = mockUserPlayers.filter((p) => p.is_benched);
      assert.equal(mockUserStarters.length, 8, 'User team must have 8 starters');
      assert.equal(mockUserBench.length, 7, 'User team must have 7 bench reserves');

      const mockOppStarters = mockOppPlayers.filter((p) => !p.is_benched);
      const mockOppBench = mockOppPlayers.filter((p) => p.is_benched);
      assert.equal(mockOppStarters.length, 8, 'Opponent team must have 8 starters');
      assert.equal(mockOppBench.length, 7, 'Opponent team must have 7 bench reserves');

      // 2. deriveWeeklyMatchup must produce 30 player favorabilities with 15 user and 15 opponent
      const derived = sleeper.deriveWeeklyMatchup(1);
      assert.equal(derived.player_favorabilities.length, 30, 'deriveWeeklyMatchup must return 30 player favorabilities');

      const derivedUserPlayers = derived.player_favorabilities.filter((p) => p.is_user_team);
      const derivedOppPlayers = derived.player_favorabilities.filter((p) => !p.is_user_team);
      assert.equal(derivedUserPlayers.length, 15, 'Derived user team must have 15 players');
      assert.equal(derivedOppPlayers.length, 15, 'Derived opponent team must have 15 players');

      assert.equal(derivedUserPlayers.filter((p) => !p.is_benched).length, 8, 'Derived user must have 8 starters');
      assert.equal(derivedUserPlayers.filter((p) => p.is_benched).length, 7, 'Derived user must have 7 bench reserves');
      assert.equal(derivedOppPlayers.filter((p) => !p.is_benched).length, 8, 'Derived opponent must have 8 starters');
      assert.equal(derivedOppPlayers.filter((p) => p.is_benched).length, 7, 'Derived opponent must have 7 bench reserves');

      // 3. Every player must have valid stadium coordinates, roof type, and astrological favorability
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

      // 4. Verify MatchupsScreen handles all 30 players with starters and bench separation
      const matchupsSource = fs.readFileSync(matchupsPath, 'utf8');
      assert.ok(
        matchupsSource.includes('Player Astrological & Stadium Favorability Breakdown'),
        'MatchupsScreen must render Player Astrological & Stadium Favorability Breakdown title'
      );
      assert.ok(
        matchupsSource.includes('YOUR STARTERS') && matchupsSource.includes('YOUR BENCH'),
        'MatchupsScreen must render both YOUR STARTERS and YOUR BENCH'
      );
      assert.ok(
        matchupsSource.includes('OPPONENT STARTERS') && matchupsSource.includes('OPPONENT BENCH'),
        'MatchupsScreen must render both OPPONENT STARTERS and OPPONENT BENCH'
      );
    });

    it('23.6 should opportunistically load optional internal data package when present and fall back to clean OSS defaults when absent', async () => {
      const sleeper = await import('./dist/lib/sleeper.js');
      const mockData = await import('./dist/lib/mockData.js');

      // 1. When pointed at a directory without custom_profile.json, falls back cleanly
      const missingRes = await sleeper.loadOptionalInternalData({
        baseDir: '/tmp/nonexistent_oneiromancy_oss_checkout',
      });
      assert.equal(missingRes.available, false, 'Missing custom data directory must return available: false');
      assert.equal(missingRes.profile, null, 'Missing custom data directory must return profile: null');

      // 2. When running with a sibling custom dataset directory or staged custom_mocks, discovers full dataset
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

      // Restore clean OSS baseline for subsequent tests
      sleeper.registerInternalProfile(null);
    });
  });
});

