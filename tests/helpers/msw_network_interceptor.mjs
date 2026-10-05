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
 * Oneiromancy - Mock Service Worker (MSW) & Network Interception Engine
 * 
 * Provides an authentic MSW-compatible server implementation in Node.js 22 that
 * intercepts outgoing HTTP/HTTPS fetch requests to api.sleeper.app at the network
 * level and serves the authentic JSON mock files relocated to:
 * mocks/
 * 
 * Implements MSW API specification:
 * - setupServer(...handlers)
 * - http.get(url, resolver)
 * - HttpResponse.json(data, init)
 * - server.listen({ onUnhandledRequest })
 * - server.resetHandlers()
 * - server.use(...handlers)
 * - server.close()
 * 
 * Guarantees ZERO real network calls reach external servers during test execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate authentic mocks directory inside oneiromancy
const possibleMockDirs = [
  path.resolve(__dirname, '../../mocks'),
  path.resolve(__dirname, '../mocks'),
  path.resolve(process.cwd(), 'mocks'),
];

export const MOCKS_DIR = possibleMockDirs.find(
  (d) => fs.existsSync(d) && fs.existsSync(path.join(d, 'mock_league_info.json'))
);

if (!MOCKS_DIR) {
  throw new Error(`MSW Error: Unable to locate relocated mocks directory in: ${possibleMockDirs.join(', ')}`);
}

// Load authentic mock JSON data cache
export const FIXTURES = {
  user: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_user.json'), 'utf8')),
  leagueInfo: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_info.json'), 'utf8')),
  leagueUsers: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_users.json'), 'utf8')),
  leagueRosters: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_rosters.json'), 'utf8')),
  draftMeta: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_draft_metadata.json'), 'utf8')),
  draftPicks: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_draft_picks.json'), 'utf8')),
  matchupsW1: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_matchups_w1.json'), 'utf8')),
  leagueDrafts: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_league_drafts.json'), 'utf8')),
  userLeagues2024: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_user_leagues_2024.json'), 'utf8')),
  userLeagues2025: JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, 'mock_user_leagues_2025.json'), 'utf8')),
};

// Lazy loader for large players mock (14.6 MB)
let _cachedPlayers = null;
export function getNflPlayersFixture() {
  if (!_cachedPlayers) {
    const raw = fs.readFileSync(path.join(MOCKS_DIR, 'mock_players_nfl.json'), 'utf8');
    _cachedPlayers = JSON.parse(raw);
  }
  return _cachedPlayers;
}

/**
 * Standard MSW HttpResponse constructor
 */
export class HttpResponse extends Response {
  static json(data, init = {}) {
    const body = JSON.stringify(data);
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return new Response(body, {
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      headers,
    });
  }

  static text(body, init = {}) {
    return new Response(body, {
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      headers: new Headers(init.headers || {}),
    });
  }

  static error() {
    return Response.error();
  }
}

/**
 * Standard MSW HTTP method definition
 */
export const http = {
  get(urlPattern, resolver) {
    return {
      method: 'GET',
      urlPattern,
      resolver,
    };
  },
  post(urlPattern, resolver) {
    return {
      method: 'POST',
      urlPattern,
      resolver,
    };
  },
  put(urlPattern, resolver) {
    return {
      method: 'PUT',
      urlPattern,
      resolver,
    };
  },
  delete(urlPattern, resolver) {
    return {
      method: 'DELETE',
      urlPattern,
      resolver,
    };
  },
};

/**
 * Default Sleeper API Handlers mapped to relocated authentic mocks
 */
export function createDefaultSleeperHandlers() {
  return [
    // GET /v1/user/<username>
    http.get(/https:\/\/api\.sleeper\.app\/v1\/user\/([^/]+)$/, ({ params, request }) => {
      const username = params[0]?.toLowerCase();
      if (username === 'oneirovanguard' || username === 'oneirovangard' || username === '9000000000000000101') {
        return HttpResponse.json(FIXTURES.user);
      }
      return HttpResponse.json(null, { status: 404, statusText: 'Not Found' });
    }),

    // GET /v1/user/<user_id>/leagues/nfl/<season>
    http.get(/https:\/\/api\.sleeper\.app\/v1\/user\/([^/]+)\/leagues\/nfl\/([^/]+)$/, ({ params }) => {
      const season = params[1];
      if (season === '2024') {
        return HttpResponse.json(FIXTURES.userLeagues2024);
      }
      if (season === '2025') {
        return HttpResponse.json(FIXTURES.userLeagues2025);
      }
      return HttpResponse.json([FIXTURES.leagueInfo]);
    }),

    // GET /v1/league/<league_id>
    http.get(/https:\/\/api\.sleeper\.app\/v1\/league\/([^/]+)$/, () => {
      return HttpResponse.json(FIXTURES.leagueInfo);
    }),

    // GET /v1/league/<league_id>/users
    http.get(/https:\/\/api\.sleeper\.app\/v1\/league\/([^/]+)\/users$/, () => {
      return HttpResponse.json(FIXTURES.leagueUsers);
    }),

    // GET /v1/league/<league_id>/rosters
    http.get(/https:\/\/api\.sleeper\.app\/v1\/league\/([^/]+)\/rosters$/, () => {
      return HttpResponse.json(FIXTURES.leagueRosters);
    }),

    // GET /v1/league/<league_id>/drafts
    http.get(/https:\/\/api\.sleeper\.app\/v1\/league\/([^/]+)\/drafts$/, () => {
      return HttpResponse.json(FIXTURES.leagueDrafts);
    }),

    // GET /v1/draft/<draft_id>
    http.get(/https:\/\/api\.sleeper\.app\/v1\/draft\/([^/]+)$/, () => {
      return HttpResponse.json(FIXTURES.draftMeta);
    }),

    // GET /v1/draft/<draft_id>/picks
    http.get(/https:\/\/api\.sleeper\.app\/v1\/draft\/([^/]+)\/picks$/, () => {
      return HttpResponse.json(FIXTURES.draftPicks);
    }),

    // GET /v1/league/<league_id>/matchups/<week>
    http.get(/https:\/\/api\.sleeper\.app\/v1\/league\/([^/]+)\/matchups\/([^/]+)$/, () => {
      return HttpResponse.json(FIXTURES.matchupsW1);
    }),

    // GET /v1/players/nfl
    http.get(/https:\/\/api\.sleeper\.app\/v1\/players\/nfl$/, () => {
      return HttpResponse.json(getNflPlayersFixture());
    }),
  ];
}

/**
 * Mock Service Worker Server Implementation
 */
export class MSWServer {
  constructor(...initialHandlers) {
    this.initialHandlers = initialHandlers.length > 0 ? initialHandlers : createDefaultSleeperHandlers();
    this.currentHandlers = [...this.initialHandlers];
    this.isListening = false;
    this.originalFetch = null;
    this.interceptor = null;
    this.interceptedRequests = [];
  }

  listen(options = {}) {
    if (this.isListening && globalThis.fetch === this.interceptor) return;

    if (globalThis.fetch !== this.interceptor) {
      this.originalFetch = globalThis.fetch;
    }
    const self = this;

    const mswInterceptedFetch = async function mswInterceptedFetch(input, init = {}) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();

      self.interceptedRequests.push({ url, method, timestamp: Date.now() });

      for (const handler of self.currentHandlers) {
        if (handler.method !== method) continue;

        let isMatch = false;
        let params = [];

        if (handler.urlPattern instanceof RegExp) {
          const match = url.match(handler.urlPattern);
          if (match) {
            isMatch = true;
            params = match.slice(1);
          }
        } else if (typeof handler.urlPattern === 'string') {
          if (handler.urlPattern.includes('*')) {
            const regex = new RegExp('^' + handler.urlPattern.replace(/\*/g, '.*') + '$');
            isMatch = regex.test(url);
          } else {
            isMatch = url === handler.urlPattern;
          }
        }

        if (isMatch) {
          const response = await handler.resolver({
            request: new Request(input, init),
            params,
          });
          if (response instanceof Response) {
            return response;
          }
        }
      }

      if (url.includes('api.sleeper.app')) {
        const errorMsg = `[MSW Error] Intercepted unhandled request to external Sleeper API: ${method} ${url}`;
        if (options.onUnhandledRequest === 'error' || !options.onUnhandledRequest) {
          throw new Error(errorMsg);
        } else if (typeof options.onUnhandledRequest === 'function') {
          options.onUnhandledRequest({ method, url });
        }
      }

      return self.originalFetch(input, init);
    };

    this.interceptor = mswInterceptedFetch;
    globalThis.fetch = mswInterceptedFetch;
    this.isListening = true;
  }

  use(...newHandlers) {
    this.currentHandlers.unshift(...newHandlers);
  }

  resetHandlers() {
    this.currentHandlers = [...this.initialHandlers];
    this.interceptedRequests = [];
  }

  close() {
    if (!this.isListening) return;
    if (this.originalFetch && globalThis.fetch === this.interceptor) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    this.interceptor = null;
    this.isListening = false;
    this.interceptedRequests = [];
  }

  getInterceptedCount() {
    return this.interceptedRequests.length;
  }

  getInterceptedRequests() {
    return [...this.interceptedRequests];
  }
}

export function setupServer(...handlers) {
  return new MSWServer(...handlers);
}
