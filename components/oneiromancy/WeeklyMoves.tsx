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
import { useOneiromancy } from '@/context/OneiromancyContext';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import {
  computeByeOutlook,
  computeLineupCheck,
  computeTradePartners,
  computeWaiverMoves,
  type LineupSwap,
} from '@/lib/oracle';

import type { CompetitorTeam, CosmicPlayer, RosterSlot } from '@/types/oneiromancy';

// Stable empty defaults so memo dependencies don't change every render.
const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

/** Two bars comparing a pair of values, each scaled to the larger of the two. */
export const PairBars: React.FC<{
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
  tone: 'stats' | 'stars';
}> = ({ label, a, b, format, tone }) => {
  const max = Math.max(a, b, 0.01);
  const fill = tone === 'stats' ? 'bg-cyan-400' : 'bg-purple-400';
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-[11px] font-mono text-slate-400">
      <span>{label}</span>
      <span className="flex flex-col gap-1">
        <span className="h-1.5 rounded bg-slate-800 overflow-hidden">
          <span className={`block h-full ${fill}`} style={{ width: `${(a / max) * 100}%` }} />
        </span>
        <span className="h-1.5 rounded bg-slate-800 overflow-hidden">
          <span className={`block h-full ${fill} opacity-40`} style={{ width: `${(b / max) * 100}%` }} />
        </span>
      </span>
      <span className="text-right text-slate-200 tabular-nums">
        {format(a)} / {format(b)}
      </span>
    </div>
  );
};

function lineupVerdict(s: LineupSwap, lambda: number): string {
  const inName = s.playerIn.name;
  const outName = s.playerOut?.name ?? 'the current starter';
  if (s.statsFavor !== 'out' && s.starsFavor !== 'out') {
    return `Stats and Stars both favor ${inName}.`;
  }
  const statsSide = s.statsFavor === 'in' ? inName : outName;
  const starsSide = s.starsFavor === 'in' ? inName : outName;
  const winner = s.statsFavor === 'in' ? 'stats' : 'stars';
  const flip = s.flipLambda !== null ? ` It flips at λ ${s.flipLambda.toFixed(2)}.` : '';
  return `Stats favor ${statsSide}, stars favor ${starsSide}. At λ ${lambda.toFixed(2)} the ${winner} win.${flip}`;
}

const MoveCard: React.FC<{ kind: string; kindClass: string; children: React.ReactNode }> = ({
  kind,
  kindClass,
  children,
}) => (
  <li className="p-4 rounded-xl bg-slate-900/70 border border-white/10 flex flex-col gap-2">
    <span className={`text-[10px] font-mono uppercase tracking-widest ${kindClass}`}>{kind}</span>
    {children}
  </li>
);

export const WeeklyMoves: React.FC = () => {
  const { draftState, setTab } = useOneiromancy();
  const [inspected, setInspected] = useState<InspectTarget | null>(null);
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const season = getSeasonContext();
  const currentWeek = season?.currentWeek ?? draftState.weekly_matchup?.week;

  const swaps = useMemo(() => computeLineupCheck(roster, lambda), [roster, lambda]);
  const waiver = useMemo(
    () => computeWaiverMoves(board, roster, lambda, currentWeek, 1)[0],
    [board, roster, lambda, currentWeek],
  );
  const bye = useMemo(
    () => (currentWeek ? computeByeOutlook(roster, currentWeek, 3)[0] : undefined),
    [roster, currentWeek],
  );
  const trade = useMemo(
    () => computeTradePartners(teams, board, roster, lambda)[0],
    [teams, board, roster, lambda],
  );

  const tabButton = (label: string, tab: string) => (
    <button
      type="button"
      onClick={() => setTab(tab as any)}
      className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-200 hover:border-cyan-400/60"
    >
      {label}
    </button>
  );

  const hasMoves = swaps.length > 0 || waiver || bye || trade;

  return (
    <section aria-labelledby="weekly-moves-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="weekly-moves-heading" className="font-serif text-xl font-bold text-slate-100">
          Your moves
        </h3>
        <span className="text-[11px] font-mono text-slate-400">ranked by urgency · λ {lambda.toFixed(2)}</span>
      </div>
      {!hasMoves && (
        <p className="p-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-slate-300">
          Your lineup is already the Oracle&apos;s best, and no waiver move beats your bench.
        </p>
      )}
      <ol className="flex flex-col gap-3" data-testid="weekly-moves">
        {swaps.map((s) => (
          <MoveCard key={`swap-${s.playerIn.id}`} kind={`Lineup · ${s.slot}`} kindClass="text-cyan-300">
            <span className="text-base font-semibold text-slate-100">
              Start <PlayerLink player={s.playerIn} vs={s.playerOut ?? null} onOpen={setInspected} />
              {s.playerOut ? (
                <>
                  {' '}over <PlayerLink player={s.playerOut} vs={s.playerIn} onOpen={setInspected} />
                </>
              ) : null}
            </span>
            {s.moved && (
              <span className="text-xs text-slate-400">
                {s.moved.player.name} moves to {s.moved.to}.
              </span>
            )}
            <PairBars label="Stats" a={s.statsIn} b={s.statsOut} format={(n) => n.toFixed(1)} tone="stats" />
            <PairBars label="Stars" a={s.starsIn} b={s.starsOut} format={(n) => n.toFixed(0)} tone="stars" />
            <span className="text-xs font-mono text-slate-300">{lineupVerdict(s, lambda)}</span>
          </MoveCard>
        ))}

        {waiver && (
          <MoveCard kind={`Waiver · ${waiver.add.position}`} kindClass="text-emerald-300">
            <span className="text-base font-semibold text-slate-100">
              Add <PlayerLink player={waiver.add} vs={waiver.drop} onOpen={setInspected} /> ({waiver.add.team}),
              drop <PlayerLink player={waiver.drop} vs={waiver.add} onOpen={setInspected} />
            </span>
            <span className="text-xs text-slate-400">{waiver.reason}</span>
            <div className="flex flex-wrap gap-2">
              {tabButton('All waiver moves', 'market')}
            </div>
          </MoveCard>
        )}

        {bye && (
          <MoveCard kind={`Plan ahead · Week ${bye.week}`} kindClass="text-amber-300">
            <span className="text-base font-semibold text-slate-100">
              {bye.starters.length} starter{bye.starters.length === 1 ? '' : 's'} on bye:{' '}
              {bye.starters.map((p) => `${p.name} (${p.position})`).join(', ')}
            </span>
            <span className="text-xs text-slate-400">
              {bye.bench.length > 0
                ? `Also off from your bench: ${bye.bench.map((p) => p.name).join(', ')}. `
                : ''}
              Line up cover before week {bye.week}.
            </span>
          </MoveCard>
        )}

        {trade && (
          <MoveCard kind="Trade idea · lineup fit" kindClass="text-purple-300">
            <span className="text-base font-semibold text-slate-100">
              {trade.give && trade.get ? (
                <>
                  Offer <PlayerLink player={trade.give.player} vs={trade.get.player} onOpen={setInspected} /> to{' '}
                  {trade.team.name.replace(/\s*\(You\)$/, '')} for{' '}
                  <PlayerLink player={trade.get.player} vs={trade.give.player} onOpen={setInspected} />
                </>
              ) : (
                `${trade.team.name.replace(/\s*\(You\)$/, '')} is short at ${trade.youCanOffer.join(' and ')}`
              )}
            </span>
            <span className="text-xs text-slate-400">
              {trade.give && trade.get
                ? `${trade.give.player.name} would start over their ${trade.give.replaces.name}; ${trade.get.player.name} would start over your ${trade.get.replaces.name}.`
                : trade.summary}
            </span>
            <div className="flex flex-wrap gap-2">{tabButton('See trade partners', 'trades')}</div>
          </MoveCard>
        )}
      </ol>
      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={roster}
      />
    </section>
  );
};

export default WeeklyMoves;
