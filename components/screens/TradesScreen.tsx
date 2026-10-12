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

import React, { useMemo, useState } from 'react';
import UserAvatar from '@/components/common/UserAvatar';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerMarketplace from '@/components/screens/PlayerMarketplace';
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
  oracleScore,
  starsScore,
  statsPoints,
} from '@/lib/oracle';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import type { CompetitorTeam, CosmicPlayer, ElementType, RosterSlot } from '@/types/oneiromancy';

/** Oracle, Stats and Stars together; a player's value is never projection alone. */
const ValueLine: React.FC<{ p: CosmicPlayer; lambda: number }> = ({ p, lambda }) => {
  const stars = starsScore(p);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-400">
      <span className="text-purple-200 font-semibold">Oracle {oracleScore(p, lambda).toFixed(1)}</span>
      <span>· {statsPoints(p).toFixed(1)} pts ·</span>
      <span className={`px-1 rounded border ${TONE_PILL[favorabilityTone(stars)]}`}>Stars {stars.toFixed(0)}</span>
    </span>
  );
};

// Stable empty defaults so memo dependencies don't change every render.
const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

/**
 * Trades: who is short where you are deep. Partners are ranked by positional
 * need against your surplus; the celestial angle is each lineup's element mix.
 */
export const TradesScreen: React.FC = () => {
  const { draftState } = useOneiromancy();
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const [openTeam, setOpenTeam] = useState<number | null>(null);
  const [inspected, setInspected] = useState<InspectTarget | null>(null);

  const partners = useMemo(() => computeTradePartners(teams, board, roster, lambda), [teams, board, roster, lambda]);
  const byId = useMemo(() => new Map(board.map((p) => [String(p.id), p])), [board]);
  const me = teams.find((t) => t.is_user);
  const myStarters = (me?.starters ?? []).map((id) => byId.get(String(id))).filter((p): p is CosmicPlayer => Boolean(p));
  const myMix = dominantElements(myStarters);

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto">
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">Divine Swaps</span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">Trades</h2>
        <p className="text-xs text-slate-400 font-sans">
          Trades that help both lineups: your bench player would start for them, and theirs for you. Ranked by
          Oracle (λ {lambda.toFixed(2)}). Your lineup leans {myMix}.
        </p>
      </div>

      {partners.length === 0 ? (
        <p className="p-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-slate-300">
          No trade improves both lineups this week. Check back after waivers clear.
        </p>
      ) : (
        <ol className="flex flex-col gap-4" data-testid="trade-partners">
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
              .sort((a, b) => a.position.localeCompare(b.position) || oracleScore(b, lambda) - oracleScore(a, lambda));
            const netGain = (p.give?.gain ?? 0) + (p.get?.gain ?? 0);
            const side = (
              kind: 'send' | 'receive',
              piece: NonNullable<typeof p.give>,
            ) => (
              <div
                className={`p-3 rounded-xl space-y-2.5 ${
                  kind === 'send' ? 'bg-rose-950/20 border border-rose-500/25' : 'bg-cyan-950/20 border border-cyan-500/25'
                }`}
              >
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold block ${
                    kind === 'send' ? 'text-rose-400' : 'text-cyan-400'
                  }`}
                >
                  {kind === 'send' ? 'You send' : 'You receive'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PositionalBadge position={piece.player.position} size="sm" />
                  <span className="font-serif font-bold text-slate-100 text-sm">
                    <PlayerLink player={piece.player} vs={piece.replaces} onOpen={setInspected} />
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{piece.player.team}</span>
                  <HealthTag player={piece.player} />
                  <Tag tone="purple">{kind === 'send' ? 'Your bench' : 'Their bench'}</Tag>
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
                <GlassCard variant="panel" glowColor="purple" className="p-4 space-y-3.5">
                  {/* Partner and combined gain */}
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/5 pb-2.5">
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
                        {typeof p.team.wins === 'number' && (
                          <span className="ml-2 text-xs font-mono text-slate-400">
                            {p.team.wins}-{p.team.losses}
                            {p.team.ties ? `-${p.team.ties}` : ''}
                          </span>
                        )}
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

                  {/* Alchemy telemetry */}
                  <div className="flex flex-wrap justify-between items-center gap-2 font-mono text-[11px] px-1">
                    <span className="text-slate-400">
                      Their lineup leans <span className="text-purple-300">{theirMix}</span>
                    </span>
                    <span
                      className={
                        relation === 'Complementary'
                          ? 'text-emerald-400'
                          : relation === 'Opposed'
                            ? 'text-rose-300'
                            : 'text-amber-300'
                      }
                    >
                      {relation === 'Same element' ? 'Same element as yours' : `${relation} to yours`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenTeam(isOpen ? null : p.team.roster_id)}
                      aria-expanded={isOpen}
                      className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-200 hover:border-cyan-400/60"
                    >
                      {isOpen ? 'Hide their roster' : 'See their roster'}
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                      {rosterPlayers.map((pl) => (
                        <li key={pl.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <PositionalBadge position={pl.position} size="sm" />
                          <PlayerLink player={pl} onOpen={setInspected} className="text-slate-200 truncate min-w-0" />
                          <span className="ml-auto">
                            <ValueLine p={pl} lambda={lambda} />
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
      />

      {!draftState.isLive && (
        <section className="flex flex-col gap-2">
          <h3 className="font-serif text-lg font-bold text-slate-100">Sample Divine Swaps</h3>
          <PlayerMarketplace section="trades" />
        </section>
      )}
    </div>
  );
};

export default TradesScreen;
