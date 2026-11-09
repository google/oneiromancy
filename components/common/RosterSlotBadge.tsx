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

export type RosterSlotType =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'WRT'
  | 'WRTQ'
  | 'WRRB'
  | 'REC_FLEX'
  | 'IDP'
  | 'K'
  | 'DEF'
  | 'BN'
  | 'UNKNOWN';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface NormalizedSlot {
  type: RosterSlotType;
  label: string;
  title: string;
}

export interface RosterSlotBadgeProps {
  slotId?: string;
  slotName?: string;
  slotLabel?: string;
  type?: RosterSlotType;
  size?: BadgeSize;
  className?: string;
  style?: Record<string, string | number | undefined>;
  dataTestId?: string;
  'data-testid'?: string;
  title?: string;
}

const KNOWN_SLOT_IDS: Record<string, { type: RosterSlotType; label: string; title: string }> = {
  QB: { type: 'QB', label: 'QB', title: 'Quarterback' },
  RB: { type: 'RB', label: 'RB', title: 'Running Back' },
  RB1: { type: 'RB', label: 'RB', title: 'Running Back 1' },
  RB2: { type: 'RB', label: 'RB', title: 'Running Back 2' },
  RB3: { type: 'RB', label: 'RB', title: 'Running Back 3' },
  WR: { type: 'WR', label: 'WR', title: 'Wide Receiver' },
  WR1: { type: 'WR', label: 'WR', title: 'Wide Receiver 1' },
  WR2: { type: 'WR', label: 'WR', title: 'Wide Receiver 2' },
  WR3: { type: 'WR', label: 'WR', title: 'Wide Receiver 3' },
  TE: { type: 'TE', label: 'TE', title: 'Tight End' },
  TE1: { type: 'TE', label: 'TE', title: 'Tight End 1' },
  TE2: { type: 'TE', label: 'TE', title: 'Tight End 2' },
  FLEX: { type: 'WRT', label: 'WRT', title: 'Flex (W/R/T)' },
  WRT: { type: 'WRT', label: 'WRT', title: 'Flex (W/R/T)' },
  SUPER_FLEX: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' },
  SUPERFLEX: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' },
  WRTQ: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' },
  SF: { type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' },
  WRRB_FLEX: { type: 'WRRB', label: 'WR/RB', title: 'Flex (W/R)' },
  WRRB: { type: 'WRRB', label: 'WR/RB', title: 'Flex (W/R)' },
  REC_FLEX: { type: 'REC_FLEX', label: 'WR/TE', title: 'Flex (W/T)' },
  WRTE: { type: 'REC_FLEX', label: 'WR/TE', title: 'Flex (W/T)' },
  IDP_FLEX: { type: 'IDP', label: 'IDP', title: 'Individual Defensive Player' },
  IDP: { type: 'IDP', label: 'IDP', title: 'Individual Defensive Player' },
  DL: { type: 'IDP', label: 'DL', title: 'Defensive Lineman' },
  LB: { type: 'IDP', label: 'LB', title: 'Linebacker' },
  DB: { type: 'IDP', label: 'DB', title: 'Defensive Back' },
  K: { type: 'K', label: 'K', title: 'Kicker' },
  DEF: { type: 'DEF', label: 'DEF', title: 'Defense / Special Teams' },
};

const KNOWN_SLOT_NAMES: Array<{ pattern: RegExp; type: RosterSlotType; label: string; title: string }> = [
  { pattern: /^Quarterback$/i, type: 'QB', label: 'QB', title: 'Quarterback' },
  { pattern: /^Running\s*Back(\s*\d+)?$/i, type: 'RB', label: 'RB', title: 'Running Back' },
  { pattern: /^Wide\s*Receiver(\s*\d+)?$/i, type: 'WR', label: 'WR', title: 'Wide Receiver' },
  { pattern: /^Tight\s*End(\s*\d+)?$/i, type: 'TE', label: 'TE', title: 'Tight End' },
  { pattern: /^(Flex\s*\(W\/R\/T\)|Flex\s*\(WRT\)|Flex|W\/R\/T|WRT)$/i, type: 'WRT', label: 'WRT', title: 'Flex (W/R/T)' },
  { pattern: /^(Superflex\s*\(QB\/W\/R\/T\)|Superflex\s*\(WRTQ\)|Superflex|Super\s*Flex|WRTQ|SF)$/i, type: 'WRTQ', label: 'WRTQ', title: 'Superflex (QB/W/R/T)' },
  { pattern: /^(Flex\s*\(W\/R\)|Flex\s*\(WR\/RB\)|WR\/RB|WRRB)$/i, type: 'WRRB', label: 'WR/RB', title: 'Flex (W/R)' },
  { pattern: /^(Flex\s*\(W\/T\)|Flex\s*\(WR\/TE\)|WR\/TE|WRTE)$/i, type: 'REC_FLEX', label: 'WR/TE', title: 'Flex (W/T)' },
  { pattern: /^(Kicker|K)$/i, type: 'K', label: 'K', title: 'Kicker' },
  { pattern: /^(Defense(\s*\/\s*Special\s*Teams)?|DEF|D\/ST)$/i, type: 'DEF', label: 'DEF', title: 'Defense / Special Teams' },
  { pattern: /^(Individual\s*Defensive\s*Player|IDP(\s*Flex)?)$/i, type: 'IDP', label: 'IDP', title: 'Individual Defensive Player' },
  { pattern: /^(Defensive\s*Lineman|DL)$/i, type: 'IDP', label: 'DL', title: 'Defensive Lineman' },
  { pattern: /^(Linebacker|LB)$/i, type: 'IDP', label: 'LB', title: 'Linebacker' },
  { pattern: /^(Defensive\s*Back|DB)$/i, type: 'IDP', label: 'DB', title: 'Defensive Back' },
];

/**
 * Normalizes a roster slot ID and/or name to its canonical type, label, and title.
 * Follows an anchored normalization order:
 * 1. BN / BENCH first
 * 2. Exact slotId lookup
 * 3. Exact slotName lookup
 * 4. Fallback passthrough
 */
export function normalizeRosterSlot(slotId?: string, slotName?: string): NormalizedSlot {
  const rawId = (slotId || '').trim();
  const rawName = (slotName || '').trim();

  // a. Check BN / BENCH first (anchored exact/numeric matching)
  if (/^(BN|BENCH)(\s*\d+)?$/i.test(rawId) || /^(BN|BENCH)(\s*\d+)?$/i.test(rawName)) {
    const matched = /^(BN|BENCH)(\s*\d+)?$/i.test(rawId) ? rawId : rawName;
    const benchSuffix = matched.replace(/^(BN|BENCH)\s*/i, '').trim();
    const title = (rawName && !/^(BN|BENCH)$/i.test(rawName)) ? rawName : (benchSuffix ? `Bench ${benchSuffix}` : 'Bench');
    return {
      type: 'BN',
      label: 'BN',
      title: title || 'Bench',
    };
  }

  // b. Exact lookup of slotId against known IDs
  if (rawId) {
    const upperId = rawId.toUpperCase();
    const fromId = KNOWN_SLOT_IDS[upperId];
    if (fromId) {
      const title = (rawName && rawName !== fromId.label) ? rawName : fromId.title;
      return {
        type: fromId.type,
        label: fromId.label,
        title,
      };
    }
    if (/^RB\d+$/i.test(rawId)) {
      return { type: 'RB', label: 'RB', title: rawName || `Running Back ${rawId.slice(2)}` };
    }
    if (/^WR\d+$/i.test(rawId)) {
      return { type: 'WR', label: 'WR', title: rawName || `Wide Receiver ${rawId.slice(2)}` };
    }
    if (/^TE\d+$/i.test(rawId)) {
      return { type: 'TE', label: 'TE', title: rawName || `Tight End ${rawId.slice(2)}` };
    }
  }

  // c. Exact lookup of slotName (or slotId if name empty) against known names
  for (const entry of KNOWN_SLOT_NAMES) {
    if ((rawName && entry.pattern.test(rawName)) || (rawId && entry.pattern.test(rawId))) {
      const title = (rawName && rawName !== entry.label) ? rawName : entry.title;
      return {
        type: entry.type,
        label: entry.label,
        title,
      };
    }
  }

  // d. Fallback to neutral passthrough that never throws or returns empty
  const fallback = rawName || rawId || 'SLOT';
  return {
    type: 'UNKNOWN',
    label: fallback,
    title: fallback,
  };
}

interface SlotStyleConfig {
  className: string;
  style?: Record<string, string | number | undefined>;
}

const SLOT_STYLES: Record<RosterSlotType, SlotStyleConfig> = {
  QB: {
    className: 'text-black font-black border-transparent',
    style: { backgroundColor: '#ff2a6d' },
  },
  RB: {
    className: 'text-black font-black border-transparent',
    style: { backgroundColor: '#00ceb8' },
  },
  WR: {
    className: 'text-black font-black border-transparent',
    style: { backgroundColor: '#00b0ff' },
  },
  TE: {
    className: 'text-black font-black border-transparent',
    style: { backgroundColor: '#ff9100' },
  },
  WRT: {
    className: 'text-black font-black border-transparent',
    style: {
      background: 'linear-gradient(90deg, #00b0ff 0%, #00b0ff 33.33%, #00ceb8 33.33%, #00ceb8 66.66%, #ff9100 66.66%, #ff9100 100%)',
    },
  },
  WRTQ: {
    className: 'text-black font-black border-transparent',
    style: {
      background: 'conic-gradient(from 0deg at 50% 50%, #00ceb8 0deg 90deg, #ff2a6d 90deg 180deg, #ff9100 180deg 270deg, #00b0ff 270deg 360deg)',
    },
  },
  WRRB: {
    className: 'text-black font-black border-transparent',
    style: { background: 'linear-gradient(90deg, #00b0ff 50%, #00ceb8 50%)' },
  },
  REC_FLEX: {
    className: 'text-black font-black border-transparent',
    style: { background: 'linear-gradient(90deg, #00b0ff 50%, #ff9100 50%)' },
  },
  IDP: {
    className: 'text-slate-300 font-bold bg-slate-800 border border-slate-700',
  },
  K: {
    className: 'text-slate-300 font-bold bg-slate-800 border border-slate-700',
  },
  DEF: {
    className: 'text-slate-300 font-bold bg-slate-800 border border-slate-700',
  },
  BN: {
    className: 'bg-slate-700 border border-slate-600 text-slate-200 font-bold',
  },
  UNKNOWN: {
    className: 'bg-slate-800 border border-slate-700 text-slate-300 font-bold',
  },
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 rounded min-w-8',
  md: 'text-xs px-2 py-0.5 rounded min-w-9',
  lg: 'text-sm px-2.5 py-1 rounded-md min-w-10',
};

export const RosterSlotBadge: React.FC<RosterSlotBadgeProps> = ({
  slotId,
  slotName,
  slotLabel,
  type,
  size = 'sm',
  className = '',
  style,
  dataTestId,
  'data-testid': propTestId,
  title,
}) => {
  const normalized = normalizeRosterSlot(slotId, slotName || slotLabel);
  const finalType = type || normalized.type;
  const labelText = (slotLabel !== undefined && slotLabel !== '') ? slotLabel : (normalized.label || 'SLOT');
  const finalTitle = title || normalized.title;
  const cfg = SLOT_STYLES[finalType] || SLOT_STYLES.UNKNOWN;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const testId = dataTestId || propTestId || `slot-badge-${finalType.toLowerCase()}`;
  const isUppercase = finalType !== 'UNKNOWN';

  const combinedStyle = cfg.style ? { ...cfg.style, ...style } : style;

  return (
    <span
      data-testid={testId}
      role="note"
      title={finalTitle}
      aria-label={finalTitle}
      style={combinedStyle}
      className={`inline-flex items-center justify-center font-mono ${isUppercase ? 'uppercase' : ''} tracking-wider select-none shrink-0 text-center leading-none ${sizeClass} ${cfg.className} ${className}`}
    >
      {labelText}
    </span>
  );
};

export default RosterSlotBadge;
