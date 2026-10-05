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
import UserAvatar from '@/components/common/UserAvatar';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import AscensionTimeline from '@/components/oneiromancy/AscensionTimeline';
import CelestialLeaderboardGraph from '@/components/oneiromancy/CelestialLeaderboardGraph';
import TelemetryBar from '@/components/oneiromancy/TelemetryBar';
import {useOneiromancy} from '@/context/OneiromancyContext';
import {
  mockCompetitorTeams,
  mockWeeklyMatchup,
} from '@/lib/mockData';
import {deriveWeeklyMatchup} from '@/lib/sleeper';
import {
  calculateTeamCelestialMetrics,
  calculateWinProbability,
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
  Activity,
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
  Swords,
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
  const activeAspects = useMemo(() => {
    const aspects = [];
    const qbs = rosteredPlayers.filter((p) => p.position === 'QB');
    for (const qb of qbs) {
      const passCatchers = rosteredPlayers.filter(
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
  }, [rosteredPlayers]);

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
      {/* Screen Title & Mystical Subheading */}
      <div className="text-center space-y-1">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
          Ideal Team & League Telemetry
        </h2>
        <p className="text-xs text-slate-400 max-w-xl mx-auto font-sans">
          Squad telemetry, harmony alignment, bye week coverage, and competitor
          draft states.
        </p>
      </div>

      {/* 1. Weekly Matchup & Start/Sit Oracle Summary */}
      {weeklyMatchup && (
        <GlassCard
          variant="panel"
          className="p-4 sm:p-6 space-y-4 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Weekly Matchup & Start/Sit Oracle</span>
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                    Week {weeklyMatchup.week}
                  </span>
                </h3>
                <p className="text-[11px] font-sans text-slate-400">
                  Head-to-head matchup divination against league competitor and
                  elemental start/sit guidance.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Activity className="w-3 h-3 animate-pulse" />
              MATCHUP #{weeklyMatchup.matchup_id} ACTIVE
            </span>
          </div>

          {/* Matchup Duel Head-to-Head Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 items-center bg-slate-950/60 p-4 rounded-xl border border-white/5">
            {/* User Team */}
            <div className="sm:col-span-3 flex items-center gap-3 p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30">
              <UserAvatar
                src={weeklyMatchup.user_team.avatar_url}
                alt={`${weeklyMatchup.user_team.team_name} avatar`}
                fallbackText={weeklyMatchup.user_team.team_name}
                size="lg"
                isUser={true}
                testId="matchup-summary-user-avatar"
                data-testid="matchup-summary-user-avatar"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-sm text-cyan-200 truncate">
                    {weeklyMatchup.user_team.team_name}
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    YOU
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Mgr: {weeklyMatchup.user_team.owner_name}
                </div>
                <div className="text-sm font-mono font-bold text-cyan-400 mt-0.5">
                  {weeklyMatchup.user_team.projected_points.toFixed(2)}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    Proj Pts
                  </span>
                </div>
              </div>
            </div>

            {/* VS Badge & Dynamic Win Probability */}
            {(() => {
              const winProbData = calculateWinProbability(
                weeklyMatchup.user_team.projected_points,
                weeklyMatchup.opponent_team.projected_points,
                weeklyMatchup.user_team.harmony_score,
                weeklyMatchup.opponent_team.harmony_score,
              );
              const winProb =
                weeklyMatchup.win_probability ?? winProbData.winProbability;
              const winProbLabel =
                weeklyMatchup.win_probability_label ??
                winProbData.favorabilityLabel;
              const isFavorite = winProb >= 50.0;

              return (
                <div className="sm:col-span-1 flex flex-col items-center justify-center text-center py-1">
                  <span className="text-xs font-serif font-bold text-slate-400 px-2 py-1 rounded-full bg-slate-900 border border-white/10">
                    VS
                  </span>
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    <span
                      className={`text-xs font-mono font-bold ${isFavorite ? 'text-emerald-400' : 'text-purple-400'}`}>
                      {winProb.toFixed(1)}% Win Prob
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-cyan-300 font-semibold px-1 rounded bg-cyan-950/80 border border-cyan-500/30 max-w-[110px] truncate text-center block">
                      {winProbLabel}
                    </span>
                    {/* Visual Probability Bar Gauge */}
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFavorite
                            ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                            : 'bg-gradient-to-r from-purple-500 to-rose-400'
                        }`}
                        style={{
                          width: `${Math.min(Math.max(winProb, 5), 95)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Opponent Team */}
            <div className="sm:col-span-3 flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-white/10">
              <UserAvatar
                src={weeklyMatchup.opponent_team.avatar_url}
                alt={`${weeklyMatchup.opponent_team.team_name} avatar`}
                fallbackText={weeklyMatchup.opponent_team.team_name}
                size="lg"
                isUser={false}
                testId="matchup-summary-opp-avatar"
                data-testid="matchup-summary-opp-avatar"
              />
              <div className="min-w-0 flex-1">
                <div className="font-serif font-bold text-sm text-slate-200 truncate">
                  {weeklyMatchup.opponent_team.team_name}
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Mgr: {weeklyMatchup.opponent_team.owner_name}
                </div>
                <div className="text-sm font-mono font-bold text-purple-300 mt-0.5">
                  {weeklyMatchup.opponent_team.projected_points.toFixed(2)}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    Proj Pts
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Start / Sit Preview */}
          {weeklyMatchup.start_sit_recommendations &&
            weeklyMatchup.start_sit_recommendations.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    START
                  </span>
                  <span className="text-slate-200 font-bold">
                    {
                      weeklyMatchup.start_sit_recommendations[0]
                        ?.recommended_start?.name ||
                      (weeklyMatchup.start_sit_recommendations[0] as any)
                        ?.start_player_name ||
                      'Starter'
                    }
                  </span>
                  <span className="text-slate-500">vs</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    SIT
                  </span>
                  <span className="text-slate-400">
                    {
                      weeklyMatchup.start_sit_recommendations[0]
                        ?.recommended_sit?.name ||
                      (weeklyMatchup.start_sit_recommendations[0] as any)
                        ?.sit_player_name ||
                      'Bench Reserve'
                    }
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 italic">
                  {weeklyMatchup.start_sit_recommendations[0]?.synergy_reason ||
                    (weeklyMatchup.start_sit_recommendations[0] as any)?.rationale ||
                    ''}
                </span>
              </div>
            )}

          {/* Call-to-action to dedicated Matchups Screen */}
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Full celestial favorability comparison, stadium coordinates &
              player transits in Matchups tab
            </span>
            <button
              type="button"
              onClick={() => context.setTab?.('matchups' as any)}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/80 font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer">
              <span>
                View Full Celestial Matchup Analysis & Stadium Transits
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </GlassCard>
      )}

      {/* 2. Top Telemetry Bar */}
      <TelemetryBar
        totalProjectedPoints={totalProjectedPoints}
        totalVOR={totalVOR}
        elementalDistribution={elementalDistribution}
        activeStacks={activeAspects}
      />

      {/* 4. Harmony Score & Metaphysical Team Synergy */}
      <GlassCard variant="panel" className="p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Harmony Score & Metaphysical Team Synergy</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/30 text-amber-300">
                  {harmonyScore} / 100 HARMONY
                </span>
              </h3>
              <p className="text-[11px] font-sans text-slate-400">
                Holistic vibrational alignment across elemental balance,
                celestial aspect synergy, and schedule symmetry.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-full">
            RESONANCE ACTIVE
          </span>
        </div>

        {/* Harmony Explanation Guide (Collapsible Details for Less-is-More Decluttering) */}
        <details className="group rounded-xl bg-slate-950/60 border border-cyan-500/20 text-xs overflow-hidden transition-all">
          <summary className="p-3 font-mono text-cyan-300 font-semibold cursor-pointer hover:bg-white/5 flex items-center justify-between select-none">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>What is Harmony Score?</span>
            </span>
            <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <div className="p-3.5 pt-0 space-y-2 border-t border-white/5">
            <p className="font-sans text-slate-300 leading-relaxed">
              Harmony evaluates how well your roster functions as a synchronized
              metaphysical unit rather than a disconnected collection of
              isolated players. It synthesizes three core pillars:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-mono text-red-300 font-bold">
                  <Flame className="w-3 h-3 text-red-400" />
                  <span>1. Elemental Triplicity</span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-normal">
                  Diversification across Fire, Earth, Air, and Water prevents
                  systemic scoring slumps when unfavorable meteorological or
                  astrological transits occur.
                </p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-mono text-amber-300 font-bold">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>2. Celestial Conjunction & Major Aspects</span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-normal">
                  Harmonic angular geometries (trines, sextiles, and planetary
                  ruler conjunctions) align player etheric frequencies,
                  compounding collective momentum into exponential +27.0 astral
                  resonance ceilings.
                </p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-mono text-teal-300 font-bold">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  <span>3. Schedule Symmetry</span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-normal">
                  Staggering bye weeks ensures no starting position drops to
                  zero starters, preserving championship floor throughout weeks
                  5–14 and playoffs.
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
                      {aspect.multiplier}x Astral Harmonics (+
                      {aspect.bonus_points.toFixed(0)} Pts Resonance Ceiling)
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
                    Synchronized celestial wave alignment: Harmonic conjunction
                    between planetary rulers amplifies astral resonance and
                    compounding etheric output during high-leverage planetary
                    transits.
                  </p>
                </div>
              ))}

              {/* Elemental Synergy Callouts */}
              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-cyan-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-cyan-400" />
                    Fire & Air Kinetic Combustion
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    +15% Red Zone Bonus
                  </span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-relaxed">
                  Fire QB provides energetic offensive leadership while Air WR
                  creates separation on deep post routes, maximizing big-play
                  touchdown volume.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-teal-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-teal-400" />
                    Earth Bedrock Floor Anchoring
                  </span>
                  <span className="text-[10px] text-teal-300">
                    High Touch Floor
                  </span>
                </div>
                <p className="text-[10px] font-sans text-slate-400 leading-relaxed">
                  Workhorse RB touches protect your weekly floor from defensive
                  coverage shifts and poor weather environments.
                </p>
              </div>

              {/* Mathematically Linear Aspect Resonance Scale Gauge */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Linear Aspect Resonance Reader (0° to 180°)</span>
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {Math.min(180, Math.round(activeAspects.length * 60))}° (
                    {Math.min(
                      100,
                      Math.round((activeAspects.length / 3) * 100),
                    )}
                    %)
                  </span>
                </div>
                <div className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(8, (activeAspects.length / 3) * 100))}%`,
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
      </GlassCard>

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
                            {player.team} • Bye {player.bye_week}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-bold">
                              {(
                                player.projected_points ||
                                player.sleeper_projected_points ||
                                0
                              ).toFixed(1)}{' '}
                              pts
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-cyan-400 font-bold">
                              {player.draft_score.toFixed(1)} DS
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
                            {player.team} • Bye {player.bye_week}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-bold">
                              {(
                                player.projected_points ||
                                player.sleeper_projected_points ||
                                0
                              ).toFixed(1)}{' '}
                              pts
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-purple-300 font-bold">
                              {player.draft_score.toFixed(1)} DS
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
                  18-Week Bye Week Coverage & Schedule Matrix
                </h3>
                <p className="text-[11px] font-sans text-slate-400">
                  Simulated weekly starting lineups, conflict triage, and
                  championship playoff depth.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
              Weeks 1–18
            </span>
          </div>

          {/* 18-Week Coverage Detailed Explanation Box (Collapsible for Less-is-More Decluttering) */}
          <details className="group rounded-xl bg-slate-950/70 border border-purple-500/20 text-xs overflow-hidden transition-all">
            <summary className="p-3 font-mono text-purple-300 font-semibold cursor-pointer hover:bg-white/5 flex items-center justify-between select-none">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-400" />
                <span>Why 18-Week Coverage Matters</span>
              </span>
              <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="p-3.5 pt-0 space-y-2 border-t border-white/5">
              <p className="font-sans text-slate-300 leading-relaxed">
                The NFL regular season spans 18 weeks: fantasy regular season
                runs Weeks 1–14, followed by the Fantasy Playoffs (Weeks 15–17)
                and Week 18. NFL bye weeks occur between Weeks 5 and 14,
                temporarily removing players from active competition.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-0.5">
                  <span className="text-emerald-400 font-bold">
                    Full Roster (OK)
                  </span>
                  <p className="text-[10px] font-sans text-slate-400">
                    All starting positions active; full projected scoring output
                    unlocked.
                  </p>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-0.5">
                  <span className="text-amber-300 font-bold">
                    Conflict (Warning)
                  </span>
                  <p className="text-[10px] font-sans text-slate-400">
                    Multiple key starters share a bye week; monitor waiver wire
                    for spot starters.
                  </p>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-white/5 space-y-0.5">
                  <span className="text-cyan-300 font-bold">
                    Playoffs (W15–17)
                  </span>
                  <p className="text-[10px] font-sans text-slate-400">
                    Zero NFL byes; guarantees maximum starting power for
                    championship contention.
                  </p>
                </div>
              </div>
            </div>
          </details>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {weeklyCoverage.map((node) => {
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

      {/* 6.5 Celestial Leaderboard & Standings */}
      <CelestialLeaderboardGraph
        competitorTeams={competitorTeams}
        cosmicBoard={cosmicBoard}
        userSlot={userSlot}
      />

      {/* 7. Other Teams' States & League Draft Overview with Authentic Sleeper Team Names */}
      <GlassCard variant="panel" className="p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <div>
              <h3 className="font-serif text-lg font-bold text-slate-100">
                League Draft Status & Competitor Rosters
              </h3>
              <p className="text-[11px] font-sans text-slate-400">
                12-Team Sleeper League • Authentic Team Names & Draft Picks
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
            LIVE SYNC
          </span>
        </div>

        {/* SpiritScore Scale & Calibration Legend */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2 text-xs font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              SpiritScore & Harmony Calibration Spectrum
            </span>
            <span className="text-[10px] text-slate-400">
              Threshold Baseline: 75.0 Equilibrium Line
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-400 block">
                  ✨ Favorable (Apex)
                </span>
                <span className="text-slate-400 text-[9px]">
                  Score &ge; 85.0 • High Astral Resonance
                </span>
              </div>
              <span className="text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/30">
                Top Tier
              </span>
            </div>
            <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-500/30 flex items-center justify-between">
              <div>
                <span className="font-bold text-sky-400 block">
                  ⚖️ Harmonic (Stable)
                </span>
                <span className="text-slate-400 text-[9px]">
                  75.0 &ndash; 84.9 • Elemental Balance
                </span>
              </div>
              <span className="text-sky-300 font-bold px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-500/30">
                Mid Tier
              </span>
            </div>
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 flex items-center justify-between">
              <div>
                <span className="font-bold text-rose-400 block">
                  ⚠️ Discordant (At Risk)
                </span>
                <span className="text-slate-400 text-[9px]">
                  Score &lt; 75.0 • Astral Friction
                </span>
              </div>
              <span className="text-rose-300 font-bold px-1.5 py-0.5 rounded bg-rose-900/60 border border-rose-500/30">
                Low Tier
              </span>
            </div>
          </div>
        </div>

        {/* Competitor Rosters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(() => {
            return competitorTeams.map((team, idx) => {
              const slotNum = team.slot || team.roster_id || idx + 1;
              const isUser = slotNum === userSlot;
              const metrics = calculateTeamCelestialMetrics(team, cosmicBoard);
              const spiritScore = metrics.spiritScore;
              const draftScore = metrics.draftScore;
              const harmonyScore = metrics.harmonyScore;
              const tierInfo = classifySpiritScoreTier(spiritScore);
              const verdict = metrics.verdict;

              return (
                <div
                  key={team.roster_id || slotNum}
                  data-testid={
                    isUser
                      ? 'user-competitor-card'
                      : `competitor-card-slot-${slotNum}`
                  }
                  title={
                    isUser
                      ? 'Active Persona (You)'
                      : `${team.name} (Slot ${slotNum})`
                  }
                  className={`p-3.5 rounded-xl border text-xs font-mono space-y-2.5 transition-all relative ${
                    isUser
                      ? 'border-purple-400 ring-2 ring-purple-500/70 shadow-lg shadow-purple-500/25 bg-purple-950/40'
                      : tierInfo.tier === 'Favorable'
                        ? 'bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                        : tierInfo.tier === 'Discordant'
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-slate-900/60 border-white/10'
                  }`}>
                  {/* Top luminous accent line for user team */}
                  {isUser && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-amber-400 to-purple-500 rounded-t-xl" />
                  )}

                  {/* Team Header */}
                  <div
                    className={`flex items-center gap-2.5 border-b pb-2 ${
                      isUser ? 'border-purple-500/30' : 'border-white/5'
                    }`}>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Circular Avatar Thumbnail */}
                      <UserAvatar
                        src={team.avatar_url || team.avatar}
                        alt={`${team.owner_display_name || team.name} avatar`}
                        fallbackText={team.owner_display_name || team.name}
                        size="md"
                        isUser={isUser}
                        testId={`team-avatar-slot-${slotNum}`}
                        data-testid={`team-avatar-slot-${slotNum}`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            data-testid={`team-name-slot-${slotNum}`}
                            className={`font-bold break-words leading-snug ${
                              isUser
                                ? 'text-purple-200 font-extrabold text-sm drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                                : 'text-slate-200'
                            }`}>
                            {team.name}
                          </span>
                          {isUser && (
                            <span
                              data-testid="user-team-badge"
                              className="text-[10px] tracking-wide text-amber-200 bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-900 px-2.5 py-0.5 rounded-full border border-amber-400/80 shadow-[0_0_10px_rgba(234,179,8,0.4)] shrink-0 font-bold flex items-center gap-1">
                              YOUR TEAM
                            </span>
                          )}
                        </div>
                        {team.owner_display_name && (
                          <span className="text-[10px] text-slate-400 block break-words font-sans mt-0.5">
                            Mgr: {team.owner_display_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Team Aggregated Scores & Rating Table */}
                  <div
                    className={`p-2 rounded border space-y-1.5 ${
                      isUser
                        ? 'bg-purple-950/60 border-purple-500/30'
                        : 'bg-slate-950/60 border-white/5'
                    }`}>
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-[8px] font-mono uppercase tracking-wider text-slate-400">
                        Rating
                      </span>
                      <span
                        data-testid={`team-verdict-slot-${slotNum}`}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          tierInfo.tier === 'Favorable'
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : tierInfo.tier === 'Discordant'
                              ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                              : 'bg-sky-950/80 border-sky-500/40 text-sky-300'
                        }`}>
                        {verdict || tierInfo.badgeLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">
                          Spirit
                        </span>
                        <strong
                          className={`font-bold ${
                            tierInfo.tier === 'Favorable'
                              ? 'text-emerald-300'
                              : tierInfo.tier === 'Discordant'
                                ? 'text-rose-300'
                                : 'text-purple-300'
                          }`}>
                          {spiritScore.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">
                          Draft
                        </span>
                        <strong
                          className={
                            isUser
                              ? 'text-amber-300 font-bold'
                              : 'text-cyan-300 font-bold'
                          }>
                          {draftScore.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">
                          Harmony
                        </span>
                        <strong className="text-amber-300 font-bold">
                          {harmonyScore.toFixed(0)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Visual Equilibrium Mini-Gauge (75.0 line of equilibrium) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                      <span>Equilibrium (75.0)</span>
                      <span
                        className={
                          spiritScore >= 75.0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }>
                        {spiritScore >= 75.0
                          ? `+${(spiritScore - 75.0).toFixed(1)}`
                          : (spiritScore - 75.0).toFixed(1)}
                      </span>
                    </div>
                    <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                      {/* 75.0 Equilibrium Marker Line at 50% relative to 50-100 scale */}
                      <div
                        className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 z-10"
                        title="75.0 Equilibrium"
                      />
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          tierInfo.tier === 'Favorable'
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                            : tierInfo.tier === 'Discordant'
                              ? 'bg-gradient-to-r from-rose-600 to-amber-500'
                              : 'bg-gradient-to-r from-sky-500 to-blue-400'
                        }`}
                        style={{
                          width: `${Math.min(Math.max(((spiritScore - 50) / 50) * 100, 5), 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Picks list */}
                  <div className="space-y-1 pt-1">
                    {team.picks && team.picks.length > 0 ? (
                      team.picks.map((pick) => (
                        <div
                          key={pick.pick_no}
                          className="flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <PositionalBadge
                              position={pick.metadata.position}
                              size="sm"
                            />
                            <span className="text-slate-300 truncate">
                              {pick.metadata.first_name}{' '}
                              {pick.metadata.last_name}
                            </span>
                          </div>
                          <span className="text-slate-500 shrink-0 ml-1">
                            Rd {pick.round} (#{pick.pick_no})
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 italic">
                        No picks registered yet
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </GlassCard>

      {/* 8. Path of Ascension Timeline (Read-Only) with Collapsible Toggle */}
      {!isAscensionExpanded ? (
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
      )}

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
