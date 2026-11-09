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
import { DEFAULT_CHAOS_LAMBDA, isPlayerOnByeWeek, stripUserSuffix } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import { MAX_COMPARE_PLAYERS, useOptionalOneiromancy } from '@/context/OneiromancyContext';
import {
  TONE_LABEL,
  TONE_PILL,
  favorabilityTone,
  oraclePlaceholderInfo,
  oracleScore,
  resolveActiveWeek,
  starsScore,
  statsPoints,
} from '@/lib/oracle';

export interface PlayerCardRowProps {
  player: CosmicPlayer;
  rank: number;
  onInspect: (player: CosmicPlayer) => void;
  onDraft?: (playerId: string) => void;
  isDrafting?: boolean;
  className?: string;
  /** Oracle λ used for the blended score. */
  lambda?: number;
  /** Active NFL week override when season context is not populated. */
  activeWeek?: number;
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
  /** Whether the player is currently selected for multi-player comparison */
  isCompared?: boolean;
  /** Whether selecting for comparison is disabled (e.g. reached 6 player cap) */
  isCompareDisabled?: boolean;
  /** Callback to toggle comparison selection */
  onToggleCompare?: (id: string) => void;
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
  activeWeek: propActiveWeek,
  waiverHint,
  tradeHint,
  isCompared = false,
  isCompareDisabled = false,
  onToggleCompare,
}) => {
  const ctx = useOptionalOneiromancy();
  const isAvailable = player.draft_status === 'available';
  const isMyTeam = player.draft_status === 'my_team';
  const isSevereInjury =
    player.injury_status &&
    ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status);
  const seasonCtx = getSeasonContext();
  const activeWk = resolveActiveWeek(ctx?.draftState, propActiveWeek);
  const onByeNow = isPlayerOnByeWeek(activeWk, player.bye_week, player.team, seasonCtx?.byeWeeks);
  const placeholder = oraclePlaceholderInfo(player, activeWk);
  const stars = starsScore(player, activeWk);
  const tone = favorabilityTone(stars);
  const oracleVal = oracleScore(player, lambda, { currentWeek: activeWk });

  return (
    <div
      onClick={() => onInspect(player)}
      data-testid={`player-card-row-${player.id}`}
      className={`group p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center gap-3 ${
        isCompared
          ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
          : onByeNow
          ? 'bg-slate-950/70 border-slate-700/50 opacity-50 grayscale hover:opacity-75'
          : isMyTeam
          ? 'bg-purple-950/25 border-purple-500/60 ring-1 ring-purple-500/20'
          : isAvailable
          ? 'bg-slate-900/70 border-white/10 hover:border-cyan-500/40'
          : 'bg-slate-900/50 border-white/10 hover:border-cyan-500/30'
      } ${className}`}
    >
      {onToggleCompare && (
        <label
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              e.preventDefault();
              if (!isCompareDisabled || isCompared) {
                onToggleCompare(String(player.id));
              }
            }
          }}
          className="shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer"
        >
          <input
            type="checkbox"
            checked={Boolean(isCompared)}
            disabled={isCompareDisabled}
            title={isCompareDisabled ? `Maximum of ${MAX_COMPARE_PLAYERS} players compared` : undefined}
            onChange={() => {}}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (!isCompareDisabled || isCompared) {
                onToggleCompare(String(player.id));
              }
            }}
            aria-label={`Compare ${player.name}`}
            className={`w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50 ${
              isCompareDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          />
        </label>
      )}
      <span className="font-mono text-xs text-slate-500 w-6 shrink-0 text-right">{rank}</span>
      <PlayerHeadshot player={player} size="md" />
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-sans font-semibold text-sm text-slate-100 break-words">
            {player.name}
          </span>
          {isCompared && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/50 bg-amber-950/70 text-amber-200"
              aria-label="Pinned comparison"
            >
              PINNED
            </span>
          )}
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
          <PositionalBadge position={player.position} size="sm" depth={player.depth_chart_order} />
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
                {`BYE WK ${player.bye_week || activeWk}`}
              </span>
              <span className="text-[10px] font-mono text-slate-500">· On Bye</span>
            </>
          )}
          {!isAvailable && !isMyTeam && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-slate-900 text-cyan-200">
              {stripUserSuffix(player.drafted_by) || stripUserSuffix(tradeHint?.partnerName) || 'Rostered'}
            </span>
          )}
          {waiverHint && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
              Drop {waiverHint.dropName} (+{waiverHint.oracleGain.toFixed(1)} Oracle)
            </span>
          )}
          {tradeHint && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-200 border border-purple-500/40">
              {stripUserSuffix(tradeHint.partnerName)}
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
        <span
          className="flex flex-col"
          title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
        >
          <span className="text-[9px] text-slate-500 uppercase">Stats</span>
          <span className="text-sm font-bold text-slate-100 tabular-nums">
            {statsPoints(player).toFixed(1)}
          </span>
        </span>
        <span
          className="flex flex-col"
          title={placeholder.hasPlaceholder ? placeholder.tooltipText : undefined}
        >
          <span className="text-[9px] text-slate-500 uppercase">Oracle</span>
          <span className="text-sm font-bold text-cyan-300 tabular-nums">
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
        </span>
        <span
          className="flex flex-col items-end"
          title={placeholder.hasPlaceholder ? placeholder.tooltipText : TONE_LABEL[tone]}
        >
          <span className="text-[9px] text-slate-500 uppercase">Stars</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${TONE_PILL[tone]}`}>
            {stars.toFixed(0)}
          </span>
        </span>
      </div>
    </div>
  );
};

export default PlayerCardRow;
