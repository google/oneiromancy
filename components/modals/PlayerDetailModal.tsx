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

import React, { useContext } from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import { CosmicPlayer, RosterSlot } from '@/types/oneiromancy';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { haversineDistance } from '@/lib/scoring';
import { X, Sparkles, Compass, Shield, ArrowRightLeft } from 'lucide-react';

export interface PlayerDetailModalProps {
  player: CosmicPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  onDraft?: (playerId: string) => void;
  roster?: RosterSlot[];
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  isOpen,
  onClose,
  roster: propRoster,
}) => {
  let ctx: any = null;
  try {
    ctx = useOneiromancy();
  } catch {
    ctx = null;
  }
  if (!isOpen || !player) return null;

  const activeRoster: RosterSlot[] = propRoster || ctx?.draftState?.my_roster || [];
  const boardRostered: CosmicPlayer[] = (ctx?.draftState?.cosmic_board || []).filter(
    (p) => p.draft_status === 'my_team'
  );

  // Collect all players on the user's team with the same role (position)
  const sameRoleTeamPlayers: Array<{
    slotLabel: string;
    isStarter: boolean;
    rosterPlayer: CosmicPlayer;
  }> = [];
  const seenIds = new Set<string>();

  for (const slot of activeRoster) {
    if (slot.player && slot.player.position === player.position) {
      const isStarter = !slot.slot_id.startsWith('BN');
      sameRoleTeamPlayers.push({
        slotLabel: isStarter ? `STARTER • ${slot.slot_id}` : `BENCH • ${slot.slot_id}`,
        isStarter,
        rosterPlayer: slot.player,
      });
      seenIds.add(String(slot.player.id));
    }
  }
  const hasPopulatedRosterSlots = activeRoster.some((s) => Boolean(s.player));
  if (!hasPopulatedRosterSlots) {
    for (const bp of boardRostered) {
      if (bp.position === player.position && !seenIds.has(String(bp.id))) {
        sameRoleTeamPlayers.push({
          slotLabel: 'ROSTER',
          isStarter: false,
          rosterPlayer: bp,
        });
        seenIds.add(String(bp.id));
      }
    }
  }

  const getWeeklyProj = (p: CosmicPlayer) =>
    p.weekly_projected_points ??
    p.sleeper_projected_points ??
    p.projected_points ??
    0;

  const candidateProj = getWeeklyProj(player);
  const candidateFav = player.favorability_score ?? 75;

  const breakdown = player.divination_breakdown || {
    celestial: player.spirit_score ? Math.round(player.spirit_score * 0.95) : 85,
    numeric: player.jersey_number ? (player.jersey_number % 9) + 80 : 85,
    geomantic: 85,
    oracular: 85,
    harmony: player.harmony_score || 85,
  };

  const isAvailable = player.draft_status === 'available';

  const NFL_TEAM_COORDS: Record<string, { lat: number; lon: number; venue: string }> = {
    ARI: { lat: 33.5276, lon: -112.2626, venue: 'State Farm Stadium' },
    ATL: { lat: 33.7554, lon: -84.4009, venue: 'Mercedes-Benz Stadium' },
    BAL: { lat: 39.278, lon: -76.6227, venue: 'M&T Bank Stadium' },
    BUF: { lat: 42.7738, lon: -78.787, venue: 'Highmark Stadium' },
    CAR: { lat: 35.2258, lon: -80.8528, venue: 'Bank of America Stadium' },
    CHI: { lat: 41.8623, lon: -87.6167, venue: 'Soldier Field' },
    CIN: { lat: 39.0954, lon: -84.5161, venue: 'Paycor Stadium' },
    CLE: { lat: 41.5061, lon: -81.6995, venue: 'Cleveland Browns Stadium' },
    DAL: { lat: 32.7473, lon: -97.0945, venue: 'AT&T Stadium' },
    DEN: { lat: 39.7439, lon: -105.0201, venue: 'Empower Field' },
    DET: { lat: 42.34, lon: -83.0456, venue: 'Ford Field' },
    GB: { lat: 44.5013, lon: -88.0622, venue: 'Lambeau Field' },
    HOU: { lat: 29.6847, lon: -95.4107, venue: 'NRG Stadium' },
    IND: { lat: 39.7601, lon: -86.1639, venue: 'Lucas Oil Stadium' },
    JAX: { lat: 30.3239, lon: -81.6373, venue: 'EverBank Stadium' },
    KC: { lat: 39.0489, lon: -94.4839, venue: 'GEHA Field at Arrowhead Stadium' },
    LAC: { lat: 33.9535, lon: -118.339, venue: 'SoFi Stadium' },
    LAR: { lat: 33.9535, lon: -118.339, venue: 'SoFi Stadium' },
    LV: { lat: 36.0908, lon: -115.1833, venue: 'Allegiant Stadium' },
    MIA: { lat: 25.958, lon: -80.2389, venue: 'Hard Rock Stadium' },
    MIN: { lat: 44.9735, lon: -93.2575, venue: 'U.S. Bank Stadium' },
    NE: { lat: 42.0909, lon: -71.2643, venue: 'Gillette Stadium' },
    NO: { lat: 29.9511, lon: -90.0812, venue: 'Caesars Superdome' },
    NYG: { lat: 40.8128, lon: -74.0742, venue: 'MetLife Stadium' },
    NYJ: { lat: 40.8128, lon: -74.0742, venue: 'MetLife Stadium' },
    PHI: { lat: 39.9008, lon: -75.1675, venue: 'Lincoln Financial Field' },
    PIT: { lat: 40.4468, lon: -80.0158, venue: 'Acrisure Stadium' },
    SEA: { lat: 47.5952, lon: -122.3316, venue: 'Lumen Field' },
    SF: { lat: 37.4033, lon: -121.9694, venue: "Levi's Stadium" },
    TB: { lat: 27.9759, lon: -82.5033, venue: 'Raymond James Stadium' },
    TEN: { lat: 36.1665, lon: -86.7713, venue: 'Nissan Stadium' },
    WAS: { lat: 38.9076, lon: -76.8645, venue: 'Commanders Field' },
  };

  const rawTeam = (player.team || 'KC').toUpperCase();
  const stadiumCoords = NFL_TEAM_COORDS[rawTeam] || {
    lat: 39.0489,
    lon: -94.4839,
    venue: `${player.team} Stadium`,
  };

  const pHash = Math.abs(
    (player.name || player.id).split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  );
  const birthLat = Number((25.0 + (pHash % 200) / 10).toFixed(2));
  const birthLon = Number((-120.0 + ((pHash * 7) % 450) / 10).toFixed(2));
  const birthplaceCoords = {
    lat: birthLat,
    lon: birthLon,
    city: `Birthplace (${player.elemental_traits.sun_sign || 'Natal'} Nexus)`,
  };

  const geodesicDist = Math.round(
    haversineDistance(birthplaceCoords.lat, birthplaceCoords.lon, stadiumCoords.lat, stadiumCoords.lon)
  );
  const meridianAlignment = Number((Math.max(5.0, 20.0 - geodesicDist / 200)).toFixed(1));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#161622] border border-purple-500/40 p-5 sm:p-6 shadow-[0_0_30px_rgba(109,40,217,0.3)] space-y-4"
      >
        {/* Modal Top Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <PositionalBadge position={player.position} size="md" />
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                {player.team} • Bye {player.bye_week} • #{player.jersey_number}
              </span>
              {player.injury_status && (
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                    player.injury_status === 'Out' || player.injury_status === 'IR'
                      ? 'text-rose-400 bg-rose-950/80 border-rose-500/50'
                      : 'text-amber-400 bg-amber-950/80 border-amber-500/50'
                  }`}
                >
                  {player.injury_status.toUpperCase()}
                </span>
              )}
            </div>
            <h2
              id="player-detail-modal-title"
              className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide"
            >
              {player.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dossier"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Projections Capsule */}
        {(() => {
          const sleeperProj = candidateProj;
          const nflProj =
            player.nfl_projected_points ??
            (player.weekly_projected_points ?? sleeperProj);

          return (
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-xs">
              <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30">
                <span className="text-[10px] text-cyan-400 block uppercase font-bold">
                  Sleeper League Proj
                </span>
                <span className="text-lg font-bold text-cyan-200">
                  {sleeperProj.toFixed(1)} pts
                </span>
                <span className="text-[9px] text-slate-400 block">
                  League Scoring Proj
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">
                  NFL Standard Proj
                </span>
                <span className="text-lg font-bold text-slate-200">
                  {nflProj.toFixed(1)} pts
                </span>
                <span className="text-[9px] text-slate-400 block">
                  Standard Half-PPR Baseline
                </span>
              </div>
            </div>
          );
        })()}

        {/* Elemental Traits Capsule */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] p-2.5 rounded-xl bg-slate-950/80 border border-white/10">
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Zodiac Sun</span>
            <span className="text-slate-200 font-bold">{player.elemental_traits?.sun_sign || 'Aries'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Element</span>
            <span className="text-cyan-300 font-bold">{player.elemental_traits?.element || 'Water'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Life Path</span>
            <span className="text-purple-300 font-bold">#{player.elemental_traits?.life_path_number || 7}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">Tarot Archetype</span>
            <span className="text-amber-300 font-bold truncate block">{player.elemental_traits?.tarot_card || 'The Chariot'}</span>
          </div>
        </div>

        {/* 5 Score Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
            <span className="text-[9px] text-cyan-400 uppercase font-bold block">DraftScore</span>
            <span className="text-xl font-bold text-cyan-300">{player.draft_score.toFixed(1)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
            <span className="text-[9px] text-emerald-300 uppercase font-bold block">Wk Favorability</span>
            <span className="text-xl font-bold text-emerald-300">
              {candidateFav.toFixed(0)}
            </span>
            <span className="text-[8px] block text-emerald-400 font-mono truncate">
              {player.favorability_verdict || (candidateFav >= 84 ? 'HEAVILY FAV' : candidateFav >= 75 ? 'ASTRALLY FAV' : 'CHALLENGED')}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30">
            <span className="text-[9px] text-purple-300 uppercase font-bold block">Spirit</span>
            <span className="text-xl font-bold text-purple-200">{player.spirit_score.toFixed(1)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30">
            <span className="text-[9px] text-sky-400 uppercase font-bold block">VOR</span>
            <span className="text-xl font-bold text-sky-300">
              {player.market_vor >= 0 ? `+${player.market_vor.toFixed(1)}` : player.market_vor.toFixed(1)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30">
            <span className="text-[9px] text-amber-300 uppercase font-bold block">Harmony</span>
            <span className="text-xl font-bold text-amber-200">{player.harmony_score.toFixed(1)}</span>
          </div>
        </div>

        {/* Roster Role Comparison vs. Same-Position Players on User's Team */}
        <div
          data-testid="roster-role-comparison"
          className="space-y-2.5 p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 font-mono text-xs"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs uppercase font-bold text-cyan-300 tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
              Role Comparison vs. Your Team ({player.position})
            </span>
            <span className="text-[10px] text-slate-400">
              {sameRoleTeamPlayers.length} {player.position}{sameRoleTeamPlayers.length === 1 ? '' : 's'} on active roster
            </span>
          </div>

          {sameRoleTeamPlayers.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-slate-400 text-[11px]">
              No rostered {player.position}s found on your active squad — {player.name} would fill an open {player.position} role directly.
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {sameRoleTeamPlayers.map(({ slotLabel, isStarter, rosterPlayer }) => {
                const isSelf = String(rosterPlayer.id) === String(player.id);
                const rosProj = getWeeklyProj(rosterPlayer);
                const rosFav = rosterPlayer.favorability_score ?? 70;

                const projDiff = candidateProj - rosProj;
                const dsDiff = player.draft_score - rosterPlayer.draft_score;
                const vorDiff = player.market_vor - rosterPlayer.market_vor;
                const spiritDiff = player.spirit_score - rosterPlayer.spirit_score;
                const harmDiff = player.harmony_score - rosterPlayer.harmony_score;
                const favDiff = candidateFav - rosFav;
                const isUpgrade = dsDiff > 0.2 || projDiff > 0.5;

                const fmtDiff = (d: number, decimals = 1) =>
                  `${d >= 0 ? '+' : ''}${d.toFixed(decimals)}`;

                return (
                  <div
                    key={`${slotLabel}-${rosterPlayer.id}`}
                    data-testid={`role-comp-row-${rosterPlayer.id}`}
                    className={`p-2.5 rounded-lg border space-y-2 ${
                      isSelf
                        ? 'bg-cyan-950/30 border-cyan-500/40'
                        : isUpgrade
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-slate-900/70 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            isStarter
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                              : 'bg-slate-800 text-slate-300 border-white/10'
                          }`}
                        >
                          {slotLabel}
                        </span>
                        <span className="font-serif font-bold text-sm text-slate-100">
                          {rosterPlayer.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {rosterPlayer.team} (Bye {rosterPlayer.bye_week})
                        </span>
                        {rosterPlayer.injury_status && (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-950/70 text-rose-300 border border-rose-500/40">
                            {rosterPlayer.injury_status.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          isSelf
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                            : isUpgrade
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-white/10'
                        }`}
                      >
                        {isSelf
                          ? 'CURRENTLY INSPECTED'
                          : isUpgrade
                            ? `⚡ UPGRADE (${fmtDiff(projDiff)} PTS / ${fmtDiff(dsDiff)} DS)`
                            : `HOLD ${rosterPlayer.name.split(' ')[1] || rosterPlayer.name} (${fmtDiff(dsDiff)} DS)`}
                      </span>
                    </div>

                    {/* 6-Column Stat Comparison & Delta Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10px] pt-1 border-t border-white/5">
                      <div className="p-1.5 rounded bg-slate-950/70">
                        <span className="text-[8px] text-slate-500 uppercase block">Proj Pts</span>
                        <span className="text-slate-200 font-bold">
                          {candidateProj.toFixed(1)} vs {rosProj.toFixed(1)}
                        </span>
                        <span
                          className={`block font-bold ${
                            projDiff > 0 ? 'text-emerald-400' : projDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {fmtDiff(projDiff)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-slate-950/70">
                        <span className="text-[8px] text-slate-500 uppercase block">DraftScore</span>
                        <span className="text-slate-200 font-bold">
                          {player.draft_score.toFixed(1)} vs {rosterPlayer.draft_score.toFixed(1)}
                        </span>
                        <span
                          className={`block font-bold ${
                            dsDiff > 0 ? 'text-emerald-400' : dsDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {fmtDiff(dsDiff)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-slate-950/70">
                        <span className="text-[8px] text-slate-500 uppercase block">VOR</span>
                        <span className="text-slate-200 font-bold">
                          {fmtDiff(player.market_vor)} vs {fmtDiff(rosterPlayer.market_vor)}
                        </span>
                        <span
                          className={`block font-bold ${
                            vorDiff > 0 ? 'text-emerald-400' : vorDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {fmtDiff(vorDiff)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-slate-950/70">
                        <span className="text-[8px] text-slate-500 uppercase block">Spirit</span>
                        <span className="text-slate-200 font-bold">
                          {player.spirit_score.toFixed(1)} vs {rosterPlayer.spirit_score.toFixed(1)}
                        </span>
                        <span
                          className={`block font-bold ${
                            spiritDiff > 0 ? 'text-emerald-400' : spiritDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {fmtDiff(spiritDiff)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-slate-950/70">
                        <span className="text-[8px] text-slate-500 uppercase block">Harmony</span>
                        <span className="text-slate-200 font-bold">
                          {player.harmony_score.toFixed(1)} vs {rosterPlayer.harmony_score.toFixed(1)}
                        </span>
                        <span
                          className={`block font-bold ${
                            harmDiff > 0 ? 'text-emerald-400' : harmDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {fmtDiff(harmDiff)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-slate-950/70">
                        <span className="text-[8px] text-slate-500 uppercase block">Wk Fav</span>
                        <span className="text-slate-200 font-bold">
                          {candidateFav.toFixed(0)} vs {rosFav.toFixed(0)}
                        </span>
                        <span
                          className={`block font-bold ${
                            favDiff > 0 ? 'text-emerald-400' : favDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {fmtDiff(favDiff, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5 Divination Tiers Breakdown */}
        <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/90 border border-white/10 font-mono text-xs">
          <span className="text-xs uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            The 5 Divination Pillars
          </span>

          <div className="space-y-2 pt-1">
            {[
              {
                name: 'Celestial Transits (30%)',
                val: breakdown.celestial,
                color: 'bg-cyan-400',
                desc: 'Planetary alignments & natal transit aspects',
              },
              {
                name: 'Stadium Feng Shui (25%)',
                val: breakdown.geomantic,
                color: 'bg-emerald-400',
                desc: 'Magnetic venue orientation & dome enclosure atmosphere',
              },
              {
                name: 'Jersey Gematria (20%)',
                val: breakdown.numeric,
                color: 'bg-purple-400',
                desc: 'Life path root resonance & master number harmony',
              },
              {
                name: 'Squad Alchemy (15%)',
                val: breakdown.harmony,
                color: 'bg-amber-400',
                desc: 'Western Trine synergy & 3.0x correlation stack bonus',
              },
              {
                name: 'Tarot & Oracular (10%)',
                val: breakdown.oracular,
                color: 'bg-rose-400',
                desc: 'Major Arcana archetype & hexagram resonance',
              },
            ].map((tier) => (
              <div key={tier.name} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">{tier.name}</span>
                  <span className="text-white font-bold">{tier.val.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${tier.color} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(0, tier.val))}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">{tier.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Astrocartography Stadium Coordinates & Geodesic Telemetry */}
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 font-mono text-xs space-y-2">
          <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Astrocartography Geodesic Coordinates
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded bg-slate-900/80 border border-white/5">
              <span className="text-slate-500 text-[9px] block uppercase">Birthplace</span>
              <span className="text-slate-200 font-bold block">{birthplaceCoords.city}</span>
              <span className="text-slate-400 text-[10px]">{birthplaceCoords.lat}° N, {Math.abs(birthplaceCoords.lon)}° W</span>
            </div>
            <div className="p-2 rounded bg-slate-900/80 border border-white/5">
              <span className="text-slate-500 text-[9px] block uppercase">Stadium Venue</span>
              <span className="text-slate-200 font-bold block">{stadiumCoords.venue}</span>
              <span className="text-slate-400 text-[10px]">{stadiumCoords.lat}° N, {Math.abs(stadiumCoords.lon)}° W</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400 border-t border-white/5">
            <span>Geodesic Distance:</span>
            <span className="text-cyan-300 font-bold">{geodesicDist.toLocaleString()} km</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-emerald-400">
            <span>Meridian Alignment Bonus:</span>
            <span className="font-bold">+{meridianAlignment} pts (In Nexus)</span>
          </div>
        </div>

        {/* Read-Only Status & Dismissal */}
        <div className="flex items-center gap-2 pt-2">
          <div className="flex-1 py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-center flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">
              STATUS:{' '}
              <strong className={isAvailable ? 'text-cyan-400' : 'text-slate-400'}>
                {isAvailable ? 'AVAILABLE IN DRAFT POOL (READ-ONLY)' : 'ROSTERED / CLAIMED'}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs border border-white/10 active:scale-98 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailModal;
