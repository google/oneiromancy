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

import React, { useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import { CosmicPlayer } from '@/types/oneiromancy';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export interface RecommendedPickHeroProps {
  player: CosmicPlayer | null;
  onDraft?: (playerId: string) => void;
  onInspect?: (player: CosmicPlayer) => void;
  onSelectPlayer?: (player: CosmicPlayer) => void;
  isDrafting?: boolean;
  className?: string;
}

export const RecommendedPickHero: React.FC<RecommendedPickHeroProps> = ({
  player,
  onDraft,
  onInspect,
  onSelectPlayer,
  isDrafting = false,
  className = '',
}) => {
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
        <p className="text-xs text-slate-500 font-mono">
          Draft roster is complete or no available players match current divination criteria.
        </p>
      </GlassCard>
    );
  }

  // Divination breakdown values
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

  return (
    <GlassCard
      variant="gradient"
      glowColor="cyan"
      className={`p-5 sm:p-6 relative overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* Top Banner: Position, Element & Oracle Decree */}
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <PositionalBadge position={player.position} size="md" />
          <span className="text-xs font-mono text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-white/10">
            {elementIcon} {player.elemental_traits?.element || 'Celestial'} • {player.elemental_traits?.sun_sign || 'Astra'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span className="font-bold uppercase tracking-wider">THE ORACLE&apos;S DECREE</span>
        </div>
      </div>

      {/* Player Identity */}
      <div className="mt-4 space-y-1">
        <h3
          onClick={handleSelectPlayer}
          data-testid="spotlight-player-name"
          className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide cursor-pointer hover:underline hover:text-cyan-300 transition-colors"
          title={`Click to inspect ${player.name} dossier`}
        >
          {player.name}
        </h3>
        <p className="font-mono text-xs text-slate-400 flex flex-wrap gap-2 items-center">
          <span>{player.team}</span>
          <span>•</span>
          <span>Bye {player.bye_week}</span>
          <span>•</span>
          <span>#{player.jersey_number}</span>
          <span>•</span>
          <span>ADP {player.adp.toFixed(1)}</span>
        </p>
      </div>

      {/* 5-Metric Telemetry Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10">
        {/* DraftScore */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
            DraftScore
          </span>
          <span className="font-mono text-2xl font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
            {player.draft_score.toFixed(1)}
          </span>
          <span className="text-[9px] font-mono text-slate-500">Blended Equilibrium</span>
        </div>

        {/* Spirit Score */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-purple-300 uppercase font-bold tracking-wider">
            Spirit Score
          </span>
          <span className="font-mono text-2xl font-bold text-purple-300">
            {player.spirit_score.toFixed(1)}
          </span>
          <span className="text-[9px] font-mono text-slate-500">Divination Index</span>
        </div>

        {/* Market VOR */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
            Market VOR
          </span>
          <span className="font-mono text-2xl font-bold text-emerald-400">
            {player.market_vor >= 0 ? `+${player.market_vor.toFixed(1)}` : player.market_vor.toFixed(1)}
          </span>
          <span className="text-[9px] font-mono text-slate-500">Value Over Replacement</span>
        </div>

        {/* Squad Harmony */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-amber-300 uppercase font-bold tracking-wider">
            Squad Harmony
          </span>
          <span className="font-mono text-2xl font-bold text-amber-300">
            {player.harmony_score.toFixed(1)}
          </span>
          <span className="text-[9px] font-mono text-slate-500">Synergy Resonance</span>
        </div>

        {/* Weekly Favorability */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-teal-300 uppercase font-bold tracking-wider">
            Wk Favorability
          </span>
          <span className="font-mono text-2xl font-bold text-teal-300">
            {(player.favorability_score ?? 75).toFixed(0)}
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            {(player.favorability_score ?? 75) >= 84
              ? 'Heavily Favored'
              : (player.favorability_score ?? 75) >= 75
                ? 'Astrally Favored'
                : 'Challenged Transit'}
          </span>
        </div>
      </div>

      {/* "Divine Portent" Arcane Rationale */}
      <div className="mt-4 p-3 rounded-lg bg-purple-950/40 border border-purple-500/30 font-serif italic text-xs text-slate-200 space-y-1">
        <div className="flex items-center gap-1.5 font-mono not-italic text-[10px] uppercase tracking-wider text-purple-300 font-bold">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span>Divine Portent & Arcane Rationale</span>
        </div>
        <p className="leading-relaxed">
          {player.position === 'WR'
            ? `"${player.elemental_traits?.element || 'Celestial'} Trine Receiver — High-ceiling alpha playmaker for ${player.team || 'the squad'}, providing the mystical foundation for elite stack correlation and explosive upside."`
            : player.position === 'QB'
            ? `"Solar Nexus Core — Field general for ${player.team || 'the offense'}, channeling astral momentum to catalyze 3.0x stack resonance across receiving conduits."`
            : player.position === 'RB'
            ? `"${player.elemental_traits?.element || 'Earth'} Grounding Anchor — Volume workhorse for ${player.team || 'the offense'}, fortifying roster foundation with elite replacement equity and baseline consistency."`
            : `"${player.elemental_traits?.element || 'Celestial'} Vanguard — Endowed with auspicious ${player.elemental_traits?.sun_sign || 'planetary'} alignment, elevating squad harmony with dynamic positional value."`}
        </p>
      </div>

      {/* Expandable Divination Dossier Accordion */}
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
            {[
              { label: 'Celestial Transits (30%)', value: breakdown.celestial, color: 'bg-cyan-400' },
              { label: 'Stadium Feng Shui (25%)', value: breakdown.geomantic, color: 'bg-emerald-400' },
              { label: 'Jersey Gematria (20%)', value: breakdown.numeric, color: 'bg-purple-400' },
              { label: 'Squad Alchemy (15%)', value: breakdown.harmony, color: 'bg-amber-400' },
              { label: 'Tarot & Oracular (10%)', value: breakdown.oracular, color: 'bg-rose-400' },
            ].map((tier) => (
              <div key={tier.label} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{tier.label}</span>
                  <span className="text-slate-200 font-bold">{tier.value.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${tier.color} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(0, tier.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default RecommendedPickHero;
