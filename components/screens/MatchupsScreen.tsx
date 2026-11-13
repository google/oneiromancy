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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import RosterSlotBadge from '@/components/common/RosterSlotBadge';
import PlayerHeadshot from '@/components/common/PlayerHeadshot';
import PowerupStars from '@/components/common/PowerupStars';
import UserAvatar from '@/components/common/UserAvatar';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import type { InspectTarget } from '@/components/common/PlayerLink';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { mockMatchupWeeks, mockPlayerFavorabilities, mockTeamComparison, mockWeeklyMatchup } from '@/lib/mockData';
import { DEFAULT_CHAOS_LAMBDA, calculateWinProbability, starsVerdictLabel, stripUserSuffix } from '@/lib/scoring';
import { TONE_PILL, computeLineupCheck, currentWeekOracleScore, favorabilityTone, oraclePlaceholderInfo, oracleScore, resolveActiveWeek, starsScore, statsPoints } from '@/lib/oracle';
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

  const contextWeek = context.draftState?.weekly_matchup?.week;
  const upcomingMatchups = context.draftState?.weekly_matchup?.upcoming_matchups;
  const resolveActiveMatchupWeek = useCallback(() => {
    if (propWeeklyMatchup?.week) return propWeeklyMatchup.week;
    if (typeof window !== 'undefined' && window.location?.search) {
      const wParam = Number(new URLSearchParams(window.location.search).get('week'));
      if (Number.isFinite(wParam) && wParam >= 1 && wParam <= 18) return wParam;
    }
    const isMock = Boolean(
      context.draftState &&
      !context.draftState.isLive &&
      context.draftState.mode !== 'live'
    );
    if (isMock) {
      return resolveActiveWeek(context.draftState);
    }
    if (contextWeek) return contextWeek;
    if (upcomingMatchups?.length) {
      return (
        upcomingMatchups.find((m) => m.status === 'active')?.week ||
        upcomingMatchups.find((m) => m.is_upcoming)?.week ||
        upcomingMatchups[0].week
      );
    }
    return resolveActiveWeek(context.draftState);
  }, [propWeeklyMatchup?.week, context.draftState, contextWeek, upcomingMatchups]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() => resolveActiveMatchupWeek());
  const contextSyncKey = `${contextWeek ?? ''}|${context.draftState?.draft_id ?? ''}|${context.draftState?.settings?.league_id ?? ''}`;
  const prevContextSyncKeyRef = useRef<string>(contextSyncKey);

  useEffect(() => {
    if (propWeeklyMatchup?.week) setSelectedWeek(propWeeklyMatchup.week);
  }, [propWeeklyMatchup?.week]);

  useEffect(() => {
    if (!propWeeklyMatchup?.week && contextWeek !== undefined && contextSyncKey !== prevContextSyncKeyRef.current) {
      prevContextSyncKeyRef.current = contextSyncKey;
      setSelectedWeek(resolveActiveMatchupWeek());
    }
  }, [propWeeklyMatchup?.week, contextWeek, contextSyncKey, resolveActiveMatchupWeek]);

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
          status:
            matchForWeek.status ||
            derived?.status ||
            (selectedWeek < existing.week ? 'completed' : 'upcoming'),
          date_range: matchForWeek.date_range || derived?.date_range,
          score_user: matchForWeek.score_user ?? derived?.score_user,
          score_opponent: matchForWeek.score_opponent ?? derived?.score_opponent,
          result: matchForWeek.result ?? derived?.result,
          upcoming_matchups: existing.upcoming_matchups,
          user_team: derived?.user_team || matchForWeek.user_team,
          opponent_team: derived?.opponent_team || matchForWeek.opponent_team,
          win_probability: derived?.win_probability ?? matchForWeek.win_probability,
          win_probability_label:
            derived?.win_probability_label ?? matchForWeek.win_probability_label,
          team_comparison: derived?.team_comparison || matchForWeek.team_comparison,
          player_favorabilities:
            derived?.player_favorabilities?.length
              ? derived.player_favorabilities
              : matchForWeek.player_favorabilities || [],
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
  const [headerScoreMode, setHeaderScoreMode] = useState<'oracle' | 'stats'>('oracle');
  const oracleRadioRef = useRef<HTMLButtonElement | null>(null);
  const statsRadioRef = useRef<HTMLButtonElement | null>(null);
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
    const rawOppName = stripUserSuffix(matchupData.opponent_team?.team_name);
    return {
      week: selectedWeek,
      opponent_name: rawOppName || 'Matchup',
      opponent_owner: matchupData.opponent_team?.owner_name?.trim() || 'Manager',
      status: selectedWeek === activeWk ? ('active' as const) : selectedWeek < activeWk ? ('completed' as const) : ('upcoming' as const),
      date_range: matchupData.date_range || `Week ${selectedWeek}`,
    };
  }, [matchupWeeks, selectedWeek, matchupData, context.draftState?.weekly_matchup?.week]);

  const fallbackUserAstralRaw = Number(teamComparison.user_astral_favorability ?? teamComparison.user_favorability_index ?? (isLiveMode ? 0 : 92.4));
  const fallbackOppAstralRaw = Number(teamComparison.opponent_astral_favorability ?? teamComparison.opponent_favorability_index ?? (isLiveMode ? 0 : 68.1));
  const userHarmonyRaw = Number(teamComparison.user_harmony_score ?? matchupData.user_team?.harmony_score ?? (isLiveMode ? 0 : 85.0));
  const oppHarmonyRaw = Number(teamComparison.opponent_harmony_score ?? matchupData.opponent_team?.harmony_score ?? (isLiveMode ? 0 : 78.0));
  const fallbackUserAstral = Number.isFinite(fallbackUserAstralRaw) ? fallbackUserAstralRaw : 0;
  const fallbackOppAstral = Number.isFinite(fallbackOppAstralRaw) ? fallbackOppAstralRaw : 0;
  const userHarmony = Number.isFinite(userHarmonyRaw) ? userHarmonyRaw : 0;
  const oppHarmony = Number.isFinite(oppHarmonyRaw) ? oppHarmonyRaw : 0;
  const isFiniteNum = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
  const userProjRaw = matchupData.user_team?.projected_points;
  const oppProjRaw = matchupData.opponent_team?.projected_points;
  const hasValidFinalScores =
    matchupData.status === 'completed' &&
    isFiniteNum(matchupData.score_user) &&
    isFiniteNum(matchupData.score_opponent);
  const hasExplicitInvalidProj =
    (userProjRaw !== undefined && !isFiniteNum(userProjRaw)) ||
    (oppProjRaw !== undefined && !isFiniteNum(oppProjRaw));
  const showFinalLabel = hasValidFinalScores;
  const userTeamName = stripUserSuffix(matchupData.user_team?.team_name, 'Team');
  const oppTeamName = stripUserSuffix(matchupData.opponent_team?.team_name, 'Matchup');

  const rawRosterPositions = context.draftState?.roster_positions || context.draftState?.settings?.roster_positions;
  const leagueEligiblePositions = useMemo(() => deriveEligiblePositions(rawRosterPositions, context.draftState?.my_roster), [rawRosterPositions, context.draftState?.my_roster]);
  const boardMap = useMemo(() => new Map((context.draftState?.cosmic_board || []).map((p) => [String(p.id), p])), [context.draftState?.cosmic_board]);

  const rosterPlayerById = useMemo(
    () =>
      new Map(
        (context.draftState?.my_roster || [])
          .filter((s) => s.player)
          .map((s) => [String(s.player!.id), s.player!]),
      ),
    [context.draftState?.my_roster],
  );

  const byePlayerIds = useMemo(() => {
    const ids = new Set<string>();
    const nflByeActive = isNFLByeWeek(selectedWeek);
    const season = getSeasonContext();
    for (const fav of playerFavorabilities) {
      const bp = boardMap.get(String(fav.player_id));
      const rp = rosterPlayerById.get(String(fav.player_id));
      const team = (fav.nfl_team || fav.team || bp?.team || rp?.team || '').toUpperCase();
      const explicitBye =
        fav.game_kickoff === 'Bye week' ||
        fav.game_kickoff === 'No game this week (Bye)' ||
        fav.stadium?.stadium_name === 'No game this week';
      if (
        explicitBye ||
        (nflByeActive &&
          isPlayerOnByeWeek(selectedWeek, fav.bye_week || bp?.bye_week || rp?.bye_week, team, season?.byeWeeks))
      ) {
        ids.add(String(fav.player_id));
      }
    }
    return ids;
  }, [playerFavorabilities, boardMap, rosterPlayerById, selectedWeek]);

  const toCosmicPlayer = useCallback(
    (
      fav: PlayerMatchupFavorability,
      isOnByeOverride?: boolean,
      fallbackBase?: CosmicPlayer | null,
    ): CosmicPlayer => {
      const bp = boardMap.get(String(fav.player_id));
      const rp = fallbackBase ?? rosterPlayerById.get(String(fav.player_id)) ?? null;
      const found: CosmicPlayer | null =
        bp && rp
          ? {
              ...bp,
              ...rp,
              spirit_score: bp.spirit_score ?? rp.spirit_score,
              divination_breakdown: bp.divination_breakdown ?? rp.divination_breakdown,
              average_projected_points: bp.average_projected_points ?? rp.average_projected_points ?? bp.baseline_projected_points ?? rp.baseline_projected_points,
              baseline_projected_points: bp.baseline_projected_points ?? rp.baseline_projected_points,
              next_play_week: bp.next_play_week ?? rp.next_play_week,
              next_week_projected_points: bp.next_week_projected_points ?? rp.next_week_projected_points,
              depth_chart_order: bp.depth_chart_order ?? rp.depth_chart_order ?? fav.depth_chart_order,
            }
          : bp ?? rp ?? null;
      const isOnBye = isOnByeOverride !== undefined ? isOnByeOverride : byePlayerIds.has(String(fav.player_id));
      const rawPts = Number.isFinite(Number(fav.projected_points)) ? Number(fav.projected_points) : found ? statsPoints(found) : 12;
      const pts = isOnBye ? 0 : rawPts;
      const stars = Number.isFinite(Number(fav.favorability_score)) ? Number(fav.favorability_score) : found ? starsScore(found, { currentWeek: selectedWeek }) : 75;
      const avgPts = found?.average_projected_points ?? found?.baseline_projected_points ?? (rawPts > 0 ? rawPts : undefined);
      if (found) {
        return {
          ...found,
          average_projected_points: avgPts,
          projected_points: pts,
          sleeper_projected_points: pts,
          weekly_projected_points: pts,
          favorability_score: stars,
        };
      }
      const nameParts = (fav.player_name || 'Player').split(' ');
      return {
        id: String(fav.player_id), name: fav.player_name, first_name: nameParts[0] || fav.player_name,
        last_name: nameParts.slice(1).join(' ') || '', position: fav.position, team: fav.nfl_team || fav.team || 'NFL',
        jersey_number: 0, bye_week: 0, depth_chart_order: fav.depth_chart_order, projected_points: pts, sleeper_projected_points: pts, weekly_projected_points: pts,
        average_projected_points: avgPts, baseline_projected_points: avgPts,
        adp: 0, market_vor: 0, vor_normalized: Math.min(100, (pts / 25) * 100),
        spirit_score: Number(fav.spirit_score ?? stars), harmony_score: 75, draft_score: stars, favorability_score: stars,
        divination_breakdown: { celestial: stars, numeric: stars, geomantic: stars, oracular: stars, harmony: 75 },
        elemental_traits: { sun_sign: '-', element: 'Fire', tarot_card: '-', life_path_number: 0, iching_hexagram: 0, gematria_resonance: stars },
        draft_status: fav.is_user_team ? 'my_team' : 'drafted',
      };
    },
    [boardMap, byePlayerIds, rosterPlayerById, selectedWeek],
  );

  const favById = useMemo(
    () => new Map(playerFavorabilities.map((fav) => [String(fav.player_id), fav])),
    [playerFavorabilities],
  );

  const weekAdjustedRoster = useMemo(() => {
    const rawRoster = context.draftState?.my_roster || [];
    const season = getSeasonContext();
    return rawRoster.map((slot) => {
      if (!slot.player) return slot;
      const p = slot.player;
      const pId = String(p.id);
      const fav = favById.get(pId);
      const team = (fav?.nfl_team || fav?.team || p.team || '').toUpperCase();
      const isOnBye =
        byePlayerIds.has(pId) ||
        isPlayerOnByeWeek(selectedWeek, fav?.bye_week || p.bye_week, team, season?.byeWeeks);

      if (fav) {
        return {
          ...slot,
          player: toCosmicPlayer(fav, isOnBye, p),
        };
      }

      if (isOnBye) {
        return {
          ...slot,
          player: {
            ...p,
            projected_points: 0,
            sleeper_projected_points: 0,
            weekly_projected_points: 0,
          },
        };
      }
      return slot;
    });
  }, [context.draftState?.my_roster, favById, byePlayerIds, toCosmicPlayer, selectedWeek]);

  const swaps = useMemo(() => computeLineupCheck(weekAdjustedRoster, lambda, selectedWeek), [weekAdjustedRoster, lambda, selectedWeek]);
  const swapByStarterId = useMemo(() => new Map(swaps.filter((s) => s.playerOut).map((s) => [String(s.playerOut!.id), s])), [swaps]);
  const leagueStartingSlots = useMemo(() => extractStartingSlots(rawRosterPositions, context.draftState?.my_roster), [rawRosterPositions, context.draftState?.my_roster]);

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

  const hasFiniteTeamProj = isFiniteNum(userProjRaw) && isFiniteNum(oppProjRaw);
  const hasStarterMatchupInputs =
    allUserStarters.length > 0 &&
    allOppStarters.length > 0 &&
    !hasExplicitInvalidProj;
  const hasMatchupMetrics = !isLiveMode
    ? !hasExplicitInvalidProj
    : hasStarterMatchupInputs || hasFiniteTeamProj;

  const userProj = useMemo(() => {
    if (allUserStarters.length > 0) {
      const sum = allUserStarters.reduce((acc, s) => acc + starterCardStats(s), 0);
      return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0;
    }
    if (isFiniteNum(userProjRaw)) return userProjRaw;
    return !hasExplicitInvalidProj && !isLiveMode ? 125.0 : 0;
  }, [allUserStarters, starterCardStats, userProjRaw, hasExplicitInvalidProj, isLiveMode]);

  const oppProj = useMemo(() => {
    if (allOppStarters.length > 0) {
      const sum = allOppStarters.reduce((acc, s) => acc + starterCardStats(s), 0);
      return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0;
    }
    if (isFiniteNum(oppProjRaw)) return oppProjRaw;
    return !hasExplicitInvalidProj && !isLiveMode ? 110.0 : 0;
  }, [allOppStarters, starterCardStats, oppProjRaw, hasExplicitInvalidProj, isLiveMode]);

  const winProbCalc = useMemo(() => {
    if (!hasMatchupMetrics) return { winProb: 50.0, label: '-', isFavorite: true };
    const calc = calculateWinProbability(userProj, oppProj, userHarmony, oppHarmony);
    const useCalcDirectly = allUserStarters.length > 0 && allOppStarters.length > 0;
    const rawWinProb = Number((useCalcDirectly ? calc.winProbability : matchupData.win_probability) ?? calc.winProbability ?? 50.0);
    const finiteWinProb = Number.isFinite(rawWinProb) ? Math.min(100, Math.max(0, rawWinProb)) : 50.0;
    const label = (useCalcDirectly ? calc.favorabilityLabel : matchupData.win_probability_label) ?? calc.favorabilityLabel;
    return { winProb: finiteWinProb, label, isFavorite: finiteWinProb >= 50.0 };
  }, [hasMatchupMetrics, allUserStarters.length, allOppStarters.length, matchupData.win_probability, matchupData.win_probability_label, userProj, oppProj, userHarmony, oppHarmony]);

  const userAstral = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allUserStarters.length === 0) return Number.isFinite(fallbackUserAstral) ? fallbackUserAstral : 0;
    const sum = allUserStarters.reduce((acc, s) => {
      const val = boardMap.has(String(s.player_id)) ? starsScore(toCosmicPlayer(s), { currentWeek: selectedWeek }) : Number(s.favorability_score ?? 75);
      return acc + (Number.isFinite(val) ? val : 75);
    }, 0);
    return Math.round((sum / allUserStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allUserStarters, fallbackUserAstral, toCosmicPlayer, boardMap, selectedWeek]);
  const oppAstral = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allOppStarters.length === 0) return Number.isFinite(fallbackOppAstral) ? fallbackOppAstral : 0;
    const sum = allOppStarters.reduce((acc, s) => {
      const val = boardMap.has(String(s.player_id)) ? starsScore(toCosmicPlayer(s), { currentWeek: selectedWeek }) : Number(s.favorability_score ?? 75);
      return acc + (Number.isFinite(val) ? val : 75);
    }, 0);
    return Math.round((sum / allOppStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allOppStarters, fallbackOppAstral, toCosmicPlayer, boardMap, selectedWeek]);
  const userOracle = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allUserStarters.length === 0) {
      const safeProj = Number.isFinite(userProj) ? userProj : 0;
      const safeAstral = Number.isFinite(userAstral) ? userAstral : 0;
      const val = Math.round(((1 - lambda) * Math.min(100, Math.max(0, ((safeProj / 8) / 25) * 100)) + lambda * safeAstral) * 10) / 10;
      return Number.isFinite(val) ? val : 0;
    }
    const sum = allUserStarters.reduce((acc, s) => {
      const score = oracleScore(toCosmicPlayer(s), lambda, { currentWeek: selectedWeek });
      return acc + (Number.isFinite(score) ? score : 0);
    }, 0);
    return Math.round((sum / allUserStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allUserStarters, toCosmicPlayer, lambda, userProj, userAstral, selectedWeek]);
  const oppOracle = useMemo(() => {
    if (!hasMatchupMetrics) return 0;
    if (allOppStarters.length === 0) {
      const safeProj = Number.isFinite(oppProj) ? oppProj : 0;
      const safeAstral = Number.isFinite(oppAstral) ? oppAstral : 0;
      const val = Math.round(((1 - lambda) * Math.min(100, Math.max(0, ((safeProj / 8) / 25) * 100)) + lambda * safeAstral) * 10) / 10;
      return Number.isFinite(val) ? val : 0;
    }
    const sum = allOppStarters.reduce((acc, s) => {
      const score = oracleScore(toCosmicPlayer(s), lambda, { currentWeek: selectedWeek });
      return acc + (Number.isFinite(score) ? score : 0);
    }, 0);
    return Math.round((sum / allOppStarters.length) * 10) / 10;
  }, [hasMatchupMetrics, allOppStarters, toCosmicPlayer, lambda, oppProj, oppAstral, selectedWeek]);

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
    const isCardDominant = isFavoredInMatchup && !isOnBye;
    const cp = toCosmicPlayer(player, isOnBye);
    const placeholder = oraclePlaceholderInfo(cp, selectedWeek);

    const rawStars = boardMap.has(String(player.player_id))
      ? starsScore(cp, selectedWeek)
      : Number(player.favorability_score ?? 75);
    const stars = Number.isFinite(rawStars) ? rawStars : 75;
    const tone = favorabilityTone(stars);
    const rawStats = isOnBye ? 0 : Number(player.projected_points ?? statsPoints(cp));
    const stats = Number.isFinite(rawStats) ? rawStats : 0;
    const oracle = oracleScore(cp, lambda, { currentWeek: selectedWeek });
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
    const kickoffDisplay = isByeStadium
      ? 'Bye week'
      : (player.game_kickoff || 'Time TBA');

    return (
      <div
        key={`${selectedWeek}-${player.is_user_team ? 'u' : 'o'}-${player.player_id}-${idx}`}
        data-testid={!isMutedBench ? `matchup-starter-card-${player.player_id}` : undefined}
        data-dominant={isCardDominant ? 'true' : 'false'}
        onClick={() => openFavPlayer(player, swap?.playerIn ?? (vsStarter ? toCosmicPlayer(vsStarter) : null))}
        className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer h-full flex flex-col justify-between gap-1.5 ${
          isOnBye
            ? 'opacity-50 grayscale bg-slate-950/70 border-slate-700/50 hover:opacity-75'
            : isMutedBench
              ? 'opacity-75 bg-slate-950/50 border-white/10 hover:opacity-100'
              : player.is_user_team
                ? 'bg-purple-950/25 border-purple-500/60 hover:border-purple-400'
                : 'bg-slate-900/70 border-cyan-500/40 hover:border-cyan-400/70'
        }`}
      >
        <div className={`flex items-center justify-between gap-2 min-w-0 ${!player.is_user_team ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 ${!player.is_user_team ? 'flex-row-reverse text-right' : ''}`}>
            <PlayerHeadshot
              player={{ id: player.player_id, name: player.player_name, team: player.nfl_team || player.team, position: player.position }}
              size="matchup"
              className="border-white/15 shadow-sm"
            />
            <div data-testid="matchup-card-text-col" className={`min-w-0 flex-1 space-y-1 ${!player.is_user_team ? 'text-right' : ''}`}>
              <div className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${!player.is_user_team ? 'justify-end' : ''}`}>
                <PositionalBadge
                  position={player.position}
                  size="md"
                  className="shrink-0 sm:text-sm sm:px-2.5 sm:py-0.5 sm:font-bold"
                  depth={player.depth_chart_order ?? cp.depth_chart_order}
                />
                <span
                  title={player.player_name}
                  className="font-bold text-base sm:text-lg leading-tight text-slate-100 truncate"
                >
                  {player.player_name}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs sm:text-[13px] font-mono text-slate-300 min-w-0 overflow-hidden ${!player.is_user_team ? 'justify-end' : ''}`}>
                <span
                  title={`${player.nfl_team || player.team || 'FA'} · Bye ${cp.bye_week || '-'}`}
                  className="truncate"
                >
                  {player.nfl_team || player.team || 'FA'} · Bye {cp.bye_week || '-'}
                </span>
                {isOnBye && (
                  <span title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : `On bye in Week ${selectedWeek} - 0.0 projected points`} className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                    <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50">
                      {`BYE WK ${cp.bye_week || selectedWeek}`}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">· On Bye</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hierarchical Node Tree: Stats & Stars feeding upward into Oracle */}
          <div
            data-testid="player-oracle-tree"
            role="group"
            aria-label={`Player judgment synthesis tree for ${player.player_name}`}
            className="shrink-0 flex flex-col items-center w-[104px] sm:w-[112px] font-mono select-none pt-0.5"
          >
            <div
              data-testid="oracle-node"
              title={
                placeholder.hasPlaceholder
                  ? undefined
                  : isCardDominant
                  ? `Matchup Leader: ${oracle.toFixed(1)} Oracle (dominant score)`
                  : 'Combined Oracle Score (Stats + Stars)'
              }
              className={`relative w-[88px] sm:w-[94px] px-1.5 py-0.5 rounded-lg border text-center transition-all ${
                isCardDominant
                  ? player.is_user_team
                    ? 'bg-purple-900/75 border-purple-300 text-white shadow-[0_0_16px_rgba(168,85,247,0.85)] ring-1 ring-purple-300/70'
                    : 'bg-cyan-900/75 border-cyan-300 text-white shadow-[0_0_16px_rgba(6,182,212,0.85)] ring-1 ring-cyan-300/70'
                  : 'bg-slate-950/90 border-purple-500/30 text-purple-200'
              }`}
            >
              {isCardDominant && (
                <PowerupStars
                  seedKey={`${selectedWeek}-${player.player_id}-${idx}`}
                  isUserTeam={Boolean(player.is_user_team)}
                />
              )}
              <span
                className={`text-[8px] block uppercase tracking-wider leading-tight relative z-[1] ${
                  isCardDominant
                    ? player.is_user_team
                      ? 'text-purple-100 font-bold'
                      : 'text-cyan-100 font-bold'
                    : 'text-purple-300/80'
                }`}
              >
                Oracle
              </span>
              <span className="text-xs font-bold tabular-nums leading-tight relative z-[1]">
                {oracle.toFixed(1)}
                {placeholder.hasPlaceholder && (
                  <OraclePlaceholderMarker placeholder={placeholder} />
                )}
              </span>
            </div>

            <svg
              data-testid="oracle-tree-branches"
              viewBox="0 0 100 16"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="w-full h-2.5 overflow-visible pointer-events-none"
            >
              <path
                d="M 25 16 L 25 8 L 46 8 L 46 2"
                fill="none"
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
                strokeWidth={isCardDominant ? '1.75' : '1.25'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isCardDominant ? 'text-cyan-300' : 'text-cyan-500/60'}
              />
              <path
                d="M 43 4.5 L 46 1.5 L 49 4.5"
                fill="none"
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
                strokeWidth={isCardDominant ? '1.75' : '1.25'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isCardDominant ? 'text-cyan-300' : 'text-cyan-500/60'}
              />
              <path
                d="M 75 16 L 75 8 L 54 8 L 54 2"
                fill="none"
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
                strokeWidth={isCardDominant ? '1.75' : '1.25'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isCardDominant ? 'text-purple-300' : 'text-purple-400/60'}
              />
              <path
                d="M 51 4.5 L 54 1.5 L 57 4.5"
                fill="none"
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
                strokeWidth={isCardDominant ? '1.75' : '1.25'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isCardDominant ? 'text-purple-300' : 'text-purple-400/60'}
              />
            </svg>

            <div className="grid grid-cols-2 gap-1 w-full">
              <div
                data-testid="stats-node"
                className="px-1 py-0.5 rounded bg-slate-950/80 border border-cyan-500/20 text-center"
                title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Baseline projected points'}
              >
                <span className="text-[7px] text-slate-500 block uppercase leading-none">Stats</span>
                <span className="text-[11px] font-bold text-cyan-300 tabular-nums leading-tight">
                  {Math.round(stats * 100) % 10 === 0 ? stats.toFixed(1) : stats.toFixed(2)}
                </span>
              </div>
              <div
                data-testid="stars-node"
                className={`px-1 py-0.5 rounded border text-center ${TONE_PILL[tone]}`}
                title={placeholder.hasPlaceholder ? placeholder.tooltipText : starsVerdictLabel(stars)}
              >
                <span className="text-[7px] opacity-75 block uppercase leading-none">Stars</span>
                <span className="text-[11px] font-bold tabular-nums leading-tight">
                  {stars.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Consistent compact single-line venue conditions & kickoff strip */}
        <div
          data-testid="matchup-venue-row"
          className={`pt-1.5 border-t border-white/5 flex flex-col gap-0.5 text-[10px] font-mono min-w-0 ${
            !player.is_user_team ? 'items-end text-right' : 'items-start text-left'
          }`}
        >
          <div
            data-testid="matchup-venue-line"
            className={`flex items-center gap-1 min-w-0 max-w-full ${!player.is_user_team ? 'flex-row-reverse' : ''}`}
          >
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-slate-300 font-medium leading-tight truncate" title={stadiumDisplay}>
              {stadiumDisplay}
            </span>
          </div>
          <div
            data-testid="matchup-kickoff-line"
            className={`flex items-center gap-1 min-w-0 max-w-full text-slate-400 ${!player.is_user_team ? 'flex-row-reverse' : ''}`}
          >
            <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
            <span className="leading-tight truncate" title={kickoffDisplay}>{kickoffDisplay}</span>
          </div>
        </div>

        {/* Inline Swap Opportunity Tooltip on Starter Slots */}
        {swap && (() => {
          const benchCp = swap.playerIn;
          const benchOracle = currentWeekOracleScore(benchCp, lambda, selectedWeek);
          const benchDisplay = benchOracle.toFixed(1);
          const currentDisplay = currentWeekOracleScore(swap.playerOut ?? cp, lambda, selectedWeek).toFixed(1);
          const calculatedGain = Math.round((Number(benchDisplay) - Number(currentDisplay)) * 10) / 10;
          if (calculatedGain < 0.5) return null;
          const gainDisplay = calculatedGain.toFixed(1);
          return (
            <div
              role="button"
              tabIndex={0}
              data-testid="matchup-swap-opportunity"
              title={`Bench ${swap.playerIn.name} scores +${gainDisplay} higher Oracle (${benchDisplay} vs ${currentDisplay})`}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation();
                setInspected({ player: benchCp, vs: swap.playerOut ?? null });
              }}
              onKeyDown={(e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setInspected({ player: benchCp, vs: swap.playerOut ?? null });
                }
              }}
              className="px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-mono text-emerald-200 flex items-center justify-between gap-2 min-w-0"
            >
              <span data-testid="matchup-swap-tooltip" className="flex items-center gap-1.5 min-w-0">
                <ArrowUpDown className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">
                  Swap Opportunity: Bench <strong>{swap.playerIn.name}</strong> adds +{gainDisplay} Oracle
                </span>
              </span>
              <span className="underline text-[10px] shrink-0">Compare →</span>
            </div>
          );
        })()}
        <details className="group text-slate-300">
          <summary
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 cursor-pointer select-none leading-tight"
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
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-center bg-slate-950/70 p-4 rounded-xl border border-white/5">
            {/* LEFT: YOUR TEAM (Purple Identity; mobile single-column aligns left via justify-self-start) */}
            <div className="w-fit max-w-full min-w-0 justify-self-start flex items-center gap-3.5 p-3 rounded-xl bg-purple-950/35 border-2 border-purple-500/60 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
              <UserAvatar
                src={matchupData.user_team?.avatar_url || matchupData.user_team?.avatar}
                alt={`${userTeamName} avatar`}
                fallbackText={userTeamName}
                size="xl"
                isUser={true}
                testId="user-team-avatar"
                data-testid="user-team-avatar"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-base text-purple-100 truncate">{userTeamName}</span>
                </div>
                <div className="text-xs font-mono text-slate-400 truncate">
                  Mgr: {matchupData.user_team?.owner_name?.trim() || 'Manager'}
                </div>
                <div
                  data-testid="matchup-header-user-score"
                  className="text-lg font-mono font-bold text-purple-300 mt-0.5 tabular-nums min-w-[7ch]"
                >
                  {hasMatchupMetrics || (headerScoreMode === 'stats' && showFinalLabel)
                    ? headerScoreMode === 'oracle'
                      ? userOracle.toFixed(1)
                      : Number(
                          showFinalLabel
                            ? matchupData.score_user
                            : userProj,
                        ).toFixed(2)
                    : '-'}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {headerScoreMode === 'oracle' ? 'Oracle' : showFinalLabel ? 'Final' : 'Stats'}
                  </span>
                </div>
              </div>
            </div>

            {/* CENTER: VS, Header Score Mode Toggle & Win Probability Gauge */}
            <div className="flex flex-col items-center justify-center text-center py-1">
              <span className="text-xs font-serif font-bold text-slate-300 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10">
                VS
              </span>
              <div
                role="radiogroup"
                aria-label="Matchup header score mode"
                className="mt-1 inline-flex items-center rounded-lg bg-slate-900/90 border border-white/10 px-0.5"
              >
                <button
                  ref={oracleRadioRef}
                  type="button"
                  role="radio"
                  aria-checked={headerScoreMode === 'oracle'}
                  tabIndex={headerScoreMode === 'oracle' ? 0 : -1}
                  data-testid="matchup-score-mode-oracle"
                  onClick={() => setHeaderScoreMode('oracle')}
                  onKeyDown={(e: { key: string; preventDefault: () => void }) => {
                    if (
                      e.key === 'ArrowRight' ||
                      e.key === 'ArrowDown' ||
                      e.key === 'ArrowLeft' ||
                      e.key === 'ArrowUp' ||
                      e.key === 'End'
                    ) {
                      e.preventDefault();
                      setHeaderScoreMode('stats');
                      statsRadioRef.current?.focus();
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      setHeaderScoreMode('oracle');
                      oracleRadioRef.current?.focus();
                    }
                  }}
                  className="min-h-[44px] min-w-[44px] px-0.5 inline-flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${
                      headerScoreMode === 'oracle'
                        ? 'bg-purple-600/80 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Oracle
                  </span>
                </button>
                <button
                  ref={statsRadioRef}
                  type="button"
                  role="radio"
                  aria-checked={headerScoreMode === 'stats'}
                  tabIndex={headerScoreMode === 'stats' ? 0 : -1}
                  data-testid="matchup-score-mode-stats"
                  onClick={() => setHeaderScoreMode('stats')}
                  onKeyDown={(e: { key: string; preventDefault: () => void }) => {
                    if (
                      e.key === 'ArrowRight' ||
                      e.key === 'ArrowDown' ||
                      e.key === 'ArrowLeft' ||
                      e.key === 'ArrowUp' ||
                      e.key === 'Home'
                    ) {
                      e.preventDefault();
                      setHeaderScoreMode('oracle');
                      oracleRadioRef.current?.focus();
                    } else if (e.key === 'End') {
                      e.preventDefault();
                      setHeaderScoreMode('stats');
                      statsRadioRef.current?.focus();
                    }
                  }}
                  className="min-h-[44px] min-w-[44px] px-0.5 inline-flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${
                      headerScoreMode === 'stats'
                        ? 'bg-cyan-600/80 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {showFinalLabel ? 'Final' : 'Stats'}
                  </span>
                </button>
              </div>
              <div className="mt-1 flex flex-col items-center gap-1">
                <span className={`text-xs font-mono font-bold whitespace-nowrap ${winProbCalc.isFavorite ? 'text-emerald-400' : 'text-rose-400'}`}>
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

            {/* RIGHT: OPPONENT TEAM (mobile single-column aligns right via justify-self-end) */}
            <div className="w-fit max-w-full min-w-0 justify-self-end flex flex-row-reverse items-center gap-3.5 p-3 rounded-xl bg-cyan-950/20 border-2 border-cyan-500/40 text-right">
              <UserAvatar
                src={matchupData.opponent_team?.avatar_url || matchupData.opponent_team?.avatar}
                alt={`${oppTeamName} avatar`}
                fallbackText={oppTeamName}
                size="xl"
                isUser={false}
                testId="opponent-team-avatar"
                data-testid="opponent-team-avatar"
              />
              <div className="min-w-0 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-serif font-bold text-base text-cyan-100 truncate">{oppTeamName}</span>
                </div>
                <div className="text-xs font-mono text-slate-400 truncate">
                  Mgr: {matchupData.opponent_team?.owner_name?.trim() || 'Manager'}
                </div>
                <div
                  data-testid="matchup-header-opp-score"
                  className="text-lg font-mono font-bold text-cyan-300 mt-0.5 tabular-nums min-w-[7ch]"
                >
                  {hasMatchupMetrics || (headerScoreMode === 'stats' && showFinalLabel)
                    ? headerScoreMode === 'oracle'
                      ? oppOracle.toFixed(1)
                      : Number(
                          showFinalLabel
                            ? matchupData.score_opponent
                            : oppProj,
                        ).toFixed(2)
                    : '-'}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {headerScoreMode === 'oracle' ? 'Oracle' : showFinalLabel ? 'Final' : 'Stats'}
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
                title: 'Starter Stars Avg',
                left: userAstral,
                right: oppAstral,
                fmt: (n: number) => (hasMatchupMetrics ? n.toFixed(1) : '-'),
              },
              {
                title: 'Squad Harmony Rating',
                left: userHarmony,
                right: oppHarmony,
                fmt: (n: number) => {
                  if (!hasMatchupMetrics) return '-';
                  const pct = Math.round(n);
                  return `${pct}% (${pct >= 85 ? 'Apex Harmony' : pct >= 75 ? 'Harmonic Balance' : 'Discordant Risk'})`;
                },
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
            <h3
              title="Starters paired 1:1 by Sleeper league starting lineup slots."
              className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Positional Starter Matchups</span>
            </h3>
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
            {displayedPairs.map((pair, idx) => {
              const hasBoth = Boolean(pair.user && pair.opp);
              const isUserOnBye = pair.user ? byePlayerIds.has(String(pair.user.player_id)) : false;
              const isOppOnBye = pair.opp ? byePlayerIds.has(String(pair.opp.player_id)) : false;
              const uOracle = pair.user ? oracleScore(toCosmicPlayer(pair.user, isUserOnBye), lambda, { currentWeek: selectedWeek }) : 0;
              const oOracle = pair.opp ? oracleScore(toCosmicPlayer(pair.opp, isOppOnBye), lambda, { currentWeek: selectedWeek }) : 0;
              const effUserOracle = isUserOnBye ? 0 : uOracle;
              const effOppOracle = isOppOnBye ? 0 : oOracle;
              const delta = hasBoth ? effUserOracle - effOppOracle : 0;
              const isZeroSplit = hasBoth && effUserOracle + effOppOracle <= 0;
              const isUserFavored = hasBoth && !isZeroSplit && !isUserOnBye && delta > 0.05;
              const isOppFavored = hasBoth && !isZeroSplit && !isOppOnBye && delta < -0.05;
              const comparisonStatus = !hasBoth
                ? 'Open'
                : isUserOnBye && isOppOnBye
                ? 'Both starters on bye'
                : isUserOnBye
                ? 'Opponent active vs user on bye'
                : isOppOnBye
                ? 'User active vs opponent on bye'
                : isUserFavored
                ? 'User dominant'
                : isOppFavored
                ? 'Opponent dominant'
                : 'Even';

              return (
                <div key={`slot-pair-${pair.slotRole}-${idx}`} className="p-2 rounded-xl bg-slate-900/40 border border-white/5">
                  <span className="sr-only">
                    {`${pair.slotLabel}: ${pair.user ? `${pair.user.player_name} Oracle ${uOracle.toFixed(1)}` : 'Empty'} vs ${pair.opp ? `${pair.opp.player_name} Oracle ${oOracle.toFixed(1)}` : 'Empty'} - ${comparisonStatus}`}
                  </span>
                  {/* Paired Starter Cards (Left = Yours in Purple, Middle = Slot Badge, Right = Opponent in Cyan) */}
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2.5 lg:gap-3 items-stretch">
                    <div data-slot-side="user" className="h-full flex flex-col">
                      {pair.user ? (
                        renderPlayerCard(pair.user, false, idx, pair.opp, isUserFavored)
                      ) : (
                        <div className="p-2.5 rounded-xl border border-dashed border-white/10 text-xs font-mono text-slate-500 h-full flex items-center justify-center">
                          Empty starter slot
                        </div>
                      )}
                    </div>
                    <RosterSlotBadge
                      slotId={pair.slotRole}
                      slotLabel={pair.slotLabel}
                      dataTestId="matchup-slot-label"
                      size="sm"
                      className="place-self-center tracking-wider"
                    />
                    <div data-slot-side="opponent" className="h-full flex flex-col">
                      {pair.opp ? (
                        renderPlayerCard(pair.opp, false, idx, pair.user, isOppFavored)
                      ) : (
                        <div className="p-2.5 rounded-xl border border-dashed border-white/10 text-xs font-mono text-slate-500 h-full flex items-center justify-center">
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
                    title={`${p.is_user_team ? userTeamName : oppTeamName} · On bye in Week ${selectedWeek} - 0.0 pts`}
                    className={`px-2 py-0.5 rounded border text-[10px] ${
                      p.is_user_team
                        ? 'bg-purple-950/80 border-purple-400/50 text-purple-200'
                        : 'bg-cyan-950/60 border-cyan-400/40 text-cyan-200'
                    }`}
                  >
                    {p.player_name} ({p.position}{p.is_benched ? ' · BN' : ' · START'})
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
        activeWeek={selectedWeek}
      />
    </div>
  );
};

export default MatchupsScreen;
