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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerHeadshot from '@/components/common/PlayerHeadshot';
import UserAvatar from '@/components/common/UserAvatar';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import type { InspectTarget } from '@/components/common/PlayerLink';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { mockMatchupWeeks, mockPlayerFavorabilities, mockTeamComparison, mockWeeklyMatchup } from '@/lib/mockData';
import { DEFAULT_CHAOS_LAMBDA, calculateWinProbability, starsVerdictLabel } from '@/lib/scoring';
import { TONE_PILL, computeLineupCheck, favorabilityTone, oracleScore, starsScore, statsPoints } from '@/lib/oracle';
import { kickoffLabel, moonAt, neutralVenueCoords, planetaryHourAt, teamGame } from '@/lib/nflGames';
import { buildStarterPairs, deriveEligiblePositions, deriveWeeklyMatchup, extractStartingSlots, formatStarterRole, getSeasonContext, isNFLByeWeek, isPlayerOnByeWeek } from '@/lib/sleeper';
import type { CosmicPlayer, MatchupWeekData, PlayerMatchupFavorability, TeamCelestialComparison, WeeklyMatchup } from '@/types/oneiromancy';
import { AlertTriangle, ArrowUpDown, Calendar, Clock, MapPin, Moon, Orbit, Sparkles, Swords } from 'lucide-react';

export interface MatchupsScreenProps {
  weeklyMatchup?: WeeklyMatchup | null;
  className?: string;
  embedded?: boolean;
  part?: 'all' | 'comparison' | 'details';
}

export const MatchupsScreen: React.FC<MatchupsScreenProps> = ({
  weeklyMatchup: propWeeklyMatchup,
  className = '',
  embedded = false,
  part = 'all',
}) => {
  const context = useOneiromancy();
  const showComparison = part !== 'details';
  const showDetails = part !== 'comparison';
  const lambda = context.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const [inspected, setInspected] = useState<InspectTarget | null>(null);

  const resolveActiveMatchupWeek = useCallback(() => {
    if (propWeeklyMatchup?.week) return propWeeklyMatchup.week;
    if (typeof window !== 'undefined' && window.location?.search) {
      const wParam = Number(new URLSearchParams(window.location.search).get('week'));
      if (Number.isFinite(wParam) && wParam >= 1 && wParam <= 18) return wParam;
    }
    if (context.draftState?.weekly_matchup?.week) return context.draftState.weekly_matchup.week;
    const upcoming = context.draftState?.weekly_matchup?.upcoming_matchups;
    if (upcoming?.length) {
      return (
        upcoming.find((m) => m.status === 'active')?.week ||
        upcoming.find((m) => m.is_upcoming)?.week ||
        upcoming[0].week
      );
    }
    return 1;
  }, [propWeeklyMatchup?.week, context.draftState?.weekly_matchup]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() => resolveActiveMatchupWeek());

  useEffect(() => {
    if (propWeeklyMatchup?.week) setSelectedWeek(propWeeklyMatchup.week);
  }, [propWeeklyMatchup?.week]);

  useEffect(() => {
    if (!propWeeklyMatchup?.week && context.draftState?.weekly_matchup?.week) {
      setSelectedWeek(resolveActiveMatchupWeek());
    }
  }, [propWeeklyMatchup?.week, context.draftState?.weekly_matchup?.week, resolveActiveMatchupWeek]);

  const userSlot = context.userSlot;
  const settingsUserSlot = context.draftState?.settings?.user_slot;
  const userRosterId = context.userRosterId;
  const competitorTeams = context.draftState?.competitor_teams;
  const cosmicBoard = context.draftState?.cosmic_board;
  const myRoster = context.draftState?.my_roster;
  const existingMatchup = context.draftState?.weekly_matchup;
  const isLiveState = Boolean(context.draftState?.isLive || context.draftState?.mode === 'live');

  const matchupData = useMemo(() => {
    if (propWeeklyMatchup) return propWeeklyMatchup;
    const activeSlot = userSlot || settingsUserSlot || 7;
    const activeUserTeam = competitorTeams?.find((t) => t.is_user);
    const activeRosterId = activeUserTeam?.roster_id ?? userRosterId ?? activeSlot;
    const existing = existingMatchup;

    if (
      existing?.user_team &&
      (existing.user_team.roster_id === activeRosterId || existing.user_team.slot === activeSlot) &&
      (!selectedWeek || existing.week === selectedWeek)
    ) {
      return existing;
    }

    if (
      existing &&
      selectedWeek &&
      selectedWeek !== existing.week &&
      getSeasonContext() &&
      competitorTeams?.length
    ) {
      return deriveWeeklyMatchup(activeRosterId, competitorTeams, null, cosmicBoard, myRoster, selectedWeek);
    }

    if (existing?.upcoming_matchups?.length && selectedWeek && selectedWeek !== existing.week) {
      const matchForWeek = existing.upcoming_matchups.find((w) => w.week === selectedWeek);
      if (matchForWeek) {
        const derived = competitorTeams?.length
          ? deriveWeeklyMatchup(activeRosterId, competitorTeams, null, cosmicBoard, myRoster, selectedWeek)
          : null;
        return {
          ...existing,
          ...(derived || {}),
          week: matchForWeek.week,
          matchup_id: matchForWeek.matchup_id || derived?.matchup_id || existing.matchup_id,
          status: matchForWeek.status || derived?.status || existing.status,
          date_range: matchForWeek.date_range || derived?.date_range || existing.date_range,
          upcoming_matchups: existing.upcoming_matchups,
          user_team: derived?.user_team || matchForWeek.user_team || existing.user_team,
          opponent_team: derived?.opponent_team || matchForWeek.opponent_team || existing.opponent_team,
          win_probability: derived?.win_probability ?? matchForWeek.win_probability ?? existing.win_probability,
          win_probability_label:
            derived?.win_probability_label ?? matchForWeek.win_probability_label ?? existing.win_probability_label,
          team_comparison: derived?.team_comparison || matchForWeek.team_comparison || existing.team_comparison,
          player_favorabilities:
            derived?.player_favorabilities?.length
              ? derived.player_favorabilities
              : matchForWeek.player_favorabilities?.length
                ? matchForWeek.player_favorabilities
                : existing.player_favorabilities,
        };
      }
    }

    if (competitorTeams?.length) {
      return deriveWeeklyMatchup(activeRosterId, competitorTeams, null, cosmicBoard, myRoster, selectedWeek || 1);
    }
    if (existing) return existing;
    return isLiveState ? ({} as WeeklyMatchup) : mockWeeklyMatchup;
  }, [
    propWeeklyMatchup,
    userSlot,
    settingsUserSlot,
    userRosterId,
    competitorTeams,
    cosmicBoard,
    myRoster,
    existingMatchup,
    isLiveState,
    selectedWeek,
  ]);

  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const isLiveMode = Boolean(context.draftState?.isLive || context.draftState?.mode === 'live');

  const teamComparison: TeamCelestialComparison = useMemo(
    () => matchupData.team_comparison || (isLiveMode ? ({} as TeamCelestialComparison) : mockTeamComparison),
    [matchupData.team_comparison, isLiveMode],
  );

  const playerFavorabilities: PlayerMatchupFavorability[] = useMemo(() => {
    if (matchupData.player_favorabilities !== undefined) return matchupData.player_favorabilities;
    return isLiveMode ? [] : mockPlayerFavorabilities;
  }, [matchupData.player_favorabilities, isLiveMode]);

  const matchupWeeks: MatchupWeekData[] = useMemo(
    () => matchupData.upcoming_matchups || (isLiveMode ? [] : mockMatchupWeeks),
    [matchupData.upcoming_matchups, isLiveMode],
  );

  const currentWeekInfo = useMemo(() => {
    const found = matchupWeeks.find((w) => w.week === selectedWeek);
    if (found) return found;
    const activeWk = context.draftState?.weekly_matchup?.week || 2;
    return {
      week: selectedWeek,
      opponent_name: matchupData.opponent_team?.team_name || 'Opponent',
      opponent_owner: matchupData.opponent_team?.owner_name || 'Opponent',
      status: selectedWeek === activeWk ? ('active' as const) : selectedWeek < activeWk ? ('completed' as const) : ('upcoming' as const),
      date_range: matchupData.date_range || `Week ${selectedWeek}`,
    };
  }, [matchupWeeks, selectedWeek, matchupData, context.draftState?.weekly_matchup?.week]);

  const fallbackUserAstral = Number(teamComparison.user_astral_favorability ?? teamComparison.user_favorability_index ?? (isLiveMode ? 0 : 92.4));
  const fallbackOppAstral = Number(teamComparison.opponent_astral_favorability ?? teamComparison.opponent_favorability_index ?? (isLiveMode ? 0 : 68.1));
  const userHarmony = Number(teamComparison.user_harmony_score ?? matchupData.user_team?.harmony_score ?? (isLiveMode ? 0 : 85.0));
  const oppHarmony = Number(teamComparison.opponent_harmony_score ?? matchupData.opponent_team?.harmony_score ?? (isLiveMode ? 0 : 78.0));
  const hasMatchupMetrics = !isLiveMode || (matchupData.user_team?.projected_points !== undefined && matchupData.opponent_team?.projected_points !== undefined);
  const userTeamName = matchupData.user_team?.team_name || 'Your Team';
  const oppTeamName = matchupData.opponent_team?.team_name || 'Opponent';

  const rawRosterPositions = context.draftState?.roster_positions || context.draftState?.settings?.roster_positions;
  const leagueEligiblePositions = useMemo(() => deriveEligiblePositions(rawRosterPositions, context.draftState?.my_roster), [rawRosterPositions, context.draftState?.my_roster]);
  const boardMap = useMemo(() => new Map((context.draftState?.cosmic_board || []).map((p) => [String(p.id), p])), [context.draftState?.cosmic_board]);
  const swaps = useMemo(() => computeLineupCheck(context.draftState?.my_roster || [], lambda), [context.draftState?.my_roster, lambda]);
  const swapByStarterId = useMemo(() => new Map(swaps.filter((s) => s.playerOut).map((s) => [String(s.playerOut!.id), s])), [swaps]);
  const leagueStartingSlots = useMemo(() => extractStartingSlots(rawRosterPositions, context.draftState?.my_roster), [rawRosterPositions, context.draftState?.my_roster]);

  const byePlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isNFLByeWeek(selectedWeek)) return ids;
    const season = getSeasonContext();
    for (const fav of playerFavorabilities) {
      const bp = boardMap.get(String(fav.player_id));
      const team = (fav.nfl_team || fav.team || bp?.team || '').toUpperCase();
      if (
        isPlayerOnByeWeek(selectedWeek, fav.bye_week || bp?.bye_week, team, season?.byeWeeks) ||
        fav.game_kickoff === 'Bye week' ||
        fav.game_kickoff === 'No game this week (Bye)' ||
        fav.stadium?.stadium_name === 'No game this week'
      ) {
        ids.add(String(fav.player_id));
      }
    }
    return ids;
  }, [playerFavorabilities, boardMap, selectedWeek]);

  const toCosmicPlayer = useCallback(
    (fav: PlayerMatchupFavorability, isOnByeOverride?: boolean): CosmicPlayer => {
      const found = boardMap.get(String(fav.player_id));
      const isOnBye = isOnByeOverride !== undefined ? isOnByeOverride : byePlayerIds.has(String(fav.player_id));
      const rawPts = Number.isFinite(Number(fav.projected_points)) ? Number(fav.projected_points) : found ? statsPoints(found) : 12;
      const pts = isOnBye ? 0 : rawPts;
      const stars = Number.isFinite(Number(fav.favorability_score)) ? Number(fav.favorability_score) : found ? starsScore(found) : 75;
      if (found) {
        return { ...found, projected_points: pts, sleeper_projected_points: pts, weekly_projected_points: pts, favorability_score: stars };
      }
      const nameParts = (fav.player_name || 'Player').split(' ');
      return {
        id: String(fav.player_id), name: fav.player_name, first_name: nameParts[0] || fav.player_name,
        last_name: nameParts.slice(1).join(' ') || '', position: fav.position, team: fav.nfl_team || fav.team || 'NFL',
        jersey_number: 0, bye_week: 0, projected_points: pts, sleeper_projected_points: pts, weekly_projected_points: pts,
        adp: 0, market_vor: 0, vor_normalized: Math.min(100, (pts / 25) * 100),
        spirit_score: Number(fav.spirit_score ?? stars), harmony_score: 75, draft_score: stars, favorability_score: stars,
        divination_breakdown: { celestial: stars, numeric: stars, geomantic: stars, oracular: stars, harmony: 75 },
        elemental_traits: { sun_sign: '-', element: 'Fire', tarot_card: '-', life_path_number: 0, iching_hexagram: 0, gematria_resonance: stars },
        draft_status: fav.is_user_team ? 'my_team' : 'drafted',
      };
    },
    [boardMap, byePlayerIds],
  );

  const userStarterIdSet = useMemo(
    () =>
      matchupData.user_team?.starters && matchupData.user_team.starters.length > 0
        ? new Set(matchupData.user_team.starters.filter((id) => id && String(id) !== '0').map(String))
        : null,
    [matchupData.user_team?.starters],
  );
  const oppStarterIdSet = useMemo(
    () =>
      matchupData.opponent_team?.starters && matchupData.opponent_team.starters.length > 0
        ? new Set(matchupData.opponent_team.starters.filter((id) => id && String(id) !== '0').map(String))
        : null,
    [matchupData.opponent_team?.starters],
  );

  const allUserStarters = useMemo(
    () =>
      playerFavorabilities.filter((p) => {
        if (!p.is_user_team || p.is_benched) return false;
        if (userStarterIdSet) return userStarterIdSet.has(String(p.player_id));
        return leagueEligiblePositions.includes(p.position);
      }),
    [playerFavorabilities, userStarterIdSet, leagueEligiblePositions],
  );
  const allOppStarters = useMemo(
    () =>
      playerFavorabilities.filter((p) => {
        if (p.is_user_team || p.is_benched) return false;
        if (oppStarterIdSet) return oppStarterIdSet.has(String(p.player_id));
        return leagueEligiblePositions.includes(p.position);
      }),
    [playerFavorabilities, oppStarterIdSet, leagueEligiblePositions],
  );

  const starterCardStats = useCallback(
    (s: PlayerMatchupFavorability): number => {
      if (byePlayerIds.has(String(s.player_id))) return 0;
      const raw = Number(s.projected_points ?? statsPoints(toCosmicPlayer(s)));
      return Number.isFinite(raw) ? raw : 0;
    },
    [byePlayerIds, toCosmicPlayer],
  );

  const userProj = useMemo(() => {
    if (allUserStarters.length > 0) {
      const sum = allUserStarters.reduce((acc, s) => acc + starterCardStats(s), 0);
      return Math.round(sum * 100) / 100;
    }
    return Number(matchupData.user_team?.projected_points ?? (isLiveMode ? 0 : 125.0));
  }, [allUserStarters, starterCardStats, matchupData.user_team?.projected_points, isLiveMode]);

  const oppProj = useMemo(() => {
    if (allOppStarters.length > 0) {
      const sum = allOppStarters.reduce((acc, s) => acc + starterCardStats(s), 0);
      return Math.round(sum * 100) / 100;
    }
    return Number(matchupData.opponent_team?.projected_points ?? (isLiveMode ? 0 : 110.0));
  }, [allOppStarters, starterCardStats, matchupData.opponent_team?.projected_points, isLiveMode]);

  const winProbCalc = useMemo(() => {
    if (!hasMatchupMetrics) return { winProb: 50.0, label: '-', isFavorite: true };
    const calc = calculateWinProbability(userProj, oppProj, userHarmony, oppHarmony);
    const useCalcDirectly = allUserStarters.length > 0 && allOppStarters.length > 0;
    const winProb = Number((useCalcDirectly ? calc.winProbability : matchupData.win_probability) ?? calc.winProbability ?? 50.0);
    const label = (useCalcDirectly ? calc.favorabilityLabel : matchupData.win_probability_label) ?? calc.favorabilityLabel;
    return { winProb: Number.isFinite(winProb) ? winProb : 50.0, label, isFavorite: winProb >= 50.0 };
  }, [hasMatchupMetrics, allUserStarters.length, allOppStarters.length, matchupData.win_probability, matchupData.win_probability_label, userProj, oppProj, userHarmony, oppHarmony]);

  const userAstral = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allUserStarters.length === 0) return fallbackUserAstral;
    const sum = allUserStarters.reduce((acc, s) => {
      const val = boardMap.has(String(s.player_id)) ? starsScore(toCosmicPlayer(s)) : Number(s.favorability_score ?? 75);
      return acc + (Number.isFinite(val) ? val : 75);
    }, 0);
    return Math.round((sum / allUserStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allUserStarters, fallbackUserAstral, toCosmicPlayer, boardMap]);
  const oppAstral = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allOppStarters.length === 0) return fallbackOppAstral;
    const sum = allOppStarters.reduce((acc, s) => {
      const val = boardMap.has(String(s.player_id)) ? starsScore(toCosmicPlayer(s)) : Number(s.favorability_score ?? 75);
      return acc + (Number.isFinite(val) ? val : 75);
    }, 0);
    return Math.round((sum / allOppStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allOppStarters, fallbackOppAstral, toCosmicPlayer, boardMap]);
  const userOracle = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allUserStarters.length === 0) return Math.round(((1 - lambda) * Math.min(100, Math.max(0, ((userProj / 8) / 25) * 100)) + lambda * userAstral) * 10) / 10;
    const sum = allUserStarters.reduce((acc, s) => acc + oracleScore(toCosmicPlayer(s), lambda), 0);
    return Math.round((sum / allUserStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allUserStarters, toCosmicPlayer, lambda, userProj, userAstral]);
  const oppOracle = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allOppStarters.length === 0) return Math.round(((1 - lambda) * Math.min(100, Math.max(0, ((oppProj / 8) / 25) * 100)) + lambda * oppAstral) * 10) / 10;
    const sum = allOppStarters.reduce((acc, s) => acc + oracleScore(toCosmicPlayer(s), lambda), 0);
    return Math.round((sum / allOppStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allOppStarters, toCosmicPlayer, lambda, oppProj, oppAstral]);

  const playersOnBye = useMemo(
    () => playerFavorabilities.filter((fav) => byePlayerIds.has(String(fav.player_id))),
    [playerFavorabilities, byePlayerIds],
  );

  // Pair user starters and opponent starters into head-to-head slot rows in Sleeper league starting order
  const starterPairs = useMemo(
    () =>
      buildStarterPairs(
        leagueStartingSlots,
        allUserStarters,
        allOppStarters,
        matchupData.user_team?.starters,
        matchupData.opponent_team?.starters,
      ),
    [leagueStartingSlots, allUserStarters, allOppStarters, matchupData.user_team?.starters, matchupData.opponent_team?.starters],
  );

  const displayedPairs = useMemo(() => {
    if (positionFilter === 'ALL') return starterPairs;
    return starterPairs.filter(
      (pair) =>
        pair.user?.position === positionFilter ||
        pair.opp?.position === positionFilter ||
        pair.slotRole === positionFilter ||
        pair.slotLabel === positionFilter,
    );
  }, [starterPairs, positionFilter]);

  const userStartersCount = useMemo(
    () => displayedPairs.filter((p) => Boolean(p.user)).length,
    [displayedPairs],
  );
  const oppStartersCount = useMemo(
    () => displayedPairs.filter((p) => Boolean(p.opp)).length,
    [displayedPairs],
  );

  const kickoffSky = useMemo(() => {
    const sampleTeam = playerFavorabilities[0]?.nfl_team || playerFavorabilities[0]?.team;
    const schedGame = sampleTeam ? teamGame(selectedWeek, sampleTeam) : undefined;
    const seasonYear = Number(getSeasonContext()?.season) || 2025;
    const fallbackUtc = new Date(Date.UTC(seasonYear, 8, 7 + Math.max(0, selectedWeek - 1) * 7, 17, 0, 0)).toISOString();
    const effectiveGame = schedGame ?? {
      week: selectedWeek,
      home: sampleTeam || 'KC',
      away: 'OPP',
      kickoff: fallbackUtc,
      date: fallbackUtc.slice(0, 10),
      venue: null,
      neutral: false,
    };
    const refDate = new Date(effectiveGame.kickoff || fallbackUtc);
    const homeFav = playerFavorabilities.find((pf) => (pf.nfl_team || pf.team) === effectiveGame.home);
    const refLon =
      neutralVenueCoords(effectiveGame.venue?.name)?.lon ??
      homeFav?.stadium?.longitude ??
      playerFavorabilities[0]?.stadium?.longitude ??
      0;
    return {
      label: kickoffLabel(effectiveGame),
      moon: moonAt(refDate),
      hour: planetaryHourAt(refDate, Number(refLon) || 0),
    };
  }, [selectedWeek, playerFavorabilities]);

  const openFavPlayer = (fav: PlayerMatchupFavorability, vsPlayer: CosmicPlayer | null = null) => {
    const isOnBye = byePlayerIds.has(String(fav.player_id));
    setInspected({ player: toCosmicPlayer(fav, isOnBye), vs: vsPlayer });
  };

  const renderPlayerCard = (
    player: PlayerMatchupFavorability,
    isMutedBench: boolean,
    idx: number,
    vsStarter: PlayerMatchupFavorability | null = null,
    isFavoredInMatchup: boolean = false,
  ) => {
    const isOnBye = byePlayerIds.has(String(player.player_id));
    const cp = toCosmicPlayer(player, isOnBye);
    const rawStars = boardMap.has(String(player.player_id)) ? starsScore(cp) : Number(player.favorability_score ?? 75);
    const stars = Number.isFinite(rawStars) ? rawStars : 75;
    const tone = favorabilityTone(stars);
    const rawStats = isOnBye ? 0 : Number(player.projected_points ?? statsPoints(cp));
    const stats = Number.isFinite(rawStats) ? rawStats : 0;
    const oracle = oracleScore(cp, lambda);
    const swap = player.is_user_team && !isMutedBench ? swapByStarterId.get(String(player.player_id)) : undefined;

    const rawLat = player.stadium?.latitude ?? player.stadium?.coordinates?.lat;
    const rawLon = player.stadium?.longitude ?? player.stadium?.coordinates?.lon;
    const hasCoords = typeof rawLat === 'number' && Number.isFinite(rawLat) && typeof rawLon === 'number' && Number.isFinite(rawLon);
    const coordText = hasCoords
      ? `${Math.abs(rawLat).toFixed(2)}°${rawLat >= 0 ? 'N' : 'S'}, ${Math.abs(rawLon).toFixed(2)}°${rawLon >= 0 ? 'E' : 'W'}`
      : null;
    const isByeStadium =
      isOnBye ||
      player.stadium?.stadium_name === 'No game this week' ||
      player.game_kickoff === 'Bye week' ||
      player.game_kickoff === 'No game this week (Bye)';
    const stadiumDisplay = isByeStadium
      ? 'No game this week (Bye)'
      : `${player.stadium?.stadium_name || 'NFL Stadium'}${player.stadium?.roof_type && player.stadium.roof_type !== '-' ? ` (${player.stadium.roof_type})` : ''}`;

    return (
      <div
        key={`${selectedWeek}-${player.is_user_team ? 'u' : 'o'}-${player.player_id}-${idx}`}
        data-testid={!isMutedBench ? `matchup-starter-card-${player.player_id}` : undefined}
        onClick={() => openFavPlayer(player, swap?.playerIn ?? (vsStarter ? toCosmicPlayer(vsStarter) : null))}
        className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
          isOnBye
            ? 'opacity-50 grayscale bg-slate-950/70 border-slate-700/50 hover:opacity-75'
            : isMutedBench
              ? 'opacity-75 bg-slate-950/50 border-white/10 hover:opacity-100'
              : player.is_user_team
                ? `bg-purple-950/25 ${isFavoredInMatchup ? 'border-purple-400 ring-1 ring-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]' : 'border-purple-500/60'} hover:border-purple-400`
                : `bg-slate-900/70 ${isFavoredInMatchup ? 'border-cyan-400 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]' : 'border-cyan-500/40'} hover:border-cyan-400/70`
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <PlayerHeadshot player={{ id: player.player_id, name: player.player_name, team: player.nfl_team || player.team, position: player.position }} size="sm" />
            <div data-testid="matchup-card-text-col" className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <PositionalBadge position={player.position} size="sm" />
                <span className="font-bold text-sm text-slate-100 truncate">{player.player_name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                <span>{player.nfl_team || player.team || 'FA'} · Bye {cp.bye_week || '-'}</span>
                {isFavoredInMatchup && (
                  <span data-testid="player-favored-badge" className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 shadow-sm whitespace-nowrap" title="Favored in this starting matchup based on Oracle rating.">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                    <span>FAVORED</span>
                  </span>
                )}
                {isOnBye && (
                  <span title={`On bye in Week ${selectedWeek} - 0.0 projected points`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50">BYE WK {selectedWeek}</span>
                    <span className="text-[10px] font-mono text-slate-500">· On Bye</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Strictly the 3 Canonical Player Judgment Metrics */}
          <div className="flex items-center gap-1.5 shrink-0 font-mono text-right">
            <div className="min-w-[46px] px-2 py-1 rounded bg-slate-950/80 border border-white/5" title="Baseline projected points">
              <span className="text-[8px] text-slate-500 block uppercase">Stats</span>
              <span className="text-xs font-bold text-cyan-300 tabular-nums">
                {Math.round(stats * 100) % 10 === 0 ? stats.toFixed(1) : stats.toFixed(2)}
              </span>
            </div>
            <div className="min-w-[46px] px-2 py-1 rounded bg-slate-950/80 border border-purple-500/30" title="Combined Divinity / Oracle Score">
              <span className="text-[8px] text-purple-300/80 block uppercase">Oracle</span>
              <span className="text-xs font-bold text-purple-200 tabular-nums">{oracle.toFixed(1)}</span>
            </div>
            <div className={`min-w-[42px] px-2 py-1 rounded border ${TONE_PILL[tone]}`} title={starsVerdictLabel(stars)}>
              <span className="text-[8px] opacity-75 block uppercase">Stars</span>
              <span className="text-xs font-bold tabular-nums">{stars.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Unclipped venue conditions & kickoff telemetry */}
        <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 flex-wrap">
          <span className="flex items-center gap-1 text-slate-300 min-w-0">
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-slate-300 font-medium">{stadiumDisplay}</span>
          </span>
          {!isByeStadium && player.game_kickoff && player.game_kickoff !== 'Bye week' && (
            <span className="flex items-center gap-1 shrink-0 whitespace-nowrap text-slate-400">
              <Clock className="w-2.5 h-2.5 text-slate-500" />
              {player.game_kickoff}
            </span>
          )}
        </div>

        {/* Inline Swap Opportunity Tooltip on Starter Slots */}
        {swap && (
          <div
            role="button"
            tabIndex={0}
            data-testid="matchup-swap-opportunity"
            title={`Bench ${swap.playerIn.name} scores +${Number(swap.oracleGain || 0).toFixed(1)} higher Oracle (${oracleScore(swap.playerIn, lambda).toFixed(1)} vs ${oracle.toFixed(1)})`}
            onClick={(e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              setInspected({ player: swap.playerIn, vs: swap.playerOut ?? null });
            }}
            onKeyDown={(e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setInspected({ player: swap.playerIn, vs: swap.playerOut ?? null });
              }
            }}
            className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono text-emerald-200 flex items-center justify-between gap-2"
          >
            <span data-testid="matchup-swap-tooltip" className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Swap Opportunity: Bench <strong>{swap.playerIn.name}</strong> adds +{Number(swap.oracleGain || 0).toFixed(1)} Oracle
              </span>
            </span>
            <span className="underline text-[10px] shrink-0">Compare →</span>
          </div>
        )}
        <details className="group mt-1 text-slate-300">
          <summary
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 cursor-pointer select-none"
          >
            Alignment & Stadium Telemetry
          </summary>
          <div className="pt-1 text-[10px] font-mono text-slate-400">
            {[coordText, player.lunar_phase, player.planetary_hour, player.astrological_rationale]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {!embedded && showDetails && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
              Celestial Matchup Divination
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide flex items-center gap-2">
              <Swords className="w-6 h-6 text-purple-400" />
              <span>Week {selectedWeek} Matchup</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> {kickoffSky.label}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-200 flex items-center gap-1">
              <Moon className="w-3 h-3 text-cyan-400" /> {kickoffSky.moon}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-200 flex items-center gap-1">
              <Orbit className="w-3 h-3 text-purple-400" /> {kickoffSky.hour}
            </span>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/90 border border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {matchupWeeks.map((w) => (
              <button
                key={w.week}
                type="button"
                data-testid={`matchup-week-btn-${w.week}`}
                onClick={() => setSelectedWeek(w.week)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedWeek === w.week
                    ? 'bg-purple-950/90 text-purple-200 border border-purple-400/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>Week {w.week}</span>
                {w.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-2">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>{currentWeekInfo.date_range}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/30 text-purple-200">
              {currentWeekInfo.status}
            </span>
          </div>
        </div>
      )}

      {/* Single Cohesive Team Head-to-Head Card (Left = You with Purple Border, Right = Opponent) */}
      {showComparison && (
        <GlassCard variant="panel" className="p-4 sm:p-5 space-y-4 border-purple-500/30">
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-4 items-center bg-slate-950/70 p-4 rounded-xl border border-white/5">
            {/* LEFT: YOUR TEAM (Purple Identity) */}
            <div className="sm:col-span-3 flex items-center gap-3.5 p-3 rounded-xl bg-purple-950/35 border-2 border-purple-500/60 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
              <UserAvatar
                src={matchupData.user_team?.avatar_url || matchupData.user_team?.avatar}
                alt={`${userTeamName} avatar`}
                fallbackText={userTeamName}
                size="xl"
                isUser={true}
                testId="user-team-avatar"
                data-testid="user-team-avatar"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-base text-purple-100 truncate">{userTeamName}</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-400/50 shrink-0">
                    YOUR TEAM
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 truncate">
                  Mgr: {matchupData.user_team?.owner_name}
                </div>
                <div className="text-lg font-mono font-bold text-purple-300 mt-0.5 tabular-nums">
                  {hasMatchupMetrics
                    ? Number(
                        matchupData.status === 'completed' && matchupData.score_user !== undefined
                          ? matchupData.score_user
                          : userProj,
                      ).toFixed(2)
                    : '-'}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {matchupData.status === 'completed' ? 'Final' : 'Stats'}
                  </span>
                </div>
              </div>
            </div>

            {/* CENTER: VS & Win Probability Gauge */}
            <div className="sm:col-span-1 flex flex-col items-center justify-center text-center py-1">
              <span className="text-xs font-serif font-bold text-slate-300 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10">
                VS
              </span>
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className={`text-xs font-mono font-bold ${winProbCalc.isFavorite ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hasMatchupMetrics ? `${winProbCalc.winProb.toFixed(1)}% Win Prob` : '-'}
                </span>
                <span className="text-[8px] font-mono uppercase tracking-wider text-purple-200 font-semibold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 max-w-[110px] truncate text-center block">
                  {winProbCalc.label}
                </span>
                {hasMatchupMetrics && (
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-white/10">
                    <div
                      className={`h-full rounded-full ${
                        winProbCalc.isFavorite
                          ? 'bg-gradient-to-r from-purple-500 to-emerald-400'
                          : 'bg-gradient-to-r from-purple-500 to-rose-400'
                      }`}
                      style={{ width: `${Math.min(Math.max(winProbCalc.winProb, 5), 95)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: OPPONENT TEAM */}
            <div className="sm:col-span-3 flex items-center gap-3.5 p-3 rounded-xl bg-cyan-950/20 border-2 border-cyan-500/40">
              <UserAvatar
                src={matchupData.opponent_team?.avatar_url || matchupData.opponent_team?.avatar}
                alt={`${oppTeamName} avatar`}
                fallbackText={oppTeamName}
                size="xl"
                isUser={false}
                testId="opponent-team-avatar"
                data-testid="opponent-team-avatar"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-base text-cyan-100 truncate">{oppTeamName}</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                    OPPONENT
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 truncate">
                  Mgr: {matchupData.opponent_team?.owner_name}
                </div>
                <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5 tabular-nums">
                  {hasMatchupMetrics
                    ? Number(
                        matchupData.status === 'completed' && matchupData.score_opponent !== undefined
                          ? matchupData.score_opponent
                          : oppProj,
                      ).toFixed(2)
                    : '-'}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {matchupData.status === 'completed' ? 'Final' : 'Stats'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact 3-Metric Scale Bars (Oracle, Stars, Squad Harmony) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: 'Starter Oracle Avg',
                left: userOracle,
                right: oppOracle,
                fmt: (n: number) => (hasMatchupMetrics ? n.toFixed(1) : '-'),
              },
              {
                title: 'Starter Stars Avg (Astral Favorability Index)',
                left: userAstral,
                right: oppAstral,
                fmt: (n: number) => (hasMatchupMetrics ? n.toFixed(1) : '-'),
              },
              {
                title: 'Squad Harmony Rating',
                left: userHarmony,
                right: oppHarmony,
                fmt: (n: number) =>
                  hasMatchupMetrics
                    ? `${Math.round(n)}% (${n >= 85 ? 'Apex Harmony' : n >= 75 ? 'Harmonic Balance' : 'Discordant Risk'})`
                    : '-',
              },
            ].map((m) => {
              const total = Math.max(m.left + m.right, 1);
              const isUserLead = m.left >= m.right;
              return (
                <div key={m.title} className="p-3 rounded-xl bg-slate-900/70 border border-white/10 space-y-1.5 font-mono">
                  <span className="text-[10px] uppercase text-slate-400 block truncate">{m.title}</span>
                  <div className="flex items-center justify-between text-xs font-bold gap-1">
                    <span className={isUserLead ? 'text-emerald-400 font-extrabold' : 'text-slate-300'}>{m.fmt(m.left)}</span>
                    <span className="text-slate-500 text-[10px]">vs</span>
                    <span className={!isUserLead ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}>{m.fmt(m.right)}</span>
                  </div>
                  {hasMatchupMetrics && (
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                      <div className="bg-purple-500 h-full" style={{ width: `${(m.left / total) * 100}%` }} />
                      <div className="bg-cyan-500/80 h-full" style={{ width: `${(m.right / total) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {showDetails && (
        <>
          {/* Position Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3
                title="Starters paired 1:1 by Sleeper league starting lineup slots."
                className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Positional Starter Matchups</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                Player Astrological & Stadium Favorability Breakdown · Active Transits & Conjunctions
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {['ALL', ...leagueEligiblePositions].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPositionFilter(pos)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                    positionFilter === pos
                      ? 'bg-purple-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Single Unified Side-by-Side Positional Starter Matchup Grid */}
          <div data-testid="positional-matchup-grid" className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-1.5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider font-bold text-purple-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7]" />
                  YOUR STARTERS ({userStartersCount})
                </span>
                <span className="text-[10px] font-mono text-purple-300">{userTeamName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  OPPONENT STARTERS ({oppStartersCount})
                </span>
                <span className="text-[10px] font-mono text-cyan-300">{oppTeamName}</span>
              </div>
            </div>

            {displayedPairs.map((pair, idx) => {
              const hasBoth = Boolean(pair.user && pair.opp);
              const uOracle = pair.user ? oracleScore(toCosmicPlayer(pair.user), lambda) : 0;
              const oOracle = pair.opp ? oracleScore(toCosmicPlayer(pair.opp), lambda) : 0;
              const delta = hasBoth ? uOracle - oOracle : 0;
              const sum = uOracle + oOracle;
              const isZeroSplit = hasBoth && sum <= 0;
              const uPct = !hasBoth ? 0 : isZeroSplit ? 50 : Math.min(100, Math.max(0, Math.round((uOracle / sum) * 100)));
              const oPct = !hasBoth ? 0 : isZeroSplit ? 50 : Math.min(100, Math.max(0, 100 - uPct));
              const isEven = hasBoth && (isZeroSplit || Math.abs(delta) <= 0.05);
              const isUserFavored = hasBoth && !isZeroSplit && delta > 0.05;
              const isOppFavored = hasBoth && !isZeroSplit && delta < -0.05;
              const displayDelta = isEven ? 0 : delta;

              return (
                <div key={`slot-pair-${pair.slotRole}-${idx}`} className="p-2.5 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2">
                  {/* Compact Slot Advantage Bar with Crisp Separator & Favored Highlight */}
                  <div className="flex items-center gap-2.5 px-2 font-mono text-[10px]">
                    <span data-testid="matchup-slot-label" className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-purple-300 font-bold text-center w-14 shrink-0 tracking-wider">
                      {pair.slotLabel}
                    </span>
                    <div
                      role="meter"
                      aria-label={`${pair.slotLabel} matchup: ${pair.user?.player_name || 'Empty'} vs ${pair.opp?.player_name || 'Empty'}`}
                      aria-valuenow={hasBoth ? Math.round(uPct) : 50}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      title={hasBoth ? `Matchup advantage: ${uOracle.toFixed(1)} Oracle vs ${oOracle.toFixed(1)} Oracle` : 'Empty slot'}
                      className="relative flex-1 h-2 rounded-full bg-slate-950/80 border border-white/10 overflow-hidden flex items-center shadow-inner"
                    >
                      {/* 50% Neutral Centerline */}
                      <div data-testid="matchup-bar-centerline" aria-hidden="true" className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 z-20 pointer-events-none" />
                      {/* User Bar Segment */}
                      <div
                        data-testid="matchup-bar-user"
                        className={`h-full transition-all duration-300 ${
                          isUserFavored
                            ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.85)] z-[2]'
                            : isOppFavored
                            ? 'bg-purple-950/50 opacity-40 z-[1]'
                            : 'bg-purple-500/80 z-[1]'
                        }`}
                        style={{ width: `${uPct}%` }}
                      />
                      {/* Crisp Visual Separator Line (Only when both starters present) */}
                      {hasBoth && (
                        <div
                          data-testid="matchup-bar-separator"
                          aria-hidden="true"
                          className="w-0.5 bg-white h-full z-10 shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.95)]"
                        />
                      )}
                      {/* Opponent Bar Segment */}
                      <div
                        data-testid="matchup-bar-opp"
                        className={`h-full transition-all duration-300 ${
                          isOppFavored
                            ? 'bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.85)] z-[2]'
                            : isUserFavored
                            ? 'bg-cyan-950/50 opacity-40 z-[1]'
                            : 'bg-cyan-500/80 z-[1]'
                        }`}
                        style={{ width: `${oPct}%` }}
                      />
                    </div>
                    {/* Favored Badge & Delta */}
                    <div data-testid="matchup-bar-delta" className="shrink-0 flex items-center gap-1.5 w-28 justify-end">
                      <span
                        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                          !hasBoth
                            ? 'bg-slate-800 text-slate-500 border border-white/5'
                            : isUserFavored
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_6px_rgba(168,85,247,0.3)]'
                            : isOppFavored
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_6px_rgba(6,182,212,0.3)]'
                            : 'bg-slate-800 text-slate-400 border border-white/5'
                        }`}
                      >
                        {!hasBoth ? 'Open' : isUserFavored ? 'Favored' : isOppFavored ? 'Opp Fav' : 'Even'}
                      </span>
                      <span className={`font-bold ${!hasBoth || isEven ? 'text-slate-400' : isUserFavored ? 'text-purple-300' : 'text-cyan-300'}`}>
                        {!hasBoth ? '-' : isEven ? '0.0' : displayDelta > 0 ? `+${displayDelta.toFixed(1)}` : displayDelta.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Paired Starter Cards (Left = Yours in Purple, Right = Opponent in Cyan) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      {pair.user ? (
                        renderPlayerCard(pair.user, false, idx, pair.opp, isUserFavored)
                      ) : (
                        <div className="p-3 rounded-xl border border-dashed border-white/10 text-xs font-mono text-slate-500">
                          Empty starter slot
                        </div>
                      )}
                    </div>
                    <div>
                      {pair.opp ? (
                        renderPlayerCard(pair.opp, false, idx, pair.user, isOppFavored)
                      ) : (
                        <div className="p-3 rounded-xl border border-dashed border-white/10 text-xs font-mono text-slate-500">
                          Empty opponent slot
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. Compact Players on Bye Callout Footer Strip */}
          <div
            data-testid="matchup-bye-callout"
            className="p-3 rounded-xl bg-slate-900/70 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
          >
            <span className="text-amber-300 font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Players on Bye · Week {selectedWeek}:</span>
            </span>
            {playersOnBye.length === 0 ? (
              <span className="text-slate-400">Zero rostered or opponent players on bye this week.</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {playersOnBye.map((p) => (
                  <span
                    key={p.player_id}
                    title={`On bye in Week ${selectedWeek} - 0.0 pts`}
                    className={`px-2 py-0.5 rounded border text-[10px] ${
                      p.is_user_team
                        ? 'bg-purple-950/80 border-purple-400/50 text-purple-200'
                        : 'bg-cyan-950/60 border-cyan-400/40 text-cyan-200'
                    }`}
                  >
                    {p.player_name} ({p.position} · {p.is_user_team ? 'YOU' : 'OPP'}{p.is_benched ? ' · BN' : ' · START'})
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={context.draftState?.my_roster || []}
      />
    </div>
  );
};

export default MatchupsScreen;
