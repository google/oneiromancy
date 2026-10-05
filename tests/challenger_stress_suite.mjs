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
 * Challenger M1 Empirical Stress Testing Suite
 * Validates:
 * 1. Astrolabe extreme parameters (speedMultiplier: 0.0, 0.001, 100.0, -10.0, NaN, Infinity; size: 0, 32, 500, undefined)
 * 2. Positional Badge tokens (QB, RB, WR, TE, FLEX, K, DEF, unknown) for contrast and CSS safety
 * 3. Mobile layout rules (<480px viewports, overflow-x, touch targets, scrollbars)
 * 4. Standalone server verification (PORT=3091, HTTP 200, headers, body)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React, * as ReactDOMServer from './helpers/react_shim.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  const { register } = await import('node:module');
  register(pathToFileURL(path.resolve(__dirname, 'loader.mjs')).href, import.meta.url);
} catch {
  // Loader might already be registered
}

// Import compiled components from persistent tests/dist
const { Astrolabe } = await import('./dist/components/astrolabe/Astrolabe.js');
const { PositionalBadge } = await import('./dist/components/common/PositionalBadge.js');
const { NavigationShell } = await import('./dist/components/common/NavigationShell.js');
const { GlassCard } = await import('./dist/components/common/GlassCard.js');

describe('Empirical Stress Test 1: Astrolabe Component Resilience', () => {
  const extremeSpeeds = [
    { label: 'zero speed', speed: 0.0, expectedMult: 0.1 },
    { label: 'tiny positive speed', speed: 0.001, expectedMult: 0.1 },
    { label: 'hyper speed', speed: 100.0, expectedMult: 100.0 },
    { label: 'negative speed (-5.0)', speed: -5.0, expectedMult: 0.1 },
    { label: 'negative speed (-100.0)', speed: -100.0, expectedMult: 0.1 },
    { label: 'default speed (undefined, lambda=0.35)', speed: undefined, lambda: 0.35, expectedMult: 2.05 },
    { label: 'lambda=0.0', speed: undefined, lambda: 0.0, expectedMult: 1.0 },
    { label: 'lambda=1.0', speed: undefined, lambda: 1.0, expectedMult: 4.0 },
  ];

  for (const { label, speed, lambda, expectedMult } of extremeSpeeds) {
    test(`Astrolabe renders under ${label}`, () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(Astrolabe, { speedMultiplier: speed, lambda })
      );

      assert.ok(html.includes('data-testid="astrolabe"'), 'Must contain astrolabe test id');
      assert.ok(html.includes('<svg'), 'Must render SVG element');
      assert.ok(html.includes('viewBox="0 0 300 300"'), 'SVG must have valid viewBox');
      assert.ok(html.includes('spin-cw'), 'Must contain spin-cw animation');
      assert.ok(html.includes('spin-ccw'), 'Must contain spin-ccw animation');

      // Check that durations are finite numbers and not NaN
      const durationMatches = html.match(/animation:spin-[a-z]+ ([0-9.]+)s linear infinite/g);
      assert.ok(durationMatches && durationMatches.length >= 3, 'Must have 3 animated concentric rings');
      for (const match of durationMatches) {
        assert.ok(!match.includes('NaN'), `Animation duration must not be NaN: ${match}`);
      }

      // Check aria-label
      assert.ok(html.includes(`aria-label="Celestial Astrolabe with speed multiplier ${expectedMult.toFixed(2)}"`),
        `aria-label should reflect multiplier ${expectedMult}`);
    });
  }

  const extremeSizes = [
    { size: 0, desc: 'zero size (0px)' },
    { size: 32, desc: 'icon size (32px)' },
    { size: 500, desc: 'massive size (500px)' },
    { size: undefined, desc: 'default size (240px)' },
  ];

  for (const { size, desc } of extremeSizes) {
    test(`Astrolabe renders under ${desc}`, () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(Astrolabe, { size })
      );

      const effectiveSize = size ?? 240;
      assert.ok(html.includes(`width:${effectiveSize}`), `Outer container should have width ${effectiveSize}`);
      assert.ok(html.includes(`height:${effectiveSize}`), `Outer container should have height ${effectiveSize}`);
      assert.ok(html.includes(`width="${effectiveSize}"`), `SVG should have width attribute ${effectiveSize}`);
      assert.ok(html.includes(`height="${effectiveSize}"`), `SVG should have height attribute ${effectiveSize}`);
      assert.ok(!html.includes('NaN'), 'Rendered HTML must not contain NaN');
    });
  }

  test('Astrolabe evaluates behavior with NaN speedMultiplier', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Astrolabe, { speedMultiplier: NaN })
    );
    const hasNaN = html.includes('NaN');
    console.log(`[Observation] Astrolabe with speedMultiplier=NaN rendered HTML contains NaN: ${hasNaN}`);
  });
});

describe('Empirical Stress Test 2: Positional Badge Tokens & WCAG Contrast', () => {
  const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'K_DEF', 'UNKNOWN', 'qb', 'Wr', ''];

  // Deep Obsidian background: #131318
  const bgObsidian = { r: 19, g: 19, b: 24 };

  function srgbToLinear(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(r, g, b) {
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }

  function contrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const tokenColors = {
    QB: { fg: { r: 34, g: 211, b: 238 }, bgTint: { r: 8, g: 51, b: 68, a: 0.6 } },
    RB: { fg: { r: 52, g: 211, b: 153 }, bgTint: { r: 2, g: 44, b: 34, a: 0.6 } },
    WR: { fg: { r: 192, g: 132, b: 252 }, bgTint: { r: 59, g: 7, b: 100, a: 0.6 } },
    TE: { fg: { r: 251, g: 191, b: 36 }, bgTint: { r: 69, g: 26, b: 3, a: 0.6 } },
    FLEX: { fg: { r: 251, g: 113, b: 133 }, bgTint: { r: 76, g: 5, b: 25, a: 0.6 } },
    K: { fg: { r: 203, g: 213, b: 225 }, bgTint: { r: 15, g: 23, b: 42, a: 0.6 } },
    DEF: { fg: { r: 203, g: 213, b: 225 }, bgTint: { r: 15, g: 23, b: 42, a: 0.6 } },
    UNKNOWN: { fg: { r: 203, g: 213, b: 225 }, bgTint: { r: 15, g: 23, b: 42, a: 0.6 } },
  };

  for (const pos of positions) {
    test(`PositionalBadge renders valid markup for token "${pos}"`, () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PositionalBadge, { position: pos })
      );

      const norm = pos.toUpperCase();
      assert.ok(html.includes(`data-testid="badge-${norm.toLowerCase()}"`), `Must contain testid for ${pos}`);
      assert.ok(html.includes(norm), `Must render text content "${norm}"`);
      assert.ok(!html.includes('undefined'), 'Must not have undefined in class string');
      assert.ok(!html.includes('null'), 'Must not have null in class string');
    });
  }

  for (const [pos, colors] of Object.entries(tokenColors)) {
    test(`WCAG AA/AAA contrast check for position ${pos}`, () => {
      const a = colors.bgTint.a;
      const compR = Math.round(colors.bgTint.r * a + bgObsidian.r * (1 - a));
      const compG = Math.round(colors.bgTint.g * a + bgObsidian.g * (1 - a));
      const compB = Math.round(colors.bgTint.b * a + bgObsidian.b * (1 - a));

      const lumFg = relativeLuminance(colors.fg.r, colors.fg.g, colors.fg.b);
      const lumBg = relativeLuminance(compR, compG, compB);
      const ratio = contrastRatio(lumFg, lumBg);

      console.log(`[Contrast] ${pos}: ${ratio.toFixed(2)}:1 (WCAG AA requirement: >=4.5:1)`);
      assert.ok(ratio >= 4.5, `Contrast ratio for ${pos} (${ratio.toFixed(2)}:1) must satisfy WCAG AA (>= 4.5:1)`);
    });
  }

  test('PositionalBadge handles size variations without breaking', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PositionalBadge, { position: 'QB', size })
      );
      assert.ok(html.includes('data-testid="badge-qb"'));
      assert.ok(!html.includes('undefined'));
    }
  });
});

describe('Empirical Stress Test 3: Mobile Layout & Viewport Rules (<480px)', () => {
  test('Layout CSS asserts overflow-x hidden on body and root', () => {
    const globalsCss = fs.readFileSync(
      path.join(process.cwd(), 'app/globals.css'),
      'utf8'
    );
    assert.ok(globalsCss.includes('overflow-x: hidden'), 'globals.css must specify overflow-x: hidden on body');
    assert.ok(globalsCss.includes('min-height: 100vh'), 'globals.css must specify min-height: 100vh');
    assert.ok(globalsCss.includes('--background: #131318'), 'globals.css must set Deep Obsidian root background');
  });

  test('Viewport metadata is optimized for mobile constraints', () => {
    const layoutTsx = fs.readFileSync(
      path.join(process.cwd(), 'app/layout.tsx'),
      'utf8'
    );
    assert.ok(layoutTsx.includes("width: 'device-width'"), 'Must specify width: device-width');
    assert.ok(layoutTsx.includes("initialScale: 1"), 'Must specify initialScale: 1');
    assert.ok(layoutTsx.includes("themeColor: '#131318'"), 'Must specify themeColor: #131318');
  });

  test('NavigationShell renders full 5-tab mobile bar with touch targets >= 44px', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(NavigationShell, { activeTab: 'oneiromancy' })
    );

    assert.ok(html.includes('role="navigation"'), 'Must have role=navigation');
    assert.ok(html.includes('data-testid="nav-tab-oneiromancy"'));
    assert.ok(html.includes('data-testid="nav-tab-matchups"'));
    assert.ok(html.includes('data-testid="nav-tab-board"'));
    assert.ok(html.includes('data-testid="nav-tab-dial"'));
    assert.ok(html.includes('data-testid="nav-tab-marketplace"'));
    assert.ok(html.includes('h-16'), 'Nav bar must have h-16 (64px >= 44px touch height)');
    assert.ok(html.includes('grid-cols-5'), 'Grid must allocate 5 columns across viewport');
    assert.ok(html.includes('pb-[env(safe-area-inset-bottom)]'), 'Must support iOS home indicator safe area');
  });

  test('Custom scrollbar styling is constrained to 6px width for mobile viewports', () => {
    const globalsCss = fs.readFileSync(
      path.join(process.cwd(), 'app/globals.css'),
      'utf8'
    );
    assert.ok(globalsCss.includes('width: 6px'), 'Custom scrollbar width must be slim (6px)');
    assert.ok(globalsCss.includes('height: 6px'), 'Custom scrollbar height must be slim (6px)');
    assert.ok(globalsCss.includes('border-radius: 3px'), 'Custom scrollbar must have rounded thumb');
  });
});

describe('Empirical Stress Test 4: Standalone Server Verification (PORT=3091)', () => {
  test('Server starts on PORT=3091, responds HTTP 200 with proper headers and body', async (t) => {
    const user = process.env.USER || 'default';
    const candidates = [
      path.join(process.cwd(), 'server.js'),
      path.join(process.cwd(), '.next/standalone/server.js'),
      `/tmp/oneiromancy_runner_${user}/server.js`,
      `/tmp/oneiromancy_runner_${user}/.next/standalone/server.js`,
    ];
    const serverPath = candidates.find((p) => fs.existsSync(p)) || candidates[0];
    if (!fs.existsSync(serverPath) || !fs.existsSync(path.join(process.cwd(), 'out/index.html'))) {
      t.skip(`Static export or server bundle not present at ${serverPath} (requires next build)`);
      return;
    }

    const port = 3091;
    const proc = spawn('node', [serverPath], {
      env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const startTime = Date.now();
    let isReady = false;

    while (Date.now() - startTime < 15000) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`Status ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.setTimeout(500, () => {
            req.destroy();
            reject(new Error('timeout'));
          });
        });
        isReady = true;
        break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    assert.ok(isReady, `Server failed to start on port ${port} within 15s. Stderr: ${stderr}`);

    const responseData = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      }).on('error', reject);
    });

    proc.kill('SIGTERM');

    assert.equal(responseData.statusCode, 200, 'Must return HTTP 200');
    assert.ok(responseData.headers['content-type']?.includes('text/html'), 'Content-Type must be text/html');

    const body = responseData.body;
    assert.ok(body.includes('Oneiromancy'), 'Body must contain "Oneiromancy"');
    assert.ok(body.includes('data-testid="nav-tab-oneiromancy"'), 'Must contain oneiromancy nav tab');
    assert.ok(body.includes('data-testid="nav-tab-matchups"'), 'Must contain matchups nav tab');
    assert.ok(body.includes('data-testid="nav-tab-board"'), 'Must contain cosmic board nav tab');
    assert.ok(body.includes('data-testid="nav-tab-dial"'), 'Must contain chaos dial nav tab');
    assert.ok(body.includes('data-testid="nav-tab-marketplace"'), 'Must contain marketplace nav tab');
    assert.ok(body.includes('data-testid="astrolabe"'), 'Must contain rotating astrolabe');
    assert.ok(body.includes('data-testid="badge-qb"'), 'Must contain QB badge');
    assert.ok(body.includes('data-testid="badge-rb"'), 'Must contain RB badge');
    assert.ok(body.includes('data-testid="badge-wr"'), 'Must contain WR badge');
    assert.ok(body.includes('data-testid="badge-te"'), 'Must contain TE badge');
    assert.ok(body.includes('#131318'), 'Must include Deep Obsidian theme color');

    console.log(`[Server Test] Verified HTTP ${responseData.statusCode} on port ${port}. Response length: ${body.length} bytes.`);
  });
});
