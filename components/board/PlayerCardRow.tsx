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

import React from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import { CosmicPlayer } from '@/types/oneiromancy';
import { User } from 'lucide-react';
import { DEFAULT_CHAOS_LAMBDA, isPlayerOnByeWeek } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
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
  /** Optional waiver upgrade context when viewing Waivers filter. */
  waiverHint?: {
    dropName: string;
    oracleGain: number;
    wouldStart?: boolean;
  };
  /** Optional trade partner context when viewing Trades filter. */
  tradeHint?: {
    partnerName: string;
    give?: CosmicPlayer;
    giveName?: string;
    gain?: number;
    oracleGain?: number;
  };
}

/**
 * Compact player row: single click opens PlayerDetailModal directly.
 * Rostered user players use the canonical purple border; displays strictly
 * the 3 canonical player metrics (Stats, Oracle, Stars).
 */
export const PlayerCardRow: React.FC<PlayerCardRowProps> = ({
  player,
  rank,
  onInspect,
  className = '',
  lambda = DEFAULT_CHAOS_LAMBDA,
  waiverHint,
  tradeHint,
}) => {
  const isAvailable = player.draft_status === 'available';
  const isMyTeam = player.draft_status === 'my_team';
  const stars = starsScore(player);
  const tone = favorabilityTone(stars);
  const isSevereInjury =
    player.injury_status &&
    ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status);
  const seasonCtx = getSeasonContext();
  const onByeNow = isPlayerOnByeWeek(seasonCtx?.currentWeek, player.bye_week, player.team, seasonCtx?.byeWeeks);

  return (
    <div
      onClick={() => onInspect(player)}
      data-testid={`player-card-row-${player.id}`}
      className={`group p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center gap-3 ${
        onByeNow
          ? 'bg-slate-950/70 border-slate-700/50 opacity-50 grayscale hover:opacity-75'
          : isMyTeam
          ? 'bg-purple-950/25 border-purple-500/60 ring-1 ring-purple-500/20'
          : isAvailable
          ? 'bg-slate-900/70 border-white/10 hover:border-cyan-500/40'
          : 'bg-slate-900/50 border-white/10 hover:border-cyan-500/30'
      } ${className}`}
    >
      <span className="font-mono text-xs text-slate-500 w-6 shrink-0 text-right">{rank}</span>
      <PlayerHeadshot player={player} size="md" />
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-sans font-semibold text-sm text-slate-100 break-words">
            {player.name}
          </span>
          {isMyTeam && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-500/50 bg-purple-950/70 text-purple-200 flex items-center gap-1"
              aria-hidden="true"
            >
              <User className="w-2.5 h-2.5 text-purple-300" aria-hidden="true" />
              <span>Roster</span>
            </span>
          )}
          {isMyTeam && <span className="sr-only"> (On your roster)</span>}
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 flex-wrap">
          <PositionalBadge position={player.position} size="sm" />
          <span>
            <TeamLogo team={player.team} className="mr-1" />
            {player.team} · Bye {player.bye_week || '-'}
          </span>
          {player.injury_status && player.injury_status !== 'Healthy' && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                isSevereInjury
                  ? 'text-rose-300 bg-rose-950/70 border-rose-500/50'
                  : 'text-amber-300 bg-amber-950/70 border-amber-500/50'
              }`}
            >
              {player.injury_status.toUpperCase()}
            </span>
          )}
          {onByeNow && (
            <>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-amber-300 bg-amber-950/70 border-amber-500/50">
                BYE WK {seasonCtx?.currentWeek}
              </span>
              <span className="text-[10px] font-mono text-slate-500">· On Bye</span>
            </>
          )}
          {!isAvailable && !isMyTeam && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-slate-900 text-cyan-200">
              {player.drafted_by || tradeHint?.partnerName || 'Rostered'}
            </span>
          )}
          {waiverHint && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
              Drop {waiverHint.dropName} (+{waiverHint.oracleGain.toFixed(1)} Oracle)
            </span>
          )}
          {tradeHint && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-200 border border-purple-500/40">
              {tradeHint.partnerName}
              {tradeHint.give?.name || tradeHint.giveName
                ? ` • Send ${tradeHint.give?.name || tradeHint.giveName}`
                : ''}
              {(tradeHint.gain ?? tradeHint.oracleGain)
                ? ` (+${(tradeHint.gain ?? tradeHint.oracleGain)!.toFixed(1)} Oracle)`
                : ''}
            </span>
          )}
        </span>
      </div>
      {/* Strictly 3 Canonical Player Metrics: Stats, Oracle, Stars */}
      <div className="shrink-0 grid grid-cols-3 gap-2 text-right font-mono">
        <span className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase">Stats</span>
          <span className="text-sm font-bold text-slate-100 tabular-nums">{statsPoints(player).toFixed(1)}</span>
        </span>
        <span className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase">Oracle</span>
          <span className="text-sm font-bold text-cyan-300 tabular-nums">{oracleScore(player, lambda).toFixed(1)}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-[9px] text-slate-500 uppercase">Stars</span>
          <span title={TONE_LABEL[tone]} className={`text-xs font-bold px-1.5 py-0.5 rounded border ${TONE_PILL[tone]}`}>
            {stars.toFixed(0)}
          </span>
        </span>
      </div>
    </div>
  );
};

export default PlayerCardRow;
