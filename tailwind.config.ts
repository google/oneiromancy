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

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        oneiromancy: {
          obsidian: '#131318',
          surface: '#1a1a24',
          elevated: '#242436',
          purple: '#6d28d9',
          cyan: '#06b6d4',
          gold: '#eab308',
          green: '#10b981',
          wr: '#a855f7',
        },
        obsidian: {
          950: '#131318',
          900: '#1a1a24',
          800: '#242436',
          700: '#32324a',
        },
        nebula: {
          DEFAULT: '#6d28d9',
          light: '#8b5cf6',
          glow: 'rgba(109, 40, 217, 0.4)',
        },
        cyan: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
          glow: 'rgba(6, 182, 212, 0.4)',
        },
        pos: {
          qb: '#06b6d4',
          rb: '#10b981',
          wr: '#a855f7',
          te: '#eab308',
          flex: '#f43f5e',
          kdef: '#94a3b8',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 60s linear infinite',
        'spin-reverse': 'spin-reverse 40s linear infinite',
        'spin-inner': 'spin 20s linear infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
      },
      keyframes: {
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.4))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 16px rgba(6,182,212,0.8))' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
