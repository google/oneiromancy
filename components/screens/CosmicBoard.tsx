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

import BoardControls, {
  BoardSortDirection,
  BoardSortField,
  PositionFilterValue,
} from '@/components/board/BoardControls';
import PlayerCardRow from '@/components/board/PlayerCardRow';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import RecommendedPickHero from '@/components/oneiromancy/RecommendedPickHero';
import {useOneiromancy} from '@/context/OneiromancyContext';
import {CosmicPlayer} from '@/types/oneiromancy';
import {Eye, LayoutGrid, RefreshCw, Sparkles} from 'lucide-react';
import React, {useCallback, useMemo, useState} from 'react';

export interface CosmicBoardProps {
  players?: CosmicPlayer[];
  onDraftPlayer?: (playerId: string) => void;
  onInspectPlayer?: (player: CosmicPlayer) => void;
  initialSearchQuery?: string;
  initialPositionFilter?: PositionFilterValue;
  initialSortField?: BoardSortField;
  initialHideDrafted?: boolean;
  className?: string;
}

export function comparePlayersForBoard(
  a: CosmicPlayer,
  b: CosmicPlayer,
  sortField: BoardSortField,
  direction: BoardSortDirection = 'desc',
): number {
  const multiplier = direction === 'desc' ? -1 : 1;
  let primaryDiff = 0;

  switch (sortField) {
    case 'draft_score':
      primaryDiff = a.draft_score - b.draft_score;
      break;
    case 'projected_points':
      primaryDiff =
        (a.sleeper_projected_points ??
          (a as any).weekly_projected_points ??
          a.projected_points) -
        (b.sleeper_projected_points ??
          (b as any).weekly_projected_points ??
          b.projected_points);
      break;
    case 'spirit_score':
      primaryDiff = a.spirit_score - b.spirit_score;
      break;
    case 'market_vor':
      primaryDiff = a.market_vor - b.market_vor;
      break;
    case 'harmony_score':
      primaryDiff = a.harmony_score - b.harmony_score;
      break;
    case 'favorability_score':
      primaryDiff = (a.favorability_score ?? 70) - (b.favorability_score ?? 70);
      break;
    case 'adp':
      primaryDiff = (b.adp || 999) - (a.adp || 999);
      break;
  }

  if (primaryDiff !== 0) return primaryDiff * multiplier;
  // Secondary tie-breaker: Market VOR
  if (b.market_vor !== a.market_vor) return b.market_vor - a.market_vor;
  // Tertiary tie-breaker: ADP
  if (a.adp !== b.adp) return a.adp - b.adp;
  // Quaternary tie-breaker: Alphabetical Name
  return a.name.localeCompare(b.name);
}

export const CosmicBoard: React.FC<CosmicBoardProps> = ({
  players: propPlayers,
  onDraftPlayer: propOnDraftPlayer,
  onInspectPlayer: propOnInspectPlayer,
  initialSearchQuery = '',
  initialPositionFilter = 'ALL',
  initialSortField = 'draft_score',
  initialHideDrafted = true,
  className = '',
}) => {
  const context = useOneiromancy();

  const allPlayers = useMemo(
    () => propPlayers || context.draftState?.cosmic_board || [],
    [propPlayers, context.draftState?.cosmic_board],
  );

  const topPick = useMemo(() => {
    const isHealthyAndAvailable = (
      p: CosmicPlayer | null | undefined,
    ): p is CosmicPlayer => {
      if (!p) return false;
      const isAvail = p.draft_status === 'available';
      const isOut =
        p.injury_status === 'Out' ||
        p.injury_status === 'IR' ||
        p.injury_status === 'Doubtful' ||
        p.status === 'Injured Reserve' ||
        p.status === 'Inactive' ||
        p.status === 'Out';
      return isAvail && !isOut;
    };

    const cp = context.draftState?.current_pick as any;
    if (isHealthyAndAvailable(cp?.recommended_player)) {
      return cp.recommended_player;
    }

    const availableCandidates = allPlayers.filter(isHealthyAndAvailable);
    if (availableCandidates.length > 0) {
      const sorted = [...availableCandidates].sort((a, b) => {
        if (b.draft_score !== a.draft_score)
          return b.draft_score - a.draft_score;
        const bProj =
          b.sleeper_projected_points ??
          (b as any).weekly_projected_points ??
          b.projected_points;
        const aProj =
          a.sleeper_projected_points ??
          (a as any).weekly_projected_points ??
          a.projected_points;
        return bProj - aProj;
      });
      return sorted[0];
    }

    return (
      allPlayers.find((p) => p.draft_status === 'available') ||
      allPlayers[0] ||
      null
    );
  }, [context.draftState, allPlayers]);

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [positionFilter, setPositionFilter] = useState<PositionFilterValue>(
    initialPositionFilter,
  );
  const [sortField, setSortField] = useState<BoardSortField>(initialSortField);
  const [sortDirection, setSortDirection] =
    useState<BoardSortDirection>('desc');
  const [hideDrafted, setHideDrafted] = useState(initialHideDrafted);

  // Detail Modal inspection
  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(
    null,
  );

  const handleDraft = useCallback(
    (playerId: string) => {
      if (propOnDraftPlayer) {
        propOnDraftPlayer(playerId);
      } else {
        context.draftPlayer(playerId);
      }
    },
    [propOnDraftPlayer, context],
  );

  const handleInspect = useCallback(
    (player: CosmicPlayer) => {
      if (propOnInspectPlayer) {
        propOnInspectPlayer(player);
      } else {
        setInspectedPlayer(player);
        context.selectPlayer(player);
      }
    },
    [propOnInspectPlayer, context],
  );

  // Position counts across full pool
  const positionCounts = useMemo(() => {
    const counts: Record<PositionFilterValue, number> = {
      ALL: allPlayers.length,
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      FLEX: 0,
    };
    for (const p of allPlayers) {
      if (p.position === 'QB') counts.QB++;
      if (p.position === 'RB') {
        counts.RB++;
        counts.FLEX++;
      }
      if (p.position === 'WR') {
        counts.WR++;
        counts.FLEX++;
      }
      if (p.position === 'TE') {
        counts.TE++;
        counts.FLEX++;
      }
    }
    return counts;
  }, [allPlayers]);

  // Sub-2ms filtered & sorted player list
  const processedPlayers = useMemo(() => {
    let list = allPlayers;

    // 1. Availability filter
    if (hideDrafted) {
      list = list.filter((p) => p.draft_status === 'available');
    }

    // 2. Position filter
    if (positionFilter !== 'ALL') {
      if (positionFilter === 'FLEX') {
        list = list.filter(
          (p) =>
            p.position === 'RB' || p.position === 'WR' || p.position === 'TE',
        );
      } else {
        list = list.filter((p) => p.position === positionFilter);
      }
    }

    // 3. Regex-safe whitespace-trimmed text search
    const safeQuery = (searchQuery || '').trim().toLowerCase();
    if (safeQuery) {
      list = list.filter((p) => {
        const name = (
          p.name || `${p.first_name || ''} ${p.last_name || ''}`
        ).toLowerCase();
        const team = (p.team || '').toLowerCase();
        return name.includes(safeQuery) || team.includes(safeQuery);
      });
    }

    // 4. Multi-tier sort
    return [...list].sort((a, b) =>
      comparePlayersForBoard(a, b, sortField, sortDirection),
    );
  }, [
    allPlayers,
    hideDrafted,
    positionFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  return (
    <div
      className={`flex flex-col gap-4 w-full max-w-5xl mx-auto ${className}`}>
      {/* Screen Title & Subheading */}
      <div className="text-center space-y-1">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
          Celestial Player Directory
        </h2>
        <p className="text-xs text-slate-400 max-w-xl mx-auto font-sans">
          High-density mobile data grid with instant search, positional
          filtering, and multi-tier sorting.
        </p>
      </div>

      {/* Divination Spotlight Pick (Read-Only) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Divination Spotlight Pick (Read-Only)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Round {context.draftState?.current_pick?.round || 5} Target
          </span>
        </div>
        <RecommendedPickHero
          player={topPick}
          onSelectPlayer={handleInspect}
          onInspect={handleInspect}
        />
      </div>

      {/* Board Interactive Controls */}
      <BoardControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, dir) => {
          setSortField(field);
          if (dir) setSortDirection(dir);
        }}
        hideDrafted={hideDrafted}
        onToggleHideDrafted={setHideDrafted}
        positionCounts={positionCounts}
        totalVisibleCount={processedPlayers.length}
      />

      {/* Zero Results / Loading State */}
      {context.isLoading && processedPlayers.length === 0 ? (
        <GlassCard
          variant="panel"
          glowColor="cyan"
          className="p-8 text-center space-y-3 animate-pulse border border-white/10">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="font-serif text-base font-bold text-slate-100">
              Consulting Celestial Player Directory...
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
            Synchronizing live NFL player projections, VOR valuations, and
            astral alignments...
          </p>
          <div className="relative w-full max-w-md mx-auto h-2 bg-slate-950/90 rounded-full overflow-hidden border border-cyan-500/30">
            <div className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 rounded-full w-full animate-pulse" />
          </div>
        </GlassCard>
      ) : processedPlayers.length === 0 ? (
        <GlassCard variant="panel" className="p-8 text-center space-y-2">
          <p className="text-sm font-serif text-slate-300">
            No celestial players found matching filter
          </p>
          <p className="text-xs text-slate-500 font-mono">
            Adjust search query or position criteria to reveal astral talents.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Mobile Dual-Line Card-Row List (<768px) */}
          <div className="flex flex-col gap-2 md:hidden">
            {processedPlayers.map((player, idx) => (
              <PlayerCardRow
                key={`${player.id}-${player.draft_status}-${idx}`}
                player={player}
                rank={idx + 1}
                onInspect={handleInspect}
                onDraft={handleDraft}
              />
            ))}
          </div>

          {/* Desktop Tabular Grid (>=768px) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-[#1a1a24]/90 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-3 w-16">Pos</th>
                  <th className="py-3 px-3 w-20">Team</th>
                  <th className="py-3 px-3 text-right">Proj (Slp / NFL)</th>
                  <th className="py-3 px-3 text-right">VOR</th>
                  <th className="py-3 px-3 text-right">Spirit</th>
                  <th className="py-3 px-3 text-right">Harmony</th>
                  <th className="py-3 px-3 text-right">Wk Fav</th>
                  <th className="py-3 px-4 text-right">DraftScore</th>
                  <th className="py-3 px-4 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {processedPlayers.map((player, idx) => {
                  const isAvailable = player.draft_status === 'available';
                  const isMyTeam = player.draft_status === 'my_team';
                  const sleeperProj =
                    player.sleeper_projected_points ??
                    (player as any).weekly_projected_points ??
                    player.projected_points;
                  const nflProj =
                    player.nfl_projected_points ??
                    sleeperProj;

                  return (
                    <tr
                      key={`${player.id}-${player.draft_status}-${idx}`}
                      onClick={() => handleInspect(player)}
                      className={`hover:bg-slate-900/80 transition-colors cursor-pointer ${
                        isMyTeam
                          ? 'bg-emerald-950/20'
                          : !isAvailable
                            ? 'opacity-40 bg-slate-950/30'
                            : ''
                      }`}>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-serif font-bold text-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              isAvailable
                                ? 'text-slate-100'
                                : 'text-slate-400 line-through'
                            }>
                              {player.name}
                          </span>
                          {player.injury_status && (
                            <span
                              className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded border ${
                                player.injury_status === 'Out' ||
                                player.injury_status === 'IR'
                                  ? 'text-rose-400 bg-rose-950/60 border-rose-500/40'
                                  : 'text-amber-400 bg-amber-950/60 border-amber-500/40'
                              }`}>
                              {player.injury_status.toUpperCase()}
                            </span>
                          )}
                          {isMyTeam && (
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/30">
                              MINE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <PositionalBadge position={player.position} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {player.team} ({player.bye_week})
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-slate-200 font-bold">
                          {sleeperProj.toFixed(1)}
                        </span>
                        <span className="text-slate-500 text-[10px] ml-1">
                          / {nflProj.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {player.market_vor >= 0
                          ? `+${player.market_vor.toFixed(1)}`
                          : player.market_vor.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-300">
                        {player.spirit_score.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-300">
                        {player.harmony_score.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded border text-[10px] ${
                            (player.favorability_score ?? 70) >= 84
                              ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40'
                              : (player.favorability_score ?? 70) >= 75
                                ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                                : 'text-rose-300 bg-rose-950/80 border-rose-500/40'
                          }`}
                          title={
                            player.favorability_verdict ||
                            'Weekly Matchup Favorability'
                          }>
                          <span>{(player.favorability_score ?? 70).toFixed(0)}</span>
                          <span className="text-[8px] opacity-80 uppercase">
                            {(player.favorability_score ?? 70) >= 84
                              ? 'APEX'
                              : (player.favorability_score ?? 70) >= 75
                                ? 'FAV'
                                : 'CHG'}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-cyan-400">
                        <span className="bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded shadow-[0_0_6px_rgba(6,182,212,0.3)]">
                          {player.draft_score.toFixed(1)}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInspect(player)}
                            aria-label={`Inspect ${player.name}`}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAvailable ? (
                            <span className="px-2 py-0.5 text-[10px] font-mono text-cyan-400 bg-cyan-950/60 rounded border border-cyan-500/30">
                              OPEN
                            </span>
                          ) : isMyTeam ? (
                            <span className="px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 rounded border border-emerald-500/30">
                              ROSTER
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-900 rounded border border-white/5">
                              TAKEN
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Inspection Modal */}
      <PlayerDetailModal
        player={inspectedPlayer}
        isOpen={Boolean(inspectedPlayer)}
        roster={context.draftState?.my_roster}
        onClose={() => {
          setInspectedPlayer(null);
          context.selectPlayer(null);
        }}
      />
    </div>
  );
};

export default CosmicBoard;
