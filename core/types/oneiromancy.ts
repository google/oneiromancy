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
 * Oneiromancy - Canonical TypeScript Interfaces
 * Authoritative schema matching survey_data_spec.md Section 2 and PROJECT.md.
 */

// ============================================================================
// Core Primitive Types & Enums
// ============================================================================

export type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
export type ElementType = 'Fire' | 'Earth' | 'Air' | 'Water';
export type DraftStatus = 'available' | 'drafted' | 'my_team';
export type DraftLeagueStatus = 'pre_draft' | 'drafting' | 'paused' | 'complete';
export type ConflictSeverity = 'none' | 'low' | 'high';
export type RosterSlotId =
  | 'QB'
  | 'RB1'
  | 'RB2'
  | 'WR1'
  | 'WR2'
  | 'TE'
  | 'FLEX'
  | 'K'
  | 'DEF'
  | `BN${number}`
  | string;

// ============================================================================
// 1. Cosmic Player & Board
// ============================================================================

export interface DivinationBreakdown {
  celestial: number; // 0-100 (30% weight default)
  numeric: number;   // 0-100 (20% weight default)
  geomantic: number; // 0-100 (25% weight default)
  oracular: number;  // 0-100 (10% weight default)
  harmony: number;   // 0-100 (15% weight default)
}

export interface PlayerElementalTraits {
  sun_sign: string; // e.g. "Virgo", "Pisces", "Aries"
  element: ElementType;
  life_path_number: number;
  gematria_resonance: number;
  tarot_card: string;
  iching_hexagram: number;
  score?: number;
}

export interface CosmicPlayer {
  id: string; // Sleeper player ID
  name: string;
  first_name: string;
  last_name: string;
  position: NFLPosition;
  team: string; // 2 or 3-letter NFL code
  jersey_number: number;
  bye_week: number;
  adp: number; // Average draft position
  projected_points: number; // Single-week PPR projection (0-40)
  season_projected_points?: number; // Full-season PPR projection
  weekly_projected_points?: number; // Weekly matchup projection
  sleeper_projected_points?: number; // Custom League-Scoring weekly projection (e.g. 6pt pass TD, Superflex)
  nfl_projected_points?: number; // Baseline NFL standard PPR projection
  market_vor: number; // Value Over Replacement (raw)
  vor_normalized: number; // 0-100 scale
  draft_score: number; // Blended Chaos Dial score (0-100)
  spirit_score: number; // Weighted divination score (0-100)
  harmony_score: number; // Squad synergy score (0-100)
  favorability_score?: number; // Weekly matchup favorability (0-100)
  favorability_verdict?: 'HEAVILY FAVORED' | 'ASTRALLY FAVORED' | 'NEUTRAL' | 'CELESTIALLY CHALLENGED' | 'FAVORED' | 'UNFAVORED';
  draft_status: DraftStatus;
  drafted_by_user_id?: string | null;
  drafted_pick_no?: number | null;
  elemental_traits: PlayerElementalTraits;
  divination_breakdown: DivinationBreakdown;
  status?: string;
  injury_status?: string | null;
  depth_chart_order?: number | null;
  catalysts?: string[];
  risks?: string[];
}

export type CosmicBoard = CosmicPlayer[];

// ============================================================================
// 2. Ideal Draft Path ("Path of Ascension")
// ============================================================================

export interface IdealDraftPick {
  round: number; // 1 to 15
  overall_pick: number; // Expected overall pick
  target_position: NFLPosition;
  target_player_id: string;
  target_player_name: string;
  target_team: string;
  projected_points: number;
  season_projected_points?: number;
  positional_vor: number;
  vor_normalized?: number;
  spirit_score: number;
  draft_score: number;
  elemental_synergy_tag: string; // e.g. "Water Trine Anchor", "3.0x QB/WR Bengal Stack Multiplier"
  strategic_rationale: string;
  fallback_player_id: string;
  fallback_player_name: string;
  is_ascended: boolean; // True if this round's pick has been executed
  actual_picked_player_id?: string | null;
}

export type AscensionStep = IdealDraftPick;
export type IdealDraftPath = IdealDraftPick[];

// ============================================================================
// 3. User Roster & Squad Alchemy
// ============================================================================

export interface RosterSlot {
  slot_id: RosterSlotId;
  slot_name: string;
  eligible_positions: NFLPosition[];
  player: CosmicPlayer | null;
}

export interface StackSynergyBonus {
  type: 'QB_WR' | 'QB_TE' | 'DOUBLE_STACK';
  team: string;
  qb_name: string;
  pass_catcher_names: string[];
  multiplier: number; // 3.0
  bonus_points: number;
}

export interface MyRoster {
  user_id: string;
  roster_id: number;
  starters: RosterSlot[];
  bench: RosterSlot[];
  total_projected_points: number;
  average_spirit_score: number;
  squad_harmony_index: number; // 0-100
  elemental_distribution: ElementalDistribution;
  active_stacks: StackSynergyBonus[];
  position_counts: Record<NFLPosition, number>;
}

// ============================================================================
// 4. Weekly Coverage Matrix
// ============================================================================

export interface WeeklyPositionSlot {
  position: NFLPosition;
  player_name: string;
  projected_week_points: number;
  is_bye: boolean;
}

export interface ByeCoverageWeek {
  week: number; // 1 through 18
  active_starters: WeeklyPositionSlot[];
  bye_players: {
    player_id: string;
    player_name: string;
    position: NFLPosition;
  }[];
  projected_total: number;
  conflict_severity: ConflictSeverity;
  elemental_synergy_multiplier: number;
}

export type WeekCoverageNode = ByeCoverageWeek;

export interface WeeklyCoverageMatrix {
  schedule: ByeCoverageWeek[];
  bye_synergy_score: number; // 0-100
  lowest_scoring_week: number;
  highest_scoring_week: number;
  bye_conflict_summary: {
    week: number;
    conflicted_positions: NFLPosition[];
  }[];
}

// ============================================================================
// 5. Elemental Traits & Western Trines
// ============================================================================

export interface ElementalDistribution {
  Fire: number;
  Earth: number;
  Air: number;
  Water: number;
}

export interface ZodiacTrineDefinition {
  element: ElementType;
  signs: [string, string, string];
  archetype_nature: string;
  fantasy_affinity: string;
  associated_color: string;
}

export interface TeamElementalAffinity {
  team_code: string;
  team_name: string;
  founded_year: number;
  element: ElementType;
  primary_sign: string;
  stadium_name: string;
  stadium_orientation: 'N-S' | 'E-W' | 'NE-SW' | 'NW-SE';
  dome_type: 'Open' | 'Retractable' | 'Fixed Dome';
}

export interface ZodiacSignDefinition {
  element: ElementType;
  modality: 'Cardinal' | 'Fixed' | 'Mutable' | string;
  planetary_ruler: string;
  keyword: string;
}

export interface ElementalTraitsRegistry {
  trines?: Record<ElementType, ZodiacTrineDefinition>;
  teams?: Record<string, TeamElementalAffinity>;
  compatibility_matrix?: Record<ElementType, Record<ElementType, number>>;
  [sign: string]: ZodiacSignDefinition | any;
}

// ============================================================================
// 6. Waiver Upgrades
// ============================================================================

export interface WaiverUpgrade {
  id: string;
  name: string;
  position: NFLPosition;
  team: string;
  projected_points: number;
  spirit_score: number;
  draft_score: number;
  recommended_drop_id: string;
  recommended_drop_name: string;
  recommended_drop_position: NFLPosition;
  recommended_drop_team?: string;
  net_score_delta: number; // DraftScore(Upgrade) - DraftScore(Drop)
  net_projected_delta: number;
  divination_rationale: string;
  waiver_priority_rank: number;
  proposed_player?: CosmicPlayer;
  recommended_drop_player?: CosmicPlayer;
}

export type WaiverUpgradeItem = WaiverUpgrade;
export type WaiverUpgradesBoard = WaiverUpgrade[];

// ============================================================================
// Competitor Teams & Weekly Matchup Interfaces
// ============================================================================

export interface CompetitorTeam {
  slot: number;
  roster_id: number;
  owner_id?: string;
  name: string;
  owner_name?: string;
  owner_display_name?: string;
  avatar?: string | null;
  avatar_url?: string | null;
  picks: SleeperPick[];
  starters?: string[];
  players?: string[];
  total_draft_score?: number;
  total_spirit_score?: number;
  avg_draft_score?: number;
  avg_spirit_score?: number;
  harmony_score?: number;
  favorability_tier?: 'Favorable' | 'Harmonic' | 'Discordant';
  favorability_label?: string;
  is_user?: boolean;
}

export interface MatchupTeam {
  slot?: number;
  roster_id: number;
  team_name: string;
  owner_name: string;
  avatar?: string | null;
  avatar_url?: string | null;
  projected_points: number;
  starters: string[];
  players: string[];
  harmony_score?: number;
}

export interface StartSitRecommendation {
  position: NFLPosition;
  recommended_start: CosmicPlayer;
  recommended_sit: CosmicPlayer;
  projected_delta: number;
  synergy_reason: string;
  confidence: 'HIGH' | 'MEDIUM';
}

export interface StadiumAstrologicalData {
  stadium_name: string;
  city: string;
  state: string;
  coordinates: { lat: number; lon: number };
  latitude?: number;
  longitude?: number;
  roof_type: 'Dome (Fixed)' | 'Dome (Retractable)' | 'Open Air (Coastal)' | 'Open Air (Inland)' | 'Open Air (High Altitude)' | string;
  celestial_house: string;
  zodiac_ascendant: string;
  geo_magnetic_resonance: string;
}

export interface PlayerMatchupFavorability {
  player_id: string;
  player_name: string;
  position: NFLPosition;
  team: string;
  opponent?: string;
  opponent_team?: string;
  team_name?: string;
  nfl_team?: string;
  projected_points?: number;
  is_user_team: boolean;
  is_benched?: boolean;
  spirit_score?: number;
  harmony_score?: number;
  base_spirit?: number;
  role_modifier?: number;
  health_penalty?: number;
  stadium_score?: number;
  opponent_rank?: number;
  game_date?: string;
  game_kickoff?: string;
  kickoff_time?: string;
  lunar_phase: string;
  planetary_hour: string;
  stadium: StadiumAstrologicalData;
  favorability_score: number; // 0-100
  favorability_verdict: 'HEAVILY FAVORED' | 'ASTRALLY FAVORED' | 'NEUTRAL' | 'CELESTIALLY CHALLENGED' | 'FAVORED' | 'UNFAVORED';
  rationale?: string;
  astrological_rationale?: string;
  astrological_transit?: string;
  aspect_highlights?: string[];
  aspect_description?: string;
}

export interface TeamCelestialComparison {
  user_favorability_index: number;
  opponent_favorability_index: number;
  user_astral_favorability?: number;
  opponent_astral_favorability?: number;
  user_celestial_conjunction?: string;
  opponent_celestial_conjunction?: string;
  user_elemental_dominance?: string;
  opponent_elemental_dominance?: string;
  astral_edge_summary?: string;
  user_harmony_score?: number;
  opponent_harmony_score?: number;
  elemental_dominance?: { user: string; opponent: string };
  celestial_conjunctions?: string[];
  verdict_summary?: string;
}

export interface MatchupWeekData {
  week: number;
  is_upcoming?: boolean;
  matchup_id?: number;
  user_team?: MatchupTeam;
  opponent_team?: MatchupTeam;
  win_probability?: number;
  win_probability_label?: string;
  team_comparison?: TeamCelestialComparison;
  player_favorabilities?: PlayerMatchupFavorability[];
  start_sit_recommendations?: StartSitRecommendation[];
  status?: 'active' | 'upcoming' | 'completed';
  opponent_name?: string;
  astral_alignment?: string;
  result?: 'W' | 'L' | 'T';
  score_user?: number;
  score_opponent?: number;
  date_range?: string;
}

export interface WeeklyMatchup {
  week: number;
  matchup_id: number;
  user_team: MatchupTeam;
  opponent_team: MatchupTeam;
  win_probability?: number;
  win_probability_label?: string;
  start_sit_recommendations: StartSitRecommendation[];
  team_comparison?: TeamCelestialComparison;
  player_favorabilities?: PlayerMatchupFavorability[];
  past_matchups?: MatchupWeekData[];
  upcoming_matchups?: MatchupWeekData[];
}

// ============================================================================
// 7. Trade Proposals ("Divine Swap")
// ============================================================================

export interface TradeParticipant {
  player_id: string;
  player_name: string;
  position: NFLPosition;
  projected_points: number;
  season_projected_points?: number;
  spirit_score: number;
  element: ElementType;
}

export interface TradeProposal {
  proposal_id: string;
  target_team_id: string;
  target_team_name: string;
  give_players: TradeParticipant[];
  receive_players: TradeParticipant[];
  user_deficit_addressed: string;
  partner_deficit_addressed: string;
  net_vor_delta: number;
  harmony_delta: number;
  trade_fairness_index: number; // 0-100 (50 = balanced)
  divine_verdict: string;
}

export type DivineSwapProposal = TradeProposal;
export type TradeProposalsRegistry = TradeProposal[];

// ============================================================================
// 8. Oneiromancy & Oracle Settings
// ============================================================================

export interface OracleWeights {
  celestial: number; // Default 0.30
  numeric: number;   // Default 0.20
  geomantic: number; // Default 0.25
  oracular: number;  // Default 0.10
  harmony: number;   // Default 0.15
}

export interface AvailableLeague {
  league_id: string;
  name: string;
  season: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport: string;
  total_rosters: number;
  roster_positions?: string[];
  settings?: Record<string, unknown>;
  scoring_settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  draft_id?: string;
}

export interface SleeperRosterSettings {
  fpts?: number;
  fpts_decimal?: number;
  losses?: number;
  ties?: number;
  total_moves?: number;
  waiver_budget_used?: number;
  waiver_position?: number;
  wins?: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings?: SleeperRosterSettings | null;
  metadata?: Record<string, string> | null;
  co_owners?: string[] | null;
  keepers?: string[] | null;
  player_map?: Record<string, unknown> | null;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  custom_points?: number | null;
  players?: string[] | null;
  starters?: string[] | null;
  starters_points?: number[] | null;
  players_points?: Record<string, number> | null;
}

export interface SleeperLeagueDraft {
  draft_id: string;
  league_id: string;
  status: string;
  type: string;
  season: string;
  draft_order?: Record<string, number> | null;
  slot_to_roster_id?: Record<string, number> | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface OneiromancySettings {
  draft_id: string;
  league_id?: string;
  sleeper_username?: string;
  available_leagues?: AvailableLeague[];
  user_id: string;
  user_slot: number;
  auto_update: boolean;
  poll_interval_ms: number; // 5000 or 10000
  chaos_lambda: number; // 0.0 to 1.0 (default 0.65)
  lambda_chaos?: number;
  oracle_weights: OracleWeights;
  theme: 'deep_obsidian';
  offline_mode_active: boolean;
  mode?: 'live' | 'mock';
  sync_error?: string | null;
  sync_warning?: string | null;
  last_error?: string | null;
  roster_positions?: string[];
  user_avatar?: string | null;
  user_avatar_url?: string | null;
}

export type AppSettings = OneiromancySettings;

export interface ResolvedLeagueSetup {
  draft_id: string;
  user_id: string;
  user_slot: number;
  display_name: string;
  avatar?: string | null;
  avatar_url?: string | null;
}

export interface SleeperUserMetadata {
  team_name?: string;
  avatar?: string;
  allow_pn?: string;
  mascot_message?: string;
  user_message?: string;
  mention_pn?: string;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name?: string;
  avatar?: string | null;
  metadata?: SleeperUserMetadata;
  is_owner?: boolean;
}

// ============================================================================
// Canonical Draft State Aggregation
// ============================================================================

export interface DraftPickState {
  round: number;
  pick_no: number;
  on_the_clock_team_id: string;
  seconds_remaining: number;
}

export interface DraftState {
  draft_id: string;
  status: DraftLeagueStatus;
  current_pick: DraftPickState;
  cosmic_board: CosmicPlayer[];
  ideal_draft_path: IdealDraftPick[];
  my_roster: RosterSlot[];
  weekly_coverage: ByeCoverageWeek[];
  elemental_traits: ElementalDistribution;
  waiver_upgrades: WaiverUpgrade[];
  trade_proposals: TradeProposal[];
  settings: OneiromancySettings;
  available_leagues?: AvailableLeague[];
  isLive?: boolean;
  mode?: 'live' | 'mock';
  sync_error?: string | null;
  sync_warning?: string | null;
  competitor_teams?: CompetitorTeam[];
  weekly_matchup?: WeeklyMatchup;
  roster_positions?: string[];
  avatar?: string | null;
  avatar_url?: string | null;
  user_avatar_url?: string | null;
}

// ============================================================================
// External Sleeper API Data Contracts
// ============================================================================

export interface SleeperDraftSettings {
  teams: number;
  rounds: number;
  pick_timer: number;
  slots_qb: number;
  slots_rb: number;
  slots_wr: number;
  slots_te: number;
  slots_flex: number;
  slots_k?: number;
  slots_def?: number;
  slots_bn: number;
  cpu_autopick?: number;
  reversal_round?: number;
  slots_super_flex?: number;
  slots_idp_flex?: number;
  slots_dl?: number;
  slots_lb?: number;
  slots_db?: number;
  slots_idp?: number;
  autopause_enabled?: number;
  autostart?: number;
  alpha_sort?: number;
  nomination_timer?: number;
}

export interface SleeperDraftMetadata {
  draft_id: string;
  league_id: string | null;
  season: string;
  type: 'snake' | 'linear' | 'auction';
  status: DraftLeagueStatus;
  start_time: number | null;
  last_picked: number | null;
  last_message_time: number | null;
  settings: SleeperDraftSettings;
  metadata: {
    name: string;
    description?: string;
    scoring_type: 'std' | 'half_ppr' | 'ppr' | '2qb' | 'dynasty_2qb' | string;
    banner_image?: string;
    progress?: string;
  };
  draft_order: Record<string, number> | null; // user_id -> draft_slot
  slot_to_roster_id: Record<string, number> | null;
}

export interface SleeperPickMetadata {
  first_name: string;
  last_name: string;
  team: string;
  position: NFLPosition;
  player_id?: string;
  status?: string;
  injury_status?: string;
  sport: string;
  number?: string;
  amount?: string;
  years_exp?: string;
  news_updated?: string;
  team_abbr?: string;
  team_changed_at?: string;
}

export interface SleeperPick {
  draft_id: string;
  pick_no: number;
  round: number;
  draft_slot: number;
  player_id: string;
  picked_by: string;
  roster_id: number;
  is_keeper: boolean | null;
  metadata: SleeperPickMetadata;
  reactions?: Record<string, string> | null;
}

export interface SleeperPlayerRecord {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: NFLPosition;
  team: string | null;
  status: 'Active' | 'Inactive' | 'Injured Reserve' | 'Practice Squad' | string;
  birth_date: string | null;
  number: number | null;
  college: string | null;
  birth_city?: string | null;
  birth_state?: string | null;
  birth_country?: string | null;
  years_exp: number;
  height: string | null;
  weight: string | null;
  injury_status: string | null;
  depth_chart_order?: number | null;
  fantasy_positions?: string[];
  search_full_name?: string;
  search_rank?: number | null;
  age?: number | null;
}

export interface SleeperNFLState {
  week: number;
  leg: number;
  season: string;
  season_type: string;
  league_season: string;
  previous_season: string;
  season_start_date: string;
  display_week: number;
  league_create_season: string;
  season_has_scores: boolean;
}
