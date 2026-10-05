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
import {useOneiromancy} from '@/context/OneiromancyContext';
import {
  mockMatchupWeeks,
  mockPastMatchups,
  mockPlayerFavorabilities,
  mockTeamComparison,
  mockWeeklyMatchup,
} from '@/lib/mockData';
import {calculateWinProbability} from '@/lib/scoring';
import {deriveEligiblePositions, deriveWeeklyMatchup} from '@/lib/sleeper';
import {
  MatchupWeekData,
  NFLPosition,
  PlayerMatchupFavorability,
  TeamCelestialComparison,
  WeeklyMatchup,
} from '@/types/oneiromancy';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Droplet,
  Flame,
  MapPin,
  Moon,
  Mountain,
  Shield,
  Sparkles,
  Sun,
  Swords,
  TrendingUp,
  Wind,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';

export interface MatchupsScreenProps {
  weeklyMatchup?: WeeklyMatchup | null;
  className?: string;
}

export const MatchupsScreen: React.FC<MatchupsScreenProps> = ({
  weeklyMatchup: propWeeklyMatchup,
  className = '',
}) => {
  const context = useOneiromancy();
  const resolveActiveMatchupWeek = useCallback(() => {
    if (propWeeklyMatchup?.week) return propWeeklyMatchup.week;
    if (context.draftState?.weekly_matchup?.week) {
      return context.draftState.weekly_matchup.week;
    }
    const upcoming = context.draftState?.weekly_matchup?.upcoming_matchups;
    if (upcoming && upcoming.length > 0) {
      const activeMatch = upcoming.find((m) => m.status === 'active');
      if (activeMatch) return activeMatch.week;
      const upcomingMatch = upcoming.find((m) => m.is_upcoming);
      if (upcomingMatch) return upcomingMatch.week;
      return upcoming[0].week;
    }
    return 1;
  }, [
    propWeeklyMatchup?.week,
    context.draftState?.weekly_matchup?.week,
    context.draftState?.weekly_matchup?.upcoming_matchups,
  ]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() =>
    resolveActiveMatchupWeek(),
  );

  useEffect(() => {
    if (propWeeklyMatchup?.week) {
      setSelectedWeek(propWeeklyMatchup.week);
    }
  }, [propWeeklyMatchup?.week]);

  useEffect(() => {
    if (!propWeeklyMatchup?.week && context.draftState?.weekly_matchup?.week) {
      setSelectedWeek(resolveActiveMatchupWeek());
    }
  }, [
    propWeeklyMatchup?.week,
    context.draftState?.weekly_matchup?.week,
    resolveActiveMatchupWeek,
  ]);

  const matchupData = useMemo(() => {
    if (propWeeklyMatchup) return propWeeklyMatchup;
    const activeSlot =
      context.userSlot || context.draftState?.settings?.user_slot || 7;
    const activeUserTeam = context.draftState?.competitor_teams?.find(
      (t) => t.is_user,
    );
    const activeRosterId =
      activeUserTeam?.roster_id ?? context.userRosterId ?? activeSlot;

    const existingMatchup = context.draftState?.weekly_matchup;
    if (
      existingMatchup &&
      existingMatchup.user_team &&
      (existingMatchup.user_team.roster_id === activeRosterId ||
        existingMatchup.user_team.slot === activeSlot) &&
      (!selectedWeek || existingMatchup.week === selectedWeek)
    ) {
      return existingMatchup;
    }

    if (
      existingMatchup &&
      existingMatchup.upcoming_matchups &&
      existingMatchup.upcoming_matchups.length > 0 &&
      selectedWeek &&
      selectedWeek !== existingMatchup.week
    ) {
      const matchForWeek = existingMatchup.upcoming_matchups.find(
        (w) => w.week === selectedWeek,
      );
      if (matchForWeek) {
        const hasLiveTeams =
          Array.isArray(context.draftState?.competitor_teams) &&
          context.draftState!.competitor_teams.length > 0;
        const derivedForWeek = hasLiveTeams
          ? deriveWeeklyMatchup(
              activeRosterId,
              context.draftState!.competitor_teams,
              null,
              context.draftState?.cosmic_board,
              context.draftState?.my_roster,
              selectedWeek,
            )
          : null;
        return {
          ...existingMatchup,
          week: matchForWeek.week,
          matchup_id: matchForWeek.matchup_id || existingMatchup.matchup_id,
          opponent_team:
            matchForWeek.opponent_team ||
            derivedForWeek?.opponent_team ||
            existingMatchup.opponent_team,
          win_probability:
            matchForWeek.win_probability ??
            derivedForWeek?.win_probability ??
            existingMatchup.win_probability,
          win_probability_label:
            matchForWeek.win_probability_label ??
            derivedForWeek?.win_probability_label ??
            existingMatchup.win_probability_label,
          team_comparison:
            matchForWeek.team_comparison ||
            derivedForWeek?.team_comparison ||
            existingMatchup.team_comparison,
          player_favorabilities:
            derivedForWeek?.player_favorabilities &&
            derivedForWeek.player_favorabilities.length > 0
              ? derivedForWeek.player_favorabilities
              : matchForWeek.player_favorabilities &&
                  matchForWeek.player_favorabilities.length > 0
                ? matchForWeek.player_favorabilities
                : existingMatchup.player_favorabilities,
        };
      }
    }

    if (
      context.draftState?.competitor_teams &&
      context.draftState.competitor_teams.length > 0
    ) {
      return deriveWeeklyMatchup(
        activeRosterId,
        context.draftState.competitor_teams,
        null,
        context.draftState.cosmic_board,
        context.draftState.my_roster,
        selectedWeek || 1,
      );
    }
    if (existingMatchup) return existingMatchup;
    const isLive = Boolean(
      context.draftState?.isLive || context.draftState?.mode === 'live',
    );
    return isLive ? ({} as WeeklyMatchup) : mockWeeklyMatchup;
  }, [
    propWeeklyMatchup,
    context.draftState?.weekly_matchup,
    context.draftState?.settings?.user_slot,
    context.draftState?.competitor_teams,
    context.draftState?.cosmic_board,
    context.draftState?.my_roster,
    context.draftState?.isLive,
    context.draftState?.mode,
    selectedWeek,
  ]);
  const [teamFilter, setTeamFilter] = useState<'all' | 'user' | 'opponent'>(
    'all',
  );
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  const isLiveMode = Boolean(
    context.draftState?.isLive || context.draftState?.mode === 'live',
  );

  const teamComparison: TeamCelestialComparison = useMemo(() => {
    return (
      matchupData.team_comparison ||
      (isLiveMode ? ({} as TeamCelestialComparison) : mockTeamComparison)
    );
  }, [matchupData.team_comparison, isLiveMode]);

  const playerFavorabilities: PlayerMatchupFavorability[] = useMemo(() => {
    return (
      matchupData.player_favorabilities ||
      (isLiveMode ? [] : mockPlayerFavorabilities) ||
      []
    );
  }, [matchupData.player_favorabilities, isLiveMode]);

  const matchupWeeks: MatchupWeekData[] = useMemo(() => {
    return (
      matchupData.upcoming_matchups || (isLiveMode ? [] : mockMatchupWeeks)
    );
  }, [matchupData.upcoming_matchups, isLiveMode]);

  const pastMatchups = useMemo(() => {
    return matchupData.past_matchups || (isLiveMode ? [] : mockPastMatchups);
  }, [matchupData.past_matchups, isLiveMode]);

  // Current active week data
  const currentWeekInfo = useMemo(() => {
    const found = matchupWeeks.find((w) => w.week === selectedWeek);
    if (found) return found;
    return {
      week: selectedWeek,
      opponent_name: matchupData.opponent_team?.team_name || 'Opponent',
      opponent_owner: matchupData.opponent_team?.owner_name || 'Opponent',
      status:
        selectedWeek === (context.draftState?.weekly_matchup?.week || 2)
          ? ('active' as const)
          : selectedWeek < (context.draftState?.weekly_matchup?.week || 2)
            ? ('completed' as const)
            : ('upcoming' as const),
      date_range: 'Sep 4 - Sep 8, 2025',
    };
  }, [
    matchupWeeks,
    selectedWeek,
    matchupData,
    context.draftState?.weekly_matchup?.week,
  ]);

  // Win probability calculation
  const winProbCalc = useMemo(() => {
    const calc = calculateWinProbability(
      matchupData.user_team?.projected_points ?? 125.0,
      matchupData.opponent_team?.projected_points ?? 125.0,
      matchupData.user_team?.harmony_score ?? 80.0,
      matchupData.opponent_team?.harmony_score ?? 80.0,
    );
    const winProb = matchupData.win_probability ?? calc.winProbability;
    const label = matchupData.win_probability_label ?? calc.favorabilityLabel;
    return {winProb, label, isFavorite: winProb >= 50.0};
  }, [matchupData]);

  const rawRosterPositions =
    context.draftState?.roster_positions ||
    context.draftState?.settings?.roster_positions;
  const allRoster = context.draftState?.my_roster;

  const leagueEligiblePositions = useMemo(() => {
    return deriveEligiblePositions(rawRosterPositions, allRoster);
  }, [rawRosterPositions, allRoster]);

  // Filtered players
  const filteredPlayers = useMemo(() => {
    return playerFavorabilities.filter((p) => {
      if (teamFilter === 'user' && !p.is_user_team) return false;
      if (teamFilter === 'opponent' && p.is_user_team) return false;
      if (positionFilter !== 'ALL' && p.position !== positionFilter)
        return false;
      // Strictly exclude any positions not eligible in active league
      if (!leagueEligiblePositions.includes(p.position)) return false;
      return true;
    });
  }, [
    playerFavorabilities,
    teamFilter,
    positionFilter,
    leagueEligiblePositions,
  ]);

  const userStarters = useMemo(() => {
    return filteredPlayers.filter((p) => p.is_user_team && !p.is_benched);
  }, [filteredPlayers]);

  const userBench = useMemo(() => {
    return filteredPlayers.filter((p) => p.is_user_team && p.is_benched);
  }, [filteredPlayers]);

  const oppStarters = useMemo(() => {
    return filteredPlayers.filter((p) => !p.is_user_team && !p.is_benched);
  }, [filteredPlayers]);

  const oppBench = useMemo(() => {
    return filteredPlayers.filter((p) => !p.is_user_team && p.is_benched);
  }, [filteredPlayers]);

  const renderPlayerCard = (
    player: PlayerMatchupFavorability,
    isMutedBench: boolean = false,
    cardIdx: number = 0,
  ) => {
    const isFavored =
      player.favorability_verdict === 'HEAVILY FAVORED' ||
      player.favorability_verdict === 'ASTRALLY FAVORED' ||
      (player.favorability_verdict as string) === 'FAVORED';
    const isUnfavored =
      player.favorability_verdict === 'CELESTIALLY CHALLENGED' ||
      (player.favorability_verdict as string) === 'UNFAVORED';

    const venueBonus = player.stadium?.roof_type?.includes('Dome') ? 5.0 : 10.0;
    const baseSpirit =
      player.base_spirit ??
      Math.round((player.spirit_score ?? 85.0) * 0.8 * 10) / 10;
    const healthPen = player.health_penalty ?? 0.0;
    const transitMod =
      player.role_modifier !== undefined
        ? player.role_modifier
        : Math.round(
            (player.favorability_score - baseSpirit - healthPen - venueBonus) *
              10,
          ) / 10;

    return (
      <GlassCard
        key={`${selectedWeek}-${player.is_user_team ? 'u' : 'o'}-${player.player_id}-${cardIdx}`}
        variant="panel"
        className={`p-3.5 space-y-2.5 transition-all ${
          isMutedBench
            ? 'opacity-70 bg-slate-950/40 border-white/5 hover:opacity-100 hover:border-white/20'
            : player.is_user_team
              ? 'border-cyan-500/30 hover:border-cyan-500/50 bg-slate-900/60'
              : 'border-purple-500/30 hover:border-purple-500/50 bg-slate-900/60'
        }`}>
        {/* Player Top Line */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <PositionalBadge position={player.position} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-serif font-bold text-sm text-slate-100 truncate">
                  {player.player_name}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {player.nfl_team || player.team}
                </span>
                <span
                  className={`text-[8px] font-mono uppercase px-1 rounded ${
                    player.is_user_team
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                  {player.is_user_team ? 'YOU' : 'OPP'}
                </span>
                {isMutedBench && (
                  <span className="text-[8px] font-mono uppercase px-1 rounded bg-slate-800 text-slate-400 border border-white/10">
                    BENCH
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                Opp: vs {player.opponent_team || player.opponent} •{' '}
                {(
                  player.projected_points ??
                  (player.favorability_score
                    ? player.favorability_score * 0.18
                    : 12.0)
                ).toFixed(1)}{' '}
                Proj Pts
              </div>
            </div>
          </div>

          {/* Favorability Score & Verdict */}
          <div className="text-right flex flex-col items-end shrink-0">
            <span
              className={`text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isFavored
                  ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                  : isUnfavored
                    ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                    : 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
              }`}>
              {isFavored ? (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              )}
              <span>{player.favorability_verdict}</span>
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
              {player.favorability_score.toFixed(1)} / 100
            </span>
          </div>
        </div>

        {/* Collapsible Astrological & Stadium Details */}
        <details className="group mt-1 text-slate-300">
          <summary className="cursor-pointer text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center justify-between py-1 px-2 rounded bg-slate-950/40 border border-white/5 list-none">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Alignment & Stadium Telemetry</span>
            </span>
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform text-slate-400" />
          </summary>

          <div className="mt-2 space-y-2 pt-1 border-t border-white/5">
            {/* Stadium & Location Metadata */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
              <div className="space-y-1">
                <div className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">
                    {player.stadium.stadium_name}
                  </span>
                </div>
                <div className="text-slate-500 text-[10px]">
                  {player.stadium.city}, {player.stadium.state}
                </div>
                <div className="text-slate-400 text-[10px]">
                  Coords:{' '}
                  {(
                    player.stadium.latitude ??
                    player.stadium.coordinates?.lat ??
                    0
                  ).toFixed(4)}
                  ° N,{' '}
                  {Math.abs(
                    player.stadium.longitude ??
                      player.stadium.coordinates?.lon ??
                      0,
                  ).toFixed(4)}
                  ° W
                </div>
              </div>

              <div className="space-y-1 border-l border-white/5 pl-2">
                <div className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">
                    {player.game_kickoff ||
                      `${player.game_date || ''} • ${player.kickoff_time || ''}`}
                  </span>
                </div>
                <div className="text-slate-500 text-[10px]">
                  Roof: {player.stadium.roof_type}
                </div>
                <div className="text-purple-300 text-[10px] flex items-center gap-1">
                  <Moon className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                  <span className="truncate">{player.lunar_phase}</span>
                </div>
              </div>
            </div>

            {/* Planetary Hour & Astrological Transit */}
            <div className="flex items-center justify-between text-[10px] font-mono px-2 py-1 rounded bg-slate-900/50 border border-white/5">
              <span className="text-amber-300 flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Planetary Hour: {player.planetary_hour}</span>
              </span>
              <span className="text-cyan-300 truncate ml-2">
                Transit:{' '}
                {player.astrological_transit ||
                  player.aspect_highlights?.join(' • ') ||
                  'Aligned'}
              </span>
            </div>

            {/* Favorability Score Contribution Breakdown Ledger */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/10 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-1">
                <span className="font-bold text-cyan-300 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  <span>Favorability Impact Breakdown</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  Target: {player.favorability_score.toFixed(1)} / 100
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                <div className="p-1.5 rounded bg-slate-900/60 border border-white/5">
                  <span className="text-slate-500 block">Base Spirit</span>
                  <span className="text-purple-300 font-bold">
                    +{baseSpirit.toFixed(1)}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-900/60 border border-white/5">
                  <span className="text-slate-500 block">Astral Transit</span>
                  <span
                    className={`font-bold ${
                      transitMod >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                    {transitMod >= 0 ? '+' : ''}
                    {transitMod.toFixed(1)} Transit
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-900/60 border border-white/5">
                  <span className="text-slate-500 block">Health & Proj</span>
                  <span
                    className={`font-bold ${
                      healthPen < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                    {healthPen < 0
                      ? `${healthPen.toFixed(1)} Injury / Out`
                      : '+0.0 Active Health'}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-900/60 border border-white/5">
                  <span className="text-slate-500 block">Venue Feng Shui</span>
                  <span className="text-cyan-300 font-bold truncate block">
                    {player.stadium.roof_type?.includes('Dome')
                      ? '+5.0 Dome'
                      : '+10.0 Open'}
                  </span>
                </div>
              </div>
            </div>

            {/* Astrological Rationale - Color Coded by Verdict */}
            <div
              className={`text-xs font-sans leading-relaxed p-2.5 rounded-lg border flex items-start gap-2 ${
                isUnfavored
                  ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                  : isFavored
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              }`}>
              {isUnfavored ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              ) : isFavored ? (
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span>
                {player.astrological_rationale ||
                  player.rationale ||
                  player.aspect_description ||
                  `${player.player_name} channels celestial alignment for this contest.`}
              </span>
            </div>
          </div>
        </details>
      </GlassCard>
    );
  };

  return (
    <div
      className={`flex flex-col gap-6 w-full max-w-5xl mx-auto ${className}`}>
      {/* Title & Introduction */}
      <div className="text-center space-y-1">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide flex items-center justify-center gap-2">
          <Swords className="w-6 h-6 text-cyan-400" />
          <span>Celestial Matchup Divination</span>
        </h2>
        <p className="text-xs text-slate-400 max-w-xl mx-auto font-sans">
          Astrological favorability comparison by team, plus stadium
          geographical coordinates, kickoff transits, and lunar alignment for
          every starting warrior.
        </p>
      </div>

      {/* Weekly Favorability Score Definition & Guide */}
      <GlassCard
        variant="panel"
        className="p-3.5 sm:p-4 rounded-xl border-cyan-500/20 bg-slate-950/70">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <h3 className="font-serif font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>
                  Understanding Weekly Favorability & Stadium Telemetry
                </span>
              </h3>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                Micro-Tactical Metric (0–100)
              </span>
            </div>
            <p className="text-xs font-sans text-slate-300 leading-relaxed">
              Unlike the macro season-long <strong>DraftScore</strong> (which
              measures overall draft asset value), the{' '}
              <strong>Weekly Favorability Score</strong> calculates tactical
              matchup viability for the current week based on four dynamic
              factors:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5">
                <span className="text-purple-300 font-bold block">
                  1. Spirit Baseline (80%)
                </span>
                <span className="text-slate-400 text-[10px]">
                  Natal birth chart, elemental traits & decan rulers
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5">
                <span className="text-cyan-300 font-bold block">
                  2. Stadium Feng Shui
                </span>
                <span className="text-slate-400 text-[10px]">
                  Leyline geodesic distance, roof exposure & field axis
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5">
                <span className="text-emerald-400 font-bold block">
                  3. Astral Transit
                </span>
                <span className="text-slate-400 text-[10px]">
                  Kickoff planetary trines (+boost) vs squares (-friction)
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5">
                <span className="text-rose-400 font-bold block">
                  4. Health / Inactivity Drag
                </span>
                <span className="text-slate-400 text-[10px]">
                  -22.0 Penalty for Out / IR / inactive status
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 font-mono text-[10px] text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <strong className="text-emerald-300">
                  ≥84 HEAVILY FAVORED
                </strong>{' '}
                (Apex Matchup Alignment)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <strong className="text-amber-300">
                  75–83 ASTRALLY FAVORED
                </strong>{' '}
                (Solid Harmonic Alignment)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <strong className="text-rose-300">
                  &lt;75 CELESTIALLY CHALLENGED
                </strong>{' '}
                (Planetary Friction / Injury Risk)
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Week Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/90 border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {matchupWeeks.map((w) => (
            <button
              key={w.week}
              type="button"
              onClick={() => setSelectedWeek(w.week)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                selectedWeek === w.week
                  ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}>
              <span>Week {w.week}</span>
              {w.status === 'active' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-2">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>{currentWeekInfo.date_range}</span>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
            {currentWeekInfo.status}
          </span>
        </div>
      </div>

      {/* Team Celestial Comparison Card */}
      <GlassCard
        variant="panel"
        className="p-5 sm:p-6 space-y-6 border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.12)]">
        {/* Matchup Duel Head-to-Head Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-4 items-center bg-slate-950/70 p-4 rounded-xl border border-white/5">
          {/* User Team */}
          <div className="sm:col-span-3 flex items-center gap-3.5 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
            <UserAvatar
              src={
                matchupData.user_team.avatar_url || matchupData.user_team.avatar
              }
              alt={`${matchupData.user_team.team_name} avatar`}
              fallbackText={matchupData.user_team.team_name}
              size="xl"
              isUser={true}
              testId="user-team-avatar"
              data-testid="user-team-avatar"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-base text-cyan-200 truncate">
                  {matchupData.user_team.team_name}
                </span>
                <span className="text-[9px] font-mono uppercase px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  YOU
                </span>
              </div>
              <div className="text-xs font-mono text-slate-400 truncate">
                Mgr: {matchupData.user_team.owner_name}
              </div>
              <div className="text-base font-mono font-bold text-cyan-400 mt-0.5">
                {matchupData.user_team.projected_points.toFixed(2)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  Proj Pts
                </span>
              </div>
            </div>
          </div>

          {/* VS Gauge */}
          <div className="sm:col-span-1 flex flex-col items-center justify-center text-center py-2">
            <span className="text-xs font-serif font-bold text-slate-400 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10">
              VS
            </span>
            <div className="mt-2 flex flex-col items-center gap-1">
              <span
                className={`text-xs font-mono font-bold ${
                  winProbCalc.isFavorite
                    ? 'text-emerald-400'
                    : 'text-purple-400'
                }`}>
                {winProbCalc.winProb.toFixed(1)}% Win Prob
              </span>
              <span className="text-[8px] font-mono uppercase tracking-wider text-cyan-300 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 max-w-[110px] truncate text-center block">
                {winProbCalc.label}
              </span>
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    winProbCalc.isFavorite
                      ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                      : 'bg-gradient-to-r from-purple-500 to-rose-400'
                  }`}
                  style={{
                    width: `${Math.min(Math.max(winProbCalc.winProb, 5), 95)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Opponent Team */}
          <div className="sm:col-span-3 flex items-center gap-3.5 p-3 rounded-xl bg-purple-950/20 border border-purple-500/30">
            <UserAvatar
              src={
                matchupData.opponent_team.avatar_url ||
                matchupData.opponent_team.avatar
              }
              alt={`${matchupData.opponent_team.team_name} avatar`}
              fallbackText={matchupData.opponent_team.team_name}
              size="xl"
              isUser={false}
              testId="opponent-team-avatar"
              data-testid="opponent-team-avatar"
            />
            <div className="min-w-0 flex-1">
              <div className="font-serif font-bold text-base text-purple-200 truncate">
                {matchupData.opponent_team.team_name}
              </div>
              <div className="text-xs font-mono text-slate-400 truncate">
                Mgr: {matchupData.opponent_team.owner_name}
              </div>
              <div className="text-base font-mono font-bold text-purple-300 mt-0.5">
                {matchupData.opponent_team.projected_points.toFixed(2)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  Proj Pts
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team-Level Astrological Comparison Metrics & Head-to-Head Advantage Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono uppercase text-cyan-300 font-semibold tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Team Celestial Telemetry & Astral Favorability Index
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Ephemeris Calibration
            </span>
          </div>

          {(() => {
            const userAstral =
              teamComparison.user_astral_favorability ??
              teamComparison.user_favorability_index ??
              92.4;
            const oppAstral =
              teamComparison.opponent_astral_favorability ??
              teamComparison.opponent_favorability_index ??
              68.1;
            const isUserAstralLead = userAstral > oppAstral;
            const isOppAstralLead = oppAstral > userAstral;
            const astralDelta = Math.abs(userAstral - oppAstral);

            const userHarmony =
              teamComparison.user_harmony_score ??
              matchupData.user_team.harmony_score ??
              85.0;
            const oppHarmony =
              teamComparison.opponent_harmony_score ??
              matchupData.opponent_team.harmony_score ??
              78.0;
            const isUserHarmonyLead = userHarmony > oppHarmony;
            const isOppHarmonyLead = oppHarmony > userHarmony;
            const harmonyDelta = Math.abs(userHarmony - oppHarmony);

            const userProj = matchupData.user_team.projected_points;
            const oppProj = matchupData.opponent_team.projected_points;
            const isUserProjLead = userProj > oppProj;
            const projDelta = Math.abs(userProj - oppProj);

            const userElemental =
              teamComparison.elemental_dominance?.user ||
              teamComparison.user_elemental_dominance ||
              'Fire & Air';
            const oppElemental =
              teamComparison.elemental_dominance?.opponent ||
              teamComparison.opponent_elemental_dominance ||
              'Earth & Water';

            const getTierLabel = (score: number) => {
              if (score >= 85) return 'Apex Harmony';
              if (score >= 75) return 'Harmonic Balance';
              return 'Discordant Risk';
            };

            const userTeamName =
              matchupData.user_team?.team_name || 'Your Team';
            const oppTeamName =
              matchupData.opponent_team?.team_name || 'Opponent';

            // Derive dynamic advantages and vulnerabilities for each team
            const userAdvantages: string[] = [];
            const userDisadvantages: string[] = [];
            const oppAdvantages: string[] = [];
            const oppDisadvantages: string[] = [];

            // Projected points comparison
            if (isUserProjLead && projDelta >= 0.5) {
              userAdvantages.push(
                `+${projDelta.toFixed(1)} Projected Points edge over ${oppTeamName}`,
              );
              oppDisadvantages.push(
                `-${projDelta.toFixed(1)} Projected Points deficit against ${userTeamName}`,
              );
            } else if (!isUserProjLead && projDelta >= 0.5) {
              oppAdvantages.push(
                `+${projDelta.toFixed(1)} Projected Points edge over ${userTeamName}`,
              );
              userDisadvantages.push(
                `-${projDelta.toFixed(1)} Projected Points deficit against ${oppTeamName}`,
              );
            }

            // Astral Favorability comparison
            if (isUserAstralLead && astralDelta >= 1.0) {
              userAdvantages.push(
                `+${astralDelta.toFixed(1)}% Astral Favorability alignment advantage`,
              );
              oppDisadvantages.push(
                `-${astralDelta.toFixed(1)}% Astral alignment deficit in celestial transits`,
              );
            } else if (isOppAstralLead && astralDelta >= 1.0) {
              oppAdvantages.push(
                `+${astralDelta.toFixed(1)}% Astral Favorability alignment advantage`,
              );
              userDisadvantages.push(
                `-${astralDelta.toFixed(1)}% Astral alignment deficit in celestial transits`,
              );
            }

            // Squad Harmony comparison
            if (isUserHarmonyLead && harmonyDelta >= 1.0) {
              userAdvantages.push(
                `+${harmonyDelta.toFixed(1)} Squad Harmony rating (${getTierLabel(userHarmony)})`,
              );
              oppDisadvantages.push(
                `-${harmonyDelta.toFixed(1)} Squad Harmony differential vs ${userTeamName}`,
              );
            } else if (isOppHarmonyLead && harmonyDelta >= 1.0) {
              oppAdvantages.push(
                `+${harmonyDelta.toFixed(1)} Squad Harmony rating (${getTierLabel(oppHarmony)})`,
              );
              userDisadvantages.push(
                `-${harmonyDelta.toFixed(1)} Squad Harmony differential vs ${oppTeamName}`,
              );
            }

            // Elemental synergy & containment
            userAdvantages.push(
              `${userElemental} elemental synergy with kinetic momentum`,
            );
            oppAdvantages.push(
              `${oppElemental} elemental resilience with high containment`,
            );

            if (userHarmony < 75) {
              userDisadvantages.push(
                `Roster cohesion risk (${userHarmony.toFixed(1)}/100 · Discordant)`,
              );
            }
            if (oppHarmony < 75) {
              oppDisadvantages.push(
                `Roster cohesion risk (${oppHarmony.toFixed(1)}/100 · Discordant)`,
              );
            }

            const isUserLead = isUserAstralLead;
            const isOppLead = isOppAstralLead;
            // prettier-ignore
            const astralUserClass = isUserLead ? 'text-emerald-400' : 'text-slate-300';
            // prettier-ignore
            const astralOppClass = isOppLead ? 'text-emerald-400' : 'text-slate-300';
            // prettier-ignore
            const harmonyUserClass = isUserHarmonyLead ? 'text-emerald-400 font-extrabold' : 'text-slate-400';
            // prettier-ignore
            const harmonyOppClass = isOppHarmonyLead ? 'text-emerald-400 font-extrabold' : 'text-slate-400';

            return (
              <div className="space-y-4">
                {/* 3 Balanced Telemetry Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Astral Favorability Index Card */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-slate-400">
                        Astral Favorability Index
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Transit Alignment
                      </span>
                    </div>
                    <div className="grid grid-cols-5 items-center text-center">
                      <div className="col-span-2 text-left">
                        <div
                          className={`text-lg font-mono font-bold ${astralUserClass}`}>
                          {userAstral.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {userTeamName}
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <span className="text-xs font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                          vs
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <div
                          className={`text-lg font-mono font-bold ${astralOppClass}`}>
                          {oppAstral.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {oppTeamName}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden flex">
                      <div
                        className="bg-purple-500 transition-all"
                        style={{
                          width: `${(userAstral / (userAstral + oppAstral)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-cyan-500 transition-all"
                        style={{
                          width: `${(oppAstral / (userAstral + oppAstral)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Squad Harmony Rating Card */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-slate-400">
                        Squad Harmony Rating
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Roster Cohesion
                      </span>
                    </div>
                    <div className="grid grid-cols-5 items-center text-center">
                      <div className="col-span-2 text-left">
                        <div
                          className={`text-lg font-mono font-bold ${harmonyUserClass}`}>
                          {userHarmony.toFixed(1)}
                          <span className="text-xs font-normal text-slate-500">
                            {' '}
                            /100
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {getTierLabel(userHarmony)}
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <span className="text-xs font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                          vs
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <div
                          className={`text-lg font-mono font-bold ${harmonyOppClass}`}>
                          {oppHarmony.toFixed(1)}
                          <span className="text-xs font-normal text-slate-500">
                            {' '}
                            /100
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {getTierLabel(oppHarmony)}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden flex">
                      <div
                        className="bg-purple-500 transition-all"
                        style={{
                          width: `${(userHarmony / (userHarmony + oppHarmony)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-cyan-500 transition-all"
                        style={{
                          width: `${(oppHarmony / (userHarmony + oppHarmony)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Elemental Dominance Card */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-slate-400">
                        Elemental Dominance
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Synergy Matrix
                      </span>
                    </div>
                    <div className="grid grid-cols-5 items-center text-center">
                      <div className="col-span-2 text-left">
                        <div className="text-sm font-mono font-bold text-purple-300">
                          {userElemental}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {userTeamName}
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <span className="text-xs font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                          vs
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="text-sm font-mono font-bold text-cyan-300">
                          {oppElemental}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {oppTeamName}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono text-center pt-1 border-t border-white/5">
                      Kinetic synergy & containment balance
                    </div>
                  </div>
                </div>

                {/* Head-to-Head Comparative Advantages & Disadvantages Breakdown */}
                <div className="rounded-xl bg-slate-900/40 border border-white/10 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-amber-400" />
                      <span>Comparative Advantages & Vulnerabilities</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Head-to-Head Matchup Breakdown
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* User Team Advantage / Disadvantage Column */}
                    <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-purple-200 truncate">
                          {userTeamName}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Your Roster
                        </span>
                      </div>

                      {/* Advantages */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono font-semibold uppercase text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Key Advantages</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] font-mono text-slate-300">
                          {userAdvantages.map((adv, idx) => (
                            <li key={idx} className="leading-tight">
                              {adv}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Disadvantages / Risks */}
                      {userDisadvantages.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-white/5">
                          <div className="text-[10px] font-mono font-semibold uppercase text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>Vulnerabilities & Risks</span>
                          </div>
                          <ul className="space-y-1 pl-4 list-disc text-[11px] font-mono text-slate-300">
                            {userDisadvantages.map((dis, idx) => (
                              <li
                                key={idx}
                                className="leading-tight text-rose-200/90">
                                {dis}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Opponent Team Advantage / Disadvantage Column */}
                    <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-cyan-200 truncate">
                          {oppTeamName}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Opponent
                        </span>
                      </div>

                      {/* Advantages */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono font-semibold uppercase text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Key Advantages</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] font-mono text-slate-300">
                          {oppAdvantages.map((adv, idx) => (
                            <li key={idx} className="leading-tight">
                              {adv}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Disadvantages / Risks */}
                      {oppDisadvantages.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-white/5">
                          <div className="text-[10px] font-mono font-semibold uppercase text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>Vulnerabilities & Risks</span>
                          </div>
                          <ul className="space-y-1 pl-4 list-disc text-[11px] font-mono text-slate-300">
                            {oppDisadvantages.map((dis, idx) => (
                              <li
                                key={idx}
                                className="leading-tight text-rose-200/90">
                                {dis}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Celestial Conjunctions */}
                <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-1.5">
                  <div className="text-xs font-mono text-cyan-300 font-semibold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Active Transits & Conjunctions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      teamComparison.celestial_conjunctions ||
                      ([
                        teamComparison.user_celestial_conjunction,
                        teamComparison.opponent_celestial_conjunction,
                      ].filter(Boolean) as string[])
                    ).map((conj, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-slate-900/80 border border-white/10 text-[11px] font-mono text-slate-300">
                        ✨ {conj}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 font-sans mt-2 pt-1 border-t border-white/5 leading-relaxed">
                    {teamComparison.verdict_summary ||
                      teamComparison.astral_edge_summary}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </GlassCard>

      {/* Player-Level Stadium & Date Favorability Breakdown */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <span>Player Astrological & Stadium Favorability Breakdown</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Stadium geographical coordinates, roof containment, kickoff
              transits, and lunar alignment for each starter.
            </p>
          </div>

          {/* Filters: Team & Position */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Team Filter */}
            <div className="flex rounded-lg bg-slate-900/80 border border-white/10 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setTeamFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  teamFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                All Players ({playerFavorabilities.length})
              </button>
              <button
                type="button"
                onClick={() => setTeamFilter('user')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  teamFilter === 'user'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                {matchupData.user_team?.team_name || 'AstralOracles'}
              </button>
              <button
                type="button"
                onClick={() => setTeamFilter('opponent')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  teamFilter === 'opponent'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                {matchupData.opponent_team?.team_name || 'lunareclipse'}
              </button>
            </div>

            {/* Pos Filter */}
            <div className="flex gap-1">
              {['ALL', ...leagueEligiblePositions].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPositionFilter(pos)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                    positionFilter === pos
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}>
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Responsive Side-by-Side 2-Column Comparison Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Column 1: YOUR TEAM (Left) */}
          {(teamFilter === 'all' || teamFilter === 'user') && (
            <div className="space-y-4">
              {/* Starters Section Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/30">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-300">
                    YOUR STARTERS
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {userStarters.length} Active
                </span>
              </div>

              {/* Starters List */}
              <div className="space-y-3">
                {userStarters.length > 0 ? (
                  userStarters.map((p, idx) => renderPlayerCard(p, false, idx))
                ) : (
                  <div className="text-center py-6 text-xs font-mono text-slate-500 bg-slate-950/40 rounded-xl border border-white/5">
                    No active starters found
                  </div>
                )}
              </div>

              {/* Bench Section (Distinct Header & Muted Styling) */}
              {userBench.length > 0 && (
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-400">
                        YOUR BENCH
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {userBench.length} Reserves
                    </span>
                  </div>
                  <div className="space-y-3">
                    {userBench.map((p, idx) => renderPlayerCard(p, true, idx))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Column 2: OPPONENT TEAM (Right) */}
          {(teamFilter === 'all' || teamFilter === 'opponent') && (
            <div className="space-y-4">
              {/* Starters Section Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/30">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-purple-300">
                    OPPONENT STARTERS
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {oppStarters.length} Active
                </span>
              </div>

              {/* Starters List */}
              <div className="space-y-3">
                {oppStarters.length > 0 ? (
                  oppStarters.map((p, idx) => renderPlayerCard(p, false, idx))
                ) : (
                  <div className="text-center py-6 text-xs font-mono text-slate-500 bg-slate-950/40 rounded-xl border border-white/5">
                    No active opponent starters found
                  </div>
                )}
              </div>

              {/* Bench Section (Distinct Header & Muted Styling) */}
              {oppBench.length > 0 && (
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-400">
                        OPPONENT BENCH
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {oppBench.length} Reserves
                    </span>
                  </div>
                  <div className="space-y-3">
                    {oppBench.map((p, idx) => renderPlayerCard(p, true, idx))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Past Matchups Archival Record */}
      {pastMatchups && pastMatchups.length > 0 && (
        <GlassCard variant="panel" className="p-5 space-y-4 border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono uppercase text-slate-300 font-semibold tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Historical Oneiromancy Archive • Past Matchup Records
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Completed League Duels
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastMatchups.map((past, idx) => {
              const opponentName =
                past.opponent_name ||
                past.opponent_team?.team_name ||
                'Opponent';
              const alignment =
                past.astral_alignment ||
                past.team_comparison?.astral_edge_summary ||
                'Aligned';
              const outcome =
                past.result ||
                (past.user_team &&
                past.opponent_team &&
                past.user_team.projected_points >
                  past.opponent_team.projected_points
                  ? 'W'
                  : 'L');
              const scoreUser =
                past.score_user ?? past.user_team?.projected_points ?? 115.0;
              const scoreOpp =
                past.score_opponent ??
                past.opponent_team?.projected_points ??
                102.0;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs font-mono">
                  <div>
                    <div className="font-bold text-slate-200">
                      Week {past.week}: vs {opponentName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Astral Alignment: {alignment}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-bold ${
                        outcome === 'W' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                      {outcome} ({scoreUser.toFixed(1)} - {scoreOpp.toFixed(1)})
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Final Score
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default MatchupsScreen;
