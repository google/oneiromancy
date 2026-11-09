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

import React, { useEffect, useId, useRef, useState } from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import { CosmicPlayer, RosterSlot } from '@/types/oneiromancy';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import {
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  DIVINATION_PILLARS,
  starsVerdictLabel,
  haversineDistance,
  isPlayerOnByeWeek,
  normalizeOracleWeights,
  stripUserSuffix,
} from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import {
  TONE_PILL,
  favorabilityTone,
  oraclePlaceholderInfo,
  oracleScore,
  resolveActiveWeek,
  starsScore,
  statsPoints,
} from '@/lib/oracle';
import { X, Sparkles, Compass, Shield, ArrowRightLeft, ChevronDown } from 'lucide-react';

type ModalHistoryEntry = {
  isOpen: boolean;
  playerId: string | null;
  entryId: string | null;
  pushed: boolean;
  awaitingRePush: boolean;
  reusedPendingEntry: boolean;
  adoptedWithoutPush: boolean;
  onClose: () => void;
};

type ModalHistoryStore = {
  sessionId: string;
  nextModalEntrySeq: number;
  pendingBacks: number;
  lastPendingBackFromState: unknown;
  lastPendingBackEntryId: string | null;
  attachedPopStateWindow: Window | null;
  attachedPopStateHandler?: ((event: PopStateEvent) => void) | null;
  registeredModalEntries: Set<ModalHistoryEntry>;
};

declare global {
  interface Window {
    __oneiromancyModalHistory__?: ModalHistoryStore;
  }
}

let ssrModalStore: ModalHistoryStore | null = null;

function getModalHistoryStore(): ModalHistoryStore {
  if (typeof window !== 'undefined') {
    if (!window.__oneiromancyModalHistory__) {
      window.__oneiromancyModalHistory__ = {
        sessionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        nextModalEntrySeq: 0,
        pendingBacks: 0,
        lastPendingBackFromState: null,
        lastPendingBackEntryId: null,
        attachedPopStateWindow: null,
        attachedPopStateHandler: null,
        registeredModalEntries: new Set<ModalHistoryEntry>(),
      };
    }
    return window.__oneiromancyModalHistory__;
  }
  if (!ssrModalStore) {
    ssrModalStore = {
      sessionId: 'ssr-session',
      nextModalEntrySeq: 0,
      pendingBacks: 0,
      lastPendingBackFromState: null,
      lastPendingBackEntryId: null,
      attachedPopStateWindow: null,
      attachedPopStateHandler: null,
      registeredModalEntries: new Set<ModalHistoryEntry>(),
    };
  }
  return ssrModalStore;
}

function createModalHistoryEntryId(): string {
  const store = getModalHistoryStore();
  store.nextModalEntrySeq += 1;
  return `${store.sessionId}:${store.nextModalEntrySeq}`;
}

function safeCurrentHistoryState(): Record<string, unknown> {
  if (
    typeof window !== 'undefined' &&
    window.history?.state &&
    typeof window.history.state === 'object'
  ) {
    return window.history.state as Record<string, unknown>;
  }
  return {};
}

function syncClearedStalePendingBacks(): void {
  const store = getModalHistoryStore();
  if (store.pendingBacks <= 0 || typeof window === 'undefined' || !window.history) return;
  const currentState = window.history.state ?? null;
  const currentEntryId =
    typeof (currentState as any)?.oneiromancyEntryId === 'string'
      ? (currentState as any).oneiromancyEntryId
      : null;
  if (
    store.lastPendingBackFromState !== null &&
    currentState !== store.lastPendingBackFromState &&
    currentEntryId !== store.lastPendingBackEntryId
  ) {
    store.pendingBacks = 0;
    store.lastPendingBackFromState = null;
    store.lastPendingBackEntryId = null;
  }
}

function triggerModalHistoryBack(expectedEntryId: string | null = null): void {
  if (typeof window === 'undefined' || !window.history) return;
  const store = getModalHistoryStore();
  const currentState = window.history.state ?? null;
  const currentEntryId =
    typeof (currentState as any)?.oneiromancyEntryId === 'string'
      ? (currentState as any).oneiromancyEntryId
      : null;
  if (
    expectedEntryId &&
    currentEntryId !== expectedEntryId
  ) {
    return;
  }
  store.lastPendingBackFromState = currentState;
  store.lastPendingBackEntryId = currentEntryId;
  store.pendingBacks += 1;
  window.history.back?.();
}

function handleGlobalModalPopState(event: PopStateEvent): void {
  const store = getModalHistoryStore();
  if (store.pendingBacks > 0) {
    store.pendingBacks -= 1;
    if (store.pendingBacks === 0) {
      store.lastPendingBackFromState = null;
      store.lastPendingBackEntryId = null;
    }
    for (const entry of store.registeredModalEntries) {
      if (entry.awaitingRePush) {
        entry.awaitingRePush = false;
        entry.reusedPendingEntry = false;
        if (
          entry.isOpen &&
          entry.playerId &&
          canUseBrowserHistory() &&
          window.history.state?.oneiromancyEntryId !== entry.entryId
        ) {
          const entryId = createModalHistoryEntryId();
          entry.entryId = entryId;
          entry.pushed = true;
          window.history.pushState(
            {
              ...safeCurrentHistoryState(),
              oneiromancyModal: 'playerDetail',
              oneiromancyEntryId: entryId,
              playerId: entry.playerId,
            },
            '',
          );
        }
        return;
      }
    }
    return;
  }

  const poppedEntryId = event?.state?.oneiromancyEntryId;
  for (const entry of store.registeredModalEntries) {
    if (entry.pushed && poppedEntryId !== entry.entryId) {
      entry.pushed = false;
      entry.awaitingRePush = false;
      entry.reusedPendingEntry = false;
      entry.adoptedWithoutPush = false;
      entry.entryId = null;
      entry.onClose();
    }
  }
}

function ensureGlobalPopStateListener(): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  const store = getModalHistoryStore();
  if (
    store.attachedPopStateWindow !== window ||
    store.attachedPopStateHandler !== handleGlobalModalPopState
  ) {
    if (
      store.attachedPopStateWindow &&
      store.attachedPopStateHandler &&
      typeof store.attachedPopStateWindow.removeEventListener === 'function'
    ) {
      store.attachedPopStateWindow.removeEventListener('popstate', store.attachedPopStateHandler);
    }
    window.addEventListener('popstate', handleGlobalModalPopState);
    store.attachedPopStateWindow = window;
    store.attachedPopStateHandler = handleGlobalModalPopState;
  }
}

export function resetPlayerDetailModalHistoryForTest(): void {
  const store = getModalHistoryStore();
  store.pendingBacks = 0;
  store.lastPendingBackFromState = null;
  store.lastPendingBackEntryId = null;
  for (const entry of store.registeredModalEntries) {
    entry.pushed = false;
    entry.awaitingRePush = false;
    entry.reusedPendingEntry = false;
    entry.adoptedWithoutPush = false;
    entry.entryId = null;
  }
  if (
    store.attachedPopStateWindow &&
    typeof store.attachedPopStateWindow.removeEventListener === 'function'
  ) {
    const handler = store.attachedPopStateHandler ?? handleGlobalModalPopState;
    store.attachedPopStateWindow.removeEventListener('popstate', handler);
    store.attachedPopStateWindow = null;
    store.attachedPopStateHandler = null;
  }
  if (store.registeredModalEntries.size > 0) {
    ensureGlobalPopStateListener();
  }
}

function canUseBrowserHistory(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.history?.pushState === 'function'
  );
}

export interface PlayerDetailModalProps {
  player: CosmicPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  onDraft?: (playerId: string) => void;
  roster?: RosterSlot[];
  compareWith?: CosmicPlayer | null;
  compareCandidates?: CosmicPlayer[] | null;
  activeWeek?: number;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  isOpen,
  onClose,
  roster: propRoster,
  compareWith = null,
  compareCandidates = null,
  activeWeek: propActiveWeek,
}) => {
  const rawContentId = useId();
  const contentId = `roster-role-comp-content-${rawContentId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [isRoleCompOpen, setIsRoleCompOpen] = useState(true);
  const ctx = useOptionalOneiromancy();
  const [showRoster, setShowRoster] = useState(false);
  const comparisonKey = `${player?.id ?? ''}|${compareWith?.id ?? ''}|${(compareCandidates ?? []).map((c) => c.id).join(',')}`;
  useEffect(() => {
    setShowRoster(false);
    setIsRoleCompOpen(true);
  }, [comparisonKey, isOpen]);
  const modalLambda = ctx?.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const pillarWeights = normalizeOracleWeights(
    ctx?.draftState?.settings?.oracle_weights ?? DEFAULT_ORACLE_WEIGHTS,
  );
  const pct = (w: number) => `${Math.round(w * 100)}%`;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const activePlayerId =
    player?.id !== undefined && player?.id !== null && player.id !== ''
      ? String(player.id)
      : null;
  const modalEntryRef = useRef<ModalHistoryEntry | null>(null);
  if (!modalEntryRef.current) {
    modalEntryRef.current = {
      isOpen,
      playerId: activePlayerId,
      entryId: null,
      pushed: false,
      awaitingRePush: false,
      reusedPendingEntry: false,
      adoptedWithoutPush: false,
      onClose: () => onCloseRef.current(),
    };
  }
  modalEntryRef.current.isOpen = isOpen;
  modalEntryRef.current.playerId = isOpen ? activePlayerId : null;
  modalEntryRef.current.onClose = () => onCloseRef.current();

  const requestClose = () => {
    syncClearedStalePendingBacks();
    const entry = modalEntryRef.current!;
    if (entry.pushed && canUseBrowserHistory()) {
      const closingEntryId = entry.entryId;
      entry.pushed = false;
      entry.entryId = null;
      if (entry.reusedPendingEntry) {
        entry.reusedPendingEntry = false;
        entry.awaitingRePush = false;
        entry.adoptedWithoutPush = false;
        onCloseRef.current();
        return;
      }
      if (entry.adoptedWithoutPush) {
        entry.adoptedWithoutPush = false;
        entry.awaitingRePush = false;
        const cur = safeCurrentHistoryState();
        if (cur && typeof cur === 'object') {
          const { oneiromancyModal: _m, oneiromancyEntryId: _e, playerId: _p, ...rest } = cur;
          window.history.replaceState?.(rest, '');
        }
        onCloseRef.current();
        return;
      }
      entry.awaitingRePush = false;
      entry.adoptedWithoutPush = false;
      triggerModalHistoryBack(closingEntryId);
    }
    onCloseRef.current();
  };

  useEffect(() => {
    const store = getModalHistoryStore();
    const entry = modalEntryRef.current!;
    store.registeredModalEntries.add(entry);
    ensureGlobalPopStateListener();
    return () => {
      store.registeredModalEntries.delete(entry);
      if (
        store.registeredModalEntries.size === 0 &&
        store.attachedPopStateWindow &&
        typeof store.attachedPopStateWindow.removeEventListener === 'function'
      ) {
        const handler = store.attachedPopStateHandler ?? handleGlobalModalPopState;
        store.attachedPopStateWindow.removeEventListener('popstate', handler);
        store.attachedPopStateWindow = null;
        store.attachedPopStateHandler = null;
      }
    };
  }, []);

  // All callers render <PlayerDetailModal isOpen={...} /> persistently so the
  // !isOpen branch handles popping the modal history entry when dismissed externally.
  useEffect(() => {
    if (!canUseBrowserHistory()) return;
    syncClearedStalePendingBacks();
    ensureGlobalPopStateListener();
    const store = getModalHistoryStore();
    const entry = modalEntryRef.current!;
    if (isOpen && activePlayerId) {
      if (!entry.pushed) {
        entry.pushed = true;
        if (window.history.state?.oneiromancyModal === 'playerDetail') {
          const entryId = createModalHistoryEntryId();
          entry.entryId = entryId;
          entry.awaitingRePush = store.pendingBacks > 0;
          entry.reusedPendingEntry = store.pendingBacks > 0;
          entry.adoptedWithoutPush = store.pendingBacks === 0;
          const nextState = {
            ...safeCurrentHistoryState(),
            oneiromancyModal: 'playerDetail',
            oneiromancyEntryId: entryId,
            playerId: activePlayerId,
          };
          window.history.replaceState?.(nextState, '');
          if (store.pendingBacks > 0) {
            store.lastPendingBackFromState = window.history.state ?? nextState;
            store.lastPendingBackEntryId = entryId;
          }
        } else {
          if (store.pendingBacks > 0) {
            entry.awaitingRePush = true;
          }
          const entryId = createModalHistoryEntryId();
          entry.entryId = entryId;
          entry.reusedPendingEntry = false;
          entry.adoptedWithoutPush = false;
          window.history.pushState(
            {
              ...safeCurrentHistoryState(),
              oneiromancyModal: 'playerDetail',
              oneiromancyEntryId: entryId,
              playerId: activePlayerId,
            },
            '',
          );
        }
      } else if (
        window.history.state?.oneiromancyModal === 'playerDetail' &&
        window.history.state?.playerId !== activePlayerId
      ) {
        const entryId = createModalHistoryEntryId();
        entry.entryId = entryId;
        const nextState = {
          ...safeCurrentHistoryState(),
          oneiromancyModal: 'playerDetail',
          oneiromancyEntryId: entryId,
          playerId: activePlayerId,
        };
        window.history.replaceState?.(nextState, '');
        if (store.pendingBacks > 0) {
          store.lastPendingBackFromState = window.history.state ?? nextState;
          store.lastPendingBackEntryId = entryId;
        }
      }
      return;
    }

    if (!isOpen && entry.pushed) {
      const closingEntryId = entry.entryId;
      entry.pushed = false;
      entry.entryId = null;
      if (entry.reusedPendingEntry) {
        entry.reusedPendingEntry = false;
        entry.awaitingRePush = false;
        entry.adoptedWithoutPush = false;
        return;
      }
      if (entry.adoptedWithoutPush) {
        entry.adoptedWithoutPush = false;
        entry.awaitingRePush = false;
        const cur = safeCurrentHistoryState();
        if (cur && typeof cur === 'object') {
          const { oneiromancyModal, oneiromancyEntryId, playerId, ...rest } = cur;
          window.history.replaceState?.(rest, '');
        }
        return;
      }
      entry.awaitingRePush = false;
      entry.adoptedWithoutPush = false;
      triggerModalHistoryBack(closingEntryId);
    }
  }, [isOpen, activePlayerId]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener?.('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen || !player) return null;

  const activeRoster: RosterSlot[] = propRoster || ctx?.draftState?.my_roster || [];
  const boardRostered: CosmicPlayer[] = (ctx?.draftState?.cosmic_board || []).filter(
    (p) => p.draft_status === 'my_team',
  );

  const isStarterSlot = (slotId: string) =>
    !slotId.startsWith('BN') && slotId !== 'IR' && slotId !== 'TAXI';

  const getPlayerRosterInfo = (p: CosmicPlayer) => {
    const slot = activeRoster.find((s) => s.player && String(s.player.id) === String(p.id));
    if (slot) {
      const isStarter = isStarterSlot(slot.slot_id);
      return {
        isMine: true,
        isStarter,
        slotId: slot.slot_id,
      };
    }
    const isUserOwned =
      p.draft_status === 'my_team' ||
      boardRostered.some((bp) => String(bp.id) === String(p.id));
    return {
      isMine: isUserOwned,
      isStarter: false,
      slotId: '',
    };
  };

  const getPlayerRoleLabel = (p: CosmicPlayer, isUserMine: boolean, defaultLabel: string) => {
    if (isUserMine) return 'Roster';
    if (p.draft_status === 'available') return 'Free Agent';
    if (p.draft_status === 'drafted' || p.drafted_by) {
      const ownerLabel = stripUserSuffix(p.drafted_by);
      return ownerLabel ? `Rostered (${ownerLabel})` : 'Rostered';
    }
    return defaultLabel;
  };

  const getIntraRosterSlotLabel = (
    info: ReturnType<typeof getPlayerRosterInfo>,
    defaultLabel: string
  ) => {
    if (info.isStarter) {
      return info.slotId ? `Starter (${info.slotId})` : 'Starter';
    }
    if (info.slotId) {
      return 'Bench';
    }
    return defaultLabel;
  };

  const sameRoleTeamPlayers: Array<{
    slotLabel: string;
    isStarter: boolean;
    rosterPlayer: CosmicPlayer;
  }> = [];
  const seenIds = new Set<string>();

  for (const slot of activeRoster) {
    if (slot.player && slot.player.position === player.position) {
      const isStarter = isStarterSlot(slot.slot_id);
      sameRoleTeamPlayers.push({
        slotLabel: isStarter ? `STARTER • ${slot.slot_id}` : `BENCH • ${slot.slot_id}`,
        isStarter,
        rosterPlayer: slot.player,
      });
      seenIds.add(String(slot.player.id));
    }
  }
  const inspectedRosterInfo = getPlayerRosterInfo(player);
  const isMine = inspectedRosterInfo.isMine;
  const hasPopulatedRosterSlots = activeRoster.some((s) => Boolean(s.player));
  if (!hasPopulatedRosterSlots) {
    for (const bp of boardRostered) {
      if (bp.position === player.position && !seenIds.has(String(bp.id))) {
        sameRoleTeamPlayers.push({
          slotLabel: 'ROSTER',
          isStarter: false,
          rosterPlayer: bp,
        });
        seenIds.add(String(bp.id));
      }
    }
  }

  const teammates = sameRoleTeamPlayers.filter((r) => String(r.rosterPlayer.id) !== String(player.id));
  const isMultiCompare = Boolean(compareCandidates && compareCandidates.length >= 3);
  const headToHead = Boolean(compareWith) && !showRoster && !isMultiCompare;
  const comparisonRows = headToHead
    ? [
        {
          slotLabel: 'VS',
          isStarter: false,
          rosterPlayer: compareWith as CosmicPlayer,
        },
      ]
    : teammates;

  const seasonCtx = getSeasonContext();
  const activeWk = resolveActiveWeek(ctx?.draftState, propActiveWeek);

  const getWeeklyProj = (p: CosmicPlayer) => {
    const n = Number(
      p.weekly_projected_points ??
        p.sleeper_projected_points ??
        p.projected_points ??
        0,
    );
    return Number.isFinite(n) ? n : 0;
  };

  const getPlayerDisplayMetrics = (p: CosmicPlayer) => {
    const pOnBye = isPlayerOnByeWeek(activeWk, p.bye_week, p.team, seasonCtx?.byeWeeks);
    const placeholder = oraclePlaceholderInfo(p, activeWk);
    const stars = starsScore(p, activeWk);
    const oracle = oracleScore(p, modalLambda, { currentWeek: activeWk });
    return {
      onBye: pOnBye,
      placeholder,
      stats: statsPoints(p),
      stars,
      oracle,
    };
  };

  let bestCandidateId: string | null = null;
  if (compareCandidates && compareCandidates.length >= 3) {
    let maxOracle = -Infinity;
    for (const cand of compareCandidates) {
      const o = getPlayerDisplayMetrics(cand).oracle;
      if (o > maxOracle) {
        maxOracle = o;
        bestCandidateId = String(cand.id);
      }
    }
  }

  const candidateMetrics = getPlayerDisplayMetrics(player);
  const candidateProj = candidateMetrics.stats;
  const candidateFav = candidateMetrics.stars;
  const candidateOracle = candidateMetrics.oracle;

  const breakdown = player.divination_breakdown || {
    celestial: player.spirit_score ? Math.round(player.spirit_score * 0.95) : 85,
    numeric: player.jersey_number ? (player.jersey_number % 9) + 80 : 85,
    geomantic: 85,
    oracular: 85,
    harmony: player.harmony_score || 85,
  };

  const isAvailable = player.draft_status === 'available';

  const NFL_TEAM_COORDS: Record<string, { lat: number; lon: number; venue: string }> = {
    ARI: { lat: 33.5276, lon: -112.2626, venue: 'State Farm Stadium' },
    ATL: { lat: 33.7554, lon: -84.4009, venue: 'Mercedes-Benz Stadium' },
    BAL: { lat: 39.278, lon: -76.6227, venue: 'M&T Bank Stadium' },
    BUF: { lat: 42.7738, lon: -78.787, venue: 'Highmark Stadium' },
    CAR: { lat: 35.2258, lon: -80.8528, venue: 'Bank of America Stadium' },
    CHI: { lat: 41.8623, lon: -87.6167, venue: 'Soldier Field' },
    CIN: { lat: 39.0954, lon: -84.5161, venue: 'Paycor Stadium' },
    CLE: { lat: 41.5061, lon: -81.6995, venue: 'Cleveland Browns Stadium' },
    DAL: { lat: 32.7473, lon: -97.0945, venue: 'AT&T Stadium' },
    DEN: { lat: 39.7439, lon: -105.0201, venue: 'Empower Field' },
    DET: { lat: 42.34, lon: -83.0456, venue: 'Ford Field' },
    GB: { lat: 44.5013, lon: -88.0622, venue: 'Lambeau Field' },
    HOU: { lat: 29.6847, lon: -95.4107, venue: 'NRG Stadium' },
    IND: { lat: 39.7601, lon: -86.1639, venue: 'Lucas Oil Stadium' },
    JAX: { lat: 30.3239, lon: -81.6373, venue: 'EverBank Stadium' },
    KC: { lat: 39.0489, lon: -94.4839, venue: 'GEHA Field at Arrowhead Stadium' },
    LAC: { lat: 33.9535, lon: -118.339, venue: 'SoFi Stadium' },
    LAR: { lat: 33.9535, lon: -118.339, venue: 'SoFi Stadium' },
    LV: { lat: 36.0908, lon: -115.1833, venue: 'Allegiant Stadium' },
    MIA: { lat: 25.958, lon: -80.2389, venue: 'Hard Rock Stadium' },
    MIN: { lat: 44.9735, lon: -93.2575, venue: 'U.S. Bank Stadium' },
    NE: { lat: 42.0909, lon: -71.2643, venue: 'Gillette Stadium' },
    NO: { lat: 29.9511, lon: -90.0812, venue: 'Caesars Superdome' },
    NYG: { lat: 40.8128, lon: -74.0742, venue: 'MetLife Stadium' },
    NYJ: { lat: 40.8128, lon: -74.0742, venue: 'MetLife Stadium' },
    PHI: { lat: 39.9008, lon: -75.1675, venue: 'Lincoln Financial Field' },
    PIT: { lat: 40.4468, lon: -80.0158, venue: 'Acrisure Stadium' },
    SEA: { lat: 47.5952, lon: -122.3316, venue: 'Lumen Field' },
    SF: { lat: 37.4033, lon: -121.9694, venue: "Levi's Stadium" },
    TB: { lat: 27.9759, lon: -82.5033, venue: 'Raymond James Stadium' },
    TEN: { lat: 36.1665, lon: -86.7713, venue: 'Nissan Stadium' },
    WAS: { lat: 38.9076, lon: -76.8645, venue: 'Commanders Field' },
  };

  const rawTeam = (player.team || 'KC').toUpperCase();
  const stadiumCoords = NFL_TEAM_COORDS[rawTeam] || {
    lat: 39.0489,
    lon: -94.4839,
    venue: `${player.team} Stadium`,
  };

  const pHash = Math.abs(
    (player.name || player.id).split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0),
  );
  const birthLat = Number((25.0 + (pHash % 200) / 10).toFixed(2));
  const birthLon = Number((-120.0 + ((pHash * 7) % 450) / 10).toFixed(2));
  const birthplaceCoords = {
    lat: birthLat,
    lon: birthLon,
    city: `Birthplace (${player.elemental_traits?.sun_sign || 'Natal'} Nexus)`,
  };

  const geodesicDist = Math.round(
    haversineDistance(birthplaceCoords.lat, birthplaceCoords.lon, stadiumCoords.lat, stadiumCoords.lon),
  );
  const meridianAlignment = Number(Math.max(5.0, 20.0 - geodesicDist / 200).toFixed(1));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={requestClose}
    >
      <div
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#161622] border border-purple-500/40 shadow-[0_0_30px_rgba(109,40,217,0.3)] overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="sticky top-0 z-10 flex-shrink-0 bg-[#161622] border-b border-white/10 px-5 sm:px-6 pt-5 pb-3 flex justify-between items-start">
          <div className="flex items-start gap-3 min-w-0">
            <PlayerHeadshot key={String(player.id)} player={player} size="lg" />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <PositionalBadge position={player.position} size="md" depth={player.depth_chart_order} />
                <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  <TeamLogo team={player.team} className="mr-1" />
                  {player.team} • Bye {player.bye_week || '-'} • #{player.jersey_number}
                </span>
                {player.injury_status && player.injury_status !== 'Healthy' && (
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                      player.injury_status === 'Out' || player.injury_status === 'IR'
                        ? 'text-rose-400 bg-rose-950/80 border-rose-500/50'
                        : 'text-amber-400 bg-amber-950/80 border-amber-500/50'
                    }`}
                  >
                    {player.injury_status.toUpperCase()}
                  </span>
                )}
                {candidateMetrics.onBye && (
                  <>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border text-amber-300 bg-amber-950/80 border-amber-500/50">
                      {`BYE WK ${player.bye_week || activeWk}`}
                    </span>
                    <span className="text-xs font-mono text-slate-400">On Bye</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="player-detail-modal-title"
                  className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide"
                >
                  {player.name}
                </h2>
                {isMultiCompare && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    Comparing {compareCandidates!.length} Candidates
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close dossier"
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 [&::-webkit-scrollbar-track]:bg-transparent [scrollbar-width:thin] [scrollbar-color:#242436_transparent]">
          {/* Strictly 3 Canonical Player Metrics: Stats, Oracle, Stars */}
          <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
          <div
            className="p-3 rounded-xl bg-slate-950/80 border border-white/10"
            title={candidateMetrics.placeholder.hasPlaceholder ? candidateMetrics.placeholder.statsTooltipText : undefined}
          >
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Stats
            </span>
            <span className="text-xl font-bold text-slate-100 tabular-nums">{candidateProj.toFixed(1)} pts</span>
            <span className="text-[9px] text-slate-500 block">
              Projected points
            </span>
          </div>
          <div
            className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30"
            title={candidateMetrics.placeholder.hasPlaceholder ? candidateMetrics.placeholder.tooltipText : undefined}
          >
            <span className="text-[10px] text-cyan-400 uppercase font-bold block">
              Oracle <span className="normal-case">(λ {modalLambda.toFixed(2)})</span>
            </span>
            <span className="text-xl font-bold text-cyan-300 tabular-nums">
              {candidateOracle.toFixed(1)}
              {candidateMetrics.placeholder.hasPlaceholder && (
                <span
                  data-testid="oracle-placeholder-marker"
                  title={candidateMetrics.placeholder.tooltipText}
                  className="ml-0.5 text-amber-300 font-bold"
                >
                  ~
                </span>
              )}
            </span>
            <span className="text-[9px] text-purple-300 block">
              Blended stats & stars
            </span>
          </div>
          <div
            className={`p-3 rounded-xl border ${TONE_PILL[favorabilityTone(candidateFav)]}`}
            title={candidateMetrics.placeholder.hasPlaceholder ? candidateMetrics.placeholder.tooltipText : undefined}
          >
            <span className="text-[10px] uppercase font-bold block">
              Stars
            </span>
            <span className="text-xl font-bold tabular-nums">{candidateFav.toFixed(0)}</span>
            <span className="text-[9px] block font-mono truncate">
              {starsVerdictLabel(candidateFav)}
            </span>
          </div>
        </div>

        {/* Elemental Traits Capsule */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] p-2.5 rounded-xl bg-slate-950/80 border border-white/10">
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Zodiac Sun</span>
            <span className="text-slate-200 font-bold">{player.elemental_traits?.sun_sign || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Element</span>
            <span className="text-cyan-300 font-bold">{player.elemental_traits?.element || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Life Path</span>
            <span className="text-purple-300 font-bold">
              {player.elemental_traits?.life_path_number ? `#${player.elemental_traits.life_path_number}` : '-'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Tarot Archetype</span>
            <span className="text-amber-300 font-bold truncate block">{player.elemental_traits?.tarot_card || '-'}</span>
          </div>
        </div>

        {/* 5 Divination Tiers Breakdown */}
        <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/90 border border-white/10 font-mono text-xs">
          <span className="text-xs uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            The 5 Divination Pillars
          </span>

          <div className="space-y-2 pt-1">
            {DIVINATION_PILLARS.map((pillar) => (
              <div key={pillar.key} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">{pillar.name} ({pct(pillarWeights[pillar.key])})</span>
                  <span className="text-white font-bold">{Number(breakdown[pillar.key] ?? 0).toFixed(1)}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${pillar.color} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(0, Number(breakdown[pillar.key] ?? 0)))}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">{pillar.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Astrocartography Stadium Coordinates */}
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 font-mono text-xs space-y-2">
          <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Astrocartography Geodesic Coordinates
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded bg-slate-900/80 border border-white/5">
              <span className="text-slate-500 text-[9px] block uppercase">Birthplace</span>
              <span className="text-slate-200 font-bold block">{birthplaceCoords.city}</span>
              <span className="text-slate-400 text-[10px]">{birthplaceCoords.lat}° N, {Math.abs(birthplaceCoords.lon)}° W</span>
            </div>
            <div className="p-2 rounded bg-slate-900/80 border border-white/5">
              <span className="text-slate-500 text-[9px] block uppercase">Stadium Venue</span>
              <span className="text-slate-200 font-bold block">{stadiumCoords.venue}</span>
              <span className="text-slate-400 text-[10px]">{stadiumCoords.lat}° N, {Math.abs(stadiumCoords.lon)}° W</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400 border-t border-white/5">
            <span>Geodesic Distance:</span>
            <span className="text-cyan-300 font-bold">{geodesicDist.toLocaleString()} km ({meridianAlignment > 0 ? `+${meridianAlignment}` : meridianAlignment} pts)</span>
          </div>
        </div>

        {/* Roster Role Comparison / Multi-Candidate Comparison */}
        <div
          data-testid="roster-role-comparison"
          className="space-y-2.5 p-3.5 rounded-xl bg-slate-950/90 border border-purple-500/40 font-mono text-xs"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsRoleCompOpen((v) => !v)}
              aria-expanded={isRoleCompOpen}
              aria-controls={contentId}
              className="flex items-center gap-1.5 text-xs uppercase font-bold text-purple-200 tracking-wider hover:text-purple-100 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
              <span>
                {isMultiCompare && !showRoster
                  ? `Comparing ${compareCandidates!.length} Selected Candidates`
                  : headToHead
                  ? `Head-to-head: ${player.name} vs. ${compareWith?.name}`
                  : isMine
                  ? `Role Comparison vs. Other ${player.position}s`
                  : `Role Comparison (${player.position})`}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-purple-400 transition-transform duration-200 ${
                  isRoleCompOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isMultiCompare ? (
              <button
                type="button"
                onClick={() => setShowRoster((v) => !v)}
                className="text-[10px] text-cyan-300 underline hover:text-cyan-200 cursor-pointer"
              >
                {showRoster
                  ? `Back to ${compareCandidates!.length} Candidates`
                  : `Compare with your ${player.position}s`}
              </button>
            ) : compareWith ? (
              <button
                type="button"
                onClick={() => setShowRoster((v) => !v)}
                className="text-[10px] text-cyan-300 underline hover:text-cyan-200 cursor-pointer"
              >
                {headToHead ? `Compare with all your ${player.position}s` : `Back to ${compareWith.name}`}
              </button>
            ) : (
              <span className="text-[10px] text-slate-400">
                {teammates.length} {isMine ? 'other ' : ''}
                {player.position}
                {teammates.length === 1 ? '' : 's'} on your roster
              </span>
            )}
          </div>

          <div id={contentId} className={isRoleCompOpen ? 'space-y-2 pt-1' : 'hidden space-y-2 pt-1'}>

          {isMultiCompare && !showRoster ? (
            <div
              data-testid="multi-candidate-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1"
            >
              {compareCandidates!.map((cand, idx) => {
                const candMetrics = getPlayerDisplayMetrics(cand);
                const candRosterInfo = getPlayerRosterInfo(cand);
                const roleLabel = getPlayerRoleLabel(cand, candRosterInfo.isMine, 'Candidate');
                const isLeader = String(cand.id) === bestCandidateId;
                return (
                  <div
                    key={cand.id}
                    data-testid={`candidate-card-${cand.id}`}
                    className={`p-2.5 rounded-lg border flex flex-col justify-between gap-2 ${
                      isLeader
                        ? 'bg-purple-950/30 border-purple-500/60 shadow-lg shadow-purple-950/20'
                        : candRosterInfo.isMine
                        ? 'bg-slate-900/90 border-purple-500/30'
                        : 'bg-slate-900/70 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[9px] font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        {isLeader ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                            Leader
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-800 text-slate-400 border border-white/5">
                            {roleLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <PlayerHeadshot
                          player={cand}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-serif font-bold text-xs text-slate-100 truncate block">
                            {cand.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <PositionalBadge
                              position={cand.position}
                              depth={cand.depth_chart_order}
                              size="sm"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">
                              {cand.team || 'FA'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-1 text-center text-[10px] pt-1.5 border-t border-white/5">
                      <div
                        className="p-1 rounded bg-slate-950/70"
                        title={
                          candMetrics.placeholder.hasPlaceholder
                            ? candMetrics.placeholder.tooltipText
                            : 'Weekly stats projection'
                        }
                      >
                        <span className="text-[8px] text-slate-500 uppercase block">Stats</span>
                        <span className="text-slate-200 font-bold block">
                          {candMetrics.stats.toFixed(1)}
                          {candMetrics.placeholder.hasPlaceholder && (
                            <span
                              data-testid="stats-placeholder-marker"
                              title={candMetrics.placeholder.statsTooltipText}
                              className="ml-0.5 text-amber-300 font-bold"
                            >
                              ~
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        className="p-1 rounded bg-slate-950/70"
                        title={
                          candMetrics.placeholder.hasPlaceholder
                            ? candMetrics.placeholder.tooltipText
                            : 'Oracle rating'
                        }
                      >
                        <span className="text-[8px] text-slate-500 uppercase block">Oracle</span>
                        <span className="text-purple-300 font-bold block">
                          {candMetrics.oracle.toFixed(1)}
                          {candMetrics.placeholder.hasPlaceholder && (
                            <span
                              data-testid="oracle-placeholder-marker"
                              title={candMetrics.placeholder.tooltipText}
                              className="ml-0.5 text-amber-300 font-bold"
                            >
                              ~
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        className="p-1 rounded bg-slate-950/70"
                        title="Astrological alignment (0 to 100)"
                      >
                        <span className="text-[8px] text-slate-500 uppercase block">Stars</span>
                        <span className="text-cyan-300 font-bold block">
                          {candMetrics.stars.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : comparisonRows.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-slate-400 text-[11px]">
              {isMine
                ? `${player.name} is your only ${player.position}.`
                : `No rostered ${player.position}s found on your active squad - ${player.name} would fill an open ${player.position} role directly.`}
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {comparisonRows.map(({ slotLabel, isStarter, rosterPlayer }) => {
                const isSelf = String(rosterPlayer.id) === String(player.id);
                const rosterPlayerInfo = getPlayerRosterInfo(rosterPlayer);

                // Assign panels: user's rostered player anchors the purple left card
                // If both players belong to user's roster, anchor the current starter on the left
                const swapSides =
                  headToHead &&
                  ((inspectedRosterInfo.isMine && !rosterPlayerInfo.isMine) ||
                   (inspectedRosterInfo.isMine &&
                    rosterPlayerInfo.isMine &&
                    inspectedRosterInfo.isStarter &&
                    !rosterPlayerInfo.isStarter));

                const leftPlayer = swapSides ? player : rosterPlayer;
                const rightPlayer = swapSides ? rosterPlayer : player;

                const leftInfo = swapSides ? inspectedRosterInfo : rosterPlayerInfo;
                const rightInfo = swapSides ? rosterPlayerInfo : inspectedRosterInfo;

                const isLeftMine = leftInfo.isMine;
                const isRightMine = rightInfo.isMine;

                const leftMetrics = getPlayerDisplayMetrics(leftPlayer);
                const rightMetrics = getPlayerDisplayMetrics(rightPlayer);

                const leftProj = getWeeklyProj(leftPlayer);
                const rightProj = getWeeklyProj(rightPlayer);
                const leftFav = leftMetrics.stars;
                const rightFav = rightMetrics.stars;
                const leftOracle = leftMetrics.oracle;
                const rightOracle = rightMetrics.oracle;

                const projDiff = rightProj - leftProj;
                const dsDiff = rightOracle - leftOracle;
                const favDiff = rightFav - leftFav;
                const isUpgrade = dsDiff > 0.2;

                const leftTitle = headToHead
                  ? isLeftMine && isRightMine
                    ? getIntraRosterSlotLabel(leftInfo, 'Roster')
                    : getPlayerRoleLabel(leftPlayer, isLeftMine, 'Player')
                  : slotLabel === 'ROSTER'
                  ? 'Roster'
                  : `Roster (${slotLabel})`;

                const rightTitle = headToHead
                  ? isLeftMine && isRightMine
                    ? getIntraRosterSlotLabel(rightInfo, 'Roster')
                    : getPlayerRoleLabel(rightPlayer, isRightMine, 'Candidate')
                  : isMine
                  ? `Inspected (${player.position})`
                  : `Candidate (${player.position})`;

                const fmtDiff = (d: number, decimals = 1) =>
                  `${d >= 0 ? '+' : ''}${d.toFixed(decimals)}`;

                return (
                  <div
                    key={`${slotLabel}-${rosterPlayer.id}`}
                    data-testid={`role-comp-row-${rosterPlayer.id}`}
                    className={`p-2.5 rounded-lg border space-y-2 ${
                      isSelf
                        ? 'bg-cyan-950/30 border-cyan-500/40'
                        : isUpgrade
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-slate-900/70 border-white/10'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Left: User Roster Player / Primary Compare Piece */}
                      <div
                        className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                          isLeftMine
                            ? 'bg-purple-950/25 border-purple-500/60'
                            : 'bg-slate-900/80 border-slate-700/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <span
                            className={`text-[9px] uppercase font-bold block ${
                              isLeftMine ? 'text-purple-300' : 'text-slate-400'
                            }`}
                          >
                            {leftTitle}
                          </span>
                          <span className="font-serif font-bold text-xs text-slate-100 truncate block">
                            {leftPlayer.name} ({leftPlayer.team})
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-bold block ${
                              isLeftMine ? 'text-purple-200' : 'text-slate-200'
                            }`}
                            title={leftMetrics.placeholder.hasPlaceholder ? leftMetrics.placeholder.tooltipText : undefined}
                          >
                            {leftOracle.toFixed(1)}
                            {leftMetrics.placeholder.hasPlaceholder && (
                              <span
                                data-testid="oracle-placeholder-marker"
                                title={leftMetrics.placeholder.tooltipText}
                                className="ml-0.5 text-amber-300 font-bold"
                              >
                                ~
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Right: Candidate / Opponent / Secondary Compare Piece */}
                      <div
                        className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                          isRightMine
                            ? 'bg-purple-950/25 border-purple-500/60'
                            : 'bg-slate-900/80 border-cyan-500/30'
                        }`}
                      >
                        <div className="min-w-0">
                          <span
                            className={`text-[9px] uppercase font-bold block ${
                              isRightMine ? 'text-purple-300' : 'text-cyan-300'
                            }`}
                          >
                            {rightTitle}
                          </span>
                          <span className="font-serif font-bold text-xs text-slate-100 truncate block">
                            {rightPlayer.name} ({rightPlayer.team})
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-bold block ${
                              isRightMine ? 'text-purple-200' : 'text-cyan-300'
                            }`}
                            title={rightMetrics.placeholder.hasPlaceholder ? rightMetrics.placeholder.tooltipText : undefined}
                          >
                            {rightOracle.toFixed(1)}
                            {rightMetrics.placeholder.hasPlaceholder && (
                              <span
                                data-testid="oracle-placeholder-marker"
                                title={rightMetrics.placeholder.tooltipText}
                                className="ml-0.5 text-amber-300 font-bold"
                              >
                                ~
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          headToHead
                            ? 'bg-purple-950/80 text-purple-200 border-purple-500/40'
                            : isStarter
                            ? 'bg-purple-950/80 text-purple-200 border-purple-500/40'
                            : 'bg-slate-800 text-slate-300 border-white/10'
                        }`}
                      >
                        {headToHead ? 'Head-to-Head' : slotLabel === 'ROSTER' ? 'Roster' : slotLabel}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          isSelf
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                            : isUpgrade
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-white/10'
                        }`}
                      >
                        {isSelf
                          ? 'CURRENTLY INSPECTED'
                          : headToHead
                          ? dsDiff >= 0
                            ? `${rightPlayer.name} by ${Math.abs(dsDiff).toFixed(1)} Oracle`
                            : `${leftPlayer.name} by ${Math.abs(dsDiff).toFixed(1)} Oracle`
                          : isMine
                          ? dsDiff >= 0
                            ? `AHEAD OF ${leftPlayer.name} (${fmtDiff(dsDiff)} Oracle)`
                            : `BEHIND ${leftPlayer.name} (${fmtDiff(dsDiff)} Oracle)`
                          : isUpgrade
                          ? `UPGRADE (${fmtDiff(dsDiff)} Oracle, ${fmtDiff(projDiff)} pts)`
                          : `KEEP ${leftPlayer.name} (${fmtDiff(dsDiff)} Oracle)`}
                      </span>
                    </div>

                    {/* Strictly 3 Canonical Player Judgment Metrics Comparison & Delta Grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1 border-t border-white/5">
                      <div
                        className="p-1.5 rounded bg-slate-950/70"
                        title={
                          leftMetrics.placeholder.hasPlaceholder || rightMetrics.placeholder.hasPlaceholder
                            ? `Baseline projected points comparison (${[
                                leftMetrics.placeholder.hasPlaceholder ? `${leftPlayer.name}: 0.0 pts actual` : null,
                                rightMetrics.placeholder.hasPlaceholder ? `${rightPlayer.name}: 0.0 pts actual` : null,
                              ].filter(Boolean).join(', ')})`
                            : 'Baseline projected points comparison'
                        }
                      >
                        <span className="text-[8px] text-slate-500 uppercase block">
                          Stats
                        </span>
                        <span className="text-slate-200 font-bold">
                          {rightProj.toFixed(1)} vs {leftProj.toFixed(1)}
                        </span>
                        <span className={`block font-bold ${projDiff > 0 ? 'text-emerald-400' : projDiff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {fmtDiff(projDiff)}
                        </span>
                      </div>

                      <div
                        className="p-1.5 rounded bg-slate-950/70"
                        title={
                          leftMetrics.placeholder.hasPlaceholder || rightMetrics.placeholder.hasPlaceholder
                            ? `Combined Oracle score comparison (uses average projection placeholder for ${[
                                leftMetrics.placeholder.hasPlaceholder ? leftPlayer.name : null,
                                rightMetrics.placeholder.hasPlaceholder ? rightPlayer.name : null,
                              ].filter(Boolean).join(', ')})`
                            : 'Combined Oracle score comparison'
                        }
                      >
                        <span className="text-[8px] text-slate-500 uppercase block">
                          Oracle
                        </span>
                        <span className="text-slate-200 font-bold">
                          {rightOracle.toFixed(1)} vs {leftOracle.toFixed(1)}
                        </span>
                        <span className={`block font-bold ${dsDiff > 0 ? 'text-emerald-400' : dsDiff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {fmtDiff(dsDiff)}
                        </span>
                      </div>

                      <div
                        className="p-1.5 rounded bg-slate-950/70"
                        title="Astrological alignment comparison (0 to 100)"
                      >
                        <span className="text-[8px] text-slate-500 uppercase block">
                          Stars
                        </span>
                        <span className="text-slate-200 font-bold">
                          {rightFav.toFixed(0)} vs {leftFav.toFixed(0)}
                        </span>
                        <span className={`block font-bold ${favDiff > 0 ? 'text-emerald-400' : favDiff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {fmtDiff(favDiff, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        <div className="pt-2">
          <div className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-center flex items-center justify-center gap-2">
            <Shield
              className={`w-3.5 h-3.5 ${
                isMine
                  ? 'text-purple-300'
                  : isAvailable
                    ? 'text-cyan-400'
                    : 'text-slate-400'
              }`}
            />
            <strong
              className={
                isMine
                  ? 'text-purple-300'
                  : isAvailable
                    ? 'text-cyan-400'
                    : 'text-slate-400'
              }
            >
              {isMine
                ? 'MY ROSTER'
                : isAvailable
                  ? 'FREE AGENT'
                  : player.drafted_by
                    ? `ROSTERED (${player.drafted_by})`
                    : 'ROSTERED'}
            </strong>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailModal;
