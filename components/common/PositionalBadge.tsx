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

import React from 'react';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF' | 'K_DEF';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface PositionalBadgeProps {
  position: Position | string;
  size?: BadgeSize;
  className?: string;
  showGlow?: boolean;
  depth?: number | string | null;
  title?: string;
}

export const toSuperscript = (depth: number | string | null | undefined): string => {
  if (depth === null || depth === undefined || String(depth).trim() === '') return '';
  const num = Number(depth);
  if (!Number.isInteger(num) || num < 1 || num > 99) return '';
  return String(num);
};

const POSITION_STYLES: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  QB: {
    text: 'text-red-400',
    bg: 'bg-red-950/40',
    border: 'border-red-500/40',
    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.35)]',
  },
  RB: {
    text: 'text-teal-400',
    bg: 'bg-teal-950/40',
    border: 'border-teal-500/40',
    glow: 'shadow-[0_0_10px_rgba(20,184,166,0.35)]',
  },
  WR: {
    text: 'text-sky-400',
    bg: 'bg-sky-950/40',
    border: 'border-sky-500/40',
    glow: 'shadow-[0_0_10px_rgba(56,189,248,0.35)]',
  },
  TE: {
    text: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/40',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.35)]',
  },
  FLEX: {
    text: 'text-rose-400',
    bg: 'bg-rose-950/60',
    border: 'border-rose-500/50',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.35)]',
  },
  K: {
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
    border: 'border-slate-600/50',
    glow: 'shadow-[0_0_8px_rgba(148,163,184,0.25)]',
  },
  DEF: {
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
    border: 'border-slate-600/50',
    glow: 'shadow-[0_0_8px_rgba(148,163,184,0.25)]',
  },
  K_DEF: {
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
    border: 'border-slate-600/50',
    glow: 'shadow-[0_0_8px_rgba(148,163,184,0.25)]',
  },
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.2 rounded font-semibold',
  md: 'text-xs px-2 py-0.5 rounded-md font-semibold',
  lg: 'text-sm px-2.5 py-1 rounded-md font-bold',
};

export const PositionalBadge: React.FC<PositionalBadgeProps> = ({
  position,
  size = 'md',
  className = '',
  showGlow = true,
  depth,
  title,
}) => {
  const normalizedPos = position.toUpperCase();
  const styles = POSITION_STYLES[normalizedPos] || {
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
    border: 'border-slate-700',
    glow: '',
  };

  const depthText = toSuperscript(depth);
  const isValidDepth = depthText !== '';

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const glowClass = showGlow ? styles.glow : '';
  const badgeTitle = title ?? (isValidDepth ? `${normalizedPos} · depth chart #${depthText}` : undefined);

  return (
    <span
      data-testid={`badge-${normalizedPos.toLowerCase()}`}
      title={badgeTitle}
      className={`inline-flex items-center justify-center font-mono border uppercase tracking-wider transition-all duration-200 ${styles.text} ${styles.bg} ${styles.border} ${glowClass} ${sizeClass} ${className}`}
    >
      {normalizedPos}
      {isValidDepth ? (
        <>
          <sup
            data-testid="position-depth"
            aria-hidden="true"
            className="relative -top-[0.35em] text-[0.7em] font-bold leading-none ml-0.5 tracking-tight select-none"
          >
            {depthText}
          </sup>
          <span className="sr-only normal-case">, depth chart {depthText}</span>
        </>
      ) : null}
    </span>
  );
};

export default PositionalBadge;
