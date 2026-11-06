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

import React, { useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import { CosmicPlayer } from '@/types/oneiromancy';
import { DEFAULT_CHAOS_LAMBDA, DIVINATION_PILLARS, starsVerdictLabel } from '@/lib/scoring';
import { oraclePlaceholderInfo, oracleScore, resolveActiveWeek, starsScore, statsPoints } from '@/lib/oracle';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export interface RecommendedPickHeroProps {
  player: CosmicPlayer | null;
  onDraft?: (playerId: string) => void;
  onInspect?: (player: CosmicPlayer) => void;
  onSelectPlayer?: (player: CosmicPlayer) => void;
  isDrafting?: boolean;
  className?: string;
  activeWeek?: number;
}

export const RecommendedPickHero: React.FC<RecommendedPickHeroProps> = ({
  player,
  onInspect,
  onSelectPlayer,
  className = '',
  activeWeek: propActiveWeek,
}) => {
  const ctx = useOptionalOneiromancy();
  const activeWeek = resolveActiveWeek(ctx?.draftState, propActiveWeek);
  const lambda = ctx?.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const handleSelectPlayer = () => {
    if (!player) return;
    if (onSelectPlayer) {
      onSelectPlayer(player);
    } else if (onInspect) {
      onInspect(player);
    }
  };

  if (!player) {
    return (
      <GlassCard variant="panel" className={`p-8 text-center space-y-2 ${className}`}>
        <p className="text-sm font-serif text-slate-300">
          ✦ All celestial candidates have ascended ✦
        </p>
      </GlassCard>
    );
  }

  const breakdown = player.divination_breakdown || {
    celestial: 90,
    numeric: 92,
    geomantic: 88,
    oracular: 95,
    harmony: player.harmony_score || 98,
  };

  const elementIcon =
    player.elemental_traits?.element === 'Fire'
      ? '🔥'
      : player.elemental_traits?.element === 'Earth'
      ? '🌍'
      : player.elemental_traits?.element === 'Air'
      ? '💨'
      : '💧';

  const stars = starsScore(player, { currentWeek: activeWeek });

  return (
    <GlassCard
      variant="gradient"
      glowColor="cyan"
      className={`p-5 sm:p-6 relative overflow-hidden transition-all duration-300 ${className}`}
    >
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <PositionalBadge position={player.position} size="md" depth={player.depth_chart_order} />
          <span className="text-xs font-mono text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-white/10">
            {elementIcon} {player.elemental_traits?.element || 'Celestial'} • {player.elemental_traits?.sun_sign || 'Astra'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span className="font-bold uppercase tracking-wider">THE ORACLE&apos;S DECREE</span>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <h3
          onClick={handleSelectPlayer}
          data-testid="spotlight-player-name"
          className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide cursor-pointer hover:underline hover:text-cyan-300 transition-colors"
          title={`Click to open ${player.name} details`}
        >
          {player.name}
        </h3>
        <p className="font-mono text-xs text-slate-400 flex flex-wrap gap-2 items-center">
          <span>{player.team}</span>
          <span>•</span>
          <span>Bye {player.bye_week || '-'}</span>
          <span>•</span>
          <span>#{player.jersey_number}</span>
        </p>
      </div>

      {/* Strictly 3 Canonical Player Metrics: Stats, Oracle, Stars */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10">
        {(() => {
          const placeholder = oraclePlaceholderInfo(player, activeWeek);
          return (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                  Stats
                </span>
                <span
                  title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
                  className="font-mono text-2xl font-bold text-slate-100 tabular-nums"
                >
                  {statsPoints(player).toFixed(1)}
                </span>
                <span className="text-[9px] font-mono text-slate-500">Projected Points</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
                  Oracle
                </span>
                <span
                  title={placeholder.hasPlaceholder ? placeholder.tooltipText : undefined}
                  className="font-mono text-2xl font-bold text-cyan-300 tabular-nums flex items-center"
                >
                  {oracleScore(player, lambda, { currentWeek: activeWeek }).toFixed(1)}
                  {placeholder.hasPlaceholder && (
                    <span
                      data-testid="oracle-placeholder-marker"
                      title={placeholder.tooltipText}
                      className="ml-1 text-amber-300 font-bold"
                    >
                      ~
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-mono text-slate-500">Blended Stats &amp; Stars</span>
              </div>
            </>
          );
        })()}

        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-teal-300 uppercase font-bold tracking-wider">
            Stars
          </span>
          <span className="font-mono text-2xl font-bold text-teal-300 tabular-nums">
            {stars.toFixed(0)}
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            {starsVerdictLabel(stars)}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setIsDossierOpen(!isDossierOpen)}
          className="w-full py-1.5 px-3 flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors rounded-lg bg-slate-900/60 border border-white/5"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            {isDossierOpen ? 'Hide Divination Breakdown' : 'View 5-Tier Divination Breakdown'}
          </span>
          {isDossierOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isDossierOpen && (
          <div className="mt-2 p-3 rounded-lg bg-slate-950/90 border border-white/10 space-y-2.5 font-mono text-xs">
            {DIVINATION_PILLARS.map((tier) => {
              const value = Number(breakdown[tier.key] ?? 85);
              return (
                <div key={tier.key} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{tier.label}</span>
                    <span className="text-slate-200 font-bold">{value.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tier.color} transition-all duration-300`}
                      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default RecommendedPickHero;
