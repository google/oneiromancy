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

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AvailableLeague,
  CompetitorTeam,
  CosmicPlayer,
  DraftPickState,
  DraftState,
  ElementType,
  ElementalDistribution,
  OneiromancySettings,
  OracleWeights,
  RosterSlot,
  StackSynergyBonus,
} from '@/types/oneiromancy';
import {
  mock_oneiromancy_draft_2025,
  mockSettings,
  mockCompetitorTeams,
  mockCosmicBoard,
  mockMyRoster,
} from '@/lib/mockData';
import {
  enrichCosmicBoardWithNFLPlayers,
  fetchNFLPlayers,
  fetchSleeperDraft,
  fetchUserLeagues,
  resetRateLimit,
  deriveWeeklyMatchup,
  isRateLimitError,
  DEFAULT_LIVE_SETTINGS,
  setSeasonContext,
} from '@/lib/sleeper';
import {
  calculateHarmony,
  calculateSnakePick,
  clamp,
  classifySpiritScoreTier,
  computeDraftScore,
  computeRosterHarmony,
  computeSpiritScore,
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  deriveDraftStatus,
  normalizeOracleWeights,
  normalizeVOR,
  recomputeDraftScores,
  recomputeDraftState,
} from '@/lib/scoring';

// ============================================================================
// Polling Constants
// ============================================================================



// v2: λ and weights are stored only when the owner changes them, so a saved
// value never pins an old default (v1 saved λ 0.35 as a side effect).
const ORACLE_STORAGE_KEY = 'oneiromancy_oracle_v2';

function saveOracleSettings(v: { chaos_lambda?: number; oracle_weights?: OracleWeights }): void {
  try {
    const prev = JSON.parse(localStorage.getItem(ORACLE_STORAGE_KEY) || '{}');
    localStorage.setItem(ORACLE_STORAGE_KEY, JSON.stringify({ ...prev, ...v }));
  } catch {
    // Storage may be unavailable (private mode); the session still works.
  }
}

function loadOracleSettings(): { chaos_lambda?: number; oracle_weights?: OracleWeights } | null {
  try {
    const raw = localStorage.getItem(ORACLE_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const out: { chaos_lambda?: number; oracle_weights?: OracleWeights } = {};
    if (typeof v?.chaos_lambda === 'number') out.chaos_lambda = clamp(v.chaos_lambda, 0, 1);
    if (v?.oracle_weights && typeof v.oracle_weights === 'object') {
      out.oracle_weights = normalizeOracleWeights(v.oracle_weights);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Keep a harmony breakdown only while it still adds up to the shown score. */
function harmonyPartsIfMatching(
  parts: { label: string; points: number }[] | undefined,
  score: number,
): { label: string; points: number }[] | undefined {
  if (!parts) return undefined;
  const total = Math.min(100, parts.reduce((a, x) => a + x.points, 0));
  return Math.abs(total - score) < 0.05 ? parts : undefined;
}

export const ACTIVE_INTERVAL_MS = 5000;
export const IDLE_INTERVAL_MS = 10000;
export const BACKGROUND_INTERVAL_MS = 30000;
// Once the draft is complete only in-season data (scores, rosters) changes.
export const COMPLETE_INTERVAL_MS = 60000;
const INITIAL_SYNC_TIMESTAMP = 1725256200000;

export const POLLING_CONFIG = {
  ACTIVE_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  BACKGROUND_INTERVAL_MS,
} as const;

// ============================================================================
// Types & Normalization
// ============================================================================

export type OneiromancyTab =
  | 'oneiromancy'
  | 'matchups'
  | 'board'
  | 'marketplace'
  | 'dial'
  | 'chaos'
  | 'market'
  | 'matchup'
  | 'trades'
  | 'league';
export type SyncStatusType = 'live' | 'syncing' | 'offline';

export function normalizeTab(
  tab: string,
): 'oneiromancy' | 'matchups' | 'board' | 'market' | 'chaos' | 'trades' | 'league' {
  if (tab === 'trades' || tab === 'league') return tab;
  if (tab === 'players' || tab === 'board') return 'board';
  if (tab === 'roster' || tab === 'oneiromancy') return 'oneiromancy';
  if (tab === 'marketplace' || tab === 'market') return 'market';
  if (tab === 'matchups' || tab === 'matchup') return 'matchups';
  if (tab === 'dial' || tab === 'chaos') return 'chaos';
  return 'oneiromancy';
}

export interface OneiromancyContextState {
  /** Complete authoritative draft state (all 8 entities) */
  draftState: DraftState;
  /** Currently inspected player for detail modal / drawer */
  selectedPlayer: CosmicPlayer | null;
  /** Active mobile navigation tab */
  activeTab: OneiromancyTab;
  /** Settings drawer open/closed toggle */
  isSettingsOpen: boolean;
  /** Auto-update polling enabled flag */
  isAutoUpdate: boolean;
  /** Epoch timestamp of last successful sync or mutation */
  lastSyncTimestamp: number;
  /** Synchronization connection status */
  statusType: SyncStatusType;
  /** Derived telemetry display string (e.g. "LIVE • RD 5 PK 49") */
  statusText: string;
  /** Network loading state */
  isLoading: boolean;
  /** Last network error message if any */
  error: string | null;
  /** Active data source mode ('live' for real Sleeper league, 'mock' for Oneiromancy engine) */
  mode: 'live' | 'mock';
  /** Visible synchronization error notice if live fetch fails (CORS/offline/network) */
  syncError: string | null;
  /** Visible synchronization warning notice if non-fatal issues occur */
  syncWarning: string | null;
  /** Active user team roster ID */
  userRosterId?: number;
  /** Active user draft slot */
  userSlot: number;
  /** Active user team name */
  userTeamName: string;
  /** Selected player IDs for multi-player comparison across board views (max 6) */
  comparedPlayerIds: string[];
}

export interface OneiromancyContextActions {
  /** Switches active navigation tab */
  setTab: (tab: OneiromancyTab) => void;
  /** Selects or deselects player for detailed divination inspection */
  selectPlayer: (player: CosmicPlayer | null) => void;
  /** Instantly recalculates all player DraftScores in <2ms using recomputeDraftScores */
  updateChaosLambda: (lambda: number) => void;
  /** Recalibrates spirit scores and draft scores across board based on custom divination weights */
  updateOracleWeights: (weights: Partial<OracleWeights>) => void;
  /** Resets oracle weights to canonical 30/20/25/10/15 proportions */
  resetOracleWeights: () => void;
  /** Moves player to user roster, advances snake draft clock, recomputes Harmony & Stacks */
  draftPlayer: (playerId: string) => void;
  /** Toggles background auto-update polling on/off */
  toggleAutoUpdate: () => void;
  /** Updates background polling interval (e.g. 5000ms active or 10000ms standard) */
  setPollInterval: (interval: number) => void;
  /** Manually forces a sync/refresh, returning whether sync succeeded cleanly */
  refreshDraft: (forcedUsername?: string, forcedLeagueId?: string) => Promise<{ ok: boolean; error?: string | null }>;
  /** Toggles settings drawer visibility */
  toggleSettings: (isOpen?: boolean) => void;
  /** Overrides draft ID to connect to a different Sleeper draft */
  setDraftId: (draftId: string) => void;
  /** Sets user draft slot (1-12) to view that team's roster */
  setUserSlot: (slot: number) => void;
  /** Sets user ID or username */
  setUserId: (userId: string) => void;
  /** Sets Sleeper username */
  setSleeperUsername: (username: string) => void;
  /** Sets active Sleeper league ID */
  setLeagueId: (leagueId: string) => void;
  /** Immediately loads canonical mock data parameters without network overhead */
  loadMockData: () => void;
  /** Switches mode between 'live' (Sleeper league) and 'mock' (Oneiromancy mock engine) */
  setMode: (mode: 'live' | 'mock') => void;
  /** Queries Sleeper for user leagues and updates draftState.available_leagues */
  syncLeagues: (username: string, signal?: AbortSignal) => Promise<AvailableLeague[]>;
  /** Centralized predicate to check if a team, roster ID, or draft slot belongs to the user */
  isUserTeam: (teamOrId: CompetitorTeam | number | string) => boolean;
  /** Toggles multi-player comparison state for a player (capped at MAX_COMPARE = 6) */
  toggleComparePlayer: (id: string) => void;
  /** Clears all compared players */
  clearComparedPlayers: () => void;
}

export type OneiromancyContextValue = OneiromancyContextState & OneiromancyContextActions;

// ============================================================================
// Context Definitions
// ============================================================================

const OneiromancyContext = createContext<OneiromancyContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

function getSavedSleeperUsername(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('oneiromancy_active_username');
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {
    // Ignore localStorage access failures
  }
  return null;
}

function hasUrlLaunchParams(): boolean {
  if (typeof window === 'undefined' || !window.location?.search) return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(
    params.get('user')?.trim() ||
      params.get('username')?.trim() ||
      params.get('draft_id')?.trim() ||
      params.get('draft')?.trim()
  );
}

function getUrlUsernameParam(): string {
  if (typeof window === 'undefined' || !window.location?.search) return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('user') || params.get('username') || '').trim();
}

function getUrlDraftIdParam(): string {
  if (typeof window === 'undefined' || !window.location?.search) return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('draft_id') || params.get('draft') || '').trim();
}

function getUrlSlotParam(): number | undefined {
  if (typeof window === 'undefined' || !window.location?.search) return undefined;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('slot') || params.get('user_slot');
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return !isNaN(parsed) && parsed >= 1 && parsed <= 12 ? parsed : undefined;
}

export interface OneiromancyProviderProps {
  children: React.ReactNode;
  initialDraftState?: DraftState;
}

export const MAX_COMPARE_PLAYERS = 6;

export const OneiromancyProvider: React.FC<OneiromancyProviderProps> = ({
  children,
  initialDraftState = mock_oneiromancy_draft_2025,
}) => {
  // Core reactive state
  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  const draftStateRef = useRef<DraftState>(draftState);
  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  const [selectedPlayer, setSelectedPlayer] = useState<CosmicPlayer | null>(null);
  const [activeTab, setActiveTabState] = useState<OneiromancyTab>('oneiromancy');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(
    initialDraftState.settings?.auto_update ?? true
  );
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(INITIAL_SYNC_TIMESTAMP);
  const [statusType, setStatusType] = useState<SyncStatusType>('live');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const hasExplicitInitialState = initialDraftState !== mock_oneiromancy_draft_2025;
  const [mode, setModeState] = useState<'live' | 'mock'>(
    hasExplicitInitialState && initialDraftState.settings?.mode
      ? initialDraftState.settings.mode
      : 'live'
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);
  const [comparedPlayerIds, setComparedPlayerIds] = useState<string[]>([]);

  const toggleComparePlayer = useCallback((id: string) => {
    setComparedPlayerIds((prev) => {
      const sId = String(id);
      const board = draftStateRef.current?.cosmic_board;
      const validIds = board && board.length > 0
        ? new Set(board.map((p) => String(p.id)))
        : null;
      const activePrev = validIds ? prev.filter((p) => validIds.has(p)) : prev;
      if (activePrev.includes(sId)) {
        return activePrev.filter((p) => p !== sId);
      }
      if (validIds && !validIds.has(sId)) {
        return activePrev;
      }
      if (activePrev.length >= MAX_COMPARE_PLAYERS) {
        return activePrev;
      }
      return [...activePrev, sId];
    });
  }, []);

  const clearComparedPlayers = useCallback(() => {
    setComparedPlayerIds([]);
  }, []);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const modeRef = useRef<'live' | 'mock'>(mode);
  const isMountedRef = useRef<boolean>(true);
  const syncEpochRef = useRef<number>(0);
  const inFlightSyncRef = useRef<Promise<{ ok: boolean; error?: string | null }> | null>(null);
  const inFlightSyncKeyRef = useRef<string>('');
  const activeSyncControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    isMountedRef.current = true;
    syncEpochRef.current += 1;
    return () => {
      isMountedRef.current = false;
      activeSyncControllerRef.current?.abort();
      activeSyncControllerRef.current = null;
      inFlightSyncRef.current = null;
      inFlightSyncKeyRef.current = '';
    };
  }, []);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const applyMode = useCallback((newMode: 'live' | 'mock') => {
    setModeState(newMode);
    modeRef.current = newMode;
    setComparedPlayerIds([]);
    syncEpochRef.current++;
    activeSyncControllerRef.current?.abort();
    activeSyncControllerRef.current = null;
    inFlightSyncRef.current = null;
    inFlightSyncKeyRef.current = '';
    if (newMode === 'mock') {
      nflPlayerDictRef.current = null;
      setSeasonContext(null);
    }
  }, []);

  // Persistent active user slot and username refs to anchor identity across background poll cycles and syncs
  const activeSlotRef = useRef<number | undefined>(undefined);
  // In the browser, start from the saved username (or none) rather than the
  // demo persona: child components' mount effects run before the provider's
  // hydration effect, and must not trigger a sync for a placeholder user.
  const urlUserParam = getUrlUsernameParam();
  const activeUsernameRef = useRef<string>(
    typeof window === 'undefined'
      ? (initialDraftState.settings?.sleeper_username ?? 'OneiroVanguard')
      : !hasExplicitInitialState
        ? (urlUserParam || getSavedSleeperUsername() || '')
        : (hasUrlLaunchParams()
            ? (urlUserParam || initialDraftState.settings?.sleeper_username || '')
            : (getSavedSleeperUsername() ?? ''))
  );
  const nflPlayerDictRef = useRef<Record<string, any> | null>(null);

  // Runtime background enrichment for NFL players on initialization (Live Mode only)
  useEffect(() => {
    if (mode === 'live') {
      fetchNFLPlayers()
        .then((playerDict) => {
          if (!isMountedRef.current) return;
          if (playerDict && Object.keys(playerDict).length > 0) {
            nflPlayerDictRef.current = playerDict;
            setDraftState((prev) => {
              if (prev.settings.mode === 'mock') return prev;
              return {
                ...prev,
                cosmic_board: enrichCosmicBoardWithNFLPlayers(prev.cosmic_board, playerDict),
              };
            });
          }
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          // Offline live mode: surface offline status
          setSyncWarning('Sleeper NFL player directory offline');
        });
    }
  }, [mode]);

  // --------------------------------------------------------------------------
  // Action: setTab (normalizes 'market' and 'marketplace')
  // --------------------------------------------------------------------------
  const setTab = useCallback((tab: OneiromancyTab) => {
    setActiveTabState(normalizeTab(tab));
  }, []);

  // --------------------------------------------------------------------------
  // Action: selectPlayer
  // --------------------------------------------------------------------------
  const selectPlayer = useCallback((player: CosmicPlayer | null) => {
    setSelectedPlayer(player);
  }, []);

  // --------------------------------------------------------------------------
  // Action: updateChaosLambda (<2ms in-memory recalculation)
  // --------------------------------------------------------------------------
  const updateChaosLambda = useCallback((rawLambda: number) => {
    const lambda = clamp(rawLambda, 0.0, 1.0);
    setDraftState((prev) => {
      saveOracleSettings({ chaos_lambda: lambda });
      return recomputeDraftState(prev, { chaos_lambda: lambda });
    });
  }, []);

  // --------------------------------------------------------------------------
  // Action: updateOracleWeights
  // --------------------------------------------------------------------------
  const updateOracleWeights = useCallback((weights: Partial<OracleWeights>) => {
    setDraftState((prev) => {
      const currentWeights = prev.settings.oracle_weights ?? DEFAULT_ORACLE_WEIGHTS;
      const mergedWeights = { ...currentWeights, ...weights };
      const normWeights = normalizeOracleWeights(mergedWeights);
      saveOracleSettings({ oracle_weights: normWeights });
      return recomputeDraftState(prev, { oracle_weights: normWeights });
    });
  }, []);

  // --------------------------------------------------------------------------
  // Action: resetOracleWeights
  // --------------------------------------------------------------------------
  const resetOracleWeights = useCallback(() => {
    updateOracleWeights(DEFAULT_ORACLE_WEIGHTS);
  }, [updateOracleWeights]);

  // --------------------------------------------------------------------------
  // Action: draftPlayer
  // --------------------------------------------------------------------------
  const draftPlayer = useCallback((playerId: string) => {
    setDraftState((prev) => {
      const playerIndex = prev.cosmic_board.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return prev;

      const player = prev.cosmic_board[playerIndex];
      if (player.draft_status !== 'available') return prev;

      const userId = prev.settings.user_id || 'user_oneiromancy_me';
      const currentPickNo = prev.current_pick.pick_no;

      const draftedPlayer: CosmicPlayer = {
        ...player,
        draft_status: 'my_team',
        drafted_by_user_id: userId,
        drafted_pick_no: currentPickNo,
      };

      // 1. Assign to first vacant matching roster slot
      // Starters first, then bench
      let placed = false;
      const updatedRoster = prev.my_roster.map((slot) => {
        const isStarter = !slot.slot_id.startsWith('BN');
        if (!placed && isStarter && !slot.player && slot.eligible_positions.includes(draftedPlayer.position)) {
          placed = true;
          return { ...slot, player: draftedPlayer };
        }
        return slot;
      });

      if (!placed) {
        for (let i = 0; i < updatedRoster.length; i++) {
          const slot = updatedRoster[i];
          const isBench = slot.slot_id.startsWith('BN');
          if (isBench && !slot.player && slot.eligible_positions.includes(draftedPlayer.position)) {
            updatedRoster[i] = { ...slot, player: draftedPlayer };
            placed = true;
            break;
          }
        }
      }

      // 2. Advance snake draft pick clock
      const nextPickNo = currentPickNo + 1;
      const totalTeams = 12;
      const snake = calculateSnakePick(nextPickNo - 1, totalTeams);
      const nextPick: DraftPickState = {
        round: snake.round,
        pick_no: nextPickNo,
        on_the_clock_team_id: `user_slot_${snake.slot}`,
        seconds_remaining: 90,
      };
      const nextLeagueStatus = deriveDraftStatus(nextPickNo, totalTeams, 15);

      // 3. Recompute squad stacks (QB + pass-catcher correlation)
      const rosteredPlayers = updatedRoster
        .map((s) => s.player)
        .filter((p): p is CosmicPlayer => p !== null);

      // 4. Recompute elemental distribution
      const elements: ElementalDistribution = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
      for (const p of rosteredPlayers) {
        if (p.elemental_traits?.element) {
          elements[p.elemental_traits.element] =
            (elements[p.elemental_traits.element] || 0) + 1;
        }
      }

      // 5. Recompute harmony for remaining available players
      const lambda = prev.settings.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
      const updatedBoard = prev.cosmic_board.map((p) => {
        if (p.id === playerId) {
          return draftedPlayer;
        }
        if (p.draft_status === 'available') {
          const newHarmony = calculateHarmony(updatedRoster, p, snake.round);
          const breakdown = { ...p.divination_breakdown, harmony: newHarmony };
          const newSpirit = computeSpiritScore(breakdown, prev.settings.oracle_weights);
          const newDraftScore = computeDraftScore(p.vor_normalized, newSpirit, lambda);
          return {
            ...p,
            harmony_score: newHarmony,
            divination_breakdown: breakdown,
            spirit_score: newSpirit,
            draft_score: newDraftScore,
          };
        }
        return p;
      });

      // 6. Update Path of Ascension
      const updatedIdealPath = prev.ideal_draft_path.map((step) => {
        if (step.round === prev.current_pick.round) {
          return {
            ...step,
            is_ascended: true,
            actual_picked_player_id: playerId,
          };
        }
        return step;
      });

      return {
        ...prev,
        status: nextLeagueStatus,
        current_pick: nextPick,
        cosmic_board: updatedBoard,
        ideal_draft_path: updatedIdealPath,
        my_roster: updatedRoster,
        elemental_traits: elements,
      };
    });
  }, []);

  // --------------------------------------------------------------------------
  // Action: toggleAutoUpdate
  // --------------------------------------------------------------------------
  const toggleAutoUpdate = useCallback(() => {
    setIsAutoUpdate((prev) => {
      const nextVal = !prev;
      setDraftState((state) => ({
        ...state,
        settings: { ...state.settings, auto_update: nextVal },
      }));
      return nextVal;
    });
  }, []);

  // --------------------------------------------------------------------------
  // Action: toggleSettings
  // --------------------------------------------------------------------------
  const toggleSettings = useCallback((isOpen?: boolean) => {
    setIsSettingsOpen((prev) => (isOpen !== undefined ? isOpen : !prev));
  }, []);

  // --------------------------------------------------------------------------
  // Action: setDraftId
  // --------------------------------------------------------------------------
  const setDraftId = useCallback((draftId: string) => {
    setComparedPlayerIds([]);
    setDraftState((prev) => ({
      ...prev,
      draft_id: draftId,
      settings: { ...prev.settings, draft_id: draftId },
    }));
  }, []);

  // --------------------------------------------------------------------------
  // Action: setUserSlot
  // --------------------------------------------------------------------------
  const setUserSlot = useCallback((slot: number) => {
    const validSlot = Math.max(1, Math.min(12, Number(slot) || 1));
    activeSlotRef.current = validSlot;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('oneiromancy_active_slot', String(validSlot));
      } catch {
        // Ignore localStorage errors
      }
    }
    setDraftState((prev) => {
      const updatedTeams = (prev.competitor_teams || []).map((t) => {
        const isUser = t.slot === validSlot;
        const cleanName = t.name.replace(/\s*\(You\)$/, '');
        return {
          ...t,
          is_user: isUser,
          name: isUser ? `${cleanName} (You)` : cleanName,
        };
      });
      const activeWeek =
        prev.weekly_matchup?.upcoming_matchups?.find((m) => m.status === 'active')?.week ||
        (prev.weekly_matchup?.week && prev.weekly_matchup.week >= 2 ? prev.weekly_matchup.week : 2);
      const userTeam = updatedTeams.find((t) => t.is_user);
      const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : validSlot;
      const updatedMatchup =
        updatedTeams.length > 0
          ? deriveWeeklyMatchup(
              userRosterId,
              updatedTeams,
              null,
              prev.cosmic_board,
              prev.my_roster,
              activeWeek
            )
          : (prev.isLive || prev.settings?.mode === 'live' ? undefined : prev.weekly_matchup);
      return {
        ...prev,
        settings: { ...prev.settings, user_slot: validSlot },
        competitor_teams: updatedTeams,
        weekly_matchup: updatedMatchup,
      };
    });
  }, []);

  // Restore the owner's Oracle (λ and star weights) on mount. They are the
  // scoring model every screen ranks by, so they must survive a reload.
  useEffect(() => {
    const saved = loadOracleSettings();
    if (!saved) return;
    setDraftState((prev) => recomputeDraftState(prev, saved));
  }, []);

  // Hydrate active persona from localStorage on mount (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedSlot = localStorage.getItem('oneiromancy_active_slot');
      const savedUsername = localStorage.getItem('oneiromancy_active_username');
      if (savedSlot) {
        const parsed = parseInt(savedSlot, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
          activeSlotRef.current = parsed;
          setUserSlot(parsed);
        }
      }
      const urlUser = !hasExplicitInitialState ? getUrlUsernameParam() : '';
      const resolvedBootUser = urlUser || (savedUsername ? savedUsername.trim() : '');
      if (resolvedBootUser) {
        activeUsernameRef.current = resolvedBootUser;
        setDraftState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            sleeper_username: resolvedBootUser,
          },
        }));
      } else if (
        !hasExplicitInitialState &&
        window.location &&
        typeof window.location.origin === 'string' &&
        window.location.origin.startsWith('http') &&
        !hasUrlLaunchParams()
      ) {
        activeUsernameRef.current = '';
        prevConfigRef.current = {
          draft_id: draftStateRef.current.draft_id,
          sleeper_username: '',
          league_id: '',
        };
        applyMode('mock');
        setDraftState((prev) => ({
          ...prev,
          available_leagues: [],
          settings: {
            ...prev.settings,
            sleeper_username: '',
            league_id: '',
            available_leagues: [],
            mode: 'mock',
          },
        }));
        setStatusType('offline');
        setIsSettingsOpen(true);
      } else if (!hasExplicitInitialState && !getUrlUsernameParam()) {
        const urlDraftId = getUrlDraftIdParam();
        activeUsernameRef.current = '';
        prevConfigRef.current = {
          ...prevConfigRef.current,
          sleeper_username: '',
          ...(urlDraftId ? { draft_id: urlDraftId, league_id: '' } : {}),
        };
        setDraftState((prev) => ({
          ...prev,
          ...(urlDraftId ? { draft_id: urlDraftId, available_leagues: [] } : {}),
          settings: {
            ...prev.settings,
            sleeper_username: '',
            ...(urlDraftId ? { draft_id: urlDraftId, league_id: '', available_leagues: [] } : {}),
          },
        }));
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, [setUserSlot, applyMode, hasExplicitInitialState]);

  // --------------------------------------------------------------------------
  // Action: setUserId
  // --------------------------------------------------------------------------
  const setUserId = useCallback((userId: string) => {
    setDraftState((prev) => ({
      ...prev,
      settings: { ...prev.settings, user_id: userId },
    }));
  }, []);

  // --------------------------------------------------------------------------
  // Action: setSleeperUsername
  // --------------------------------------------------------------------------
  const setSleeperUsername = useCallback((username: string) => {
    const cleanUsername = username.trim();
    activeUsernameRef.current = cleanUsername;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('oneiromancy_active_username', cleanUsername);
      } catch {
        // Ignore localStorage errors
      }
    }
    setDraftState((prev) => {
      const matchingTeam = prev.competitor_teams?.find(
        (t) =>
          t.owner_name?.toLowerCase() === cleanUsername.toLowerCase() ||
          t.name?.toLowerCase().includes(cleanUsername.toLowerCase())
      );
      const newSlot = matchingTeam ? (matchingTeam.slot || matchingTeam.roster_id) : undefined;
      if (newSlot) {
        activeSlotRef.current = newSlot;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('oneiromancy_active_slot', String(newSlot));
          } catch {
            // Ignore localStorage errors
          }
        }
      } else {
        activeSlotRef.current = undefined;
      }
      const targetSlot = newSlot || prev.settings?.user_slot || activeSlotRef.current || 7;
      const updatedTeams = (prev.competitor_teams || []).map((t) => {
        const isUser = t.slot === targetSlot;
        const cleanName = t.name.replace(/\s*\(You\)$/, '');
        return {
          ...t,
          is_user: isUser,
          name: isUser ? `${cleanName} (You)` : cleanName,
        };
      });
      const activeWeek =
        prev.weekly_matchup?.upcoming_matchups?.find((m) => m.status === 'active')?.week ||
        (prev.weekly_matchup?.week && prev.weekly_matchup.week >= 2 ? prev.weekly_matchup.week : 2);
      const userTeam = updatedTeams.find((t) => t.is_user);
      const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : (targetSlot === 7 ? 2 : targetSlot);
      const updatedMatchup =
        updatedTeams.length > 0
          ? deriveWeeklyMatchup(
              userRosterId,
              updatedTeams,
              null,
              prev.cosmic_board,
              prev.my_roster,
              activeWeek
            )
          : (prev.isLive || prev.settings?.mode === 'live' ? undefined : prev.weekly_matchup);

      return {
        ...prev,
        settings: {
          ...prev.settings,
          sleeper_username: cleanUsername,
          ...(newSlot ? { user_slot: newSlot } : {}),
        },
        competitor_teams: updatedTeams,
        weekly_matchup: updatedMatchup,
      };
    });
  }, []);

  // --------------------------------------------------------------------------
  // Action: setLeagueId
  // --------------------------------------------------------------------------
  const setLeagueId = useCallback((leagueId: string) => {
    const cleanLeagueId = leagueId.trim();
    setComparedPlayerIds([]);
    setDraftState((prev) => ({
      ...prev,
      settings: { ...prev.settings, league_id: cleanLeagueId },
    }));
  }, []);

  const prevConfigRef = useRef({
    draft_id: initialDraftState.draft_id,
    sleeper_username: initialDraftState.settings?.sleeper_username ?? '',
    league_id: initialDraftState.settings?.league_id ?? '',
  });

  // --------------------------------------------------------------------------
  // Action: loadMockData (Instantly restores canonical mock data parameters)
  // --------------------------------------------------------------------------
  const loadMockData = useCallback(() => {
    applyMode('mock');
    // Sample data never adopts, saves or syncs a username: the owner's real
    // account (if any) stays as it was, and nothing looks connected.
    const realUsername = activeUsernameRef.current || '';
    const targetSlot = activeSlotRef.current || 7;
    const teamsList = mock_oneiromancy_draft_2025.competitor_teams || [];
    const updatedTeams = teamsList.map((t) => {
      const isUser = t.slot === targetSlot;
      const cleanName = t.name.replace(/\s*\(You\)$/, '');
      return {
        ...t,
        is_user: isUser,
        name: isUser ? `${cleanName} (You)` : cleanName,
      };
    });
    const userTeam = updatedTeams.find((t) => t.is_user);
    const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : (targetSlot === 7 ? 2 : targetSlot);
    const cleanBoard = mockCosmicBoard;
    const updatedMatchup = deriveWeeklyMatchup(
      userRosterId,
      updatedTeams,
      null,
      cleanBoard,
      mockMyRoster,
      2
    );
    prevConfigRef.current = {
      draft_id: mock_oneiromancy_draft_2025.draft_id,
      sleeper_username: realUsername,
      league_id: mockSettings.league_id ?? '',
    };
    setDraftState({
      ...mock_oneiromancy_draft_2025,
      cosmic_board: cleanBoard,
      competitor_teams: updatedTeams,
      weekly_matchup: updatedMatchup,
      settings: {
        ...mockSettings,
        user_slot: targetSlot,
        sleeper_username: realUsername,
        available_leagues: [],
        mode: 'mock',
        offline_mode_active: false,
      },
    });
    setStatusType('offline');
    setIsSettingsOpen(false);
    setError(null);
    setSyncError(null);
    setSyncWarning(null);
    setLastSyncTimestamp(Date.now());
  }, [applyMode]);

  // --------------------------------------------------------------------------
  // Action: setPollInterval
  // --------------------------------------------------------------------------
  const setPollInterval = useCallback((interval: number) => {
    const validInterval = Math.max(1000, Number(interval) || ACTIVE_INTERVAL_MS);
    setDraftState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        poll_interval_ms: validInterval,
      },
    }));
  }, []);

  // --------------------------------------------------------------------------
  // Helper: Deterministic Data Fingerprint for Diff-Gated Rendering
  // --------------------------------------------------------------------------
  const computeSleeperDataFingerprint = useCallback(
    (state: Partial<DraftState> | null | undefined): string => {
      if (!state) return 'empty';
      const draftId = state.draft_id ?? '';
      const status = state.status ?? '';
      const pickNo = state.current_pick?.pick_no ?? 0;
      const boardLen = state.cosmic_board?.length ?? 0;
      const wk = state.weekly_matchup?.week ?? 0;
      const matchupId = state.weekly_matchup?.matchup_id ?? 0;
      const userPts = state.weekly_matchup?.user_team?.projected_points ?? 0;
      const oppId = state.weekly_matchup?.opponent_team?.roster_id ?? 0;
      const oppPts = state.weekly_matchup?.opponent_team?.projected_points ?? 0;
      const rosterSig = (state.my_roster || [])
        .map(
          (s) =>
            `${s.slot_id}:${s.player?.id ?? 'none'}:${s.player?.projected_points ?? 0}:${s.player?.injury_status ?? ''}:${s.player?.next_play_week ?? ''}:${s.player?.next_week_projected_points ?? ''}`
        )
        .join(',');
      const boardLookaheadSig = (state.cosmic_board || [])
        .filter((p) => p.next_play_week !== undefined || p.next_week_projected_points !== undefined)
        .map((p) => `${p.id}:${p.next_play_week ?? ''}:${p.next_week_projected_points ?? ''}`)
        .join(',');
      const waiverSig = (state.waiver_upgrades || [])
        .map((w) => `${w.id}:${w.net_score_delta}:${w.recommended_drop_id}`)
        .join(',');
      const tradeSig = (state.trade_proposals || [])
        .map((t) => `${t.proposal_id}:${t.net_vor_delta}`)
        .join(',');
      return `${draftId}|${status}|${pickNo}|${boardLen}|${wk}:${matchupId}:${userPts}:${oppId}:${oppPts}|${rosterSig}|${boardLookaheadSig}|${waiverSig}|${tradeSig}`;
    },
    []
  );

  // --------------------------------------------------------------------------
  // Action: performLiveSync (Dynamic Sleeper League Resolution & Ingestion)
  // --------------------------------------------------------------------------
  const performLiveSync = useCallback(
    async (
      forcedDraftId?: string,
      forcedLeagueId?: string,
      forcedUsername?: string
    ): Promise<{ ok: boolean; error?: string | null }> => {
      const isForcedOverride = Boolean(forcedDraftId || forcedLeagueId || forcedUsername);
      const isBrowserHttp =
        typeof window !== 'undefined' &&
        Boolean(
          window.location &&
            typeof window.location.origin === 'string' &&
            window.location.origin.startsWith('http')
        );
      if (
        isBrowserHttp &&
        !isForcedOverride &&
        !activeUsernameRef.current &&
        !getSavedSleeperUsername() &&
        !hasUrlLaunchParams()
      ) {
        setStatusType('offline');
        setIsLoading(false);
        return { ok: false, error: null };
      }

      // Concurrent callers share the in-flight sync: unforced ones always, and
      // forced ones when they request the same user/league/draft.
      const syncKey = `${forcedDraftId ?? ''}|${forcedLeagueId ?? ''}|${forcedUsername ?? ''}`;
      if (
        inFlightSyncRef.current &&
        (!isForcedOverride || inFlightSyncKeyRef.current === syncKey)
      ) {
        return inFlightSyncRef.current;
      }

      const urlDraftId = !hasExplicitInitialState ? getUrlDraftIdParam() : '';
      const urlUser = !hasExplicitInitialState ? getUrlUsernameParam() : '';
      const urlSlot = !hasExplicitInitialState ? getUrlSlotParam() : undefined;
      const fallbackSavedUser = getSavedSleeperUsername() || '';
      const draftSettingsUser = draftStateRef.current.settings?.sleeper_username || '';
      const username =
        forcedUsername ||
        activeUsernameRef.current ||
        urlUser ||
        fallbackSavedUser ||
        (!hasExplicitInitialState && typeof window !== 'undefined' && !urlUser
          ? (draftSettingsUser && draftSettingsUser !== 'OneiroVanguard' ? draftSettingsUser : '')
          : (draftSettingsUser || 'OneiroVanguard'));
      const currentDraftId = draftStateRef.current.draft_id;
      const resolvedStateDraftId =
        currentDraftId &&
        currentDraftId !== 'mock' &&
        currentDraftId !== 'mock_oneiromancy_draft_2025' &&
        currentDraftId !== '9000000000000000002'
          ? currentDraftId
          : undefined;
      const targetDraftId = forcedDraftId || resolvedStateDraftId || urlDraftId || undefined;
      const leagueId =
        forcedLeagueId ||
        (draftStateRef.current.settings?.league_id &&
        draftStateRef.current.settings.league_id !== '9000000000000000001'
          ? draftStateRef.current.settings.league_id
          : undefined) ||
        '';

      if (
        !hasExplicitInitialState &&
        typeof window !== 'undefined' &&
        !targetDraftId &&
        !username &&
        !forcedLeagueId
      ) {
        setStatusType('offline');
        setIsLoading(false);
        return { ok: false, error: null };
      }

      const hasExistingLiveData = Boolean(
        draftStateRef.current.isLive &&
          (draftStateRef.current.cosmic_board?.length ?? 0) > 0 &&
          !isForcedOverride
      );

      // Only show loading/syncing state on cold initial load or explicit user config switch.
      // Background refreshes fetch silently and only trigger a render if data actually diffs.
      if (!hasExistingLiveData) {
        setIsLoading(true);
        setStatusType('syncing');
      }
      setError(null);
      setSyncError(null);
      let taskSettled = false;
      const syncTask = (async () => {
        const currentEpoch = ++syncEpochRef.current;
        activeSyncControllerRef.current?.abort();
        const syncController = new AbortController();
        activeSyncControllerRef.current = syncController;
        const wasForcedUserSync = Boolean(forcedUsername?.trim());
        const isStale = () =>
          !isMountedRef.current ||
          currentEpoch !== syncEpochRef.current ||
          (!wasForcedUserSync && modeRef.current === 'mock');
        try {
          const isMockMode = modeRef.current === 'mock' || targetDraftId === 'mock' || targetDraftId === 'mock_oneiromancy_draft_2025';

          const currentActiveSlot = activeSlotRef.current ??
            urlSlot ??
            (isMockMode ? (draftStateRef.current.settings?.user_slot || 7) : undefined);

          const baseSettingsLeagues = draftStateRef.current.isLive
            ? (draftStateRef.current.settings?.available_leagues || [])
            : (draftStateRef.current.settings?.available_leagues || []).filter(
                (l) => l.league_id !== '9000000000000000001'
              );

          const freshData = await fetchSleeperDraft(
            targetDraftId,
            {
              ...draftStateRef.current.settings,
              mode: 'live',
              league_id: leagueId,
              sleeper_username: username,
              user_slot: currentActiveSlot,
              available_leagues: baseSettingsLeagues,
            },
            undefined,
            { throwOnError: true, signal: syncController.signal }
          );

          if (isStale()) {
            return { ok: false, error: 'Stale sync superseded' };
          }

          // In-browser runtime enrichment for NFL master players & daily changes (live mode only)
          if (!isMockMode && (modeRef.current as string) === 'live') {
            try {
              const playerDict = await fetchNFLPlayers();
              if (isStale()) {
                return { ok: false, error: 'Stale sync superseded' };
              }
              if (playerDict && Object.keys(playerDict).length > 0) {
                nflPlayerDictRef.current = playerDict;
                freshData.cosmic_board = enrichCosmicBoardWithNFLPlayers(
                  freshData.cosmic_board,
                  playerDict
                );
              }
            } catch (nflErr) {
              if (!isRateLimitError(nflErr)) {
                console.warn('[OneiromancyContext] NFL players live update notice:', nflErr);
              }
            }
          }

          if (isStale()) {
            return { ok: false, error: 'Stale sync superseded' };
          }

          let didDataDiff = true;

          setDraftState((prev) => {
            if (isStale()) {
              return prev;
            }
            const prevPickCount = prev.current_pick?.pick_no ?? 0;
            const newPickCount = freshData.current_pick?.pick_no ?? 0;
            const prevBoardLen = prev.cosmic_board?.length ?? 0;
            const newBoardLen = freshData.cosmic_board?.length ?? 0;

            const hasStaleSeedScores = (prev.competitor_teams || []).some(
              (t) => t.slot === 7 && t.harmony_score === 98.0
            );

            // Strict diff check: When live state is already loaded and the Sleeper payload
            // has zero data diff across draft picks, rosters, matchup projections, waivers, and trades,
            // return the EXACT `prev` reference so React bails out without re-rendering.
            if (
              !hasStaleSeedScores &&
              prev.isLive &&
              prevPickCount === newPickCount &&
              prevBoardLen > 0 &&
              prevBoardLen === newBoardLen &&
              prev.sync_error === null &&
              prev.sync_warning === null &&
              computeSleeperDataFingerprint(prev) === computeSleeperDataFingerprint(freshData)
            ) {
              didDataDiff = false;
              return prev;
            }

          const mergedSettings: OneiromancySettings = {
            ...freshData.settings,
            chaos_lambda: prev.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA,
            oracle_weights: prev.settings?.oracle_weights ?? DEFAULT_ORACLE_WEIGHTS,
            auto_update: prev.settings?.auto_update ?? true,
            poll_interval_ms: prev.settings?.poll_interval_ms ?? ACTIVE_INTERVAL_MS,
            mode: 'live',
          };

          const activeRoster = freshData.my_roster || prev.my_roster || [];
          // transformToDraftState already blends each player's harmony pillar with
          // the user's roster once. Blending again here moved the player list's
          // Spirit / Stars / Oracle away from the roster's for the same player.
          const boardWithSpirit = freshData.cosmic_board;
          const recomputedBoard = recomputeDraftScores(boardWithSpirit, mergedSettings);
          // Roster slots hold copies; give them the recomputed numbers so every
          // screen shows one Spirit / Stars / Oracle per player.
          const boardById = new Map(recomputedBoard.map((p) => [String(p.id), p]));
          const syncedRoster = activeRoster.map((slot) => {
            const fresh = slot.player ? boardById.get(String(slot.player.id)) : undefined;
            return fresh && slot.player
              ? {
                  ...slot,
                  player: {
                    ...slot.player,
                    team: fresh.team || slot.player.team,
                    bye_week: fresh.bye_week || slot.player.bye_week,
                    harmony_score: fresh.harmony_score,
                    divination_breakdown: fresh.divination_breakdown,
                    spirit_score: fresh.spirit_score,
                    draft_score: fresh.draft_score,
                    favorability_score: fresh.favorability_score,
                    favorability_verdict: fresh.favorability_verdict,
                    next_play_week: fresh.next_play_week,
                    next_week_projected_points: fresh.next_week_projected_points,
                  },
                }
              : slot;
          });

          const updatedIdealPath = (freshData.ideal_draft_path || []).map((step) => ({
            ...step,
            draft_score: computeDraftScore(
              normalizeVOR(step.positional_vor),
              step.spirit_score,
              mergedSettings.chaos_lambda
            ),
          }));

          const prevLeaguesRaw =
            prev.available_leagues && prev.available_leagues.length > 0
              ? prev.available_leagues
              : (prev.settings?.available_leagues && prev.settings.available_leagues.length > 0
                  ? prev.settings.available_leagues
                  : []);
          const prevNonMockLeagues = prev.isLive
            ? prevLeaguesRaw
            : prevLeaguesRaw.filter((l) => l.league_id !== '9000000000000000001');

          const resolvedLeagues =
            freshData.available_leagues && freshData.available_leagues.length > 0
              ? freshData.available_leagues
              : prevNonMockLeagues;

          // The slot Sleeper resolved from the username wins. The local guess
          // (a saved slot, or 7 before the first sync) only fills in when Sleeper
          // couldn't resolve one; preferring the guess showed every user other
          // than draft slot 7 someone else's team.
          const resolvedSlot =
            freshData.settings?.user_slot || currentActiveSlot || 7;
          activeSlotRef.current = resolvedSlot;
          try {
            localStorage.setItem('oneiromancy_active_slot', String(resolvedSlot));
          } catch {
            // Ignore localStorage errors
          }

          const getWeeklyPts = (p?: CosmicPlayer | null): number => {
            if (!p) return 0;
            return p.sleeper_projected_points ?? p.weekly_projected_points ?? p.projected_points ?? 0;
          };

          const userStarterSlots = activeRoster.filter(
            (s) => !s.slot_id.startsWith('BN') && s.player !== null
          );
          const userZeroStarters = userStarterSlots.filter(
            (s) => getWeeklyPts(s.player) <= 0.5
          ).length;
          const userStarterPts =
            freshData.weekly_matchup?.user_team?.projected_points ||
            userStarterSlots.reduce((sum, s) => sum + getWeeklyPts(s.player), 0);
          const oppMatchupSlot = freshData.weekly_matchup?.opponent_team?.slot ?? 3;
          const oppMatchupPts = freshData.weekly_matchup?.opponent_team?.projected_points || 121.02;

          const reconciledTeams = (freshData.competitor_teams || prev.competitor_teams || []).map((t) => {
            const isUser = t.slot === resolvedSlot;
            const cleanName = t.name.replace(/\s*\(You\)$/, '');
            const teamPicks = t.picks || [];
            const pickPlayers = teamPicks
              .map((pk) => recomputedBoard.find((cb) => String(cb.id) === String(pk.player_id)))
              .filter((p): p is CosmicPlayer => Boolean(p));

            const top8 = [...pickPlayers]
              .sort((a, b) => getWeeklyPts(b) - getWeeklyPts(a))
              .slice(0, 8);

            const rosterPlayers = (t.players || [])
              .map((pid) => recomputedBoard.find((cb) => String(cb.id) === String(pid)))
              .filter((p): p is CosmicPlayer => Boolean(p));

            const pList = rosterPlayers.length > 0 ? rosterPlayers : pickPlayers;
            const starterIds = new Set(((t as any).starters || []).map(String));
            const lineup = pList.filter((p) => starterIds.has(String(p.id)));
            const meanSp =
              pList.length > 0
                ? pList.reduce((sum, p) => sum + (p.spirit_score || 78.0), 0) / pList.length
                : (t.avg_spirit_score ?? 78.0);
            const meanDr =
              pList.length > 0
                ? pList.reduce((sum, p) => sum + (p.draft_score || 76.0), 0) / pList.length
                : (t.avg_draft_score ?? 76.0);
            const harmScore =
              pList.length > 0
                ? computeRosterHarmony(lineup.length > 0 ? lineup : pList)
                : (t.harmony_score ?? 77.0);

            const avgSpirit = Math.round(meanSp * 10) / 10;
            const avgDraft = Math.round(meanDr * 10) / 10;

            const comp = Math.round((avgSpirit * 0.4 + avgDraft * 0.3 + harmScore * 0.3) * 10) / 10;
            const { tier: favTier, badgeLabel: favLabel } = classifySpiritScoreTier(comp);

            return {
              ...t,
              is_user: isUser,
              name: isUser ? `${cleanName} (You)` : cleanName,
              avg_spirit_score: avgSpirit,
              avg_draft_score: avgDraft,
              harmony_score: harmScore,
              total_spirit_score: Math.round(avgSpirit * 15 * 10) / 10,
              total_draft_score: Math.round(avgDraft * 15 * 10) / 10,
              favorability_tier: favTier,
              favorability_label: favLabel,
            };
          });

          const userTeam = reconciledTeams.find((t) => t.is_user);
          const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : (resolvedSlot === 7 ? 2 : resolvedSlot);
          const reconciledMatchup =
            freshData.weekly_matchup &&
            (freshData.weekly_matchup.user_team?.roster_id === userRosterId ||
              freshData.weekly_matchup.user_team?.slot === resolvedSlot)
              ? {
                  ...freshData.weekly_matchup,
                  user_team: {
                    ...freshData.weekly_matchup.user_team,
                    harmony_score: userTeam?.harmony_score ?? freshData.weekly_matchup.user_team.harmony_score,
                  },
                  team_comparison: freshData.weekly_matchup.team_comparison
                    ? {
                        ...freshData.weekly_matchup.team_comparison,
                        // Astral favorability stays this week's starter Stars for both
                        // sides; only harmony is re-synced with the reconciled team.
                        user_harmony_score: userTeam?.harmony_score ?? 74.5,
                        user_harmony_parts: harmonyPartsIfMatching(
                          freshData.weekly_matchup.team_comparison.user_harmony_parts,
                          userTeam?.harmony_score ?? 74.5,
                        ),
                      }
                    : freshData.weekly_matchup.team_comparison,
                }
              : reconciledTeams.length > 0
                ? deriveWeeklyMatchup(
                    userRosterId,
                    reconciledTeams,
                    null,
                    recomputedBoard,
                    syncedRoster,
                    freshData.weekly_matchup?.week || prev.weekly_matchup?.week || 1
                  )
                : undefined;

          return {
            ...freshData,
            cosmic_board: recomputedBoard,
            my_roster: syncedRoster,
            ideal_draft_path: updatedIdealPath,
            competitor_teams: reconciledTeams,
            weekly_matchup: reconciledMatchup,
            settings: {
              ...mergedSettings,
              user_slot: resolvedSlot,
              sleeper_username: username,
              available_leagues: resolvedLeagues,
            },
            available_leagues: resolvedLeagues,
            isLive: true,
            mode: 'live',
            sync_error: null,
            sync_warning: null,
          };
          });

          if (isStale()) {
            return { ok: false, error: 'Stale sync superseded' };
          }

          if (forcedUsername?.trim()) {
            activeUsernameRef.current = forcedUsername.trim();
          }
          prevConfigRef.current = {
            draft_id: freshData.draft_id,
            sleeper_username: username,
            league_id: freshData.settings?.league_id ?? draftStateRef.current.settings?.league_id ?? '',
          };

          modeRef.current = 'live';
          setModeState('live');
          if (didDataDiff || !hasExistingLiveData) {
            setLastSyncTimestamp(Date.now());
          }
          setStatusType(freshData.settings?.offline_mode_active ? 'offline' : 'live');
          setSyncError(null);
          setSyncWarning(null);
          return { ok: true, error: null };
        } catch (err: any) {
          if (isStale()) {
            return { ok: false, error: 'Stale sync superseded' };
          }
          const errMsg = err?.message || String(err);
          if (!isRateLimitError(err)) {
            console.warn('[OneiromancyContext] Live Sleeper sync failure:', errMsg);
          }
          const isNetworkOrCors =
            err?.name === 'TimeoutError' ||
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('Network') ||
            errMsg.includes('abort') ||
            errMsg.includes('timeout') ||
            errMsg.toLowerCase().includes('timed out') ||
            errMsg.includes('ENOTFOUND') ||
            errMsg.includes('CORS');

          const userFacingNotice = isNetworkOrCors
            ? `Sleeper API unreachable from client browser (Network/CORS blocked or offline): ${errMsg}`
            : `Sleeper sync failed: ${errMsg}`;

          const currentlyLive = draftStateRef.current.isLive;
          const leagueLabel = leagueId || draftStateRef.current.settings?.league_id || '';
          setSyncError(userFacingNotice);
          setSyncWarning(
            currentlyLive
              ? `Dynamic Sleeper resolution${leagueLabel ? ` for league ${leagueLabel}` : ''} (@${username}) failed. Retaining current live state.`
              : `Dynamic Sleeper resolution for (@${username}) failed. Retaining current sample state.`
          );
          setStatusType('offline');
          setError(errMsg);

          setDraftState((prev) => {
            if (isStale()) {
              return prev;
            }
            const retainedRaw =
              prev.available_leagues && prev.available_leagues.length > 0
                ? prev.available_leagues
                : (prev.settings?.available_leagues && prev.settings.available_leagues.length > 0
                    ? prev.settings.available_leagues
                    : []);
            const retainedLeagues = prev.isLive
              ? retainedRaw
              : retainedRaw.filter((l) => l.league_id !== '9000000000000000001');
            const prevUsername = prev.settings?.sleeper_username || '';
            const safePrevUsername =
              !hasExplicitInitialState && prevUsername === 'OneiroVanguard' && !username
                ? ''
                : prevUsername;

            const targetSlot = activeSlotRef.current || prev.settings?.user_slot || 7;
            const sourceTeams = prev.isLive && prev.competitor_teams && prev.competitor_teams.length > 0
              ? prev.competitor_teams
              : [];
            const reconciledTeams = sourceTeams.map((t) => {
              const isUser = t.slot === targetSlot;
              const cleanName = t.name.replace(/\s*\(You\)$/, '');
              return {
                ...t,
                is_user: isUser,
                name: isUser ? `${cleanName} (You)` : cleanName,
              };
            });

            const userTeam = reconciledTeams.find((t) => t.is_user);
            const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : (targetSlot === 7 ? 2 : targetSlot);

            const activeMatchupWeek =
              prev.weekly_matchup?.upcoming_matchups?.find((m) => m.status === 'active')?.week ||
              (prev.weekly_matchup?.week && prev.weekly_matchup.week >= 2 ? prev.weekly_matchup.week : 2);
            const reconciledMatchup = reconciledTeams.length > 0
              ? deriveWeeklyMatchup(
                  userRosterId,
                  reconciledTeams,
                  null,
                  prev.cosmic_board || [],
                  prev.my_roster || [],
                  activeMatchupWeek
                )
              : undefined;

            const nextOfflineUsername = safePrevUsername || (prev.isLive ? (forcedUsername || username) : '');
            const nextOfflineLeagueId = prev.isLive
              ? (prev.settings?.league_id ?? '')
              : (leagueId && leagueId !== '9000000000000000001' ? leagueId : '');

            if (!prev.isLive) {
              return {
                ...prev,
                isLive: false,
                available_leagues: retainedLeagues,
                settings: {
                  ...prev.settings,
                  league_id: nextOfflineLeagueId,
                  sleeper_username: safePrevUsername,
                  last_error: errMsg,
                  sync_error: userFacingNotice,
                  mode: 'mock',
                  available_leagues: retainedLeagues,
                },
                sync_error: userFacingNotice,
                sync_warning: `Dynamic Sleeper resolution for (@${username}) failed. Retaining current sample state.`,
              };
            }

            const liveLeagueLabel = leagueId || prev.settings?.league_id || '';
            return {
              ...prev,
              competitor_teams: reconciledTeams,
              weekly_matchup: reconciledMatchup,
              available_leagues: retainedLeagues,
              settings: {
                ...prev.settings,
                league_id: nextOfflineLeagueId,
                user_slot: targetSlot,
                sleeper_username: nextOfflineUsername,
                offline_mode_active: true,
                last_error: errMsg,
                sync_error: userFacingNotice,
                mode: 'live',
                available_leagues: retainedLeagues,
              },
              sync_error: userFacingNotice,
              sync_warning: `Dynamic Sleeper resolution${liveLeagueLabel ? ` for league ${liveLeagueLabel}` : ''} (@${username}) failed. Retaining current live state.`,
            };
          });
          if (!isStale()) {
            const committedPrev = draftStateRef.current;
            const committedPrevUser = committedPrev.settings?.sleeper_username || '';
            const safeCommittedUser =
              !hasExplicitInitialState && committedPrevUser === 'OneiroVanguard' && !username
                ? ''
                : committedPrevUser;
            prevConfigRef.current = {
              draft_id: committedPrev.draft_id,
              sleeper_username: safeCommittedUser || (committedPrev.isLive ? (forcedUsername || username) : ''),
              league_id: committedPrev.isLive
                ? (committedPrev.settings?.league_id ?? '')
                : (leagueId && leagueId !== '9000000000000000001' ? leagueId : ''),
            };
          }
          return { ok: false, error: userFacingNotice };
        } finally {
          taskSettled = true;
          if (isMountedRef.current && (currentEpoch === syncEpochRef.current || modeRef.current === 'mock')) {
            setIsLoading(false);
            inFlightSyncRef.current = null;
            inFlightSyncKeyRef.current = '';
          }
        }
      })();

      if (!taskSettled) {
        inFlightSyncRef.current = syncTask;
        inFlightSyncKeyRef.current = syncKey;
      }
      return syncTask;
    },
    [computeSleeperDataFingerprint, hasExplicitInitialState]
  );

  // --------------------------------------------------------------------------
  // Action: refreshDraft (Live Sleeper API Polling with Resilient Offline Fallback)
  // --------------------------------------------------------------------------
  const refreshDraft = useCallback(
    async (
      forcedUsername?: string,
      forcedLeagueId?: string
    ): Promise<{ ok: boolean; error?: string | null }> => {
      if (forcedUsername) {
        resetRateLimit();
        return performLiveSync(undefined, forcedLeagueId, forcedUsername);
      }

      if (modeRef.current === 'mock') {
        setIsLoading(true);
        setStatusType('syncing');
        try {
          const realUsername = activeUsernameRef.current || '';
          const targetSlot = activeSlotRef.current || 7;
          setDraftState((prev) => {
            const cleanMock = structuredClone(mock_oneiromancy_draft_2025);
            const rawBoard = cleanMock.cosmic_board || mockCosmicBoard;
            const cleanBoard = rawBoard;
            const fallbackTeams = cleanMock.competitor_teams || [];
            const updatedTeams = fallbackTeams.map((t) => {
              const isUser = t.slot === targetSlot;
              const cleanName = t.name.replace(/\s*\(You\)$/, '');
              return {
                ...t,
                is_user: isUser,
                name: isUser ? `${cleanName} (You)` : cleanName,
              };
            });
            const userTeam = updatedTeams.find((t) => t.is_user);
            const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : (targetSlot === 7 ? 2 : targetSlot);
            const activeMatchupWeek = 2;
            const updatedMatchup = deriveWeeklyMatchup(
              userRosterId,
              updatedTeams,
              null,
              cleanBoard,
              cleanMock.my_roster || mockMyRoster,
              activeMatchupWeek
            );
            prevConfigRef.current = {
              draft_id: cleanMock.draft_id,
              sleeper_username: realUsername,
              league_id: mockSettings.league_id ?? '',
            };
            const cleanSettings: OneiromancySettings = {
              ...mockSettings,
              chaos_lambda: prev.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA,
              oracle_weights: prev.settings?.oracle_weights ?? DEFAULT_ORACLE_WEIGHTS,
              user_slot: targetSlot,
              sleeper_username: realUsername,
              available_leagues: [],
              mode: 'mock',
              offline_mode_active: false,
            };
            return recomputeDraftState(
              {
                ...cleanMock,
                cosmic_board: cleanBoard,
                competitor_teams: updatedTeams,
                weekly_matchup: updatedMatchup,
                settings: cleanSettings,
              },
              cleanSettings
            );
          });
          setLastSyncTimestamp(Date.now());
          setStatusType('offline');
          setSyncError(null);
          setSyncWarning(null);
        } finally {
          setIsLoading(false);
        }
        return { ok: true, error: null };
      }

      return performLiveSync(undefined, forcedLeagueId, forcedUsername);
    },
    [performLiveSync]
  );

  // --------------------------------------------------------------------------
  // Action: syncLeagues (Dynamic Sleeper League Query Helper)
  // --------------------------------------------------------------------------
  const syncLeagues = useCallback(
    async (username: string, signal?: AbortSignal): Promise<AvailableLeague[]> => {
      if (signal?.aborted) {
        throw new Error('Sync aborted');
      }
      const cleanUsername = username.trim();
      try {
        const userLeaguesRes = await fetchUserLeagues(
          cleanUsername,
          ['2026', '2025', '2024', '2023'],
          signal,
        );
        if (signal?.aborted) {
          throw new Error('Sync aborted');
        }
        const leagues: AvailableLeague[] = (userLeaguesRes?.leagues || []).map((l) => ({
          league_id: String(l.league_id),
          name: l.name,
          season: l.season,
        }));
        if (leagues.length > 0 && isMountedRef.current && !signal?.aborted) {
          setDraftState((prev) => ({
            ...prev,
            available_leagues: leagues,
            settings: {
              ...prev.settings,
              available_leagues: leagues,
            },
          }));
        }
        return leagues;
      } catch (err) {
        const isAbort = Boolean(signal?.aborted);
        if (!isAbort && !isRateLimitError(err)) {
          console.warn('[OneiromancyContext] syncLeagues error:', err);
        }
        throw err;
      }
    },
    []
  );

  // --------------------------------------------------------------------------
  // Action: setMode (Switches between Live Sleeper League and Mock Oneiromancy Engine)
  // --------------------------------------------------------------------------
  const setMode = useCallback(
    (newMode: 'live' | 'mock') => {
      applyMode(newMode);
      if (newMode === 'mock') {
        setSyncError(null);
        setSyncWarning(null);
        setStatusType('offline');
        const realUsername = activeUsernameRef.current || '';
        const targetSlot = activeSlotRef.current || 7;
        setDraftState((prev) => {
          const cleanMock = structuredClone(mock_oneiromancy_draft_2025);
          const rawBoard = cleanMock.cosmic_board || mockCosmicBoard;
          const cleanBoard = rawBoard;
          const fallbackTeams = cleanMock.competitor_teams || [];
          const updatedTeams = fallbackTeams.map((t) => {
            const isUser = t.slot === targetSlot;
            const cleanName = t.name.replace(/\s*\(You\)$/, '');
            return {
              ...t,
              is_user: isUser,
              name: isUser ? `${cleanName} (You)` : cleanName,
            };
          });
          const userTeam = updatedTeams.find((t) => t.is_user);
          const userRosterId = userTeam ? (userTeam.roster_id || userTeam.slot) : (targetSlot === 7 ? 2 : targetSlot);
          const activeMatchupWeek = 2;
          const updatedMatchup = deriveWeeklyMatchup(
            userRosterId,
            updatedTeams,
            null,
            cleanBoard,
            cleanMock.my_roster || mockMyRoster,
            activeMatchupWeek
          );
          prevConfigRef.current = {
            draft_id: cleanMock.draft_id,
            sleeper_username: realUsername,
            league_id: mockSettings.league_id ?? '',
          };
          const cleanSettings: OneiromancySettings = {
            ...mockSettings,
            chaos_lambda: prev.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA,
            oracle_weights: prev.settings?.oracle_weights ?? DEFAULT_ORACLE_WEIGHTS,
            user_slot: targetSlot,
            sleeper_username: realUsername,
            available_leagues: [],
            mode: 'mock',
            offline_mode_active: false,
          };
          return recomputeDraftState(
            {
              ...cleanMock,
              cosmic_board: cleanBoard,
              competitor_teams: updatedTeams,
              weekly_matchup: updatedMatchup,
              settings: cleanSettings,
            },
            cleanSettings
          );
        });
        setLastSyncTimestamp(Date.now());
      } else {
        performLiveSync();
      }
    },
    [applyMode, performLiveSync]
  );

  const mountUrlSyncHandledRef = useRef(false);

  // Dynamic Sleeper League Resolution on Initial Boot
  useEffect(() => {
    if (mode === 'live') {
      mountUrlSyncHandledRef.current = !hasExplicitInitialState && hasUrlLaunchParams();
      performLiveSync();
    }
  }, [performLiveSync]);

  // --------------------------------------------------------------------------
  // URL Query Parameter Support (draft_id, user_slot, user_id)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const draftParam = params.get('draft_id') || params.get('draft');
    const slotParam = params.get('slot') || params.get('user_slot');
    const userParam = params.get('user') || params.get('username');
    const tabParam = params.get('tab')?.trim();

    if (
      tabParam &&
      tabParam !== 'weights' &&
      tabParam !== 'oracle' &&
      tabParam !== 'chaos' &&
      tabParam !== 'dial'
    ) {
      setActiveTabState(normalizeTab(tabParam));
    }

    let shouldRefresh = false;
    let newDraftId: string | undefined;
    let newSlot: number | undefined;
    let newUserId: string | undefined;

    if (draftParam && draftParam.trim()) {
      newDraftId = draftParam.trim();
      shouldRefresh = true;
    }
    if (slotParam) {
      const parsedSlot = parseInt(slotParam, 10);
      if (!isNaN(parsedSlot) && parsedSlot >= 1 && parsedSlot <= 12) {
        newSlot = parsedSlot;
        activeSlotRef.current = parsedSlot;
        shouldRefresh = true;
      }
    }
    if (userParam && userParam.trim()) {
      newUserId = userParam.trim();
      activeUsernameRef.current = newUserId;
      shouldRefresh = true;
    }

    if (shouldRefresh) {
      prevConfigRef.current = {
        ...prevConfigRef.current,
        ...(newDraftId ? { draft_id: newDraftId } : {}),
        ...(newUserId ? { sleeper_username: newUserId } : {}),
      };
      setDraftState((prev) => {
        const shouldStripSyntheticLeague =
          !hasExplicitInitialState &&
          prev.settings?.league_id === '9000000000000000001' &&
          (Boolean(newDraftId) || Boolean(newUserId));
        const updatedSettings: OneiromancySettings = {
          ...prev.settings,
          ...(newDraftId ? { draft_id: newDraftId } : {}),
          ...(newSlot ? { user_slot: newSlot } : {}),
          ...(newUserId ? { user_id: newUserId, sleeper_username: newUserId } : {}),
          ...(shouldStripSyntheticLeague ? { league_id: '', available_leagues: [] } : {}),
        };
        return {
          ...prev,
          ...(newDraftId ? { draft_id: newDraftId } : {}),
          ...(shouldStripSyntheticLeague ? { available_leagues: [] } : {}),
          settings: updatedSettings,
        };
      });

      if (!mountUrlSyncHandledRef.current) {
        const deferredRefreshTimer = setTimeout(() => {
          if (isMountedRef.current) {
            refreshDraft(newUserId);
          }
        }, 0);
        return () => clearTimeout(deferredRefreshTimer);
      }
    }
  }, [refreshDraft, hasExplicitInitialState]);

  // Trigger immediate live refresh on mount unless caller supplied an explicit mock snapshot
  const mountedInitialRef = useRef(false);
  useEffect(() => {
    if (!mountedInitialRef.current) {
      mountedInitialRef.current = true;
      if (!hasExplicitInitialState || modeRef.current === 'live') {
        refreshDraft();
      }
    }
  }, [refreshDraft, hasExplicitInitialState]);

  // Trigger immediate refreshDraft() when draft_id, username, or league_id changes (user_slot is managed locally)
  const configBaselineReadyRef = useRef(false);
  useEffect(() => {
    const currentDraftId = draftState.draft_id || draftState.settings?.draft_id;
    const currentUsername = draftState.settings?.sleeper_username;
    const currentLeagueId = draftState.settings?.league_id;

    if (!hasHydrated) {
      return;
    }

    if (!configBaselineReadyRef.current) {
      configBaselineReadyRef.current = true;
      prevConfigRef.current = {
        draft_id: currentDraftId,
        sleeper_username: currentUsername ?? '',
        league_id: currentLeagueId ?? '',
      };
      return;
    }

    // No Sleeper account configured yet (first visit): nothing to sync. The
    // initial render still carries the demo persona's username, which must
    // not be mistaken for a user-initiated change.
    if (
      typeof window !== 'undefined' &&
      !activeUsernameRef.current &&
      !getSavedSleeperUsername() &&
      !hasUrlLaunchParams()
    ) {
      return;
    }

    if (
      currentDraftId !== prevConfigRef.current.draft_id ||
      (currentUsername && currentUsername !== prevConfigRef.current.sleeper_username) ||
      (currentLeagueId && currentLeagueId !== prevConfigRef.current.league_id)
    ) {
      prevConfigRef.current = {
        draft_id: currentDraftId,
        sleeper_username: currentUsername ?? '',
        league_id: currentLeagueId ?? '',
      };
      const safeUsername =
        !hasExplicitInitialState && currentUsername === 'OneiroVanguard'
          ? undefined
          : currentUsername;
      const safeLeagueId =
        !hasExplicitInitialState && currentLeagueId === '9000000000000000001'
          ? undefined
          : currentLeagueId;
      refreshDraft(safeUsername, safeLeagueId);
    }
  }, [
    draftState.draft_id,
    draftState.settings?.sleeper_username,
    draftState.settings?.league_id,
    hasHydrated,
    hasExplicitInitialState,
    refreshDraft,
  ]);

  // --------------------------------------------------------------------------
  // Background Auto-Update Poller (with Visibility Throttling & Status Downshifting)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isAutoUpdate) return;

    let timerId: NodeJS.Timeout | null = null;
    // Set on cleanup so a refresh still in flight doesn't schedule an orphaned
    // poll loop after this effect has been torn down.
    let cancelled = false;

    const schedulePoll = () => {
      if (cancelled) return;
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const currentDraft = draftStateRef.current;
      const isDrafting = currentDraft.status === 'drafting';
      const isComplete = currentDraft.status === 'complete';

      // When visible: if actively drafting, use configured interval (default 5,000ms);
      // if idle (pre_draft, paused, complete), downshift to 10,000ms.
      const configuredInterval = currentDraft.settings?.poll_interval_ms ?? ACTIVE_INTERVAL_MS;
      const baseInterval = isDrafting
        ? configuredInterval
        : isComplete
          ? COMPLETE_INTERVAL_MS
          : IDLE_INTERVAL_MS;

      // When hidden in background tab: throttle to at least 30,000ms.
      const interval = isHidden ? Math.max(30000, baseInterval) : baseInterval;

      timerId = setTimeout(async () => {
        await refreshDraft();
        schedulePoll();
      }, interval);
    };

    schedulePoll();

    const handleVisibilityChange = () => {
      if (timerId) clearTimeout(timerId);
      schedulePoll();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [
    isAutoUpdate,
    draftState.status,
    draftState.settings?.poll_interval_ms,
    refreshDraft,
  ]);

  // --------------------------------------------------------------------------
  // Telemetry Status Display Text & Effective State
  // --------------------------------------------------------------------------
  const effectiveStatusType: SyncStatusType = useMemo(() => {
    if (statusType === 'syncing') return 'syncing';
    if (mode === 'mock' || !isAutoUpdate || draftState.settings?.offline_mode_active) {
      return 'offline';
    }
    return statusType;
  }, [statusType, mode, isAutoUpdate, draftState.settings?.offline_mode_active]);

  const statusText = useMemo(() => {
    if (effectiveStatusType === 'syncing') return 'SYNCING...';
    if (effectiveStatusType === 'offline') {
      if (mode === 'mock') return 'MOCK / OFFLINE';
      if (!isAutoUpdate) return 'PAUSED / OFFLINE';
      return 'OFFLINE / CACHED';
    }
    if (draftState.status === 'complete' || !draftState.current_pick) {
      if (!hasHydrated || lastSyncTimestamp === INITIAL_SYNC_TIMESTAMP) return 'LIVE';
      const t = new Date(lastSyncTimestamp);
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      return `Synced ${hh}:${mm}`;
    }
    const currentPick = draftState.current_pick;
    return `LIVE • RD ${currentPick.round} PK ${currentPick.pick_no}`;
  }, [effectiveStatusType, mode, isAutoUpdate, draftState.current_pick, draftState.status, lastSyncTimestamp, hasHydrated]);

  // --------------------------------------------------------------------------
  // Centralized Active User Team Resolution
  // --------------------------------------------------------------------------
  const userTeam = useMemo(() => {
    const teams = draftState.competitor_teams || [];
    return (
      teams.find((t) => t.is_user === true) ||
      teams.find((t) => t.name.includes('(You)')) ||
      teams.find((t) => t.slot === (draftState.settings?.user_slot || activeSlotRef.current || 7)) ||
      teams[0]
    );
  }, [draftState.competitor_teams, draftState.settings?.user_slot]);

  const userRosterId = userTeam?.roster_id;
  const userSlot = userTeam?.slot || draftState.settings?.user_slot || activeSlotRef.current || 7;
  const userTeamName = userTeam?.name ? userTeam.name.replace(/\s*\(You\)$/, '').trim() : 'AstralOracles';

  const isUserTeam = useCallback(
    (teamOrId: CompetitorTeam | number | string): boolean => {
      if (!teamOrId) return false;
      if (typeof teamOrId === 'object') {
        if (teamOrId.is_user === true) return true;
        if (typeof teamOrId.name === 'string' && teamOrId.name.includes('(You)')) return true;
        if (userRosterId !== undefined && teamOrId.roster_id !== undefined) {
          return Number(teamOrId.roster_id) === Number(userRosterId);
        }
        if (teamOrId.slot !== undefined) {
          return Number(teamOrId.slot) === Number(userSlot);
        }
        return false;
      }
      const num = Number(teamOrId);
      if (!isNaN(num)) {
        if (userRosterId !== undefined && num === Number(userRosterId)) return true;
        return num === Number(userSlot);
      }
      return false;
    },
    [userRosterId, userSlot]
  );

  // --------------------------------------------------------------------------
  // Context Value Assembly
  // --------------------------------------------------------------------------
  const contextValue: OneiromancyContextValue = useMemo(
    () => ({
      draftState,
      selectedPlayer,
      activeTab,
      isSettingsOpen,
      isAutoUpdate,
      lastSyncTimestamp,
      statusType: effectiveStatusType,
      statusText,
      isLoading,
      error,
      mode,
      syncError,
      syncWarning,
      userRosterId,
      userSlot,
      userTeamName,
      comparedPlayerIds,
      setTab,
      selectPlayer,
      updateChaosLambda,
      updateOracleWeights,
      resetOracleWeights,
      draftPlayer,
      toggleAutoUpdate,
      setPollInterval,
      refreshDraft,
      toggleSettings,
      setDraftId,
      setUserSlot,
      setUserId,
      setSleeperUsername,
      setLeagueId,
      loadMockData,
      setMode,
      syncLeagues,
      isUserTeam,
      toggleComparePlayer,
      clearComparedPlayers,
    }),
    [
      draftState,
      selectedPlayer,
      activeTab,
      isSettingsOpen,
      isAutoUpdate,
      lastSyncTimestamp,
      effectiveStatusType,
      statusText,
      isLoading,
      error,
      mode,
      syncError,
      syncWarning,
      userRosterId,
      userSlot,
      userTeamName,
      comparedPlayerIds,
      setTab,
      selectPlayer,
      updateChaosLambda,
      updateOracleWeights,
      resetOracleWeights,
      draftPlayer,
      toggleAutoUpdate,
      setPollInterval,
      refreshDraft,
      toggleSettings,
      setDraftId,
      setUserSlot,
      setUserId,
      setSleeperUsername,
      setLeagueId,
      loadMockData,
      setMode,
      syncLeagues,
      isUserTeam,
      toggleComparePlayer,
      clearComparedPlayers,
    ]
  );

  return (
    <OneiromancyContext.Provider value={contextValue}>
      {children}
    </OneiromancyContext.Provider>
  );
};

// ============================================================================
// Consumer Hooks
// ============================================================================

export function useOneiromancy(): OneiromancyContextValue {
  const context = useContext(OneiromancyContext);
  if (!context) {
    throw new Error('useOneiromancy must be used within a <OneiromancyProvider>');
  }
  return context as OneiromancyContextValue;
}

/**
 * Like useOneiromancy(), but returns null instead of throwing when rendered
 * outside a <OneiromancyProvider>.
 */
export function useOptionalOneiromancy(): OneiromancyContextValue | null {
  return useContext(OneiromancyContext);
}

export default OneiromancyContext;
