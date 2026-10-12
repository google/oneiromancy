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

import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import AscensionTimeline from '@/components/oneiromancy/AscensionTimeline';
import CelestialLeaderboardGraph from '@/components/oneiromancy/CelestialLeaderboardGraph';
import TelemetryBar from '@/components/oneiromancy/TelemetryBar';
import {useOneiromancy} from '@/context/OneiromancyContext';
import {
  mockCompetitorTeams,
  mockWeeklyMatchup,
} from '@/lib/mockData';
import {deriveWeeklyMatchup, getSeasonContext} from '@/lib/sleeper';
import WeeklyMoves from '@/components/oneiromancy/WeeklyMoves';
import MatchupsScreen from '@/components/screens/MatchupsScreen';
import {TONE_PILL, elementRelation, favorabilityTone, starsScore, statsPoints} from '@/lib/oracle';
import {
  calculateTeamCelestialMetrics,
  classifySpiritScoreTier,
  computeRosterHarmony,
} from '@/lib/scoring';
import {
  CompetitorTeam,
  CosmicPlayer,
  DraftPickState,
  IdealDraftPick,
  RosterSlot,
  WeeklyMatchup,
} from '@/types/oneiromancy';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Flame,
  Info,
  Shield,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import React, {useMemo, useState} from 'react';

export interface OneiromancyDashboardProps {
  recommendedPick?: CosmicPlayer | null;
  ascensionPath?: IdealDraftPick[];
  myRoster?: RosterSlot[];
  currentPick?: DraftPickState;
  onDraftPlayer?: (playerId: string) => void;
  onInspectPlayer?: (player: CosmicPlayer) => void;
  className?: string;
}

export const OneiromancyDashboard: React.FC<OneiromancyDashboardProps> = ({
  recommendedPick: propRecommendedPick,
  ascensionPath: propAscensionPath,
  myRoster: propMyRoster,
  currentPick: propCurrentPick,
  onDraftPlayer: _propOnDraftPlayer,
  onInspectPlayer: propOnInspectPlayer,
  className = '',
}) => {
  // Consume global context
  const context = useOneiromancy();

  const draftState = context.draftState;
  const cosmicBoard = useMemo(
    () => draftState?.cosmic_board || [],
    [draftState?.cosmic_board],
  );
  const currentPick = propCurrentPick || draftState?.current_pick;
  const myRoster = useMemo(
    () => propMyRoster || draftState?.my_roster || [],
    [propMyRoster, draftState?.my_roster],
  );
  const ascensionPath = useMemo(
    () => propAscensionPath || draftState?.ideal_draft_path || [],
    [propAscensionPath, draftState?.ideal_draft_path],
  );
  const weeklyCoverage = useMemo(
    () => draftState?.weekly_coverage || [],
    [draftState?.weekly_coverage],
  );

  // Weekly matchup and start/sit divination (defaults to next/active upcoming match)
  const weeklyMatchup = useMemo<WeeklyMatchup | null>(() => {
    let rawMatchup = draftState?.weekly_matchup;
    if (!rawMatchup && draftState?.competitor_teams && draftState.competitor_teams.length > 0) {
      const activeSlot = draftState.settings?.user_slot || 1;
      const activeUserTeam = draftState.competitor_teams.find((t) => t.is_user);
      const activeRosterId = activeUserTeam?.roster_id ?? activeSlot;
      rawMatchup = deriveWeeklyMatchup(
        activeRosterId,
        draftState.competitor_teams,
        null,
        draftState.cosmic_board,
        draftState.my_roster,
        1,
      );
    }
    if (!rawMatchup) {
      return draftState?.isLive ? null : mockWeeklyMatchup;
    }
    return rawMatchup;
  }, [
    draftState?.weekly_matchup,
    draftState?.competitor_teams,
    draftState?.cosmic_board,
    draftState?.my_roster,
    draftState?.settings?.user_slot,
    draftState?.isLive,
  ]);

  // Compute roster telemetry
  const rosteredPlayers = useMemo(() => {
    return myRoster
      .map((slot) => slot.player)
      .filter((p): p is CosmicPlayer => p !== null && p !== undefined);
  }, [myRoster]);

  const startingPlayers = useMemo(() => {
    return myRoster
      .filter(
        (slot) =>
          !slot.slot_id.startsWith('BN') &&
          slot.player !== null &&
          slot.player !== undefined,
      )
      .map((slot) => slot.player as CosmicPlayer);
  }, [myRoster]);

  const totalProjectedPoints = useMemo(() => {
    if (startingPlayers.length === 0) {
      if (weeklyMatchup?.user_team?.projected_points) {
        return weeklyMatchup.user_team.projected_points;
      }
      return 0;
    }
    return startingPlayers.reduce(
      (sum, p) => sum + (p.projected_points || 0),
      0,
    );
  }, [startingPlayers, weeklyMatchup?.user_team?.projected_points]);

  const totalVOR = useMemo(() => {
    if (rosteredPlayers.length === 0) return 0;
    return rosteredPlayers.reduce((sum, p) => sum + (p.market_vor || 0), 0);
  }, [rosteredPlayers]);

  // Elemental traits
  const elementalDistribution = useMemo(() => {
    if (draftState?.elemental_traits) return draftState.elemental_traits;
    const dist = {Fire: 0, Earth: 0, Air: 0, Water: 0};
    for (const p of rosteredPlayers) {
      if (p.elemental_traits?.element) {
        dist[p.elemental_traits.element] =
          (dist[p.elemental_traits.element] || 0) + 1;
      }
    }
    return dist;
  }, [draftState?.elemental_traits, rosteredPlayers]);

  // Active celestial aspects and harmonic conjunctions
  // Element readings from this roster's starters (not fixed text).
  const elementReadings = useMemo(() => {
    const el = (p: CosmicPlayer) => p.elemental_traits?.element;
    const qb = startingPlayers.find((p) => p.position === 'QB');
    const catchers = startingPlayers.filter((p) => p.position === 'WR' || p.position === 'TE');
    const groups: Record<string, string[]> = { Complementary: [], 'Same element': [], Opposed: [] };
    if (qb) {
      for (const c of catchers) {
        const r = elementRelation(el(qb), el(c));
        if (r in groups) groups[r].push(`${c.name} (${el(c)})`);
      }
    }
    const airTargets = qb && el(qb) === 'Fire' ? catchers.filter((c) => el(c) === 'Air') : [];
    const earthBacks = startingPlayers.filter((p) => p.position === 'RB' && el(p) === 'Earth');
    const counts: Record<string, number> = {};
    for (const p of startingPlayers) {
      const e = el(p);
      if (e) counts[e] = (counts[e] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([e]) => e);
    const rel = top.length >= 2 ? elementRelation(top[0] as any, top[1] as any) : null;
    const aspect =
      top.length < 2
        ? { angle: 0, name: 'Conjunction' }
        : rel === 'Complementary'
          ? { angle: 60, name: 'Sextile' }
          : { angle: 90, name: 'Square' };
    return { qb, qbElement: qb ? el(qb) : undefined, groups, airTargets, earthBacks, top: top.slice(0, 2), rel, aspect };
  }, [startingPlayers]);

  // Starters only, like the Squad Harmony score these stacks add to.
  const activeAspects = useMemo(() => {
    const aspects = [];
    const qbs = startingPlayers.filter((p) => p.position === 'QB');
    for (const qb of qbs) {
      const passCatchers = startingPlayers.filter(
        (p) =>
          (p.position === 'WR' || p.position === 'TE') && p.team === qb.team,
      );
      if (passCatchers.length > 0) {
        aspects.push({
          team: qb.team,
          multiplier: 3.0,
          bonus_points: passCatchers.length >= 2 ? 27.0 : 18.0,
          description: `${qb.team} 3.0x Astral Conjunction ${qb.name} ☌ ${passCatchers.map((pc) => pc.name).join(' & ')}`,
          qb_name: qb.name,
          pass_catcher_names: passCatchers.map((pc) => pc.name),
        });
      }
    }
    return aspects;
  }, [startingPlayers]);

  // Competitor teams compilation with authentic Sleeper team names
  const competitorTeams = useMemo<CompetitorTeam[]>(() => {
    if (
      draftState?.competitor_teams &&
      draftState.competitor_teams.length > 0
    ) {
      return draftState.competitor_teams;
    }
    return draftState?.isLive ? [] : mockCompetitorTeams;
  }, [draftState?.competitor_teams, draftState?.isLive]);

  // Strict single-user resolution: exactly one team can be 'isUser'
  const userTeam = useMemo(() => {
    return (
      competitorTeams.find((t) => t.is_user === true) ||
      competitorTeams.find((t) => t.name.includes('(You)')) ||
      competitorTeams.find(
        (t) => t.slot === (draftState?.settings?.user_slot || 7),
      ) ||
      competitorTeams[0]
    );
  }, [competitorTeams, draftState?.settings?.user_slot]);

  // Active user slot number
  const userSlot = useMemo(() => {
    return userTeam
      ? userTeam.slot || userTeam.roster_id
      : draftState?.settings?.user_slot || 7;
  }, [userTeam, draftState?.settings?.user_slot]);

  // Harmony score calculation (0-100), synchronized directly with the user team's authentic harmony_score
  const harmonyScore = useMemo(() => {
    if (
      userTeam?.harmony_score !== undefined &&
      userTeam.harmony_score !== null
    ) {
      return Math.round(userTeam.harmony_score);
    }
    if (rosteredPlayers.length > 0) {
      return Math.round(computeRosterHarmony(rosteredPlayers));
    }
    return 75;
  }, [userTeam?.harmony_score, rosteredPlayers]);

  // Minimized Ascension Path toggle state (collapses by default when draft is inactive/complete)
  const isDraftComplete = useMemo(() => {
    return (
      draftState?.status === 'complete' ||
      rosteredPlayers.length >= 15 ||
      ascensionPath.every((s) => s.is_ascended)
    );
  }, [draftState?.status, rosteredPlayers.length, ascensionPath]);

  const [isHarmonyOpen, setIsHarmonyOpen] = useState(false);
  const remainingCoverage = useMemo(() => {
    const season = getSeasonContext();
    if (!season) return weeklyCoverage;
    return weeklyCoverage.filter(
      (w) => w.week >= season.currentWeek && w.week <= season.lastRegularWeek,
    );
  }, [weeklyCoverage]);
  const [isAscensionExpanded, setIsAscensionExpanded] =
    useState<boolean>(!isDraftComplete);

  const handleInspect = (player: CosmicPlayer) => {
    if (propOnInspectPlayer) {
      propOnInspectPlayer(player);
    } else {
      context.selectPlayer(player);
    }
  };

  const handleInspectById = (playerId: string) => {
    const found = cosmicBoard.find((p) => p.id === playerId);
    if (found) {
      handleInspect(found);
    }
  };

  // Radar chart dynamic coordinates (5 axes: Fire, Air, Water, Earth, Celestial Aspect Resonance)
  const radarPoints = useMemo(() => {
    const cx = 110;
    const cy = 110;
    const maxR = 75;

    const fireNorm = Math.min(
      1,
      Math.max(0.3, (elementalDistribution.Fire || 1) / 3),
    );
    const airNorm = Math.min(
      1,
      Math.max(0.3, (elementalDistribution.Air || 1) / 3),
    );
    const waterNorm = Math.min(
      1,
      Math.max(0.3, (elementalDistribution.Water || 1) / 3),
    );
    const earthNorm = Math.min(
      1,
      Math.max(0.3, (elementalDistribution.Earth || 1) / 3),
    );
    const aspectNorm = Math.min(
      1.0,
      Math.max(0.1, (activeAspects.length / 3) * 0.8 + 0.2),
    );

    const norms = [fireNorm, airNorm, waterNorm, earthNorm, aspectNorm];
    const angles = [-90, -18, 54, 126, 198]; // 5 spokes in degrees

    const pts = norms.map((norm, i) => {
      const rad = (angles[i] * Math.PI) / 180;
      const r = norm * maxR;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      return {x, y, angle: angles[i], norm};
    });

    const polygonString = pts
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    return {cx, cy, maxR, pts, polygonString};
  }, [elementalDistribution, activeAspects]);

  return (
    <div
      className={`flex flex-col gap-6 w-full max-w-5xl mx-auto ${className}`}>
      {/* Screen title: plain name first, the Oneiromancy name as the eyebrow */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
          Ideal Team & League Telemetry
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
          This Week
        </h2>
        <p className="text-xs text-slate-400 font-sans">
          {weeklyMatchup?.week ? `Week ${weeklyMatchup.week}` : 'Your week'}
          {weeklyMatchup?.date_range ? ` · ${weeklyMatchup.date_range}` : ''} · what to start, add, and plan for.
        </p>
      </div>

      {/* This week's team comparison: head-to-head and celestial telemetry */}
      {weeklyMatchup && <MatchupsScreen embedded part="comparison" />}

      <WeeklyMoves />

      {/* 4. Squad Harmony: one card; the header toggles the body open in place */}
      <section className="rounded-xl bg-slate-900/70 border border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHarmonyOpen((v) => !v)}
          aria-expanded={isHarmonyOpen}
          aria-controls="team-harmony-body"
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/5">
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-serif text-base font-bold text-slate-100">Squad Harmony</span>
            <span className="text-xs font-mono text-amber-300">{harmonyScore}%</span>
          </span>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            {isHarmonyOpen ? 'Hide' : 'Elements and stacks'}
            {isHarmonyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>
        {isHarmonyOpen && (
          <div id="team-harmony-body" className="px-4 sm:px-6 pb-5 pt-4 space-y-5 border-t border-white/10">
            <p className="text-[11px] font-sans text-slate-400">
              How well your lineup works as a unit. Starts at 50%, plus the three bonuses below (max 100%).
            </p>
        {/* How Harmony is scored (computeRosterHarmonyBreakdown) */}
        <details className="group rounded-xl bg-slate-950/60 border border-cyan-500/20 text-xs overflow-hidden transition-all">
          <summary className="p-3 font-mono text-cyan-300 font-semibold cursor-pointer hover:bg-white/5 flex items-center justify-between select-none">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>How Squad Harmony is scored</span>
            </span>
            <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <div className="p-3.5 pt-0 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
              <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-mono text-red-300 font-bold">
                  <Flame className="w-3 h-3 text-red-400" />
                  <span>1. Elemental Trine</span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-normal">
                  Three starters of one element: +12%. Four or more: +18%.
                </p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-mono text-amber-300 font-bold">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>2. QB Stacks</span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-normal">
                  A pass catcher with his own QB: +18% (+9% each when several share one QB). Up to +30%.
                </p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-mono text-teal-300 font-bold">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  <span>3. Four-Element Balance</span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-normal">
                  Fire, Earth, Air and Water all present: +10%.
                </p>
              </div>
            </div>
          </div>
        </details>

        {/* Visual Team Synergy Radar Graph & Celestial Aspects Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Radar Chart Visual */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-slate-950/70 p-4 rounded-xl border border-white/5 relative">
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-semibold mb-1">
              Elemental & Celestial Aspect Radar
            </div>
            <svg viewBox="0 0 220 220" className="w-52 h-52 overflow-visible">
              <defs>
                <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                </radialGradient>
              </defs>

              {/* Concentric Guide Rings */}
              {[0.25, 0.5, 0.75, 1.0].map((level, i) => (
                <circle
                  key={i}
                  cx={radarPoints.cx}
                  cy={radarPoints.cy}
                  r={radarPoints.maxR * level}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeDasharray={level === 1.0 ? 'none' : '2 2'}
                  strokeWidth="1"
                />
              ))}

              {/* Axis Spokes */}
              {radarPoints.pts.map((pt, i) => (
                <line
                  key={i}
                  x1={radarPoints.cx}
                  y1={radarPoints.cy}
                  x2={
                    radarPoints.cx +
                    radarPoints.maxR * Math.cos((pt.angle * Math.PI) / 180)
                  }
                  y2={
                    radarPoints.cy +
                    radarPoints.maxR * Math.sin((pt.angle * Math.PI) / 180)
                  }
                  stroke="rgba(6, 182, 212, 0.25)"
                  strokeWidth="1"
                />
              ))}

              {/* Synergistic Polygon Shape */}
              <polygon
                points={radarPoints.polygonString}
                fill="url(#radarFillGrad)"
                stroke="#06b6d4"
                strokeWidth="2"
                className="transition-all duration-700 ease-out drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
              />

              {/* Vertex Nodes */}
              {radarPoints.pts.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  fill="#06b6d4"
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="animate-pulse"
                />
              ))}

              {/* Axis Labels */}
              <text
                x="110"
                y="24"
                textAnchor="middle"
                fill="#ef4444"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace">
                Fire ({elementalDistribution.Fire || 0})
              </text>
              <text
                x="194"
                y="90"
                textAnchor="start"
                fill="#38bdf8"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace">
                Air ({elementalDistribution.Air || 0})
              </text>
              <text
                x="165"
                y="195"
                textAnchor="start"
                fill="#818cf8"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace">
                Water ({elementalDistribution.Water || 0})
              </text>
              <text
                x="55"
                y="195"
                textAnchor="end"
                fill="#14b8a6"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace">
                Earth ({elementalDistribution.Earth || 0})
              </text>
              <text
                x="26"
                y="90"
                textAnchor="end"
                fill="#f59e0b"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace">
                Aspects ({activeAspects.length})
              </text>

              {/* Center Harmony Node */}
              <circle
                cx={radarPoints.cx}
                cy={radarPoints.cy}
                r="16"
                fill="#0f172a"
                stroke="#06b6d4"
                strokeWidth="1.5"
              />
              <text
                x={radarPoints.cx}
                y={radarPoints.cy + 3.5}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="10"
                fontWeight="bold"
                fontFamily="monospace">
                {harmonyScore}
              </text>
            </svg>
            <span className="text-[10px] font-mono text-slate-400 mt-1">
              Ascendant Resonance • {activeAspects.length} Celestial
              Conjunctions
            </span>
          </div>

          {/* Player Synergy Matrix */}
          <div className="md:col-span-7 space-y-3">
            <div className="text-xs font-mono text-cyan-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Active Celestial Aspect Connections</span>
            </div>

            <div className="space-y-2">
              {activeAspects.length === 0 && (
                <p className="text-[11px] font-sans text-slate-400">
                  No QB stacks among your starters (+0% Harmony).
                </p>
              )}
              {activeAspects.map((aspect, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/80 border border-amber-500/30 space-y-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-red-400" />
                      {aspect.team} Astral Synergy Conjunction
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-200">
                      {/* computeRosterHarmonyBreakdown: +18 for a lone pass catcher, +9 each when several share the QB */}
                      +{aspect.pass_catcher_names.length === 1 ? 18 : 9 * aspect.pass_catcher_names.length}% Harmony
                    </span>
                  </div>
                  <div className="text-xs font-sans text-slate-200">
                    <span className="font-semibold text-slate-100">
                      {aspect.qb_name}
                    </span>
                    <span className="text-slate-400 mx-1.5">
                      ☌ (Conjunction)
                    </span>
                    <span className="font-semibold text-slate-100">
                      {aspect.pass_catcher_names.join(' & ')}
                    </span>
                  </div>
                  <p className="text-[10px] font-sans text-slate-400 leading-normal">
                    A QB and his own pass catchers rise and fall together.
                  </p>
                </div>
              ))}

              {/* Elemental callouts, read from your starters */}
              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-cyan-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-cyan-400" />
                    {elementReadings.airTargets.length > 0
                      ? 'Fire & Air Kinetic Combustion'
                      : elementReadings.qb
                        ? `${elementReadings.qbElement ?? ''} QB alignment`
                        : 'QB alignment'}
                  </span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-relaxed">
                  {!elementReadings.qb
                    ? 'No QB among your starters.'
                    : elementReadings.airTargets.length > 0
                      ? `Fire QB ${elementReadings.qb.name} with Air ${elementReadings.airTargets.map((c) => c.name).join(' & ')}: energetic leadership plus separation on deep routes.`
                      : (['Complementary', 'Same element', 'Opposed'] as const)
                          .filter((k) => elementReadings.groups[k].length > 0)
                          .map((k) => `${k}: ${elementReadings.groups[k].join(', ')}`)
                          .join(' · ') || `${elementReadings.qb.name} has no starting pass catchers to align with.`}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-teal-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-teal-400" />
                    Earth Bedrock Floor Anchoring
                  </span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-relaxed">
                  {elementReadings.earthBacks.length > 0
                    ? `${elementReadings.earthBacks.map((p) => p.name).join(' & ')} (Earth RB${elementReadings.earthBacks.length > 1 ? 's) anchor' : ') anchors'} your weekly floor.`
                    : 'No Earth RBs among your starters, so no floor anchor this week.'}
                </p>
              </div>

              {/* Aspect between your starters' two leading elements */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Linear Aspect Resonance Reader (0° to 180°)</span>
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {elementReadings.aspect.angle}° ({elementReadings.aspect.name})
                  </span>
                </div>
                <p className="text-[10px] font-sans text-slate-400">
                  {elementReadings.top.length >= 2
                    ? `Your starters lean ${elementReadings.top.join(' & ')}: ${elementReadings.rel === 'Complementary' ? 'complementary elements' : 'elements in tension'}.`
                    : elementReadings.top.length === 1
                      ? `Your starters are all ${elementReadings.top[0]}.`
                      : 'No element data for your starters.'}
                </p>
                <div className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, (elementReadings.aspect.angle / 180) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400 px-0.5">
                  <span>0° (Conj)</span>
                  <span>60° (Sextile)</span>
                  <span>90° (Square)</span>
                  <span>120° (Trine)</span>
                  <span>180° (Opp)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
          </div>
        )}
      </section>

      {/* 5. Your Team's Current State: Roster Slots */}
      <GlassCard variant="panel" className="p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="font-serif text-lg font-bold text-slate-100">
              Your Team&apos;s Active Roster Slots
            </h3>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
            {rosteredPlayers.length} / 15 Filled
          </span>
        </div>

        {/* Starters Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              STARTERS (
              {
                myRoster.filter((s) => !s.slot_id.startsWith('BN') && s.player)
                  .length
              }{' '}
              / {myRoster.filter((s) => !s.slot_id.startsWith('BN')).length})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {myRoster
              .filter((s) => !s.slot_id.startsWith('BN'))
              .map((slot) => {
                const player = slot.player;
                return (
                  <div
                    key={slot.slot_id}
                    onClick={() => player && handleInspect(player)}
                    className={`p-3 rounded-xl border transition-all ${
                      player
                        ? 'bg-slate-900/80 border-cyan-500/30 hover:border-cyan-400 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-950/40 border-dashed border-white/10 opacity-70'
                    }`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">
                        {slot.slot_name}
                      </span>
                      {player ? (
                        <PositionalBadge position={player.position} size="sm" />
                      ) : (
                        <span className="text-[9px] font-mono text-slate-500">
                          VACANT
                        </span>
                      )}
                    </div>
                    {player ? (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-serif font-bold text-xs text-slate-100 truncate">
                            {player.name}
                          </span>
                          {player.injury_status && (
                            <span
                              className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border shrink-0 ${
                                ['Out', 'IR', 'Doubtful', 'NA'].includes(
                                  player.injury_status,
                                )
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              }`}>
                              {player.injury_status.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span>
                            {player.team} • Bye {player.bye_week || '—'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-300 font-bold" title="Stats: this week's projection">
                              {statsPoints(player).toFixed(1)} pts
                            </span>
                            <span
                              title="Stars: this week's favorability"
                              className={`px-1 rounded border ${TONE_PILL[favorabilityTone(starsScore(player))]}`}>
                              ★ {starsScore(player).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] font-mono text-slate-500 italic">
                        Awaiting draft pick
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Bench Section */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
              BENCH (
              {
                myRoster.filter((s) => s.slot_id.startsWith('BN') && s.player)
                  .length
              }{' '}
              / {myRoster.filter((s) => s.slot_id.startsWith('BN')).length})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {myRoster
              .filter((s) => s.slot_id.startsWith('BN'))
              .map((slot) => {
                const player = slot.player;
                return (
                  <div
                    key={slot.slot_id}
                    onClick={() => player && handleInspect(player)}
                    className={`p-3 rounded-xl border transition-all ${
                      player
                        ? 'bg-slate-950/70 border-white/10 hover:border-purple-500/40 cursor-pointer opacity-85'
                        : 'bg-slate-950/30 border-dashed border-white/5 opacity-50'
                    }`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-mono font-medium text-slate-400 uppercase">
                        {slot.slot_name}
                      </span>
                      {player ? (
                        <PositionalBadge position={player.position} size="sm" />
                      ) : (
                        <span className="text-[9px] font-mono text-slate-500">
                          VACANT
                        </span>
                      )}
                    </div>
                    {player ? (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-serif font-medium text-xs text-slate-200 truncate">
                            {player.name}
                          </span>
                          {player.injury_status && (
                            <span
                              className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border shrink-0 ${
                                ['Out', 'IR', 'Doubtful', 'NA'].includes(
                                  player.injury_status,
                                )
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              }`}>
                              {player.injury_status.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span>
                            {player.team} • Bye {player.bye_week || '—'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-300 font-bold" title="Stats: this week's projection">
                              {statsPoints(player).toFixed(1)} pts
                            </span>
                            <span
                              title="Stars: this week's favorability"
                              className={`px-1 rounded border ${TONE_PILL[favorabilityTone(starsScore(player))]}`}>
                              ★ {starsScore(player).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] font-mono text-slate-500 italic">
                        Awaiting draft pick
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </GlassCard>

      {/* 6. Weekly Bye Week Coverage Matrix & Explanation */}
      {weeklyCoverage.length > 0 && (
        <GlassCard variant="panel" className="p-4 sm:p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-100">
                  Bye outlook
                </h3>
                <p className="text-[11px] font-sans text-slate-400">
                  Remaining weeks with real NFL byes. Points are this week&apos;s projections with
                  bye players removed.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
              Weeks {remainingCoverage[0]?.week ?? 1}–{remainingCoverage[remainingCoverage.length - 1]?.week ?? 18}
            </span>
          </div>

          {/* How bye coverage works */}
          <details className="group rounded-xl bg-slate-950/70 border border-purple-500/20 text-xs overflow-hidden transition-all">
            <summary className="p-3 font-mono text-purple-300 font-semibold cursor-pointer hover:bg-white/5 flex items-center justify-between select-none">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-400" />
                <span>How bye coverage works</span>
              </span>
              <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="p-3.5 pt-0 space-y-2 border-t border-white/5">
              <p className="font-sans text-slate-300 leading-relaxed pt-3">
                Each week lists your players on bye and your best lineup without them. Byes fall in
                Weeks 5–14; the fantasy playoffs (Weeks 15–17) have none.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-0.5">
                  <span className="text-slate-300 font-bold">OK</span>
                  <p className="text-[10px] font-sans text-slate-400">No one on bye.</p>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-0.5">
                  <span className="text-amber-300 font-bold">BYE</span>
                  <p className="text-[10px] font-sans text-slate-400">One or two players on bye.</p>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-0.5">
                  <span className="text-rose-300 font-bold">Conflict</span>
                  <p className="text-[10px] font-sans text-slate-400">Three or more on bye; check waivers early.</p>
                </div>
              </div>
            </div>
          </details>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {remainingCoverage.map((node) => {
              const isHighConflict = node.conflict_severity === 'high';
              const isLowConflict = node.conflict_severity === 'low';

              return (
                <div
                  key={node.week}
                  className={`p-2.5 rounded-xl border font-mono text-xs space-y-1 ${
                    isHighConflict
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : isLowConflict
                        ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                        : 'bg-slate-900/60 border-white/5 text-slate-300'
                  }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">WK {node.week}</span>
                    {isHighConflict ? (
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-950/80 px-1 py-0.2 rounded border border-rose-500/40">
                        CONFLICT
                      </span>
                    ) : isLowConflict ? (
                      <span className="text-[9px] font-bold text-amber-300">BYE</span>
                    ) : (
                      <span className="text-[9px] text-slate-500">OK</span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-cyan-300">
                    {node.projected_total.toFixed(1)} pts
                  </div>
                  {node.bye_players.length > 0 ? (
                    <div className="text-[9px] text-slate-400 truncate">
                      Bye: {node.bye_players.map((b) => b.position).join(', ')}
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-500">Full roster</div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* 8. Path of Ascension: a draft tool, hidden once the draft is complete */}
      {!isDraftComplete && (!isAscensionExpanded ? (
        <GlassCard
          variant="panel"
          className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>Path of Ascension</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-normal">
                  Draft Complete
                </span>
              </h4>
              <p className="text-[11px] font-mono text-slate-400">
                15-round divination roadmap collapsed. Roster is fully ascended.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAscensionExpanded(true)}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs hover:bg-cyan-900/80 transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <span>Show Completed Ascension Path</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {isDraftComplete && (
            <div className="flex justify-end px-1">
              <button
                type="button"
                onClick={() => setIsAscensionExpanded(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-white/10 text-slate-300 font-mono text-xs hover:text-white flex items-center gap-1.5 transition-all">
                <span>Collapse Ascension Path</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <AscensionTimeline
            steps={ascensionPath}
            currentRound={currentPick?.round || 5}
            cosmicBoard={cosmicBoard}
            onInspectPlayerById={handleInspectById}
          />
        </div>
      ))}

      {/* Detail Modal (Read-Only) */}
      <PlayerDetailModal
        player={context.selectedPlayer}
        isOpen={Boolean(context.selectedPlayer)}
        onClose={() => context.selectPlayer(null)}
      />
    </div>
  );
};

export default OneiromancyDashboard;
