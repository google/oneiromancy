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

import React from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import { CosmicPlayer } from '@/types/oneiromancy';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import { TONE_LABEL, TONE_PILL, favorabilityTone, oracleScore, starsScore, statsPoints } from '@/lib/oracle';

export interface PlayerCardRowProps {
  player: CosmicPlayer;
  rank: number;
  onInspect: (player: CosmicPlayer) => void;
  onDraft?: (playerId: string) => void;
  isDrafting?: boolean;
  className?: string;
  /** Oracle λ used for the blended score. */
  lambda?: number;
}

/** Phone row: full name first, then Stats, Stars and Oracle. */
export const PlayerCardRow: React.FC<PlayerCardRowProps> = ({
  player,
  rank,
  onInspect,
  className = '',
  lambda = DEFAULT_CHAOS_LAMBDA,
}) => {
  const isAvailable = player.draft_status === 'available';
  const isMyTeam = player.draft_status === 'my_team';
  const stars = starsScore(player);
  const tone = favorabilityTone(stars);

  return (
    <div
      onClick={() => onInspect(player)}
      className={`group p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center gap-3 ${
        isMyTeam
          ? 'bg-emerald-950/20 border-emerald-500/30'
          : isAvailable
          ? 'bg-slate-900/70 border-white/10 hover:border-cyan-500/40'
          : 'bg-slate-950/50 border-white/5 opacity-60'
      } ${className}`}
    >
      <span className="font-mono text-xs text-slate-500 w-6 shrink-0 text-right">{rank}</span>
      <PlayerHeadshot player={player} size="md" />
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="font-sans font-semibold text-sm text-slate-100 break-words">
          {player.name}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 flex-wrap">
          <PositionalBadge position={player.position} size="sm" />
          <span>
            <TeamLogo team={player.team} className="mr-1" />
            {player.team} · Bye {player.bye_week || '—'}
          </span>
          {player.injury_status && (
            <span
              className={`text-[9px] font-bold px-1 rounded border ${
                ['Out', 'IR', 'NA', 'Doubtful'].includes(player.injury_status)
                  ? 'text-rose-300 bg-rose-950/60 border-rose-500/40'
                  : 'text-amber-300 bg-amber-950/60 border-amber-500/40'
              }`}
            >
              {player.injury_status.toUpperCase()}
            </span>
          )}
          {!isAvailable && (
            <span className="text-[9px] px-1 rounded border border-white/10 text-slate-400">
              {isMyTeam ? 'Yours' : 'Rostered'}
            </span>
          )}
        </span>
      </div>
      <div className="shrink-0 grid grid-cols-3 gap-2 text-right font-mono">
        <span className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase">Stats</span>
          <span className="text-sm font-bold text-slate-100 tabular-nums">{statsPoints(player).toFixed(1)}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-[9px] text-slate-500 uppercase">Stars</span>
          <span title={TONE_LABEL[tone]} className={`text-xs font-bold px-1 rounded border ${TONE_PILL[tone]}`}>
            {stars.toFixed(0)}
          </span>
        </span>
        <span className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase">Oracle</span>
          <span className="text-sm font-bold text-cyan-300 tabular-nums">{oracleScore(player, lambda).toFixed(0)}</span>
        </span>
      </div>
    </div>
  );
};

export default PlayerCardRow;
