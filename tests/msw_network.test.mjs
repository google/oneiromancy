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
 * Tier 7: Mock Service Worker (MSW) & Network Interception Suite
 * 
 * Verifies that the client service and test environment intercept all outgoing
 * HTTP requests to api.sleeper.app at the network level using Mock Service Worker (MSW),
 * serving authentic JSON mock fixtures from oneiromancy/mocks/ without
 * ever making live external network calls.
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupServer, http, HttpResponse, FIXTURES } from './helpers/msw_network_interceptor.mjs';

// Import compiled Sleeper client
const sleeper = await import('./dist/lib/sleeper.js');

describe('Tier 7: Mock Service Worker (MSW) Network Interception', () => {
  let server;

  before(() => {
    server = setupServer();
    server.listen({ onUnhandledRequest: 'error' });
  });

  after(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    if (typeof sleeper.resetRateLimit === 'function') {
      sleeper.resetRateLimit();
    }
  });

  afterEach(() => {
    if (typeof sleeper.resetRateLimit === 'function') {
      sleeper.resetRateLimit();
    }
  });

  // ==========================================================================
  // Suite 7.1: Authentic Fixture Interception & Serving
  // ==========================================================================
  describe('7.1 Authentic Fixture Serving', () => {
    test('7.1.1 should intercept GET /v1/user/OneiroVanguard and return mock_user.json', async () => {
      const user = await sleeper.getUser('OneiroVanguard');
      assert.ok(user, 'User object must be returned');
      assert.equal(user.username, FIXTURES.user.username);
      assert.equal(user.user_id, FIXTURES.user.user_id);
      assert.equal(user.display_name, FIXTURES.user.display_name);
    });

    test('7.1.2 should intercept GET /v1/league/:id and return mock_league_info.json', async () => {
      const league = await sleeper.fetchLeague('9000000000000000001');
      assert.ok(league, 'League object must be returned');
      assert.equal(league.league_id, FIXTURES.leagueInfo.league_id);
      assert.equal(league.name, FIXTURES.leagueInfo.name);
      assert.equal(league.total_rosters, 12);
      assert.deepEqual(league.roster_positions, FIXTURES.leagueInfo.roster_positions);
    });

    test('7.1.3 should intercept GET /v1/league/:id/users and return mock_league_users.json', async () => {
      const users = await sleeper.fetchLeagueUsers('9000000000000000001');
      assert.ok(Array.isArray(users), 'Users must be an array');
      assert.equal(users.length, 12, 'Must have 12 authentic league users');
      const commanderUser = users.find((u) => u.user_id === FIXTURES.user.user_id);
      assert.ok(commanderUser, 'Must find OneiroVanguard in league users');
      assert.equal(commanderUser.metadata?.team_name?.trim(), 'AstralOracles');
    });

    test('7.1.4 should intercept GET /v1/league/:id/rosters and return mock_league_rosters.json', async () => {
      const rosters = await sleeper.fetchLeagueRosters('9000000000000000001');
      assert.ok(Array.isArray(rosters), 'Rosters must be an array');
      assert.equal(rosters.length, 12, 'Must have 12 authentic rosters');
      const userRoster = rosters.find((r) => r.owner_id === FIXTURES.user.user_id);
      assert.ok(userRoster, 'Must find user roster for OneiroVanguard');
      assert.equal(userRoster.roster_id, 2);
      assert.equal(userRoster.starters.length, 8);
      assert.equal(userRoster.players.length, 15);
    });

    test('7.1.5 should intercept GET /v1/draft/:id and return mock_draft_metadata.json', async () => {
      const draft = await sleeper.fetchDraftMetadata('9000000000000000002');
      assert.ok(draft, 'Draft metadata must be returned');
      assert.equal(draft.draft_id, FIXTURES.draftMeta.draft_id);
      assert.equal(draft.type, 'snake');
      assert.equal(draft.settings.teams, 12);
      assert.equal(draft.settings.rounds, 15);
    });

    test('7.1.6 should intercept GET /v1/draft/:id/picks and return mock_draft_picks.json', async () => {
      const picks = await sleeper.fetchDraftPicks('9000000000000000002');
      assert.ok(Array.isArray(picks), 'Picks must be an array');
      assert.equal(picks.length, 180, 'Must have 180 authentic draft picks (12 teams x 15 rounds)');
      assert.equal(picks[0].player_id, '4984'); // Josh Allen
      assert.equal(picks[0].round, 1);
      assert.equal(picks[0].draft_slot, 1);
    });

    test('7.1.7 should intercept GET /v1/league/:id/matchups/1 and return mock_league_matchups_w1.json', async () => {
      const matchups = await sleeper.fetchLeagueMatchups('9000000000000000001', 1);
      assert.ok(Array.isArray(matchups), 'Matchups must be an array');
      assert.equal(matchups.length, 12, 'Must have 12 matchup records for 12 teams');
      const userMatchup = matchups.find((m) => m.roster_id === 2);
      assert.ok(userMatchup, 'Must find roster 2 in week 1 matchups');
      assert.equal(userMatchup.matchup_id, 3);
    });

    test('7.1.8 should intercept GET /v1/league/:id/drafts via resolveLeagueDraftAndUser', async () => {
      const resolved = await sleeper.resolveLeagueDraftAndUser('9000000000000000001', 'OneiroVanguard');
      assert.ok(resolved, 'Must resolve draft and user');
      assert.equal(resolved.draft_id, '9000000000000000002');
      assert.equal(resolved.user_slot, 7);
      assert.equal(resolved.user_id, FIXTURES.user.user_id);
    });

    test('7.1.9 should intercept GET /v1/user/:id/leagues/nfl/:season via fetchUserLeagues', async () => {
      const result = await sleeper.fetchUserLeagues('OneiroVanguard');
      assert.ok(result?.user);
      assert.ok(Array.isArray(result?.leagues));
    });

    test('7.1.10 should intercept GET /v1/players/nfl and enrich player database', async () => {
      const players = await sleeper.fetchNFLPlayers();
      assert.ok(players && typeof players === 'object');
      assert.ok(players['6770'], 'Player 6770 must exist in players fixture');
      assert.equal(players['6770'].first_name, 'Joe');
      assert.equal(players['6770'].position, 'QB');
    });
  });

  // ==========================================================================
  // Suite 7.2: Runtime Overrides & Error Handling
  // ==========================================================================
  describe('7.2 Runtime Overrides & HTTP Fault Simulation', () => {
    test('7.2.1 should handle HTTP 429 Too Many Requests override cleanly', async () => {
      server.use(
        http.get('https://api.sleeper.app/v1/league/9000000000000000001', () => {
          return new HttpResponse(JSON.stringify({ message: 'rate limited' }), {
            status: 429,
            statusText: 'Too Many Requests',
          });
        })
      );

      const res = await sleeper.fetchLeague('9000000000000000001');
      assert.ok(res === null || res.league_id);
    });

    test('7.2.2 should handle HTTP 500 Internal Server Error override', async () => {
      server.use(
        http.get('https://api.sleeper.app/v1/user/ServerErrorUser', () => {
          return new HttpResponse(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            statusText: 'Internal Server Error',
          });
        })
      );

      await assert.rejects(
        async () => {
          await sleeper.getUser('ServerErrorUser');
        },
        /Failed to resolve user 'ServerErrorUser'|500/
      );
    });

    test('7.2.3 should strictly reject unhandled outgoing request to Sleeper API', async () => {
      await assert.rejects(
        async () => {
          await globalThis.fetch('https://api.sleeper.app/v1/forbidden_unhandled_route');
        },
        /Intercepted unhandled request to external Sleeper API/
      );
    });

    test('7.2.4 should track total intercepted requests across test lifecycle', async () => {
      await sleeper.getUser('OneiroVanguard');
      const count = server.getInterceptedCount();
      assert.ok(count > 0, 'Server must record all intercepted calls');
      const reqs = server.getInterceptedRequests();
      assert.ok(reqs.every((r) => r.url.includes('api.sleeper.app')));
    });
  });
});
