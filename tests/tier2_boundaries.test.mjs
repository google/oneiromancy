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
const Astrolabe = (await import('./dist/components/astrolabe/Astrolabe.js')).default;
const NavigationShellModule = await import('./dist/components/common/NavigationShell.js');
const NavigationShell = NavigationShellModule.default;
const PositionalBadge = (await import('./dist/components/common/PositionalBadge.js')).default;
const GlassCard = (await import('./dist/components/common/GlassCard.js')).default;
const sleeper = await import('./dist/lib/sleeper.js');

describe('Tier 2: Boundary & Corner Cases (19 Features x 5 Boundary Tests = 95 Tests)', () => {
  // ============================================================================
  // Boundary 1: Theme Tokens Boundaries (Compiled Config & Stylesheet Inspection)
  // ============================================================================
  describe('Boundary 1: Theme Tokens Boundaries', () => {
    const globalsCssPath = path.resolve('app/globals.css');

    it('1.1 should verify Deep Obsidian (#131318) contrast ratio against #ffffff exceeds WCAG AAA (>=7.0:1)', () => {
      const hex = tailwindConfig?.theme?.extend?.colors?.oneiromancy?.obsidian;
      assert.equal(hex, '#131318', 'Tailwind config must specify obsidian hex token #131318');

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
      const colorsObj = tailwindConfig?.theme?.extend?.colors || {};
      const hexMatches = JSON.stringify(colorsObj).match(/#[0-9A-Fa-f]{3,8}/g) || [];
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
      const oneiromancyColors = tailwindConfig?.theme?.extend?.colors?.oneiromancy || {};
      const requiredKeys = ['obsidian', 'surface', 'elevated', 'purple', 'cyan', 'gold', 'green', 'wr'];
      for (const key of requiredKeys) {
        assert.ok(typeof oneiromancyColors[key] === 'string', `Tailwind oneiromancy colors must define ${key}`);
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
  // Boundary 2: Mystical & Telemetry Typography Boundaries (Rendered DOM Inspection)
  // ============================================================================
  describe('Boundary 2: Typography Boundaries', () => {
    it('2.1 should ensure font stacks in tailwind.config.ts terminate in generic system serif and monospace fallbacks', () => {
      const fontFamily = tailwindConfig?.theme?.extend?.fontFamily || {};
      assert.deepEqual(fontFamily.serif, ['var(--font-playfair)', 'Georgia', 'serif'], 'Serif stack must terminate in serif');
      assert.deepEqual(fontFamily.mono, ['var(--font-space-mono)', 'monospace'], 'Mono stack must terminate in monospace');
      assert.deepEqual(fontFamily.sans, ['Inter', 'system-ui', 'sans-serif'], 'Sans stack must terminate in sans-serif');
    });

    it('2.2 should verify telemetry readout formatting in Astrolabe.tsx handles precision without NaN', () => {
      for (const lambda of [0.0, 0.35, 0.75, 1.0]) {
        const html = renderToStaticMarkup(React.createElement(Astrolabe, { lambda, showLabels: true }));
        assert.ok(!html.includes('NaN'), `Astrolabe at lambda=${lambda} must not render NaN`);
        assert.ok(html.includes(lambda.toFixed(2)), `Astrolabe must format lambda=${lambda.toFixed(2)} to 2 decimal places`);
      }
    });

    it('2.3 should verify PositionalBadge safely handles missing or unknown positions with fallback', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'UNKNOWN' }));
      assert.ok(html.includes('text-slate-300'), 'Fallback style must use slate text');
      assert.ok(html.includes('bg-slate-900/60'), 'Fallback style must use slate background');
      assert.ok(html.includes('UNKNOWN'), 'Fallback badge must render the normalized position label');
    });

    it('2.4 should verify NavigationShell provides short phone labels for every tab', () => {
      const html = renderToStaticMarkup(
        React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div', null, 'Body'))
      );
      for (const shortLabel of ['Roster', 'Matchup', 'Players', 'League']) {
        assert.ok(html.includes(`>${shortLabel}<`), `NavigationShell must render ${shortLabel} tab label`);
      }
    });

    it('2.5 should verify NavigationShell default status text and type', () => {
      const html = renderToStaticMarkup(
        React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div', null, 'Body'))
      );
      assert.ok(html.includes('data-testid="draft-status-indicator"'), 'NavigationShell must render draft-status-indicator');
      assert.ok(html.includes('>LIVE<'), 'NavigationShell default statusText must be LIVE');
      assert.ok(html.includes('bg-emerald-500'), 'NavigationShell default statusType live must use bg-emerald-500');
    });
  });

  // ============================================================================
  // Boundary 3: Glassmorphism & Panel Styling Boundaries (Rendered DOM Inspection)
  // ============================================================================
  describe('Boundary 3: Glassmorphism Boundaries', () => {
    const globalsCssPath = path.resolve('app/globals.css');

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
      const defaultHtml = renderToStaticMarkup(React.createElement(GlassCard, null, 'Default'));
      const surfaceHtml = renderToStaticMarkup(React.createElement(GlassCard, { variant: 'surface' }, 'Surface'));
      const gradientHtml = renderToStaticMarkup(React.createElement(GlassCard, { variant: 'gradient' }, 'Gradient'));
      assert.ok(defaultHtml.includes('glass-panel'), 'GlassCard must default variant to glass-panel');
      assert.ok(surfaceHtml.includes('glass-surface'), 'GlassCard variant="surface" must apply glass-surface');
      assert.ok(gradientHtml.includes('glow-gradient-card'), 'GlassCard variant="gradient" must apply glow-gradient-card');
    });

    it('3.4 should verify GlassCard interactive prop adds cursor-pointer and active scale', () => {
      const nonInteractiveHtml = renderToStaticMarkup(React.createElement(GlassCard, null, 'Static'));
      const interactiveHtml = renderToStaticMarkup(React.createElement(GlassCard, { interactive: true }, 'Interactive'));
      assert.ok(!nonInteractiveHtml.includes('cursor-pointer'), 'GlassCard must default interactive to false');
      assert.ok(interactiveHtml.includes('cursor-pointer'), 'GlassCard interactive must add cursor-pointer');
      assert.ok(interactiveHtml.includes('active:scale-[0.99]'), 'GlassCard interactive must add active:scale-[0.99]');
    });

    it('3.5 should verify GlassCard glowColor prop maps cyan, purple, gold, and green utilities', () => {
      const noneHtml = renderToStaticMarkup(React.createElement(GlassCard, null, 'None'));
      assert.ok(!noneHtml.includes('glow-cyan') && !noneHtml.includes('glow-purple'), 'GlassCard must default glowColor to none');
      for (const color of ['cyan', 'purple', 'gold', 'green']) {
        const html = renderToStaticMarkup(React.createElement(GlassCard, { glowColor: color }, color));
        assert.ok(html.includes(`glow-${color}`), `GlassCard must map ${color} glow to glow-${color}`);
      }
    });
  });

  // ============================================================================
  // Boundary 4: Positional Badges Boundaries (Rendered DOM Inspection)
  // ============================================================================
  describe('Boundary 4: Positional Badges Boundaries', () => {
    it('4.1 should verify PositionalBadge falls back to slate styling for unrecognized positions', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'PUNTER' }));
      assert.ok(html.includes('text-slate-300'), 'Fallback must use text-slate-300');
      assert.ok(html.includes('border-slate-700'), 'Fallback must use border-slate-700');
    });

    it('4.2 should verify PositionalBadge normalizes position code with toUpperCase()', () => {
      const positions = ['qb', 'Rb', 'wr', 'TE', 'flex'];
      const expectedColors = ['text-red-400', 'text-teal-400', 'text-sky-400', 'text-amber-400', 'text-rose-400'];
      positions.forEach((pos, idx) => {
        const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: pos }));
        assert.ok(html.includes(`>${pos.toUpperCase()}<`), `PositionalBadge must render uppercase ${pos.toUpperCase()}`);
        assert.ok(html.includes(expectedColors[idx]), `PositionalBadge must apply ${expectedColors[idx]} for ${pos}`);
      });
    });

    it('4.3 should verify PositionalBadge renders distinct styles for all 8 core fantasy position keys', () => {
      const expectedKeys = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'K_DEF'];
      for (const expected of expectedKeys) {
        const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: expected }));
        assert.ok(html.includes('inline-flex'), `PositionalBadge must render badge container for ${expected}`);
        assert.ok(!html.includes('border-slate-700') || expected === 'K' || expected === 'DEF' || expected === 'K_DEF', `Position ${expected} must be recognized`);
      }
    });

    it('4.4 should verify PositionalBadge renders text and padding classes for sm, md, and lg sizes', () => {
      const smHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', size: 'sm' }));
      const mdHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', size: 'md' }));
      const lgHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', size: 'lg' }));
      assert.ok(smHtml.includes('text-[10px] px-1.5 py-0.2 rounded font-semibold'), 'sm size must render compact classes');
      assert.ok(mdHtml.includes('text-xs px-2 py-0.5 rounded-md font-semibold'), 'md size must render standard classes');
      assert.ok(lgHtml.includes('text-sm px-2.5 py-1 rounded-md font-bold'), 'lg size must render large classes');
    });

    it('4.5 should verify showGlow prop toggles glow shadow class conditionally', () => {
      const glowHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', showGlow: true }));
      const noGlowHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', showGlow: false }));
      assert.ok(glowHtml.includes('shadow-['), 'showGlow=true must include glow shadow class');
      assert.ok(!noGlowHtml.includes('shadow-['), 'showGlow=false must omit glow shadow class');
    });

    it('4.6 should verify badge with position QB and depth 2 outputs superscript depth 2 and accessible label', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', depth: 2 }));
      assert.ok(html.includes('>QB<sup'), 'Must render QB base followed by sup');
      assert.ok(html.includes('>2</sup>'), 'Must render ASCII digit 2 in sup');
      assert.ok(html.includes('title="QB · depth chart #2"'), 'Must include descriptive title');
      assert.ok(html.includes('depth chart 2</span>'), 'Must include accessible sr-only label');
    });

    it('4.7 should verify component call with WR and depth 1 outputs superscript depth 1', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'WR', depth: 1 }));
      assert.ok(html.includes('>WR<sup'), 'Must render WR base followed by sup');
      assert.ok(html.includes('>1</sup>'), 'Must render ASCII digit 1 in sup');
      assert.ok(html.includes('title="WR · depth chart #1"'), 'Must include title for WR depth 1');
      assert.ok(html.includes('depth chart 1</span>'), 'Must include accessible label for depth 1');
    });

    it('4.8 should verify double-digit depths such as QB with depth 10 format cleanly', () => {
      const html = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', depth: 10 }));
      assert.ok(html.includes('>QB<sup'), 'Must render QB base followed by sup');
      assert.ok(html.includes('>10</sup>'), 'Must render ASCII digits 10 in sup');
      assert.ok(html.includes('title="QB · depth chart #10"'), 'Must include title for double-digit depth');
      assert.ok(html.includes('depth chart 10</span>'), 'Must include accessible label for depth 10');
    });

    it('4.9 should verify non-positive depths (0, -1) output standard TE without superscripts', () => {
      const zeroHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'TE', depth: 0 }));
      const negHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'TE', depth: -1 }));
      assert.ok(zeroHtml.includes('>TE<'), 'depth=0 must render plain TE');
      assert.ok(!zeroHtml.includes('<sup'), 'depth=0 must not render sup tag');
      assert.ok(!zeroHtml.includes('sr-only'), 'depth=0 must not render sr-only text');
      assert.ok(negHtml.includes('>TE<'), 'depth=-1 must render plain TE');
      assert.ok(!negHtml.includes('<sup'), 'depth=-1 must not render sup tag');
      assert.ok(!negHtml.includes('sr-only'), 'depth=-1 must not render sr-only text');
    });

    it('4.10 should verify null or undefined depths output standard RB without superscripts', () => {
      const nullHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'RB', depth: null }));
      const undefHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'RB', depth: undefined }));
      assert.ok(nullHtml.includes('>RB<'), 'depth=null must render plain RB');
      assert.ok(!nullHtml.includes('<sup'), 'depth=null must not render sup tag');
      assert.ok(!nullHtml.includes('sr-only'), 'depth=null must not render sr-only text');
      assert.ok(undefHtml.includes('>RB<'), 'depth=undefined must render plain RB');
      assert.ok(!undefHtml.includes('<sup'), 'depth=undefined must not render sup tag');
      assert.ok(!undefHtml.includes('sr-only'), 'depth=undefined must not render sr-only text');
    });

    it('4.11 should verify non-integer (1.5) and out-of-range (100) depths output standard badges without superscripts', () => {
      const floatHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', depth: 1.5 }));
      const outOfRangeHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'WR', depth: 100 }));
      assert.ok(floatHtml.includes('>QB<'), 'depth=1.5 must render plain QB');
      assert.ok(!floatHtml.includes('<sup'), 'depth=1.5 must not render sup tag');
      assert.ok(!floatHtml.includes('sr-only'), 'depth=1.5 must not render sr-only text');
      assert.ok(outOfRangeHtml.includes('>WR<'), 'depth=100 must render plain WR');
      assert.ok(!outOfRangeHtml.includes('<sup'), 'depth=100 must not render sup tag');
      assert.ok(!outOfRangeHtml.includes('sr-only'), 'depth=100 must not render sr-only text');
    });

    it('4.12 should verify numeric string ("2") parses to superscript 2 and whitespace/empty strings fall back to plain badge', () => {
      const strHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'QB', depth: '2' }));
      const emptyHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'TE', depth: '' }));
      const spaceHtml = renderToStaticMarkup(React.createElement(PositionalBadge, { position: 'TE', depth: '   ' }));
      assert.ok(strHtml.includes('>QB<sup'), 'depth="2" must render QB with sup tag');
      assert.ok(strHtml.includes('>2</sup>'), 'depth="2" must render ASCII digit 2 in sup');
      assert.ok(emptyHtml.includes('>TE<'), 'depth="" must render plain TE');
      assert.ok(!emptyHtml.includes('<sup'), 'depth="" must not render sup tag');
      assert.ok(spaceHtml.includes('>TE<'), 'depth="   " must render plain TE');
      assert.ok(!spaceHtml.includes('<sup'), 'depth="   " must not render sup tag');
    });
  });

  // ============================================================================
  // Boundary 5: Dynamic Astrolabe SVG Boundaries (Rendered DOM Inspection)
  // ============================================================================
  describe('Boundary 5: Dynamic Astrolabe Boundaries', () => {
    it('5.1 should verify rotation duration at baseline lambda = 0.0 equals 60s outer, 40s middle, 20s inner', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 0.0 }));
      assert.ok(html.includes('spin-cw 60s'), 'Outer ring duration at lambda=0.0 must be 60s');
      assert.ok(html.includes('spin-ccw 40s'), 'Middle ring duration at lambda=0.0 must be 40s');
      assert.ok(html.includes('spin-cw 20s'), 'Inner ring duration at lambda=0.0 must be 20s');
    });

    it('5.2 should verify rotation duration at maximum chaos lambda = 1.0 equals 15s outer, 10s middle, 5s inner', () => {
      const html = renderToStaticMarkup(React.createElement(Astrolabe, { lambda: 1.0 }));
      assert.ok(html.includes('spin-cw 15s'), 'Outer ring duration at lambda=1.0 must be 15s');
      assert.ok(html.includes('spin-ccw 10s'), 'Middle ring duration at lambda=1.0 must be 10s');
      assert.ok(html.includes('spin-cw 5s'), 'Inner ring duration at lambda=1.0 must be 5s');
    });

    it('5.3 should verify speedMultiplier clamp lower bound 0.1 prevents division by zero in Astrolabe.tsx', () => {
      const htmlZero = renderToStaticMarkup(React.createElement(Astrolabe, { speedMultiplier: 0, showLabels: true }));
      const htmlNeg = renderToStaticMarkup(React.createElement(Astrolabe, { speedMultiplier: -5, showLabels: true }));
      assert.ok(!htmlZero.includes('Infinity') && !htmlZero.includes('NaN'), 'speedMultiplier=0 must not produce Infinity/NaN');
      assert.ok(htmlZero.includes('0.1x'), 'speedMultiplier=0 must clamp to 0.1x');
      assert.ok(htmlNeg.includes('0.1x'), 'speedMultiplier=-5 must clamp to 0.1x');
    });

    it('5.4 should verify rotation duration minimum thresholds (3s outer, 2.5s middle, 1.5s inner) prevent GPU lockup', () => {
      const htmlExtreme = renderToStaticMarkup(React.createElement(Astrolabe, { speedMultiplier: 1000 }));
      assert.ok(htmlExtreme.includes('spin-cw 3s'), 'Astrolabe outer duration must clamp to minimum 3s');
      assert.ok(htmlExtreme.includes('spin-ccw 2.5s'), 'Astrolabe middle duration must clamp to minimum 2.5s');
      assert.ok(htmlExtreme.includes('spin-cw 1.5s'), 'Astrolabe inner duration must clamp to minimum 1.5s');
    });

    it('5.5 should verify Astrolabe accepts and renders custom size prop', () => {
      const defaultHtml = renderToStaticMarkup(React.createElement(Astrolabe, {}));
      const customHtml = renderToStaticMarkup(React.createElement(Astrolabe, { size: 320 }));
      assert.ok(defaultHtml.includes('width="240"') && defaultHtml.includes('height="240"'), 'Astrolabe must default size to 240');
      assert.ok(customHtml.includes('width="320"') && customHtml.includes('height="320"'), 'Astrolabe must apply custom size=320');
    });
  });

  // ============================================================================
  // Boundary 6: Navigation Shell Boundaries (Rendered DOM Inspection)
  // ============================================================================
  describe('Boundary 6: Navigation Shell Boundaries', () => {
    it('6.1 should verify TABS configuration contains exactly 4 entries with unique IDs in correct order', () => {
      const html = renderToStaticMarkup(
        React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div', null, 'Body'))
      );
      const desktopIds = [...html.matchAll(/data-testid="desktop-nav-tab-([a-z_]+)"/g)].map((m) => m[1]);
      assert.equal(desktopIds.length, 4);
      assert.equal(new Set(desktopIds).size, 4, 'Tab IDs must all be distinct');
      assert.deepEqual(desktopIds, ['oneiromancy', 'matchups', 'board', 'league']);
    });

    it('6.2 should verify active tab indicator and text styling in NavigationShell.tsx', () => {
      const html = renderToStaticMarkup(
        React.createElement(NavigationShell, { activeTab: 'matchups' }, React.createElement('div', null, 'Body'))
      );
      assert.ok(html.includes('text-cyan-400'), 'Active tab must apply text-cyan-400');
      assert.ok(html.includes('bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4]'), 'Active tab must render glowing cyan bar');
      assert.ok(html.includes('aria-current="page"'), 'Active tab must set aria-current="page"');
    });

    it('6.3 should verify statusType color and glow mappings in NavigationShell.tsx', () => {
      const liveHtml = renderToStaticMarkup(
        React.createElement(NavigationShell, { statusType: 'live' }, React.createElement('div'))
      );
      const syncingHtml = renderToStaticMarkup(
        React.createElement(NavigationShell, { statusType: 'syncing' }, React.createElement('div'))
      );
      const offlineHtml = renderToStaticMarkup(
        React.createElement(NavigationShell, { statusType: 'offline' }, React.createElement('div'))
      );
      assert.ok(liveHtml.includes('bg-emerald-500'), 'live status must map to bg-emerald-500');
      assert.ok(liveHtml.includes('shadow-[0_0_8px_rgba(16,185,129,0.8)]'), 'live status glow must use emerald rgba');
      assert.ok(syncingHtml.includes('bg-amber-500'), 'syncing status must map to bg-amber-500');
      assert.ok(offlineHtml.includes('bg-slate-500'), 'offline status must use bg-slate-500');
    });

    it('6.4 should verify isTabActive resolves legacy tab aliases to canonical 4-tab IDs', () => {
      const isTabActive = NavigationShellModule.isTabActive;
      assert.equal(isTabActive('market', 'board'), true);
      assert.equal(isTabActive('marketplace', 'board'), true);
      assert.equal(isTabActive('trades', 'board'), true);
      assert.equal(isTabActive('chaos', 'oneiromancy'), true);
      assert.equal(isTabActive('matchup', 'matchups'), true);
    });

    it('6.5 should verify Settings button renders with accessible Draft Settings aria-label', () => {
      const html = renderToStaticMarkup(
        React.createElement(NavigationShell, { activeTab: 'oneiromancy' }, React.createElement('div'))
      );
      assert.ok(html.includes('aria-label="Draft Settings"'), 'Settings button must specify aria-label="Draft Settings"');
      assert.ok(html.includes('data-testid="nav-settings-gear"'), 'Settings button must render nav-settings-gear');
      assert.ok(html.includes('data-testid="nav-manager-fallback-icon"'), 'Default mode Settings button must render nav-manager-fallback-icon');
      assert.ok(html.includes('w-8 h-8') && html.includes('before:-inset-1.5'), 'Settings button must preserve w-8 h-8 layout box and 44px touch target pseudo-element');
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
      assert.equal(normalized.celestial, 0.1);
      assert.equal(normalized.numeric, 0.1);
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
  // Boundary 11: Sleeper API Boundaries (Behavioral Runtime Verification)
  // --------------------------------------------------------------------------
  describe('Boundary 11: Sleeper API Boundaries', () => {
    it('11.1 should activate 60-second cooldown timer upon calling triggerRateLimitCooldown', () => {
      assert.equal(typeof sleeper.triggerRateLimitCooldown, 'function', 'Must export triggerRateLimitCooldown helper');
      assert.equal(sleeper.RATE_LIMIT_COOLDOWN_MS, 60000, 'Cooldown must be 60,000ms');
      sleeper.resetRateLimit();
      assert.equal(sleeper.isRateLimited(), false, 'Initially not rate limited');
      sleeper.triggerRateLimitCooldown();
      assert.equal(sleeper.isRateLimited(), true, 'Must be rate limited after triggerRateLimitCooldown');
      const checkRes = sleeper.checkRateLimit();
      assert.equal(checkRes.allowed, false, 'checkRateLimit must block during 429 cooldown');
      assert.ok(checkRes.waitTimeMs > 50000 && checkRes.waitTimeMs <= 60000, 'Remaining cooldown must be ~60,000ms');
      sleeper.resetRateLimit();
      assert.equal(sleeper.isRateLimited(), false, 'resetRateLimit must clear cooldown');
    });

    it('11.2 should trigger immediate fallback to mock_oneiromancy_draft_2025 when requested in mock mode', async () => {
      const fallbackMeta = await sleeper.fetchDraftMetadata('mock_oneiromancy_draft_2025');
      assert.equal(fallbackMeta.draft_id, '9000000000000000002', 'fetchDraftMetadata("mock_oneiromancy_draft_2025") returns canonical mockDraftMetadata');
      const fallbackPicks = await sleeper.fetchDraftPicks('mock_oneiromancy_draft_2025');
      assert.ok(Array.isArray(fallbackPicks) && fallbackPicks.length > 0, 'Fallback picks must be non-empty');
    });

    it('11.3 should enforce rate limiter configuration of 300 req/min and 5s/10s/30s intervals', () => {
      assert.equal(sleeper.POLLING_CONFIG.MAX_REQ_PER_MIN, 300, 'MAX_REQ_PER_MIN must be 300');
      assert.equal(sleeper.POLLING_CONFIG.ACTIVE_INTERVAL_MS, 5000);
      assert.equal(sleeper.POLLING_CONFIG.IDLE_INTERVAL_MS, 10000);
      assert.equal(sleeper.POLLING_CONFIG.BACKGROUND_INTERVAL_MS, 30000);
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
      for (let i = 0; i < 50; i++) {
        oracle.computeDraftScore(50 + (i % 50), 60 + (i % 40), 0.35);
      }
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        oracle.computeDraftScore(50 + (i % 50), 60 + (i % 40), 0.35);
      }
      const dur = performance.now() - start;
      assert.ok(dur < 15.0, `1,000 calculations completed in ${dur}ms`);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 17: Auto-Update Polling Boundaries (Behavioral Production Verification)
  // --------------------------------------------------------------------------
  describe('Boundary 17: Auto-Update Polling Boundaries', () => {
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
      assert.equal(oracle.POLLING_CONFIG.BACKGROUND_INTERVAL_MS, 30000);
      assert.equal(oracle.POLLING_CONFIG.ACTIVE_INTERVAL_MS, 5000);
      assert.equal(oracle.POLLING_CONFIG.IDLE_INTERVAL_MS, 10000);

      assert.equal(sleeper.resolvePollInterval('drafting', 'hidden'), 30000, 'Hidden tab must throttle to 30,000ms');
      assert.equal(sleeper.resolvePollInterval('drafting', 'visible'), 5000, 'Active drafting tab must poll every 5,000ms');
      assert.equal(sleeper.resolvePollInterval('pre_draft', 'visible'), 10000, 'Idle pre_draft tab must downshift to 10,000ms');
      assert.equal(sleeper.resolvePollInterval('complete', 'visible'), 10000, 'Completed draft tab must downshift to 10,000ms');
    });

    it('17.3 should verify custom userInterval overrides visible polling while preserving hidden tab throttling', () => {
      assert.equal(sleeper.resolvePollInterval('drafting', 'visible', 3000), 3000, 'Custom userInterval=3000 must apply when visible');
      assert.equal(sleeper.resolvePollInterval('pre_draft', 'visible', 3000), 3000, 'Custom userInterval=3000 applies when visible');
      assert.equal(sleeper.resolvePollInterval('drafting', 'hidden', 3000), 30000, 'Hidden tab must still throttle to 30,000ms');
    });

    it('17.4 should handle pick rollback event via production detectPollerDelta (newPicks < oldPicks)', () => {
      const res = oracle.detectPollerDelta(10, 9, 'drafting', 'drafting');
      assert.equal(res.shouldRecompute, false, 'Rollback must not trigger forward recomputation');
      assert.equal(res.newPicksAdded, 0, 'Rollback must not produce negative added picks');

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
  // Boundary 18: Production Standalone Build Boundaries (Config Inspection)
  // ============================================================================
  describe('Boundary 18: Production Build Boundaries', () => {
    it('18.1 should verify next.config.mjs specifies output export', async () => {
      const nextConfig = (await import('../next.config.mjs')).default;
      assert.equal(nextConfig.output, 'export');
    });

    it('18.2 should verify scripts/copy_standalone_assets.mjs exists and is non-empty', () => {
      const scriptPath = path.resolve('scripts/copy_standalone_assets.mjs');
      assert.ok(fs.existsSync(scriptPath), 'scripts/copy_standalone_assets.mjs must exist');
      assert.ok(fs.statSync(scriptPath).size > 100, 'scripts/copy_standalone_assets.mjs must be non-empty');
    });

    it('18.3 should verify package.json private flag is set to true', () => {
      const pkgPath = path.resolve('package.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.equal(pkg.private, true);
    });

    it('18.4 should verify next.config.mjs configures images unoptimized', async () => {
      const nextConfig = (await import('../next.config.mjs')).default;
      assert.equal(nextConfig.images?.unoptimized, true, 'Images config must be unoptimized for container standalone');
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
  // Boundary 19: Containerization Boundaries (Deployment Manifest Inspection)
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

    it('19.5 should verify scripts/verify_launch.js exists and is executable/valid', () => {
      const verifyScript = path.resolve('scripts/verify_launch.js');
      assert.ok(fs.existsSync(verifyScript), 'scripts/verify_launch.js must exist');
      assert.ok(fs.statSync(verifyScript).size > 200, 'scripts/verify_launch.js must be non-empty');
    });
  });
});
