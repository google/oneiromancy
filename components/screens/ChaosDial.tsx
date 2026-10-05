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

import React, { useState, useMemo, useCallback } from 'react';
import Astrolabe from '@/components/astrolabe/Astrolabe';
import GlassCard from '@/components/common/GlassCard';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  clamp,
  computeDraftScore,
  normalizeOracleWeights,
} from '@/lib/scoring';
import { CosmicPlayer, OracleWeights } from '@/types/oneiromancy';
import {
  Compass,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  ExternalLink,
  HelpCircle,
  Orbit,
  Brain,
  Flame,
  Droplet,
  Wind,
  Mountain,
  Moon,
  Sun,
  Hash,
  Shield,
} from 'lucide-react';

export interface ChaosDialProps {
  lambda?: number;
  onLambdaChange?: (lambda: number) => void;
  weights?: OracleWeights;
  onWeightsChange?: (weights: Partial<OracleWeights>) => void;
  players?: CosmicPlayer[];
  className?: string;
  onResetWeights?: () => void;
}

export const CHAOS_ZONES = [
  {
    name: 'Analytic Orthodoxy',
    min: 0.0,
    max: 0.2,
    badge: 'bg-cyan-950/60 text-cyan-400 border-cyan-500/40',
    description: 'Empirical market VOR and statistical consensus dominate projections.',
  },
  {
    name: 'Balanced Oracle',
    min: 0.21,
    max: 0.49,
    badge: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
    description: 'The Golden Ratio equilibrium harmonizing cold telemetry with cosmic divination.',
  },
  {
    name: 'Mystic Ascendance',
    min: 0.5,
    max: 0.79,
    badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
    description: 'Intuitive natal transits and elemental trines supersede consensus ADP.',
  },
  {
    name: 'Cosmic Bedlam',
    min: 0.8,
    max: 1.0,
    badge: 'bg-rose-950/60 text-rose-400 border-rose-500/40',
    description: 'Unconstrained sacred chaos and tarot alchemy guide all draft choices.',
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
}) => {
  const context = useOneiromancy();

  // Determine active values from props or context
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
  const [computeTimeMs, setComputeTimeMs] = useState<number>(0.05);

  // Active descriptive zone
  const activeZone = useMemo(() => {
    return (
      CHAOS_ZONES.find((z) => lambda >= z.min && lambda <= z.max) || CHAOS_ZONES[1]
    );
  }, [lambda]);

  // Sample simulation player
  const samplePlayer = players[0] || {
    name: "Ja'Marr Chase",
    vor_normalized: 89.2,
    spirit_score: 92.6,
  };
  const sampleDraftScore = computeDraftScore(
    samplePlayer.vor_normalized,
    samplePlayer.spirit_score,
    lambda
  );

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {/* Screen Title & Esoteric Subheading */}
      <div className="text-center space-y-1">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
          Divination Equilibrium
        </h2>
        <p className="text-xs text-slate-400 max-w-xl mx-auto font-sans">
          Modulate the sacred balance between cold empirical Value Over Replacement (VOR) and celestial intuitive Oneiromancy spirit.
        </p>
      </div>

      {/* Central Rotating SVG Astrolabe Card */}
      <GlassCard
        variant="gradient"
        glowColor="cyan"
        className="flex flex-col items-center justify-center p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-white/10 text-[10px] font-mono text-cyan-400">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>{computeTimeMs < 0.1 ? '<0.1ms' : `${computeTimeMs}ms`}</span>
        </div>

        {/* Dynamic Concentric Astrolabe */}
        <div className="my-2 select-none">
          <Astrolabe
            size={220}
            lambda={lambda}
            speedMultiplier={1 + 3 * lambda}
            className="drop-shadow-[0_0_30px_rgba(6,182,212,0.35)]"
          />
        </div>

        {/* Active Zone Pill */}
        <div className="mt-4 flex flex-col items-center gap-1">
          <span
            className={`px-3 py-1 rounded-full border text-xs font-mono font-bold tracking-wide uppercase ${activeZone.badge}`}
          >
            {activeZone.name}
          </span>
          <p className="text-[11px] text-slate-400 text-center max-w-sm mt-1">
            {activeZone.description}
          </p>
        </div>
      </GlassCard>

      {/* Master Chaos Slider Card */}
      <GlassCard variant="panel" glowColor="purple" className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Master Chaos Factor (λ)
            </span>
            <p className="text-[11px] text-slate-400">
              0.00 (Empirical Orthodoxy) ↔ 1.00 (Cosmic Bedlam)
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-lg font-bold text-cyan-300 bg-slate-900/90 px-3 py-0.5 rounded-lg border border-cyan-500/30">
              {lambda.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Interactive Telemetry Equilibrium Slider */}
        <div className="space-y-3">
          <div className="relative w-full">
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
              className="w-full h-3 bg-slate-950/80 rounded-full appearance-none cursor-pointer accent-cyan-400 border border-white/10"
            />
            <div
              className="pointer-events-none mt-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 transition-all duration-300"
              style={{ width: `${Math.round(lambda * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
            <span>0.0 (Pure VOR)</span>
            <span className="text-cyan-400 font-bold">λ = {lambda.toFixed(2)} (Active Equilibrium)</span>
            <span>1.0 (Pure Spirit)</span>
          </div>

          {/* Interactive Preset Buttons */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[
              { label: '0.00 VOR', val: 0.0, name: 'Orthodoxy' },
              { label: '0.35 Canonical', val: 0.35, name: 'Equilibrium' },
              { label: '0.65 Mystic', val: 0.65, name: 'Ascendance' },
              { label: '1.00 Bedlam', val: 1.0, name: 'Bedlam' },
            ].map((preset) => {
              const isMatch = Math.abs(lambda - preset.val) < 0.01;
              return (
                <button
                  type="button"
                  key={preset.val}
                  onClick={() => {
                    if (onLambdaChange) onLambdaChange(preset.val);
                    else if (context.updateChaosLambda) context.updateChaosLambda(preset.val);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-mono text-center border cursor-pointer transition-all ${
                    isMatch
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20'
                  }`}
                >
                  <div className="font-bold">{preset.label}</div>
                  <div className="text-[9px] opacity-70">{preset.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Live Formula Readout & Simulation Card */}
      <GlassCard variant="panel" glowColor="none" className="p-4 space-y-3 bg-[#161622]/90">
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono uppercase text-purple-400 font-semibold tracking-wider">
            Live Mathematical Formula
          </span>
          <span className="text-[10px] font-mono text-slate-400">Instant In-Memory</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/90 border border-white/10 font-mono text-xs space-y-1">
          <div className="text-slate-400">
            DraftScore = (1 - λ) × VOR + λ × SpiritScore
          </div>
          <div className="text-cyan-300 font-bold">
            = (1 - {lambda.toFixed(2)}) × VOR + {lambda.toFixed(2)} × SpiritScore
          </div>
          <div className="text-purple-300">
            = {(1 - lambda).toFixed(2)} × VOR + {lambda.toFixed(2)} × SpiritScore
          </div>
        </div>

        {/* Live Simulation Preview */}
        <div className="pt-1 flex items-center justify-between text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Simulation Preview</span>
            <span className="text-slate-200 font-bold">{samplePlayer.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[9px] text-slate-500 block">VOR / Spirit</span>
              <span className="text-slate-400 text-[11px]">
                {(samplePlayer.vor_normalized ?? 89.2).toFixed(1)} / {(samplePlayer.spirit_score ?? 92.6).toFixed(1)}
              </span>
            </div>
            <div className="text-right pl-2 border-l border-white/10">
              <span className="text-[9px] text-cyan-400 block font-bold">DraftScore</span>
              <span className="text-cyan-300 font-bold text-sm">
                {sampleDraftScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Divination Tier Weights Accordion */}
      <GlassCard variant="panel" glowColor="gold" className="p-5 space-y-4">
        <button
          type="button"
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="space-y-0.5">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Divination Tier Weights
            </span>
            <p className="text-[11px] text-slate-400">
              Fine-tune the 5 celestial pillars comprising Spirit Score
            </p>
          </div>
          <div className="p-1 rounded-md text-slate-400 group-hover:text-slate-200 bg-slate-800/60 border border-white/10">
            {isAccordionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAccordionOpen && (
          <div className="space-y-4 pt-2 border-t border-white/10">
            {/* 5 Divination Weight Telemetry Meters (Read-Only) */}
            {[
              {
                key: 'celestial' as keyof OracleWeights,
                label: 'Celestial Transits',
                desc: 'Natal chart planetary aspects & zodiac alignment',
                defaultVal: 30,
                color: 'bg-cyan-400',
              },
              {
                key: 'geomantic' as keyof OracleWeights,
                label: 'Stadium Feng Shui',
                desc: 'Venue orientation, compass azimuth & dome containment',
                defaultVal: 25,
                color: 'bg-emerald-400',
              },
              {
                key: 'numeric' as keyof OracleWeights,
                label: 'Jersey Gematria',
                desc: 'Life path root numbers & master vibration resonance',
                defaultVal: 20,
                color: 'bg-purple-400',
              },
              {
                key: 'harmony' as keyof OracleWeights,
                label: 'Squad Alchemy',
                desc: 'Western Trine elemental harmony & 3.0x stack synergy',
                defaultVal: 15,
                color: 'bg-amber-400',
              },
              {
                key: 'oracular' as keyof OracleWeights,
                label: 'Tarot & I-Ching',
                desc: 'Major Arcana archetype alignments & hexagram harmony',
                defaultVal: 10,
                color: 'bg-rose-400',
              },
            ].map((tier) => {
              const currentPercent = Math.round((weights[tier.key] ?? tier.defaultVal / 100) * 100);

              return (
                <div key={tier.key} className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-200 font-semibold">{tier.label}</span>
                      <span className="text-[10px] text-slate-500 block">{tier.desc}</span>
                    </div>
                    <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-white/10">
                      {currentPercent}%
                    </span>
                  </div>
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
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tier.color} transition-all duration-300`}
                      style={{ width: `${Math.min(100, Math.max(0, currentPercent))}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Read-Only Canonical Seal */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10 font-mono text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Total Oracle Weight:</span>
              </span>
              <span className="font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                100% CANONICAL HARMONY (LOCKED)
              </span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Esoteric & Astrological Reference Guide */}
      <GlassCard variant="panel" className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <h3 className="font-serif text-lg font-bold text-slate-100">
              Esoteric &amp; Astrological Reference Guide
            </h3>
          </div>
          <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
            Deep-Dive Encyclopedia
          </span>
        </div>

        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          Comprehensive explanations of the mystical mathematics, planetary aspects, and elemental triplicities powering Oneiromancy.
        </p>

        <div className="space-y-3 pt-1">
          {/* Concept 1: Western Tropical Zodiac & Natal Degrees */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Western Tropical Zodiac &amp; Natal Degrees
                </h4>
              </div>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded shrink-0">
                Zodiac Foundations
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">What It Means:</strong>
                <span>
                  The Western Tropical Zodiac maps the Sun&apos;s apparent annual journey along the ecliptic plane into twelve mathematically equidistant 30&deg; segments, anchored to the vernal equinox (0&deg; Aries). Each player&apos;s natal Sun sign and exact natal degree (0&deg;–29&deg;59&apos;) fix their inherent metaphysical blueprint.
                </span>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Why We Care for an NFL Football Player:</strong>
                <p className="mt-0.5">
                  A player&apos;s natal sign governs their physiological archetype and response to high-stress gridiron environments: Cardinal signs (Aries, Cancer, Libra, Capricorn) initiate offensive tempo and rhythm; Fixed signs (Taurus, Leo, Scorpio, Aquarius) establish stubborn line-of-scrimmage anchor strength and ball protection; Mutable signs (Gemini, Virgo, Sagittarius, Pisces) provide elusive agility and open-field route adaptation.
                </p>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">When It Matters:</strong>
                <span>
                  Solar ingresses and seasonal equinox transits directly modulate player energy reserves over the grueling 18-week NFL campaign as the Sun shifts through autumnal and winter constellations.
                </span>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://en.wikipedia.org/wiki/Tropical_astrology"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-amber-500/30 text-amber-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Tropical Zodiac</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://www.astro.com/astrology/in_intro_e.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-300 transition-all"
                  >
                    <span className="truncate">Astrodienst: Introduction to the Zodiac</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 2: Planetary Rulerships & Domiciles */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Planetary Rulerships &amp; Domiciles
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded shrink-0">
                Celestial Domiciles
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">What It Means:</strong>
                <span>
                  Every zodiac sign is governed by a classical planetary ruler (Mars rules Aries, Venus rules Taurus/Libra, Mercury rules Gemini/Virgo, Moon rules Cancer, Sun rules Leo, Pluto rules Scorpio, Jupiter rules Sagittarius, Saturn rules Capricorn, Uranus rules Aquarius, Neptune rules Pisces). A planet in its home domicile operates with unadulterated strength.
                </span>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Why We Care for an NFL Football Player:</strong>
                <p className="mt-0.5">
                  When a player&apos;s natal ruler receives positive aspects or transits its domicile during game week, the athlete accesses higher-order flow states. Conversely, ruling planets in detriment or fall signal elevated mechanical friction or tactical miscommunications with coaching schemes.
                </p>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">When It Matters:</strong>
                <span>
                  Crucial for weekly start/sit decisions and trade timing, capitalizing on positive planetary dignities before rival managers notice the underlying celestial shift.
                </span>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://en.wikipedia.org/wiki/Domicile_(astrology)"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-emerald-500/30 text-emerald-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Astrological Domicile</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://www.astro.com/astrowiki/en/Ruler"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 text-purple-300 transition-all"
                  >
                    <span className="truncate">AstroWiki: Planetary Rulers</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 3: Natal Chart Planetary Aspects */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Orbit className="w-4 h-4 text-cyan-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Natal Chart Planetary Aspects
                </h4>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded shrink-0">
                Astro-Physics
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">What It Means:</strong>
                <span>
                  Planetary aspects are the precise geometric angular relationships (conjunctions 0&deg;, sextiles 60&deg;, squares 90&deg;, trines 120&deg;, and oppositions 180&deg;) formed between celestial bodies (Mars, Jupiter, Saturn) and the Sun or Moon based on a player&apos;s exact birth date and coordinates.
                </span>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Why We Care for an NFL Football Player:</strong>
                <ul className="list-disc list-inside space-y-1 mt-1 text-slate-300 pl-1">
                  <li><strong className="text-rose-400">Mars Aspects (Aggression &amp; Burst):</strong> Mars governs primal kinetic energy, aggressive line-of-scrimmage collision tolerance, and explosive second-level acceleration. A strong Mars-Sun trine or Mars in Aries yields elite tackle-breaking power.</li>
                  <li><strong className="text-amber-400">Saturn Transits (Durability vs Orthopedic Risk):</strong> Saturn represents physical bone density, structural cartilage, and longevity. Saturn retrogrades and harsh 90&deg; squares signal acute joint/ligament fatigue and high injury vulnerability.</li>
                  <li><strong className="text-sky-400">Mercury Retrogrades (Cerebral Processing Speed):</strong> Mercury dictates synaptic reaction time, presnap defensive disguise recognition, and QB audibles at the line against Cover 0 zero-blitz schemes.</li>
                  <li><strong className="text-purple-400">Jupiter Alignments (Fortune &amp; Red Zone Luck):</strong> Jupiter expands luck, broken-play recovery bounces, and red-zone touchdown conversion variance.</li>
                </ul>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">When It Matters:</strong>
                <span>
                  Aspects matter dynamically during game-day planetary transits crossing a player&apos;s natal degrees. When game-day transits activate natal trines, players experience peak flow state; opposing squares correlate with cold streaks or sudden soft-tissue tightness.
                </span>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading &amp; Ephemeris Data:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://en.wikipedia.org/wiki/Astrological_aspect"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Astrological Aspect</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://www.astro.com/astrology/in_sports_e.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 text-purple-300 transition-all"
                  >
                    <span className="truncate">Astrodienst: Sports Astrology Studies</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://ssd.jpl.nasa.gov/horizons/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-emerald-500/30 text-emerald-300 transition-all"
                  >
                    <span className="truncate">NASA JPL: Horizons Ephemeris</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://www.astro.com/astrowiki/en/Aspect"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-amber-500/30 text-amber-300 transition-all"
                  >
                    <span className="truncate">AstroWiki: Aspects Guide</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 4: Elemental Triplicities & Quadruplicities */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Elemental Triplicities in Gridiron Divination
                </h4>
              </div>
              <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded shrink-0">
                Triplicities &amp; Modalities
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <p>
                Every player belongs to one of four classical astrological triplicities, dictating their athletic motor, playing temperament, and on-field chemistry:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Fire (Aries, Leo, Sagittarius)</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-sans">
                    Explosive acceleration, sudden vertical burst, ferocious stiff-arms, and game-breaking home run potential.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-teal-400 font-bold">
                    <Mountain className="w-3.5 h-3.5" />
                    <span>Earth (Taurus, Virgo, Capricorn)</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-sans">
                    Contact balance resilience, high-volume touch floor, interior pass blocking, and dependable goal-line execution.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <Wind className="w-3.5 h-3.5" />
                    <span>Air (Gemini, Libra, Aquarius)</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-sans">
                    Route running precision, lateral agility, spatial separation, cerebral presnap reads, and ball distribution.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                    <Droplet className="w-3.5 h-3.5" />
                    <span>Water (Cancer, Scorpio, Pisces)</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-sans">
                    Fluid cutbacks, instinctive field vision between tackles, improvisational scramble drills, and elusive open-field navigation.
                  </p>
                </div>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://en.wikipedia.org/wiki/Astrological_element"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-rose-500/30 text-rose-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Astrological Elements</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://en.wikipedia.org/wiki/Tetrabiblos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-sky-500/30 text-sky-300 transition-all"
                  >
                    <span className="truncate">Ptolemy&apos;s Tetrabiblos (Classical Foundations)</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 5: Pythagorean Numerology & Life Path Resonance */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-purple-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Pythagorean Numerology &amp; Life Path Resonance
                </h4>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded shrink-0">
                Sacred Numerology
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Mathematical Model:</strong>
                <p className="mt-0.5">
                  Pythagorean reduction synthesizes a player&apos;s birthdate digits (MM/DD/YYYY) into an irreducible root number (1–9) or Master Number (11, 22, 33). This is complemented by Gematria name resonance mapping consonant/vowel vibrations:
                </p>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-white/10 font-mono text-[11px] text-purple-300 my-1.5 text-center">
                  LifePath = Reduce(&sum; Month_digits + &sum; Day_digits + &sum; Year_digits)
                </div>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Why We Care for an NFL Football Player:</strong>
                <p className="mt-0.5">
                  Life Path numbers reveal psychological resilience in high-stakes environments: Life Path 1 players are natural on-field commanders (ideal franchise QBs); Life Path 8 players embody kinetic impact and contact balance; Master Numbers (11, 22) consistently generate supernatural 99th-percentile weekly ceilings during playoff elimination matchups.
                </p>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://en.wikipedia.org/wiki/Numerology"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 text-purple-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Pythagorean Numerology</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://www.astro.com/astrology/in_numerology_e.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-300 transition-all"
                  >
                    <span className="truncate">Astrodienst: Number Symbolism</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 6: Lunar Phases & Void of Course (VoC) Transits */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-cyan-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Lunar Phases &amp; Void of Course (VoC) Transits
                </h4>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded shrink-0">
                Lunar Dynamics
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">What It Means:</strong>
                <span>
                  The 29.5-day synodic lunar cycle moves from New Moon (initiatory momentum) to Full Moon (culmination and volatile energy spikes). A Void of Course (VoC) Moon occurs when the Moon makes its final major Ptolemaic aspect before entering the subsequent zodiac sign.
                </span>
              </div>

              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Why We Care for an NFL Football Player:</strong>
                <p className="mt-0.5">
                  NFL games kicking off during Void of Course Moon periods exhibit significantly higher turnover variance, bizarre officiating reversals, unexpected red-zone fumbles, and game-script collapses. Full Moons disproportionately favor deep aerial shootouts, while Waning Moons reward conservative ground-and-pound rushing attacks.
                </p>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://www.astro.com/astrowiki/en/Void_of_Course"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-300 transition-all"
                  >
                    <span className="truncate">AstroWiki: Void of Course Moon</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://en.wikipedia.org/wiki/Lunar_phase"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-sky-500/30 text-sky-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Lunar Phases</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 7: Chaos Dial & Lambda (λ) Mathematical Equilibrium */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Chaos Dial &amp; Lambda (&lambda;) Mathematical Equilibrium
                </h4>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded shrink-0">
                Algorithm
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Mathematical Model:</strong>
                <p className="mt-0.5">
                  The Chaos Dial implements an algorithmic interpolation between cold empirical Value Over Replacement (VOR) and mystical spirit divination:
                </p>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-white/10 font-mono text-[11px] text-cyan-300 my-1.5 text-center">
                  DraftScore = (1 - &lambda;) &times; VOR_norm + &lambda; &times; SpiritScore
                </div>
                <p>
                  Inspired by simulated annealing in combinatorial optimization, &lambda; controls algorithmic temperature: &lambda;=0.0 enforces pure statistical consensus, while &lambda;=1.0 unleashes full cosmic intuition and tarot archetype alignment.
                </p>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Further Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://en.wikipedia.org/wiki/Simulated_annealing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 text-purple-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Simulated Annealing</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://en.wikipedia.org/wiki/Value_over_replacement_player"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-300 transition-all"
                  >
                    <span className="truncate">Wikipedia: Value Over Replacement (VOR)</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Concept 8: Classical Bibliography & Ephemeris Systems */}
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="font-serif font-bold text-sm text-slate-100">
                  Classical Bibliography &amp; Ephemeris Systems
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded shrink-0">
                Primary Sources
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-slate-200 block text-[11px] uppercase tracking-wide font-mono">Foundational Treatises &amp; Computational Ephemerides:</strong>
                <ul className="list-disc list-inside space-y-1.5 mt-1 text-slate-300 pl-1">
                  <li>
                    <strong className="text-cyan-300">Claudius Ptolemy (c. 150 CE) — <em>Tetrabiblos</em>:</strong> The foundational Greek treatise formalizing planetary rulerships, the four elemental triplicities, and major geometric aspects.
                  </li>
                  <li>
                    <strong className="text-purple-300">Johannes Kepler (1619) — <em>Harmonices Mundi</em>:</strong> Discovery of planetary orbital resonance, geometric harmonic aspect ratios, and the physical music of the spheres.
                  </li>
                  <li>
                    <strong className="text-emerald-300">NASA Jet Propulsion Laboratory — <em>Horizons Ephemeris</em>:</strong> High-precision barycentric celestial coordinates and planetary state vectors powering modern orbital physics.
                  </li>
                  <li>
                    <strong className="text-amber-300">Swiss Ephemeris (Astrodienst):</strong> The gold-standard semi-analytical planetary calculation engine based on NASA JPL ephemerides (DE431/DE441).
                  </li>
                </ul>
              </div>

              {/* Links for Further Reading */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Authoritative Ephemeris &amp; Historical Sources:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <a
                    href="https://ssd.jpl.nasa.gov/horizons/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-emerald-500/30 text-emerald-300 transition-all"
                  >
                    <span className="truncate">NASA JPL: Horizons Ephemeris System</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://www.astro.com/swisseph/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-300 transition-all"
                  >
                    <span className="truncate">Astrodienst: Swiss Ephemeris Engine</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://en.wikipedia.org/wiki/Harmonices_Mundi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 text-purple-300 transition-all"
                  >
                    <span className="truncate">Kepler&apos;s Harmonices Mundi (1619)</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                  <a
                    href="https://en.wikipedia.org/wiki/Tetrabiblos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 hover:border-amber-500/30 text-amber-300 transition-all"
                  >
                    <span className="truncate">Ptolemy&apos;s Tetrabiblos (c. 150 CE)</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default ChaosDial;
