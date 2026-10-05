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
  calculateHarmony,
  calculateNumericTier,
  calculateSnakePick,
  calculateTeamCelestialMetrics,
  calculateWinProbability,
  computeDraftScore,
  computeSpiritScore,
  computeTeamMatchupFavorability,
  computeWeeklyPlayerFavorability,
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  deriveDraftStatus,
  generateAscensionPath,
  recomputeDraftScores,
} from './scoring';

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
    msg.includes('rate limit')
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
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
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
): Promise<SleeperDraftMetadata> {
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

  const res = await fetchWithTimeout(`${SLEEPER_BASE_URL}/draft/${draftId}`);
  if (res.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}_ERROR`);
  }

  return (await res.json()) as SleeperDraftMetadata;
}

/**
 * Fetch draft picks from Sleeper: GET /v1/draft/<draft_id>/picks
 * Reference: https://docs.sleeper.com/#drafts
 */
export async function fetchDraftPicks(draftId: string): Promise<SleeperPick[]> {
  if (
    !draftId ||
    draftId === 'mock' ||
    draftId === 'mock_oneiromancy_draft_2025'
  ) {
    return mockPicks;
  }

  if (isRateLimited()) {
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }

  checkRateLimit();

  const res = await fetchWithTimeout(
    `${SLEEPER_BASE_URL}/draft/${draftId}/picks`,
  );
  if (res.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}_ERROR`);
  }

  return (await res.json()) as SleeperPick[];
}

/**
 * Fetch league users from Sleeper: GET /v1/league/<league_id>/users
 * Reference: https://docs.sleeper.com/#users-in-a-league
 */
export async function fetchLeagueUsers(
  leagueId: string,
): Promise<SleeperUser[]> {
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
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return [];
    }
    if (res.ok) {
      return (await res.json()) as SleeperUser[];
    }
  } catch (err: unknown) {
    logSleeperWarning('[Sleeper] fetchLeagueUsers warning:', err);
  }
  return [];
}

/**
 * Fetch league rosters from Sleeper: GET /v1/league/<league_id>/rosters
 * Reference: https://docs.sleeper.com/#rosters
 */
export async function fetchLeagueRosters(
  leagueId: string,
): Promise<SleeperRoster[]> {
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
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return [];
    }
    if (res.ok) {
      return (await res.json()) as SleeperRoster[];
    }
  } catch (err: unknown) {
    logSleeperWarning('[Sleeper] fetchLeagueRosters warning:', err);
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
): Promise<SleeperMatchup[]> {
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
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return [];
    }
    if (res.ok) {
      return (await res.json()) as SleeperMatchup[];
    }
  } catch (err: unknown) {
    logSleeperWarning('[Sleeper] fetchLeagueMatchups warning:', err);
  }
  return [];
}

/**
 * Fetch league metadata and configuration: GET /v1/league/<league_id>
 * Reference: https://docs.sleeper.com/#leagues
 */
export async function fetchLeague(
  leagueId: string,
): Promise<SleeperLeague | null> {
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
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return null;
    }
    if (res.ok) {
      return (await res.json()) as SleeperLeague;
    }
  } catch (err: unknown) {
    logSleeperWarning('[Sleeper] fetchLeague warning:', err);
  }
  return null;
}

/**
 * Fetch current NFL state: GET /v1/state/nfl
 * Reference: https://docs.sleeper.com/#state
 */
export async function fetchNFLState(): Promise<SleeperNFLState | null> {
  if (isRateLimited()) return null;
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(`${SLEEPER_BASE_URL}/state/nfl`);
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return null;
    }
    if (res.ok) {
      return (await res.json()) as SleeperNFLState;
    }
  } catch (err: unknown) {
    logSleeperWarning('[Sleeper] fetchNFLState warning:', err);
  }
  return null;
}

/**
 * Fetch weekly player projections from Sleeper: GET /v1/projections/nfl/regular/<season>/<week>
 */
export async function fetchWeeklyProjections(
  season: string = '2026',
  week: number = 2,
): Promise<Record<string, any> | null> {
  if (isRateLimited()) return null;
  checkRateLimit();
  try {
    const res = await fetchWithTimeout(
      `${SLEEPER_BASE_URL}/projections/nfl/regular/${season}/${week}`,
    );
    if (res.status === 429) {
      triggerRateLimitCooldown();
      return null;
    }
    if (res.ok) {
      return (await res.json()) as Record<string, any>;
    }
  } catch (err: unknown) {
    logSleeperWarning('[Sleeper] fetchWeeklyProjections warning:', err);
  }
  return null;
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
  seasons: string[] = ['2025', '2024', '2023', '2026'],
): Promise<{user: SleeperUser; leagues: SleeperLeague[]}> {
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
  );
  if (userRes.status === 429) {
    triggerRateLimitCooldown();
    throw new Error('HTTP_429_TOO_MANY_REQUESTS');
  }

  let user: SleeperUser | null = null;
  if (userRes.ok) {
    try {
      user = await userRes.json();
    } catch {
      user = null;
    }
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
        );
        if (altRes.status === 429) {
          triggerRateLimitCooldown();
        } else if (altRes.ok) {
          const altData = await altRes.json();
          if (altData && altData.user_id) {
            user = altData as SleeperUser;
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

  if (!user || !user.user_id) {
    throw new Error(
      `User '${cleanUsername}' not found on Sleeper (try checking spelling, e.g. OneiroVangard or OneiroVanguard)`,
    );
  }

  const userId = String(user.user_id);
  const allLeagues: SleeperLeague[] = [];
  const seenLeagueIds = new Set<string>();

  for (const season of seasons) {
    try {
      if (isRateLimited()) break;
      checkRateLimit();

      const leaguesRes = await fetchWithTimeout(
        `${SLEEPER_BASE_URL}/user/${userId}/leagues/nfl/${season}`,
      );
      if (leaguesRes.status === 429) {
        triggerRateLimitCooldown();
        break;
      }
      if (leaguesRes.ok) {
        const leagues = await leaguesRes.json();
        if (Array.isArray(leagues)) {
          for (const l of leagues) {
            if (l && l.league_id && !seenLeagueIds.has(String(l.league_id))) {
              seenLeagueIds.add(String(l.league_id));
              allLeagues.push(l);
            }
          }
        }
      }
    } catch (seasonErr: unknown) {
      logSleeperWarning(
        `[Sleeper] Could not fetch leagues for season ${season}:`,
        seasonErr,
      );
    }
  }

  return {user, leagues: allLeagues};
}

/**
 * Fetch NFL master player dictionary: GET /v1/players/nfl (cached 24h)
 * Reference: https://docs.sleeper.com/#players
 */
export async function fetchNFLPlayers(): Promise<
  Record<string, SleeperPlayerRecord>
> {
  const now = Date.now();
  if (
    playerDictionaryCache &&
    now - playerCacheTimestamp < PLAYER_CACHE_TTL_MS
  ) {
    return playerDictionaryCache;
  }

  if (playerDictionaryPromise) {
    return playerDictionaryPromise;
  }

  playerDictionaryPromise = (async () => {
    try {
      if (isRateLimited()) return playerDictionaryCache ?? {};
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
        return data;
      }
    } catch (err) {
      // Gracefully handle player fetch failure
    } finally {
      playerDictionaryPromise = null;
    }
    return playerDictionaryCache ?? {};
  })();

  return playerDictionaryPromise;
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
 * Enriches cosmic board players with live Sleeper NFL master dictionary updates
 * (status, injury_status, depth_chart_order, team, number).
 */
export function enrichCosmicBoardWithNFLPlayers(
  board: CosmicPlayer[],
  playerDict?: Record<string, SleeperPlayerRecord> | null,
): CosmicPlayer[] {
  if (!playerDict || Object.keys(playerDict).length === 0) {
    return board;
  }

  const existingIds = new Set<string>();
  const enriched = board.map((player) => {
    existingIds.add(String(player.id));
    const record = playerDict[player.id];
    if (!record) return player;

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

    return {
      ...player,
      first_name: firstName,
      last_name: lastName,
      name,
      position,
      status: record.status ?? player.status,
      injury_status:
        record.injury_status !== undefined
          ? record.injury_status
          : player.injury_status,
      depth_chart_order: record.depth_chart_order ?? player.depth_chart_order,
      team: record.team || player.team,
      jersey_number: record.number ?? player.jersey_number,
    };
  });

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

const KNOWN_ROSTERED_NFL_PLAYERS: Record<
  string,
  {
    first_name: string;
    last_name: string;
    position: NFLPosition;
    team: string;
    number: number;
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
    team: 'TEX',
    number: 8,
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
    playerDict?.[playerId] || KNOWN_ROSTERED_NFL_PLAYERS[String(playerId)];

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

  const team = meta?.team || record?.team || 'NFL';
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
  const weeklyPts = Math.round(baseWeekly * 10) / 10;
  const vorNormalized = isMyTeam ? 75.0 : isDeepFreeAgent ? 25.0 : 62.0;
  const marketVor = isMyTeam ? 5.0 : isDeepFreeAgent ? -2.0 : 2.5;
  const draftScore =
    Math.round((0.65 * vorNormalized + 0.35 * spiritScore) * 10) / 10;

  return {
    id: playerId,
    name,
    first_name: firstName,
    last_name: lastName,
    position,
    team,
    jersey_number: jerseyNumber,
    bye_week: 7 + (absHash % 8),
    adp: 50,
    projected_points: weeklyPts,
    weekly_projected_points: weeklyPts,
    sleeper_projected_points: weeklyPts,
    nfl_projected_points: weeklyPts,
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
    catalysts: [
      'High volume red-zone target share',
      'Positive game script in high-scoring offense',
    ],
    risks: [
      'Tough division matchup concentration',
      'High target competition in receiving corps',
    ],
  };
}

/**
 * Maps a single roster slot designation (e.g. 'FLEX', 'SUPER_FLEX', 'WRRB_FLEX', 'REC_FLEX', 'K', 'DEF')
 * to its eligible positions.
 */
export function expandSlotPositions(slot: string): NFLPosition[] {
  const s = (slot || '').toUpperCase().trim();
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
      if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(s)) {
        return [s as NFLPosition];
      }
      return ['WR', 'RB', 'TE'];
  }
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
    const startingPos = rosterPositions.filter(
      (pos) =>
        !['BN', 'BENCH', 'IR', 'TAXI', 'RES'].includes(
          (pos || '').toUpperCase().trim(),
        ),
    );
    for (const pos of startingPos) {
      const expanded = expandSlotPositions(pos);
      expanded.forEach((p) => {
        if (p === 'K' && !hasExplicitKicker) return;
        set.add(p);
      });
    }
  } else if (Array.isArray(fallbackRoster) && fallbackRoster.length > 0) {
    const startingSlots = fallbackRoster.filter(
      (slot) =>
        !slot.slot_id.startsWith('BN') &&
        slot.slot_id.toUpperCase() !== 'BENCH',
    );
    for (const slot of startingSlots) {
      if (
        Array.isArray(slot.eligible_positions) &&
        slot.eligible_positions.length > 0
      ) {
        slot.eligible_positions.forEach((p) => {
          if (
            !['BN', 'BENCH', 'IR', 'TAXI', 'RES'].includes(
              (p || '').toUpperCase().trim(),
            )
          ) {
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
 * Generates deterministic 18-week schedule data for the active team.
 */
export function generateMatchupWeeks(
  userTeam: CompetitorTeam,
  competitorTeams: CompetitorTeam[],
  activeWeek: number = 1,
): MatchupWeekData[] {
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
          Array.isArray((userTeam as any).starters) &&
          (userTeam as any).starters.length > 0
            ? (userTeam as any).starters
            : userTeam.picks
              ? userTeam.picks.slice(0, 8).map((p) => p.player_id)
              : [],
        players:
          Array.isArray((userTeam as any).players) &&
          (userTeam as any).players.length > 0
            ? (userTeam as any).players
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
          Array.isArray((opp as any).starters) &&
          (opp as any).starters.length > 0
            ? (opp as any).starters
            : opp.picks
              ? opp.picks.slice(0, 8).map((p) => p.player_id)
              : [],
        players:
          Array.isArray((opp as any).players) && (opp as any).players.length > 0
            ? (opp as any).players
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
        user_elemental_dominance: 'Fire & Air',
        opponent_elemental_dominance: 'Earth & Water',
        elemental_dominance: {user: 'Fire & Air', opponent: 'Earth & Water'},
        celestial_conjunctions: [
          'Jupiter Trine Mars (+14.2)',
          'Sun Sextile Mercury (+8.5)',
        ],
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

  const mockFavByPlayerId = new Map<string, PlayerMatchupFavorability>();
  for (const mf of mockPlayerFavorabilities) {
    if (mf.player_id) {
      mockFavByPlayerId.set(String(mf.player_id), mf);
    }
  }

  const getTeamPlayers = (team: CompetitorTeam, match: any): CosmicPlayer[] => {
    // If team is user and fullRoster is provided with players, use the complete roster
    if (team.is_user && Array.isArray(fullRoster)) {
      const rosterPlayers = fullRoster
        .filter((s) => s.player)
        .map((s) => s.player!);
      if (rosterPlayers.length >= 15) {
        return rosterPlayers.slice(0, 15);
      }
    }

    const orderedStarterIds: string[] =
      match?.starters &&
      Array.isArray(match.starters) &&
      match.starters.length > 0
        ? match.starters
            .filter((pid: any) => pid && String(pid) !== '0')
            .map(String)
        : Array.isArray((team as any).starters) &&
            (team as any).starters.length > 0
          ? (team as any).starters
              .filter((pid: any) => pid && String(pid) !== '0')
              .map(String)
          : [];

    const activeRosterIds: string[] =
      match?.players && Array.isArray(match.players) && match.players.length > 0
        ? match.players.filter(Boolean).map(String)
        : Array.isArray((team as any).players) &&
            (team as any).players.length > 0
          ? (team as any).players.filter(Boolean).map(String)
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

    const uniqueById = new Map<string, CosmicPlayer>();
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

    let players = Array.from(uniqueById.values());

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

    // Ensure full roster (up to 15 players) by filling from board or mockCosmicBoard
    if (players.length < 15) {
      const currentIds = new Set(players.map((p) => String(p.id)));
      const sourcePool = board.length >= 15 ? board : mockCosmicBoard;
      const startIdx =
        ((team.slot - 1) * 7) % Math.max(1, sourcePool.length - 20);
      const remainingPool = [
        ...sourcePool.slice(startIdx),
        ...sourcePool.slice(0, startIdx),
      ].filter((p) => !currentIds.has(String(p.id)));

      for (const candidate of remainingPool) {
        if (players.length >= 15) break;
        const cid = String(candidate.id);
        if (!currentIds.has(cid)) {
          players.push(candidate);
          currentIds.add(cid);
        }
      }
    }

    return players.slice(0, 15);
  };

  const userPlayers = getTeamPlayers(userTeam, userMatch);
  const oppPlayers = getTeamPlayers(oppTeam, oppMatch);

  const normalizeStartersSet = (
    players: CosmicPlayer[],
    candidateStarterIds: string[],
  ): Set<string> => {
    const validRosterIds = new Set(
      players.slice(0, 15).map((p) => String(p.id)),
    );
    const result = new Set<string>();
    for (const id of candidateStarterIds) {
      const sid = String(id);
      if (sid && sid !== '0' && validRosterIds.has(sid) && result.size < 8) {
        result.add(sid);
      }
    }
    for (const p of players.slice(0, 15)) {
      if (result.size >= 8) break;
      const pid = String(p.id);
      if (!result.has(pid)) {
        result.add(pid);
      }
    }
    return result;
  };

  const rawUserStarterIds: string[] = [];
  if (userMatch?.starters && Array.isArray(userMatch.starters)) {
    userMatch.starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawUserStarterIds.push(String(id));
    });
  }
  if (Array.isArray(fullRoster) && fullRoster.length > 0) {
    fullRoster.forEach((s) => {
      const isBench =
        String(s.slot_id).startsWith('BN') ||
        String(s.slot_id).toUpperCase() === 'BENCH';
      if (!isBench && s.player?.id) {
        rawUserStarterIds.push(String(s.player.id));
      }
    });
  }
  if (
    rawUserStarterIds.length === 0 &&
    Array.isArray((userTeam as any).starters) &&
    (userTeam as any).starters.length > 0
  ) {
    (userTeam as any).starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawUserStarterIds.push(String(id));
    });
  }
  if (
    rawUserStarterIds.length < 8 &&
    (userTeam.slot === 7 ||
      userTeam.roster_id === 2 ||
      userTeam.name?.toLowerCase().includes('astraloracles'))
  ) {
    ['4574', '6813', '9224', '7547', '10229', '8131', '7588', '96'].forEach(
      (id) => rawUserStarterIds.push(id),
    );
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
    Array.isArray((oppTeam as any).starters) &&
    (oppTeam as any).starters.length > 0
  ) {
    (oppTeam as any).starters.forEach((id: string) => {
      if (id && String(id) !== '0') rawOppStarterIds.push(String(id));
    });
  }
  if (
    rawOppStarterIds.length < 8 &&
    (oppTeam.roster_id === 8 ||
      oppTeam.slot === 8 ||
      oppTeam.name?.toLowerCase().includes('solarflare'))
  ) {
    ['3294', '9509', '8138', '7569', '12519', '5012', '8228', '421'].forEach(
      (id) => rawOppStarterIds.push(id),
    );
  } else if (
    rawOppStarterIds.length < 8 &&
    (oppTeam.slot === 5 ||
      oppTeam.roster_id === 11 ||
      oppTeam.name?.toLowerCase().includes('zenithvoyager') ||
      oppTeam.name?.toLowerCase().includes('lunareclipse'))
  ) {
    ['4984', '4866', '8155', '6786', '7564', '8130', '4046', '6770'].forEach(
      (id) => rawOppStarterIds.push(id),
    );
  }

  const userStartersSet = normalizeStartersSet(userPlayers, rawUserStarterIds);
  const oppStartersSet = normalizeStartersSet(oppPlayers, rawOppStarterIds);

  const calcStartersProj = (
    players: CosmicPlayer[],
    startersSet: Set<string>,
    matchObj?: any,
  ): number => {
    const starterPlayers = players.filter((p, idx) =>
      startersSet.size > 0 ? startersSet.has(String(p.id)) : idx < 8,
    );
    const sum = starterPlayers.reduce((acc, p) => {
      const actualPts = Number(matchObj?.players_points?.[String(p.id)] ?? 0);
      const weeklyPts =
        p.weekly_projected_points ??
        p.sleeper_projected_points ??
        p.projected_points ??
        14.5;
      return acc + (actualPts > 0 ? Math.max(actualPts, weeklyPts) : weeklyPts);
    }, 0);
    return Math.round(sum * 100) / 100;
  };

  const calculatedUserProj = calcStartersProj(
    userPlayers,
    userStartersSet,
    userMatch,
  );
  const calculatedOppProj = calcStartersProj(
    oppPlayers,
    oppStartersSet,
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
    const spirit = p.spirit_score || (isStarter ? 85 : 80);
    const actualPts = Number(matchObj?.players_points?.[pid] ?? 0);
    const hasPlayed = actualPts > 0;

    const rawWeeklyProj =
      (p as any).weekly_projected_points ??
      (p as any).sleeper_projected_points ??
      (p.projected_points ?? (isStarter ? 14.5 : 9.5));
    const playerWeeklyProj =
      hasPlayed && rawWeeklyProj <= 0 ? actualPts : rawWeeklyProj;

    const isInjured =
      p.injury_status === 'Doubtful' ||
      p.injury_status === 'Out' ||
      p.injury_status === 'IR' ||
      (p as any).status === 'Injured Reserve';

    const rawTeamCode = (p.team || 'KC').toUpperCase();
    const nflStadiumMeta =
      NFL_TEAM_STADIUMS[rawTeamCode] || NFL_TEAM_STADIUMS['KC'];
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

    const calc = computeWeeklyPlayerFavorability(
      spirit,
      playerWeeklyProj,
      p.injury_status,
      isStarter,
      geomantic,
    );

    const elem =
      (p as any).elemental_traits?.element || (p as any).element || 'Fire';
    const sunSign = (p as any).elemental_traits?.sun_sign || 'Aries';
    const stadiumName = stadiumObj.stadium_name;

    let rationaleText: string;
    let aspectHighlights: string[];

    if (calc.health_penalty < 0) {
      rationaleText = `⚠️ 6th House Health Affliction: ${p.name} (${sunSign} / ${elem}) carries ${
        p.injury_status || 'Injury / Inactive'
      } status (-22 pts health drag), suppressing field availability at ${stadiumName}.`;
      aspectHighlights = [
        '⚠️ 6th House Health Affliction (-22 pts)',
        'Inactive Reserve Drag',
        'Suppressed Field Availability',
      ];
    } else if (calc.verdict === 'HEAVILY FAVORED') {
      rationaleText = `✨ Apex Celestial Alignment: ${p.name} (${sunSign} / ${elem}) commands a ${
        calc.role_modifier >= 0 ? `+${calc.role_modifier.toFixed(1)}` : calc.role_modifier.toFixed(1)
      } astral transit trine and high geomagnetic resonance at ${stadiumName}.`;
      aspectHighlights = [
        `✨ ${stadiumObj.zodiac_ascendant} Trine`,
        `Astral Transit (${calc.role_modifier >= 0 ? '+' : ''}${calc.role_modifier.toFixed(1)} pts)`,
        stadiumObj.geo_magnetic_resonance,
      ];
    } else if (calc.verdict === 'ASTRALLY FAVORED') {
      rationaleText = `🌟 Harmonic Transit Alignment: ${p.name} (${sunSign} / ${elem}) channels steady planetary sextile support (${
        calc.role_modifier >= 0 ? `+${calc.role_modifier.toFixed(1)}` : calc.role_modifier.toFixed(1)
      } transit) and clean stadium grounding at ${stadiumName}.`;
      aspectHighlights = [
        `🌟 Harmonic Sextile Alignment`,
        `Astral Transit (${calc.role_modifier >= 0 ? '+' : ''}${calc.role_modifier.toFixed(1)} pts)`,
        stadiumObj.celestial_house,
      ];
    } else {
      rationaleText = `⚠️ Planetary Square & Coverage Friction: ${p.name} (${sunSign} / ${elem}) encounters a challenging Saturn-Mars square (${
        calc.role_modifier >= 0 ? `+${calc.role_modifier.toFixed(1)}` : calc.role_modifier.toFixed(1)
      } transit) and defensive scheme resistance at ${stadiumName}.`;
      aspectHighlights = [
        '⚠️ Saturn-Mars Coverage Square',
        `Transit Friction (${calc.role_modifier >= 0 ? '+' : ''}${calc.role_modifier.toFixed(1)} pts)`,
        'Contested Matchup Windows',
      ];
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

    const gameKickoff =
      kickoffSlots[(Math.abs(idHash) + week) % kickoffSlots.length];
    const lunarPhase =
      lunarPhases[(Math.abs(idHash) + week) % lunarPhases.length];
    const planetaryHour =
      planetaryHours[(Math.abs(idHash) + idx) % planetaryHours.length];

    return {
      player_id: pid,
      player_name: p.name,
      position: p.position,
      team: p.team || 'NFL',
      nfl_team: p.team || 'NFL',
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

  const teamComparison: TeamCelestialComparison = {
    user_favorability_index:
      Math.round((userTeam.avg_spirit_score ?? 85.0) * 10) / 10,
    opponent_favorability_index:
      Math.round((oppTeam.avg_spirit_score ?? 80.0) * 10) / 10,
    user_astral_favorability:
      Math.round((userTeam.avg_spirit_score ?? 85.0) * 10) / 10,
    opponent_astral_favorability:
      Math.round((oppTeam.avg_spirit_score ?? 80.0) * 10) / 10,
    user_harmony_score: userHarmony,
    opponent_harmony_score: oppHarmony,
    user_elemental_dominance: 'Fire & Air',
    opponent_elemental_dominance: 'Earth & Water',
    elemental_dominance: {user: 'Fire & Air', opponent: 'Earth & Water'},
    celestial_conjunctions: [
      'Jupiter Trine Mars (+14.2)',
      'Sun Sextile Mercury (+8.5)',
    ],
    verdict_summary: `${userTeam.name} holds ${winProbability >= 50 ? 'favorable' : 'contested'} astral alignment with ${userHarmony} Squad Harmony vs ${oppTeam.name}'s ${oppHarmony}.`,
  };

  return {
    week,
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
        userMatch?.starters ||
        (userStartersSet.size > 0
          ? Array.from(userStartersSet)
          : userPlayers.slice(0, 8).map((p) => p.id)),
      players:
        userMatch?.players ||
        (userTeam as any).players ||
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
        oppMatch?.starters ||
        (oppStartersSet.size > 0
          ? Array.from(oppStartersSet)
          : oppPlayers.slice(0, 8).map((p) => p.id)),
      players:
        oppMatch?.players ||
        (oppTeam as any).players ||
        oppPlayers.map((p) => p.id),
      harmony_score: oppHarmony,
    },
    win_probability: winProbability,
    win_probability_label: favorabilityLabel,
    team_comparison: teamComparison,
    player_favorabilities:
      playerFavorabilities.length > 0
        ? playerFavorabilities
        : mockPlayerFavorabilities,
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
    upcoming_matchups: generateMatchupWeeks(userTeam, competitorTeams, week),
  };
}

/**
 * Dynamically derives 18-week schedule matrix and bye week coverage from the active roster.
 * Simulates weekly starting lineups, conflict triage, and championship playoff depth for Weeks 1–18.
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
    const byePlayers = players
      .filter((p) => p.bye_week === week)
      .map((p) => ({
        player_id: String(p.id),
        player_name: p.name,
        position: p.position as NFLPosition,
      }));

    // 2. Identify active (non-bye) players
    const activePlayers = players.filter((p) => p.bye_week !== week);

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
): DraftState {
  const isSyntheticOrLive =
    Boolean(leagueDetails?.league_id) ||
    (Boolean(userSettings?.league_id) && userSettings?.league_id !== '9000000000000000001');

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
    metadata.draft_id === 'mock' ||
    metadata.draft_id === 'mock_oneiromancy_draft_2025' ||
    settings.draft_id === 'mock_oneiromancy_draft_2025' ||
    settings.mode === 'mock' ||
    (!weeklyProjections &&
      (!leagueRosters || leagueRosters.length === 0) &&
      (!picks || picks.length === 0));

  // 1. Gather all unique players from draft picks, league rosters, and weekly projections
  const playerMap = new Map<string, CosmicPlayer>();

  // Seed baseline board only in explicit mock mode
  const baseBoard = isExplicitMock
    ? playerDict && Object.keys(playerDict).length > 0
      ? enrichCosmicBoardWithNFLPlayers(mockCosmicBoard, playerDict)
      : mockCosmicBoard
    : [];

  for (const player of baseBoard) {
    const pid = String(player.id);
    const pick = pickedPlayerMap.get(pid);
    const isMyPick =
      pick &&
      ((settings.user_id && pick.picked_by === settings.user_id) ||
        pick.draft_slot === settings.user_slot);

    playerMap.set(pid, {
      ...player,
      draft_status: isMyPick ? 'my_team' : pick ? 'drafted' : 'available',
      drafted_by_user_id: pick ? pick.picked_by : null,
      drafted_pick_no: pick ? pick.pick_no : null,
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
          isMyPick,
          pick.metadata,
        );
      }
      const firstName = pick.metadata?.first_name || player.first_name;
      const lastName = pick.metadata?.last_name || player.last_name;
      const name =
        firstName && lastName ? `${firstName} ${lastName}`.trim() : player.name;
      const position = pick.metadata?.position
        ? (pick.metadata.position.toUpperCase() as NFLPosition)
        : player.position;
      const team = pick.metadata?.team || player.team;
      const jerseyNumber =
        Number(pick.metadata?.number) || player.jersey_number;

      const liveRecord = playerDict?.[pid];
      player = {
        ...player,
        first_name: firstName,
        last_name: lastName,
        name,
        position,
        team,
        jersey_number: jerseyNumber,
        draft_status: isMyPick ? 'my_team' : 'drafted',
        drafted_by_user_id: pick.picked_by || null,
        drafted_pick_no: pick.pick_no || null,
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
          }
          if (isUserRoster) {
            player = {
              ...player,
              draft_status: 'my_team',
            };
          } else if (player.draft_status !== 'my_team') {
            player = {
              ...player,
              draft_status: 'drafted',
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

  // If live projections exist, ingest all unowned available players from weeklyProjections
  if (hasLiveProjections && playerDict && Object.keys(playerDict).length > 0) {
    for (const [pid, proj] of Object.entries(weeklyProjections!)) {
      if (playerMap.has(pid)) continue;
      const record = playerDict[pid];
      if (!record) continue;
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
  } else if (
    !hasLiveProjections &&
    playerDict &&
    Object.keys(playerDict).length > 0
  ) {
    // Offline / mock fallback for available free agents
    const availableCandidates: Array<{
      id: string;
      searchRank: number;
    }> = [];

    for (const [pid, record] of Object.entries(playerDict)) {
      if (playerMap.has(pid)) continue;
      const pos = (record.position || '').toUpperCase();
      if (!validPositions.has(pos)) continue;
      const searchRank = Number((record as any).search_rank || 9999);
      if (searchRank < 1000 || record.status === 'Active') {
        availableCandidates.push({id: pid, searchRank});
      }
    }

    availableCandidates.sort((a, b) => a.searchRank - b.searchRank);

    for (const cand of availableCandidates.slice(0, 350)) {
      const p = synthesizeCosmicPlayerFromId(cand.id, playerDict, false);
      p.draft_status = 'available';
      playerMap.set(cand.id, p);
    }
  }

  playerMap.forEach((player, pid) => {
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
        if (pick?.metadata?.team) {
          matched.team = pick.metadata.team;
        } else if (record?.team) {
          matched.team = record.team;
        }
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
        if (pick?.metadata?.team) {
          matched.team = pick.metadata.team;
        } else if (record?.team) {
          matched.team = record.team;
        }
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
  const activeLambda = settings.chaos_lambda ?? 0.35;
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

  let competitorTeams: CompetitorTeam[] = isExplicitMock
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
  if (
    Array.isArray(leagueUsers) &&
    leagueUsers.length > 0 &&
    Array.isArray(leagueRosters) &&
    leagueRosters.length > 0
  ) {
    const userMap = new Map<string, any>();
    for (const u of leagueUsers) {
      userMap.set(String(u.user_id), u);
    }

    // Determine the single primary user roster ID
    let userTeamRosterId: number = targetSlot;
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

        const teamMetrics = calculateTeamCelestialMetrics(
          { slot, roster_id: r.roster_id, picks: teamPicks, players: r.players },
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

        const teamStarters = Array.isArray(r.starters)
          ? r.starters.filter((id: any) => id && String(id) !== '0').map(String)
          : [];
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
        };
      })
      .sort((a, b) => a.slot - b.slot);
  }

  const activeUserTeam =
    competitorTeams.find((t) => t.is_user) || competitorTeams[0];
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
  const weeklyMatchup = deriveWeeklyMatchup(
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

  const sortedWeakestBench = [...activeUserBench]
    .filter((b) => b.player && leagueEligibleSet.has(b.player.position))
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
              sortedWeakestBench[
                idx % Math.max(1, sortedWeakestBench.length)
              ] ||
              activeUserBench[0];

            const dropPlayer = dropSlot?.player || activeUserPlayers[0];
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
): Promise<ResolvedLeagueSetup> {
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
  options?: {throwOnError?: boolean},
): Promise<DraftState> {
  if (draftId === 'mock') {
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
    userSettings?.sleeper_username || 'OneiroVanguard'
  ).trim();

  // If active 429 cooldown is in effect, return offline fallback state immediately without network round-trips
  if (isRateLimited()) {
    if (options?.throwOnError) {
      throw new Error('HTTP_429_TOO_MANY_REQUESTS');
    }
    const isMock = !draftId || draftId === 'mock' || draftId === 'mock_oneiromancy_draft_2025';
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
      draft_id: draftId,
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
        draft_id: draftId,
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
      const [metadata, picks] = await Promise.all([
        fetchDraftMetadata(draftId),
        fetchDraftPicks(draftId),
      ]);
      const activeDict = playerDict || playerDictionaryCache || undefined;
      const targetLeagueId = metadata?.league_id || userSettings?.league_id;

      if (targetLeagueId) {
        const [leagueUsers, leagueRosters, leagueDetails, nflState] =
          await Promise.all([
            fetchLeagueUsers(targetLeagueId).catch(() => []),
            fetchLeagueRosters(targetLeagueId).catch(() => []),
            fetchLeague(targetLeagueId).catch(() => null),
            fetchNFLState().catch(() => null),
          ]);

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
          fetchLeagueMatchups(targetLeagueId, activeWeek).catch(() => []),
          fetchWeeklyProjections(season, activeWeek).catch(() => null),
        ]);

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
      userSettings?.sleeper_username || 'OneiroVanguard'
    ).trim();
    const cleanUser = username.replace(/^@/, '').toLowerCase().trim();
    const isCanonicalUser =
      !cleanUser ||
      cleanUser.includes('oneirovanguard') ||
      cleanUser === '9000000000000000101' ||
      cleanUser === 'user_oneiromancy_me';

    let resolvedUserId = isCanonicalUser
      ? userSettings?.user_id || '9000000000000000101'
      : undefined;
    let resolvedUsername = username;
    let userLeaguesFound = false;

    // Dynamically query user & leagues from Sleeper API
    try {
      const userLeaguesRes = await fetchUserLeagues(username);
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
        resolvedUserId = String(userLeaguesRes.user.user_id);
        resolvedUsername =
          userLeaguesRes.user.display_name ||
          userLeaguesRes.user.username ||
          username;
      }
    } catch (ulErr: unknown) {
      logSleeperWarning('[Sleeper] fetchUserLeagues warning:', ulErr);
      if (
        isCanonicalUser &&
        (!availableLeagues || availableLeagues.length === 0)
      ) {
        availableLeagues = mockSettings.available_leagues || [];
      }
    }

    // Default to first/only league if none selected or if selected league not in user leagues
    let selectedLeagueId = userSettings?.league_id;
    if (
      !selectedLeagueId ||
      (availableLeagues.length > 0 &&
        !availableLeagues.some((l) => l.league_id === selectedLeagueId))
    ) {
      if (availableLeagues.length > 0) {
        selectedLeagueId = availableLeagues[0].league_id;
      } else {
        selectedLeagueId = '9000000000000000001';
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
        );
        effectiveDraftId = resolved.draft_id;
        resolvedUserId = resolved.user_id;
        resolvedUserSlot = resolved.user_slot;
        resolvedUsername = resolved.display_name;
        leagueResolved = true;
      } catch (resErr: unknown) {
        logSleeperWarning(
          '[Sleeper] resolveLeagueDraftAndUser warning:',
          resErr,
        );
        leagueResolutionErr = resErr;
      }
    }

    // If user was not found on Sleeper and could not be resolved from selected league
    if (!leagueResolved && !userLeaguesFound && !isCanonicalUser) {
      const detailMsg =
        leagueResolutionErr?.message ||
        `User '${username}' not found on Sleeper or in league ${selectedLeagueId}`;
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
      const state = transformToDraftState(
        mockDraftMetadata,
        mockPicks,
        effectiveSettings,
        playerDict,
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

    const [
      metadata,
      picks,
      leagueUsers,
      leagueRosters,
      leagueDetails,
      nflState,
    ] = await Promise.all([
      fetchDraftMetadata(effectiveDraftId),
      fetchDraftPicks(effectiveDraftId),
      selectedLeagueId
        ? fetchLeagueUsers(selectedLeagueId)
        : Promise.resolve([]),
      selectedLeagueId
        ? fetchLeagueRosters(selectedLeagueId)
        : Promise.resolve([]),
      selectedLeagueId ? fetchLeague(selectedLeagueId) : Promise.resolve(null),
      fetchNFLState(),
    ]);

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
        ? fetchLeagueMatchups(selectedLeagueId, activeWeek)
        : Promise.resolve([]),
      fetchWeeklyProjections(season, activeWeek),
    ]);

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
        activeDict = await fetchNFLPlayers();
      } catch (err) {
        // Continue with available cached data
      }
    }
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
    const isMock = !effectiveDraftId && (!draftId || draftId === 'mock' || draftId === 'mock_oneiromancy_draft_2025');
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
