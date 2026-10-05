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
import { CosmicPlayer } from '@/types/oneiromancy';
import { Eye } from 'lucide-react';

export interface PlayerCardRowProps {
  player: CosmicPlayer;
  rank: number;
  onInspect: (player: CosmicPlayer) => void;
  onDraft?: (playerId: string) => void;
  isDrafting?: boolean;
  className?: string;
}

export const PlayerCardRow: React.FC<PlayerCardRowProps> = ({
  player,
  rank,
  onInspect,
  onDraft,
  isDrafting = false,
  className = '',
}) => {
  const isAvailable = player.draft_status === 'available';
  const isMyTeam = player.draft_status === 'my_team';
  const sleeperProj =
    player.sleeper_projected_points ??
    (player as any).weekly_projected_points ??
    player.projected_points;
  const nflProj =
    player.nfl_projected_points ??
    sleeperProj;

  return (
    <div
      onClick={() => onInspect(player)}
      className={`group p-3 rounded-xl border transition-all cursor-pointer select-none ${
        isMyTeam
          ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
          : isAvailable
          ? 'bg-slate-900/70 border-white/10 hover:border-cyan-500/40 hover:bg-slate-900/90'
          : 'bg-slate-950/50 border-white/5 opacity-50'
      } ${className}`}
    >
      {/* Line 1: Rank, Position, Name, Team (Bye), DraftScore */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-xs text-slate-500 w-5 shrink-0 text-right">
            #{rank}
          </span>
          <PositionalBadge position={player.position} size="sm" />
          <div className="min-w-0 flex-1 truncate flex items-center gap-1.5">
            <span
              className={`font-serif font-bold text-sm truncate ${
                isAvailable ? 'text-slate-100 group-hover:text-cyan-300' : 'text-slate-400 line-through'
              }`}
            >
              {player.name}
            </span>
            {player.injury_status && (
              <span
                className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded border shrink-0 ${
                  player.injury_status === 'Out' || player.injury_status === 'IR'
                    ? 'text-rose-400 bg-rose-950/60 border-rose-500/40'
                    : 'text-amber-400 bg-amber-950/60 border-amber-500/40'
                }`}
              >
                {player.injury_status.toUpperCase()}
              </span>
            )}
            <span className="font-mono text-[11px] text-slate-400 ml-1 shrink-0">
              {player.team} ({player.bye_week})
            </span>
          </div>
        </div>

        {/* DraftScore & Weekly Favorability pill */}
        <div className="shrink-0 flex items-center gap-1.5">
          {player.favorability_score !== undefined && (
            <span
              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                (player.favorability_score ?? 70) >= 84
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40'
                  : (player.favorability_score ?? 70) >= 75
                    ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                    : 'text-rose-300 bg-rose-950/80 border-rose-500/40'
              }`}
              title="Weekly Matchup Favorability Score">
              Fav: {player.favorability_score.toFixed(0)}
            </span>
          )}
          <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.25)]">
            {player.draft_score.toFixed(1)} DS
          </span>
        </div>
      </div>

      {/* Line 2: Telemetry Stats & Read-Only Inspection */}
      <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        {/* Telemetry Chips */}
        <div className="flex items-center gap-2 font-mono text-[10px] flex-wrap">
          <span className="text-slate-200">
            Proj <strong className="text-cyan-300">{sleeperProj.toFixed(1)}</strong>
            <span className="text-slate-500 text-[9px]"> / {nflProj.toFixed(1)}</span>
          </span>
          <span className="text-emerald-400">
            VOR {player.market_vor >= 0 ? `+${player.market_vor.toFixed(1)}` : player.market_vor.toFixed(1)}
          </span>
          <span className="text-purple-300">
            Spirit {player.spirit_score.toFixed(0)}
          </span>
          <span className="text-amber-300">
            Harm {player.harmony_score.toFixed(0)}
          </span>

          {/* Status Pill */}
          {isMyTeam ? (
            <span className="text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
              ROSTER
            </span>
          ) : !isAvailable ? (
            <span className="text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded border border-white/5">
              DRAFTED
            </span>
          ) : (
            <span className="text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/30">
              AVAILABLE
            </span>
          )}
        </div>

        {/* Read-Only Status & Inspection */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onInspect(player)}
            aria-label={`Inspect ${player.name}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors border border-white/5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[10px]">Inspect</span>
          </button>
          {isAvailable && (
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
              OPEN
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerCardRow;
