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
 * Oneiromancy - Sleeper API Client & Data Normalizer
 *
 * Official Sleeper API Documentation: https://docs.sleeper.com/
 *
 * Architecture & Rate Limiting:
 * Sleeper provides an unauthenticated, read-only HTTP JSON service (https://api.sleeper.app/v1/...).
 * Per official documentation (https://docs.sleeper.com/), API rate limit guidance recommends
 * staying under 1,000 requests per minute to prevent IP blocks.
 *
 * Client-Side Strategy:
 * - High-headroom sliding-window request tracker (MAX_REQ_PER_MIN = 300) to eliminate artificial throttling
 *   during multi-season discovery and polling.
 * - Reactive backoff cooldown: if Sleeper responds with an authentic HTTP 429 Too Many Requests,
 *   the client enters a 60-second cooldown (RATE_LIMIT_COOLDOWN_MS = 60000).
 * - User-initiated manual interactions (e.g. Apply & Sync, username edits) trigger resetRateLimit()
 *   to immediately clear active cooldowns and unblock lookups.
 */

import { clearNflGames, fetchEspnWeek, kickoffLabel, moonAt, neutralVenueCoords, planetaryHourAt, raceWithAbort, setWeekGames, teamGame, type NflGame } from './nflGames';
import { clearGameStatus, setGameStatus, teamGameStatus, type GameStatus } from './gameStatus';
import {
  AscensionStep,
  AvailableLeague,
  ByeCoverageWeek,
  CompetitorTeam,
  ConflictSeverity,
  CosmicPlayer,
  DraftLeagueStatus,
  DraftPickState,
  DraftState,
  ElementalDistribution,
  ElementType,
  MatchupWeekData,
  NFLPosition,
  OneiromancySettings,
  PlayerMatchupFavorability,
  ResolvedLeagueSetup,
  RosterSlot,
  SleeperDraftMetadata,
  SleeperLeague,
  SleeperLeagueDraft,
  SleeperMatchup,
  SleeperNFLState,
  SleeperPick,
  SleeperPlayerRecord,
  SleeperRoster,
  SleeperUser,
  TeamCelestialComparison,
  TradeProposal,
  WaiverUpgrade,
  WeeklyMatchup,
  WeeklyPositionSlot,
} from '../types/oneiromancy';
import {dominantElements, getNextPlayWeek, INJURED_STATUSES, teamStacks} from './oracle';
import {
  mock_oneiromancy_draft_2025,
  mockCompetitorTeams,
  mockCosmicBoard,
  mockDraftMetadata,
  mockIdealDraftPath,
  mockMatchupWeeks,
  mockPastMatchups,
  mockPicks,
  mockPlayerFavorabilities,
  mockSettings,
  mockTeamComparison,
  mockTradeProposals,
  mockWaiverUpgrades,
  mockWeeklyCoverage,
  mockWeeklyMatchup,
} from './mockData';
import {
  BASELINES,
  calculateHarmony,
  calculateNumericTier,
  calculateSnakePick,
  calculateTeamCelestialMetrics,
  calculateWinProbability,
  computeDraftScore,
  computeRosterHarmonyBreakdown,
  computeSpiritScore,
  computeTeamMatchupFavorability,
  computeWeeklyPlayerFavorability,
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  deriveDraftStatus,
  generateAscensionPath,
  isNFLByeWeek,
  isPlayerOnByeWeek,
  isPlayerSigned,
  NFL_BYE_WEEK_MAX,
  NFL_BYE_WEEK_MIN,
  recomputeDraftScores,
} from './scoring';
import {
  type SeasonContext,
  getSeasonContext,
  setSeasonContextState,
} from './seasonContext';

export type { SeasonContext };
export {
  getNextPlayWeek,
  getSeasonContext,
  isNFLByeWeek,
  isPlayerOnByeWeek,
  NFL_BYE_WEEK_MAX,
  NFL_BYE_WEEK_MIN,
};

// ============================================================================
// Constants & Rate Limiter Configuration
// ============================================================================

export const DEFAULT_LIVE_SETTINGS: OneiromancySettings = {
  draft_id: '',
  league_id: '',
  sleeper_username: '',
  user_id: '',
  user_slot: 1,
  auto_update: true,
  poll_interval_ms: 5000,
  chaos_lambda: DEFAULT_CHAOS_LAMBDA,
  oracle_weights: { ...DEFAULT_ORACLE_WEIGHTS },
  theme: 'deep_obsidian',
  offline_mode_active: false,
};

export const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
export const MAX_REQ_PER_MIN = 300; // High headroom budget to eliminate artificial client-side blocks
export const RATE_LIMIT_COOLDOWN_MS = 60000; // 60s cooldown on 429
export const REQUEST_TIMEOUT_MS = 10000; // 10s timeout
export const RATE_LIMIT_WINDOW_MS = 60000; // 60s sliding window
export const RATE_LIMIT_JITTER_MARGIN_MS = 2000; // 2s jitter margin (effective 58s window)

export const POLLING_CONFIG = {
  ACTIVE_INTERVAL_MS: 5000,
  IDLE_INTERVAL_MS: 10000,
  BACKGROUND_INTERVAL_MS: 30000,
  RATE_LIMIT_COOLDOWN_MS: 60000,
  MAX_REQ_PER_MIN: 300,
  SLEEPER_RATE_LIMIT_CEILING: 90,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_JITTER_MARGIN_MS: 2000,
} as const;

const requestTimestamps: number[] = [];
let cooldownExpiresAt = 0;

// In-memory player dictionary cache (24-hour TTL)
let playerDictionaryCache: Record<string, SleeperPlayerRecord> | null = null;
let playerDictionaryPromise: Promise<
  Record<string, SleeperPlayerRecord>
> | null = null;
let playerCacheTimestamp = 0;
const PLAYER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let playerNegativeCacheTimestamp = 0;
const PLAYER_NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// Rate Limiter Helpers & Graceful Logging
// ============================================================================

let debugLoggingEnabled = false;

export function isDebugLoggingEnabled(): boolean {
  return debugLoggingEnabled;
}

export function setDebugLogging(enabled: boolean): void {
  debugLoggingEnabled = enabled;
}

export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('too_many_requests') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit')
  );
}

export function logSleeperWarning(message: string, err?: unknown): void {
  if (isRateLimitError(err)) {
    return;
  }
  if (debugLoggingEnabled) {
    console.warn(message, err);
  }
}

export function checkRateLimit(
  options?: boolean | {isManual?: boolean; bypassRateLimit?: boolean},
): {allowed: boolean; waitTimeMs: number} {
  const now = Date.now();
  const isManual =
    typeof options === 'boolean'
      ? options
      : Boolean(options?.isManual || options?.bypassRateLimit);

  // Only block if an authentic HTTP 429 cooldown is active and not a manual override
  if (now < cooldownExpiresAt) {
    if (isManual) {
      cooldownExpiresAt = 0;
    } else {
      return {allowed: false, waitTimeMs: cooldownExpiresAt - now};
    }
  }

  // Prune timestamps older than sliding window minus jitter safety margin (58,000ms)
  const windowThreshold =
    now - (RATE_LIMIT_WINDOW_MS - RATE_LIMIT_JITTER_MARGIN_MS);
  while (
    requestTimestamps.length > 0 &&
    requestTimestamps[0] < windowThreshold
  ) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= MAX_REQ_PER_MIN) {
    if (debugLoggingEnabled) {
      console.warn(
        `[Sleeper] Debug Warning: Request count (${requestTimestamps.length}) reached MAX_REQ_PER_MIN (${MAX_REQ_PER_MIN})`,
      );
    }
  }

  requestTimestamps.push(now);
  return {allowed: true, waitTimeMs: 0};
}

export function triggerRateLimitCooldown(): void {
  cooldownExpiresAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

export function isRateLimited(): boolean {
  return Date.now() < cooldownExpiresAt;
}

export function resetRateLimit(): void {
  requestTimestamps.length = 0;
  cooldownExpiresAt = 0;
  playerNegativeCacheTimestamp = 0;
}

export function resetPlayerNegativeCache(): void {
  playerNegativeCacheTimestamp = 0;
}

/**
 * Resolves polling interval based on draft state, page visibility, and user config.
 */
export function resolvePollInterval(
  status: string,
  visibilityState: string = 'visible',
  userInterval?: number,
): number {
  if (visibilityState === 'hidden') {
    return POLLING_CONFIG.BACKGROUND_INTERVAL_MS; // 30,000ms
  }
  if (userInterval && userInterval > 0) {
    return userInterval;
  }
  return status === 'drafting'
    ? POLLING_CONFIG.ACTIVE_INTERVAL_MS // 5,000ms
    : POLLING_CONFIG.IDLE_INTERVAL_MS; // 10,000ms
}

// ============================================================================
// HTTP Fetch Utility with Timeout
// ============================================================================

async function fetchWithTimeout(
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new Error('Sync aborted');
  }
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    return res;
  } catch (err) {
    if (timedOut) {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

class SleeperUserNotFoundError extends Error {
  constructor(username: string) {
    super(
      `User '${username}' not found on Sleeper (try checking spelling, e.g. OneiroVangard or OneiroVanguard)`,
    );
    this.name = 'SleeperUserNotFoundError';
  }
}

function toAbortError(err: unknown): Error {
  if (
    err instanceof Error &&
    (err.name === 'AbortError' || err.message === 'Sync aborted')
  ) {
    return err;
  }
  return new Error('Sync aborted');
}

// ============================================================================
// Sleeper API Client Functions
// ============================================================================

/**
 * Fetch draft metadata from Sleeper: GET /v1/draft/<draft_id>
 * Reference: https://docs.sleeper.com/#drafts
 */
export async function fetchDraftMetadata(
  draftId: string,
  signal?: AbortSignal,
): Promise<SleeperDraftMetadata> {
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }

  if (
    !draftId ||
    draftId === 'mock' ||
    draftId === 'mock_oneiromancy_draft_2025'
  ) {
    return mockDraftMetadata;
  }

  if (isRateLimited()) {
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }

  checkRateLimit();

  const res = await fetchWithTimeout(
    `${SLEEPER_BASE_URL}/draft/${draftId}`,
    REQUEST_TIMEOUT_MS,
    signal,
  );
  if (res.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}_ERROR`);
  }

  const metadata = (await res.json()) as SleeperDraftMetadata;
  if ((metadata as any)?.status === 'complete') completedDraftIds.add(draftId);
  return metadata;
}

// A completed draft's picks never change, so they are fetched once.
const completedDraftIds = new Set<string>();
const completedDraftPicksCache = new Map<string, SleeperPick[]>();

/**
 * Fetch draft picks from Sleeper: GET /v1/draft/<draft_id>/picks
 * Reference: https://docs.sleeper.com/#drafts
 */
export async function fetchDraftPicks(
  draftId: string,
  signal?: AbortSignal,
): Promise<SleeperPick[]> {
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }

  if (
    !draftId ||
    draftId === 'mock' ||
    draftId === 'mock_oneiromancy_draft_2025'
  ) {
    return mockPicks;
  }

  const cachedPicks = completedDraftIds.has(draftId)
    ? completedDraftPicksCache.get(draftId)
    : undefined;
  if (cachedPicks) return cachedPicks;

  if (isRateLimited()) {
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }

  checkRateLimit();

  const res = await fetchWithTimeout(
    `${SLEEPER_BASE_URL}/draft/${draftId}/picks`,
    REQUEST_TIMEOUT_MS,
    signal,
  );
  if (res.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}_ERROR`);
  }

  const picks = (await res.json()) as SleeperPick[];
  if (Array.isArray(picks)) completedDraftPicksCache.set(draftId, picks);
  return picks;
}

/**
 * Fetch league users from Sleeper: GET /v1/league/<league_id>/users
 * Reference: https://docs.sleeper.com/#users-in-a-league
 */
export async function fetchLeagueUsers(
  leagueId: string,
  signal?: AbortSignal,
): Promise<SleeperUser[]> {
  if (signal?.aborted) return [];
  if (
    !leagueId ||
    leagueId === 'mock' ||
    leagueId === 'mock_oneiromancy_draft_2025'
  )
    return [];
  if (isRateLimited()) return [];
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/league/${leagueId}/users`,
      REQUEST_TIMEOUT_MS,
      signal,
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return [];
    }
    if (res.ok) {
      return (await res.json()) as SleeperUser[];
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      logSleeperWarning('[Sleeper] fetchLeagueUsers warning:', err);
    }
  }
  return [];
}

/**
 * Fetch league rosters from Sleeper: GET /v1/league/<league_id>/rosters
 * Reference: https://docs.sleeper.com/#rosters
 */
export async function fetchLeagueRosters(
  leagueId: string,
  signal?: AbortSignal,
): Promise<SleeperRoster[]> {
  if (signal?.aborted) return [];
  if (
    !leagueId ||
    leagueId === 'mock' ||
    leagueId === 'mock_oneiromancy_draft_2025'
  )
    return [];
  if (isRateLimited()) return [];
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/league/${leagueId}/rosters`,
      REQUEST_TIMEOUT_MS,
      signal,
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return [];
    }
    if (res.ok) {
      return (await res.json()) as SleeperRoster[];
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      logSleeperWarning('[Sleeper] fetchLeagueRosters warning:', err);
    }
  }
  return [];
}

/**
 * Fetch league matchups for a specific week: GET /v1/league/<league_id>/matchups/<week>
 * Reference: https://docs.sleeper.com/#matchups
 */
export async function fetchLeagueMatchups(
  leagueId: string,
  week = 1,
  signal?: AbortSignal,
): Promise<SleeperMatchup[]> {
  if (signal?.aborted) return [];
  if (
    !leagueId ||
    leagueId === 'mock' ||
    leagueId === 'mock_oneiromancy_draft_2025'
  )
    return [];
  if (isRateLimited()) return [];
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`,
      REQUEST_TIMEOUT_MS,
      signal,
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return [];
    }
    if (res.ok) {
      return (await res.json()) as SleeperMatchup[];
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      logSleeperWarning('[Sleeper] fetchLeagueMatchups warning:', err);
    }
  }
  return [];
}

/**
 * Fetch league metadata and configuration: GET /v1/league/<league_id>
 * Reference: https://docs.sleeper.com/#leagues
 */
export async function fetchLeague(
  leagueId: string,
  signal?: AbortSignal,
): Promise<SleeperLeague | null> {
  if (signal?.aborted) return null;
  if (
    !leagueId ||
    leagueId === 'mock' ||
    leagueId === 'mock_oneiromancy_draft_2025'
  )
    return null;
  if (isRateLimited()) return null;
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/league/${leagueId}`,
      REQUEST_TIMEOUT_MS,
      signal,
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return null;
    }
    if (res.ok) {
      return (await res.json()) as SleeperLeague;
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      logSleeperWarning('[Sleeper] fetchLeague warning:', err);
    }
  }
  return null;
}

/**
 * Fetch current NFL state: GET /v1/state/nfl
 * Reference: https://docs.sleeper.com/#state
 */
export async function fetchNFLState(
  signal?: AbortSignal,
): Promise<SleeperNFLState | null> {
  if (signal?.aborted) return null;
  if (isRateLimited()) return null;
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/state/nfl`,
      REQUEST_TIMEOUT_MS,
      signal,
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return null;
    }
    if (res.ok) {
      return (await res.json()) as SleeperNFLState;
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      logSleeperWarning('[Sleeper] fetchNFLState warning:', err);
    }
  }
  return null;
}

/**
 * Fetch weekly player projections from Sleeper: GET /v1/projections/nfl/regular/<season>/<week>
 */
const PROJECTIONS_TTL_MS = 10 * 60 * 1000;
const projectionsCache = new Map<string, {at: number; data: Record<string, any> | null}>();
const inFlightProjectionsCache = new Map<string, Promise<Record<string, any> | null>>();

export function clearProjectionsCache(): void {
  projectionsCache.clear();
  inFlightProjectionsCache.clear();
  scheduleCache.clear();
  scheduleFetchedAt.clear();
  matchupWeekCache.clear();
  completedDraftIds.clear();
  completedDraftPicksCache.clear();
  playerDictionaryCache = null;
}

export async function fetchWeeklyProjections(
  season: string = '2026',
  week: number = 2,
  signal?: AbortSignal,
): Promise<Record<string, any> | null> {
  if (signal?.aborted) return null;
  // Weekly projections are large (~0.5 MB) and change slowly; reuse them for
  // ten minutes instead of downloading them on every poll.
  const cacheKey = `${season}:${week}`;
  const cached = projectionsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PROJECTIONS_TTL_MS) {
    return cached.data;
  }
  const inFlight = inFlightProjectionsCache.get(cacheKey);
  if (inFlight) return raceWithAbort(inFlight, signal, null);
  if (isRateLimited()) return null;
  checkRateLimit();
  const req = (async (): Promise<Record<string, any> | null> => {
    try {
      const res = await fetchWithTimeout(
        `${SLEEPER_BASE_URL}/projections/nfl/regular/${season}/${week}`,
        REQUEST_TIMEOUT_MS,
      );
      if (res.status === 429) {
        triggerRateLimitCooldown();
        return null;
      }
      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        if (data && typeof data === 'object') {
          projectionsCache.set(cacheKey, {at: Date.now(), data});
        }
        return data;
      }
      const negativeCacheAt = Date.now() - (PROJECTIONS_TTL_MS - 60 * 1000);
      projectionsCache.set(cacheKey, {at: negativeCacheAt, data: null});
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
        return null;
      }
      logSleeperWarning('[Sleeper] fetchWeeklyProjections warning:', err);
      const negativeCacheAt = Date.now() - (PROJECTIONS_TTL_MS - 60 * 1000);
      projectionsCache.set(cacheKey, {at: negativeCacheAt, data: null});
    }
    return null;
  })();
  inFlightProjectionsCache.set(cacheKey, req);
  void req.finally(() => {
    if (inFlightProjectionsCache.get(cacheKey) === req) {
      inFlightProjectionsCache.delete(cacheKey);
    }
  });
  return raceWithAbort(req, signal, null);
}

async function fetchNextWeekProjectionsMap(params: {
  season: string;
  activeWeek: number;
  picks?: SleeperPick[];
  leagueRosters?: any[];
  leagueMatchups?: any[];
  weeklyProjections?: Record<string, any> | null;
  playerDict?: Record<string, SleeperPlayerRecord>;
  signal?: AbortSignal;
}): Promise<Record<number, Record<string, any> | null>> {
  const {
    season,
    activeWeek,
    picks,
    leagueRosters,
    leagueMatchups,
    weeklyProjections,
    playerDict,
    signal,
  } = params;
  if (signal?.aborted) throw new Error('Sync aborted');
  const seasonCtx = getSeasonContext();
  const seasonByeWeeks = seasonCtx?.byeWeeks;
  if (!activeWeek || activeWeek >= 18) return {};

  const nextWeeks = new Set<number>();
  const checkedPlayerIds = new Set<string>();
  const checkPlayer = (team?: string | null, byeWeek?: number | null) => {
    const nextWk = getNextPlayWeek(team, activeWeek, seasonByeWeeks, byeWeek);
    if (nextWk !== null) nextWeeks.add(nextWk);
  };

  if (Array.isArray(picks)) {
    for (const pick of picks) {
      if (!pick?.player_id) continue;
      const pid = String(pick.player_id);
      checkedPlayerIds.add(pid);
      const rec = playerDict?.[pid];
      const isReleasedOrUnsignedFA =
        rec !== undefined &&
        (!rec.team || !isPlayerSigned(rec.team) || rec.team === 'FA' || rec.team === 'NFL');
      const liveTeam = isReleasedOrUnsignedFA
        ? 'FA'
        : rec?.team || pick.metadata?.team;
      checkPlayer(liveTeam, isReleasedOrUnsignedFA ? null : rec?.bye_week);
    }
  }
  if (Array.isArray(leagueRosters)) {
    for (const r of leagueRosters) {
      const ids = [
        ...(Array.isArray(r?.players) ? r.players : []),
        ...(Array.isArray(r?.reserve) ? r.reserve : []),
      ];
      for (const rawId of ids) {
        if (!rawId) continue;
        const pid = String(rawId);
        if (checkedPlayerIds.has(pid)) continue;
        checkedPlayerIds.add(pid);
        const rec = playerDict?.[pid];
        const isReleasedOrUnsignedFA =
          rec !== undefined &&
          (!rec.team || !isPlayerSigned(rec.team) || rec.team === 'FA' || rec.team === 'NFL');
        const team = isReleasedOrUnsignedFA ? 'FA' : rec?.team;
        checkPlayer(team, isReleasedOrUnsignedFA ? null : rec?.bye_week);
      }
    }
  }
  if (Array.isArray(leagueMatchups)) {
    for (const m of leagueMatchups) {
      const ids = Array.isArray(m?.players) ? m.players : [];
      for (const rawId of ids) {
        if (!rawId) continue;
        const pid = String(rawId);
        if (checkedPlayerIds.has(pid)) continue;
        checkedPlayerIds.add(pid);
        const rec = playerDict?.[pid];
        const isReleasedOrUnsignedFA =
          rec !== undefined &&
          (!rec.team || !isPlayerSigned(rec.team) || rec.team === 'FA' || rec.team === 'NFL');
        const team = isReleasedOrUnsignedFA ? 'FA' : rec?.team;
        checkPlayer(team, isReleasedOrUnsignedFA ? null : rec?.bye_week);
      }
    }
  }
  if (weeklyProjections && playerDict) {
    for (const pid of Object.keys(weeklyProjections)) {
      if (checkedPlayerIds.has(pid)) continue;
      checkedPlayerIds.add(pid);
      const rec = playerDict[pid];
      if (rec) {
        const isReleasedOrUnsignedFA =
          !rec.team || !isPlayerSigned(rec.team) || rec.team === 'FA' || rec.team === 'NFL';
        const team = isReleasedOrUnsignedFA ? 'FA' : rec.team;
        checkPlayer(team, isReleasedOrUnsignedFA ? null : rec.bye_week);
      }
    }
  }
  if (playerDict) {
    for (const [pid, rec] of Object.entries(playerDict)) {
      if (checkedPlayerIds.has(pid)) continue;
      if (!rec || !isValidNFLPlayerRecord(pid, rec)) continue;
      if (isSignedActiveNFLPlayer(pid, rec)) {
        checkPlayer(rec.team, rec.bye_week);
      }
    }
  }

  if (nextWeeks.size === 0) return {};

  const result: Record<number, Record<string, any> | null> = {};
  await Promise.all(
    Array.from(nextWeeks).map(async (wk) => {
      if (signal?.aborted) return;
      result[wk] = await fetchWeeklyProjections(season, wk, signal).catch(() => null);
    }),
  );
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }
  return result;
}

// ============================================================================
// Season Context: NFL schedule (bye weeks, week dates) and league matchups
// for every regular-season week. Registered once per sync so that everything
// deriving byes, opponents, results and dates reads real Sleeper data.
// ============================================================================

export interface SleeperScheduleGame {
  week: number;
  date: string;
  home: string;
  away: string;
  status?: string;
  game_id?: string;
}

// Promise caches, so concurrent syncs share one request. Empty results are
// evicted so they are retried on the next sync.
const scheduleCache = new Map<string, Promise<SleeperScheduleGame[]>>();
// Game statuses change on game days, so the schedule is refetched after this.
const SCHEDULE_TTL_MS = 5 * 60 * 1000;
const scheduleFetchedAt = new Map<string, number>();
const matchupWeekCache = new Map<string, Promise<SleeperMatchup[]>>();

export function setSeasonContext(ctx: SeasonContext | null): void {
  setSeasonContextState(ctx);
  if (!ctx) {
    clearGameStatus();
    clearNflGames();
  }
}

/**
 * Real bye week for an NFL team from the registered schedule. Returns 0 for
 * a team with no bye in the schedule (e.g. free agents), and undefined when no
 * schedule is registered (mock mode).
 */
export function getTeamByeWeek(team?: string | null): number | undefined {
  const ctx = getSeasonContext();
  if (!ctx || Object.keys(ctx.byeWeeks).length === 0) {
    return undefined;
  }
  const normalized = (team || '').toUpperCase();
  return (normalized && ctx.byeWeeks[normalized]) || 0;
}

/**
 * Fetch the NFL regular-season schedule: GET /schedule/nfl/regular/<season>
 * (Sleeper's public schedule route; not under /v1).
 */
export function fetchNFLSchedule(
  season: string,
  signal?: AbortSignal,
): Promise<SleeperScheduleGame[]> {
  if (signal?.aborted) return Promise.resolve([]);
  const cached = scheduleCache.get(season);
  if (cached && Date.now() - (scheduleFetchedAt.get(season) ?? 0) < SCHEDULE_TTL_MS) {
    return raceWithAbort(cached, signal, []);
  }
  const request = (async (): Promise<SleeperScheduleGame[]> => {
    if (isRateLimited()) return [];
    checkRateLimit();
    try {
      const res = await fetchWithTimeout(
        `https://api.sleeper.app/schedule/nfl/regular/${season}`,
        REQUEST_TIMEOUT_MS,
      );
      if (res.status === 429) {
        triggerRateLimitCooldown();
        return [];
      }
      if (res.ok) {
        const games = (await res.json()) as SleeperScheduleGame[];
        if (
          Array.isArray(games) &&
          games.length > 0 &&
          games.every((g) => g && typeof g.week === 'number')
        ) {
          return games;
        }
      }
    } catch (err: unknown) {
      if (
        !(err instanceof Error && err.name === 'AbortError' && signal?.aborted)
      ) {
        logSleeperWarning('[Sleeper] fetchNFLSchedule warning:', err);
      }
    }
    return [];
  })();
  scheduleCache.set(season, request);
  scheduleFetchedAt.set(season, Date.now());
  void request.then((games) => {
    if (games.length === 0) scheduleCache.delete(season);
  });
  return raceWithAbort(request, signal, []);
}

/** Each team's bye: the regular-season week in which it plays no game. */
export function deriveByeWeeks(
  games: SleeperScheduleGame[],
): Record<string, number> {
  const weeks = new Set<number>();
  const played = new Map<string, Set<number>>();
  for (const g of games) {
    weeks.add(g.week);
    for (const team of [g.home, g.away]) {
      if (!played.has(team)) played.set(team, new Set());
      played.get(team)!.add(g.week);
    }
  }
  const byes: Record<string, number> = {};
  played.forEach((teamWeeks, team) => {
    const bye = Array.from(weeks)
      .sort((a, b) => a - b)
      .find((w) => isNFLByeWeek(w) && !teamWeeks.has(w));
    if (bye) byes[team] = bye;
  });
  return byes;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Week date ranges ("Oct 8 - Oct 12, 2026") from first and last game dates. */
export function deriveWeekDates(
  games: SleeperScheduleGame[],
): Record<number, string> {
  const byWeek = new Map<number, string[]>();
  for (const g of games) {
    if (!g.date) continue;
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week)!.push(g.date);
  }
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
  };
  const dates: Record<number, string> = {};
  byWeek.forEach((ds, week) => {
    ds.sort();
    const first = ds[0];
    const last = ds[ds.length - 1];
    dates[week] = `${fmt(first)} - ${fmt(last)}, ${last.slice(0, 4)}`;
  });
  return dates;
}

/**
 * Loads the schedule and every regular-season week's league matchups, then
 * registers them as the season context. Weeks other than the current one are
 * cached per league, since finished results and future pairings don't change;
 * the current week is always taken from `currentWeekMatchups`.
 */
export async function loadSeasonContext(
  leagueId: string,
  season: string,
  currentWeek: number,
  currentWeekMatchups: SleeperMatchup[],
  leagueDetails?: SleeperLeague | null,
  signal?: AbortSignal,
): Promise<SeasonContext | null> {
  if (signal?.aborted) return null;
  const playoffStart = Number(
    (leagueDetails?.settings as any)?.playoff_week_start || 15,
  );
  const lastRegularWeek = Math.max(1, Math.min(18, playoffStart - 1));
  const games = await fetchNFLSchedule(season, signal);
  if (signal?.aborted) return null;

  const matchupsByWeek: Record<number, SleeperMatchup[]> = {};
  const weekRequests: Promise<void>[] = [];
  for (let w = 1; w <= lastRegularWeek; w++) {
    if (w === currentWeek) {
      matchupsByWeek[w] = Array.isArray(currentWeekMatchups) ? currentWeekMatchups : [];
      continue;
    }
    // Finished weeks never change; future pairings are refreshed when the
    // current NFL week advances.
    const key = `${leagueId}:${w}:${w < currentWeek ? 'final' : currentWeek}`;
    let request = matchupWeekCache.get(key);
    if (!request) {
      request = fetchLeagueMatchups(leagueId, w).then((m) =>
        Array.isArray(m) ? m : [],
      );
      matchupWeekCache.set(key, request);
      void request.then((m) => {
        if (m.length === 0) matchupWeekCache.delete(key);
      });
    }
    const week = w;
    weekRequests.push(
      raceWithAbort(request, signal, []).then((m) => {
        matchupsByWeek[week] = m;
      }),
    );
  }
  // Real games for the matchup cards: Sleeper's dates and home/away teams,
  // overlaid with ESPN's kickoffs and venues where available.
  const sleeperWeekGamesByWeek = new Map<number, NflGame[]>();
  const pendingWeekGames = new Map<number, NflGame[]>();
  for (let w = 1; w <= lastRegularWeek; w++) {
    const wkGames = games
      .filter((g) => g.week === w)
      .map((g): NflGame => ({
        week: w,
        home: g.home,
        away: g.away,
        kickoff: null,
        date: g.date || null,
        venue: null,
        neutral: false,
      }));
    sleeperWeekGamesByWeek.set(w, wkGames);
    pendingWeekGames.set(w, wkGames);
  }
  const espnRequests: Promise<void>[] = [];
  for (let w = 1; w <= lastRegularWeek; w++) {
    const week = w;
    espnRequests.push(
      fetchEspnWeek(season, week, week < currentWeek, signal).then((espn) => {
        if (signal?.aborted || !espn || espn.length === 0) return;
        const base = sleeperWeekGamesByWeek.get(week) || [];
        if (base.length === 0) {
          pendingWeekGames.set(week, espn);
          return;
        }
        const pairKey = (a: string, b: string) => [a, b].sort().join(':');
        const espnByPair = new Map<string, NflGame>();
        for (const eg of espn) {
          espnByPair.set(pairKey(eg.home, eg.away), eg);
        }
        const seenPairs = new Set<string>();
        const merged: NflGame[] = base.map((sg) => {
          const key = pairKey(sg.home, sg.away);
          seenPairs.add(key);
          const match = espnByPair.get(key);
          if (!match) return sg;
          return {
            ...sg,
            kickoff: match.kickoff ?? sg.kickoff,
            date: match.date ?? sg.date,
            venue: match.venue ?? sg.venue,
            neutral: match.neutral ?? sg.neutral,
          };
        });
        for (const eg of espn) {
          if (!seenPairs.has(pairKey(eg.home, eg.away))) {
            merged.push(eg);
          }
        }
        if (!signal?.aborted) {
          pendingWeekGames.set(week, merged);
        }
      }),
    );
  }
  await Promise.all([...weekRequests, ...espnRequests]);
  if (signal?.aborted) return null;
  for (const [week, wkGames] of pendingWeekGames) {
    setWeekGames(week, wkGames);
  }

  const byeWeeks = deriveByeWeeks(games);
  const statusByTeam: Record<string, GameStatus> = {};
  for (const g of games) {
    if (g.week !== currentWeek) continue;
    const st = g.status === 'complete' || g.status === 'in_game' ? g.status : 'pre_game';
    statusByTeam[g.home] = st;
    statusByTeam[g.away] = st;
  }
  setGameStatus(currentWeek, statusByTeam);
  const hasMatchups = Object.values(matchupsByWeek).some((m) => m.length > 0);
  if (!hasMatchups && Object.keys(byeWeeks).length === 0) {
    setSeasonContext(null);
    return null;
  }

  const ctx: SeasonContext = {
    season,
    leagueId,
    currentWeek,
    lastRegularWeek,
    byeWeeks,
    weekDates: deriveWeekDates(games),
    matchupsByWeek,
  };
  setSeasonContext(ctx);
  return ctx;
}

/**
 * Canonical avatar URL resolver for Sleeper:
 * Precedence rules:
 * 1. If custom metadata avatar (user.metadata?.avatar or roster.metadata?.avatar) is present, use it.
 *    If it begins with http:// or https://, preserve as-is. Otherwise prefix CDN.
 * 2. Otherwise use avatarId (user.avatar hash):
 *    - Thumbnail: https://sleepercdn.com/avatars/thumbs/<avatar_id>
 *    - Full: https://sleepercdn.com/avatars/<avatar_id>
 */
export function resolveSleeperAvatarUrl(
  avatarId?: string | null,
  options?: {full?: boolean; metadataAvatar?: string | null},
): string | null {
  const target =
    options?.metadataAvatar &&
    typeof options.metadataAvatar === 'string' &&
    options.metadataAvatar.trim()
      ? options.metadataAvatar.trim()
      : avatarId && typeof avatarId === 'string' && avatarId.trim()
        ? avatarId.trim()
        : null;

  if (!target) return null;

  const isFull = Boolean(options?.full);
  const isDirectUrl =
    target.startsWith('http://') || target.startsWith('https://');
  const cacheKey = isDirectUrl
    ? target
    : `${target}:${isFull ? 'full' : 'thumb'}`;

  // Check intermediate cache first
  const cached =
    getAvatarFromCache(cacheKey) ||
    (isDirectUrl ? getAvatarFromCache(target) : null);
  if (cached) return cached;

  let resolved: string;
  if (isDirectUrl) {
    resolved = target;
  } else {
    const base = isFull
      ? 'https://sleepercdn.com/avatars'
      : 'https://sleepercdn.com/avatars/thumbs';
    resolved = `${base}/${target}`;
  }

  // Populate cache for all aliases
  const keysToCache: (string | number | null | undefined)[] = [cacheKey];
  if (isDirectUrl) {
    keysToCache.push(target, avatarId, options?.metadataAvatar);
  } else {
    if (!isFull) {
      keysToCache.push(target, avatarId, options?.metadataAvatar);
    }
  }
  setAvatarInCache(keysToCache, resolved);
  return resolved;
}

export function getSleeperAvatarUrl(
  avatarId?: string | null,
  options?: {full?: boolean; metadataAvatar?: string | null},
): string | null {
  return resolveSleeperAvatarUrl(avatarId, options);
}

// ============================================================================
// Intermediate Avatar Cache
// ============================================================================

export const AVATAR_CACHE_STORAGE_KEY = 'oneiromancy_avatar_cache_v1';
export const avatarCacheMap = new Map<string, string>();

/**
 * Initializes and hydrates in-memory avatar cache from localStorage.
 */
export function initAvatarCache(): Map<string, string> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(AVATAR_CACHE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries(parsed)) {
            if (typeof val === 'string' && val.trim()) {
              avatarCacheMap.set(key, val.trim());
            }
          }
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }
  return avatarCacheMap;
}

// Automatically initialize in browser environment
if (typeof window !== 'undefined') {
  initAvatarCache();
}

/**
 * Retrieves a cached avatar URL by any identifier key (userId, rosterId, avatarHash, teamName, or URL).
 */
export function getAvatarFromCache(
  key?: string | number | null,
): string | null {
  if (key === null || key === undefined) return null;
  const strKey = String(key).trim();
  if (!strKey) return null;

  if (avatarCacheMap.has(strKey)) {
    return avatarCacheMap.get(strKey)!;
  }
  const thumbKey = `${strKey}:thumb`;
  if (avatarCacheMap.has(thumbKey)) {
    return avatarCacheMap.get(thumbKey)!;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(AVATAR_CACHE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          if (parsed[strKey]) {
            const val = String(parsed[strKey]).trim();
            avatarCacheMap.set(strKey, val);
            return val;
          }
          if (parsed[thumbKey]) {
            const val = String(parsed[thumbKey]).trim();
            avatarCacheMap.set(thumbKey, val);
            return val;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Stores an avatar URL under multiple lookup keys in both memory Map and localStorage.
 */
export function setAvatarInCache(
  keys: (string | number | null | undefined)[],
  url: string,
): void {
  if (!url || typeof url !== 'string' || !url.trim()) return;
  const trimmedUrl = url.trim();

  let hasUpdate = false;
  for (const k of keys) {
    if (k !== null && k !== undefined) {
      const strKey = String(k).trim();
      if (strKey) {
        avatarCacheMap.set(strKey, trimmedUrl);
        hasUpdate = true;
      }
    }
  }

  if (hasUpdate && typeof window !== 'undefined' && window.localStorage) {
    try {
      const obj: Record<string, string> = {};
      avatarCacheMap.forEach((v, k) => {
        obj[k] = v;
      });
      window.localStorage.setItem(
        AVATAR_CACHE_STORAGE_KEY,
        JSON.stringify(obj),
      );
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Clears both in-memory and persisted avatar cache.
 */
export function clearAvatarCache(): void {
  avatarCacheMap.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(AVATAR_CACHE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * Resolves a Sleeper user by username or user_id:
 * GET /v1/user/<username> or GET /v1/user/<user_id>
 * Reference: https://docs.sleeper.com/#user
 */
export async function getUser(usernameOrId: string): Promise<SleeperUser> {
  const clean = usernameOrId.replace(/^@/, '').trim();
  if (!clean || clean === 'mock') {
    return {
      user_id: 'user_oneiromancy_me',
      username: 'OneiroVanguard',
      display_name: 'OneiroVanguard',
    };
  }
  if (isRateLimited()) {
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  checkRateLimit();
  const res = await fetchWithTimeout(`${SLEEPER_BASE_URL}/user/${clean}`);
  if (res.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }

  let data: SleeperUser | null = res.ok ? await res.json() : null;
  if (!data || !data.user_id) {
    // Intelligent fallback for spelling differences (OneiroVangard <-> OneiroVanguard)
    const lower = clean.toLowerCase();
    let alternate: string | null = null;
    if (lower === 'oneirovanguard') {
      alternate = 'OneiroVangard';
    } else if (lower === 'oneirovangard') {
      alternate = 'OneiroVanguard';
    }

    if (alternate) {
      try {
        const altRes = await fetchWithTimeout(
          `${SLEEPER_BASE_URL}/user/${alternate}`,
        );
        if (altRes.status === 429) {
          triggerRateLimitCooldown();
        } else if (altRes.ok) {
          const altData = await altRes.json();
          if (altData && altData.user_id) {
            data = altData as SleeperUser;
          }
        }
      } catch (altErr: unknown) {
        logSleeperWarning(
          `[Sleeper] Alternate user lookup for ${alternate} failed:`,
          altErr,
        );
      }
    }
  }

  if (!data || !data.user_id) {
    throw new Error(`Failed to resolve user '${usernameOrId}'`);
  }
  return data;
}

/**
 * Fetch all leagues for a Sleeper username:
 * 1. GET /v1/user/<username> -> resolves user_id and profile (Reference: https://docs.sleeper.com/#user)
 * 2. GET /v1/user/<user_id>/leagues/<sport>/<season> -> fetches user leagues for each season (Reference: https://docs.sleeper.com/#leagues)
 * Returns { user, leagues: SleeperLeague[] }
 */
export async function fetchUserLeagues(
  username: string,
  seasons: string[] = ['2026', '2025', '2024', '2023'],
  signal?: AbortSignal,
): Promise<{user: SleeperUser; leagues: SleeperLeague[]}> {
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }
  if (!username || username === 'mock') {
    return {
      user: {
        user_id: 'user_oneiromancy_me',
        username: 'OneiroVanguard',
        display_name: 'OneiroVanguard',
      },
      leagues: [
        {
          league_id: '9000000000000000001',
          name: 'Astral Sanctum League',
          season: '2025',
          status: 'drafting',
          sport: 'nfl',
          total_rosters: 12,
          roster_positions: [
            'QB',
            'RB',
            'RB',
            'WR',
            'WR',
            'TE',
            'FLEX',
            'SUPER_FLEX',
            'BN',
            'BN',
            'BN',
            'BN',
            'BN',
            'BN',
            'BN',
          ],
        },
      ],
    };
  }

  const cleanUsername = username.replace(/^@/, '').trim();
  if (isRateLimited()) {
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  checkRateLimit();

  let userRes = await fetchWithTimeout(
    `${SLEEPER_BASE_URL}/user/${cleanUsername}`,
    REQUEST_TIMEOUT_MS,
    signal,
  );
  if (userRes.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }

  let user: SleeperUser | null = null;
  let primaryUserErr: Error | null = null;
  if (userRes.ok) {
    try {
      user = await raceWithAbort(
        userRes.json() as Promise<SleeperUser | null>,
        signal,
        null,
      );
    } catch (jsonErr: unknown) {
      if (signal?.aborted) {
        throw toAbortError(jsonErr);
      }
      primaryUserErr =
        jsonErr instanceof Error ? jsonErr : new Error(String(jsonErr));
      user = null;
    }
  } else if (userRes.status !== 404) {
    primaryUserErr = new Error(`HTTP_${userRes.status}_USER_FETCH_FAILED`);
  }
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }

  // Intelligent fallback: if not found (404, non-ok, or null body from Sleeper API), attempt alternate
  if (!user || !user.user_id || !userRes.ok) {
    const lower = cleanUsername.toLowerCase();
    let alternate: string | null = null;
    if (lower === 'oneirovanguard') {
      alternate = 'OneiroVangard';
    } else if (lower === 'oneirovangard') {
      alternate = 'OneiroVanguard';
    }

    if (alternate) {
      try {
        const altRes = await fetchWithTimeout(
          `${SLEEPER_BASE_URL}/user/${alternate}`,
          REQUEST_TIMEOUT_MS,
          signal,
        );
        if (altRes.status === 429) {
          triggerRateLimitCooldown();
          throw new Error('HTTP_429_TOO_MANY_REQUESTS');
        } else if (altRes.ok) {
          const altData = await raceWithAbort(
            altRes.json() as Promise<SleeperUser | null>,
            signal,
            null,
          );
          if (signal?.aborted) {
            throw new Error('Sync aborted');
          }
          if (altData && altData.user_id) {
            user = altData as SleeperUser;
          }
        } else if (altRes.status !== 404) {
          throw new Error(`HTTP_${altRes.status}_USER_FETCH_FAILED`);
        }
      } catch (altErr: unknown) {
        if (signal?.aborted) {
          throw toAbortError(altErr);
        }
        logSleeperWarning(
          `[Sleeper] Alternate user lookup for ${alternate} failed:`,
          altErr,
        );
        throw altErr instanceof Error ? altErr : new Error(String(altErr));
      }
    } else if (primaryUserErr) {
      throw primaryUserErr;
    }
  }

  if (!user || !user.user_id) {
    if (primaryUserErr) {
      throw primaryUserErr;
    }
    throw new SleeperUserNotFoundError(cleanUsername);
  }

  const userId = String(user.user_id);
  const allLeagues: SleeperLeague[] = [];
  const seenLeagueIds = new Set<string>();
  let successfulSeasonCount = 0;
  let sawSeasonRateLimit = false;
  let lastSeasonErr: unknown = null;

  for (const season of seasons) {
    try {
      if (signal?.aborted) {
        throw new Error('Sync aborted');
      }
      if (isRateLimited()) {
        sawSeasonRateLimit = true;
        break;
      }
      checkRateLimit();

      const leaguesRes = await fetchWithTimeout(
        `${SLEEPER_BASE_URL}/user/${userId}/leagues/nfl/${season}`,
        REQUEST_TIMEOUT_MS,
        signal,
      );
      if (leaguesRes.status === 429) {
        triggerRateLimitCooldown();
        sawSeasonRateLimit = true;
        break;
      }
      if (leaguesRes.ok) {
        const leagues = await raceWithAbort(
          leaguesRes.json() as Promise<SleeperLeague[] | null>,
          signal,
          null,
        );
        if (signal?.aborted) {
          throw new Error('Sync aborted');
        }
        successfulSeasonCount += 1;
        if (Array.isArray(leagues)) {
          for (const l of leagues) {
            if (l && l.league_id && !seenLeagueIds.has(String(l.league_id))) {
              seenLeagueIds.add(String(l.league_id));
              allLeagues.push(l);
            }
          }
        }
      } else if (leaguesRes.status === 404) {
        successfulSeasonCount += 1;
      } else {
        lastSeasonErr = new Error(
          `HTTP_${leaguesRes.status}_LEAGUES_FETCH_FAILED`,
        );
      }
    } catch (seasonErr: unknown) {
      if (signal?.aborted) {
        throw toAbortError(seasonErr);
      }
      lastSeasonErr = seasonErr;
      logSleeperWarning(
        `[Sleeper] Could not fetch leagues for season ${season}:`,
        seasonErr,
      );
    }
  }
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }
  if (successfulSeasonCount === 0 && seasons.length > 0) {
    if (sawSeasonRateLimit) {
      throw new Error('HTTP_429_TOO_MANY_REQUESTS');
    }
    if (lastSeasonErr) {
      throw lastSeasonErr instanceof Error
        ? lastSeasonErr
        : new Error(String(lastSeasonErr));
    }
  }

  return {user, leagues: allLeagues};
}

/**
 * Fetch NFL master player dictionary: GET /v1/players/nfl (cached 24h)
 * Reference: https://docs.sleeper.com/#players
 */
const VALID_NFL_TEAMS = new Set<string>([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
]);

function isValidNFLPlayerRecord(
  _pid: string,
  record?: SleeperPlayerRecord | null,
): boolean {
  if (!record) return false;
  const fn = String(record.first_name || '').trim();
  const ln = String(record.last_name || '').trim();
  return Boolean(fn && ln);
}

function isSignedActiveNFLPlayer(
  pid: string,
  record?: SleeperPlayerRecord | null,
): boolean {
  if (!isValidNFLPlayerRecord(pid, record) || !record) return false;
  const team = String(record.team || '').toUpperCase();
  if (!VALID_NFL_TEAMS.has(team)) return false;
  const pos = String(record.position || '').toUpperCase();
  return (
    record.active === true ||
    record.status === 'Active' ||
    record.status === 'Injured Reserve' ||
    record.status === 'Physically Unable to Perform' ||
    (record.depth_chart_order !== null &&
      record.depth_chart_order !== undefined) ||
    Boolean(record.injury_status) ||
    pos === 'DEF'
  );
}

export async function fetchNFLPlayers(
  signal?: AbortSignal,
): Promise<Record<string, SleeperPlayerRecord>> {
  if (signal?.aborted) {
    return playerDictionaryCache ?? {};
  }
  const now = Date.now();
  if (
    playerDictionaryCache &&
    now - playerCacheTimestamp < PLAYER_CACHE_TTL_MS
  ) {
    return playerDictionaryCache;
  }
  if (now - playerNegativeCacheTimestamp < PLAYER_NEGATIVE_CACHE_TTL_MS) {
    return playerDictionaryCache ?? {};
  }

  if (playerDictionaryPromise) {
    return raceWithAbort(
      playerDictionaryPromise,
      signal,
      playerDictionaryCache ?? {},
    );
  }

  playerDictionaryPromise = (async () => {
    try {
      try {
        if (isRateLimited()) {
          return playerDictionaryCache ?? {};
        }
        checkRateLimit();

        const res = await fetchWithTimeout(
          `${SLEEPER_BASE_URL}/players/nfl`,
          15000,
        );
        if (res.status === 429) {
          triggerRateLimitCooldown();
          return playerDictionaryCache ?? {};
        }
        if (res.ok) {
          const data = (await res.json()) as Record<string, SleeperPlayerRecord>;
          playerDictionaryCache = data;
          playerCacheTimestamp = Date.now();
          playerNegativeCacheTimestamp = 0;
          return data;
        } else {
          playerNegativeCacheTimestamp = Date.now();
        }
      } catch (err) {
        // Unreachable or offline live Sleeper API
        playerNegativeCacheTimestamp = Date.now();
      }
      return playerDictionaryCache ?? {};
    } finally {
      playerDictionaryPromise = null;
    }
  })();

  return raceWithAbort(
    playerDictionaryPromise,
    signal,
    playerDictionaryCache ?? {},
  );
}

// ============================================================================
// Active Pick & State Calculation
// ============================================================================

export function calculateActivePick(
  pickCount: number,
  teams: number,
  rounds: number,
  draftOrder: Record<string, number> | null,
  reversalRound?: number,
): DraftPickState {
  const maxPicks = teams * rounds;
  if (pickCount >= maxPicks) {
    return {
      round: rounds,
      pick_no: maxPicks,
      on_the_clock_team_id: '',
      seconds_remaining: 0,
    };
  }

  const snakeInfo = calculateSnakePick(pickCount, teams, reversalRound);
  let onTheClockTeam = '';

  if (draftOrder) {
    for (const [userId, slot] of Object.entries(draftOrder)) {
      if (slot === snakeInfo.slot) {
        onTheClockTeam = userId;
        break;
      }
    }
  }

  return {
    round: snakeInfo.round,
    pick_no: snakeInfo.overallPick,
    on_the_clock_team_id: onTheClockTeam,
    seconds_remaining: 90,
  };
}

/**
 * Grounded replacement-level baseline per game based on position baselines.
 */
export function getGroundedPositionBaseline(
  pos?: string,
  options?: {
    isDeepReserve?: boolean;
    isMyTeam?: boolean;
    searchRank?: number | null;
    depthChartOrder?: number | null;
    status?: string | null;
  },
): number {
  const posKey = String(pos || '').toUpperCase();
  const standardBaseline =
    posKey in BASELINES
      ? Math.round((BASELINES[posKey as keyof typeof BASELINES] / 17) * 10) / 10
      : 8.0;

  const isDeepReserve =
    Boolean(options?.isDeepReserve) ||
    (!options?.isMyTeam &&
      typeof options?.searchRank === 'number' &&
      options.searchRank > 250) ||
    (typeof options?.depthChartOrder === 'number' &&
      options.depthChartOrder > (posKey === 'QB' ? 2 : 3)) ||
    options?.status === 'Practice Squad';

  if (isDeepReserve) {
    const reserveCap = posKey === 'QB' ? 5.0 : 4.0;
    return Math.min(standardBaseline, reserveCap);
  }

  return standardBaseline;
}

/**
 * Enriches cosmic board players with live Sleeper NFL master dictionary updates
 * (status, injury_status, depth_chart_order, team, number) and appends any
 * active signed NFL players missing from the baseline board.
 */
export function enrichCosmicBoardWithNFLPlayers(
  board: CosmicPlayer[],
  playerDict?: Record<string, SleeperPlayerRecord> | null,
): CosmicPlayer[] {
  if (!playerDict || Object.keys(playerDict).length === 0) {
    return board;
  }

  const allowedPositions = new Set<string>(['QB', 'RB', 'WR', 'TE']);
  for (const p of board) {
    if (p?.position) allowedPositions.add(String(p.position).toUpperCase());
  }

  const existingIds = new Set<string>();
  const enriched = board.map((player) => {
    const pid = String(player.id);
    existingIds.add(pid);
    const record = playerDict[pid];
    if (!record || !isValidNFLPlayerRecord(pid, record)) return player;

    const firstName =
      record.first_name && record.last_name
        ? record.first_name
        : player.first_name;
    const lastName =
      record.first_name && record.last_name
        ? record.last_name
        : player.last_name;
    const name =
      record.first_name && record.last_name
        ? `${record.first_name} ${record.last_name}`.trim()
        : player.name;
    const position = record.position
      ? (record.position.toUpperCase() as NFLPosition)
      : player.position;
    const recordBaseline = Number((record as any)?.baseline_projected_points ?? 0);
    const pos = String(position || '').toUpperCase();
    const searchRankRaw = (record as any)?.search_rank ?? (player as any)?.search_rank ?? null;
    const searchRank =
      searchRankRaw !== null &&
      searchRankRaw !== undefined &&
      Number.isFinite(Number(searchRankRaw))
        ? Number(searchRankRaw)
        : null;
    const depthChartOrder =
      'depth_chart_order' in record
        ? (record.depth_chart_order ?? null)
        : (player.depth_chart_order ?? null);
    const isMyTeam = player.draft_status === 'my_team' || (player as any)?.is_my_team === true;
    const groundedPosBaseline = getGroundedPositionBaseline(pos, {
      searchRank: typeof searchRank === 'number' && searchRank > 0 ? searchRank : null,
      depthChartOrder: typeof depthChartOrder === 'number' ? depthChartOrder : null,
      status: record.status ?? player.status,
      isMyTeam,
    });
    const isInjured = Boolean(
      (record.injury_status && (INJURED_STATUSES as readonly string[]).includes(record.injury_status)) ||
      (player.injury_status && (INJURED_STATUSES as readonly string[]).includes(player.injury_status)),
    );
    const baselineProjectedPoints =
      typeof player.baseline_projected_points === 'number' &&
      Number.isFinite(player.baseline_projected_points) &&
      player.baseline_projected_points > 0
        ? player.baseline_projected_points
        : Number.isFinite(recordBaseline) && recordBaseline > 0
          ? Math.round(recordBaseline * 100) / 100
          : isInjured && isPlayerSigned(record)
            ? groundedPosBaseline
            : player.baseline_projected_points;
    const recordAvg = Number((record as any)?.average_projected_points ?? 0);
    const recordSeason = Number((record as any)?.season_projected_points ?? 0);
    const averageProjectedPoints =
      typeof player.average_projected_points === 'number' &&
      Number.isFinite(player.average_projected_points) &&
      player.average_projected_points > 0
        ? player.average_projected_points
        : Number.isFinite(recordAvg) && recordAvg > 0
          ? Math.round(recordAvg * 100) / 100
          : Number.isFinite(recordSeason) && recordSeason > 0
            ? Math.round((recordSeason / 17) * 100) / 100
            : baselineProjectedPoints !== undefined
              ? baselineProjectedPoints
              : isInjured && isPlayerSigned(record)
                ? groundedPosBaseline
                : undefined;

    return {
      ...player,
      first_name: firstName,
      last_name: lastName,
      name,
      position,
      ...(baselineProjectedPoints !== undefined
        ? {baseline_projected_points: baselineProjectedPoints}
        : {}),
      ...(averageProjectedPoints !== undefined
        ? {average_projected_points: averageProjectedPoints}
        : {}),
      status: record.status ?? player.status,
      injury_status:
        record.injury_status !== undefined
          ? record.injury_status
          : player.injury_status,
      depth_chart_order:
        'depth_chart_order' in record
          ? (record.depth_chart_order ?? null)
          : player.depth_chart_order,
      fantasy_positions: Array.isArray(record.fantasy_positions)
        ? record.fantasy_positions
        : player.fantasy_positions,
      team: record.team || player.team,
      bye_week: getTeamByeWeek(record.team || player.team) ?? player.bye_week,
      jersey_number: record.number ?? player.jersey_number,
    };
  });

  const extraCandidates: Array<{id: string; searchRank: number}> = [];
  for (const [pid, record] of Object.entries(playerDict)) {
    if (existingIds.has(pid)) continue;
    const pos = String(record?.position || '').toUpperCase();
    if (!allowedPositions.has(pos)) continue;
    if (!isSignedActiveNFLPlayer(pid, record)) continue;
    const searchRank = Number(record?.search_rank || 9999);
    extraCandidates.push({id: pid, searchRank});
  }
  extraCandidates.sort((a, b) => a.searchRank - b.searchRank);
  for (const cand of extraCandidates) {
    const synth = synthesizeCosmicPlayerFromId(cand.id, playerDict, false);
    synth.draft_status = 'available';
    enriched.push(synth);
    existingIds.add(cand.id);
  }

  return enriched;
}

// ============================================================================
// Transformation Engine: Sleeper Data -> Canonical DraftState
// ============================================================================

/**
 * Calculates custom league-specific projected points from raw Sleeper projection stats
 * applying the active league's scoring settings (e.g. 6pt pass TD, PPR, Superflex).
 */
export function calculateSleeperLeagueProjection(
  proj: any,
  scoringSettings?: Record<string, number> | null,
): number {
  if (!proj) return 0;
  if (typeof proj === 'number') return proj;

  if (!scoringSettings) {
    return Number(proj.pts_ppr ?? proj.pts_half_ppr ?? proj.pts_std ?? 0);
  }

  const passYd =
    (proj.pass_yd || 0) *
    ((scoringSettings['pass_yd'] as number | undefined) ?? 0.04);
  const passTd =
    (proj.pass_td || 0) *
    ((scoringSettings['pass_td'] as number | undefined) ?? 4);
  const passInt =
    (proj.pass_int || 0) *
    ((scoringSettings['pass_int'] as number | undefined) ?? -2);
  const pass2pt =
    (proj.pass_2pt || 0) *
    ((scoringSettings['pass_2pt'] as number | undefined) ?? 2);
  const rushYd =
    (proj.rush_yd || 0) *
    ((scoringSettings['rush_yd'] as number | undefined) ?? 0.1);
  const rushTd =
    (proj.rush_td || 0) *
    ((scoringSettings['rush_td'] as number | undefined) ?? 6);
  const rush2pt =
    (proj.rush_2pt || 0) *
    ((scoringSettings['rush_2pt'] as number | undefined) ?? 2);
  const rec =
    (proj.rec || 0) * ((scoringSettings['rec'] as number | undefined) ?? 1);
  const recYd =
    (proj.rec_yd || 0) *
    ((scoringSettings['rec_yd'] as number | undefined) ?? 0.1);
  const recTd =
    (proj.rec_td || 0) *
    ((scoringSettings['rec_td'] as number | undefined) ?? 6);
  const rec2pt =
    (proj.rec_2pt || 0) *
    ((scoringSettings['rec_2pt'] as number | undefined) ?? 2);
  const fumLost =
    (proj.fum_lost || 0) *
    ((scoringSettings['fum_lost'] as number | undefined) ?? -2);

  const total =
    passYd +
    passTd +
    passInt +
    pass2pt +
    rushYd +
    rushTd +
    rush2pt +
    rec +
    recYd +
    recTd +
    rec2pt +
    fumLost;

  if (
    total === 0 &&
    (proj.pts_ppr !== undefined ||
      proj.pts_half_ppr !== undefined ||
      proj.pts_std !== undefined ||
      proj.projected_points !== undefined)
  ) {
    return (
      Math.round(
        Number(
          proj.pts_ppr ??
            proj.pts_half_ppr ??
            proj.pts_std ??
            proj.projected_points ??
            0,
        ) * 100,
      ) / 100
    );
  }

  return Math.round(total * 100) / 100;
}

export const KNOWN_ROSTERED_NFL_PLAYERS: Record<
  string,
  {
    first_name: string;
    last_name: string;
    position: NFLPosition;
    team: string;
    number: number;
    depth_chart_order?: number;
  }
> = {
  '421': {
    first_name: 'Matthew',
    last_name: 'Stafford',
    position: 'QB',
    team: 'LAR',
    number: 9,
  },
  '1166': {
    first_name: 'Kirk',
    last_name: 'Cousins',
    position: 'QB',
    team: 'ATL',
    number: 18,
  },
  '1373': {
    first_name: 'Geno',
    last_name: 'Smith',
    position: 'QB',
    team: 'SEA',
    number: 7,
  },
  '1466': {
    first_name: 'Travis',
    last_name: 'Kelce',
    position: 'TE',
    team: 'KC',
    number: 87,
  },
  '2133': {
    first_name: 'Davante',
    last_name: 'Adams',
    position: 'WR',
    team: 'LAR',
    number: 17,
  },
  '2216': {
    first_name: 'Mike',
    last_name: 'Evans',
    position: 'WR',
    team: 'TB',
    number: 13,
  },
  '2449': {
    first_name: 'Stefon',
    last_name: 'Diggs',
    position: 'WR',
    team: 'HOU',
    number: 1,
  },
  '3163': {
    first_name: 'Jared',
    last_name: 'Goff',
    position: 'QB',
    team: 'DET',
    number: 16,
  },
  '3257': {
    first_name: 'Jacoby',
    last_name: 'Brissett',
    position: 'QB',
    team: 'NE',
    number: 14,
  },
  '4035': {
    first_name: 'Alvin',
    last_name: 'Kamara',
    position: 'RB',
    team: 'NO',
    number: 41,
  },
  '4037': {
    first_name: 'Chris',
    last_name: 'Godwin',
    position: 'WR',
    team: 'TB',
    number: 14,
  },
  '4039': {
    first_name: 'Cooper',
    last_name: 'Kupp',
    position: 'WR',
    team: 'SEA',
    number: 10,
  },
  '4199': {
    first_name: 'Aaron',
    last_name: 'Jones',
    position: 'RB',
    team: 'MIN',
    number: 33,
  },
  '4217': {
    first_name: 'George',
    last_name: 'Kittle',
    position: 'TE',
    team: 'SF',
    number: 85,
  },
  '4892': {
    first_name: 'Baker',
    last_name: 'Mayfield',
    position: 'QB',
    team: 'TB',
    number: 6,
  },
  '4943': {
    first_name: 'Sam',
    last_name: 'Darnold',
    position: 'QB',
    team: 'SEA',
    number: 14,
    depth_chart_order: 2,
  },
  '5012': {
    first_name: 'Mark',
    last_name: 'Andrews',
    position: 'TE',
    team: 'BAL',
    number: 89,
  },
  '5022': {
    first_name: 'Dallas',
    last_name: 'Goedert',
    position: 'TE',
    team: 'PHI',
    number: 88,
  },
  '5045': {
    first_name: 'Courtland',
    last_name: 'Sutton',
    position: 'WR',
    team: 'DEN',
    number: 14,
  },
  '5844': {
    first_name: 'T.J.',
    last_name: 'Hockenson',
    position: 'TE',
    team: 'MIN',
    number: 87,
  },
  '5846': {
    first_name: 'DK',
    last_name: 'Metcalf',
    position: 'WR',
    team: 'PIT',
    number: 4,
  },
  '5849': {
    first_name: 'Kyler',
    last_name: 'Murray',
    position: 'QB',
    team: 'ARI',
    number: 1,
  },
  '5870': {
    first_name: 'Daniel',
    last_name: 'Jones',
    position: 'QB',
    team: 'IND',
    number: 17,
  },
  '5872': {
    first_name: 'Deebo',
    last_name: 'Samuel',
    position: 'WR',
    team: 'SF',
    number: 19,
  },
  '5892': {
    first_name: 'David',
    last_name: 'Montgomery',
    position: 'RB',
    team: 'DET',
    number: 5,
  },
  '5927': {
    first_name: 'Terry',
    last_name: 'McLaurin',
    position: 'WR',
    team: 'WAS',
    number: 17,
  },
  '5947': {
    first_name: 'Jakobi',
    last_name: 'Meyers',
    position: 'WR',
    team: 'LV',
    number: 16,
  },
  '5967': {
    first_name: 'Tony',
    last_name: 'Pollard',
    position: 'RB',
    team: 'TEN',
    number: 20,
  },
  '6130': {
    first_name: 'Devin',
    last_name: 'Singletary',
    position: 'RB',
    team: 'NYG',
    number: 26,
  },
  '6790': {
    first_name: "D'Andre",
    last_name: 'Swift',
    position: 'RB',
    team: 'CHI',
    number: 4,
  },
  '6806': {
    first_name: 'J.K.',
    last_name: 'Dobbins',
    position: 'RB',
    team: 'LAC',
    number: 27,
  },
  '6819': {
    first_name: 'Michael',
    last_name: 'Pittman',
    position: 'WR',
    team: 'IND',
    number: 11,
  },
  '7002': {
    first_name: 'Juwan',
    last_name: 'Johnson',
    position: 'TE',
    team: 'NO',
    number: 83,
  },
  '7021': {
    first_name: 'Rico',
    last_name: 'Dowdle',
    position: 'RB',
    team: 'DAL',
    number: 23,
  },
  '7526': {
    first_name: 'Jaylen',
    last_name: 'Waddle',
    position: 'WR',
    team: 'MIA',
    number: 17,
  },
  '7567': {
    first_name: 'Kenny',
    last_name: 'Gainwell',
    position: 'RB',
    team: 'PHI',
    number: 14,
  },
  '7569': {
    first_name: 'Nico',
    last_name: 'Collins',
    position: 'WR',
    team: 'HOU',
    number: 12,
  },
  '7594': {
    first_name: 'Chuba',
    last_name: 'Hubbard',
    position: 'RB',
    team: 'CAR',
    number: 30,
  },
  '7611': {
    first_name: 'Rhamondre',
    last_name: 'Stevenson',
    position: 'RB',
    team: 'NE',
    number: 38,
  },
  '7619': {
    first_name: 'Mathew',
    last_name: 'Sexton',
    position: 'WR',
    team: 'NYJ',
    number: 87,
  },
  '4574': {
    first_name: 'Cooper',
    last_name: 'Rush',
    position: 'QB',
    team: 'DAL',
    number: 10,
  },
  '8121': {
    first_name: 'Romeo',
    last_name: 'Doubs',
    position: 'WR',
    team: 'GB',
    number: 87,
  },
  '8126': {
    first_name: "Wan'Dale",
    last_name: 'Robinson',
    position: 'WR',
    team: 'NYG',
    number: 17,
  },
  '8131': {
    first_name: 'Isaiah',
    last_name: 'Likely',
    position: 'TE',
    team: 'BAL',
    number: 80,
  },
  '8132': {
    first_name: 'Tyler',
    last_name: 'Allgeier',
    position: 'RB',
    team: 'ATL',
    number: 25,
  },
  '8138': {
    first_name: 'James',
    last_name: 'Cook',
    position: 'RB',
    team: 'BUF',
    number: 4,
  },
  '8142': {
    first_name: 'Alec',
    last_name: 'Pierce',
    position: 'WR',
    team: 'IND',
    number: 14,
  },
  '8146': {
    first_name: 'Garrett',
    last_name: 'Wilson',
    position: 'WR',
    team: 'NYJ',
    number: 5,
  },
  '8148': {
    first_name: 'Jameson',
    last_name: 'Williams',
    position: 'WR',
    team: 'DET',
    number: 1,
  },
  '8154': {
    first_name: 'Brian',
    last_name: 'Robinson',
    position: 'RB',
    team: 'WAS',
    number: 8,
  },
  '8161': {
    first_name: 'Malik',
    last_name: 'Willis',
    position: 'QB',
    team: 'GB',
    number: 2,
  },
  '8167': {
    first_name: 'Christian',
    last_name: 'Watson',
    position: 'WR',
    team: 'GB',
    number: 9,
  },
  '8183': {
    first_name: 'Brock',
    last_name: 'Purdy',
    position: 'QB',
    team: 'SF',
    number: 13,
  },
  '8228': {
    first_name: 'Jaylen',
    last_name: 'Warren',
    position: 'RB',
    team: 'PIT',
    number: 30,
  },
  '8408': {
    first_name: 'Jordan',
    last_name: 'Mason',
    position: 'RB',
    team: 'SF',
    number: 24,
  },
  '8676': {
    first_name: 'Rashid',
    last_name: 'Shaheed',
    position: 'WR',
    team: 'NO',
    number: 22,
  },
  '8800': {
    first_name: 'Malik',
    last_name: 'Davis',
    position: 'RB',
    team: 'DAL',
    number: 20,
  },
  '9225': {
    first_name: 'Tank',
    last_name: 'Bigsby',
    position: 'RB',
    team: 'JAX',
    number: 4,
  },
  '9226': {
    first_name: "De'Von",
    last_name: 'Achane',
    position: 'RB',
    team: 'MIA',
    number: 28,
  },
  '9228': {
    first_name: 'Bryce',
    last_name: 'Young',
    position: 'QB',
    team: 'CAR',
    number: 9,
  },
  '9480': {
    first_name: 'Brenton',
    last_name: 'Strange',
    position: 'TE',
    team: 'JAX',
    number: 85,
  },
  '9484': {
    first_name: 'Tucker',
    last_name: 'Kraft',
    position: 'TE',
    team: 'GB',
    number: 85,
  },
  '9487': {
    first_name: 'Parker',
    last_name: 'Washington',
    position: 'WR',
    team: 'JAX',
    number: 11,
  },
  '9500': {
    first_name: 'Josh',
    last_name: 'Downs',
    position: 'WR',
    team: 'IND',
    number: 2,
  },
  '9504': {
    first_name: 'Kayshon',
    last_name: 'Boutte',
    position: 'WR',
    team: 'NE',
    number: 9,
  },
  '9508': {
    first_name: 'Tyjae',
    last_name: 'Spears',
    position: 'RB',
    team: 'TEN',
    number: 2,
  },
  '9754': {
    first_name: 'Quentin',
    last_name: 'Johnston',
    position: 'WR',
    team: 'LAC',
    number: 1,
  },
  '9756': {
    first_name: 'Jordan',
    last_name: 'Addison',
    position: 'WR',
    team: 'MIN',
    number: 3,
  },
  '10213': {
    first_name: 'Tre',
    last_name: 'Tucker',
    position: 'WR',
    team: 'LV',
    number: 1,
  },
  '10219': {
    first_name: 'Chris',
    last_name: 'Rodriguez',
    position: 'RB',
    team: 'WAS',
    number: 24,
  },
  '10222': {
    first_name: 'Jayden',
    last_name: 'Reed',
    position: 'WR',
    team: 'GB',
    number: 11,
  },
  '10232': {
    first_name: 'Michael',
    last_name: 'Wilson',
    position: 'WR',
    team: 'ARI',
    number: 14,
  },
  '10236': {
    first_name: 'Dalton',
    last_name: 'Kincaid',
    position: 'TE',
    team: 'BUF',
    number: 86,
  },
  '11560': {
    first_name: 'Caleb',
    last_name: 'Williams',
    position: 'QB',
    team: 'CHI',
    number: 18,
  },
  '11563': {
    first_name: 'Bo',
    last_name: 'Nix',
    position: 'QB',
    team: 'DEN',
    number: 10,
  },
  '11581': {
    first_name: 'MarShawn',
    last_name: 'Lloyd',
    position: 'RB',
    team: 'GB',
    number: 32,
  },
  '11583': {
    first_name: 'Jonathon',
    last_name: 'Brooks',
    position: 'RB',
    team: 'CAR',
    number: 24,
  },
  '11584': {
    first_name: 'Bucky',
    last_name: 'Irving',
    position: 'RB',
    team: 'TB',
    number: 7,
  },
  '11603': {
    first_name: 'AJ',
    last_name: 'Barner',
    position: 'TE',
    team: 'SEA',
    number: 88,
  },
  '11610': {
    first_name: 'Malik',
    last_name: 'Washington',
    position: 'WR',
    team: 'MIA',
    number: 6,
  },
  '11618': {
    first_name: 'Jalen',
    last_name: 'McMillan',
    position: 'WR',
    team: 'TB',
    number: 11,
  },
  '11620': {
    first_name: 'Rome',
    last_name: 'Odunze',
    position: 'WR',
    team: 'CHI',
    number: 15,
  },
  '11624': {
    first_name: 'Xavier',
    last_name: 'Worthy',
    position: 'WR',
    team: 'KC',
    number: 1,
  },
  '11631': {
    first_name: 'Brian',
    last_name: 'Thomas',
    position: 'WR',
    team: 'JAX',
    number: 7,
  },
  '11646': {
    first_name: 'Jalen',
    last_name: 'Coker',
    position: 'WR',
    team: 'CAR',
    number: 18,
  },
  '11834': {
    first_name: 'Devaughn',
    last_name: 'Vele',
    position: 'WR',
    team: 'DEN',
    number: 17,
  },
  '12469': {
    first_name: 'Dylan',
    last_name: 'Sampson',
    position: 'RB',
    team: 'CLE',
    number: 22,
  },
  '12471': {
    first_name: 'DJ',
    last_name: 'Giddens',
    position: 'RB',
    team: 'IND',
    number: 21,
  },
  '12489': {
    first_name: 'RJ',
    last_name: 'Harvey',
    position: 'RB',
    team: 'DEN',
    number: 12,
  },
  '12490': {
    first_name: 'Bhayshul',
    last_name: 'Tuten',
    position: 'RB',
    team: 'JAX',
    number: 33,
  },
  '12493': {
    first_name: 'Oronde',
    last_name: 'Gadsden',
    position: 'TE',
    team: 'LAC',
    number: 86,
  },
  '12501': {
    first_name: 'Matthew',
    last_name: 'Golden',
    position: 'WR',
    team: 'GB',
    number: 81,
  },
  '12512': {
    first_name: 'Quinshon',
    last_name: 'Judkins',
    position: 'RB',
    team: 'CLE',
    number: 10,
  },
  '12519': {
    first_name: 'Luther',
    last_name: 'Burden',
    position: 'WR',
    team: 'CHI',
    number: 10,
  },
  '12522': {
    first_name: 'Cam',
    last_name: 'Ward',
    position: 'QB',
    team: 'TEN',
    number: 1,
  },
  '12529': {
    first_name: 'TreVeyon',
    last_name: 'Henderson',
    position: 'RB',
    team: 'NE',
    number: 32,
  },
  '12533': {
    first_name: 'Jacory',
    last_name: 'Croskey-Merritt',
    position: 'RB',
    team: 'WAS',
    number: 22,
  },
  '12534': {
    first_name: 'Kyle',
    last_name: 'Monangai',
    position: 'RB',
    team: 'CHI',
    number: 25,
  },
  '12545': {
    first_name: 'Tyler',
    last_name: 'Shough',
    position: 'QB',
    team: 'NO',
    number: 6,
  },
  '13268': {
    first_name: 'Elijah',
    last_name: 'Sarratt',
    position: 'WR',
    team: 'BAL',
    number: 13,
  },
  '13269': {
    first_name: 'Fernando',
    last_name: 'Mendoza',
    position: 'QB',
    team: 'LV',
    number: 15,
  },
  '13274': {
    first_name: 'Germie',
    last_name: 'Bernard',
    position: 'WR',
    team: 'PIT',
    number: 17,
  },
  '13279': {
    first_name: 'Carnell',
    last_name: 'Tate',
    position: 'WR',
    team: 'TEN',
    number: 14,
  },
  '13281': {
    first_name: 'Jordyn',
    last_name: 'Tyson',
    position: 'WR',
    team: 'NO',
    number: 1,
  },
  '13286': {
    first_name: 'Jadarian',
    last_name: 'Price',
    position: 'RB',
    team: 'SEA',
    number: 8,
  },
  '13288': {
    first_name: 'Nicholas',
    last_name: 'Singleton',
    position: 'RB',
    team: 'TEN',
    number: 32,
  },
  '13294': {
    first_name: 'Makai',
    last_name: 'Lemon',
    position: 'WR',
    team: 'PHI',
    number: 9,
  },
  '13296': {
    first_name: 'Caleb',
    last_name: 'Douglas',
    position: 'WR',
    team: 'MIA',
    number: 83,
  },
  '13298': {
    first_name: 'KC',
    last_name: 'Concepcion',
    position: 'WR',
    team: 'CLE',
    number: 1,
  },
  '13305': {
    first_name: 'Mike',
    last_name: 'Washington',
    position: 'RB',
    team: 'LV',
    number: 30,
  },
  '13337': {
    first_name: 'Emmett',
    last_name: 'Johnson',
    position: 'RB',
    team: 'KC',
    number: 10,
  },
  '13346': {
    first_name: 'Denzel',
    last_name: 'Boston',
    position: 'WR',
    team: 'CLE',
    number: 12,
  },
  '13414': {
    first_name: 'Kaelon',
    last_name: 'Black',
    position: 'RB',
    team: 'SF',
    number: 26,
  },
  '13417': {
    first_name: "De'Zhaun",
    last_name: 'Stribling',
    position: 'WR',
    team: 'SF',
    number: 7,
  },
  '96': {first_name: 'Aaron', last_name: 'Rodgers', position: 'QB', team: 'PIT', number: 8},
  '1479': {first_name: 'Keenan', last_name: 'Allen', position: 'WR', team: 'IND', number: 10},
  '1737': {first_name: 'Case', last_name: 'Keenum', position: 'QB', team: 'CHI', number: 11},
  '2306': {first_name: 'Jameis', last_name: 'Winston', position: 'QB', team: 'NYG', number: 19},
  '2307': {first_name: 'Marcus', last_name: 'Mariota', position: 'QB', team: 'WAS', number: 8},
  '2505': {first_name: 'Darren', last_name: 'Waller', position: 'TE', team: 'CAR', number: 88},
  '3198': {first_name: 'Derrick', last_name: 'Henry', position: 'RB', team: 'BAL', number: 22},
  '3214': {first_name: 'Hunter', last_name: 'Henry', position: 'TE', team: 'NE', number: 85},
  '3271': {first_name: 'Tyler', last_name: 'Higbee', position: 'TE', team: 'LAR', number: 89},
  '3294': {first_name: 'Dak', last_name: 'Prescott', position: 'QB', team: 'DAL', number: 4},
  '3321': {first_name: 'Tyreek', last_name: 'Hill', position: 'WR', team: 'MIA', number: 10},
  '3634': {first_name: 'Kalif', last_name: 'Raymond', position: 'WR', team: 'CHI', number: 14},
  '4017': {first_name: 'Deshaun', last_name: 'Watson', position: 'QB', team: 'CLE', number: 4},
  '4034': {first_name: 'Christian', last_name: 'McCaffrey', position: 'RB', team: 'SF', number: 23},
  '4046': {first_name: 'Patrick', last_name: 'Mahomes', position: 'QB', team: 'KC', number: 15},
  '4177': {first_name: 'Mack', last_name: 'Hollins', position: 'WR', team: 'NE', number: 13},
  '4454': {first_name: 'Kendrick', last_name: 'Bourne', position: 'WR', team: 'ARI', number: 17},
  '4663': {first_name: 'Austin', last_name: 'Ekeler', position: 'RB', team: 'WAS', number: 30},
  '4866': {first_name: 'Saquon', last_name: 'Barkley', position: 'RB', team: 'PHI', number: 26},
  '4881': {first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL', number: 8},
  '4983': {first_name: 'DJ', last_name: 'Moore', position: 'WR', team: 'BUF', number: 2},
  '4984': {first_name: 'Josh', last_name: 'Allen', position: 'QB', team: 'BUF', number: 17},
  '5850': {first_name: 'Josh', last_name: 'Jacobs', position: 'RB', team: 'GB', number: 8},
  '5859': {first_name: 'A.J.', last_name: 'Brown', position: 'WR', team: 'NE', number: 1},
  '6770': {first_name: 'Joe', last_name: 'Burrow', position: 'QB', team: 'CIN', number: 9},
  '6786': {first_name: 'CeeDee', last_name: 'Lamb', position: 'WR', team: 'DAL', number: 88},
  '6794': {first_name: 'Justin', last_name: 'Jefferson', position: 'WR', team: 'MIN', number: 18},
  '6797': {first_name: 'Justin', last_name: 'Herbert', position: 'QB', team: 'LAC', number: 10},
  '6801': {first_name: 'Tee', last_name: 'Higgins', position: 'WR', team: 'CIN', number: 5},
  '6804': {first_name: 'Jordan', last_name: 'Love', position: 'QB', team: 'GB', number: 10},
  '6813': {first_name: 'Jonathan', last_name: 'Taylor', position: 'RB', team: 'IND', number: 28},
  '6904': {first_name: 'Jalen', last_name: 'Hurts', position: 'QB', team: 'PHI', number: 1},
  '7083': {first_name: 'Tyler', last_name: 'Huntley', position: 'QB', team: 'BAL', number: 5},
  '7523': {first_name: 'Trevor', last_name: 'Lawrence', position: 'QB', team: 'JAX', number: 16},
  '7525': {first_name: 'DeVonta', last_name: 'Smith', position: 'WR', team: 'PHI', number: 6},
  '7547': {first_name: 'Amon-Ra', last_name: 'St. Brown', position: 'WR', team: 'DET', number: 14},
  '7564': {first_name: "Ja'Marr", last_name: 'Chase', position: 'WR', team: 'CIN', number: 1},
  '7588': {first_name: 'Javonte', last_name: 'Williams', position: 'RB', team: 'DAL', number: 33},
  '7600': {first_name: 'Pat', last_name: 'Freiermuth', position: 'TE', team: 'PIT', number: 88},
  '8110': {first_name: 'Jake', last_name: 'Ferguson', position: 'TE', team: 'DAL', number: 87},
  '8112': {first_name: 'Drake', last_name: 'London', position: 'WR', team: 'ATL', number: 5},
  '8129': {first_name: 'Dameon', last_name: 'Pierce', position: 'RB', team: 'PHI', number: 39},
  '8130': {first_name: 'Trey', last_name: 'McBride', position: 'TE', team: 'ARI', number: 85},
  '8134': {first_name: 'Khalil', last_name: 'Shakir', position: 'WR', team: 'BUF', number: 10},
  '8136': {first_name: 'Rachaad', last_name: 'White', position: 'RB', team: 'WAS', number: 1},
  '8137': {first_name: 'George', last_name: 'Pickens', position: 'WR', team: 'DAL', number: 3},
  '8144': {first_name: 'Chris', last_name: 'Olave', position: 'WR', team: 'NO', number: 12},
  '8150': {first_name: 'Kyren', last_name: 'Williams', position: 'RB', team: 'LAR', number: 23},
  '8151': {first_name: 'Kenneth', last_name: 'Walker', position: 'RB', team: 'KC', number: 9},
  '8155': {first_name: 'Breece', last_name: 'Hall', position: 'RB', team: 'NYJ', number: 20},
  '9221': {first_name: 'Jahmyr', last_name: 'Gibbs', position: 'RB', team: 'DET', number: 0},
  '9224': {first_name: 'Chase', last_name: 'Brown', position: 'RB', team: 'CIN', number: 30},
  '9230': {first_name: 'Tanner', last_name: 'McKee', position: 'QB', team: 'PHI', number: 16},
  '9486': {first_name: 'Dontayvion', last_name: 'Wicks', position: 'WR', team: 'PHI', number: 13},
  '9488': {first_name: 'Jaxon', last_name: 'Smith-Njigba', position: 'WR', team: 'SEA', number: 11},
  '9493': {first_name: 'Puka', last_name: 'Nacua', position: 'WR', team: 'LAR', number: 12},
  '9509': {first_name: 'Bijan', last_name: 'Robinson', position: 'RB', team: 'ATL', number: 7},
  '9511': {first_name: 'Keaton', last_name: 'Mitchell', position: 'RB', team: 'LAC', number: 34},
  '9753': {first_name: 'Zach', last_name: 'Charbonnet', position: 'RB', team: 'SEA', number: 26},
  '9757': {first_name: 'Kendre', last_name: 'Miller', position: 'RB', team: 'NO', number: 5},
  '9758': {first_name: 'C.J.', last_name: 'Stroud', position: 'QB', team: 'HOU', number: 7},
  '9997': {first_name: 'Zay', last_name: 'Flowers', position: 'WR', team: 'BAL', number: 4},
  '10229': {first_name: 'Rashee', last_name: 'Rice', position: 'WR', team: 'KC', number: 4},
  '10235': {first_name: 'Roschon', last_name: 'Johnson', position: 'RB', team: 'CHI', number: 23},
  '10859': {first_name: 'Sam', last_name: 'LaPorta', position: 'TE', team: 'DET', number: 87},
  '11435': {first_name: 'Emanuel', last_name: 'Wilson', position: 'RB', team: 'SEA', number: 23},
  '11439': {first_name: 'Jaleel', last_name: 'McLaughlin', position: 'RB', team: 'CLE', number: 38},
  '11559': {first_name: 'Michael', last_name: 'Penix', position: 'QB', team: 'ATL', number: 9},
  '11564': {first_name: 'Drake', last_name: 'Maye', position: 'QB', team: 'NE', number: 10},
  '11566': {first_name: 'Jayden', last_name: 'Daniels', position: 'QB', team: 'WAS', number: 5},
  '11576': {first_name: 'Braelon', last_name: 'Allen', position: 'RB', team: 'NYJ', number: 0},
  '11586': {first_name: 'Blake', last_name: 'Corum', position: 'RB', team: 'LAR', number: 24},
  '11604': {first_name: 'Brock', last_name: 'Bowers', position: 'TE', team: 'LV', number: 89},
  '11628': {first_name: 'Marvin', last_name: 'Harrison', position: 'WR', team: 'ARI', number: 18},
  '11632': {first_name: 'Malik', last_name: 'Nabers', position: 'WR', team: 'NYG', number: 1},
  '11635': {first_name: 'Ladd', last_name: 'McConkey', position: 'WR', team: 'LAC', number: 15},
  '11637': {first_name: 'Keon', last_name: 'Coleman', position: 'WR', team: 'BUF', number: 0},
  '11783': {first_name: 'Ryan', last_name: 'Flournoy', position: 'WR', team: 'DAL', number: 19},
  '12474': {first_name: 'Woody', last_name: 'Marks', position: 'RB', team: 'HOU', number: 4},
  '12481': {first_name: 'Cam', last_name: 'Skattebo', position: 'RB', team: 'NYG', number: 44},
  '12495': {first_name: 'Ollie', last_name: 'Gordon', position: 'RB', team: 'MIA', number: 0},
  '12504': {first_name: 'Kaleb', last_name: 'Johnson', position: 'RB', team: 'GB', number: 26},
  '12506': {first_name: 'Harold', last_name: 'Fannin', position: 'TE', team: 'CLE', number: 44},
  '12507': {first_name: 'Omarion', last_name: 'Hampton', position: 'RB', team: 'LAC', number: 8},
  '12514': {first_name: 'Emeka', last_name: 'Egbuka', position: 'WR', team: 'TB', number: 2},
  '12517': {first_name: 'Colston', last_name: 'Loveland', position: 'TE', team: 'CHI', number: 84},
  '12518': {first_name: 'Tyler', last_name: 'Warren', position: 'TE', team: 'IND', number: 84},
  '12526': {first_name: 'Tetairoa', last_name: 'McMillan', position: 'WR', team: 'CAR', number: 4},
  '12527': {first_name: 'Ashton', last_name: 'Jeanty', position: 'RB', team: 'LV', number: 2},
  '13285': {first_name: 'Malachi', last_name: 'Fields', position: 'WR', team: 'NYG', number: 88},
  '13287': {first_name: 'Jeremiyah', last_name: 'Love', position: 'RB', team: 'ARI', number: 4},
  '13301': {first_name: 'Antonio', last_name: 'Williams', position: 'WR', team: 'WAS', number: 14},
  '13330': {first_name: 'Kenyon', last_name: 'Sadiq', position: 'TE', team: 'NYJ', number: 16},
  '13425': {first_name: 'Jalon', last_name: 'Daniels', position: 'QB', team: 'TB', number: 10},
};

/**
 * Dynamically synthesizes a full CosmicPlayer from Sleeper player ID, metadata, or player dictionary.
 */
export function synthesizeCosmicPlayerFromId(
  playerId: string,
  playerDict?: Record<string, SleeperPlayerRecord> | null,
  isMyTeam = true,
  meta?: SleeperPick['metadata'],
): CosmicPlayer {
  const record =
    (playerDict && typeof playerDict === 'object' && playerId in playerDict)
      ? (playerDict as any)[playerId]
      : (playerDict && typeof playerDict === 'object' && ('position' in (playerDict as any) || 'first_name' in (playerDict as any) || 'fantasy_positions' in (playerDict as any)))
        ? (playerDict as any)
        : KNOWN_ROSTERED_NFL_PLAYERS[String(playerId)];

  const firstName =
    meta?.first_name ||
    record?.first_name ||
    'Active';
  const lastName =
    meta?.last_name ||
    record?.last_name ||
    `Player ${playerId}`;
  const name = `${firstName} ${lastName}`.trim();

  const rawPos = (
    meta?.position ||
    record?.position ||
    'WR'
  ).toUpperCase();
  const validPositions: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const position: NFLPosition = validPositions.includes(rawPos as NFLPosition)
    ? (rawPos as NFLPosition)
    : 'WR';

  const liveTeam =
    record?.team && record.team !== 'FA' && record.team !== 'NFL'
      ? record.team
      : undefined;
  const team = liveTeam || meta?.team || record?.team || 'NFL';
  const jerseyNumber =
    Number(meta?.number || record?.number || 0) || 0;
  const status =
    meta?.status ||
    (record as any)?.status ||
    'Active';
  const injuryStatus =
    (record as any)?.injury_status !== undefined
      ? ((record as any).injury_status ?? null)
      : meta?.injury_status !== undefined
        ? meta.injury_status
        : null;

  // Elemental traits generation based on player id/name
  const elements: ElementType[] = ['Fire', 'Earth', 'Air', 'Water'];
  let hash = 0;
  const seed = `${playerId}-${name}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const element = elements[absHash % 4];
  const sunSigns = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];
  const sunSign = sunSigns[absHash % 12];
  const tarotCards = [
    'The Magician',
    'The High Priestess',
    'The Empress',
    'The Emperor',
    'The Hierophant',
    'The Lovers',
    'The Chariot',
    'Strength',
    'The Hermit',
    'Wheel of Fortune',
    'Justice',
    'The Hanged Man',
    'Death',
    'Temperance',
    'The Devil',
    'The Tower',
    'The Star',
    'The Moon',
    'The Sun',
    'Judgement',
    'The World',
  ];
  const tarotCard = tarotCards[absHash % tarotCards.length];

  const celestialScore = Number(
    (
      56.0 +
      ((absHash * 17 + (sunSign.charCodeAt(0) || 65) * 7) % 410) / 10
    ).toFixed(1),
  );
  const baseNumeric = calculateNumericTier(
    (record as any)?.birth_date || null,
    jerseyNumber,
  );
  const numericScore = Number(
    Math.min(
      98.0,
      Math.max(52.0, baseNumeric + (((absHash * 31) % 180) / 10 - 9.0)),
    ).toFixed(1),
  );
  const geomanticScore = Number(
    (
      55.0 +
      ((absHash * 23 + (team.charCodeAt(0) || 65) * 13) % 420) / 10
    ).toFixed(1),
  );
  const oracularScore = Number(
    (
      54.0 +
      ((absHash * 29 + (tarotCard.charCodeAt(4) || 65) * 11) % 440) / 10
    ).toFixed(1),
  );
  const harmonyScore = Number(
    (
      58.0 +
      ((absHash * 19 + (element.charCodeAt(0) || 65) * 9) % 380) / 10
    ).toFixed(1),
  );
  const divinationBreakdown = {
    celestial: celestialScore,
    numeric: numericScore,
    geomantic: geomanticScore,
    oracular: oracularScore,
    harmony: harmonyScore,
  };
  const spiritScore = computeSpiritScore(divinationBreakdown);

  const searchRank = Number((record as any)?.search_rank || 0);
  const isDeepFreeAgent = !isMyTeam && searchRank > 250;
  const isInjured = Boolean(
    (record?.injury_status && (INJURED_STATUSES as readonly string[]).includes(record.injury_status)) ||
    (meta?.injury_status && (INJURED_STATUSES as readonly string[]).includes(meta.injury_status)),
  );
  const depthChartOrder = record?.depth_chart_order ?? (meta as any)?.depth_chart_order ?? null;
  const groundedPosBaseline = getGroundedPositionBaseline(position, {
    isDeepReserve: isDeepFreeAgent,
    isMyTeam,
    searchRank: searchRank > 0 ? searchRank : null,
    depthChartOrder: typeof depthChartOrder === 'number' ? depthChartOrder : null,
    status: record?.status ?? meta?.status,
  });

  const rawBaseline = Number(
    (record as any)?.baseline_projected_points ??
      (meta as any)?.baseline_projected_points ??
      0,
  );
  const baselinePts =
    Number.isFinite(rawBaseline) && rawBaseline > 0
      ? Math.round(rawBaseline * 100) / 100
      : isInjured && isPlayerSigned(record || { team })
        ? groundedPosBaseline
        : undefined;

  const baseWeekly = isDeepFreeAgent
    ? 4.0 + (absHash % 35) / 10
    : position === 'QB'
      ? 15.5 + (absHash % 40) / 10
      : position === 'RB'
        ? 13.5 + (absHash % 40) / 10
        : position === 'WR'
          ? 12.5 + (absHash % 40) / 10
          : position === 'TE'
            ? 8.5 + (absHash % 30) / 10
            : position === 'K'
              ? 8.0 + (absHash % 30) / 10
              : 7.0 + (absHash % 30) / 10;
  const weeklyPts = isInjured ? 0 : Math.round(baseWeekly * 10) / 10;
  const rawAvg = Number(
    (record as any)?.average_projected_points ??
      (meta as any)?.average_projected_points ??
      0,
  );
  const rawSeason = Number(
    (record as any)?.season_projected_points ??
      (meta as any)?.season_projected_points ??
      0,
  );

  const avgPts =
    Number.isFinite(rawAvg) && rawAvg > 0
      ? Math.round(rawAvg * 100) / 100
      : Number.isFinite(rawSeason) && rawSeason > 0
        ? Math.round((rawSeason / 17) * 100) / 100
        : baselinePts !== undefined
          ? baselinePts
          : isInjured && isPlayerSigned(record || { team })
            ? groundedPosBaseline
            : undefined;
  const vorNormalized = isMyTeam ? 75.0 : isDeepFreeAgent ? 25.0 : 62.0;
  const marketVor = isMyTeam ? 5.0 : isDeepFreeAgent ? -2.0 : 2.5;
  const draftScore =
    Math.round(((1 - DEFAULT_CHAOS_LAMBDA) * vorNormalized + DEFAULT_CHAOS_LAMBDA * spiritScore) * 10) / 10;

  return {
    id: playerId,
    name,
    first_name: firstName,
    last_name: lastName,
    position,
    team,
    jersey_number: jerseyNumber,
    bye_week:
      getTeamByeWeek(team) ??
      (Number.isFinite(Number((record as any)?.bye_week)) && Number((record as any)?.bye_week) > 0
        ? Number((record as any)?.bye_week)
        : Number.isFinite(Number((meta as any)?.bye_week)) && Number((meta as any)?.bye_week) > 0
          ? Number((meta as any)?.bye_week)
          : 0),
    depth_chart_order:
      (record && 'depth_chart_order' in record)
        ? (record.depth_chart_order ?? null)
        : (meta && 'depth_chart_order' in meta && (meta as any).depth_chart_order != null)
          ? (meta as any).depth_chart_order
          : undefined,
    fantasy_positions: (record && 'fantasy_positions' in record && Array.isArray(record.fantasy_positions)) ? record.fantasy_positions : undefined,
    adp: 0, // unknown; drafted players get their real pick number
    projected_points: weeklyPts,
    weekly_projected_points: weeklyPts,
    sleeper_projected_points: weeklyPts,
    nfl_projected_points: weeklyPts,
    ...(baselinePts !== undefined
      ? {baseline_projected_points: baselinePts}
      : {}),
    ...(avgPts !== undefined && avgPts > 0
      ? {average_projected_points: avgPts}
      : {}),
    ...(rawSeason > 0
      ? {season_projected_points: Math.round(rawSeason * 100) / 100}
      : {}),
    market_vor: marketVor,
    vor_normalized: vorNormalized,
    draft_score: draftScore,
    spirit_score: spiritScore,
    harmony_score: harmonyScore,
    draft_status: isMyTeam ? 'my_team' : 'drafted',
    drafted_by_user_id: null,
    drafted_pick_no: null,
    elemental_traits: {
      sun_sign: sunSign,
      element,
      life_path_number: (absHash % 9) + 1,
      gematria_resonance: (absHash % 10) + 1,
      tarot_card: tarotCard,
      iching_hexagram: (absHash % 64) + 1,
      score: Math.round(celestialScore),
    },
    divination_breakdown: divinationBreakdown,
    status,
    injury_status: injuryStatus,
    // No real per-player catalyst data exists; leave empty rather than repeat
    // the same lines on every player.
    catalysts: [],
    risks: [],
  };
}

/**
 * Maps a single roster slot designation (e.g. 'FLEX', 'SUPER_FLEX', 'WRRB_FLEX', 'REC_FLEX', 'K', 'DEF')
 * to its eligible positions.
 */
export function expandSlotPositions(slot: string): NFLPosition[] {
  const s = (slot || '').toUpperCase().trim().replace(/\d+$/, '');
  switch (s) {
    case 'QB':
      return ['QB'];
    case 'RB':
      return ['RB'];
    case 'WR':
      return ['WR'];
    case 'TE':
      return ['TE'];
    case 'K':
      return ['K'];
    case 'DEF':
      return ['DEF'];
    case 'FLEX':
    case 'W/R/T':
    case 'WR_RB_TE':
      return ['WR', 'RB', 'TE'];
    case 'SUPER_FLEX':
    case 'SUPERFLEX':
    case 'QB/W/R/T':
    case 'QB_WR_RB_TE':
      return ['QB', 'WR', 'RB', 'TE'];
    case 'WRRB_FLEX':
    case 'W/R':
    case 'WR_RB':
    case 'RB_WR':
      return ['WR', 'RB'];
    case 'REC_FLEX':
    case 'W/T':
    case 'WR_TE':
    case 'WR_TE_FLEX':
      return ['WR', 'TE'];
    case 'IDP_FLEX':
      return ['IDP', 'DL', 'LB', 'DB'] as any[];
    case 'DL':
    case 'LB':
    case 'DB':
    case 'IDP':
      return [s as any];
    case 'BN':
    case 'BENCH':
    case 'IR':
    case 'TAXI':
    case 'RES':
      return [];
    default:
      if (isBenchOrReserveSlot(s)) return [];
      return ['WR', 'RB', 'TE'];
  }
}

/**
 * Formats a Sleeper starting slot role for concise display (e.g. FLEX -> WRT, SUPER_FLEX -> WRTQ).
 */
export function formatStarterRole(role: string): string {
  const r = (role || '').toUpperCase().trim().replace(/\d+$/, '');
  if (r === 'FLEX') return 'WRT';
  if (r === 'SUPER_FLEX' || r === 'SUPERFLEX') return 'WRTQ';
  if (r === 'WRRB_FLEX' || r === 'WRRB') return 'WR/RB';
  if (r === 'REC_FLEX' || r === 'WRTE') return 'WR/TE';
  if (r === 'IDP_FLEX') return 'IDP';
  return r;
}

export function isBenchOrReserveSlot(role: string): boolean {
  const s = String(role || '').toUpperCase().trim();
  if (!s) return false;
  return /^(BN|BENCH|IR|TAXI|RES|RESERVE)\d*$/.test(s);
}

/**
 * Extracts active starting slots from league roster positions or team roster slots,
 * filtering out bench and reserve slots ('BN', 'IR', 'TAXI', 'RES').
 */
export function extractStartingSlots(
  rosterPositions?: string[] | null,
  fallbackRoster?: RosterSlot[] | null,
): string[] {
  const raw = Array.isArray(rosterPositions) ? rosterPositions : [];
  const nonBench = raw.filter((p) => p && !isBenchOrReserveSlot(p));
  if (nonBench.length > 0) return nonBench;

  if (Array.isArray(fallbackRoster)) {
    const fromRoster = fallbackRoster
      .filter((s: RosterSlot) => {
        const sid = s.slot_id || s.slot_name || '';
        return sid && !isBenchOrReserveSlot(sid);
      })
      .map((s: RosterSlot) => s.slot_id || s.slot_name || '');
    if (fromRoster.length > 0) return fromRoster;
  }

  return ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'];
}

export interface StarterPairRow {
  slotLabel: string;
  slotRole: string;
  user: PlayerMatchupFavorability | null;
  opp: PlayerMatchupFavorability | null;
}

function isPlayerEligibleForSlot(
  p: PlayerMatchupFavorability,
  cleanRole: string,
  eligible: NFLPosition[],
): boolean {
  if (p.position === cleanRole || eligible.includes(p.position)) return true;
  if (Array.isArray(p.fantasy_positions)) {
    return p.fantasy_positions.some(
      (fp) =>
        typeof fp === 'string' &&
        (fp.toUpperCase() === cleanRole || eligible.includes(fp.toUpperCase() as NFLPosition)),
    );
  }
  return false;
}

function isPlayerEarmarkedForLaterSlot(
  pid: string,
  p: PlayerMatchupFavorability,
  currentIdx: number,
  starterIds: string[],
  startingSlots: string[],
): boolean {
  if (!Array.isArray(starterIds) || !Array.isArray(startingSlots)) return false;
  const laterIdx = starterIds.findIndex(
    (id, idx) =>
      idx > currentIdx &&
      idx < startingSlots.length &&
      String(id) === pid &&
      isPlayerEligibleForSlot(
        p,
        String(startingSlots[idx]).toUpperCase().trim().replace(/\d+$/, ''),
        expandSlotPositions(startingSlots[idx]),
      ),
  );
  return laterIdx !== -1;
}

/**
 * Builds aligned starter pair rows matching the Sleeper league's starting slot order.
 * Strictly assigns by index when starter ID arrays are provided, treating '0' as an empty slot.
 * Validates positional eligibility before accepting an index-mapped player to guard against unordered rosters.
 * Appends any unassigned starters as overflow rows to guarantee zero lost starters.
 */
export function buildStarterPairs(
  startingSlots: string[],
  allUserStarters: PlayerMatchupFavorability[],
  allOppStarters: PlayerMatchupFavorability[],
  userStarterIds: string[] | null | undefined = [],
  oppStarterIds: string[] | null | undefined = [],
): StarterPairRow[] {
  const safeStartingSlots = Array.isArray(startingSlots) ? startingSlots : [];
  const safeUserStarters = Array.isArray(allUserStarters) ? allUserStarters : [];
  const safeOppStarters = Array.isArray(allOppStarters) ? allOppStarters : [];
  const uIds = Array.isArray(userStarterIds) ? userStarterIds : [];
  const oIds = Array.isArray(oppStarterIds) ? oppStarterIds : [];

  const userFavMap = new Map<string, PlayerMatchupFavorability>(
    safeUserStarters.map((p) => [String(p.player_id), p]),
  );
  const oppFavMap = new Map<string, PlayerMatchupFavorability>(
    safeOppStarters.map((p) => [String(p.player_id), p]),
  );

  const assignedUser = new Set<string>();
  const assignedOpp = new Set<string>();
  const pairs: StarterPairRow[] = [];

  const hasUserIds = uIds.length > 0;
  const hasOppIds = oIds.length > 0;

  const userStarterIdSet = hasUserIds
    ? new Set(uIds.map(String).filter((id) => id && id !== '0'))
    : null;
  const oppStarterIdSet = hasOppIds
    ? new Set(oIds.map(String).filter((id) => id && id !== '0'))
    : null;

  const candidateUserStarters = userStarterIdSet
    ? safeUserStarters.filter((p) => userStarterIdSet.has(String(p.player_id)))
    : safeUserStarters;
  const candidateOppStarters = oppStarterIdSet
    ? safeOppStarters.filter((p) => oppStarterIdSet.has(String(p.player_id)))
    : safeOppStarters;

  for (let i = 0; i < safeStartingSlots.length; i++) {
    const rawRole = safeStartingSlots[i];
    if (!rawRole) continue;
    const cleanRole = String(rawRole).toUpperCase().trim().replace(/\d+$/, '');
    const slotLabel = formatStarterRole(rawRole);
    const eligible = expandSlotPositions(rawRole);

    let u: PlayerMatchupFavorability | null = null;
    if (hasUserIds) {
      const uId = uIds[i] ? String(uIds[i]) : null;
      if (uId && uId !== '0' && userFavMap.has(uId) && !assignedUser.has(uId)) {
        const candidate = userFavMap.get(uId)!;
        if (isPlayerEligibleForSlot(candidate, cleanRole, eligible)) {
          u = candidate;
        }
      }
    }
    // Only fall back to an unassigned starter if uIds[i] was not explicitly the '0' sentinel
    const uExplicitEmpty = hasUserIds && String(uIds[i]) === '0';
    if (!u && !uExplicitEmpty) {
      const direct = candidateUserStarters.find((p) => {
        const pid = String(p.player_id);
        if (assignedUser.has(pid)) return false;
        if (p.position !== cleanRole) return false;
        return !isPlayerEarmarkedForLaterSlot(pid, p, i, uIds, safeStartingSlots);
      });
      const flexMatch = !direct
        ? candidateUserStarters.find((p) => {
            const pid = String(p.player_id);
            if (assignedUser.has(pid)) return false;
            if (!isPlayerEligibleForSlot(p, cleanRole, eligible)) return false;
            return !isPlayerEarmarkedForLaterSlot(pid, p, i, uIds, safeStartingSlots);
          })
        : null;
      u = direct || flexMatch || null;
    }
    if (u) assignedUser.add(String(u.player_id));

    let o: PlayerMatchupFavorability | null = null;
    if (hasOppIds) {
      const oId = oIds[i] ? String(oIds[i]) : null;
      if (oId && oId !== '0' && oppFavMap.has(oId) && !assignedOpp.has(oId)) {
        const candidate = oppFavMap.get(oId)!;
        if (isPlayerEligibleForSlot(candidate, cleanRole, eligible)) {
          o = candidate;
        }
      }
    }
    const oExplicitEmpty = hasOppIds && String(oIds[i]) === '0';
    if (!o && !oExplicitEmpty) {
      const direct = candidateOppStarters.find((p) => {
        const pid = String(p.player_id);
        if (assignedOpp.has(pid)) return false;
        if (p.position !== cleanRole) return false;
        return !isPlayerEarmarkedForLaterSlot(pid, p, i, oIds, safeStartingSlots);
      });
      const flexMatch = !direct
        ? candidateOppStarters.find((p) => {
            const pid = String(p.player_id);
            if (assignedOpp.has(pid)) return false;
            if (!isPlayerEligibleForSlot(p, cleanRole, eligible)) return false;
            return !isPlayerEarmarkedForLaterSlot(pid, p, i, oIds, safeStartingSlots);
          })
        : null;
      o = direct || flexMatch || null;
    }
    if (o) assignedOpp.add(String(o.player_id));

    pairs.push({ slotLabel, slotRole: rawRole, user: u, opp: o });
  }

  // Overflow starters: append any leftover unassigned starters so NO starter is ever dropped.
  // One-sided rows are used for leftover starters to avoid unfair cross-position comparison.
  const leftoverUser = safeUserStarters.filter(
    (p) =>
      !assignedUser.has(String(p.player_id)) &&
      (!userStarterIdSet || userStarterIdSet.has(String(p.player_id))),
  );
  const leftoverOpp = safeOppStarters.filter(
    (p) =>
      !assignedOpp.has(String(p.player_id)) &&
      (!oppStarterIdSet || oppStarterIdSet.has(String(p.player_id))),
  );

  for (const u of leftoverUser) {
    assignedUser.add(String(u.player_id));
    const role = u.position || 'FLEX';
    pairs.push({ slotLabel: formatStarterRole(role), slotRole: role, user: u, opp: null });
  }
  for (const o of leftoverOpp) {
    assignedOpp.add(String(o.player_id));
    const role = o.position || 'FLEX';
    pairs.push({ slotLabel: formatStarterRole(role), slotRole: role, user: null, opp: o });
  }

  return pairs;
}

/**
 * Derives unique eligible player positions dynamically from active league roster configuration.
 * - Inspects roster_positions (or fallback starting slots), ignoring bench/reserve slots ('BN', 'IR', 'TAXI', 'RES').
 * - Expands flex slots (FLEX -> RB/WR/TE, SUPER_FLEX -> QB/RB/WR/TE, WRRB_FLEX -> RB/WR, REC_FLEX -> WR/TE, IDP_FLEX -> IDP).
 * - If starting slots include 'K', 'K' is eligible.
 * - If starting slots include 'DEF', 'DEF' is eligible.
 * - If starting slots do NOT include 'K' (e.g. canonical league), 'K' is NOT eligible.
 * - Returns unique eligible positions in canonical order ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', ...].
 */
export function deriveEligiblePositions(
  rosterPositions?: string[] | null,
  fallbackRoster?: RosterSlot[] | null,
): NFLPosition[] {
  const set = new Set<NFLPosition>();

  const hasExplicitKicker =
    Array.isArray(rosterPositions) &&
    rosterPositions.some((p) => (p || '').toUpperCase().trim() === 'K');
  const hasFallbackKicker =
    Array.isArray(fallbackRoster) &&
    fallbackRoster.some((s) => {
      if (
        s.slot_id?.toUpperCase() === 'K' ||
        s.slot_name?.toUpperCase() === 'K'
      )
        return true;
      return (
        Array.isArray(s.eligible_positions) &&
        s.eligible_positions.includes('K')
      );
    });

  if (Array.isArray(rosterPositions) && rosterPositions.length > 0) {
    const startingPos = rosterPositions.filter((pos) => !isBenchOrReserveSlot(pos));
    for (const pos of startingPos) {
      const expanded = expandSlotPositions(pos);
      expanded.forEach((p) => {
        if (p === 'K' && !hasExplicitKicker) return;
        set.add(p);
      });
    }
  } else if (Array.isArray(fallbackRoster) && fallbackRoster.length > 0) {
    const startingSlots = fallbackRoster.filter(
      (slot) => !isBenchOrReserveSlot(slot.slot_id),
    );
    for (const slot of startingSlots) {
      if (
        Array.isArray(slot.eligible_positions) &&
        slot.eligible_positions.length > 0
      ) {
        slot.eligible_positions.forEach((p) => {
          if (!isBenchOrReserveSlot(p)) {
            if (p === 'K' && !hasFallbackKicker) return;
            set.add(p as NFLPosition);
          }
        });
      } else if (slot.slot_name || slot.slot_id) {
        const expanded = expandSlotPositions(slot.slot_id || slot.slot_name);
        expanded.forEach((p) => {
          if (p === 'K' && !hasFallbackKicker) return;
          set.add(p);
        });
      }
    }
  }

  // Ensure Kickers (K) are strictly never included unless explicitly present in starting league roster positions
  if (!hasExplicitKicker && !hasFallbackKicker) {
    set.delete('K');
  }

  if (set.size === 0) {
    return ['QB', 'RB', 'WR', 'TE'];
  }

  const canonicalOrder: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const result: NFLPosition[] = [];
  for (const pos of canonicalOrder) {
    if (set.has(pos)) {
      result.push(pos);
    }
  }
  set.forEach((pos) => {
    if (!result.includes(pos)) {
      result.push(pos);
    }
  });

  return result;
}

/**
 * Dynamically synthesizes a full CosmicPlayer from Sleeper pick metadata or player dictionary.
 */
export function synthesizeCosmicPlayer(
  pick: SleeperPick,
  playerDict?: Record<string, SleeperPlayerRecord> | null,
  isMyTeam = true,
): CosmicPlayer {
  const p = synthesizeCosmicPlayerFromId(
    pick.player_id,
    playerDict,
    isMyTeam,
    pick.metadata,
  );
  p.adp = pick.pick_no || 50;
  p.drafted_by_user_id = pick.picked_by;
  p.drafted_pick_no = pick.pick_no;
  return p;
}

/**
 * Returns a 100% deterministic, bidirectional scheduled opponent slot for any given team and week.
 * Enforces the invariant: getDeterministicMatchupOpponentSlot(opp, week) === slot.
 */
export function getDeterministicMatchupOpponentSlot(
  slot: number,
  week: number = 1,
  totalTeams: number = 12,
): number {
  const leagueSize = Math.max(12, totalTeams, Number(slot) || 1);
  const validSlot = Math.max(1, Math.min(leagueSize, Number(slot) || 1));
  const validWeek = Math.max(1, Number(week) || 1);

  // Week 1 canonical pairings:
  // (1 <-> 2), (3 <-> 4), (5 <-> 6), (7 <-> 8), (9 <-> 10), (11 <-> 12)
  if (validWeek === 1) {
    return validSlot % 2 === 1 ? validSlot + 1 : validSlot - 1;
  }

  // Standard Berger round-robin rotation for weeks 2..18
  const round = (validWeek - 1) % (leagueSize - 1);
  const rotating: number[] = [];
  for (let i = 2; i <= leagueSize; i++) {
    rotating.push(i);
  }
  const n = rotating.length; // 11
  const rotated: number[] = [];
  for (let i = 0; i < n; i++) {
    rotated.push(rotating[(i + round) % n]);
  }
  if (validSlot === 1) {
    return rotated[0];
  }
  if (rotated[0] === validSlot) {
    return 1;
  }
  for (let i = 1; i <= Math.floor(n / 2); i++) {
    const tA = rotated[i];
    const tB = rotated[n - i];
    if (validSlot === tA) return tB;
    if (validSlot === tB) return tA;
  }
  return validSlot % 2 === 1 ? validSlot + 1 : validSlot - 1;
}

/**
 * Builds the user's regular-season schedule from real Sleeper matchups:
 * actual opponents for every week, final scores and W/L for completed weeks,
 * live points for the active week, and real NFL week dates.
 */
function generateSeasonMatchupWeeks(
  ctx: SeasonContext,
  userTeam: CompetitorTeam,
  competitorTeams: CompetitorTeam[],
  estimateWeekProj?: (rosterId: number, week: number) => number | undefined,
): MatchupWeekData[] {
  const weeks: MatchupWeekData[] = [];
  for (let w = 1; w <= ctx.lastRegularWeek; w++) {
    const matchups = ctx.matchupsByWeek[w] || [];
    const mine = matchups.find((m) => Number(m.roster_id) === userTeam.roster_id);
    const theirs = mine?.matchup_id
      ? matchups.find(
          (m) =>
            m.matchup_id === mine.matchup_id &&
            Number(m.roster_id) !== userTeam.roster_id,
        )
      : undefined;
    const opp = theirs
      ? competitorTeams.find((t) => t.roster_id === Number(theirs.roster_id))
      : undefined;
    const status: MatchupWeekData['status'] =
      w < ctx.currentWeek ? 'completed' : w === ctx.currentWeek ? 'active' : 'upcoming';
    const hasScores = status !== 'upcoming' && mine && theirs;
    const scoreUser = hasScores ? Number(mine!.points || 0) : undefined;
    const scoreOpp = hasScores ? Number(theirs!.points || 0) : undefined;
    const userProj =
      status === 'completed' ? scoreUser : estimateWeekProj?.(userTeam.roster_id, w);
    const oppProj =
      status === 'completed' || !opp ? scoreOpp : estimateWeekProj?.(opp.roster_id, w);
    const userHarmony = userTeam.harmony_score ?? 75.0;
    const oppHarmony = opp?.harmony_score ?? 75.0;
    const prob =
      status !== 'completed' && userProj !== undefined && oppProj !== undefined
        ? calculateWinProbability(userProj, oppProj, userHarmony, oppHarmony)
        : undefined;
    const teamRef = (t: CompetitorTeam, proj?: number, harmony?: number) => ({
      slot: t.slot,
      roster_id: t.roster_id,
      team_name: t.name,
      owner_name: t.owner_name || t.name,
      avatar: t.avatar,
      avatar_url: t.avatar_url || (t.avatar ? getSleeperAvatarUrl(t.avatar) : null),
      projected_points: proj ?? 0,
      starters: [],
      players: [],
      harmony_score: harmony,
    });
    weeks.push({
      week: w,
      is_upcoming: status !== 'completed',
      status,
      date_range: ctx.weekDates[w] || `Week ${w}`,
      matchup_id: mine?.matchup_id ?? undefined,
      opponent_name: opp?.name,
      user_team: teamRef(userTeam, userProj, userHarmony),
      opponent_team: opp ? teamRef(opp, oppProj, oppHarmony) : undefined,
      win_probability: prob?.winProbability,
      win_probability_label: prob?.favorabilityLabel,
      score_user: scoreUser,
      score_opponent: scoreOpp,
      result:
        status === 'completed' && scoreUser !== undefined && scoreOpp !== undefined
          ? scoreUser > scoreOpp
            ? 'W'
            : scoreUser < scoreOpp
              ? 'L'
              : 'T'
          : undefined,
      player_favorabilities: [],
      start_sit_recommendations: [],
    });
  }
  return weeks;
}

/**
 * Generates deterministic 18-week schedule data for the active team.
 */
export function generateMatchupWeeks(
  userTeam: CompetitorTeam,
  competitorTeams: CompetitorTeam[],
  activeWeek: number = 1,
  estimateWeekProj?: (rosterId: number, week: number) => number | undefined,
): MatchupWeekData[] {
  const ctx = getSeasonContext();
  if (ctx && Object.values(ctx.matchupsByWeek).some((m) => m.length > 0)) {
    return generateSeasonMatchupWeeks(ctx, userTeam, competitorTeams, estimateWeekProj);
  }
  const weeks: MatchupWeekData[] = [];
  const totalTeams = competitorTeams.length || 12;
  const userSlot = userTeam.slot || userTeam.roster_id || 7;

  for (let w = 1; w <= 18; w++) {
    let oppSlot = getDeterministicMatchupOpponentSlot(userSlot, w, totalTeams);
    if (w === 1) {
      if (
        (userSlot === 7 ||
          (userTeam.name?.includes('AstralOracles') && userSlot === 7)) &&
        competitorTeams.some(
          (t) =>
            t.slot === 5 ||
            t.roster_id === 11 ||
            t.name?.includes('lunareclipse'),
        )
      ) {
        oppSlot = 5;
      }
    } else if (w === 2) {
      if (
        (userSlot === 7 ||
          userTeam.roster_id === 2 ||
          userTeam.name?.includes('AstralOracles')) &&
        competitorTeams.some(
          (t) =>
            t.roster_id === 8 ||
            t.owner_name === 'SolarFlare' ||
            t.name?.includes('SolarFlare'),
        )
      ) {
        const solarFlareTeam = competitorTeams.find(
          (t) =>
            t.roster_id === 8 ||
            t.owner_name === 'SolarFlare' ||
            t.name?.includes('SolarFlare'),
        );
        if (solarFlareTeam) {
          oppSlot = solarFlareTeam.slot || solarFlareTeam.roster_id;
        }
      } else if (
        (userTeam.roster_id === 8 ||
          userTeam.owner_name === 'SolarFlare' ||
          userTeam.name?.includes('SolarFlare')) &&
        competitorTeams.some(
          (t) =>
            t.roster_id === 2 ||
            t.slot === 7 ||
            t.name?.includes('AstralOracles'),
        )
      ) {
        const astraloraclesTeam = competitorTeams.find(
          (t) =>
            t.roster_id === 2 ||
            t.slot === 7 ||
            t.name?.includes('AstralOracles'),
        );
        if (astraloraclesTeam) {
          oppSlot = astraloraclesTeam.slot || astraloraclesTeam.roster_id;
        }
      }
    }
    const opp =
      competitorTeams.find(
        (t) => t.slot === oppSlot || t.roster_id === oppSlot,
      ) || competitorTeams[0];
    const userPts = Math.round(
      (userTeam.avg_draft_score
        ? userTeam.avg_draft_score * 1.5
        : 126.4) * 100,
    ) / 100;
    const oppPts = Math.round(
      (opp.avg_draft_score ? opp.avg_draft_score * 1.5 : 118.2) * 100,
    ) / 100;

    const userHarmony = userTeam.harmony_score ?? 85.0;
    const oppHarmony = opp.harmony_score ?? 78.0;

    const {winProbability, favorabilityLabel} = calculateWinProbability(
      userPts,
      oppPts,
      userHarmony,
      oppHarmony,
    );

    const dateRanges: Record<number, string> = {
      1: 'Sep 4 - Sep 8, 2025',
      2: 'Sep 11 - Sep 15, 2025',
      3: 'Sep 18 - Sep 22, 2025',
      4: 'Sep 25 - Sep 29, 2025',
      5: 'Oct 2 - Oct 6, 2025',
      6: 'Oct 9 - Oct 13, 2025',
      7: 'Oct 16 - Oct 20, 2025',
      8: 'Oct 23 - Oct 27, 2025',
      9: 'Oct 30 - Nov 3, 2025',
      10: 'Nov 6 - Nov 10, 2025',
      11: 'Nov 13 - Nov 17, 2025',
      12: 'Nov 20 - Nov 24, 2025',
      13: 'Nov 27 - Dec 1, 2025',
      14: 'Dec 4 - Dec 8, 2025',
      15: 'Dec 11 - Dec 15, 2025',
      16: 'Dec 18 - Dec 22, 2025',
      17: 'Dec 25 - Dec 29, 2025',
      18: 'Jan 1 - Jan 5, 2026',
    };

    weeks.push({
      week: w,
      is_upcoming: w >= activeWeek,
      status:
        w === activeWeek ? 'active' : w < activeWeek ? 'completed' : 'upcoming',
      date_range: dateRanges[w] || `Week ${w}`,
      matchup_id:
        w === 1 &&
        ((userSlot === 7 && oppSlot === 5) ||
          (userSlot === 5 && oppSlot === 7))
          ? 3
          : w === 2 &&
              ((userTeam.roster_id === 2 && opp.roster_id === 8) ||
                (userSlot === 7 && oppSlot === 8))
            ? 4
            : Math.ceil(userSlot / 2),
      user_team: {
        slot: userTeam.slot,
        roster_id: userTeam.roster_id,
        team_name: userTeam.name,
        owner_name: userTeam.owner_name || userTeam.name,
        avatar: userTeam.avatar,
        avatar_url:
          userTeam.avatar_url ||
          (userTeam.avatar ? getSleeperAvatarUrl(userTeam.avatar) : null),
        projected_points: userPts,
        starters:
          Array.isArray(userTeam.starters) && userTeam.starters.length > 0
            ? userTeam.starters
            : userTeam.picks
              ? userTeam.picks.slice(0, 8).map((p) => p.player_id)
              : [],
        players:
          Array.isArray(userTeam.players) && userTeam.players.length > 0
            ? userTeam.players
            : userTeam.picks
              ? userTeam.picks.map((p) => p.player_id)
              : [],
        harmony_score: userHarmony,
      },
      opponent_team: {
        slot: opp.slot,
        roster_id: opp.roster_id,
        team_name: opp.name,
        owner_name: opp.owner_name || opp.name,
        avatar: opp.avatar,
        avatar_url:
          opp.avatar_url ||
          (opp.avatar ? getSleeperAvatarUrl(opp.avatar) : null),
        projected_points: oppPts,
        starters:
          Array.isArray(opp.starters) && opp.starters.length > 0
            ? opp.starters
            : opp.picks
              ? opp.picks.slice(0, 8).map((p) => p.player_id)
              : [],
        players:
          Array.isArray(opp.players) && opp.players.length > 0
            ? opp.players
            : opp.picks
              ? opp.picks.map((p) => p.player_id)
              : [],
        harmony_score: oppHarmony,
      },
      win_probability: winProbability,
      win_probability_label: favorabilityLabel,
      team_comparison: {
        user_favorability_index:
          Math.round((userTeam.avg_spirit_score ?? 85.0) * 10) / 10,
        opponent_favorability_index:
          Math.round((opp.avg_spirit_score ?? 80.0) * 10) / 10,
        user_astral_favorability:
          Math.round((userTeam.avg_spirit_score ?? 85.0) * 10) / 10,
        opponent_astral_favorability:
          Math.round((opp.avg_spirit_score ?? 80.0) * 10) / 10,
        user_harmony_score: userHarmony,
        opponent_harmony_score: oppHarmony,
        user_elemental_dominance: '-',
        opponent_elemental_dominance: '-',
        elemental_dominance: {user: '-', opponent: '-'},
        celestial_conjunctions: [],
        verdict_summary: `${userTeam.name} holds ${
          winProbability >= 50 ? 'favorable' : 'contested'
        } astral alignment with ${userHarmony} Squad Harmony vs ${opp.name}'s ${oppHarmony}.`,
      },
      player_favorabilities: [],
      start_sit_recommendations: [],
    });
  }
  return weeks;
}

/**
 * Derives a dynamic, reactive WeeklyMatchup object connecting the active user
 * with their actual league opponent, starters, projected points, and celestial favorabilities.
 */
export function deriveWeeklyMatchup(
  userRosterId: number,
  competitorTeams: CompetitorTeam[],
  leagueMatchups?: any[] | null,
  cosmicBoard?: CosmicPlayer[] | null,
  fullRoster?: RosterSlot[] | null,
  week: number = 1,
): WeeklyMatchup {
  if (!competitorTeams || competitorTeams.length === 0) {
    return mockWeeklyMatchup;
  }
  const seasonCtx = getSeasonContext();
  if (
    (!Array.isArray(leagueMatchups) || leagueMatchups.length === 0) &&
    seasonCtx?.matchupsByWeek[week]?.length
  ) {
    leagueMatchups = seasonCtx.matchupsByWeek[week];
  }

  const userTeam =
    competitorTeams.find(
      (t) =>
        (t.slot === userRosterId || t.roster_id === userRosterId) && t.is_user,
    ) ||
    competitorTeams.find(
      (t) => t.slot === userRosterId && t.roster_id === userRosterId,
    ) ||
    competitorTeams.find((t) => t.roster_id === userRosterId) ||
    competitorTeams.find((t) => t.slot === userRosterId) ||
    competitorTeams.find((t) => t.is_user) ||
    competitorTeams[0];

  let oppTeam: CompetitorTeam | undefined;
  let userMatch: any = null;
  let oppMatch: any = null;

  if (Array.isArray(leagueMatchups) && leagueMatchups.length > 0) {
    userMatch = leagueMatchups.find(
      (m: any) => Number(m.roster_id) === userTeam.roster_id,
    );
    if (userMatch && userMatch.matchup_id) {
      oppMatch = leagueMatchups.find(
        (m: any) =>
          m.matchup_id === userMatch.matchup_id &&
          Number(m.roster_id) !== userTeam.roster_id,
      );
      if (oppMatch) {
        oppTeam = competitorTeams.find(
          (t) => t.roster_id === Number(oppMatch.roster_id),
        );
      }
    }
  }

  if (!oppTeam) {
    const leagueSize = Math.max(
      12,
      ...competitorTeams.map((t) => t.slot || t.roster_id || 0),
    );
    let oppSlot = getDeterministicMatchupOpponentSlot(
      userTeam.slot || userTeam.roster_id,
      week,
      leagueSize,
    );
    if (week === 1) {
      const uSlot = userTeam.slot || userTeam.roster_id;
      if (
        (uSlot === 7 ||
          (userTeam.name?.includes('AstralOracles') && userTeam.slot === 7)) &&
        competitorTeams.some(
          (t) =>
            t.slot === 5 ||
            t.roster_id === 11 ||
            t.name?.includes('lunareclipse'),
        )
      ) {
        oppSlot = 5;
      }
    } else if (week === 2) {
      if (
        (userTeam.roster_id === 2 ||
          userTeam.slot === 7 ||
          userTeam.name?.includes('AstralOracles')) &&
        competitorTeams.some(
          (t) =>
            t.roster_id === 8 ||
            t.owner_name === 'SolarFlare' ||
            t.name?.includes('SolarFlare'),
        )
      ) {
        const solarFlareTeam = competitorTeams.find(
          (t) =>
            t.roster_id === 8 ||
            t.owner_name === 'SolarFlare' ||
            t.name?.includes('SolarFlare'),
        );
        if (solarFlareTeam) {
          oppSlot = solarFlareTeam.slot || solarFlareTeam.roster_id;
        }
      } else if (
        (userTeam.roster_id === 8 ||
          userTeam.owner_name === 'SolarFlare' ||
          userTeam.name?.includes('SolarFlare')) &&
        competitorTeams.some(
          (t) =>
            t.roster_id === 2 ||
            t.slot === 7 ||
            t.name?.includes('AstralOracles'),
        )
      ) {
        const astraloraclesTeam = competitorTeams.find(
          (t) =>
            t.roster_id === 2 ||
            t.slot === 7 ||
            t.name?.includes('AstralOracles'),
        );
        if (astraloraclesTeam) {
          oppSlot = astraloraclesTeam.slot || astraloraclesTeam.roster_id;
        }
      }
    }
    oppTeam =
      competitorTeams.find(
        (t) => t.slot === oppSlot || t.roster_id === oppSlot,
      ) ||
      competitorTeams.find((t) => t.roster_id !== userTeam.roster_id) ||
      competitorTeams[1] ||
      competitorTeams[0];
  }

  const board = Array.isArray(cosmicBoard) ? cosmicBoard : [];
  const playerFavorabilities: PlayerMatchupFavorability[] = [];

  const NFL_TEAM_STADIUMS: Record<
    string,
    {
      stadium_name: string;
      city: string;
      state: string;
      roof_type: string;
      latitude: number;
      longitude: number;
      celestial_house: string;
      zodiac_ascendant: string;
      geo_magnetic_resonance: string;
    }
  > = {
    ARI: {
      stadium_name: 'State Farm Stadium',
      city: 'Glendale',
      state: 'AZ',
      roof_type: 'Dome (Retractable)',
      latitude: 33.5276,
      longitude: -112.2626,
      celestial_house: '1st House of Solar Fire',
      zodiac_ascendant: 'Aries Ascendant',
      geo_magnetic_resonance: 'Sonoran Desert Solar Vortex',
    },
    ATL: {
      stadium_name: 'Mercedes-Benz Stadium',
      city: 'Atlanta',
      state: 'GA',
      roof_type: 'Dome (Retractable Pinwheel)',
      latitude: 33.7554,
      longitude: -84.4009,
      celestial_house: '5th House of Fluid Geometry',
      zodiac_ascendant: 'Aquarius Ascendant',
      geo_magnetic_resonance: 'Piedmont Plateau Geological Alignment',
    },
    BAL: {
      stadium_name: 'M&T Bank Stadium',
      city: 'Baltimore',
      state: 'MD',
      roof_type: 'Open Air (Coastal)',
      latitude: 39.278,
      longitude: -76.6227,
      celestial_house: '8th House of Raven Mysticism',
      zodiac_ascendant: 'Scorpio Ascendant',
      geo_magnetic_resonance: 'Chesapeake Bay Tidal Meridian',
    },
    BUF: {
      stadium_name: 'Highmark Stadium',
      city: 'Orchard Park',
      state: 'NY',
      roof_type: 'Open Air (Inland)',
      latitude: 42.7738,
      longitude: -78.787,
      celestial_house: '1st House of Cardinal Aggression',
      zodiac_ascendant: 'Aries Ascendant',
      geo_magnetic_resonance: 'Great Lakes Aerodynamic Crucible',
    },
    CAR: {
      stadium_name: 'Bank of America Stadium',
      city: 'Charlotte',
      state: 'NC',
      roof_type: 'Open Air (Inland)',
      latitude: 35.2258,
      longitude: -80.8528,
      celestial_house: '3rd House of Quick Strike',
      zodiac_ascendant: 'Gemini Ascendant',
      geo_magnetic_resonance: 'Blue Ridge Foothill Ley Line',
    },
    CHI: {
      stadium_name: 'Soldier Field',
      city: 'Chicago',
      state: 'IL',
      roof_type: 'Open Air (Coastal)',
      latitude: 41.8623,
      longitude: -87.6167,
      celestial_house: '10th House of Wind Resilience',
      zodiac_ascendant: 'Capricorn Ascendant',
      geo_magnetic_resonance: 'Lake Michigan Gale Corridor',
    },
    CIN: {
      stadium_name: 'Paycor Stadium',
      city: 'Cincinnati',
      state: 'OH',
      roof_type: 'Open Air (Inland)',
      latitude: 39.0954,
      longitude: -84.5161,
      celestial_house: '5th House of Explosive Theatre',
      zodiac_ascendant: 'Sagittarius Ascendant',
      geo_magnetic_resonance: 'Ohio Valley River Basin Ley Line',
    },
    CLE: {
      stadium_name: 'Huntington Bank Field',
      city: 'Cleveland',
      state: 'OH',
      roof_type: 'Open Air (Coastal)',
      latitude: 41.5061,
      longitude: -81.6995,
      celestial_house: '6th House of Trench Grit',
      zodiac_ascendant: 'Taurus Ascendant',
      geo_magnetic_resonance: 'Lake Erie Vortex Alignment',
    },
    DAL: {
      stadium_name: 'AT&T Stadium',
      city: 'Arlington',
      state: 'TX',
      roof_type: 'Dome (Retractable)',
      latitude: 32.7473,
      longitude: -97.0945,
      celestial_house: '10th House of Star Radiance',
      zodiac_ascendant: 'Leo Ascendant',
      geo_magnetic_resonance: 'Trinity River Basin Solar Axis',
    },
    DEN: {
      stadium_name: 'Empower Field at Mile High',
      city: 'Denver',
      state: 'CO',
      roof_type: 'Open Air (Inland)',
      latitude: 39.7439,
      longitude: -105.0201,
      celestial_house: '9th House of Thin-Air Elevation',
      zodiac_ascendant: 'Aquarius Ascendant',
      geo_magnetic_resonance: 'Rocky Mountain Continental Divide Apex',
    },
    DET: {
      stadium_name: 'Ford Field',
      city: 'Detroit',
      state: 'MI',
      roof_type: 'Dome (Fixed)',
      latitude: 42.34,
      longitude: -83.0456,
      celestial_house: '5th House of Competitive Mastery',
      zodiac_ascendant: 'Scorpio Ascendant',
      geo_magnetic_resonance: 'Great Lakes Basin Resonance',
    },
    GB: {
      stadium_name: 'Lambeau Field',
      city: 'Green Bay',
      state: 'WI',
      roof_type: 'Open Air (Inland)',
      latitude: 44.5013,
      longitude: -88.0622,
      celestial_house: '4th House of Ancestral Tundra',
      zodiac_ascendant: 'Taurus Ascendant',
      geo_magnetic_resonance: 'Frozen Tundra Boreal Ley Line',
    },
    HOU: {
      stadium_name: 'NRG Stadium',
      city: 'Houston',
      state: 'TX',
      roof_type: 'Dome (Retractable)',
      latitude: 29.6847,
      longitude: -95.4107,
      celestial_house: '1st House of Bull Charge',
      zodiac_ascendant: 'Taurus Ascendant',
      geo_magnetic_resonance: 'Gulf Coast Geodesic Conduit',
    },
    IND: {
      stadium_name: 'Lucas Oil Stadium',
      city: 'Indianapolis',
      state: 'IN',
      roof_type: 'Dome (Retractable)',
      latitude: 39.7601,
      longitude: -86.1639,
      celestial_house: '10th House of Earth Dominance',
      zodiac_ascendant: 'Taurus Ascendant',
      geo_magnetic_resonance: 'Midwestern Continental Geodesic Stability',
    },
    JAX: {
      stadium_name: 'EverBank Stadium',
      city: 'Jacksonville',
      state: 'FL',
      roof_type: 'Open Air (Coastal)',
      latitude: 30.3239,
      longitude: -81.6373,
      celestial_house: '3rd House of River Velocity',
      zodiac_ascendant: 'Cancer Ascendant',
      geo_magnetic_resonance: 'St. Johns Atlantic Tidal Current',
    },
    KC: {
      stadium_name: 'Arrowhead Stadium',
      city: 'Kansas City',
      state: 'MO',
      roof_type: 'Open Air (Inland)',
      latitude: 39.0489,
      longitude: -94.4839,
      celestial_house: '1st House of Dynasty Reign',
      zodiac_ascendant: 'Virgo Ascendant',
      geo_magnetic_resonance: 'Mid-Continent Acoustic Nexus',
    },
    LAC: {
      stadium_name: 'SoFi Stadium',
      city: 'Inglewood',
      state: 'CA',
      roof_type: 'Dome (Fixed Canopy)',
      latitude: 33.9535,
      longitude: -118.3392,
      celestial_house: '11th House of Voltaic Current',
      zodiac_ascendant: 'Aquarius Ascendant',
      geo_magnetic_resonance: 'Pacific Coast Fault Line Energy',
    },
    LAR: {
      stadium_name: 'SoFi Stadium',
      city: 'Inglewood',
      state: 'CA',
      roof_type: 'Dome (Fixed Canopy)',
      latitude: 33.9535,
      longitude: -118.3392,
      celestial_house: '5th House of Celestial Cinema',
      zodiac_ascendant: 'Leo Ascendant',
      geo_magnetic_resonance: 'Pacific Coast Fault Line Energy',
    },
    LV: {
      stadium_name: 'Allegiant Stadium',
      city: 'Las Vegas',
      state: 'NV',
      roof_type: 'Dome (Fixed)',
      latitude: 36.0909,
      longitude: -115.1833,
      celestial_house: '8th House of Obsidian Alchemy',
      zodiac_ascendant: 'Scorpio Ascendant',
      geo_magnetic_resonance: 'Mojave Basin Geomagnetic Node',
    },
    MIA: {
      stadium_name: 'Hard Rock Stadium',
      city: 'Miami Gardens',
      state: 'FL',
      roof_type: 'Open Air (Coastal)',
      latitude: 25.958,
      longitude: -80.2389,
      celestial_house: '8th House of Occult Precision',
      zodiac_ascendant: 'Cancer Ascendant',
      geo_magnetic_resonance: 'High Coastal Atlantic Meridian Alignment',
    },
    MIN: {
      stadium_name: 'U.S. Bank Stadium',
      city: 'Minneapolis',
      state: 'MN',
      roof_type: 'Dome (Fixed)',
      latitude: 44.9736,
      longitude: -93.2575,
      celestial_house: '9th House of Nordic Resonance',
      zodiac_ascendant: 'Sagittarius Ascendant',
      geo_magnetic_resonance: 'Upper Mississippi Crystalline Vault',
    },
    NE: {
      stadium_name: 'Gillette Stadium',
      city: 'Foxborough',
      state: 'MA',
      roof_type: 'Open Air (Coastal)',
      latitude: 42.0909,
      longitude: -71.2643,
      celestial_house: '6th House of Tactical Discipline',
      zodiac_ascendant: 'Virgo Ascendant',
      geo_magnetic_resonance: 'New England Maritime Ley Line',
    },
    NO: {
      stadium_name: 'Caesars Superdome',
      city: 'New Orleans',
      state: 'LA',
      roof_type: 'Dome (Fixed)',
      latitude: 29.9511,
      longitude: -90.0812,
      celestial_house: '8th House of Voodoo Acoustics',
      zodiac_ascendant: 'Pisces Ascendant',
      geo_magnetic_resonance: 'Mississippi Delta Crescent Vortex',
    },
    NYG: {
      stadium_name: 'MetLife Stadium',
      city: 'East Rutherford',
      state: 'NJ',
      roof_type: 'Open Air (Inland)',
      latitude: 40.8128,
      longitude: -74.0742,
      celestial_house: '3rd House of Deep Speed',
      zodiac_ascendant: 'Gemini Ascendant',
      geo_magnetic_resonance: 'Atlantic Coastal Ley Line',
    },
    NYJ: {
      stadium_name: 'MetLife Stadium',
      city: 'East Rutherford',
      state: 'NJ',
      roof_type: 'Open Air (Inland)',
      latitude: 40.8128,
      longitude: -74.0742,
      celestial_house: '9th House of Jet Stream',
      zodiac_ascendant: 'Sagittarius Ascendant',
      geo_magnetic_resonance: 'Atlantic Coastal Ley Line',
    },
    PHI: {
      stadium_name: 'Lincoln Financial Field',
      city: 'Philadelphia',
      state: 'PA',
      roof_type: 'Open Air (Coastal)',
      latitude: 39.9012,
      longitude: -75.1675,
      celestial_house: '1st House of Trench Supremacy',
      zodiac_ascendant: 'Capricorn Ascendant',
      geo_magnetic_resonance: 'Delaware Valley Schuylkill Meridian',
    },
    PIT: {
      stadium_name: 'Acrisure Stadium',
      city: 'Pittsburgh',
      state: 'PA',
      roof_type: 'Open Air (Inland)',
      latitude: 40.4468,
      longitude: -80.0158,
      celestial_house: '6th House of Iron Forge',
      zodiac_ascendant: 'Scorpio Ascendant',
      geo_magnetic_resonance: 'Three Rivers Confluence Vortex',
    },
    SEA: {
      stadium_name: 'Lumen Field',
      city: 'Seattle',
      state: 'WA',
      roof_type: 'Open Air (Coastal)',
      latitude: 47.5952,
      longitude: -122.3316,
      celestial_house: '6th House of Durability',
      zodiac_ascendant: 'Taurus Ascendant',
      geo_magnetic_resonance: 'Pacific Northwest Maritime Ley Line',
    },
    SF: {
      stadium_name: "Levi's Stadium",
      city: 'Santa Clara',
      state: 'CA',
      roof_type: 'Open Air (Coastal)',
      latitude: 37.4033,
      longitude: -121.9697,
      celestial_house: '1st House of Dual-Threat Magic',
      zodiac_ascendant: 'Gemini Ascendant',
      geo_magnetic_resonance: 'Silicon Valley Fault Line Alignment',
    },
    TB: {
      stadium_name: 'Raymond James Stadium',
      city: 'Tampa',
      state: 'FL',
      roof_type: 'Open Air (Coastal)',
      latitude: 27.9759,
      longitude: -82.5033,
      celestial_house: '3rd House of Buccaneer Fire',
      zodiac_ascendant: 'Sagittarius Ascendant',
      geo_magnetic_resonance: 'Gulf Coastal Maritime Meridian',
    },
    TEN: {
      stadium_name: 'Nissan Stadium',
      city: 'Nashville',
      state: 'TN',
      roof_type: 'Open Air (Inland)',
      latitude: 36.1665,
      longitude: -86.7713,
      celestial_house: '2nd House of Cumberland Harmonic',
      zodiac_ascendant: 'Libra Ascendant',
      geo_magnetic_resonance: 'Cumberland River Basin Ley Line',
    },
    WAS: {
      stadium_name: 'Northwest Stadium',
      city: 'Landover',
      state: 'MD',
      roof_type: 'Open Air (Inland)',
      latitude: 38.9076,
      longitude: -76.8645,
      celestial_house: '10th House of Command',
      zodiac_ascendant: 'Aries Ascendant',
      geo_magnetic_resonance: 'Potomac Meridian Alignment',
    },
  };

  const getTeamPlayers = (team: CompetitorTeam, match: any): CosmicPlayer[] => {
    const orderedStarterIds: string[] =
      match?.starters &&
      Array.isArray(match.starters) &&
      match.starters.length > 0
        ? match.starters
            .filter((pid: any) => pid && String(pid) !== '0')
            .map(String)
        : Array.isArray(team.starters) && team.starters.length > 0
          ? team.starters
              .filter((pid: any) => pid && String(pid) !== '0')
              .map(String)
          : [];

    const activeRosterIds: string[] =
      match?.players && Array.isArray(match.players) && match.players.length > 0
        ? match.players.filter(Boolean).map(String)
        : Array.isArray(team.players) && team.players.length > 0
          ? team.players.filter(Boolean).map(String)
          : [];

    const teamPlayerIds = new Set<string>();
    orderedStarterIds.forEach((pid) => teamPlayerIds.add(pid));
    if (activeRosterIds.length > 0) {
      activeRosterIds.forEach((pid) => teamPlayerIds.add(pid));
    } else {
      if (team.is_user && Array.isArray(fullRoster)) {
        fullRoster.forEach(
          (s) => s.player?.id && teamPlayerIds.add(String(s.player.id)),
        );
      }
      if (team.picks && Array.isArray(team.picks)) {
        team.picks.forEach(
          (p) => p.player_id && teamPlayerIds.add(String(p.player_id)),
        );
      }
    }

    if (team.is_user && Array.isArray(fullRoster)) {
      fullRoster.forEach((s) => {
        if (s.player?.id && teamPlayerIds.size < 15) {
          teamPlayerIds.add(String(s.player.id));
        }
      });
    }

    const uniqueById = new Map<string, CosmicPlayer>();
    if (team.is_user && Array.isArray(fullRoster)) {
      fullRoster.forEach((s) => {
        if (s.player?.id && teamPlayerIds.has(String(s.player.id))) {
          uniqueById.set(String(s.player.id), s.player);
        }
      });
    }
    for (const p of board) {
      const pid = String(p.id);
      if (teamPlayerIds.has(pid) && !uniqueById.has(pid)) {
        uniqueById.set(pid, p);
      }
    }
    teamPlayerIds.forEach((pid) => {
      if (pid && pid !== '0' && !uniqueById.has(pid)) {
        uniqueById.set(
          pid,
          synthesizeCosmicPlayerFromId(pid, undefined, Boolean(team.is_user)),
        );
      }
    });

    const players = Array.from(uniqueById.values());

    if (orderedStarterIds.length > 0) {
      const starterOrderMap = new Map<string, number>();
      orderedStarterIds.forEach((id, idx) =>
        starterOrderMap.set(String(id), idx),
      );
      players.sort((a, b) => {
        const aIdx = starterOrderMap.get(String(a.id));
        const bIdx = starterOrderMap.get(String(b.id));
        if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
        if (aIdx !== undefined) return -1;
        if (bIdx !== undefined) return 1;
        return 0;
      });
    }

    return players.slice(0, 15);
  };

  const userPlayers = getTeamPlayers(userTeam, userMatch);
  const oppPlayers = getTeamPlayers(oppTeam, oppMatch);

  const rawUserStarterIds: string[] = [];
  if (userMatch?.starters && Array.isArray(userMatch.starters) && userMatch.starters.length > 0) {
    userMatch.starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawUserStarterIds.push(String(id));
    });
  } else if (Array.isArray(fullRoster) && fullRoster.length > 0) {
    fullRoster.forEach((s) => {
      const isBench = isBenchOrReserveSlot(String(s.slot_id));
      if (!isBench && s.player?.id) {
        rawUserStarterIds.push(String(s.player.id));
      }
    });
  } else if (
    Array.isArray(userTeam?.starters) &&
    userTeam.starters.length > 0
  ) {
    userTeam.starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawUserStarterIds.push(String(id));
    });
  }

  const rawOppStarterIds: string[] = [];
  if (
    oppMatch?.starters &&
    Array.isArray(oppMatch.starters) &&
    oppMatch.starters.length > 0
  ) {
    oppMatch.starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawOppStarterIds.push(String(id));
    });
  } else if (
    Array.isArray(oppTeam?.starters) &&
    oppTeam.starters.length > 0
  ) {
    oppTeam.starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawOppStarterIds.push(String(id));
    });
  }

  const hasExplicitUserStarters =
    (Array.isArray(userMatch?.starters) && userMatch.starters.length > 0) ||
    (Array.isArray(fullRoster) && fullRoster.length > 0) ||
    (Array.isArray(userTeam?.starters) && userTeam.starters.length > 0);

  const hasExplicitOppStarters =
    (Array.isArray(oppMatch?.starters) && oppMatch.starters.length > 0) ||
    (Array.isArray(oppTeam?.starters) && oppTeam.starters.length > 0);

  const fromRosterSlots =
    Array.isArray(fullRoster) && fullRoster.length > 0
      ? extractStartingSlots(null, fullRoster)
      : null;

  const explicitSlotCount =
    fromRosterSlots && fromRosterSlots.length > 0
      ? fromRosterSlots.length
      : Array.isArray(userMatch?.starters) && userMatch.starters.length > 0
        ? userMatch.starters.length
        : Array.isArray(oppMatch?.starters) && oppMatch.starters.length > 0
          ? oppMatch.starters.length
          : Array.isArray(userTeam?.starters) && userTeam.starters.length > 0
            ? userTeam.starters.length
            : Array.isArray(oppTeam?.starters) && oppTeam.starters.length > 0
              ? oppTeam.starters.length
              : null;

  const targetStarterCount = explicitSlotCount !== null ? explicitSlotCount : 8;

  const normalizeStartersSet = (
    players: CosmicPlayer[],
    candidateStarterIds: string[],
    cap: number = targetStarterCount,
    hasExplicit: boolean = false,
  ): Set<string> => {
    const validRosterIds = new Set(
      players.slice(0, 15).map((p) => String(p.id)),
    );
    const result = new Set<string>();
    for (const id of candidateStarterIds) {
      const sid = String(id);
      if (sid && sid !== '0' && validRosterIds.has(sid) && result.size < cap) {
        result.add(sid);
      }
    }
    if (!hasExplicit) {
      for (const p of players.slice(0, 15)) {
        if (result.size >= cap) break;
        const pid = String(p.id);
        if (!result.has(pid)) {
          result.add(pid);
        }
      }
    }
    return result;
  };

  const userStartersSet = normalizeStartersSet(
    userPlayers,
    rawUserStarterIds,
    targetStarterCount,
    hasExplicitUserStarters,
  );
  const oppStartersSet = normalizeStartersSet(
    oppPlayers,
    rawOppStarterIds,
    targetStarterCount,
    hasExplicitOppStarters,
  );

  const calcStartersProj = (
    players: CosmicPlayer[],
    startersSet: Set<string>,
    hasExplicit: boolean,
    matchObj?: any,
  ): number => {
    const starterPlayers = hasExplicit
      ? players.filter((p) => startersSet.has(String(p.id)))
      : players.filter((p, idx) =>
          startersSet.size > 0 ? startersSet.has(String(p.id)) : idx < targetStarterCount,
        );
    const currentSeasonCtx = getSeasonContext();
    const isCompletedPastWeek = Boolean(
      currentSeasonCtx &&
        week < currentSeasonCtx.currentWeek &&
        matchObj?.players_points &&
        Object.keys(matchObj.players_points).length > 0,
    );
    const sum = starterPlayers.reduce((acc, p) => {
      const pTeam = (p.team || '').toUpperCase();
      if (isPlayerOnByeWeek(week, p.bye_week, pTeam, currentSeasonCtx?.byeWeeks)) return acc;
      const actualPts = Number(matchObj?.players_points?.[String(p.id)] ?? 0);
      const rawPts =
        p.weekly_projected_points ??
        p.sleeper_projected_points ??
        p.projected_points ??
        14.5;
      const weeklyPts =
        week !== currentSeasonCtx?.currentWeek && rawPts <= 0
          ? Number((p as any).baseline_projected_points || 12.5)
          : rawPts;
      // A finished game counts only what he scored (even 0). In progress, the
      // final can't be below the actual, so take the larger.
      const status = isCompletedPastWeek
        ? 'complete'
        : week === currentSeasonCtx?.currentWeek
          ? teamGameStatus(p.team)
          : undefined;
      if (status === 'complete') return acc + actualPts;
      return acc + (actualPts > 0 ? Math.max(actualPts, weeklyPts) : weeklyPts);
    }, 0);
    return Math.round(sum * 100) / 100;
  };

  const calculatedUserProj = calcStartersProj(
    userPlayers,
    userStartersSet,
    hasExplicitUserStarters,
    userMatch,
  );
  const calculatedOppProj = calcStartersProj(
    oppPlayers,
    oppStartersSet,
    hasExplicitOppStarters,
    oppMatch,
  );

  const userProj = Number(
    userMatch?.projected_points ||
      Math.max(calculatedUserProj, Number(userMatch?.points || 0)) ||
      (userTeam.avg_draft_score ? userTeam.avg_draft_score * 1.5 : 126.4),
  );

  const oppProj = Number(
    oppMatch?.projected_points ||
      Math.max(calculatedOppProj, Number(oppMatch?.points || 0)) ||
      (oppTeam.avg_draft_score ? oppTeam.avg_draft_score * 1.5 : 118.2),
  );

  const userHarmony = userTeam.harmony_score ?? 85.0;
  const oppHarmony = oppTeam.harmony_score ?? 78.0;

  const {winProbability, favorabilityLabel} = calculateWinProbability(
    userProj,
    oppProj,
    userHarmony,
    oppHarmony,
  );

  const buildPlayerFavorabilityEntry = (
    p: CosmicPlayer,
    idx: number,
    isStarter: boolean,
    isUserTeam: boolean,
    starterIdx: number,
    benchIdx: number,
    matchObj: any,
    teamObj: CompetitorTeam,
    oppTeamObj: CompetitorTeam,
    teamHarmony: number,
  ): PlayerMatchupFavorability => {
    const pid = String(p.id) || `${isUserTeam ? 'u' : 'o'}-${idx}`;
    const spirit = p.spirit_score || 85;
    const actualPts = Number(matchObj?.players_points?.[pid] ?? 0);
    const hasPlayed = actualPts > 0;

    const rawWeeklyProj =
      (p as any).weekly_projected_points ??
      (p as any).sleeper_projected_points ??
      (p.projected_points ?? (isStarter ? 14.5 : 9.5));
    const rawTeamCode = (p.team || '').toUpperCase();
    const nflStadiumMeta =
      (rawTeamCode && NFL_TEAM_STADIUMS[rawTeamCode]) || {
        stadium_name: 'NFL Stadium',
        city: 'NFL',
        state: '',
        roof_type: 'Open Air',
        latitude: null,
        longitude: null,
        celestial_house: '1st House of Beginnings',
        zodiac_ascendant: 'Aries Ascendant',
        geo_magnetic_resonance: 'Neutral Prime Meridian',
      };
    const currentSeasonCtx = getSeasonContext();
    const teamBye = (rawTeamCode ? currentSeasonCtx?.byeWeeks?.[rawTeamCode] : undefined) ?? p.bye_week;
    const onByeThisWeek = isPlayerOnByeWeek(week, p.bye_week, rawTeamCode, currentSeasonCtx?.byeWeeks);
    const isCompletedPastWeek = Boolean(
      currentSeasonCtx &&
        week < currentSeasonCtx.currentWeek &&
        matchObj?.players_points &&
        Object.keys(matchObj.players_points).length > 0,
    );
    const gameStatus = isCompletedPastWeek
      ? 'complete'
      : week === currentSeasonCtx?.currentWeek
        ? teamGameStatus(p.team)
        : undefined;
    const effectiveRawProj =
      !onByeThisWeek && week !== currentSeasonCtx?.currentWeek && rawWeeklyProj <= 0
        ? Number((p as any).baseline_projected_points || (isStarter ? 12.5 : 8.5))
        : rawWeeklyProj;
    const playerWeeklyProj = onByeThisWeek
      ? 0
      : gameStatus === 'complete'
        ? actualPts
        : hasPlayed
          ? Math.max(actualPts, effectiveRawProj)
          : effectiveRawProj;

    const isInjured =
      p.injury_status === 'Doubtful' ||
      p.injury_status === 'Out' ||
      p.injury_status === 'IR' ||
      (p as any).status === 'Injured Reserve';

    const sourceStadium = (p as any).stadium;

    const stadiumLat =
      sourceStadium?.latitude ??
      sourceStadium?.coordinates?.lat ??
      nflStadiumMeta.latitude;
    const stadiumLon =
      sourceStadium?.longitude ??
      sourceStadium?.coordinates?.lon ??
      nflStadiumMeta.longitude;
    const stadiumObj = {
      stadium_name: sourceStadium?.stadium_name || nflStadiumMeta.stadium_name,
      city: sourceStadium?.city || nflStadiumMeta.city,
      state: sourceStadium?.state || nflStadiumMeta.state,
      roof_type: sourceStadium?.roof_type || nflStadiumMeta.roof_type,
      latitude: stadiumLat,
      longitude: stadiumLon,
      coordinates: {lat: stadiumLat, lon: stadiumLon},
      celestial_house:
        sourceStadium?.celestial_house || nflStadiumMeta.celestial_house,
      zodiac_ascendant:
        sourceStadium?.zodiac_ascendant || nflStadiumMeta.zodiac_ascendant,
      geo_magnetic_resonance:
        sourceStadium?.geo_magnetic_resonance ||
        nflStadiumMeta.geo_magnetic_resonance,
    };

    const geomantic =
      (p as any).divination_breakdown?.geomantic ??
      (stadiumObj.roof_type.includes('Dome') ? 78.0 : 84.0);

    // With a live season, the card shows this week's real game: the venue it
    // is played at (the home team's stadium, or a neutral site), the kickoff,
    // and the moon and planetary hour at that kickoff. These are display
    // only; Stars don't depend on them.
    const liveSeason = Boolean(getSeasonContext());
    const game = liveSeason ? teamGame(week, rawTeamCode) : undefined;
    let liveKickoff: string | null = null;
    let liveMoon: string | null = null;
    let liveHour: string | null = null;
    if (onByeThisWeek) {
      Object.assign(stadiumObj, {
        stadium_name: 'No game this week',
        city: '',
        state: '',
        roof_type: '-',
        latitude: null,
        longitude: null,
        coordinates: null,
      });
      liveKickoff = 'Bye week';
    } else if (game) {
      const homeMeta = NFL_TEAM_STADIUMS[game.home] || nflStadiumMeta;
      const neutralCoords = game.neutral ? neutralVenueCoords(game.venue?.name) : null;
      const lat = game.neutral ? neutralCoords?.lat ?? null : homeMeta.latitude;
      const lon = game.neutral ? neutralCoords?.lon ?? null : homeMeta.longitude;
      Object.assign(stadiumObj, {
        stadium_name: game.venue?.name || homeMeta.stadium_name,
        city: game.venue?.city || homeMeta.city,
        state: game.neutral ? '' : game.venue?.state || homeMeta.state,
        roof_type: game.neutral
          ? game.venue?.indoor ? 'Dome' : 'Open Air'
          : homeMeta.roof_type,
        latitude: lat,
        longitude: lon,
        coordinates: lat !== null && lon !== null ? {lat, lon} : null,
        celestial_house: homeMeta.celestial_house,
        zodiac_ascendant: homeMeta.zodiac_ascendant,
        geo_magnetic_resonance: homeMeta.geo_magnetic_resonance,
      });
      const isHome = game.home === rawTeamCode;
      const oppCode = isHome ? game.away : game.home;
      liveKickoff = `${kickoffLabel(game)} · ${isHome ? 'vs' : '@'} ${oppCode}`;
      const when = game.kickoff
        ? new Date(game.kickoff)
        : game.date
          ? new Date(`${game.date}T18:00:00Z`)
          : null;
      liveMoon = when ? moonAt(when) : null;
      liveHour = game.kickoff && lon !== null ? planetaryHourAt(new Date(game.kickoff), lon) : null;
    } else {
      const homeMeta = (rawTeamCode && NFL_TEAM_STADIUMS[rawTeamCode]) || nflStadiumMeta;
      Object.assign(stadiumObj, {
        stadium_name: stadiumObj.stadium_name || homeMeta.stadium_name,
        city: stadiumObj.city || homeMeta.city,
        state: stadiumObj.state || homeMeta.state,
        roof_type:
          stadiumObj.roof_type &&
          stadiumObj.roof_type !== '-'
            ? stadiumObj.roof_type
            : homeMeta.roof_type,
        latitude: stadiumObj.latitude ?? homeMeta.latitude,
        longitude: stadiumObj.longitude ?? homeMeta.longitude,
        coordinates:
          stadiumObj.coordinates ??
          (homeMeta.latitude !== null && homeMeta.longitude !== null
            ? {lat: homeMeta.latitude, lon: homeMeta.longitude}
            : null),
        celestial_house: stadiumObj.celestial_house || homeMeta.celestial_house,
        zodiac_ascendant:
          stadiumObj.zodiac_ascendant || homeMeta.zodiac_ascendant,
        geo_magnetic_resonance:
          stadiumObj.geo_magnetic_resonance || homeMeta.geo_magnetic_resonance,
      });
      liveKickoff = (p as any).game_kickoff || (p as any).kickoff_time || (liveSeason ? 'Time TBA' : null);
    }

    // A player's Stars never depend on where he sits in a lineup (owner decision):
    // every player is scored as a starter, so bench players aren't pre-judged.
    const calc = computeWeeklyPlayerFavorability(
      spirit,
      playerWeeklyProj,
      p.injury_status,
      true,
      geomantic,
    );

    const elem =
      (p as any).elemental_traits?.element || (p as any).element || 'Fire';
    const sunSign = (p as any).elemental_traits?.sun_sign || 'Aries';
    const stadiumName = stadiumObj.stadium_name;

    let rationaleText: string;
    let aspectHighlights: string[];

    if (calc.health_penalty < 0) {
      const onBye = onByeThisWeek;
      rationaleText = onBye
        ? `🌑 Fallow week: ${p.name} (${sunSign} / ${elem}) is on bye (−22 Stars).`
        : p.injury_status
          ? `⚠️ 6th House affliction: ${p.name} (${sunSign} / ${elem}) is ${p.injury_status} (−22 Stars).`
          : `⚠️ 6th House affliction: ${p.name} (${sunSign} / ${elem}) has no projection this week (−22 Stars).`;
      aspectHighlights = onBye
        ? ['🌑 Bye week (−22)']
        : ['⚠️ 6th House affliction (−22)', p.injury_status || 'No projection'];
    } else if (calc.verdict === 'HEAVILY FAVORED') {
      rationaleText = `✨ Apex alignment: ${p.name} (${sunSign} / ${elem}) rides a ${stadiumObj.zodiac_ascendant} trine at ${stadiumName}.`;
      aspectHighlights = [`✨ ${stadiumObj.zodiac_ascendant} Trine`, stadiumObj.geo_magnetic_resonance];
    } else if (calc.verdict === 'ASTRALLY FAVORED') {
      rationaleText = `🌟 Harmonic alignment: ${p.name} (${sunSign} / ${elem}) has steady sextile support at ${stadiumName}.`;
      aspectHighlights = ['🌟 Harmonic Sextile', stadiumObj.celestial_house];
    } else if (calc.verdict === 'NEUTRAL') {
      rationaleText = `⚖️ Mixed signals: ${p.name} (${sunSign} / ${elem}) has neither trine nor square at ${stadiumName}.`;
      aspectHighlights = ['⚖️ Neutral transit', stadiumObj.celestial_house];
    } else {
      rationaleText = `⚠️ Planetary friction: ${p.name} (${sunSign} / ${elem}) faces a Saturn-Mars square at ${stadiumName}.`;
      aspectHighlights = ['⚠️ Saturn-Mars Square', 'Contested matchup'];
    }

    const kickoffSlots = [
      'Sunday 1:00 PM EDT',
      'Sunday 4:05 PM EDT',
      'Sunday 4:25 PM EDT',
      'Sunday 8:20 PM EDT',
      'Monday 8:15 PM EDT',
      'Thursday 8:15 PM EDT',
    ];
    const planetaryHours = [
      'Hour of Mars (Kinetic Power)',
      'Hour of Jupiter (Expansion & Vision)',
      'Hour of Sun (Radiant Command)',
      'Hour of Venus (Harmonic Precision)',
      'Hour of Mercury (Audible Velocity)',
      'Hour of Saturn (Trench Resilience)',
    ];
    const lunarPhases = [
      'Waxing Gibbous in Scorpio',
      'Full Moon in Pisces',
      'Waxing Crescent in Libra',
      'Waning Gibbous in Taurus',
    ];

    let idHash = 0;
    for (let i = 0; i < pid.length; i++) {
      idHash = (idHash * 31 + pid.charCodeAt(i)) | 0;
    }

    // Sample (mock) data keeps the illustrative slots; a live season shows the
    // real game, or nothing when it isn't known.
    const gameKickoff = onByeThisWeek
      ? 'Bye week'
      : liveSeason
        ? liveKickoff ?? 'Time TBA'
        : kickoffSlots[(Math.abs(idHash) + week) % kickoffSlots.length];
    const lunarPhase = liveSeason
      ? liveMoon ?? ''
      : lunarPhases[(Math.abs(idHash) + week) % lunarPhases.length];
    const planetaryHour = liveSeason
      ? liveHour ?? ''
      : planetaryHours[(Math.abs(idHash) + idx) % planetaryHours.length];

    return {
      player_id: pid,
      player_name: p.name,
      position: p.position,
      fantasy_positions: p.fantasy_positions,
      depth_chart_order: p.depth_chart_order,
      team: p.team || 'NFL',
      nfl_team: p.team || 'NFL',
      bye_week: teamBye || p.bye_week || 0,
      opponent: oppTeamObj?.name || 'OPP',
      team_name: teamObj?.name || (isUserTeam ? 'My Team' : 'Opponent'),
      is_user_team: isUserTeam,
      is_benched: !isStarter,
      projected_points: Math.round(playerWeeklyProj * 100) / 100,
      spirit_score: spirit,
      base_spirit: calc.base_spirit,
      role_modifier: calc.role_modifier,
      health_penalty: calc.health_penalty,
      stadium_score: geomantic,
      harmony_score: teamHarmony,
      favorability_score: calc.score,
      favorability_verdict: calc.verdict as any,
      opponent_team: oppTeamObj?.name || (isUserTeam ? 'Opponent' : 'My Team'),
      opponent_rank: idx + (isUserTeam ? 10 : 8),
      stadium: stadiumObj,
      game_kickoff: gameKickoff,
      lunar_phase: lunarPhase,
      planetary_hour: planetaryHour,
      aspect_highlights: aspectHighlights,
      astrological_transit: aspectHighlights.join(' • '),
      astrological_rationale: rationaleText,
      rationale: rationaleText,
      aspect_description: rationaleText,
    };
  };

  let uStarterCounter = 0;
  let uBenchCounter = 0;
  userPlayers.slice(0, 15).forEach((p, idx) => {
    const isStarter = userStartersSet.has(String(p.id));
    const sIdx = isStarter ? uStarterCounter++ : 0;
    const bIdx = !isStarter ? uBenchCounter++ : 0;
    playerFavorabilities.push(
      buildPlayerFavorabilityEntry(
        p,
        idx,
        isStarter,
        true,
        sIdx,
        bIdx,
        userMatch,
        userTeam,
        oppTeam,
        userHarmony,
      ),
    );
  });

  let oStarterCounter = 0;
  let oBenchCounter = 0;
  oppPlayers.slice(0, 15).forEach((p, idx) => {
    const isStarter = oppStartersSet.has(String(p.id));
    const sIdx = isStarter ? oStarterCounter++ : 0;
    const bIdx = !isStarter ? oBenchCounter++ : 0;
    playerFavorabilities.push(
      buildPlayerFavorabilityEntry(
        p,
        idx,
        isStarter,
        false,
        sIdx,
        bIdx,
        oppMatch,
        oppTeam,
        userTeam,
        oppHarmony,
      ),
    );
  });

  const userStarterPlayers = userPlayers.filter((p) => userStartersSet.has(String(p.id)));
  const oppStarterPlayers = oppPlayers.filter((p) => oppStartersSet.has(String(p.id)));
  const userElements = dominantElements(userStarterPlayers);
  const oppElements = dominantElements(oppStarterPlayers);

  // Astral favorability is this week's: the mean Stars of each side's starters,
  // falling back to roster Spirit only when no starter could be scored.
  const meanStars = (isUser: boolean): number | null => {
    const scores = playerFavorabilities
      .filter((f) => f.is_user_team === isUser && !f.is_benched)
      .map((f) => Number(f.favorability_score))
      .filter((n) => Number.isFinite(n));
    return scores.length ? Math.round((scores.reduce((a, n) => a + n, 0) / scores.length) * 10) / 10 : null;
  };
  const userAstral = meanStars(true) ?? Math.round((userTeam.avg_spirit_score ?? 85.0) * 10) / 10;
  const oppAstral = meanStars(false) ?? Math.round((oppTeam.avg_spirit_score ?? 80.0) * 10) / 10;
  // Show the bonuses behind harmony only when they reproduce the team's score.
  const harmonyParts = (starters: CosmicPlayer[], score: number) => {
    if (starters.length === 0) return undefined;
    const b = computeRosterHarmonyBreakdown(starters);
    return Math.abs(b.total - score) < 0.05 ? b.parts : undefined;
  };

  const teamComparison: TeamCelestialComparison = {
    user_favorability_index: userAstral,
    opponent_favorability_index: oppAstral,
    user_astral_favorability: userAstral,
    opponent_astral_favorability: oppAstral,
    user_harmony_score: userHarmony,
    opponent_harmony_score: oppHarmony,
    user_harmony_parts: harmonyParts(userStarterPlayers, userHarmony),
    opponent_harmony_parts: harmonyParts(oppStarterPlayers, oppHarmony),
    user_elemental_dominance: userElements,
    opponent_elemental_dominance: oppElements,
    elemental_dominance: {user: userElements, opponent: oppElements},
    // Real QB + pass-catcher stacks among each side's starters.
    celestial_conjunctions: [...teamStacks(userStarterPlayers), ...teamStacks(oppStarterPlayers)],
    verdict_summary: `${userTeam.name} ${winProbability >= 50 ? 'is favored' : 'is the underdog'} (${winProbability.toFixed(1)}% win probability, from projections and harmony). Starter Stars ${userAstral.toFixed(1)} vs ${oppAstral.toFixed(1)}; Squad Harmony ${userHarmony} vs ${oppHarmony}.`,
  };

  const weekStatus = seasonCtx
    ? week < seasonCtx.currentWeek
      ? ('completed' as const)
      : week === seasonCtx.currentWeek
        ? ('active' as const)
        : ('upcoming' as const)
    : undefined;
  const hasScores =
    weekStatus !== undefined && weekStatus !== 'upcoming' && userMatch && oppMatch;
  const scoreUser = hasScores ? Number(userMatch.points || 0) : undefined;
  const scoreOpp = hasScores ? Number(oppMatch.points || 0) : undefined;
  const boardById = new Map(board.map((p) => [String(p.id), p]));
  const estimateWeekProj = (rosterId: number, w: number): number | undefined => {
    const m = seasonCtx?.matchupsByWeek[w]?.find(
      (x) => Number(x.roster_id) === rosterId,
    );
    if (!m?.starters?.length) return undefined;
    let sum = 0;
    for (const id of m.starters) {
      const p = boardById.get(String(id));
      if (!p || isPlayerOnByeWeek(w, p.bye_week, p.team, seasonCtx?.byeWeeks)) continue;
      sum +=
        p.weekly_projected_points ??
        p.sleeper_projected_points ??
        p.projected_points ??
        0;
    }
    return Math.round(sum * 100) / 100;
  };

  const seasonWeeks = generateMatchupWeeks(
    userTeam,
    competitorTeams,
    seasonCtx?.currentWeek ?? week,
    estimateWeekProj,
  );

  return {
    week,
    status: weekStatus,
    date_range: seasonCtx?.weekDates[week],
    score_user: scoreUser,
    score_opponent: scoreOpp,
    result:
      weekStatus === 'completed' && scoreUser !== undefined && scoreOpp !== undefined
        ? scoreUser > scoreOpp
          ? 'W'
          : scoreUser < scoreOpp
            ? 'L'
            : 'T'
        : undefined,
    matchup_id:
      userMatch?.matchup_id ||
      ((userTeam.slot === 7 && oppTeam.slot === 5) ||
      (userTeam.slot === 5 && oppTeam.slot === 7) ||
      userTeam.name?.includes('AstralOracles')
        ? 3
        : Math.min(userTeam.slot, oppTeam.slot) || 1),
    user_team: {
      slot: userTeam.slot,
      roster_id: userTeam.roster_id,
      team_name: userTeam.name,
      owner_name: userTeam.owner_name || userTeam.name,
      avatar: userTeam.avatar,
      avatar_url:
        userTeam.avatar_url ||
        (userTeam.avatar ? getSleeperAvatarUrl(userTeam.avatar) : null),
      projected_points: Math.round(userProj * 100) / 100,
      starters:
        Array.isArray(userMatch?.starters) && userMatch.starters.length > 0
          ? userMatch.starters
          : Array.isArray(fullRoster) && fullRoster.length > 0
            ? fullRoster
                .filter((s: RosterSlot) => {
                  const sid = s.slot_id || s.slot_name || '';
                  return sid && !isBenchOrReserveSlot(sid);
                })
                .map((s: RosterSlot) => (s.player?.id ? String(s.player.id) : '0'))
            : Array.isArray(userTeam.starters) && userTeam.starters.length > 0
              ? userTeam.starters
              : Array.from(userStartersSet),
      players:
        userMatch?.players ||
        userTeam.players ||
        userPlayers.map((p) => p.id),
      harmony_score: userHarmony,
    },
    opponent_team: {
      slot: oppTeam.slot,
      roster_id: oppTeam.roster_id,
      team_name: oppTeam.name,
      owner_name: oppTeam.owner_name || oppTeam.name,
      avatar: oppTeam.avatar,
      avatar_url:
        oppTeam.avatar_url ||
        (oppTeam.avatar ? getSleeperAvatarUrl(oppTeam.avatar) : null),
      projected_points: Math.round(oppProj * 100) / 100,
      starters:
        Array.isArray(oppMatch?.starters) && oppMatch.starters.length > 0
          ? oppMatch.starters
          : Array.isArray(oppTeam.starters) && oppTeam.starters.length > 0
            ? oppTeam.starters
            : Array.from(oppStartersSet),
      players:
        oppMatch?.players ||
        oppTeam.players ||
        oppPlayers.map((p) => p.id),
      harmony_score: oppHarmony,
    },
    win_probability: winProbability,
    win_probability_label: favorabilityLabel,
    team_comparison: teamComparison,
    player_favorabilities: playerFavorabilities,
    start_sit_recommendations: (() => {
      const activeStarterIds = new Set(
        userMatch?.starters ||
          (userStartersSet.size > 0
            ? Array.from(userStartersSet)
            : userPlayers.slice(0, 8).map((p) => p.id)),
      );
      const starterPlayers = userPlayers.filter((p) =>
        activeStarterIds.has(p.id),
      );
      const benchPlayers = userPlayers.filter(
        (p) => !activeStarterIds.has(p.id),
      );

      if (starterPlayers.length > 0 && benchPlayers.length > 0) {
        const startCandidate =
          starterPlayers.find(
            (p) => p.position === 'WR' || p.position === 'RB',
          ) || starterPlayers[0];
        const sitCandidate =
          benchPlayers.find((b) => b.position === startCandidate.position) ||
          benchPlayers.find((b) => ['WR', 'RB', 'TE'].includes(b.position)) ||
          benchPlayers[0];

        const elem = startCandidate.elemental_traits?.element || 'Air';
        const projDelta =
          Math.round(
            Math.max(
              0.5,
              (startCandidate.projected_points || 0) -
                (sitCandidate.projected_points || 0),
            ) * 10,
          ) / 10;
        const synergyReason = `${elem} Trine catalyst against boundary pass defense; activates higher red-zone separation compared to bench ${sitCandidate.position}.`;

        return [
          {
            position: startCandidate.position as NFLPosition,
            recommended_start: startCandidate,
            recommended_sit: sitCandidate,
            projected_delta: projDelta,
            synergy_reason: synergyReason,
            confidence: 'HIGH' as const,
            start_player_name: startCandidate.name,
            start_player_position: startCandidate.position as NFLPosition,
            start_player_team: startCandidate.team || 'NFL',
            sit_player_name: sitCandidate.name,
            sit_player_position: sitCandidate.position as NFLPosition,
            sit_player_team: sitCandidate.team || 'NFL',
            rationale: synergyReason,
          },
        ];
      }
      return [];
    })(),
    upcoming_matchups: seasonWeeks,
    past_matchups: seasonCtx
      ? seasonWeeks.filter((w) => w.status === 'completed')
      : undefined,
  };
}

/**
 * Dynamically derives 18-week schedule matrix and bye week coverage from the active roster.
 * Simulates weekly starting lineups, conflict triage, and championship playoff depth for Weeks 1-18.
 */
export function derive18WeekCoverage(
  roster: RosterSlot[],
  rosterPositions: string[] = [
    'QB',
    'RB',
    'RB',
    'WR',
    'WR',
    'TE',
    'FLEX',
    'SUPER_FLEX',
  ],
): ByeCoverageWeek[] {
  const players = roster
    .map((slot) => slot.player)
    .filter((p): p is CosmicPlayer => p !== null && p !== undefined);

  if (players.length === 0) {
    return mockWeeklyCoverage;
  }

  const coverageWeeks: ByeCoverageWeek[] = [];

  for (let week = 1; week <= 18; week++) {
    // 1. Identify players on bye for this week
    const byePlayers = isNFLByeWeek(week)
      ? players
          .filter((p) => isPlayerOnByeWeek(week, p.bye_week, p.team, getSeasonContext()?.byeWeeks))
          .map((p) => ({
            player_id: String(p.id),
            player_name: p.name,
            position: p.position as NFLPosition,
          }))
      : [];

    // 2. Identify active (non-bye) players
    const activePlayers = isNFLByeWeek(week)
      ? players.filter((p) => !isPlayerOnByeWeek(week, p.bye_week, p.team, getSeasonContext()?.byeWeeks))
      : players;

    // 3. Form optimal starting lineup from active players
    const usedPlayerIds = new Set<string>();
    const starters: WeeklyPositionSlot[] = [];

    // Helper to find best available player
    const getWeeklyProj = (p: CosmicPlayer) =>
      p.weekly_projected_points ??
      p.sleeper_projected_points ??
      p.projected_points ??
      0;

    const findBest = (
      filterFn: (p: CosmicPlayer) => boolean,
    ): CosmicPlayer | null => {
      const candidates = activePlayers
        .filter((p) => !usedPlayerIds.has(String(p.id)) && filterFn(p))
        .sort((a, b) => getWeeklyProj(b) - getWeeklyProj(a));
      if (candidates.length > 0) {
        usedPlayerIds.add(String(candidates[0].id));
        return candidates[0];
      }
      return null;
    };

    // Fill standard positions
    for (const pos of rosterPositions) {
      if (pos.startsWith('BN') || pos.startsWith('IR')) continue;

      let chosen: CosmicPlayer | null = null;
      if (pos === 'QB') {
        chosen = findBest((p) => p.position === 'QB');
      } else if (pos === 'RB') {
        chosen = findBest((p) => p.position === 'RB');
      } else if (pos === 'WR') {
        chosen = findBest((p) => p.position === 'WR');
      } else if (pos === 'TE') {
        chosen = findBest((p) => p.position === 'TE');
      } else if (pos === 'FLEX') {
        chosen = findBest((p) => ['RB', 'WR', 'TE'].includes(p.position));
      } else if (pos === 'SUPER_FLEX' || pos === 'SUPERFLEX') {
        chosen = findBest((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
      } else if (pos === 'K') {
        chosen = findBest((p) => p.position === 'K');
      } else if (pos === 'DEF') {
        chosen = findBest((p) => p.position === 'DEF');
      }

      if (chosen) {
        const weeklyPoints =
          chosen.weekly_projected_points ??
          chosen.sleeper_projected_points ??
          chosen.projected_points ??
          12.0;

        starters.push({
          position: chosen.position as NFLPosition,
          player_name: chosen.name,
          projected_week_points: weeklyPoints,
          is_bye: false,
        });
      }
    }

    // Determine conflict severity
    let conflictSeverity: ConflictSeverity = 'none';
    if (byePlayers.length >= 3) {
      conflictSeverity = 'high';
    } else if (byePlayers.length >= 1) {
      conflictSeverity = 'low';
    }

    const baseProjectedTotal = starters.reduce(
      (sum, s) => sum + s.projected_week_points,
      0,
    );
    const synergyMultiplier =
      conflictSeverity === 'high'
        ? 0.95
        : conflictSeverity === 'none'
          ? 1.05
          : 1.02;
    const projectedTotal =
      Math.round(baseProjectedTotal * synergyMultiplier * 10) / 10;

    coverageWeeks.push({
      week,
      active_starters: starters,
      bye_players: byePlayers,
      projected_total: projectedTotal,
      conflict_severity: conflictSeverity,
      elemental_synergy_multiplier: synergyMultiplier,
    });
  }

  return coverageWeeks;
}

export function transformToDraftState(
  metadata: SleeperDraftMetadata,
  picks: SleeperPick[],
  userSettings?: Partial<OneiromancySettings>,
  playerDict?: Record<string, SleeperPlayerRecord>,
  leagueUsers?: any[],
  leagueRosters?: any[],
  leagueMatchups?: any[],
  leagueDetails?: any,
  activeWeek?: number,
  weeklyProjections?: Record<string, any> | null,
  nextWeekProjectionsByWeek?: Record<number, Record<string, any> | null> | null,
): DraftState {
  const isSyntheticOrLive =
    userSettings?.mode === 'live' ||
    Boolean(leagueDetails?.league_id) ||
    (Boolean(userSettings?.league_id) && userSettings?.league_id !== '9000000000000000001') ||
    (Boolean(metadata.draft_id) &&
      metadata.draft_id !== 'mock' &&
      metadata.draft_id !== 'mock_oneiromancy_draft_2025' &&
      metadata.draft_id !== '9000000000000000002');

  const baseAvailableLeagues = isSyntheticOrLive
    ? (leagueDetails
        ? [
            {
              league_id: String(leagueDetails.league_id),
              name: leagueDetails.name || 'League',
              season: String(leagueDetails.season || '2025'),
            },
          ]
        : (userSettings?.available_leagues || []))
    : (userSettings?.available_leagues || mockSettings.available_leagues);

  const settings: OneiromancySettings = {
    ...(isSyntheticOrLive ? DEFAULT_LIVE_SETTINGS : mockSettings),
    available_leagues: baseAvailableLeagues,
    ...userSettings,
    draft_id: metadata.draft_id,
  };
  if (leagueDetails?.league_id) {
    settings.league_id = String(leagueDetails.league_id);
  }

  const teams = metadata.settings?.teams || 12;
  const rounds = metadata.settings?.rounds || 15;
  const pickCount = picks.length;

  const isDraftComplete =
    metadata.status === 'complete' ||
    (metadata.status as string) === 'finished' ||
    pickCount >= teams * rounds;

  const status: DraftLeagueStatus = isDraftComplete
    ? 'complete'
    : deriveDraftStatus(pickCount, teams, rounds);

  const currentPick: DraftPickState = isDraftComplete
    ? {
        round: rounds,
        pick_no:
          pickCount >= teams * rounds
            ? teams * rounds
            : pickCount || rounds * teams,
        on_the_clock_team_id: '',
        seconds_remaining: 0,
      }
    : calculateActivePick(
        pickCount,
        teams,
        rounds,
        metadata.draft_order,
        metadata.settings?.reversal_round,
      );

  // Map drafted player IDs
  const pickedPlayerMap = new Map<string, SleeperPick>();
  for (const pick of picks) {
    if (pick && pick.player_id) {
      pickedPlayerMap.set(pick.player_id, pick);
    }
  }

  const isExplicitMock =
    settings.mode !== 'live' &&
    (metadata.draft_id === 'mock' ||
      metadata.draft_id === 'mock_oneiromancy_draft_2025' ||
      settings.draft_id === 'mock_oneiromancy_draft_2025' ||
      settings.mode === 'mock');

  const hasPopulatedLeagueRosters =
    Array.isArray(leagueRosters) &&
    leagueRosters.some((r) => Array.isArray(r?.players) && r.players.length > 0);
  const hasCompletedRosterSync = isDraftComplete && hasPopulatedLeagueRosters;

  // 1. Gather all unique players from draft picks, league rosters, and weekly projections
  const playerMap = new Map<string, CosmicPlayer>();
  const syntheticBaselineIds = new Set<string>();

  // Seed baseline board only in explicit mock mode
  const baseBoard = isExplicitMock ? mockCosmicBoard : [];

  for (const player of baseBoard) {
    const pid = String(player.id);
    const pick = pickedPlayerMap.get(pid);
    const isMyPick =
      pick &&
      ((settings.user_id && pick.picked_by === settings.user_id) ||
        pick.draft_slot === settings.user_slot);

    playerMap.set(pid, {
      ...player,
      draft_status: hasCompletedRosterSync
        ? 'available'
        : isMyPick
          ? 'my_team'
          : pick
            ? 'drafted'
            : 'available',
      drafted_by_user_id: hasCompletedRosterSync
        ? null
        : pick
          ? pick.picked_by
          : null,
      drafted_pick_no: hasCompletedRosterSync
        ? null
        : pick
          ? pick.pick_no
          : null,
    });
  }

  // Add and enrich all drafted picks
  if (Array.isArray(picks)) {
    for (const pick of picks) {
      if (!pick || !pick.player_id) continue;
      const pid = String(pick.player_id);
      const isMyPick =
        (settings.user_id && pick.picked_by === settings.user_id) ||
        pick.draft_slot === settings.user_slot;

      let player = playerMap.get(pid);
      if (!player) {
        player = synthesizeCosmicPlayerFromId(
          pid,
          playerDict,
          hasCompletedRosterSync ? false : Boolean(isMyPick),
          pick.metadata,
        );
        if (player.baseline_projected_points === undefined) {
          syntheticBaselineIds.add(pid);
        }
      }
      const firstName = pick.metadata?.first_name || player.first_name;
      const lastName = pick.metadata?.last_name || player.last_name;
      const name =
        firstName && lastName ? `${firstName} ${lastName}`.trim() : player.name;
      const position = pick.metadata?.position
        ? (pick.metadata.position.toUpperCase() as NFLPosition)
        : player.position;
      const liveRecord = playerDict?.[pid];
      const liveTeam =
        liveRecord?.team &&
        liveRecord.team !== 'FA' &&
        liveRecord.team !== 'NFL'
          ? liveRecord.team
          : undefined;
      const team = liveTeam || pick.metadata?.team || player.team;
      const jerseyNumber =
        Number(pick.metadata?.number) || player.jersey_number;
      const rawPickBaseline = Number(
        (pick.metadata as any)?.baseline_projected_points ?? 0,
      );
      const pickBaseline =
        Number.isFinite(rawPickBaseline) && rawPickBaseline > 0
          ? Math.round(rawPickBaseline * 100) / 100
          : player.baseline_projected_points;

      player = {
        ...player,
        first_name: firstName,
        last_name: lastName,
        name,
        position,
        team,
        jersey_number: jerseyNumber,
        bye_week:
          getTeamByeWeek(team) ??
          (Number.isFinite(Number((pick.metadata as any)?.bye_week)) && Number((pick.metadata as any)?.bye_week) > 0
            ? Number((pick.metadata as any)?.bye_week)
            : Number.isFinite(Number((liveRecord as any)?.bye_week)) && Number((liveRecord as any)?.bye_week) > 0
              ? Number((liveRecord as any)?.bye_week)
              : player.bye_week || 0),
        ...(pickBaseline !== undefined
          ? {baseline_projected_points: pickBaseline}
          : {}),
        draft_status: hasCompletedRosterSync
          ? 'available'
          : isMyPick
            ? 'my_team'
            : 'drafted',
        drafted_by_user_id: hasCompletedRosterSync
          ? null
          : pick.picked_by || null,
        drafted_pick_no: hasCompletedRosterSync ? null : (pick.pick_no || null),
        status: liveRecord?.status || pick.metadata?.status || player.status,
        injury_status:
          liveRecord !== undefined
            ? (liveRecord.injury_status ?? null)
            : pick.metadata?.injury_status !== undefined
              ? pick.metadata?.injury_status
              : player.injury_status,
      };
      playerMap.set(pid, player);
    }
  }

  // Add and enrich all rostered players across all league rosters
  if (Array.isArray(leagueRosters)) {
    for (const r of leagueRosters) {
      const isUserRoster =
        (settings.user_id && String(r.owner_id) === String(settings.user_id)) ||
        (settings.user_slot &&
          (metadata.draft_order &&
          metadata.draft_order[String(r.owner_id)] !== undefined
            ? Number(metadata.draft_order[String(r.owner_id)]) ===
              Number(settings.user_slot)
            : Number(r.roster_id) === Number(settings.user_slot)));

      if (Array.isArray(r.players)) {
        for (const rawPid of r.players) {
          if (!rawPid) continue;
          const pid = String(rawPid);
          let player = playerMap.get(pid);
          if (!player) {
            player = synthesizeCosmicPlayerFromId(
              pid,
              playerDict,
              Boolean(isUserRoster),
            );
            if (player.baseline_projected_points === undefined) {
              syntheticBaselineIds.add(pid);
            }
          }
          if (isUserRoster) {
            player = {
              ...player,
              draft_status: 'my_team',
              drafted_by_user_id: r.owner_id
                ? String(r.owner_id)
                : player.drafted_by_user_id,
            };
          } else if (player.draft_status !== 'my_team') {
            player = {
              ...player,
              draft_status: 'drafted',
              drafted_by_user_id: r.owner_id
                ? String(r.owner_id)
                : player.drafted_by_user_id,
            };
          }
          playerMap.set(pid, player);
        }
      }
    }
  }

  // Also ensure any player IDs referenced in leagueMatchups (starters or players) exist in playerMap
  if (Array.isArray(leagueMatchups)) {
    for (const m of leagueMatchups) {
      const mPids = [
        ...(Array.isArray(m?.starters) ? m.starters : []),
        ...(Array.isArray(m?.players) ? m.players : []),
      ];
      for (const rawPid of mPids) {
        if (!rawPid || String(rawPid) === '0') continue;
        const pid = String(rawPid);
        if (!playerMap.has(pid)) {
          const synthesized = synthesizeCosmicPlayerFromId(
            pid,
            playerDict,
            false,
          );
          if (synthesized.baseline_projected_points === undefined) {
            syntheticBaselineIds.add(pid);
          }
          playerMap.set(pid, {
            ...synthesized,
            draft_status: 'drafted',
          });
        }
      }
    }
  }

  // Determine active roster positions and league-eligible positions
  const activeRosterPositions: string[] = Array.isArray(
    leagueDetails?.roster_positions,
  )
    ? leagueDetails.roster_positions
    : Array.isArray(userSettings?.roster_positions)
      ? userSettings.roster_positions
      : [
          'QB',
          'RB',
          'RB',
          'WR',
          'WR',
          'TE',
          'FLEX',
          'SUPER_FLEX',
          'BN',
          'BN',
          'BN',
          'BN',
          'BN',
          'BN',
          'BN',
        ];

  const validPositions = new Set<string>(['QB', 'RB', 'WR', 'TE']);
  if (activeRosterPositions.includes('K')) validPositions.add('K');
  if (activeRosterPositions.includes('DEF')) validPositions.add('DEF');

  const scoringSettings = leagueDetails?.scoring_settings;
  const hasLiveProjections = Boolean(
    weeklyProjections && Object.keys(weeklyProjections).length > 0,
  );

  // Ingest all unowned available players from weekly projections (when available)
  if (hasLiveProjections && playerDict && Object.keys(playerDict).length > 0) {
    for (const [pid, proj] of Object.entries(weeklyProjections!)) {
      if (playerMap.has(pid)) continue;
      const record = playerDict[pid];
      if (!record || !isValidNFLPlayerRecord(pid, record)) continue;
      const pos = (record.position || '').toUpperCase();
      if (!validPositions.has(pos)) continue;

      const leagueProj = calculateSleeperLeagueProjection(
        proj,
        scoringSettings,
      );
      const nflProj = Number(
        proj?.pts_ppr ?? proj?.pts_half_ppr ?? proj?.pts_std ?? 0,
      );
      const effectiveProj = leagueProj > 0 ? leagueProj : nflProj;

      if (effectiveProj > 0) {
        const p = synthesizeCosmicPlayerFromId(pid, playerDict, false);
        if (p.baseline_projected_points === undefined) {
          syntheticBaselineIds.add(pid);
        }
        p.draft_status = 'available';
        p.nfl_projected_points = Math.round(nflProj * 100) / 100;
        p.sleeper_projected_points = Math.round(effectiveProj * 100) / 100;
        p.weekly_projected_points = p.sleeper_projected_points;
        p.projected_points = p.sleeper_projected_points;

        const posBaseline =
          pos === 'QB' ? 14.0 : pos === 'RB' ? 10.0 : pos === 'WR' ? 9.0 : 6.0;
        p.market_vor =
          Math.round((p.sleeper_projected_points - posBaseline) * 10) / 10;
        p.vor_normalized = Number(
          Math.min(99.0, Math.max(10.0, 52.0 + p.market_vor * 6.5)).toFixed(1),
        );
        playerMap.set(pid, p);
      }
    }
  }

  // Ingest all signed active NFL players from playerDict (live mode only)
  if (!isExplicitMock && playerDict && Object.keys(playerDict).length > 0) {
    const availableCandidates: Array<{
      id: string;
      searchRank: number;
    }> = [];

    for (const [pid, record] of Object.entries(playerDict)) {
      if (playerMap.has(pid)) continue;
      if (!isValidNFLPlayerRecord(pid, record)) continue;
      const pos = (record.position || '').toUpperCase();
      if (!validPositions.has(pos)) continue;

      const searchRank = Number((record as any).search_rank || 9999);
      if (isSignedActiveNFLPlayer(pid, record)) {
        availableCandidates.push({id: pid, searchRank});
      }
    }

    availableCandidates.sort((a, b) => a.searchRank - b.searchRank);

    for (const cand of availableCandidates) {
      const p = synthesizeCosmicPlayerFromId(cand.id, playerDict, false);
      if (p.baseline_projected_points === undefined) {
        syntheticBaselineIds.add(cand.id);
      }
      p.draft_status = 'available';
      playerMap.set(cand.id, p);
    }
  }

  playerMap.forEach((player, pid) => {
    const explicitBaselineRaw = Number(
      (player as any).baseline_projected_points ??
        (playerDict?.[pid] as any)?.baseline_projected_points ??
        0,
    );
    const hasExplicitPositiveBaseline =
      Number.isFinite(explicitBaselineRaw) && explicitBaselineRaw > 0;
    const legacyBaselineRaw = Number(
      player.sleeper_projected_points ?? player.projected_points ?? 0,
    );
    const baselineForMatchup = hasExplicitPositiveBaseline
      ? explicitBaselineRaw
      : !syntheticBaselineIds.has(pid) && Number.isFinite(legacyBaselineRaw) && legacyBaselineRaw > 0
        ? legacyBaselineRaw
        : 0;
    if (baselineForMatchup > 0) {
      (player as any).baseline_projected_points =
        Math.round(baselineForMatchup * 100) / 100;
    } else {
      delete (player as any).baseline_projected_points;
    }

    const explicitAvgRaw = Number(
      (player as any).average_projected_points ??
        (playerDict?.[pid] as any)?.average_projected_points ??
        0,
    );
    const hasExplicitPositiveAvg =
      Number.isFinite(explicitAvgRaw) &&
      explicitAvgRaw > 0;
    const avgForMatchup = hasExplicitPositiveAvg
      ? explicitAvgRaw
      : baselineForMatchup > 0
        ? baselineForMatchup
        : Number(player.season_projected_points) > 0
          ? Number(player.season_projected_points) / 17
          : 0;
    if (avgForMatchup > 0) {
      (player as any).average_projected_points =
        Math.round(avgForMatchup * 100) / 100;
    } else {
      delete (player as any).average_projected_points;
    }
    const proj = weeklyProjections?.[pid];
    let nflPts = 0;
    let sleeperPts = 0;

    if (proj) {
      nflPts = Number(proj.pts_ppr ?? proj.pts_half_ppr ?? proj.pts_std ?? 0);
      sleeperPts = calculateSleeperLeagueProjection(proj, scoringSettings);
      if (sleeperPts === 0 && nflPts > 0) sleeperPts = nflPts;
    } else if (hasLiveProjections) {
      nflPts = 0;
      sleeperPts = 0;
    } else {
      nflPts =
        (player as any).nfl_projected_points !== undefined
          ? Number((player as any).nfl_projected_points)
          : player.projected_points || 0;
      sleeperPts =
        (player as any).sleeper_projected_points !== undefined
          ? Number((player as any).sleeper_projected_points)
          : nflPts;
    }

    player.nfl_projected_points = Math.round(nflPts * 100) / 100;
    player.sleeper_projected_points = Math.round(sleeperPts * 100) / 100;
    player.weekly_projected_points = player.sleeper_projected_points;
    player.projected_points = player.sleeper_projected_points;

    // Derive dynamic market_vor & vor_normalized across available, rostered, and drafted players when live projections exist
    if (
      player.draft_status === 'available' ||
      hasLiveProjections ||
      player.market_vor === 0 ||
      player.market_vor === 5
    ) {
      const posBaseline =
        player.position === 'QB'
          ? 14.0
          : player.position === 'RB'
            ? 10.0
            : player.position === 'WR'
              ? 9.0
              : player.position === 'TE'
                ? 6.0
                : 7.0;
      player.market_vor =
        Math.round((player.sleeper_projected_points - posBaseline) * 10) / 10;
      player.vor_normalized = Number(
        Math.min(99.0, Math.max(10.0, 52.0 + player.market_vor * 6.5)).toFixed(
          1,
        ),
      );
    }
    const seasonCtx = getSeasonContext();
    const effectiveActiveWeek =
      typeof activeWeek === 'number' ? activeWeek : seasonCtx?.currentWeek;
    const liveRec = playerDict?.[pid];
    const isReleasedFreeAgent =
      liveRec !== undefined &&
      (!liveRec.team || liveRec.team === 'FA' || liveRec.team === 'NFL');
    const lookaheadTeam = isReleasedFreeAgent ? 'FA' : player.team;
    const lookaheadByeWeek = isReleasedFreeAgent ? null : player.bye_week;
    const nextPlayWk = getNextPlayWeek(
      lookaheadTeam,
      effectiveActiveWeek,
      seasonCtx?.byeWeeks,
      lookaheadByeWeek,
    );
    if (nextPlayWk !== null) {
      player.next_play_week = nextPlayWk;
      const nextProj = nextWeekProjectionsByWeek?.[nextPlayWk]?.[pid];
      let nextProjPts = 0;
      if (nextProj) {
        const nflNext = Number(
          nextProj.pts_ppr ?? nextProj.pts_half_ppr ?? nextProj.pts_std ?? 0,
        );
        const leagueNext = calculateSleeperLeagueProjection(
          nextProj,
          scoringSettings,
        );
        nextProjPts = leagueNext > 0 ? leagueNext : nflNext;
      }
      const fallbackLookaheadBaseline = hasExplicitPositiveBaseline
        ? Math.round(explicitBaselineRaw * 100) / 100
        : !syntheticBaselineIds.has(pid) &&
            typeof player.baseline_projected_points === 'number' &&
            Number.isFinite(player.baseline_projected_points) &&
            player.baseline_projected_points > 0
          ? player.baseline_projected_points
          : undefined;
      if (
        !(Number.isFinite(nextProjPts) && nextProjPts > 0) &&
        fallbackLookaheadBaseline !== undefined
      ) {
        nextProjPts = fallbackLookaheadBaseline;
      }
      player.next_week_projected_points =
        Number.isFinite(nextProjPts) && nextProjPts > 0
          ? Math.round(nextProjPts * 100) / 100
          : undefined;
      if (
        player.next_week_projected_points &&
        player.next_week_projected_points > 0 &&
        !hasExplicitPositiveAvg
      ) {
        player.average_projected_points = player.next_week_projected_points;
      }
    } else {
      delete player.next_play_week;
      delete player.next_week_projected_points;
    }

    playerMap.set(pid, player);
  });

  const updatedCosmicBoard: CosmicPlayer[] = [];
  playerMap.forEach((p) => updatedCosmicBoard.push(p));
  const scoredCosmicBoard = recomputeDraftScores(updatedCosmicBoard, settings);

  // Derive user roster from leagueRosters
  let userRoster: any = null;
  const rawUser = settings.sleeper_username || '';
  const cleanUser = rawUser.replace(/^@/, '').toLowerCase().trim();
  const isCanonicalMatchAllowed =
    !cleanUser ||
    cleanUser.includes('oneirovanguard') ||
    cleanUser === '9000000000000000101' ||
    cleanUser === 'user_oneiromancy_me';

  let matchedU: any = null;
  if (Array.isArray(leagueUsers) && leagueUsers.length > 0) {
    matchedU = leagueUsers.find((u: any) => {
      const uid = String(u.user_id || '');
      const un = (u.username || '').toLowerCase();
      const dn = (u.display_name || '').toLowerCase();
      const tn = (u.metadata?.team_name || '').toLowerCase();

      if (cleanUser) {
        if (un === cleanUser || dn === cleanUser || uid === cleanUser)
          return true;
        if (
          cleanUser.length >= 3 &&
          (un.includes(cleanUser) || dn.includes(cleanUser))
        )
          return true;
        if (
          cleanUser.length >= 3 &&
          (tn === cleanUser || tn.includes(cleanUser))
        )
          return true;
        if (isCanonicalMatchAllowed) {
          return (
            uid === '9000000000000000101' ||
            un.includes('oneirovanguard') ||
            dn.includes('oneirovanguard') ||
            tn.includes('astraloracles')
          );
        }
        return false;
      }

      return (
        uid === '9000000000000000101' ||
        un.includes('oneirovanguard') ||
        dn.includes('oneirovanguard') ||
        tn.includes('astraloracles')
      );
    });
  }

  if (matchedU) {
    settings.sleeper_username =
      matchedU.display_name || matchedU.username || rawUser || cleanUser;
    settings.user_id = String(matchedU.user_id);
  }

  const explicitSlot =
    userSettings?.user_slot !== undefined && userSettings.user_slot !== null
      ? Number(userSettings.user_slot)
      : undefined;

  if (Array.isArray(leagueRosters) && leagueRosters.length > 0) {
    if (explicitSlot !== undefined) {
      userRoster = leagueRosters.find((r: any) => {
        const ownerId = String(r.owner_id || '');
        if (
          metadata.draft_order &&
          metadata.draft_order[ownerId] !== undefined
        ) {
          return Number(metadata.draft_order[ownerId]) === explicitSlot;
        }
        return Number(r.roster_id) === explicitSlot;
      });
    }
    if (!userRoster && matchedU) {
      const foundUserId = String(matchedU.user_id);
      userRoster = leagueRosters.find(
        (r: any) =>
          String(r.owner_id) === foundUserId ||
          (Array.isArray(r.co_owners) &&
            r.co_owners.map(String).includes(foundUserId)),
      );
    }
    if (!userRoster && settings.user_id && isCanonicalMatchAllowed) {
      userRoster = leagueRosters.find(
        (r: any) =>
          String(r.owner_id) === String(settings.user_id) ||
          (Array.isArray(r.co_owners) &&
            r.co_owners.map(String).includes(String(settings.user_id))),
      );
    }
    if (!userRoster && settings.user_slot) {
      userRoster = leagueRosters.find((r: any) => {
        const ownerId = String(r.owner_id || '');
        if (
          metadata.draft_order &&
          metadata.draft_order[ownerId] !== undefined
        ) {
          return (
            Number(metadata.draft_order[ownerId]) === Number(settings.user_slot)
          );
        }
        return Number(r.roster_id) === Number(settings.user_slot);
      });
    }
  }

  if (explicitSlot !== undefined) {
    settings.user_slot = explicitSlot;
  } else if (userRoster) {
    const ownerId = String(userRoster.owner_id || '');
    if (metadata.draft_order && metadata.draft_order[ownerId] !== undefined) {
      settings.user_slot = Number(metadata.draft_order[ownerId]);
    } else if (userRoster.roster_id !== undefined) {
      settings.user_slot = Number(userRoster.roster_id);
    }
  }

  // Populate user draft picks (used for Path of Ascension and draft fallback)
  let userPicks = picks.filter(
    (p) =>
      (settings.user_id &&
        (p.picked_by === settings.user_id ||
          String(p.picked_by) === String(settings.user_id))) ||
      (settings.user_slot && p.draft_slot === settings.user_slot),
  );
  if (userRoster) {
    const rosterId = Number(userRoster.roster_id);
    const rosterPicks = picks.filter(
      (p) =>
        p.roster_id === rosterId ||
        (settings.user_slot && p.draft_slot === settings.user_slot),
    );
    if (rosterPicks.length > 0) {
      userPicks = rosterPicks;
    }
  }
  if (userPicks.length === 0) {
    if (
      settings.user_slot &&
      settings.user_slot >= 1 &&
      settings.user_slot <= 12
    ) {
      userPicks = picks.filter((p) => p.draft_slot === settings.user_slot);
    }
    if (userPicks.length === 0 && metadata.draft_order && settings.user_id) {
      const slotFromOrder = metadata.draft_order[settings.user_id];
      if (slotFromOrder) {
        userPicks = picks.filter((p) => p.draft_slot === slotFromOrder);
      }
    }
    if (userPicks.length === 0 && picks.length > 0) {
      const availableSlots = Array.from(
        new Set(picks.map((p) => p.draft_slot)),
      ).sort((a, b) => a - b);
      if (availableSlots.length > 0) {
        userPicks = picks.filter((p) => p.draft_slot === availableSlots[0]);
      }
    }
  }
  userPicks.sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0));

  let fullRoster: RosterSlot[] = [];

  interface SlotDefinition {
    id: string;
    name: string;
    pos: NFLPosition[];
  }

  let startingSlots: SlotDefinition[] = [];
  const rawPositions: string[] = Array.isArray(leagueDetails?.roster_positions)
    ? leagueDetails.roster_positions.filter(
        (pos: string) =>
          !['BN', 'IR', 'TAXI'].includes((pos || '').toUpperCase().trim()),
      )
    : Array.isArray(userSettings?.roster_positions)
      ? userSettings.roster_positions.filter(
          (pos: string) =>
            !['BN', 'IR', 'TAXI'].includes((pos || '').toUpperCase().trim()),
        )
      : [];

  if (rawPositions.length === 0 && metadata?.settings) {
    const ms = metadata.settings as unknown as Record<
      string,
      number | undefined
    >;
    const qbCount = ms['slots_qb'] ?? 0;
    const rbCount = ms['slots_rb'] ?? 0;
    const wrCount = ms['slots_wr'] ?? 0;
    const teCount = ms['slots_te'] ?? 0;
    const flexCount = ms['slots_flex'] ?? 0;
    const sflexCount = ms['slots_super_flex'] ?? 0;
    const kCount = ms['slots_k'] ?? 0;
    const defCount = ms['slots_def'] ?? 0;
    if (
      qbCount +
        rbCount +
        wrCount +
        teCount +
        flexCount +
        sflexCount +
        kCount +
        defCount >
      0
    ) {
      for (let i = 0; i < qbCount; i++) rawPositions.push('QB');
      for (let i = 0; i < rbCount; i++) rawPositions.push('RB');
      for (let i = 0; i < wrCount; i++) rawPositions.push('WR');
      for (let i = 0; i < teCount; i++) rawPositions.push('TE');
      for (let i = 0; i < flexCount; i++) rawPositions.push('FLEX');
      for (let i = 0; i < sflexCount; i++) rawPositions.push('SUPER_FLEX');
      for (let i = 0; i < kCount; i++) rawPositions.push('K');
      for (let i = 0; i < defCount; i++) rawPositions.push('DEF');
    }
  }

  if (rawPositions.length > 0) {
    let rbCount = 0;
    let wrCount = 0;
    for (const pos of rawPositions) {
      const uPos = (pos || '').toUpperCase().trim();
      if (uPos === 'QB') {
        startingSlots.push({id: 'QB', name: 'Quarterback', pos: ['QB']});
      } else if (uPos === 'RB') {
        rbCount++;
        startingSlots.push({
          id: `RB${rbCount}`,
          name: `Running Back ${rbCount}`,
          pos: ['RB'],
        });
      } else if (uPos === 'WR') {
        wrCount++;
        startingSlots.push({
          id: `WR${wrCount}`,
          name: `Wide Receiver ${wrCount}`,
          pos: ['WR'],
        });
      } else if (uPos === 'TE') {
        startingSlots.push({id: 'TE', name: 'Tight End', pos: ['TE']});
      } else if (uPos === 'FLEX' || uPos === 'W/R/T' || uPos === 'WR_RB_TE') {
        startingSlots.push({
          id: 'FLEX',
          name: 'Flex (W/R/T)',
          pos: ['WR', 'RB', 'TE'],
        });
      } else if (
        uPos === 'SUPER_FLEX' ||
        uPos === 'SUPERFLEX' ||
        uPos === 'QB/W/R/T' ||
        uPos === 'QB_WR_RB_TE'
      ) {
        startingSlots.push({
          id: 'SUPER_FLEX',
          name: 'Superflex (QB/W/R/T)',
          pos: ['QB', 'WR', 'RB', 'TE'],
        });
      } else if (
        uPos === 'WRRB_FLEX' ||
        uPos === 'W/R' ||
        uPos === 'WR_RB' ||
        uPos === 'RB_WR'
      ) {
        startingSlots.push({
          id: 'WRRB_FLEX',
          name: 'Flex (W/R)',
          pos: ['WR', 'RB'],
        });
      } else if (
        uPos === 'REC_FLEX' ||
        uPos === 'W/T' ||
        uPos === 'WR_TE_FLEX' ||
        uPos === 'WR_TE'
      ) {
        startingSlots.push({
          id: 'REC_FLEX',
          name: 'Flex (W/T)',
          pos: ['WR', 'TE'],
        });
      } else if (uPos === 'IDP_FLEX') {
        startingSlots.push({
          id: 'IDP_FLEX',
          name: 'IDP Flex',
          pos: ['IDP', 'DL', 'LB', 'DB'] as any[],
        });
      } else if (uPos === 'K') {
        startingSlots.push({id: 'K', name: 'Kicker', pos: ['K']});
      } else if (uPos === 'DEF') {
        startingSlots.push({id: 'DEF', name: 'Defense', pos: ['DEF']});
      } else {
        startingSlots.push({
          id: pos,
          name: pos,
          pos: expandSlotPositions(pos),
        });
      }
    }
  } else if (
    Array.isArray(userRoster?.starters) &&
    userRoster.starters.length === 9
  ) {
    // 9-Starter Standard default
    startingSlots = [
      {id: 'QB', name: 'Quarterback', pos: ['QB']},
      {id: 'RB1', name: 'Running Back 1', pos: ['RB']},
      {id: 'RB2', name: 'Running Back 2', pos: ['RB']},
      {id: 'WR1', name: 'Wide Receiver 1', pos: ['WR']},
      {id: 'WR2', name: 'Wide Receiver 2', pos: ['WR']},
      {id: 'TE', name: 'Tight End', pos: ['TE']},
      {id: 'FLEX', name: 'Flex (W/R/T)', pos: ['WR', 'RB', 'TE']},
      {id: 'K', name: 'Kicker', pos: ['K']},
      {id: 'DEF', name: 'Defense', pos: ['DEF']},
    ];
  } else {
    // 8-Starter Superflex default (canonical league configuration)
    startingSlots = [
      {id: 'QB', name: 'Quarterback', pos: ['QB']},
      {id: 'RB1', name: 'Running Back 1', pos: ['RB']},
      {id: 'RB2', name: 'Running Back 2', pos: ['RB']},
      {id: 'WR1', name: 'Wide Receiver 1', pos: ['WR']},
      {id: 'WR2', name: 'Wide Receiver 2', pos: ['WR']},
      {id: 'TE', name: 'Tight End', pos: ['TE']},
      {id: 'FLEX', name: 'Flex (W/R/T)', pos: ['WR', 'RB', 'TE']},
      {
        id: 'SUPER_FLEX',
        name: 'Superflex (QB/W/R/T)',
        pos: ['QB', 'WR', 'RB', 'TE'],
      },
    ];
  }

  const rosterEligiblePositions: NFLPosition[] = Array.from(
    new Set(startingSlots.flatMap((s) => s.pos)),
  );
  if (rosterEligiblePositions.length === 0) {
    rosterEligiblePositions.push('QB', 'RB', 'WR', 'TE');
  }

  const hasRosterPlayers =
    userRoster &&
    Array.isArray(userRoster.players) &&
    userRoster.players.length > 0;

  if (hasRosterPlayers) {
    // =========================================================================
    // LIVE ROSTER INGESTION MODE (Active league roster from userRoster)
    // =========================================================================
    const rosterPlayerIds: string[] = userRoster.players.map(String);
    const rawStarters: string[] = Array.isArray(userRoster.starters)
      ? userRoster.starters.map(String)
      : [];

    // Mark all rostered players on the cosmic board as 'my_team'
    const teamCosmicPlayers: CosmicPlayer[] = rosterPlayerIds.map((pid) => {
      let matched = scoredCosmicBoard.find((p) => p.id === pid);
      const pick = pickedPlayerMap.get(pid);
      const record = playerDict?.[pid];

      if (matched) {
        matched.draft_status = 'my_team';
        const firstName =
          pick?.metadata?.first_name && pick?.metadata?.last_name
            ? pick.metadata.first_name
            : record?.first_name && record?.last_name
              ? record.first_name
              : matched.first_name;
        const lastName =
          pick?.metadata?.first_name && pick?.metadata?.last_name
            ? pick.metadata.last_name
            : record?.first_name && record?.last_name
              ? record.last_name
              : matched.last_name;
        if (
          (pick?.metadata?.first_name && pick?.metadata?.last_name) ||
          (record?.first_name && record?.last_name)
        ) {
          matched.first_name = firstName;
          matched.last_name = lastName;
          matched.name = `${firstName} ${lastName}`.trim();
        }
        if (pick?.metadata?.position) {
          matched.position =
            pick.metadata.position.toUpperCase() as NFLPosition;
        } else if (record?.position) {
          matched.position = record.position.toUpperCase() as NFLPosition;
        }
        if (record?.team && record.team !== 'FA' && record.team !== 'NFL') {
          matched.team = record.team;
        } else if (pick?.metadata?.team) {
          matched.team = pick.metadata.team;
        } else if (record?.team) {
          matched.team = record.team;
        }
        matched.bye_week = getTeamByeWeek(matched.team) ?? matched.bye_week;
        if (pick?.metadata?.number) {
          matched.jersey_number = Number(pick.metadata.number);
        } else if (record?.number !== undefined && record?.number !== null) {
          matched.jersey_number = record.number;
        }
        if (pick?.metadata?.status) {
          matched.status = pick.metadata.status;
        } else if (record?.status) {
          matched.status = record.status;
        }
        if (record !== undefined) {
          matched.injury_status = record.injury_status ?? null;
        } else if (pick?.metadata?.injury_status !== undefined) {
          matched.injury_status = pick.metadata.injury_status;
        }
        return matched;
      }
      const synthesized = synthesizeCosmicPlayerFromId(
        pid,
        playerDict,
        true,
        pick?.metadata,
      );
      scoredCosmicBoard.push(synthesized);
      return synthesized;
    });

    const assignedPlayerIds = new Set<string>();
    const rosterStarters: RosterSlot[] = [];

    // Pass 1: Map starters directly from userRoster.starters if aligned with startingSlots
    for (let i = 0; i < startingSlots.length; i++) {
      const slotDef = startingSlots[i];
      const starterId = rawStarters[i];
      let assignedPlayer: CosmicPlayer | null = null;

      if (starterId && starterId !== '0') {
        assignedPlayer =
          teamCosmicPlayers.find((p) => p.id === starterId) || null;
        if (assignedPlayer) {
          assignedPlayerIds.add(starterId);
        }
      }

      rosterStarters.push({
        slot_id: slotDef.id,
        slot_name: slotDef.name,
        eligible_positions: slotDef.pos,
        player: assignedPlayer,
      });
    }

    // Pass 2: If any starter slot remains vacant (e.g. starter was '0' or starters array was empty), fill from unassigned team players
    for (const slot of rosterStarters) {
      if (!slot.player) {
        for (const player of teamCosmicPlayers) {
          if (
            !assignedPlayerIds.has(player.id) &&
            slot.eligible_positions.includes(player.position)
          ) {
            slot.player = player;
            assignedPlayerIds.add(player.id);
            break;
          }
        }
      }
    }

    // Pass 3: Bench slots (BN1..BN{N}) for remaining players
    const rosterBench: RosterSlot[] = [];
    let benchIdx = 1;
    for (const player of teamCosmicPlayers) {
      if (!assignedPlayerIds.has(player.id)) {
        rosterBench.push({
          slot_id: `BN${benchIdx}` as `BN${number}`,
          slot_name: `Bench ${benchIdx}`,
          eligible_positions: rosterEligiblePositions,
          player,
        });
        assignedPlayerIds.add(player.id);
        benchIdx++;
      }
    }

    // Pad bench slots if needed to ensure total roster length is at least 15
    while (rosterStarters.length + rosterBench.length < 15) {
      rosterBench.push({
        slot_id: `BN${benchIdx}` as `BN${number}`,
        slot_name: `Bench ${benchIdx}`,
        eligible_positions: rosterEligiblePositions,
        player: null,
      });
      benchIdx++;
    }

    fullRoster = [...rosterStarters, ...rosterBench];
  } else {
    // =========================================================================
    // DRAFT PICKS FALLBACK MODE (Pre-draft or pure draft data)
    // =========================================================================
    const userCosmicPlayers: CosmicPlayer[] = userPicks.map((up) => {
      let matched = scoredCosmicBoard.find((p) => p.id === up.player_id);
      const pick = up;
      const record = playerDict?.[up.player_id];
      if (matched) {
        matched.draft_status = 'my_team';
        const firstName =
          pick?.metadata?.first_name && pick?.metadata?.last_name
            ? pick.metadata.first_name
            : record?.first_name && record?.last_name
              ? record.first_name
              : matched.first_name;
        const lastName =
          pick?.metadata?.first_name && pick?.metadata?.last_name
            ? pick.metadata.last_name
            : record?.first_name && record?.last_name
              ? record.last_name
              : matched.last_name;
        if (
          (pick?.metadata?.first_name && pick?.metadata?.last_name) ||
          (record?.first_name && record?.last_name)
        ) {
          matched.first_name = firstName;
          matched.last_name = lastName;
          matched.name = `${firstName} ${lastName}`.trim();
        }
        if (pick?.metadata?.position) {
          matched.position =
            pick.metadata.position.toUpperCase() as NFLPosition;
        } else if (record?.position) {
          matched.position = record.position.toUpperCase() as NFLPosition;
        }
        if (record?.team && record.team !== 'FA' && record.team !== 'NFL') {
          matched.team = record.team;
        } else if (pick?.metadata?.team) {
          matched.team = pick.metadata.team;
        } else if (record?.team) {
          matched.team = record.team;
        }
        matched.bye_week = getTeamByeWeek(matched.team) ?? matched.bye_week;
        if (pick?.metadata?.number) {
          matched.jersey_number = Number(pick.metadata.number);
        } else if (record?.number !== undefined && record?.number !== null) {
          matched.jersey_number = record.number;
        }
        if (pick?.metadata?.status) {
          matched.status = pick.metadata.status;
        } else if (record?.status) {
          matched.status = record.status;
        }
        if (record !== undefined) {
          matched.injury_status = record.injury_status ?? null;
        } else if (pick?.metadata?.injury_status !== undefined) {
          matched.injury_status = pick.metadata.injury_status;
        }
        return matched;
      }
      const synthesized = synthesizeCosmicPlayer(up, playerDict, true);
      scoredCosmicBoard.push(synthesized);
      return synthesized;
    });

    const assignedPlayerIds = new Set<string>();
    const rosterStarters: RosterSlot[] = [];

    // Pass 1: Strict primary starters (single position slots like QB, RB1, RB2, WR1, WR2, TE, K, DEF)
    for (const slotDef of startingSlots) {
      if (
        ['FLEX', 'SUPER_FLEX', 'WRRB_FLEX', 'REC_FLEX', 'IDP_FLEX'].includes(
          slotDef.id,
        )
      ) {
        rosterStarters.push({
          slot_id: slotDef.id,
          slot_name: slotDef.name,
          eligible_positions: slotDef.pos,
          player: null,
        });
        continue;
      }
      let assignedPlayer: CosmicPlayer | null = null;
      const candidates = userCosmicPlayers
        .filter(
          (p) =>
            !assignedPlayerIds.has(p.id) && slotDef.pos.includes(p.position),
        )
        .sort((a, b) => {
          const aInjured = ['Out', 'IR', 'Doubtful'].includes(
            a.injury_status || '',
          );
          const bInjured = ['Out', 'IR', 'Doubtful'].includes(
            b.injury_status || '',
          );
          if (aInjured !== bInjured) return aInjured ? 1 : -1;
          return (b.projected_points || 0) - (a.projected_points || 0);
        });

      if (candidates.length > 0) {
        assignedPlayer = candidates[0];
        assignedPlayerIds.add(assignedPlayer.id);
      }

      rosterStarters.push({
        slot_id: slotDef.id,
        slot_name: slotDef.name,
        eligible_positions: slotDef.pos,
        player: assignedPlayer,
      });
    }

    // Pass 2: FLEX / SUPER_FLEX slots
    for (const slot of rosterStarters) {
      if (
        !slot.player &&
        ['FLEX', 'SUPER_FLEX', 'WRRB_FLEX', 'REC_FLEX', 'IDP_FLEX'].includes(
          slot.slot_id,
        )
      ) {
        const candidates = userCosmicPlayers
          .filter(
            (p) =>
              !assignedPlayerIds.has(p.id) &&
              slot.eligible_positions.includes(p.position),
          )
          .sort((a, b) => {
            const aInjured = ['Out', 'IR', 'Doubtful'].includes(
              a.injury_status || '',
            );
            const bInjured = ['Out', 'IR', 'Doubtful'].includes(
              b.injury_status || '',
            );
            if (aInjured !== bInjured) return aInjured ? 1 : -1;
            return (b.projected_points || 0) - (a.projected_points || 0);
          });
        if (candidates.length > 0) {
          slot.player = candidates[0];
          assignedPlayerIds.add(candidates[0].id);
        }
      }
    }

    // Pass 3: Bench Slots for remaining players
    const rosterBench: RosterSlot[] = [];
    let benchIdx = 1;
    for (const player of userCosmicPlayers) {
      if (!assignedPlayerIds.has(player.id)) {
        rosterBench.push({
          slot_id: `BN${benchIdx}` as `BN${number}`,
          slot_name: `Bench ${benchIdx}`,
          eligible_positions: rosterEligiblePositions,
          player,
        });
        assignedPlayerIds.add(player.id);
        benchIdx++;
      }
    }

    // Pad bench slots up to total roster size (at least 15 slots total)
    const targetRosterSize = Math.max(15, startingSlots.length + 7);
    while (rosterStarters.length + rosterBench.length < targetRosterSize) {
      rosterBench.push({
        slot_id: `BN${benchIdx}` as `BN${number}`,
        slot_name: `Bench ${benchIdx}`,
        eligible_positions: rosterEligiblePositions,
        player: null,
      });
      benchIdx++;
    }

    fullRoster = [...rosterStarters, ...rosterBench];
  }

  // Calculate Elemental Distribution
  const elementalDistribution: ElementalDistribution = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };
  for (const slot of fullRoster) {
    const el = slot.player?.elemental_traits?.element;
    if (el && el in elementalDistribution) {
      elementalDistribution[el]++;
    }
  }

  // Recompute squad harmony, spirit_score, and draft_score against the resolved user fullRoster
  const activeLambda = settings.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  for (let i = 0; i < scoredCosmicBoard.length; i++) {
    const p = scoredCosmicBoard[i];
    const baseRosterHarmony = calculateHarmony(
      fullRoster,
      p,
      currentPick.round || 1,
    );
    const natalHarmony =
      p.divination_breakdown?.harmony ?? p.harmony_score ?? 75.0;
    const blendedHarmony = Number(
      Math.min(
        99.0,
        Math.max(35.0, 0.65 * baseRosterHarmony + 0.35 * natalHarmony),
      ).toFixed(1),
    );
    const updatedBreakdown = {
      ...(p.divination_breakdown || {
        celestial: 78.0,
        numeric: 74.0,
        geomantic: 76.0,
        oracular: 72.0,
        harmony: blendedHarmony,
      }),
      harmony: blendedHarmony,
    };
    const updatedSpirit = computeSpiritScore(
      updatedBreakdown,
      settings.oracle_weights,
    );
    const updatedDraft = computeDraftScore(
      p.vor_normalized,
      updatedSpirit,
      activeLambda,
    );
    p.harmony_score = blendedHarmony;
    p.divination_breakdown = updatedBreakdown;
    p.spirit_score = updatedSpirit;
    p.draft_score = updatedDraft;
  }

  // The blend above changes Spirit, so refresh each player's saved Stars (it
  // was computed before the blend), and give any roster-slot copies the same
  // numbers as the player list.
  const refreshed = recomputeDraftScores(scoredCosmicBoard, settings);
  const refreshedById = new Map<string, CosmicPlayer>();
  for (let i = 0; i < scoredCosmicBoard.length; i++) {
    scoredCosmicBoard[i].favorability_score = refreshed[i].favorability_score;
    scoredCosmicBoard[i].favorability_verdict = refreshed[i].favorability_verdict;
    refreshedById.set(String(scoredCosmicBoard[i].id), scoredCosmicBoard[i]);
  }
  for (const slot of fullRoster) {
    const fresh = slot.player ? refreshedById.get(String(slot.player.id)) : undefined;
    if (!slot.player || !fresh) continue;
    slot.player = {
      ...slot.player,
      harmony_score: fresh.harmony_score,
      divination_breakdown: fresh.divination_breakdown,
      spirit_score: fresh.spirit_score,
      draft_score: fresh.draft_score,
      favorability_score: fresh.favorability_score,
      favorability_verdict: fresh.favorability_verdict,
    };
  }

  const targetSlot =
    settings.user_slot || (userRoster ? Number(userRoster.roster_id) : 7);

  // Update Path of Ascension
  const idealPath: AscensionStep[] = (
    scoredCosmicBoard && scoredCosmicBoard.length > 0
      ? generateAscensionPath(
          scoredCosmicBoard,
          targetSlot,
          rounds,
          teams,
        )
      : isExplicitMock
        ? mockIdealDraftPath
        : []
  ).map((step) => {
    const pickAtRound = userPicks.find((p) => p.round === step.round);
    if (pickAtRound) {
      return {
        ...step,
        is_ascended: true,
        actual_picked_player_id: pickAtRound.player_id,
      };
    }
    return {
      ...step,
      is_ascended: false,
      actual_picked_player_id: null,
    };
  });

  let competitorTeams: CompetitorTeam[] =
    isExplicitMock
      ? mockCompetitorTeams.map((t) => {
          const isUser = t.slot === targetSlot;
          const baseName = t.name.replace(/\s*\(You\)\s*/g, '').trim();
          return {
            ...t,
            is_user: isUser,
            name: isUser ? `${baseName} (You)` : baseName,
            avatar_url: t.avatar_url || getSleeperAvatarUrl(t.avatar),
          };
        })
      : [];
  const userMap = new Map<string, any>();
  if (Array.isArray(leagueUsers)) {
    for (const u of leagueUsers) {
      userMap.set(String(u.user_id), u);
    }
  }

  // Determine the single primary user roster ID
  let userTeamRosterId: number = targetSlot;
  if (Array.isArray(leagueRosters) && leagueRosters.length > 0) {
    if (explicitSlot === undefined) {
      if (userRoster && userRoster.roster_id !== undefined) {
        userTeamRosterId = Number(userRoster.roster_id);
      } else if (settings.user_id) {
        const match = leagueRosters.find(
          (r: any) => String(r.owner_id || '') === String(settings.user_id),
        );
        if (match) userTeamRosterId = Number(match.roster_id);
      }
    } else {
      const slotMatch = leagueRosters.find((r: any) => {
        const ownerId = String(r.owner_id || '');
        const slot = metadata.draft_order?.[ownerId] ?? Number(r.roster_id);
        return slot === explicitSlot;
      });
      if (slotMatch) {
        userTeamRosterId = Number(slotMatch.roster_id);
      }
    }

    competitorTeams = leagueRosters
      .map((r: any) => {
        const ownerId = String(r.owner_id || '');
        const userObj = userMap.get(ownerId);
        const slot =
          metadata.draft_order?.[ownerId] ?? Number(r.roster_id) ?? 1;
        const isUser = Number(r.roster_id) === userTeamRosterId;
        const customTeamName = userObj?.metadata?.team_name?.trim();
        const displayName = (
          userObj?.display_name ||
          userObj?.username ||
          `Team ${r.roster_id}`
        ).trim();
        const name = isUser
          ? customTeamName
            ? `${customTeamName} (You)`
            : `${displayName} (You)`
          : customTeamName || displayName;
        const ownerName = displayName;
        const metadataAvatar =
          userObj?.metadata?.avatar || r.metadata?.avatar || null;
        const avatarHash = userObj?.avatar || null;
        const avatarUrl = resolveSleeperAvatarUrl(avatarHash, {metadataAvatar});
        const avatar = avatarHash || null;
        if (avatarUrl) {
          setAvatarInCache(
            [
              ownerId,
              userObj?.user_id,
              r.roster_id,
              `roster_${r.roster_id}`,
              `slot_${slot}`,
              avatarHash,
              displayName,
              userObj?.username,
              name,
              avatarUrl,
            ],
            avatarUrl,
          );
        }
        const teamPicks = picks.filter(
          (p) =>
            (p.picked_by && p.picked_by === ownerId) ||
            p.roster_id === r.roster_id ||
            p.draft_slot === slot,
        );

        // This week's lineup lives on the current-week matchup; the roster's
        // own starters field can lag behind it.
        const weekMatch = Array.isArray(leagueMatchups)
          ? leagueMatchups.find((m: any) => Number(m.roster_id) === Number(r.roster_id))
          : undefined;
        const lineupSource =
          Array.isArray(weekMatch?.starters) && weekMatch.starters.length > 0
            ? weekMatch.starters
            : r.starters;
        const teamStarters = Array.isArray(lineupSource)
          ? lineupSource.filter((id: any) => id && String(id) !== '0').map(String)
          : [];
        const teamMetrics = calculateTeamCelestialMetrics(
          { slot, roster_id: r.roster_id, picks: teamPicks, players: r.players, starters: teamStarters },
          scoredCosmicBoard,
        );
        const avg_spirit_score = teamMetrics.spiritScore;
        const avg_draft_score = teamMetrics.draftScore;
        const harmony_score = teamMetrics.harmonyScore;
        const total_spirit_score = Math.round(avg_spirit_score * 15 * 10) / 10;
        const total_draft_score = Math.round(avg_draft_score * 15 * 10) / 10;
        const favorability_tier: 'Favorable' | 'Harmonic' | 'Discordant' =
          teamMetrics.tier === 'Volatile' ? 'Harmonic' : teamMetrics.tier;
        const favorability_label = teamMetrics.verdict;

        const teamPlayersList = Array.isArray(r.players)
          ? r.players.filter(Boolean).map(String)
          : [];

        return {
          slot,
          roster_id: Number(r.roster_id),
          owner_id: ownerId,
          name,
          owner_name: ownerName,
          avatar,
          avatar_url: avatarUrl,
          picks: teamPicks,
          starters: teamStarters,
          players: teamPlayersList,
          total_draft_score,
          total_spirit_score,
          avg_draft_score,
          avg_spirit_score,
          harmony_score,
          favorability_tier,
          favorability_label,
          is_user: isUser,
          wins: Number(r.settings?.wins ?? 0),
          losses: Number(r.settings?.losses ?? 0),
          ties: Number(r.settings?.ties ?? 0),
          points_for:
            Math.round(
              (Number(r.settings?.fpts ?? 0) + Number(r.settings?.fpts_decimal ?? 0) / 100) * 100,
            ) / 100,
        };
      })
      .sort((a, b) => a.slot - b.slot);
  }

  const activeUserTeam =
    competitorTeams.find((t) => t.is_user) || competitorTeams[0];
  const userPlayerIdSet = new Set<string>(
    fullRoster
      .filter((s) => s.player !== null)
      .map((s) => String(s.player!.id)),
  );
  const compOwnerByPid = new Map<string, {name: string; ownerId?: string}>();

  // 1. Build competitor ownership directly from leagueRosters
  if (Array.isArray(leagueRosters) && leagueRosters.length > 0) {
    for (const r of leagueRosters) {
      if (Number(r.roster_id) === userTeamRosterId) continue;
      const ownerId = String(r.owner_id || '');
      const userObj = userMap.get(ownerId);
      const customTeamName = userObj?.metadata?.team_name?.trim();
      const displayName = (
        userObj?.display_name ||
        userObj?.username ||
        `Team ${r.roster_id}`
      ).trim();
      const cleanName = (customTeamName || displayName)
        .replace(/\s*\(You\)$/, '')
        .trim();
      const rPlayerList =
        Array.isArray(r.players) && r.players.length > 0
          ? r.players
          : Array.isArray(r.starters)
            ? r.starters
            : [];
      for (const pid of rPlayerList) {
        if (pid && String(pid) !== '0') {
          compOwnerByPid.set(String(pid), {
            name: cleanName,
            ownerId: ownerId || undefined,
          });
        }
      }
    }
  }

  // 2. Incorporate competitor picks from draft if roster sync is not yet complete
  for (const ct of competitorTeams) {
    if (ct.is_user) continue;
    const cleanName = ct.name.replace(/\s*\(You\)$/, '').trim();
    if (!hasCompletedRosterSync) {
      for (const pk of ct.picks || []) {
        if (pk?.player_id) {
          compOwnerByPid.set(String(pk.player_id), {
            name: cleanName,
            ownerId: ct.owner_id,
          });
        }
      }
    }
    const ctPlayerList =
      Array.isArray(ct.players) && ct.players.length > 0
        ? ct.players
        : Array.isArray(ct.starters)
          ? ct.starters
          : [];
    for (const pid of ctPlayerList) {
      if (pid && String(pid) !== '0') {
        compOwnerByPid.set(String(pid), {
          name: cleanName,
          ownerId: ct.owner_id,
        });
      }
    }
  }

  const userTeamCleanName = (activeUserTeam?.name || 'Your Team')
    .replace(/\s*\(You\)$/, '')
    .trim();

  // Skip the availability reset pass if competitor roster data is unpopulated
  const shouldResetAvailability =
    hasPopulatedLeagueRosters &&
    (Array.isArray(leagueRosters) && leagueRosters.length > 1
      ? compOwnerByPid.size > 0
      : true);

  for (const bp of scoredCosmicBoard) {
    const pid = String(bp.id);
    if (userPlayerIdSet.has(pid)) {
      bp.draft_status = 'my_team';
      bp.drafted_by = userTeamCleanName;
    } else if (compOwnerByPid.has(pid)) {
      const owner = compOwnerByPid.get(pid)!;
      bp.draft_status = 'drafted';
      bp.drafted_by = owner.name;
      if (owner.ownerId) {
        bp.drafted_by_user_id = owner.ownerId;
      }
    } else if (shouldResetAvailability) {
      bp.draft_status = 'available';
      bp.drafted_by = undefined;
      bp.drafted_by_user_id = null;
    }
  }
  const userAvatarUrl =
    activeUserTeam?.avatar_url ||
    (activeUserTeam?.avatar
      ? getSleeperAvatarUrl(activeUserTeam.avatar)
      : null);
  if (userAvatarUrl) {
    setAvatarInCache(
      [
        activeUserTeam?.owner_id,
        activeUserTeam?.roster_id,
        `roster_${activeUserTeam?.roster_id}`,
        `slot_${activeUserTeam?.slot}`,
        activeUserTeam?.avatar,
        activeUserTeam?.name,
        activeUserTeam?.owner_name,
        userAvatarUrl,
      ],
      userAvatarUrl,
    );
  }

  const userRosterId = activeUserTeam?.roster_id ?? targetSlot;
  const resolvedWeek = activeWeek || leagueDetails?.settings?.leg || 2;
  const weeklyMatchup =
    !isExplicitMock && competitorTeams.length === 0
      ? undefined
      : deriveWeeklyMatchup(
          userRosterId,
          competitorTeams,
          leagueMatchups,
          scoredCosmicBoard,
          fullRoster,
          resolvedWeek,
        );

  // Dynamically reconcile waiver upgrades and trade proposals with active user roster
  const activeUserBench = fullRoster.filter(
    (s) => s.slot_id.startsWith('BN') && s.player !== null,
  );
  const activeUserPlayers = fullRoster
    .filter((s) => s.player !== null)
    .map((s) => s.player!);

  // Collect set of ALL player IDs rostered by ANY team in the league
  const allRosteredPlayerIds = new Set<string>();
  if (Array.isArray(leagueRosters)) {
    for (const r of leagueRosters) {
      if (Array.isArray(r.players)) {
        for (const pid of r.players) {
          if (pid) allRosteredPlayerIds.add(String(pid));
        }
      }
    }
  }
  if (Array.isArray(picks)) {
    for (const p of picks) {
      if (p.player_id) allRosteredPlayerIds.add(String(p.player_id));
    }
  }
  for (const s of fullRoster) {
    if (s.player?.id) {
      allRosteredPlayerIds.add(String(s.player.id));
    }
  }

  const resolvedRosterPositions: string[] | undefined =
    activeRosterPositions ||
    (Array.isArray(userSettings?.roster_positions)
      ? userSettings.roster_positions
      : undefined);

  const leagueEligiblePositions = deriveEligiblePositions(
    resolvedRosterPositions,
    fullRoster,
  );
  const leagueEligibleSet = new Set<string>(leagueEligiblePositions);

  const unownedFreeAgents = scoredCosmicBoard
    .filter(
      (p) =>
        !allRosteredPlayerIds.has(String(p.id)) &&
        p.draft_status !== 'my_team' &&
        p.draft_status !== 'drafted' &&
        leagueEligibleSet.has(p.position),
    )
    .sort((a, b) => (b.draft_score || 0) - (a.draft_score || 0));

  // A bench player projected at zero only because their team is on bye this
  // week is not a drop candidate.
  const currentWeek = getSeasonContext()?.currentWeek ?? activeWeek;
  const sortedWeakestBench = [...activeUserBench]
    .filter((b) => b.player && leagueEligibleSet.has(b.player.position))
    .filter((b) => !isPlayerOnByeWeek(currentWeek, b.player?.bye_week, b.player?.team, getSeasonContext()?.byeWeeks))
    .sort(
      (a, b) =>
        (a.player?.draft_score ?? 0) - (b.player?.draft_score ?? 0) ||
        (a.player?.projected_points ?? 0) - (b.player?.projected_points ?? 0),
    );

  const reconciledWaiverUpgrades: WaiverUpgrade[] =
    unownedFreeAgents.length > 0
      ? unownedFreeAgents
          .slice(0, 8)
          .map((fa, idx) => {
            const samePosWeakBench = sortedWeakestBench.find(
              (b) =>
                b.player?.position === fa.position &&
                (fa.draft_score || 0) > (b.player?.draft_score || 0),
            );
            const dropSlot =
              samePosWeakBench ||
              sortedWeakestBench[idx % Math.max(1, sortedWeakestBench.length)];

            // Only ever recommend dropping a bench player, never a starter.
            const dropPlayer = dropSlot?.player;
            if (!dropPlayer) return null;
            const dropId = dropPlayer ? dropPlayer.id : '0';
            const dropName = dropPlayer ? dropPlayer.name : 'Bench Reserve';
            const dropPos = (
              dropPlayer ? dropPlayer.position : fa.position
            ) as NFLPosition;
            const dropTeam = dropPlayer ? dropPlayer.team : 'NFL';
            const dropDS = dropPlayer ? dropPlayer.draft_score : 50.0;
            const dropProj = dropPlayer
              ? (dropPlayer.sleeper_projected_points ??
                dropPlayer.projected_points ??
                0)
              : 0.0;
            const faProj =
              fa.sleeper_projected_points ?? fa.projected_points ?? 0.0;

            const rawScoreDelta =
              Math.round((fa.draft_score - dropDS) * 10) / 10;
            const rawProjDelta = Math.round((faProj - dropProj) * 10) / 10;
            const netScoreDelta = hasLiveProjections
              ? rawScoreDelta
              : Math.max(0.5, rawScoreDelta);
            const netProjDelta = hasLiveProjections
              ? rawProjDelta
              : Math.max(0.5, rawProjDelta);

            return {
              id: String(fa.id),
              name: fa.name,
              position: fa.position as NFLPosition,
              team: fa.team || 'NFL',
              projected_points: faProj,
              spirit_score: fa.spirit_score || 80.0,
              draft_score: fa.draft_score || 75.0,
              recommended_drop_id: dropId,
              recommended_drop_name: dropName,
              recommended_drop_position: dropPos,
              recommended_drop_team: dropTeam,
              net_score_delta: netScoreDelta,
              net_projected_delta: netProjDelta,
              divination_rationale: `${fa.name} (${faProj.toFixed(1)} pts/wk) provides +${netScoreDelta.toFixed(1)} DS and ${netProjDelta >= 0 ? `+${netProjDelta.toFixed(1)}` : netProjDelta.toFixed(1)} pts/wk over bench reserve ${dropName} (${dropProj.toFixed(1)} pts/wk).`,
              waiver_priority_rank: idx + 1,
              priority_tier:
                idx === 0 ? 'Urgent' : idx < 3 ? 'Favorable' : 'Speculative',
              waiver_wire_rationale: `${fa.name} (${faProj.toFixed(1)} pts/wk) provides +${netScoreDelta.toFixed(1)} DS and ${netProjDelta >= 0 ? `+${netProjDelta.toFixed(1)}` : netProjDelta.toFixed(1)} pts/wk over bench reserve ${dropName} (${dropProj.toFixed(1)} pts/wk).`,
            };
          })
          .filter((u): u is NonNullable<typeof u> => u !== null)
          .filter(
            (u) =>
              !hasLiveProjections ||
              u.net_score_delta > 0 ||
              u.net_projected_delta > 0,
          )
          .slice(0, 5)
          .map((u, i) => ({...u, waiver_priority_rank: i + 1}))
      : isExplicitMock
        ? mockWaiverUpgrades.filter((w) => leagueEligibleSet.has(w.position))
        : [];

  const eligibleActiveUserPlayers = activeUserPlayers.filter((p) =>
    leagueEligibleSet.has(p.position),
  );
  const reconciledTradeProposals: TradeProposal[] = (() => {
    if (!isExplicitMock) {
      return [];
    }
    const baseTrades = mockTradeProposals.filter(
      (tp) =>
        !tp.receive_players ||
        tp.receive_players.length === 0 ||
        tp.receive_players.every((p) => leagueEligibleSet.has(p.position)),
    );
    if (eligibleActiveUserPlayers.length === 0) return baseTrades;
    return baseTrades.map((tp, idx) => {
      const reconciledGive = tp.give_players.map((gp, gIdx) => {
        const isOnRoster = eligibleActiveUserPlayers.some(
          (p) => p.id === gp.player_id,
        );
        if (!isOnRoster && eligibleActiveUserPlayers.length > 0) {
          const tradeCandidates = eligibleActiveUserPlayers.filter(
            (p) =>
              (p.sleeper_projected_points ?? p.projected_points ?? 0) > 5.0,
          );
          const pool =
            tradeCandidates.length > 0
              ? tradeCandidates
              : eligibleActiveUserPlayers;
          const replacement = pool[(idx + gIdx) % pool.length];
          return {
            player_id: replacement.id,
            player_name: replacement.name,
            position: replacement.position,
            projected_points:
              replacement.sleeper_projected_points ??
              replacement.projected_points,
            spirit_score: replacement.spirit_score || 80.0,
            element: replacement.elemental_traits.element,
          };
        }
        return gp;
      });
      return {
        ...tp,
        give_players: reconciledGive,
      };
    });
  })();

  if (weeklyMatchup && isExplicitMock) {
    weeklyMatchup.team_comparison =
      weeklyMatchup.team_comparison || mockTeamComparison;
    weeklyMatchup.player_favorabilities =
      weeklyMatchup.player_favorabilities || mockPlayerFavorabilities;
    weeklyMatchup.past_matchups =
      weeklyMatchup.past_matchups || mockPastMatchups;
    weeklyMatchup.upcoming_matchups =
      weeklyMatchup.upcoming_matchups || mockMatchupWeeks;
  }

  settings.roster_positions = activeRosterPositions;
  settings.user_avatar = activeUserTeam?.avatar || null;
  settings.user_avatar_url = userAvatarUrl;

  return {
    draft_id: metadata.draft_id,
    status,
    current_pick: currentPick,
    cosmic_board: scoredCosmicBoard,
    ideal_draft_path: idealPath,
    my_roster: fullRoster,
    weekly_coverage: derive18WeekCoverage(fullRoster, activeRosterPositions),
    elemental_traits: elementalDistribution,
    waiver_upgrades: reconciledWaiverUpgrades,
    trade_proposals: reconciledTradeProposals,
    settings,
    available_leagues: settings.available_leagues,
    isLive: !isExplicitMock,
    mode: isExplicitMock ? 'mock' : 'live',
    competitor_teams: competitorTeams,
    weekly_matchup: weeklyMatchup,
    roster_positions: activeRosterPositions,
    avatar: activeUserTeam?.avatar || null,
    avatar_url: userAvatarUrl,
    user_avatar_url: userAvatarUrl,
  };
}

// ============================================================================
// Top-Level Draft Poller & League Resolution Orchestrator
// ============================================================================

/**
 * Dynamically resolves active draft_id, user_id, and user_slot from a Sleeper league:
 * - Drafts: GET /v1/league/<league_id>/drafts (Reference: https://docs.sleeper.com/#drafts)
 * - Rosters: GET /v1/league/<league_id>/rosters (Reference: https://docs.sleeper.com/#rosters)
 * - Users: GET /v1/league/<league_id>/users (Reference: https://docs.sleeper.com/#users-in-a-league)
 * Matches username flexibly (case-insensitive display_name, username, or 'oneirovan' substring).
 */
export async function resolveLeagueDraftAndUser(
  leagueId: string,
  username: string,
  signal?: AbortSignal,
): Promise<ResolvedLeagueSetup> {
  if (signal?.aborted) {
    throw new Error('Sync aborted');
  }
  if (!leagueId) {
    throw new Error('League ID must be provided to resolve league setup.');
  }
  if (isRateLimited()) {
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  checkRateLimit();
  const cleanUsername = (username || '').replace(/^@/, '').toLowerCase().trim();

  // 1. Fetch league drafts: GET /league/<league_id>/drafts
  const draftsRes = await fetchWithTimeout(
    `${SLEEPER_BASE_URL}/league/${leagueId}/drafts`,
    REQUEST_TIMEOUT_MS,
    signal,
  );
  if (draftsRes.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  if (!draftsRes.ok) {
    throw new Error(
      `Failed to fetch drafts for league ${leagueId} (HTTP ${draftsRes.status})`,
    );
  }
  const drafts = (await draftsRes.json()) as SleeperLeagueDraft[];
  if (!Array.isArray(drafts) || drafts.length === 0) {
    throw new Error(`No drafts found for league ${leagueId}`);
  }

  // Find active / in-progress or latest completed draft
  const activeDraft =
    drafts.find((d) => d.status === 'drafting') ||
    drafts.find((d) => d.status === 'in_progress') ||
    drafts.find((d) => d.status === 'complete' || d.status === 'finished') ||
    drafts[0];
  const draft_id = String(activeDraft.draft_id);

  // 2. Fetch league users: GET /league/<league_id>/users
  const usersRes = await fetchWithTimeout(
    `${SLEEPER_BASE_URL}/league/${leagueId}/users`,
    REQUEST_TIMEOUT_MS,
    signal,
  );
  if (usersRes.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  if (!usersRes.ok) {
    throw new Error(
      `Failed to fetch users for league ${leagueId} (HTTP ${usersRes.status})`,
    );
  }
  const users = (await usersRes.json()) as SleeperUser[];
  const internalAliases = cachedInternalProfile?.search_aliases || [];
  const isCanonicalSearch =
    !cleanUsername ||
    cleanUsername.includes('oneirovan') ||
    cleanUsername.includes('oneirovanguard') ||
    cleanUsername.includes('astraloracles') ||
    cleanUsername === '9000000000000000101' ||
    cleanUsername === 'user_oneiromancy_me' ||
    internalAliases.some((a) => cleanUsername.includes(a.toLowerCase()));

  const matchedUser = Array.isArray(users)
    ? users.find((u: SleeperUser) => {
        const uName = (u.username || '').toLowerCase();
        const dName = (u.display_name || '').toLowerCase();
        const tName = (u.metadata?.team_name || '').toLowerCase();
        const uid = String(u.user_id || '');
        if (cleanUsername) {
          if (
            uName === cleanUsername ||
            dName === cleanUsername ||
            tName === cleanUsername ||
            uid === cleanUsername
          ) {
            return true;
          }
          if (
            cleanUsername.length >= 3 &&
            (uName.includes(cleanUsername) ||
              dName.includes(cleanUsername) ||
              tName.includes(cleanUsername))
          ) {
            return true;
          }
          if (isCanonicalSearch) {
            return (
              uName.includes('oneirovan') ||
              dName.includes('oneirovan') ||
              tName.includes('astraloracles') ||
              uid === '9000000000000000101' ||
              internalAliases.some(
                (a) =>
                  uName.includes(a.toLowerCase()) ||
                  dName.includes(a.toLowerCase()) ||
                  tName.includes(a.toLowerCase()) ||
                  uid === a,
              )
            );
          }
          return false;
        }
        return (
          uName.includes('oneirovan') ||
          dName.includes('oneirovan') ||
          tName.includes('astraloracles') ||
          uid === '9000000000000000101' ||
          internalAliases.some(
            (a) =>
              uName.includes(a.toLowerCase()) ||
              dName.includes(a.toLowerCase()) ||
              tName.includes(a.toLowerCase()) ||
              uid === a,
          )
        );
      })
    : null;

  if (!matchedUser) {
    throw new Error(
      `User '${username || cleanUsername}' not found in Sleeper league ${leagueId}`,
    );
  }
  const user_id = String(matchedUser.user_id);
  const display_name = String(
    matchedUser.display_name || matchedUser.username || username,
  );

  // 3. Resolve user draft slot from draft order or rosters
  let user_slot = 1;
  try {
    const draftDetailRes = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/draft/${draft_id}`,
      REQUEST_TIMEOUT_MS,
      signal,
    );
    if (draftDetailRes.ok) {
      const draftDetail = await draftDetailRes.json();
      const draftOrder = draftDetail.draft_order || {};
      if (draftOrder[user_id] !== undefined) {
        user_slot = Number(draftOrder[user_id]);
      } else {
        // Fallback: query league rosters
        const rostersRes = await fetchWithTimeout(
          `${SLEEPER_BASE_URL}/league/${leagueId}/rosters`,
          REQUEST_TIMEOUT_MS,
          signal,
        );
        if (rostersRes.ok) {
          const rosters = (await rostersRes.json()) as SleeperRoster[];
          if (Array.isArray(rosters)) {
            const userRoster = rosters.find(
              (r) => String(r.owner_id) === user_id,
            );
            if (userRoster && userRoster.roster_id !== undefined) {
              user_slot = Number(userRoster.roster_id);
            }
          }
        }
      }
    }
  } catch (slotErr: unknown) {
    if (signal?.aborted) {
      throw toAbortError(slotErr);
    }
    logSleeperWarning(
      '[Sleeper] Draft slot resolution warning, defaulting to slot 1:',
      slotErr,
    );
  }

  return {
    draft_id,
    user_id,
    user_slot,
    display_name,
  };
}

/**
 * Connects to live Sleeper API.
 * If draftId is not known or is mock/league_id, dynamically resolves draft ID and user slot from league.
 * Returns DraftState with isLive: true.
 * Throws on error if throwOnError option is specified, or returns fallback state with error details.
 */
export async function fetchSleeperDraft(
  draftId?: string,
  userSettings?: Partial<OneiromancySettings>,
  playerDict?: Record<string, SleeperPlayerRecord>,
  options?: {throwOnError?: boolean; signal?: AbortSignal},
): Promise<DraftState> {
  if (options?.signal?.aborted) {
    throw new Error('Sync aborted');
  }
  if (draftId === 'mock') {
    setSeasonContext(null);
    return transformToDraftState(
      mockDraftMetadata,
      mockPicks,
      userSettings,
      playerDict,
    );
  }

  let effectiveDraftId = draftId;
  let effectiveSettings: Partial<OneiromancySettings> = {...userSettings};
  let availableLeagues: AvailableLeague[] =
    userSettings?.available_leagues || [];
  const requestedUsername = (
    userSettings?.sleeper_username ?? (userSettings ? '' : 'OneiroVanguard')
  ).trim();

  // If active 429 cooldown is in effect, return offline fallback state immediately without network round-trips
  if (isRateLimited()) {
    if (options?.throwOnError) {
      throw new Error('HTTP_429_TOO_MANY_REQUESTS');
    }
    const isMock =
      userSettings?.mode === 'mock' ||
      draftId === 'mock' ||
      draftId === 'mock_oneiromancy_draft_2025' ||
      (!draftId && userSettings?.mode !== 'live' && !userSettings?.league_id);
    const retainedLeagues =
      availableLeagues.length > 0
        ? availableLeagues
        : userSettings?.available_leagues &&
            userSettings.available_leagues.length > 0
          ? userSettings.available_leagues
          : isMock
            ? mockSettings.available_leagues || []
            : [];
    if (isMock) {
      return {
        ...mock_oneiromancy_draft_2025,
        draft_id: draftId || 'mock_oneiromancy_draft_2025',
        available_leagues: retainedLeagues,
        settings: {
          ...mockSettings,
          ...userSettings,
          draft_id: draftId || 'mock_oneiromancy_draft_2025',
          offline_mode_active: true,
          last_error: 'HTTP_429_TOO_MANY_REQUESTS',
          available_leagues: retainedLeagues,
        },
        sync_error: 'HTTP_429_TOO_MANY_REQUESTS',
        sync_warning:
          'Sleeper rate limit cooldown active. Retrying automatically.',
      };
    }
    return {
      draft_id: draftId || userSettings?.draft_id || 'live',
      isLive: true,
      mode: 'live',
      status: 'pre_draft',
      current_pick: {
        round: 1,
        pick_no: 1,
        on_the_clock_team_id: '',
        seconds_remaining: 90,
      },
      settings: {
        ...DEFAULT_LIVE_SETTINGS,
        ...userSettings,
        draft_id: draftId || userSettings?.draft_id || 'live',
        offline_mode_active: true,
        last_error: 'HTTP_429_TOO_MANY_REQUESTS',
        available_leagues: retainedLeagues,
      },
      cosmic_board: [],
      my_roster: [],
      weekly_coverage: [],
      elemental_traits: {Fire: 0, Earth: 0, Air: 0, Water: 0},
      competitor_teams: [],
      ideal_draft_path: [],
      weekly_matchup: undefined,
      available_leagues: retainedLeagues,
      waiver_upgrades: [],
      trade_proposals: [],
      sync_error: 'HTTP_429_TOO_MANY_REQUESTS',
      sync_warning:
        'Sleeper rate limit cooldown active. Retrying automatically.',
    };
  }

  try {
    const isExplicitDraft =
      draftId &&
      draftId !== 'mock' &&
      draftId !== 'mock_oneiromancy_draft_2025' &&
      draftId !== userSettings?.league_id;

    if (isExplicitDraft) {
      if (options?.signal?.aborted) {
        throw new Error('Sync aborted');
      }
      const [metadata, picks] = await Promise.all([
        fetchDraftMetadata(draftId, options?.signal),
        fetchDraftPicks(draftId, options?.signal),
      ]);
      if (options?.signal?.aborted) {
        throw new Error('Sync aborted');
      }
      let activeDict = playerDict || playerDictionaryCache || undefined;
      if (!activeDict || Object.keys(activeDict).length === 0) {
        activeDict = await fetchNFLPlayers(options?.signal).catch(() => ({}));
      }
      if (options?.signal?.aborted) {
        throw new Error('Sync aborted');
      }
      const targetLeagueId = metadata?.league_id || userSettings?.league_id;

      if (targetLeagueId) {
        const [leagueUsers, leagueRosters, leagueDetails, nflState] =
          await Promise.all([
            fetchLeagueUsers(targetLeagueId, options?.signal).catch(() => []),
            fetchLeagueRosters(targetLeagueId, options?.signal).catch(() => []),
            fetchLeague(targetLeagueId, options?.signal).catch(() => null),
            fetchNFLState(options?.signal).catch(() => null),
          ]);
        if (options?.signal?.aborted) {
          throw new Error('Sync aborted');
        }

        const activeWeek: number =
          typeof (nflState as any)?.week === 'number'
            ? (nflState as any).week
            : typeof leagueDetails?.settings?.['leg'] === 'number'
              ? (leagueDetails.settings['leg'] as number)
              : 1;
        const season: string = String(
          (nflState as any)?.season || leagueDetails?.season || '2026',
        );

        const [leagueMatchups, weeklyProjections] = await Promise.all([
          fetchLeagueMatchups(targetLeagueId, activeWeek, options?.signal).catch(() => []),
          fetchWeeklyProjections(season, activeWeek, options?.signal).catch(() => null),
        ]);
        if (options?.signal?.aborted) {
          throw new Error('Sync aborted');
        }
        await loadSeasonContext(
          targetLeagueId,
          season,
          activeWeek,
          leagueMatchups,
          leagueDetails,
          options?.signal,
        ).catch(() => {
          if (!options?.signal?.aborted) setSeasonContext(null);
        });
        if (options?.signal?.aborted) {
          throw new Error('Sync aborted');
        }

        if (Array.isArray(leagueUsers)) {
          for (const u of leagueUsers) {
            const url = resolveSleeperAvatarUrl(u.avatar, {
              metadataAvatar: u.metadata?.avatar,
            });
            if (url) {
              setAvatarInCache(
                [u.user_id, u.avatar, u.username, u.display_name, url],
                url,
              );
            }
          }
        }

        const nextWeekProjectionsByWeek = await fetchNextWeekProjectionsMap({
          season,
          activeWeek,
          picks,
          leagueRosters,
          leagueMatchups,
          weeklyProjections,
          playerDict: activeDict,
          signal: options?.signal,
        });

        const state = transformToDraftState(
          metadata,
          picks,
          effectiveSettings,
          activeDict,
          leagueUsers,
          leagueRosters,
          leagueMatchups,
          leagueDetails,
          activeWeek,
          weeklyProjections,
          nextWeekProjectionsByWeek,
        );
        return {
          ...state,
          available_leagues:
            availableLeagues.length > 0
              ? availableLeagues
              : userSettings?.available_leagues || [],
          isLive: true,
          mode: 'live',
          sync_error: null,
          sync_warning: null,
        };
      }

      const state = transformToDraftState(
        metadata,
        picks,
        effectiveSettings,
        activeDict,
      );
      return {
        ...state,
        available_leagues:
          availableLeagues.length > 0
            ? availableLeagues
            : userSettings?.available_leagues || [],
        isLive: true,
        mode: 'live',
        sync_error: null,
        sync_warning: null,
      };
    }

    const username = (
      userSettings?.sleeper_username ?? (userSettings ? '' : 'OneiroVanguard')
    ).trim();
    const cleanUser = username.replace(/^@/, '').toLowerCase().trim();
    const isCanonicalUser =
      cleanUser.includes('oneirovanguard') ||
      cleanUser === '9000000000000000101' ||
      cleanUser === 'user_oneiromancy_me';

    if (!username) {
      throw new Error('No Sleeper username configured');
    }

    let resolvedUserId = isCanonicalUser
      ? userSettings?.user_id || '9000000000000000101'
      : undefined;
    let resolvedUsername = username;
    let userLeaguesFound = false;
    let resolvedUserRecord = false;
    let userLookupErr: unknown = null;

    // Dynamically query user & leagues from Sleeper API
    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }
    try {
      const userLeaguesRes = await fetchUserLeagues(
        username,
        ['2026', '2025', '2024', '2023'],
        options?.signal,
      );
      if (
        userLeaguesRes &&
        userLeaguesRes.leagues &&
        userLeaguesRes.leagues.length > 0
      ) {
        availableLeagues = userLeaguesRes.leagues.map((l) => ({
          league_id: String(l.league_id),
          name: l.name,
          season: l.season,
        }));
        userLeaguesFound = true;
      }
      if (userLeaguesRes && userLeaguesRes.user) {
        resolvedUserRecord = true;
        resolvedUserId = String(userLeaguesRes.user.user_id);
        resolvedUsername =
          userLeaguesRes.user.display_name ||
          userLeaguesRes.user.username ||
          username;
      }
    } catch (ulErr: unknown) {
      if (options?.signal?.aborted) {
        throw toAbortError(ulErr);
      }
      userLookupErr = ulErr;
      logSleeperWarning('[Sleeper] fetchUserLeagues warning:', ulErr);
      if (
        isCanonicalUser &&
        (!availableLeagues || availableLeagues.length === 0)
      ) {
        availableLeagues = mockSettings.available_leagues || [];
      }
    }

    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }

    // Default to first/only league if none selected or if selected league not in user leagues
    let selectedLeagueId = userSettings?.league_id;
    if (!isCanonicalUser && selectedLeagueId === '9000000000000000001') {
      selectedLeagueId = '';
    }
    if (
      !selectedLeagueId ||
      (availableLeagues.length > 0 &&
        !availableLeagues.some((l) => l.league_id === selectedLeagueId))
    ) {
      if (availableLeagues.length > 0) {
        selectedLeagueId = availableLeagues[0].league_id;
      } else if (isCanonicalUser) {
        selectedLeagueId = '9000000000000000001';
      } else {
        selectedLeagueId = '';
      }
    }

    // Dynamically query league drafts, user ID, and team slot from league
    let resolvedUserSlot = userSettings?.user_slot;
    let leagueResolved = false;
    let leagueResolutionErr: any = null;

    if (selectedLeagueId) {
      try {
        const resolved = await resolveLeagueDraftAndUser(
          selectedLeagueId,
          resolvedUsername || username,
          options?.signal,
        );
        effectiveDraftId = resolved.draft_id;
        resolvedUserId = resolved.user_id;
        resolvedUserSlot = resolved.user_slot;
        resolvedUsername = resolved.display_name;
        leagueResolved = true;
      } catch (resErr: unknown) {
        if (options?.signal?.aborted) {
          throw toAbortError(resErr);
        }
        logSleeperWarning(
          '[Sleeper] resolveLeagueDraftAndUser warning:',
          resErr,
        );
        leagueResolutionErr = resErr;
      }
    }

    // If user was not found on Sleeper and could not be resolved from selected league
    if (!leagueResolved && !userLeaguesFound && !isCanonicalUser) {
      const userLookupErrMsg =
        userLookupErr instanceof Error
          ? userLookupErr.message
          : userLookupErr
            ? String(userLookupErr)
            : '';
      const isTrueNotFound =
        userLookupErr instanceof SleeperUserNotFoundError ||
        userLookupErrMsg.includes('not found on Sleeper');
      if (userLookupErr && !isTrueNotFound) {
        throw userLookupErr instanceof Error
          ? userLookupErr
          : new Error(userLookupErrMsg);
      }
      if (leagueResolutionErr instanceof Error) {
        throw leagueResolutionErr;
      }
      const detailMsg =
        leagueResolutionErr?.message ||
        (resolvedUserRecord
          ? `No NFL leagues found for @${resolvedUsername || username}`
          : userLookupErrMsg ||
            `User '${username}' not found on Sleeper or in league ${selectedLeagueId || 'none'}`);
      throw new Error(detailMsg);
    }

    if (
      !effectiveDraftId ||
      effectiveDraftId === 'mock_oneiromancy_draft_2025'
    ) {
      effectiveDraftId = 'mock_oneiromancy_draft_2025';
    }

    effectiveSettings = {
      ...effectiveSettings,
      draft_id: effectiveDraftId,
      league_id: selectedLeagueId,
      user_id:
        resolvedUserId ||
        (isCanonicalUser
          ? effectiveSettings.user_id || '9000000000000000101'
          : resolvedUserId),
      user_slot: resolvedUserSlot || effectiveSettings.user_slot || 7,
      sleeper_username: resolvedUsername || username,
      available_leagues: availableLeagues,
    };

    if (effectiveDraftId === 'mock_oneiromancy_draft_2025') {
      if (options?.signal?.aborted) {
        throw new Error('Sync aborted');
      }
      setSeasonContext(null);
      const activeDict = playerDict || undefined;
      const state = transformToDraftState(
        mockDraftMetadata,
        mockPicks,
        effectiveSettings,
        activeDict,
      );
      const isCanonicalSlot7 =
        !effectiveSettings.user_slot || effectiveSettings.user_slot === 7;
      const finalRoster =
        isCanonicalSlot7 && state.my_roster.filter((s) => s.player).length < 15
          ? mock_oneiromancy_draft_2025.my_roster
          : state.my_roster;
      return {
        ...state,
        my_roster: finalRoster,
        available_leagues: availableLeagues,
      };
    }

    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }
    const [
      metadata,
      picks,
      leagueUsers,
      leagueRosters,
      leagueDetails,
      nflState,
    ] = await Promise.all([
      fetchDraftMetadata(effectiveDraftId, options?.signal),
      fetchDraftPicks(effectiveDraftId, options?.signal),
      selectedLeagueId
        ? fetchLeagueUsers(selectedLeagueId, options?.signal)
        : Promise.resolve([]),
      selectedLeagueId
        ? fetchLeagueRosters(selectedLeagueId, options?.signal)
        : Promise.resolve([]),
      selectedLeagueId
        ? fetchLeague(selectedLeagueId, options?.signal)
        : Promise.resolve(null),
      fetchNFLState(options?.signal),
    ]);
    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }

    const activeWeek: number =
      typeof (nflState as any)?.week === 'number'
        ? (nflState as any).week
        : typeof leagueDetails?.settings?.['leg'] === 'number'
          ? (leagueDetails.settings['leg'] as number)
          : 1;
    const season: string = String(
      (nflState as any)?.season || leagueDetails?.season || '2026',
    );

    const [leagueMatchups, weeklyProjections] = await Promise.all([
      selectedLeagueId
        ? fetchLeagueMatchups(selectedLeagueId, activeWeek, options?.signal)
        : Promise.resolve([]),
      fetchWeeklyProjections(season, activeWeek, options?.signal),
    ]);
    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }
    if (selectedLeagueId) {
      await loadSeasonContext(
        selectedLeagueId,
        season,
        activeWeek,
        leagueMatchups,
        leagueDetails,
        options?.signal,
      ).catch(() => {
        if (!options?.signal?.aborted) setSeasonContext(null);
      });
    }
    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }

    if (Array.isArray(leagueUsers)) {
      for (const u of leagueUsers) {
        const url = resolveSleeperAvatarUrl(u.avatar, {
          metadataAvatar: u.metadata?.avatar,
        });
        if (url) {
          setAvatarInCache(
            [u.user_id, u.avatar, u.username, u.display_name, url],
            url,
          );
        }
      }
    }

    let activeDict = playerDict || playerDictionaryCache || undefined;
    if (!activeDict || Object.keys(activeDict).length === 0) {
      try {
        activeDict = await fetchNFLPlayers(options?.signal);
      } catch (err) {
        // Continue with available cached data
      }
    }
    if (options?.signal?.aborted) {
      throw new Error('Sync aborted');
    }
    const nextWeekProjectionsByWeek = await fetchNextWeekProjectionsMap({
      season,
      activeWeek,
      picks,
      leagueRosters,
      leagueMatchups,
      weeklyProjections,
      playerDict: activeDict,
      signal: options?.signal,
    });
    const state = transformToDraftState(
      metadata,
      picks,
      effectiveSettings,
      activeDict,
      leagueUsers,
      leagueRosters,
      leagueMatchups,
      leagueDetails,
      activeWeek,
      weeklyProjections,
      nextWeekProjectionsByWeek,
    );
    return {
      ...state,
      available_leagues: availableLeagues,
      isLive: true,
      mode: 'live',
      sync_error: null,
      sync_warning: null,
    };
  } catch (err: any) {
    if (options?.throwOnError) {
      throw err;
    }
    const isMock =
      !effectiveDraftId &&
      (userSettings?.mode === 'mock' ||
        draftId === 'mock' ||
        draftId === 'mock_oneiromancy_draft_2025' ||
        (!draftId &&
          userSettings?.mode !== 'live' &&
          !userSettings?.league_id));
    const retainedLeagues =
      availableLeagues.length > 0
        ? availableLeagues
        : userSettings?.available_leagues &&
            userSettings.available_leagues.length > 0
          ? userSettings.available_leagues
          : isMock
            ? mockSettings.available_leagues || []
            : [];
    if (isMock) {
      return {
        ...mock_oneiromancy_draft_2025,
        draft_id: effectiveDraftId || draftId || 'mock_oneiromancy_draft_2025',
        available_leagues: retainedLeagues,
        settings: {
          ...mockSettings,
          ...effectiveSettings,
          sleeper_username: requestedUsername,
          draft_id: effectiveDraftId || draftId || 'mock_oneiromancy_draft_2025',
          offline_mode_active: true,
          last_error: err?.message || String(err),
          available_leagues: retainedLeagues,
        },
        sync_error: err?.message || String(err),
      };
    }
    return {
      draft_id: effectiveDraftId || draftId || '',
      isLive: true,
      mode: 'live',
      status: 'pre_draft',
      current_pick: {
        round: 1,
        pick_no: 1,
        on_the_clock_team_id: '',
        seconds_remaining: 90,
      },
      settings: {
        ...DEFAULT_LIVE_SETTINGS,
        ...effectiveSettings,
        sleeper_username: requestedUsername,
        draft_id: effectiveDraftId || draftId || '',
        offline_mode_active: true,
        last_error: err?.message || String(err),
        available_leagues: retainedLeagues,
      },
      cosmic_board: [],
      my_roster: [],
      weekly_coverage: [],
      elemental_traits: {Fire: 0, Earth: 0, Air: 0, Water: 0},
      competitor_teams: [],
      ideal_draft_path: [],
      weekly_matchup: undefined,
      available_leagues: retainedLeagues,
      waiver_upgrades: [],
      trade_proposals: [],
      sync_error: err?.message || String(err),
    };
  }
}

/**
 * Polls the draft route or Sleeper API, returning DraftState.
 */
export async function pollDraft(
  draftId: string,
  isLive = true,
): Promise<DraftState> {
  if (!isLive) {
    return mock_oneiromancy_draft_2025;
  }
  return fetchSleeperDraft(draftId);
}

// ============================================================================
// Optional Custom Dataset Override Loader
// ============================================================================

export interface InternalDataProfile {
  default_username: string;
  default_league_id: string;
  default_draft_id: string;
  default_user_id: string;
  default_league_name: string;
  default_team_name: string;
  search_aliases: string[];
  team_name_map: Record<string, string>;
}

let cachedInternalProfile: InternalDataProfile | null = null;

export function registerInternalProfile(
  profile: InternalDataProfile | null,
): void {
  cachedInternalProfile = profile;
  if (!profile) {
    playerDictionaryCache = null;
    playerCacheTimestamp = 0;
  }
}

export function getInternalProfile(): InternalDataProfile | null {
  return cachedInternalProfile;
}

/**
 * Applies an optionally loaded InternalDataProfile onto a DraftState,
 * restoring original league IDs, usernames, and team names when present.
 */
export function applyOptionalInternalProfileToDraftState(
  state: DraftState,
  profile: InternalDataProfile | null = cachedInternalProfile,
): DraftState {
  if (!profile) return state;
  const mapTeamName = (name: string): string => {
    if (!name) return name;
    if (profile.team_name_map[name]) return profile.team_name_map[name];
    const clean = name.replace(/\s*\(You\)$/, '');
    if (profile.team_name_map[clean]) {
      return name.endsWith('(You)')
        ? `${profile.team_name_map[clean]} (You)`
        : profile.team_name_map[clean];
    }
    return name;
  };

  const updatedTeams = (state.competitor_teams || []).map((t) => ({
    ...t,
    name: mapTeamName(t.name),
  }));

  const updatedMatchup = state.weekly_matchup
    ? {
        ...state.weekly_matchup,
        user_team: state.weekly_matchup.user_team
          ? {
              ...state.weekly_matchup.user_team,
              team_name: mapTeamName(state.weekly_matchup.user_team.team_name),
            }
          : state.weekly_matchup.user_team,
        opponent_team: state.weekly_matchup.opponent_team
          ? {
              ...state.weekly_matchup.opponent_team,
              team_name: mapTeamName(
                state.weekly_matchup.opponent_team.team_name,
              ),
            }
          : state.weekly_matchup.opponent_team,
      }
    : state.weekly_matchup;

  return {
    ...state,
    draft_id: profile.default_draft_id || state.draft_id,
    available_leagues: (state.available_leagues || []).map((l, idx) =>
      idx === 0
        ? {
            ...l,
            league_id: profile.default_league_id || l.league_id,
            name: profile.default_league_name || l.name,
          }
        : l,
    ),
    settings: {
      ...state.settings,
      sleeper_username:
        profile.default_username || state.settings.sleeper_username,
      league_id: profile.default_league_id || state.settings.league_id,
      draft_id: profile.default_draft_id || state.settings.draft_id,
      user_id: profile.default_user_id || state.settings.user_id,
    },
    competitor_teams: updatedTeams,
    weekly_matchup: updatedMatchup,
  };
}

/**
 * Optionally loads the full custom dataset (14.65 MB mock_players_nfl.json +
 * authentic Sleeper fixtures & profile) from an optional custom dataset directory
 * (staged into custom_mocks/ or public/custom_mocks/).
 * Gracefully no-ops and returns { available: false } when running in a standalone OSS export.
 */
export async function loadOptionalInternalData(options?: {
  baseUrl?: string;
  baseDir?: string;
  loadFullPlayers?: boolean;
}): Promise<{
  available: boolean;
  profile: InternalDataProfile | null;
  playersLoaded: number;
  playerCount: number;
}> {
  const loadFullPlayers = options?.loadFullPlayers ?? true;

  // 1. Browser / HTTP static asset check (/custom_mocks/custom_profile.json)
  const browserOrigin =
    typeof window !== 'undefined' && typeof window.location?.origin === 'string'
      ? window.location.origin
      : '';
  if (options?.baseUrl || browserOrigin.startsWith('http')) {
    const base = (options?.baseUrl || '').replace(/\/$/, '');
    try {
      const profRes = await fetch(`${base}/custom_mocks/custom_profile.json`);
      if (profRes.ok) {
        const profile = (await profRes.json()) as InternalDataProfile;
        cachedInternalProfile = profile;
        let playersLoaded = 0;
        if (loadFullPlayers) {
          const playersRes = await fetch(
            `${base}/custom_mocks/mock_players_nfl.json`,
          );
          if (playersRes.ok) {
            const playersData = (await playersRes.json()) as Record<
              string,
              SleeperPlayerRecord
            >;
            playerDictionaryCache = playersData;
            playerCacheTimestamp = Date.now();
            playersLoaded = Object.keys(playersData).length;
          }
        }
        return {
          available: true,
          profile,
          playersLoaded,
          playerCount: playersLoaded,
        };
      }
    } catch {
      // Fall through to Node/filesystem check or OSS fallback
    }
  }

  // 2. Node.js local filesystem / sibling directory check
  const nodeProcess = (
    globalThis as {
      process?: {
        versions?: {node?: string};
        cwd?: () => string;
        getBuiltinModule?: (id: string) => unknown;
      };
    }
  ).process;
  if (nodeProcess?.versions?.node && nodeProcess.getBuiltinModule) {
    try {
      const fsMod = nodeProcess.getBuiltinModule('node:fs') as {
        existsSync: (p: string) => boolean;
        readFileSync: (p: string, enc: string) => string;
        readdirSync?: (p: string) => string[];
      };
      const pathMod = nodeProcess.getBuiltinModule('node:path') as {
        resolve: (...parts: string[]) => string;
        join: (...parts: string[]) => string;
      };
      const cwd =
        options?.baseDir || (nodeProcess.cwd ? nodeProcess.cwd() : '.');
      const parentDir = pathMod.resolve(cwd, '..');
      const siblingDirs =
        fsMod.existsSync(parentDir) && fsMod.readdirSync
          ? fsMod
              .readdirSync(parentDir)
              .map((d) => pathMod.resolve(parentDir, d))
          : [];
      const candidateDirs = [
        pathMod.resolve(cwd, 'custom_mocks'),
        pathMod.resolve(cwd, 'public', 'custom_mocks'),
        ...siblingDirs,
      ];
      const foundDir = candidateDirs.find((d) =>
        fsMod.existsSync(pathMod.join(d, 'custom_profile.json')),
      );
      if (foundDir) {
        const profile = JSON.parse(
          fsMod.readFileSync(
            pathMod.join(foundDir, 'custom_profile.json'),
            'utf8',
          ),
        ) as InternalDataProfile;
        cachedInternalProfile = profile;
        let playersLoaded = 0;
        const playersPath = pathMod.join(foundDir, 'mock_players_nfl.json');
        if (loadFullPlayers && fsMod.existsSync(playersPath)) {
          const playersData = JSON.parse(
            fsMod.readFileSync(playersPath, 'utf8'),
          ) as Record<string, SleeperPlayerRecord>;
          playerDictionaryCache = playersData;
          playerCacheTimestamp = Date.now();
          playersLoaded = Object.keys(playersData).length;
        }
        return {
          available: true,
          profile,
          playersLoaded,
          playerCount: playersLoaded,
        };
      }
    } catch {
      // Ignore filesystem errors in restricted runtimes
    }
  }

  return {available: false, profile: null, playersLoaded: 0, playerCount: 0};
}
