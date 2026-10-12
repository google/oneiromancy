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

import React, { useEffect, useMemo, useState } from 'react';
import { X, Compass } from 'lucide-react';
import { useOneiromancy } from '@/context/OneiromancyContext';
import ChaosDial from '@/components/screens/ChaosDial';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import { computeLineupCheck, computeWaiverMoves } from '@/lib/oracle';
import { oracleLeaning } from '@/components/common/NavigationShell';

import type { CosmicPlayer, RosterSlot } from '@/types/oneiromancy';

// Stable empty defaults so memo dependencies don't change every render.
const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];

export interface OraclePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Symmetric around the middle; "Mostly stars" is the owner's default λ.
const PRESETS = [
  { value: 0, label: 'Stats only' },
  { value: 1 - DEFAULT_CHAOS_LAMBDA, label: 'Mostly stats' },
  { value: DEFAULT_CHAOS_LAMBDA, label: 'Mostly stars', isDefault: true },
  { value: 1, label: 'Stars only' },
];

/**
 * The Oracle: one place to decide how much the stars move your decisions,
 * previewed on your own lineup and waiver moves.
 */
export const OraclePanel: React.FC<OraclePanelProps> = ({ isOpen, onClose }) => {
  const { draftState, updateChaosLambda } = useOneiromancy();
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const [inspected, setInspected] = useState<InspectTarget | null>(null);
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const currentWeek = getSeasonContext()?.currentWeek;

  const swaps = useMemo(() => computeLineupCheck(roster, lambda), [roster, lambda]);
  const topWaiver = useMemo(
    () => computeWaiverMoves(board, roster, lambda, currentWeek, 1)[0],
    [board, roster, lambda, currentWeek],
  );

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    // With a player open on top, Escape closes only the player view.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inspected) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, inspected]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Oracle settings"
        className="h-full w-full max-w-lg overflow-y-auto bg-[#14141c] border-l border-purple-500/30 p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
              Divination Equilibrium
            </span>
            <h2 className="font-serif text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-300" /> Oracle
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              How much should the stars move your decisions? Every ranking and pick in the app uses this.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Oracle"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The four numbers, named the same everywhere in the app */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-sans">
          {(
            [
              ['Stats', 'text-cyan-300', "This week's projected points."],
              ['Spirit', 'text-purple-300', 'Season-long score from the five pillars below.'],
              ['Stars', 'text-emerald-300', "This week's favorability, built on Spirit (0–100)."],
              ['Oracle', 'text-amber-300', 'Stats and Stars blended by λ.'],
            ] as const
          ).map(([term, color, def]) => (
            <div key={term}>
              <dt className={`inline font-mono font-bold ${color}`}>{term}</dt>
              <dd className="inline text-slate-400"> {def}</dd>
            </div>
          ))}
        </dl>

        <section className="space-y-3 p-4 rounded-xl bg-slate-900/70 border border-white/10">
          <div className="flex items-baseline justify-between">
            <label htmlFor="oracle-lambda" className="text-xs font-mono text-slate-300">
              λ = <span className="text-purple-200 font-bold text-base">{lambda.toFixed(2)}</span>
            </label>
            <span className="text-xs font-mono text-purple-300">{oracleLeaning(lambda)}</span>
          </div>
          <input
            id="oracle-lambda"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={lambda}
            aria-label="Oracle lambda"
            onChange={(e) => updateChaosLambda(parseFloat(e.target.value))}
            className="w-full accent-purple-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>Stats only</span>
            <span>Stars only</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => updateChaosLambda(p.value)}
                className={`py-1.5 rounded-lg text-[10px] font-mono border ${
                  Math.abs(lambda - p.value) < 0.01
                    ? 'border-purple-400 bg-purple-950/60 text-purple-100'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
                {p.isDefault && <span className="block text-[9px] opacity-70">default</span>}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-mono text-slate-400">Oracle = (1 − λ) × Stats + λ × Stars</p>
        </section>

        <section className="space-y-2" data-testid="oracle-preview">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">At this setting</h3>
          {swaps.length === 0 ? (
            <p className="text-sm text-slate-300 p-3 rounded-lg bg-slate-900/60 border border-white/10">
              Your current lineup is already the Oracle&apos;s best lineup.
            </p>
          ) : (
            swaps.map((s) => (
              <div
                key={s.playerIn.id}
                className="p-3 rounded-lg bg-slate-900/60 border border-white/10 text-sm flex flex-col gap-0.5"
              >
                <span className="text-slate-100">
                  {s.slot}: start{' '}
                  <strong>
                    <PlayerLink player={s.playerIn} vs={s.playerOut ?? null} onOpen={setInspected} />
                  </strong>
                  {s.playerOut ? (
                    <>
                      {' '}over <PlayerLink player={s.playerOut} vs={s.playerIn} onOpen={setInspected} />
                    </>
                  ) : null}
                  {s.moved ? ` (${s.moved.player.name} moves to ${s.moved.to})` : ''}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {s.flipLambda !== null
                    ? `Stats and Stars disagree. This flips at λ ${s.flipLambda.toFixed(2)}.`
                    : 'Stats and Stars agree.'}
                </span>
              </div>
            ))
          )}
          {topWaiver && (
            <div className="p-3 rounded-lg bg-slate-900/60 border border-white/10 text-sm">
              Top waiver move: add{' '}
              <strong>
                <PlayerLink player={topWaiver.add} vs={topWaiver.drop} onOpen={setInspected} />
              </strong>
              , drop <PlayerLink player={topWaiver.drop} vs={topWaiver.add} onOpen={setInspected} />
            </div>
          )}
        </section>

        {/* Star weights and the astrology reference are always shown (owner preference). */}
        <section aria-label="Star weights and astrology reference">
          <ChaosDial embedded />
        </section>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <PlayerDetailModal
          player={inspected?.player ?? null}
          compareWith={inspected?.vs ?? null}
          isOpen={inspected !== null}
          onClose={() => setInspected(null)}
          roster={roster}
        />
      </div>
    </div>
  );
};

export default OraclePanel;
