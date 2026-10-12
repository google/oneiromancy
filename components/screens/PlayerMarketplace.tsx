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

'use client';

import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import {useOneiromancy} from '@/context/OneiromancyContext';
import {
  mockCosmicBoard,
  mockMyRoster,
  mockTradeProposals,
  mockWaiverUpgrades,
} from '@/lib/mockData';
import {DEFAULT_CHAOS_LAMBDA, isPlayerSigned} from '@/lib/scoring';
import {deriveEligiblePositions, getSeasonContext} from '@/lib/sleeper';
import {computeWaiverMoves, elementRelation, statsPoints} from '@/lib/oracle';
import {PairBars} from '@/components/oneiromancy/WeeklyMoves';
import PlayerLink, {type InspectTarget} from '@/components/common/PlayerLink';
import {DeltaBadge, HealthTag, StatTiles, Tag} from '@/components/common/PlayerTiles';
import {
  CosmicPlayer,
  NFLPosition,
  RosterSlot,
  TradeProposal,
  WaiverUpgrade,
} from '@/types/oneiromancy';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Droplet,
  Eye,
  Flame,
  Mountain,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react';
import React, {useCallback, useMemo, useState} from 'react';

export type MarketplaceSubTab = 'waivers' | 'trades' | 'all';

export interface PlayerMarketplaceProps {
  waiverUpgrades?: WaiverUpgrade[];
  tradeProposals?: TradeProposal[];
  myRoster?: RosterSlot[];
  rosterPositions?: string[];
  onClaimWaiver?: (upgrade: WaiverUpgrade) => void;
  onCopyTrade?: (proposal: TradeProposal) => void;
  isLoading?: boolean;
  className?: string;
  /** 'waivers' (Waivers tab), 'trades' (Divine Swaps under Trades), or both. */
  section?: 'waivers' | 'trades' | 'both';
}

export const PlayerMarketplace: React.FC<PlayerMarketplaceProps> = ({
  waiverUpgrades: propWaiverUpgrades,
  tradeProposals: propTradeProposals,
  myRoster: propMyRoster,
  rosterPositions: propRosterPositions,
  isLoading: propIsLoading,
  className = '',
  section = 'both',
}) => {
  const context = useOneiromancy();

  const isLiveMode = Boolean(
    context.draftState?.isLive || context.draftState?.mode === 'live',
  );

  const waiverUpgrades =
    propWaiverUpgrades ||
    context.draftState?.waiver_upgrades ||
    (isLiveMode ? [] : mockWaiverUpgrades);
  const tradeProposals =
    propTradeProposals ||
    context.draftState?.trade_proposals ||
    (isLiveMode ? [] : mockTradeProposals);

  const hasExistingData =
    waiverUpgrades.length > 0 || tradeProposals.length > 0;

  const isDataLoading = Boolean(
    propIsLoading !== undefined
      ? propIsLoading
      : !hasExistingData &&
        (context.isLoading ||
          context.statusType === 'syncing' ||
          (isLiveMode && context.lastSyncTimestamp === 0)),
  );

  const [activeSubTab, setActiveSubTab] = useState<MarketplaceSubTab>(
    section === 'trades' ? 'trades' : 'waivers',
  );
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allowSignedDropForFreeAgent, setAllowSignedDropForFreeAgent] =
    useState<boolean>(false);

  const allPlayers = useMemo(() => {
    return (
      context.draftState?.cosmic_board || (isLiveMode ? [] : mockCosmicBoard)
    );
  }, [context.draftState?.cosmic_board, isLiveMode]);

  const allRoster = useMemo(() => {
    return (
      propMyRoster ||
      context.draftState?.my_roster ||
      (isLiveMode ? [] : mockMyRoster)
    );
  }, [propMyRoster, context.draftState?.my_roster, isLiveMode]);

  const rosteredPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    allRoster.forEach((slot) => {
      if (slot.player?.id) ids.add(slot.player.id);
    });
    if (context.draftState?.competitor_teams) {
      context.draftState.competitor_teams.forEach((team) => {
        team.picks?.forEach((pick) => {
          if (pick.player_id) ids.add(pick.player_id);
        });
      });
    }
    return ids;
  }, [allRoster, context.draftState?.competitor_teams]);

  const rawRosterPositions = useMemo(() => {
    return (
      propRosterPositions ||
      context.draftState?.roster_positions ||
      context.draftState?.settings?.roster_positions ||
      null
    );
  }, [
    propRosterPositions,
    context.draftState?.roster_positions,
    context.draftState?.settings?.roster_positions,
  ]);

  // Eligible player positions dynamically derived from active league roster configuration
  const leagueEligiblePositions = useMemo(() => {
    return deriveEligiblePositions(rawRosterPositions, allRoster);
  }, [rawRosterPositions, allRoster]);

  // Filtered waiver upgrades (prune non-positive net_score_delta per Boundary 10.3, strictly unowned, eligible positions)
  const filteredWaivers = useMemo(() => {
    return waiverUpgrades.filter((item) => {
      if (item.net_score_delta <= 0) return false;
      if (rosteredPlayerIds.has(item.id)) return false;

      // 1. Resolve actual add and drop players
      const addPlayer =
        allPlayers.find((p) => String(p.id) === String(item.id)) ||
        allPlayers.find(
          (p) => p.name && p.name.toLowerCase() === item.name.toLowerCase(),
        );
      const effectiveAddPosition = (
        addPlayer?.position ||
        item.position ||
        ''
      ).toUpperCase() as NFLPosition;

      const dropPlayer =
        allRoster.find(
          (s) => String(s.player?.id) === String(item.recommended_drop_id),
        )?.player ||
        allRoster.find(
          (s) =>
            s.player?.name &&
            s.player.name.toLowerCase() ===
              (item.recommended_drop_name || '').toLowerCase(),
        )?.player ||
        allPlayers.find(
          (p) => String(p.id) === String(item.recommended_drop_id),
        ) ||
        allPlayers.find(
          (p) =>
            p.name &&
            p.name.toLowerCase() ===
              (item.recommended_drop_name || '').toLowerCase(),
        );
      const effectiveDropPosition = (
        dropPlayer?.position ||
        item.recommended_drop_position ||
        ''
      ).toUpperCase() as NFLPosition;

      // 2. League Position Permeability:
      // Brutally block Kickers (K) unless K is explicitly in league roster positions
      if (
        effectiveAddPosition === 'K' &&
        !leagueEligiblePositions.includes('K')
      ) {
        return false;
      }
      if (item.position === 'K' && !leagueEligiblePositions.includes('K')) {
        return false;
      }
      if (
        effectiveDropPosition === 'K' &&
        !leagueEligiblePositions.includes('K')
      ) {
        return false;
      }

      // 3. Dynamically filter by league eligible positions derived from active league configuration
      if (!leagueEligiblePositions.includes(item.position)) return false;
      if (
        effectiveAddPosition &&
        !leagueEligiblePositions.includes(effectiveAddPosition)
      )
        return false;
      if (
        item.recommended_drop_position &&
        !leagueEligiblePositions.includes(item.recommended_drop_position)
      )
        return false;
      if (
        effectiveDropPosition &&
        !leagueEligiblePositions.includes(effectiveDropPosition)
      )
        return false;
      if (
        positionFilter !== 'ALL' &&
        item.position !== positionFilter &&
        effectiveAddPosition !== positionFilter
      )
        return false;

      // 4. Signed player drop protection:
      // When allowSignedDropForFreeAgent is false (default):
      // Prevent recommending dropping a signed active NFL roster player for an unsigned free agent.
      if (!allowSignedDropForFreeAgent) {
        const dropTeam = dropPlayer?.team || item.recommended_drop_team;
        const isDropSigned =
          isPlayerSigned(dropPlayer) || isPlayerSigned(dropTeam);

        const addTeam = addPlayer?.team || item.team;
        const isAddSigned =
          isPlayerSigned(addPlayer) || isPlayerSigned(addTeam);

        if (isDropSigned && !isAddSigned) {
          return false;
        }
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDrop = (item.recommended_drop_name || '')
          .toLowerCase()
          .includes(q);
        const matchesTeam = (item.team || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDrop && !matchesTeam) return false;
      }
      return true;
    });
  }, [
    waiverUpgrades,
    rosteredPlayerIds,
    leagueEligiblePositions,
    positionFilter,
    searchQuery,
    allowSignedDropForFreeAgent,
    allPlayers,
    allRoster,
  ]);

  // Filtered trade proposals
  const filteredTrades = useMemo(() => {
    return tradeProposals.filter((item) => {
      // Exclude trades involving ineligible positions for active league
      const hasIneligible =
        item.give_players?.some(
          (p) => !leagueEligiblePositions.includes(p.position),
        ) ||
        item.receive_players?.some(
          (p) => !leagueEligiblePositions.includes(p.position),
        );
      if (hasIneligible) return false;

      // Check for injured/inactive players or unrostered/available players
      const isInjuredOrInactive = (pId: string, pName?: string) => {
        const p =
          allRoster.find((s) => String(s.player?.id) === String(pId))?.player ||
          allRoster.find(
            (s) =>
              s.player?.name &&
              s.player.name.toLowerCase() === (pName || '').toLowerCase(),
          )?.player ||
          allPlayers.find((x) => String(x.id) === String(pId)) ||
          allPlayers.find(
            (x) =>
              x.name && x.name.toLowerCase() === (pName || '').toLowerCase(),
          );
        if (!p) return false;
        return (
          p.injury_status === 'Out' ||
          p.injury_status === 'IR' ||
          p.injury_status === 'Doubtful' ||
          p.status === 'Injured Reserve' ||
          p.status === 'Inactive' ||
          p.status === 'Out'
        );
      };

      const isUnrosteredAvailable = (pId: string, pName?: string) => {
        const p =
          allPlayers.find((x) => String(x.id) === String(pId)) ||
          allPlayers.find(
            (x) =>
              x.name && x.name.toLowerCase() === (pName || '').toLowerCase(),
          );
        if (p?.draft_status === 'available') return true;
        if (rosteredPlayerIds.size > 0 && !rosteredPlayerIds.has(String(pId))) {
          return true;
        }
        return false;
      };

      const hasInjured =
        item.give_players?.some((p) =>
          isInjuredOrInactive(p.player_id, p.player_name),
        ) ||
        item.receive_players?.some((p) =>
          isInjuredOrInactive(p.player_id, p.player_name),
        );
      if (hasInjured) return false;

      const hasAvailable =
        item.receive_players?.some((p) =>
          isUnrosteredAvailable(p.player_id, p.player_name),
        ) ||
        item.give_players?.some((p) =>
          isUnrosteredAvailable(p.player_id, p.player_name),
        );
      if (hasAvailable) return false;

      // Signed player protection:
      if (!allowSignedDropForFreeAgent) {
        const givesSigned = item.give_players?.some((gp) => {
          const p =
            allRoster.find((s) => String(s.player?.id) === String(gp.player_id))
              ?.player ||
            allRoster.find(
              (s) =>
                s.player?.name &&
                s.player.name.toLowerCase() === gp.player_name.toLowerCase(),
            )?.player ||
            allPlayers.find((p) => String(p.id) === String(gp.player_id)) ||
            allPlayers.find(
              (p) =>
                p.name && p.name.toLowerCase() === gp.player_name.toLowerCase(),
            );
          const team = p?.team || (gp as any).team;
          return isPlayerSigned(p) || isPlayerSigned(team);
        });
        const receivesUnsigned = item.receive_players?.some((rp) => {
          const p =
            allPlayers.find((p) => String(p.id) === String(rp.player_id)) ||
            allPlayers.find(
              (p) =>
                p.name && p.name.toLowerCase() === rp.player_name.toLowerCase(),
            );
          const team = p?.team || (rp as any).team;
          return !isPlayerSigned(p) && !isPlayerSigned(team);
        });
        if (givesSigned && receivesUnsigned) {
          return false;
        }
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTarget = (item.target_team_name || '')
          .toLowerCase()
          .includes(q);
        const matchesGive = item.give_players?.some((p) =>
          p.player_name.toLowerCase().includes(q),
        );
        const matchesRec = item.receive_players?.some((p) =>
          p.player_name.toLowerCase().includes(q),
        );
        if (!matchesTarget && !matchesGive && !matchesRec) return false;
      }
      if (positionFilter !== 'ALL') {
        const hasPos =
          item.give_players?.some((p) => p.position === positionFilter) ||
          item.receive_players?.some((p) => p.position === positionFilter);
        if (!hasPos) return false;
      }
      return true;
    });
  }, [
    tradeProposals,
    leagueEligiblePositions,
    positionFilter,
    searchQuery,
    allowSignedDropForFreeAgent,
    allPlayers,
    allRoster,
    rosteredPlayerIds,
  ]);

  // Element icon helper
  const renderElementIcon = (element?: string) => {
    switch (element) {
      case 'Fire':
        return <Flame className="w-3.5 h-3.5 text-rose-500 inline" />;
      case 'Water':
        return <Droplet className="w-3.5 h-3.5 text-blue-400 inline" />;
      case 'Air':
        return <Wind className="w-3.5 h-3.5 text-sky-400 inline" />;
      case 'Earth':
        return <Mountain className="w-3.5 h-3.5 text-teal-400 inline" />;
      default:
        return null;
    }
  };

  const oracleLambda = context.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const waiverMoves = useMemo(
    () =>
      computeWaiverMoves(
        allPlayers,
        propMyRoster || context.draftState?.my_roster || [],
        oracleLambda,
        getSeasonContext()?.currentWeek ?? context.draftState?.weekly_matchup?.week,
        8,
      ),
    [allPlayers, propMyRoster, context.draftState?.my_roster, oracleLambda, context.draftState?.weekly_matchup?.week],
  );
  const visibleMoves = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return waiverMoves
      .filter((m) => allowSignedDropForFreeAgent || (m.add.team && m.add.team !== 'NFL'))
      .filter((m) => positionFilter === 'ALL' || m.add.position === positionFilter)
      .filter(
        (m) =>
          !q ||
          m.add.name.toLowerCase().includes(q) ||
          m.drop.name.toLowerCase().includes(q) ||
          (m.add.team || '').toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [waiverMoves, allowSignedDropForFreeAgent, positionFilter, searchQuery]);

  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(
    null,
  );
  // Set when opened from a recommendation, so the view compares the two players.
  const [inspectedVs, setInspectedVs] = useState<CosmicPlayer | null>(null);
  const openTarget = useCallback((t: InspectTarget) => {
    setInspectedVs(t.vs);
    setInspectedPlayer(t.player);
  }, []);

  const currentPick = context.draftState?.current_pick;

  const handleInspect = useCallback(
    (player: CosmicPlayer) => {
      setInspectedVs(null);
      setInspectedPlayer(player);
      context.selectPlayer?.(player);
    },
    [context],
  );

  const resolvePlayer = useCallback(
    (
      id: string,
      fallbackName: string,
      fallbackPos: NFLPosition,
      fallbackTeam?: string,
      fallbackPoints?: number,
      fallbackDraftScore?: number,
      fallbackSpirit?: number,
    ): CosmicPlayer => {
      const fromBoard = allPlayers.find((p) => p.id === id);
      if (fromBoard) return fromBoard;
      const fromRoster = allRoster.find((s) => s.player?.id === id)?.player;
      if (fromRoster) return fromRoster;

      const firstName = fallbackName.split(' ')[0] || fallbackName;
      const lastName = fallbackName.split(' ').slice(1).join(' ') || '';
      return {
        id,
        name: fallbackName,
        first_name: firstName,
        last_name: lastName,
        position: fallbackPos,
        team: fallbackTeam || 'NFL',
        jersey_number: 11,
        bye_week: 10,
        adp: 150.0,
        projected_points: fallbackPoints || 140.0,
        market_vor: 4.5,
        vor_normalized: 50.0,
        draft_score: fallbackDraftScore || 70.0,
        spirit_score: fallbackSpirit || 75.0,
        harmony_score: 72.0,
        draft_status: 'available',
        elemental_traits: {
          sun_sign: 'Aries',
          element: 'Fire',
          life_path_number: 7,
          gematria_resonance: 8,
          tarot_card: 'The Chariot',
          iching_hexagram: 14,
          score: fallbackSpirit || 75.0,
        },
        divination_breakdown: {
          celestial: 75,
          numeric: 75,
          geomantic: 75,
          oracular: 75,
          harmony: 75,
        },
        injury_status: 'Healthy',
        catalysts: [
          'High red-zone target share',
          'Positive offensive game script',
        ],
        risks: ['Rotational snap competition', 'Tough perimeter coverage'],
      };
    },
    [allPlayers, allRoster],
  );

  const renderMarketplaceLoadingState = (type: 'waivers' | 'trades') => (
    <GlassCard
      variant="panel"
      glowColor={type === 'waivers' ? 'cyan' : 'purple'}
      className="p-6 sm:p-8 text-center space-y-4 animate-pulse border border-white/10"
      data-testid={
        type === 'waivers'
          ? 'marketplace-waivers-loading'
          : 'marketplace-trades-loading'
      }>
      <div className="flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
        <span className="font-serif text-base font-bold text-slate-100">
          {type === 'waivers'
            ? 'Transmuting Celestial Waiver Wire...'
            : 'Evaluating Reciprocal Trade Deficits...'}
        </span>
      </div>

      <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
        {type === 'waivers'
          ? 'Synchronizing live NFL player rosters, evaluating unowned free agents, and calculating net VOR differentials...'
          : 'Scanning 12 competitor rosters, projecting positional surplus/deficits, and balancing fair reciprocal swaps...'}
      </p>

      {/* Glowing indeterminate progress / loading bar */}
      <div className="relative w-full max-w-md mx-auto h-2 bg-slate-950/90 rounded-full overflow-hidden border border-cyan-500/30">
        <div className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 rounded-full w-full animate-pulse" />
      </div>

      {/* Shimmer skeleton card placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-left">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2.5">
          <div className="h-3.5 w-28 bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-44 bg-slate-700/60 rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2.5">
          <div className="h-3.5 w-28 bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-44 bg-slate-700/60 rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {/* Header: plain name first, the Oneiromancy name as the eyebrow */}
      {section !== 'trades' && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
            Alchemical Transmutations
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
            {section === 'waivers' ? 'Waivers' : 'Waivers & trades'}
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Adds that beat your weakest droppable bench player, best first. Starters, players on bye and needed
            depth are never dropped.
          </p>
        </div>
      )}

      {/* Sub-Tab Navigation (standalone use only) */}
      {section === 'both' && (
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/90 border border-white/10">
        <button
          type="button"
          onClick={() => setActiveSubTab('waivers')}
          className={`py-2 px-3 rounded-lg font-mono text-xs transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'waivers'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}>
          <RefreshCw
            className={`w-3.5 h-3.5 ${isDataLoading ? 'animate-spin text-cyan-400' : ''}`}
          />
          <span>
            Waiver Upgrades ({isDataLoading ? '...' : visibleMoves.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('trades')}
          className={`py-2 px-3 rounded-lg font-mono text-xs transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'trades'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(109,40,217,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}>
          <Scale className="w-3.5 h-3.5" />
          <span>
            Divine Swaps ({isDataLoading ? '...' : filteredTrades.length})
          </span>
        </button>
      </div>
      )}

      {activeSubTab !== 'trades' && (<>
      {/* Positional Filters & Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search player, team, or trade partner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Position Chips (Dynamic to league eligible positions, no kickers) */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...leagueEligiblePositions].map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                positionFilter === pos
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Signed Player Drop for Free Agent Toggle */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-mono">
        <label
          htmlFor="allow-signed-drop-toggle"
          className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            id="allow-signed-drop-toggle"
            data-testid="allow-signed-drop-toggle"
            checked={allowSignedDropForFreeAgent}
            onChange={(e) => setAllowSignedDropForFreeAgent(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
          />
          <div>
            <span className="font-bold text-slate-200 block text-xs">
              Include players without an NFL team
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">
              Off: NFL-signed players only.
            </span>
          </div>
        </label>
        <span
          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 border ${
            allowSignedDropForFreeAgent
              ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
          }`}>
          {allowSignedDropForFreeAgent ? 'Including unsigned' : 'Signed players only'}
        </span>
      </div>
      </>)}

      {/* Section 1: Waiver moves (compact, need-aware) */}
      {(activeSubTab === 'waivers' || activeSubTab === 'all') && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Waiver moves
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Oracle λ {oracleLambda.toFixed(2)}
            </span>
          </div>

          {isDataLoading ? (
            renderMarketplaceLoadingState('waivers')
          ) : visibleMoves.length === 0 ? (
            <GlassCard variant="panel" className="p-6 text-center space-y-1">
              <p className="text-sm font-serif text-slate-300">No waiver move beats your bench right now</p>
              <p className="text-xs text-slate-500 font-mono">
                Every available player scores below your weakest droppable bench player.
              </p>
            </GlassCard>
          ) : (
            <ol className="flex flex-col gap-3">
              {visibleMoves.map((move, idx) => (
                <li key={`${move.add.id}-${move.drop.id}`}>
                  <GlassCard variant="panel" glowColor="green" className="p-4 sm:p-5 space-y-3.5">
                    {/* Header: priority, verdict and net deltas */}
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/10 pb-3">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold tracking-wider">
                          PRIORITY {idx + 1}
                        </span>
                        <Tag tone={move.wouldStart ? 'cyan' : 'slate'}>
                          {move.wouldStart ? 'Would start' : 'Bench depth'}
                        </Tag>
                        <PositionalBadge position={move.add.position} size="sm" />
                        <span className="text-sm font-serif font-bold text-slate-100">
                          <PlayerLink player={move.add} vs={move.drop} onOpen={openTarget} />{' '}
                          <span className="text-slate-500 font-mono text-[11px] font-normal">for</span>{' '}
                          <PlayerLink player={move.drop} vs={move.add} onOpen={openTarget} />
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <DeltaBadge value={move.oracleGain} unit="ORACLE" tone="emerald" />
                        <DeltaBadge value={move.statsGain} unit="PTS" tone="amber" />
                        <DeltaBadge value={move.starsAdd - move.starsDrop} unit="STARS" tone="purple" digits={0} />
                      </div>
                    </div>

                    {/* Side-by-side: proposed add vs recommended drop */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                                Proposed add
                              </span>
                              <Tag tone="cyan">Free agent</Tag>
                            </div>
                            <div className="font-serif font-bold text-slate-100 text-sm">
                              <PlayerLink player={move.add} vs={move.drop} onOpen={openTarget} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <PositionalBadge position={move.add.position} size="sm" />
                            <HealthTag player={move.add} />
                          </div>
                        </div>
                        <StatTiles player={move.add} lambda={oracleLambda} />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[9px] uppercase tracking-wider text-rose-400 font-bold block">
                              Recommended drop (your bench)
                            </span>
                            <div className="font-serif font-bold text-slate-300 text-sm">
                              <PlayerLink player={move.drop} vs={move.add} onOpen={openTarget} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <PositionalBadge position={move.drop.position} size="sm" />
                            <HealthTag player={move.drop} />
                          </div>
                        </div>
                        <StatTiles player={move.drop} lambda={oracleLambda} muted />
                      </div>
                    </div>

                    {/* Alchemical rationale */}
                    <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] font-sans italic text-purple-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>
                        {move.reason}{' '}
                        {(() => {
                          const rel = elementRelation(move.add.elemental_traits?.element, move.drop.elemental_traits?.element);
                          if (rel === '—') return null;
                          return rel === 'Same element'
                            ? `Same element as ${move.drop.name}.`
                            : `${rel} element to ${move.drop.name}.`;
                        })()}
                      </span>
                    </div>
                  </GlassCard>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Section 2: Automated Divine Swap Trade Proposals */}
      {(activeSubTab === 'trades' || activeSubTab === 'all') && (
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-mono uppercase text-purple-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-purple-400" />
              Automated Divine Swap Proposals
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Balanced Reciprocal Deficits
            </span>
          </div>

          {isDataLoading ? (
            renderMarketplaceLoadingState('trades')
          ) : filteredTrades.length === 0 ? (
            <GlassCard variant="panel" className="p-8 text-center space-y-2">
              <p className="text-sm font-serif text-slate-300">
                {isLiveMode
                  ? 'Divine Swaps are not available for live leagues yet'
                  : 'No complementary trades identified'}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {isLiveMode
                  ? 'Trade proposals are only generated for the Mock Oneiromancy Engine.'
                  : 'No league rival currently exhibits complementary deficits matching your surplus.'}
              </p>
            </GlassCard>
          ) : (
            filteredTrades.map((trade) => {
              return (
                <GlassCard
                  key={trade.proposal_id}
                  variant="panel"
                  glowColor="purple"
                  className="p-4 space-y-3.5">
                  {/* Trade Target & Fairness Index */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block">
                        Trade Partner
                      </span>
                      <span className="font-serif font-bold text-slate-100 text-sm">
                        {trade.target_team_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300">
                        Fairness: {trade.trade_fairness_index.toFixed(1)}/100
                      </span>
                    </div>
                  </div>

                  {/* Trade Exchange Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                    {/* YOU SEND */}
                    <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 space-y-1.5">
                      <span className="text-[9px] uppercase tracking-wider text-rose-400 font-bold block">
                        YOU SEND
                      </span>
                      {trade.give_players.map((p) => {
                        const fullP =
                          allRoster.find(
                            (s) => String(s.player?.id) === String(p.player_id),
                          )?.player ||
                          allPlayers.find(
                            (x) => String(x.id) === String(p.player_id),
                          ) ||
                          allPlayers.find(
                            (x) =>
                              x.name?.toLowerCase() ===
                              p.player_name.toLowerCase(),
                          );
                        const inj = fullP?.injury_status;
                        const isAvail = fullP?.draft_status === 'available';
                        const teamName = fullP?.team || (p as any).team;
                        return (
                          <div key={p.player_id} className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PositionalBadge position={p.position} size="sm" />
                              <span className="font-serif font-bold text-slate-200 truncate">
                                {p.player_name}
                              </span>
                              {teamName && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {teamName}
                                </span>
                              )}
                              {inj && (
                                <span className="text-[8px] font-mono uppercase font-bold px-1 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
                                  {inj}
                                </span>
                              )}
                              {isAvail ? (
                                <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                  AVAILABLE
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                                  ROSTERED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              {renderElementIcon(p.element)}
                              <span>{p.projected_points} pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* YOU RECEIVE */}
                    <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-1.5">
                      <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold block">
                        YOU RECEIVE
                      </span>
                      {trade.receive_players.map((p) => {
                        const fullP =
                          allPlayers.find(
                            (x) => String(x.id) === String(p.player_id),
                          ) ||
                          allPlayers.find(
                            (x) =>
                              x.name?.toLowerCase() ===
                              p.player_name.toLowerCase(),
                          ) ||
                          allRoster.find(
                            (s) => String(s.player?.id) === String(p.player_id),
                          )?.player;
                        const inj = fullP?.injury_status;
                        const isAvail = fullP?.draft_status === 'available';
                        const teamName = fullP?.team || (p as any).team;
                        return (
                          <div key={p.player_id} className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PositionalBadge position={p.position} size="sm" />
                              <span className="font-serif font-bold text-slate-200 truncate">
                                {p.player_name}
                              </span>
                              {teamName && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {teamName}
                                </span>
                              )}
                              {inj && (
                                <span className="text-[8px] font-mono uppercase font-bold px-1 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
                                  {inj}
                                </span>
                              )}
                              {isAvail ? (
                                <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                  AVAILABLE
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                                  ROSTERED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              {renderElementIcon(p.element)}
                              <span>{p.projected_points} pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Deficit & Need Resolution */}
                  <div className="space-y-1 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                    <div className="text-slate-300">
                      <span className="text-cyan-400 font-bold">
                        Your Need:{' '}
                      </span>
                      {trade.user_deficit_addressed}
                    </div>
                    <div className="text-slate-400">
                      <span className="text-purple-400 font-bold">
                        Rival Need:{' '}
                      </span>
                      {trade.partner_deficit_addressed}
                    </div>
                  </div>

                  {/* Alchemy Synergy Telemetry */}
                  <div className="flex justify-between items-center font-mono text-[11px] px-1">
                    <span className="text-emerald-400">
                      Net VOR: +{trade.net_vor_delta.toFixed(1)} VOR
                    </span>
                    <span className="text-purple-300">
                      Harmony: +{trade.harmony_delta.toFixed(1)} Synergies
                    </span>
                  </div>

                  {/* Sacred Divine Verdict */}
                  <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] font-sans italic text-purple-200 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>&ldquo;{trade.divine_verdict}&rdquo;</span>
                  </div>

                  {/* Read-Only Divine Verdict Telemetry */}
                  <div className="w-full py-2.5 px-3 rounded-lg bg-purple-950/40 border border-purple-500/30 font-mono text-xs flex items-center justify-between">
                    <span className="text-purple-300 font-bold flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-purple-400" />
                      <span>
                        COMPATIBILITY INDEX:{' '}
                        {trade.trade_fairness_index.toFixed(0)}/100
                      </span>
                    </span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                      +{trade.harmony_delta.toFixed(1)} HARMONY
                    </span>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      )}

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={inspectedPlayer}
        compareWith={inspectedVs}
        isOpen={Boolean(inspectedPlayer)}
        onClose={() => {
          setInspectedPlayer(null);
          setInspectedVs(null);
        }}
      />
    </div>
  );
};

export {isPlayerSigned};
export default PlayerMarketplace;
