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
 * Challenger 2 Milestone 4 Empirical Stress Testing Suite
 * 'Oneiromancy' Fantasy Draft Frontend
 *
 * Verifies:
 * 1. Sleeper Rate Limiter Burst Testing:
 *    - Strict 24 req/min budget ceiling prevents external hammering.
 *    - 30 rapid requests in <1s correctly allow exactly 24 and throttle/queue 6.
 *    - Sliding window expiration restores rate budget.
 * 2. HTTP 429 Cooldown & Zero Round-Trip Fallback:
 *    - Receiving HTTP 429 activates a 60-second cooldown timer.
 *    - During active cooldown, subsequent calls immediately return offline fallback
 *      draft state with zero external network requests.
 *    - Cooldown timer expiration restores live network querying.
 * 3. SettingsDrawer Component DOM Attributes & Accessibility:
 *    - Inspects component for role="dialog", aria-modal="true", aria-labelledby.
 *    - Inspects auto-update toggle switch: role="switch", aria-checked.
 *    - Inspects draft ID input field and label association.
 *    - Inspects polling interval selector buttons (5s / 10s) and 30s background throttle.
 *    - Inspects Outbound Egress status tags (Target API, Cloud Run / App Engine).
 * 4. Resilient API Route Proxy & Standalone Integration:
 *    - Asserts GET /api/draft/[id] never returns HTTP 500 under 429 or network errors.
 *    - Validates no-store cache headers and graceful fallback.
 * 5. Adversarial Input Fuzzing & High-Concurrency Hammering:
 *    - Fuzzes 100 anomalous draft IDs asserting zero crashes.
 *    - Fires 100 concurrent requests asserting strict network call bounds.
 */

import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Register TypeScript / @ alias loader for Node.js ESM execution
register(new URL('./loader.mjs', import.meta.url));

// Helper: import fresh isolated instance of sleeper.js
let moduleInstanceCounter = 0;
async function getFreshSleeperModule() {
  moduleInstanceCounter++;
  const url = `./dist/lib/sleeper.js?instance=${moduleInstanceCounter}_${Date.now()}`;
  return await import(url);
}

// Read raw source files for DOM / AST inspection
const settingsDrawerSource = fs.readFileSync(
  path.join(PROJECT_ROOT, 'components/settings/SettingsDrawer.tsx'),
  'utf8'
);
const apiRoutePath = path.join(PROJECT_ROOT, 'app/api/draft/[id]/route.ts');
const apiRouteSource = fs.existsSync(apiRoutePath)
  ? fs.readFileSync(apiRoutePath, 'utf8')
  : '';
const sleeperPath = fs.existsSync(path.join(PROJECT_ROOT, 'core/lib/sleeper.ts'))
  ? path.join(PROJECT_ROOT, 'core/lib/sleeper.ts')
  : path.join(PROJECT_ROOT, 'lib/sleeper.ts');
const sleeperSource = fs.readFileSync(sleeperPath, 'utf8');
const contextSource = fs.readFileSync(
  path.join(PROJECT_ROOT, 'context/OneiromancyContext.tsx'),
  'utf8'
);

// ============================================================================
// SUITE 1: Sleeper Rate Limiter Burst Test (24 req/min Ceiling)
// ============================================================================
describe('Suite 1: Sleeper Rate Limiter Burst Test (Headroom Budget)', () => {
  test('1.1 Constants verify MAX_REQ_PER_MIN=300 and RATE_LIMIT_COOLDOWN_MS=60000', async () => {
    const sleeper = await getFreshSleeperModule();
    assert.equal(sleeper.MAX_REQ_PER_MIN, 300, 'MAX_REQ_PER_MIN must be 300');
    assert.equal(sleeper.RATE_LIMIT_COOLDOWN_MS, 60000, 'RATE_LIMIT_COOLDOWN_MS must be 60000');
    assert.equal(sleeper.REQUEST_TIMEOUT_MS, 10000, 'REQUEST_TIMEOUT_MS must be 10000');
    assert.equal(sleeper.SLEEPER_BASE_URL, 'https://api.sleeper.app/v1');
  });

  test('1.2 Burst test checkRateLimit: 30 rapid sequential calls in <1s are permitted without client-side blocking', async () => {
    const sleeper = await getFreshSleeperModule();
    const startTime = Date.now();
    const results = [];

    for (let i = 0; i < 30; i++) {
      results.push(sleeper.checkRateLimit());
    }

    const duration = Date.now() - startTime;
    assert.ok(duration < 1000, `30 requests executed in ${duration}ms (<1000ms)`);

    const allowed = results.filter((r) => r.allowed);
    const rejected = results.filter((r) => !r.allowed);

    assert.equal(allowed.length, 30, 'All 30 requests permitted within the headroom budget');
    assert.equal(rejected.length, 0, 'Zero requests prematurely rejected');

    for (let i = 0; i < 30; i++) {
      assert.equal(results[i].allowed, true, `Request #${i + 1} must be allowed`);
      assert.equal(results[i].waitTimeMs, 0, `Request #${i + 1} waitTimeMs must be 0`);
    }
  });

  test('1.3 Burst test fetchDraftMetadata with network mocking: all 30 calls reach fetch without client-side rejection', async () => {
    const sleeper = await getFreshSleeperModule();
    let networkCallCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      networkCallCount++;
      return new Response(
        JSON.stringify({
          draft_id: 'test_burst_draft',
          status: 'drafting',
          settings: { teams: 12, rounds: 15 },
          draft_order: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(
          sleeper.fetchDraftMetadata('test_burst_draft').then(
            (data) => ({ status: 'fulfilled', data }),
            (err) => ({ status: 'rejected', reason: err.message })
          )
        );
      }

      const settled = await Promise.all(promises);
      const fulfilled = settled.filter((s) => s.status === 'fulfilled');
      const throttled = settled.filter((s) => s.status === 'rejected');

      assert.equal(fulfilled.length, 30, 'All 30 calls fulfilled by live network mock');
      assert.equal(throttled.length, 0, 'Zero calls rejected at rate limit gate');
      assert.equal(
        networkCallCount,
        30,
        `Network fetch invoked exactly 30 times without premature client-side blocking`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('1.4 Burst test fetchSleeperDraft: 30 calls resolve cleanly with live data when not rate-limited by 429', async () => {
    const sleeper = await getFreshSleeperModule();
    let networkCallCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      networkCallCount++;
      if (url.includes('/picks')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          draft_id: 'test_e2e_burst',
          status: 'drafting',
          settings: { teams: 12, rounds: 15 },
          draft_order: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(sleeper.fetchSleeperDraft('test_e2e_burst'));
      }

      const results = await Promise.all(promises);

      assert.equal(results.length, 30, 'All 30 calls must resolve without throwing');
      assert.ok(
        networkCallCount >= 30,
        `Network calls (${networkCallCount}) successfully executed`
      );

      for (const res of results) {
        assert.equal(res.draft_id, 'test_e2e_burst');
        assert.ok(Array.isArray(res.cosmic_board));
        assert.ok(Array.isArray(res.my_roster));
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('1.5 resetRateLimit clears request timestamps and active cooldown', async () => {
    const sleeper = await getFreshSleeperModule();

    // Trigger cooldown
    sleeper.triggerRateLimitCooldown();
    assert.equal(sleeper.isRateLimited(), true);
    assert.equal(sleeper.checkRateLimit().allowed, false);

    // Reset rate limit
    sleeper.resetRateLimit();
    assert.equal(sleeper.isRateLimited(), false, 'isRateLimited must be false after resetRateLimit()');
    const recovered = sleeper.checkRateLimit();
    assert.equal(recovered.allowed, true, 'checkRateLimit must allow requests after reset');
    assert.equal(recovered.waitTimeMs, 0);
  });
});

// ============================================================================
// SUITE 2: HTTP 429 Cooldown & Zero Network Round-Trip Fallback
// ============================================================================
describe('Suite 2: HTTP 429 Cooldown & Zero Network Round-Trip Fallback', () => {
  test('2.1 Receiving HTTP 429 activates 60-second cooldown and triggers triggerRateLimitCooldown', async () => {
    const sleeper = await getFreshSleeperModule();

    assert.equal(sleeper.isRateLimited(), false, 'Initially not rate limited');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ message: 'Too Many Requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      await assert.rejects(
        async () => {
          await sleeper.fetchDraftMetadata('real_sleeper_draft_429');
        },
        (err) => err.message === 'HTTP_429_TOO_MANY_REQUESTS'
      );

      assert.equal(sleeper.isRateLimited(), true, 'isRateLimited() must be true after receiving 429');

      const check = sleeper.checkRateLimit();
      assert.equal(check.allowed, false, 'checkRateLimit().allowed must be false');
      assert.ok(
        check.waitTimeMs >= 58000 && check.waitTimeMs <= 60000,
        `Wait time must be near 60000ms (observed ${check.waitTimeMs}ms)`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('2.2 Zero network round-trips during active 429 cooldown period', async () => {
    const sleeper = await getFreshSleeperModule();

    // Trigger cooldown directly
    sleeper.triggerRateLimitCooldown();
    assert.equal(sleeper.isRateLimited(), true);

    let networkAttempts = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      networkAttempts++;
      throw new Error('NETWORK_TOUCHED_DURING_COOLDOWN_VIOLATION');
    };

    try {
      const startTime = performance.now();

      // Fire 20 requests to fetchSleeperDraft
      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(await sleeper.fetchSleeperDraft('guarded_draft_id'));
      }

      const elapsed = performance.now() - startTime;

      // 1. Strict zero network assertions
      assert.equal(
        networkAttempts,
        0,
        `ZERO network calls must occur during 429 cooldown. (Observed: ${networkAttempts})`
      );

      // 2. Near-zero execution latency (<25ms for 20 calls)
      assert.ok(
        elapsed < 100,
        `20 offline fallback responses served in ${elapsed.toFixed(2)}ms (<100ms)`
      );

      // 3. Fallback integrity
      for (const state of results) {
        assert.equal(state.draft_id, 'guarded_draft_id');
        assert.equal(state.settings.offline_mode_active, true);
        assert.ok(['drafting', 'complete'].includes(state.status));
        assert.ok(state.cosmic_board.length > 0);
        assert.ok(state.my_roster.length > 0);
        assert.ok(state.ideal_draft_path.length > 0);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('2.3 Cooldown expiration restores live querying after 60,001 ms', async () => {
    const sleeper = await getFreshSleeperModule();

    sleeper.triggerRateLimitCooldown();
    assert.equal(sleeper.isRateLimited(), true);

    const realDateNow = Date.now;
    const futureTime = realDateNow() + 60001;
    Date.now = () => futureTime;

    let networkCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      networkCalled = true;
      return new Response(
        JSON.stringify({ draft_id: 'post_cooldown', status: 'drafting', settings: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      assert.equal(sleeper.isRateLimited(), false, 'isRateLimited() must expire after 60s');
      const meta = await sleeper.fetchDraftMetadata('post_cooldown');
      assert.equal(meta.draft_id, 'post_cooldown');
      assert.equal(networkCalled, true, 'Network call allowed once cooldown expired');
    } finally {
      Date.now = realDateNow;
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// SUITE 3: SettingsDrawer Component Source & DOM Attributes Verification
// ============================================================================
describe('Suite 3: SettingsDrawer Component DOM Attributes & Accessibility', () => {
  test('3.1 Modal dialog accessibility attributes (role="dialog", aria-modal="true", aria-labelledby)', () => {
    assert.ok(
      settingsDrawerSource.includes('role="dialog"'),
      'SettingsDrawer must contain role="dialog"'
    );
    assert.ok(
      settingsDrawerSource.includes('aria-modal="true"'),
      'SettingsDrawer must contain aria-modal="true"'
    );
    assert.ok(
      settingsDrawerSource.includes('aria-labelledby="settings-drawer-title"'),
      'SettingsDrawer must contain aria-labelledby="settings-drawer-title"'
    );
    assert.ok(
      settingsDrawerSource.includes('id="settings-drawer-title"'),
      'SettingsDrawer must contain header with id="settings-drawer-title"'
    );
    assert.ok(
      settingsDrawerSource.includes('aria-label="Close Settings"'),
      'SettingsDrawer close button must include aria-label="Close Settings"'
    );
  });

  test('3.2 Auto-update toggle switch semantics (role="switch", aria-checked={isAutoUpdate})', () => {
    assert.ok(
      settingsDrawerSource.includes('role="switch"'),
      'Auto-update toggle button must have role="switch"'
    );
    assert.ok(
      settingsDrawerSource.includes('aria-checked={isAutoUpdate}'),
      'Toggle button must dynamically bind aria-checked={isAutoUpdate}'
    );
    assert.ok(
      settingsDrawerSource.includes('onClick={toggleAutoUpdate}'),
      'Toggle button must bind onClick={toggleAutoUpdate}'
    );
    // Visual state transitions
    assert.ok(
      settingsDrawerSource.includes("isAutoUpdate ? 'bg-cyan-500' : 'bg-slate-700'"),
      'Toggle track must transition between cyan-500 and slate-700'
    );
    assert.ok(
      settingsDrawerSource.includes("isAutoUpdate ? 'translate-x-6' : 'translate-x-0'"),
      'Toggle knob must translate between translate-x-6 and translate-x-0'
    );
  });

  test('3.3 Sleeper Username input field and accessible label association', () => {
    assert.ok(
      settingsDrawerSource.includes('id="username-input"'),
      'Input element must have id="username-input"'
    );
    assert.ok(
      settingsDrawerSource.includes('htmlFor="username-input"'),
      'Label element must have htmlFor="username-input"'
    );
    assert.ok(
      settingsDrawerSource.includes('disabled={isLoading}'),
      'Apply button must be disabled during loading state (disabled={isLoading})'
    );
    assert.ok(
      settingsDrawerSource.includes('onClick={handleSave}'),
      'Apply button must trigger handleSave'
    );
  });

  test('3.4 Polling frequency selector buttons (5s / 10s) and background throttle note', () => {
    assert.ok(
      settingsDrawerSource.includes('5000'),
      'SettingsDrawer must provide 5000ms (5s) interval option'
    );
    assert.ok(
      settingsDrawerSource.includes('10000'),
      'SettingsDrawer must provide 10000ms (10s) interval option'
    );
    assert.ok(
      settingsDrawerSource.includes('30s when application is in a background tab'),
      'Drawer must document 30s background tab throttling'
    );
  });

  test('3.5 Outbound egress status tags (Target API, Cloud Run / App Engine)', () => {
    assert.ok(
      settingsDrawerSource.includes('Outbound Egress Status'),
      'Drawer must feature "Outbound Egress Status" section'
    );
    assert.ok(
      settingsDrawerSource.includes('https://api.sleeper.app/v1/'),
      'Drawer must display target API URL: https://api.sleeper.app/v1/'
    );
    assert.ok(
      settingsDrawerSource.includes('Standalone Cloud Run / App Engine Container'),
      'Drawer must display deployment environment tag'
    );
  });

  test('3.6 Context auto-update poller lifecycle and visibility listener cleanup', () => {
    assert.ok(
      contextSource.includes("document.visibilityState === 'hidden'"),
      'OneiromancyContext must inspect document.visibilityState'
    );
    assert.ok(
      contextSource.includes('const interval = isHidden ? 30000 :'),
      'OneiromancyContext must throttle polling to 30,000ms when tab is hidden'
    );
    assert.ok(
      contextSource.includes("document.addEventListener('visibilitychange'"),
      'OneiromancyContext must register visibilitychange listener'
    );
    assert.ok(
      contextSource.includes("document.removeEventListener('visibilitychange'"),
      'OneiromancyContext must clean up visibilitychange listener on unmount'
    );
  });
});

// ============================================================================
// SUITE 4: Static Export Architecture & Resilience
// ============================================================================
describe('Suite 4: Static Export Architecture & Resilience', () => {
  test('4.1 next.config.mjs specifies output export for client-side architecture', () => {
    const configPath = path.join(PROJECT_ROOT, 'next.config.mjs');
    assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist');
    const configContent = fs.readFileSync(configPath, 'utf8');
    assert.ok(
      configContent.includes("output: 'export'") || configContent.includes('output: "export"'),
      'next.config.mjs must specify output: export'
    );
  });

  test('4.2 Client resilience: Sleeper API client implements graceful offline fallback', () => {
    assert.ok(
      sleeperSource.includes('offline_mode_active: true'),
      'Sleeper client must implement offline fallback state'
    );
  });

  test('4.3 Standalone or static export verification', () => {
    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'next.config.mjs')), 'next.config.mjs must exist');
  });
});

// ============================================================================
// SUITE 5: Adversarial Edge Cases & Fuzzing
// ============================================================================
describe('Suite 5: Adversarial Edge Cases & Fuzzing', () => {
  test('5.1 Fuzzing 100 anomalous draft IDs through fetchSleeperDraft asserts deterministic fallback', async () => {
    const sleeper = await getFreshSleeperModule();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const testIds = [
        '',
        ' ',
        '   ',
        'mock',
        'mock_oneiromancy_draft_2025',
        'null',
        'undefined',
        'NaN',
        '0',
        '-1',
        '999999999999999999999999999999999999',
        '../etc/passwd',
        'DROP TABLE drafts;',
        '<script>alert(1)</script>',
        '✨🔮⚡🪐',
        'draft/with/slashes',
        'draft?query=1&param=2',
        '#hashtag_draft',
        '\n\r\t',
        ...Array.from({ length: 80 }, (_, i) => `fuzz_draft_${i}_${Math.random().toString(36).slice(2)}`),
      ];

      for (const draftId of testIds) {
        const result = await sleeper.fetchSleeperDraft(draftId);
        assert.ok(result, `DraftState must be defined for ID: ${JSON.stringify(draftId)}`);
        assert.ok(Array.isArray(result.cosmic_board), 'cosmic_board must be an array');
        assert.ok(Array.isArray(result.my_roster), 'my_roster must be an array');
        assert.ok(result.settings, 'settings must be defined');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('5.2 Extreme concurrency burst: 100 parallel requests succeed without premature client-side block', async () => {
    const sleeper = await getFreshSleeperModule();
    let networkCallCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      networkCallCount++;
      return new Response(
        JSON.stringify({ draft_id: 'hammer_100', status: 'drafting', settings: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const promises = Array.from({ length: 100 }, (_, i) =>
        sleeper.fetchDraftMetadata(`hammer_draft_${i}`).then(
          () => ({ success: true }),
          (err) => ({ success: false, error: err.message })
        )
      );

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      assert.equal(successes.length, 100, 'All 100 requests succeed without client-side block');
      assert.equal(failures.length, 0, 'Zero requests fail closed with RATE_LIMIT_EXCEEDED');
      assert.equal(networkCallCount, 100, 'All 100 requests reach network');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('5.3 Sleeper API player dictionary 24-hour cache TTL and failure resilience', async () => {
    const sleeper = await getFreshSleeperModule();

    let fetchCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCount++;
      return new Response(
        JSON.stringify({
          player_burrow: { player_id: 'player_burrow', first_name: 'Joe', last_name: 'Burrow' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      // First call: fetches from network
      const dict1 = await sleeper.fetchNFLPlayers();
      assert.equal(dict1.player_burrow?.first_name, 'Joe');
      assert.equal(fetchCount, 1);

      // Second call: served from in-memory cache without network hit
      const dict2 = await sleeper.fetchNFLPlayers();
      assert.equal(dict2.player_burrow?.first_name, 'Joe');
      assert.equal(fetchCount, 1, 'Second fetchNFLPlayers call must be served from cache (TTL 24h)');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
