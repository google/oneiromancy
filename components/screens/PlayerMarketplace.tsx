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

import GlassCard from '@/components/common/GlassCard';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import { DeltaBadge, HealthTag, StatTiles, Tag } from '@/components/common/PlayerTiles';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  mockCosmicBoard,
  mockMyRoster,
} from '@/lib/mockData';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import { deriveEligiblePositions, getSeasonContext } from '@/lib/sleeper';
import { computeWaiverMoves, elementRelation } from '@/lib/oracle';
import {
  CosmicPlayer,
  NFLPosition,
  RosterSlot,
} from '@/types/oneiromancy';
import { Sparkles, TrendingUp } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

export type MarketplaceSubTab = 'waivers' | 'trades' | 'all';

export interface PlayerMarketplaceProps {
  myRoster?: RosterSlot[];
  rosterPositions?: string[];
  className?: string;
  section?: 'waivers' | 'trades' | 'both';
  positionFilter?: string;
  searchQuery?: string;
}

export const PlayerMarketplace: React.FC<PlayerMarketplaceProps> = ({
  myRoster: propMyRoster,
  rosterPositions: propRosterPositions,
  className = '',
  section = 'waivers',
  positionFilter = 'ALL',
  searchQuery = '',
}) => {
  const context = useOneiromancy();
  const isLiveMode = Boolean(
    context.draftState?.isLive || context.draftState?.mode === 'live',
  );

  const allPlayers = useMemo(
    () => context.draftState?.cosmic_board || (isLiveMode ? [] : mockCosmicBoard),
    [context.draftState?.cosmic_board, isLiveMode],
  );

  const allRoster = useMemo(
    () =>
      propMyRoster ||
      context.draftState?.my_roster ||
      (isLiveMode ? [] : mockMyRoster),
    [propMyRoster, context.draftState?.my_roster, isLiveMode],
  );

  const rawRosterPositions = useMemo(
    () =>
      propRosterPositions ||
      context.draftState?.roster_positions ||
      context.draftState?.settings?.roster_positions ||
      null,
    [
      propRosterPositions,
      context.draftState?.roster_positions,
      context.draftState?.settings?.roster_positions,
    ],
  );

  const leagueEligiblePositions = useMemo(
    () => deriveEligiblePositions(rawRosterPositions, allRoster),
    [rawRosterPositions, allRoster],
  );

  const oracleLambda = context.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const waiverMoves = useMemo(
    () =>
      computeWaiverMoves(
        allPlayers,
        allRoster,
        oracleLambda,
        getSeasonContext()?.currentWeek ?? context.draftState?.weekly_matchup?.week,
        40,
      ),
    [allPlayers, allRoster, oracleLambda, context.draftState?.weekly_matchup?.week],
  );

  const visibleMoves = useMemo(
    () =>
      waiverMoves
        .filter((m) => leagueEligiblePositions.includes(m.add.position as NFLPosition))
        .filter((m) => {
          if (positionFilter && positionFilter !== 'ALL') {
            if (positionFilter === 'FLEX') {
              if (!['RB', 'WR', 'TE'].includes(m.add.position)) return false;
            } else if (m.add.position !== positionFilter) {
              return false;
            }
          }
          const q = (searchQuery || '').trim().toLowerCase();
          if (q) {
            const addName = (m.add.name || '').toLowerCase();
            const dropName = (m.drop.name || '').toLowerCase();
            const addTeam = (m.add.team || '').toLowerCase();
            if (!addName.includes(q) && !dropName.includes(q) && !addTeam.includes(q)) return false;
          }
          return true;
        })
        .slice(0, 6),
    [waiverMoves, leagueEligiblePositions, positionFilter, searchQuery],
  );

  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(null);
  const [inspectedVs, setInspectedVs] = useState<CosmicPlayer | null>(null);
  const openTarget = useCallback((t: InspectTarget) => {
    setInspectedVs(t.vs);
    setInspectedPlayer(t.player);
  }, []);

  return (
    <div className={`flex flex-col gap-4 w-full max-w-5xl mx-auto ${className}`}>
      {section !== 'trades' && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
            Alchemical Transmutations
          </span>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-100">
            Waiver Upgrades
          </h3>
        </div>
      )}

      <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Top Waiver Moves
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Oracle λ {oracleLambda.toFixed(2)}
            </span>
          </div>

          {visibleMoves.length === 0 ? (
            <GlassCard variant="panel" className="p-5 text-center space-y-1">
              <p className="text-sm font-serif text-slate-300">No waiver move beats your bench right now</p>
            </GlassCard>
          ) : (
            <ol className="flex flex-col gap-3">
              {visibleMoves.map((move, idx) => (
                <li key={`${move.add.id}-${move.drop.id}`}>
                  <GlassCard variant="panel" glowColor="green" className="p-4 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/10 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold">
                          #{idx + 1}
                        </span>
                        <Tag tone={move.wouldStart ? 'cyan' : 'slate'}>
                          {move.wouldStart ? 'Would start' : 'Bench depth'}
                        </Tag>
                        <PositionalBadge position={move.add.position} size="sm" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <DeltaBadge value={move.oracleGain} unit="ORACLE" tone="emerald" />
                        <DeltaBadge value={move.statsGain} unit="PTS" tone="amber" />
                        <DeltaBadge value={move.starsAdd - move.starsDrop} unit="STARS" tone="purple" digits={0} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-500/50 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] uppercase tracking-wider text-purple-300 font-bold">
                            Your Bench Drop
                          </span>
                          <HealthTag player={move.drop} />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerHeadshot player={move.drop} size="sm" />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <PositionalBadge position={move.drop.position} size="sm" />
                              <span className="font-serif font-bold text-slate-200 text-sm truncate">
                                <PlayerLink player={move.drop} vs={move.add} onOpen={openTarget} />
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 whitespace-nowrap">
                              <TeamLogo team={move.drop.team} />
                              <span>{move.drop.team} · Bye {move.drop.bye_week || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <StatTiles player={move.drop} lambda={oracleLambda} muted />
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                            Free Agent Add
                          </span>
                          <HealthTag player={move.add} />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerHeadshot player={move.add} size="sm" />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <PositionalBadge position={move.add.position} size="sm" />
                              <span className="font-serif font-bold text-slate-100 text-sm truncate">
                                <PlayerLink player={move.add} vs={move.drop} onOpen={openTarget} />
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 whitespace-nowrap">
                              <TeamLogo team={move.add.team} />
                              <span>{move.add.team} · Bye {move.add.bye_week || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <StatTiles player={move.add} lambda={oracleLambda} />
                      </div>
                    </div>

                    <div className="text-[11px] font-sans text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>
                        {move.reason}{' '}
                        {(() => {
                          const rel = elementRelation(
                            move.add.elemental_traits?.element,
                            move.drop.elemental_traits?.element,
                          );
                          return rel === '-' ? null : `(${rel})`;
                        })()}
                      </span>
                    </div>
                  </GlassCard>
                </li>
              ))}
            </ol>
          )}
        </div>

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

export default PlayerMarketplace;
