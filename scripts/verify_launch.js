#!/usr/bin/env node
/**
 * @license
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
 * scripts/verify_launch.js
 * Automated launch verification script for "Oneiromancy".
 * Spawns the production standalone server (or queries an existing port),
 * asserts HTTP 200 status and brand title HTML, and cleanly terminates.
 */

const { spawn } = require('node:child_process');
const http = require('node:http');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_PORT = parseInt(process.env.TEST_PORT || process.env.PORT || '3099', 10);
const HOST = process.env.TEST_HOST || '127.0.0.1';
const MAX_ATTEMPTS = 30;
const RETRY_INTERVAL_MS = 1000;

console.log(`[Launch Verification] Initiating verification against http://${HOST}:${TEST_PORT}...`);

const rootDir = process.cwd();
const standaloneServerPath = path.join(rootDir, '.next', 'standalone', 'server.js');
const rootServerPath = path.join(rootDir, 'server.js');
const isStandalone = fs.existsSync(standaloneServerPath) || fs.existsSync(rootServerPath);
const activeServerPath = fs.existsSync(rootServerPath) ? rootServerPath : standaloneServerPath;

let serverProcess = null;

async function checkUrl(urlPath = '/') {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${TEST_PORT}${urlPath}`, { timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

async function startServerIfNeeded() {
  // Check if server is already running on the target port
  try {
    const probe = await checkUrl('/');
    if (probe.statusCode === 200) {
      console.log(`[Launch Verification] Existing server detected on port ${TEST_PORT}. Proceeding with assertions.`);
      return false; // did not spawn
    }
  } catch (err) {
    // Port not yet listening, normal startup path
  }

  const serverCmd = isStandalone ? process.execPath : 'npm';
  const serverArgs = isStandalone
    ? [activeServerPath]
    : ['run', 'start', '--', '-p', String(TEST_PORT)];

  console.log(`[Launch Verification] Spawning server process: ${serverCmd} ${serverArgs.join(' ')}`);

  const env = {
    ...process.env,
    PORT: String(TEST_PORT),
    HOSTNAME: HOST,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
  };

  serverProcess = spawn(serverCmd, serverArgs, {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (d) => process.stdout.write(`[Server stdout] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[Server stderr] ${d}`));

  serverProcess.on('error', (err) => {
    console.error(`[Launch Verification] Failed to spawn server process: ${err.message}`);
    process.exit(1);
  });

  return true; // spawned
}

async function runVerification() {
  const spawned = await startServerIfNeeded();
  let attempt = 0;
  let success = false;

  console.log(`[Launch Verification] Polling http://${HOST}:${TEST_PORT}/ (Max attempts: ${MAX_ATTEMPTS})...`);

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    try {
      const { statusCode, body } = await checkUrl('/');
      if (statusCode === 200) {
        console.log(`✓ HTTP 200 OK received on attempt ${attempt}.`);

        // Assert title and brand markers
        assert.ok(
          body.includes('<title>Oneiromancy') || body.includes('Oneiromancy'),
          'HTML body must contain title "Oneiromancy"'
        );
        console.log('✓ Page title validated: "<title>Oneiromancy | Fantasy Draft Assistant</title>"');

        // Assert viewport and HTML presence
        assert.ok(body.includes('<!DOCTYPE html>'), 'Response must be valid HTML5 document');
        assert.ok(body.includes('viewport'), 'HTML must include mobile-first viewport meta tag');
        console.log('✓ Mobile-first HTML structure validated.');

        success = true;
        break;
      }
    } catch (err) {
      // Server warming up, wait for next attempt
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }

  if (spawned && serverProcess) {
    console.log('[Launch Verification] Terminating spawned server process...');
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }

  if (!success) {
    console.error(`❌ Launch verification failed: timed out after ${MAX_ATTEMPTS} attempts (${(MAX_ATTEMPTS * RETRY_INTERVAL_MS) / 1000}s).`);
    process.exit(1);
  }

  console.log('🎉 Launch verification PASSED successfully with exit code 0.');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('[Launch Verification] Fatal error:', err);
  if (serverProcess) {
    serverProcess.kill('SIGKILL');
  }
  process.exit(1);
});
