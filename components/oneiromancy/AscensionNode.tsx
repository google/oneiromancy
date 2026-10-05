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
import { IdealDraftPick } from '@/types/oneiromancy';
import { Check, Zap, Crown, Sparkles, AlertCircle } from 'lucide-react';

export interface AscensionNodeProps {
  step: IdealDraftPick;
  isCurrent: boolean;
  isCompleted: boolean;
  isTerminal: boolean;
  fallbackActive?: boolean;
  fallbackPlayerName?: string;
  onInspect?: () => void;
  className?: string;
}

export const AscensionNode: React.FC<AscensionNodeProps> = ({
  step,
  isCurrent,
  isCompleted,
  isTerminal,
  fallbackActive = false,
  fallbackPlayerName,
  onInspect,
  className = '',
}) => {
  return (
    <div className={`relative flex items-start gap-3 sm:gap-4 group ${className}`}>
      {/* Node Beacon / Status Indicator */}
      <div className="relative z-10 flex items-center justify-center shrink-0 w-8 h-8 rounded-full border bg-slate-950 transition-all">
        {isCompleted ? (
          <div className="w-full h-full rounded-full bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400">
            <Check className="w-4 h-4" />
          </div>
        ) : isCurrent ? (
          <div className="relative w-full h-full rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8)]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <Zap className="w-4 h-4 text-cyan-300 relative z-10" />
          </div>
        ) : isTerminal ? (
          <div className="w-full h-full rounded-full bg-amber-950/80 border border-amber-400/60 flex items-center justify-center text-amber-300 shadow-[0_0_8px_rgba(234,179,8,0.5)]">
            <Crown className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-full h-full rounded-full bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <span className="text-xs">✦</span>
          </div>
        )}
      </div>

      {/* Node Content Card */}
      <div
        onClick={onInspect}
        className={`flex-1 p-3 rounded-xl border transition-all cursor-pointer ${
          isCurrent
            ? 'bg-cyan-950/20 border-cyan-500/60 shadow-[0_0_16px_rgba(6,182,212,0.2)]'
            : isCompleted
            ? 'bg-emerald-950/10 border-emerald-500/20 opacity-80 hover:opacity-100'
            : isTerminal
            ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-400/50'
            : 'bg-slate-900/40 border-dashed border-purple-500/30 hover:border-purple-400/50'
        }`}
      >
        {/* Top Header: Round, Pick, Position */}
        <div className="flex justify-between items-center text-xs font-mono mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              RD {String(step.round).padStart(2, '0')} • PK {String(step.overall_pick).padStart(2, '0')}
            </span>
            <PositionalBadge position={step.target_position} size="sm" />
          </div>

          {isTerminal && (
            <span className="text-[9px] uppercase tracking-wider font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
              Zenith Cap
            </span>
          )}

          {isCurrent && (
            <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/50 animate-pulse">
              On Clock Radar
            </span>
          )}

          {isCompleted && (
            <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium">
              Ascended ✓
            </span>
          )}
        </div>

        {/* Player Name & Team */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="space-y-0.5">
            <span
              className={`font-serif font-bold text-sm sm:text-base ${
                isCompleted ? 'text-slate-400 line-through' : isCurrent ? 'text-cyan-200' : 'text-slate-100'
              }`}
            >
              {step.target_player_name}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-2">
              {step.target_team}
            </span>
          </div>

          {/* Telemetry Stats */}
          <div className="text-right font-mono text-xs shrink-0">
            <span className="text-cyan-400 font-bold">{(step.draft_score ?? 0).toFixed(1)} DS</span>
            <span className="text-[10px] text-slate-500 block">
              +{((step.positional_vor ?? step.vor_normalized ?? 0)).toFixed(1)} VOR
            </span>
          </div>
        </div>

        {/* Fallback Candidate Callout if Poached */}
        {fallbackActive && (
          <div className="mt-2 p-1.5 rounded bg-amber-950/50 border border-amber-500/40 text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              ⚡ Fallback Activated: {fallbackPlayerName || step.fallback_player_name}
            </span>
          </div>
        )}

        {/* Elemental Synergy Tag & Strategic Rationale */}
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          {step.elemental_synergy_tag && (
            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              {step.elemental_synergy_tag}
            </span>
          )}
        </div>

        {step.strategic_rationale && (
          <p className="mt-1.5 text-[11px] font-sans text-slate-400 italic line-clamp-2">
            &ldquo;{step.strategic_rationale}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
};

export default AscensionNode;
