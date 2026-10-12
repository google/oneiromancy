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

/**
 * The original Marketplace look (colored tags, stat tiles, element icons),
 * driven by the Stats / Stars / Oracle model. Shared by Waivers and Trades.
 */

import React from 'react';
import { Droplet, Flame, Mountain, Wind } from 'lucide-react';
import { favorabilityTone, oracleScore, starsScore, statsPoints, type Tone } from '@/lib/oracle';
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

/** Injury tag; "Healthy" in green when there is none. */
export const HealthTag: React.FC<{ player: CosmicPlayer }> = ({ player }) => {
  const s = player.injury_status;
  if (!s) return <Tag tone="emerald">Healthy</Tag>;
  const severe = ['Out', 'IR', 'NA', 'PUP', 'Sus', 'Doubtful'].includes(s);
  return <Tag tone={severe ? 'rose' : 'amber'}>{s}</Tag>;
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
 * Stat tiles: projected points, this week's Stars (the weekly favorability,
 * tone-colored), Oracle at λ, and Spirit; then team / bye and element.
 */
export const StatTiles: React.FC<{ player: CosmicPlayer; lambda: number; muted?: boolean }> = ({
  player,
  lambda,
  muted = false,
}) => {
  const stars = starsScore(player);
  const tone = favorabilityTone(stars);
  const tile = `${muted ? 'bg-slate-950/80' : 'bg-slate-900/80'} p-1.5 rounded border border-white/5`;
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
        <div className={tile}>
          <span className="text-slate-500 block text-[9px]">Proj pts</span>
          <span className={`font-bold ${muted ? 'text-slate-300' : 'text-cyan-300'}`}>
            {statsPoints(player).toFixed(1)}
          </span>
        </div>
        <div className={tile} title="Stars: this week's celestial favorability (0–100)">
          <span className="text-slate-500 block text-[9px]">Stars</span>
          <span className={`font-bold ${TONE_TEXT[tone]}`}>{stars.toFixed(0)}</span>
        </div>
        <div className={tile} title={`Oracle at λ ${lambda.toFixed(2)}`}>
          <span className="text-slate-500 block text-[9px]">Oracle</span>
          <span className={`font-bold ${muted ? 'text-slate-300' : 'text-emerald-400'}`}>
            {oracleScore(player, lambda).toFixed(1)}
          </span>
        </div>
        <div className={tile}>
          <span className="text-slate-500 block text-[9px]">Spirit</span>
          <span className="font-bold text-purple-300">{(player.spirit_score ?? 0).toFixed(1)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        <div className={`${tile} flex justify-between items-center gap-1`}>
          <span className="text-slate-500">Team / Bye</span>
          <span className="text-slate-200 font-bold">
            {player.team || 'FA'} (Wk {player.bye_week || '—'})
          </span>
        </div>
        <div className={`${tile} flex justify-between items-center gap-1 min-w-0`}>
          <span className="text-slate-400 flex items-center gap-1 min-w-0">
            <ElementIcon element={player.elemental_traits?.element} />
            <span className="truncate">{player.elemental_traits?.element || '—'}</span>
          </span>
          <span className="text-slate-400 truncate">{player.elemental_traits?.sun_sign || ''}</span>
        </div>
      </div>
    </div>
  );
};
