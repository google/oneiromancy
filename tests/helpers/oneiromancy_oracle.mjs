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

/**
 * Oneiromancy Oracle Test Reference Engine
 * Authoritative mathematical formulas, schema validators, state machine rules,
 * and canonical fixtures derived from canonical architectural specifications.
 */

export const THEME_TOKENS = {
  OBSIDIAN: '#131318',
  OBSIDIAN_SURFACE: '#1a1a24',
  OBSIDIAN_ELEVATED: '#242436',
  NEBULA_PURPLE: '#6d28d9',
  ELECTRIC_CYAN: '#06b6d4',
  CELESTIAL_GOLD: '#eab308',
  EMERALD_GREEN: '#10b981',
  ASTRAL_PURPLE: '#a855f7',
  ROSE_FLEX: '#f43f5e',
  SLATE_MUTED: '#94a3b8',
};

export const POSITION_COLORS = {
  QB: { hex: '#06b6d4', name: 'Cyan', bgClass: 'bg-cyan-950/40', borderClass: 'border-cyan-500/40' },
  RB: { hex: '#10b981', name: 'Green', bgClass: 'bg-emerald-950/40', borderClass: 'border-emerald-500/40' },
  WR: { hex: '#a855f7', name: 'Purple', bgClass: 'bg-purple-950/40', borderClass: 'border-purple-500/40' },
  TE: { hex: '#eab308', name: 'Gold', bgClass: 'bg-amber-950/40', borderClass: 'border-amber-500/40' },
  FLEX: { hex: '#f43f5e', name: 'Rose', bgClass: 'bg-rose-950/40', borderClass: 'border-rose-500/40' },
  K_DEF: { hex: '#94a3b8', name: 'Slate', bgClass: 'bg-slate-900/60', borderClass: 'border-slate-600/40' },
};

export const TYPOGRAPHY = {
  MYSTICAL_SERIF: 'Playfair Display',
  MYSTICAL_VAR: '--font-playfair',
  TELEMETRY_MONO: 'Space Mono',
  TELEMETRY_VAR: '--font-space-mono',
};

import {
  BASELINES,
  DEFAULT_ORACLE_WEIGHTS,
  DEFAULT_CHAOS_LAMBDA,
  clamp,
  calculateVOR,
  normalizeVOR,
  computeDraftScore,
  normalizeOracleWeights,
  computeSpiritScore,
  digitalRoot,
  calculateLifePath,
  numberResonance,
  calculateNumericTier,
  haversineDistance,
  calculateGeomanticTier,
  calculateWesternTrinesBonus,
  calculateStackMultiplier,
  calculatePositionalCapsPenalty,
  calculateQuadBalanceBonus,
  calculateHarmony,
  calculateSnakePick,
  deriveDraftStatus,
  detectPollerDelta,
  computeTeamMatchupFavorability,
  computeWeeklyPlayerFavorability,
  calculateWinProbability,
} from '../../core/lib/scoring.ts';
import { POLLING_CONFIG } from '../../core/lib/sleeper.ts';

export {
  BASELINES,
  DEFAULT_ORACLE_WEIGHTS,
  DEFAULT_CHAOS_LAMBDA,
  POLLING_CONFIG,
  clamp,
  calculateVOR,
  normalizeVOR,
  computeDraftScore,
  normalizeOracleWeights,
  computeSpiritScore,
  digitalRoot,
  calculateLifePath,
  numberResonance,
  calculateNumericTier,
  haversineDistance,
  calculateGeomanticTier,
  calculateWesternTrinesBonus,
  calculateWesternTrinesBonus as calculateWesternTrineBonus,
  calculateStackMultiplier,
  calculatePositionalCapsPenalty,
  calculateQuadBalanceBonus,
  calculateHarmony as calculateHarmonyScore,
  calculateHarmony,
  calculateSnakePick,
  deriveDraftStatus,
  detectPollerDelta,
  computeTeamMatchupFavorability,
  computeWeeklyPlayerFavorability,
  calculateWinProbability,
};

export function validateCosmicPlayer(p) {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.id !== 'string' || !p.id) return false;
  if (typeof p.name !== 'string' || !p.name) return false;
  if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position)) return false;
  if (typeof p.team !== 'string') return false;
  if (typeof p.bye_week !== 'number' || p.bye_week < 0) return false;
  if (typeof p.projected_points !== 'number') return false;
  if (typeof p.market_vor !== 'number') return false;
  if (typeof p.draft_score !== 'number' || p.draft_score < 0 || p.draft_score > 100) return false;
  if (typeof p.spirit_score !== 'number' || p.spirit_score < 0 || p.spirit_score > 100) return false;
  if (typeof p.harmony_score !== 'number' || p.harmony_score < 0 || p.harmony_score > 100) return false;
  if (!['available', 'drafted', 'my_team'].includes(p.draft_status)) return false;
  if (!p.divination_breakdown || typeof p.divination_breakdown !== 'object') return false;
  return true;
}

export function validateIdealDraftPath(path) {
  if (!Array.isArray(path) || path.length === 0) return false;
  for (const step of path) {
    if (typeof step.round !== 'number' || step.round < 1) return false;
    if (typeof step.overall_pick !== 'number') return false;
    if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(step.target_position)) return false;
    if (typeof step.target_player_id !== 'string') return false;
    if (typeof step.target_player_name !== 'string') return false;
    if (typeof step.draft_score !== 'number') return false;
    if (typeof step.is_ascended !== 'boolean') return false;
    if (typeof step.fallback_player_id !== 'string') return false;
  }
  return true;
}

export function validateMyRoster(roster) {
  if (!roster || typeof roster !== 'object') return false;
  if (typeof roster.user_id !== 'string') return false;
  if (!Array.isArray(roster.starters)) return false;
  if (!Array.isArray(roster.bench)) return false;
  if (typeof roster.total_projected_points !== 'number') return false;
  if (typeof roster.average_spirit_score !== 'number') return false;
  if (typeof roster.squad_harmony_index !== 'number') return false;
  if (!roster.elemental_distribution || typeof roster.elemental_distribution !== 'object') return false;
  return true;
}

export function validateWeeklyCoverage(coverage) {
  if (!coverage || typeof coverage !== 'object') return false;
  if (!Array.isArray(coverage.schedule)) return false;
  if (typeof coverage.bye_synergy_score !== 'number') return false;
  for (const node of coverage.schedule) {
    if (typeof node.week !== 'number' || node.week < 1 || node.week > 18) return false;
    if (!['none', 'low', 'high'].includes(node.conflict_severity)) return false;
  }
  return true;
}

export function validateElementalTraits(traits) {
  if (!traits || typeof traits !== 'object') return false;
  if (!traits.trines || typeof traits.trines !== 'object') return false;
  for (const el of ['Fire', 'Earth', 'Air', 'Water']) {
    if (!traits.trines[el]) return false;
  }
  if (!traits.compatibility_matrix || typeof traits.compatibility_matrix !== 'object') return false;
  return true;
}

export function validateWaiverUpgrades(upgrades) {
  if (!Array.isArray(upgrades)) return false;
  for (const item of upgrades) {
    if (typeof item.id !== 'string') return false;
    if (typeof item.name !== 'string') return false;
    if (typeof item.net_score_delta !== 'number') return false;
    if (typeof item.recommended_drop_id !== 'string') return false;
  }
  return true;
}

export function validateTradeProposals(proposals) {
  if (!Array.isArray(proposals)) return false;
  for (const prop of proposals) {
    if (typeof prop.proposal_id !== 'string') return false;
    if (typeof prop.target_team_id !== 'string') return false;
    if (!Array.isArray(prop.give_players) || !Array.isArray(prop.receive_players)) return false;
    if (typeof prop.trade_fairness_index !== 'number') return false;
  }
  return true;
}

export function validateAppSettings(settings) {
  if (!settings || typeof settings !== 'object') return false;
  if (typeof settings.draft_id !== 'string') return false;
  if (typeof settings.auto_update !== 'boolean') return false;
  if (typeof settings.chaos_lambda !== 'number' || settings.chaos_lambda < 0 || settings.chaos_lambda > 1)
    return false;
  if (!settings.oracle_weights || typeof settings.oracle_weights !== 'object') return false;
  return true;
}

export function createCanonicalMockDraft() {
  const draftMetadata = {
    draft_id: 'mock_oneiromancy_draft_2025',
    league_id: 'mock_league_celestial_12',
    season: '2025',
    type: 'snake',
    status: 'drafting',
    start_time: 1725254400000,
    last_picked: 1725256200000,
    last_message_time: 1725256215000,
    settings: {
      teams: 12,
      rounds: 15,
      pick_timer: 90,
      slots_qb: 1,
      slots_rb: 2,
      slots_wr: 2,
      slots_te: 1,
      slots_flex: 1,
      slots_k: 1,
      slots_def: 1,
      slots_bn: 6,
    },
    metadata: {
      name: 'Oneiromancy Invitational 2025',
      scoring_type: 'ppr',
      description: 'High-Tech Divination Draft League',
    },
    draft_order: {
      user_celestial_01: 1,
      user_divine_02: 2,
      user_mystic_03: 3,
      user_astro_04: 4,
      user_oneiromancy_me: 5,
      user_oracle_06: 6,
      user_rune_07: 7,
      user_alchemy_08: 8,
      user_tarot_09: 9,
      user_zenith_10: 10,
      user_fengshui_11: 11,
      user_eclipse_12: 12,
    },
    slot_to_roster_id: {
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
      '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    },
  };

  const players = [
    {
      id: '4046',
      name: 'Patrick Mahomes',
      first_name: 'Patrick',
      last_name: 'Mahomes',
      position: 'QB',
      team: 'KC',
      jersey_number: 15,
      bye_week: 6,
      adp: 34.5,
      projected_points: 342.8,
      market_vor: 68.4,
      vor_normalized: 78.5,
      draft_score: 83.7,
      spirit_score: 93.4,
      harmony_score: 88.0,
      draft_status: 'available',
      elemental_traits: {
        sun_sign: 'Virgo',
        element: 'Earth',
        life_path_number: 5,
        gematria_resonance: 8,
        tarot_card: 'The Emperor',
        iching_hexagram: 1,
      },
      divination_breakdown: { celestial: 94.0, numeric: 96.0, geomantic: 92.5, oracular: 90.0, harmony: 95.0 },
    },
    {
      id: '7569',
      name: "Ja'Marr Chase",
      first_name: "Ja'Marr",
      last_name: 'Chase',
      position: 'WR',
      team: 'CIN',
      jersey_number: 1,
      bye_week: 12,
      adp: 6.2,
      projected_points: 305.2,
      market_vor: 84.1,
      vor_normalized: 89.2,
      draft_score: 90.4,
      spirit_score: 92.6,
      harmony_score: 98.0,
      draft_status: 'my_team',
      drafted_by_user_id: 'user_oneiromancy_me',
      drafted_pick_no: 5,
      elemental_traits: {
        sun_sign: 'Pisces',
        element: 'Water',
        life_path_number: 7,
        gematria_resonance: 9,
        tarot_card: 'The Chariot',
        iching_hexagram: 14,
      },
      divination_breakdown: { celestial: 90.0, numeric: 92.0, geomantic: 88.0, oracular: 95.0, harmony: 98.0 },
    },
    {
      id: '6766',
      name: 'Joe Burrow',
      first_name: 'Joe',
      last_name: 'Burrow',
      position: 'QB',
      team: 'CIN',
      jersey_number: 9,
      bye_week: 12,
      adp: 48.0,
      projected_points: 315.0,
      market_vor: 55.2,
      vor_normalized: 74.5,
      draft_score: 85.5,
      spirit_score: 91.0,
      harmony_score: 96.0,
      draft_status: 'my_team',
      drafted_by_user_id: 'user_oneiromancy_me',
      drafted_pick_no: 29,
      elemental_traits: {
        sun_sign: 'Sagittarius',
        element: 'Fire',
        life_path_number: 9,
        gematria_resonance: 9,
        tarot_card: 'The Magician',
        iching_hexagram: 11,
      },
      divination_breakdown: { celestial: 92.0, numeric: 94.0, geomantic: 85.0, oracular: 88.0, harmony: 96.0 },
    },
    {
      id: '4866',
      name: 'Saquon Barkley',
      first_name: 'Saquon',
      last_name: 'Barkley',
      position: 'RB',
      team: 'PHI',
      jersey_number: 26,
      bye_week: 5,
      adp: 16.5,
      projected_points: 278.4,
      market_vor: 72.0,
      vor_normalized: 83.2,
      draft_score: 84.6,
      spirit_score: 87.5,
      harmony_score: 85.0,
      draft_status: 'my_team',
      drafted_by_user_id: 'user_oneiromancy_me',
      drafted_pick_no: 20,
      elemental_traits: {
        sun_sign: 'Aquarius',
        element: 'Air',
        life_path_number: 8,
        gematria_resonance: 8,
        tarot_card: 'Strength',
        iching_hexagram: 34,
      },
      divination_breakdown: { celestial: 88.0, numeric: 89.0, geomantic: 84.0, oracular: 86.0, harmony: 85.0 },
    },
    {
      id: '6794',
      name: 'CeeDee Lamb',
      first_name: 'CeeDee',
      last_name: 'Lamb',
      position: 'WR',
      team: 'DAL',
      jersey_number: 88,
      bye_week: 7,
      adp: 2.5,
      projected_points: 310.0,
      market_vor: 86.0,
      vor_normalized: 90.5,
      draft_score: 91.2,
      spirit_score: 92.5,
      harmony_score: 84.0,
      draft_status: 'drafted',
      drafted_by_user_id: 'user_divine_02',
      drafted_pick_no: 2,
      elemental_traits: {
        sun_sign: 'Aries',
        element: 'Fire',
        life_path_number: 3,
        gematria_resonance: 7,
        tarot_card: 'The Emperor',
        iching_hexagram: 1,
      },
      divination_breakdown: { celestial: 93.0, numeric: 90.0, geomantic: 91.0, oracular: 94.0, harmony: 84.0 },
    },
    {
      id: '6813',
      name: 'Jonathan Taylor',
      first_name: 'Jonathan',
      last_name: 'Taylor',
      position: 'RB',
      team: 'IND',
      jersey_number: 28,
      bye_week: 14,
      adp: 18.0,
      projected_points: 265.0,
      market_vor: 68.0,
      vor_normalized: 81.0,
      draft_score: 84.0,
      spirit_score: 90.0,
      harmony_score: 82.0,
      draft_status: 'available',
      elemental_traits: {
        sun_sign: 'Capricorn',
        element: 'Earth',
        life_path_number: 4,
        gematria_resonance: 6,
        tarot_card: 'The Chariot',
        iching_hexagram: 2,
      },
      divination_breakdown: { celestial: 90.0, numeric: 88.0, geomantic: 92.0, oracular: 89.0, harmony: 82.0 },
    },
    {
      id: '7526',
      name: 'Tee Higgins',
      first_name: 'Tee',
      last_name: 'Higgins',
      position: 'WR',
      team: 'CIN',
      jersey_number: 5,
      bye_week: 12,
      adp: 44.0,
      projected_points: 224.5,
      market_vor: 42.1,
      vor_normalized: 68.9,
      draft_score: 80.2,
      spirit_score: 89.2,
      harmony_score: 95.0,
      draft_status: 'available',
      elemental_traits: {
        sun_sign: 'Capricorn',
        element: 'Earth',
        life_path_number: 6,
        gematria_resonance: 5,
        tarot_card: 'The Star',
        iching_hexagram: 14,
      },
      divination_breakdown: { celestial: 87.0, numeric: 86.0, geomantic: 88.0, oracular: 90.0, harmony: 95.0 },
    },
    {
      id: '9226',
      name: 'Dontayvion Wicks',
      first_name: 'Dontayvion',
      last_name: 'Wicks',
      position: 'WR',
      team: 'GB',
      jersey_number: 13,
      bye_week: 10,
      adp: 120.0,
      projected_points: 182.4,
      market_vor: 22.0,
      vor_normalized: 58.0,
      draft_score: 79.8,
      spirit_score: 91.5,
      harmony_score: 86.0,
      draft_status: 'available',
      elemental_traits: {
        sun_sign: 'Gemini',
        element: 'Air',
        life_path_number: 5,
        gematria_resonance: 4,
        tarot_card: 'The Magician',
        iching_hexagram: 9,
      },
      divination_breakdown: { celestial: 93.0, numeric: 90.0, geomantic: 91.0, oracular: 92.0, harmony: 86.0 },
    },
    {
      id: '5001',
      name: 'Allen Lazard',
      first_name: 'Allen',
      last_name: 'Lazard',
      position: 'WR',
      team: 'NYJ',
      jersey_number: 10,
      bye_week: 12,
      adp: 180.0,
      projected_points: 140.4,
      market_vor: -2.0,
      vor_normalized: 48.0,
      draft_score: 65.6,
      spirit_score: 75.0,
      harmony_score: 70.0,
      draft_status: 'my_team',
      drafted_by_user_id: 'user_oneiromancy_me',
      drafted_pick_no: 120,
      elemental_traits: {
        sun_sign: 'Sagittarius',
        element: 'Fire',
        life_path_number: 2,
        gematria_resonance: 1,
        tarot_card: 'The Tower',
        iching_hexagram: 29,
      },
      divination_breakdown: { celestial: 72.0, numeric: 70.0, geomantic: 78.0, oracular: 76.0, harmony: 70.0 },
    },
  ];

  const picks = [
    {
      draft_id: 'mock_oneiromancy_draft_2025',
      pick_no: 1,
      round: 1,
      draft_slot: 1,
      player_id: '4034',
      picked_by: 'user_celestial_01',
      roster_id: 1,
      is_keeper: false,
      metadata: { first_name: 'Christian', last_name: 'McCaffrey', team: 'SF', position: 'RB', number: '23' },
    },
    {
      draft_id: 'mock_oneiromancy_draft_2025',
      pick_no: 2,
      round: 1,
      draft_slot: 2,
      player_id: '6794',
      picked_by: 'user_divine_02',
      roster_id: 2,
      is_keeper: false,
      metadata: { first_name: 'CeeDee', last_name: 'Lamb', team: 'DAL', position: 'WR', number: '88' },
    },
    {
      draft_id: 'mock_oneiromancy_draft_2025',
      pick_no: 5,
      round: 1,
      draft_slot: 5,
      player_id: '7569',
      picked_by: 'user_oneiromancy_me',
      roster_id: 5,
      is_keeper: false,
      metadata: { first_name: "Ja'Marr", last_name: 'Chase', team: 'CIN', position: 'WR', number: '1' },
    },
    {
      draft_id: 'mock_oneiromancy_draft_2025',
      pick_no: 20,
      round: 2,
      draft_slot: 5,
      player_id: '4866',
      picked_by: 'user_oneiromancy_me',
      roster_id: 5,
      is_keeper: false,
      metadata: { first_name: 'Saquon', last_name: 'Barkley', team: 'PHI', position: 'RB', number: '26' },
    },
    {
      draft_id: 'mock_oneiromancy_draft_2025',
      pick_no: 29,
      round: 3,
      draft_slot: 5,
      player_id: '6766',
      picked_by: 'user_oneiromancy_me',
      roster_id: 5,
      is_keeper: false,
      metadata: { first_name: 'Joe', last_name: 'Burrow', team: 'CIN', position: 'QB', number: '9' },
    },
  ];

  return { draftMetadata, players, picks };
}
