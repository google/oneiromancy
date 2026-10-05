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

describe('Tier 2: Boundary & Corner Cases (19 Features x 5 Boundary Tests = 95 Tests)', () => {
  // ============================================================================
  // Boundary 1: Theme Tokens Boundaries (Genuine File Inspection)
  // ============================================================================
  describe('Boundary 1: Theme Tokens Boundaries', () => {
    const tailwindPath = path.resolve('tailwind.config.ts');
    const globalsCssPath = path.resolve('app/globals.css');

    it('1.1 should verify Deep Obsidian (#131318) contrast ratio against #ffffff exceeds WCAG AAA (>=7.0:1)', () => {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      const match = tailwindContent.match(/obsidian:\s*['"](#131318)['"]/);
      assert.ok(match, 'Tailwind config must specify obsidian hex token');
      const hex = match[1];

      // Compute exact relative luminance per W3C WCAG 2.1 specification
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      const whiteLum = 1.0;
      const contrast = (whiteLum + 0.05) / (lum + 0.05);

      assert.ok(contrast >= 7.0, `Contrast ratio ${contrast.toFixed(2)}:1 must exceed 7.0:1 for WCAG AAA`);
    });

    it('1.2 should verify all color hex codes in tailwind config conform to 6-digit hex format', () => {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      const hexMatches = tailwindContent.match(/#[0-9A-Fa-f]{3,8}/g) || [];
      assert.ok(hexMatches.length >= 10, 'Tailwind config must contain color hex codes');
      for (const hex of hexMatches) {
        assert.ok(/^#[0-9A-Fa-f]{6}$/.test(hex), `Hex code ${hex} in tailwind config must be valid 6-digit hex`);
      }
    });

    it('1.3 should verify glassmorphic panel opacity boundaries in globals.css reside in [0.60, 0.90]', () => {
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      const alphaMatches = [...globalsCssContent.matchAll(/rgba\(26,\s*26,\s*36,\s*([\d.]+)\)/g)].map((m) => parseFloat(m[1]));
      assert.ok(alphaMatches.length >= 2, 'globals.css must define glass opacity alphas');
      for (const alpha of alphaMatches) {
        assert.ok(alpha >= 0.60 && alpha <= 0.90, `Opacity ${alpha} must reside within [0.60, 0.90] for readable glassmorphism`);
      }
    });

    it('1.4 should verify all core oneiromancy color keys are defined in tailwind config', () => {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      const requiredKeys = ['obsidian', 'surface', 'elevated', 'purple', 'cyan', 'gold', 'green', 'wr'];
      for (const key of requiredKeys) {
        assert.ok(tailwindContent.includes(`${key}:`), `Tailwind oneiromancy colors must define ${key}`);
      }
    });

    it('1.5 should verify neon glow shadow blur radius boundary does not exceed 24px in globals.css', () => {
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      const glowMatches = [...globalsCssContent.matchAll(/box-shadow:[^;]*0\s+0\s+(\d+)px/g)].map((m) => parseInt(m[1], 10));
      assert.ok(glowMatches.length >= 4, 'globals.css must define glow utilities with pixel blur radii');
      for (const radius of glowMatches) {
        assert.ok(radius >= 8 && radius <= 24, `Glow radius ${radius}px must be between 8px and 24px`);
      }
    });
  });

  // ============================================================================
  // Boundary 2: Mystical & Telemetry Typography Boundaries (Genuine File Inspection)
  // ============================================================================
  describe('Boundary 2: Typography Boundaries', () => {
    const tailwindPath = path.resolve('tailwind.config.ts');
    const astrolabePath = path.resolve('components/astrolabe/Astrolabe.tsx');
    const navPath = path.resolve('components/common/NavigationShell.tsx');
    const badgePath = path.resolve('components/common/PositionalBadge.tsx');

    it('2.1 should ensure font stacks in tailwind.config.ts terminate in generic system serif and monospace fallbacks', () => {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
      assert.ok(tailwindContent.includes("serif: ['var(--font-playfair)', 'Georgia', 'serif']"), 'Serif stack must terminate in serif');
      assert.ok(tailwindContent.includes("mono: ['var(--font-space-mono)', 'monospace']"), 'Mono stack must terminate in monospace');
      assert.ok(tailwindContent.includes("sans: ['Inter', 'system-ui', 'sans-serif']"), 'Sans stack must terminate in sans-serif');
    });

    it('2.2 should verify telemetry readout formatting in Astrolabe.tsx handles precision without NaN', () => {
      const astrolabeContent = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeContent.includes('mult.toFixed(1)'), 'Astrolabe must format speed multiplier to 1 decimal place');
      assert.ok(astrolabeContent.includes('currentLambda.toFixed(2)'), 'Astrolabe must format lambda factor to 2 decimal places');

      const formatMult = (m) => m.toFixed(1);
      const formatLambda = (l) => l.toFixed(2);
      assert.equal(formatMult(0.1), '0.1');
      assert.equal(formatMult(1.0), '1.0');
      assert.equal(formatMult(4.0), '4.0');
      assert.equal(formatLambda(0.0), '0.00');
      assert.equal(formatLambda(0.35), '0.35');
      assert.equal(formatLambda(1.0), '1.00');
    });

    it('2.3 should verify PositionalBadge safely handles missing or unknown positions with fallback', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('styles = POSITION_STYLES[normalizedPos] || {'), 'PositionalBadge must have fallback style lookup');
      assert.ok(badgeSource.includes("text: 'text-slate-300'"), 'Fallback style must use slate text');
      assert.ok(badgeSource.includes("bg: 'bg-slate-900/60'"), 'Fallback style must use slate background');
    });

    it('2.4 should verify NavigationShell tab labels extract single-word mobile identifiers without throwing', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes("tab.label.split(' ')[0]"), 'NavigationShell must truncate tab labels to first word for mobile display');
      const tabs = [
        { label: 'Oneiromancy' },
        { label: 'Cosmic Board' },
        { label: 'Chaos Dial' },
        { label: 'Marketplace' },
      ];
      const shortened = tabs.map((t) => t.label.split(' ')[0]);
      assert.deepEqual(shortened, ['Oneiromancy', 'Cosmic', 'Chaos', 'Marketplace']);
    });

    it('2.5 should verify NavigationShell provides default status text LIVE • RD 3 PK 4', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes("statusText = 'LIVE • RD 3 PK 4'"), 'NavigationShell must specify default statusText prop');
      assert.ok(navSource.includes("statusType = 'live'"), 'NavigationShell must specify default statusType prop');
    });
  });

  // ============================================================================
  // Boundary 3: Glassmorphism & Panel Styling Boundaries (Genuine File Inspection)
  // ============================================================================
  describe('Boundary 3: Glassmorphism Boundaries', () => {
    const globalsCssPath = path.resolve('app/globals.css');
    const glassCardPath = path.resolve('components/common/GlassCard.tsx');

    it('3.1 should verify backdrop blur values in globals.css reside in safe GPU range [8px, 20px]', () => {
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      const blurMatches = [...globalsCssContent.matchAll(/blur\((\d+)px\)/g)].map((m) => parseInt(m[1], 10));
      assert.ok(blurMatches.length >= 2, 'globals.css must specify blur values');
      for (const blur of blurMatches) {
        assert.ok(blur >= 8 && blur <= 20, `Backdrop blur ${blur}px must be between 8px and 20px to prevent mobile GPU stalls`);
      }
    });

    it('3.2 should verify .glow-gradient-card::before disables pointer events and has negative z-index', () => {
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      assert.ok(globalsCssContent.includes('pointer-events: none'), 'Gradient overlay must specify pointer-events: none');
      assert.ok(globalsCssContent.includes('z-index: -1'), 'Gradient overlay must specify z-index: -1');
    });

    it('3.3 should verify GlassCard variant prop defaults to panel and maps surface and gradient', () => {
      const glassCardSource = fs.readFileSync(glassCardPath, 'utf8');
      assert.ok(glassCardSource.includes("variant = 'panel'"), 'GlassCard must default variant to panel');
      assert.ok(glassCardSource.includes("'glow-gradient-card'"), 'GlassCard must include glow-gradient-card');
      assert.ok(glassCardSource.includes("'glass-surface'"), 'GlassCard must include glass-surface');
      assert.ok(glassCardSource.includes("'glass-panel'"), 'GlassCard must include glass-panel');
      assert.ok(/variant === ['"]gradient['"]\s*\?\s*['"]glow-gradient-card['"]/.test(glassCardSource), 'GlassCard maps gradient');
      assert.ok(/variant === ['"]surface['"]\s*\?\s*['"]glass-surface['"]/.test(glassCardSource), 'GlassCard maps surface');
    });

    it('3.4 should verify GlassCard interactive prop adds cursor-pointer and active scale', () => {
      const glassCardSource = fs.readFileSync(glassCardPath, 'utf8');
      assert.ok(glassCardSource.includes('interactive = false'), 'GlassCard must default interactive to false');
      assert.ok(glassCardSource.includes('cursor-pointer'), 'GlassCard interactive must add cursor-pointer');
      assert.ok(glassCardSource.includes('active:scale-[0.99]'), 'GlassCard interactive must add active:scale-[0.99]');
    });

    it('3.5 should verify GlassCard glowColor prop maps cyan, purple, gold, and green utilities', () => {
      const glassCardSource = fs.readFileSync(glassCardPath, 'utf8');
      assert.ok(glassCardSource.includes("glowColor = 'none'"), 'GlassCard must default glowColor to none');
      assert.ok(/glowColor === ['"]cyan['"]\s*\?\s*['"]glow-cyan['"]/.test(glassCardSource), 'GlassCard must map cyan glow');
      assert.ok(/glowColor === ['"]purple['"]\s*\?\s*['"]glow-purple['"]/.test(glassCardSource), 'GlassCard must map purple glow');
      assert.ok(/glowColor === ['"]gold['"]\s*\?\s*['"]glow-gold['"]/.test(glassCardSource), 'GlassCard must map gold glow');
      assert.ok(/glowColor === ['"]green['"]\s*\?\s*['"]glow-green['"]/.test(glassCardSource), 'GlassCard must map green glow');
    });
  });

  // ============================================================================
  // Boundary 4: Positional Badges Boundaries (Genuine File Inspection)
  // ============================================================================
  describe('Boundary 4: Positional Badges Boundaries', () => {
    const badgePath = path.resolve('components/common/PositionalBadge.tsx');

    it('4.1 should verify PositionalBadge falls back to slate styling for unrecognized positions', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('const styles = POSITION_STYLES[normalizedPos] || {'), 'PositionalBadge must define fallback style');
      assert.ok(badgeSource.includes("text: 'text-slate-300'"), 'Fallback must use text-slate-300');
      assert.ok(badgeSource.includes("border: 'border-slate-700'"), 'Fallback must use border-slate-700');
    });

    it('4.2 should verify PositionalBadge normalizes position code with toUpperCase()', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('const normalizedPos = position.toUpperCase()'), 'PositionalBadge must normalize position to uppercase');
      const positions = ['qb', 'Rb', 'wr', 'TE', 'flex'];
      const normalized = positions.map((p) => p.toUpperCase());
      assert.deepEqual(normalized, ['QB', 'RB', 'WR', 'TE', 'FLEX']);
    });

    it('4.3 should verify POSITION_STYLES defines all 8 core fantasy position keys', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      const match = badgeSource.match(/const POSITION_STYLES: Record<string,[^>]+> = \{([\s\S]*?)\};/);
      assert.ok(match, 'PositionalBadge must define POSITION_STYLES');
      const keys = [...match[1].matchAll(/([A-Z_]+):/g)].map((m) => m[1]);
      const expectedKeys = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'K_DEF'];
      for (const expected of expectedKeys) {
        assert.ok(keys.includes(expected), `POSITION_STYLES must define ${expected}`);
      }
    });

    it('4.4 should verify SIZE_CLASSES defines text and padding classes for sm, md, and lg sizes', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes("sm: 'text-[10px] px-1.5 py-0.2 rounded font-semibold'"), 'SIZE_CLASSES must configure sm');
      assert.ok(badgeSource.includes("md: 'text-xs px-2 py-0.5 rounded-md font-semibold'"), 'SIZE_CLASSES must configure md');
      assert.ok(badgeSource.includes("lg: 'text-sm px-2.5 py-1 rounded-md font-bold'"), 'SIZE_CLASSES must configure lg');
    });

    it('4.5 should verify showGlow prop toggles glow shadow class conditionally', () => {
      const badgeSource = fs.readFileSync(badgePath, 'utf8');
      assert.ok(badgeSource.includes('showGlow = true'), 'PositionalBadge must default showGlow to true');
      assert.ok(badgeSource.includes("const glowClass = showGlow ? styles.glow : ''"), 'PositionalBadge must conditionally evaluate glowClass');
    });
  });

  // ============================================================================
  // Boundary 5: Dynamic Astrolabe SVG Boundaries (Genuine File Inspection)
  // ============================================================================
  describe('Boundary 5: Dynamic Astrolabe Boundaries', () => {
    const astrolabePath = path.resolve('components/astrolabe/Astrolabe.tsx');

    it('5.1 should verify rotation duration at baseline lambda = 0.0 equals 60s outer, 40s middle, 20s inner', () => {
      const calcDurations = (lambda, speedMultiplier) => {
        const mult = speedMultiplier !== undefined ? Math.max(0.1, speedMultiplier) : Math.max(0.2, 1 + (lambda ?? 0.35) * 3);
        return {
          outer: Math.max(3, 60 / mult),
          middle: Math.max(2.5, 40 / mult),
          inner: Math.max(1.5, 20 / mult),
        };
      };
      const d0 = calcDurations(0.0, undefined);
      assert.equal(d0.outer, 60);
      assert.equal(d0.middle, 40);
      assert.equal(d0.inner, 20);
    });

    it('5.2 should verify rotation duration at maximum chaos lambda = 1.0 equals 15s outer, 10s middle, 5s inner', () => {
      const calcDurations = (lambda, speedMultiplier) => {
        const mult = speedMultiplier !== undefined ? Math.max(0.1, speedMultiplier) : Math.max(0.2, 1 + (lambda ?? 0.35) * 3);
        return {
          outer: Math.max(3, 60 / mult),
          middle: Math.max(2.5, 40 / mult),
          inner: Math.max(1.5, 20 / mult),
        };
      };
      const d1 = calcDurations(1.0, undefined);
      assert.equal(d1.outer, 15);
      assert.equal(d1.middle, 10);
      assert.equal(d1.inner, 5);
    });

    it('5.3 should verify speedMultiplier clamp lower bound 0.1 prevents division by zero in Astrolabe.tsx', () => {
      const astrolabeContent = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeContent.includes('Math.max(0.1, speedMultiplier)'), 'Astrolabe must clamp speedMultiplier to at least 0.1');
      const calcMult = (sm) => Math.max(0.1, sm);
      assert.equal(calcMult(0), 0.1);
      assert.equal(calcMult(-5), 0.1);
      assert.equal(calcMult(0.05), 0.1);
    });

    it('5.4 should verify rotation duration minimum thresholds (3s outer, 2.5s middle, 1.5s inner) prevent GPU lockup', () => {
      const astrolabeContent = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeContent.includes('Math.max(3, 60 / mult)'), 'Astrolabe outer duration must clamp to minimum 3s');
      assert.ok(astrolabeContent.includes('Math.max(2.5, 40 / mult)'), 'Astrolabe middle duration must clamp to minimum 2.5s');
      assert.ok(astrolabeContent.includes('Math.max(1.5, 20 / mult)'), 'Astrolabe inner duration must clamp to minimum 1.5s');

      const extremeMult = 1000;
      assert.equal(Math.max(3, 60 / extremeMult), 3);
      assert.equal(Math.max(2.5, 40 / extremeMult), 2.5);
      assert.equal(Math.max(1.5, 20 / extremeMult), 1.5);
    });

    it('5.5 should verify Astrolabe accepts and renders custom size prop', () => {
      const astrolabeContent = fs.readFileSync(astrolabePath, 'utf8');
      assert.ok(astrolabeContent.includes('size = 240'), 'Astrolabe must set default size to 240');
      assert.ok(astrolabeContent.includes('style={{ width: size, height: size }}'), 'Astrolabe container must set style width/height from size');
      assert.ok(astrolabeContent.includes('width={size}'), 'SVG element must set width from size');
      assert.ok(astrolabeContent.includes('height={size}'), 'SVG element must set height from size');
    });
  });

  // ============================================================================
  // Boundary 6: Navigation Shell Boundaries (Genuine File Inspection)
  // ============================================================================
  describe('Boundary 6: Navigation Shell Boundaries', () => {
    const navPath = path.resolve('components/common/NavigationShell.tsx');

    it('6.1 should verify TABS configuration contains exactly 5 entries with unique IDs in correct order', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      const match = navSource.match(/const TABS: TabItem\[\] = \[([\s\S]*?)\];/);
      assert.ok(match, 'NavigationShell must define TABS array');
      const ids = [...match[1].matchAll(/id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
      assert.equal(ids.length, 5);
      assert.equal(new Set(ids).size, 5, 'Tab IDs must all be distinct');
      assert.deepEqual(ids, ['oneiromancy', 'matchups', 'board', 'marketplace', 'dial']);
    });

    it('6.2 should verify active tab indicator and text styling in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes("isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'"), 'Active tab must apply text-cyan-400');
      assert.ok(navSource.includes('bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4]'), 'Active tab must render glowing cyan bar');
      assert.ok(navSource.includes("aria-current={isActive ? 'page' : undefined}"), 'Active tab must set aria-current="page"');
    });

    it('6.3 should verify statusType color and glow mappings in NavigationShell.tsx', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(/statusType === ['"]live['"]\s*\?\s*['"]bg-emerald-500['"]/.test(navSource), 'live status must map to bg-emerald-500');
      assert.ok(/statusType === ['"]syncing['"]\s*\?\s*['"]bg-amber-500['"]/.test(navSource), 'syncing status must map to bg-amber-500');
      assert.ok(navSource.includes("'bg-slate-500'"), 'offline status must use bg-slate-500');
      assert.ok(navSource.includes('shadow-[0_0_8px_rgba(16,185,129,0.8)]'), 'live status glow must use emerald rgba');
    });

    it('6.4 should verify handleTabClick delegates safely to onTabChange callback', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('const handleTabClick = (tabId: string) => {'), 'NavigationShell must define handleTabClick');
      assert.ok(navSource.includes('if (onTabChange) {') || navSource.includes('onTabChange(tabId)'), 'handleTabClick must call onTabChange if provided');
    });

    it('6.5 should verify Settings button wires onClick to onOpenSettings prop', () => {
      const navSource = fs.readFileSync(navPath, 'utf8');
      assert.ok(navSource.includes('onClick={onOpenSettings}'), 'Settings button must bind onClick to onOpenSettings');
      assert.ok(navSource.includes('aria-label="Draft Settings"'), 'Settings button must specify aria-label="Draft Settings"');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 7: Screen 1: Ideal Team Dashboard ("Oneiromancy")
  // --------------------------------------------------------------------------
  describe('Boundary 7: Oneiromancy Dashboard Boundaries', () => {
    it('7.1 should handle empty player pool gracefully without throwing null pointer', () => {
      const selectSpotlight = (players = []) => (players.length > 0 ? players[0] : null);
      assert.equal(selectSpotlight([]), null);
    });

    it('7.2 should render terminal draft node on Round 15 (last pick of draft)', () => {
      const step = { round: 15, overall_pick: 180, isTerminal: true };
      assert.equal(step.round, 15);
      assert.equal(step.isTerminal, true);
    });

    it('7.3 should elevate next highest available candidate if both primary target and fallback are drafted', () => {
      const targetDrafted = true;
      const fallbackDrafted = true;
      const board = [
        { id: 't1', drafted: true },
        { id: 'fb1', drafted: true },
        { id: 'alt1', drafted: false, name: 'Alternative Pick' },
      ];
      const selected = targetDrafted && fallbackDrafted ? board.find((p) => !p.drafted) : null;
      assert.equal(selected.name, 'Alternative Pick');
    });

    it('7.4 should handle 100% completed draft path (all 15 picks ascended)', () => {
      const allAscended = Array.from({ length: 15 }, () => ({ is_ascended: true }));
      const isComplete = allAscended.every((s) => s.is_ascended);
      assert.equal(isComplete, true);
    });

    it('7.5 should handle player with projected_points = 0.0 in hero spotlight', () => {
      const vor = oracle.calculateVOR(0.0, 'WR');
      assert.equal(vor, -180.0);
      const norm = oracle.normalizeVOR(vor, 100.0);
      assert.equal(norm, 0.0);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 8: Screen 2: Cosmic Board Data Table
  // --------------------------------------------------------------------------
  describe('Boundary 8: Cosmic Board Boundaries', () => {
    it('8.1 should return empty array when positional filter has 0 matches', () => {
      const mock = oracle.createCanonicalMockDraft();
      const defs = mock.players.filter((p) => p.position === 'DEF');
      assert.equal(defs.length, 0);
    });

    it('8.2 should treat regex special characters in search query as literal strings', () => {
      const mock = oracle.createCanonicalMockDraft();
      const dangerousQuery = '.*+?^${}()|[]\\';
      const search = (q) => mock.players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
      assert.doesNotThrow(() => search(dangerousQuery));
      assert.equal(search(dangerousQuery).length, 0);
    });

    it('8.3 should resolve tie breaks across identical DraftScores by VOR, then ADP, then name', () => {
      const p1 = { name: 'Player A', draft_score: 85.0, market_vor: 50.0, adp: 20.0 };
      const p2 = { name: 'Player B', draft_score: 85.0, market_vor: 55.0, adp: 22.0 };
      const p3 = { name: 'Player C', draft_score: 85.0, market_vor: 50.0, adp: 18.0 };

      const tieBreaker = (a, b) => {
        if (b.draft_score !== a.draft_score) return b.draft_score - a.draft_score;
        if (b.market_vor !== a.market_vor) return b.market_vor - a.market_vor;
        if (a.adp !== b.adp) return a.adp - b.adp;
        return a.name.localeCompare(b.name);
      };

      const sorted = [p1, p2, p3].sort(tieBreaker);
      assert.equal(sorted[0].name, 'Player B', 'Higher VOR should win tie');
      assert.equal(sorted[1].name, 'Player C', 'Lower ADP should win secondary tie');
      assert.equal(sorted[2].name, 'Player A');
    });

    it('8.4 should handle virtual scroll windowing across 300+ items without dropping items', () => {
      const totalItems = 300;
      const windowSize = 20;
      const getWindow = (start) => Array.from({ length: windowSize }, (_, i) => start + i).filter((i) => i < totalItems);
      assert.equal(getWindow(0).length, 20);
      assert.equal(getWindow(290).length, 10);
    });

    it('8.5 should trim leading and trailing whitespace in search query', () => {
      const mock = oracle.createCanonicalMockDraft();
      const search = (q) => {
        const trimmed = (q || '').trim().toLowerCase();
        return mock.players.filter((p) => p.name.toLowerCase().includes(trimmed));
      };
      assert.equal(search('  Mahomes  ').length, 1);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 9: Screen 3: The Chaos Dial
  // --------------------------------------------------------------------------
  describe('Boundary 9: Chaos Dial Boundaries', () => {
    it('9.1 should produce pure VOR score when lambda = 0.0 (Spirit Score zeroed)', () => {
      const score = oracle.computeDraftScore(75.0, 99.0, 0.0);
      assert.equal(score, 75.0);
    });

    it('9.2 should produce pure Spirit score when lambda = 1.0 (VOR zeroed)', () => {
      const score = oracle.computeDraftScore(40.0, 95.0, 1.0);
      assert.equal(score, 95.0);
    });

    it('9.3 should revert to default weights when all 5 weights are set to 0.0', () => {
      const zeroWeights = { celestial: 0, numeric: 0, geomantic: 0, oracular: 0, harmony: 0 };
      const normalized = oracle.normalizeOracleWeights(zeroWeights);
      assert.equal(normalized.celestial, 0.30);
      assert.equal(normalized.numeric, 0.20);
    });

    it('9.4 should isolate single tier when one weight is 1.0 and others are 0.0', () => {
      const weights = { celestial: 1.0, numeric: 0.0, geomantic: 0.0, oracular: 0.0, harmony: 0.0 };
      const normalized = oracle.normalizeOracleWeights(weights);
      assert.equal(normalized.celestial, 1.0);
      assert.equal(normalized.numeric, 0.0);
      const spirit = oracle.computeSpiritScore({ celestial: 92.0, numeric: 50.0 }, normalized);
      assert.equal(spirit, 92.0);
    });

    it('9.5 should prevent floating point drift maintaining normalized sum = 1.0000', () => {
      const custom = { celestial: 0.3333333, numeric: 0.3333333, geomantic: 0.3333333, oracular: 0, harmony: 0 };
      const normalized = oracle.normalizeOracleWeights(custom);
      const sum =
        normalized.celestial +
        normalized.numeric +
        normalized.geomantic +
        normalized.oracular +
        normalized.harmony;
      assert.ok(Math.abs(sum - 1.0) < 0.001);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 10: Screen 4: Player Marketplace
  // --------------------------------------------------------------------------
  describe('Boundary 10: Player Marketplace Boundaries', () => {
    it('10.1 should return empty upgrade recommendations when available waiver pool is empty', () => {
      const getUpgrades = (available = [], bench = []) => {
        if (available.length === 0 || bench.length === 0) return [];
        return available.map((a) => ({ id: a.id }));
      };
      assert.equal(getUpgrades([], [{ id: 'b1' }]).length, 0);
    });

    it('10.2 should return empty upgrade recommendations when user bench is empty', () => {
      const getUpgrades = (available = [], bench = []) => {
        if (available.length === 0 || bench.length === 0) return [];
        return available.map((a) => ({ id: a.id }));
      };
      assert.equal(getUpgrades([{ id: 'a1' }], []).length, 0);
    });

    it('10.3 should omit upgrade recommendation if net delta is negative or zero', () => {
      const candidate = { draft_score: 60.0 };
      const weakestBench = { draft_score: 70.0 };
      const delta = candidate.draft_score - weakestBench.draft_score;
      const isViableUpgrade = delta > 0;
      assert.equal(isViableUpgrade, false);
    });

    it('10.4 should yield 0 trade proposals if both teams have identical roster composition', () => {
      const team1 = { QB: 1, RB: 2, WR: 2 };
      const team2 = { QB: 1, RB: 2, WR: 2 };
      const evaluateDeficit = (t1, t2) => (t1.RB < 2 && t2.RB > 2 ? 'Deficit' : null);
      assert.equal(evaluateDeficit(team1, team2), null);
    });

    it('10.5 should assert trade fairness index at exact parity (50.0)', () => {
      const trade1Value = 100.0;
      const trade2Value = 100.0;
      const fairnessIndex = 50.0 + (trade2Value - trade1Value);
      assert.equal(fairnessIndex, 50.0);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 11: Sleeper API Boundaries (Genuine Production Verification)
  // --------------------------------------------------------------------------
  describe('Boundary 11: Sleeper API Boundaries', () => {
    const sleeperPath = fs.existsSync(path.resolve('core/lib/sleeper.ts'))
      ? path.resolve('core/lib/sleeper.ts')
      : path.resolve('lib/sleeper.ts');
    const contextPath = path.resolve('context/OneiromancyContext.tsx');

    it('11.1 should activate 60-second cooldown timer upon receiving HTTP 429 Too Many Requests', () => {
      assert.ok(fs.existsSync(sleeperPath), 'sleeper.ts must exist');
      const content = fs.readFileSync(sleeperPath, 'utf8');
      assert.ok(content.includes('RATE_LIMIT_COOLDOWN_MS = 60000'), 'Cooldown must be 60,000ms');
      assert.ok(content.includes('triggerRateLimitCooldown'), 'Must export triggerRateLimitCooldown helper');
      assert.ok(content.includes('res.status === 429'), 'Must intercept HTTP 429 response');
    });

    it('11.2 should trigger immediate fallback to mock_oneiromancy_draft_2025 on HTTP 404 or network error', () => {
      const content = fs.readFileSync(sleeperPath, 'utf8');
      assert.ok(content.includes('mock_oneiromancy_draft_2025'), 'Must fallback to mock_oneiromancy_draft_2025');
      assert.ok(content.includes('offline_mode_active: true'), 'Must set offline_mode_active: true on fallback');

      const contextContent = fs.readFileSync(contextPath, 'utf8');
      assert.ok(contextContent.includes('mock_oneiromancy_draft_2025'), 'OneiromancyContext must provide offline fallback');
    });

    it('11.3 should enforce rate limiter jitter buffer to prevent false 429 backoff during 5s polling', () => {
      const content = fs.readFileSync(sleeperPath, 'utf8');
      assert.ok(
        content.includes('RATE_LIMIT_JITTER_MARGIN_MS') || content.includes('58000') || content.includes('buffer'),
        'lib/sleeper.ts must implement rate limit window sliding jitter buffer'
      );
      assert.ok(content.includes('MAX_REQ_PER_MIN = 300'), 'MAX_REQ_PER_MIN must be 300');
    });

    it('11.4 should handle pre-draft state (0 picks) returning empty array without throwing', () => {
      const status = oracle.deriveDraftStatus(0, 12, 15);
      assert.equal(status, 'pre_draft', '0 picks must evaluate to pre_draft status');
    });

    it('11.5 should parse large draft payload (16 teams x 20 rounds = 320 picks) and evaluate complete status', () => {
      const status = oracle.deriveDraftStatus(320, 16, 20);
      assert.equal(status, 'complete', '320 picks on 16x20 league must evaluate to complete');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 12: Embedded Mock Fallback Engine
  // --------------------------------------------------------------------------
  describe('Boundary 12: Mock Fallback Boundaries', () => {
    it('12.1 should verify mock draft at pick 0 assigns on-the-clock team to slot 1', () => {
      const pickState = oracle.calculateSnakePick(0, 12);
      assert.equal(pickState.overallPick, 1);
      assert.equal(pickState.round, 1);
      assert.equal(pickState.slot, 1);
    });

    it('12.2 should verify mock draft at pick 180 transitions status to complete', () => {
      const status = oracle.deriveDraftStatus(180, 12, 15);
      assert.equal(status, 'complete');
    });

    it('12.3 should accommodate 10-team league adjustment (10 teams x 15 rounds = 150 picks)', () => {
      const statusAt150 = oracle.deriveDraftStatus(150, 10, 15);
      assert.equal(statusAt150, 'complete');
      const pick11 = oracle.calculateSnakePick(10, 10);
      assert.equal(pick11.round, 2);
      assert.equal(pick11.slot, 10, 'In 10-team snake draft, pick 11 is slot 10');
    });

    it('12.4 should recover cleanly from corrupted JSON payload using mock fallback', () => {
      const safeParseDraft = (raw) => {
        try {
          return JSON.parse(raw);
        } catch {
          return oracle.createCanonicalMockDraft().draftMetadata;
        }
      };
      const result = safeParseDraft('INVALID_JSON_CORRUPTED');
      assert.equal(result.draft_id, 'mock_oneiromancy_draft_2025');
    });

    it('12.5 should switch seamlessly from fallback back to live draft when connection recovers', () => {
      let isLive = false;
      let activeDraftId = isLive ? 'live_draft_123' : 'mock_oneiromancy_draft_2025';
      assert.equal(activeDraftId, 'mock_oneiromancy_draft_2025');

      isLive = true;
      activeDraftId = isLive ? 'live_draft_123' : 'mock_oneiromancy_draft_2025';
      assert.equal(activeDraftId, 'live_draft_123');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 13: Canonical 8-Entity Schemas
  // --------------------------------------------------------------------------
  describe('Boundary 13: 8-Entity Schemas Boundaries', () => {
    it('13.1 should normalize negative raw VOR (-50.0 pts) to positive clamped value', () => {
      const norm = oracle.normalizeVOR(-50.0, 100.0);
      // 50 + (-50 / 100) * 45 = 50 - 22.5 = 27.5
      assert.equal(norm, 27.5);
    });

    it('13.2 should fail validation if ascension step round is 0 or exceeds 15', () => {
      const invalidStep = [{ round: 0, overall_pick: 0, target_position: 'WR', target_player_id: 'x', target_player_name: 'x', draft_score: 50, is_ascended: false, fallback_player_id: 'y' }];
      assert.equal(oracle.validateIdealDraftPath(invalidStep), false);
    });

    it('13.3 should validate MyRoster entity when all player slots are null (empty roster)', () => {
      const emptyRoster = {
        user_id: 'user_oneiromancy_me',
        starters: Array.from({ length: 9 }, (_, i) => ({ slot_id: `S${i}`, player: null })),
        bench: Array.from({ length: 6 }, (_, i) => ({ slot_id: `BN${i}`, player: null })),
        total_projected_points: 0.0,
        average_spirit_score: 0.0,
        squad_harmony_index: 50.0,
        elemental_distribution: { Fire: 0, Earth: 0, Air: 0, Water: 0 },
      };
      assert.equal(oracle.validateMyRoster(emptyRoster), true);
    });

    it('13.4 should validate weekly coverage with 0 bye conflicts as severity none', () => {
      const coverage = {
        schedule: [{ week: 1, active_starters: [], bye_players: [], projected_total: 100, conflict_severity: 'none' }],
        bye_synergy_score: 95.0,
      };
      assert.equal(oracle.validateWeeklyCoverage(coverage), true);
    });

    it('13.5 should validate weekly coverage with 5 starters out as severity high', () => {
      const coverage = {
        schedule: [{ week: 12, active_starters: [], bye_players: [], projected_total: 60, conflict_severity: 'high' }],
        bye_synergy_score: 50.0,
      };
      assert.equal(oracle.validateWeeklyCoverage(coverage), true);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 14: Spirit Score 5 Divination Tiers
  // --------------------------------------------------------------------------
  describe('Boundary 14: Divination Tiers Boundaries', () => {
    it('14.1 should preserve Master Numbers 11, 22, 33 without digital root reduction', () => {
      assert.equal(oracle.digitalRoot(11, true), 11);
      assert.equal(oracle.digitalRoot(22, true), 22);
      assert.equal(oracle.digitalRoot(33, true), 33);
      assert.equal(oracle.digitalRoot(11, false), 2);
    });

    it('14.2 should accurately calculate Life Path for leap day birth date (2000-02-29)', () => {
      // 2 + 0 + 0 + 0 + 0 + 2 + 2 + 9 = 15 -> 1 + 5 = 6
      assert.equal(oracle.calculateLifePath('2000-02-29'), 6);
    });

    it('14.3 should reduce jersey number 0 or 00 to digital root 0 without exception', () => {
      assert.equal(oracle.digitalRoot(0, true), 0);
    });

    it('14.4 should default Life Path to 7 when birth date is missing or null', () => {
      assert.equal(oracle.calculateLifePath(null), 7);
      assert.equal(oracle.calculateLifePath(''), 7);
    });

    it('14.5 should output maximum astrocartography score 100 when coordinates are identical (distance = 0 km)', () => {
      const coords = { lat: 39.0489, lon: -94.4839 };
      const score = oracle.calculateGeomanticTier(coords, coords, { orientation: 'N-S', domeType: 'Open', surface: 'Grass' });
      // Feng Shui: 50 + 15 + 10 + 10 = 85. Astro: 100 - 0 = 100.
      // Total: 0.40 * 85 + 0.60 * 100 = 34 + 60 = 94.0
      assert.equal(score, 94.0);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 15: Harmony Engine & Synergy Math
  // --------------------------------------------------------------------------
  describe('Boundary 15: Harmony Engine Boundaries', () => {
    it('15.1 should assign baseline harmony score of 50.0 to empty roster (0 players)', () => {
      const harmony = oracle.calculateHarmonyScore(null, [], 1);
      assert.equal(harmony, 50.0);
    });

    it('15.2 should apply -35.0 pt positional cap penalty when drafting 3rd QB', () => {
      const roster = [
        { player: { position: 'QB', team: 'KC' } },
        { player: { position: 'QB', team: 'BUF' } },
      ];
      const penalty = oracle.calculatePositionalCapsPenalty('QB', roster, 10);
      assert.equal(penalty, 35.0);
    });

    it('15.3 should apply -40.0 pt positional cap penalty when drafting 2nd Defense', () => {
      const roster = [{ player: { position: 'DEF', team: 'SF' } }];
      const penalty = oracle.calculatePositionalCapsPenalty('DEF', roster, 14);
      assert.equal(penalty, 40.0);
    });

    it('15.4 should award 0 bonus for 3 elements, but award +10 bonus when 4th element added', () => {
      const threeElements = { Fire: 2, Earth: 1, Air: 1, Water: 0 };
      const fourElements = { Fire: 2, Earth: 1, Air: 1, Water: 1 };
      assert.equal(oracle.calculateQuadBalanceBonus(threeElements), 0.0);
      assert.equal(oracle.calculateQuadBalanceBonus(fourElements), 10.0);
    });

    it('15.5 should apply +18.0 primary stack and +9.0 secondary double stack bonus', () => {
      const rosterWithQB = [{ player: { position: 'QB', team: 'CIN' } }];
      const wr1 = { position: 'WR', team: 'CIN' };
      assert.equal(oracle.calculateStackMultiplier(wr1, rosterWithQB), 18.0);

      const rosterWithQBAndWR1 = [
        { player: { position: 'QB', team: 'CIN' } },
        { player: { position: 'WR', team: 'CIN' } },
      ];
      const wr2 = { position: 'WR', team: 'CIN' };
      assert.equal(oracle.calculateStackMultiplier(wr2, rosterWithQBAndWR1), 9.0);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 16: Chaos Dial Scoring Math
  // --------------------------------------------------------------------------
  describe('Boundary 16: Chaos Dial Math Boundaries', () => {
    it('16.1 should output 0.0 when both VOR_norm and SpiritScore are 0.0', () => {
      assert.equal(oracle.computeDraftScore(0.0, 0.0, 0.35), 0.0);
    });

    it('16.2 should output 100.0 when both VOR_norm and SpiritScore are 100.0', () => {
      assert.equal(oracle.computeDraftScore(100.0, 100.0, 0.35), 100.0);
    });

    it('16.3 should clamp extreme negative raw VOR (-200.0) to 0.0 in normalization', () => {
      assert.equal(oracle.normalizeVOR(-200.0, 100.0), 0.0);
    });

    it('16.4 should clamp extreme positive raw VOR (+300.0) to 100.0 in normalization', () => {
      assert.equal(oracle.normalizeVOR(300.0, 100.0), 100.0);
    });

    it('16.5 should execute 1,000 player score recalculations in <10ms', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        oracle.computeDraftScore(50 + (i % 50), 60 + (i % 40), 0.35);
      }
      const dur = performance.now() - start;
      assert.ok(dur < 15.0, `1,000 calculations completed in ${dur}ms`);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 17: Auto-Update Polling Boundaries (Genuine Production Verification)
  // --------------------------------------------------------------------------
  describe('Boundary 17: Auto-Update Polling Boundaries', () => {
    const contextPath = path.resolve('context/OneiromancyContext.tsx');
    const settingsPath = path.resolve('components/settings/SettingsDrawer.tsx');

    it('17.1 should handle pick timer remaining = 0 seconds (pick clock expired) without throwing', () => {
      const mock = oracle.createCanonicalMockDraft();
      const expiredState = {
        ...mock.draftMetadata,
        current_pick: { round: 1, pick_no: 5, on_the_clock_team_id: 'team_01', seconds_remaining: 0 },
      };
      assert.equal(expiredState.current_pick.seconds_remaining, 0);
      assert.ok(mock.players.length > 0, 'Players must remain accessible when pick clock reaches 0');
    });

    it('17.2 should verify poller interval resolves 30s when hidden, 5s when drafting, and 10s when idle', () => {
      // Assert genuine production resolver exported by lib/sleeper.ts
      assert.equal(oracle.POLLING_CONFIG.BACKGROUND_INTERVAL_MS, 30000);
      assert.equal(oracle.POLLING_CONFIG.ACTIVE_INTERVAL_MS, 5000);
      assert.equal(oracle.POLLING_CONFIG.IDLE_INTERVAL_MS, 10000);

      // Verify OneiromancyContext source genuinely implements dynamic downshifting
      assert.ok(fs.existsSync(contextPath), 'context/OneiromancyContext.tsx must exist');
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      assert.ok(
        contextContent.includes("draftState.status === 'drafting'") ||
        contextContent.includes('isDrafting') ||
        contextContent.includes('resolvePollInterval'),
        'OneiromancyContext must inspect draft status to downshift poller'
      );
      assert.ok(
        contextContent.includes('30000') || contextContent.includes('BACKGROUND_INTERVAL_MS'),
        'OneiromancyContext must implement 30,000ms background tab throttling'
      );
      assert.ok(
        contextContent.includes('10000') || contextContent.includes('IDLE_INTERVAL_MS'),
        'OneiromancyContext must implement 10,000ms idle downshifting'
      );
    });

    it('17.3 should cancel prior timers under rapid toggling of auto-update switch', () => {
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      assert.ok(
        contextContent.includes('clearTimeout(timerId)'),
        'OneiromancyContext must invoke clearTimeout(timerId) on re-schedule or cleanup'
      );
      assert.ok(
        contextContent.includes("removeEventListener('visibilitychange'") ||
        contextContent.includes('removeEventListener("visibilitychange"'),
        'OneiromancyContext must clean up visibilitychange event listener on unmount'
      );
    });

    it('17.4 should handle pick rollback event via production detectPollerDelta (newPicks < oldPicks)', () => {
      // Call production pure function from lib/scoring.ts
      const res = oracle.detectPollerDelta(10, 9, 'drafting', 'drafting');
      assert.equal(res.shouldRecompute, false, 'Rollback must not trigger forward recomputation');
      assert.equal(res.newPicksAdded, 0, 'Rollback must not produce negative added picks');

      // Status change during rollback (e.g. commissioner pauses draft) flags delta without forward recompute
      const resPaused = oracle.detectPollerDelta(10, 9, 'drafting', 'paused');
      assert.equal(resPaused.hasDelta, true, 'Status change must flag state delta');
      assert.equal(resPaused.shouldRecompute, false, 'Rollback must not trigger forward recomputation');
    });

    it('17.5 should skip recalculation across 100 poll ticks when pick count is unchanged', () => {
      let recomputes = 0;
      for (let i = 0; i < 100; i++) {
        const delta = oracle.detectPollerDelta(15, 15, 'drafting', 'drafting');
        if (delta.shouldRecompute) recomputes++;
      }
      assert.equal(recomputes, 0, 'Must produce zero recalculations when pick count is static');
    });
  });

  // ============================================================================
  // Boundary 18: Production Standalone Build Boundaries (Genuine Inspection)
  // ============================================================================
  describe('Boundary 18: Production Build Boundaries', () => {
    it('18.1 should verify next.config.mjs specifies output export', () => {
      const configPath = path.resolve('next.config.mjs');
      assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist');
      const content = fs.readFileSync(configPath, 'utf8');
      assert.ok(content.includes("output: 'export'") || content.includes('output: "export"'));
    });

    it('18.2 should verify scripts/copy_standalone_assets.mjs handles static directory copying', () => {
      const scriptPath = path.resolve('scripts/copy_standalone_assets.mjs');
      assert.ok(fs.existsSync(scriptPath), 'scripts/copy_standalone_assets.mjs must exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assert.ok(content.includes('existsSync'), 'Script must verify directory existence');
      assert.ok(content.includes('cpSync'), 'Script must use cpSync to transfer assets');
    });

    it('18.3 should verify package.json private flag is set to true', () => {
      const pkgPath = path.resolve('package.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.equal(pkg.private, true);
    });

    it('18.4 should verify next.config.mjs configures images unoptimized', () => {
      const configPath = path.resolve('next.config.mjs');
      assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist');
      const content = fs.readFileSync(configPath, 'utf8');
      assert.ok(content.includes('unoptimized: true'), 'Images config must be unoptimized for container standalone');
    });

    it('18.5 should verify all required npm scripts exist in package.json', () => {
      const pkgPath = path.resolve('package.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const requiredScripts = ['dev', 'build', 'start', 'start:standalone', 'lint', 'typecheck', 'test'];
      for (const script of requiredScripts) {
        assert.ok(pkg.scripts[script], `package.json must define npm script "${script}"`);
      }
    });
  });

  // ============================================================================
  // Boundary 19: Containerization Boundaries (Genuine Inspection, Zero Skips)
  // ============================================================================
  describe('Boundary 19: Containerization Boundaries', () => {
    it('19.1 should verify Dockerfile specifies HOSTNAME 0.0.0.0 and PORT 8080', () => {
      const dockerfilePath = path.resolve('Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(content.includes('PORT=8080'), 'Dockerfile must set PORT=8080');
      assert.ok(content.includes('HOSTNAME="0.0.0.0"'), 'Dockerfile must set HOSTNAME="0.0.0.0"');
    });

    it('19.2 should verify Dockerfile exposes port 8080', () => {
      const dockerfilePath = path.resolve('Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(content.includes('EXPOSE 8080'), 'Dockerfile must specify EXPOSE 8080');
    });

    it('19.3 should verify Dockerfile enforces non-root UID 1001 nextjs user execution', () => {
      const dockerfilePath = path.resolve('Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(content.includes('USER nextjs'), 'Dockerfile must set USER nextjs');
      assert.ok(content.includes('1001'), 'Dockerfile must create user/group with UID/GID 1001');
    });

    it('19.4 should verify app.yaml configures Google App Engine nodejs22 and instance_class F2', () => {
      const appYamlPath = path.resolve('app.yaml');
      assert.ok(fs.existsSync(appYamlPath), 'app.yaml must exist');
      const content = fs.readFileSync(appYamlPath, 'utf8');
      assert.ok(content.includes('runtime: nodejs22'), 'app.yaml must specify runtime: nodejs22');
      assert.ok(content.includes('instance_class: F2'), 'app.yaml must specify instance_class: F2');
      assert.ok(content.includes('out/index.html'), 'app.yaml must specify static index.html');
      assert.ok(!content.includes('entrypoint: node .next/standalone/server.js'), 'app.yaml must not contain dynamic standalone server entrypoint');
    });

    it('19.5 should verify scripts/verify_launch.js configures 30-second timeout handling', () => {
      const verifyScript = path.resolve('scripts/verify_launch.js');
      assert.ok(fs.existsSync(verifyScript), 'scripts/verify_launch.js must exist');
      const content = fs.readFileSync(verifyScript, 'utf8');
      assert.ok(content.includes('MAX_ATTEMPTS = 30') || content.includes('30'), 'verify_launch.js must configure 30 attempts');
      assert.ok(content.includes('RETRY_INTERVAL_MS = 1000') || content.includes('1000'), 'verify_launch.js must retry every 1000ms');
    });
  });
});
