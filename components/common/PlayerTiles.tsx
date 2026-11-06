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

/**
 * Shared visual primitives (colored tags, 3-metric stat tiles, element icons),
 * driven strictly by the 3 canonical metrics: Stats, Spirit/Oracle, and Stars.
 */

import React from 'react';
import { Droplet, Flame, Mountain, Wind } from 'lucide-react';
import {
  favorabilityTone,
  oraclePlaceholderInfo,
  oracleScore,
  resolveActiveWeek,
  starsScore,
  statsPoints,
  type Tone,
} from '@/lib/oracle';
import { isPlayerOnByeWeek } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import type { CosmicPlayer } from '@/types/oneiromancy';

const TONE_TEXT: Record<Tone, string> = {
  apex: 'text-emerald-300',
  good: 'text-emerald-400',
  neutral: 'text-amber-300',
  bad: 'text-rose-300',
};

export const ElementIcon: React.FC<{ element?: string | null }> = ({ element }) => {
  switch (element) {
    case 'Fire':
      return <Flame className="w-3.5 h-3.5 text-rose-500 inline shrink-0" />;
    case 'Water':
      return <Droplet className="w-3.5 h-3.5 text-blue-400 inline shrink-0" />;
    case 'Air':
      return <Wind className="w-3.5 h-3.5 text-sky-400 inline shrink-0" />;
    case 'Earth':
      return <Mountain className="w-3.5 h-3.5 text-teal-400 inline shrink-0" />;
    default:
      return null;
  }
};

export type TagTone = 'cyan' | 'purple' | 'emerald' | 'rose' | 'amber' | 'slate';
const TAG: Record<TagTone, string> = {
  cyan: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300',
  purple: 'bg-purple-950/80 border-purple-500/40 text-purple-300',
  emerald: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
  rose: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
  amber: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
  slate: 'bg-slate-950/80 border-white/10 text-slate-400',
};

/** Small colored pill (status, injury, priority). */
export const Tag: React.FC<{ tone: TagTone; children: React.ReactNode; className?: string }> = ({
  tone,
  children,
  className = '',
}) => (
  <span
    className={`px-1.5 py-0.5 rounded border font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${TAG[tone]} ${className}`}
  >
    {children}
  </span>
);

/** Injury tag; "Healthy" in green when there is none, or "BYE WK N" tag + muted "On Bye" label when on bye. */
export const HealthTag: React.FC<{ player: CosmicPlayer; activeWeek?: number }> = ({
  player,
  activeWeek,
}) => {
  const s = player.injury_status;
  const severe = Boolean(s && ['Out', 'IR', 'NA', 'PUP', 'Sus', 'Doubtful'].includes(s));
  const ctx = getSeasonContext();
  const oneiromancy = useOptionalOneiromancy();
  const activeWk = resolveActiveWeek(oneiromancy?.draftState, activeWeek);
  const onBye = isPlayerOnByeWeek(activeWk, player.bye_week, player.team, ctx?.byeWeeks);

  const byeBadge = onBye ? (
    <span className="inline-flex items-center gap-1.5">
      <Tag tone="amber">
        {`BYE WK ${player.bye_week || activeWk}`}
      </Tag>
      <span className="text-[10px] font-mono text-slate-500">On Bye</span>
    </span>
  ) : null;

  if (s && severe) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Tag tone="rose">{s}</Tag>
        {byeBadge}
      </span>
    );
  }
  if (s && s !== 'Healthy') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Tag tone="amber">{s}</Tag>
        {byeBadge}
      </span>
    );
  }
  if (onBye) {
    return byeBadge;
  }
  return <Tag tone="emerald">Healthy</Tag>;
};

/** A signed delta badge such as "+12.4 ORACLE". */
export const DeltaBadge: React.FC<{ value: number; unit: string; tone: TagTone; digits?: number }> = ({
  value,
  unit,
  tone,
  digits = 1,
}) => (
  <span className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold ${TAG[tone]}`}>
    {value >= 0 ? '+' : ''}
    {value.toFixed(digits)} {unit}
  </span>
);

/**
 * 3-Metric Stat tiles:
 * 1. Stats (projected points)
 * 2. Spirit / Oracle (combined divinity weight score at λ)
 * 3. Stars (upcoming week astrological alignment, 0-100)
 */
export const StatTiles: React.FC<{
  player: CosmicPlayer;
  lambda: number;
  muted?: boolean;
  activeWeek?: number;
}> = ({
  player,
  lambda,
  muted = false,
  activeWeek,
}) => {
  const oneiromancy = useOptionalOneiromancy();
  const activeWk = resolveActiveWeek(oneiromancy?.draftState, activeWeek);
  const placeholder = oraclePlaceholderInfo(player, activeWk);
  const stars = starsScore(player, activeWk);
  const tone = favorabilityTone(stars);
  const tile = `${muted ? 'bg-slate-950/80' : 'bg-slate-900/80'} p-1.5 rounded border border-white/5`;
  const oracleVal = oracleScore(player, lambda, { currentWeek: activeWk });
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
        <div
          className={tile}
          title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Stats: baseline projected fantasy points'}
        >
          <span className="text-slate-500 block text-[9px]">Stats</span>
          <span className={`font-bold ${muted ? 'text-slate-300' : 'text-cyan-300'}`}>
            {statsPoints(player).toFixed(1)}
          </span>
        </div>
        <div
          className={tile}
          title={
            placeholder.hasPlaceholder
              ? placeholder.tooltipText
              : `Oracle at λ ${lambda.toFixed(2)} (Spirit ${(player.spirit_score ?? 0).toFixed(1)})`
          }
        >
          <span className="text-slate-500 block text-[9px]">Oracle</span>
          <span className={`font-bold ${muted ? 'text-slate-300' : 'text-purple-300'}`}>
            {oracleVal.toFixed(1)}
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
        </div>
        <div
          className={tile}
          title={
            placeholder.hasPlaceholder
              ? placeholder.tooltipText
              : 'Stars: upcoming week astrological alignment (0-100)'
          }
        >
          <span className="text-slate-500 block text-[9px]">Stars</span>
          <span className={`font-bold ${TONE_TEXT[tone]}`}>{stars.toFixed(0)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        <div className={`${tile} flex justify-between items-center gap-1`}>
          <span className="text-slate-500">Team / Bye</span>
          <span className="text-slate-200 font-bold">
            {player.team || 'FA'} (Wk {player.bye_week || '-'})
          </span>
        </div>
        <div className={`${tile} flex justify-between items-center gap-1 min-w-0`}>
          <span className="text-slate-400 flex items-center gap-1 min-w-0">
            <ElementIcon element={player.elemental_traits?.element} />
            <span className="truncate">{player.elemental_traits?.element || '-'}</span>
          </span>
          <span className="text-slate-400 truncate">{player.elemental_traits?.sun_sign || ''}</span>
        </div>
      </div>
    </div>
  );
};
