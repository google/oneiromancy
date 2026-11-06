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
    if (typeof sleeper.clearProjectionsCache === 'function') {
      sleeper.clearProjectionsCache();
    }
    if (typeof sleeper.setSeasonContext === 'function') {
      sleeper.setSeasonContext(null);
    }
  });

  afterEach(() => {
    if (typeof sleeper.resetRateLimit === 'function') {
      sleeper.resetRateLimit();
    }
    if (typeof sleeper.clearProjectionsCache === 'function') {
      sleeper.clearProjectionsCache();
    }
    if (typeof sleeper.setSeasonContext === 'function') {
      sleeper.setSeasonContext(null);
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

  // ==========================================================================
  // Suite 7.3: Bye-Week Next-Play-Week Projections Interception & Caching
  // ==========================================================================
  describe('7.3 Bye-Week Next-Play-Week Projections Interception & Caching', () => {
    const controlledDict = {
      '4984': {
        player_id: '4984',
        full_name: 'Josh Allen',
        first_name: 'Josh',
        last_name: 'Allen',
        position: 'QB',
        team: 'BUF',
        active: true,
        status: 'Active',
        bye_week: 7,
        search_rank: 1,
      },
      '4046': {
        player_id: '4046',
        full_name: 'Patrick Mahomes',
        first_name: 'Patrick',
        last_name: 'Mahomes',
        position: 'QB',
        team: 'KC',
        active: true,
        status: 'Active',
        bye_week: 10,
        search_rank: 2,
      },
    };

    test('7.3.1 loads next-week projections once per TTL when a player is on bye and enriches next_play_week and next_week_projected_points without mutating current-week projected_points', async () => {
      let nextWeekFetchCount = 0;
      server.use(
        http.get('https://api.sleeper.app/v1/state/nfl', () =>
          HttpResponse.json({ season: '2026', week: 7, season_type: 'regular' }),
        ),
        http.get('https://api.sleeper.app/schedule/nfl/regular/2026', () =>
          HttpResponse.json([
            { week: 7, date: '2026-10-18', home: 'KC', away: 'MIA' },
            { week: 8, date: '2026-10-25', home: 'BUF', away: 'MIA' },
            { week: 10, date: '2026-11-08', home: 'BUF', away: 'IND' },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/7', () =>
          HttpResponse.json({ '4046': { pts_ppr: 20.5 } }),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/8', () => {
          nextWeekFetchCount += 1;
          return HttpResponse.json({ '4984': { pts_ppr: 22.8 }, '4046': { pts_ppr: 19.1 } });
        }),
      );

      const settings = {
        sleeper_username: 'OneiroVanguard',
        league_id: '9000000000000000001',
        draft_id: '9000000000000000002',
        user_id: FIXTURES.user.user_id,
        user_slot: 7,
      };

      const state1 = await sleeper.fetchSleeperDraft(
        '9000000000000000002',
        settings,
        controlledDict,
        { throwOnError: true },
      );
      const josh1 = state1.cosmic_board.find((p) => p.id === '4984');
      assert.equal(nextWeekFetchCount, 1, 'Next-week projections must be fetched once for active Week 7 bye');
      assert.equal(josh1?.projected_points, 0, 'Current-week projected_points must stay 0 on bye');
      assert.equal(josh1?.next_play_week, 8, 'Week-7 bye player must resolve next_play_week = 8');
      assert.equal(josh1?.next_week_projected_points, 22.8, 'Week-7 bye player must receive Week-8 next_week_projected_points');

      // Second call within 10-minute TTL must hit projectionsCache instead of making a second HTTP call
      const state2 = await sleeper.fetchSleeperDraft(
        '9000000000000000002',
        settings,
        controlledDict,
        { throwOnError: true },
      );
      const josh2 = state2.cosmic_board.find((p) => p.id === '4984');
      assert.equal(nextWeekFetchCount, 1, 'Subsequent fetch within TTL must reuse cached next-week projections');
      assert.equal(josh2?.next_week_projected_points, 22.8);
    });

    test('7.3.2 skips next-week projections request completely when zero players are on bye in active week', async () => {
      server.use(
        http.get('https://api.sleeper.app/v1/state/nfl', () =>
          HttpResponse.json({ season: '2025', week: 2, season_type: 'regular' }),
        ),
        http.get('https://api.sleeper.app/schedule/nfl/regular/2025', () =>
          HttpResponse.json([
            { week: 2, date: '2025-09-14', home: 'BUF', away: 'KC' },
            { week: 3, date: '2025-09-21', home: 'BUF', away: 'MIA' },
            { week: 7, date: '2025-10-19', home: 'KC', away: 'LV' },
            { week: 10, date: '2025-11-09', home: 'BUF', away: 'IND' },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2025/2', () =>
          HttpResponse.json({ '4984': { pts_ppr: 24.0 }, '4046': { pts_ppr: 21.5 } }),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2025/3', () => {
          throw new Error('Next-week projections endpoint must not be called when zero players are on bye');
        }),
      );

      const state = await sleeper.fetchSleeperDraft(
        '9000000000000000002',
        {
          sleeper_username: 'OneiroVanguard',
          league_id: '9000000000000000001',
          draft_id: '9000000000000000002',
          user_id: FIXTURES.user.user_id,
          user_slot: 7,
        },
        controlledDict,
        { throwOnError: true },
      );

      const nextWeekCalls = server
        .getInterceptedRequests()
        .filter((r) => r.url.includes('/projections/nfl/regular/2025/3'));
      assert.equal(nextWeekCalls.length, 0, 'Must make 0 requests for next-week projections when no player is on bye');
      const josh = state.cosmic_board.find((p) => p.id === '4984');
      assert.equal(josh?.next_play_week, undefined);
      assert.equal(josh?.next_week_projected_points, undefined);
    });

    test('7.3.3 handles HTTP 500 error on next-week projections non-fatally, falling back only to explicit positive baseline_projected_points and never synthetic hashes', async () => {
      let failedEndpointHits = 0;
      const dictWithBaseline = {
        ...controlledDict,
        '5859': {
          player_id: '5859',
          full_name: 'James Cook',
          first_name: 'James',
          last_name: 'Cook',
          position: 'RB',
          team: 'BUF',
          active: true,
          status: 'Active',
          bye_week: 7,
          search_rank: 15,
          baseline_projected_points: 19.4,
        },
        '7526': {
          player_id: '7526',
          full_name: 'Khalil Shakir',
          first_name: 'Khalil',
          last_name: 'Shakir',
          position: 'WR',
          team: 'BUF',
          active: true,
          status: 'Active',
          bye_week: 7,
          search_rank: 35,
          baseline_projected_points: -2.5,
        },
      };

      server.use(
        http.get('https://api.sleeper.app/v1/state/nfl', () =>
          HttpResponse.json({ season: '2024', week: 7, season_type: 'regular' }),
        ),
        http.get('https://api.sleeper.app/schedule/nfl/regular/2024', () =>
          HttpResponse.json([
            { week: 7, date: '2024-10-20', home: 'KC', away: 'MIA' },
            { week: 8, date: '2024-10-27', home: 'BUF', away: 'SEA' },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2024/7', () =>
          HttpResponse.json({ '4046': { pts_ppr: 18.0 } }),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2024/8', () => {
          failedEndpointHits += 1;
          return HttpResponse.json({ error: 'Upstream unavailable' }, { status: 500 });
        }),
        http.get('https://api.sleeper.app/v1/league/9000000000000000001/matchups/8', () =>
          HttpResponse.json([]),
        ),
      );

      const settings = {
        sleeper_username: 'OneiroVanguard',
        league_id: '9000000000000000001',
        draft_id: '9000000000000000002',
        user_id: FIXTURES.user.user_id,
        user_slot: 7,
      };
      const state = await sleeper.fetchSleeperDraft(
        '9000000000000000002',
        settings,
        dictWithBaseline,
        { throwOnError: true },
      );

      assert.equal(state.isLive, true, 'HTTP 500 on next-week projections must not abort live sync');
      assert.equal(failedEndpointHits, 1, 'Failed endpoint must be queried once');
      const josh = state.cosmic_board.find((p) => p.id === '4984');
      assert.equal(josh?.projected_points, 0, 'Current-week projected_points remains 0 on bye');
      assert.equal(josh?.next_play_week, 8, 'next_play_week still resolves from schedule');
      assert.equal(
        josh?.next_week_projected_points,
        undefined,
        'HTTP 500 without explicit baseline_projected_points must leave next_week_projected_points undefined rather than copying synthetic hash defaults',
      );
      assert.equal(
        josh?.baseline_projected_points,
        undefined,
        'Synthetic baseline_projected_points must not be retained on board when no verified baseline projection exists',
      );

      const cook = state.cosmic_board.find((p) => p.id === '5859');
      assert.equal(cook?.projected_points, 0, 'Current-week projected_points remains 0 on bye even with baseline');
      assert.equal(cook?.next_play_week, 8);
      assert.equal(
        cook?.next_week_projected_points,
        19.4,
        'HTTP 500 must fall back to explicit positive baseline_projected_points when available',
      );

      const shakir = state.cosmic_board.find((p) => p.id === '7526');
      assert.equal(
        shakir?.next_week_projected_points,
        undefined,
        'Non-positive baseline_projected_points must not produce lookahead points',
      );

      // Re-fetching within TTL must hit negative cache and not hammer failing endpoint
      await sleeper.fetchSleeperDraft('9000000000000000002', settings, dictWithBaseline, { throwOnError: true });
      assert.equal(failedEndpointHits, 1, 'Negative cache must prevent repeated HTTP 500 retries within TTL');

      // Future-week deriveWeeklyMatchup must still retain per-player synthetic baseline_projected_points
      const week8Preview = sleeper.deriveWeeklyMatchup(
        2,
        [
          { roster_id: 2, owner_id: FIXTURES.user.user_id, name: 'My Team', slot: 7, is_user: true, players: ['4984'], starters: ['4984'] },
          { roster_id: 3, owner_id: 'opp', name: 'Opp', slot: 1, is_user: false, players: ['4046'], starters: ['4046'] },
        ],
        [],
        state.cosmic_board,
        [],
        8,
      );
      const joshWeek8Fav = week8Preview.player_favorabilities.find((pf) => pf.player_id === '4984');
      assert.equal(
        joshWeek8Fav?.projected_points,
        12.5,
        'Future-week deriveWeeklyMatchup must fall back to starter default when baseline_projected_points is undefined',
      );
    });

    test('7.3.4 prioritizes live playerDict team over stale draft pick metadata team and excludes released Free Agents from bye lookahead', async () => {
      const { bye_week: _ignoredBye, ...tradedJoshBase } = controlledDict['4984'];
      const tradedDict = {
        ...controlledDict,
        '4984': {
          ...tradedJoshBase,
          team: 'KC',
        },
        '9999': {
          player_id: '9999',
          full_name: 'Released Veteran',
          first_name: 'Released',
          last_name: 'Veteran',
          position: 'WR',
          team: 'FA',
          active: false,
          status: 'Inactive',
          bye_week: 7,
          search_rank: 999,
        },
      };
      server.use(
        http.get('https://api.sleeper.app/v1/state/nfl', () =>
          HttpResponse.json({ season: '2026', week: 7, season_type: 'regular' }),
        ),
        http.get('https://api.sleeper.app/schedule/nfl/regular/2026', () =>
          HttpResponse.json([
            { week: 7, date: '2026-10-18', home: 'KC', away: 'MIA' },
            { week: 8, date: '2026-10-25', home: 'BUF', away: 'NYJ' },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/draft/9000000000000000002/picks', () =>
          HttpResponse.json([
            {
              player_id: '4984',
              picked_by: FIXTURES.user.user_id,
              roster_id: 2,
              draft_slot: 7,
              round: 1,
              pick_no: 1,
              metadata: {
                team: 'BUF',
                first_name: 'Josh',
                last_name: 'Allen',
                position: 'QB',
              },
            },
            {
              player_id: '9999',
              picked_by: FIXTURES.user.user_id,
              roster_id: 2,
              draft_slot: 7,
              round: 2,
              pick_no: 14,
              metadata: {
                team: 'BUF',
                first_name: 'Released',
                last_name: 'Veteran',
                position: 'WR',
                baseline_projected_points: '11.5',
              },
            },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/league/9000000000000000001/rosters', () =>
          HttpResponse.json([
            {
              roster_id: 2,
              owner_id: FIXTURES.user.user_id,
              starters: ['4984'],
              players: ['4984', '9999'],
            },
          ]),
        ),
        http.get('https://api.sleeper.app/v1/league/9000000000000000001/matchups/7', () =>
          HttpResponse.json([]),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/7', () =>
          HttpResponse.json({ '4984': { pts_ppr: 22.1 } }),
        ),
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/8', () =>
          HttpResponse.json({ '4984': { pts_ppr: 23.0 }, '9999': { pts_ppr: 12.0 } }),
        ),
      );

      const state = await sleeper.fetchSleeperDraft(
        '9000000000000000002',
        {
          sleeper_username: 'OneiroVanguard',
          league_id: '9000000000000000001',
          draft_id: '9000000000000000002',
          user_id: FIXTURES.user.user_id,
          user_slot: 7,
        },
        tradedDict,
        { throwOnError: true },
      );

      const lookaheadCalls = server
        .getInterceptedRequests()
        .filter((r) => /\/projections\/nfl\/regular\/2026\/(?!7\b)\d+/.test(r.url));
      assert.equal(lookaheadCalls.length, 0, 'Must make 0 requests for lookahead weeks (e.g. Week 8) when live team KC plays and released FA has no NFL team');
      const tradedJosh = state.cosmic_board.find((p) => p.id === '4984');
      assert.equal(tradedJosh?.team, 'KC');
      assert.equal(tradedJosh?.next_play_week, undefined);
      assert.equal(tradedJosh?.next_week_projected_points, undefined);

      const releasedWr = state.cosmic_board.find((p) => p.id === '9999');
      assert.equal(releasedWr?.team, 'BUF', 'Base player record team must remain immutable from drafted pick metadata');
      assert.equal(releasedWr?.bye_week, 7, 'Base player record bye_week must remain immutable from season bye weeks');
      assert.equal(releasedWr?.next_play_week, undefined, 'Released FA must not inherit stale draft-pick bye lookahead week');
      assert.equal(releasedWr?.next_week_projected_points, undefined, 'Released FA must not inherit lookahead projected points');
    });

    test('7.3.5 concurrent fetchWeeklyProjections calls share a single in-flight request', async () => {
      let fetchHits = 0;
      server.use(
        http.get('https://api.sleeper.app/v1/projections/nfl/regular/2026/10', async () => {
          fetchHits += 1;
          await new Promise((r) => setTimeout(r, 15));
          return HttpResponse.json({ '4984': { pts_ppr: 24.6 } });
        }),
      );

      const [r1, r2, r3] = await Promise.all([
        sleeper.fetchWeeklyProjections('2026', 10),
        sleeper.fetchWeeklyProjections('2026', 10),
        sleeper.fetchWeeklyProjections('2026', 10),
      ]);

      assert.equal(fetchHits, 1, 'Concurrent callers for the same week must share 1 in-flight network request');
      assert.equal(r1?.['4984']?.pts_ppr, 24.6);
      assert.deepEqual(r2, r1);
      assert.deepEqual(r3, r1);
    });
  });
});
