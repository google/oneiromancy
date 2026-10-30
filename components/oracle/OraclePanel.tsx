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

import React, { useEffect } from 'react';
import { X, Compass, HelpCircle } from 'lucide-react';
import { useOneiromancy } from '@/context/OneiromancyContext';
import ChaosDial from '@/components/screens/ChaosDial';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import { oracleLeaning } from '@/components/common/NavigationShell';

export interface OraclePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Symmetric around the middle; default is λ = 0.75 (mostly stars).
const PRESETS = [
  { value: 0, label: 'Stats only' },
  { value: 1 - DEFAULT_CHAOS_LAMBDA, label: 'Mostly stats' },
  { value: DEFAULT_CHAOS_LAMBDA, label: 'Mostly stars', isDefault: true },
  { value: 1, label: 'Stars only' },
];

/**
 * The Oracle: one place to decide how much the stars move your decisions
 * and inspect the 5-pillar Spirit weights and astrology reference guide.
 */
export const OraclePanel: React.FC<OraclePanelProps> = ({ isOpen, onClose }) => {
  const { draftState, updateChaosLambda } = useOneiromancy();
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Oracle settings"
        className="h-full w-full max-w-lg overflow-y-auto bg-[#14141c] border-l border-purple-500/30 p-5 space-y-5"
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
              Weights &amp; Astrology Encyclopedia
            </span>
            <h2 className="font-serif text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-300" /> Oracle &amp; Weights
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Control how football stats and astrological alignment blend across every player card, lineup check, and trade.
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

        {/* The three canonical player metrics, named the same everywhere in the app */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-sans">
          {(
            [
              ['Stats', 'text-cyan-300', "This week's projected points."],
              ['Oracle', 'text-purple-300', 'Stats and Stars blended by λ.'],
              ['Stars', 'text-emerald-300', "This week's alignment (0-100), built from the 5-pillar Spirit weights."],
            ] as const
          ).map(([term, color, def]) => (
            <div key={term} className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
              <dt className={`font-mono font-bold ${color}`}>{term}</dt>
              <dd className="text-slate-400 mt-0.5">{def}</dd>
            </div>
          ))}
        </dl>

        <section className="space-y-3 p-4 rounded-xl bg-slate-900/70 border border-white/10">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="oracle-lambda"
              className="text-xs font-mono text-slate-300 flex items-center gap-1.5"
              title="What it measures: The blend ratio between football projections (Stats) and astrological alignment (Stars). Why it matters: Raising λ promotes players with hot game-day transits over chalk projections."
            >
              <span>
                λ = <span className="text-purple-200 font-bold text-base">{lambda.toFixed(2)}</span>
              </span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            </label>
            <span className="text-xs font-mono text-purple-300">{oracleLeaning(lambda)}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Sets how much astrological alignment (Stars) shifts a player&apos;s Oracle rating vs. raw football Stats.
          </p>
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
                data-testid={`preset-${p.value}`}
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

        {/* Star weights and the astrology reference are always shown (owner preference). */}
        <section aria-label="Star weights and astrology reference">
          <ChaosDial embedded />
        </section>
      </div>
    </div>
  );
};

export default OraclePanel;
