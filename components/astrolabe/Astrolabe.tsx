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

import React from 'react';

export interface AstrolabeProps {
  size?: number;
  speedMultiplier?: number;
  lambda?: number;
  className?: string;
  showCenterReadout?: boolean;
}

export const Astrolabe: React.FC<AstrolabeProps> = ({
  size = 240,
  speedMultiplier,
  lambda = 0.35,
  className = '',
  showCenterReadout = true,
}) => {
  // Compute effective multiplier from speedMultiplier (if explicitly given) or lambda (0.0 to 1.0)
  const mult = speedMultiplier !== undefined 
    ? Math.max(0.1, speedMultiplier) 
    : Math.max(0.2, 1 + (lambda ?? 0.35) * 3);

  // Dynamic animation durations based on rotation speed multiplier
  const outerDuration = Math.max(3, 60 / mult);
  const middleDuration = Math.max(2.5, 40 / mult);
  const innerDuration = Math.max(1.5, 20 / mult);

  const currentLambda = lambda ?? 0.35;

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      data-testid="astrolabe"
      role="img"
      aria-label={`Celestial Astrolabe with speed multiplier ${mult.toFixed(2)}`}
    >
      {/* Outer Atmospheric Glow */}
      <div
        className="absolute inset-0 rounded-full blur-xl pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, rgba(6,182,212,${0.15 + 0.25 * currentLambda}) 0%, rgba(109,40,217,${0.2 + 0.3 * currentLambda}) 70%, transparent 100%)`,
        }}
      />

      <svg
        viewBox="0 0 300 300"
        width={size}
        height={size}
        className="relative overflow-visible"
      >
        {/* Outer Halo */}
        <circle
          cx="150"
          cy="150"
          r="146"
          fill="none"
          stroke="rgba(6,182,212,0.18)"
          strokeWidth="1"
          strokeDasharray="2, 6"
        />

        {/* Ring 1: Outer Zodiac & Celestial Degree Ticks (Rotates Clockwise) */}
        <g
          className="origin-center"
          style={{
            animation: `spin-cw ${outerDuration}s linear infinite`,
            transformOrigin: '150px 150px',
          }}
        >
          <circle
            cx="150"
            cy="150"
            r="138"
            fill="none"
            stroke="rgba(6,182,212,0.5)"
            strokeWidth="1.5"
          />
          <circle
            cx="150"
            cy="150"
            r="130"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="3, 5"
          />
          {/* 24 Celestial Degree Ticks & Cardinal Nodes */}
          {Array.from({ length: 24 }).map((_, i) => (
            <line
              key={`tick-${i}`}
              x1="150"
              y1="12"
              x2="150"
              y2={i % 6 === 0 ? '22' : i % 2 === 0 ? '19' : '16'}
              stroke={i % 6 === 0 ? '#06b6d4' : i % 2 === 0 ? 'rgba(6,182,212,0.7)' : 'rgba(255,255,255,0.3)'}
              strokeWidth={i % 6 === 0 ? '2.5' : i % 2 === 0 ? '1.5' : '1'}
              transform={`rotate(${i * 15} 150 150)`}
            />
          ))}
          {/* Zodiac Glyphs at Cardinal Positions */}
          <text x="150" y="27" textAnchor="middle" fill="#06b6d4" fontSize="10" fontFamily="sans-serif">♈</text>
          <text x="273" y="153" textAnchor="middle" fill="#06b6d4" fontSize="10" fontFamily="sans-serif">♋</text>
          <text x="150" y="278" textAnchor="middle" fill="#06b6d4" fontSize="10" fontFamily="sans-serif">♎</text>
          <text x="27" y="153" textAnchor="middle" fill="#06b6d4" fontSize="10" fontFamily="sans-serif">♑</text>
        </g>

        {/* Ring 2: Middle Divination & Aspect Chords (Rotates Counter-Clockwise) */}
        <g
          className="origin-center"
          style={{
            animation: `spin-ccw ${middleDuration}s linear infinite`,
            transformOrigin: '150px 150px',
          }}
        >
          <circle
            cx="150"
            cy="150"
            r="104"
            fill="none"
            stroke="rgba(109,40,217,0.6)"
            strokeWidth="1.5"
          />
          <circle
            cx="150"
            cy="150"
            r="96"
            fill="none"
            stroke="rgba(168,85,247,0.25)"
            strokeWidth="1"
            strokeDasharray="4, 4"
          />
          {/* Trine Aspect Chords (120-degree triangles) */}
          <polygon
            points="150,46 240,202 60,202"
            fill="none"
            stroke="rgba(109,40,217,0.4)"
            strokeWidth="1.5"
          />
          <polygon
            points="150,254 60,98 240,98"
            fill="none"
            stroke="rgba(6,182,212,0.3)"
            strokeWidth="1.5"
          />
          {/* Planetary nodes */}
          <circle cx="150" cy="46" r="3.5" fill="#6d28d9" stroke="#fff" strokeWidth="0.8" />
          <circle cx="240" cy="202" r="3.5" fill="#06b6d4" stroke="#fff" strokeWidth="0.8" />
          <circle cx="60" cy="202" r="3.5" fill="#eab308" stroke="#fff" strokeWidth="0.8" />
        </g>

        {/* Ring 3: Inner Sacred Geometry Ring (Rotates Clockwise) */}
        <g
          className="origin-center"
          style={{
            animation: `spin-cw ${innerDuration}s linear infinite`,
            transformOrigin: '150px 150px',
          }}
        >
          <circle
            cx="150"
            cy="150"
            r="70"
            fill="none"
            stroke="rgba(234,179,8,0.5)"
            strokeWidth="1.5"
          />
          <circle
            cx="150"
            cy="150"
            r="62"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            strokeDasharray="2, 3"
          />
          {/* Hexagram geometry */}
          <polygon
            points="150,80 210,185 90,185"
            fill="none"
            stroke="rgba(234,179,8,0.3)"
            strokeWidth="1"
          />
          <polygon
            points="150,220 90,115 210,115"
            fill="none"
            stroke="rgba(16,185,129,0.3)"
            strokeWidth="1"
          />
        </g>

        {/* Center Eye: Chaos Telemetry Core */}
        <circle
          cx="150"
          cy="150"
          r="32"
          fill="#131318"
          stroke="#06b6d4"
          strokeWidth="2"
        />
        <circle
          cx="150"
          cy="150"
          r="26"
          fill="rgba(6,182,212,0.12)"
          stroke="rgba(109,40,217,0.4)"
          strokeWidth="1"
        />
        <circle
          cx="150"
          cy="150"
          r="8"
          fill="#6d28d9"
          className="animate-pulse"
        />
      </svg>

      {/* Floating Center Telemetry Readout */}
      {showCenterReadout && (
        <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
            {speedMultiplier !== undefined ? 'SPEED' : 'λ FACTOR'}
          </span>
          <span className="text-xs font-mono text-white font-bold tracking-tight">
            {speedMultiplier !== undefined ? `${mult.toFixed(1)}x` : currentLambda.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default Astrolabe;
