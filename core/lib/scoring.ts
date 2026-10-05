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

/**
 * Oneiromancy - Divination & Scoring Engine
 * Pure mathematical scoring functions implementing the Chaos Dial, 5 Divination Tiers,
 * Western Trines, QB-Receiver Stack Multipliers, and Positional Cap Deductions.
 */

import {
  CompetitorTeam,
  CosmicPlayer,
  DivinationBreakdown,
  DraftState,
  ElementType,
  IdealDraftPick,
  NFLPosition,
  OneiromancySettings,
  OracleWeights,
  PlayerMatchupFavorability,
  RosterSlot,
  SleeperPick,
  TradeParticipant,
  TradeProposal,
  WaiverUpgrade,
} from '../types/oneiromancy';

// ============================================================================
// Constants & Baselines
// ============================================================================

export const BASELINES: Record<NFLPosition, number> & {
  DEFAULT_MAX_VOR: number;
} = {
  QB: 260.0,
  RB: 170.0,
  WR: 180.0,
  TE: 120.0,
  K: 110.0,
  DEF: 100.0,
  DEFAULT_MAX_VOR: 100.0,
};

export const DEFAULT_ORACLE_WEIGHTS: OracleWeights = {
  celestial: 0.3,
  numeric: 0.2,
  geomantic: 0.25,
  oracular: 0.1,
  harmony: 0.15,
};

export const DEFAULT_CHAOS_LAMBDA = 0.35;

// ============================================================================
// Utility & Clamping
// ============================================================================

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || value === null || value === undefined) return min;
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// 1. VOR & DraftScore Calculations
// ============================================================================

export function calculateVOR(
  projectedPoints: number,
  position: NFLPosition,
  customBaseline: number | null = null,
): number {
  const baseline =
    customBaseline !== null ? customBaseline : (BASELINES[position] ?? 150.0);
  return Number((projectedPoints - baseline).toFixed(2));
}

export function normalizeVOR(
  rawVor: number,
  maxVor: number = BASELINES.DEFAULT_MAX_VOR,
): number {
  if (maxVor <= 0) return 50.0;
  const scaled = 50 + (rawVor / maxVor) * 45;
  return Number(clamp(scaled, 0.0, 100.0).toFixed(2));
}

export function computeDraftScore(
  vorNorm: number,
  spiritScore: number,
  lambda: number = DEFAULT_CHAOS_LAMBDA,
): number {
  const clampedLambda = clamp(lambda, 0.0, 1.0);
  const blended = (1.0 - clampedLambda) * vorNorm + clampedLambda * spiritScore;
  return Number(clamp(blended, 0.0, 100.0).toFixed(2));
}

export interface WeeklyPlayerFavorabilityOptions {
  spiritScore?: number;
  spirit?: number;
  projectedPoints?: number;
  weeklyProj?: number;
  injuryStatus?: string | null;
  isStarter?: boolean;
  geomantic?: number;
  stadiumScore?: number;
}

export function computeWeeklyPlayerFavorability(
  spiritOrOptions: number | WeeklyPlayerFavorabilityOptions,
  weeklyProjArg?: number,
  injuryStatusArg?: string | null,
  isStarterArg: boolean = true,
  geomanticArg: number = 78.0,
): {
  score: number;
  verdict:
    | 'HEAVILY FAVORED'
    | 'ASTRALLY FAVORED'
    | 'NEUTRAL'
    | 'CELESTIALLY CHALLENGED';
  base_spirit: number;
  role_modifier: number;
  health_penalty: number;
  venue_bonus: number;
  stadium_score: number;
} {
  let spirit: number;
  let weeklyProj: number;
  let injuryStatus: string | null | undefined;
  let isStarter: boolean;
  let geomantic: number;

  if (typeof spiritOrOptions === 'object' && spiritOrOptions !== null) {
    spirit = spiritOrOptions.spiritScore ?? spiritOrOptions.spirit ?? 50.0;
    weeklyProj =
      spiritOrOptions.projectedPoints ?? spiritOrOptions.weeklyProj ?? 0.0;
    injuryStatus = spiritOrOptions.injuryStatus;
    isStarter = spiritOrOptions.isStarter ?? true;
    geomantic =
      spiritOrOptions.geomantic ?? spiritOrOptions.stadiumScore ?? 78.0;
  } else {
    spirit = typeof spiritOrOptions === 'number' ? spiritOrOptions : 50.0;
    weeklyProj = weeklyProjArg ?? 0.0;
    injuryStatus = injuryStatusArg;
    isStarter = isStarterArg ?? true;
    geomantic = geomanticArg ?? 78.0;
  }

  const baseSpirit = Math.round(spirit * 0.45 * 10) / 10;
  const roleModifier = isStarter ? 8.0 : -6.0;
  const isZeroProj = weeklyProj <= 0;
  const isInjured =
    injuryStatus === 'Doubtful' ||
    injuryStatus === 'Out' ||
    injuryStatus === 'IR' ||
    (injuryStatus === 'Questionable' && isZeroProj);
  const healthPenalty = isZeroProj || isInjured ? -22.0 : 0.0;
  const stadiumScore = Math.round(geomantic * 0.25 * 10) / 10;
  const venueBonus = stadiumScore;
  const projBonus = Math.round(weeklyProj * 0.8 * 10) / 10;

  const raw =
    Math.round(
      (baseSpirit + roleModifier + healthPenalty + stadiumScore + projBonus) *
        10,
    ) / 10;
  const score = clamp(raw, 0.0, 100.0);

  const verdict =
    score >= 84
      ? 'HEAVILY FAVORED'
      : score >= 75
        ? 'ASTRALLY FAVORED'
        : score >= 65
          ? 'NEUTRAL'
          : 'CELESTIALLY CHALLENGED';

  return {
    score,
    verdict,
    base_spirit: baseSpirit,
    role_modifier: roleModifier,
    health_penalty: healthPenalty,
    venue_bonus: venueBonus,
    stadium_score: stadiumScore,
  };
}

export function computeTeamMatchupFavorability(
  starters: Array<{favorability_score?: number; score?: number} | number>,
): number {
  if (!starters || starters.length === 0) return 75.0;
  const scores = starters.map((p) =>
    typeof p === 'number' ? p : (p.favorability_score ?? p.score ?? 75.0),
  );
  const sum = scores.reduce((a, b) => a + b, 0);
  return Number((sum / scores.length).toFixed(1));
}

/**
 * Pure in-memory high-speed recomputation of DraftScores across all players.
 * Designed for 60fps drag responsiveness (<2ms execution for 300+ players).
 */
export function recomputeDraftScores(
  players: CosmicPlayer[],
  settings: OneiromancySettings,
): CosmicPlayer[] {
  const lambda = clamp(
    settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA,
    0.0,
    1.0,
  );
  const oneMinusLambda = 1.0 - lambda;
  const len = players.length;
  const result = new Array<CosmicPlayer>(len);

  for (let i = 0; i < len; i++) {
    const p = players[i];
    const blended = oneMinusLambda * p.vor_normalized + lambda * p.spirit_score;
    const draftScore =
      blended < 0.0
        ? 0.0
        : blended > 100.0
          ? 100.0
          : Math.round(blended * 100) / 100;

    const weeklyProj =
      p.weekly_projected_points ??
      p.sleeper_projected_points ??
      p.projected_points ??
      0;
    const isStarter = p.draft_status === 'my_team' || weeklyProj >= 8.0;
    const geomantic = p.divination_breakdown?.geomantic ?? 78.0;
    const fav = computeWeeklyPlayerFavorability(
      p.spirit_score,
      weeklyProj,
      p.injury_status,
      isStarter,
      geomantic,
    );

    result[i] = {
      ...p,
      draft_score: draftScore,
      favorability_score: fav.score,
      favorability_verdict: fav.verdict as any,
    };
  }

  return result;
}

// ============================================================================
// 2. Oracle Weights & Spirit Score
// ============================================================================

export function normalizeOracleWeights(
  weights: Partial<OracleWeights> = {},
): OracleWeights {
  const cel = Math.max(
    0,
    weights.celestial ?? DEFAULT_ORACLE_WEIGHTS.celestial,
  );
  const num = Math.max(0, weights.numeric ?? DEFAULT_ORACLE_WEIGHTS.numeric);
  const geo = Math.max(
    0,
    weights.geomantic ?? DEFAULT_ORACLE_WEIGHTS.geomantic,
  );
  const ora = Math.max(0, weights.oracular ?? DEFAULT_ORACLE_WEIGHTS.oracular);
  const har = Math.max(0, weights.harmony ?? DEFAULT_ORACLE_WEIGHTS.harmony);

  const sum = cel + num + geo + ora + har;
  if (sum === 0) {
    return {...DEFAULT_ORACLE_WEIGHTS};
  }

  return {
    celestial: Number((cel / sum).toFixed(4)),
    numeric: Number((num / sum).toFixed(4)),
    geomantic: Number((geo / sum).toFixed(4)),
    oracular: Number((ora / sum).toFixed(4)),
    harmony: Number((har / sum).toFixed(4)),
  };
}

export function computeSpiritScore(
  breakdown: Partial<DivinationBreakdown> = {},
  customWeights: Partial<OracleWeights> | null = null,
): number {
  const weights = customWeights
    ? normalizeOracleWeights(customWeights)
    : DEFAULT_ORACLE_WEIGHTS;
  const cel = breakdown.celestial ?? 50.0;
  const num = breakdown.numeric ?? 50.0;
  const geo = breakdown.geomantic ?? 50.0;
  const ora = breakdown.oracular ?? 50.0;
  const har = breakdown.harmony ?? 50.0;

  const total =
    weights.celestial * cel +
    weights.numeric * num +
    weights.geomantic * geo +
    weights.oracular * ora +
    weights.harmony * har;

  return Number(clamp(total, 0.0, 100.0).toFixed(2));
}

// ============================================================================
// 3. Numerology & Tier 2 Math
// ============================================================================

export function digitalRoot(n: number, preserveMasters = true): number {
  let num = Math.abs(Math.floor(n));
  if (preserveMasters && (num === 11 || num === 22 || num === 33)) {
    return num;
  }
  while (num >= 10) {
    if (preserveMasters && (num === 11 || num === 22 || num === 33)) {
      return num;
    }
    num = String(num)
      .split('')
      .reduce((sum, d) => sum + parseInt(d, 10), 0);
  }
  return num;
}

export function calculateLifePath(birthDateStr?: string | null): number {
  if (!birthDateStr || typeof birthDateStr !== 'string') return 7; // Default Life Path
  const digits = birthDateStr.replace(/\D/g, '');
  if (!digits) return 7;
  const initialSum = digits
    .split('')
    .reduce((sum, d) => sum + parseInt(d, 10), 0);
  return digitalRoot(initialSum, true);
}

export function numberResonance(a: number, b: number): number {
  if (a === b) return 1.0;
  if (a + b === 10 || Math.abs(a - b) === 3) return 0.8;
  return 0.3;
}

export function calculateNumericTier(
  birthDate?: string | null,
  jerseyNumber?: number | null,
  seasonYear = 2025,
): number {
  const lifePath = calculateLifePath(birthDate);
  const jerseyRoot = digitalRoot(jerseyNumber ?? 0, false);
  const seasonRoot = digitalRoot(seasonYear, false);

  const res1 = numberResonance(lifePath, jerseyRoot);
  const res2 = numberResonance(jerseyRoot, seasonRoot);
  const masterBonus =
    lifePath === 11 || lifePath === 22 || lifePath === 33 ? 1.0 : 0.0;

  const raw = 40 + 25 * res1 + 20 * res2 + 15 * masterBonus;
  return Number(clamp(raw, 0.0, 100.0).toFixed(2));
}

// ============================================================================
// 4. Geomancy & Tier 3 Math
// ============================================================================

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GeomanticTraits {
  orientation?: 'N-S' | 'E-W' | string;
  domeType?: 'Open' | 'Fixed Dome' | 'Retractable' | string;
  surface?: 'Grass' | 'Turf' | string;
  meridianBonus?: boolean;
}

export function calculateGeomanticTier(
  playerCoords?: {lat: number; lon: number} | null,
  stadiumCoords?: {lat: number; lon: number} | null,
  traits: GeomanticTraits = {},
): number {
  let fengShui = 50;
  if (traits.orientation === 'N-S') fengShui += 15;
  else if (traits.orientation === 'E-W') fengShui -= 10;

  if (traits.domeType === 'Open') fengShui += 10;
  else if (traits.domeType === 'Fixed Dome') fengShui += 5;

  if (traits.surface === 'Grass') fengShui += 10;
  else if (traits.surface === 'Turf') fengShui -= 5;

  let astroScore = 70;
  if (playerCoords && stadiumCoords) {
    const dist = haversineDistance(
      playerCoords.lat,
      playerCoords.lon,
      stadiumCoords.lat,
      stadiumCoords.lon,
    );
    astroScore =
      clamp(100 - dist / 50, 40, 100) + (traits.meridianBonus ? 15 : 0);
  }

  const result =
    0.4 * clamp(fengShui, 0, 100) + 0.6 * clamp(astroScore, 0, 100);
  return Number(clamp(result, 0.0, 100.0).toFixed(2));
}

// ============================================================================
// 5. Harmony Engine & Squad Alchemy (Tier 5)
// ============================================================================

export function calculateWesternTrinesBonus(
  elementCounts: Partial<Record<ElementType, number>> = {},
): number {
  let maxSameElement = 0;
  for (const el of ['Fire', 'Earth', 'Air', 'Water'] as const) {
    const count = elementCounts[el] ?? 0;
    if (count > maxSameElement) maxSameElement = count;
  }
  if (maxSameElement >= 4) return 18.0;
  if (maxSameElement >= 3) return 12.0;
  return 0.0;
}

export const calculateWesternTrineBonus = calculateWesternTrinesBonus;

export function calculateStackMultiplier(
  candidatePlayer?: Partial<CosmicPlayer> | null,
  roster: RosterSlot[] = [],
): number {
  if (!candidatePlayer || !candidatePlayer.team || !candidatePlayer.position)
    return 0.0;
  const isPassCatcher =
    candidatePlayer.position === 'WR' || candidatePlayer.position === 'TE';
  const isQB = candidatePlayer.position === 'QB';

  if (!isPassCatcher && !isQB) return 0.0;

  let hasSameTeamQB = false;
  let sameTeamPassCatcherCount = 0;

  for (const slot of roster) {
    const p = slot.player;
    if (!p || p.team !== candidatePlayer.team) continue;
    if (p.position === 'QB') hasSameTeamQB = true;
    if (p.position === 'WR' || p.position === 'TE') sameTeamPassCatcherCount++;
  }

  if (isPassCatcher && hasSameTeamQB) {
    if (sameTeamPassCatcherCount === 0) {
      return 18.0; // 3.0x base stack (3.0 * 6.0)
    } else {
      return 9.0; // Double stack bonus
    }
  }

  if (isQB && sameTeamPassCatcherCount > 0) {
    return 18.0; // QB stacks with existing receiver
  }

  return 0.0;
}

export function calculatePositionalCapsPenalty(
  candidatePosition?: NFLPosition | string | null,
  roster: RosterSlot[] = [],
  round = 1,
): number {
  let qbCount = 0;
  let teCount = 0;
  let defCount = 0;
  let kCount = 0;

  for (const slot of roster) {
    const p = slot.player;
    if (!p) continue;
    if (p.position === 'QB') qbCount++;
    if (p.position === 'TE') teCount++;
    if (p.position === 'DEF') defCount++;
    if (p.position === 'K') kCount++;
  }

  if (candidatePosition === 'QB') {
    if (qbCount >= 2) return 35.0; // 3rd QB
    if (qbCount === 1 && round < 10) return 15.0; // 2nd QB before Rd 10
  }
  if (candidatePosition === 'TE') {
    if (teCount >= 1 && round < 11) return 15.0; // 2nd TE before Rd 11
  }
  if (candidatePosition === 'DEF' && defCount >= 1) return 40.0; // 2nd DEF
  if (candidatePosition === 'K' && kCount >= 1) return 40.0; // 2nd K

  return 0.0;
}

export function calculateQuadBalanceBonus(
  elementCounts: Partial<Record<ElementType, number>> = {},
): number {
  const fire = (elementCounts.Fire ?? 0) >= 1;
  const earth = (elementCounts.Earth ?? 0) >= 1;
  const air = (elementCounts.Air ?? 0) >= 1;
  const water = (elementCounts.Water ?? 0) >= 1;
  return fire && earth && air && water ? 10.0 : 0.0;
}

/**
 * Calculates squad harmony score, accommodating either (roster, candidate) or (candidate, roster) argument orders.
 */
export function calculateHarmony(
  arg1?: RosterSlot[] | Partial<CosmicPlayer> | null,
  arg2?: Partial<CosmicPlayer> | RosterSlot[] | null,
  round = 1,
): number {
  let roster: RosterSlot[] = [];
  let candidate: Partial<CosmicPlayer> | null = null;

  if (Array.isArray(arg1)) {
    roster = arg1;
    candidate = (arg2 as Partial<CosmicPlayer>) || null;
  } else {
    candidate = (arg1 as Partial<CosmicPlayer>) || null;
    roster = Array.isArray(arg2) ? arg2 : [];
  }

  const elementCounts: Record<ElementType, number> = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };
  for (const slot of roster) {
    const p = slot.player;
    if (p?.elemental_traits?.element) {
      elementCounts[p.elemental_traits.element] =
        (elementCounts[p.elemental_traits.element] || 0) + 1;
    }
  }

  if (candidate?.elemental_traits?.element) {
    const el = candidate.elemental_traits.element;
    elementCounts[el] = (elementCounts[el] || 0) + 1;
  }

  const trineBonus = calculateWesternTrinesBonus(elementCounts);
  const stackBonus = calculateStackMultiplier(candidate, roster);
  const quadBonus = calculateQuadBalanceBonus(elementCounts);
  const capPenalty = calculatePositionalCapsPenalty(
    candidate?.position,
    roster,
    round,
  );

  const rawHarmony = 50 + trineBonus + stackBonus + quadBonus - capPenalty;
  return Number(clamp(rawHarmony, 0.0, 100.0).toFixed(2));
}

export const calculateHarmonyScore = (
  candidatePlayer?: Partial<CosmicPlayer> | null,
  roster: RosterSlot[] = [],
  round = 1,
): number => calculateHarmony(candidatePlayer, roster, round);

/**
 * Computes squad harmony score across an array of players or roster slots.
 */
export function computeRosterHarmony(
  players: (Partial<CosmicPlayer> | RosterSlot | null | undefined)[],
): number {
  const validPlayers: Partial<CosmicPlayer>[] = [];
  for (const item of players) {
    if (!item) continue;
    if ('player' in item && item.player) {
      validPlayers.push(item.player);
    } else if ('name' in item || 'elemental_traits' in item || 'id' in item) {
      validPlayers.push(item as Partial<CosmicPlayer>);
    }
  }
  if (validPlayers.length === 0) return 50.0;

  const elementCounts: Record<ElementType, number> = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };
  for (const p of validPlayers) {
    if (p.elemental_traits?.element) {
      elementCounts[p.elemental_traits.element] =
        (elementCounts[p.elemental_traits.element] || 0) + 1;
    }
  }

  const rosterSlots: RosterSlot[] = validPlayers.map((p, idx) => ({
    slot_id: `slot_${idx}`,
    slot_name: p.position || 'BN',
    position: (p.position as any) || 'BN',
    eligible_positions: p.position ? [p.position as any] : [],
    player: p as CosmicPlayer,
    is_locked: false,
  }));

  const trineBonus = calculateWesternTrinesBonus(elementCounts);
  let stackBonus = 0;
  for (const p of validPlayers) {
    stackBonus += calculateStackMultiplier(
      p,
      rosterSlots.filter((s) => s.player?.id !== p.id),
    );
  }
  stackBonus = Math.min(stackBonus, 30.0);
  const quadBonus = calculateQuadBalanceBonus(elementCounts);
  const rawHarmony = 50 + trineBonus + stackBonus + quadBonus;
  return Number(clamp(rawHarmony, 0.0, 100.0).toFixed(2));
}

/**
 * Compute Spirit Score across the 5 divination tiers.
 */
export function calculateSpiritScore(
  player: Partial<CosmicPlayer>,
  roster: RosterSlot[] = [],
  weights: Partial<OracleWeights> | null = null,
  round = 1,
): number {
  const normWeights = weights
    ? normalizeOracleWeights(weights)
    : DEFAULT_ORACLE_WEIGHTS;

  let celestial = player.divination_breakdown?.celestial;
  let numeric = player.divination_breakdown?.numeric;
  let geomantic = player.divination_breakdown?.geomantic;
  let oracular = player.divination_breakdown?.oracular;
  let harmony = player.divination_breakdown?.harmony;

  if (harmony === undefined && roster) {
    harmony = calculateHarmony(roster, player, round);
  }

  const breakdown: DivinationBreakdown = {
    celestial: celestial ?? 85.0,
    numeric: numeric ?? calculateNumericTier(null, player.jersey_number),
    geomantic: geomantic ?? 85.0,
    oracular: oracular ?? 85.0,
    harmony: harmony ?? 50.0,
  };

  return computeSpiritScore(breakdown, normWeights);
}

// ============================================================================
// 6. Draft State & Polling Helpers
// ============================================================================

export function calculateSnakePick(
  pickIndex0Based: number,
  totalTeams = 12,
  reversalRound: number | null = null,
): {overallPick: number; round: number; pickInRound: number; slot: number} {
  const overallPick = pickIndex0Based + 1;
  const round = Math.floor(pickIndex0Based / totalTeams) + 1;
  const k = (pickIndex0Based % totalTeams) + 1;

  let slot: number;
  if (reversalRound === 3) {
    if (round === 1) {
      slot = k;
    } else if (round % 2 === 1 && round >= 3) {
      slot = totalTeams - k + 1;
    } else {
      slot = k;
    }
  } else {
    if (round % 2 === 1) {
      slot = k;
    } else {
      slot = totalTeams - k + 1;
    }
  }

  return {overallPick, round, pickInRound: k, slot};
}

export function deriveDraftStatus(
  pickCount: number,
  totalTeams = 12,
  totalRounds = 15,
): 'pre_draft' | 'drafting' | 'complete' {
  const maxPicks = totalTeams * totalRounds;
  if (pickCount >= maxPicks) {
    return 'complete';
  }
  if (pickCount === 0) {
    return 'pre_draft';
  }
  return 'drafting';
}

export function detectPollerDelta(
  lastPickCount: number,
  newPickCount: number,
  lastStatus: string,
  newStatus: string,
): {hasDelta: boolean; shouldRecompute: boolean; newPicksAdded: number} {
  const countChanged = newPickCount > lastPickCount;
  const statusChanged = lastStatus !== newStatus;
  return {
    hasDelta: countChanged || statusChanged,
    shouldRecompute: countChanged,
    newPicksAdded: Math.max(0, newPickCount - lastPickCount),
  };
}

// ============================================================================
// 8. Weekly Matchup Win Probability & Favorability Classification
// ============================================================================

export function calculateWinProbability(
  userProjected: number,
  oppProjected: number,
  userHarmony = 80.0,
  oppHarmony = 80.0,
): {
  winProbability: number; // percentage, e.g. 82.2
  winProbabilityFraction: number; // 0.0 to 1.0, e.g. 0.822
  favorabilityLabel: string; // "Heavy Astral Favorite", "Moderate Advantage", etc.
  pointDelta: number; // user - opp
} {
  const diff = userProjected - oppProjected;
  // Logistic function with NFL standard deviation factor ~18.0
  const baseProb = 1 / (1 + Math.exp(-diff / 18.0));
  // Celestial harmony adjustment: +0.2% per point of harmony delta
  const harmonyAdjustment = (userHarmony - oppHarmony) * 0.002;
  const rawProb = baseProb + harmonyAdjustment;
  const clampedProb = clamp(rawProb, 0.05, 0.95);
  const winProbability = Math.round(clampedProb * 1000) / 10; // e.g. 82.2

  let favorabilityLabel = 'Even Match';
  if (winProbability >= 78.0) {
    favorabilityLabel = 'Heavy Favorite';
  } else if (winProbability >= 62.0) {
    favorabilityLabel = 'Astral Edge';
  } else if (winProbability >= 52.0) {
    favorabilityLabel = 'Slight Edge';
  } else if (winProbability >= 48.0) {
    favorabilityLabel = 'Even Match';
  } else if (winProbability >= 38.0) {
    favorabilityLabel = 'Slight Dog';
  } else if (winProbability >= 22.0) {
    favorabilityLabel = 'Astral Dog';
  } else {
    favorabilityLabel = 'Heavy Dog';
  }

  return {
    winProbability,
    winProbabilityFraction: clampedProb,
    favorabilityLabel,
    pointDelta: Math.round(diff * 100) / 100,
  };
}

export type FavorabilityTier = 'Favorable' | 'Harmonic' | 'Discordant';

export function classifySpiritScoreTier(spiritScore: number): {
  tier: FavorabilityTier;
  badgeLabel: string;
  glowColor: 'green' | 'blue' | 'rose';
  description: string;
} {
  if (spiritScore >= 85.0) {
    return {
      tier: 'Favorable',
      badgeLabel: '✨ Favorable (Apex)',
      glowColor: 'green',
      description: 'Celestial Alignment & Astral Momentum',
    };
  }
  if (spiritScore >= 75.0) {
    return {
      tier: 'Harmonic',
      badgeLabel: '⚖️ Harmonic (Stable)',
      glowColor: 'blue',
      description: 'Elemental Equilibrium & Stable Floor',
    };
  }
  return {
    tier: 'Discordant',
    badgeLabel: '⚠️ Discordant (At Risk)',
    glowColor: 'rose',
    description: 'Planetary Discord & Elemental Conflicts',
  };
}

// ============================================================================
// 8. Competitor Team Celestial Metrics & Invariant Ranking Logic
// ============================================================================

export interface SlotZodiacSeed {
  slot: number;
  sign: string;
  ruler: string;
  element: ElementType;
  seedSpirit: number;
  seedDraft: number;
  seedHarmony: number;
}

/**
 * Deterministic seed metrics for all 12 draft slots aligned with classic Zodiac rulerships.
 * Used for pre-draft stability so team celestial metrics are 100% invariant to who is
 * currently selected as the active user (You).
 */
export const SLOT_ZODIAC_SEEDS: Record<number, SlotZodiacSeed> = {
  1: {
    slot: 1,
    sign: 'Aries',
    ruler: 'Mars',
    element: 'Fire',
    seedSpirit: 82.5,
    seedDraft: 80.2,
    seedHarmony: 81.5,
  },
  2: {
    slot: 2,
    sign: 'Taurus',
    ruler: 'Venus',
    element: 'Earth',
    seedSpirit: 81.5,
    seedDraft: 81.5,
    seedHarmony: 82.0,
  },
  3: {
    slot: 3,
    sign: 'Gemini',
    ruler: 'Mercury',
    element: 'Air',
    seedSpirit: 87.4,
    seedDraft: 84.2,
    seedHarmony: 85.6,
  },
  4: {
    slot: 4,
    sign: 'Cancer',
    ruler: 'Moon',
    element: 'Water',
    seedSpirit: 81.0,
    seedDraft: 79.0,
    seedHarmony: 80.2,
  },
  5: {
    slot: 5,
    sign: 'Leo',
    ruler: 'Sun',
    element: 'Fire',
    seedSpirit: 68.8,
    seedDraft: 67.2,
    seedHarmony: 67.5,
  },
  6: {
    slot: 6,
    sign: 'Virgo',
    ruler: 'Mercury',
    element: 'Earth',
    seedSpirit: 76.5,
    seedDraft: 76.5,
    seedHarmony: 75.2,
  },
  7: {
    slot: 7,
    sign: 'Libra',
    ruler: 'Venus',
    element: 'Air',
    seedSpirit: 88.5,
    seedDraft: 89.2,
    seedHarmony: 98.0,
  },
  8: {
    slot: 8,
    sign: 'Scorpio',
    ruler: 'Pluto',
    element: 'Water',
    seedSpirit: 78.0,
    seedDraft: 76.5,
    seedHarmony: 77.4,
  },
  9: {
    slot: 9,
    sign: 'Sagittarius',
    ruler: 'Jupiter',
    element: 'Fire',
    seedSpirit: 72.4,
    seedDraft: 71.5,
    seedHarmony: 71.0,
  },
  10: {
    slot: 10,
    sign: 'Capricorn',
    ruler: 'Saturn',
    element: 'Earth',
    seedSpirit: 86.2,
    seedDraft: 83.1,
    seedHarmony: 84.8,
  },
  11: {
    slot: 11,
    sign: 'Aquarius',
    ruler: 'Uranus',
    element: 'Air',
    seedSpirit: 68.8,
    seedDraft: 67.2,
    seedHarmony: 67.5,
  },
  12: {
    slot: 12,
    sign: 'Pisces',
    ruler: 'Neptune',
    element: 'Water',
    seedSpirit: 76.8,
    seedDraft: 75.4,
    seedHarmony: 76.0,
  },
};

export interface TeamCelestialMetrics {
  spiritScore: number;
  draftScore: number;
  harmonyScore: number;
  compositeScore: number;
  verdict: string;
  tier: 'Favorable' | 'Harmonic' | 'Volatile' | 'Discordant';
}

/**
 * Deterministically calculates a competitor team's celestial metrics from their actual
 * roster of players/draft picks and elemental alignments.
 *
 * Invariant Guarantee: The active user identity (You) is completely excluded from
 * calculation. Scores for every team remain 100% identical when switching active user.
 */
export function calculateTeamCelestialMetrics(
  team: Partial<CompetitorTeam> & {
    slot?: number;
    picks?: SleeperPick[];
    players?: string[];
    starters?: string[];
  },
  cosmicBoard: CosmicPlayer[] = [],
): TeamCelestialMetrics {
  const slot = team.slot || team.roster_id || 1;
  const seed = SLOT_ZODIAC_SEEDS[slot] || {
    slot,
    sign: 'Aries',
    ruler: 'Mars',
    element: 'Fire' as ElementType,
    seedSpirit: 78.0,
    seedDraft: 76.0,
    seedHarmony: 77.0,
  };

  // Resolve players from picks or players list if cosmicBoard is available
  let resolvedPlayers: CosmicPlayer[] = [];
  if (cosmicBoard && cosmicBoard.length > 0) {
    const playerIds = new Set<string>();
    if (team.picks && team.picks.length > 0) {
      for (const pick of team.picks) {
        if (pick.player_id) playerIds.add(String(pick.player_id));
      }
    }
    if (team.players && team.players.length > 0) {
      for (const pid of team.players) {
        if (pid) playerIds.add(String(pid));
      }
    }
    if (playerIds.size > 0) {
      resolvedPlayers = cosmicBoard.filter((p) => playerIds.has(String(p.id)));
    }
  }

  let spiritScore: number;
  let draftScore: number;
  let harmonyScore: number;

  if (resolvedPlayers.length > 0) {
    const totalSpirit = resolvedPlayers.reduce(
      (acc, p) => acc + (p.spirit_score ?? 80.0),
      0,
    );
    const totalDraft = resolvedPlayers.reduce(
      (acc, p) => acc + (p.draft_score ?? 80.0),
      0,
    );
    spiritScore = Math.round((totalSpirit / resolvedPlayers.length) * 10) / 10;
    draftScore = Math.round((totalDraft / resolvedPlayers.length) * 10) / 10;
    harmonyScore = computeRosterHarmony(resolvedPlayers);
  } else {
    // Restrict SLOT_ZODIAC_SEEDS[slot] fallback strictly to when a team has 0 resolved players
    spiritScore = team.avg_spirit_score ?? seed.seedSpirit;
    draftScore = team.avg_draft_score ?? seed.seedDraft;
    harmonyScore = team.harmony_score ?? seed.seedHarmony;
  }

  // Composite score: weighted blend of Spirit, Draft, and Harmony
  const compositeScore =
    Math.round(
      (spiritScore * 0.4 + draftScore * 0.3 + harmonyScore * 0.3) * 10,
    ) / 10;

  // Deterministic verdict based on composite score:
  // >= 90: ✨ Favorable (Apex)
  // >= 80: ⚖️ Harmonic (Stable)
  // >= 70: 🌀 Volatile (Flux)
  // < 70: 🌑 Discordant (Shadow)
  let verdict: string;
  let tier: 'Favorable' | 'Harmonic' | 'Volatile' | 'Discordant';
  if (compositeScore >= 85.0) {
    verdict = '✨ Favorable (Apex)';
    tier = 'Favorable';
  } else if (compositeScore >= 80.0) {
    verdict = '⚖️ Harmonic (Stable)';
    tier = 'Harmonic';
  } else if (compositeScore >= 70.0) {
    verdict = '🌀 Volatile (Flux)';
    tier = 'Volatile';
  } else {
    verdict = '🌑 Discordant (Shadow)';
    tier = 'Discordant';
  }

  return {
    spiritScore,
    draftScore,
    harmonyScore,
    compositeScore,
    verdict,
    tier,
  };
}

/**
 * Validates whether a player has an active NFL franchise contract (Signed)
 * vs an unsigned free agent.
 */
export function isPlayerSigned(
  player?: {team?: string | null; status?: string | null} | string | null,
): boolean {
  if (!player) return false;
  const rawTeam = typeof player === 'string' ? player : player.team;
  if (!rawTeam || typeof rawTeam !== 'string') return false;
  const t = rawTeam.trim().toUpperCase();
  if (
    t === '' ||
    t === 'FA' ||
    t === 'FREE AGENT' ||
    t === 'FREEAGENT' ||
    t === 'FREE_AGENT' ||
    t === 'NONE' ||
    t === 'N/A' ||
    t === 'NA' ||
    t === 'NULL' ||
    t === 'UNDEFINED' ||
    t === 'NFL'
  ) {
    return false;
  }
  if (typeof player === 'object' && player !== null && player.status) {
    const s = player.status.trim().toUpperCase();
    if (
      s === 'FA' ||
      s === 'FREE AGENT' ||
      s === 'FREE_AGENT' ||
      s === 'INACTIVE'
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Dynamically generates the Ideal Draft Path ("Path of Ascension") from scored cosmic board.
 */
export function generateAscensionPath(
  cosmicBoard: CosmicPlayer[],
  userSlot: number = 1,
  totalRounds: number = 15,
  totalTeams: number = 12,
): IdealDraftPick[] {
  const available = [...cosmicBoard].sort(
    (a, b) => (b.draft_score ?? 0) - (a.draft_score ?? 0),
  );
  const path: IdealDraftPick[] = [];
  const chosenIds = new Set<string>();

  for (let round = 1; round <= totalRounds; round++) {
    const isOddRound = round % 2 === 1;
    const roundPick = isOddRound ? userSlot : totalTeams - userSlot + 1;
    const overallPick = (round - 1) * totalTeams + roundPick;

    let target = available.find((p) => !chosenIds.has(p.id));
    if (!target && available.length > 0) {
      target = available[0];
    }

    if (target) {
      chosenIds.add(target.id);
      const fallback =
        available.find(
          (p) => !chosenIds.has(p.id) && p.position === target?.position,
        ) ||
        available.find((p) => !chosenIds.has(p.id)) ||
        target;

      const element = target.elemental_traits?.element || 'Fire';
      const stackTag =
        target.position === 'QB'
          ? `🔥 ${target.team} Quarterback Anchor`
          : target.position === 'WR' || target.position === 'TE'
            ? `⚡ ${element} Trine Receiver Alignment`
            : `🛡️ ${element} Core Grounding`;

      const rationale = `Round ${round} Pick ${overallPick}: Target ${target.name} (${target.position}, ${target.team}) for ${target.draft_score.toFixed(1)} draft score and ${target.spirit_score.toFixed(1)} spirit alignment.`;

      path.push({
        round,
        overall_pick: overallPick,
        target_position: target.position,
        target_player_id: target.id,
        target_player_name: target.name,
        target_team: target.team,
        projected_points: target.projected_points,
        positional_vor: target.market_vor,
        vor_normalized: target.vor_normalized,
        spirit_score: target.spirit_score,
        draft_score: target.draft_score,
        elemental_synergy_tag: stackTag,
        strategic_rationale: rationale,
        fallback_player_id: fallback?.id || target.id,
        fallback_player_name: fallback?.name || target.name,
        is_ascended: target.draft_status === 'my_team',
        actual_picked_player_id:
          target.draft_status === 'my_team' ? target.id : null,
      });
    }
  }

  return path;
}

/**
 * Atomic pure recomputation of draft state collections on parameter changes
 * (chaos_lambda, oracle_weights, user_slot, etc.)
 */
export function recomputeDraftState(
  state: DraftState,
  settings: Partial<OneiromancySettings> = {},
): DraftState {
  if (!state) return state;
  const mergedSettings: OneiromancySettings = {
    ...state.settings,
    ...settings,
  };
  const userSlot =
    mergedSettings.user_slot || state.settings?.user_slot || 1;

  // 1. Recompute cosmic_board
  const recomputedBoard = recomputeDraftScores(
    state.cosmic_board || [],
    mergedSettings,
  );

  // 2. Recompute my_roster with updated board player scores
  const recomputedRoster = (state.my_roster || []).map((slot) => {
    if (!slot.player) return slot;
    const updated = recomputedBoard.find(
      (p) => String(p.id) === String(slot.player?.id),
    );
    return {
      ...slot,
      player: updated || slot.player,
    };
  });

  // 3. Recompute competitor_teams
  const recomputedTeams = (state.competitor_teams || []).map((team) => {
    const isUser = team.slot === userSlot || team.is_user === true;
    const metrics = calculateTeamCelestialMetrics(team, recomputedBoard);
    return {
      ...team,
      is_user: isUser,
      avg_spirit_score: metrics.spiritScore,
      avg_draft_score: metrics.draftScore,
      harmony_score: metrics.harmonyScore,
      total_draft_score:
        Math.round(metrics.draftScore * (team.picks?.length || 15) * 10) / 10,
      total_spirit_score:
        Math.round(metrics.spiritScore * (team.picks?.length || 15) * 10) / 10,
      favorability_tier:
        metrics.tier === 'Volatile' ? 'Harmonic' : (metrics.tier as any),
      favorability_label: metrics.verdict,
    };
  });

  // 4. Recompute weekly_matchup player favorabilities
  let recomputedMatchup = state.weekly_matchup;
  if (state.weekly_matchup?.player_favorabilities) {
    const userTeam = recomputedTeams.find((t) => t.is_user);
    const userHarmony = userTeam?.harmony_score ?? 78.0;
    const recomputedFavs = state.weekly_matchup.player_favorabilities.map(
      (fav) => {
        const p = recomputedBoard.find(
          (b) => String(b.id) === String(fav.player_id),
        );
        const spirit = p?.spirit_score ?? fav.spirit_score ?? 80.0;
        const weeklyProj =
          fav.projected_points ?? p?.weekly_projected_points ?? 12.0;
        const geomantic =
          p?.divination_breakdown?.geomantic ?? fav.stadium_score ?? 78.0;
        const calc = computeWeeklyPlayerFavorability(
          spirit,
          weeklyProj,
          p?.injury_status,
          !fav.is_benched,
          geomantic,
        );
        return {
          ...fav,
          spirit_score: spirit,
          favorability_score: calc.score,
          favorability_verdict: calc.verdict,
          base_spirit: calc.base_spirit,
          role_modifier: calc.role_modifier,
          health_penalty: calc.health_penalty,
          harmony_score: fav.is_user_team
            ? userHarmony
            : (fav.harmony_score ?? 75.0),
        };
      },
    );
    recomputedMatchup = {
      ...state.weekly_matchup,
      player_favorabilities: recomputedFavs,
    };
  }

  // 5. Generate ideal_draft_path dynamically
  const recomputedIdealPath = generateAscensionPath(
    recomputedBoard,
    userSlot,
    15,
  );

  // 6. Recompute waiver_upgrades with updated board player scores
  const recomputedWaivers = (state.waiver_upgrades || []).map((w) => {
    const prop = recomputedBoard.find(
      (p) => String(p.id) === String(w.id || w.proposed_player?.id),
    );
    const drop = recomputedBoard.find(
      (p) =>
        String(p.id) ===
        String(w.recommended_drop_id || w.recommended_drop_player?.id),
    );
    const propDraft = prop?.draft_score ?? w.draft_score;
    const dropDraft =
      drop?.draft_score ??
      w.recommended_drop_player?.draft_score ??
      propDraft - (w.net_score_delta || 0);
    const netDelta = Math.round((propDraft - dropDraft) * 10) / 10;
    return {
      ...w,
      draft_score: propDraft,
      spirit_score: prop?.spirit_score ?? w.spirit_score,
      projected_points: prop?.projected_points ?? w.projected_points,
      net_score_delta: netDelta,
      proposed_player: prop || w.proposed_player,
      recommended_drop_player: drop || w.recommended_drop_player,
    };
  });

  // 7. Recompute trade_proposals with updated board player scores
  const recomputedTrades: TradeProposal[] = (state.trade_proposals || []).map(
    (tp) => {
      const recomputeParticipantList = (list: TradeParticipant[] = []) =>
        list.map((part) => {
          const p = recomputedBoard.find(
            (b) => String(b.id) === String(part.player_id),
          );
          if (!p) return part;
          return {
            ...part,
            spirit_score: p.spirit_score ?? part.spirit_score,
            projected_points: p.projected_points ?? part.projected_points,
            season_projected_points:
              p.season_projected_points ?? part.season_projected_points,
          };
        });
      const gives = recomputeParticipantList(tp.give_players || []);
      const receives = recomputeParticipantList(tp.receive_players || []);
      return {
        ...tp,
        give_players: gives,
        receive_players: receives,
      };
    },
  );

  return {
    ...state,
    settings: mergedSettings,
    cosmic_board: recomputedBoard,
    my_roster: recomputedRoster,
    competitor_teams: recomputedTeams,
    weekly_matchup: recomputedMatchup,
    ideal_draft_path: recomputedIdealPath,
    waiver_upgrades: recomputedWaivers,
    trade_proposals: recomputedTrades,
  };
}
