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

import React, { useMemo, useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import RosterSlotBadge from '@/components/common/RosterSlotBadge';
import PlayerHeadshot from '@/components/common/PlayerHeadshot';
import { type InspectTarget } from '@/components/common/PlayerLink';
import { ElementIcon, HealthTag } from '@/components/common/PlayerTiles';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { mockCompetitorTeams, mockWeeklyMatchup } from '@/lib/mockData';
import { deriveWeeklyMatchup, getSeasonContext } from '@/lib/sleeper';
import { moonAt, neutralVenueCoords, planetaryHourAt, teamGame } from '@/lib/nflGames';
import {
  TONE_PILL,
  compute18WeekByeCoverage,
  computeLineupCheck,
  favorabilityTone,
  oraclePlaceholderInfo,
  oracleScore,
  resolveActiveWeek,
  starsScore,
  statsPoints,
} from '@/lib/oracle';
import {
  DEFAULT_CHAOS_LAMBDA,
  computeRosterHarmony,
  hasUserSuffix,
  stripUserSuffix,
  computeRosterHarmonyBreakdown,
  isNFLByeWeek,
  isPlayerOnByeWeek,
} from '@/lib/scoring';
import type {
  CompetitorTeam,
  CosmicPlayer,
  DraftPickState,
  IdealDraftPick,
  RosterSlot,
} from '@/types/oneiromancy';
import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Flame,
  Info,
  Moon,
  Orbit,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';

export interface OneiromancyDashboardProps {
  recommendedPick?: CosmicPlayer | null;
  ascensionPath?: IdealDraftPick[];
  myRoster?: RosterSlot[];
  currentPick?: DraftPickState;
  onDraftPlayer?: (playerId: string) => void;
  onInspectPlayer?: (player: CosmicPlayer) => void;
  className?: string;
}

const ELEMENT_STROKE: Record<string, string> = {
  Fire: '#f43f5e',
  Earth: '#14b8a6',
  Air: '#38bdf8',
  Water: '#60a5fa',
};

/** Visual multi-ring Divination Aura around each player headshot. */
function auraClasses(stars: number): { ring: string; glow: string; label: string } {
  if (stars >= 84) {
    return {
      ring: 'ring-2 ring-amber-400 border-amber-300',
      glow: 'shadow-[0_0_22px_rgba(251,191,36,0.75),0_0_40px_rgba(168,85,247,0.45)]',
      label: 'Apex Aura',
    };
  }
  if (stars >= 75) {
    return {
      ring: 'ring-2 ring-emerald-400/80 border-emerald-300',
      glow: 'shadow-[0_0_16px_rgba(16,185,129,0.55)]',
      label: 'Harmonic Aura',
    };
  }
  if (stars >= 65) {
    return {
      ring: 'ring-1 ring-purple-400/60 border-purple-400/40',
      glow: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]',
      label: 'Steady Aura',
    };
  }
  return {
    ring: 'ring-1 ring-rose-500/50 border-rose-500/40',
    glow: 'shadow-[0_0_8px_rgba(244,63,94,0.25)]',
    label: 'Challenged Aura',
  };
}

export const OneiromancyDashboard: React.FC<OneiromancyDashboardProps> = ({
  myRoster: propMyRoster,
  onInspectPlayer: propOnInspectPlayer,
  className = '',
}) => {
  const context = useOneiromancy();
  const draftState = context.draftState;
  const lambda = draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const [inspected, setInspected] = useState<InspectTarget | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const myRoster = useMemo(
    () => propMyRoster || draftState?.my_roster || [],
    [propMyRoster, draftState?.my_roster],
  );

  const weeklyMatchup = useMemo(() => {
    let raw = draftState?.weekly_matchup;
    if (!raw && draftState?.competitor_teams?.length) {
      const activeUserTeam = draftState.competitor_teams.find((t) => t.is_user);
      const activeRosterId = activeUserTeam?.roster_id ?? (draftState.settings?.user_slot || 7);
      const activeWk = getSeasonContext()?.currentWeek ?? 1;
      raw = deriveWeeklyMatchup(
        activeRosterId,
        draftState.competitor_teams,
        null,
        draftState.cosmic_board,
        draftState.my_roster,
        activeWk,
      );
    }
    return raw || (draftState?.isLive ? null : mockWeeklyMatchup);
  }, [draftState]);

  const starterSlots = useMemo(
    () => myRoster.filter((s) => !s.slot_id.startsWith('BN')),
    [myRoster],
  );
  const benchSlots = useMemo(
    () => myRoster.filter((s) => s.slot_id.startsWith('BN')),
    [myRoster],
  );
  const startingPlayers = useMemo(
    () => starterSlots.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p)),
    [starterSlots],
  );
  const benchPlayers = useMemo(
    () => benchSlots.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p)),
    [benchSlots],
  );
  const rosteredPlayers = useMemo(
    () => myRoster.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p)),
    [myRoster],
  );
  const byeSchedule = useMemo(
    () => compute18WeekByeCoverage(myRoster),
    [myRoster],
  );

  // Global Universe State at current kickoff window
  const universeState = useMemo(() => {
    const season = getSeasonContext();
    const activeWeek = resolveActiveWeek(draftState, selectedWeek);
    const starterGame = startingPlayers
      .map((p) => teamGame(activeWeek, p.team))
      .find((g) => Boolean(g?.kickoff));
    const seasonYear = Number(season?.season) || 2025;
    const fallbackIso = new Date(Date.UTC(seasonYear, 8, 7 + Math.max(0, activeWeek - 1) * 7, 17, 0, 0)).toISOString();
    const refDate = new Date(starterGame?.kickoff || fallbackIso);
    const homeFav = starterGame?.home
      ? weeklyMatchup?.player_favorabilities?.find((pf) => (pf.nfl_team || pf.team) === starterGame.home)
      : undefined;
    const refLon =
      neutralVenueCoords(starterGame?.venue?.name)?.lon ??
      homeFav?.stadium?.longitude ??
      weeklyMatchup?.player_favorabilities?.find((pf) => typeof pf.stadium?.longitude === 'number')?.stadium?.longitude;
    const moon = moonAt(refDate);
    const hour = planetaryHourAt(refDate, typeof refLon === 'number' && Number.isFinite(refLon) ? refLon : 0);
    const isPeakMoon = moon.includes('Full Moon') || moon.includes('New Moon');
    return { moon, hour, activeWeek, isPeakMoon };
  }, [
    weeklyMatchup?.week,
    weeklyMatchup?.player_favorabilities,
    startingPlayers,
    selectedWeek,
    draftState?.isLive,
    draftState?.mode,
  ]);

  // Lineup swap recommendations (bench -> starter)
  const swaps = useMemo(() => computeLineupCheck(myRoster, lambda, universeState.activeWeek), [myRoster, lambda, universeState.activeWeek]);
  const swapByStarterId = useMemo(() => {
    const map = new Map<string, (typeof swaps)[number]>();
    for (const s of swaps) {
      if (s.playerOut) map.set(String(s.playerOut.id), s);
    }
    return map;
  }, [swaps]);
  const swapByBenchId = useMemo(() => {
    const map = new Map<string, (typeof swaps)[number]>();
    for (const s of swaps) {
      map.set(String(s.playerIn.id), s);
    }
    return map;
  }, [swaps]);

  const elementalDistribution = useMemo(() => {
    const dist = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
    for (const p of startingPlayers) {
      const el = p.elemental_traits?.element;
      if (el && el in dist) dist[el] += 1;
    }
    return dist;
  }, [startingPlayers]);

  const activeAspects = useMemo(() => {
    const aspects: {
      team: string;
      multiplier: number;
      bonus_points: number;
      description: string;
      qb: CosmicPlayer;
      passCatchers: CosmicPlayer[];
    }[] = [];
    const qbs = startingPlayers.filter((p) => p.position === 'QB');
    for (const qb of qbs) {
      const passCatchers = startingPlayers.filter(
        (p) => (p.position === 'WR' || p.position === 'TE') && p.team === qb.team,
      );
      if (passCatchers.length > 0) {
        aspects.push({
          team: qb.team,
          multiplier: 3.0,
          bonus_points: passCatchers.length >= 2 ? 27.0 : 18.0,
          description: `${qb.team} 3.0x Astral Stack Conjunction: ${qb.name} ☌ ${passCatchers.map((pc) => pc.name).join(' & ')}`,
          qb,
          passCatchers,
        });
      }
    }
    return aspects;
  }, [startingPlayers]);

  const stackTeamSet = useMemo(() => new Set(activeAspects.map((a) => a.team)), [activeAspects]);

  const competitorTeams = useMemo<CompetitorTeam[]>(() => {
    if (draftState?.competitor_teams?.length) return draftState.competitor_teams;
    return draftState?.isLive ? [] : mockCompetitorTeams;
  }, [draftState?.competitor_teams, draftState?.isLive]);

  const userTeam = useMemo(
    () =>
      competitorTeams.find((t) => t.is_user === true) ||
      competitorTeams.find((t) => hasUserSuffix(t.name)) ||
      competitorTeams.find((t) => t.slot === (draftState?.settings?.user_slot || 7)) ||
      competitorTeams[0],
    [competitorTeams, draftState?.settings?.user_slot],
  );

  const harmonyScore = useMemo(() => {
    if (userTeam?.harmony_score !== undefined && userTeam.harmony_score !== null) {
      return Math.round(userTeam.harmony_score);
    }
    if (rosteredPlayers.length > 0) return Math.round(computeRosterHarmony(rosteredPlayers));
    return 75;
  }, [userTeam?.harmony_score, rosteredPlayers]);

  const harmonyBreakdown = useMemo(
    () => computeRosterHarmonyBreakdown(startingPlayers.length ? startingPlayers : rosteredPlayers),
    [startingPlayers, rosteredPlayers],
  );

  // 5-Spoke Elemental & Aspect Radar Coordinates
  const radarPoints = useMemo(() => {
    const cx = 115;
    const cy = 96;
    const maxR = 62;
    const scaleElem = (count: number) => 0.15 + Math.min(1, count / 4) * 0.85;
    const norms = [
      scaleElem(elementalDistribution.Fire),
      scaleElem(elementalDistribution.Air),
      scaleElem(elementalDistribution.Water),
      scaleElem(elementalDistribution.Earth),
      Math.min(1.0, Math.max(0.2, (activeAspects.length / 3) * 0.8 + 0.2)),
    ];
    const angles = [-90, -18, 54, 126, 198];
    const pts = norms.map((norm, i) => {
      const rad = (angles[i] * Math.PI) / 180;
      const r = norm * maxR;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    });
    const polygonString = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { cx, cy, maxR, pts, polygonString };
  }, [elementalDistribution, activeAspects.length]);

  const handleOpenPlayer = (player: CosmicPlayer, vs: CosmicPlayer | null = null) => {
    if (propOnInspectPlayer && !vs) {
      propOnInspectPlayer(player);
      return;
    }
    setInspected({ player, vs });
  };

  const renderPlayerCard = (slot: RosterSlot, isBench: boolean) => {
    const p = slot.player;
    if (!p) {
      return (
        <div
          key={slot.slot_id}
          className="p-3 rounded-xl bg-slate-900/40 border border-dashed border-white/10 flex items-center justify-between text-xs font-mono text-slate-500"
        >
          <RosterSlotBadge slotId={slot.slot_id} slotName={slot.slot_name} size="sm" className="shrink-0" />
          <span>Empty Slot</span>
        </div>
      );
    }
    const seasonCtx = getSeasonContext();
    const activeWk = universeState.activeWeek;
    const onBye = isPlayerOnByeWeek(activeWk, p.bye_week, p.team, seasonCtx?.byeWeeks);
    const placeholder = oraclePlaceholderInfo(p, activeWk);
    const stats = statsPoints(p);
    const oracle = oracleScore(p, lambda, { currentWeek: activeWk });
    const stars = starsScore(p, activeWk);
    const tone = favorabilityTone(stars);
    const aura = auraClasses(stars);
    const starterSwap = !isBench ? swapByStarterId.get(String(p.id)) : undefined;
    const benchSwap = isBench ? swapByBenchId.get(String(p.id)) : undefined;
    const compareTarget = starterSwap?.playerIn ?? benchSwap?.playerOut ?? null;
    const el = p.elemental_traits?.element;
    const hasTrine = Boolean(el && elementalDistribution[el] >= 3);
    const hasStack =
      !isBench &&
      stackTeamSet.has(p.team) &&
      (p.position === 'QB' || p.position === 'WR' || p.position === 'TE');

    return (
      <div
        key={slot.slot_id}
        data-testid={`roster-card-${slot.slot_id}`}
        data-bye={onBye ? 'true' : undefined}
        role="button"
        tabIndex={0}
        onClick={() => handleOpenPlayer(p, compareTarget)}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpenPlayer(p, compareTarget);
          }
        }}
        className={`group relative p-3 rounded-xl border-2 transition-all cursor-pointer ${
          onBye
            ? 'bg-slate-950/70 border-slate-700/50 opacity-50 grayscale hover:opacity-75'
            : starterSwap
              ? 'bg-slate-900/85 border-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.2)] hover:bg-slate-900'
              : benchSwap
                ? 'bg-slate-900/85 border-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:bg-slate-900'
                : isBench
                  ? 'bg-slate-900/85 border-purple-500/40 hover:border-purple-400 hover:bg-slate-900'
                  : 'bg-slate-900/85 border-purple-500/60 hover:border-purple-400 hover:bg-slate-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Divination Aura Headshot */}
            <div data-testid="player-divination-aura" title={`${aura.label} (Stars ${stars.toFixed(0)})`} className={`relative rounded-full p-0.5 shrink-0 ${aura.ring} ${aura.glow} transition-transform group-hover:scale-105`}>
              <PlayerHeadshot player={p} size="md" />
            </div>
            <div data-testid="roster-card-text-col" className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden min-w-0">
                <RosterSlotBadge slotId={slot.slot_id} slotName={slot.slot_name} size="sm" className="shrink-0" />
                <PositionalBadge position={p.position} size="sm" showGlow={false} className="shrink-0" depth={p.depth_chart_order} />
                {starterSwap && (() => {
                  const gain = Number(starterSwap.oracleGain || 0).toFixed(1);
                  const title = `Swap alert: bench ${starterSwap.playerIn.name} leads by +${gain} Oracle`;
                  return (
                    <span
                      data-testid="lineup-swap-arrow"
                      title={title}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold shrink-0"
                    >
                      <ArrowUpDown className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="hidden sm:inline" aria-hidden="true"><span className="hidden lg:inline">Swap </span><span>+{gain}</span></span>
                      <span className="sr-only">Swap +{gain} Oracle</span>
                    </span>
                  );
                })()}
                {benchSwap && (() => {
                  const gain = Number(benchSwap.oracleGain || 0).toFixed(1);
                  const title = benchSwap.playerOut
                    ? `Promote over ${benchSwap.playerOut.name} (+${gain} Oracle)`
                    : `Promote to empty slot (+${gain} Oracle)`;
                  return (
                    <span
                      title={title}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[9px] font-mono font-bold shrink-0"
                    >
                      <ArrowUpDown className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="hidden sm:inline" aria-hidden="true">Promote</span>
                      <span className="sr-only">Promote (+{gain} Oracle)</span>
                    </span>
                  );
                })()}
              </div>
              <div className="font-bold text-sm text-slate-100 truncate">{p.name}</div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 whitespace-nowrap overflow-hidden min-w-0">
                <span className="shrink-0">{p.team || 'FA'} · Bye {p.bye_week || '-'}</span>
                <span className="flex items-center gap-0.5 min-w-0"><ElementIcon element={el} /><span className="truncate">{p.elemental_traits?.sun_sign || el}</span></span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <HealthTag player={p} activeWeek={activeWk} />
                {hasStack && <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold whitespace-nowrap">☌ {p.team} Stack</span>}
                {hasTrine && !isBench && <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-[9px] font-mono whitespace-nowrap">△ {el} Trine</span>}
              </div>
            </div>
          </div>

          {/* Strictly the 3 Canonical Player Judgment Metrics */}
          <div className="flex items-center gap-1.5 shrink-0 font-mono text-right">
            <div
              className="min-w-[46px] px-2 py-1 rounded-lg bg-slate-950/80 border border-white/5"
              title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Baseline projected points'}
            >
              <span className="text-[8px] text-slate-500 block uppercase">
                Stats
              </span>
              <span className="text-xs font-bold text-cyan-300 tabular-nums">{stats.toFixed(1)}</span>
            </div>
            <div
              className="min-w-[46px] px-2 py-1 rounded-lg bg-slate-950/80 border border-purple-500/30"
              title={placeholder.hasPlaceholder ? placeholder.tooltipText : `Combined Oracle Score at λ ${lambda.toFixed(2)}`}
            >
              <span className="text-[8px] text-purple-300/80 block uppercase">
                Oracle
              </span>
              <span className="text-xs font-bold text-purple-200 tabular-nums">
                {oracle.toFixed(1)}
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
            </div>
            <div
              className={`min-w-[42px] px-2 py-1 rounded-lg border ${TONE_PILL[tone]}`}
              title={placeholder.hasPlaceholder ? placeholder.tooltipText : 'Upcoming week astrological alignment (0 to 100)'}
            >
              <span className="text-[8px] opacity-75 block uppercase">
                Stars
              </span>
              <span className="text-xs font-bold tabular-nums">{stars.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {/* 1. Global Universe State Banner */}
      <GlassCard
        variant="gradient"
        glowColor="purple"
        data-testid="universe-state-banner"
        className="p-4 sm:p-5 border border-purple-500/40"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/90 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Ideal Team &amp; League Telemetry · Week {universeState.activeWeek}
              </span>
              <div className="inline-flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-purple-500/30 text-[10px] font-mono">
                <span className="text-slate-400">Wk</span>
                <select
                  data-testid="dashboard-week-select"
                  aria-label="Select active week"
                  value={universeState.activeWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-transparent text-purple-200 font-bold focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((wk) => (
                    <option key={wk} value={wk} className="bg-slate-900 text-slate-100">
                      Wk {wk} {isNFLByeWeek(wk) ? '(Byes)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 flex flex-wrap items-center gap-2">
              <span>{stripUserSuffix(userTeam?.name, 'My Roster')}</span>
            </h2>
          </div>

          {/* Live Cosmic Sky Chips: Moon Phase, Planetary Hour & Squad Harmony */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div
              className={`px-3 py-1.5 rounded-xl bg-slate-950/80 border flex items-center gap-2 ${
                universeState.isPeakMoon
                  ? 'border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                  : 'border-cyan-500/30'
              }`}
            >
              <Moon className={`w-4 h-4 shrink-0 ${universeState.isPeakMoon ? 'text-amber-300' : 'text-cyan-300'}`} />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">
                  {universeState.isPeakMoon ? 'Peak Lunar Alignment' : 'Lunar Transit'}
                </span>
                <span className="text-cyan-200 font-bold">{universeState.moon}</span>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-purple-500/30 flex items-center gap-2">
              <Orbit className="w-4 h-4 text-purple-300 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">Planetary Hour</span>
                <span className="text-purple-200 font-bold">{universeState.hour}</span>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-amber-500/30 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">Squad Harmony</span>
                <span className="text-amber-300 font-bold">{harmonyScore} pts</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 2. Unified Interactive Visual Roster Constellation & Lineup Field */}
      <GlassCard variant="panel" glowColor="cyan" className="p-4 sm:p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Roster Aura &amp; Stack Constellation
            </h3>
            <p className="text-xs text-slate-400">
              Shows how balanced your lineup is, how deep your bench is, and how many points each starter and bench player is projected to score.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
            {harmonyBreakdown.parts.map((part) => (
              <span
                key={part.label}
                className="px-2 py-0.5 rounded-full bg-slate-900 border border-amber-500/30 text-amber-200"
              >
                {part.label}: +{part.points} pts
              </span>
            ))}
          </div>
        </div>

        {/* Interactive Constellation Map (5-Spoke Elemental & Aspect Balance Radar + Active Trine/Stack Summary) */}
        <div className="bg-slate-950/70 rounded-xl p-3 sm:p-4 border border-white/5">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
            <div className="flex justify-center w-full md:w-auto shrink-0">
              <svg
                viewBox="-45 0 300 190"
                className="w-full max-w-[280px] sm:max-w-[300px] h-48 overflow-visible"
                data-testid="synergy-constellation-svg"
                role="img"
                aria-label="Team Alignment Radar and Stack Constellation Graph"
              >
                {/* 5-Spoke Elemental & Aspect Balance Web */}
                {[0.33, 0.66, 1.0].map((level, idx) => (
                  <circle
                    key={`grid-${idx}`}
                    cx={radarPoints.cx}
                    cy={radarPoints.cy}
                    r={radarPoints.maxR * level}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="2,3"
                  />
                ))}
                <polygon
                  points={radarPoints.polygonString}
                  fill="rgba(168, 85, 247, 0.24)"
                  stroke="#06b6d4"
                  strokeWidth="2"
                />
                <text x="115" y="20" textAnchor="middle" fill="#f87171" fontSize="9" fontFamily="monospace">
                  Fire ({elementalDistribution.Fire})
                </text>
                <text x="200" y="76" textAnchor="start" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                  Air ({elementalDistribution.Air})
                </text>
                <text x="170" y="176" textAnchor="middle" fill="#60a5fa" fontSize="9" fontFamily="monospace">
                  Water ({elementalDistribution.Water})
                </text>
                <text x="60" y="176" textAnchor="middle" fill="#2dd4bf" fontSize="9" fontFamily="monospace">
                  Earth ({elementalDistribution.Earth})
                </text>
                <text x="26" y="76" textAnchor="end" fill="#c084fc" fontSize="9" fontFamily="monospace">
                  Aspects ({activeAspects.length})
                </text>
              </svg>
            </div>

            {/* Right column: Linear Elemental Harmony Bars & Correlation Stack Telemetry */}
            <div className="flex-1 w-full space-y-3 font-mono">
              <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                ELEMENTAL HARMONY THRESHOLDS (3+ STARTERS = +12 PTS TRINE BONUS)
              </div>
              <div className="space-y-2">
                {(['Fire', 'Earth', 'Air', 'Water'] as const).map((el) => {
                  const count = elementalDistribution[el];
                  const isTrine = count >= 3;
                  const stroke = ELEMENT_STROKE[el];
                  const percent = Math.min(100, (count / 8) * 100);
                  return (
                    <div key={el} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: stroke }} className="font-bold">
                          {el}
                        </span>
                        <span className={isTrine ? 'text-emerald-400 text-[10px]' : 'text-slate-400 text-[10px]'}>
                          {count}/8 {isTrine ? '★ TRINE ACTIVE' : `(need ${Math.max(0, 3 - count)} more)`}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/10">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(5, percent)}%`,
                            backgroundColor: stroke,
                            opacity: isTrine ? 0.9 : 0.45,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-white/10 space-y-1 text-xs">
                <div className="text-amber-400 text-[11px] font-bold">
                  CORRELATION STACKS:{' '}
                  <span className="font-normal text-amber-200">
                    {activeAspects.length > 0
                      ? activeAspects.map((a) => `${a.team} 3.0x (${a.qb.name.split(' ').slice(-1)[0]} ☌ ${a.passCatchers.map((pc) => pc.name.split(' ').slice(-1)[0]).join('/')})`).join(' · ')
                      : 'No active QB + WR/TE same-team starter stack'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Squad Harmony: {harmonyScore} pts · Click any starter or bench card below to compare roles
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Starters & Bench Player Aura Field (Single Cohesive Roster View) */}
        <div className="space-y-4">
          <section className="space-y-2.5" aria-label="Active Starters">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-serif text-base font-bold text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7]" />
                STARTERS ({starterSlots.length})
              </h4>
              <span className="text-[11px] font-mono text-purple-300">
                {swaps.length > 0
                  ? `${swaps.length} bench promotion${swaps.length === 1 ? '' : 's'} flagged`
                  : 'Optimal Oracle lineup active'}
              </span>
            </div>
            {swaps.length > 0 && (
              <div
                data-testid="lineup-swap-banner"
                className="p-2.5 rounded-xl border bg-amber-950/40 border-amber-500/40 text-amber-200 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Swap alert: bench <strong>{swaps[0].playerIn.name}</strong>{' '}
                    {swaps[0].playerOut ? (
                      <>leads <strong>{swaps[0].playerOut.name}</strong> by +{Number(swaps[0].oracleGain || 0).toFixed(1)} Oracle</>
                    ) : (
                      <>can fill an empty slot (+{Number(swaps[0].oracleGain || 0).toFixed(1)} Oracle)</>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="lineup-swap-banner-button"
                  onClick={() => handleOpenPlayer(swaps[0].playerIn, swaps[0].playerOut ?? null)}
                  className="text-[11px] underline text-amber-300 hover:text-amber-100 shrink-0 cursor-pointer"
                >
                  Compare lineup →
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {starterSlots.map((slot) => renderPlayerCard(slot, false))}
            </div>
          </section>

          <section className="space-y-2.5 pt-3 border-t border-white/10" aria-label="Bench Depth">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-base font-bold text-slate-200">
                BENCH ({benchSlots.length})
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                Scored as starters (no bench penalty)
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {benchSlots.map((slot) => renderPlayerCard(slot, true))}
            </div>
          </section>
        </div>
      </GlassCard>

      {/* 3. Full-Width 18-Week Bye Coverage Strip & Compact Harmony/Bye Guide */}
      <GlassCard
        variant="panel"
        data-testid="18-week-coverage-strip"
        className="p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <h3 className="font-serif text-base font-bold text-slate-100">
              18-Week Bye Coverage
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Weeks 5-14 byes · Weeks 15-17 fantasy playoffs
          </span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-[repeat(18,minmax(0,1fr))] gap-1.5 font-mono text-[10px] text-center">
          {byeSchedule.map((w) => {
            const cls =
              w.severity === 'cluster'
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200 font-bold'
                : w.severity === 'normal'
                  ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900/60 border-white/5 text-slate-500';
            const names = w.players.map((p) => `${p.name} (${p.position})`).join(', ');
            return (
              <button
                type="button"
                key={w.week}
                onClick={() => setSelectedWeek(selectedWeek === w.week ? null : w.week)}
                data-testid={`bye-week-cell-${w.week}`}
                title={names ? `Week ${w.week} byes: ${names} (click to inspect week)` : `Week ${w.week}: No players on bye (click to inspect week)`}
                className={`py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${cls} ${w.week === universeState.activeWeek ? 'ring-2 ring-purple-400' : 'hover:border-purple-400/50'}`}
              >
                <span className="block text-[9px] opacity-75">W{w.week}</span>
                <span className="block text-xs font-bold">{w.players.length}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
          <details className="group text-slate-300">
            <summary className="font-mono text-[11px] text-cyan-300 cursor-pointer flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>How Squad Harmony is scored</span>
            </summary>
            <div className="mt-1.5 p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-[11px] text-slate-300 space-y-1">
              <div>
                <Flame className="w-3 h-3 text-rose-400 inline mr-1" />
                <strong>1. Elemental Trine:</strong> 3 starters of one element (+12 points), 4+ (+18 points) added to base 50 to amplify ceiling and floor.
              </div>
              <div>
                <Zap className="w-3 h-3 text-amber-400 inline mr-1" />
                <strong>2. QB Stacks:</strong> Starting a QB with 1 receiver (+18 points) or 2 receivers (+9 points each), capped at +30 points total added to base 50 (Astral Stack Conjunction).
              </div>
              <div>
                <CheckCircle2 className="w-3 h-3 text-teal-400 inline mr-1" />
                <strong>3. Four-Element Balance:</strong> All 4 elements represented (+10 points) added to base 50.
              </div>
            </div>
          </details>

          <details className="group text-slate-300">
            <summary className="font-mono text-[11px] text-purple-300 cursor-pointer flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-purple-400" />
              <span>How bye coverage works</span>
            </summary>
            <div className="mt-1.5 p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-[11px] text-slate-300">
              0 = No one on bye. · 1-2 = One or two players on bye. · ≥3 = Three or more on bye.
            </div>
          </details>
        </div>
      </GlassCard>

      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={myRoster}
        activeWeek={universeState.activeWeek}
      />
    </div>
  );
};

export default OneiromancyDashboard;
