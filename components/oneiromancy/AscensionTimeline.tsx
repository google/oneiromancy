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
import GlassCard from '@/components/common/GlassCard';
import AscensionNode from './AscensionNode';
import { CosmicPlayer, IdealDraftPick } from '@/types/oneiromancy';
import { Sparkles, Trophy, CheckCircle2 } from 'lucide-react';

export interface AscensionTimelineProps {
  steps?: IdealDraftPick[];
  currentRound?: number;
  cosmicBoard?: CosmicPlayer[];
  onSelectStep?: (step: IdealDraftPick) => void;
  onInspectPlayerById?: (playerId: string) => void;
  className?: string;
}

export const AscensionTimeline: React.FC<AscensionTimelineProps> = ({
  steps = [],
  currentRound = 5,
  cosmicBoard = [],
  onSelectStep,
  onInspectPlayerById,
  className = '',
}) => {
  if (steps.length === 0) {
    return (
      <GlassCard variant="panel" className="p-6 text-center text-slate-400 font-mono text-xs">
        No ascension draft path calculated yet.
      </GlassCard>
    );
  }

  const allCompleted = steps.every((s) => s.is_ascended || s.round < currentRound);

  return (
    <GlassCard variant="panel" className={`p-4 sm:p-6 space-y-4 ${className}`}>
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Path of Ascension</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400">
            15-Round Divination Trajectory & Target Milestones
          </p>
        </div>
        <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
          Round {currentRound} / 15
        </span>
      </div>

      {/* Roster Complete Banner if all rounds completed */}
      {allCompleted && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/80 to-cyan-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="font-mono text-xs">
            <span className="font-bold block text-emerald-200">ASCENSION COMPLETE • ROSTER LOCKED</span>
            <span className="text-[11px] text-slate-300">
              All 15 sacred draft nodes achieved. Proceed to Player Marketplace for waiver transmutations.
            </span>
          </div>
        </div>
      )}

      {/* Timeline List with Connecting Vertical Rail */}
      <div className="relative pl-0 sm:pl-2 space-y-4 pt-1">
        {/* Continuous Connecting Rail Line */}
        <div
          className="absolute left-[15px] sm:left-[23px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-emerald-500 via-cyan-400 to-purple-800"
          aria-hidden="true"
        />

        {steps.map((step) => {
          const isCompleted = step.is_ascended || step.round < currentRound;
          const isCurrent = step.round === currentRound;
          const isTerminal = step.round === 15;

          // Check if primary target player is poached by opponent
          let fallbackActive = false;
          let fallbackPlayerName: string | undefined = undefined;

          if (cosmicBoard.length > 0 && isCurrent) {
            const primary = cosmicBoard.find((p) => p.id === step.target_player_id);
            if (primary && primary.draft_status === 'drafted') {
              fallbackActive = true;
              const fallback = cosmicBoard.find((p) => p.id === step.fallback_player_id);
              if (fallback && fallback.draft_status === 'available') {
                fallbackPlayerName = fallback.name;
              } else {
                // Elevate best available of that position
                const bestPositional = cosmicBoard
                  .filter((p) => p.position === step.target_position && p.draft_status === 'available')
                  .sort((a, b) => b.draft_score - a.draft_score)[0];
                fallbackPlayerName = bestPositional ? bestPositional.name : step.fallback_player_name;
              }
            }
          }

          return (
            <AscensionNode
              key={`round-${step.round}-${step.overall_pick}`}
              step={step}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
              isTerminal={isTerminal}
              fallbackActive={fallbackActive}
              fallbackPlayerName={fallbackPlayerName}
              onInspect={() => {
                if (onSelectStep) onSelectStep(step);
                if (onInspectPlayerById && step.target_player_id) {
                  onInspectPlayerById(step.target_player_id);
                }
              }}
            />
          );
        })}
      </div>
    </GlassCard>
  );
};

export default AscensionTimeline;
