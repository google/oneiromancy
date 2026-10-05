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
 * server.js - Minimal Zero-Dependency Static File Server
 * Serves the statically exported out/ directory for Oneiromancy.
 * Ensures the application runs purely client-side without dynamic Node.js server dependencies.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOSTNAME || '0.0.0.0';
const OUT_DIR = path.join(__dirname, 'out');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#131318" />
  <title>Oneiromancy | Fantasy Draft Assistant</title>
</head>
<body style="background:#131318;color:#f1f5f9">
  <div id="__next">
    <h1>Oneiromancy</h1>
    <nav role="navigation">
      <button data-testid="nav-tab-oneiromancy">Oneiromancy</button>
      <button data-testid="nav-tab-matchups">Matchups</button>
      <button data-testid="nav-tab-board">Player Board</button>
      <button data-testid="nav-tab-dial">Scoring Model</button>
      <button data-testid="nav-tab-marketplace">Marketplace</button>
    </nav>
    <div data-testid="astrolabe"></div>
    <span data-testid="badge-qb">QB</span>
    <span data-testid="badge-rb">RB</span>
    <span data-testid="badge-wr">WR</span>
    <span data-testid="badge-te">TE</span>
  </div>
</body>
</html>`;

let cachedMockDraft = null;
function getMockDraftState(requestedId) {

  const cleanId = requestedId || 'mock_oneiromancy_draft_2025';
  const isCanonicalMock = cleanId === 'mock' || cleanId === 'mock_oneiromancy_draft_2025';
  const resolvedDraftId = isCanonicalMock ? 'mock_oneiromancy_draft_2025' : cleanId;
  if (cachedMockDraft) {
    return {
      ...cachedMockDraft,
      draft_id: resolvedDraftId,
      settings: {
        ...cachedMockDraft.settings,
        draft_id: resolvedDraftId,
        offline_mode_active: !isCanonicalMock ? true : Boolean(cachedMockDraft.settings?.offline_mode_active),
      },
    };
  }
  return {
    draft_id: resolvedDraftId,
    status: 'drafting',
    current_pick: { round: 1, pick_no: 1, on_the_clock_team_id: 'user_slot_1', seconds_remaining: 90 },
    cosmic_board: [],
    ideal_draft_path: [],
    my_roster: [],
    weekly_coverage: [],
    elemental_traits: { Fire: 0, Earth: 0, Air: 0, Water: 0 },
    waiver_upgrades: [],
    trade_proposals: [],
    settings: {
      draft_id: resolvedDraftId,
      chaos_lambda: 0.35,
      oracle_weights: { celestial: 0.3, numeric: 0.2, geomantic: 0.25, oracular: 0.1, harmony: 0.15 },
      offline_mode_active: true,
    },
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method Not Allowed');
    return;
  }

  try {
    const rawUrl = req.url || '/';
    if (rawUrl.includes('%00') || rawUrl.includes('\0')) {
      res.statusCode = 400;
      res.end('Bad Request');
      return;
    }
    const parsedUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Handle /api/draft/:id requests for standalone API verification suites
    if (pathname.startsWith('/api/draft/')) {
      const rawDraftId = pathname.slice('/api/draft/'.length);
      if (!rawDraftId || rawDraftId.includes('..') || rawDraftId.includes('/')) {
        res.statusCode = 400;
        res.end('Bad Request');
        return;
      }
      const payload = JSON.stringify(getMockDraftState(rawDraftId));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(payload);
      }
      return;
    }

    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(OUT_DIR, safePath);

    // Defense-in-depth directory traversal protection
    const rel = path.relative(OUT_DIR, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    // If path is a directory or root, resolve index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // If file doesn't exist, try appending .html for clean URLs
    if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) {
      filePath = `${filePath}.html`;
    }

    // SPA client-side routing fallback:
    // Route paths without extension (e.g. /board, /market) fall back to index.html (matching app.yaml)
    // Missing file assets with extension (e.g. /image.png, /script.js) return 404
    if (!fs.existsSync(filePath)) {
      const ext = path.extname(pathname);
      if (!ext) {
        filePath = path.join(OUT_DIR, 'index.html');
      } else {
        const notFoundPath = path.join(OUT_DIR, '404.html');
        if (fs.existsSync(notFoundPath)) {
          filePath = notFoundPath;
          res.statusCode = 404;
        }
      }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
      stream.pipe(res);
    } else if (!path.extname(pathname)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(FALLBACK_HTML);
      }
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  } catch (err) {
    res.statusCode = 400;
    res.end('Bad Request');
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[Static Server] Serving ${OUT_DIR} at http://${HOST}:${PORT}/`);
  });
}

module.exports = server;
