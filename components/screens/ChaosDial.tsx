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

import React, { useState, useMemo } from 'react';
import Astrolabe from '@/components/astrolabe/Astrolabe';
import GlassCard from '@/components/common/GlassCard';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  DIVINATION_PILLARS,
} from '@/lib/scoring';
import { CosmicPlayer, OracleWeights } from '@/types/oneiromancy';
import { oracleScore, starsScore, statsPoints } from '@/lib/oracle';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ExternalLink,
  HelpCircle,
  Orbit,
  Flame,
  Droplet,
  Wind,
  Mountain,
  RotateCcw,
} from 'lucide-react';

export interface ChaosDialProps {
  lambda?: number;
  onLambdaChange?: (lambda: number) => void;
  weights?: OracleWeights;
  onWeightsChange?: (weights: Partial<OracleWeights>) => void;
  players?: CosmicPlayer[];
  className?: string;
  onResetWeights?: () => void;
  /** Inside the Oracle panel: show only weights and the reference guide. */
  embedded?: boolean;
}

export const CHAOS_ZONES = [
  {
    name: 'Analytic Orthodoxy',
    min: 0.0,
    max: 0.2,
    badge: 'bg-cyan-950/60 text-cyan-400 border-cyan-500/40',
    description: 'Baseline football projections lead; stars break ties.',
  },
  {
    name: 'Balanced Oracle',
    min: 0.21,
    max: 0.49,
    badge: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
    description: 'Balanced blend of projected points and astrological alignment.',
  },
  {
    name: 'Mystic Ascendance',
    min: 0.5,
    max: 0.79,
    badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
    description: 'Natal transits and elemental trines outweigh chalk consensus.',
  },
  {
    name: 'Cosmic Bedlam',
    min: 0.8,
    max: 1.0,
    badge: 'bg-rose-950/60 text-rose-400 border-rose-500/40',
    description: 'Pure astrological alignment drives every lineup and waiver call.',
  },
];

export const ChaosDial: React.FC<ChaosDialProps> = ({
  lambda: controlledLambda,
  onLambdaChange,
  weights: controlledWeights,
  onWeightsChange,
  players: propPlayers,
  className = '',
  onResetWeights,
  embedded = false,
}) => {
  const context = useOneiromancy();

  const lambda =
    controlledLambda !== undefined
      ? controlledLambda
      : context.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;

  const weights =
    controlledWeights !== undefined
      ? controlledWeights
      : context.draftState?.settings?.oracle_weights ?? DEFAULT_ORACLE_WEIGHTS;

  const players = propPlayers || context.draftState?.cosmic_board || [];
  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(true);
  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState<boolean>(true);
  const [activeTooltipKey, setActiveTooltipKey] = useState<string | null>(null);

  const activeZone = useMemo(
    () => CHAOS_ZONES.find((z) => lambda >= z.min && lambda <= z.max) || CHAOS_ZONES[1],
    [lambda],
  );

  const samplePlayer =
    context.draftState?.my_roster?.find((s) => s.player)?.player ||
    players[0] || {
      name: "Ja'Marr Chase",
      projected_points: 19.8,
      vor_normalized: 89.2,
      spirit_score: 92.6,
    };
  const sampleStats = statsPoints(samplePlayer as CosmicPlayer);
  const sampleStars = starsScore(samplePlayer as CosmicPlayer);
  const sampleOracle = oracleScore(samplePlayer as CosmicPlayer, lambda);
  const weightTotal = Math.round(
    Object.values(weights || {}).reduce((sum: number, v) => sum + (Number(v) || 0), 0) * 100,
  );

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {!embedded && (
        <>
          <div className="text-center space-y-1">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
              Divination Equilibrium
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto font-sans">
              Tune how baseline football projections (Stats) blend with astrological alignment (Stars).
            </p>
          </div>

          <GlassCard
            variant="gradient"
            glowColor="cyan"
            className="flex flex-col items-center justify-center p-4 relative overflow-hidden"
          >
            <div className="my-2 select-none">
              <Astrolabe
                size={120}
                lambda={lambda}
                speedMultiplier={1 + 3 * lambda}
                className="drop-shadow-[0_0_30px_rgba(6,182,212,0.35)]"
              />
            </div>
            <div className="mt-3 flex flex-col items-center gap-1">
              <span
                className={`px-3 py-1 rounded-full border text-xs font-mono font-bold tracking-wide uppercase ${activeZone.badge}`}
              >
                {activeZone.name}
              </span>
              <p className="text-[11px] text-slate-400 text-center max-w-sm">{activeZone.description}</p>
            </div>
          </GlassCard>

          <GlassCard variant="panel" glowColor="purple" className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Master Chaos Factor (λ)
              </span>
              <span className="font-mono text-base font-bold text-cyan-300 bg-slate-900/90 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
                {lambda.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              aria-label="Master Chaos Factor (lambda)"
              value={lambda}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (onLambdaChange) onLambdaChange(val);
                else if (context.updateChaosLambda) context.updateChaosLambda(val);
              }}
              className="w-full h-2.5 bg-slate-950/80 rounded-full appearance-none cursor-pointer accent-cyan-400 border border-white/10"
            />
            <div className="flex items-center justify-between text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Preview Player</span>
                <span className="text-slate-200 font-bold">{samplePlayer.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-cyan-300">Stats {sampleStats.toFixed(1)}</span>
                <span className="text-emerald-300">Stars {sampleStars.toFixed(0)}</span>
                <span className="text-purple-300 font-bold">Oracle {sampleOracle.toFixed(1)}</span>
              </div>
            </div>
          </GlassCard>
        </>
      )}

      {/* 5 Divination Pillar Weights with Interactive Tooltips */}
      <GlassCard variant="panel" glowColor="gold" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => !embedded && setIsAccordionOpen(!isAccordionOpen)}
            aria-expanded={embedded || isAccordionOpen}
            disabled={embedded}
            className="flex-1 flex items-center justify-between text-left group disabled:cursor-default"
          >
            <div className="space-y-0.5">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                5 Divination Pillar Weights (Spirit)
              </span>
              <p className="text-[11px] text-slate-400">
                Adjust what builds each player&apos;s Spirit and weekly Stars score. Click any (?) icon to see what it measures.
              </p>
            </div>
            {!embedded && (
              <div className="p-1 rounded-md text-slate-400 group-hover:text-slate-200 bg-slate-800/60 border border-white/10">
                {isAccordionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onResetWeights) onResetWeights();
              else if (context.resetOracleWeights) context.resetOracleWeights();
              else if (context.updateOracleWeights) context.updateOracleWeights(DEFAULT_ORACLE_WEIGHTS);
            }}
            data-testid="reset-weights-btn"
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-1 shrink-0"
            title="Reset all 5 pillar weights to defaults"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        {(embedded || isAccordionOpen) && (
          <div className="space-y-3.5 pt-2 border-t border-white/10">
            {DIVINATION_PILLARS.map((tier) => {
              const currentPercent = Math.round((weights[tier.key] ?? tier.defaultVal / 100) * 100);
              const isTooltipOpen = activeTooltipKey === tier.key;

              return (
                <div
                  key={tier.key}
                  data-testid={`weight-pillar-${tier.key}`}
                  className="space-y-1.5 font-mono text-xs p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-100 font-bold">{tier.label}</span>
                        <button
                          type="button"
                          onClick={() => setActiveTooltipKey(isTooltipOpen ? null : tier.key)}
                          aria-label={`Explain ${tier.label}`}
                          data-testid={`pillar-tooltip-btn-${tier.key}`}
                          title={`${tier.whatItMeasures} - ${tier.whyItMatters}`}
                          className="text-slate-400 hover:text-cyan-300 transition-colors"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400 font-sans block">{tier.desc}</span>
                    </div>
                    <span className="font-bold text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                      {currentPercent}%
                    </span>
                  </div>

                  {isTooltipOpen && (
                    <div
                      data-testid={`pillar-tooltip-${tier.key}`}
                      className="p-2.5 rounded-lg bg-slate-900/95 border border-cyan-500/30 text-[11px] font-sans space-y-1 text-slate-200"
                    >
                      <div>
                        <span className="font-mono font-bold text-cyan-300">What it measures: </span>
                        {tier.whatItMeasures}
                      </div>
                      <div>
                        <span className="font-mono font-bold text-purple-300">Why it matters on game day: </span>
                        {tier.whyItMatters}
                      </div>
                    </div>
                  )}

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    aria-label={tier.label}
                    value={currentPercent}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value) / 100;
                      const next = { ...weights, [tier.key]: pct };
                      if (onWeightsChange) onWeightsChange(next);
                      else if (context.updateOracleWeights) context.updateOracleWeights(next);
                    }}
                    className="w-full h-2 bg-slate-800/80 rounded-full appearance-none cursor-pointer accent-amber-400"
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2 border-t border-white/10 font-mono text-xs">
              <span className="text-slate-400">Normalized total:</span>
              <span className="font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                {weightTotal}% → 100%
              </span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Condensed Scannable Astrology & Scoring Encyclopedia */}
      <GlassCard variant="panel" glowColor="purple" className="p-4 sm:p-5 space-y-4">
        <button
          type="button"
          onClick={() => setIsEncyclopediaOpen((prev) => !prev)}
          aria-expanded={isEncyclopediaOpen}
          data-testid="encyclopedia-toggle"
          className="w-full flex items-center justify-between gap-2 border-b border-white/10 pb-3 text-left"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <h3 className="font-serif text-base font-bold text-slate-100">
                Astrology &amp; Divination Field Guide (Encyclopedia)
              </h3>
              <p className="text-[11px] text-slate-400">
                Quick reference for Western Tropical Zodiac signs, Natal Chart Planetary Aspects, and Elemental Triplicities.
              </p>
            </div>
          </div>
          <div className="p-1 rounded-md text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-white/10 shrink-0">
            {isEncyclopediaOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isEncyclopediaOpen && (
          <div className="space-y-4">
            {/* Formula Summary Card (shown only when standalone; OraclePanel already displays the formula above) */}
            {!embedded && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-500/30 font-mono text-xs space-y-1">
                <div className="text-purple-300 font-bold">
                  Oracle = (1 &minus; &lambda;) &times; Stats + &lambda; &times; Stars
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Blends baseline football strength (Stats) with weekly alignment (Stars), powered by the 5-pillar Spirit weights above.
                </p>
              </div>
            )}

        {/* Natal Chart Planetary Aspects - 4 Compact Cards */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Orbit className="w-3.5 h-3.5" /> Natal Chart Planetary Aspects
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-rose-500/20">
              <div className="font-mono font-bold text-rose-300">Mars Aspects (Aggression &amp; Red-Zone Burst)</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Measures explosive red-zone carries, yards after contact, and pass-rush disruption.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-amber-500/20">
              <div className="font-mono font-bold text-amber-300">Saturn Transits (Durability &amp; Snap Share)</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tracks snap-count reliability, pass protection, and four-quarter workload resilience.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-sky-500/20">
              <div className="font-mono font-bold text-sky-300">Mercury Retrogrades (Route Timing &amp; Turnovers)</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Flags audible miscommunications, broken option routes, and turnover volatility.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-emerald-500/20">
              <div className="font-mono font-bold text-emerald-300">Jupiter Alignments (Ceiling &amp; Big Plays)</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Amplifies multi-touchdown ceiling games and deep-ball connection probability.
              </p>
            </div>
          </div>
        </div>

        {/* Elemental Triplicities in Gridiron Divination */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-purple-300">
            Elemental Triplicities in Gridiron Divination
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/25">
              <span className="font-mono font-bold text-rose-300 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Fire
              </span>
              <span className="text-slate-400 block text-[10px]">Aries · Leo · Sagittarius - Deep-threat ceiling</span>
            </div>
            <div className="p-2 rounded-lg bg-teal-950/20 border border-teal-500/25">
              <span className="font-mono font-bold text-teal-300 flex items-center gap-1">
                <Mountain className="w-3 h-3" /> Earth
              </span>
              <span className="text-slate-400 block text-[10px]">Taurus · Virgo · Capricorn - High-volume floor</span>
            </div>
            <div className="p-2 rounded-lg bg-sky-950/20 border border-sky-500/25">
              <span className="font-mono font-bold text-sky-300 flex items-center gap-1">
                <Wind className="w-3 h-3" /> Air
              </span>
              <span className="text-slate-400 block text-[10px]">Gemini · Libra · Aquarius - Tempo &amp; route precision</span>
            </div>
            <div className="p-2 rounded-lg bg-blue-950/20 border border-blue-500/25">
              <span className="font-mono font-bold text-blue-300 flex items-center gap-1">
                <Droplet className="w-3 h-3" /> Water
              </span>
              <span className="text-slate-400 block text-[10px]">Cancer · Scorpio · Pisces - YAC &amp; open-field flow</span>
            </div>
          </div>
        </div>

        {/* External Reference Links */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap gap-3 text-[11px] font-mono">
          <a
            href="https://en.wikipedia.org/wiki/Astrological_aspect"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
          >
            <span>Astrological Aspects</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://www.astro.com/astrology/in_sports_e.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline flex items-center gap-1"
          >
            <span>Sports Astrology</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://ssd.jpl.nasa.gov/horizons/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300 hover:text-amber-200 underline flex items-center gap-1"
          >
            <span>NASA JPL Ephemeris</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default ChaosDial;
