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

import React, { useMemo } from 'react';

const FIVE_POINT_STAR_POINTS =
  '12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9';

interface FloatingStarParticle {
  leftPct: number;
  topPx: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  bright: boolean;
}

function buildFloatingStars(seedKey: string): FloatingStarParticle[] {
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const nextRand = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };
  return Array.from({ length: 7 }, (_, i) => ({
    leftPct: Math.round(4 + ((i + nextRand() * 0.85) / 7) * 84),
    topPx: Math.round(-6 + nextRand() * 14),
    sizePx: Math.round(8 + nextRand() * 6),
    durationSec: Number((1.65 + nextRand() * 1.05).toFixed(2)),
    delaySec: Number((-0.15 - i * 0.28 - nextRand() * 0.18).toFixed(2)),
    bright: i % 2 === 1,
  }));
}

export interface PowerupStarsProps {
  seedKey: string;
  isUserTeam: boolean;
}

export const PowerupStars: React.FC<PowerupStarsProps> = ({ seedKey, isUserTeam }) => {
  const floatingStars = useMemo(() => buildFloatingStars(seedKey), [seedKey]);

  return (
    <div
      data-testid="oracle-powerup-stars"
      aria-hidden="true"
      className="pointer-events-none absolute -top-3 -inset-x-2 h-7 overflow-visible"
    >
      {floatingStars.map((star, idx) => (
        <svg
          key={idx}
          viewBox="0 0 24 24"
          width={star.sizePx}
          height={star.sizePx}
          style={{
            left: `${star.leftPct}%`,
            top: `${star.topPx}px`,
            animationDuration: `${star.durationSec}s`,
            animationDelay: `${star.delaySec}s`,
          }}
          className={`absolute animate-powerup-star-float motion-reduce:animate-none ${
            isUserTeam
              ? star.bright
                ? 'text-white drop-shadow-[0_0_6px_rgba(216,180,254,0.95)]'
                : 'text-purple-200 drop-shadow-[0_0_5px_rgba(192,132,252,0.85)]'
              : star.bright
                ? 'text-white drop-shadow-[0_0_6px_rgba(103,232,249,0.95)]'
                : 'text-cyan-200 drop-shadow-[0_0_5px_rgba(34,211,238,0.85)]'
          }`}
        >
          <polygon points={FIVE_POINT_STAR_POINTS} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
};

export default PowerupStars;
