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
 * Challenger M1 Adversarial Failure Mode Harness
 * Confirms boundary weaknesses and edge cases identified during deep review:
 * - VULN-1: PositionalBadge unhandled TypeError on null/undefined position
 * - VULN-2: Astrolabe propagation of NaN into CSS animation durations
 * - VULN-3: Astrolabe text readout overflow at size=0px
 * - VULN-4: Settings button touch target size below WCAG AAA (32px vs 44px)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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

const { PositionalBadge } = await import('./dist/components/common/PositionalBadge.js');
const { Astrolabe } = await import('./dist/components/astrolabe/Astrolabe.js');
const { NavigationShell } = await import('./dist/components/common/NavigationShell.js');

describe('Adversarial Failure Mode Probes', () => {
  test('VULN-1: PositionalBadge throws TypeError when position is undefined or null', () => {
    // Probe 1: undefined position
    assert.throws(
      () => {
        ReactDOMServer.renderToStaticMarkup(
          React.createElement(PositionalBadge, { position: undefined })
        );
      },
      {
        name: 'TypeError',
        message: /toUpperCase/,
      },
      'PositionalBadge must throw TypeError when position is undefined'
    );

    // Probe 2: null position
    assert.throws(
      () => {
        ReactDOMServer.renderToStaticMarkup(
          React.createElement(PositionalBadge, { position: null })
        );
      },
      {
        name: 'TypeError',
        message: /toUpperCase/,
      },
      'PositionalBadge must throw TypeError when position is null'
    );
  });

  test('VULN-2: Astrolabe propagates NaN into CSS animation style and aria-label', () => {
    const htmlSpeedNaN = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Astrolabe, { speedMultiplier: NaN })
    );

    assert.ok(htmlSpeedNaN.includes('NaNs'), 'Invalid CSS "NaNs" produced in animation duration');
    assert.ok(htmlSpeedNaN.includes('multiplier NaN'), 'aria-label displays "multiplier NaN"');

    const htmlLambdaNaN = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Astrolabe, { speedMultiplier: undefined, lambda: NaN })
    );
    assert.ok(htmlLambdaNaN.includes('NaNs'), 'Invalid CSS "NaNs" produced when lambda is NaN');
  });

  test('VULN-3: Astrolabe center text overflows container at size=0 without clipping', () => {
    const htmlZero = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Astrolabe, { size: 0, showCenterReadout: true })
    );

    // Verify outer container is 0px width/height but lacks overflow-hidden
    assert.ok(htmlZero.includes('width:0;height:0') || htmlZero.includes('width:0px;height:0px') || htmlZero.includes('width:0'), 'Container has width 0');
    assert.ok(!htmlZero.startsWith('<div class="relative flex items-center justify-center select-none  overflow-hidden"'), 'Outer container does not have overflow-hidden');
    assert.ok(htmlZero.includes('SPEED') || htmlZero.includes('λ FACTOR'), 'Text readout still rendered in DOM at 0px size');
  });

  test('VULN-4: NavigationShell header settings button touch target is 32px (below WCAG AAA 44px)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(NavigationShell, {})
    );

    // Button classes: p-1.5 rounded-lg (p-1.5 = 6px padding)
    // Icon: w-5 h-5 (20px x 20px)
    // Total bounding box = 20 + 2*6 = 32px x 32px.
    assert.ok(html.includes('aria-label="Draft Settings"'), 'Settings button exists');
    assert.ok(html.includes('p-1.5'), 'Button padding is p-1.5 (6px)');
    assert.ok(html.includes('w-5 h-5'), 'Icon size is w-5 h-5 (20px)');
    // 32px satisfies WCAG 2.2 AA (>=24px) but fails WCAG AAA / iOS target (>=44px)
  });
});
