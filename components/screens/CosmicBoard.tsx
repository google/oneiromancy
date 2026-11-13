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

import BoardControls, { BoardModeFilter, BoardSortDirection, BoardSortField, PositionFilterValue } from '@/components/board/BoardControls';
import PlayerCardRow from '@/components/board/PlayerCardRow';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import { MAX_COMPARE_PLAYERS, useOneiromancy } from '@/context/OneiromancyContext';
import { DEFAULT_CHAOS_LAMBDA, isPlayerOnByeWeek, isPlayerSigned, stripUserSuffix } from '@/lib/scoring';
import { deriveEligiblePositions, getSeasonContext } from '@/lib/sleeper';
import {
  TONE_LABEL,
  TONE_PILL,
  computeTradePartners,
  computeWaiverMoves,
  favorabilityTone,
  oraclePlaceholderInfo,
  oracleScore,
  resolveActiveWeek,
  starsScore,
  statsPoints,
} from '@/lib/oracle';
import { CosmicPlayer, NFLPosition } from '@/types/oneiromancy';
import { RefreshCw, Scale } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface CosmicBoardProps {
  players?: CosmicPlayer[];
  onDraftPlayer?: (playerId: string) => void;
  onInspectPlayer?: (player: CosmicPlayer) => void;
  initialSearchQuery?: string;
  initialPositionFilter?: PositionFilterValue;
  initialSortField?: BoardSortField;
  initialHideDrafted?: boolean;
  initialFilter?: BoardModeFilter;
  className?: string;
}

export function comparePlayersForBoard(
  a: CosmicPlayer,
  b: CosmicPlayer,
  sortField: BoardSortField,
  direction: BoardSortDirection = 'desc',
  lambda: number = DEFAULT_CHAOS_LAMBDA,
  activeWeek?: number,
): number {
  const multiplier = direction === 'desc' ? -1 : 1;
  let primaryDiff = 0;

  switch (sortField) {
    case 'oracle': primaryDiff = oracleScore(a, lambda, { currentWeek: activeWeek }) - oracleScore(b, lambda, { currentWeek: activeWeek }); break;
    case 'stars':
    case 'favorability_score': primaryDiff = starsScore(a, { currentWeek: activeWeek }) - starsScore(b, { currentWeek: activeWeek }); break;
    case 'draft_score': primaryDiff = a.draft_score - b.draft_score; break;
    case 'projected_points': primaryDiff = statsPoints(a) - statsPoints(b); break;
    case 'spirit_score': primaryDiff = a.spirit_score - b.spirit_score; break;
    case 'market_vor': primaryDiff = a.market_vor - b.market_vor; break;
    case 'harmony_score': primaryDiff = a.harmony_score - b.harmony_score; break;
    case 'adp': primaryDiff = (b.adp || 999) - (a.adp || 999); break;
  }

  if (primaryDiff !== 0) return primaryDiff * multiplier;
  if (b.market_vor !== a.market_vor) return b.market_vor - a.market_vor;
  if (a.adp !== b.adp) return a.adp - b.adp;
  return a.name.localeCompare(b.name);
}

export const CosmicBoard: React.FC<CosmicBoardProps> = ({
  players: propPlayers,
  onDraftPlayer: propOnDraftPlayer,
  onInspectPlayer: propOnInspectPlayer,
  initialSearchQuery = '',
  initialPositionFilter = 'ALL',
  initialSortField = 'oracle',
  initialHideDrafted = false,
  initialFilter = 'all',
  className = '',
}) => {
  const context = useOneiromancy();

  const allPlayers = useMemo(
    () => propPlayers || context.draftState?.cosmic_board || [],
    [propPlayers, context.draftState?.cosmic_board],
  );

  const [modeFilter, setModeFilter] = useState<BoardModeFilter>(initialFilter);
  useEffect(() => {
    setModeFilter(initialFilter);
  }, [initialFilter]);

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [positionFilter, setPositionFilter] = useState<PositionFilterValue>(
    initialPositionFilter,
  );
  const [sortField, setSortField] = useState<BoardSortField>(initialSortField);
  const [sortDirection, setSortDirection] = useState<BoardSortDirection>('desc');
  const [hideDrafted, setHideDrafted] = useState(initialHideDrafted);
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const lambda = context.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, positionFilter, modeFilter]);

  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(null);
  const [inspectedVs, setInspectedVs] = useState<CosmicPlayer | null>(null);

  const leagueEligiblePositions = useMemo(
    () =>
      deriveEligiblePositions(
        context.draftState?.roster_positions || context.draftState?.settings?.roster_positions,
        context.draftState?.my_roster,
      ),
    [context.draftState?.roster_positions, context.draftState?.settings?.roster_positions, context.draftState?.my_roster],
  );

  const activeWeek = resolveActiveWeek(context.draftState);
  const comparedPlayerIds = context?.comparedPlayerIds ?? [];
  const toggleComparePlayer = context?.toggleComparePlayer ?? (() => {});
  const clearComparedPlayers = context?.clearComparedPlayers ?? (() => {});

  const pinnedPlayers = useMemo(() => {
    const byId = new Map(allPlayers.map((p) => [String(p.id), p]));
    return comparedPlayerIds
      .map((id) => byId.get(String(id)))
      .filter((p): p is CosmicPlayer => Boolean(p));
  }, [allPlayers, comparedPlayerIds]);

  const waiverMap = useMemo(() => {
    const moves = computeWaiverMoves(
      allPlayers,
      context.draftState?.my_roster || [],
      lambda,
      activeWeek,
      40,
    );
    const map = new Map<string, { drop: CosmicPlayer; oracleGain: number; wouldStart: boolean }>();
    for (const m of moves) {
      if (!leagueEligiblePositions.includes(m.add.position as NFLPosition)) continue;
      map.set(String(m.add.id), {
        drop: m.drop,
        oracleGain: m.oracleGain,
        wouldStart: m.wouldStart,
      });
    }
    return map;
  }, [allPlayers, context.draftState?.my_roster, lambda, activeWeek, leagueEligiblePositions]);

  const tradeMap = useMemo(() => {
    const partners = computeTradePartners(
      context.draftState?.competitor_teams || [],
      allPlayers,
      context.draftState?.my_roster || [],
      lambda,
      { currentWeek: activeWeek },
    );
    const map = new Map<string, { partnerName: string; give?: CosmicPlayer; gain?: number }>();
    for (const p of partners) {
      const givesSigned = p.give?.player ? isPlayerSigned(p.give.player) : false;
      const receivesUnsigned = p.get?.player ? !isPlayerSigned(p.get.player) : false;
      if (givesSigned && receivesUnsigned) continue;
      if (p.get?.player) {
        map.set(String(p.get.player.id), {
          partnerName: stripUserSuffix(p.team?.name),
          give: p.give?.player,
          gain: p.get.gain,
        });
      }
    }
    for (const tp of context.draftState?.trade_proposals || []) {
      const rec = tp.receive_players?.[0];
      const give = tp.give_players?.[0];
      if (!rec || map.has(String(rec.player_id))) continue;
      const recPlayer = allPlayers.find((p) => String(p.id) === String(rec.player_id));
      const givePlayer =
        allPlayers.find((p) => String(p.id) === String(give?.player_id)) ||
        context.draftState?.my_roster?.find((s) => String(s.player?.id) === String(give?.player_id))?.player ||
        undefined;
      map.set(String(rec.player_id), {
        partnerName: stripUserSuffix(recPlayer?.drafted_by || tp.target_team_name),
        give: givePlayer,
        gain: tp.net_vor_delta,
      });
    }
    return map;
  }, [context.draftState?.competitor_teams, context.draftState?.trade_proposals, context.draftState?.my_roster, allPlayers, lambda, activeWeek]);

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
    (player: CosmicPlayer, vs?: CosmicPlayer | null) => {
      if (propOnInspectPlayer) {
        propOnInspectPlayer(player);
      } else {
        setInspectedVs(vs ?? null);
        setInspectedPlayer(player);
        context.selectPlayer(player);
      }
    },
    [propOnInspectPlayer, context],
  );

  const positionCounts = useMemo(() => {
    const counts: Record<PositionFilterValue, number> = { ALL: allPlayers.length, QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
    for (const p of allPlayers) {
      if (p.position === 'QB') counts.QB++;
      if (p.position === 'RB') { counts.RB++; counts.FLEX++; }
      if (p.position === 'WR') { counts.WR++; counts.FLEX++; }
      if (p.position === 'TE') { counts.TE++; counts.FLEX++; }
    }
    return counts;
  }, [allPlayers]);

  const processedPlayers = useMemo(() => {
    let list = allPlayers;
    if (modeFilter === 'my_team') {
      list = list.filter((p) => p.draft_status === 'my_team');
    } else if (modeFilter === 'waivers') {
      list = list.filter((p) => p.draft_status === 'available' && leagueEligiblePositions.includes(p.position as NFLPosition) && isPlayerSigned(p));
    } else if (modeFilter === 'trades') {
      list = list.filter((p) => p.draft_status === 'drafted' && leagueEligiblePositions.includes(p.position as NFLPosition));
    } else if (hideDrafted) {
      list = list.filter((p) => p.draft_status === 'available');
    }
    if (positionFilter !== 'ALL') {
      list = positionFilter === 'FLEX' ? list.filter((p) => p.position === 'RB' || p.position === 'WR' || p.position === 'TE') : list.filter((p) => p.position === positionFilter);
    }
    const safeQuery = (searchQuery || '').trim().toLowerCase();
    if (safeQuery) {
      list = list.filter((p) => {
        const name = (p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
        return name.includes(safeQuery) || (p.team || '').toLowerCase().includes(safeQuery) || (p.drafted_by || '').toLowerCase().includes(safeQuery);
      });
    }
    return [...list].sort((a, b) => {
      if (modeFilter === 'waivers' && sortField === 'oracle') {
        const wA = waiverMap.get(String(a.id))?.oracleGain ?? -Infinity;
        const wB = waiverMap.get(String(b.id))?.oracleGain ?? -Infinity;
        if (wA !== wB) return wB - wA;
      }
      if (modeFilter === 'trades' && sortField === 'oracle') {
        const tA = tradeMap.get(String(a.id))?.gain ?? -Infinity;
        const tB = tradeMap.get(String(b.id))?.gain ?? -Infinity;
        if (tA !== tB) return tB - tA;
      }
      return comparePlayersForBoard(a, b, sortField, sortDirection, lambda, activeWeek);
    });
  }, [allPlayers, modeFilter, hideDrafted, leagueEligiblePositions, positionFilter, searchQuery, sortField, sortDirection, lambda, waiverMap, tradeMap, activeWeek]);

  const processedIdSet = useMemo(
    () => new Set(processedPlayers.map((p) => String(p.id))),
    [processedPlayers],
  );
  const pinnedInFilter = useMemo(
    () => pinnedPlayers.filter((p) => processedIdSet.has(String(p.id))),
    [pinnedPlayers, processedIdSet],
  );
  const pinnedOutsideFilter = useMemo(
    () => pinnedPlayers.filter((p) => !processedIdSet.has(String(p.id))),
    [pinnedPlayers, processedIdSet],
  );

  const unpinnedProcessedPlayers = useMemo(() => {
    const pinnedSet = new Set(comparedPlayerIds.map(String));
    return processedPlayers.filter((p) => !pinnedSet.has(String(p.id)));
  }, [processedPlayers, comparedPlayerIds]);
  const pagePlayers = unpinnedProcessedPlayers.slice(0, visibleCount);

  return (
    <div className={`flex flex-col gap-4 w-full max-w-5xl mx-auto ${className}`}>
      {/* Header */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
          Celestial Player Directory
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
          Players
        </h2>
        <p className="text-xs text-slate-400 font-sans">
          Browse all players, waiver upgrades, and trade targets ranked by Stats, Oracle, and Stars (λ {lambda.toFixed(2)}).
        </p>
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
        modeFilter={modeFilter}
        onModeFilterChange={setModeFilter}
        positionCounts={positionCounts}
        totalVisibleCount={processedPlayers.length}
      />


      {/* Single Unified Player Directory Table & Card List Across All 4 Modes */}
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
        </GlassCard>
      ) : processedPlayers.length === 0 && pinnedPlayers.length === 0 ? (
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
          {/* Mobile Card-Row List (<768px) */}
          <div className="flex flex-col gap-2 md:hidden">
            {pinnedPlayers.map((player, idx) => (
              <PlayerCardRow
                key={`pinned-${player.id}`}
                player={player}
                rank={idx + 1}
                lambda={lambda}
                activeWeek={activeWeek}
                isCompared={true}
                onToggleCompare={toggleComparePlayer}
                onInspect={(p) => handleInspect(p)}
                onDraft={handleDraft}
              />
            ))}
            {pagePlayers.map((player, idx) => {
              const wHint = waiverMap.get(String(player.id));
              const tHint = tradeMap.get(String(player.id));
              return (
                <PlayerCardRow
                  key={`${player.id}-${player.draft_status}-${idx}`}
                  player={player}
                  rank={pinnedPlayers.length + idx + 1}
                  lambda={lambda}
                  activeWeek={activeWeek}
                  isCompared={false}
                  isCompareDisabled={pinnedPlayers.length >= MAX_COMPARE_PLAYERS}
                  onToggleCompare={toggleComparePlayer}
                  onInspect={(p) => handleInspect(p, wHint?.drop ?? tHint?.give ?? null)}
                  onDraft={handleDraft}
                  waiverHint={
                    wHint
                      ? {
                          dropName: wHint.drop.name,
                          oracleGain: wHint.oracleGain,
                          wouldStart: wHint.wouldStart,
                        }
                      : undefined
                  }
                  tradeHint={tHint}
                />
              );
            })}
          </div>

          {/* Desktop Table (>=768px) */}
          <div className="hidden md:block rounded-2xl border border-white/10 bg-slate-950/60">
            <table
              data-testid="cosmic-board-table"
              className="w-full table-fixed text-left font-mono text-xs border-collapse">
              <thead className="sticky top-[49px] z-10">
                <tr className="border-b border-white/10 bg-[#1a1a24] text-slate-400 text-[11px] uppercase tracking-wider">
                  <th data-testid="compare-col-header" className="py-3 px-1 w-8 text-center tracking-normal" title="Compare">
                    <Scale aria-hidden="true" className="w-3.5 h-3.5 inline-block" />
                    <span className="sr-only">Compare</span>
                  </th>
                  <th className="py-3 px-2 w-10 text-center">#</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-3 w-16">Pos</th>
                  <th className="py-3 px-3 w-32">Team · Bye</th>
                  <th className="py-3 px-3 w-20 text-right" title="Baseline football projection from Sleeper / ESPN">Stats</th>
                  <th className="py-3 px-3 w-20 text-right" title="Combined Oracle score blended by λ">Oracle</th>
                  <th className="py-3 px-3 w-24 text-center" title="Upcoming week astrological alignment (0 to 100)">Stars</th>
                  <th className="py-3 px-4 w-32 text-center">Status</th>
                </tr>
              </thead>
              {pinnedPlayers.length > 0 && (
                <tbody data-testid="compare-pinned" className="divide-y divide-amber-500/20 bg-amber-500/5">
                  {pinnedPlayers.map((player, idx) => {
                    const isAvailable = player.draft_status === 'available';
                    const isMyTeam = player.draft_status === 'my_team';
                    const seasonCtx = getSeasonContext();
                    const onBye = isPlayerOnByeWeek(activeWeek, player.bye_week, player.team, seasonCtx?.byeWeeks);
                    const placeholder = oraclePlaceholderInfo(player, activeWeek);
                    const stats = statsPoints(player);
                    const stars = starsScore(player, { currentWeek: activeWeek });
                    const oracle = oracleScore(player, lambda, { currentWeek: activeWeek });
                    const tone = favorabilityTone(stars);
                    return (
                      <tr
                        key={`pinned-${player.id}`}
                        onClick={() => handleInspect(player)}
                        data-bye={onBye ? 'true' : undefined}
                        className="bg-amber-500/10 hover:bg-amber-500/15 border-b border-amber-500/30 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-1 text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => {}}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              toggleComparePlayer(String(player.id));
                            }}
                            aria-label={`Compare ${player.name}`}
                            className="w-4 h-4 rounded border-amber-500/50 bg-slate-900 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center text-amber-300 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-100">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <PlayerHeadshot player={player} size="sm" />
                            <span className="truncate">{player.name}</span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              PINNED
                            </span>
                            {player.injury_status && player.injury_status !== 'Healthy' && (
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                  ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status)
                                    ? 'text-rose-300 bg-rose-950/70 border-rose-500/50'
                                    : 'text-amber-300 bg-amber-950/70 border-amber-500/50'
                                }`}
                              >
                                {player.injury_status.toUpperCase()}
                              </span>
                            )}
                            {onBye && (
                              <>
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 text-amber-300 bg-amber-950/70 border-amber-500/50">
                                  {`BYE WK ${player.bye_week || activeWeek}`}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">On Bye</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <PositionalBadge position={player.position} size="sm" depth={player.depth_chart_order} />
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          <TeamLogo team={player.team} className="mr-1.5" />
                          {player.team} · Bye {player.bye_week || '-'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right text-slate-100 font-bold tabular-nums"
                          title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
                        >
                          {stats.toFixed(1)}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right font-bold text-cyan-300 tabular-nums whitespace-nowrap"
                        >
                          {oracle.toFixed(1)}
                          {placeholder.hasPlaceholder && (
                            <OraclePlaceholderMarker placeholder={placeholder} />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            title={TONE_LABEL[tone]}
                            className={`inline-block min-w-[2.5rem] px-1.5 py-0.5 rounded border text-[11px] font-bold ${TONE_PILL[tone]}`}
                          >
                            {stars.toFixed(0)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block max-w-[110px] truncate px-2 py-0.5 text-[10px] rounded border ${
                              isMyTeam
                                ? 'text-purple-200 bg-purple-950/70 border-purple-500/50 font-bold'
                                : isAvailable
                                ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30'
                                : 'text-cyan-200 bg-slate-900 border-cyan-500/30'
                            }`}
                          >
                            {isMyTeam ? 'My Roster' : isAvailable ? 'Free agent' : stripUserSuffix(player.drafted_by, 'Rostered')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
              <tbody data-testid="cosmic-board-body" className="divide-y divide-white/5">
                {pagePlayers.map((player, idx) => {
                  const isAvailable = player.draft_status === 'available';
                  const isMyTeam = player.draft_status === 'my_team';
                  const wHint = waiverMap.get(String(player.id));
                  const tHint = tradeMap.get(String(player.id));
                  const seasonCtx = getSeasonContext();
                  const onBye = isPlayerOnByeWeek(activeWeek, player.bye_week, player.team, seasonCtx?.byeWeeks);
                  const placeholder = oraclePlaceholderInfo(player, activeWeek);
                  const stats = statsPoints(player);
                  const stars = starsScore(player, { currentWeek: activeWeek });
                  const oracle = oracleScore(player, lambda, { currentWeek: activeWeek });
                  const tone = favorabilityTone(stars);
                  return (
                    <tr
                      key={`${player.id}-${player.draft_status}-${idx}`}
                      onClick={() => handleInspect(player, wHint?.drop ?? tHint?.give ?? null)}
                      data-bye={onBye ? 'true' : undefined}
                      className={`hover:bg-slate-900/80 transition-colors cursor-pointer ${
                        isMyTeam ? 'bg-purple-950/25 border-l-2 border-l-purple-500' : ''
                      } ${onBye ? 'opacity-50 grayscale bg-slate-950/60' : ''}`}>
                      <td className="py-2.5 px-1 text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={pinnedPlayers.length >= MAX_COMPARE_PLAYERS}
                          title={pinnedPlayers.length >= MAX_COMPARE_PLAYERS ? `Maximum of ${MAX_COMPARE_PLAYERS} players compared` : undefined}
                          onChange={() => {}}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (pinnedPlayers.length < MAX_COMPARE_PLAYERS) {
                              toggleComparePlayer(String(player.id));
                            }
                          }}
                          aria-label={`Compare ${player.name}`}
                          className={`w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50 ${
                            pinnedPlayers.length >= MAX_COMPARE_PLAYERS ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-500 font-bold">{pinnedPlayers.length + idx + 1}</td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-100">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <PlayerHeadshot player={player} size="sm" />
                          <span className="truncate">{player.name}</span>
                          {player.injury_status && player.injury_status !== 'Healthy' && (
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status)
                                  ? 'text-rose-300 bg-rose-950/70 border-rose-500/50'
                                  : 'text-amber-300 bg-amber-950/70 border-amber-500/50'
                              }`}>
                              {player.injury_status.toUpperCase()}
                            </span>
                          )}
                          {onBye && (
                            <>
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 text-amber-300 bg-amber-950/70 border-amber-500/50">
                                {`BYE WK ${player.bye_week || activeWeek}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 shrink-0">On Bye</span>
                            </>
                          )}
                          {isAvailable && wHint && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                              Drop {wHint.drop.name} (+{wHint.oracleGain.toFixed(1)} Oracle)
                            </span>
                          )}
                          {!isAvailable && !isMyTeam && tHint && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-200 border border-purple-500/40 whitespace-nowrap">
                              {tHint.partnerName}
                              {tHint.give ? ` • Send ${tHint.give.name}` : ''}
                              {tHint.gain ? ` (+${tHint.gain.toFixed(1)} Oracle)` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <PositionalBadge position={player.position} size="sm" depth={player.depth_chart_order} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        <TeamLogo team={player.team} className="mr-1.5" />
                        {player.team} · Bye {player.bye_week || '-'}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right text-slate-100 font-bold tabular-nums"
                        title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
                      >
                        {stats.toFixed(1)}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-bold text-cyan-300 tabular-nums whitespace-nowrap"
                      >
                        {oracle.toFixed(1)}
                        {placeholder.hasPlaceholder && (
                          <OraclePlaceholderMarker placeholder={placeholder} />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          title={TONE_LABEL[tone]}
                          className={`inline-block min-w-[2.5rem] px-1.5 py-0.5 rounded border text-[11px] font-bold ${TONE_PILL[tone]}`}>
                          {stars.toFixed(0)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block max-w-[110px] truncate px-2 py-0.5 text-[10px] rounded border ${
                            isMyTeam
                              ? 'text-purple-200 bg-purple-950/70 border-purple-500/50 font-bold'
                              : isAvailable
                              ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30'
                              : 'text-cyan-200 bg-slate-900 border-cyan-500/30'
                          }`}
                          title={
                            isMyTeam
                              ? 'My Roster'
                              : isAvailable
                              ? 'Free agent'
                              : stripUserSuffix(player.drafted_by) || stripUserSuffix(tHint?.partnerName) || 'Rostered'
                          }>
                          {isMyTeam
                            ? 'My Roster'
                            : isAvailable
                            ? 'Free agent'
                            : stripUserSuffix(player.drafted_by) || stripUserSuffix(tHint?.partnerName) || 'Rostered'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="text-[11px] font-mono text-slate-400">
              Showing {pinnedInFilter.length + pagePlayers.length} of {processedPlayers.length} NFL players
              {pinnedOutsideFilter.length > 0 && ` (+${pinnedOutsideFilter.length} pinned across filters)`}
            </span>
            {unpinnedProcessedPlayers.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="self-center px-4 py-2 rounded-lg border border-white/15 text-xs font-mono text-slate-200 hover:border-cyan-400/60 transition-colors">
                Show {Math.min(PAGE_SIZE, unpinnedProcessedPlayers.length - visibleCount)} more of{' '}
                {unpinnedProcessedPlayers.length - visibleCount}
              </button>
            )}
          </div>
        </>
      )}

      {/* Comparison Action Bar (Sticky at bottom of viewport when candidates are pinned) */}
      {pinnedPlayers.length > 0 && (
        <div
          data-testid="compare-action-bar"
          className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#161622]/95 backdrop-blur border border-amber-500/40 shadow-2xl font-mono text-xs"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-amber-300 font-bold">
              Comparing {pinnedPlayers.length} / {MAX_COMPARE_PLAYERS} celestial candidates
            </span>
          </div>
          <button
            type="button"
            data-testid="clear-compare-btn"
            onClick={clearComparedPlayers}
            className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Inspection Modal */}
      <PlayerDetailModal
        player={inspectedPlayer}
        compareWith={inspectedVs}
        isOpen={Boolean(inspectedPlayer)}
        roster={context.draftState?.my_roster}
        activeWeek={activeWeek}
        onClose={() => {
          setInspectedPlayer(null);
          setInspectedVs(null);
          context.selectPlayer(null);
        }}
      />
    </div>
  );
};

export default CosmicBoard;
