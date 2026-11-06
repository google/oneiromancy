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

import React, { useMemo, useState } from 'react';
import UserAvatar from '@/components/common/UserAvatar';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import GlassCard from '@/components/common/GlassCard';
import { DeltaBadge, HealthTag, StatTiles, Tag } from '@/components/common/PlayerTiles';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  TONE_PILL,
  computeTradePartners,
  dominantElements,
  elementRelation,
  favorabilityTone,
  oraclePlaceholderInfo,
  oracleScore,
  resolveActiveWeek,
  starsScore,
  statsPoints,
} from '@/lib/oracle';
import { DEFAULT_CHAOS_LAMBDA, isPlayerSigned } from '@/lib/scoring';
import type { CompetitorTeam, CosmicPlayer, ElementType, RosterSlot } from '@/types/oneiromancy';

const ValueLine: React.FC<{ p: CosmicPlayer; lambda: number; activeWeek?: number }> = ({ p, lambda, activeWeek }) => {
  const stars = starsScore(p, { currentWeek: activeWeek });
  const placeholder = oraclePlaceholderInfo(p, activeWeek);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-400">
      <span
        title={placeholder.hasPlaceholder ? placeholder.tooltipText : undefined}
        className="text-purple-200 font-semibold inline-flex items-center"
      >
        Oracle {oracleScore(p, lambda, { currentWeek: activeWeek }).toFixed(1)}
        {placeholder.hasPlaceholder && (
          <span
            data-testid="oracle-placeholder-marker"
            title={placeholder.tooltipText}
            className="ml-0.5 text-amber-300 font-bold"
          >
            ~
          </span>
        )}
      </span>
      <span title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}>
        · {statsPoints(p).toFixed(1)} pts ·
      </span>
      <span className={`px-1 rounded border ${TONE_PILL[favorabilityTone(stars)]}`}>Stars {stars.toFixed(0)}</span>
    </span>
  );
};

const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

export interface TradesScreenProps {
  positionFilter?: string;
  searchQuery?: string;
}

export const TradesScreen: React.FC<TradesScreenProps> = ({
  positionFilter = 'ALL',
  searchQuery = '',
}) => {
  const { draftState } = useOneiromancy();
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const activeWeek = resolveActiveWeek(draftState);
  const [openTeam, setOpenTeam] = useState<number | null>(null);
  const [inspected, setInspected] = useState<InspectTarget | null>(null);

  const partners = useMemo(
    () =>
      computeTradePartners(teams, board, roster, lambda, { currentWeek: activeWeek }).filter((p) => {
        const givesSigned = p.give?.player ? isPlayerSigned(p.give.player) : false;
        const receivesUnsigned = p.get?.player ? !isPlayerSigned(p.get.player) : false;
        if (givesSigned && receivesUnsigned) return false;
        if (positionFilter && positionFilter !== 'ALL') {
          const givePos = p.give?.player?.position;
          const getPos = p.get?.player?.position;
          const matchPos = (pos?: string) =>
            positionFilter === 'FLEX'
              ? Boolean(pos && ['RB', 'WR', 'TE'].includes(pos))
              : pos === positionFilter;
          if (!matchPos(givePos) && !matchPos(getPos)) return false;
        }
        const q = (searchQuery || '').trim().toLowerCase();
        if (q) {
          const teamName = (p.team.name || '').toLowerCase();
          const giveName = (p.give?.player?.name || '').toLowerCase();
          const getName = (p.get?.player?.name || '').toLowerCase();
          if (!teamName.includes(q) && !giveName.includes(q) && !getName.includes(q)) return false;
        }
        return true;
      }),
    [teams, board, roster, lambda, positionFilter, searchQuery, activeWeek],
  );
  const byId = useMemo(() => new Map(board.map((p) => [String(p.id), p])), [board]);
  const me = teams.find((t) => t.is_user);
  const myStarters = (me?.starters ?? []).map((id) => byId.get(String(id))).filter((p): p is CosmicPlayer => Boolean(p));
  const myMix = dominantElements(myStarters);

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">Divine Swaps</span>
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-100 tracking-wide">Trades</h2>
        <p className="text-xs text-slate-400 font-sans">
          Mutual lineup upgrades where your bench player starts for them, and theirs starts for you (λ {lambda.toFixed(2)}).
        </p>
      </div>

      {partners.length === 0 ? (
        <p className="p-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-slate-300">
          No trade improves both lineups this week.
        </p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="trade-partners">
          {partners.map((p) => {
            const name = p.team.name.replace(/\s*\(You\)$/, '');
            const starters = (p.team.starters ?? [])
              .map((id) => byId.get(String(id)))
              .filter((x): x is CosmicPlayer => Boolean(x));
            const theirMix = dominantElements(starters);
            const relation = elementRelation(
              myMix.split(' & ')[0] as ElementType,
              theirMix.split(' & ')[0] as ElementType,
            );
            const isOpen = openTeam === p.team.roster_id;
            const rosterPlayers = (p.team.players ?? [])
              .map((id) => byId.get(String(id)))
              .filter((x): x is CosmicPlayer => Boolean(x))
              .sort((a, b) => a.position.localeCompare(b.position) || oracleScore(b, lambda, { currentWeek: activeWeek }) - oracleScore(a, lambda, { currentWeek: activeWeek }));
            const netGain = (p.give?.gain ?? 0) + (p.get?.gain ?? 0);
            const side = (
              kind: 'send' | 'receive',
              piece: NonNullable<typeof p.give>,
            ) => (
              <div
                className={`p-3 rounded-xl space-y-2 ${
                  kind === 'send'
                    ? 'bg-purple-950/25 border border-purple-500/50'
                    : 'bg-cyan-950/20 border border-cyan-500/30'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${kind === 'send' ? 'text-purple-300' : 'text-cyan-400'}`}>
                    {kind === 'send' ? 'You send' : 'You receive'}
                  </span>
                  <HealthTag player={piece.player} activeWeek={activeWeek} />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerHeadshot player={piece.player} size="sm" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PositionalBadge position={piece.player.position} size="sm" depth={piece.player.depth_chart_order} />
                      <span className="font-serif font-bold text-slate-100 text-sm truncate">
                        <PlayerLink player={piece.player} vs={piece.replaces} onOpen={setInspected} />
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <TeamLogo team={piece.player.team} />
                      <span>{piece.player.team} · Bye {piece.player.bye_week || '-'}</span>
                      <Tag tone="purple">{kind === 'send' ? 'Your bench' : 'Their bench'}</Tag>
                    </div>
                  </div>
                </div>
                <StatTiles player={piece.player} lambda={lambda} />
                <div className="text-[11px] font-mono text-slate-400">
                  Starts over {kind === 'receive' ? 'your ' : ''}
                  <PlayerLink player={piece.replaces} vs={piece.player} onOpen={setInspected} className="text-slate-200" />{' '}
                  <span className="text-emerald-400 font-bold">(+{piece.gain.toFixed(1)} Oracle)</span>
                </div>
              </div>
            );
            return (
              <li key={p.team.roster_id}>
                <GlassCard variant="panel" glowColor="purple" className="p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        src={p.team.avatar_url || p.team.avatar}
                        alt={`${name} avatar`}
                        fallbackText={name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block">
                          Trade partner
                        </span>
                        <span className="font-serif font-bold text-slate-100 text-base">{name}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag tone="purple">{p.give && p.get ? 'Mutual lineup fit' : `Short at ${p.youCanOffer.join(' & ')}`}</Tag>
                      {netGain > 0 && <DeltaBadge value={netGain} unit="ORACLE" tone="emerald" />}
                    </div>
                  </div>

                  {(p.give || p.get) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                      {p.give && side('send', p.give)}
                      {p.get && side('receive', p.get)}
                    </div>
                  )}

                  {!(p.give && p.get) && <p className="text-sm text-slate-300">{p.summary}</p>}

                  <div className="flex flex-wrap justify-between items-center gap-2 font-mono text-[11px] px-1">
                    <span className="text-slate-400">
                      Their lineup leans <span className="text-purple-300">{theirMix}</span> ({relation})
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenTeam(isOpen ? null : p.team.roster_id)}
                      aria-expanded={isOpen}
                      className="px-2.5 py-1 rounded-lg border border-white/15 text-xs text-slate-200 hover:border-cyan-400/60"
                    >
                      {isOpen ? 'Hide roster' : 'See roster'}
                    </button>
                  </div>

                  {isOpen && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                      {rosterPlayers.map((pl) => (
                        <li key={pl.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <PositionalBadge position={pl.position} size="sm" depth={pl.depth_chart_order} />
                          <PlayerLink player={pl} onOpen={setInspected} className="text-slate-200 truncate min-w-0" />
                          <span className="ml-auto">
                            <ValueLine p={pl} lambda={lambda} activeWeek={activeWeek} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </GlassCard>
              </li>
            );
          })}
        </ol>
      )}

      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={roster}
        activeWeek={activeWeek}
      />
    </div>
  );
};

export default TradesScreen;
